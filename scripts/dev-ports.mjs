/**
 * Cross-platform helpers to find and free BidWar local dev ports.
 * Safe on Windows: never targets PID 0 (Idle) or system PIDs.
 */
import { execSync } from "node:child_process";
import { loadRootEnv } from "./load-root-env.mjs";

loadRootEnv();

/** @returns {{ api: number; frontend: number; ownerApp: number }} */
export function getDevPorts(env = process.env) {
  return {
    api: Number(env.API_PORT?.trim() || "8080"),
    frontend: Number(
      env.FRONTEND_PORT?.trim() || env.WEB_PORT?.trim() || "3000",
    ),
    ownerApp: Number(env.OWNER_APP_PORT?.trim() || "5174"),
  };
}

/**
 * @param {number} port
 * @returns {number[]}
 */
export function findListeningPids(port) {
  const pids = new Set();

  if (process.platform === "win32") {
    try {
      const out = execSync("netstat -ano -p tcp", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const re = new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, "i");
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(re);
        if (m) pids.add(Number(m[1]));
      }
    } catch {
      /* ignore */
    }
    return [...pids].filter((pid) => pid > 4);
  }

  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const line of out.split(/\r?\n/)) {
      const pid = Number(line.trim());
      if (pid > 4) pids.add(pid);
    }
  } catch {
    /* lsof exits 1 when nothing is listening */
  }
  return [...pids];
}

/**
 * @param {number} pid
 */
export function killPid(pid) {
  if (!Number.isFinite(pid) || pid <= 4) return false;

  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
      try {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      } catch {
        /* already gone */
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {number[]} ports
 * @param {{ verbose?: boolean }} [opts]
 * @returns {{ freed: Array<{ port: number; pids: number[] }> }}
 */
export function freePorts(ports, opts = {}) {
  const verbose = opts.verbose ?? true;
  const freed = [];

  for (const port of ports) {
    const pids = findListeningPids(port);
    if (pids.length === 0) continue;

    if (verbose) {
      console.log(
        `  port ${port}: stopping PID${pids.length > 1 ? "s" : ""} ${pids.join(", ")}`,
      );
    }

    for (const pid of pids) {
      killPid(pid);
    }
    freed.push({ port, pids });
  }

  return { freed };
}

/**
 * @param {import("node:child_process").ChildProcess | null | undefined} child
 */
export function killChildTree(child) {
  if (!child?.pid) return;
  killPid(child.pid);
}

/** Wait until all dev ports are free (or timeout). */
export async function waitForPortsFree(ports, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy = ports.filter((p) => findListeningPids(p).length > 0);
    if (busy.length === 0) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return ports.every((p) => findListeningPids(p).length === 0);
}

/**
 * @param {number} apiPort
 * @param {number} [timeoutMs]
 */
export async function waitForApiHealth(apiPort, timeoutMs = 45000) {
  const url = `http://127.0.0.1:${apiPort}/api/healthz`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  throw new Error(
    `API did not become healthy at ${url} within ${timeoutMs / 1000}s`,
  );
}

/**
 * @param {{ api: number; frontend: number; ownerApp: number }} ports
 * @returns {Promise<{ api: boolean; web: boolean; owner: boolean }>}
 */
export async function getDevStackStatus(ports) {
  /** @type {{ api: boolean; web: boolean; owner: boolean }} */
  const status = { api: false, web: false, owner: false };

  try {
    const res = await fetch(`http://127.0.0.1:${ports.api}/api/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    status.api = res.ok;
  } catch {
    /* down */
  }

  try {
    const res = await fetch(`http://127.0.0.1:${ports.frontend}/admin/login`, {
      signal: AbortSignal.timeout(2000),
    });
    status.web = res.ok;
  } catch {
    /* down */
  }

  try {
    const res = await fetch(`http://127.0.0.1:${ports.ownerApp}/owner-app/`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const text = await res.text();
      status.owner = text.includes('id="root"') || text.includes("BidWar Owner");
    }
  } catch {
    /* down */
  }

  return status;
}
