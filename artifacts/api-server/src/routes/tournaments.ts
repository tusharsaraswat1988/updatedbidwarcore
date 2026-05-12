import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, teamsTable, playersTable, categoriesTable, bidsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const tournamentToJson = (t: typeof tournamentsTable.$inferSelect) => ({
  id: t.id,
  name: t.name,
  sport: t.sport,
  venue: t.venue,
  auctionDate: t.auctionDate,
  organizerName: t.organizerName,
  organizerMobile: t.organizerMobile,
  organizerEmail: t.organizerEmail,
  logoUrl: t.logoUrl,
  sponsorLogos: t.sponsorLogos,
  basePurse: t.basePurse,
  minBid: t.minBid,
  bidIncrement: t.bidIncrement,
  bidTier1UpTo: t.bidTier1UpTo,
  bidTier1Increment: t.bidTier1Increment,
  bidTier2UpTo: t.bidTier2UpTo,
  bidTier2Increment: t.bidTier2Increment,
  bidTier3Increment: t.bidTier3Increment,
  bidTiers: t.bidTiers,
  timerSeconds: t.timerSeconds,
  bidTimerSeconds: t.bidTimerSeconds,
  playerSelectionMode: t.playerSelectionMode,
  status: t.status,
  createdAt: t.createdAt.toISOString(),
});

const tournamentInputSchema = z.object({
  name: z.string().min(1),
  sport: z.string().default("cricket"),
  venue: z.string().optional(),
  auctionDate: z.string().optional(),
  organizerName: z.string().optional(),
  organizerMobile: z.string().optional(),
  organizerEmail: z.string().optional(),
  logoUrl: z.string().optional(),
  sponsorLogos: z.string().optional(),
  basePurse: z.number().int().optional(),
  minBid: z.number().int().optional(),
  bidIncrement: z.number().int().optional(),
  bidTiers: z.string().optional(),
  timerSeconds: z.number().int().optional(),
  bidTimerSeconds: z.number().int().optional(),
  playerSelectionMode: z.enum(["sequential", "random", "manual"]).optional(),
});

router.get("/tournaments", async (_req, res) => {
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  res.json(tournaments.map(tournamentToJson));
});

router.post("/tournaments", async (req, res) => {
  const parsed = tournamentInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: d.name,
      sport: d.sport,
      venue: d.venue ?? null,
      auctionDate: d.auctionDate ?? null,
      organizerName: d.organizerName ?? null,
      organizerMobile: d.organizerMobile ?? null,
      organizerEmail: d.organizerEmail ?? null,
      logoUrl: d.logoUrl ?? null,
      sponsorLogos: d.sponsorLogos ?? null,
      basePurse: d.basePurse ?? 10000000,
      minBid: d.minBid ?? 100000,
      bidIncrement: d.bidIncrement ?? 100000,
      timerSeconds: d.timerSeconds ?? 30,
      bidTimerSeconds: d.bidTimerSeconds ?? 15,
      status: "setup",
    })
    .returning();
  res.status(201).json(tournamentToJson(tournament));
});

router.get("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tournamentToJson(tournament));
});

router.patch("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    sport: z.string().optional(),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    logoUrl: z.string().optional(),
    sponsorLogos: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidIncrement: z.number().int().optional(),
    bidTier1UpTo: z.number().int().optional(),
    bidTier1Increment: z.number().int().optional(),
    bidTier2UpTo: z.number().int().optional(),
    bidTier2Increment: z.number().int().optional(),
    bidTier3Increment: z.number().int().optional(),
    bidTiers: z.string().optional(),
    timerSeconds: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
    status: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.sport !== undefined) updates.sport = d.sport;
  if (d.venue !== undefined) updates.venue = d.venue;
  if (d.auctionDate !== undefined) updates.auctionDate = d.auctionDate;
  if (d.organizerName !== undefined) updates.organizerName = d.organizerName;
  if (d.organizerMobile !== undefined) updates.organizerMobile = d.organizerMobile;
  if (d.organizerEmail !== undefined) updates.organizerEmail = d.organizerEmail;
  if (d.logoUrl !== undefined) updates.logoUrl = d.logoUrl;
  if (d.sponsorLogos !== undefined) updates.sponsorLogos = d.sponsorLogos;
  if (d.basePurse !== undefined) updates.basePurse = d.basePurse;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.bidIncrement !== undefined) updates.bidIncrement = d.bidIncrement;
  if (d.bidTier1UpTo !== undefined) updates.bidTier1UpTo = d.bidTier1UpTo;
  if (d.bidTier1Increment !== undefined) updates.bidTier1Increment = d.bidTier1Increment;
  if (d.bidTier2UpTo !== undefined) updates.bidTier2UpTo = d.bidTier2UpTo;
  if (d.bidTier2Increment !== undefined) updates.bidTier2Increment = d.bidTier2Increment;
  if (d.bidTier3Increment !== undefined) updates.bidTier3Increment = d.bidTier3Increment;
  if (d.bidTiers !== undefined) updates.bidTiers = d.bidTiers;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  if (d.bidTimerSeconds !== undefined) updates.bidTimerSeconds = d.bidTimerSeconds;
  if (d.status !== undefined) updates.status = d.status;
  const [tournament] = await db
    .update(tournamentsTable)
    .set(updates)
    .where(eq(tournamentsTable.id, id))
    .returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tournamentToJson(tournament));
});

router.delete("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.status(204).send();
});

// GET export full tournament snapshot for local/offline mode
router.get("/tournaments/:tournamentId/export", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, id));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, id));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, id));

  const playerToJson = (p: typeof playersTable.$inferSelect) => ({
    id: p.id, tournamentId: p.tournamentId, categoryId: p.categoryId, teamId: p.teamId,
    name: p.name, city: p.city, role: p.role, battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle, specialization: p.specialization, age: p.age,
    photoUrl: p.photoUrl, basePrice: p.basePrice, soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice, status: p.status, jerseyNumber: p.jerseyNumber,
    achievements: p.achievements, mobileNumber: p.mobileNumber, cricheroUrl: p.cricheroUrl,
    availabilityDates: p.availabilityDates, createdAt: p.createdAt.toISOString(),
  });

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    tournament: tournamentToJson(tournament),
    teams: teams.map(t => ({
      id: t.id, tournamentId: t.tournamentId, name: t.name, shortCode: t.shortCode,
      ownerName: t.ownerName, ownerMobile: t.ownerMobile, color: t.color,
      logoUrl: t.logoUrl, purse: t.purse, purseUsed: t.purseUsed,
      isBiddingEnabled: t.isBiddingEnabled, accessCode: t.accessCode,
      createdAt: t.createdAt.toISOString(),
    })),
    players: players.map(playerToJson),
    categories: categories.map(c => ({
      id: c.id, tournamentId: c.tournamentId, name: c.name, minBid: c.minBid,
      bidIncrement: c.bidIncrement, maxPlayers: c.maxPlayers, colorCode: c.colorCode,
      sortOrder: c.sortOrder, createdAt: c.createdAt.toISOString(),
    })),
  });
});

// POST sync local offline auction results back to cloud
router.post("/tournaments/:tournamentId/sync", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({
    playerResults: z.array(z.object({
      cloudId: z.number().int(),
      status: z.string(),
      teamCloudId: z.number().int().nullable().optional(),
      soldPrice: z.number().int().nullable().optional(),
    })),
    teamPurses: z.array(z.object({
      cloudId: z.number().int(),
      purseUsed: z.number().int(),
    })),
    bids: z.array(z.object({
      playerCloudId: z.number().int(),
      teamCloudId: z.number().int(),
      amount: z.number().int(),
      timestamp: z.string(),
    })).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sync payload" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const { playerResults, teamPurses, bids } = parsed.data;

  let playersUpdated = 0;
  for (const p of playerResults) {
    await db.update(playersTable).set({
      status: p.status,
      teamId: p.teamCloudId ?? null,
      soldPrice: p.soldPrice ?? null,
    }).where(and(eq(playersTable.id, p.cloudId), eq(playersTable.tournamentId, id)));
    playersUpdated++;
  }

  let teamsUpdated = 0;
  for (const t of teamPurses) {
    await db.update(teamsTable).set({ purseUsed: t.purseUsed })
      .where(and(eq(teamsTable.id, t.cloudId), eq(teamsTable.tournamentId, id)));
    teamsUpdated++;
  }

  let bidsInserted = 0;
  for (const b of bids) {
    await db.insert(bidsTable).values({
      tournamentId: id,
      playerId: b.playerCloudId,
      teamId: b.teamCloudId,
      amount: b.amount,
    });
    bidsInserted++;
  }

  await db.update(tournamentsTable).set({ status: "completed" }).where(eq(tournamentsTable.id, id));

  res.json({ ok: true, playersUpdated, teamsUpdated, bidsInserted });
});

export default router;
