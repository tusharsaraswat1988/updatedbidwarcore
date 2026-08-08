/**
 * Integration-style: Auction handoff endpoint idempotency against local API.
 * Skips when API is down.
 *
 * Run: pnpm --filter @workspace/scripts exec tsx --env-file=../.env src/verify-auction-sports-handoff.ts
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const API = process.env.VERIFY_API_BASE?.trim() || "http://127.0.0.1:8080/api";
const TID = Number(process.env.VERIFY_TOURNAMENT_ID || "4");
const PASSWORD = process.env.LOCAL_ORGANIZER_PASSWORD?.trim() || "demo123";

async function loginCookie(): Promise<string> {
  const res = await fetch(`${API}/auth/organizer/${TID}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  let token = "";
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const m = c.split(";")[0]?.match(/^bidwar_auth=(.*)$/);
    if (m?.[1]) token = m[1];
  }
  if (!token) throw new Error("no auth cookie");
  return `bidwar_auth=${token}`;
}

async function main() {
  const cookie = await loginCookie();
  const headers = { Cookie: cookie, "Content-Type": "application/json" };

  const first = await fetch(`${API}/tournaments/${TID}/auction/handoff-to-sports`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const firstBody = await first.json();
  if (!first.ok) throw new Error(`handoff1 ${first.status} ${JSON.stringify(firstBody)}`);

  const teams1 = await (
    await fetch(`${API}/tournaments/${TID}/scoring/master-teams`, { headers: { Cookie: cookie } })
  ).json();

  const second = await fetch(`${API}/tournaments/${TID}/auction/handoff-to-sports`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const secondBody = await second.json();
  if (!second.ok) throw new Error(`handoff2 ${second.status} ${JSON.stringify(secondBody)}`);

  const teams2 = await (
    await fetch(`${API}/tournaments/${TID}/scoring/master-teams`, { headers: { Cookie: cookie } })
  ).json();

  const players1 = teams1.reduce((s: number, t: { squadCount?: number }) => s + (t.squadCount ?? 0), 0);
  const players2 = teams2.reduce((s: number, t: { squadCount?: number }) => s + (t.squadCount ?? 0), 0);

  if (teams1.length !== teams2.length) {
    throw new Error(`duplicate teams? ${teams1.length} → ${teams2.length}`);
  }
  if (players1 !== players2) {
    throw new Error(`duplicate players? ${players1} → ${players2}`);
  }
  if (firstBody.playersReady !== secondBody.playersReady) {
    throw new Error(`playersReady drifted ${firstBody.playersReady} → ${secondBody.playersReady}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        teams: teams2.length,
        players: players2,
        readyForMatches: secondBody.readyForMatches,
        message: secondBody.message,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
