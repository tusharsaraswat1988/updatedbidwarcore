import { Router } from "express";
import { db } from "@workspace/db";
import { brandingSettingsTable } from "@workspace/db/schema";

const router = Router();

// ─── Public: read-only branding settings ──────────────────────────────────────
// Used by useBranding() hook across all public-facing screens.

router.get("/branding", async (_req, res) => {
  const [row] = await db.select().from(brandingSettingsTable).limit(1);
  if (!row) {
    res.json(null);
    return;
  }
  res.json(row);
});

// ─── Admin: read settings ──────────────────────────────────────────────────────

router.get("/auth/admin/branding", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }
  const [row] = await db.select().from(brandingSettingsTable).limit(1);
  if (!row) {
    res.json(null);
    return;
  }
  res.json(row);
});

// ─── Admin: upsert settings ────────────────────────────────────────────────────

router.put("/auth/admin/branding", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const d = req.body as Partial<typeof brandingSettingsTable.$inferInsert>;

  const [existing] = await db.select({ id: brandingSettingsTable.id }).from(brandingSettingsTable).limit(1);

  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(brandingSettingsTable)
      .set({ ...d, updatedAt: now })
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(brandingSettingsTable)
      .values({ ...d, updatedAt: now })
      .returning();
    res.json(created);
  }
});

export default router;
