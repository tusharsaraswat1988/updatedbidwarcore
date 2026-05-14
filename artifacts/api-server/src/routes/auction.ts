import { Router } from "express";
import { db } from "@workspace/db";
import {
  auctionSessionsTable,
  playersTable,
  teamsTable,
  bidsTable,
  tournamentsTable,
} from "@workspace/db";
import { eq, and, asc, desc, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { addSseClient, removeSseClient, broadcastToTournament } from "../lib/broadcast";
import { computeTeamPurseProtection } from "../lib/purse-protection";
import { notifyPlayerSold, notifyPlayerUnsold, notifyPlayerReAuction } from "../lib/whatsapp";
import {
  logBidEvent,
  logPlayerAuctionStart,
  logPlayerAuctionEnd,
  logTimerEvent,
} from "../lib/auction-logger";

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

  const tiers = parseBidTiers(tournamentRow?.bidTiers, {
    bidTier1UpTo: tournamentRow?.bidTier1UpTo ?? 100000,
    bidTier1Increment: tournamentRow?.bidTier1Increment ?? 25000,
    bidTier2UpTo: tournamentRow?.bidTier2UpTo ?? 200000,
    bidTier2Increment: tournamentRow?.bidTier2Increment ?? 50000,
    bidTier3Increment: tournamentRow?.bidTier3Increment ?? 100000,
  });

  let currentPlayer = null;
  let bidIncrement = computeTieredIncrement(session.currentBid ?? 0, tiers);

  if (session.currentPlayerId) {
    const [p] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, session.currentPlayerId));
    if (p) {
      currentPlayer = playerToJson(p);
    }
  }

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
  const isTrialMode = licenseStatus !== "live";
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
  };
}

async function broadcastState(tournamentId: number, invalidate: string[] = []) {
  const state = await buildAuctionState(tournamentId);
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
  const state = await buildAuctionState(tid);
  res.write(`data: ${JSON.stringify({ type: "auction_state", state, invalidate: [] })}\n\n`);

  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(client);
  });
});

// GET auction state
router.get("/tournaments/:tournamentId/auction", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  res.json(await buildAuctionState(tid));
});

// POST start / resume auction
router.post("/tournaments/:tournamentId/auction/start", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
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

  const timerSecs = tournament?.timerSeconds ?? 30;

  // On resume: restore the remaining timer that was frozen on pause
  const patch: Record<string, unknown> = { status: "active", lastAction: "Auction resumed", timerSeconds: timerSecs };
  if (session.pausedTimeRemaining && session.pausedTimeRemaining > 0 && session.currentPlayerId) {
    patch.timerEndsAt = new Date(Date.now() + session.pausedTimeRemaining * 1000).toISOString();
    patch.pausedTimeRemaining = null;
  }

  await db.update(auctionSessionsTable).set(patch).where(eq(auctionSessionsTable.tournamentId, tid));
  await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));
  res.json(await broadcastState(tid));
});

// POST pause auction
router.post("/tournaments/:tournamentId/auction/pause", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
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

  // Parse active category filter
  let activeCatIds: number[] | null = null;
  try {
    if (session.activeCategoryIds) activeCatIds = JSON.parse(session.activeCategoryIds);
  } catch { /* ignore */ }

  // Parse deferred player IDs (bring-later queue)
  let deferredIds: number[] = [];
  try { if (session.deferredPlayerIds) deferredIds = JSON.parse(session.deferredPlayerIds); } catch { /* ignore */ }

  // Trial mode: restrict pool to first 10 players by ID
  const isTrialMode = tournament?.licenseStatus !== "live";
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
        lastAction: "Auction completed — all players processed",
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

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: selectedPlayerId,
      currentBid: selectedPlayer.basePrice,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
      lastAction: `Now bidding: ${selectedPlayer.name}`,
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

  const schema = z.object({ teamId: z.number().int(), amount: z.number().int() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { teamId, amount } = parsed.data;
  const session = await getOrCreateSession(tid);
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  if (!session.currentPlayerId) { res.status(400).json({ error: "No player currently up for bid" }); return; }
  if (session.status !== "active") { res.status(400).json({ error: "Auction is not active" }); return; }
  if (!session.timerEndsAt || new Date(session.timerEndsAt).getTime() <= Date.now()) {
    res.status(400).json({ error: "Bidding is not open — operator must start the timer first" });
    return;
  }
  if (amount <= (session.currentBid ?? 0)) { res.status(400).json({ error: "Bid must be higher than current bid" }); return; }

  // Double-bid prevention — same team can't bid if already leading
  if (session.currentBidTeamId === teamId) {
    res.status(409).json({ error: "Your team is already the highest bidder" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  if (!team.isBiddingEnabled) { res.status(400).json({ error: "Bidding disabled for this team" }); return; }

  // Trial mode: only the first 2 teams (by ID) may bid
  if (tournament?.licenseStatus !== "live") {
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

  const { spendablePurse, reservePurse, slotsRequired } = await computeTeamPurseProtection(tid, teamId, {
    team: { purse: team.purse, purseUsed: team.purseUsed },
  });
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

  const session = await getOrCreateSession(tid);
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
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  // Fire-and-forget WhatsApp notification
  notifyPlayerSold({
    mobile: soldPlayer?.mobileNumber ?? null,
    playerName: soldPlayer?.name ?? "Player",
    teamName: team?.name ?? "Team",
    amount: soldAmount,
    tournamentName: tournament?.name ?? "the tournament",
  });

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

  const schema = z.object({ teamId: z.number().int(), amount: z.number().int().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { teamId, amount } = parsed.data;
  const session = await getOrCreateSession(tid);

  if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }

  const playerId = session.currentPlayerId;

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
  const [manualTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));

  await db
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      lastAction: `SOLD (manual): ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${amount.toLocaleString("en-IN")}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  notifyPlayerSold({
    mobile: soldPlayer?.mobileNumber ?? null,
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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST mark unsold
router.post("/tournaments/:tournamentId/auction/unsold", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const session = await getOrCreateSession(tid);
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
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  notifyPlayerUnsold({
    mobile: player?.mobileNumber ?? null,
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

  const schema = z.object({
    playerId: z.number().int(),
    startFromBase: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

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
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  notifyPlayerReAuction({
    mobile: player.mobileNumber ?? null,
    playerName: player.name,
    tournamentName: reTournament?.name ?? "the tournament",
  });

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST re-auction all unsold — reset all unsold players back to available for another round
router.post("/tournaments/:tournamentId/auction/re-auction-unsold", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

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

  res.json(await broadcastState(tid, ["players"]));
});

// POST reset trial auction — reset all non-retained players to available, clear bids
// First reset (resetCount === 0) requires the tournament's organizer/operator password.
// Any subsequent reset requires the master super admin password (ADMIN_PASSWORD).
router.post("/tournaments/:tournamentId/auction/reset-trial", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const body = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Password is required" }); return; }
  const submittedPw = body.data.password;

  const safeCompare = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  };

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const masterPw = process.env.ADMIN_PASSWORD || "";
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

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST defer current player — send to back of queue, auto-advance to next
router.post("/tournaments/:tournamentId/auction/defer-player", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const session = await getOrCreateSession(tid);
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
  const isTrialMode = tournament?.licenseStatus !== "live";

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

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: selectedPlayerId,
      currentBid: selectedPlayer.basePrice,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      deferredPlayerIds: newDeferredIds.length > 0 ? JSON.stringify(newDeferredIds) : null,
      lastAction: `Brought later: ${deferredPlayer?.name ?? "Player"} — Now bidding: ${selectedPlayer.name}`,
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

  const lastBid = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid))
    .orderBy(desc(bidsTable.timestamp))
    .limit(1);

  if (lastBid.length > 0) {
    const bid = lastBid[0];
    await db
      .update(playersTable)
      .set({ status: "available", teamId: null, soldPrice: null })
      .where(eq(playersTable.id, bid.playerId));

    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
    if (team) {
      await db
        .update(teamsTable)
        .set({ purseUsed: Math.max(0, team.purseUsed - bid.amount) })
        .where(eq(teamsTable.id, bid.teamId));
    }

    await db.delete(bidsTable).where(eq(bidsTable.id, bid.id));

    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
    await db
      .update(auctionSessionsTable)
      .set({ lastAction: `Undone: ${player?.name ?? "Player"} returned to pool` })
      .where(eq(auctionSessionsTable.tournamentId, tid));
  } else {
    await db
      .update(auctionSessionsTable)
      .set({ lastAction: "Nothing to undo" })
      .where(eq(auctionSessionsTable.tournamentId, tid));
  }

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST set LED display overlay mode (off | team | player | top5)
router.post("/tournaments/:tournamentId/auction/display-overlay", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({ mode: z.enum(["off", "team", "player", "top5"]) }).safeParse(req.body);
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
  // When spin starts, clear winner; when deactivating, reset spin state
  if (body.data.spinning === true) patch.wheelWinner = null;
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
  const body = z.object({ seconds: z.number().int().min(5).max(300) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const session = await getOrCreateSession(tid);
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

export default router;
