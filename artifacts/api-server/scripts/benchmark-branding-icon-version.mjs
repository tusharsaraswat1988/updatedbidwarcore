/**
 * Benchmark GET /api/branding/icon-version — warm-cache polling simulation.
 *
 * Usage (from repo root):
 *   node artifacts/api-server/scripts/benchmark-branding-icon-version.mjs
 *
 * Requires a running API server (default http://127.0.0.1:5000).
 */
import { performance } from "node:perf_hooks";

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:5000";
const ENDPOINT = `${BASE_URL}/api/branding/icon-version`;

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function timedFetch() {
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, { cache: "no-store" });
  const body = await res.json();
  const ms = performance.now() - t0;
  return { ms, status: res.status, body };
}

async function runSequential(count) {
  const durations = [];
  let lastBody = null;
  for (let i = 0; i < count; i++) {
    const { ms, status, body } = await timedFetch();
    if (status !== 200) throw new Error(`Request ${i + 1} failed: HTTP ${status}`);
    durations.push(ms);
    lastBody = body;
  }
  durations.sort((a, b) => a - b);
  return {
    count,
    lastBody,
    min: durations[0],
    max: durations[durations.length - 1],
    avg: durations.reduce((s, d) => s + d, 0) / durations.length,
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    durations,
  };
}

function printStats(label, stats) {
  console.log(`\n${label}`);
  console.log(`  Requests ........... ${stats.count}`);
  console.log(`  Version ............ ${stats.lastBody?.version ?? "n/a"}`);
  console.log(`  Min ................ ${stats.min.toFixed(2)} ms`);
  console.log(`  Average ............ ${stats.avg.toFixed(2)} ms`);
  console.log(`  P95 ................ ${stats.p95.toFixed(2)} ms`);
  console.log(`  P99 ................ ${stats.p99.toFixed(2)} ms`);
  console.log(`  Max ................ ${stats.max.toFixed(2)} ms`);
}

async function main() {
  console.log(`Benchmarking ${ENDPOINT}`);

  let cold;
  try {
    cold = await timedFetch();
  } catch (err) {
    console.error(`\nFailed to reach server at ${BASE_URL}`);
    console.error("Start the API server first, or set BENCHMARK_BASE_URL.");
    console.error(err);
    process.exit(1);
  }

  console.log("\nCold request (first hit after server start)");
  console.log(`  Status ............. ${cold.status}`);
  console.log(`  Version ............ ${cold.body?.version ?? "n/a"}`);
  console.log(`  Total .............. ${cold.ms.toFixed(2)} ms`);

  const warm100 = await runSequential(100);
  printStats("100 sequential warm requests", warm100);

  const warm1000 = await runSequential(1000);
  printStats("1000 sequential warm requests", warm1000);

  const mem = process.memoryUsage();
  console.log("\nClient memory (Node benchmark process)");
  console.log(`  RSS ................ ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap used .......... ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
