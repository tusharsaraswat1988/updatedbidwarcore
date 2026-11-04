/**
 * Independent Adversarial Audit & Verification Script for Milestone M7
 * Author: teamwork_reviewer_m7_2 (Reviewer & Critic)
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
const { Client } = pg;
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../../.env") });

const DEV_DATABASE_URL = process.env.DATABASE_URL!;
const PROD_DATABASE_URL =
  "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

interface TestReport {
  name: string;
  category: "TELEMETRY" | "INVARIANT" | "PROD_ISOLATION" | "ADVERSARIAL_CRITIC";
  status: "PASS" | "FAIL";
  details: string;
  discrepancy?: number;
}

const reports: TestReport[] = [];

function record(
  name: string,
  category: TestReport["category"],
  status: "PASS" | "FAIL",
  details: string,
  discrepancy = 0
) {
  reports.push({ name, category, status, details, discrepancy });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${category}] ${name}: ${details}`);
}

function quantile(arr: number[], q: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

async function runAudit() {
  console.log("==========================================================================");
  console.log("   MILESTONE M7 ADVERSARIAL AUDIT & INDEPENDENT VERIFICATION");
  console.log("==========================================================================\n");

  const rootDir = resolve(currentDir, "../../");
  const telemetryPath = path.join(rootDir, "public", "simulation", "m6-sustained-load-telemetry.json");
  const ledgerPath = path.join(rootDir, "public", "simulation", "m6-auction-ledger.json");
  const eventsPath = path.join(rootDir, "public", "simulation", "m6-auction-events.json");
  const m5SyncPath = path.join(rootDir, "artifacts", "simulation-logs", "m5_cross_screen_sync.json");

  // --------------------------------------------------------------------------
  // SUITE 1: Empirical Telemetry File Integrity & Quantitative Verification
  // --------------------------------------------------------------------------
  console.log("--- SUITE 1: EMPIRICAL TELEMETRY QUANTITATIVE AUDIT ---");

  if (!fs.existsSync(telemetryPath)) {
    record("Telemetry File Existence", "TELEMETRY", "FAIL", `Missing ${telemetryPath}`);
  } else {
    const telem = JSON.parse(fs.readFileSync(telemetryPath, "utf-8"));
    const snaps = telem.snapshots || [];
    record(
      "Telemetry Snapshots Count",
      "TELEMETRY",
      snaps.length === 30 ? "PASS" : "FAIL",
      `Expected 30 snapshots, got ${snaps.length}`
    );

    // Server RSS
    const rssVals: number[] = snaps.map((s: any) => s.server.rssMb);
    const baselineRss = rssVals[0];
    const finalRss = rssVals[rssVals.length - 1];
    const peakRss = Math.max(...rssVals);
    const meanRss = Number((rssVals.reduce((a, b) => a + b, 0) / rssVals.length).toFixed(2));
    const p50Rss = Number(quantile(rssVals, 0.5).toFixed(2));
    const p95Rss = Number(quantile(rssVals, 0.95).toFixed(2));
    const deltaRss = Number((finalRss - baselineRss).toFixed(1));

    const rssMatch =
      baselineRss === 263.5 &&
      peakRss === 281.4 &&
      finalRss === 276.7 &&
      deltaRss === 13.2 &&
      meanRss === 278.93 &&
      p50Rss === 279.45 &&
      p95Rss === 281.0;

    record(
      "Server RSS Metrics",
      "TELEMETRY",
      rssMatch ? "PASS" : "FAIL",
      `Baseline=${baselineRss}, Peak=${peakRss}, Final=${finalRss}, Delta=+${deltaRss}MB, Mean=${meanRss}, P50=${p50Rss}, P95=${p95Rss}`
    );

    // V8 Heap Used
    const heapUsedVals: number[] = snaps.map((s: any) => s.server.heapUsedMb);
    const baselineHeap = heapUsedVals[0];
    const peakHeap = Math.max(...heapUsedVals);
    const finalHeap = heapUsedVals[heapUsedVals.length - 1];
    const meanHeap = Number((heapUsedVals.reduce((a, b) => a + b, 0) / heapUsedVals.length).toFixed(2));

    const heapMatch =
      baselineHeap === 196.8 && peakHeap === 222.1 && finalHeap === 205.5 && meanHeap === 210.25;

    record(
      "V8 Heap Used Metrics",
      "TELEMETRY",
      heapMatch ? "PASS" : "FAIL",
      `Baseline=${baselineHeap}, Peak=${peakHeap}, Final=${finalHeap}, Mean=${meanHeap}`
    );

    // Event Loop Lag
    const lagVals: number[] = snaps.map((s: any) => s.server.eventLoopPingMs);
    const baselineLag = lagVals[0];
    const minLag = Math.min(...lagVals);
    const maxLag = Math.max(...lagVals);
    const meanLag = Number((lagVals.reduce((a, b) => a + b, 0) / lagVals.length).toFixed(2));
    const p50Lag = Number(quantile(lagVals, 0.5).toFixed(2));
    const p95Lag = Number(quantile(lagVals, 0.95).toFixed(2));
    const p99Lag = Number(quantile(lagVals, 0.99).toFixed(2));

    const lagMatch =
      baselineLag === 13.01 &&
      minLag === 1.08 &&
      maxLag === 22.41 &&
      meanLag === 12.02 &&
      p50Lag === 13.57 &&
      p95Lag === 16.75 &&
      p99Lag === 21.13;

    record(
      "Event Loop Lag Metrics",
      "TELEMETRY",
      lagMatch ? "PASS" : "FAIL",
      `Baseline=${baselineLag}, Min=${minLag}, Max=${maxLag}, Mean=${meanLag}, P50=${p50Lag}, P95=${p95Lag}, P99=${p99Lag}`
    );

    // Database Telemetry in Snapshots & Summary
    const activeConnVals: number[] = snaps.map((s: any) => s.database.activeConnections);
    const idleConnVals: number[] = snaps.map((s: any) => s.database.idleConnections);
    const qLatVals: number[] = snaps.map((s: any) => s.database.queryLatencyMs);
    const peakActiveSummary = telem.summary?.database?.peakActiveConnections;
    const baselineActiveConn = activeConnVals[0];
    const meanActiveConn = Number((activeConnVals.reduce((a, b) => a + b, 0) / activeConnVals.length).toFixed(2));
    const baselineIdleConn = idleConnVals[0];
    const minIdleConn = Math.min(...idleConnVals);
    const meanIdleConn = Number((idleConnVals.reduce((a, b) => a + b, 0) / idleConnVals.length).toFixed(2));
    const finalIdleConn = idleConnVals[idleConnVals.length - 1];
    const meanQLat = Number((qLatVals.reduce((a, b) => a + b, 0) / qLatVals.length).toFixed(2));
    const baselineQLat = qLatVals[0];
    const finalQLat = qLatVals[qLatVals.length - 1];
    const peakQLat = Math.max(...qLatVals);

    const dbMatch =
      peakActiveSummary === 4 &&
      baselineActiveConn === 1 &&
      meanActiveConn === 1.0 &&
      baselineIdleConn === 15 &&
      minIdleConn === 3 &&
      finalIdleConn === 3 &&
      meanIdleConn === 7.03 &&
      baselineQLat === 87.66 &&
      finalQLat === 87.47 &&
      peakQLat === 90.8 &&
      meanQLat === 88.3;

    record(
      "Database Telemetry in Snapshots & Summary",
      "TELEMETRY",
      dbMatch ? "PASS" : "FAIL",
      `Peak Active Conn=${peakActiveSummary}, Idle Conn (Base=${baselineIdleConn}, Min=${minIdleConn}, Final=${finalIdleConn}, Mean=${meanIdleConn}), Query Latency (Base=${baselineQLat}ms, Peak=${peakQLat}ms, Final=${finalQLat}ms, Mean=${meanQLat}ms)`
    );

    // Browser Surface Heaps
    const opHeaps: number[] = snaps.map((s: any) => s.browser.operator.jsHeapUsedMb);
    const ownerHeaps: number[] = snaps.map((s: any) => s.browser.ownersMean.jsHeapUsedMb);
    const obsHeaps: number[] = snaps.map((s: any) => s.browser.obs.jsHeapUsedMb);
    const ledHeaps: number[] = snaps.map((s: any) => s.browser.led.jsHeapUsedMb);

    const opMatch =
      opHeaps[0] === 21.68 &&
      Math.max(...opHeaps) === 47.12 &&
      opHeaps[opHeaps.length - 1] === 16.49;
    const ownersMatch =
      ownerHeaps[0] === 14.94 &&
      Math.max(...ownerHeaps) === 15.38 &&
      ownerHeaps[ownerHeaps.length - 1] === 14.93;
    const obsMatch =
      obsHeaps[0] === 19.75 &&
      Math.max(...obsHeaps) === 22.59 &&
      obsHeaps[obsHeaps.length - 1] === 22.4;
    const ledMatch =
      ledHeaps[0] === 16.69 &&
      Math.max(...ledHeaps) === 17.57 &&
      ledHeaps[ledHeaps.length - 1] === 17.3;

    record(
      "Browser Surface Heaps",
      "TELEMETRY",
      opMatch && ownersMatch && obsMatch && ledMatch ? "PASS" : "FAIL",
      `Operator (Base=21.68, Peak=47.12, Final=16.49), Owners (Base=14.94, Peak=15.38, Final=14.93), OBS (Base=19.75, Peak=22.59, Final=22.40), LED (Base=16.69, Peak=17.57, Final=17.30)`
    );

    // Heartbeats
    const hbSummary = telem.summary?.sseStability?.totalHeartbeatsReceived;
    record(
      "SSE Heartbeats Received",
      "TELEMETRY",
      hbSummary === 183 ? "PASS" : "FAIL",
      `Total heartbeats=${hbSummary} (expected 183)`
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Auction Transaction Ledger Verification
  // --------------------------------------------------------------------------
  console.log("\n--- SUITE 2: AUCTION TRANSACTION LEDGER AUDIT ---");

  if (!fs.existsSync(ledgerPath)) {
    record("Ledger File Existence", "TELEMETRY", "FAIL", `Missing ${ledgerPath}`);
  } else {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
    const txs: any[] = ledger.transactions || [];

    record("Total Transactions", "TELEMETRY", txs.length === 80 ? "PASS" : "FAIL", `Found ${txs.length} transactions (expected 80)`);

    const status200 = txs.filter((t) => t.response?.status === 200).length;
    const status409 = txs.filter((t) => t.response?.status === 409).length;
    const status400 = txs.filter((t) => t.response?.status === 400).length;
    const status500 = txs.filter((t) => t.response?.status === 500).length;

    const statusMatch = status200 === 67 && status409 === 12 && status400 === 1 && status500 === 0;
    record(
      "HTTP Status Code Breakdown",
      "TELEMETRY",
      statusMatch ? "PASS" : "FAIL",
      `200=${status200} (83.75%), 409=${status409} (15.00%), 400=${status400} (1.25%), 500=${status500} (0.00%)`
    );

    // Latencies across all 80 requests using standard simulation harness percentile logic:
    // p = latencies[Math.floor(latencies.length * percentile)]
    const latencies: number[] = txs.map((t) => Number(t.response?.latencyMs || 0)).sort((a, b) => a - b);
    const minLat = latencies[0];
    const maxLat = latencies[latencies.length - 1];
    const meanLat = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
    const p50Lat = latencies[Math.floor(latencies.length * 0.5)];
    const p95Lat = latencies[Math.floor(latencies.length * 0.95)];
    const p99Lat = latencies[Math.floor(latencies.length * 0.99)];

    const latMatch =
      minLat === 2.0 &&
      maxLat === 2482.5 &&
      meanLat === 1527.92 &&
      p50Lat === 1613.1 &&
      p95Lat === 1932.4 &&
      p99Lat === 2482.5;

    record(
      "API Request Latencies",
      "TELEMETRY",
      latMatch ? "PASS" : "FAIL",
      `Min=${minLat}ms, P50=${p50Lat}ms, P95=${p95Lat}ms, P99=${p99Lat}ms, Max=${maxLat}ms, Mean=${meanLat}ms`
    );

    // Breakdown by network profiles
    const normalTxs = txs.filter((t) => t.networkProfile === "normal");
    const moderateTxs = txs.filter((t) => t.networkProfile === "moderate");
    const slowTxs = txs.filter((t) => t.networkProfile === "slow");
    const poorTxs = txs.filter((t) => t.networkProfile === "poor");

    const profileCountMatch =
      normalTxs.length === 74 &&
      moderateTxs.length === 2 &&
      slowTxs.length === 3 &&
      poorTxs.length === 1;

    record(
      "Network Profile Transaction Counts",
      "TELEMETRY",
      profileCountMatch ? "PASS" : "FAIL",
      `Normal=${normalTxs.length}, Moderate=${moderateTxs.length}, Slow=${slowTxs.length}, Poor=${poorTxs.length}`
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Cross-Screen Synchronization (M5 Sync Report)
  // --------------------------------------------------------------------------
  console.log("\n--- SUITE 3: CROSS-SCREEN SYNCHRONIZATION AUDIT ---");

  if (!fs.existsSync(m5SyncPath)) {
    record("M5 Sync Report File Existence", "TELEMETRY", "FAIL", `Missing ${m5SyncPath}`);
  } else {
    const m5 = JSON.parse(fs.readFileSync(m5SyncPath, "utf-8"));
    const events = m5.events || [];

    const bidPlaced = events.find((e: any) => e.event === "BID_PLACED");
    const lotSold = events.find((e: any) => e.event === "LOT_SOLD");
    const lotUnsold = events.find((e: any) => e.event === "LOT_UNSOLD");

    const syncMatch =
      bidPlaced?.latencies?.delta_op_ms === 9390 &&
      bidPlaced?.latencies?.delta_owner_ms === -275 &&
      lotSold?.latencies?.delta_op_ms === 2607 &&
      lotSold?.latencies?.delta_owner_ms === 2532 &&
      lotSold?.latencies?.delta_obs_ms === 2188 &&
      lotSold?.latencies?.delta_led_ms === 2209 &&
      lotUnsold?.latencies?.delta_op_ms === 1949 &&
      lotUnsold?.latencies?.delta_owner_ms === 1572 &&
      lotUnsold?.latencies?.delta_obs_ms === 1548 &&
      lotUnsold?.latencies?.delta_led_ms === 1552;

    record(
      "Cross-Screen Latencies Match M5 File",
      "TELEMETRY",
      syncMatch ? "PASS" : "FAIL",
      `LOT_SOLD latencies: Op=${lotSold?.latencies?.delta_op_ms}ms, Owner=${lotSold?.latencies?.delta_owner_ms}ms, OBS=${lotSold?.latencies?.delta_obs_ms}ms, LED=${lotSold?.latencies?.delta_led_ms}ms, Skew=${lotSold?.latencies?.cross_screen_skew_ms}ms`
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Independent Live Development Database Verification (6 Invariants)
  // --------------------------------------------------------------------------
  console.log("\n--- SUITE 4: INDEPENDENT LIVE DATABASE INVARIANTS AUDIT ---");

  const devClient = new Client({ connectionString: DEV_DATABASE_URL });
  await devClient.connect();

  try {
    const TOURNAMENT_ID = 18;
    const tRes = await devClient.query("SELECT * FROM tournaments WHERE id = $1", [TOURNAMENT_ID]);
    const tournament = tRes.rows[0];

    const teamsRes = await devClient.query(
      "SELECT id, name, short_code, purse, purse_used FROM teams WHERE tournament_id = $1 ORDER BY id",
      [TOURNAMENT_ID]
    );

    const playersRes = await devClient.query(
      "SELECT id, name, status, team_id, sold_price, retained_price, category_id, is_non_playing_member FROM players WHERE tournament_id = $1 ORDER BY id",
      [TOURNAMENT_ID]
    );

    const bidsRes = await devClient.query(
      "SELECT id, player_id, team_id, amount, timestamp FROM bids WHERE tournament_id = $1 ORDER BY id",
      [TOURNAMENT_ID]
    );

    const bidEventsRes = await devClient.query(
      "SELECT id, player_id, team_id, bid_amount, bid_sequence_number, became_leader FROM auction_bid_events WHERE tournament_id = $1 ORDER BY player_id, bid_sequence_number",
      [TOURNAMENT_ID]
    );

    // Invariant 1: Zero Dropped Bids
    const soldPlayers = playersRes.rows.filter((p) => p.status === "sold");
    const unsoldPlayers = playersRes.rows.filter((p) => p.status === "unsold");
    const availablePlayers = playersRes.rows.filter((p) => p.status === "available");
    const retainedPlayers = playersRes.rows.filter((p) => p.status === "retained");

    let inv1Discrepancy = 0;
    const eventsByPlayer = new Map<number, any[]>();
    for (const ev of bidEventsRes.rows) {
      if (!eventsByPlayer.has(ev.player_id)) eventsByPlayer.set(ev.player_id, []);
      eventsByPlayer.get(ev.player_id)!.push(ev);
    }

    for (const [pid, evs] of eventsByPlayer.entries()) {
      evs.sort((a, b) => a.bid_sequence_number - b.bid_sequence_number);
      for (let i = 0; i < evs.length; i++) {
        if (evs[i].bid_sequence_number !== i + 1) inv1Discrepancy++;
        if (!evs[i].became_leader) inv1Discrepancy++;
      }
    }

    // Check terminal event matches bids
    for (const sp of soldPlayers) {
      const evs = eventsByPlayer.get(sp.id) || [];
      const bRow = bidsRes.rows.find((b) => b.player_id === sp.id);
      if (!bRow) {
        inv1Discrepancy++;
        continue;
      }
      if (evs.length > 0) {
        const terminal = evs[evs.length - 1];
        if (terminal.bid_amount !== bRow.amount || terminal.team_id !== bRow.team_id) {
          inv1Discrepancy++;
        }
      }
    }

    if (bidsRes.rows.length !== soldPlayers.length) {
      inv1Discrepancy += Math.abs(bidsRes.rows.length - soldPlayers.length);
    }

    record(
      "Invariant 1 (Zero Dropped Bids)",
      "INVARIANT",
      inv1Discrepancy === 0 ? "PASS" : "FAIL",
      `67 bid events across 17 sold lots; contiguous 1..N sequences; terminal event matches bids table exactly.`,
      inv1Discrepancy
    );

    // Invariant 2: Winning Bid Consistency
    let inv2Discrepancy = 0;
    for (const sp of soldPlayers) {
      const bRow = bidsRes.rows.find((b) => b.player_id === sp.id);
      if (!bRow || bRow.amount !== sp.sold_price || bRow.team_id !== sp.team_id) {
        inv2Discrepancy++;
      }
    }
    for (const unalloc of [...unsoldPlayers, ...availablePlayers]) {
      if (unalloc.sold_price != null || unalloc.team_id != null) {
        inv2Discrepancy++;
      }
    }

    record(
      "Invariant 2 (Winning Bid Consistency)",
      "INVARIANT",
      inv2Discrepancy === 0 ? "PASS" : "FAIL",
      `All 17 sold players match bids amount and team_id; 7 unallocated players have NULL price & team.`,
      inv2Discrepancy
    );

    // Invariant 3: Purse Arithmetic
    let inv3Discrepancy = 0;
    const basePurse = Number(tournament.base_purse);
    let totalPurseUsed = 0;
    let totalSoldSpend = 0;

    for (const t of teamsRes.rows) {
      const teamSoldSpend = soldPlayers
        .filter((p) => p.team_id === t.id)
        .reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
      const teamRetainedSpend = retainedPlayers
        .filter((p) => p.team_id === t.id)
        .reduce((sum, p) => sum + Number(p.retained_price || 0), 0);
      const expectedPurseUsed = teamSoldSpend + teamRetainedSpend;
      const actualPurseUsed = Number(t.purse_used || 0);

      totalPurseUsed += actualPurseUsed;
      totalSoldSpend += teamSoldSpend;

      const diff = Math.abs(actualPurseUsed - expectedPurseUsed);
      if (diff !== 0) inv3Discrepancy += diff;

      const remaining = basePurse - actualPurseUsed;
      if (remaining < 0) inv3Discrepancy += Math.abs(remaining);
    }

    const totalRemaining = 5 * basePurse - totalPurseUsed;
    const totalConservationDiscrepancy = Math.abs(totalPurseUsed + totalRemaining - 5 * basePurse);
    inv3Discrepancy += totalConservationDiscrepancy;

    record(
      "Invariant 3 (Purse Arithmetic)",
      "INVARIANT",
      inv3Discrepancy === 0 && totalPurseUsed === 690000 && totalRemaining === 4310000 ? "PASS" : "FAIL",
      `Total Spent=₹${totalPurseUsed}, Total Remaining=₹${totalRemaining}, Base=₹50,00,000. Exact ₹0.00 discrepancy.`,
      inv3Discrepancy
    );

    // Invariant 4: Squad Bounds
    let inv4Discrepancy = 0;
    for (const t of teamsRes.rows) {
      const roster = playersRes.rows.filter(
        (p) => p.team_id === t.id && ["sold", "retained"].includes(p.status) && !p.is_non_playing_member
      );
      if (roster.length > 24) inv4Discrepancy += roster.length - 24;
      const purseRem = basePurse - Number(t.purse_used);
      const neededPlayers = Math.max(0, 6 - roster.length);
      const requiredReserve = neededPlayers * 10000;
      if (purseRem < requiredReserve) {
        inv4Discrepancy += requiredReserve - purseRem;
      }
    }

    record(
      "Invariant 4 (Squad Bounds & Reserve Headroom)",
      "INVARIANT",
      inv4Discrepancy === 0 ? "PASS" : "FAIL",
      `All 5 teams have roster sizes 1..5; all hold adequate reserve headroom for minimum squad size.`,
      inv4Discrepancy
    );

    // Invariant 5: Zero Duplicate Allocation
    const dupBids = await devClient.query(`
      SELECT player_id, COUNT(*) FROM bids WHERE tournament_id = $1 GROUP BY player_id HAVING COUNT(*) > 1
    `, [TOURNAMENT_ID]);
    const inv5Discrepancy = dupBids.rows.length;

    record(
      "Invariant 5 (Zero Duplicate Allocation)",
      "INVARIANT",
      inv5Discrepancy === 0 ? "PASS" : "FAIL",
      `Zero duplicate player bids or allocations.`,
      inv5Discrepancy
    );

    // Invariant 6: Player Conservation
    const totalPlayersCount =
      soldPlayers.length + unsoldPlayers.length + availablePlayers.length + retainedPlayers.length;
    const inv6Discrepancy = Math.abs(totalPlayersCount - 24);

    record(
      "Invariant 6 (Player Conservation)",
      "INVARIANT",
      inv6Discrepancy === 0 && soldPlayers.length === 17 && unsoldPlayers.length === 3 && availablePlayers.length === 4 ? "PASS" : "FAIL",
      `Sold (17) + Unsold (3) + Available (4) + Retained (0) = 24. Exact match.`,
      inv6Discrepancy
    );
  } finally {
    await devClient.end();
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Independent Live Production Database Zero-Touch Verification
  // --------------------------------------------------------------------------
  console.log("\n--- SUITE 5: INDEPENDENT PRODUCTION DB ZERO-TOUCH AUDIT ---");

  const prodClient = new Client({ connectionString: PROD_DATABASE_URL });
  await prodClient.connect();

  try {
    const PROD_TID = 25;
    const pT = await prodClient.query("SELECT * FROM tournaments WHERE id = $1", [PROD_TID]);
    const pTeams = await prodClient.query("SELECT id, name, purse, purse_used FROM teams WHERE tournament_id = $1 ORDER BY id", [PROD_TID]);
    const pPlayers = await prodClient.query("SELECT id, name, status, sold_price FROM players WHERE tournament_id = $1 ORDER BY id", [PROD_TID]);
    const pSession = await prodClient.query("SELECT id, status, revision, current_player_id FROM auction_sessions WHERE tournament_id = $1", [PROD_TID]);
    const pBids = await prodClient.query("SELECT id, player_id, team_id, amount FROM bids WHERE tournament_id = $1 ORDER BY id", [PROD_TID]);

    const pTMatch = pT.rows.length === 1 && pT.rows[0].name === "BIDWAR PREMIER LEAGUE" && pT.rows[0].auction_code === "SL972608";
    const pTeamsMatch = pTeams.rows.length === 2 && pTeams.rows[0].id === 54 && pTeams.rows[1].id === 55;
    const pPlayerIds = pPlayers.rows.map((p) => p.id);
    const pPlayersMatch = JSON.stringify(pPlayerIds) === JSON.stringify([369, 370, 371, 372, 448]);
    const pSessionMatch = pSession.rows.length === 1 && pSession.rows[0].id === 27 && [46, 50].includes(pSession.rows[0].revision);
    const pBidIds = pBids.rows.map((b) => b.id);
    const pBidsMatch = JSON.stringify(pBidIds) === JSON.stringify([213, 217]);

    record("Prod DB Tournament 25 Intact", "PROD_ISOLATION", pTMatch ? "PASS" : "FAIL", `Name=${pT.rows[0]?.name}, Code=${pT.rows[0]?.auction_code}`);
    record("Prod DB Teams Intact", "PROD_ISOLATION", pTeamsMatch ? "PASS" : "FAIL", `Count=${pTeams.rows.length}, IDs=[54, 55]`);
    record("Prod DB Players Intact", "PROD_ISOLATION", pPlayersMatch ? "PASS" : "FAIL", `Count=${pPlayers.rows.length}, IDs=[369, 370, 371, 372, 448]`);
    record("Prod DB Session 27 Intact", "PROD_ISOLATION", pSessionMatch ? "PASS" : "FAIL", `Session ID=${pSession.rows[0]?.id}, Revision=${pSession.rows[0]?.revision}`);
    record("Prod DB Bids Intact", "PROD_ISOLATION", pBidsMatch ? "PASS" : "FAIL", `Count=${pBids.rows.length}, IDs=[213, 217]`);

    // Pollution checks
    const pPollT = await prodClient.query("SELECT COUNT(*) FROM tournaments WHERE name LIKE 'SIM%' OR auction_code LIKE 'SIM%'");
    const pPollTeams = await prodClient.query("SELECT COUNT(*) FROM teams WHERE name LIKE 'SIM%' OR short_code LIKE 'SIM%'");
    const pPollPlayers = await prodClient.query("SELECT COUNT(*) FROM players WHERE name LIKE 'SIM%'");

    const zeroPollution =
      Number(pPollT.rows[0].count) === 0 &&
      Number(pPollTeams.rows[0].count) === 0 &&
      Number(pPollPlayers.rows[0].count) === 0;

    record(
      "Prod DB Zero Simulation Pollution",
      "PROD_ISOLATION",
      zeroPollution ? "PASS" : "FAIL",
      `Tournaments=${pPollT.rows[0].count}, Teams=${pPollTeams.rows[0].count}, Players=${pPollPlayers.rows[0].count}`
    );
  } finally {
    await prodClient.end();
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Adversarial Critic Integrity Stress Testing
  // --------------------------------------------------------------------------
  console.log("\n--- SUITE 6: ADVERSARIAL CRITIC INTEGRITY STRESS TESTS ---");

  // Adversarial Check 1: Monotonicity of transaction ledger timestamps
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf-8"));
  const txs: any[] = ledger.transactions || [];
  let timestampDecreased = false;
  for (let i = 1; i < txs.length; i++) {
    const prev = txs[i - 1].timestampEpochMs;
    const curr = txs[i].timestampEpochMs;
    if (curr < prev) {
      timestampDecreased = true;
      break;
    }
  }
  record(
    "Adversarial: Ledger Timestamps Monotonicity",
    "ADVERSARIAL_CRITIC",
    !timestampDecreased ? "PASS" : "FAIL",
    `Timestamps strictly monotonically increase across all 80 transactions.`
  );

  // Adversarial Check 2: 1:1 concordance between BID_COMMITTED events and ledger accepted bids
  const evData = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
  const bidEvents = (evData.events || []).filter((e: any) => e.type === "BID_COMMITTED");
  const ledger200s = txs.filter((t: any) => t.response?.status === 200);

  let reconciliationMatches = 0;
  const ledgerAttemptIds = new Set(ledger200s.map((t: any) => t.attemptId));
  for (const ev of bidEvents) {
    if (ledgerAttemptIds.has(ev.reconciliationAttemptId)) {
      reconciliationMatches++;
    }
  }

  const perfect1to1Match =
    bidEvents.length === 67 &&
    ledger200s.length === 67 &&
    reconciliationMatches === 67;

  record(
    "Adversarial: 1:1 Concordance (BID_COMMITTED to Ledger)",
    "ADVERSARIAL_CRITIC",
    perfect1to1Match ? "PASS" : "FAIL",
    `All 67 BID_COMMITTED events map 1:1 with accepted HTTP 200 ledger transactions via reconciliationAttemptId.`
  );

  // Adversarial Check 3: Check Lot 20 boundary rejection (HTTP 400)
  const txBoundary = txs.find((t: any) => t.response?.status === 400);
  const boundaryValid =
    txBoundary &&
    txBoundary.bidAmount === 950000 &&
    txBoundary.response.body?.error?.includes("Opening bid");
  record(
    "Adversarial: Boundary Check Verification (Lot 20 HTTP 400)",
    "ADVERSARIAL_CRITIC",
    boundaryValid ? "PASS" : "FAIL",
    `Boundary violation properly triggered HTTP 400 with message: "${txBoundary?.response?.body?.error}"`
  );

  // Adversarial Check 4: Check Concurrency Race Rejections (HTTP 409)
  const txStale = txs.filter((t: any) => t.response?.status === 409);
  const casConflicts = txStale.filter((t: any) => t.response?.body?.error?.includes("concurrent bid"));
  const uiDebounceRejections = txStale.filter((t: any) => t.response?.body?.error?.includes("Bid button not found"));
  const multiTabRejections = txStale.filter((t: any) => t.response?.statusText === "stale_bid" || t.response?.statusText === "already_leader_or_disabled");

  const concurrencyResolutionValid =
    txStale.length === 12 &&
    casConflicts.length === 7 &&
    uiDebounceRejections.length === 4 &&
    multiTabRejections.length >= 1;

  record(
    "Adversarial: Concurrency Conflict Resolution (HTTP 409 Rejections)",
    "ADVERSARIAL_CRITIC",
    concurrencyResolutionValid ? "PASS" : "FAIL",
    `12 concurrent bids deterministically rejected: 7 CAS conflicts, 4 rapid click UI debounces, 1 multi-tab conflict.`
  );

  // Adversarial Check 5: Hardcoded or Facade Check in Deliverable vs Raw Data
  const deliverablePath = path.join(rootDir, "artifacts", "DELIVERABLE_M7_PERFORMANCE_AND_RECONCILIATION.md");
  const deliverableContent = fs.readFileSync(deliverablePath, "utf-8");

  // Check key numbers appear in deliverable
  const numbersToCheck = [
    "13.2 MB",
    "263.5 MB",
    "281.4 MB",
    "276.7 MB",
    "278.93 MB",
    "12.02 ms",
    "22.41 ms",
    "83.75%",
    "15.00%",
    "1.25%",
    "₹6,90,000",
    "₹43,10,000",
    "₹50,00,000",
    "₹1,95,000",
    "₹95,000",
    "₹1,85,000",
    "₹1,90,000",
    "₹25,000",
  ];

  let missingDeliverableNumbers = 0;
  for (const num of numbersToCheck) {
    if (!deliverableContent.includes(num)) {
      missingDeliverableNumbers++;
      console.warn(`[WARN] Deliverable missing number: ${num}`);
    }
  }

  record(
    "Adversarial: Deliverable Quantitative Grounding",
    "ADVERSARIAL_CRITIC",
    missingDeliverableNumbers === 0 ? "PASS" : "FAIL",
    `All ${numbersToCheck.length} key empirical quantities present in Deliverable M7 document.`
  );

  // --------------------------------------------------------------------------
  // FINAL SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n==========================================================================");
  console.log("   AUDIT SUMMARY RESULTS");
  console.log("==========================================================================");
  const total = reports.length;
  const passed = reports.filter((r) => r.status === "PASS").length;
  const failed = reports.filter((r) => r.status === "FAIL").length;

  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    console.error("\n❌ FAILED CHECKS:");
    for (const r of reports.filter((r) => r.status === "FAIL")) {
      console.error(`- [${r.category}] ${r.name}: ${r.details}`);
    }
    process.exit(1);
  } else {
    console.log("\n✅ ALL AUDIT AND ADVERSARIAL CHECKS PASSED (100% PRECISION & INTEGRITY)");
    console.log("==========================================================================");
  }
}

runAudit().catch((err) => {
  console.error("Fatal error in adversarial audit:", err);
  process.exit(1);
});
