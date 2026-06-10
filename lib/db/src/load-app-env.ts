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

const HOST_MANAGED_SECRET_KEYS = [
  "ADMIN_PASSWORD",
  "ADMIN_DATA_PASSWORD",
  "SESSION_SECRET",
  "DATABASE_URL",
  "NEON_DATABASE_URL",
] as const;

function isManagedHost(): boolean {
  return !!(
    process.env.RENDER
    || process.env.RAILWAY_ENVIRONMENT
    || process.env.FLY_APP_NAME
    || process.env.VERCEL
  );
}

function snapshotHostSecrets(): Partial<Record<(typeof HOST_MANAGED_SECRET_KEYS)[number], string>> {
  const snapshot: Partial<Record<(typeof HOST_MANAGED_SECRET_KEYS)[number], string>> = {};
  for (const key of HOST_MANAGED_SECRET_KEYS) {
    const value = process.env[key]?.trim();
    if (value) snapshot[key] = value;
  }
  return snapshot;
}

/** On Render/Railway/etc., never let `.env.production` override dashboard secrets. */
function restoreHostSecrets(
  snapshot: Partial<Record<(typeof HOST_MANAGED_SECRET_KEYS)[number], string>>,
): void {
  for (const key of HOST_MANAGED_SECRET_KEYS) {
    const hostValue = snapshot[key];
    if (hostValue) {
      process.env[key] = hostValue;
    } else if (key === "ADMIN_PASSWORD" || key === "ADMIN_DATA_PASSWORD") {
      delete process.env[key];
    }
  }
}

export function resolveAppEnvFileName(nodeEnv: string): string {
  return nodeEnv === "production" ? ".env.production" : ".env";
}

/**
 * Loads environment variables from the repo-root env file for the given mode.
 * - development (default): `.env` only — never reads `.env.production`
 * - production: `.env.production` only — never reads `.env`
 *
 * Uses `override: false` so host-injected vars (Render/Replit) are preserved.
 * On managed hosts (Render, Railway, Fly, Vercel), dashboard secrets are never
 * replaced by values from `.env.production`.
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

  const hostSecrets =
    nodeEnv === "production" && isManagedHost() ? snapshotHostSecrets() : {};

  loadEnv({ path: envPath, override: false });

  if (nodeEnv === "production" && isManagedHost()) {
    restoreHostSecrets(hostSecrets);
  }

  return { loaded: true, path: envPath, file, nodeEnv, repoRoot };
}
