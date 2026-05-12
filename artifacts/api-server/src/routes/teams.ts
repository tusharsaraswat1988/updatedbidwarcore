import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function genAccessCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const teamToJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id,
  tournamentId: t.tournamentId,
  name: t.name,
  shortCode: t.shortCode,
  ownerName: t.ownerName,
  ownerMobile: t.ownerMobile,
  color: t.color,
  logoUrl: t.logoUrl,
  purse: t.purse,
  purseUsed: t.purseUsed,
  isBiddingEnabled: t.isBiddingEnabled,
  accessCode: t.accessCode,
  createdAt: t.createdAt.toISOString(),
});

router.get("/tournaments/:tournamentId/teams", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid))
    .orderBy(teamsTable.createdAt);
  res.json(teams.map(teamToJson));
});

router.post("/tournaments/:tournamentId/teams", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    name: z.string().min(1),
    shortCode: z.string().min(1).max(5),
    ownerName: z.string().min(1),
    ownerMobile: z.string().optional(),
    color: z.string().optional(),
    logoUrl: z.string().optional(),
    purse: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const [team] = await db
    .insert(teamsTable)
    .values({
      tournamentId: tid,
      name: d.name,
      shortCode: d.shortCode,
      ownerName: d.ownerName,
      ownerMobile: d.ownerMobile ?? null,
      color: d.color ?? "#3B82F6",
      logoUrl: d.logoUrl ?? null,
      purse: d.purse ?? 10000000,
      purseUsed: 0,
      isBiddingEnabled: true,
      accessCode: genAccessCode(),
    })
    .returning();
  res.status(201).json(teamToJson(team));
});

router.get("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  res.json(teamToJson(team));
});

router.patch("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    shortCode: z.string().optional(),
    ownerName: z.string().optional(),
    ownerMobile: z.string().optional(),
    color: z.string().optional(),
    logoUrl: z.string().optional(),
    purse: z.number().int().optional(),
    isBiddingEnabled: z.boolean().optional(),
    regenerateCode: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.shortCode !== undefined) updates.shortCode = d.shortCode;
  if (d.ownerName !== undefined) updates.ownerName = d.ownerName;
  if (d.ownerMobile !== undefined) updates.ownerMobile = d.ownerMobile;
  if (d.color !== undefined) updates.color = d.color;
  if (d.logoUrl !== undefined) updates.logoUrl = d.logoUrl;
  if (d.purse !== undefined) updates.purse = d.purse;
  if (d.isBiddingEnabled !== undefined) updates.isBiddingEnabled = d.isBiddingEnabled;
  if (d.regenerateCode) updates.accessCode = genAccessCode();
  const [team] = await db
    .update(teamsTable)
    .set(updates)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)))
    .returning();
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  res.json(teamToJson(team));
});

// POST verify owner access code
router.post("/tournaments/:tournamentId/teams/:teamId/verify-access", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({ code: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  // If no access code set, any code is accepted (backward compat)
  const valid = !team.accessCode || team.accessCode.toUpperCase() === body.data.code.toUpperCase();
  res.json({ valid });
});

router.delete("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  res.status(204).send();
});

export default router;
