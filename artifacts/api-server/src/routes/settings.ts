import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { z } from "zod";
import { isScoringFeatureEnabled } from "../lib/scoring-feature";
import {
  getPlatformDefaultAudioCached,
  readPlatformDefaultAudio,
  writePlatformDefaultAudio,
} from "../lib/platform-audio-defaults";
import { commitBatchCloudinaryImageWrites } from "../lib/cloudinary-media-service";
import { type ImageFieldChange } from "../lib/cloudinary-image-fields";
import { parseCloudinaryPublicIdFromUrl } from "@workspace/api-base/cloudinary-media";

const router = Router();

router.get("/settings/features", (_req, res) => {
  const scoring = isScoringFeatureEnabled();
  res.json({
    scoring,
    /** Same platform gate — kept for older clients */
    badminton: scoring,
    cricket: scoring,
  });
});

// ─── Installer URL settings ───────────────────────────────────────────────────

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

async function upsertKey(key: string, value: string | null | undefined) {
  if (value === undefined) return;
  if (value === null || value === "") {
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
  } else {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
  }
}

// Public: read installer URL + version
router.get("/settings/installer-url", async (_req, res) => {
  const data = await readInstallerSettings();
  res.json(data);
});

// Admin: update installer URL + version
const updateInstallerSchema = z.object({
  url: z.string().url().nullable().optional(),
  version: z.string().nullable().optional(),
  releasedAt: z.string().nullable().optional(),
});

router.patch("/auth/admin/settings/installer-url", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const parsed = updateInstallerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { url, version, releasedAt } = parsed.data;
  await upsertKey("installer_url", url);
  await upsertKey("installer_version", version);
  await upsertKey("installer_released_at", releasedAt);

  const data = await readInstallerSettings();
  res.json(data);
});

// ─── GitHub CI config ─────────────────────────────────────────────────────────

const GITHUB_KEYS = ["github_owner", "github_repo", "github_workflow_file"] as const;

async function readGithubConfig() {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...GITHUB_KEYS]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  return {
    owner: map["github_owner"] ?? null,
    repo: map["github_repo"] ?? null,
    workflowFile: map["github_workflow_file"] ?? "build-electron.yml",
  };
}

// Admin: read GitHub config
router.get("/auth/admin/builds/github-config", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  res.json(await readGithubConfig());
});

// Admin: update GitHub config
const updateGithubSchema = z.object({
  owner: z.string().nullable().optional(),
  repo: z.string().nullable().optional(),
  workflowFile: z.string().nullable().optional(),
});

router.patch("/auth/admin/builds/github-config", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  const parsed = updateGithubSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  await upsertKey("github_owner", parsed.data.owner);
  await upsertKey("github_repo", parsed.data.repo);
  await upsertKey("github_workflow_file", parsed.data.workflowFile);
  res.json(await readGithubConfig());
});

// ─── Build trigger ────────────────────────────────────────────────────────────

const triggerSchema = z.object({
  version: z.string().optional(),
});

router.post("/auth/admin/builds/trigger", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { owner, repo, workflowFile } = await readGithubConfig();
  const pat = process.env.GITHUB_PAT;

  if (!owner || !repo) {
    res.status(400).json({ error: "GitHub owner and repo not configured in admin settings" });
    return;
  }
  if (!pat) {
    res.status(500).json({ error: "GITHUB_PAT secret is not set in environment" });
    return;
  }

  const version = parsed.data.version?.trim() || "1.0.0";
  const workflow = workflowFile || "build-electron.yml";

  const ghRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { version } }),
    },
  );

  if (!ghRes.ok) {
    const detail = await ghRes.text();
    res.status(502).json({ error: "GitHub API error", detail });
    return;
  }

  res.json({
    ok: true,
    version,
    actionsUrl: `https://github.com/${owner}/${repo}/actions`,
  });
});

// ─── Build status ─────────────────────────────────────────────────────────────

interface GithubRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  head_sha: string;
  display_title: string;
}

interface GithubRunsResponse {
  workflow_runs: GithubRun[];
}

router.get("/auth/admin/builds/status", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const { owner, repo, workflowFile } = await readGithubConfig();
  const pat = process.env.GITHUB_PAT;

  if (!owner || !repo || !pat) {
    res.json({ configured: false });
    return;
  }

  const workflow = workflowFile || "build-electron.yml";
  const ghRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!ghRes.ok) {
    res.json({ configured: true, error: "Failed to fetch build status from GitHub" });
    return;
  }

  const data = (await ghRes.json()) as GithubRunsResponse;
  const runs = data.workflow_runs ?? [];
  const latest = runs[0] ?? null;

  if (!latest) {
    res.json({ configured: true, hasRuns: false });
    return;
  }

  res.json({
    configured: true,
    hasRuns: true,
    id: latest.id,
    status: latest.status,
    conclusion: latest.conclusion,
    url: latest.html_url,
    createdAt: latest.created_at,
    title: latest.display_title,
    actionsUrl: `https://github.com/${owner}/${repo}/actions`,
  });
});

// ─── Admin session lock ───────────────────────────────────────────────────────

const SESSION_LOCK_KEY = "admin_session_lock_minutes";
const DEFAULT_LOCK_MINUTES = 10;
const WARNING_SECONDS = 90;

async function readSessionLockSettings() {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, SESSION_LOCK_KEY))
    .limit(1);

  const parsed = row?.value ? Number.parseInt(row.value, 10) : DEFAULT_LOCK_MINUTES;
  const lockMinutes = Number.isFinite(parsed) && parsed >= 10 && parsed <= 120
    ? parsed
    : DEFAULT_LOCK_MINUTES;

  return { lockMinutes, warningSeconds: WARNING_SECONDS };
}

router.get("/auth/admin/settings/session-lock", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  res.json(await readSessionLockSettings());
});

const updateSessionLockSchema = z.object({
  lockMinutes: z.coerce.number().int().min(10).max(120),
});

router.patch("/auth/admin/settings/session-lock", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  if (req.jwtUser.adminLevel !== "master") {
    res.status(403).json({ error: "Master admin required" });
    return;
  }

  const parsed = updateSessionLockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Idle minutes must be between 10 and 120" });
    return;
  }

  await upsertKey(SESSION_LOCK_KEY, String(parsed.data.lockMinutes));
  res.json(await readSessionLockSettings());
});

// ─── Platform default broadcast audio ────────────────────────────────────────

const audioUrlField = z.string().nullable().optional();

const updatePlatformAudioSchema = z.object({
  countdownSoundUrl: audioUrlField,
  soldSoundUrl: audioUrlField,
  breakEndMusicUrl: audioUrlField,
});

router.get("/settings/default-audio", async (_req, res) => {
  res.json(await getPlatformDefaultAudioCached());
});

router.get("/auth/admin/settings/default-audio", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  res.json(await readPlatformDefaultAudio());
});

router.patch("/auth/admin/settings/default-audio", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const parsed = updatePlatformAudioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = await writePlatformDefaultAudio(parsed.data);
  res.json(data);
});

// ─── Buzz Studio Creative Assets ──────────────────────────────────────────────
//
// Global poster background images, keyed by aspect ratio.
// Stored in settingsTable as: buzz_studio_bg_1:1, buzz_studio_bg_4:5, etc.
// Admin-only write. Public read (backgrounds are embedded in poster exports).

const BUZZ_BG_KEYS = {
  "1:1":  "buzz_studio_bg_1:1",
  "4:5":  "buzz_studio_bg_4:5",
  "9:16": "buzz_studio_bg_9:16",
  "16:9": "buzz_studio_bg_16:9",
} as const;

const BUZZ_BG_PUBLIC_ID_KEYS = {
  "1:1":  "buzz_studio_bg_1:1_public_id",
  "4:5":  "buzz_studio_bg_4:5_public_id",
  "9:16": "buzz_studio_bg_9:16_public_id",
  "16:9": "buzz_studio_bg_16:9_public_id",
} as const;

type BuzzAspectRatioKey = keyof typeof BUZZ_BG_KEYS;

const BUZZ_ASPECT_RATIOS: BuzzAspectRatioKey[] = ["1:1", "4:5", "9:16", "16:9"];

const buzzPublicIdsSchema = z.object({
  "1:1": z.string().nullable().optional(),
  "4:5": z.string().nullable().optional(),
  "9:16": z.string().nullable().optional(),
  "16:9": z.string().nullable().optional(),
}).optional();

/** Returns a flat map of aspect ratio → background URL (or null). */
async function readBuzzStudioAssets(): Promise<Record<BuzzAspectRatioKey, string | null>> {
  const keys = Object.values(BUZZ_BG_KEYS);
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, keys));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  return {
    "1:1":  map[BUZZ_BG_KEYS["1:1"]]  ?? null,
    "4:5":  map[BUZZ_BG_KEYS["4:5"]]  ?? null,
    "9:16": map[BUZZ_BG_KEYS["9:16"]] ?? null,
    "16:9": map[BUZZ_BG_KEYS["16:9"]] ?? null,
  };
}

async function readBuzzStudioAssetKeys(
  urlKeys: Record<BuzzAspectRatioKey, string>,
  publicIdKeys: Record<BuzzAspectRatioKey, string>,
): Promise<{
  urls: Record<BuzzAspectRatioKey, string | null>;
  publicIds: Record<BuzzAspectRatioKey, string | null>;
}> {
  const keys = [...Object.values(urlKeys), ...Object.values(publicIdKeys)];
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, keys));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  const urls = {} as Record<BuzzAspectRatioKey, string | null>;
  const publicIds = {} as Record<BuzzAspectRatioKey, string | null>;
  for (const ratio of BUZZ_ASPECT_RATIOS) {
    urls[ratio] = map[urlKeys[ratio]] ?? null;
    publicIds[ratio] = map[publicIdKeys[ratio]] ?? null;
  }
  return { urls, publicIds };
}

async function patchBuzzStudioAssetSet(options: {
  urlKeys: Record<BuzzAspectRatioKey, string>;
  publicIdKeys: Record<BuzzAspectRatioKey, string>;
  data: Partial<Record<BuzzAspectRatioKey, string | null>>;
  publicIds?: Partial<Record<BuzzAspectRatioKey, string | null>>;
  logger?: { error?: (obj: unknown, msg?: string) => void; warn?: (obj: unknown, msg?: string) => void };
  context: Record<string, unknown>;
}): Promise<void> {
  const { urls: currentUrls, publicIds: currentPublicIds } = await readBuzzStudioAssetKeys(
    options.urlKeys,
    options.publicIdKeys,
  );

  const imageChanges: ImageFieldChange[] = [];
  const pending: Partial<Record<BuzzAspectRatioKey, { url: string | null; publicId: string | null }>> = {};

  for (const ratio of BUZZ_ASPECT_RATIOS) {
    if (options.data[ratio] === undefined && options.publicIds?.[ratio] === undefined) continue;

    const nextUrl = options.data[ratio] !== undefined
      ? (options.data[ratio] ?? null)
      : currentUrls[ratio];
    const nextPublicId = options.publicIds?.[ratio] !== undefined
      ? (options.publicIds[ratio] ?? null)
      : options.data[ratio] !== undefined
        ? parseCloudinaryPublicIdFromUrl(options.data[ratio] ?? null)
        : currentPublicIds[ratio];

    pending[ratio] = { url: nextUrl, publicId: nextPublicId };
    imageChanges.push({
      label: ratio,
      previous: { url: currentUrls[ratio], publicId: currentPublicIds[ratio] },
      next: { url: nextUrl, publicId: nextPublicId },
    });
  }

  if (imageChanges.length === 0) {
    return;
  }

  await commitBatchCloudinaryImageWrites({
    changes: imageChanges,
    persist: async () => {
      for (const ratio of BUZZ_ASPECT_RATIOS) {
        const next = pending[ratio];
        if (!next) continue;
        await upsertKey(options.urlKeys[ratio], next.url);
        await upsertKey(options.publicIdKeys[ratio], next.publicId);
      }
    },
    logger: options.logger,
    context: options.context,
  });
}

// GET /settings/buzz-studio-assets — public read (needed by preview & export)
router.get("/settings/buzz-studio-assets", async (_req, res) => {
  res.json(await readBuzzStudioAssets());
});

// GET /auth/admin/settings/buzz-studio-assets — admin read
router.get("/auth/admin/settings/buzz-studio-assets", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  res.json(await readBuzzStudioAssets());
});

const updateBuzzStudioAssetsSchema = z.object({
  "1:1":  z.string().url().nullable().optional(),
  "4:5":  z.string().url().nullable().optional(),
  "9:16": z.string().url().nullable().optional(),
  "16:9": z.string().url().nullable().optional(),
  publicIds: buzzPublicIdsSchema,
});

// PATCH /auth/admin/settings/buzz-studio-assets — admin write
router.patch("/auth/admin/settings/buzz-studio-assets", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const parsed = updateBuzzStudioAssetsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = parsed.data;
  await patchBuzzStudioAssetSet({
    urlKeys: BUZZ_BG_KEYS,
    publicIdKeys: BUZZ_BG_PUBLIC_ID_KEYS,
    data,
    publicIds: data.publicIds,
    logger: req.log,
    context: { route: "settings.buzzStudioAssets" },
  });

  res.json(await readBuzzStudioAssets());
});

// ─── Top Buys template backgrounds (separate from global) ───────────────────

const updateTopBuysTemplateAssetsSchema = z.object({
  "1:1":  z.string().url().nullable().optional(),
  "4:5":  z.string().url().nullable().optional(),
  "9:16": z.string().url().nullable().optional(),
  "16:9": z.string().url().nullable().optional(),
  publicIds: buzzPublicIdsSchema,
});

// GET /settings/buzz-studio-template-assets/top-buys — public read
router.get("/settings/buzz-studio-template-assets/top-buys", async (_req, res) => {
  const { readTopBuysTemplateAssets } = await import("../lib/buzz-studio-assets.js");
  res.json(await readTopBuysTemplateAssets());
});

// GET /auth/admin/settings/buzz-studio-template-assets/top-buys
router.get("/auth/admin/settings/buzz-studio-template-assets/top-buys", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }
  const { readTopBuysTemplateAssets } = await import("../lib/buzz-studio-assets.js");
  res.json(await readTopBuysTemplateAssets());
});

// PATCH /auth/admin/settings/buzz-studio-template-assets/top-buys
router.patch("/auth/admin/settings/buzz-studio-template-assets/top-buys", async (req, res) => {
  if (!req.jwtUser.isAdmin) {
    res.status(403).json({ error: "Admin required" });
    return;
  }

  const parsed = updateTopBuysTemplateAssetsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { TOP_BUYS_TEMPLATE_BG_KEYS, TOP_BUYS_TEMPLATE_BG_PUBLIC_ID_KEYS, readTopBuysTemplateAssets } = await import("../lib/buzz-studio-assets.js");
  const data = parsed.data;
  await patchBuzzStudioAssetSet({
    urlKeys: TOP_BUYS_TEMPLATE_BG_KEYS,
    publicIdKeys: TOP_BUYS_TEMPLATE_BG_PUBLIC_ID_KEYS,
    data,
    publicIds: data.publicIds,
    logger: req.log,
    context: { route: "settings.topBuysTemplateAssets" },
  });

  res.json(await readTopBuysTemplateAssets());
});

export default router;
