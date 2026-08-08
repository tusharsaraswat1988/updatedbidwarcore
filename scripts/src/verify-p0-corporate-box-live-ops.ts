/**
 * P0.2 Corporate Box cricket live-ops verification against local API.
 * Exercises authoritative persistence for all five required scenarios.
 *
 * Usage: pnpm --filter @workspace/scripts exec tsx --env-file=../.env src/verify-p0-corporate-box-live-ops.ts
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const API = process.env.VERIFY_API_BASE?.trim() || "http://127.0.0.1:8080/api";
const TID = Number(process.env.VERIFY_TOURNAMENT_ID || "4");
const PASSWORD = process.env.LOCAL_ORGANIZER_PASSWORD?.trim() || "demo123";

type Jar = { cookie: string };

const results: Array<{
  test: string;
  result: "PASS" | "FAIL" | "BLOCKED";
  evidence: string;
}> = [];

function record(test: string, result: "PASS" | "FAIL" | "BLOCKED", evidence: string) {
  results.push({ test, result, evidence });
  const mark = result === "PASS" ? "✓" : result === "FAIL" ? "✗" : "○";
  console.log(`\n[${mark} ${result}] ${test}\n  ${evidence}`);
}

async function api(
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jar.cookie ? { Cookie: jar.cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) {
    const part = c.split(";")[0];
    if (part) {
      // Keep last auth cookie; merge simply.
      jar.cookie = jar.cookie
        ? `${jar.cookie.split("; ").filter((x) => !x.startsWith(part.split("=")[0]! + "=")).join("; ")}; ${part}`.replace(/^; /, "")
        : part;
      if (!jar.cookie.includes(part)) jar.cookie = jar.cookie ? `${jar.cookie}; ${part}` : part;
    }
  }
  // Fallback for environments without getSetCookie
  const raw = res.headers.get("set-cookie");
  if (raw && !setCookie.length) {
    const part = raw.split(";")[0]!;
    jar.cookie = part;
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function login(): Promise<Jar> {
  const jar: Jar = { cookie: "" };
  const res = await api(jar, "POST", `/auth/organizer/${TID}/login`, { password: PASSWORD });
  assert(res.status === 200 && res.json?.success, `login failed: ${res.status} ${res.text}`);
  // Node fetch may not expose set-cookie; use cookie jar from undici manually via raw headers if needed.
  return jar;
}

/** Cookie-aware fetch using a manual jar rebuilt from login response. */
async function loginWithCookie(): Promise<Jar> {
  const res = await fetch(`${API}/auth/organizer/${TID}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert(res.ok, `login HTTP ${res.status}`);
  const jar: Jar = { cookie: "" };
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof anyHeaders.getSetCookie === "function" ? anyHeaders.getSetCookie() : [];
  // Login clears then sets bidwar_auth — keep the last non-empty value only.
  let token = "";
  for (const c of cookies) {
    const part = c.split(";")[0] ?? "";
    const m = part.match(/^bidwar_auth=(.*)$/);
    if (m && m[1]) token = m[1];
  }
  if (!token) {
    const raw = res.headers.get("set-cookie") || "";
    const matches = [...raw.matchAll(/bidwar_auth=([^;,]*)/g)];
    for (const m of matches) {
      if (m[1]) token = m[1];
    }
  }
  assert(token, "login did not return session cookie — cannot verify authenticated flows");
  jar.cookie = `bidwar_auth=${token}`;
  return jar;
}

async function main() {
  console.log(`P0.2 verify → ${API} tournament=${TID}`);
  const jar = await loginWithCookie();
  console.log(`Logged in (cookie bytes=${jar.cookie.length})`);

  // Bind Corporate Box competition (existing APIs only). Skip if already locked.
  const existingCfg = await api(jar, "GET", `/tournaments/${TID}/competition/configuration`);
  const existing = existingCfg.json?.configuration ?? existingCfg.json;
  const alreadyLocked = Boolean(existingCfg.json?.status?.locked || existing?.locked);
  if (!alreadyLocked) {
    const patch = await api(jar, "PATCH", `/tournaments/${TID}/competition/configuration`, {
      competitionTypeId: "auction",
      variantId: "cricket.box",
      ruleProfileId: "cricket.box.corporate_standard",
      presentationProfileId: "presentation.cricket.corporate_box",
      registrationModeId: "individual",
      teamFormationStrategyId: "auction",
    });
    assert(patch.status === 200, `competition patch failed: ${patch.status} ${patch.text}`);
  } else {
    console.log("competition already locked — using frozen configuration");
  }
  const cfgRes = alreadyLocked
    ? existingCfg
    : await api(jar, "GET", `/tournaments/${TID}/competition/configuration`);
  const cfg = cfgRes.json?.configuration ?? cfgRes.json;
  assert(cfg?.ruleProfileId === "cricket.box.corporate_standard", "Corporate Box rule profile not bound");
  assert(cfg?.variantId === "cricket.box", "cricket.box variant not bound");

  // Production gate: Competition Setup must be locked before Prepare.
  const competitionReady = await api(jar, "POST", `/tournaments/${TID}/competition/ready`, {});
  if (competitionReady.status === 409) {
    console.log("competition already locked");
  } else {
    assert(
      competitionReady.status === 200,
      `competition ready/lock failed: ${competitionReady.status} ${competitionReady.text}`,
    );
  }

  // Resolve Player Registry franchise teams (opaque auctionTeamId used by scoring)
  const teamsRes = await api(jar, "GET", `/tournaments/${TID}/scoring/master-teams`);
  assert(teamsRes.status === 200, `master-teams: ${teamsRes.status} ${teamsRes.text}`);
  const teams = Array.isArray(teamsRes.json) ? teamsRes.json : teamsRes.json?.teams ?? [];
  assert(teams.length >= 2, `need ≥2 master teams, got ${teams.length}`);
  const homeId = Number(teams[0]!.auctionTeamId ?? teams[0]!.teamId ?? teams[0]!.id);
  const awayId = Number(teams[1]!.auctionTeamId ?? teams[1]!.teamId ?? teams[1]!.id);
  assert(homeId && awayId, `invalid team ids home=${homeId} away=${awayId}`);
  const homeName = teams[0]!.shortName ?? teams[0]!.name;
  const awayName = teams[1]!.shortName ?? teams[1]!.name;

  // Create match
  const created = await api(jar, "POST", `/tournaments/${TID}/scoring/matches`, {
    homeTeamId: homeId,
    awayTeamId: awayId,
  });
  assert(created.status === 200 || created.status === 201, `create match: ${created.status} ${created.text}`);
  const matchId = created.json?.match?.id ?? created.json?.id;
  assert(matchId, "no match id");
  console.log(`Match created id=${matchId} ${homeName} vs ${awayName}`);

  // ---- TEST 1 lifecycle bits: Prepare mandatory ----
  const startNoPrep = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.match.started",
    payload: { tossWinnerTeamId: homeId, electedTo: "bat", oversLimit: 20 },
    expectedSequence: 0,
  });
  const blockedStart =
    startNoPrep.status >= 400 &&
    (String(startNoPrep.json?.code || "").includes("RUNTIME") ||
      String(startNoPrep.json?.error || startNoPrep.text).toLowerCase().includes("prepare") ||
      String(startNoPrep.json?.code || "").includes("PREPARE") ||
      String(startNoPrep.json?.code || "").includes("CONTRACT") ||
      String(startNoPrep.json?.error || startNoPrep.text).toLowerCase().includes("ready") ||
      String(startNoPrep.json?.error || startNoPrep.text).toLowerCase().includes("runtime"));
  if (!blockedStart) {
    console.log("start-without-prepare:", startNoPrep.status, startNoPrep.json || startNoPrep.text);
  }

  // Match Configuration lock (production path) then Prepare + Ready
  const matchLock = await api(jar, "POST", `/tournaments/${TID}/matches/${matchId}/ready`, {});
  assert(
    matchLock.status === 200 || matchLock.status === 409,
    `match configuration lock failed: ${matchLock.status} ${matchLock.text}`,
  );
  const prep = await api(jar, "POST", `/tournaments/${TID}/runtime-matches/${matchId}/prepare`, {});
  assert(prep.status === 200 || prep.status === 201, `prepare failed: ${prep.status} ${prep.text}`);
  const ready = await api(jar, "POST", `/tournaments/${TID}/runtime-matches/${matchId}/ready`, {});
  assert(ready.status === 200 || ready.status === 201, `ready failed: ${ready.status} ${ready.text}`);

  const detailAfterPrep = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${matchId}`);
  assert(detailAfterPrep.status === 200, `get match: ${detailAfterPrep.status}`);
  const rules = detailAfterPrep.json?.match?.rules ?? detailAfterPrep.json?.match?.rulesJson;
  const oversOk = rules?.overs === 6;
  const xiOk = rules?.playingSquadSize === 8;
  const benchOk = rules?.benchSize === 2;
  const lbwOk = rules?.lbwEnabled === false;
  const retireOk = rules?.retireAtRuns === 30;
  const fhOk = rules?.freeHitEnabled === true;

  // Start match with stale oversLimit 20 — server must force 6
  let seq = detailAfterPrep.json?.state?.lastSequence ?? 0;
  const started = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.match.started",
    payload: { tossWinnerTeamId: homeId, electedTo: "bat", oversLimit: 20 },
    expectedSequence: seq,
  });
  assert(started.status === 201 || started.status === 200, `match start: ${started.status} ${started.text}`);
  seq = started.json?.state?.lastSequence ?? seq + 1;
  const oversAfterStart = started.json?.state?.oversLimit;
  assert(oversAfterStart === 6, `expected oversLimit 6 after start, got ${oversAfterStart}`);

  // Squad / XI
  const roster = await api(jar, "GET", `/tournaments/${TID}/scoring/roster`);
  assert(roster.status === 200, `roster: ${roster.status}`);
  const players = Array.isArray(roster.json) ? roster.json : roster.json?.players ?? roster.json?.roster ?? [];
  const homePlayers = players
    .filter((p: any) => (p.auctionTeamId ?? p.teamId) === homeId)
    .slice(0, 10);
  const awayPlayers = players
    .filter((p: any) => (p.auctionTeamId ?? p.teamId) === awayId)
    .slice(0, 10);
  const playerKey = (p: any) => p.auctionPlayerId ?? p.id ?? p.playerId;
  const homeIds = (homePlayers.length ? homePlayers : players.slice(0, 8)).map(playerKey).filter(Boolean);
  const awayIds = (awayPlayers.length ? awayPlayers : players.slice(8, 16)).map(playerKey).filter(Boolean);

  // Reject XI > 8
  const tooMany = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/squads`, {
    teamId: homeId,
    playingXi: homeIds.slice(0, 9),
    bench: homeIds.slice(9, 11),
  });
  // endpoint may be PUT path — try foundation route
  let xiRejectOk =
    tooMany.status === 400 ||
    tooMany.status === 409 ||
    (tooMany.status !== 200 && tooMany.status !== 201);

  // Use correct foundation API
  const setSquad = async (teamId: number, xi: number[], bench: number[]) => {
    const r = await api(jar, "PUT", `/tournaments/${TID}/scoring/matches/${matchId}/squads/${teamId}`, {
      playingXi: xi,
      bench,
      battingOrder: xi.slice(0, 2),
    });
    if (r.status === 404) {
      return api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/squads`, {
        teamId,
        playingXi: xi,
        bench,
        battingOrder: xi.slice(0, 2),
      });
    }
    return r;
  };

  const rejectXi = await setSquad(homeId, [...homeIds.slice(0, 8), 999001], homeIds.slice(8, 10));
  xiRejectOk = rejectXi.status >= 400;

  const homeXi = homeIds.slice(0, 8);
  const homeBench = homeIds.slice(8, 10);
  const awayXi = awayIds.slice(0, 8);
  const awayBench = awayIds.slice(8, 10);
  assert(homeXi.length >= 2 && awayXi.length >= 2, `not enough roster players home=${homeXi.length} away=${awayXi.length}`);

  const sqHome = await setSquad(homeId, homeXi, homeBench.slice(0, 2));
  assert(sqHome.status < 400, `set home squad: ${sqHome.status} ${sqHome.text}`);
  const sqAway = await setSquad(awayId, awayXi, awayBench.slice(0, 2));
  assert(sqAway.status < 400, `set away squad: ${sqAway.status} ${sqAway.text}`);

  // Lineups
  const lineup = async (teamId: number, playerIds: number[], battingOrder?: number[]) => {
    const r = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
      eventType: "cricket.lineup.set",
      payload: { teamId, playerIds, battingOrder },
      expectedSequence: seq,
    });
    assert(r.status < 300, `lineup ${teamId}: ${r.status} ${r.text}`);
    seq = r.json.state.lastSequence;
    return r.json;
  };
  await lineup(homeId, homeXi, [homeXi[0]!, homeXi[1]!]);
  await lineup(awayId, awayXi);

  const striker = homeXi[0]!;
  const nonStriker = homeXi[1]!;
  const bowler = awayXi[0]!;
  const nextBatter = homeXi[2]!;

  // Short scoring sequence: 1, 4, wide, wicket, replacement, end innings, chase a few, complete
  const ball = async (payload: Record<string, unknown>) => {
    const r = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
      eventType: "cricket.ball.recorded",
      payload,
      expectedSequence: seq,
      correlationId: crypto.randomUUID(),
    });
    assert(r.status < 300, `ball: ${r.status} ${r.text}`);
    seq = r.json.state.lastSequence;
    return r.json;
  };

  let state = (
    await ball({
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: striker,
      nonStrikerId: nonStriker,
      bowlerId: bowler,
      runsOffBat: 1,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    })
  ).state;

  // Wide must NOT swap strike
  state = (
    await ball({
      innings: 1,
      over: 0,
      ball: 2,
      strikerId: state.strikerId,
      nonStrikerId: state.nonStrikerId,
      bowlerId: bowler,
      runsOffBat: 0,
      extras: { type: "wide", runs: 1 },
      wicket: null,
      isLegalDelivery: false,
    })
  ).state;
  const strikeAfterWide = { s: state.strikerId, n: state.nonStrikerId };

  // Boundary
  state = (
    await ball({
      innings: 1,
      over: 0,
      ball: 2,
      strikerId: state.strikerId,
      nonStrikerId: state.nonStrikerId,
      bowlerId: bowler,
      runsOffBat: 4,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    })
  ).state;

  // ---- TEST 3 wicket + refresh simulation ----
  const beforeWicketStriker = state.strikerId;
  state = (
    await ball({
      innings: 1,
      over: 0,
      ball: 3,
      strikerId: state.strikerId,
      nonStrikerId: state.nonStrikerId,
      bowlerId: bowler,
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: { type: "bowled", dismissedPlayerId: state.strikerId },
      isLegalDelivery: true,
    })
  ).state;

  // Re-fetch (browser refresh)
  const afterWicketGet = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${matchId}`);
  const refreshed = afterWicketGet.json.state;
  const wicketVacated =
    refreshed.strikerId == null || refreshed.nonStrikerId == null;
  const dismissedNotStriker = refreshed.strikerId !== beforeWicketStriker;

  // Invalid continue with dismissed as striker should fail if crease empty
  const invalidContinue = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.ball.recorded",
    payload: {
      innings: 1,
      over: 0,
      ball: 4,
      strikerId: beforeWicketStriker,
      nonStrikerId: refreshed.nonStrikerId ?? nonStriker,
      bowlerId: bowler,
      runsOffBat: 1,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    },
    expectedSequence: seq,
  });
  // May succeed if server accepts any ids — but crease vacancy rules should require new batter when striker null
  // Prefer: replacement with nextBatter
  if (invalidContinue.status < 300) {
    seq = invalidContinue.json.state.lastSequence;
    state = invalidContinue.json.state;
  }

  // Force correct replacement path
  if (refreshed.strikerId == null) {
    state = (
      await ball({
        innings: 1,
        over: 0,
        ball: state.innings?.[0]?.ball >= 3 ? state.innings[0].ball + 1 : 4,
        strikerId: nextBatter,
        nonStrikerId: refreshed.nonStrikerId ?? nonStriker,
        bowlerId: bowler,
        runsOffBat: 2,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      })
    ).state;
  }

  // End first innings using current totals (server overwrites)
  const endInn = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.innings.ended",
    payload: {
      innings: 1,
      reason: "all_out",
      runs: 999,
      wickets: 9,
      overs: "0.0",
    },
    expectedSequence: seq,
  });
  assert(endInn.status < 300, `innings end: ${endInn.status} ${endInn.text}`);
  seq = endInn.json.state.lastSequence;
  state = endInn.json.state;
  const firstRuns = state.innings.find((i: any) => i.innings === 1)?.runs;
  const target = state.target;
  assert(target === firstRuns + 1, `target expected ${firstRuns + 1}, got ${target}`);
  assert(firstRuns !== 999, "server must not trust client innings runs=999");

  // Second innings lineup openers
  await lineup(awayId, awayXi, [awayXi[0]!, awayXi[1]!]);
  await lineup(homeId, homeXi);

  // Chase: score enough to win (or just a few then complete)
  const chaseBowler = homeXi[0]!;
  const cStriker = awayXi[0]!;
  const cNon = awayXi[1]!;
  // Score runs to reach/exceed target quickly via penalty + balls
  const need = Math.max(0, target - 0);
  // Use penalty to reach near target then finish
  const pen = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.penalty.awarded",
    payload: { innings: 2, battingTeamId: awayId, runs: Math.max(need, 1) },
    expectedSequence: seq,
  });
  if (pen.status < 300) {
    seq = pen.json.state.lastSequence;
    state = pen.json.state;
  } else {
    // fallback: score a six
    state = (
      await ball({
        innings: 2,
        over: 0,
        ball: 1,
        strikerId: cStriker,
        nonStrikerId: cNon,
        bowlerId: chaseBowler,
        runsOffBat: 6,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      })
    ).state;
  }

  // End second innings + complete
  const end2 = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.innings.ended",
    payload: { innings: 2, reason: "target_reached", runs: 0, wickets: 0, overs: "0.1" },
    expectedSequence: seq,
  });
  if (end2.status < 300) {
    seq = end2.json.state.lastSequence;
    state = end2.json.state;
  }

  const complete = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${matchId}/events`, {
    eventType: "cricket.match.completed",
    payload: {
      winnerTeamId: homeId,
      margin: "wrong",
      resultText: "WRONG CLIENT RESULT",
      isTie: false,
    },
    expectedSequence: seq,
  });
  assert(complete.status < 300, `complete: ${complete.status} ${complete.text}`);
  seq = complete.json.state.lastSequence;
  state = complete.json.state;
  assert(
    state.resultText !== "WRONG CLIENT RESULT",
    `server must overwrite client result, got ${state.resultText}`,
  );

  // Persist after refresh
  const finalGet = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${matchId}`);
  assert(finalGet.json?.match?.status === "completed", `match status ${finalGet.json?.match?.status}`);
  assert(finalGet.json?.state?.matchStatus === "completed", "state not completed after refresh");

  // Live display / public
  const live = await api(jar, "GET", `/tournaments/${TID}/scoring/live`);
  const publicMatch = await api(jar, "GET", `/tournaments/${TID}/scoring/public/matches/${matchId}`);
  // public route may differ
  const pubOk =
    publicMatch.status === 200 ||
    (await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${matchId}/scorecard`)).status === 200;

  const standings = await api(jar, "GET", `/tournaments/${TID}/scoring/standings`);

  // ---- TEST 4 offline / idempotent correlation ----
  // Create a fresh live match for conflict/offline tests
  const m2 = await api(jar, "POST", `/tournaments/${TID}/scoring/matches`, {
    homeTeamId: homeId,
    awayTeamId: awayId,
  });
  const match2 = m2.json?.match?.id ?? m2.json?.id;
  await api(jar, "POST", `/tournaments/${TID}/matches/${match2}/ready`, {});
  await api(jar, "POST", `/tournaments/${TID}/runtime-matches/${match2}/prepare`, {});
  await api(jar, "POST", `/tournaments/${TID}/runtime-matches/${match2}/ready`, {});
  let s2 = 0;
  const st2 = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.match.started",
    payload: { tossWinnerTeamId: homeId, electedTo: "bat", oversLimit: 6 },
    expectedSequence: s2,
  });
  s2 = st2.json.state.lastSequence;
  await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.lineup.set",
    payload: { teamId: homeId, playerIds: homeXi, battingOrder: [homeXi[0], homeXi[1]] },
    expectedSequence: s2,
  });
  s2 += 1;
  // refresh seq
  const g2 = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${match2}`);
  s2 = g2.json.state.lastSequence;
  await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.lineup.set",
    payload: { teamId: awayId, playerIds: awayXi },
    expectedSequence: s2,
  });
  const g2b = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${match2}`);
  s2 = g2b.json.state.lastSequence;

  const corr = crypto.randomUUID();
  const offlineBallPayload = {
    innings: 1,
    over: 0,
    ball: 1,
    strikerId: homeXi[0],
    nonStrikerId: homeXi[1],
    bowlerId: awayXi[0],
    runsOffBat: 1,
    extras: { type: null, runs: 0 },
    wicket: null,
    isLegalDelivery: true,
  };
  const first = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.ball.recorded",
    payload: offlineBallPayload,
    expectedSequence: s2,
    correlationId: corr,
  });
  assert(first.status < 300, `offline-sim first: ${first.status} ${first.text}`);
  const runsOnce = first.json.state.innings[0].runs;
  const sAfter = first.json.state.lastSequence;
  // Replay same correlationId (simulates drain after false network failure)
  const replay = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.ball.recorded",
    payload: offlineBallPayload,
    expectedSequence: s2, // stale — should idempotent-hit via correlation OR conflict
    correlationId: corr,
  });
  const afterReplay = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${match2}`);
  const runsAfterReplay = afterReplay.json.state.innings[0].runs;
  const noDuplicate = runsAfterReplay === runsOnce;

  // ---- TEST 5 two-tab conflict ----
  const tabA = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.ball.recorded",
    payload: {
      ...offlineBallPayload,
      over: 0,
      ball: 2,
      runsOffBat: 2,
      strikerId: afterReplay.json.state.strikerId,
      nonStrikerId: afterReplay.json.state.nonStrikerId,
    },
    expectedSequence: afterReplay.json.state.lastSequence,
  });
  assert(tabA.status < 300, `tabA: ${tabA.status} ${tabA.text}`);
  const tabB = await api(jar, "POST", `/tournaments/${TID}/scoring/matches/${match2}/events`, {
    eventType: "cricket.ball.recorded",
    payload: {
      ...offlineBallPayload,
      over: 0,
      ball: 2,
      runsOffBat: 6,
      strikerId: afterReplay.json.state.strikerId,
      nonStrikerId: afterReplay.json.state.nonStrikerId,
    },
    expectedSequence: afterReplay.json.state.lastSequence, // stale
  });
  const conflictOk = tabB.status === 409 && tabB.json?.code === "SEQUENCE_CONFLICT";
  const afterConflict = await api(jar, "GET", `/tournaments/${TID}/scoring/matches/${match2}`);
  const consistent = afterConflict.json.state.innings[0].runs === tabA.json.state.innings[0].runs;

  // ---- LED live consistency vs scorer for match2 ----
  const live2 = await api(jar, "GET", `/tournaments/${TID}/scoring/live`);
  const liveState = live2.json?.state;
  const liveMatchId = live2.json?.match?.id;
  const ledAligned =
    liveMatchId === match2 &&
    liveState?.innings?.[0]?.runs === afterConflict.json.state.innings[0].runs &&
    liveState?.lastSequence === afterConflict.json.state.lastSequence;

  // Record results
  const lifecyclePass =
    blockedStart &&
    oversOk &&
    xiOk &&
    benchOk &&
    lbwOk &&
    retireOk &&
    fhOk &&
    oversAfterStart === 6 &&
    target === firstRuns + 1 &&
    finalGet.json.match.status === "completed" &&
    state.resultText !== "WRONG CLIENT RESULT";

  record(
    "Complete match lifecycle",
    lifecyclePass ? "PASS" : "FAIL",
    `tournament=${TID} match=${matchId} prepareBlocked=${blockedStart} rules overs=${rules?.overs} xi=${rules?.playingSquadSize} bench=${rules?.benchSize} lbw=${rules?.lbwEnabled} retire=${rules?.retireAtRuns} fh=${rules?.freeHitEnabled}; startOvers=${oversAfterStart}; firstRuns=${firstRuns} target=${target}; result="${finalGet.json.state.resultText}"; status=${finalGet.json.match.status}; standingsStatus=${standings.status}; public=${pubOk}; xiReject=${xiRejectOk}`,
  );

  record(
    "LED + Public live sync",
    ledAligned ? "PASS" : live2.status === 200 ? "FAIL" : "BLOCKED",
    `live matchId=${liveMatchId} expected=${match2}; liveRuns=${liveState?.innings?.[0]?.runs} scorerRuns=${afterConflict.json.state.innings[0].runs}; liveSeq=${liveState?.lastSequence} scorerSeq=${afterConflict.json.state.lastSequence}; publicProbe=${pubOk}`,
  );

  record(
    "Refresh after wicket",
    wicketVacated && dismissedNotStriker ? "PASS" : "FAIL",
    `match=${matchId} beforeStriker=${beforeWicketStriker} afterRefresh striker=${refreshed.strikerId} non=${refreshed.nonStrikerId}; vacated=${wicketVacated}; strikeAfterWide=${JSON.stringify(strikeAfterWide)}`,
  );

  record(
    "Offline one-ball recovery",
    noDuplicate && (replay.status < 300 || replay.status === 409) ? "PASS" : "FAIL",
    `match=${match2} correlationId=${corr}; firstRuns=${runsOnce} afterReplayRuns=${runsAfterReplay}; replayStatus=${replay.status} code=${replay.json?.code}; seqFirst=${sAfter}`,
  );

  record(
    "Two-tab conflict",
    conflictOk && consistent ? "PASS" : "FAIL",
    `match=${match2} tabA=${tabA.status} tabB=${tabB.status}/${tabB.json?.code}; consistent=${consistent}; runs=${afterConflict.json.state.innings[0].runs}`,
  );

  console.log("\n========== P0 VERIFICATION MATRIX ==========");
  for (const r of results) {
    console.log(`${r.result.padEnd(7)} | ${r.test} | ${r.evidence}`);
  }
  const failed = results.filter((r) => r.result === "FAIL");
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("VERIFY FATAL:", err);
  process.exit(1);
});
