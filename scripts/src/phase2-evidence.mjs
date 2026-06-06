/**
 * Phase 2 evidence — static checks + HTTP smoke tests.
 * Usage: node scripts/src/phase2-evidence.mjs [baseUrl]
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
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

function grepInArtifacts(pattern, subdirs = ["artifacts"]) {
  const hits = [];
  for (const sub of subdirs) {
    const dir = join(root, sub);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      if (pattern.test(readFileSync(f, "utf8"))) hits.push(relative(root, f));
    }
  }
  return hits;
}

console.log("Phase 2 evidence — static + HTTP checks\n");

const authModule = "lib/api-base/src/owner-auth.ts";
const authExists = existsSync(join(root, authModule));
const authImports = grepInArtifacts(/from ["']@workspace\/api-base\/owner-auth["']/);

console.log("## 1 Single owner auth module");
console.log(JSON.stringify({ module: authModule, exists: authExists, consumers: authImports }, null, 2));

function findFiles(name) {
  return walk(join(root, "artifacts")).filter((f) => f.endsWith(name)).map((f) => relative(root, f));
}

const accessCodeFiles = findFiles("AccessCode.tsx");
const accessGateFiles = findFiles("AccessGate.tsx");

console.log("\n## 2 Single AccessCode component");
console.log(JSON.stringify({
  accessCodeFiles,
  accessGateFiles,
  ownerPanelExists: existsSync(join(root, "artifacts/auction-platform/src/pages/owner-panel.tsx")),
}, null, 2));

const frontendDirs = ["artifacts/owner-app", "artifacts/auction-platform"];
const verifyHits = grepInArtifacts(/verify-access|verifyOwnerAccessCode|useVerifyOwnerAccess/, frontendDirs);
const ownerPanelVerify = verifyHits.filter((f) => f.includes("owner-panel"));
const duplicateClientVerify = grepInArtifacts(
  /fetch\([^)]*verify-access|useVerifyOwnerAccess/,
  frontendDirs,
).filter((f) => !f.includes("AccessCode.tsx") && !f.includes("owner-auth"));

console.log("\n## 3 No duplicate verification logic");
console.log(JSON.stringify({ verifyHits, ownerPanelVerify, clientSideFallbackInOwnerApp: duplicateClientVerify }, null, 2));

async function get(path) {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, text: await r.text() };
}

async function postJson(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let json;
  try { json = await r.json(); } catch { json = null; }
  return { status: r.status, json };
}

const manifest = await get("/owner-app/manifest.webmanifest");
let manifestJson = {};
try { manifestJson = JSON.parse(manifest.text); } catch {}

const legacy = await fetch(`${base}/tournament/5/owner/5`, { redirect: "manual" });
const deepJoin = await get("/owner-app/join?tournamentId=5&teamId=5");
const lookup = await postJson("/api/owner/onboarding/lookup", { mobile: "9889960999" });
const verify = await postJson("/api/tournaments/5/teams/5/verify-access", { code: "WRONG" });

console.log("\n## 4–8 HTTP smoke");
console.log(JSON.stringify({
  deepLinkJoin: { status: deepJoin.status },
  legacyRedirect: { status: legacy.status, location: legacy.headers.get("location") },
  lookup: { status: lookup.status, entries: lookup.json?.entries?.length },
  verifyEndpoint: verify,
  pwa: { manifestStatus: manifest.status, display: manifestJson.display, scope: manifestJson.scope },
}, null, 2));

const pass = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
console.log("\n--- SUMMARY ---");
pass(authExists && authImports.length >= 2, "Single owner-auth module");
pass(accessCodeFiles.length === 1 && accessGateFiles.length === 0, "Single AccessCode component");
pass(ownerPanelVerify.length === 0 && duplicateClientVerify.length === 0, "No duplicate verify logic");
pass(deepJoin.status === 200, "Deep link join page");
pass(legacy.status === 302, "Legacy SMS redirect");
pass(lookup.status === 200 && (lookup.json?.entries?.length ?? 0) > 0, "Mobile lookup API");
pass(manifest.status === 200 && manifestJson.display === "standalone", "PWA installability");
