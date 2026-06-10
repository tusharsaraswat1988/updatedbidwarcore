/**
 * Node entrypoints (dev.mjs) cannot import TypeScript — keep in sync with
 * lib/db/src/load-app-env.ts
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const MARKER = "pnpm-workspace.yaml";

/** @param {string} startDir */
export function findRepoRoot(startDir) {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(resolve(dir, MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find repo root (missing ${MARKER}) starting from ${startDir}`,
      );
    }
    dir = parent;
  }
}

/** @param {string} nodeEnv */
export function resolveAppEnvFileName(nodeEnv) {
  return nodeEnv === "production" ? ".env.production" : ".env";
}

/**
 * @param {{ nodeEnv?: string; repoRoot?: string }} [options]
 */
export function loadAppEnv(options = {}) {
  const nodeEnv =
    options.nodeEnv ?? process.env.NODE_ENV?.trim() ?? "development";
  const repoRoot =
    options.repoRoot ??
    findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const file = resolveAppEnvFileName(nodeEnv);
  const envPath = resolve(repoRoot, file);

  if (!existsSync(envPath)) {
    return { loaded: false, path: envPath, file, nodeEnv, repoRoot };
  }

  loadEnv({ path: envPath, override: false });
  return { loaded: true, path: envPath, file, nodeEnv, repoRoot };
}
