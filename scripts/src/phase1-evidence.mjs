/**
 * Phase 1 evidence — HTTP route tests against production static server.
 * Usage: node scripts/src/phase1-evidence.mjs [baseUrl]
 */
const base = (process.argv[2] ?? "http://127.0.0.1:8081").replace(/\/$/, "");

async function head(location) {
  const r = await fetch(location, { redirect: "manual" });
  return { status: r.status, location: r.headers.get("location") };
}

async function get(path) {
  const r = await fetch(`${base}${path}`);
  const text = await r.text();
  return { status: r.status, text, headers: Object.fromEntries(r.headers) };
}

async function postJson(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
}

const results = [];

function log(section, data) {
  results.push({ section, ...data });
  console.log(`\n## ${section}`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

console.log(`Phase 1 evidence — base URL: ${base}`);

// 1–2 Join routes
const join = await get("/owner-app/join");
log("1 Mobile owner flow — /owner-app/join", {
  status: join.status,
  hasJoinHeading: join.text.includes("Join your auction"),
  hasMobileInput: join.text.includes('type="tel"') || join.text.includes("Mobile number"),
});

const joinDeep = await get("/owner-app/join?tournamentId=5&teamId=5");
log("4–5 Share/SMS link entry — deep link join", {
  status: joinDeep.status,
  hasDeepLinkHint: joinDeep.text.includes("Team link detected"),
});

// Legacy redirects
const legacyAuction = await head(`${base}/tournament/5/owner/5`);
log("4 SMS legacy redirect", {
  status: legacyAuction.status,
  location: legacyAuction.location,
  expected: "/owner-app/join?tournamentId=5&teamId=5",
});

const legacyShare = await head(`${base}/owner-app/tournament/5/owner/5`);
log("5 Share legacy redirect", {
  status: legacyShare.status,
  location: legacyShare.location,
});

// PWA assets
const manifest = await get("/owner-app/manifest.webmanifest");
let manifestJson = {};
try {
  manifestJson = JSON.parse(manifest.text);
} catch {}
log("2 PWA install — manifest", {
  status: manifest.status,
  name: manifestJson.name,
  display: manifestJson.display,
  icons: manifestJson.icons?.length,
});

const sw = await get("/owner-app/sw.js");
log("3 PWA update — service worker", {
  status: sw.status,
  hasPrecache: sw.text.includes("precache") || sw.text.includes("__WB_MANIFEST"),
  size: sw.text.length,
});

const registerSW = await get("/owner-app/registerSW.js");
log("3 PWA update — registerSW", { status: registerSW.status, snippet: registerSW.text.slice(0, 120) });

// Push
const vapid = await get("/api/vapid-public-key");
let vapidJson = {};
try {
  vapidJson = JSON.parse(vapid.text);
} catch {}
log("7 Push — VAPID public key", {
  status: vapid.status,
  hasKey: !!vapidJson.publicKey,
  keyPrefix: vapidJson.publicKey?.slice(0, 8),
});

// Desktop browser
const desktop = await get("/owner-app/");
log("8 Desktop browser — launcher", {
  status: desktop.status,
  hasRoot: desktop.text.includes('id="root"'),
  hasAssets: /\/owner-app\/assets\//.test(desktop.text),
});

// Auction platform legacy client redirect (SPA)
const legacySpa = await get("/tournament/5/owner/5");
log("4 SMS link — auction-platform SPA redirect component", {
  note: "Production server returns 302 before SPA; dev uses RedirectToOwnerApp",
  status: legacySpa.status,
});

// Owner bidding — API guard
const bidNoCode = await postJson("/api/tournaments/5/auction/bid", {
  teamId: 5,
  amount: 60000,
});
log("6 Owner bidding — bid without access code (expect reject)", bidNoCode);

const verifyBad = await postJson("/api/tournaments/5/teams/5/verify-access", { code: "WRONG" });
log("6 Owner bidding — verify-access endpoint", verifyBad);

// SMS URL shape (code inspection)
log("4 SMS URL generator", {
  ownerJoinPath: "/owner-app/join?tournamentId=5&teamId=5",
  pushDeepLink: "/owner-app/join?tournamentId=5&teamId=5",
  teamsPageLink: "/owner-app/join?tournamentId=5&teamId=5",
});

console.log("\n--- SUMMARY ---");
const pass = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
pass(join.status === 200 && join.text.includes("Join your auction"), "Mobile join page");
pass(joinDeep.text.includes("Team link detected"), "Deep link hint");
pass(legacyAuction.status === 302 && legacyAuction.location?.includes("/owner-app/join"), "SMS legacy 302");
pass(legacyShare.status === 302, "Share legacy 302");
pass(manifest.status === 200 && manifestJson.display === "standalone", "PWA manifest");
pass(sw.status === 200 && sw.text.length > 1000, "Service worker");
pass(vapid.status === 200 && vapidJson.publicKey, "VAPID key");
pass(desktop.status === 200, "Desktop launcher");
pass(bidNoCode.status === 401 || bidNoCode.status === 403, "Bid requires access code");
