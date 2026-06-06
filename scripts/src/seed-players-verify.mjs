/**
 * Temporary seed for Players table verification — creates QA Test players.
 * Run: node scripts/src/seed-players-verify.mjs [tournamentId] [--cleanup]
 */
const API = "http://127.0.0.1:8080/api";
const TOURNAMENT_ID = parseInt(process.argv[2] || "4", 10);
const CLEANUP = process.argv.includes("--cleanup");

async function loginAdmin() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("Set ADMIN_PASSWORD in environment");
  const res = await fetch(`${API}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: pw }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map(c => c.split(";")[0]).join("; ");
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
  return cookie;
}

async function listPlayers(cookie) {
  const res = await fetch(`${API}/tournaments/${TOURNAMENT_ID}/players`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) throw new Error(`List players failed: ${res.status}`);
  return res.json();
}

async function bulkCreate(cookie, players) {
  const res = await fetch(`${API}/tournaments/${TOURNAMENT_ID}/players/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ players }),
  });
  if (!res.ok) throw new Error(`Bulk create failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function deletePlayer(cookie, id) {
  await fetch(`${API}/tournaments/${TOURNAMENT_ID}/players/${id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
}

async function main() {
  const cookie = await loginAdmin();
  const existing = await listPlayers(cookie);

  if (CLEANUP) {
    const qa = existing.filter(p => p.name.startsWith("QA Test "));
    for (const p of qa) await deletePlayer(cookie, p.id);
    console.log(`Cleaned up ${qa.length} QA Test players`);
    return;
  }

  const qaExisting = existing.filter(p => p.name.startsWith("QA Test "));
  const need = Math.max(0, 105 - existing.length);
  if (need === 0 && qaExisting.length >= 100) {
    console.log(`Already have ${existing.length} players (${qaExisting.length} QA). Skipping seed.`);
    return;
  }

  const toCreate = [];
  const base = qaExisting.length;
  for (let i = 0; i < Math.max(need, 100 - qaExisting.length); i++) {
    const n = base + i + 1;
    const statuses = ["available", "available", "available", "sold", "unsold", "retained"];
    toCreate.push({
      name: `QA Test Player ${String(n).padStart(3, "0")}`,
      mobileNumber: `91${String(7000000000 + n).slice(-10)}`,
      basePrice: 100000,
      status: statuses[n % statuses.length],
    });
  }

  const result = await bulkCreate(cookie, toCreate);
  const after = await listPlayers(cookie);
  console.log(JSON.stringify({ created: result.created, failed: result.failed, total: after.length }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
