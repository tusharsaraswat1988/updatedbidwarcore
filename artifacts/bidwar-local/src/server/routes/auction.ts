import { Router, type Response, type NextFunction, type Request } from "express";
import { randomUUID } from "node:crypto";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { validateBidAmount } from "@workspace/api-base/auction-bid";
import {
  parseReAuctionStrategy,
  parseReAuctionStrategyFromRequest,
  resolveOpeningBid,
  serializeReAuctionStrategy,
  validateFixedReAuctionAmount,
} from "@workspace/api-base/re-auction-strategy";
import { pickRandomPlayerFromPool } from "@workspace/api-base/auction-player-selection";
import {
  tournamentToReadinessInput,
  validateAuctionReadiness,
} from "@workspace/api-base/auction-readiness";
import type { LocalDb } from "@workspace/db-local";
import {
  auctionSessionsTable, playersTable, teamsTable, bidsTable, tournamentsTable,
  purseBoostersTable, categoriesTable,
} from "@workspace/db-local";
import { CHEER_DEFAULT_PRESETS } from "@workspace/cheer-presets";
import {
  computeEffectiveCapacity,
  getActiveBoosterTotal,
  validateCancelBooster,
} from "../lib/purse-capacity.js";
import {
  createLedPurseBoosterOverlay,
  parseLedPurseBoosterOverlay,
  replayLedPurseBoosterOverlay,
  type LedPurseBoosterTeamLine,
} from "@workspace/api-base";
import { mirrorStateToCloud } from "../mirror.js";
import { fetchCloudVenueGuard, releaseVenueAuctionOnCloud } from "../lib/venue-guard.js";

// SSE client registry (in-process, no separate broadcast module needed)
const sseClients = new Map<number, Set<Response>>();

const cheerRateLimiter = new Map<string, number>();
const fanBattleCounters = new Map<number, Map<number, number>>();
const recentCheerTimestamps = new Map<number, number[]>();

setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [ip, ts] of cheerRateLimiter) {
    if (ts < cutoff) cheerRateLimiter.delete(ip);
  }
}, 60_000);

function getHeatLevel(tournamentId: number): string {
  const timestamps = recentCheerTimestamps.get(tournamentId) ?? [];
  const cutoff = Date.now() - 30_000;
  const recent = timestamps.filter((t) => t > cutoff).length;
  if (recent >= 13) return "WAR MODE";
  if (recent >= 7) return "HEATED";
  if (recent >= 3) return "ACTIVE";
  return "CALM";
}

type PlayerSelectionMode = "sequential" | "random" | "manual";

function normalizePlayerSelectionMode(mode: string | null | undefined): PlayerSelectionMode {
  if (mode === "random" || mode === "manual") return mode;
  return "sequential";
}

function selectPlayerFromPool(
  pool: { id: number }[],
  mode: PlayerSelectionMode | undefined,
  session: { randomDrawQueue?: string | null; currentPlayerId?: number | null },
): { playerId: number; randomDrawQueue: string | null } | null {
  if (pool.length === 0) return null;
  if (mode === "random") {
    const pick = pickRandomPlayerFromPool(pool, {
      queueJson: session.randomDrawQueue,
      lastPlayerId: session.currentPlayerId,
    });
    return { playerId: pick.playerId, randomDrawQueue: pick.queueJson };
  }
  return {
    playerId: pool.reduce((a, b) => (a.id < b.id ? a : b)).id,
    randomDrawQueue: null,
  };
}

function addSseClient(tid: number, res: Response) {
  if (!sseClients.has(tid)) sseClients.set(tid, new Set());
  sseClients.get(tid)!.add(res);
  return res;
}

function removeSseClient(tid: number, res: Response) {
  sseClients.get(tid)?.delete(res);
}

function broadcastToTournament(tid: number, payload: unknown) {
  const json = JSON.stringify(payload);
  sseClients.get(tid)?.forEach(res => {
    try { res.write(`data: ${json}\n\n`); } catch { /* client disconnected */ }
  });
}

type BidTier = { upTo?: number; increment: number };

function parseBidTiers(tiersJson: string | null | undefined, fallback: {
  bidTier1UpTo: number; bidTier1Increment: number;
  bidTier2UpTo: number; bidTier2Increment: number;
  bidTier3Increment: number;
}): BidTier[] {
  if (tiersJson) {
    try {
      const parsed = JSON.parse(tiersJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as BidTier[];
    } catch { /* ignore */ }
  }
  return [
    { upTo: fallback.bidTier1UpTo, increment: fallback.bidTier1Increment },
    { upTo: fallback.bidTier2UpTo, increment: fallback.bidTier2Increment },
    { increment: fallback.bidTier3Increment },
  ];
}

function computeTieredIncrement(currentBid: number, tiers: BidTier[]): number {
  for (const tier of tiers) {
    if (tier.upTo === undefined || currentBid < tier.upTo) return tier.increment;
  }
  return tiers[tiers.length - 1]?.increment ?? 50000;
}

import { resolveOfflineUrl } from "../lib/offline-media.js";

const playerToJson = (p: typeof playersTable.$inferSelect) => ({
  id: p.id, tournamentId: p.tournamentId, categoryId: p.categoryId, teamId: p.teamId,
  name: p.name, city: p.city, role: p.role, battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle, specialization: p.specialization, age: p.age,
  gender: p.gender ?? null,
  photoUrl: resolveOfflineUrl(p.photoUrl), basePrice: p.basePrice, soldPrice: p.soldPrice,
  retainedPrice: p.retainedPrice, status: p.status, jerseyNumber: p.jerseyNumber,
  achievements: p.achievements, mobileNumber: p.mobileNumber, cricheroUrl: p.cricheroUrl,
  availabilityDates: p.availabilityDates, createdAt: p.createdAt,
});

export function createAuctionRouter(db: LocalDb) {
  const router = Router();

  async function getOrCreateSession(tournamentId: number) {
    let [session] = await db.select().from(auctionSessionsTable)
      .where(eq(auctionSessionsTable.tournamentId, tournamentId));
    if (!session) {
      const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
      const timerSeconds = tournament?.timerSeconds ?? 30;
      [session] = await db.insert(auctionSessionsTable).values({
        tournamentId, status: "idle", timerSeconds, soldPlayersCount: 0, unsoldPlayersCount: 0,
      }).returning();
    }
    return session;
  }

  const AUCTION_PAUSED_ERROR = "Auction is paused. Resume the auction before continuing.";

  function rejectIfAuctionPaused(
    session: { status: string },
    res: Response,
  ): boolean {
    if (session.status === "paused") {
      res.status(409).json({ error: AUCTION_PAUSED_ERROR });
      return true;
    }
    return false;
  }

  async function resolvePlayerOpeningBid(
    tournamentId: number,
    player: {
      basePrice: number;
      categoryId: number | null;
    },
    reAuctionStrategyJson?: string | null,
  ): Promise<number> {
    const [tournamentRow] = await db
      .select({ minBid: tournamentsTable.minBid })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId));

    let categoryMinBid: number | null = null;
    if (player.categoryId) {
      const [cat] = await db
        .select({ minBid: categoriesTable.minBid })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, player.categoryId));
      categoryMinBid = cat?.minBid ?? null;
    }

    return resolveOpeningBid({
      strategy: parseReAuctionStrategy(reAuctionStrategyJson),
      playerBasePrice: player.basePrice,
      categoryMinBid,
      tournamentMinBid: tournamentRow?.minBid ?? 0,
    });
  }

  async function handleAvailablePoolExhausted(tid: number): Promise<void> {
    const allPlayers = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tid));

    const unsoldCount = allPlayers.filter((p) => p.status === "unsold").length;
    const auctionable = allPlayers.filter((p) => p.status !== "retained");
    const allSold =
      auctionable.length > 0 && auctionable.every((p) => p.status === "sold");

    if (allSold || (unsoldCount === 0 && auctionable.length > 0)) {
      await db
        .update(auctionSessionsTable)
        .set({
          status: "completed",
          currentPlayerId: null,
          currentBid: null,
          currentBidTeamId: null,
          timerEndsAt: null,
          deferredPlayerIds: null,
          randomDrawQueue: null,
          lastAction: "Auction completed — all players sold",
        })
        .where(eq(auctionSessionsTable.tournamentId, tid));
      await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
      return;
    }

    if (unsoldCount > 0) {
      await db
        .update(auctionSessionsTable)
        .set({
          status: "active",
          currentPlayerId: null,
          currentBid: null,
          currentBidTeamId: null,
          timerEndsAt: null,
          randomDrawQueue: null,
          lastAction: `Main round complete — ${unsoldCount} unsold player${unsoldCount !== 1 ? "s" : ""} remaining`,
        })
        .where(eq(auctionSessionsTable.tournamentId, tid));
      return;
    }

    await db
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        deferredPlayerIds: null,
        randomDrawQueue: null,
        lastAction: "Auction completed",
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
  }

  async function buildAuctionState(tournamentId: number) {
    const session = await getOrCreateSession(tournamentId);
    const [tournamentRow] = await db.select({
      playerSelectionMode: tournamentsTable.playerSelectionMode,
      timerSeconds: tournamentsTable.timerSeconds,
      bidTimerSeconds: tournamentsTable.bidTimerSeconds,
      bidTier1UpTo: tournamentsTable.bidTier1UpTo,
      bidTier1Increment: tournamentsTable.bidTier1Increment,
      bidTier2UpTo: tournamentsTable.bidTier2UpTo,
      bidTier2Increment: tournamentsTable.bidTier2Increment,
      bidTier3Increment: tournamentsTable.bidTier3Increment,
      bidTiers: tournamentsTable.bidTiers,
    }).from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));

    const timerSeconds = tournamentRow?.timerSeconds ?? 30;
    const bidTimerSeconds = tournamentRow?.bidTimerSeconds ?? 15;
    const tiers = parseBidTiers(tournamentRow?.bidTiers, {
      bidTier1UpTo: tournamentRow?.bidTier1UpTo ?? 100000,
      bidTier1Increment: tournamentRow?.bidTier1Increment ?? 25000,
      bidTier2UpTo: tournamentRow?.bidTier2UpTo ?? 200000,
      bidTier2Increment: tournamentRow?.bidTier2Increment ?? 50000,
      bidTier3Increment: tournamentRow?.bidTier3Increment ?? 100000,
    });

    let currentPlayer = null;
    const bidIncrement = computeTieredIncrement(session.currentBid ?? 0, tiers);

    if (session.currentPlayerId) {
      const [p] = await db.select().from(playersTable).where(eq(playersTable.id, session.currentPlayerId));
      if (p) currentPlayer = playerToJson(p);
    }

    let currentBidTeamName = null, currentBidTeamColor = null, currentBidTeamLogoUrl = null;
    if (session.currentBidTeamId) {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, session.currentBidTeamId));
      if (team) {
        currentBidTeamName = team.name;
        currentBidTeamColor = team.color;
        currentBidTeamLogoUrl = resolveOfflineUrl(team.logoUrl);
      }
    }

    const allPlayers = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tournamentId));
    const soldCount = allPlayers.filter(p => p.status === "sold").length;
    const unsoldCount = allPlayers.filter(p => p.status === "unsold").length;
    const availableCount = allPlayers.filter(p => p.status === "available").length;

    let wheelItems: { label: string; color: string }[] = [];
    try { if (session.wheelItemsJson) wheelItems = JSON.parse(session.wheelItemsJson); } catch { /* ignore */ }

    let activeCategoryIds: number[] | null = null;
    try { if (session.activeCategoryIds) activeCategoryIds = JSON.parse(session.activeCategoryIds); } catch { /* ignore */ }

    let deferredPlayerIds: number[] = [];
    try { if (session.deferredPlayerIds) deferredPlayerIds = JSON.parse(session.deferredPlayerIds); } catch { /* ignore */ }

    let displayPlayerFilter: { status: string; categoryId: number | null; teamId: number | null } | undefined;
    if (session.displayPlayerFilter) {
      try { displayPlayerFilter = JSON.parse(session.displayPlayerFilter); } catch { /* ignore */ }
    }

    let displayCountdown: { type: string; endsAt: string; message: string | null; musicMuted?: boolean } | null = null;
    if (session.displayCountdown) {
      try {
        const parsed = JSON.parse(session.displayCountdown) as {
          type: string;
          endsAt: string;
          message: string | null;
          musicMuted?: boolean;
        };
        if (parsed && new Date(parsed.endsAt) > new Date()) displayCountdown = parsed;
      } catch { /* ignore */ }
    }

    let lastPurseBooster: {
      id: number;
      teamId: number;
      teamName: string;
      amount: number;
      previousCapacity: number;
      newCapacity: number;
      appliedAt: string;
    } | null = null;
    if (session.lastPurseBoosterJson) {
      try { lastPurseBooster = JSON.parse(session.lastPurseBoosterJson); } catch { /* ignore */ }
    }

    let ledPurseBoosterOverlay = parseLedPurseBoosterOverlay(session.lastLedToastJson);
    let ledPurseToast: { teamName: string; expiresAt?: string } | null = null;
    if (!ledPurseBoosterOverlay && session.lastLedToastJson) {
      try {
        const parsed = JSON.parse(session.lastLedToastJson) as { teamName: string; expiresAt: string };
        if (parsed?.teamName && parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          ledPurseToast = { teamName: parsed.teamName, expiresAt: parsed.expiresAt };
        }
      } catch { /* ignore legacy */ }
    }

    let outcome: {
      type: "sold" | "unsold";
      playerId?: number | null;
      playerName?: string | null;
      photoUrl?: string | null;
      teamId?: number | null;
      teamName?: string | null;
      teamColor?: string | null;
      amount?: number | null;
    } | null = null;
    const action = session.lastAction?.trim();
    if (action?.startsWith("UNSOLD:")) {
      const playerName = action.replace(/^UNSOLD:\s*/, "") || "Player";
      const unsoldPlayer = allPlayers.find((p) => p.status === "unsold" && p.name === playerName);
      outcome = {
        type: "unsold",
        playerId: unsoldPlayer?.id ?? null,
        playerName,
        photoUrl: resolveOfflineUrl(unsoldPlayer?.photoUrl ?? null),
      };
    } else if (action?.startsWith("SOLD")) {
      outcome = { type: "sold" };
    }

    return {
      tournamentId, status: session.status, currentPlayer,
      currentBid: session.currentBid, currentBidTeamId: session.currentBidTeamId,
      currentBidTeamName, currentBidTeamColor, currentBidTeamLogoUrl,
      bidIncrement, timerSeconds, bidTimerSeconds, timerEndsAt: session.timerEndsAt,
      lastAction: session.lastAction, outcome, soldPlayersCount: soldCount,
      unsoldPlayersCount: unsoldCount, remainingPlayersCount: availableCount,
      fortuneWheelActive: session.fortuneWheelActive,
      wheelSpinning: session.wheelSpinning ?? false,
      wheelItems,
      wheelWinner: session.wheelSpinning ? null : session.wheelWinner,
      teamPurseViewActive: session.teamPurseViewActive,
      displayOverlay: session.displayOverlay ?? null,
      displayPlayerFilter,
      isBreak: session.isBreak ?? false,
      breakEndsAt: session.breakEndsAt ?? null,
      displayCountdown,
      activeCategoryIds, playerSelectionMode: tournamentRow?.playerSelectionMode ?? "sequential",
      licenseStatus: "active",
      trialTeamIds: null,
      deferredPlayerIds: deferredPlayerIds.length > 0 ? deferredPlayerIds : null,
      lastPurseBooster,
      ledPurseToast,
      ledPurseBoosterOverlay,
      lastAuctionActivityAt: session.updatedAt ?? null,
    };
  }

  async function broadcastState(tournamentId: number, invalidate: string[] = []) {
    const state = await buildAuctionState(tournamentId);
    broadcastToTournament(tournamentId, { type: "auction_state", state, invalidate });
    mirrorStateToCloud(db, tournamentId);
    return state;
  }

  // Operator PIN middleware — applied to all mutating auction routes.
  // If the tournament has an operatorPin set, callers must supply the correct
  // value in the X-Operator-Pin header. GET requests and the /bid endpoint
  // (which uses team access codes instead) are always allowed through.
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") { next(); return; }
    const match = /\/tournaments\/(\d+)\/(?:auction|purse-boosters)/.exec(req.path);
    if (!match) { next(); return; }
    // Bid route authenticates with team access codes — skip PIN check
    if (req.path.endsWith("/bid")) { next(); return; }
    const tid = parseInt(match[1]);
    if (!tid) { next(); return; }
    const [t] = await db
      .select({ operatorPin: tournamentsTable.operatorPin })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid));
    if (!t?.operatorPin) { next(); return; } // No PIN configured — open LAN access
    const provided = req.headers["x-operator-pin"] as string | undefined;
    if (provided === t.operatorPin) { next(); return; }
    res.status(401).json({ error: "Operator PIN required. Include X-Operator-Pin header." });
  });

  // GET SSE stream
  router.get("/tournaments/:tournamentId/auction/events", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    addSseClient(tid, res);
    const state = await buildAuctionState(tid);
    res.write(`data: ${JSON.stringify({ type: "auction_state", state, invalidate: [] })}\n\n`);
    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
    }, 20000);
    req.on("close", () => { clearInterval(heartbeat); removeSseClient(tid, res); });
  });

  // GET auction state
  router.get("/tournaments/:tournamentId/auction", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    res.json(await buildAuctionState(tid));
  });

  // POST start / resume
  router.post("/tournaments/:tournamentId/auction/start", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const session = await getOrCreateSession(tid);
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

    if (session.status === "idle" && tournament) {
      const cloudGuard = await fetchCloudVenueGuard(tournament);
      if (cloudGuard?.blockLocalStart) {
        res.status(409).json({ error: cloudGuard.reason ?? "Cloud auction is already running." });
        return;
      }

      const [{ count: teamCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, tid));
      const [{ count: playerCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, tid));

      const issues = validateAuctionReadiness(
        tournamentToReadinessInput(tournament, teamCount, playerCount),
        "live",
      );
      if (issues.length > 0) {
        res.status(400).json({
          error: "Auction is not ready.",
          issues: issues.map((i) => i.message),
        });
        return;
      }
    }

    const timerSecs = tournament?.timerSeconds ?? 30;
    const patch: Record<string, unknown> = { status: "active", lastAction: "Auction resumed", timerSeconds: timerSecs };
    if (session.pausedTimeRemaining && session.pausedTimeRemaining > 0 && session.currentPlayerId) {
      patch.timerEndsAt = new Date(Date.now() + session.pausedTimeRemaining * 1000).toISOString();
      patch.pausedTimeRemaining = null;
    }
    await db.update(auctionSessionsTable).set(patch).where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));
    res.json(await broadcastState(tid));
  });

  // POST pause
  router.post("/tournaments/:tournamentId/auction/pause", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const session = await getOrCreateSession(tid);
    let pausedTimeRemaining: number | null = null;
    if (session.timerEndsAt) {
      const remaining = Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000);
      pausedTimeRemaining = remaining > 0 ? remaining : null;
    }
    await db.update(auctionSessionsTable)
      .set({ status: "paused", lastAction: "Auction paused", timerEndsAt: null, pausedTimeRemaining })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "paused" }).where(eq(tournamentsTable.id, tid));
    res.json(await broadcastState(tid));
  });

  // POST next player
  router.post("/tournaments/:tournamentId/auction/next-player", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      playerId: z.number().int().optional(),
      mode: z.enum(["sequential", "random", "manual"]).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { playerId, mode } = parsed.data;
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    const timerSecs = tournament?.timerSeconds ?? 30;
    const session = await getOrCreateSession(tid);
    if (session.currentPlayerId) {
      res.status(400).json({ error: "Finish the current player (Sold, Unsold, or Defer) before loading the next player" });
      return;
    }
    if (session.timerEndsAt && new Date(session.timerEndsAt).getTime() > Date.now()) {
      res.status(400).json({ error: "Stop bidding before loading the next player" });
      return;
    }

    let activeCatIds: number[] | null = null;
    try { if (session.activeCategoryIds) activeCatIds = JSON.parse(session.activeCategoryIds); } catch { /* ignore */ }

    let deferredIds: number[] = [];
    try { if (session.deferredPlayerIds) deferredIds = JSON.parse(session.deferredPlayerIds); } catch { /* ignore */ }

    const effectiveMode = mode ?? normalizePlayerSelectionMode(tournament?.playerSelectionMode);

    let selectedPlayerId: number | null = null;
    let newDeferredIds = deferredIds;
    let newRandomDrawQueue: string | null = session.randomDrawQueue ?? null;
    if (playerId) {
      selectedPlayerId = playerId;
      newRandomDrawQueue = null;
      if (deferredIds.includes(playerId)) {
        newDeferredIds = deferredIds.filter((id) => id !== playerId);
      }
    } else {
      const baseConditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
      const allAvailable =
        activeCatIds && activeCatIds.length > 0
          ? await db
              .select()
              .from(playersTable)
              .where(
                and(
                  ...baseConditions,
                  inArray(playersTable.categoryId as Parameters<typeof inArray>[0], activeCatIds),
                ),
              )
          : await db.select().from(playersTable).where(and(...baseConditions));

      const nonDeferred = allAvailable.filter((p) => !deferredIds.includes(p.id));
      const pool =
        nonDeferred.length > 0
          ? nonDeferred
          : allAvailable.filter((p) => deferredIds.includes(p.id));

      const pick = selectPlayerFromPool(pool, effectiveMode, session);
      if (pick) {
        selectedPlayerId = pick.playerId;
        newRandomDrawQueue = pick.randomDrawQueue;
        if (deferredIds.includes(pick.playerId)) {
          newDeferredIds = deferredIds.filter((id) => id !== pick.playerId);
        }
      }
    }

    if (!selectedPlayerId) {
      await handleAvailablePoolExhausted(tid);
      res.json(await broadcastState(tid, ["players"]));
      return;
    }

    const [selectedPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, selectedPlayerId));
    const openingBid = await resolvePlayerOpeningBid(tid, selectedPlayer, session.reAuctionStrategyJson);
    await db.update(auctionSessionsTable).set({
      status: "active", currentPlayerId: selectedPlayerId,
      currentBid: openingBid, currentBidTeamId: null,
      timerSeconds: timerSecs, timerEndsAt: null, pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
      randomDrawQueue: newRandomDrawQueue,
      lastAction: `Now bidding: ${selectedPlayer.name}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["players"]));
  });

  // POST place bid
  router.post("/tournaments/:tournamentId/auction/bid", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({ teamId: z.number().int(), amount: z.number().int(), accessCode: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { teamId, amount, accessCode } = parsed.data;
    const session = await getOrCreateSession(tid);
    if (!session.currentPlayerId) { res.status(400).json({ error: "No player currently up for bid" }); return; }
    if (session.status !== "active") { res.status(400).json({ error: "Auction is not active" }); return; }
    if (!session.timerEndsAt || new Date(session.timerEndsAt).getTime() <= Date.now()) {
      res.status(400).json({ error: "Bidding is not open — operator must start the timer first" }); return;
    }

    const [tournamentRow] = await db.select({
      bidTier1UpTo: tournamentsTable.bidTier1UpTo,
      bidTier1Increment: tournamentsTable.bidTier1Increment,
      bidTier2UpTo: tournamentsTable.bidTier2UpTo,
      bidTier2Increment: tournamentsTable.bidTier2Increment,
      bidTier3Increment: tournamentsTable.bidTier3Increment,
      bidTiers: tournamentsTable.bidTiers,
    }).from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    const tiers = parseBidTiers(tournamentRow?.bidTiers, {
      bidTier1UpTo: tournamentRow?.bidTier1UpTo ?? 100000,
      bidTier1Increment: tournamentRow?.bidTier1Increment ?? 25000,
      bidTier2UpTo: tournamentRow?.bidTier2UpTo ?? 200000,
      bidTier2Increment: tournamentRow?.bidTier2Increment ?? 50000,
      bidTier3Increment: tournamentRow?.bidTier3Increment ?? 100000,
    });
    const bidIncrement = computeTieredIncrement(session.currentBid ?? 0, tiers);
    const bidValidation = validateBidAmount(amount, {
      currentBid: session.currentBid,
      bidIncrement,
      currentBidTeamId: session.currentBidTeamId,
    });
    if (!bidValidation.ok) {
      res.status(400).json({ error: bidValidation.error });
      return;
    }

    if (session.currentBidTeamId === teamId) { res.status(409).json({ error: "Your team is already the highest bidder" }); return; }
    const [team] = await db.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
    if (!team) {
      const [foreign] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.id, teamId));
      res.status(foreign ? 403 : 404).json({ error: foreign ? "Team does not belong to this tournament" : "Team not found" });
      return;
    }
    // Access code check — if the team has one set, the caller must supply it
    if (team.accessCode) {
      if (!accessCode || team.accessCode.toUpperCase() !== accessCode.toUpperCase()) {
        res.status(403).json({ error: "Invalid team access code" }); return;
      }
    }
    if (!team.isBiddingEnabled) { res.status(400).json({ error: "Bidding disabled for this team" }); return; }
    const boosterTotal = await getActiveBoosterTotal(db, tid, teamId);
    const spendable = computeEffectiveCapacity(team.purse, boosterTotal) - team.purseUsed;
    if (amount > spendable) { res.status(400).json({ error: "Insufficient purse" }); return; }
    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    const bidTimerSecs = tournament?.bidTimerSeconds ?? 15;
    const newTimerEndsAt = new Date(Date.now() + bidTimerSecs * 1000).toISOString();
    await db.update(auctionSessionsTable).set({
      currentBid: amount, currentBidTeamId: teamId, timerEndsAt: newTimerEndsAt,
      pausedTimeRemaining: null,
      lastAction: `${team.name} bid ₹${amount.toLocaleString("en-IN")}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST sell player
  router.post("/tournaments/:tournamentId/auction/sell", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    if (!session.currentPlayerId || !session.currentBidTeamId) {
      res.status(400).json({ error: "No current player or bidder" }); return;
    }
    const playerId = session.currentPlayerId;
    const teamId = session.currentBidTeamId;
    const soldAmount = session.currentBid ?? 0;
    await db.update(playersTable).set({ status: "sold", teamId, soldPrice: soldAmount }).where(eq(playersTable.id, playerId));
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    await db.update(teamsTable).set({ purseUsed: (team?.purseUsed ?? 0) + soldAmount }).where(eq(teamsTable.id, teamId));
    await db.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount: soldAmount });
    const [soldPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    await db.update(auctionSessionsTable).set({
      currentPlayerId: null, currentBid: null, currentBidTeamId: null,
      timerEndsAt: null, pausedTimeRemaining: null,
      lastAction: `SOLD: ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${soldAmount.toLocaleString("en-IN")}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["bids", "purses", "players"]));
  });

  // POST manual sell
  router.post("/tournaments/:tournamentId/auction/manual-sell", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({ teamId: z.number().int(), amount: z.number().int().min(0) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { teamId, amount } = parsed.data;
    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }
    const playerId = session.currentPlayerId;
    const [teamRow] = await db.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
    if (!teamRow) {
      const [foreign] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.id, teamId));
      res.status(foreign ? 403 : 404).json({ error: foreign ? "Team does not belong to this tournament" : "Team not found" });
      return;
    }
    await db.update(playersTable).set({ status: "sold", teamId, soldPrice: amount }).where(eq(playersTable.id, playerId));
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (team && amount > 0) {
      await db.update(teamsTable).set({ purseUsed: (team.purseUsed ?? 0) + amount }).where(eq(teamsTable.id, teamId));
    }
    if (amount > 0) {
      await db.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount });
    }
    const [soldPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    await db.update(auctionSessionsTable).set({
      currentPlayerId: null, currentBid: null, currentBidTeamId: null,
      timerEndsAt: null, pausedTimeRemaining: null,
      lastAction: `SOLD (manual): ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${amount.toLocaleString("en-IN")}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["bids", "purses", "players"]));
  });

  // POST mark unsold
  router.post("/tournaments/:tournamentId/auction/unsold", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, session.currentPlayerId));
    await db.update(playersTable).set({ status: "unsold" }).where(eq(playersTable.id, session.currentPlayerId));
    await db.update(auctionSessionsTable).set({
      currentPlayerId: null, currentBid: null, currentBidTeamId: null,
      timerEndsAt: null, pausedTimeRemaining: null,
      lastAction: `UNSOLD: ${player?.name ?? "Player"}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["players"]));
  });

  // POST re-auction a specific player
  router.post("/tournaments/:tournamentId/auction/re-auction", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({ playerId: z.number().int(), startFromBase: z.boolean().optional().default(true) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { playerId, startFromBase } = parsed.data;
    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    if (session.currentPlayerId && session.currentPlayerId !== playerId) {
      res.status(400).json({ error: "A player is currently on the block. Conclude or defer them before re-auctioning another player." });
      return;
    }
    const [player] = await db.select().from(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }
    if (player.status === "sold" && player.teamId && player.soldPrice) {
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
      if (team) {
        await db.update(teamsTable).set({ purseUsed: Math.max(0, team.purseUsed - player.soldPrice) }).where(eq(teamsTable.id, player.teamId));
      }
      await db.delete(bidsTable).where(and(eq(bidsTable.playerId, playerId), eq(bidsTable.tournamentId, tid)));
    }
    const startingBid = startFromBase ? player.basePrice : (player.soldPrice ?? player.basePrice);
    await db.update(playersTable).set({ status: "available", teamId: null, soldPrice: null }).where(eq(playersTable.id, playerId));
    const [reTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    const timerSecs = reTournament?.timerSeconds ?? 30;
    await db.update(auctionSessionsTable).set({
      status: "active", currentPlayerId: playerId, currentBid: startingBid,
      currentBidTeamId: null, timerSeconds: timerSecs, timerEndsAt: null,
      randomDrawQueue: null,
      lastAction: `RE-AUCTION: ${player.name}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["bids", "purses", "players"]));
  });

  // POST re-auction all unsold
  router.post("/tournaments/:tournamentId/auction/re-auction-unsold", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const bodySchema = z.object({
      strategy: z.enum(["keep_existing", "reset_defaults", "fixed"]).optional(),
      fixedAmount: z.number().int().optional(),
    });
    const bodyParsed = bodySchema.safeParse(req.body ?? {});
    if (!bodyParsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const strategyResult = parseReAuctionStrategyFromRequest(bodyParsed.data);
    if (!strategyResult.ok) { res.status(400).json({ error: strategyResult.error }); return; }

    const [tournamentForStrategy] = await db
      .select({ minBid: tournamentsTable.minBid })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid));

    if (strategyResult.strategy.mode === "fixed") {
      const fixedValidation = validateFixedReAuctionAmount(
        strategyResult.strategy.fixedAmount ?? 0,
        tournamentForStrategy?.minBid ?? 0,
      );
      if (!fixedValidation.ok) {
        res.status(400).json({ error: fixedValidation.error });
        return;
      }
      strategyResult.strategy.fixedAmount = fixedValidation.amount;
    }

    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    const unsoldPlayers = await db.select().from(playersTable)
      .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.status, "unsold")));
    if (unsoldPlayers.length === 0) { res.status(400).json({ error: "No unsold players to re-auction" }); return; }
    for (const p of unsoldPlayers) {
      await db.update(playersTable).set({ status: "available" }).where(eq(playersTable.id, p.id));
    }
    await db.update(auctionSessionsTable)
      .set({
        randomDrawQueue: null,
        reAuctionStrategyJson: serializeReAuctionStrategy(strategyResult.strategy),
        lastAction: `RE-AUCTION ROUND: ${unsoldPlayers.length} unsold players returned to queue`,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["players"]));
  });

  // POST conclude auction — operator explicitly ends the auction
  router.post("/tournaments/:tournamentId/auction/conclude", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const body = z.object({ force: z.boolean().optional().default(false) }).safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

    await getOrCreateSession(tid);
    const allPlayers = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tid));
    const soldCount = allPlayers.filter((p) => p.status === "sold").length;
    const unsoldCount = allPlayers.filter((p) => p.status === "unsold").length;

    if (unsoldCount > 0 && !body.data.force) {
      res.status(409).json({
        error: "Unsold players remain",
        requiresConfirmation: true,
        soldPlayersCount: soldCount,
        unsoldPlayersCount: unsoldCount,
      });
      return;
    }

    await db
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        pausedTimeRemaining: null,
        deferredPlayerIds: null,
        randomDrawQueue: null,
        reAuctionStrategyJson: null,
        displayCountdown: null,
        lastAction:
          unsoldCount > 0
            ? `Auction concluded by operator — ${unsoldCount} unsold player${unsoldCount !== 1 ? "s" : ""} remain`
            : "Auction concluded by operator",
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));

    releaseVenueAuctionOnCloud(db, tid);

    res.json(await broadcastState(tid, ["players"]));
  });

  // POST reset auction
  router.post("/tournaments/:tournamentId/auction/reset-trial", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const allPlayers = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tid));
    for (const p of allPlayers) {
      if (p.status !== "retained") {
        await db.update(playersTable).set({ status: "available", teamId: null, soldPrice: null }).where(eq(playersTable.id, p.id));
      }
    }
    const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
    for (const team of teams) {
      const retainedCost = allPlayers.filter(p => p.status === "retained" && p.teamId === team.id)
        .reduce((s, p) => s + (p.retainedPrice ?? 0), 0);
      await db.update(teamsTable).set({ purseUsed: retainedCost }).where(eq(teamsTable.id, team.id));
    }
    const resetNow = new Date().toISOString();
    await db.update(purseBoostersTable).set({
      status: "cancelled",
      cancelledByType: "tournament_organizer",
      cancelledByLabel: "Local Reset",
      cancelledAt: resetNow,
      cancelReason: "Cancelled during auction reset",
      syncState: "pending",
    }).where(and(
      eq(purseBoostersTable.tournamentId, tid),
      eq(purseBoostersTable.status, "active"),
    ));
    await db.delete(bidsTable).where(eq(bidsTable.tournamentId, tid));
    await db.update(auctionSessionsTable).set({
      status: "idle", currentPlayerId: null, currentBid: null, currentBidTeamId: null,
      timerEndsAt: null, soldPlayersCount: 0, unsoldPlayersCount: 0,
      deferredPlayerIds: null, randomDrawQueue: null, reAuctionStrategyJson: null,
      lastAction: "Reset complete — ready for live auction",
      lastPurseBoosterJson: null,
      lastLedToastJson: null,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "setup" }).where(eq(tournamentsTable.id, tid));
    res.json(await broadcastState(tid, ["bids", "purses", "players"]));
  });

  // POST undo last sale
  router.post("/tournaments/:tournamentId/auction/undo", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [lastBid] = await db.select().from(bidsTable).where(eq(bidsTable.tournamentId, tid))
      .orderBy(desc(bidsTable.timestamp)).limit(1);
    if (lastBid) {
      await db.update(playersTable).set({ status: "available", teamId: null, soldPrice: null }).where(eq(playersTable.id, lastBid.playerId));
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, lastBid.teamId));
      if (team) {
        await db.update(teamsTable).set({ purseUsed: Math.max(0, team.purseUsed - lastBid.amount) }).where(eq(teamsTable.id, lastBid.teamId));
      }
      await db.delete(bidsTable).where(eq(bidsTable.id, lastBid.id));
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, lastBid.playerId));
      await db.update(auctionSessionsTable).set({
        lastAction: `Undone: ${player?.name ?? "Player"} returned to pool`,
        randomDrawQueue: null,
      })
        .where(eq(auctionSessionsTable.tournamentId, tid));
    } else {
      await db.update(auctionSessionsTable).set({ lastAction: "Nothing to undo" })
        .where(eq(auctionSessionsTable.tournamentId, tid));
    }
    res.json(await broadcastState(tid, ["bids", "purses", "players"]));
  });

  // POST toggle team purse view
  router.post("/tournaments/:tournamentId/auction/team-purse-view", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({ active: z.boolean() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    await getOrCreateSession(tid);
    await db.update(auctionSessionsTable).set({ teamPurseViewActive: body.data.active }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST fortune wheel sync
  router.post("/tournaments/:tournamentId/auction/fortune-wheel", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({
      active: z.boolean().optional(),
      spinning: z.boolean().optional(),
      items: z.array(z.object({ label: z.string(), color: z.string() })).optional(),
      winner: z.string().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    await getOrCreateSession(tid);
    const patch: Record<string, unknown> = {};
    if (body.data.active !== undefined) patch.fortuneWheelActive = body.data.active;
    if (body.data.spinning !== undefined) patch.wheelSpinning = body.data.spinning;
    if (body.data.items !== undefined) patch.wheelItemsJson = JSON.stringify(body.data.items);
    if ("winner" in body.data) patch.wheelWinner = body.data.winner ?? null;
    if (Object.keys(patch).length > 0) {
      await db.update(auctionSessionsTable).set(patch).where(eq(auctionSessionsTable.tournamentId, tid));
    }
    res.json(await broadcastState(tid));
  });

  // POST break-timer (start, extend, or cancel a break countdown on the LED display)
  router.post("/tournaments/:tournamentId/auction/break-timer", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({
      action: z.enum(["start", "cancel", "extend", "mute_music", "unmute_music"]),
      durationSeconds: z.number().int().min(10).max(3600).optional(),
      message: z.string().max(60).optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const session = await getOrCreateSession(tid);

    type StoredCountdown = {
      type: string;
      endsAt: string;
      message: string | null;
      musicMuted?: boolean;
    };

    function parseStoredCountdown(raw: string | null | undefined): StoredCountdown | null {
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StoredCountdown;
      } catch {
        return null;
      }
    }

    const existingCountdown = parseStoredCountdown(session.displayCountdown);

    if (body.data.action === "mute_music" || body.data.action === "unmute_music") {
      if (!existingCountdown || existingCountdown.type !== "break") {
        res.status(400).json({ error: "mute_music is only valid for an active break countdown" });
        return;
      }
      if (new Date(existingCountdown.endsAt).getTime() <= Date.now()) {
        res.status(400).json({ error: "Break countdown has already expired" });
        return;
      }
      const musicMuted = body.data.action === "mute_music";
      await db
        .update(auctionSessionsTable)
        .set({
          displayCountdown: JSON.stringify({ ...existingCountdown, musicMuted }),
        })
        .where(eq(auctionSessionsTable.tournamentId, tid));
      res.json(await broadcastState(tid));
      return;
    }
    if (body.data.action === "start" && session.status === "active") {
      let pausedTimeRemaining: number | null = null;
      if (session.timerEndsAt) {
        const remaining = Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000);
        pausedTimeRemaining = remaining > 0 ? remaining : null;
      }
      await db
        .update(auctionSessionsTable)
        .set({
          status: "paused",
          lastAction: "Auction paused for break",
          timerEndsAt: null,
          pausedTimeRemaining,
        })
        .where(eq(auctionSessionsTable.tournamentId, tid));
      await db.update(tournamentsTable).set({ status: "paused" }).where(eq(tournamentsTable.id, tid));
    }
    if (body.data.action === "start" && !body.data.durationSeconds) {
      res.status(400).json({ error: "durationSeconds is required when action is start" });
      return;
    }
    let countdown: string | null = null;
    if (body.data.action === "start" && body.data.durationSeconds) {
      const endsAt = new Date(Date.now() + body.data.durationSeconds * 1000).toISOString();
      countdown = JSON.stringify({
        type: "break",
        endsAt,
        message: body.data.message ?? null,
        musicMuted: false,
      });
    } else if (body.data.action === "extend") {
      if (!existingCountdown || existingCountdown.type !== "break") {
        res.status(400).json({ error: "extend is only valid for an active break countdown" });
        return;
      }
      const extendSecs = body.data.durationSeconds ?? 300;
      const baseTime = new Date(existingCountdown.endsAt).getTime() > Date.now()
        ? new Date(existingCountdown.endsAt).getTime()
        : Date.now();
      const endsAt = new Date(baseTime + extendSecs * 1000).toISOString();
      countdown = JSON.stringify({
        type: "break",
        endsAt,
        message: existingCountdown.message,
        musicMuted: existingCountdown.musicMuted ?? false,
      });
    }

    const sessionPatch: Record<string, unknown> = { displayCountdown: countdown };
    if (body.data.action === "cancel") {
      if (session.status === "paused" && session.lastAction === "Auction paused for break") {
        sessionPatch.status = "active";
        sessionPatch.lastAction = "Break cancelled — auction resumed";
        if (session.pausedTimeRemaining && session.pausedTimeRemaining > 0 && session.currentPlayerId) {
          sessionPatch.timerEndsAt = new Date(Date.now() + session.pausedTimeRemaining * 1000).toISOString();
          sessionPatch.pausedTimeRemaining = null;
        }
        await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));
      }
    }

    await db.update(auctionSessionsTable).set(sessionPatch).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST set active category filter
  router.post("/tournaments/:tournamentId/auction/category-filter", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({ categoryIds: z.array(z.number().int()).nullable().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    await getOrCreateSession(tid);
    const ids = body.data.categoryIds;
    const activeCategoryIds = ids && ids.length > 0 ? JSON.stringify(ids) : null;
    await db.update(auctionSessionsTable).set({ activeCategoryIds, randomDrawQueue: null }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST start timer
  router.post("/tournaments/:tournamentId/auction/start-timer", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({ seconds: z.number().int().min(5).max(300) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    const endsAt = new Date(Date.now() + body.data.seconds * 1000).toISOString();
    await db.update(auctionSessionsTable).set({ timerEndsAt: endsAt }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // GET bid history
  router.get("/tournaments/:tournamentId/auction/bids", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const bids = await db.select().from(bidsTable).where(eq(bidsTable.tournamentId, tid))
      .orderBy(desc(bidsTable.timestamp));
    const result = await Promise.all(bids.map(async bid => {
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
      return {
        id: bid.id, tournamentId: bid.tournamentId, playerId: bid.playerId, teamId: bid.teamId,
        amount: bid.amount, timestamp: bid.timestamp,
        playerName: player?.name ?? null, teamName: team?.name ?? null, teamColor: team?.color ?? null,
      };
    }));
    res.json(result);
  });

  // GET player queue
  router.get("/tournaments/:tournamentId/auction/queue", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const session = await getOrCreateSession(tid);
    let activeCatIds: number[] | null = null;
    try { if (session.activeCategoryIds) activeCatIds = JSON.parse(session.activeCategoryIds); } catch { /* ignore */ }
    const conditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
    const allAvailable = activeCatIds && activeCatIds.length > 0
      ? await db.select().from(playersTable).where(and(...conditions, inArray(playersTable.categoryId as Parameters<typeof inArray>[0], activeCatIds))).orderBy(asc(playersTable.id))
      : await db.select().from(playersTable).where(and(...conditions)).orderBy(asc(playersTable.id));
    res.json(allAvailable.map(playerToJson));
  });

  const reasonSchema = z.string().trim().min(10).max(500);

  router.get("/tournaments/:tournamentId/purse-boosters", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const teamIdParam = req.query.teamId;
    const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;

    const conditions = [eq(purseBoostersTable.tournamentId, tid)];
    if (teamIdParam != null && teamIdParam !== "") {
      const parsedTeamId = parseInt(String(teamIdParam));
      if (!isNaN(parsedTeamId)) conditions.push(eq(purseBoostersTable.teamId, parsedTeamId));
    }
    if (statusParam) conditions.push(eq(purseBoostersTable.status, statusParam));

    const rows = await db
      .select()
      .from(purseBoostersTable)
      .where(and(...conditions))
      .orderBy(desc(purseBoostersTable.createdAt));

    res.json(rows.map(b => ({
      id: b.id,
      localUuid: b.localUuid,
      tournamentId: b.tournamentId,
      teamId: b.teamId,
      amount: b.amount,
      reason: b.reason,
      status: b.status,
      createdByLabel: b.createdByLabel,
      createdAt: b.createdAt,
      cancelledAt: b.cancelledAt,
      cancelReason: b.cancelReason,
      previousCapacity: b.previousCapacity,
      newCapacity: b.newCapacity,
    })));
  });

  router.post("/tournaments/:tournamentId/purse-boosters", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const schema = z.object({
      target: z.enum(["single", "all"]),
      teamId: z.number().int().optional(),
      amount: z.number().int().positive("Amount must be greater than zero"),
      reason: z.string(),
      showOnLed: z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }
    const reasonParsed = reasonSchema.safeParse(parsed.data.reason);
    if (!reasonParsed.success) {
      res.status(400).json({ error: reasonParsed.error.issues[0]?.message || "Invalid reason" });
      return;
    }

    const { target, amount, showOnLed } = parsed.data;
    if (target === "single" && !parsed.data.teamId) {
      res.status(400).json({ error: "teamId is required when target is single" });
      return;
    }

    let targetTeams: Array<typeof teamsTable.$inferSelect>;
    if (target === "all") {
      targetTeams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
    } else {
      const [team] = await db
        .select()
        .from(teamsTable)
        .where(and(eq(teamsTable.id, parsed.data.teamId!), eq(teamsTable.tournamentId, tid)));
      if (!team) { res.status(404).json({ error: "Team not found" }); return; }
      targetTeams = [team];
    }

    const now = new Date().toISOString();
    const applied: Array<{
      boosterId: number;
      teamId: number;
      teamName: string;
      amount: number;
      previousCapacity: number;
      newCapacity: number;
    }> = [];

    let ledOverlayJson: string | null = null;
    const batchId = randomUUID();
    let lastNotification: {
      id: number;
      teamId: number;
      teamName: string;
      amount: number;
      previousCapacity: number;
      newCapacity: number;
      appliedAt: string;
    } | null = null;

    for (const team of targetTeams) {
      const boosterTotal = await getActiveBoosterTotal(db, tid, team.id);
      const previousCapacity = computeEffectiveCapacity(team.purse, boosterTotal);
      const newCapacity = previousCapacity + amount;

      const [inserted] = await db.insert(purseBoostersTable).values({
        localUuid: randomUUID(),
        tournamentId: tid,
        teamId: team.id,
        amount,
        reason: reasonParsed.data,
        status: "active",
        createdByType: "tournament_organizer",
        createdByLabel: "Local Operator",
        createdAt: now,
        previousCapacity,
        newCapacity,
        origin: "local",
        syncState: "pending",
      }).returning();

      applied.push({
        boosterId: inserted.id,
        teamId: team.id,
        teamName: team.name,
        amount,
        previousCapacity,
        newCapacity,
      });

      lastNotification = {
        id: inserted.id,
        teamId: team.id,
        teamName: team.name,
        amount,
        previousCapacity,
        newCapacity,
        appliedAt: now,
      };
    }

    if (showOnLed && applied.length > 0) {
      const teamById = new Map(targetTeams.map((team) => [team.id, team]));
      const overlayTeams: LedPurseBoosterTeamLine[] = applied.map((entry) => {
        const team = teamById.get(entry.teamId);
        return {
          teamId: entry.teamId,
          teamName: entry.teamName,
          shortCode: team?.shortCode || entry.teamName.slice(0, 3).toUpperCase(),
          color: team?.color ?? "#3B82F6",
          logoUrl: team?.logoUrl ?? null,
          previousCapacity: entry.previousCapacity,
          boosterAmount: entry.amount,
          newCapacity: entry.newCapacity,
        };
      });
      ledOverlayJson = JSON.stringify(
        createLedPurseBoosterOverlay(target, amount, overlayTeams, { batchId }),
      );
    }

    await getOrCreateSession(tid);
    await db.update(auctionSessionsTable).set({
      lastPurseBoosterJson: lastNotification ? JSON.stringify(lastNotification) : null,
      lastLedToastJson: ledOverlayJson,
    }).where(eq(auctionSessionsTable.tournamentId, tid));

    await broadcastState(tid, ["purses", "auction_state"]);
    res.status(201).json({ applied, totalTeamsAffected: applied.length });
  });

  router.post("/tournaments/:tournamentId/purse-boosters/replay-led", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [session] = await db
      .select()
      .from(auctionSessionsTable)
      .where(eq(auctionSessionsTable.tournamentId, tid));
    if (!session) { res.status(404).json({ error: "Auction session not found" }); return; }

    const existing = parseLedPurseBoosterOverlay(session.lastLedToastJson, { includeExpired: true });
    if (!existing) {
      res.status(404).json({ error: "No purse booster LED animation to replay" });
      return;
    }

    const replayed = replayLedPurseBoosterOverlay(existing);
    await db
      .update(auctionSessionsTable)
      .set({ lastLedToastJson: JSON.stringify(replayed) })
      .where(eq(auctionSessionsTable.tournamentId, tid));

    await broadcastState(tid, ["auction_state"]);
    res.json({ ok: true, replayKey: replayed.replayKey, expiresAt: replayed.expiresAt });
  });

  router.get("/tournaments/:tournamentId/teams/:teamId/purse-boosters", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const rows = await db
      .select()
      .from(purseBoostersTable)
      .where(and(eq(purseBoostersTable.tournamentId, tid), eq(purseBoostersTable.teamId, teamId)))
      .orderBy(desc(purseBoostersTable.createdAt));

    res.json(rows.map(b => ({
      id: b.id,
      teamId: b.teamId,
      amount: b.amount,
      status: b.status,
      createdAt: b.createdAt,
      cancelledAt: b.cancelledAt,
      previousCapacity: b.previousCapacity,
      newCapacity: b.newCapacity,
    })));
  });

  router.post("/tournaments/:tournamentId/purse-boosters/:boosterId/cancel", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const boosterId = parseInt(req.params.boosterId);
    if (isNaN(tid) || isNaN(boosterId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const cancelReasonParsed = reasonSchema.safeParse((req.body as { cancelReason?: string })?.cancelReason ?? (req.body as { reason?: string })?.reason);
    if (!cancelReasonParsed.success) {
      res.status(400).json({ error: cancelReasonParsed.error.issues[0]?.message || "Invalid cancel reason" });
      return;
    }

    const [booster] = await db
      .select()
      .from(purseBoostersTable)
      .where(and(eq(purseBoostersTable.id, boosterId), eq(purseBoostersTable.tournamentId, tid)));
    if (!booster || booster.status !== "active") {
      res.status(400).json({ error: "Booster not found or already cancelled" });
      return;
    }

    const [team] = await db
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, booster.teamId), eq(teamsTable.tournamentId, tid)));
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }

    const validation = await validateCancelBooster(db, tid, team.id, team.purse, team.purseUsed, booster.amount);
    if (!validation.ok) { res.status(400).json({ error: validation.error }); return; }

    const now = new Date().toISOString();
    await db.update(purseBoostersTable).set({
      status: "cancelled",
      cancelledByType: "tournament_organizer",
      cancelledByLabel: "Local Operator",
      cancelledAt: now,
      cancelReason: cancelReasonParsed.data,
      syncState: "pending",
    }).where(eq(purseBoostersTable.id, boosterId));

    await broadcastState(tid, ["purses"]);
    res.json({ ok: true });
  });

  // POST defer current player — send to deferred queue; operator loads next via Next Player
  router.post("/tournaments/:tournamentId/auction/defer-player", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const session = await getOrCreateSession(tid);
    if (rejectIfAuctionPaused(session, res)) return;
    if (!session.currentPlayerId) {
      res.status(400).json({ error: "No player currently on the block" });
      return;
    }

    const deferredId = session.currentPlayerId;
    const [deferredPlayer] = await db
      .select({ name: playersTable.name })
      .from(playersTable)
      .where(eq(playersTable.id, deferredId));

    let deferredIds: number[] = [];
    try { if (session.deferredPlayerIds) deferredIds = JSON.parse(session.deferredPlayerIds); } catch { /* ignore */ }
    if (!deferredIds.includes(deferredId)) deferredIds.push(deferredId);

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    const timerSecs = tournament?.timerSeconds ?? 30;

    await db.update(auctionSessionsTable).set({
      status: "active",
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: deferredIds.length > 0 ? JSON.stringify(deferredIds) : null,
      lastAction: `Brought later: ${deferredPlayer?.name ?? "Player"} — select next player`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["players"]));
  });

  // POST set LED display overlay mode (off | team | player | top5 | banner)
  router.post("/tournaments/:tournamentId/auction/display-overlay", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({ mode: z.enum(["off", "team", "player", "top5", "banner"]) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    await getOrCreateSession(tid);
    const overlay = body.data.mode === "off" ? null : body.data.mode;
    await db.update(auctionSessionsTable).set({
      displayOverlay: overlay,
      teamPurseViewActive: overlay !== null,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST set Player View filter shown on LED display
  router.post("/tournaments/:tournamentId/auction/display-player-filter", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({
      status: z.enum(["all", "sold", "unsold", "available", "retained"]),
      categoryId: z.number().int().nullable().optional(),
      teamId: z.number().int().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    await getOrCreateSession(tid);
    const filter = {
      status: body.data.status,
      categoryId: body.data.categoryId ?? null,
      teamId: body.data.teamId ?? null,
    };
    await db.update(auctionSessionsTable).set({
      displayPlayerFilter: JSON.stringify(filter),
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST stop timer — ends the current bid window
  router.post("/tournaments/:tournamentId/auction/stop-timer", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await getOrCreateSession(tid);
    await db.update(auctionSessionsTable).set({
      timerEndsAt: null,
      pausedTimeRemaining: null,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST audience cheer message (LED fan battle / heat meter)
  router.post("/tournaments/:tournamentId/cheer", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid tournament ID" }); return; }

    const bodySchema = z.object({
      teamId: z.number().int().positive(),
      reactionId: z.number().int().min(0).max(9),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { teamId, reactionId } = parsed.data;

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
    if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }
    if (!tournament.cheerMessagesEnabled) {
      res.status(403).json({ error: "Cheer messages are disabled for this tournament" });
      return;
    }

    const cooldownMs = (tournament.cheerCooldownSeconds ?? 2) * 1000;
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").replace("::ffff:", "");
    const now = Date.now();
    const last = cheerRateLimiter.get(ip) ?? 0;
    if (now - last < cooldownMs) {
      res.status(429).json({
        error: "Too many requests",
        cooldownSeconds: tournament.cheerCooldownSeconds ?? 2,
      });
      return;
    }
    cheerRateLimiter.set(ip, now);

    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
    if (!team) { res.status(400).json({ error: "Team not found in this tournament" }); return; }

    let presets: string[] = CHEER_DEFAULT_PRESETS;
    if (tournament.cheerMessagePresets) {
      try {
        const p = JSON.parse(tournament.cheerMessagePresets) as unknown;
        if (Array.isArray(p) && p.length > 0) presets = p as string[];
      } catch { /* use defaults */ }
    }
    const message = presets[reactionId];
    if (!message) { res.status(400).json({ error: "Invalid reaction ID" }); return; }

    const supporterLabel = `${(team.shortCode ?? team.name.slice(0, 4)).toUpperCase()} FANS`;

    if (!fanBattleCounters.has(tid)) fanBattleCounters.set(tid, new Map());
    const tmap = fanBattleCounters.get(tid)!;
    tmap.set(teamId, (tmap.get(teamId) ?? 0) + 1);
    const fanBattle: Record<string, number> = {};
    for (const [k, v] of tmap) fanBattle[String(k)] = v;

    if (!recentCheerTimestamps.has(tid)) recentCheerTimestamps.set(tid, []);
    const tsArr = recentCheerTimestamps.get(tid)!;
    tsArr.push(now);
    recentCheerTimestamps.set(tid, tsArr.filter((t) => t > now - 300_000));

    broadcastToTournament(tid, {
      type: "cheer_message",
      supporterLabel,
      message,
      teamColor: team.color ?? null,
      teamId,
      timestamp: now,
      heatLevel: getHeatLevel(tid),
      fanBattle,
    });
    res.json({ ok: true });
  });

  return router;
}
