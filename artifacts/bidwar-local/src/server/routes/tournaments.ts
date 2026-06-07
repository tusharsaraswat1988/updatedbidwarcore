import { Router } from "express";
import {
  DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
  DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
  DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
  DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
} from "@workspace/api-base/auction-readiness";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import {
  tournamentsTable, teamsTable, playersTable, categoriesTable,
} from "@workspace/db-local";
import {
  computeEffectiveCapacity,
  getActiveBoosterTotalsForTeams,
} from "../lib/purse-capacity.js";

const tournamentToJson = (t: typeof tournamentsTable.$inferSelect) => ({
  id: t.id, name: t.name, sport: t.sport, venue: t.venue, auctionDate: t.auctionDate,
  organizerName: t.organizerName, organizerMobile: t.organizerMobile, organizerEmail: t.organizerEmail,
  logoUrl: t.logoUrl, sponsorLogos: t.sponsorLogos, basePurse: t.basePurse, minBid: t.minBid,
  bidIncrement: t.bidIncrement, bidTier1UpTo: t.bidTier1UpTo, bidTier1Increment: t.bidTier1Increment,
  bidTier2UpTo: t.bidTier2UpTo, bidTier2Increment: t.bidTier2Increment,
  bidTier3Increment: t.bidTier3Increment, bidTiers: t.bidTiers, timerSeconds: t.timerSeconds,
  bidTimerSeconds: t.bidTimerSeconds, playerSelectionMode: t.playerSelectionMode,
  status: t.status, cloudId: t.cloudId, createdAt: t.createdAt,
});

export function createTournamentsRouter(db: LocalDb) {
  const router = Router();

  router.get("/tournaments", async (_req, res) => {
    const rows = await db.select().from(tournamentsTable);
    res.json(rows.map(tournamentToJson));
  });

  router.post("/tournaments", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sport: z.string().default("cricket"),
      venue: z.string().optional(),
      auctionDate: z.string().optional(),
      basePurse: z.number().int().optional(),
      timerSeconds: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    const [row] = await db.insert(tournamentsTable).values({
      name: d.name, sport: d.sport ?? "cricket",
      venue: d.venue ?? null, auctionDate: d.auctionDate ?? null,
      basePurse: d.basePurse ?? 10000000,
      bidTiers: DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
      timerSeconds: d.timerSeconds ?? DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
      bidTimerSeconds: DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
      playerSelectionMode: DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
    }).returning();
    res.status(201).json(tournamentToJson(row));
  });

  router.get("/tournaments/:tournamentId", async (req, res) => {
    const id = parseInt(req.params.tournamentId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(tournamentToJson(row));
  });

  router.patch("/tournaments/:tournamentId", async (req, res) => {
    const id = parseInt(req.params.tournamentId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      sport: z.string().max(60).optional(),
      venue: z.string().max(200).nullable().optional(),
      auctionDate: z.string().max(30).nullable().optional(),
      organizerName: z.string().max(120).nullable().optional(),
      organizerMobile: z.string().max(20).nullable().optional(),
      logoUrl: z.string().url().nullable().optional(),
      sponsorLogos: z.string().nullable().optional(),
      basePurse: z.number().int().min(0).optional(),
      minBid: z.number().int().min(0).optional(),
      bidIncrement: z.number().int().min(0).optional(),
      bidTiers: z.string().nullable().optional(),
      timerSeconds: z.number().int().min(5).max(300).optional(),
      bidTimerSeconds: z.number().int().min(5).max(300).optional(),
      playerSelectionMode: z.enum(["manual","random","queue"]).optional(),
      status: z.enum(["setup","active","paused","completed"]).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    if (Object.keys(d).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [row] = await db.update(tournamentsTable).set({ ...d, updatedAt: new Date().toISOString() })
      .where(eq(tournamentsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(tournamentToJson(row));
  });

  router.delete("/tournaments/:tournamentId", async (req, res) => {
    const id = parseInt(req.params.tournamentId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
    res.status(204).send();
  });

  router.get("/tournaments/:tournamentId/summary", async (req, res) => {
    const id = parseInt(req.params.tournamentId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, id));
    const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, id));
    const sold = players.filter(p => p.status === "sold");
    const totalSpent = sold.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    res.json({
      totalPlayers: players.length, soldPlayers: sold.length,
      unsoldPlayers: players.filter(p => p.status === "unsold").length,
      availablePlayers: players.filter(p => p.status === "available").length,
      retainedPlayers: players.filter(p => p.status === "retained").length,
      totalTeams: teams.length, totalPurse: teams.reduce((s, t) => s + t.purse, 0), totalSpent,
    });
  });

  router.get("/tournaments/:tournamentId/team-purses", async (req, res) => {
    const id = parseInt(req.params.tournamentId);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, id));
    const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, id));
    const boosterTotals = await getActiveBoosterTotalsForTeams(db, id, teams.map(t => t.id));
    res.json(teams.map(t => {
      const boosterTotal = boosterTotals.get(t.id) ?? 0;
      const effectiveCapacity = computeEffectiveCapacity(t.purse, boosterTotal);
      return {
        teamId: t.id, teamName: t.name, shortCode: t.shortCode, color: t.color,
        logoUrl: t.logoUrl,
        originalPurse: t.purse,
        boosterTotal,
        effectiveCapacity,
        purse: effectiveCapacity,
        purseUsed: t.purseUsed,
        purseRemaining: effectiveCapacity - t.purseUsed,
        playersBought: players.filter(p => p.teamId === t.id && p.status === "sold").length,
      };
    }));
  });

  return router;
}
