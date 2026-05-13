import { Router } from "express";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  bidsTable,
  categoriesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// GET tournament summary
router.get("/tournaments/:tournamentId/analytics/summary", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid));
  const bids = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid));

  const soldPlayers = players.filter((p) => p.status === "sold");
  const unsoldPlayers = players.filter((p) => p.status === "unsold");
  const availablePlayers = players.filter((p) => p.status === "available");

  const totalSpent = soldPlayers.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0);
  const avgBidAmount = soldPlayers.length > 0 ? Math.round(totalSpent / soldPlayers.length) : 0;
  const highestBid = soldPlayers.reduce((max, p) => Math.max(max, p.soldPrice ?? 0), 0);

  // Most active team (most bids)
  const teamBidCounts: Record<number, number> = {};
  bids.forEach((b) => {
    teamBidCounts[b.teamId] = (teamBidCounts[b.teamId] ?? 0) + 1;
  });
  let mostActiveTeamId: number | null = null;
  let maxBidCount = 0;
  for (const [teamId, count] of Object.entries(teamBidCounts)) {
    if (count > maxBidCount) {
      maxBidCount = count;
      mostActiveTeamId = parseInt(teamId);
    }
  }
  let mostActiveTeam = null;
  if (mostActiveTeamId) {
    const [team] = teams.filter((t) => t.id === mostActiveTeamId);
    mostActiveTeam = team?.name ?? null;
  }

  res.json({
    totalPlayers: players.length,
    soldPlayers: soldPlayers.length,
    unsoldPlayers: unsoldPlayers.length,
    availablePlayers: availablePlayers.length,
    totalSpent,
    totalTeams: teams.length,
    avgBidAmount,
    highestBid,
    mostActiveTeam,
  });
});

// GET team purses
router.get("/tournaments/:tournamentId/analytics/team-purses", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid))
    .orderBy(teamsTable.name);

  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));

  const result = teams.map((team) => {
    const playersBought = players.filter((p) => p.teamId === team.id && p.status === "sold").length;
    return {
      teamId: team.id,
      teamName: team.name,
      shortCode: team.shortCode,
      ownerName: team.ownerName,
      color: team.color,
      logoUrl: team.logoUrl,
      purse: team.purse,
      purseUsed: team.purseUsed,
      purseRemaining: team.purse - team.purseUsed,
      playersBought,
    };
  });

  res.json(result);
});

// GET top bids
router.get("/tournaments/:tournamentId/analytics/top-bids", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const soldPlayers = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid))
    .orderBy(desc(playersTable.soldPrice))
    .limit(10);

  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.tournamentId, tid));

  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid));

  const result = soldPlayers
    .filter((p) => p.status === "sold" && p.soldPrice !== null)
    .map((p) => {
      const team = teams.find((t) => t.id === p.teamId);
      const category = categories.find((c) => c.id === p.categoryId);
      return {
        playerId: p.id,
        playerName: p.name,
        teamName: team?.name ?? "Unknown",
        teamColor: team?.color ?? null,
        soldPrice: p.soldPrice ?? 0,
        basePrice: p.basePrice,
        categoryName: category?.name ?? null,
        role: p.role,
      };
    });

  res.json(result);
});

// GET category breakdown
router.get("/tournaments/:tournamentId/analytics/category-breakdown", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.tournamentId, tid));

  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));

  const result = categories.map((cat) => {
    const catPlayers = players.filter((p) => p.categoryId === cat.id);
    const sold = catPlayers.filter((p) => p.status === "sold");
    const unsold = catPlayers.filter((p) => p.status === "unsold");
    const available = catPlayers.filter((p) => p.status === "available");
    const totalSpent = sold.reduce((sum, p) => sum + (p.soldPrice ?? 0), 0);
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      colorCode: cat.colorCode,
      total: catPlayers.length,
      sold: sold.length,
      unsold: unsold.length,
      available: available.length,
      totalSpent,
    };
  });

  res.json(result);
});

export default router;
