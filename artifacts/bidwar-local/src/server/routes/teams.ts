import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { teamsTable } from "@workspace/db-local";
import { parseIndianMobile } from "@workspace/api-base/mobile";

const teamToJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id, tournamentId: t.tournamentId, name: t.name, shortCode: t.shortCode,
  ownerName: t.ownerName, ownerMobile: t.ownerMobile, color: t.color, logoUrl: t.logoUrl,
  purse: t.purse, purseUsed: t.purseUsed, isBiddingEnabled: t.isBiddingEnabled,
  accessCode: t.accessCode, cloudId: t.cloudId, createdAt: t.createdAt,
});

const DUPLICATE_OWNER_MOBILE_ERROR =
  "This mobile number is already assigned to another team in this tournament.";

async function findDuplicateOwnerMobileTeam(
  db: LocalDb,
  tournamentId: number,
  normalizedMobile: string,
  excludeTeamId?: number,
) {
  const teams = await db
    .select({ id: teamsTable.id, ownerMobile: teamsTable.ownerMobile })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  for (const team of teams) {
    if (excludeTeamId !== undefined && team.id === excludeTeamId) continue;
    if (!team.ownerMobile) continue;
    const other = parseIndianMobile(team.ownerMobile);
    if (other.ok && other.normalized === normalizedMobile) return team;
  }
  return null;
}

export function createTeamsRouter(db: LocalDb) {
  const router = Router();

  router.get("/tournaments/:tournamentId/teams", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const rows = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
    res.json(rows.map(teamToJson));
  });

  router.post("/tournaments/:tournamentId/teams", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1), shortCode: z.string().min(1), ownerName: z.string().min(1),
      ownerMobile: z.string().optional(), color: z.string().optional(),
      logoUrl: z.string().optional(), purse: z.number().int().optional(),
      accessCode: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    let ownerMobile: string | null = null;
    if (d.ownerMobile) {
      const mobileParsed = parseIndianMobile(d.ownerMobile);
      if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
      ownerMobile = mobileParsed.normalized;
      const dupMobile = await findDuplicateOwnerMobileTeam(db, tid, ownerMobile);
      if (dupMobile) {
        res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
        return;
      }
    }
    const [row] = await db.insert(teamsTable).values({
      tournamentId: tid, name: d.name, shortCode: d.shortCode, ownerName: d.ownerName,
      ownerMobile, color: d.color ?? "#3B82F6",
      logoUrl: d.logoUrl ?? null, purse: d.purse ?? 10000000, accessCode: d.accessCode ?? null,
    }).returning();
    res.status(201).json(teamToJson(row));
  });

  router.get("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.select().from(teamsTable).where(
      and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid))
    );
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(teamToJson(row));
  });

  router.patch("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      shortCode: z.string().min(1).max(10).optional(),
      ownerName: z.string().min(1).max(120).optional(),
      ownerMobile: z.string().max(20).nullable().optional(),
      color: z.string().max(20).optional(),
      logoUrl: z.string().url().nullable().optional(),
      purse: z.number().int().min(0).optional(),
      purseUsed: z.number().int().min(0).optional(),
      isBiddingEnabled: z.boolean().optional(),
      accessCode: z.string().max(20).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    if (Object.keys(d).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const patch = { ...d };
    if (d.ownerMobile !== undefined && d.ownerMobile !== null) {
      const mobileParsed = parseIndianMobile(d.ownerMobile);
      if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
      patch.ownerMobile = mobileParsed.normalized;
      const dupMobile = await findDuplicateOwnerMobileTeam(db, tid, mobileParsed.normalized, teamId);
      if (dupMobile) {
        res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
        return;
      }
    }
    const [row] = await db.update(teamsTable).set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(teamToJson(row));
  });

  router.delete("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(teamsTable).where(
      and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid))
    );
    res.status(204).send();
  });

  return router;
}
