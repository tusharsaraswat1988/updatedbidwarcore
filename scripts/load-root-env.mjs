import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepoRoot, loadAppEnv } from "./load-app-env.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = findRepoRoot(resolve(scriptsDir, ".."));

/** Load development env (`.env` only) for local dev tooling. */
export function loadRootEnv() {
  return loadAppEnv({ nodeEnv: "development", repoRoot });
}
