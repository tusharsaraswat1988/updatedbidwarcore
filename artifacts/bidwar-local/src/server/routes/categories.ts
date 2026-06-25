import { Router } from "express";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { categoriesTable, playersTable } from "@workspace/db-local";

const catToJson = (c: typeof categoriesTable.$inferSelect) => ({
  id: c.id, tournamentId: c.tournamentId, name: c.name, minBid: c.minBid,
  bidIncrement: c.bidIncrement, maxPlayers: c.maxPlayers, colorCode: c.colorCode,
  sortOrder: c.sortOrder, cloudId: c.cloudId, createdAt: c.createdAt,
});

export function createCategoriesRouter(db: LocalDb) {
  const router = Router();

  router.get("/tournaments/:tournamentId/categories", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const rows = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.tournamentId, tid))
      .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.minBid));
    res.json(rows.map(catToJson));
  });

  router.post("/tournaments/:tournamentId/categories", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1), minBid: z.number().int().optional(),
      bidIncrement: z.number().int().optional(), maxPlayers: z.number().int().optional(),
      colorCode: z.string().optional(), sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    const [row] = await db.insert(categoriesTable).values({
      tournamentId: tid, name: d.name, minBid: d.minBid ?? 100000,
      bidIncrement: d.bidIncrement ?? null, maxPlayers: d.maxPlayers ?? null,
      colorCode: d.colorCode ?? "#F59E0B", sortOrder: d.sortOrder ?? 0,
    }).returning();
    res.status(201).json(catToJson(row));
  });

  router.patch("/tournaments/:tournamentId/categories/:categoryId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const catId = parseInt(req.params.categoryId);
    if (isNaN(tid) || isNaN(catId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1).optional(),
      minBid: z.number().int().min(0).optional(),
      bidIncrement: z.number().int().min(0).nullable().optional(),
      maxPlayers: z.number().int().min(0).nullable().optional(),
      colorCode: z.string().max(20).optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    if (Object.keys(d).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const [row] = await db.update(categoriesTable).set({ ...d, updatedAt: new Date().toISOString() })
      .where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(catToJson(row));
  });

  router.delete("/tournaments/:tournamentId/categories/:categoryId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const catId = parseInt(req.params.categoryId);
    if (isNaN(tid) || isNaN(catId)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [existing] = await db.select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid)));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const [{ assignedCount }] = await db
      .select({ assignedCount: sql<number>`cast(count(*) as int)` })
      .from(playersTable)
      .where(and(eq(playersTable.tournamentId, tid), eq(playersTable.categoryId, catId)));

    if (assignedCount > 0) {
      res.status(409).json({
        error: "This category is assigned to players and cannot be deleted. Reassign or remove those players first.",
        code: "CATEGORY_HAS_PLAYERS",
        playerCount: assignedCount,
      });
      return;
    }

    await db.delete(categoriesTable)
      .where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid)));
    res.status(204).send();
  });

  return router;
}
