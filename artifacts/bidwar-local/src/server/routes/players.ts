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
    const updates: Record<string, unknown> = {};
    const allowed = ["name","categoryId","teamId","role","city","basePrice","soldPrice",
      "retainedPrice","status","jerseyNumber","photoUrl","achievements","mobileNumber",
      "battingStyle","bowlingStyle","specialization","cricheroUrl","availabilityDates"];
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updatedAt = new Date().toISOString();
    const [row] = await db.update(playersTable).set(updates)
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
