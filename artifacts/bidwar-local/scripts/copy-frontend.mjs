/**
 * Builds auction-platform and copies its dist output into
 * artifacts/bidwar-local/frontend-dist so the Electron local server
 * can serve the operator UI as static files.
 *
 * Run as part of: pnpm run build (via build:frontend step)
 */

import { execSync } from "child_process";
import { cpSync, rmSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot    = resolve(__dirname, "../../..");
const srcDist     = resolve(repoRoot, "artifacts/auction-platform/dist");
const destDist    = resolve(__dirname, "../frontend-dist");

// Build the auction-platform Vite bundle
console.log("Building auction-platform...");
execSync("pnpm --filter @workspace/auction-platform run build", {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    // Provide required env vars for the build — PORT and BASE_PATH are not
    // used at build time for Vite static assets but must be present to avoid
    // "missing env" errors in some Vite configs.
    PORT: process.env.PORT || "3741",
    BASE_PATH: process.env.BASE_PATH || "/",
  },
});

// Copy dist → frontend-dist (clean copy)
if (existsSync(destDist)) {
  rmSync(destDist, { recursive: true, force: true });
}
mkdirSync(destDist, { recursive: true });
cpSync(srcDist, destDist, { recursive: true });

console.log(`Copied ${srcDist} → ${destDist}`);
