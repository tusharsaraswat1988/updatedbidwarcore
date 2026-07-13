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

/** Public URL config — host dashboard must win over committed `.env.production`. */
const HOST_MANAGED_PUBLIC_KEYS = [
  "APP_URL",
  "APP_PUBLIC_SCHEME",
  "APP_DOMAIN",
  "NODE_ENV",
  "BIDWAR_ENV",
] as const;

type HostManagedKey =
  | (typeof HOST_MANAGED_SECRET_KEYS)[number]
  | (typeof HOST_MANAGED_PUBLIC_KEYS)[number];

const HOST_MANAGED_KEYS: readonly HostManagedKey[] = [
  ...HOST_MANAGED_SECRET_KEYS,
  ...HOST_MANAGED_PUBLIC_KEYS,
];

function isManagedHost(): boolean {
  return !!(
    process.env.RENDER
    || process.env.RAILWAY_ENVIRONMENT
    || process.env.FLY_APP_NAME
    || process.env.VERCEL
    || process.env.REPL_ID
  );
}

function snapshotHostEnv(): Partial<Record<HostManagedKey, string>> {
  const snapshot: Partial<Record<HostManagedKey, string>> = {};
  for (const key of HOST_MANAGED_KEYS) {
    const value = process.env[key]?.trim();
    if (value) snapshot[key] = value;
  }
  return snapshot;
}

/** On Render/Railway/etc., never let `.env.production` override dashboard env. */
function restoreHostEnv(snapshot: Partial<Record<HostManagedKey, string>>): void {
  for (const key of HOST_MANAGED_KEYS) {
    const hostValue = snapshot[key];
    if (hostValue) {
      process.env[key] = hostValue;
    } else if (
      key === "ADMIN_PASSWORD"
      || key === "ADMIN_DATA_PASSWORD"
    ) {
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

  const hostEnv =
    nodeEnv === "production" && isManagedHost() ? snapshotHostEnv() : {};

  loadEnv({ path: envPath, override: false });

  if (nodeEnv === "production" && isManagedHost()) {
    restoreHostEnv(hostEnv);
  }

  return { loaded: true, path: envPath, file, nodeEnv, repoRoot };
}
