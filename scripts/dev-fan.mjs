/**
 * Start Fan Platform + API server together.
 * Usage: node scripts/dev-fan.mjs (from repo root)
 */
import { spawn, execSync } from "node:child_process";
import { loadRootEnv, repoRoot } from "./load-root-env.mjs";
import { freePorts, waitForPortsFree, waitForApiHealth } from "./dev-ports.mjs";

loadRootEnv();

const API_PORT = 3000;
const FAN_PORT = 5180;

function shutdown() {
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Freeing ports...");
freePorts([API_PORT, FAN_PORT]);
await waitForPortsFree([API_PORT, FAN_PORT], 5000);

console.log("Building API...");
execSync("pnpm --filter @workspace/api-server run build", {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("Starting API...");
const api = spawn("pnpm", ["--filter", "@workspace/api-server", "run", "start"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(API_PORT) },
});

await waitForApiHealth(API_PORT, 60000);
console.log("API ready.");

console.log("Starting Fan Platform...");
spawn("pnpm", ["--filter", "@workspace/fan-platform", "run", "dev"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PORT: String(FAN_PORT) },
});
