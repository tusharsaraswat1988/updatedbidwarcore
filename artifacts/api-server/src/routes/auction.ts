import { Router } from "express";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
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
  tournamentsTable,
  categoriesTable,
  organizersTable,
} from "@workspace/db";
import { eq, and, asc, desc, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { addSseClient, removeSseClient, broadcastToTournament, getSseClientCount } from "../lib/broadcast";
import { logger } from "../lib/logger";
import { computeTeamPurseProtection } from "../lib/purse-protection";
import { notifyPlayerSold, notifyPlayerUnsold, notifyPlayerReAuction } from "../lib/whatsapp";
import { isNameClean } from "../lib/name-filter";
import { CHEER_DEFAULT_PRESETS } from "../lib/cheer-constants";
import { getPublicOrigin, getRuntimeConfig } from "../lib/runtime-env";
import {
  logBidEvent,
  logPlayerAuctionStart,
  logPlayerAuctionEnd,
  logTimerEvent,
} from "../lib/auction-logger";
import { validateBidAmount } from "@workspace/api-base/auction-bid";
import {
  tournamentToReadinessInput,
  validateAuctionReadiness,
  type AuctionReadinessMode,
} from "@workspace/api-base/auction-readiness";
import { auditLog } from "../lib/audit-service";
import { parseAuditReason } from "../lib/audit-reason";
import { snapshotPlayer, snapshotTeam } from "../lib/audit-snapshots";

const router = Router();

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

const playerToJson = (p: typeof playersTable.$inferSelect) => ({
  id: p.id,
  tournamentId: p.tournamentId,
  categoryId: p.categoryId,
  teamId: p.teamId,
  name: p.name,
  city: p.city,
  role: p.role,
  battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle,
  specialization: p.specialization,
  age: p.age,
  photoUrl: p.photoUrl,
  basePrice: p.basePrice,
  soldPrice: p.soldPrice,
  retainedPrice: p.retainedPrice,
  status: p.status,
  jerseyNumber: p.jerseyNumber,
  achievements: p.achievements,
  mobileNumber: p.mobileNumber,
  cricheroUrl: p.cricheroUrl,
  availabilityDates: p.availabilityDates,
  playerTag: p.playerTag ?? null,
  playerTagTeamId: p.playerTagTeamId ?? null,
  isNonPlayingMember: p.isNonPlayingMember ?? false,
  createdAt: p.createdAt.toISOString(),
});

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

async function buildAuctionState(tournamentId: number) {
  const session = await getOrCreateSession(tournamentId);

  // Always fetch fresh tournament data (timer, tiers) — never rely on stale session values
  const [tournamentRow] = await db
    .select({
      playerSelectionMode: tournamentsTable.playerSelectionMode,
      timerSeconds: tournamentsTable.timerSeconds,
      bidTimerSeconds: tournamentsTable.bidTimerSeconds,
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
      currentPlayer = playerToJson(p);
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

  const allPlayers = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  const soldCount = allPlayers.filter((p) => p.status === "sold").length;
  const unsoldCount = allPlayers.filter((p) => p.status === "unsold").length;
  const availableCount = allPlayers.filter((p) => p.status === "available").length;

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

  let displayCountdown: { type: string; endsAt: string; message: string | null } | null = null;
  try {
    if (session.displayCountdown) {
      const parsed = JSON.parse(session.displayCountdown) as { type: string; endsAt: string; message: string | null };
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

  // Last sold player — shown on owner panels when no player is currently up
  let lastSoldPlayer: {
    id: number; name: string; role: string | null; photoUrl: string | null;
    soldToTeamId: number; soldToTeamName: string | null; soldToTeamColor: string | null;
    soldAmount: number;
  } | null = null;
  if (!session.currentPlayerId) {
    const [lastBid] = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.tournamentId, tournamentId))
      .orderBy(desc(bidsTable.timestamp))
      .limit(1);
    if (lastBid) {
      const [lp] = await db.select().from(playersTable).where(eq(playersTable.id, lastBid.playerId));
      const [lt] = await db.select().from(teamsTable).where(eq(teamsTable.id, lastBid.teamId));
      if (lp) {
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
    // Authoritative timer mode — stored directly in the session by the route that
    // last set timerEndsAt (start-timer → 'start', bid → 'bid').
    timerType: session.timerEndsAt ? (session.timerType ?? null) : null,
    lastAction: session.lastAction,
    outcome,
    soldPlayersCount: soldCount,
    unsoldPlayersCount: unsoldCount,
    remainingPlayersCount: availableCount,
    fortuneWheelActive: session.fortuneWheelActive,
    wheelSpinning: session.wheelSpinning,
    wheelItems,
    wheelWinner: session.wheelWinner,
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
  broadcastToTournament(tournamentId, { type: "auction_state", state, invalidate });
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
  const state = await getCachedOrBuildState(tid);
  res.write(`data: ${JSON.stringify({ type: "auction_state", state, invalidate: [] })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(client);
    logger.info({ tournamentId: tid, clientCount: getSseClientCount(tid) }, "SSE client disconnected");
  });
});

// GET auction state
router.get("/tournaments/:tournamentId/auction", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  res.json(await getCachedOrBuildState(tid));
});

// POST start / resume auction
router.post("/tournaments/:tournamentId/auction/start", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
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

  await db.update(auctionSessionsTable).set(patch).where(eq(auctionSessionsTable.tournamentId, tid));
  await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));

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
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const session = await getOrCreateSession(tid);

  // Capture remaining timer so it can be restored on resume
  let pausedTimeRemaining: number | null = null;
  if (session.timerEndsAt) {
    const remaining = Math.ceil((new Date(session.timerEndsAt).getTime() - Date.now()) / 1000);
    pausedTimeRemaining = remaining > 0 ? remaining : null;
  }

  await db
    .update(auctionSessionsTable)
    .set({ status: "paused", lastAction: "Auction paused", timerEndsAt: null, pausedTimeRemaining })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  await db.update(tournamentsTable).set({ status: "paused" }).where(eq(tournamentsTable.id, tid));
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
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

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

  if (playerId) {
    // Manual selection — operator picked a specific player
    selectedPlayerId = playerId;
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

    if (pool.length > 0) {
      if (mode === "random") {
        selectedPlayerId = pool[Math.floor(Math.random() * pool.length)].id;
      } else {
        // Sequential: lowest ID first
        selectedPlayerId = pool.reduce((a, b) => a.id < b.id ? a : b).id;
      }
      // If selected player came from the deferred list, remove them from it
      if (selectedPlayerId !== null && deferredIds.includes(selectedPlayerId)) {
        newDeferredIds = deferredIds.filter(id => id !== selectedPlayerId);
      }
    }
  }

  if (!selectedPlayerId) {
    await db
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        deferredPlayerIds: null,
        displayCountdown: null,
        lastAction: "Auction completed — all players processed",
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
    res.json(await broadcastState(tid, ["players"]));
    return;
  }

  const [selectedPlayer] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, selectedPlayerId));

  // Use category's minBid as the starting bid if set, otherwise fall back to player's basePrice
  let categoryStartBid = selectedPlayer.basePrice;
  if (selectedPlayer.categoryId) {
    const [catForStart] = await db
      .select({ minBid: categoriesTable.minBid })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, selectedPlayer.categoryId));
    if (catForStart?.minBid != null && catForStart.minBid > 0) {
      categoryStartBid = catForStart.minBid;
    }
  }

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: selectedPlayerId,
      currentBid: categoryStartBid,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
      displayCountdown: null,
      lastAction: `Now bidding: ${selectedPlayer.name}`,
      lastOutcome: null,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  // Log player auction start event (fire-and-forget)
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

// POST place bid
router.post("/tournaments/:tournamentId/auction/bid", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({ teamId: z.number().int(), amount: z.number().int(), accessCode: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { teamId, amount, accessCode } = parsed.data;
  const session = await getOrCreateSession(tid);
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

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  if (!team.isBiddingEnabled) { res.status(400).json({ error: "Bidding disabled for this team" }); return; }

  // Access-code gate: if the team has a code set the caller must supply it correctly.
  // This binds each bid to the verified owner, preventing anonymous team impersonation.
  // Organizers and admins are exempt — they are already authenticated server-side and
  // use the operator panel quick-bid buttons without an owner access code.
  if (team.accessCode && !isOrganizerOrAdmin(req, tid)) {
    if (!accessCode || team.accessCode.toUpperCase() !== accessCode.toUpperCase()) {
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

  const bidTimerSecs = tournament?.bidTimerSeconds ?? 15;
  const newTimerEndsAt = new Date(Date.now() + bidTimerSecs * 1000).toISOString();

  await db
    .update(auctionSessionsTable)
    .set({
      currentBid: amount,
      currentBidTeamId: teamId,
      timerEndsAt: newTimerEndsAt,
      timerType: "bid",
      pausedTimeRemaining: null,
      lastAction: `${team.name} bid ₹${amount.toLocaleString("en-IN")}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  res.json(await broadcastState(tid));
});

// POST sell player (to highest bidder)
router.post("/tournaments/:tournamentId/auction/sell", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  if (!session.currentPlayerId || !session.currentBidTeamId) {
    res.status(400).json({ error: "No current player or bidder" });
    return;
  }

  const playerId = session.currentPlayerId;
  const teamId = session.currentBidTeamId;
  const soldAmount = session.currentBid ?? 0;

  await db
    .update(playersTable)
    .set({ status: "sold", teamId, soldPrice: soldAmount })
    .where(eq(playersTable.id, playerId));

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  await db
    .update(teamsTable)
    .set({ purseUsed: (team?.purseUsed ?? 0) + soldAmount })
    .where(eq(teamsTable.id, teamId));

  await db.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount: soldAmount });

  const [soldPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  await db
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      lastAction: `SOLD: ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${soldAmount.toLocaleString("en-IN")}`,
      lastOutcome: JSON.stringify({
        type: "sold",
        playerId,
        playerName: soldPlayer?.name ?? "Player",
        photoUrl: soldPlayer?.photoUrl ?? null,
        teamId,
        teamName: team?.name ?? null,
        teamColor: team?.color ?? null,
        teamLogoUrl: team?.logoUrl ?? null,
        amount: soldAmount,
        isManual: false,
      }),
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST manual sell (organiser sets team + amount)
router.post("/tournaments/:tournamentId/auction/manual-sell", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const schema = z.object({
    teamId: z.number().int(),
    amount: z.number().int().min(0),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

  const { teamId, amount } = parsed.data;
  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;

  if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }

  const playerId = session.currentPlayerId;
  const [playerBefore] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  const [teamBefore] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));

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

  await db
    .update(playersTable)
    .set({ status: "sold", teamId, soldPrice: amount })
    .where(eq(playersTable.id, playerId));

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (team && amount > 0) {
    await db
      .update(teamsTable)
      .set({ purseUsed: (team.purseUsed ?? 0) + amount })
      .where(eq(teamsTable.id, teamId));
  }

  if (amount > 0) {
    await db.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount });
  }

  const [soldPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  const [teamAfter] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  const [manualTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  await db
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      lastAction: `SOLD: ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${amount.toLocaleString("en-IN")} (manual)`,
      lastOutcome: JSON.stringify({
        type: "sold",
        playerId,
        playerName: soldPlayer?.name ?? "Player",
        photoUrl: soldPlayer?.photoUrl ?? null,
        teamId,
        teamName: team?.name ?? null,
        teamColor: team?.color ?? null,
        teamLogoUrl: team?.logoUrl ?? null,
        amount,
        isManual: true,
      }),
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST mark unsold
router.post("/tournaments/:tournamentId/auction/unsold", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, session.currentPlayerId));

  await db
    .update(playersTable)
    .set({ status: "unsold" })
    .where(eq(playersTable.id, session.currentPlayerId));

  const [unsoldTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  await db
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

  res.json(await broadcastState(tid, ["players"]));
});

// POST re-auction a previously sold/unsold player
router.post("/tournaments/:tournamentId/auction/re-auction", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const schema = z.object({
    playerId: z.number().int(),
    startFromBase: z.boolean().optional().default(true),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;

  const { playerId, startFromBase } = parsed.data;
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));

  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // If player was sold, reverse purse usage
  if (player.status === "sold" && player.teamId && player.soldPrice) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
    if (team) {
      await db
        .update(teamsTable)
        .set({ purseUsed: Math.max(0, team.purseUsed - player.soldPrice) })
        .where(eq(teamsTable.id, player.teamId));
    }
    await db
      .delete(bidsTable)
      .where(and(eq(bidsTable.playerId, playerId), eq(bidsTable.tournamentId, tid)));
  }

  const startingBid = startFromBase ? player.basePrice : (player.soldPrice ?? player.basePrice);
  await db
    .update(playersTable)
    .set({ status: "available", teamId: null, soldPrice: null })
    .where(eq(playersTable.id, playerId));

  const [reTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const timerSecs = reTournament?.timerSeconds ?? 30;

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: playerId,
      currentBid: startingBid,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      lastAction: `RE-AUCTION: ${player.name}`,
      lastOutcome: null,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST re-auction all unsold — reset all unsold players back to available for another round
router.post("/tournaments/:tournamentId/auction/re-auction-unsold", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }

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

  for (const p of unsoldPlayers) {
    await db
      .update(playersTable)
      .set({ status: "available" })
      .where(eq(playersTable.id, p.id));
  }

  await db
    .update(auctionSessionsTable)
    .set({ lastAction: `RE-AUCTION ROUND: ${unsoldPlayers.length} unsold players returned to queue` })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  auditLog(req, {
    category: "auction",
    action: "auction.reauction_all_unsold",
    summary: `Re-auction round: ${unsoldPlayers.length} unsold players returned to queue`,
    severity: "critical",
    reason: reasonResult.reason,
    tournamentId: tid,
    resource: { type: "auction_session", id: tid },
    metadata: { playerCount: unsoldPlayers.length, playerIds: unsoldPlayers.map((p) => p.id) },
    alertKey: "auction_reauction_bulk",
  });

  res.json(await broadcastState(tid, ["players"]));
});

// POST reset trial auction — reset all non-retained players to available, clear bids
// First reset (resetCount === 0) requires the tournament's organizer/operator password.
// Any subsequent reset requires the master super admin password (ADMIN_PASSWORD).
router.post("/tournaments/:tournamentId/auction/reset-trial", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const body = z.object({ password: z.string().min(1), reason: z.string().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Password is required" }); return; }
  const reasonResult = parseAuditReason(req.body, true);
  if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  const submittedPw = body.data.password;

  const safeCompare = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  };

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const masterPw = getRuntimeConfig().adminPassword;
  const isMasterMatch = !!masterPw && safeCompare(submittedPw, masterPw);
  const isOperatorMatch = !!tournament.organizerPassword && safeCompare(submittedPw, tournament.organizerPassword);
  const previousResetCount = tournament.resetCount ?? 0;

  let resetActor: "operator" | "super_admin";
  if (previousResetCount === 0) {
    // First reset — operator OR super admin both allowed
    if (isOperatorMatch) {
      resetActor = "operator";
    } else if (isMasterMatch) {
      resetActor = "super_admin";
    } else {
      res.status(401).json({ error: "Incorrect operator password" });
      return;
    }
  } else {
    // Already reset before — only super admin can do it again
    if (isMasterMatch) {
      resetActor = "super_admin";
    } else if (isOperatorMatch) {
      res.status(403).json({ error: "This tournament has already been reset once. Only the super admin can reset it again." });
      return;
    } else {
      res.status(401).json({ error: "Incorrect super admin password" });
      return;
    }
  }

  const allPlayers = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));

  for (const p of allPlayers) {
    if (p.status !== "retained") {
      await db
        .update(playersTable)
        .set({ status: "available", teamId: null, soldPrice: null })
        .where(eq(playersTable.id, p.id));
    }
  }

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid));

  for (const team of teams) {
    const retainedPlayers = allPlayers.filter(
      (p) => p.status === "retained" && p.teamId === team.id
    );
    const retainedCost = retainedPlayers.reduce((sum, p) => sum + (p.retainedPrice ?? 0), 0);
    await db
      .update(teamsTable)
      .set({ purseUsed: retainedCost })
      .where(eq(teamsTable.id, team.id));
  }

  await db.delete(bidsTable).where(eq(bidsTable.tournamentId, tid));

  await db
    .update(auctionSessionsTable)
    .set({
      status: "idle",
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerEndsAt: null,
      deferredPlayerIds: null,
      soldPlayersCount: 0,
      unsoldPlayersCount: 0,
      lastAction: "Reset complete — ready for live auction",
      lastOutcome: null,
      fortuneWheelActive: false,
      wheelSpinning: false,
      wheelWinner: null,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  await db
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

  auditLog(req, {
    category: "auction",
    action: "auction.reset_trial",
    summary: `Trial auction reset by ${resetActor}`,
    severity: "critical",
    reason: reasonResult.reason,
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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST defer current player — send to back of queue, auto-advance to next
router.post("/tournaments/:tournamentId/auction/defer-player", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

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
  const selMode = tournament?.playerSelectionMode ?? "sequential";
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
  const nonDeferred = allAvailable.filter(p => !deferredIds.includes(p.id));
  const pool = nonDeferred.length > 0 ? nonDeferred : allAvailable.filter(p => deferredIds.includes(p.id));

  let selectedPlayerId: number | null = null;
  let newDeferredIds = deferredIds;

  if (pool.length > 0) {
    const effectiveMode = selMode === "manual" ? "sequential" : selMode;
    if (effectiveMode === "random") {
      selectedPlayerId = pool[Math.floor(Math.random() * pool.length)].id;
    } else {
      selectedPlayerId = pool.reduce((a, b) => a.id < b.id ? a : b).id;
    }
    // If next player was from the deferred list, remove them
    if (selectedPlayerId !== null && deferredIds.includes(selectedPlayerId)) {
      newDeferredIds = deferredIds.filter(id => id !== selectedPlayerId);
    }
  }

  if (!selectedPlayerId) {
    // No more players available — auction complete
    await db
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
        timerEndsAt: null,
        deferredPlayerIds: null,
        lastAction: "Auction completed — all players processed",
        lastOutcome: null,
      })
      .where(eq(auctionSessionsTable.tournamentId, tid));
    await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
    res.json(await broadcastState(tid, ["players"]));
    return;
  }

  const [selectedPlayer] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, selectedPlayerId));

  // Use category's minBid as the starting bid if set, otherwise fall back to player's basePrice
  let categoryStartBidDefer = selectedPlayer.basePrice;
  if (selectedPlayer.categoryId) {
    const [catForStartDefer] = await db
      .select({ minBid: categoriesTable.minBid })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, selectedPlayer.categoryId));
    if (catForStartDefer?.minBid != null && catForStartDefer.minBid > 0) {
      categoryStartBidDefer = catForStartDefer.minBid;
    }
  }

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: selectedPlayerId,
      currentBid: categoryStartBidDefer,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
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
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }

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
    const purseUsedAfter = Math.max(0, purseUsedBefore - bid.amount);

    await db
      .update(playersTable)
      .set({ status: "available", teamId: null, soldPrice: null })
      .where(eq(playersTable.id, bid.playerId));

    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
    if (team) {
      await db
        .update(teamsTable)
        .set({ purseUsed: purseUsedAfter })
        .where(eq(teamsTable.id, bid.teamId));
    }

    await db.delete(bidsTable).where(eq(bidsTable.id, bid.id));

    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
    const [teamAfter] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
    await db
      .update(auctionSessionsTable)
      .set({ lastAction: `Undone: ${player?.name ?? "Player"} returned to pool` })
      .where(eq(auctionSessionsTable.tournamentId, tid));

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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST set LED display overlay mode (off | team | player | top5)
router.post("/tournaments/:tournamentId/auction/display-overlay", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
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
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
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
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
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
  if (body.data.active === false) { patch.wheelSpinning = false; patch.wheelWinner = null; }
  if (Object.keys(patch).length > 0) {
    await db
      .update(auctionSessionsTable)
      .set(patch)
      .where(eq(auctionSessionsTable.tournamentId, tid));
  }
  res.json(await broadcastState(tid));
});

// POST set active category filter
router.post("/tournaments/:tournamentId/auction/category-filter", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const body = z.object({
    categoryIds: z.array(z.number().int()).nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await getOrCreateSession(tid);
  const ids = body.data.categoryIds;
  const activeCategoryIds = ids && ids.length > 0 ? JSON.stringify(ids) : null;
  await db
    .update(auctionSessionsTable)
    .set({ activeCategoryIds })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// POST stop timer — immediately ends the current bid window
// (re-enables conclude actions: SOLD / UNSOLD / DEFER / NEXT PLAYER)
router.post("/tournaments/:tournamentId/auction/stop-timer", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
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
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const body = z.object({ seconds: z.number().int().min(5).max(300) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const session = await getOrCreateSession(tid);
  if (rejectIfAuctionPaused(session, res)) return;
  const endsAt = new Date(Date.now() + body.data.seconds * 1000).toISOString();
  await db
    .update(auctionSessionsTable)
    .set({ timerEndsAt: endsAt, timerType: "start" })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  // Log timer start/extend event (fire-and-forget)
  const action = session.timerEndsAt ? "extend" : "start";
  logTimerEvent({
    tournamentId: tid,
    playerId: session.currentPlayerId,
    action,
    timerType: "start",
    timerSeconds: body.data.seconds,
    triggeredBy: "operator",
  });

  res.json(await broadcastState(tid));
});

// POST break-timer (start, extend, or cancel a break countdown on the LED display)
router.post("/tournaments/:tournamentId/auction/break-timer", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const body = z.object({
    action: z.enum(["start", "cancel", "extend"]),
    durationSeconds: z.number().int().min(10).max(3600).optional(),
    message: z.string().max(60).optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const session = await getOrCreateSession(tid);
  // Prevent starting a break while bidding is live — operator must pause first
  if (body.data.action === "start" && session.status === "active") {
    res.status(409).json({ error: "Cannot start a break during live bidding. Pause the auction first." });
    return;
  }
  if (body.data.action === "start" && !body.data.durationSeconds) {
    res.status(400).json({ error: "durationSeconds is required when action is start" });
    return;
  }
  let countdown: string | null = null;
  if (body.data.action === "start" && body.data.durationSeconds) {
    const endsAt = new Date(Date.now() + body.data.durationSeconds * 1000).toISOString();
    countdown = JSON.stringify({ type: "break", endsAt, message: body.data.message ?? null });
  } else if (body.data.action === "extend") {
    // extend is only valid for an active break countdown — pre-auction
    // countdowns are fixed at 10 s and cannot be extended.
    let existingCountdown: { type: string; endsAt: string; message: string | null } | null = null;
    if (session.displayCountdown) {
      try {
        existingCountdown = JSON.parse(session.displayCountdown) as { type: string; endsAt: string; message: string | null };
      } catch { /* ignore */ }
    }
    if (!existingCountdown || existingCountdown.type !== "break") {
      res.status(400).json({ error: "extend is only valid for an active break countdown" });
      return;
    }
    const extendSecs = body.data.durationSeconds ?? 300;
    const baseTime = new Date(existingCountdown.endsAt).getTime() > Date.now()
      ? new Date(existingCountdown.endsAt).getTime()
      : Date.now();
    const endsAt = new Date(baseTime + extendSecs * 1000).toISOString();
    countdown = JSON.stringify({ type: "break", endsAt, message: existingCountdown.message });
  }
  // cancel: countdown stays null
  await db
    .update(auctionSessionsTable)
    .set({ displayCountdown: countdown })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// POST pre-auction-countdown (trigger a fixed 10s pre-auction countdown on the LED display)
// Body is optional — a bare POST with no body is treated as action="start".
router.post("/tournaments/:tournamentId/auction/pre-auction-countdown", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const body = z.object({
    action: z.enum(["start", "cancel"]).optional().default("start"),
    message: z.string().max(60).optional(),
  }).safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await getOrCreateSession(tid);
  let countdown: string | null = null;
  if (body.data.action === "start") {
    const endsAt = new Date(Date.now() + 10_000).toISOString();
    countdown = JSON.stringify({ type: "pre-auction", endsAt, message: body.data.message ?? null });
  }
  await db
    .update(auctionSessionsTable)
    .set({ displayCountdown: countdown })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  res.json(await broadcastState(tid));
});

// GET bid history
router.get("/tournaments/:tournamentId/auction/bids", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const bids = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid))
    .orderBy(desc(bidsTable.timestamp));

  const result = await Promise.all(
    bids.map(async (bid) => {
      const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
      const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
      return {
        id: bid.id,
        tournamentId: bid.tournamentId,
        playerId: bid.playerId,
        teamId: bid.teamId,
        amount: bid.amount,
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

  // Per-IP cooldown — uses tournament's configured value (default 8s)
  const cooldownMs = (tournament.cheerCooldownSeconds ?? 8) * 1000;
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").replace("::ffff:", "");
  const now = Date.now();
  const last = cheerRateLimiter.get(ip) ?? 0;
  if (now - last < cooldownMs) {
    res.status(429).json({
      error: "Too many requests",
      cooldownSeconds: tournament.cheerCooldownSeconds ?? 8,
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

  broadcastToTournament(tid, {
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

  // Broadcast to cloud display/OBS screens so they update live
  const fullState = await buildAuctionState(tid);
  broadcastToTournament(tid, { type: "auction_state", state: fullState });

  res.json({ ok: true });
});

export default router;
export { broadcastState, getOrCreateSession, invalidateStateCache };
