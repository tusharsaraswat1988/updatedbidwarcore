import { Router, type Response } from "express";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import {
  auctionSessionsTable, playersTable, teamsTable, bidsTable, tournamentsTable,
} from "@workspace/db-local";
import { mirrorStateToCloud } from "../mirror.js";

// SSE client registry (in-process, no separate broadcast module needed)
const sseClients = new Map<number, Set<Response>>();

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

const playerToJson = (p: typeof playersTable.$inferSelect) => ({
  id: p.id, tournamentId: p.tournamentId, categoryId: p.categoryId, teamId: p.teamId,
  name: p.name, city: p.city, role: p.role, battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle, specialization: p.specialization, age: null,
  photoUrl: p.photoUrl, basePrice: p.basePrice, soldPrice: p.soldPrice,
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
        currentBidTeamLogoUrl = team.logoUrl;
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

    let displayCountdown: { type: string; endsAt: string; message: string | null } | null = null;
    if (session.displayCountdown) {
      try {
        const parsed = JSON.parse(session.displayCountdown) as { type: string; endsAt: string; message: string | null };
        if (parsed && new Date(parsed.endsAt) > new Date()) displayCountdown = parsed;
      } catch { /* ignore */ }
    }

    return {
      tournamentId, status: session.status, currentPlayer,
      currentBid: session.currentBid, currentBidTeamId: session.currentBidTeamId,
      currentBidTeamName, currentBidTeamColor, currentBidTeamLogoUrl,
      bidIncrement, timerSeconds, bidTimerSeconds, timerEndsAt: session.timerEndsAt,
      lastAction: session.lastAction, soldPlayersCount: soldCount,
      unsoldPlayersCount: unsoldCount, remainingPlayersCount: availableCount,
      fortuneWheelActive: session.fortuneWheelActive,
      wheelSpinning: session.wheelSpinning ?? false,
      wheelItems,
      wheelWinner: session.wheelWinner, teamPurseViewActive: session.teamPurseViewActive,
      isBreak: session.isBreak ?? false,
      breakEndsAt: session.breakEndsAt ?? null,
      displayCountdown,
      activeCategoryIds, playerSelectionMode: tournamentRow?.playerSelectionMode ?? "sequential",
    };
  }

  async function broadcastState(tournamentId: number, invalidate: string[] = []) {
    const state = await buildAuctionState(tournamentId);
    broadcastToTournament(tournamentId, { type: "auction_state", state, invalidate });
    mirrorStateToCloud(db, tournamentId);
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

    let activeCatIds: number[] | null = null;
    try { if (session.activeCategoryIds) activeCatIds = JSON.parse(session.activeCategoryIds); } catch { /* ignore */ }

    let selectedPlayerId: number | null = null;
    if (playerId) {
      selectedPlayerId = playerId;
    } else if (mode === "random") {
      const baseConditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
      const available = activeCatIds && activeCatIds.length > 0
        ? await db.select().from(playersTable).where(and(...baseConditions, inArray(playersTable.categoryId as Parameters<typeof inArray>[0], activeCatIds)))
        : await db.select().from(playersTable).where(and(...baseConditions));
      if (available.length > 0) selectedPlayerId = available[Math.floor(Math.random() * available.length)].id;
    } else {
      const baseConditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
      const query = db.select().from(playersTable).orderBy(asc(playersTable.id)).limit(1);
      const [next] = activeCatIds && activeCatIds.length > 0
        ? await query.where(and(...baseConditions, inArray(playersTable.categoryId as Parameters<typeof inArray>[0], activeCatIds)))
        : await query.where(and(...baseConditions));
      if (next) selectedPlayerId = next.id;
    }

    if (!selectedPlayerId) {
      await db.update(auctionSessionsTable).set({
        status: "completed", currentPlayerId: null, currentBid: null,
        currentBidTeamId: null, timerEndsAt: null,
        lastAction: "Auction completed — all players processed",
      }).where(eq(auctionSessionsTable.tournamentId, tid));
      await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, tid));
      res.json(await broadcastState(tid, ["players"]));
      return;
    }

    const [selectedPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, selectedPlayerId));
    await db.update(auctionSessionsTable).set({
      status: "active", currentPlayerId: selectedPlayerId,
      currentBid: selectedPlayer.basePrice, currentBidTeamId: null,
      timerSeconds: timerSecs, timerEndsAt: null, pausedTimeRemaining: null,
      lastAction: `Now bidding: ${selectedPlayer.name}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
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
    if (!session.currentPlayerId) { res.status(400).json({ error: "No player currently up for bid" }); return; }
    if (session.status !== "active") { res.status(400).json({ error: "Auction is not active" }); return; }
    if (!session.timerEndsAt || new Date(session.timerEndsAt).getTime() <= Date.now()) {
      res.status(400).json({ error: "Bidding is not open — operator must start the timer first" }); return;
    }
    if (amount <= (session.currentBid ?? 0)) { res.status(400).json({ error: "Bid must be higher than current bid" }); return; }
    if (session.currentBidTeamId === teamId) { res.status(409).json({ error: "Your team is already the highest bidder" }); return; }
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    if (!team.isBiddingEnabled) { res.status(400).json({ error: "Bidding disabled for this team" }); return; }
    if (amount > (team.purse - team.purseUsed)) { res.status(400).json({ error: "Insufficient purse" }); return; }
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
    if (!session.currentPlayerId) { res.status(400).json({ error: "No current player" }); return; }
    const playerId = session.currentPlayerId;
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
      lastAction: `RE-AUCTION: ${player.name}`,
    }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid, ["bids", "purses", "players"]));
  });

  // POST re-auction all unsold
  router.post("/tournaments/:tournamentId/auction/re-auction-unsold", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const unsoldPlayers = await db.select().from(playersTable)
      .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.status, "unsold")));
    if (unsoldPlayers.length === 0) { res.status(400).json({ error: "No unsold players to re-auction" }); return; }
    for (const p of unsoldPlayers) {
      await db.update(playersTable).set({ status: "available" }).where(eq(playersTable.id, p.id));
    }
    await db.update(auctionSessionsTable)
      .set({ lastAction: `RE-AUCTION ROUND: ${unsoldPlayers.length} unsold players returned to queue` })
      .where(eq(auctionSessionsTable.tournamentId, tid));
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
    await db.delete(bidsTable).where(eq(bidsTable.tournamentId, tid));
    await db.update(auctionSessionsTable).set({
      status: "idle", currentPlayerId: null, currentBid: null, currentBidTeamId: null,
      timerEndsAt: null, soldPlayersCount: 0, unsoldPlayersCount: 0,
      lastAction: "Reset complete — ready for live auction",
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
      await db.update(auctionSessionsTable).set({ lastAction: `Undone: ${player?.name ?? "Player"} returned to pool` })
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
      action: z.enum(["start", "cancel", "extend"]),
      durationSeconds: z.number().int().min(10).max(3600).optional(),
      message: z.string().max(60).optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const session = await getOrCreateSession(tid);
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
    await db.update(auctionSessionsTable).set({ displayCountdown: countdown }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST pre-auction-countdown (10-second fixed countdown before bidding opens)
  router.post("/tournaments/:tournamentId/auction/pre-auction-countdown", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
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
    await db.update(auctionSessionsTable).set({ displayCountdown: countdown }).where(eq(auctionSessionsTable.tournamentId, tid));
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
    await db.update(auctionSessionsTable).set({ activeCategoryIds }).where(eq(auctionSessionsTable.tournamentId, tid));
    res.json(await broadcastState(tid));
  });

  // POST start timer
  router.post("/tournaments/:tournamentId/auction/start-timer", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({ seconds: z.number().int().min(5).max(300) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    await getOrCreateSession(tid);
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

  return router;
}
