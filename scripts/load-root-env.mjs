import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(scriptsDir, "..");

/** Load monorepo root `.env` into `process.env` (no-op if file missing). */
export function loadRootEnv() {
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) {
    return { root: repoRoot, path: envPath, loaded: false };
  }
  config({ path: envPath, override: false });
  return { root: repoRoot, path: envPath, loaded: true };
}
