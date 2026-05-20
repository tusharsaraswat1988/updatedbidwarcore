import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

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

export default router;
