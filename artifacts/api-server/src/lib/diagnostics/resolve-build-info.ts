/**
 * Resolve build commit / timestamp for diagnostics without changing deploy scripts.
 * Sources (priority): BIDWAR_* env → RENDER_* env → optional build-info.json file.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type BuildInfoSource =
  | "env_override"
  | "render_env"
  | "build_info_file"
  | "unavailable";

export type BuildInfo = {
  commitSha: string | null;
  commitShaShort: string | null;
  buildTimestamp: string | null;
  source: BuildInfoSource;
};

type BuildInfoFile = {
  commitSha?: string;
  buildTimestamp?: string;
};

function shortSha(sha: string | null): string | null {
  if (!sha) return null;
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

function fromEnv(): BuildInfo | null {
  const overrideSha =
    process.env.BIDWAR_GIT_SHA?.trim() ||
    process.env.RENDER_GIT_COMMIT?.trim() ||
    process.env.RENDER_GIT_COMMIT_SHA?.trim() ||
    "";
  const overrideTs =
    process.env.BIDWAR_BUILD_TIMESTAMP?.trim() ||
    process.env.RENDER_GIT_COMMIT_TIMESTAMP?.trim() ||
    "";

  const hasBidwar =
    Boolean(process.env.BIDWAR_GIT_SHA?.trim()) ||
    Boolean(process.env.BIDWAR_BUILD_TIMESTAMP?.trim());
  const hasRender =
    Boolean(process.env.RENDER_GIT_COMMIT?.trim()) ||
    Boolean(process.env.RENDER_GIT_COMMIT_SHA?.trim());

  if (!overrideSha && !overrideTs) return null;

  return {
    commitSha: overrideSha || null,
    commitShaShort: shortSha(overrideSha || null),
    buildTimestamp: overrideTs || null,
    source: hasBidwar ? "env_override" : hasRender ? "render_env" : "env_override",
  };
}

function readBuildInfoFile(): BuildInfo | null {
  const candidates = [
    path.join(process.cwd(), "artifacts/api-server/dist/build-info.json"),
    path.join(process.cwd(), "dist/build-info.json"),
    path.join(process.cwd(), "build-info.json"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as BuildInfoFile;
      const commitSha = parsed.commitSha?.trim() || null;
      const buildTimestamp = parsed.buildTimestamp?.trim() || null;
      if (!commitSha && !buildTimestamp) continue;
      return {
        commitSha,
        commitShaShort: shortSha(commitSha),
        buildTimestamp,
        source: "build_info_file",
      };
    } catch {
      // ignore invalid file
    }
  }
  return null;
}

export function resolveBuildInfo(): BuildInfo {
  const fromEnvironment = fromEnv();
  if (fromEnvironment?.commitSha || fromEnvironment?.buildTimestamp) {
    // Prefer BIDWAR_/RENDER_ when present; fill gaps from file if needed.
    const file = readBuildInfoFile();
    return {
      commitSha: fromEnvironment.commitSha ?? file?.commitSha ?? null,
      commitShaShort: shortSha(fromEnvironment.commitSha ?? file?.commitSha ?? null),
      buildTimestamp: fromEnvironment.buildTimestamp ?? file?.buildTimestamp ?? null,
      source: fromEnvironment.source,
    };
  }

  const file = readBuildInfoFile();
  if (file) return file;

  return {
    commitSha: null,
    commitShaShort: null,
    buildTimestamp: null,
    source: "unavailable",
  };
}
