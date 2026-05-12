import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { categoriesTable } from "@workspace/db-local";

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
    const updates: Record<string, unknown> = {};
    for (const k of ["name","minBid","bidIncrement","maxPlayers","colorCode","sortOrder"]) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    updates.updatedAt = new Date().toISOString();
    const [row] = await db.update(categoriesTable).set(updates)
      .where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(catToJson(row));
  });

  router.delete("/tournaments/:tournamentId/categories/:categoryId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const catId = parseInt(req.params.categoryId);
    if (isNaN(tid) || isNaN(catId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(categoriesTable)
      .where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid)));
    res.status(204).send();
  });

  return router;
}
