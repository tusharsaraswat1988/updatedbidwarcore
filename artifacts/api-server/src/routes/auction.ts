import { Router } from "express";
import { isTournamentOrganizer, requireTournamentOrganizer } from "../middleware/require-organizer";
import { serializePlayerWithSpecifications } from "../lib/player-spec-response";
import { requireTeamInTournament } from "../lib/team-tournament-guard";
import { db } from "@workspace/db";
import { cheerLimiter } from "../lib/rate-limiters";
import { validateExportToken } from "../lib/export-token";
// NOTE: Auction operations are intentionally not rate-limited to support
// rapid bidding (2-3 req/sec per player) and polling (every 1s on 4+ screens).
import {
  auctionSessionsTable,
  playersTable,
  teamsTable,
  bidsTable,
  auctionBidEventsTable,
  auctionPlayerEventsTable,
  auctionTimerEventsTable,
  tournamentsTable,
  categoriesTable,
  organizersTable,
} from "@workspace/db";
import { eq, and, asc, desc, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { addSseClient, removeSseClient, getSseClientCount } from "../lib/broadcast";
import { logger } from "../lib/logger";
import {
  emitAuctionStateEvent,
  emitBidEvent,
  emitSoldEvent,
  type BidDeltaFields,
  type SoldDeltaFields,
} from "../lib/auction-broadcast";
import {
  EVENT_BUFFER_MAX,
  formatSseFrame,
  getCurrentEventVersion,
  getEventsAfter,
  getLastAuctionActivityAt,
  publishAuctionEvent,
} from "../lib/auction-events";
import { computeTeamPurseProtection } from "../lib/purse-protection";
import { notifyPlayerSold, notifyPlayerUnsold, notifyPlayerReAuction } from "../lib/whatsapp";
import { isNameClean } from "../lib/name-filter";
import { CHEER_DEFAULT_PRESETS } from "../lib/cheer-constants";
import { getAdminPassword, getPublicOrigin, getRuntimeConfig } from "../lib/runtime-env";
import { scheduleGoogleSheetSync } from "../lib/google-sheets-sync-queue.js";

function afterPlayerDataChanged(tournamentId: number, log?: import("pino").Logger) {
  scheduleGoogleSheetSync(tournamentId, log);
}
import {
  logBidEvent,
  logPlayerAuctionStart,
  logPlayerAuctionEnd,
  logTimerEvent,
} from "../lib/auction-logger";
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
  type AuctionReadinessMode,
} from "@workspace/api-base/auction-readiness";
import { evaluateVenueAuctionGuard } from "@workspace/api-base/venue-auction-guard";
import { auditLog } from "../lib/audit-service";
import { invalidateIntelCacheForTournament } from "../lib/intelligence-cache";
import { parseAuditReason } from "../lib/audit-reason";
import {
  onAuctionPlayerSoldAsync,
  syncAllAuctionPlayersAsync,
} from "../lib/master-sports/sync";
import { snapshotPlayer, snapshotTeam } from "../lib/audit-snapshots";
import {
  acquireOperatorLock,
  forceAcquireOperatorLock,
  heartbeatOperatorLock,
  releaseOperatorLock,
} from "../lib/operator-lock";
import { buildTeamPurseSnapshot } from "../lib/team-purse-snapshot";
import { compactAuctionStateForSse } from "../lib/auction-sse-payload";

const router = Router();

const operatorLockBodySchema = z.object({
  tabId: z.string().min(8).max(128),
});

function operatorOwnerId(req: import("express").Request): string {
  const u = req.jwtUser;
  if (!u) return "anonymous";
  if (u.isAdmin) return "admin";
  if (u.organizerAccountId) return `org:${u.organizerAccountId}`;
  return "organizer";
}

const WHEEL_SPIN_DURATION_MS = 5000;
const wheelSpinStopTimers = new Map<number, ReturnType<typeof setTimeout>>();

function clearWheelSpinStop(tournamentId: number) {
  const timer = wheelSpinStopTimers.get(tournamentId);
  if (timer) {
    clearTimeout(timer);
    wheelSpinStopTimers.delete(tournamentId);
  }
}

function scheduleWheelSpinStop(tournamentId: number) {
  clearWheelSpinStop(tournamentId);
  const timer = setTimeout(async () => {
    wheelSpinStopTimers.delete(tournamentId);
    try {
      const [session] = await db
        .select({ wheelSpinning: auctionSessionsTable.wheelSpinning })
        .from(auctionSessionsTable)
        .where(eq(auctionSessionsTable.tournamentId, tournamentId));
      if (!session?.wheelSpinning) return;
      await db
        .update(auctionSessionsTable)
        .set({ wheelSpinning: false })
        .where(eq(auctionSessionsTable.tournamentId, tournamentId));
      await broadcastState(tournamentId);
    } catch (err) {
      logger.warn({ err, tournamentId }, "fortune wheel auto-stop failed");
    }
  }, WHEEL_SPIN_DURATION_MS);
  wheelSpinStopTimers.set(tournamentId, timer);
}

async function getOrCreateSession(tournamentId: number) {
  let [session] = await db
    .select()
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId));
  if (!session) {
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId));
    const timerSeconds = tournament?.timerSeconds ?? 30;
    [session] = await db
      .insert(auctionSessionsTable)
      .values({
        tournamentId,
        status: "idle",
        timerSeconds,
        soldPlayersCount: 0,
        unsoldPlayersCount: 0,
      })
      .returning();
  }
  return session;
}

const AUCTION_PAUSED_ERROR = "Auction is paused. Resume the auction before continuing.";

/** Opening timer for first bid on a player; bid timer after any bid or pause/resume with bids. */
function resolveTimerPhase(session: {
  currentBidTeamId: number | null;
  timerType: string | null;
}): "start" | "bid" {
  if (session.currentBidTeamId || session.timerType === "bid") return "bid";
  return "start";
}

type AuctionPlayerPick = {
  playerId: number;
  randomDrawQueue: string | null;
};

type PlayerSelectionMode = "sequential" | "random" | "manual";

function normalizePlayerSelectionMode(mode: string | null | undefined): PlayerSelectionMode {
  if (mode === "random" || mode === "manual") return mode;
  return "sequential";
}

function selectPlayerFromPool(
  pool: { id: number }[],
  mode: PlayerSelectionMode | undefined,
  session: { randomDrawQueue?: string | null; currentPlayerId?: number | null },
): AuctionPlayerPick | null {
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

function computeBidTimerDuration(
  session: { timerEndsAt: string | null },
  tournament: {
    bidTimerSeconds?: number | null;
    bidExtensionEnabled?: boolean | null;
    bidExtensionThresholdSeconds?: number | null;
    bidExtensionSeconds?: number | null;
  } | null | undefined,
): number {
  const bidTimerSecs = tournament?.bidTimerSeconds ?? 15;
  if (!tournament?.bidExtensionEnabled || !session.timerEndsAt) return bidTimerSecs;

  const remaining = Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000);
  const threshold = tournament.bidExtensionThresholdSeconds ?? 3;
  const extensionSecs = tournament.bidExtensionSeconds ?? 5;
  if (remaining > 0 && remaining <= threshold) {
    return remaining + extensionSecs;
  }
  return bidTimerSecs;
}

/**
 * When the available player pool is empty: complete only if all auctionable players
 * are sold; otherwise keep the session active for an unsold round.
 */
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
    await db.transaction(async (tx) => {
      await tx
        .update(auctionSessionsTable)
        .set({
          status: "completed",
          currentPlayerId: null,
          currentBid: null,
          currentBidTeamId: null,
          timerEndsAt: null,
          timerType: null,
          deferredPlayerIds: null,
          randomDrawQueue: null,
          displayCountdown: null,
          lastAction: "Auction completed — all players sold",
          lastOutcome: null,
        })
        .where(eq(auctionSessionsTable.tournamentId, tid));
      await tx.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
    });
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
        timerType: null,
        randomDrawQueue: null,
        lastAction: `Main round complete — ${unsoldCount} unsold player${unsoldCount !== 1 ? "s" : ""} remaining`,
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        timerType: null,
        deferredPlayerIds: null,
        randomDrawQueue: null,
        displayCountdown: null,
        lastAction: "Auction completed",
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await tx.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
  });
}

function rejectIfAuctionPaused(
  session: { status: string },
  res: { status: (code: number) => { json: (body: object) => void } },
): boolean {
  if (session.status === "paused") {
    res.status(409).json({ error: AUCTION_PAUSED_ERROR });
    return true;
  }
  return false;
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

function getCategoryTiers(
  category: { bidTiers: string | null; bidIncrement: number | null },
  fallbackTiers: BidTier[]
): BidTier[] {
  if (category.bidTiers) {
    try {
      const parsed = JSON.parse(category.bidTiers);
      if (Array.isArray(parsed) && parsed.length >= 1) return parsed as BidTier[];
    } catch { /* ignore */ }
  }
  if (category.bidIncrement && category.bidIncrement > 0) {
    return [{ increment: category.bidIncrement }];
  }
  return fallbackTiers;
}

async function resolveTournamentBidTiers(tournamentId: number): Promise<BidTier[]> {
  const [tournamentRow] = await db
    .select({
      bidTier1UpTo: tournamentsTable.bidTier1UpTo,
      bidTier1Increment: tournamentsTable.bidTier1Increment,
      bidTier2UpTo: tournamentsTable.bidTier2UpTo,
      bidTier2Increment: tournamentsTable.bidTier2Increment,
      bidTier3Increment: tournamentsTable.bidTier3Increment,
      bidTiers: tournamentsTable.bidTiers,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  return parseBidTiers(tournamentRow?.bidTiers, {
    bidTier1UpTo: tournamentRow?.bidTier1UpTo ?? 100000,
    bidTier1Increment: tournamentRow?.bidTier1Increment ?? 25000,
    bidTier2UpTo: tournamentRow?.bidTier2UpTo ?? 200000,
    bidTier2Increment: tournamentRow?.bidTier2Increment ?? 50000,
    bidTier3Increment: tournamentRow?.bidTier3Increment ?? 100000,
  });
}

async function resolveActiveBidIncrement(
  tournamentId: number,
  session: { currentPlayerId: number | null; currentBid: number | null },
): Promise<number> {
  const tiers = await resolveTournamentBidTiers(tournamentId);
  let activeTiers = tiers;

  if (session.currentPlayerId) {
    const [p] = await db
      .select({ categoryId: playersTable.categoryId })
      .from(playersTable)
      .where(eq(playersTable.id, session.currentPlayerId));
    if (p?.categoryId) {
      const [cat] = await db
        .select({ bidTiers: categoriesTable.bidTiers, bidIncrement: categoriesTable.bidIncrement })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, p.categoryId));
      if (cat) {
        activeTiers = getCategoryTiers(cat, tiers);
      }
    }
  }

  return computeTieredIncrement(session.currentBid ?? 0, activeTiers);
}

async function resolveOpeningBidForPlayer(
  tournamentId: number,
  player: { basePrice: number; categoryId: number | null },
  reAuctionStrategyJson: string | null | undefined,
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

async function countPlayerStatuses(tournamentId: number) {
  const rows = await db
    .select({
      status: playersTable.status,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId))
    .groupBy(playersTable.status);

  let soldCount = 0;
  let unsoldCount = 0;
  let availableCount = 0;
  for (const row of rows) {
    if (row.status === "sold") soldCount = row.count;
    else if (row.status === "unsold") unsoldCount = row.count;
    else if (row.status === "available") availableCount = row.count;
  }
  return { soldCount, unsoldCount, availableCount };
}

async function buildAuctionState(tournamentId: number) {
  const session = await getOrCreateSession(tournamentId);

  // Always fetch fresh tournament data (timer, tiers) — never rely on stale session values
  const [tournamentRow] = await db
    .select({
      playerSelectionMode: tournamentsTable.playerSelectionMode,
      timerSeconds: tournamentsTable.timerSeconds,
      bidTimerSeconds: tournamentsTable.bidTimerSeconds,
      bidExtensionEnabled: tournamentsTable.bidExtensionEnabled,
      bidExtensionThresholdSeconds: tournamentsTable.bidExtensionThresholdSeconds,
      bidExtensionSeconds: tournamentsTable.bidExtensionSeconds,
      bidTier1UpTo: tournamentsTable.bidTier1UpTo,
      bidTier1Increment: tournamentsTable.bidTier1Increment,
      bidTier2UpTo: tournamentsTable.bidTier2UpTo,
      bidTier2Increment: tournamentsTable.bidTier2Increment,
      bidTier3Increment: tournamentsTable.bidTier3Increment,
      bidTiers: tournamentsTable.bidTiers,
      licenseStatus: tournamentsTable.licenseStatus,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  const timerSeconds = tournamentRow?.timerSeconds ?? 30;
  const bidTimerSeconds = tournamentRow?.bidTimerSeconds ?? 15;

  const tiers = await resolveTournamentBidTiers(tournamentId);

  let currentPlayer = null;
  let activeTiers = tiers;
  let currentCategoryMaxPlayers: number | null = null;
  let currentCategoryName: string | null = null;
  let teamCategoryPlayerCounts: Record<string, number> | null = null;

  if (session.currentPlayerId) {
    const [p] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, session.currentPlayerId));
    if (p) {
      currentPlayer = await serializePlayerWithSpecifications(p, "auction");
      // Use category's bid settings and enforce max players if category defines them
      if (p.categoryId) {
        const [cat] = await db
          .select({ bidTiers: categoriesTable.bidTiers, bidIncrement: categoriesTable.bidIncrement, maxPlayers: categoriesTable.maxPlayers, name: categoriesTable.name })
          .from(categoriesTable)
          .where(eq(categoriesTable.id, p.categoryId));
        if (cat) {
          activeTiers = getCategoryTiers(cat, tiers);
          if (cat.maxPlayers && cat.maxPlayers > 0) {
            currentCategoryMaxPlayers = cat.maxPlayers;
            currentCategoryName = cat.name;
            // Count per-team players already bought in this category
            const catPlayers = await db
              .select({ teamId: playersTable.teamId })
              .from(playersTable)
              .where(
                and(
                  eq(playersTable.tournamentId, tournamentId),
                  eq(playersTable.categoryId, p.categoryId),
                  inArray(playersTable.status, ["sold", "retained"])
                )
              );
            const counts: Record<string, number> = {};
            for (const cp of catPlayers) {
              if (cp.teamId != null) {
                const key = String(cp.teamId);
                counts[key] = (counts[key] ?? 0) + 1;
              }
            }
            teamCategoryPlayerCounts = counts;
          }
        }
      }
    }
  }

  const bidIncrement = computeTieredIncrement(session.currentBid ?? 0, activeTiers);

  let currentBidTeamName = null;
  let currentBidTeamColor = null;
  let currentBidTeamLogoUrl = null;
  if (session.currentBidTeamId) {
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, session.currentBidTeamId));
    if (team) {
      currentBidTeamName = team.name;
      currentBidTeamColor = team.color;
      currentBidTeamLogoUrl = team.logoUrl;
    }
  }

  const [{ soldCount, unsoldCount, availableCount }, teamPurses] = await Promise.all([
    countPlayerStatuses(tournamentId),
    buildTeamPurseSnapshot(tournamentId),
  ]);

  let wheelItems: { label: string; color: string }[] = [];
  try {
    if (session.wheelItemsJson) wheelItems = JSON.parse(session.wheelItemsJson);
  } catch { /* ignore */ }

  let activeCategoryIds: number[] | null = null;
  try {
    if (session.activeCategoryIds) activeCategoryIds = JSON.parse(session.activeCategoryIds);
  } catch { /* ignore */ }

  // Trial mode: expose first 2 team IDs that are eligible to bid
  const licenseStatus = tournamentRow?.licenseStatus ?? "trial";
  const isTrialMode = licenseStatus !== "active";
  let trialTeamIds: number[] | null = null;
  if (isTrialMode) {
    const trialTeams = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(eq(teamsTable.tournamentId, tournamentId))
      .orderBy(asc(teamsTable.id))
      .limit(2);
    trialTeamIds = trialTeams.map(t => t.id);
  }

  // Parse deferred player IDs
  let deferredPlayerIds: number[] = [];
  try {
    if (session.deferredPlayerIds) deferredPlayerIds = JSON.parse(session.deferredPlayerIds);
  } catch { /* ignore */ }

  let displayCountdown: { type: string; endsAt: string; message: string | null; musicMuted?: boolean } | null = null;
  try {
    if (session.displayCountdown) {
      const parsed = JSON.parse(session.displayCountdown) as {
        type: string;
        endsAt: string;
        message: string | null;
        musicMuted?: boolean;
      };
      // Only include if still in the future (auto-expire stale countdowns)
      if (new Date(parsed.endsAt).getTime() > Date.now()) {
        displayCountdown = parsed;
      } else {
        // Silently clear expired countdown
        await db.update(auctionSessionsTable).set({ displayCountdown: null }).where(eq(auctionSessionsTable.tournamentId, tournamentId));
      }
    }
  } catch { /* ignore */ }

  // Structured sold/unsold outcome — authoritative result that lives between two
  // players so all displays render the correct card without parsing lastAction.
  let outcome:
    | {
        type: "sold" | "unsold";
        playerId: number | null;
        playerName: string;
        photoUrl: string | null;
        teamId?: number | null;
        teamName?: string | null;
        teamColor?: string | null;
        teamLogoUrl?: string | null;
        amount?: number | null;
        isManual?: boolean;
      }
    | null = null;
  try {
    if (session.lastOutcome) {
      const parsed = JSON.parse(session.lastOutcome);
      if (parsed && (parsed.type === "sold" || parsed.type === "unsold")) {
        outcome = parsed;
      }
    }
  } catch { /* ignore malformed outcome */ }

  // Last sold player — owner panels only; must not appear after an unsold outcome.
  let lastSoldPlayer: {
    id: number; name: string; role: string | null; photoUrl: string | null;
    soldToTeamId: number; soldToTeamName: string | null; soldToTeamColor: string | null;
    soldAmount: number;
  } | null = null;
  if (!session.currentPlayerId && outcome?.type === "sold") {
    let lp: { id: number; role: string | null; photoUrl: string | null } | null = null;
    if (outcome.playerId) {
      [lp] = await db
        .select({ id: playersTable.id, role: playersTable.role, photoUrl: playersTable.photoUrl })
        .from(playersTable)
        .where(eq(playersTable.id, outcome.playerId));
    }
    lastSoldPlayer = {
      id: outcome.playerId ?? lp?.id ?? 0,
      name: outcome.playerName,
      role: lp?.role ?? null,
      photoUrl: outcome.photoUrl ?? lp?.photoUrl ?? null,
      soldToTeamId: outcome.teamId ?? 0,
      soldToTeamName: outcome.teamName ?? null,
      soldToTeamColor: outcome.teamColor ?? null,
      soldAmount: outcome.amount ?? 0,
    };
  } else if (!session.currentPlayerId && outcome?.type !== "unsold") {
    // Legacy fallback when structured outcome is absent
    const [lastBid] = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.tournamentId, tournamentId))
      .orderBy(desc(bidsTable.timestamp))
      .limit(1);
    if (lastBid) {
      const [lp] = await db.select().from(playersTable).where(eq(playersTable.id, lastBid.playerId));
      const [lt] = await db.select().from(teamsTable).where(eq(teamsTable.id, lastBid.teamId));
      if (lp?.status === "sold") {
        lastSoldPlayer = {
          id: lp.id, name: lp.name, role: lp.role, photoUrl: lp.photoUrl,
          soldToTeamId: lastBid.teamId,
          soldToTeamName: lt?.name ?? null,
          soldToTeamColor: lt?.color ?? null,
          soldAmount: lastBid.amount,
        };
      }
    }
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
    try {
      lastPurseBooster = JSON.parse(session.lastPurseBoosterJson);
    } catch { /* ignore */ }
  }

  let ledPurseToast: { teamName: string } | null = null;
  if (session.lastLedToastJson) {
    try {
      const parsed = JSON.parse(session.lastLedToastJson) as { teamName: string; expiresAt: string };
      if (parsed && new Date(parsed.expiresAt) > new Date()) {
        ledPurseToast = { teamName: parsed.teamName };
      }
    } catch { /* ignore */ }
  }

  const lastAuctionActivityAt =
    (await getLastAuctionActivityAt(tournamentId)) ??
    session.updatedAt?.toISOString() ??
    null;

  return {
    tournamentId,
    status: session.status,
    currentPlayer,
    currentBid: session.currentBid,
    currentBidTeamId: session.currentBidTeamId,
    currentBidTeamName,
    currentBidTeamColor,
    currentBidTeamLogoUrl,
    bidIncrement,
    timerSeconds,
    bidTimerSeconds,
    timerEndsAt: session.timerEndsAt,
    // Authoritative timer mode — persists across pause (timerEndsAt cleared) so
    // resume uses bid timer when bidding had already started.
    timerType: session.timerType ?? null,
    bidExtensionEnabled: tournamentRow?.bidExtensionEnabled ?? false,
    bidExtensionThresholdSeconds: tournamentRow?.bidExtensionThresholdSeconds ?? 3,
    bidExtensionSeconds: tournamentRow?.bidExtensionSeconds ?? 5,
    mainRoundExhausted:
      session.status === "active" && availableCount === 0 && unsoldCount > 0,
    lastAction: session.lastAction,
    outcome,
    soldPlayersCount: soldCount,
    unsoldPlayersCount: unsoldCount,
    remainingPlayersCount: availableCount,
    fortuneWheelActive: session.fortuneWheelActive,
    wheelSpinning: session.wheelSpinning,
    wheelItems,
    // Hide winner on live feeds while the wheel is still spinning.
    wheelWinner: session.wheelSpinning ? null : session.wheelWinner,
    teamPurseViewActive: session.teamPurseViewActive,
    displayOverlay: session.displayOverlay,
    displayPlayerFilter: session.displayPlayerFilter
      ? (() => { try { return JSON.parse(session.displayPlayerFilter as string); } catch { return undefined; } })()
      : undefined,
    activeCategoryIds,
    playerSelectionMode: tournamentRow?.playerSelectionMode ?? "sequential",
    licenseStatus,
    trialTeamIds,
    deferredPlayerIds: deferredPlayerIds.length > 0 ? deferredPlayerIds : null,
    currentCategoryMaxPlayers,
    currentCategoryName,
    teamCategoryPlayerCounts,
    displayCountdown,
    lastSoldPlayer,
    lastPurseBooster,
    ledPurseToast,
    pausedTimeRemaining: session.pausedTimeRemaining ?? null,
    teamPurses,
    lastAuctionActivityAt,
  };
}

// ── Auction state cache ───────────────────────────────────────────────────────
// Prevents reconnect storms and rapid polls from hammering Neon with identical
// reads. A 500 ms TTL means all viewers who reconnect within the same half-second
// share one DB snapshot. Mutations always call invalidateStateCache() first so
// they bypass stale data and always broadcast a fresh snapshot.
interface StateCacheEntry {
  data: Awaited<ReturnType<typeof buildAuctionState>>;
  cachedAt: number;
}
const _stateCache = new Map<number, StateCacheEntry>();
const STATE_CACHE_TTL_MS = 500;
let _cacheHits = 0;
let _cacheMisses = 0;

function invalidateStateCache(tournamentId: number) {
  _stateCache.delete(tournamentId);
}

async function getCachedOrBuildState(tournamentId: number): Promise<Awaited<ReturnType<typeof buildAuctionState>>> {
  const cached = _stateCache.get(tournamentId);
  if (cached && Date.now() - cached.cachedAt < STATE_CACHE_TTL_MS) {
    _cacheHits++;
    return cached.data;
  }
  _cacheMisses++;
  const t0 = Date.now();
  const data = await buildAuctionState(tournamentId);
  const elapsed = Date.now() - t0;
  if (elapsed > 300) {
    logger.warn({ tournamentId, elapsed, fn: "buildAuctionState" }, "auction state build slow");
  }
  _stateCache.set(tournamentId, { data, cachedAt: Date.now() });
  return data;
}

// Log cache hit rate every 5 minutes
setInterval(() => {
  const total = _cacheHits + _cacheMisses;
  if (total > 0) {
    logger.info(
      { cacheHits: _cacheHits, cacheMisses: _cacheMisses, hitRate: `${((_cacheHits / total) * 100) | 0}%` },
      "auction state cache metrics",
    );
    _cacheHits = 0;
    _cacheMisses = 0;
  }
}, 5 * 60 * 1000);

async function broadcastState(tournamentId: number, invalidate: string[] = []) {
  invalidateStateCache(tournamentId);
  const state = await getCachedOrBuildState(tournamentId);
  await emitAuctionStateEvent(tournamentId, state, invalidate);
  return state;
}

async function broadcastBidDelta(tournamentId: number, delta: BidDeltaFields) {
  invalidateStateCache(tournamentId);
  await emitBidEvent(tournamentId, delta);
  return getCachedOrBuildState(tournamentId);
}

async function broadcastSoldDelta(
  tournamentId: number,
  sold: Pick<SoldDeltaFields, "playerId" | "teamId" | "amount">,
  invalidate: string[] = ["bids", "players"],
) {
  invalidateStateCache(tournamentId);
  const state = await getCachedOrBuildState(tournamentId);
  await emitSoldEvent(
    tournamentId,
    {
      playerId: sold.playerId,
      teamId: sold.teamId,
      amount: sold.amount,
      lastOutcome: state.outcome,
      lastAction: state.lastAction ?? "",
      teamPurses: state.teamPurses,
      soldPlayersCount: state.soldPlayersCount as number,
      unsoldPlayersCount: state.unsoldPlayersCount as number,
      remainingPlayersCount: state.remainingPlayersCount as number,
      currentPlayerId: (state.currentPlayer as { id?: number } | null)?.id ?? null,
      currentBid: state.currentBid as number | null,
      currentBidTeamId: state.currentBidTeamId as number | null,
      timerEndsAt: state.timerEndsAt as string | null,
      timerType: state.timerType as string | null,
      lastSoldPlayer: state.lastSoldPlayer as SoldDeltaFields["lastSoldPlayer"],
    },
    invalidate,
  );
  return state;
}

// GET SSE stream
router.get("/tournaments/:tournamentId/auction/events", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client = addSseClient(tid, res);
  logger.info({ tournamentId: tid, clientCount: getSseClientCount(tid) }, "SSE client connected");

  const lastEventHeader = req.headers["last-event-id"];
  const afterVersion = lastEventHeader ? parseInt(String(lastEventHeader), 10) : 0;

  if (afterVersion > 0) {
    const missed = await getEventsAfter(tid, afterVersion);
    const latestVersion = await getCurrentEventVersion(tid);
    const gap = latestVersion - afterVersion;

    if (gap > 0 && (gap > EVENT_BUFFER_MAX || missed.length < gap)) {
      const state = await getCachedOrBuildState(tid);
      const version = latestVersion || (await getCurrentEventVersion(tid));
      const envelope = {
        type: "auction_state",
        version,
        tournamentId: tid,
        state: compactAuctionStateForSse(state),
        invalidate: [] as string[],
      };
      res.write(formatSseFrame(version, envelope));
    } else {
      for (const event of missed) {
        res.write(formatSseFrame(event.version, event));
      }
    }
  } else {
    const state = await getCachedOrBuildState(tid);
    const version = await getCurrentEventVersion(tid);
    const envelope = {
      type: "auction_state",
      version,
      tournamentId: tid,
      state: compactAuctionStateForSse(state),
      invalidate: [] as string[],
    };
    res.write(formatSseFrame(version || 1, envelope));
  }

  const cleanup = () => {
    clearInterval(heartbeat);
    removeSseClient(client);
    req.off("close", cleanup);
    res.off("close", cleanup);
    logger.info({ tournamentId: tid, clientCount: getSseClientCount(tid) }, "SSE client disconnected");
  };

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { cleanup(); }
  }, 20000);

  req.on("close", cleanup);
  res.on("close", cleanup);
});

// GET auction state
router.get("/tournaments/:tournamentId/auction", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  res.json(await getCachedOrBuildState(tid));
});

// ── Operator session lock (one controlling tab per tournament) ───────────────

router.post("/tournaments/:tournamentId/auction/operator-lock/acquire", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const parsed = operatorLockBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const result = await acquireOperatorLock(tid, parsed.data.tabId, operatorOwnerId(req));
  res.json(result);
});

router.post("/tournaments/:tournamentId/auction/operator-lock/heartbeat", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const parsed = operatorLockBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const result = await heartbeatOperatorLock(tid, parsed.data.tabId, operatorOwnerId(req));
  res.json(result);
});

router.post("/tournaments/:tournamentId/auction/operator-lock/release", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const parsed = operatorLockBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  await releaseOperatorLock(tid, parsed.data.tabId);
  res.json({ ok: true });
});

// POST force-takeover: authenticated organizer explicitly displaces the current lock holder.
// This is the safe "Take Over" path — the operator must confirm in the UI before calling
// this route, so it is never triggered by a transient network error.
router.post("/tournaments/:tournamentId/auction/operator-lock/takeover", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const parsed = operatorLockBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const result = await forceAcquireOperatorLock(tid, parsed.data.tabId, operatorOwnerId(req));
  auditLog(req, {
    category: "auction",
    action: "auction.operator_takeover",
    summary: "Operator session lock force-taken over",
    tournamentId: tid,
    resource: { type: "auction_session", id: tid },
    metadata: { tabId: parsed.data.tabId },
  });
  res.json(result);
});

// POST start / resume auction
router.post("/tournaments/:tournamentId/auction/start", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const session = await getOrCreateSession(tid);
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  // Block if admin-locked, UNLESS a super-admin reset happened AFTER the lock was applied.
  // A reset (lastResetAt > adminLockedAt) explicitly supersedes the lock and restores the
  // tournament to a runnable state — treating the stale adminLocked flag as a hard block
  // would incorrectly prevent valid live auctions from starting.
  if (tournament?.adminLocked) {
    const lockedAt = tournament.adminLockedAt ? new Date(tournament.adminLockedAt).getTime() : 0;
    const resetAt = tournament.lastResetAt ? new Date(tournament.lastResetAt).getTime() : 0;
    if (resetAt <= lockedAt) {
      res.status(403).json({ error: "This tournament has been locked by the admin. No further auction operations are allowed." });
      return;
    }
    // Reset happened after the lock — clear the stale flag so future starts don't re-evaluate
    await db.update(tournamentsTable)
      .set({ adminLocked: false, adminLockedAt: null })
      .where(eq(tournamentsTable.id, tid));
  }

  if (tournament?.localModeEnabled && session.status === "idle") {
    const guard = evaluateVenueAuctionGuard({
      localModeEnabled: true,
      cloudSessionStatus: session.status,
      lastMirrorAt: tournament.exportTokenLastMirrorAt,
    });
    if (guard.blockCloudStart) {
      res.status(409).json({ error: guard.blockCloudStartReason });
      return;
    }
  }

  // Readiness gate — first start only (idle → active). Resume from pause skips validation.
  if (session.status === "idle" && tournament) {
    const [{ count: teamCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamsTable)
      .where(eq(teamsTable.tournamentId, tid));
    const [{ count: playerCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tid));

    const readinessMode: AuctionReadinessMode =
      tournament.licenseStatus === "active" ? "live" : "trial";
    const issues = validateAuctionReadiness(
      tournamentToReadinessInput(tournament, teamCount, playerCount),
      readinessMode,
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

  // On resume: restore the remaining timer that was frozen on pause
  const patch: Record<string, unknown> = {
    status: "active",
    lastAction: "Auction resumed",
    timerSeconds: timerSecs,
    displayCountdown: null,
  };
  if (session.status === "idle") {
    patch.fortuneWheelActive = false;
    patch.wheelSpinning = false;
    patch.wheelWinner = null;
  }
  if (session.pausedTimeRemaining && session.pausedTimeRemaining > 0 && session.currentPlayerId) {
    patch.timerEndsAt = new Date(Date.now() + session.pausedTimeRemaining * 1000).toISOString();
    patch.pausedTimeRemaining = null;
  }

  await db.transaction(async (tx) => {
    await tx.update(auctionSessionsTable).set(patch).where(eq(auctionSessionsTable.tournamentId, tid));
    await tx.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));
  });

  // Fire-and-forget push notification — only on the first true start (idle → active),
  // not on every resume from pause, to avoid repeated notifications to owners.
  if (session.status === "idle") {
    import("./push").then(({ sendPushToTournament }) => {
      sendPushToTournament(tid, {
        title: "Auction is Live!",
        body:  "Your auction has started — open BidWar to place your bids.",
      }).catch(() => {});
    }).catch(() => {});
  }

  auditLog(req, {
    category: "auction",
    action: session.status === "idle" ? "auction.started" : "auction.resumed",
    summary: session.status === "idle" ? "Auction started" : "Auction resumed",
    tournamentId: tid,
    resource: { type: "auction_session", id: tid },
  });

  res.json(await broadcastState(tid));
});

// POST pause auction
router.post("/tournaments/:tournamentId/auction/pause", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const session = await getOrCreateSession(tid);

  // Capture remaining timer so it can be restored on resume
  let pausedTimeRemaining: number | null = null;
  if (session.timerEndsAt) {
    const remaining = Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000);
    pausedTimeRemaining = remaining > 0 ? remaining : null;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(auctionSessionsTable)
      .set({ status: "paused", lastAction: "Auction paused", timerEndsAt: null, pausedTimeRemaining })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await tx.update(tournamentsTable).set({ status: "paused" }).where(eq(tournamentsTable.id, tid));
  });
  auditLog(req, {
    category: "auction",
    action: "auction.paused",
    summary: "Auction paused",
    tournamentId: tid,
    resource: { type: "auction_session", id: tid },
    metadata: { pausedTimeRemaining },
  });
  res.json(await broadcastState(tid));
});

// POST next player
router.post("/tournaments/:tournamentId/auction/next-player", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

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
  // Capture revision for optimistic concurrency — prevents two simultaneous
  // next-player calls from both committing (last-writer-wins race).
  const nextPlayerRevision = session.revision ?? 0;

  // Parse active category filter
  let activeCatIds: number[] | null = null;
  try {
    if (session.activeCategoryIds) activeCatIds = JSON.parse(session.activeCategoryIds);
  } catch { /* ignore */ }

  // Parse deferred player IDs (bring-later queue)
  let deferredIds: number[] = [];
  try { if (session.deferredPlayerIds) deferredIds = JSON.parse(session.deferredPlayerIds); } catch { /* ignore */ }

  // Trial mode: restrict pool to first 10 players by ID
  const isTrialMode = tournament?.licenseStatus !== "active";
  let trialPlayerIds: number[] | null = null;
  if (isTrialMode) {
    const first10 = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tid))
      .orderBy(asc(playersTable.id))
      .limit(10);
    trialPlayerIds = first10.map(p => p.id);
  }

  let selectedPlayerId: number | null = null;
  let newDeferredIds = deferredIds;
  let newRandomDrawQueue: string | null = session.randomDrawQueue ?? null;

  if (playerId) {
    // Manual selection — operator picked a specific player
    selectedPlayerId = playerId;
    newRandomDrawQueue = null;
    if (deferredIds.includes(playerId)) {
      newDeferredIds = deferredIds.filter(id => id !== playerId);
    }
  } else {
    // Build base conditions
    const baseConditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
    if (activeCatIds && activeCatIds.length > 0) baseConditions.push(inArray(playersTable.categoryId, activeCatIds));
    if (trialPlayerIds && trialPlayerIds.length > 0) baseConditions.push(inArray(playersTable.id, trialPlayerIds));

    const allAvailable = await db.select().from(playersTable).where(and(...baseConditions));

    // Non-deferred players come first; fall back to deferred only when pool is empty
    const nonDeferred = allAvailable.filter(p => !deferredIds.includes(p.id));
    const pool = nonDeferred.length > 0 ? nonDeferred : allAvailable.filter(p => deferredIds.includes(p.id));

    const pick = selectPlayerFromPool(
      pool,
      mode ?? normalizePlayerSelectionMode(tournament?.playerSelectionMode),
      session,
    );
    if (pick) {
      selectedPlayerId = pick.playerId;
      newRandomDrawQueue = pick.randomDrawQueue;
      // If selected player came from the deferred list, remove them from it
      if (deferredIds.includes(pick.playerId)) {
        newDeferredIds = deferredIds.filter(id => id !== pick.playerId);
      }
    }
  }

  if (!selectedPlayerId) {
    await handleAvailablePoolExhausted(tid);
    res.json(await broadcastState(tid, ["players"]));
    return;
  }

  const [selectedPlayer] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, selectedPlayerId));

  const openingBid = await resolveOpeningBidForPlayer(
    tid,
    selectedPlayer,
    session.reAuctionStrategyJson,
  );

  // Optimistic concurrency: only commit if no other next-player call mutated
  // the session since we read it (prevents concurrent random-draw queue corruption).
  const nextPlayerCommitted = await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: selectedPlayerId,
      currentBid: openingBid,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      timerType: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
      randomDrawQueue: newRandomDrawQueue,
      displayCountdown: null,
      lastAction: `Now bidding: ${selectedPlayer.name}`,
      lastOutcome: null,
      revision: sql`COALESCE(revision, 0) + 1`,
    })
    .where(and(
      eq(auctionSessionsTable.tournamentId, tid),
      sql`COALESCE(${auctionSessionsTable.revision}, 0) = ${nextPlayerRevision}`,
    ))
    .returning({ id: auctionSessionsTable.id });

  // Log player auction start only if our update actually committed.
  // If a concurrent call won the race (0 rows updated), we skip the log and
  // broadcast the current state — the operator sees whatever the winning call
  // selected, which is correct.
  if (nextPlayerCommitted.length > 0) {
    logPlayerAuctionStart({
      tournamentId: tid,
      playerId: selectedPlayer.id,
      globalPlayerId: (selectedPlayer as any).globalPlayerId ?? null,
      categoryId: selectedPlayer.categoryId,
      sport: tournament?.sport ?? "cricket",
      playerName: selectedPlayer.name,
      playerRole: selectedPlayer.role,
      playerAge: selectedPlayer.age,
      playerCity: selectedPlayer.city,
      basePrice: selectedPlayer.basePrice,
      playerSnapshotJson: JSON.stringify(selectedPlayer),
    });
  }

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
  // Capture revision before any concurrent writes — used for the optimistic
  // concurrency check at the end of this handler to prevent two simultaneous
  // bids from both succeeding on the same session state.
  const currentRevision = session.revision ?? 0;
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  if (!session.currentPlayerId) { res.status(400).json({ error: "No player currently up for bid" }); return; }
  if (session.status !== "active") { res.status(400).json({ error: "Auction is not active" }); return; }
  if (!session.timerEndsAt || new Date(session.timerEndsAt).getTime() <= Date.now()) {
    res.status(400).json({ error: "Bidding is not open — operator must start the timer first" });
    return;
  }

  const bidIncrement = await resolveActiveBidIncrement(tid, session);
  const bidValidation = validateBidAmount(amount, {
    currentBid: session.currentBid,
    bidIncrement,
    currentBidTeamId: session.currentBidTeamId,
  });
  if (!bidValidation.ok) {
    res.status(400).json({ error: bidValidation.error });
    return;
  }

  // Double-bid prevention — same team can't bid if already leading
  if (session.currentBidTeamId === teamId) {
    res.status(409).json({ error: "Your team is already the highest bidder" });
    return;
  }

  const team = await requireTeamInTournament(res, tid, teamId);
  if (!team) return;
  if (!team.isBiddingEnabled) { res.status(400).json({ error: "Bidding disabled for this team" }); return; }

  // Access-code gate (Phase 5 hardening):
  //
  // A blank/null accessCode is NOT a bypass — unauthenticated callers must
  // supply the code. Only authenticated organizers/admins are exempt.
  //
  // Security improvements vs previous code:
  //   1. Teams with no accessCode still require organizer auth for unauthenticated
  //      callers — anonymous bids on codeless teams are now rejected.
  //   2. String comparison is timing-safe to prevent brute-force inference.
  const isOrganizer = isTournamentOrganizer(req, tid, tournament?.organizerId);
  if (!isOrganizer) {
    // Non-organizer callers must supply the correct access code.
    const teamCode = (team.accessCode ?? "").trim();
    const suppliedCode = (accessCode ?? "").trim();

    if (!teamCode) {
      // Team has no access code configured — anonymous bids not permitted.
      // The owner should set an access code via the team management panel.
      res.status(403).json({ error: "This team has no access code set. Contact the auction organizer." });
      return;
    }

    // Timing-safe comparison — prevents timing-based brute-force attacks.
    // Reuse the same safeCompare helper used in reset-trial.
    const a = teamCode.toUpperCase();
    const b = suppliedCode.toUpperCase();
    let timingSafeResult = a.length === b.length;
    if (timingSafeResult) {
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
      timingSafeResult = diff === 0;
    }
    if (!timingSafeResult) {
      res.status(403).json({ error: "Invalid access code" });
      return;
    }
  }

  // Trial mode: only the first 2 teams (by ID) may bid
  if (tournament?.licenseStatus !== "active") {
    const trialTeams = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(eq(teamsTable.tournamentId, tid))
      .orderBy(asc(teamsTable.id))
      .limit(2);
    if (!trialTeams.some(t => t.id === teamId)) {
      res.status(403).json({ error: "Trial mode: only the first 2 teams can bid. Contact admin to activate your license for a full auction." });
      return;
    }
  }

  const { spendablePurse, reservePurse, slotsRequired, maximumSquadSize } = await computeTeamPurseProtection(tid, teamId, {
    team: { purse: team.purse, purseUsed: team.purseUsed },
  });

  // Max squad check — count players already on this team
  if (maximumSquadSize > 0) {
    const allPlayers = await db
      .select({ id: playersTable.id, status: playersTable.status, teamId: playersTable.teamId, isNonPlayingMember: playersTable.isNonPlayingMember })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tid));
    // Non-playing members don't count toward squad-slot limits
    const playersBought = allPlayers.filter(
      (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained") && !p.isNonPlayingMember
    ).length;
    if (playersBought >= maximumSquadSize) {
      res.status(400).json({ error: `Maximum squad size reached — this team already has ${playersBought} player${playersBought !== 1 ? "s" : ""} (limit: ${maximumSquadSize})` });
      return;
    }
  }

  // Category max players check — if current player belongs to a category with a max, enforce it
  if (session.currentPlayerId) {
    const [bidPlayer] = await db
      .select({ categoryId: playersTable.categoryId })
      .from(playersTable)
      .where(eq(playersTable.id, session.currentPlayerId));
    if (bidPlayer?.categoryId) {
      const [bidCat] = await db
        .select({ maxPlayers: categoriesTable.maxPlayers, name: categoriesTable.name })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, bidPlayer.categoryId));
      if (bidCat?.maxPlayers && bidCat.maxPlayers > 0) {
        const catPlayers = await db
          .select({ id: playersTable.id, isNonPlayingMember: playersTable.isNonPlayingMember })
          .from(playersTable)
          .where(
            and(
              eq(playersTable.tournamentId, tid),
              eq(playersTable.teamId, teamId),
              eq(playersTable.categoryId, bidPlayer.categoryId),
              inArray(playersTable.status, ["sold", "retained"])
            )
          );
        // Non-playing members don't count toward category limits either
        const catPlayerCount = catPlayers.filter((p) => !p.isNonPlayingMember).length;
        if (catPlayerCount >= bidCat.maxPlayers) {
          res.status(400).json({
            error: `Category limit reached — your team already has the maximum ${bidCat.maxPlayers} player${bidCat.maxPlayers !== 1 ? "s" : ""} in the "${bidCat.name}" category`,
          });
          return;
        }
      }
    }
  }

  if (amount > spendablePurse) {
    const msg = reservePurse > 0
      ? `Insufficient spendable purse — ₹${reservePurse.toLocaleString("en-IN")} reserved for ${slotsRequired} minimum squad slot${slotsRequired !== 1 ? "s" : ""}`
      : "Insufficient purse";
    res.status(400).json({ error: msg });
    return;
  }

  const timerDurationSecs = computeBidTimerDuration(session, tournament);
  const newTimerEndsAt = new Date(Date.now() + timerDurationSecs * 1000).toISOString();

  // Optimistic concurrency: only commit if no other bid has mutated the session
  // since we read it. COALESCE handles existing rows created before this column.
  // If 0 rows are updated, a concurrent bid won the race — return 409.
  const committed = await db
    .update(auctionSessionsTable)
    .set({
      currentBid: amount,
      currentBidTeamId: teamId,
      timerEndsAt: newTimerEndsAt,
      timerType: "bid",
      pausedTimeRemaining: null,
      revision: sql`COALESCE(revision, 0) + 1`,
      lastAction: `${team.name} bid ₹${amount.toLocaleString("en-IN")}`,
    })
    .where(and(
      eq(auctionSessionsTable.tournamentId, tid),
      sql`COALESCE(${auctionSessionsTable.revision}, 0) = ${currentRevision}`,
    ))
    .returning({ id: auctionSessionsTable.id });

  if (committed.length === 0) {
    res.status(409).json({
      error: "A concurrent bid changed the auction state — please refresh and bid again.",
      hint: "stale_bid",
    });
    return;
  }

  // Log bid event (fire-and-forget — never blocks the response)
  logBidEvent({
    tournamentId: tid,
    playerId: session.currentPlayerId!,
    globalPlayerId: null,
    teamId,
    sport: tournament?.sport ?? "cricket",
    bidAmount: amount,
    previousBidAmount: session.currentBid,
    timerEndsAt: session.timerEndsAt,
    isManualBid: false,
  });

  res.json(await broadcastBidDelta(tid, {
    playerId: session.currentPlayerId!,
    currentBid: amount,
    currentBidTeamId: teamId,
    currentBidTeamName: team.name,
    currentBidTeamColor: team.color ?? null,
    currentBidTeamLogoUrl: team.logoUrl ?? null,
    timerEndsAt: newTimerEndsAt,
    timerType: "bid",
    lastAction: `${team.name} bid ₹${amount.toLocaleString("en-IN")}`,
    bidIncrement,
  }));
});

// POST sell player (to highest bidder)
router.post("/tournaments/:tournamentId/auction/sell", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  // Optional sell-confirmation guard: the operator UI sends these fields so the
  // server can detect if a new bid arrived between when the operator saw the
  // leading bid and when this request reached the server.
  const sellBodySchema = z.object({
    expectedBidTeamId: z.number().int().optional(),
    expectedBidAmount: z.number().int().optional(),
  });
  const sellBody = sellBodySchema.safeParse(req.body ?? {});
  const sellConfirmation = sellBody.success ? sellBody.data : {};

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  if (!session.currentPlayerId || !session.currentBidTeamId) {
    res.status(400).json({ error: "No current player or bidder" });
    return;
  }

  // Phase 3 sell-race guard: if the operator sent expected values, verify that
  // the auction state still matches what they saw when they clicked SELL.
  // If a new bid arrived in flight, return 409 so the UI can confirm with the
  // actual current leader instead of selling to the wrong team.
  if (sellConfirmation.expectedBidTeamId !== undefined &&
      sellConfirmation.expectedBidTeamId !== session.currentBidTeamId) {
    res.status(409).json({
      error: "Auction state changed — a new bid arrived before your sell request. Please confirm the current leader.",
      currentBidTeamId: session.currentBidTeamId,
      currentBid: session.currentBid,
      hint: "sell_race",
    });
    return;
  }
  if (sellConfirmation.expectedBidAmount !== undefined &&
      sellConfirmation.expectedBidAmount !== session.currentBid) {
    res.status(409).json({
      error: "Auction state changed — the bid amount changed before your sell request. Please confirm the current bid.",
      currentBidTeamId: session.currentBidTeamId,
      currentBid: session.currentBid,
      hint: "sell_race",
    });
    return;
  }

  const playerId = session.currentPlayerId;
  const teamId = session.currentBidTeamId;
  const soldAmount = session.currentBid ?? 0;

  // All four table writes are atomic: a mid-flight server failure cannot leave
  // players sold while purse is unchanged, or bids recorded without a sold player.
  const { soldPlayer, team } = await db.transaction(async (tx) => {
    await tx
      .update(playersTable)
      .set({ status: "sold", teamId, soldPrice: soldAmount })
      .where(eq(playersTable.id, playerId));

    // Phase 6: atomic purse increment — no read-modify-write, no lost update
    await tx
      .update(teamsTable)
      .set({ purseUsed: sql`COALESCE(purse_used, 0) + ${soldAmount}` })
      .where(eq(teamsTable.id, teamId));

    await tx.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount: soldAmount });

    const [txTeam] = await tx.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    const [txSoldPlayer] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));

    await tx
      .update(auctionSessionsTable)
      .set({
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        pausedTimeRemaining: null,
        // Bump revision so any in-flight bid (concurrent with this sell) returns
        // stale_bid instead of silently overwriting the sold state.
        revision: sql`COALESCE(revision, 0) + 1`,
        lastAction: `SOLD: ${txSoldPlayer?.name ?? "Player"} to ${txTeam?.name ?? "Team"} for ₹${soldAmount.toLocaleString("en-IN")}`,
        lastOutcome: JSON.stringify({
          type: "sold",
          playerId,
          playerName: txSoldPlayer?.name ?? "Player",
          photoUrl: txSoldPlayer?.photoUrl ?? null,
          teamId,
          teamName: txTeam?.name ?? null,
          teamColor: txTeam?.color ?? null,
          teamLogoUrl: txTeam?.logoUrl ?? null,
          amount: soldAmount,
          isManual: false,
        }),
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));

    return { soldPlayer: txSoldPlayer, team: txTeam };
  });

  // Tournament fetch is read-only; placed after commit so notifications use fresh data.
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  // Fire-and-forget WhatsApp notification
  notifyPlayerSold({
    mobile: soldPlayer?.mobileNumber ?? null,
    tournamentId: tid,
    playerName: soldPlayer?.name ?? "Player",
    teamName: team?.name ?? "Team",
    amount: soldAmount,
    tournamentName: tournament?.name ?? "the tournament",
  });

  // DLT SMS: notify player about being sold (fire-and-forget, live tournaments only)
  if (tournament?.licenseStatus === "active" && soldPlayer?.mobileNumber) {
    const playerMobile = soldPlayer.mobileNumber;
    void (async () => {
      try {
        const { smsNotificationSettingsTable } = await import("@workspace/db");
        const { sendDltSms, playerSoldTemplateId } = await import("../lib/fast2sms");
        const [settings] = await db.select().from(smsNotificationSettingsTable).limit(1);
        // Env var takes priority over DB setting so the template ID is universal
        const envTemplateId = playerSoldTemplateId();
        const templateId = envTemplateId || settings?.playerSoldTemplateId;
        logger.info({
          playerId,
          dltEnabled: settings?.dltEnabled,
          playerSoldEnabled: settings?.playerSoldEnabled,
          templateIdSource: envTemplateId ? "env" : "db",
          templateId,
          mobile: playerMobile.slice(0, 4) + "xxxxxx",
        }, "DLT player-sold SMS: pre-flight check");
        if (settings?.dltEnabled && settings.playerSoldEnabled && templateId) {
          // Template vars (must match approved DLT sample exactly):
          // 1=player name, 2=team name, 3=amount as plain number, 4=app URL
          const appUrl = getPublicOrigin();
          const result = await sendDltSms(
            [playerMobile],
            templateId,
            [soldPlayer.name ?? "Player", team?.name ?? "Team", String(soldAmount), appUrl],
          );
          if (result.success) {
            logger.info({ playerId, templateId, mobile: playerMobile.slice(0, 4) + "xxxxxx" }, "DLT player-sold SMS: sent");
          } else {
            logger.error({ playerId, templateId, err: result.error }, "DLT player-sold SMS: API rejected");
          }
        } else {
          logger.warn({
            playerId,
            dltEnabled: settings?.dltEnabled,
            playerSoldEnabled: settings?.playerSoldEnabled,
            templateId,
          }, "DLT player-sold SMS: skipped (condition not met)");
        }
      } catch (err) { logger.error({ err, playerId }, "DLT player-sold SMS failed"); }
    })();
  } else {
    logger.info({
      playerId,
      licenseStatus: tournament?.licenseStatus,
      hasMobile: !!soldPlayer?.mobileNumber,
    }, "DLT player-sold SMS: not attempted (no mobile or not active)");
  }

  // Log player auction end (fire-and-forget)
  logPlayerAuctionEnd({
    tournamentId: tid,
    playerId,
    globalPlayerId: (soldPlayer as any)?.globalPlayerId ?? null,
    categoryId: soldPlayer?.categoryId,
    sport: tournament?.sport ?? "cricket",
    playerName: soldPlayer?.name ?? "Player",
    playerRole: soldPlayer?.role,
    playerAge: soldPlayer?.age,
    playerCity: soldPlayer?.city,
    basePrice: soldPlayer?.basePrice,
    playerSnapshotJson: JSON.stringify(soldPlayer),
    outcome: "sold",
    finalAmount: soldAmount,
    soldToTeamId: teamId,
    soldToTeamName: team?.name,
  });

  if (soldPlayer && team) {
    onAuctionPlayerSoldAsync(soldPlayer, team, tid);
  }

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastSoldDelta(tid, { playerId, teamId, amount: soldAmount }, ["bids", "players"]));
});
router.post("/tournaments/:tournamentId/auction/manual-sell", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const schema = z.object({
    teamId: z.number().int(),
    amount: z.number().int().min(0),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const reasonResult = parseAuditReason(req.body, false);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

  const { teamId, amount } = parsed.data;
  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;

  if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }

  const playerId = session.currentPlayerId;
  const [playerBefore] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  const teamBefore = await requireTeamInTournament(res, tid, teamId);
  if (!teamBefore) return;

  // ── Purse validation ───────────────────────────────────────────────────────
  if (amount > 0) {
    const { spendablePurse, reservePurse, slotsRequired } = await computeTeamPurseProtection(tid, teamId);
    if (amount > spendablePurse) {
      const msg = reservePurse > 0
        ? `Insufficient purse — ₹${reservePurse.toLocaleString("en-IN")} reserved for ${slotsRequired} minimum squad slot${slotsRequired !== 1 ? "s" : ""}`
        : "Insufficient purse for this team";
      res.status(400).json({ error: msg });
      return;
    }
  }

  // All four table writes are atomic — no partial state on failure.
  const { soldPlayer, team, teamAfter } = await db.transaction(async (tx) => {
    await tx
      .update(playersTable)
      .set({ status: "sold", teamId, soldPrice: amount })
      .where(eq(playersTable.id, playerId));

    // Phase 6: atomic purse increment — no read-modify-write, no lost update
    if (amount > 0) {
      await tx
        .update(teamsTable)
        .set({ purseUsed: sql`COALESCE(purse_used, 0) + ${amount}` })
        .where(eq(teamsTable.id, teamId));
      await tx.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount });
    }

    const [txTeam] = await tx.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    const [txSoldPlayer] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
    const txTeamAfter = txTeam; // same row post-update, re-used for audit snapshot

    await tx
      .update(auctionSessionsTable)
      .set({
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        pausedTimeRemaining: null,
        lastAction: `SOLD: ${txSoldPlayer?.name ?? "Player"} to ${txTeam?.name ?? "Team"} for ₹${amount.toLocaleString("en-IN")} (manual)`,
        lastOutcome: JSON.stringify({
          type: "sold",
          playerId,
          playerName: txSoldPlayer?.name ?? "Player",
          photoUrl: txSoldPlayer?.photoUrl ?? null,
          teamId,
          teamName: txTeam?.name ?? null,
          teamColor: txTeam?.color ?? null,
          teamLogoUrl: txTeam?.logoUrl ?? null,
          amount,
          isManual: true,
        }),
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));

    return { soldPlayer: txSoldPlayer, team: txTeam, teamAfter: txTeamAfter };
  });

  // Tournament fetch is read-only; after commit so notifications use fresh data.
  const [manualTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  notifyPlayerSold({
    mobile: soldPlayer?.mobileNumber ?? null,
    tournamentId: tid,
    playerName: soldPlayer?.name ?? "Player",
    teamName: team?.name ?? "Team",
    amount,
    tournamentName: manualTournament?.name ?? "the tournament",
  });

  // Log player auction end for manual sell (fire-and-forget)
  logPlayerAuctionEnd({
    tournamentId: tid,
    playerId,
    globalPlayerId: (soldPlayer as any)?.globalPlayerId ?? null,
    categoryId: soldPlayer?.categoryId,
    sport: manualTournament?.sport ?? "cricket",
    playerName: soldPlayer?.name ?? "Player",
    playerRole: soldPlayer?.role,
    playerAge: soldPlayer?.age,
    playerCity: soldPlayer?.city,
    basePrice: soldPlayer?.basePrice,
    playerSnapshotJson: JSON.stringify(soldPlayer),
    outcome: "sold",
    finalAmount: amount,
    soldToTeamId: teamId,
    soldToTeamName: team?.name,
  });

  auditLog(req, {
    category: "auction",
    action: "auction.manual_sell",
    summary: `Manual sell: ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${amount.toLocaleString("en-IN")}`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId: tid,
    playerId,
    teamId,
    resource: { type: "player", id: playerId },
    before: {
      player: playerBefore ? snapshotPlayer(playerBefore) : null,
      team: teamBefore ? snapshotTeam(teamBefore) : null,
    },
    after: {
      player: soldPlayer ? snapshotPlayer(soldPlayer) : null,
      team: teamAfter ? snapshotTeam(teamAfter) : null,
    },
    metadata: { amount, teamId, isManual: true },
    alertKey: "auction_manual_sell",
  });

  if (soldPlayer && team) {
    onAuctionPlayerSoldAsync(soldPlayer, team, tid);
  }

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastSoldDelta(tid, { playerId, teamId, amount }, ["bids", "players"]));
});

// POST mark unsold
router.post("/tournaments/:tournamentId/auction/unsold", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, session.currentPlayerId));

  // Atomic: player status and session cleared together — no partial state.
  await db.transaction(async (tx) => {
    await tx
      .update(playersTable)
      .set({ status: "unsold" })
      .where(eq(playersTable.id, session.currentPlayerId));

    await tx
      .update(auctionSessionsTable)
      .set({
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        pausedTimeRemaining: null,
        lastAction: `UNSOLD: ${player?.name ?? "Player"}`,
        lastOutcome: JSON.stringify({
          type: "unsold",
          playerId: player?.id ?? null,
          playerName: player?.name ?? "Player",
          photoUrl: player?.photoUrl ?? null,
        }),
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
  });

  // Tournament fetch is read-only; after commit so notification uses fresh data.
  const [unsoldTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  notifyPlayerUnsold({
    mobile: player?.mobileNumber ?? null,
    tournamentId: tid,
    playerName: player?.name ?? "Player",
    tournamentName: unsoldTournament?.name ?? "the tournament",
  });

  // Log player auction end as unsold (fire-and-forget)
  logPlayerAuctionEnd({
    tournamentId: tid,
    playerId: player!.id,
    globalPlayerId: (player as any)?.globalPlayerId ?? null,
    categoryId: player?.categoryId,
    sport: unsoldTournament?.sport ?? "cricket",
    playerName: player?.name ?? "Player",
    playerRole: player?.role,
    playerAge: player?.age,
    playerCity: player?.city,
    basePrice: player?.basePrice,
    playerSnapshotJson: JSON.stringify(player),
    outcome: "unsold",
    finalAmount: null,
    soldToTeamId: null,
    soldToTeamName: null,
  });

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastState(tid, ["players"]));
});

// POST re-auction a previously sold/unsold player
router.post("/tournaments/:tournamentId/auction/re-auction", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const schema = z.object({
    playerId: z.number().int(),
    startFromBase: z.boolean().optional().default(true),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const reasonResult = parseAuditReason(req.body, false);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;

  const { playerId, startFromBase } = parsed.data;
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));

  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // Fetch read-only data before the transaction so they are available both
  // inside (for writes) and outside (for notifications/audit).
  const startingBid = startFromBase ? player.basePrice : (player.soldPrice ?? player.basePrice);
  const [reTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const timerSecs = reTournament?.timerSeconds ?? 30;

  // Atomic: purse reversal + bid deletion + player reset + session update.
  await db.transaction(async (tx) => {
    // If player was sold, reverse purse usage (Phase 6: atomic decrement, clamped at 0)
    if (player.status === "sold" && player.teamId && player.soldPrice) {
      await tx
        .update(teamsTable)
        .set({ purseUsed: sql`GREATEST(0, COALESCE(purse_used, 0) - ${player.soldPrice})` })
        .where(eq(teamsTable.id, player.teamId));
      await tx
        .delete(bidsTable)
        .where(and(eq(bidsTable.playerId, playerId), eq(bidsTable.tournamentId, tid)));
    }

    await tx
      .update(playersTable)
      .set({ status: "available", teamId: null, soldPrice: null })
      .where(eq(playersTable.id, playerId));

    await tx
      .update(auctionSessionsTable)
      .set({
        status: "active",
        currentPlayerId: playerId,
        currentBid: startingBid,
        currentBidTeamId: null,
        timerSeconds: timerSecs,
        timerEndsAt: null,
        timerType: null,
        randomDrawQueue: null,
        lastAction: `RE-AUCTION: ${player.name}`,
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
  });

  notifyPlayerReAuction({
    mobile: player.mobileNumber ?? null,
    tournamentId: tid,
    playerName: player.name,
    tournamentName: reTournament?.name ?? "the tournament",
  });

  const [playerAfter] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  auditLog(req, {
    category: "auction",
    action: "auction.reauction",
    summary: `Re-auction: ${player.name} returned to pool`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId: tid,
    playerId,
    teamId: player.teamId ?? undefined,
    resource: { type: "player", id: playerId },
    before: { player: snapshotPlayer(player) },
    after: { player: playerAfter ? snapshotPlayer(playerAfter) : null },
    metadata: { startFromBase, priorStatus: player.status, priorSoldPrice: player.soldPrice },
    alertKey: "auction_reauction",
  });

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST re-auction all unsold — reset all unsold players back to available for another round
router.post("/tournaments/:tournamentId/auction/re-auction-unsold", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const reasonResult = parseAuditReason(req.body, false);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

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

  const unsoldPlayers = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.status, "unsold")));

  if (unsoldPlayers.length === 0) {
    res.status(400).json({ error: "No unsold players to re-auction" });
    return;
  }

  // Atomic: all player resets and session update succeed together.
  await db.transaction(async (tx) => {
    for (const p of unsoldPlayers) {
      await tx
        .update(playersTable)
        .set({ status: "available" })
        .where(eq(playersTable.id, p.id));
    }

    await tx
      .update(auctionSessionsTable)
      .set({
        randomDrawQueue: null,
        reAuctionStrategyJson: serializeReAuctionStrategy(strategyResult.strategy),
        lastAction: `RE-AUCTION ROUND: ${unsoldPlayers.length} unsold players returned to queue`,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
  });

  auditLog(req, {
    category: "auction",
    action: "auction.reauction_all_unsold",
    summary: `Re-auction round: ${unsoldPlayers.length} unsold players returned to queue`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId: tid,
    resource: { type: "auction_session", id: tid },
    metadata: {
      playerCount: unsoldPlayers.length,
      playerIds: unsoldPlayers.map((p) => p.id),
      reAuctionStrategy: strategyResult.strategy,
    },
    alertKey: "auction_reauction_bulk",
  });

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastState(tid, ["players"]));
});

// POST reset trial auction — reset all non-retained players to available, clear bids and intelligence logs.
// Operator panel: tournament organizer password. Admin panel: super admin password (ADMIN_PASSWORD).
router.post("/tournaments/:tournamentId/auction/reset-trial", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const body = z.object({
    password: z.string().optional(),
    reason: z.string().optional(),
    resetContext: z.enum(["organizer", "admin"]).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const submittedPw = (body.data.password ?? "").trim();
  const resetContext = body.data.resetContext ?? (req.jwtUser?.isAdmin ? "admin" : "organizer");
  const reasonResult = parseAuditReason(req.body, resetContext === "admin");
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  const auditReason =
    reasonResult.reason ??
    `Organizer cleared practice auction data on ${new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    })} (IST)`;

  const safeCompare = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  };

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  if (resetContext === "organizer" && tournament.status === "completed") {
    res.status(403).json({
      error: "This tournament is completed. Auction reset is no longer available from the organizer panel.",
    });
    return;
  }

  const masterPw = getAdminPassword();
  const isMasterMatch = !!masterPw && safeCompare(submittedPw, masterPw);
  const isOperatorMatch = !!tournament.organizerPassword && safeCompare(submittedPw, tournament.organizerPassword);
  const previousResetCount = tournament.resetCount ?? 0;

  const authenticatedOrganizer = isTournamentOrganizer(req, tid, tournament.organizerId);

  let resetActor: "operator" | "super_admin";
  if (resetContext === "organizer") {
    if (authenticatedOrganizer) {
      resetActor = "operator";
    } else if (!tournament.organizerPassword) {
      res.status(400).json({ error: "No organizer password is set for this tournament. Contact platform support." });
      return;
    } else if (!submittedPw || !isOperatorMatch) {
      res.status(401).json({ error: "Incorrect organizer password" });
      return;
    } else {
      resetActor = "operator";
    }
  } else if (isMasterMatch) {
    resetActor = "super_admin";
  } else {
    res.status(401).json({ error: "Incorrect super admin password" });
    return;
  }

  const allPlayers = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));

  // Fetch teams before the transaction (read-only; used to compute retained purse cost).
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid));

  // Atomic: all 7 tables either succeed together or are fully rolled back.
  // invalidateIntelCacheForTournament (in-memory) runs after commit.
  await db.transaction(async (tx) => {
    for (const p of allPlayers) {
      if (p.status !== "retained") {
        await tx
          .update(playersTable)
          .set({ status: "available", teamId: null, soldPrice: null })
          .where(eq(playersTable.id, p.id));
      }
    }

    for (const team of teams) {
      const retainedPlayers = allPlayers.filter(
        (p) => p.status === "retained" && p.teamId === team.id
      );
      const retainedCost = retainedPlayers.reduce((sum, p) => sum + (p.retainedPrice ?? 0), 0);
      await tx
        .update(teamsTable)
        .set({ purseUsed: retainedCost })
        .where(eq(teamsTable.id, team.id));
    }

    await tx.delete(bidsTable).where(eq(bidsTable.tournamentId, tid));

    // Trial resets must not leave behavioral intelligence — it would pollute live analytics.
    await tx.delete(auctionBidEventsTable).where(eq(auctionBidEventsTable.tournamentId, tid));
    await tx
      .delete(auctionPlayerEventsTable)
      .where(eq(auctionPlayerEventsTable.tournamentId, tid));
    await tx
      .delete(auctionTimerEventsTable)
      .where(eq(auctionTimerEventsTable.tournamentId, tid));

    await tx
      .update(auctionSessionsTable)
      .set({
        status: "idle",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        deferredPlayerIds: null,
        randomDrawQueue: null,
        reAuctionStrategyJson: null,
        soldPlayersCount: 0,
        unsoldPlayersCount: 0,
        lastAction: "Reset complete — ready for live auction",
        lastOutcome: null,
        fortuneWheelActive: false,
        wheelSpinning: false,
        wheelWinner: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));

    await tx
      .update(tournamentsTable)
      .set({
        status: "setup",
        resetCount: previousResetCount + 1,
        lastResetAt: new Date(),
        lastResetBy: resetActor,
        // A reset always clears the admin lock — the act of resetting implies the
        // tournament is being prepared for another live run.
        adminLocked: false,
        adminLockedAt: null,
      })
      .where(eq(tournamentsTable.id, tid));
  });

  // In-memory cache invalidation — runs after the DB transaction commits.
  invalidateIntelCacheForTournament(tid);

  auditLog(req, {
    category: "auction",
    action: "auction.reset_trial",
    summary: `Trial auction reset by ${resetActor}`,
    severity: "critical",
    reason: auditReason,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    metadata: {
      resetActor,
      previousResetCount,
      newResetCount: previousResetCount + 1,
      playerCount: allPlayers.length,
      teamCount: teams.length,
    },
    alertKey: "auction_reset_trial",
  });

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST defer current player — send to back of queue; auto-advance unless manual selection mode
router.post("/tournaments/:tournamentId/auction/defer-player", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  if (!session.currentPlayerId) {
    res.status(400).json({ error: "No player currently on the block" });
    return;
  }

  const deferredId = session.currentPlayerId;

  // Get deferred player name for lastAction log
  const [deferredPlayer] = await db
    .select({ name: playersTable.name })
    .from(playersTable)
    .where(eq(playersTable.id, deferredId));

  // Add current player to deferred list (avoid duplicates)
  let deferredIds: number[] = [];
  try { if (session.deferredPlayerIds) deferredIds = JSON.parse(session.deferredPlayerIds); } catch { /* ignore */ }
  if (!deferredIds.includes(deferredId)) deferredIds.push(deferredId);

  // Fetch tournament settings
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const timerSecs = tournament?.timerSeconds ?? 30;
  const selMode = normalizePlayerSelectionMode(tournament?.playerSelectionMode);
  const isTrialMode = tournament?.licenseStatus !== "active";

  // Parse active category filter
  let activeCatIds: number[] | null = null;
  try { if (session.activeCategoryIds) activeCatIds = JSON.parse(session.activeCategoryIds); } catch { /* ignore */ }

  // Trial mode: restrict pool to first 10 players by ID
  let trialPlayerIds: number[] | null = null;
  if (isTrialMode) {
    const first10 = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, tid))
      .orderBy(asc(playersTable.id))
      .limit(10);
    trialPlayerIds = first10.map(p => p.id);
  }

  // Build available pool (excluding just-deferred player)
  const baseConditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
  if (activeCatIds && activeCatIds.length > 0) baseConditions.push(inArray(playersTable.categoryId, activeCatIds));
  if (trialPlayerIds && trialPlayerIds.length > 0) baseConditions.push(inArray(playersTable.id, trialPlayerIds));

  const allAvailable = await db.select().from(playersTable).where(and(...baseConditions));

  // Manual mode: defer only — operator picks the next player via next-player + playerId
  if (selMode === "manual") {
    await db
      .update(auctionSessionsTable)
      .set({
        status: "active",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerSeconds: timerSecs,
        timerEndsAt: null,
        timerType: null,
        pausedTimeRemaining: null,
        deferredPlayerIds: deferredIds.length > 0 ? JSON.stringify(deferredIds) : null,
        randomDrawQueue: null,
        lastAction: `Brought later: ${deferredPlayer?.name ?? "Player"} — select next player`,
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));

    logPlayerAuctionEnd({
      tournamentId: tid,
      playerId: deferredId,
      globalPlayerId: null,
      categoryId: null,
      sport: tournament?.sport ?? "cricket",
      playerName: deferredPlayer?.name ?? "Player",
      playerRole: null,
      playerAge: null,
      playerCity: null,
      basePrice: null,
      playerSnapshotJson: "{}",
      outcome: "deferred",
      finalAmount: null,
      soldToTeamId: null,
      soldToTeamName: null,
    });

    res.json(await broadcastState(tid, ["players"]));
    return;
  }

  const nonDeferred = allAvailable.filter(p => !deferredIds.includes(p.id));
  const pool = nonDeferred.length > 0 ? nonDeferred : allAvailable.filter(p => deferredIds.includes(p.id));

  let selectedPlayerId: number | null = null;
  let newDeferredIds = deferredIds;
  let newRandomDrawQueue: string | null = session.randomDrawQueue ?? null;

  if (pool.length > 0) {
    const pick = selectPlayerFromPool(pool, selMode, session);
    if (pick) {
      selectedPlayerId = pick.playerId;
      newRandomDrawQueue = pick.randomDrawQueue;
      // If next player was from the deferred list, remove them
      if (deferredIds.includes(pick.playerId)) {
        newDeferredIds = deferredIds.filter(id => id !== pick.playerId);
      }
    }
  }

  if (!selectedPlayerId) {
    await handleAvailablePoolExhausted(tid);
    res.json(await broadcastState(tid, ["players"]));
    return;
  }

  const [selectedPlayer] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, selectedPlayerId));

  const openingBidDefer = await resolveOpeningBidForPlayer(
    tid,
    selectedPlayer,
    session.reAuctionStrategyJson,
  );

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: selectedPlayerId,
      currentBid: openingBidDefer,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      timerType: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
      randomDrawQueue: newRandomDrawQueue,
      lastAction: `Brought later: ${deferredPlayer?.name ?? "Player"} — Now bidding: ${selectedPlayer.name}`,
      lastOutcome: null,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  // Log player auction as deferred + auction start for next player (fire-and-forget)
  logPlayerAuctionEnd({
    tournamentId: tid,
    playerId: deferredId,
    globalPlayerId: null,
    categoryId: null,
    sport: tournament?.sport ?? "cricket",
    playerName: deferredPlayer?.name ?? "Player",
    playerRole: null,
    playerAge: null,
    playerCity: null,
    basePrice: null,
    playerSnapshotJson: "{}",
    outcome: "deferred",
    finalAmount: null,
    soldToTeamId: null,
    soldToTeamName: null,
  });
  logPlayerAuctionStart({
    tournamentId: tid,
    playerId: selectedPlayer.id,
    globalPlayerId: (selectedPlayer as any).globalPlayerId ?? null,
    categoryId: selectedPlayer.categoryId,
    sport: tournament?.sport ?? "cricket",
    playerName: selectedPlayer.name,
    playerRole: selectedPlayer.role,
    playerAge: selectedPlayer.age,
    playerCity: selectedPlayer.city,
    basePrice: selectedPlayer.basePrice,
    playerSnapshotJson: JSON.stringify(selectedPlayer),
  });

  res.json(await broadcastState(tid, ["players"]));
});

// POST undo last action
router.post("/tournaments/:tournamentId/auction/undo", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

  const lastBid = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid))
    .orderBy(desc(bidsTable.timestamp))
    .limit(1);

  if (lastBid.length > 0) {
    const bid = lastBid[0];
    const [playerBefore] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
    const [teamBefore] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
    const [sessionBefore] = await db
      .select()
      .from(auctionSessionsTable)
      .where(eq(auctionSessionsTable.tournamentId, tid));

    const purseUsedBefore = teamBefore?.purseUsed ?? 0;
    const purseUsedAfter = Math.max(0, purseUsedBefore - bid.amount); // kept for audit metadata

    // Atomic: player reset + purse reversal + bid deletion + session update.
    const { player, teamAfter } = await db.transaction(async (tx) => {
      await tx
        .update(playersTable)
        .set({ status: "available", teamId: null, soldPrice: null })
        .where(eq(playersTable.id, bid.playerId));

      // Phase 6: atomic decrement — GREATEST(0, …) prevents negative purse
      if (teamBefore) {
        await tx
          .update(teamsTable)
          .set({ purseUsed: sql`GREATEST(0, COALESCE(purse_used, 0) - ${bid.amount})` })
          .where(eq(teamsTable.id, bid.teamId));
      }

      await tx.delete(bidsTable).where(eq(bidsTable.id, bid.id));

      await tx
        .update(auctionSessionsTable)
        .set({ lastAction: `Undone: ${playerBefore?.name ?? "Player"} returned to pool`, randomDrawQueue: null })
        .where(eq(auctionSessionsTable.tournamentId, tid));

      // Re-fetch post-transaction state for the audit "after" snapshot.
      const [txPlayer] = await tx.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
      const [txTeamAfter] = await tx.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
      return { player: txPlayer, teamAfter: txTeamAfter };
    });

    auditLog(req, {
      category: "auction",
      action: "auction.undo",
      summary: `Undo: ${playerBefore?.name ?? "Player"} sale to ${teamBefore?.name ?? "team"} reversed (₹${bid.amount.toLocaleString("en-IN")})`,
      severity: "critical",
      reason: reasonResult.reason,
      tournamentId: tid,
      playerId: bid.playerId,
      teamId: bid.teamId,
      resource: { type: "bid", id: bid.id },
      related: { table: "bids", id: bid.id },
      before: {
        player: playerBefore ? snapshotPlayer(playerBefore) : null,
        team: teamBefore ? snapshotTeam(teamBefore) : null,
        bid: {
          id: bid.id,
          amount: bid.amount,
          timestamp: bid.timestamp?.toISOString?.() ?? null,
          playerId: bid.playerId,
          teamId: bid.teamId,
        },
        session: sessionBefore
          ? { status: sessionBefore.status, currentPlayerId: sessionBefore.currentPlayerId, currentBid: sessionBefore.currentBid }
          : null,
      },
      after: {
        player: player ? snapshotPlayer(player) : null,
        team: teamAfter ? snapshotTeam(teamAfter) : null,
        bid: null,
      },
      metadata: {
        undoType: "last_bid_sale",
        bidId: bid.id,
        amount: bid.amount,
        purseDelta: -bid.amount,
        purseUsedBefore,
        purseUsedAfter,
        playerName: playerBefore?.name ?? null,
        teamName: teamBefore?.name ?? null,
        teamShortCode: teamBefore?.shortCode ?? null,
        bidTimestamp: bid.timestamp?.toISOString?.() ?? null,
        saleReversed: true,
      },
      alertKey: "auction_undo",
    });
  } else {
    await db
      .update(auctionSessionsTable)
      .set({ lastAction: "Nothing to undo" })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    auditLog(req, {
      category: "auction",
      action: "auction.undo",
      summary: "Undo attempted — nothing to undo",
      outcome: "partial",
      reason: reasonResult.reason,
      tournamentId: tid,
    });
  }

  afterPlayerDataChanged(tid, req.log);
  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST set LED display overlay mode (off | team | player | top5)
router.post("/tournaments/:tournamentId/auction/display-overlay", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const body = z.object({ mode: z.enum(["off", "team", "player", "top5", "banner"]) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await getOrCreateSession(tid);
  const overlay = body.data.mode === "off" ? null : body.data.mode;
  await db
    .update(auctionSessionsTable)
    .set({
      displayOverlay: overlay,
      teamPurseViewActive: overlay !== null,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// POST set Player View filter (status/category/team) shown on LED display
router.post("/tournaments/:tournamentId/auction/display-player-filter", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
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
  await db
    .update(auctionSessionsTable)
    .set({ displayPlayerFilter: JSON.stringify(filter) })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// POST fortune wheel sync (active, items, winner)
// When spinning=true the server picks a random winner from the current pool —
// the operator cannot choose or influence which item wins.
router.post("/tournaments/:tournamentId/auction/fortune-wheel", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const body = z.object({
    active: z.boolean().optional(),
    spinning: z.boolean().optional(),
    items: z.array(z.object({ label: z.string(), color: z.string() })).optional(),
    // winner field is intentionally ignored when spinning=true (server picks)
    winner: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const session = await getOrCreateSession(tid);
  const patch: Record<string, unknown> = {};
  if (body.data.active !== undefined) patch.fortuneWheelActive = body.data.active;
  if (body.data.spinning !== undefined) patch.wheelSpinning = body.data.spinning;
  // Re-broadcasting clears a stale in-progress spin unless this request starts one.
  if (body.data.active === true && body.data.spinning !== true) {
    patch.wheelSpinning = false;
  }
  if (body.data.items !== undefined) patch.wheelItemsJson = JSON.stringify(body.data.items);
  if ("winner" in body.data && body.data.spinning !== true) patch.wheelWinner = body.data.winner ?? null;
  // Server-side random draw: when spinning starts, pick a winner from the pool
  if (body.data.spinning === true) {
    // Use items from request if provided, otherwise fall back to session
    const poolJson = body.data.items !== undefined
      ? JSON.stringify(body.data.items)
      : (session.wheelItemsJson ?? "[]");
    let pool: { label: string; color: string }[] = [];
    try { pool = JSON.parse(poolJson); } catch { pool = []; }
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      patch.wheelWinner = pool[idx].label;
    } else {
      patch.wheelWinner = null;
    }
  }
  if (body.data.active === false) {
    patch.wheelSpinning = false;
    patch.wheelWinner = null;
    clearWheelSpinStop(tid);
  }
  if (body.data.spinning === false) clearWheelSpinStop(tid);
  if (Object.keys(patch).length > 0) {
    await db
      .update(auctionSessionsTable)
      .set(patch)
      .where(eq(auctionSessionsTable.tournamentId, tid));
  }
  if (body.data.spinning === true) scheduleWheelSpinStop(tid);
  invalidateStateCache(tid);
  const state = await getCachedOrBuildState(tid);
  await emitAuctionStateEvent(tid, state, []);
  // Operator HTTP response may include the picked winner while spin is in progress.
  if (body.data.spinning === true && patch.wheelWinner) {
    res.json({ ...state, wheelWinner: patch.wheelWinner as string });
    return;
  }
  res.json(state);
});

// POST set active category filter
router.post("/tournaments/:tournamentId/auction/category-filter", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const body = z.object({
    categoryIds: z.array(z.number().int()).nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await getOrCreateSession(tid);
  const ids = body.data.categoryIds;
  const activeCategoryIds = ids && ids.length > 0 ? JSON.stringify(ids) : null;
  await db
    .update(auctionSessionsTable)
    .set({ activeCategoryIds, randomDrawQueue: null })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// POST stop timer — immediately ends the current bid window
// (re-enables conclude actions: SOLD / UNSOLD / DEFER / NEXT PLAYER)
router.post("/tournaments/:tournamentId/auction/stop-timer", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const session = await getOrCreateSession(tid);
  await db
    .update(auctionSessionsTable)
    .set({ timerEndsAt: null, timerType: null, pausedTimeRemaining: null })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  // Log timer stop event (fire-and-forget)
  logTimerEvent({
    tournamentId: tid,
    playerId: session.currentPlayerId,
    action: "stop",
    timerType: session.timerType,
    timerSeconds: 0,
    triggeredBy: "operator",
  });

  res.json(await broadcastState(tid));
});

// POST start timer
router.post("/tournaments/:tournamentId/auction/start-timer", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const body = z.object({ seconds: z.number().int().min(5).max(300) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  const timerType = resolveTimerPhase(session);
  const endsAt = new Date(Date.now() + body.data.seconds * 1000).toISOString();
  await db
    .update(auctionSessionsTable)
    .set({ timerEndsAt: endsAt, timerType })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  // Log timer start/extend event (fire-and-forget)
  const action = session.timerEndsAt ? "extend" : "start";
  logTimerEvent({
    tournamentId: tid,
    playerId: session.currentPlayerId,
    action,
    timerType,
    timerSeconds: body.data.seconds,
    triggeredBy: "operator",
  });

  res.json(await broadcastState(tid));
});

// POST conclude auction — operator explicitly ends the auction
router.post("/tournaments/:tournamentId/auction/conclude", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const body = z.object({ force: z.boolean().optional().default(false) }).safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const session = await getOrCreateSession(tid);
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

  await db.transaction(async (tx) => {
    await tx
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        timerType: null,
        deferredPlayerIds: null,
        randomDrawQueue: null,
        reAuctionStrategyJson: null,
        displayCountdown: null,
        lastAction:
          unsoldCount > 0
            ? `Auction concluded by operator — ${unsoldCount} unsold player${unsoldCount !== 1 ? "s" : ""} remain`
            : "Auction concluded by operator",
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await tx.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
  });

  auditLog(req, {
    category: "auction",
    action: "auction.concluded",
    summary: "Auction concluded by operator",
    tournamentId: tid,
    resource: { type: "auction_session", id: tid },
    metadata: { soldPlayersCount: soldCount, unsoldPlayersCount: unsoldCount, forced: body.data.force },
  });

  syncAllAuctionPlayersAsync(tid);

  res.json(await broadcastState(tid, ["players"]));
});

// POST break-timer (start, extend, or cancel a break countdown on the LED display)
router.post("/tournaments/:tournamentId/auction/break-timer", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
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
  // Auto-pause live bidding when a break starts so all displays can show the countdown
  if (body.data.action === "start" && session.status === "active") {
    let pausedTimeRemaining: number | null = null;
    if (session.timerEndsAt) {
      const remaining = Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000);
      pausedTimeRemaining = remaining > 0 ? remaining : null;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(auctionSessionsTable)
        .set({
          status: "paused",
          lastAction: "Auction paused for break",
          timerEndsAt: null,
          pausedTimeRemaining,
        })
        .where(eq(auctionSessionsTable.tournamentId, tid));
      await tx.update(tournamentsTable).set({ status: "paused" }).where(eq(tournamentsTable.id, tid));
    });
    auditLog(req, {
      category: "auction",
      action: "auction.paused",
      summary: "Auction auto-paused to start break timer",
      tournamentId: tid,
      resource: { type: "auction_session", id: tid },
      metadata: { pausedTimeRemaining, reason: "break_timer" },
    });
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
    // extend is only valid for an active break countdown.
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
  // cancel: clear countdown and auto-resume if the break timer had paused the auction
  if (body.data.action === "cancel") {
    if (session.status === "paused" && session.lastAction === "Auction paused for break") {
      sessionPatch.status = "active";
      sessionPatch.lastAction = "Break cancelled — auction resumed";
      if (session.pausedTimeRemaining && session.pausedTimeRemaining > 0 && session.currentPlayerId) {
        sessionPatch.timerEndsAt = new Date(Date.now() + session.pausedTimeRemaining * 1000).toISOString();
        sessionPatch.pausedTimeRemaining = null;
      }
      await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));
      auditLog(req, {
        category: "auction",
        action: "auction.resumed",
        summary: "Auction resumed after break timer cancelled",
        tournamentId: tid,
        resource: { type: "auction_session", id: tid },
        metadata: { reason: "break_timer_cancelled" },
      });
    }
  }

  await db
    .update(auctionSessionsTable)
    .set(sessionPatch)
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// GET bid history — live bids from auction_bid_events (not sold-only bids table)
router.get("/tournaments/:tournamentId/auction/bids", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const bids = await db
    .select()
    .from(auctionBidEventsTable)
    .where(eq(auctionBidEventsTable.tournamentId, tid))
    .orderBy(desc(auctionBidEventsTable.timestamp));

  const result = await Promise.all(
    bids.map(async (bid) => {
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
      return {
        id: bid.id,
        tournamentId: bid.tournamentId,
        playerId: bid.playerId,
        teamId: bid.teamId,
        amount: bid.bidAmount,
        timestamp: bid.timestamp.toISOString(),
        playerName: player?.name ?? null,
        teamName: team?.name ?? null,
        teamColor: team?.color ?? null,
      };
    })
  );

  res.json(result);
});

// ── Cheer messages ────────────────────────────────────────────────────────────

// Per-IP cooldown tracker (cleaned up every minute)
const cheerRateLimiter = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [ip, ts] of cheerRateLimiter) {
    if (ts < cutoff) cheerRateLimiter.delete(ip);
  }
}, 60_000);

// Fan battle: per-tournament, per-team cheer counts (in-memory, resets on server restart)
const fanBattleCounters = new Map<number, Map<number, number>>();

// Heat tracker: per-tournament sliding window of recent cheer timestamps
const recentCheerTimestamps = new Map<number, number[]>();

function getHeatLevel(tournamentId: number): string {
  const timestamps = recentCheerTimestamps.get(tournamentId) ?? [];
  const cutoff = Date.now() - 30_000;
  const recent = timestamps.filter((t) => t > cutoff).length;
  if (recent >= 13) return "WAR MODE";
  if (recent >= 7) return "HEATED";
  if (recent >= 3) return "ACTIVE";
  return "CALM";
}

// Cheer is the only auction-adjacent route with a rate limit — 30/min is
// generous for audience interaction but prevents simple spam loops.
router.post("/tournaments/:tournamentId/cheer", cheerLimiter, async (req, res) => {
  const tid = parseInt(String(req.params.tournamentId));
  if (isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const bodySchema = z.object({
    teamId: z.number().int().positive(),
    reactionId: z.number().int().min(0).max(9),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { teamId, reactionId } = parsed.data;

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid));
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  if (!tournament.cheerMessagesEnabled) {
    res.status(403).json({ error: "Cheer messages are disabled for this tournament" });
    return;
  }

  // Per-IP cooldown — uses tournament's configured value (default 2s)
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

  // Validate team belongs to this tournament
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) {
    res.status(400).json({ error: "Team not found in this tournament" });
    return;
  }

  // Resolve preset message
  let presets: string[] = CHEER_DEFAULT_PRESETS;
  if (tournament.cheerMessagePresets) {
    try {
      const p = JSON.parse(tournament.cheerMessagePresets) as unknown;
      if (Array.isArray(p) && p.length > 0) presets = p as string[];
    } catch {
      // use defaults
    }
  }
  const message = presets[reactionId];
  if (!message) {
    res.status(400).json({ error: "Invalid reaction ID" });
    return;
  }

  // Build supporter label: shortCode + " FANS"
  const supporterLabel = `${(team.shortCode ?? team.name.slice(0, 4)).toUpperCase()} FANS`;

  // Update fan battle counter
  if (!fanBattleCounters.has(tid)) fanBattleCounters.set(tid, new Map());
  const tmap = fanBattleCounters.get(tid)!;
  tmap.set(teamId, (tmap.get(teamId) ?? 0) + 1);
  const fanBattle: Record<string, number> = {};
  for (const [k, v] of tmap) fanBattle[String(k)] = v;

  // Update heat timestamps
  if (!recentCheerTimestamps.has(tid)) recentCheerTimestamps.set(tid, []);
  const tsArr = recentCheerTimestamps.get(tid)!;
  tsArr.push(now);
  // Keep only the last 5 minutes
  recentCheerTimestamps.set(tid, tsArr.filter((t) => t > now - 300_000));
  const heatLevel = getHeatLevel(tid);

  await publishAuctionEvent(tid, {
    type: "cheer_message",
    supporterLabel,
    message,
    teamColor: team.color ?? null,
    teamId,
    timestamp: now,
    heatLevel,
    fanBattle,
  });
  res.json({ ok: true });
});

// POST /tournaments/:id/auction/mirror — receive live auction state from a BidWar Local instance
router.post("/tournaments/:id/auction/mirror", async (req, res) => {
  const tid = parseInt(req.params.id);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  // Timing-safe token validation with clock-drift tolerance (shared helper)
  const tokenCheck = validateExportToken(
    req.headers["x-export-token"],
    tournament.exportToken,
    tournament.exportTokenExpiresAt,
  );
  if (!tokenCheck.valid) {
    req.log.warn({ tournamentId: tid, reason: tokenCheck.reason, ip: req.ip }, "Mirror: export token validation rejected");
    res.status(tokenCheck.status).json({ error: tokenCheck.error }); return;
  }

  const bodySchema = z.object({
    status: z.string(),
    currentPlayerCloudId: z.number().int().nullable().optional(),
    currentBidTeamCloudId: z.number().int().nullable().optional(),
    currentBid: z.number().int().nullable().optional(),
    timerEndsAt: z.string().nullable().optional(),
    lastAction: z.string().nullable().optional(),
    fortuneWheelActive: z.boolean().optional().default(false),
    wheelSpinning: z.boolean().optional().default(false),
    teamPurseViewActive: z.boolean().optional().default(false),
    isBreak: z.boolean().optional().default(false),
    breakEndsAt: z.string().nullable().optional(),
    displayCountdown: z.string().nullable().optional(),
    wheelItemsJson: z.string().nullable().optional(),
    wheelWinner: z.string().nullable().optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid mirror payload" }); return; }
  const d = parsed.data;

  const session = await getOrCreateSession(tid);
  await db.update(auctionSessionsTable).set({
    status: d.status,
    currentPlayerId: d.currentPlayerCloudId ?? null,
    currentBidTeamId: d.currentBidTeamCloudId ?? null,
    currentBid: d.currentBid ?? null,
    timerEndsAt: d.timerEndsAt ?? null,
    lastAction: d.lastAction ?? null,
    fortuneWheelActive: d.fortuneWheelActive ?? false,
    wheelSpinning: d.wheelSpinning ?? false,
    teamPurseViewActive: d.teamPurseViewActive ?? false,
    isBreak: d.isBreak ?? false,
    breakEndsAt: d.breakEndsAt ?? null,
    displayCountdown: d.displayCountdown ?? null,
    wheelItemsJson: d.wheelItemsJson ?? null,
    wheelWinner: d.wheelWinner ?? null,
  }).where(eq(auctionSessionsTable.id, session.id));

  // Track last successful mirror for operational visibility (non-blocking)
  void db.update(tournamentsTable)
    .set({ exportTokenLastMirrorAt: new Date() })
    .where(eq(tournamentsTable.id, tid));

  // Broadcast to cloud display and Broadcast Overlay screens so they update live
  invalidateStateCache(tid);
  const fullState = await getCachedOrBuildState(tid);
  await emitAuctionStateEvent(tid, fullState, []);

  res.json({ ok: true });
});

export default router;
export { broadcastState, getOrCreateSession, invalidateStateCache };
