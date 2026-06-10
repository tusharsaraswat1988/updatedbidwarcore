/**
 * Start API + auction-platform + owner-app together with shared root .env and dev defaults.
 * Automatically frees stale dev ports before starting.
 * Usage: pnpm dev   (from repository root)
 */
import { spawn, execSync } from "node:child_process";
import { loadRootEnv, repoRoot } from "./load-root-env.mjs";
import {
  getDevPorts,
  freePorts,
  waitForPortsFree,
  waitForApiHealth,
  killChildTree,
} from "./dev-ports.mjs";

const { loaded, path: envPath, file } = loadRootEnv();
const { api: API_PORT, frontend: FRONTEND_PORT, ownerApp: OWNER_APP_PORT } =
  getDevPorts();

const API_PORT_STR = String(API_PORT);
const FRONTEND_PORT_STR = String(FRONTEND_PORT);
const OWNER_APP_PORT_STR = String(OWNER_APP_PORT);

function devEnv(overrides) {
  return {
    ...process.env,
    NODE_ENV: "development",
    SERVE_STATIC: "false",
    APP_DOMAIN: process.env.APP_DOMAIN?.trim() || "localhost",
    APP_PUBLIC_SCHEME: process.env.APP_PUBLIC_SCHEME?.trim() || "http",
    API_PORT: API_PORT_STR,
    FRONTEND_PORT: FRONTEND_PORT_STR,
    OWNER_APP_PORT: OWNER_APP_PORT_STR,
    API_DEV_PROXY_TARGET:
      process.env.API_DEV_PROXY_TARGET?.trim() ||
      `http://127.0.0.1:${API_PORT}`,
    ...overrides,
  };
}

const isWin = process.platform === "win32";
/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    killChildTree(c);
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function run(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: isWin,
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) return;
    if (code !== 0 && code !== null) {
      console.error(`\n[${label}] exited with code ${code}\n`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

const devPorts = [...new Set([API_PORT, FRONTEND_PORT, OWNER_APP_PORT])];

console.log("\nBidWar — local development\n");
if (loaded) {
  console.log(`  Env:      ${envPath} (${file})`);
} else {
  console.warn(
    `  Env:      (no ${file} at ${envPath} — copy .env.example to .env)\n`,
  );
}

console.log("Checking dev ports…");
const { freed } = freePorts(devPorts);
if (freed.length > 0) {
  console.log("  Waiting for ports to release…");
  const ready = await waitForPortsFree(devPorts, 12000);
  if (!ready) {
    console.error(
      "\n  Could not free dev ports. Run `pnpm dev:stop` and try again.\n",
    );
    process.exit(1);
  }
} else {
  console.log("  All dev ports are free.");
}

console.log(`\n  API:       http://127.0.0.1:${API_PORT}/api/healthz`);
console.log(`  Frontend:  http://127.0.0.1:${FRONTEND_PORT}/admin/login`);
console.log(
  `  Owner app: http://127.0.0.1:${FRONTEND_PORT}/owner-app/join`,
);
console.log(
  `             (direct) http://127.0.0.1:${OWNER_APP_PORT}/owner-app/\n`,
);

console.log("Building API (one-time)…\n");
try {
  execSync("pnpm --filter @workspace/api-server run build", {
    cwd: repoRoot,
    env: devEnv({ PORT: API_PORT_STR }),
    stdio: "inherit",
    shell: isWin,
  });
} catch {
  shutdown(1);
}

run(
  "api",
  "pnpm",
  ["--filter", "@workspace/api-server", "run", "start"],
  devEnv({ PORT: API_PORT_STR }),
);

console.log("Waiting for API health check…");
try {
  await waitForApiHealth(API_PORT);
  console.log("  API is ready.\n");
} catch (err) {
  console.error(`\n  ${err instanceof Error ? err.message : err}\n`);
  shutdown(1);
}

run(
  "web",
  "pnpm",
  ["--filter", "@workspace/auction-platform", "run", "dev"],
  devEnv({ PORT: FRONTEND_PORT_STR }),
);

run(
  "owner",
  "pnpm",
  ["--filter", "@workspace/owner-app", "run", "dev"],
  devEnv({ OWNER_APP_PORT: OWNER_APP_PORT_STR, PORT: OWNER_APP_PORT_STR }),
);

console.log("All dev processes started. Press Ctrl+C to stop.\n");
