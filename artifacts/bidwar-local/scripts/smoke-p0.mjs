/**
 * P0 smoke test: import → start auction → operator routes → API 404 JSON.
 * Usage: node ./scripts/smoke-p0.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = 3742 + Math.floor(Math.random() * 100);
const workDir = mkdtempSync(path.join(tmpdir(), "bidwar-local-p0-"));
const dbPath = path.join(workDir, "auction.db");

const snapshot = {
  version: 1,
  exportToken: "test-token",
  cloudBaseUrl: "http://127.0.0.1:9",
  tournament: {
    id: 99,
    name: "P0 Smoke Tournament",
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
    cheerMessagesEnabled: true,
    cheerCooldownSeconds: 2,
  },
  branding: {
    brandName: "BidWar Local",
    mainLogoUrl: null,
    primaryColor: "#F59E0B",
  },
  teams: [
    { id: 1, name: "Team A", shortCode: "TMA", ownerName: "Owner A", purse: 10_000_000, purseUsed: 0, accessCode: "AAAA" },
    { id: 2, name: "Team B", shortCode: "TMB", ownerName: "Owner B", purse: 10_000_000, purseUsed: 0, accessCode: "BBBB" },
    { id: 3, name: "Team C", shortCode: "TMC", ownerName: "Owner C", purse: 10_000_000, purseUsed: 0, accessCode: "CCCC" },
    { id: 4, name: "Team D", shortCode: "TMD", ownerName: "Owner D", purse: 10_000_000, purseUsed: 0, accessCode: "DDDD" },
  ],
  players: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `Player ${i + 1}`,
    basePrice: 100_000,
    status: "available",
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
  console.log("BidWar Local P0 smoke\n");
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
    if (!importRes.res.ok || !importRes.json?.ok) {
      fail(`import: ${importRes.res.status} ${importRes.text.slice(0, 200)}`);
      return;
    }
    const tid = importRes.json.tournamentId;
    pass(`import tournamentId=${tid}`);

    const tRes = await fetchJson(`${base}/api/tournaments/${tid}`);
    if (!tRes.json?.localModeEnabled || tRes.json.minimumSquadSize !== 11) {
      fail(`tournament flags: ${tRes.text.slice(0, 200)}`);
      return;
    }
    pass("tournament localModeEnabled + squad sizes");

    const startRes = await fetchJson(`${base}/api/tournaments/${tid}/auction/start`, { method: "POST" });
    if (!startRes.res.ok) {
      fail(`auction/start: ${startRes.res.status} ${startRes.text.slice(0, 300)}`);
      return;
    }
    pass("auction/start");

    const overlayRes = await fetchJson(`${base}/api/tournaments/${tid}/auction/display-overlay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "team" }),
    });
    if (!overlayRes.res.ok || overlayRes.res.headers.get("content-type")?.includes("text/html")) {
      fail(`display-overlay: ${overlayRes.res.status} ${overlayRes.text.slice(0, 120)}`);
      return;
    }
    if (!overlayRes.json?.displayOverlay) {
      fail("display-overlay missing displayOverlay in state");
      return;
    }
    pass("display-overlay");

    const stopRes = await fetchJson(`${base}/api/tournaments/${tid}/auction/stop-timer`, { method: "POST" });
    if (!stopRes.res.ok) fail(`stop-timer: ${stopRes.res.status}`);
    else pass("stop-timer");

    const brandRes = await fetchJson(`${base}/api/branding`);
    if (!brandRes.res.ok || !brandRes.json?.brandName) fail("branding route");
    else pass("branding");

    const missing = await fetchJson(`${base}/api/does-not-exist`, { method: "POST" });
    if (missing.res.status !== 404 || missing.res.headers.get("content-type")?.includes("text/html")) {
      fail(`API 404 should be JSON, got ${missing.res.status} ${missing.text.slice(0, 80)}`);
      return;
    }
    pass("API JSON 404");

    const kitRes = await fetchJson(`${base}/local/connection-kit?tournamentId=${tid}`);
    if (!kitRes.res.ok || !kitRes.json?.display?.url || !kitRes.json?.teams?.length) {
      fail(`connection-kit: ${kitRes.text.slice(0, 200)}`);
      return;
    }
    pass("connection-kit deep links");

    const brandRes2 = await fetchJson(`${base}/api/branding`);
    const logoUrl = brandRes2.json?.miniLogoUrl ?? brandRes2.json?.assets?.SYMBOL_LOGO;
    if (!brandRes2.res.ok || !logoUrl || !String(logoUrl).startsWith("/static/")) {
      fail(`default branding logo: ${JSON.stringify(brandRes2.json)?.slice(0, 200)}`);
      return;
    }
    pass("default offline branding logo");

    if (process.exitCode) {
      console.log("\nSome checks failed.");
    } else {
      console.log("\nAll P0 smoke checks passed.");
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
