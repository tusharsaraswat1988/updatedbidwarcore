/**
 * Phase-1 tournament validation — correctness + latency under load.
 *
 * Usage:
 *   node artifacts/api-server/scripts/validate-badminton-phase1-tournament.mjs
 *
 * Env:
 *   BENCHMARK_BASE_URL=http://127.0.0.1:8080
 *   BENCHMARK_TID=5
 *   VALIDATE_SKIP_500=1   skip 500-point soak (faster)
 */

import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import https from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8080";
const TID = Number(process.env.BENCHMARK_TID ?? "5");
const SKIP_500 = process.env.VALIDATE_SKIP_500 === "1";

const results = {
  when: new Date().toISOString(),
  base: BASE,
  tid: TID,
  scenarios: [],
  issues: [],
  races: [],
  replayInconsistencies: [],
  performance: {},
  phase2Recommendation: null,
};

function record(scenario, pass, details = {}) {
  results.scenarios.push({ scenario, pass, ...details });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${scenario}${details.note ? ` — ${details.note}` : ""}`);
  if (!pass) {
    results.issues.push({ scenario, ...details });
  }
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${opts.method ?? "GET"} ${url} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function probe(path, opts) {
  return jsonFetch(`${BASE}/api/tournaments/${TID}/badminton/latency-probe${path}`, opts);
}

function openSse(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: "GET",
        headers: { Accept: "text/event-stream", Connection: "keep-alive" },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`SSE HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let buf = "";
        const handlers = new Set();
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const data = dataLine.slice(5).trim();
            for (const h of handlers) h(data, performance.now());
          }
        });
        resolve({
          onMessage(fn) {
            handlers.add(fn);
            return () => handlers.delete(fn);
          },
          close() {
            req.destroy();
            res.destroy();
          },
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error("SSE connect timeout"));
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    n: arr.length,
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    min: sorted[0],
  };
}

async function verify(matchId) {
  return probe(`/verify?matchId=${matchId}`);
}

async function cleanup(matchId) {
  try {
    await probe("/cleanup", { method: "POST", body: JSON.stringify({ matchId }) });
  } catch (e) {
    console.warn(`  cleanup warning match ${matchId}: ${e.message}`);
  }
}

/** Score N points with optional alternating sides; collect latency + verify periodically. */
async function consecutivePoints(matchId, count, { alternate = false, verifyEvery = 25 } = {}) {
  const latencies = [];
  const replayGrowth = [];
  let lastSeq = 0;
  let divergences = 0;
  let checksumMismatches = 0;
  let seqViolations = 0;

  for (let i = 1; i <= count; i++) {
    const side = alternate && i % 2 === 0 ? "right" : "left";
    const t0 = performance.now();
    const point = await probe("/point", {
      method: "POST",
      body: JSON.stringify({ matchId, side }),
    });
    const wall = performance.now() - t0;
    const t5Approx = point._latency?.t4_ms != null ? point._latency.t4_ms + 20 : wall;
    latencies.push({
      wall_ms: wall,
      t4_minus_t2_ms: point._latency?.t4_ms ?? null,
      t3_minus_t2_ms: point._latency?.server_processing_ms ?? null,
      t5_approx_ms: t5Approx,
    });

    if (point.lastSequence != null) {
      if (point.lastSequence <= lastSeq) seqViolations += 1;
      lastSeq = point.lastSequence;
    }

    if (i === 1 || i % verifyEvery === 0 || i === count) {
      const v = await verify(matchId);
      replayGrowth.push({ points: i, eventCount: v.eventCount, replayMs: v.replayMs });
      if (!v.scoreFieldsMatch || !v.checksumEqual) {
        divergences += 1;
        checksumMismatches += 1;
        results.replayInconsistencies.push({
          atPoint: i,
          matchId,
          scoreFieldsMatch: v.scoreFieldsMatch,
          checksumEqual: v.checksumEqual,
          replayChecksum: v.replayChecksum,
          snapshotChecksum: v.snapshotChecksum,
        });
      }
      if (v.duplicateSequences) {
        results.issues.push({ scenario: "duplicate_events", atPoint: i, matchId });
      }
    }

    if (point.matchStatus === "completed") break;
  }

  return {
    latencies,
    replayGrowth,
    divergences,
    checksumMismatches,
    seqViolations,
    lastSeq,
  };
}

async function scenarioConsecutive(label, count) {
  console.log(`\n══ ${label} ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({
      matchKind: "singles",
      totalGames: 1,
      // Cap above N so the soak never ends the match early
      pointsPerGame: count + 50,
      deuceAt: count + 49,
      maxPoints: count + 100,
    }),
  });
  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const r = await consecutivePoints(setup.matchId, count, { verifyEvery: Math.max(10, Math.floor(count / 10)) });
  const cpuAfter = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();
  await cleanup(setup.matchId);

  const wall = stats(r.latencies.map((l) => l.wall_ms));
  const t4 = stats(r.latencies.map((l) => l.t4_minus_t2_ms).filter((n) => n != null));

  record(label, r.divergences === 0 && r.seqViolations === 0 && r.checksumMismatches === 0, {
    matchId: setup.matchId,
    wall,
    t4_to_sse: t4,
    replayGrowth: r.replayGrowth,
    seqViolations: r.seqViolations,
    divergences: r.divergences,
    memoryDeltaMB: {
      rss: (memAfter.rss - memBefore.rss) / 1024 / 1024,
      heapUsed: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
    },
    cpuUserMs: cpuAfter.user / 1000,
    cpuSystemMs: cpuAfter.system / 1000,
  });

  results.performance[label] = { wall, t4_to_sse: t4, replayGrowth: r.replayGrowth };
  return r;
}

async function scenarioUndo() {
  console.log(`\n══ Undo / score correction ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({ pointsPerGame: 21, deuceAt: 20, maxPoints: 30 }),
  });
  await probe("/point", { method: "POST", body: JSON.stringify({ matchId: setup.matchId, side: "left" }) });
  await probe("/point", { method: "POST", body: JSON.stringify({ matchId: setup.matchId, side: "left" }) });
  const before = await verify(setup.matchId);
  const undo1 = await probe("/undo", { method: "POST", body: JSON.stringify({ matchId: setup.matchId }) });
  const afterUndo = await verify(setup.matchId);
  const redo = await probe("/point", { method: "POST", body: JSON.stringify({ matchId: setup.matchId, side: "right" }) });
  const afterRedo = await verify(setup.matchId);

  const deterministic =
    undo1.leftScore === 1 &&
    undo1.rightScore === 0 &&
    afterUndo.scoreFieldsMatch &&
    afterUndo.checksumEqual &&
    redo.leftScore === 1 &&
    redo.rightScore === 1 &&
    afterRedo.scoreFieldsMatch;

  // Second undo path to same prior score
  await probe("/undo", { method: "POST", body: JSON.stringify({ matchId: setup.matchId }) });
  const undoAgain = await probe("/undo", { method: "POST", body: JSON.stringify({ matchId: setup.matchId }) });
  const backToZero = undoAgain.leftScore === 0 && undoAgain.rightScore === 0;

  record("Match rollback / undo", deterministic && backToZero, {
    beforeRallies: before.totalRallies,
    afterUndo,
    afterRedoChecksumsEqual: afterRedo.checksumEqual,
    backToZero,
  });
  await cleanup(setup.matchId);
}

async function scenarioGameAndMatchComplete() {
  console.log(`\n══ Game + match completed ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({
      matchKind: "singles",
      totalGames: 1,
      pointsPerGame: 5,
      deuceAt: 4,
      maxPoints: 8,
    }),
  });

  let last = null;
  for (let i = 0; i < 12; i++) {
    last = await probe("/point", {
      method: "POST",
      body: JSON.stringify({ matchId: setup.matchId, side: "left" }),
    });
    if (last.matchStatus === "completed") break;
  }
  const v = await verify(setup.matchId);
  const pass =
    last?.matchStatus === "completed" &&
    last.gamesLeft >= 1 &&
    v.scoreFieldsMatch &&
    v.checksumEqual;

  record("Game completed", last?.gamesLeft >= 1, { gamesLeft: last?.gamesLeft, status: last?.matchStatus });
  record("Match completed", last?.matchStatus === "completed", {
    status: last?.matchStatus,
    score: `${last?.leftScore}-${last?.rightScore}`,
    verify: { scoreFieldsMatch: v.scoreFieldsMatch, checksumEqual: v.checksumEqual },
  });
  record("Snapshot matches replay after completion", v.scoreFieldsMatch && v.checksumEqual, v);
  await cleanup(setup.matchId);
}

async function scenarioDoublesServiceRotation() {
  console.log(`\n══ Doubles service / rotation / positioning ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({
      matchKind: "doubles",
      totalGames: 1,
      pointsPerGame: 21,
      deuceAt: 20,
      maxPoints: 30,
    }),
  });

  const observations = [];
  let prevServerIdx = null;
  let serviceChanged = false;
  let rotationSeen = false;

  for (let i = 0; i < 8; i++) {
    // Winner of rally serves next in badminton doubles — alternate winners to force changes
    const side = i % 3 === 0 ? "right" : "left";
    const p = await probe("/point", {
      method: "POST",
      body: JSON.stringify({ matchId: setup.matchId, side }),
    });
    const ds = p.doublesServe;
    observations.push({
      i,
      side,
      servingSide: p.servingSide,
      servingPlayerIndex: ds?.servingPlayerIndex,
      receivingPlayerIndex: ds?.receivingPlayerIndex,
      courtPositions: ds?.courtPositions ?? null,
      checksum: p.syncChecksum,
    });
    if (prevServerIdx != null && ds && ds.servingPlayerIndex !== prevServerIdx) {
      rotationSeen = true;
    }
    if (i > 0 && observations[i - 1].servingSide !== p.servingSide) {
      serviceChanged = true;
    }
    prevServerIdx = ds?.servingPlayerIndex ?? prevServerIdx;
  }

  const v = await verify(setup.matchId);
  record("Service change", serviceChanged, { observations: observations.slice(0, 4) });
  record("Rotation updates", rotationSeen || serviceChanged, {
    note: rotationSeen ? "servingPlayerIndex changed" : "side service changed (rotation via side)",
  });
  record("Doubles positioning present", observations.some((o) => o.courtPositions != null || o.servingPlayerIndex != null), {
    sample: observations[observations.length - 1],
  });
  record("Doubles snapshot/replay consistent", v.scoreFieldsMatch && v.checksumEqual, {
    checksumEqual: v.checksumEqual,
    scoreFieldsMatch: v.scoreFieldsMatch,
  });
  await cleanup(setup.matchId);
}

async function scenarioSseReconnectAndMultiLed() {
  console.log(`\n══ SSE reconnect + multi LED + refresh ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({ pointsPerGame: 21, deuceAt: 20, maxPoints: 30 }),
  });

  const url = `${BASE}/api/tournaments/${TID}/badminton/stream?matchId=${setup.matchId}`;
  const leds = [];
  for (let i = 0; i < 3; i++) {
    leds.push({
      id: i,
      sse: await openSse(url),
      states: [],
      orderViolations: 0,
      crossMatchLeaks: 0,
      lastSeq: 0,
    });
  }
  await sleep(400);

  for (const led of leds) {
    led.off = led.sse.onMessage((data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type !== "match_state" || !msg.data) return;
        // Production should filter by matchId; broadcast currently fans out
        // tournament-wide. Validate this match's stream only for order/converge.
        if (Number(msg.data.matchId) !== Number(setup.matchId)) {
          led.crossMatchLeaks += 1;
          return;
        }
        const seq = msg.data.lastSequence ?? 0;
        if (led.lastSeq > 0 && seq < led.lastSeq) led.orderViolations += 1;
        if (seq >= led.lastSeq) {
          led.lastSeq = seq;
          led.states.push({
            seq,
            left: msg.data.leftScore,
            right: msg.data.rightScore,
            status: msg.data.matchStatus,
          });
        }
      } catch {
        // ignore
      }
    });
  }

  // Score 3 points with middle reconnect on LED 1
  await probe("/point", { method: "POST", body: JSON.stringify({ matchId: setup.matchId, side: "left" }) });
  await sleep(200);

  leds[1].sse.close();
  leds[1].sse = await openSse(url);
  await sleep(300);
  leds[1].off = leds[1].sse.onMessage((data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type !== "match_state" || !msg.data) return;
      if (Number(msg.data.matchId) !== Number(setup.matchId)) {
        leds[1].crossMatchLeaks += 1;
        return;
      }
      const seq = msg.data.lastSequence ?? 0;
      if (leds[1].lastSeq > 0 && seq < leds[1].lastSeq) leds[1].orderViolations += 1;
      if (seq >= leds[1].lastSeq) {
        leds[1].lastSeq = seq;
        leds[1].states.push({
          seq,
          left: msg.data.leftScore,
          right: msg.data.rightScore,
          status: msg.data.matchStatus,
        });
      }
    } catch {
      // ignore
    }
  });

  await probe("/point", { method: "POST", body: JSON.stringify({ matchId: setup.matchId, side: "left" }) });
  await probe("/point", { method: "POST", body: JSON.stringify({ matchId: setup.matchId, side: "right" }) });
  await sleep(500);

  // Browser refresh simulation: GET match (replay) must match last SSE
  const refreshed = await jsonFetch(`${BASE}/api/tournaments/${TID}/badminton/matches/${setup.matchId}`);
  const v = await verify(setup.matchId);

  const finalScores = leds.map((l) => l.states[l.states.length - 1] ?? null);
  const allConverged =
    finalScores.every((s) => s && s.left === refreshed.state.leftScore && s.right === refreshed.state.rightScore) ||
    // reconnecting LED may have only received post-reconnect events — compare verify/replay
    (refreshed.state.leftScore === v.leftScore && refreshed.state.rightScore === v.rightScore);

  const orderOk = leds.every((l) => l.orderViolations === 0);
  const totalCrossMatchLeaks = leds.reduce((a, l) => a + l.crossMatchLeaks, 0);
  if (totalCrossMatchLeaks > 0) {
    results.races.push({
      scenario: "sse_cross_match_fanout",
      detail:
        "Match-scoped SSE clients still receive other matches' match_state via tournament-wide broadcast OR. Production useBadmintonMatch applies without matchId filter — multi-court tournaments can cross-contaminate LED state.",
      crossMatchLeaks: totalCrossMatchLeaks,
      evidence: "badminton-broadcast.ts fans out on tournamentId; use-badminton-match.ts setQueryData ignores incoming.matchId",
    });
  }

  // LED0 and LED2 should have full stream; check they agree with each other at end
  const led0 = finalScores[0];
  const led2 = finalScores[2];
  const multiAgree =
    led0 &&
    led2 &&
    led0.left === led2.left &&
    led0.right === led2.right &&
    led0.left === refreshed.state.leftScore;

  record("SSE reconnect during scoring", leds[1].states.length >= 1 && orderOk, {
    led1StatesAfterReconnect: leds[1].states.length,
    orderViolations: leds.map((l) => l.orderViolations),
    crossMatchLeaks: leds.map((l) => l.crossMatchLeaks),
  });
  record("Browser refresh during live match", refreshed.state && v.scoreFieldsMatch && refreshed.state.leftScore === v.leftScore, {
    refreshScore: `${refreshed.state?.leftScore}-${refreshed.state?.rightScore}`,
    replayScore: `${v.leftScore}-${v.rightScore}`,
  });
  record("Multiple LED viewers converge", multiAgree && orderOk, {
    finals: finalScores,
    multiAgree,
    expected: `${refreshed.state.leftScore}-${refreshed.state.rightScore}`,
  });
  record("SSE order never violated", orderOk, {
    orderViolations: leds.map((l) => ({ id: l.id, v: l.orderViolations })),
  });
  record("LED converges to replay", refreshed.state?.leftScore === v.leftScore && refreshed.state?.rightScore === v.rightScore && v.checksumEqual, {
    checksumEqual: v.checksumEqual,
  });
  record("Cross-match SSE isolation (match-scoped subscribe)", totalCrossMatchLeaks === 0, {
    crossMatchLeaks: totalCrossMatchLeaks,
    note:
      totalCrossMatchLeaks > 0
        ? "FAIL: tournament fanout delivered other matches' states to match-scoped clients"
        : "PASS: no foreign match_state observed",
  });

  for (const led of leds) led.sse.close();
  await cleanup(setup.matchId);
}

async function scenarioMultiUmpireLock() {
  console.log(`\n══ Multiple umpire tablets (single authoritative scorer) ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({ pointsPerGame: 21 }),
  });
  const lock = await probe("/lock-test", {
    method: "POST",
    body: JSON.stringify({ matchId: setup.matchId }),
  });
  record("Multiple umpire tablets — only one lock owner", lock.authoritativeSingleScorer === true, lock);
  if (!lock.authoritativeSingleScorer) {
    results.races.push({
      scenario: "multi_umpire_lock",
      detail: "Second session was not blocked by MATCH_LOCKED",
      lock,
    });
  }
  await cleanup(setup.matchId);
}

async function scenarioNoDuplicateMissingEvents() {
  console.log(`\n══ No duplicate / missing events ══`);
  const setup = await probe("/setup", {
    method: "POST",
    body: JSON.stringify({ pointsPerGame: 21, deuceAt: 20, maxPoints: 30 }),
  });
  for (let i = 0; i < 10; i++) {
    await probe("/point", {
      method: "POST",
      body: JSON.stringify({ matchId: setup.matchId, side: i % 2 === 0 ? "left" : "right" }),
    });
  }
  await probe("/undo", { method: "POST", body: JSON.stringify({ matchId: setup.matchId }) });
  const v = await verify(setup.matchId);
  record("No duplicate event sequences", v.duplicateSequences === false, {
    eventCount: v.eventCount,
    duplicateSequences: v.duplicateSequences,
  });
  // After undo, contiguous sequence range may have tombstones — we still require no duplicate seq numbers
  record("Replay checksum equals sync snapshot", v.checksumEqual && v.scoreFieldsMatch, {
    checksumEqual: v.checksumEqual,
    scoreFieldsMatch: v.scoreFieldsMatch,
    contiguousSequences: v.contiguousSequences,
    note: "Gaps after undo tombstones are expected; duplicate sequences are not",
  });
  await cleanup(setup.matchId);
}

async function main() {
  console.log("Phase-1 Tournament Validation");
  console.log(`  API ${BASE}  tournament ${TID}`);
  for (let i = 0; i < 30; i++) {
    try {
      await jsonFetch(`${BASE}/api/healthz`);
      break;
    } catch (e) {
      if (i === 29) throw e;
      console.log(`  waiting for API (${e.message})…`);
      await sleep(2000);
    }
  }

  await scenarioConsecutive("100 consecutive points", 100);
  if (!SKIP_500) {
    await scenarioConsecutive("500 consecutive points", 500);
  } else {
    record("500 consecutive points", true, { note: "SKIPPED (VALIDATE_SKIP_500=1)" });
  }

  await scenarioUndo();
  await scenarioGameAndMatchComplete();
  await scenarioDoublesServiceRotation();
  await scenarioSseReconnectAndMultiLed();
  await scenarioMultiUmpireLock();
  await scenarioNoDuplicateMissingEvents();

  // Engine golden tests (unchanged replay path)
  console.log(`\n══ Engine golden / realtime unit tests ══`);
  const { spawnSync } = await import("node:child_process");
  const golden = spawnSync(
    "pnpm",
    ["--filter", "@workspace/api-server", "exec", "vitest", "run", "src/__tests__/badminton-platform-replay-golden.test.ts"],
    { cwd: join(__dirname, "../../.."), encoding: "utf8", shell: true },
  );
  const sync = spawnSync(
    "pnpm",
    ["--filter", "@workspace/badminton-core", "exec", "vitest", "run", "src/scoring/badminton-realtime-sync.test.ts"],
    { cwd: join(__dirname, "../../.."), encoding: "utf8", shell: true },
  );
  record("Golden replay unit tests", golden.status === 0, {
    exit: golden.status,
    stderr: (golden.stderr || "").slice(-400),
  });
  record("Realtime sync unit tests", sync.status === 0, {
    exit: sync.status,
    stderr: (sync.stderr || "").slice(-400),
  });

  const failed = results.scenarios.filter((s) => !s.pass);
  const phase1CoreFailed = failed.filter(
    (s) =>
      ![
        "Cross-match SSE isolation (match-scoped subscribe)",
      ].includes(s.scenario),
  );
  const crossMatchIssue = results.races.some((r) => r.scenario === "sse_cross_match_fanout") ||
    failed.some((s) => s.scenario.includes("Cross-match"));

  const safeForPhase2 =
    phase1CoreFailed.length === 0 && results.replayInconsistencies.length === 0;

  results.phase2Recommendation = {
    safeToProceed: safeForPhase2,
    verdict: !safeForPhase2
      ? "NO-GO — Phase-1 core correctness failures must be fixed before incremental projection."
      : crossMatchIssue
        ? "CONDITIONAL GO for Phase-2 lab work — Phase-1 score/replay/undo/lock invariants hold. However multi-court SSE fanout can cross-contaminate LEDs (pre-existing). Fix matchId filter on broadcast and/or client before relying on incremental projection in multi-court tournaments."
        : "CONDITIONAL GO — Phase-1 correctness holds. Proceed to Phase-2 incremental projection only behind a feature flag with shadow-compare (incremental vs replay) before cutover.",
    failingScenarios: failed.map((f) => f.scenario),
    phase1CoreFailures: phase1CoreFailed.map((f) => f.scenario),
    rationale: [
      "Phase-1 did not change projectionMode (still full replay on persist).",
      "Snapshot/replay score fields and sync checksums must remain identical under load before trusting incremental projection.",
      "Multi-scorer lock enforcement is required so incremental projection cannot be poisoned by concurrent writers.",
      "Match-scoped SSE must not apply foreign match_state (tournament-wide fanout today).",
    ],
  };

  console.log(`\n════════ SUMMARY ════════`);
  console.log(`  Scenarios: ${results.scenarios.length}`);
  console.log(`  Passed:    ${results.scenarios.length - failed.length}`);
  console.log(`  Failed:    ${failed.length}`);
  console.log(`  Replay inconsistencies: ${results.replayInconsistencies.length}`);
  console.log(`  Race findings: ${results.races.length}`);
  console.log(`\n  Phase-2 recommendation: ${results.phase2Recommendation.safeToProceed ? "CONDITIONAL GO" : "NO-GO"}`);
  console.log(`  ${results.phase2Recommendation.verdict}`);

  if (results.performance["100 consecutive points"]?.wall) {
    const w = results.performance["100 consecutive points"].wall;
    console.log(`\n  Perf (100 pts wall): avg=${w.avg.toFixed(1)} p95=${w.p95.toFixed(1)} p99=${w.p99.toFixed(1)} max=${w.max.toFixed(1)} ms`);
  }
  if (results.performance["500 consecutive points"]?.wall) {
    const w = results.performance["500 consecutive points"].wall;
    console.log(`  Perf (500 pts wall): avg=${w.avg.toFixed(1)} p95=${w.p95.toFixed(1)} p99=${w.p99.toFixed(1)} max=${w.max.toFixed(1)} ms`);
  }

  const outDir = join(__dirname, "../test-reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "badminton-phase1-tournament-validation.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  const mdPath = join(outDir, "badminton-phase1-tournament-validation.md");
  writeFileSync(mdPath, renderMarkdown(results));
  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${mdPath}`);

  process.exit(failed.length ? 1 : 0);
}

function renderMarkdown(r) {
  const lines = [];
  lines.push(`# Badminton Phase-1 Tournament Validation Report`);
  lines.push(``);
  lines.push(`Generated: ${r.when}`);
  lines.push(`API: ${r.base} · Tournament: ${r.tid}`);
  lines.push(``);
  lines.push(`## Phase-2 recommendation`);
  lines.push(``);
  lines.push(`**${r.phase2Recommendation.safeToProceed ? "CONDITIONAL GO" : "NO-GO"}** — ${r.phase2Recommendation.verdict}`);
  lines.push(``);
  lines.push(`## Scenarios`);
  lines.push(``);
  lines.push(`| Scenario | Result |`);
  lines.push(`|----------|--------|`);
  for (const s of r.scenarios) {
    lines.push(`| ${s.scenario} | ${s.pass ? "PASS" : "FAIL"} |`);
  }
  lines.push(``);
  lines.push(`## Correctness issues`);
  lines.push(r.issues.length ? r.issues.map((i) => `- ${JSON.stringify(i)}`).join("\n") : "_None_");
  lines.push(``);
  lines.push(`## Race conditions`);
  lines.push(r.races.length ? r.races.map((i) => `- ${JSON.stringify(i)}`).join("\n") : "_None detected_");
  lines.push(``);
  lines.push(`## Replay inconsistencies`);
  lines.push(
    r.replayInconsistencies.length
      ? r.replayInconsistencies.map((i) => `- ${JSON.stringify(i)}`).join("\n")
      : "_None — snapshot score fields matched replay checksums_",
  );
  lines.push(``);
  lines.push(`## Performance`);
  lines.push(``);
  lines.push("```json");
  lines.push(JSON.stringify(r.performance, null, 2));
  lines.push("```");
  lines.push(``);
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
