/**
 * Measure badminton umpire→LED score latency (T1–T7).
 *
 * Usage:
 *   node artifacts/api-server/scripts/measure-badminton-led-latency.mjs
 *
 * Env:
 *   BENCHMARK_BASE_URL   default http://127.0.0.1:8080
 *   BENCHMARK_TID        default 5
 *   BENCHMARK_RUNS       default 5
 *   BENCHMARK_LED_URL    default http://127.0.0.1:5175
 *   BENCHMARK_SKIP_PLAYWRIGHT=1  skip LED DOM/paint timing
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
const RUNS = Math.max(1, Number(process.env.BENCHMARK_RUNS ?? "5"));
const LED_ORIGIN = process.env.BENCHMARK_LED_URL ?? "http://127.0.0.1:5175";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmt(n) {
  return n == null || !Number.isFinite(n) ? "n/a" : `${n.toFixed(2)} ms`;
}

function avg(nums) {
  const xs = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${opts.method ?? "GET"} ${url} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

/** Minimal SSE client over Node http(s). */
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
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("SSE connect timeout"));
    });
    req.end();
  });
}

function waitForScore(sse, pred, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error("SSE score timeout"));
    }, timeoutMs);
    const off = sse.onMessage((data, t5) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "match_state" && msg.data && pred(msg.data)) {
          clearTimeout(timer);
          off();
          resolve({ t5, state: msg.data });
        }
      } catch {
        // ignore
      }
    });
  });
}

async function measureLedPaint(matchId, side, expectedLeft) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return null;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const ledUrl = `${LED_ORIGIN}/scoring-app/badminton/${matchId}/display?tid=${TID}&latencyProbe=1`;
  await page.goto(ledUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    window.__BW_LAT = {};
  });

  const watchPromise = page.evaluate((expected) => {
    const origin = performance.now();
    return new Promise((resolve) => {
      const done = (t6, t7) =>
        resolve({
          t6_minus_origin_ms: t6 - origin,
          t7_minus_origin_ms: t7 - origin,
        });

      const scoreVisible = () => {
        const texts = [...document.querySelectorAll("body *")]
          .filter((el) => el.children.length === 0)
          .map((el) => el.textContent?.trim())
          .filter(Boolean);
        return texts.includes(String(expected));
      };

      const obs = new MutationObserver(() => {
        if (!scoreVisible()) return;
        const t6 = performance.now();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => done(t6, performance.now()));
        });
        obs.disconnect();
        clearInterval(poll);
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });

      const poll = setInterval(() => {
        if (!scoreVisible()) return;
        const t6 = performance.now();
        clearInterval(poll);
        obs.disconnect();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => done(t6, performance.now()));
        });
      }, 16);

      setTimeout(() => {
        clearInterval(poll);
        obs.disconnect();
        resolve({ t6_minus_origin_ms: null, t7_minus_origin_ms: null });
      }, 15000);
    });
  }, expectedLeft);

  const t1 = performance.now();
  const pointBody = await jsonFetch(`${BASE}/api/tournaments/${TID}/badminton/latency-probe/point`, {
    method: "POST",
    body: JSON.stringify({ matchId, side }),
  });
  const ledMarks = await watchPromise;
  await browser.close();

  return { t1, pointBody, ledMarks };
}

async function measureOne(expectedLeft, matchId, withLed) {
  const sse = await openSse(`${BASE}/api/tournaments/${TID}/badminton/stream?matchId=${matchId}`);
  await sleep(400);

  const sseWait = waitForScore(sse, (s) => Number(s.leftScore) === expectedLeft);

  let t1;
  let pointBody;
  let led = null;

  if (withLed) {
    try {
      const r = await measureLedPaint(matchId, "left", expectedLeft);
      if (r) {
        t1 = r.t1;
        pointBody = r.pointBody;
        led = r.ledMarks;
      }
    } catch (err) {
      console.warn(`  LED/Playwright skipped: ${err.message}`);
    }
  }

  if (!pointBody) {
    t1 = performance.now();
    pointBody = await jsonFetch(`${BASE}/api/tournaments/${TID}/badminton/latency-probe/point`, {
      method: "POST",
      body: JSON.stringify({ matchId, side: "left" }),
    });
  }

  const { t5, state } = await sseWait;
  sse.close();

  const marks = pointBody.marks ?? {};
  const lat = pointBody._latency ?? {};

  return {
    expectedLeft,
    leftScore: state.leftScore,
    rightScore: state.rightScore,
    t5_minus_t1_ms: t5 - t1,
    t3_minus_t2_ms: lat.server_processing_ms,
    t4_minus_t3_ms: lat.broadcast_delay_ms,
    t4_minus_t2_ms:
      marks.t4_sse_emitted != null
        ? marks.t4_sse_emitted - (marks.t2_request_entered ?? 0)
        : null,
    t5_minus_t4_approx_ms:
      marks.t4_sse_emitted != null ? t5 - t1 - marks.t4_sse_emitted : null,
    t6_minus_t1_ms: led?.t6_minus_origin_ms ?? null,
    t7_minus_t1_ms: led?.t7_minus_origin_ms ?? null,
    t7_minus_t6_ms:
      led?.t6_minus_origin_ms != null && led?.t7_minus_origin_ms != null
        ? led.t7_minus_origin_ms - led.t6_minus_origin_ms
        : null,
    marks,
  };
}

function printRow(row, i) {
  console.log(`\n── Run ${i} (score ${row.leftScore}-${row.rightScore}) ──`);
  console.log(`  T1 .......................... 0.00 ms (client POST send / LED watch origin)`);
  console.log(`  T2 − T1 (network) ............ ~0–2 ms localhost (probe in-process on API)`);
  console.log(`  T3 − T2 (server→DB write) .... ${fmt(row.t3_minus_t2_ms)}`);
  console.log(`  T4 − T3 (audit→SSE emit) ..... ${fmt(row.t4_minus_t3_ms)}`);
  console.log(`  T4 − T2 (server total) ....... ${fmt(row.t4_minus_t2_ms)}`);
  console.log(`  T5 − T1 (SSE received) ....... ${fmt(row.t5_minus_t1_ms)}`);
  console.log(`  T5 − T4 (SSE network approx) . ${fmt(row.t5_minus_t4_approx_ms)}`);
  console.log(`  T6 − T1 (DOM/React) .......... ${fmt(row.t6_minus_t1_ms)}`);
  console.log(`  T7 − T1 (painted) ............ ${fmt(row.t7_minus_t1_ms)}`);
  console.log(`  T7 − T6 (render) ............. ${fmt(row.t7_minus_t6_ms)}`);
  console.log(`  Server marks (ms from T2):`);
  for (const [k, v] of Object.entries(row.marks).sort((a, b) => a[1] - b[1])) {
    console.log(`    ${k.padEnd(28)} ${Number(v).toFixed(2)}`);
  }
}

async function main() {
  console.log("Badminton LED latency measurement");
  console.log(`  API ........ ${BASE}`);
  console.log(`  Tournament . ${TID}`);
  console.log(`  Runs ....... ${RUNS}`);
  console.log(`  LED ........ ${LED_ORIGIN}`);

  await jsonFetch(`${BASE}/api/healthz`);

  const setup = await jsonFetch(`${BASE}/api/tournaments/${TID}/badminton/latency-probe/setup`, {
    method: "POST",
    body: "{}",
  });
  console.log(`\nProbe match #${setup.matchId} on ${setup.courtNumber}`);

  const skipPw = process.env.BENCHMARK_SKIP_PLAYWRIGHT === "1";
  const rows = [];

  for (let i = 1; i <= RUNS; i++) {
    try {
      const withLed = !skipPw && (i === 1 || process.env.BENCHMARK_LED_EVERY === "1");
      const row = await measureOne(i, setup.matchId, withLed);
      printRow(row, i);
      rows.push(row);
    } catch (err) {
      console.error(`Run ${i} failed:`, err.message);
    }
  }

  await jsonFetch(`${BASE}/api/tournaments/${TID}/badminton/latency-probe/cleanup`, {
    method: "POST",
    body: JSON.stringify({ matchId: setup.matchId }),
  }).catch((e) => console.warn("Cleanup:", e.message));

  const t3 = avg(rows.map((r) => r.t3_minus_t2_ms));
  const t4 = avg(rows.map((r) => r.t4_minus_t3_ms));
  const t5 = avg(rows.map((r) => r.t5_minus_t1_ms));
  const t5t4 = avg(rows.map((r) => r.t5_minus_t4_approx_ms));
  const t6 = avg(rows.map((r) => r.t6_minus_t1_ms));
  const t7 = avg(rows.map((r) => r.t7_minus_t1_ms));
  const t7t6 = avg(rows.map((r) => r.t7_minus_t6_ms));

  // Segment durations inside server marks
  function seg(from, to) {
    const vals = rows
      .map((r) => {
        const a = r.marks[from];
        const b = r.marks[to];
        return a != null && b != null ? b - a : null;
      })
      .filter((v) => v != null);
    return avg(vals);
  }

  const internal = [
    { name: "loadCurrentMatchState (events+replay+snapshot)", ms: seg("awardPoint_enter", "awardPoint_state_loaded"), file: "badminton-service.ts → loadCurrentMatchState" },
    { name: "persist batch + post-persist replay + snapshot", ms: seg("awardPoint_command_ok", "awardPoint_persist_done"), file: "badminton-service.ts → persistBadmintonCommandEvents (projectionMode: replay)" },
    { name: "writeScorerAudit", ms: seg("awardPoint_returned", "audit_written"), file: "routes/badminton.ts + scorer-audit.ts → writeScorerAudit" },
    { name: "SSE fanout write", ms: seg("pre_broadcast", "t4_sse_emitted"), file: "badminton-broadcast.ts → broadcastBadmintonMatchUpdate" },
  ];

  console.log(`\n════════ SUMMARY (n=${rows.length}) ════════`);
  console.log(`  T2 − T1 ...................... ~0–2 ms (localhost)`);
  console.log(`  T3 − T2 ...................... ${fmt(t3)}`);
  console.log(`  T4 − T3 ...................... ${fmt(t4)}`);
  console.log(`  T5 − T1 ...................... ${fmt(t5)}`);
  console.log(`  T5 − T4 (approx) ............. ${fmt(t5t4)}`);
  console.log(`  T6 − T1 ...................... ${fmt(t6)}`);
  console.log(`  T7 − T1 ...................... ${fmt(t7)}`);
  console.log(`  T7 − T6 ...................... ${fmt(t7t6)}`);

  console.log(`\n  Internal server segments:`);
  for (const s of internal) {
    console.log(`    ${s.name.padEnd(52)} ${fmt(s.ms)}`);
  }

  const candidates = [
    { name: "T3−T2 server processing", ms: t3, file: "artifacts/api-server/src/lib/badminton-service.ts → awardPoint (full event replay twice)" },
    { name: "T4−T3 broadcast delay", ms: t4, file: "artifacts/api-server/src/routes/badminton.ts → await writeScorerAudit before broadcast" },
    { name: "T5−T4 SSE delivery", ms: t5t4, file: "artifacts/api-server/src/lib/badminton-broadcast.ts" },
    { name: "T6−T5 React apply", ms: t6 != null && t5 != null ? t6 - t5 : null, file: "use-badminton-match.ts → setQueryData" },
    { name: "T7−T6 paint", ms: t7t6, file: "broadcast-display.tsx" },
    ...internal.map((s) => ({ name: s.name, ms: s.ms, file: s.file })),
  ].filter((c) => c.ms != null && Number.isFinite(c.ms));

  candidates.sort((a, b) => b.ms - a.ms);
  const top = candidates[0] ?? {
    name: "no successful runs",
    ms: null,
    file: "n/a",
  };

  console.log(`\n  ★ LARGEST MEASURED SEGMENT`);
  console.log(`    ${top.name} = ${fmt(top.ms)}`);
  console.log(`    File/function: ${top.file}`);

  const outDir = join(__dirname, "../test-reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "badminton-led-latency-report.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        when: new Date().toISOString(),
        base: BASE,
        tid: TID,
        rows,
        summary: { t3, t4, t5, t5t4, t6, t7, t7t6, top, internal },
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
