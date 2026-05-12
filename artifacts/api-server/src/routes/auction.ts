import { Router } from "express";
import { db } from "@workspace/db";
import {
  auctionSessionsTable,
  playersTable,
  teamsTable,
  bidsTable,
  tournamentsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { addSseClient, removeSseClient, broadcastToTournament } from "../lib/broadcast";

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

async function buildAuctionState(tournamentId: number) {
  const session = await getOrCreateSession(tournamentId);

  let currentPlayer = null;
  let bidIncrement = 50000;

  if (session.currentPlayerId) {
    const [p] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, session.currentPlayerId));
    if (p) {
      currentPlayer = playerToJson(p);
      if (p.categoryId) {
        const [cat] = await db
          .select()
          .from(categoriesTable)
          .where(eq(categoriesTable.id, p.categoryId));
        if (cat?.bidIncrement) bidIncrement = cat.bidIncrement;
      }
    }
  }

  let currentBidTeamName = null;
  let currentBidTeamColor = null;
  if (session.currentBidTeamId) {
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, session.currentBidTeamId));
    if (team) {
      currentBidTeamName = team.name;
      currentBidTeamColor = team.color;
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

  return {
    tournamentId,
    status: session.status,
    currentPlayer,
    currentBid: session.currentBid,
    currentBidTeamId: session.currentBidTeamId,
    currentBidTeamName,
    currentBidTeamColor,
    bidIncrement,
    timerSeconds: session.timerSeconds,
    timerEndsAt: session.timerEndsAt,
    lastAction: session.lastAction,
    soldPlayersCount: soldCount,
    unsoldPlayersCount: unsoldCount,
    remainingPlayersCount: availableCount,
    fortuneWheelActive: session.fortuneWheelActive,
    wheelItems,
    wheelWinner: session.wheelWinner,
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

// POST start auction
router.post("/tournaments/:tournamentId/auction/start", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await getOrCreateSession(tid);
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const timerSecs = tournament?.timerSeconds ?? 30;
  await db
    .update(auctionSessionsTable)
    .set({ status: "active", lastAction: "Auction started", timerSeconds: timerSecs })
    .where(eq(auctionSessionsTable.tournamentId, tid));
  await db.update(tournamentsTable).set({ status: "active" }).where(eq(tournamentsTable.id, tid));
  res.json(await broadcastState(tid));
});

// POST pause auction
router.post("/tournaments/:tournamentId/auction/pause", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await getOrCreateSession(tid);
  await db
    .update(auctionSessionsTable)
    .set({ status: "paused", lastAction: "Auction paused" })
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

  let selectedPlayerId: number | null = null;

  if (playerId) {
    selectedPlayerId = playerId;
  } else if (mode === "random") {
    const available = await db
      .select()
      .from(playersTable)
      .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")));
    if (available.length > 0) {
      selectedPlayerId = available[Math.floor(Math.random() * available.length)].id;
    }
  } else {
    const [next] = await db
      .select()
      .from(playersTable)
      .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")))
      .orderBy(asc(playersTable.id))
      .limit(1);
    if (next) selectedPlayerId = next.id;
  }

  if (!selectedPlayerId) {
    await db
      .update(auctionSessionsTable)
      .set({
        status: "completed",
        currentPlayerId: null,
        currentBid: null,
        currentBidTeamId: null,
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
      lastAction: `Now bidding: ${selectedPlayer.name}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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
  if (amount <= (session.currentBid ?? 0)) { res.status(400).json({ error: "Bid must be higher than current bid" }); return; }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  if (!team.isBiddingEnabled) { res.status(400).json({ error: "Bidding disabled for this team" }); return; }
  const purseRemaining = team.purse - team.purseUsed;
  if (amount > purseRemaining) { res.status(400).json({ error: "Insufficient purse" }); return; }

  await db
    .update(auctionSessionsTable)
    .set({
      currentBid: amount,
      currentBidTeamId: teamId,
      lastAction: `${team.name} bid ₹${amount.toLocaleString("en-IN")}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  await db
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      lastAction: `SOLD: ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${soldAmount.toLocaleString("en-IN")}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  await db
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      lastAction: `SOLD (manual): ${soldPlayer?.name ?? "Player"} to ${team?.name ?? "Team"} for ₹${amount.toLocaleString("en-IN")}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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

  await db
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      lastAction: `UNSOLD: ${player?.name ?? "Player"}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

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
    // Remove the bid record
    await db
      .delete(bidsTable)
      .where(and(eq(bidsTable.playerId, playerId), eq(bidsTable.tournamentId, tid)));
  }

  // Reset player
  const startingBid = startFromBase ? player.basePrice : (player.soldPrice ?? player.basePrice);
  await db
    .update(playersTable)
    .set({ status: "available", teamId: null, soldPrice: null })
    .where(eq(playersTable.id, playerId));

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  const timerSecs = tournament?.timerSeconds ?? 30;

  await db
    .update(auctionSessionsTable)
    .set({
      status: "active",
      currentPlayerId: playerId,
      currentBid: startingBid,
      currentBidTeamId: null,
      timerSeconds: timerSecs,
      lastAction: `RE-AUCTION: ${player.name}`,
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
});

// POST reset trial auction — reset all non-retained players to available, clear bids
router.post("/tournaments/:tournamentId/auction/reset-trial", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Reset all sold/unsold players to available (not retained)
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

  // Reset team purse usage (keep retained players' costs)
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid));

  for (const team of teams) {
    // Sum retained players' prices for this team
    const retainedPlayers = allPlayers.filter(
      (p) => p.status === "retained" && p.teamId === team.id
    );
    const retainedCost = retainedPlayers.reduce((sum, p) => sum + (p.retainedPrice ?? 0), 0);
    await db
      .update(teamsTable)
      .set({ purseUsed: retainedCost })
      .where(eq(teamsTable.id, team.id));
  }

  // Delete all bids
  await db.delete(bidsTable).where(eq(bidsTable.tournamentId, tid));

  // Reset session
  await db
    .update(auctionSessionsTable)
    .set({
      status: "idle",
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      soldPlayersCount: 0,
      unsoldPlayersCount: 0,
      lastAction: "Reset complete — ready for live auction",
    })
    .where(eq(auctionSessionsTable.tournamentId, tid));

  await db.update(tournamentsTable).set({ status: "setup" }).where(eq(tournamentsTable.id, tid));

  res.json(await broadcastState(tid, ["bids", "purses", "players"]));
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

// POST fortune wheel sync (active, items, winner)
router.post("/tournaments/:tournamentId/auction/fortune-wheel", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({
    active: z.boolean().optional(),
    items: z.array(z.object({ label: z.string(), color: z.string() })).optional(),
    winner: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  await getOrCreateSession(tid);
  const patch: Record<string, unknown> = {};
  if (body.data.active !== undefined) patch.fortuneWheelActive = body.data.active;
  if (body.data.items !== undefined) patch.wheelItemsJson = JSON.stringify(body.data.items);
  if ("winner" in body.data) patch.wheelWinner = body.data.winner ?? null;
  if (Object.keys(patch).length > 0) {
    await db
      .update(auctionSessionsTable)
      .set(patch)
      .where(eq(auctionSessionsTable.tournamentId, tid));
  }
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
  await db
    .update(auctionSessionsTable)
    .set({ timerEndsAt: endsAt })
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

export default router;
