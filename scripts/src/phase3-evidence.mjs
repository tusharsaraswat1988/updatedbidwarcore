/**
 * Phase 3 evidence — dead-code cleanup verification (static + HTTP + build artifacts).
 * Usage: node scripts/src/phase3-evidence.mjs [baseUrl]
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const base = (process.argv[2] ?? "http://127.0.0.1:8081").replace(/\/$/, "");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function grepFiles(pattern, roots) {
  const hits = [];
  for (const sub of roots) {
    const dir = join(root, sub);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(f)) continue;
      try {
        if (pattern.test(readFileSync(f, "utf8"))) hits.push(relative(root, f));
      } catch {}
    }
  }
  return hits;
}

function findByName(name) {
  return walk(join(root, "artifacts"))
    .filter((f) => f.endsWith(name))
    .map((f) => relative(root, f));
}

const pass = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);

console.log("Phase 3 evidence — cleanup verification\n");

// --- Deleted / dead code checks ---
const deadFiles = [
  "artifacts/auction-platform/src/pages/owner-panel.tsx",
  "artifacts/owner-app/src/screens/AccessGate.tsx",
  "artifacts/owner-app/src/lib/owner-onboarding.ts",
];

console.log("## Deleted files (must not exist)");
const deletedStatus = Object.fromEntries(
  deadFiles.map((f) => [f, !existsSync(join(root, f))]),
);
console.log(JSON.stringify(deletedStatus, null, 2));

const legacyHelperConsumers = grepFiles(/ownerLegacySharePath/, ["lib", "artifacts"]).filter(
  (f) => !f.endsWith("phase3-evidence.mjs"),
);
console.log("\n## ownerLegacySharePath (removed export — no consumers)");
console.log(JSON.stringify({ consumers: legacyHelperConsumers }, null, 2));

// --- Owner routes (owner-app App.tsx) ---
const appTsx = readFileSync(join(root, "artifacts/owner-app/src/App.tsx"), "utf8");
const ownerRoutes = [
  ...appTsx.matchAll(/<Route[^>]+path="([^"]+)"/g),
].map((m) => m[1]);

console.log("\n## Remaining owner-app routes (wouter, base /owner-app)");
console.log(JSON.stringify(ownerRoutes, null, 2));

const auctionApp = readFileSync(join(root, "artifacts/auction-platform/src/App.tsx"), "utf8");
const auctionOwnerRoute = auctionApp.includes('/tournament/:id/owner/:teamId');
const usesRedirect = auctionApp.includes("RedirectToOwnerApp");

console.log("\n## Auction-platform legacy owner route (redirect only)");
console.log(JSON.stringify({ legacyRoute: auctionOwnerRoute, usesRedirectToOwnerApp: usesRedirect }, null, 2));

// --- Owner auth files ---
const authFiles = [
  "lib/api-base/src/owner-auth.ts",
  "lib/api-base/src/owner-urls.ts",
  "artifacts/owner-app/src/components/AccessCode.tsx",
  "artifacts/owner-app/src/lib/owner-flow.ts",
  "artifacts/api-server/src/routes/teams.ts",
].map((f) => ({ path: f, exists: existsSync(join(root, f)) }));

console.log("\n## Remaining owner auth files");
console.log(JSON.stringify(authFiles, null, 2));

// --- Bundle / build artifacts ---
const ownerDist = join(root, "artifacts/owner-app/dist/public");
const ownerIndex = join(ownerDist, "index.html");
const ownerManifest = join(ownerDist, "manifest.webmanifest");
const ownerSw = existsSync(join(ownerDist, "sw.js")) || existsSync(join(ownerDist, "sw.mjs"));

let indexHtml = "";
if (existsSync(ownerIndex)) indexHtml = readFileSync(ownerIndex, "utf8");
const assetsUseOwnerBase = indexHtml.includes("/owner-app/assets/") || indexHtml.includes('href="/owner-app/');

console.log("\n## Bundle / build verification (owner-app dist)");
console.log(
  JSON.stringify(
    {
      distExists: existsSync(ownerDist),
      indexHtml: existsSync(ownerIndex),
      manifest: existsSync(ownerManifest),
      serviceWorker: ownerSw,
      assetsUnderOwnerAppBase: assetsUseOwnerBase,
    },
    null,
    2,
  ),
);

// --- HTTP: URLs, PWA, push path unchanged ---
async function get(path, opts = {}) {
  const r = await fetch(`${base}${path}`, opts);
  return { status: r.status, text: await r.text(), headers: r.headers };
}

let http = {};
try {
  const legacySms = await get("/tournament/5/owner/5", { redirect: "manual" });
  const legacyShare = await get("/owner-app/tournament/5/owner/5", { redirect: "manual" });
  const joinPage = await get("/owner-app/join?tournamentId=5&teamId=5");
  const manifest = await get("/owner-app/manifest.webmanifest");
  let manifestJson = {};
  try {
    manifestJson = JSON.parse(manifest.text);
  } catch {}

  const pushRoute = readFileSync(join(root, "artifacts/api-server/src/routes/push.ts"), "utf8");
  const pushUsesJoin = pushRoute.includes("ownerJoinPath") || pushRoute.includes("/owner-app/join");

  http = {
    legacySms: { status: legacySms.status, location: legacySms.headers.get("location") },
    legacyShare: { status: legacyShare.status, location: legacyShare.headers.get("location") },
    joinPage: { status: joinPage.status },
    pwa: {
      manifestStatus: manifest.status,
      display: manifestJson.display,
      scope: manifestJson.scope,
      startUrl: manifestJson.start_url,
    },
    pushDeepLinkUsesJoin: pushUsesJoin,
  };
} catch (e) {
  http = { error: String(e.message ?? e) };
}

console.log("\n## PWA + route HTTP verification");
console.log(JSON.stringify(http, null, 2));

// --- Route map ---
console.log("\n## Route map after cleanup");
console.log(`
External / canonical:
  GET /owner-app/join?tournamentId=&teamId=     → owner-app MobileEntry (onboarding)
  GET /tournament/:id/owner/:teamId             → 302 → /owner-app/join?...
  GET /owner-app/tournament/:id/owner/:teamId   → 302 → /owner-app/join?...

owner-app (wouter base /owner-app):
  /join                                         → MobileEntry
  /join/teams                                   → TeamPicker
  /tournament/:id/owner/:teamId                 → OwnerRoute (access code + live bid)
  / (catch-all)                                 → Launcher

auction-platform (dev SPA fallback):
  /tournament/:id/owner/:teamId                 → RedirectToOwnerApp → join URL
`);

console.log("--- SUMMARY ---");
for (const [f, gone] of Object.entries(deletedStatus)) pass(gone, `Deleted: ${f}`);
pass(legacyHelperConsumers.length === 0, "ownerLegacySharePath removed (no consumers)");
pass(ownerRoutes.includes("/join") && ownerRoutes.includes("/tournament/:id/owner/:teamId"), "owner-app routes intact");
pass(auctionOwnerRoute && usesRedirect, "auction-platform legacy redirect route");
pass(authFiles.every((a) => a.exists), "owner auth files present");
pass(existsSync(ownerDist) && assetsUseOwnerBase, "owner-app build uses /owner-app/ asset base");
pass(existsSync(ownerManifest) && ownerSw, "PWA artifacts in dist");
if (!http.error) {
  pass(http.legacySms?.status === 302, "Legacy SMS URL redirect");
  pass(http.legacyShare?.status === 302, "Legacy share URL redirect");
  pass(http.joinPage?.status === 200, "Canonical join page");
  pass(http.pwa?.display === "standalone", "PWA manifest standalone");
  pass(http.pushDeepLinkUsesJoin, "Push notification deep link uses join URL");
} else {
  pass(false, `HTTP checks skipped: ${http.error}`);
}
