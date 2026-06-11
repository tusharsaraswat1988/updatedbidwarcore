/**
 * Builds auction-platform and owner-app, then copies their dist outputs into
 * artifacts/bidwar-local/frontend-dist and owner-app-dist so the local server
 * can serve operator and owner UIs as static files.
 *
 * Run as part of: pnpm run build (via build:frontend step)
 */

import { execSync } from "child_process";
import { cpSync, rmSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const bidwarLocalRoot = resolve(__dirname, "..");

const apps = [
  {
    name: "auction-platform",
    filter: "@workspace/auction-platform",
    srcDist: resolve(repoRoot, "artifacts/auction-platform/dist/public"),
    destDist: resolve(bidwarLocalRoot, "frontend-dist"),
  },
  {
    name: "owner-app",
    filter: "@workspace/owner-app",
    srcDist: resolve(repoRoot, "artifacts/owner-app/dist/public"),
    destDist: resolve(bidwarLocalRoot, "owner-app-dist"),
  },
];

function copyDist({ name, filter, srcDist, destDist }) {
  console.log(`Building ${name}...`);
  execSync(`pnpm --filter ${filter} run build`, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.PORT || "3741",
      BASE_PATH: process.env.BASE_PATH || "/",
    },
  });

  if (!existsSync(srcDist)) {
    throw new Error(`${name} build output not found at ${srcDist}`);
  }

  if (existsSync(destDist)) {
    rmSync(destDist, { recursive: true, force: true });
  }
  mkdirSync(destDist, { recursive: true });
  cpSync(srcDist, destDist, { recursive: true });

  console.log(`Copied ${srcDist} → ${destDist}`);
}

for (const app of apps) {
  copyDist(app);
}
