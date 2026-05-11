import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

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
  age: p.age,
  photoUrl: p.photoUrl,
  basePrice: p.basePrice,
  soldPrice: p.soldPrice,
  status: p.status,
  jerseyNumber: p.jerseyNumber,
  achievements: p.achievements,
  createdAt: p.createdAt.toISOString(),
});

router.get("/tournaments/:tournamentId/players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid))
    .orderBy(playersTable.createdAt);
  res.json(players.map(playerToJson));
});

router.post("/tournaments/:tournamentId/players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    categoryId: z.number().int().optional(),
    name: z.string().min(1),
    city: z.string().optional(),
    role: z.string().optional(),
    battingStyle: z.string().optional(),
    bowlingStyle: z.string().optional(),
    age: z.number().int().optional(),
    photoUrl: z.string().optional(),
    basePrice: z.number().int(),
    jerseyNumber: z.string().optional(),
    achievements: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const [player] = await db
    .insert(playersTable)
    .values({
      tournamentId: tid,
      categoryId: d.categoryId ?? null,
      name: d.name,
      city: d.city ?? null,
      role: d.role ?? null,
      battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null,
      age: d.age ?? null,
      photoUrl: d.photoUrl ?? null,
      basePrice: d.basePrice,
      jerseyNumber: d.jerseyNumber ?? null,
      achievements: d.achievements ?? null,
      status: "available",
    })
    .returning();
  res.status(201).json(playerToJson(player));
});

router.get("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  res.json(playerToJson(player));
});

router.patch("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    categoryId: z.number().int().optional(),
    name: z.string().optional(),
    city: z.string().optional(),
    role: z.string().optional(),
    battingStyle: z.string().optional(),
    bowlingStyle: z.string().optional(),
    age: z.number().int().optional(),
    photoUrl: z.string().optional(),
    basePrice: z.number().int().optional(),
    jerseyNumber: z.string().optional(),
    achievements: z.string().optional(),
    status: z.string().optional(),
    teamId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.categoryId !== undefined) updates.categoryId = d.categoryId;
  if (d.name !== undefined) updates.name = d.name;
  if (d.city !== undefined) updates.city = d.city;
  if (d.role !== undefined) updates.role = d.role;
  if (d.battingStyle !== undefined) updates.battingStyle = d.battingStyle;
  if (d.bowlingStyle !== undefined) updates.bowlingStyle = d.bowlingStyle;
  if (d.age !== undefined) updates.age = d.age;
  if (d.photoUrl !== undefined) updates.photoUrl = d.photoUrl;
  if (d.basePrice !== undefined) updates.basePrice = d.basePrice;
  if (d.jerseyNumber !== undefined) updates.jerseyNumber = d.jerseyNumber;
  if (d.achievements !== undefined) updates.achievements = d.achievements;
  if (d.status !== undefined) updates.status = d.status;
  if (d.teamId !== undefined) updates.teamId = d.teamId;
  const [player] = await db
    .update(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)))
    .set(updates)
    .returning();
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  res.json(playerToJson(player));
});

router.delete("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  res.status(204).send();
});

export default router;
