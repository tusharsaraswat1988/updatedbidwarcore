import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { showcaseEventsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { commitBatchCloudinaryImageWrites, destroyCloudinaryAssetSafe } from "../lib/cloudinary-media-service";
import { queueImageFieldChange, type ImageFieldChange } from "../lib/cloudinary-image-fields";
import { resolveCloudinaryPublicId } from "@workspace/api-base/cloudinary-media";
import { showcaseService } from "../lib/showcase-service.js";
import { invalidateHomepagePageCache } from "../lib/homepage-data.js";

const router = Router();

function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.jwtUser?.isAdmin && req.jwtUser?.adminLevel === "master") { next(); return; }
  res.status(403).json({ error: "Master admin access required" });
}

const createSchema = z.object({
  imageUrl: z.string().url(),
  imagePublicId: z.string().optional().nullable(),
  sportName: z.string().min(1).max(60),
  tournamentName: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  altText: z.string().max(200).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()),
});

router.get("/showcase-events", async (_req, res) => {
  const rows = await showcaseService.listActive();
  res.json(rows);
});

router.get("/auth/admin/showcase-events", requireMasterAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(showcaseEventsTable)
    .orderBy(asc(showcaseEventsTable.displayOrder), asc(showcaseEventsTable.createdAt));
  res.json(rows);
});

router.post("/auth/admin/showcase-events", requireMasterAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const [row] = await db.insert(showcaseEventsTable).values({
    ...parsed.data,
    imagePublicId: parsed.data.imagePublicId ?? null,
  }).returning();
  invalidateHomepagePageCache();
  res.status(201).json(row);
});

router.post("/auth/admin/showcase-events/reorder", requireMasterAdmin, async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid ids" }); return; }
  await Promise.all(
    parsed.data.ids.map((id, i) =>
      db
        .update(showcaseEventsTable)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(eq(showcaseEventsTable.id, id)),
    ),
  );
  invalidateHomepagePageCache();
  res.json({ ok: true });
});

router.patch("/auth/admin/showcase-events/:id", requireMasterAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const [existing] = await db
    .select()
    .from(showcaseEventsTable)
    .where(eq(showcaseEventsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const imageChanges: ImageFieldChange[] = [];
  queueImageFieldChange(imageChanges, updates, {
    label: "imageUrl",
    urlKey: "imageUrl",
    publicIdKey: "imagePublicId",
    existing: { url: existing.imageUrl, publicId: existing.imagePublicId },
    nextUrl: parsed.data.imageUrl,
    nextPublicId: parsed.data.imagePublicId,
  });
  if (parsed.data.sportName !== undefined) updates.sportName = parsed.data.sportName;
  if (parsed.data.tournamentName !== undefined) updates.tournamentName = parsed.data.tournamentName;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.altText !== undefined) updates.altText = parsed.data.altText;
  if (parsed.data.displayOrder !== undefined) updates.displayOrder = parsed.data.displayOrder;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  let row!: typeof showcaseEventsTable.$inferSelect;
  const persistShowcaseUpdate = async () => {
    const [updated] = await db
      .update(showcaseEventsTable)
      .set(updates)
      .where(eq(showcaseEventsTable.id, id))
      .returning();
    if (!updated) throw new Error("SHOWCASE_NOT_FOUND");
    row = updated;
  };

  if (imageChanges.length > 0) {
    await commitBatchCloudinaryImageWrites({
      changes: imageChanges,
      persist: persistShowcaseUpdate,
      logger: req.log,
      context: { route: "showcase.patch", showcaseEventId: id },
    });
  } else {
    await persistShowcaseUpdate();
  }
  invalidateHomepagePageCache();
  res.json(row);
});

router.delete("/auth/admin/showcase-events/:id", requireMasterAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db
    .select()
    .from(showcaseEventsTable)
    .where(eq(showcaseEventsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const publicId = resolveCloudinaryPublicId({
    url: existing.imageUrl,
    publicId: existing.imagePublicId,
  });
  if (publicId) {
    await destroyCloudinaryAssetSafe(publicId, req.log, {
      route: "showcase.delete",
      showcaseEventId: id,
    });
  }

  await db.delete(showcaseEventsTable).where(eq(showcaseEventsTable.id, id));
  invalidateHomepagePageCache();
  res.status(204).end();
});

export default router;
