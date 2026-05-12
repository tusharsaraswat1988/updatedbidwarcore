import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { teamsTable } from "@workspace/db-local";

const teamToJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id, tournamentId: t.tournamentId, name: t.name, shortCode: t.shortCode,
  ownerName: t.ownerName, ownerMobile: t.ownerMobile, color: t.color, logoUrl: t.logoUrl,
  purse: t.purse, purseUsed: t.purseUsed, isBiddingEnabled: t.isBiddingEnabled,
  accessCode: t.accessCode, cloudId: t.cloudId, createdAt: t.createdAt,
});

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
    const [row] = await db.insert(teamsTable).values({
      tournamentId: tid, name: d.name, shortCode: d.shortCode, ownerName: d.ownerName,
      ownerMobile: d.ownerMobile ?? null, color: d.color ?? "#3B82F6",
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
    const updates: Record<string, unknown> = {};
    const allowed = ["name","shortCode","ownerName","ownerMobile","color","logoUrl","purse",
      "purseUsed","isBiddingEnabled","accessCode"];
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updatedAt = new Date().toISOString();
    const [row] = await db.update(teamsTable).set(updates)
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
