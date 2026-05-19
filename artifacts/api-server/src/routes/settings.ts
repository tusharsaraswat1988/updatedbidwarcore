import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const INSTALLER_KEYS = ["installer_url", "installer_version", "installer_released_at"] as const;

async function readInstallerSettings() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...INSTALLER_KEYS]));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  return {
    url: map["installer_url"] ?? null,
    version: map["installer_version"] ?? null,
    releasedAt: map["installer_released_at"] ?? null,
  };
}

// ─── Public: read installer URL + version ─────────────────────────────────────

router.get("/settings/installer-url", async (_req, res) => {
  const data = await readInstallerSettings();
  res.json(data);
});

// ─── Admin: update installer URL + version ────────────────────────────────────

const updateSchema = z.object({
  url: z.string().url().nullable().optional(),
  version: z.string().nullable().optional(),
  releasedAt: z.string().nullable().optional(),
});

router.patch("/auth/admin/settings/installer-url", async (req, res) => {
  if (!req.session.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { url, version, releasedAt } = parsed.data;

  const upsert = async (key: string, value: string | null | undefined) => {
    if (value === undefined) return;
    if (value === null || value === "") {
      await db.delete(settingsTable).where(eq(settingsTable.key, key));
    } else {
      await db
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    }
  };

  await upsert("installer_url", url);
  await upsert("installer_version", version);
  await upsert("installer_released_at", releasedAt);

  const data = await readInstallerSettings();
  res.json(data);
});

export default router;
