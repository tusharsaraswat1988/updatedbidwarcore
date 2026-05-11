import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/tournaments", async (req, res) => {
  const tournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(tournamentsTable.createdAt);
  res.json(
    tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      venue: t.venue,
      auctionDate: t.auctionDate,
      organizerName: t.organizerName,
      basePurse: t.basePurse,
      minBid: t.minBid,
      bidIncrement: t.bidIncrement,
      timerSeconds: t.timerSeconds,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }))
  );
});

router.post("/tournaments", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    sport: z.string().default("cricket"),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    organizerName: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidIncrement: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parsed.data;
  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: data.name,
      sport: data.sport,
      venue: data.venue ?? null,
      auctionDate: data.auctionDate ?? null,
      organizerName: data.organizerName ?? null,
      basePurse: data.basePurse ?? 10000000,
      minBid: data.minBid ?? 100000,
      bidIncrement: data.bidIncrement ?? 100000,
      timerSeconds: data.timerSeconds ?? 30,
      status: "setup",
    })
    .returning();
  res.status(201).json({
    id: tournament.id,
    name: tournament.name,
    sport: tournament.sport,
    venue: tournament.venue,
    auctionDate: tournament.auctionDate,
    organizerName: tournament.organizerName,
    basePurse: tournament.basePurse,
    minBid: tournament.minBid,
    bidIncrement: tournament.bidIncrement,
    timerSeconds: tournament.timerSeconds,
    status: tournament.status,
    createdAt: tournament.createdAt.toISOString(),
  });
});

router.get("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    id: tournament.id,
    name: tournament.name,
    sport: tournament.sport,
    venue: tournament.venue,
    auctionDate: tournament.auctionDate,
    organizerName: tournament.organizerName,
    basePurse: tournament.basePurse,
    minBid: tournament.minBid,
    bidIncrement: tournament.bidIncrement,
    timerSeconds: tournament.timerSeconds,
    status: tournament.status,
    createdAt: tournament.createdAt.toISOString(),
  });
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
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidIncrement: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
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
  if (d.basePurse !== undefined) updates.basePurse = d.basePurse;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.bidIncrement !== undefined) updates.bidIncrement = d.bidIncrement;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  if (d.status !== undefined) updates.status = d.status;
  const [tournament] = await db
    .update(tournamentsTable)
    .set(updates)
    .where(eq(tournamentsTable.id, id))
    .returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    id: tournament.id,
    name: tournament.name,
    sport: tournament.sport,
    venue: tournament.venue,
    auctionDate: tournament.auctionDate,
    organizerName: tournament.organizerName,
    basePurse: tournament.basePurse,
    minBid: tournament.minBid,
    bidIncrement: tournament.bidIncrement,
    timerSeconds: tournament.timerSeconds,
    status: tournament.status,
    createdAt: tournament.createdAt.toISOString(),
  });
});

router.delete("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.status(204).send();
});

export default router;
