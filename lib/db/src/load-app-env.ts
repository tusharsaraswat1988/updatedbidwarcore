import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot } from "./repo-root";

export type LoadAppEnvResult = {
  loaded: boolean;
  path: string;
  file: string;
  nodeEnv: string;
  repoRoot: string;
};

export function resolveAppEnvFileName(nodeEnv: string): string {
  return nodeEnv === "production" ? ".env.production" : ".env";
}

/**
 * Loads environment variables from the repo-root env file for the given mode.
 * - development (default): `.env` only — never reads `.env.production`
 * - production: `.env.production` only — never reads `.env`
 *
 * Uses `override: false` so host-injected vars (Render/Replit) are preserved.
 * Missing files are OK when the host already set required variables.
 */
export function loadAppEnv(options?: {
  nodeEnv?: string;
  repoRoot?: string;
}): LoadAppEnvResult {
  const nodeEnv =
    options?.nodeEnv ?? process.env.NODE_ENV?.trim() ?? "development";
  const repoRoot =
    options?.repoRoot ??
    findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const file = resolveAppEnvFileName(nodeEnv);
  const envPath = resolve(repoRoot, file);

  if (!existsSync(envPath)) {
    return { loaded: false, path: envPath, file, nodeEnv, repoRoot };
  }

  loadEnv({ path: envPath, override: false });
  return { loaded: true, path: envPath, file, nodeEnv, repoRoot };
}
