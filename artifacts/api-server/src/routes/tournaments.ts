import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  timerSeconds: t.timerSeconds,
  bidTimerSeconds: t.bidTimerSeconds,
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
  timerSeconds: z.number().int().optional(),
  bidTimerSeconds: z.number().int().optional(),
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

export default router;
