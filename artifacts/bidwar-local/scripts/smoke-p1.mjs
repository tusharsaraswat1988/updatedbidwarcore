/**
 * P1 smoke test: operator PIN, scout, tournament meta, sync status.
 * Usage: node ./scripts/smoke-p1.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = 3842 + Math.floor(Math.random() * 100);
const workDir = mkdtempSync(path.join(tmpdir(), "bidwar-local-p1-"));
const dbPath = path.join(workDir, "auction.db");
const operatorPin = "4321";

const snapshot = {
  version: 1,
  exportToken: "test-token-p1",
  operatorPin,
  cloudBaseUrl: "http://127.0.0.1:9",
  tournament: {
    id: 199,
    name: "P1 Smoke Tournament",
    sport: "cricket",
    basePurse: 10_000_000,
    minBid: 100_000,
    bidIncrement: 100_000,
    timerSeconds: 30,
    bidTimerSeconds: 15,
    playerSelectionMode: "sequential",
    minimumSquadSize: 11,
    maximumSquadSize: 15,
    localModeEnabled: true,
  },
  teams: [
    { id: 1, name: "Team A", shortCode: "TMA", ownerName: "Owner A", purse: 10_000_000, purseUsed: 0 },
    { id: 2, name: "Team B", shortCode: "TMB", ownerName: "Owner B", purse: 10_000_000, purseUsed: 0 },
    { id: 3, name: "Team C", shortCode: "TMC", ownerName: "Owner C", purse: 10_000_000, purseUsed: 0 },
    { id: 4, name: "Team D", shortCode: "TMD", ownerName: "Owner D", purse: 10_000_000, purseUsed: 0 },
  ],
  players: Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    basePrice: 100_000,
    status: i < 2 ? "unsold" : "available",
  })),
  categories: [],
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`  ok  ${msg}`);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { res, text, json };
}

async function waitForHealth(base, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const { res, json } = await fetchJson(`${base}/healthz`);
      if (res.ok && json?.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Server did not become healthy");
}

async function main() {
  console.log("BidWar Local P1 smoke\n");
  const serverScript = path.join(root, "dist-server", "index.js");
  const child = spawn(process.execPath, [serverScript], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DB_PATH: dbPath },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(base);
    pass("healthz");

    const importRes = await fetchJson(`${base}/local/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    if (!importRes.res.ok || importRes.json?.operatorPin !== operatorPin) {
      fail(`import operatorPin: ${importRes.text.slice(0, 200)}`);
      return;
    }
    const tid = importRes.json.tournamentId;
    pass(`import with operatorPin tournamentId=${tid}`);

    const metaRes = await fetchJson(`${base}/local/tournament-meta?tournamentId=${tid}`);
    if (!metaRes.res.ok || metaRes.json?.operatorPin !== operatorPin) {
      fail(`tournament-meta: ${metaRes.text.slice(0, 200)}`);
      return;
    }
    pass("tournament-meta");

    const kitRes = await fetchJson(`${base}/local/connection-kit?tournamentId=${tid}`);
    if (!kitRes.json?.operator?.pin) fail("connection-kit operator pin");
    else pass("connection-kit operator pin");

    const scoutRes = await fetchJson(`${base}/api/tournaments/${tid}/teams/scout`);
    if (!scoutRes.res.ok || !Array.isArray(scoutRes.json?.teams) || !Array.isArray(scoutRes.json?.unsoldPlayers)) {
      fail(`teams/scout: ${scoutRes.text.slice(0, 200)}`);
      return;
    }
    pass(`teams/scout (${scoutRes.json.teams.length} teams, ${scoutRes.json.unsoldPlayers.length} unsold)`);

    const pauseDenied = await fetchJson(`${base}/api/tournaments/${tid}/auction/pause`, { method: "POST" });
    if (pauseDenied.res.status !== 401) {
      fail(`auction mutation without PIN should 401, got ${pauseDenied.res.status}`);
      return;
    }
    pass("operator PIN enforced");

    const pauseOk = await fetchJson(`${base}/api/tournaments/${tid}/auction/pause`, {
      method: "POST",
      headers: { "X-Operator-Pin": operatorPin },
    });
    if (!pauseOk.res.ok) fail(`auction with PIN: ${pauseOk.res.status}`);
    else pass("operator PIN accepted");

    const syncStatus = await fetchJson(`${base}/local/sync-status`);
    if (!syncStatus.res.ok || typeof syncStatus.json?.failed !== "number") {
      fail(`sync-status: ${syncStatus.text.slice(0, 120)}`);
      return;
    }
    pass("sync-status includes failed count");

    if (process.exitCode) {
      console.log("\nSome checks failed.");
    } else {
      console.log("\nAll P1 smoke checks passed.");
    }
  } finally {
    child.kill();
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
