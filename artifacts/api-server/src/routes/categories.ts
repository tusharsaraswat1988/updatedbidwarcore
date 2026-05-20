import { Router } from "express";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const catToJson = (c: typeof categoriesTable.$inferSelect) => ({
  id: c.id,
  tournamentId: c.tournamentId,
  name: c.name,
  minBid: c.minBid,
  bidIncrement: c.bidIncrement,
  bidTiers: c.bidTiers,
  maxPlayers: c.maxPlayers,
  colorCode: c.colorCode,
  sortOrder: c.sortOrder,
  createdAt: c.createdAt.toISOString(),
});

router.get("/tournaments/:tournamentId/categories", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.tournamentId, tid))
    .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
  res.json(categories.map(catToJson));
});

router.post("/tournaments/:tournamentId/categories", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const schema = z.object({
    name: z.string().min(1),
    minBid: z.number().int().nullable().optional(),
    bidIncrement: z.number().int().nullable().optional(),
    bidTiers: z.string().nullable().optional(),
    maxPlayers: z.number().int().nullable().optional(),
    colorCode: z.string().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const [cat] = await db
    .insert(categoriesTable)
    .values({
      tournamentId: tid,
      name: d.name,
      minBid: d.minBid ?? null,
      bidIncrement: d.bidIncrement ?? null,
      bidTiers: d.bidTiers ?? null,
      maxPlayers: d.maxPlayers ?? null,
      colorCode: d.colorCode ?? "#F59E0B",
      sortOrder: d.sortOrder ?? 0,
    })
    .returning();
  res.status(201).json(catToJson(cat));
});

router.patch("/tournaments/:tournamentId/categories/:categoryId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const catId = parseInt(req.params.categoryId);
  if (isNaN(tid) || isNaN(catId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    minBid: z.number().int().nullable().optional(),
    bidIncrement: z.number().int().nullable().optional(),
    bidTiers: z.string().nullable().optional(),
    maxPlayers: z.number().int().nullable().optional(),
    colorCode: z.string().optional(),
    sortOrder: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.bidIncrement !== undefined) updates.bidIncrement = d.bidIncrement;
  if (d.bidTiers !== undefined) updates.bidTiers = d.bidTiers;
  if (d.maxPlayers !== undefined) updates.maxPlayers = d.maxPlayers;
  if (d.colorCode !== undefined) updates.colorCode = d.colorCode;
  if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
  const [cat] = await db
    .update(categoriesTable)
    .set(updates)
    .where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid)))
    .returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(catToJson(cat));
});

router.delete("/tournaments/:tournamentId/categories/:categoryId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const catId = parseInt(req.params.categoryId);
  if (isNaN(tid) || isNaN(catId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, catId), eq(categoriesTable.tournamentId, tid)));
  res.status(204).send();
});

export default router;
