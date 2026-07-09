/**
 * Install Playwright Chromium for Buzz Studio PNG export.
 * Run after api-server build in production deploy pipelines.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.SKIP_PLAYWRIGHT_BROWSER_INSTALL === "true") {
  console.log("[playwright] SKIP_PLAYWRIGHT_BROWSER_INSTALL=true — skipping browser install");
  process.exit(0);
}

const browsersPath =
  process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() ||
  path.join(rootDir, ".playwright-browsers");

const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: browsersPath,
};

console.log(`[playwright] Installing Chromium to ${browsersPath}`);

try {
  execSync("pnpm --filter @workspace/api-server exec playwright install chromium", {
    cwd: rootDir,
    stdio: "inherit",
    env,
  });
  console.log("[playwright] Chromium install complete");
} catch (err) {
  console.error("[playwright] Chromium install failed — creative PNG export will not work in production");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
