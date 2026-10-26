import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { commitBatchCloudinaryImageWrites, destroyCloudinaryAssetSafe } from "../lib/cloudinary-media-service";
import { queueImageFieldChange, type ImageFieldChange } from "../lib/cloudinary-image-fields";
import { clientsService } from "../lib/clients-service.js";
import { invalidateHomepagePageCache } from "../lib/homepage-data.js";

const router = Router();

function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.jwtUser?.isAdmin && req.jwtUser?.adminLevel === "master") {
    next();
    return;
  }
  res.status(403).json({ error: "Master admin access required" });
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  logoUrl: z.string().optional().nullable().or(z.literal("")),
  logoPublicId: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable().or(z.literal("")),
  clientType: z.enum(["brand", "organisation"]).default("brand"),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()),
});

// Public endpoint for homepage / landing
router.get("/clients", async (_req, res) => {
  try {
    const rows = await clientsService.listActive();
    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to load clients" });
  }
});

// Admin list all
router.get("/auth/admin/clients", requireMasterAdmin, async (_req, res) => {
  try {
    const rows = await clientsService.listAll();
    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to load admin clients" });
  }
});

// Admin create
router.post("/auth/admin/clients", requireMasterAdmin, async (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const [row] = await db
      .insert(clientsTable)
      .values({
        name: parsed.data.name.trim(),
        logoUrl: parsed.data.logoUrl?.trim() || null,
        logoPublicId: parsed.data.logoPublicId || null,
        websiteUrl: parsed.data.websiteUrl?.trim() || null,
        clientType: parsed.data.clientType ?? "brand",
        displayOrder: parsed.data.displayOrder ?? 0,
        active: parsed.data.active ?? true,
      })
      .returning();

    invalidateHomepagePageCache();
    res.status(201).json(row);
  } catch (err: unknown) {
    req.log?.error({ err }, "Failed to create client");
    res.status(500).json({ error: "Failed to create client record" });
  }
});

// Admin reorder
router.post("/auth/admin/clients/reorder", requireMasterAdmin, async (req, res) => {
  try {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ids" });
      return;
    }
    await Promise.all(
      parsed.data.ids.map((id, i) =>
        db
          .update(clientsTable)
          .set({ displayOrder: i, updatedAt: new Date() })
          .where(eq(clientsTable.id, id)),
      ),
    );
    invalidateHomepagePageCache();
    res.json({ ok: true });
  } catch (err: unknown) {
    req.log?.error({ err }, "Failed to reorder clients");
    res.status(500).json({ error: "Failed to reorder clients" });
  }
});

// Admin update
router.patch("/auth/admin/clients/:id", requireMasterAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const [existing] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const imageChanges: ImageFieldChange[] = [];

    if (parsed.data.logoUrl !== undefined || parsed.data.logoPublicId !== undefined) {
      queueImageFieldChange(imageChanges, updates, {
        label: "logoUrl",
        urlKey: "logoUrl",
        publicIdKey: "logoPublicId",
        existing: { url: existing.logoUrl, publicId: existing.logoPublicId },
        nextUrl: parsed.data.logoUrl?.trim() || null,
        nextPublicId: parsed.data.logoPublicId,
      });
    }

    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.websiteUrl !== undefined) updates.websiteUrl = parsed.data.websiteUrl?.trim() || null;
    if (parsed.data.clientType !== undefined) updates.clientType = parsed.data.clientType;
    if (parsed.data.displayOrder !== undefined) updates.displayOrder = parsed.data.displayOrder;
    if (parsed.data.active !== undefined) updates.active = parsed.data.active;

    let row: typeof clientsTable.$inferSelect | null = null;
    const persistClientUpdate = async () => {
      const [updated] = await db
        .update(clientsTable)
        .set(updates)
        .where(eq(clientsTable.id, id))
        .returning();
      row = updated ?? null;
    };

    if (imageChanges.length > 0) {
      await commitBatchCloudinaryImageWrites({
        changes: imageChanges,
        persist: persistClientUpdate,
        logger: req.log,
        context: { route: "clients.patch", clientId: id },
      });
    } else {
      await persistClientUpdate();
    }

    invalidateHomepagePageCache();
    res.json(row ?? existing);
  } catch (err: unknown) {
    req.log?.error({ err }, "Failed to update client");
    res.status(500).json({ error: "Failed to update client details" });
  }
});

// Admin delete
router.delete("/auth/admin/clients/:id", requireMasterAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .delete(clientsTable)
      .where(eq(clientsTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    if (row.logoPublicId) {
      await destroyCloudinaryAssetSafe(row.logoPublicId, req.log, {
        label: "Client logo delete",
        route: "clients.delete",
        clientId: id,
      });
    }

    invalidateHomepagePageCache();
    res.json({ ok: true, deleted: id });
  } catch (err: unknown) {
    req.log?.error({ err }, "Failed to delete client");
    res.status(500).json({ error: "Failed to delete client" });
  }
});

export default router;
