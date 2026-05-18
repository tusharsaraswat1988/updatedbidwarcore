import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { playersTable } from "@workspace/db-local";

const playerToJson = (p: typeof playersTable.$inferSelect) => ({
  id: p.id, tournamentId: p.tournamentId, categoryId: p.categoryId, teamId: p.teamId,
  name: p.name, city: p.city, role: p.role, battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle, specialization: p.specialization, age: p.age,
  photoUrl: p.photoUrl, basePrice: p.basePrice, soldPrice: p.soldPrice,
  retainedPrice: p.retainedPrice, status: p.status, jerseyNumber: p.jerseyNumber,
  achievements: p.achievements, mobileNumber: p.mobileNumber, cricheroUrl: p.cricheroUrl,
  availabilityDates: p.availabilityDates, cloudId: p.cloudId, createdAt: p.createdAt,
});

export function createPlayersRouter(db: LocalDb) {
  const router = Router();

  router.get("/tournaments/:tournamentId/players", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const rows = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tid));
    res.json(rows.map(playerToJson));
  });

  router.post("/tournaments/:tournamentId/players", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1), categoryId: z.number().int().optional(),
      role: z.string().optional(), city: z.string().optional(),
      basePrice: z.number().int().optional(), status: z.string().optional(),
      jerseyNumber: z.string().optional(), photoUrl: z.string().optional(),
      mobileNumber: z.string().optional(), battingStyle: z.string().optional(),
      bowlingStyle: z.string().optional(), specialization: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    const [row] = await db.insert(playersTable).values({
      tournamentId: tid, name: d.name, categoryId: d.categoryId ?? null,
      role: d.role ?? null, city: d.city ?? null,
      basePrice: d.basePrice ?? 100000, status: d.status ?? "available",
      jerseyNumber: d.jerseyNumber ?? null, photoUrl: d.photoUrl ?? null,
      mobileNumber: d.mobileNumber ?? null, battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null, specialization: d.specialization ?? null,
    }).returning();
    res.status(201).json(playerToJson(row));
  });

  router.get("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const pid = parseInt(req.params.playerId);
    if (isNaN(tid) || isNaN(pid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.select().from(playersTable)
      .where(and(eq(playersTable.id, pid), eq(playersTable.tournamentId, tid)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(playerToJson(row));
  });

  router.patch("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const pid = parseInt(req.params.playerId);
    if (isNaN(tid) || isNaN(pid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      categoryId: z.number().int().nullable().optional(),
      teamId: z.number().int().nullable().optional(),
      role: z.string().max(60).nullable().optional(),
      city: z.string().max(80).nullable().optional(),
      basePrice: z.number().int().min(0).optional(),
      soldPrice: z.number().int().min(0).nullable().optional(),
      retainedPrice: z.number().int().min(0).nullable().optional(),
      status: z.enum(["available","sold","unsold","retained"]).optional(),
      jerseyNumber: z.string().max(10).nullable().optional(),
      photoUrl: z.string().url().nullable().optional(),
      achievements: z.string().max(500).nullable().optional(),
      mobileNumber: z.string().max(20).nullable().optional(),
      battingStyle: z.string().max(60).nullable().optional(),
      bowlingStyle: z.string().max(60).nullable().optional(),
      specialization: z.string().max(60).nullable().optional(),
      cricheroUrl: z.string().url().nullable().optional(),
      availabilityDates: z.string().max(200).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    if (Object.keys(d).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [row] = await db.update(playersTable).set({ ...d, updatedAt: new Date().toISOString() })
      .where(and(eq(playersTable.id, pid), eq(playersTable.tournamentId, tid))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(playerToJson(row));
  });

  router.delete("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const pid = parseInt(req.params.playerId);
    if (isNaN(tid) || isNaN(pid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(playersTable).where(
      and(eq(playersTable.id, pid), eq(playersTable.tournamentId, tid))
    );
    res.status(204).send();
  });

  return router;
}
