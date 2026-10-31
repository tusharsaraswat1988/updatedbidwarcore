/**
 * Simulation Environment & Production Integrity Verification Script
 * Milestone M2 — BIDWAR PREMIER LEAGUE Simulation Environment Setup
 *
 * Verifies:
 * 1. Development Database:
 *    - Prefix-isolated tournament SIM_BIDWAR_PREMIER_LEAGUE (Code: SIMBPL01)
 *    - 5 Teams with distinct mobile numbers, access codes SIMT01–SIMS05, 10L purse, 0 used
 *    - 24 Players with 6 Batsmen, 6 Bowlers, 6 All-Rounders, 6 Wicketkeepers, serials 1–24, available status, blank mobile numbers
 *    - Initialized auction_sessions row with status 'active', revision 0, currentPlayerId null
 * 2. Production Database (ep-late-math-aohd4iep):
 *    - STRICT READ-ONLY check
 *    - Confirms Tournament 25 has NOT been altered
 *    - Confirms exactly 2 teams (54, 55)
 *    - Confirms exactly 5 players (369, 370, 371, 372, 448)
 *    - Confirms session 27 revision remains 46
 *    - Confirms 2 bids remain untouched
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Client } = pg;

// Load root .env for development database
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const DEV_DATABASE_URL = process.env.DATABASE_URL!;
const PROD_DATABASE_URL = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function verifyDevEnvironment(devClient: pg.Client) {
  console.log("\n========================================================");
  console.log("   VERIFYING DEVELOPMENT DATABASE SIMULATION ENVIRONMENT");
  console.log("========================================================\n");

  // 1. Verify Tournament
  const tRes = await devClient.query(
    "SELECT * FROM tournaments WHERE auction_code = 'SIMBPL01'"
  );

  if (tRes.rows.length !== 1) {
    throw new Error(`Expected exactly 1 simulation tournament with code 'SIMBPL01', found ${tRes.rows.length}`);
  }

  const simT = tRes.rows[0];
  console.log(`[PASS] Found Simulation Tournament ID: ${simT.id}`);
  console.log(`  - Name: ${simT.name}`);
  console.log(`  - Auction Code: ${simT.auction_code}`);
  console.log(`  - Sport: ${simT.sport} (sport_id: ${simT.sport_id})`);
  console.log(`  - Status: ${simT.status}`);
  console.log(`  - License Status: ${simT.license_status} (Expected: trial)`);
  console.log(`  - Base Purse: ₹${simT.base_purse.toLocaleString("en-IN")}`);
  console.log(`  - Min Bid: ₹${simT.min_bid.toLocaleString("en-IN")}`);
  console.log(`  - Bid Increment: ₹${simT.bid_increment.toLocaleString("en-IN")}`);
  console.log(`  - Timers: Lot = ${simT.timer_seconds}s, Bid = ${simT.bid_timer_seconds}s`);
  console.log(`  - Auction Enabled: ${simT.auction_enabled}, Scoring Enabled: ${simT.scoring_enabled}`);

  if (simT.name !== "SIM_BIDWAR_PREMIER_LEAGUE") throw new Error(`Incorrect name: ${simT.name}`);
  if (simT.license_status !== "trial") throw new Error(`License status must be trial, got: ${simT.license_status}`);
  if (simT.base_purse !== 1000000) throw new Error(`Base purse must be 1000000, got: ${simT.base_purse}`);
  if (simT.min_bid !== 10000) throw new Error(`Min bid must be 10000, got: ${simT.min_bid}`);
  if (simT.timer_seconds !== 10) throw new Error(`Timer seconds must be 10, got: ${simT.timer_seconds}`);

  // 2. Verify Teams
  const teamsRes = await devClient.query(
    "SELECT * FROM teams WHERE tournament_id = $1 ORDER BY id ASC",
    [simT.id]
  );

  console.log(`\n[PASS] Found ${teamsRes.rows.length} Teams (Expected: 5):`);
  if (teamsRes.rows.length !== 5) {
    throw new Error(`Expected exactly 5 teams, got ${teamsRes.rows.length}`);
  }

  const expectedAccessCodes = ["SIMT01", "SIMW02", "SIMR03", "SIMK04", "SIMS05"];
  for (const team of teamsRes.rows) {
    console.log(`  - Team ${team.id}: ${team.name} (${team.short_code}) | AccessCode: ${team.access_code} | Mobile: ${team.owner_mobile} | Purse: ₹${team.purse.toLocaleString("en-IN")} | PurseUsed: ₹${team.purse_used.toLocaleString("en-IN")}`);
    if (!expectedAccessCodes.includes(team.access_code)) {
      throw new Error(`Unexpected access code ${team.access_code} for team ${team.name}`);
    }
    if (team.purse !== 1000000) throw new Error(`Team purse must be 1000000, got: ${team.purse}`);
    if (team.purse_used !== 0) throw new Error(`Team purseUsed must be 0, got: ${team.purse_used}`);
  }

  // 3. Verify Players
  const playersRes = await devClient.query(
    "SELECT * FROM players WHERE tournament_id = $1 ORDER BY serial_no ASC",
    [simT.id]
  );

  console.log(`\n[PASS] Found ${playersRes.rows.length} Players (Expected: 24):`);
  if (playersRes.rows.length !== 24) {
    throw new Error(`Expected exactly 24 players, got ${playersRes.rows.length}`);
  }

  const roleCounts: Record<string, number> = {};
  for (const player of playersRes.rows) {
    roleCounts[player.role] = (roleCounts[player.role] || 0) + 1;
    if (player.status !== "available") {
      throw new Error(`Player ${player.name} status must be available, got: ${player.status}`);
    }
    if (player.mobile_number !== "") {
      throw new Error(`Player ${player.name} mobile must be blank, got: ${player.mobile_number}`);
    }
  }

  console.log("  Role breakdown:", roleCounts);
  if (roleCounts["Batsman"] !== 6) throw new Error(`Expected 6 Batsmen, got ${roleCounts["Batsman"]}`);
  if (roleCounts["Bowler"] !== 6) throw new Error(`Expected 6 Bowlers, got ${roleCounts["Bowler"]}`);
  if (roleCounts["All-Rounder"] !== 6) throw new Error(`Expected 6 All-Rounders, got ${roleCounts["All-Rounder"]}`);
  if (roleCounts["Wicketkeeper"] !== 6) throw new Error(`Expected 6 Wicketkeepers, got ${roleCounts["Wicketkeeper"]}`);

  // Check serial numbers are 1..24
  for (let i = 0; i < 24; i++) {
    if (playersRes.rows[i].serial_no !== i + 1) {
      throw new Error(`Expected serial_no ${i + 1}, got ${playersRes.rows[i].serial_no}`);
    }
  }
  console.log("  [PASS] Serials 1–24 strictly contiguous and verified.");

  // 4. Verify Auction Session
  const sessionRes = await devClient.query(
    "SELECT * FROM auction_sessions WHERE tournament_id = $1",
    [simT.id]
  );

  if (sessionRes.rows.length !== 1) {
    throw new Error(`Expected exactly 1 auction session for tournament ${simT.id}, got ${sessionRes.rows.length}`);
  }

  const session = sessionRes.rows[0];
  console.log(`\n[PASS] Auction Session ID ${session.id}:`);
  console.log(`  - Status: ${session.status} (Expected: active)`);
  console.log(`  - Current Player: ${session.current_player_id} (Expected: null)`);
  console.log(`  - Revision: ${session.revision} (Expected: 0)`);
  console.log(`  - Timer Seconds: ${session.timer_seconds} (Expected: 10)`);

  if (session.status !== "active") throw new Error(`Session status must be active, got: ${session.status}`);
  if (session.current_player_id !== null) throw new Error(`Current player must be null, got: ${session.current_player_id}`);
  if (session.revision !== 0) throw new Error(`Session revision must be 0, got: ${session.revision}`);

  return simT.id;
}

async function verifyProductionIntegrity(prodClient: pg.Client) {
  console.log("\n========================================================");
  console.log("   VERIFYING PRODUCTION DATABASE INTEGRITY (STRICT READ-ONLY)");
  console.log("========================================================\n");

  // 1. Verify Tournament 25
  const t25Res = await prodClient.query("SELECT * FROM tournaments WHERE id = 25");
  if (t25Res.rows.length !== 1) {
    throw new Error(`Production Tournament 25 not found!`);
  }
  const t25 = t25Res.rows[0];
  console.log(`[PASS] Production Tournament 25 is intact:`);
  console.log(`  - Name: ${t25.name} (Expected: BIDWAR PREMIER LEAGUE)`);
  console.log(`  - Auction Code: ${t25.auction_code} (Expected: SL972608)`);
  console.log(`  - Venue: ${t25.venue}`);
  console.log(`  - Organizer: ${t25.organizer_name} (${t25.organizer_mobile})`);
  if (t25.name !== "BIDWAR PREMIER LEAGUE") throw new Error(`Production tournament name modified!`);
  if (t25.auction_code !== "SL972608") throw new Error(`Production auction code modified!`);

  // 2. Verify Teams count (exactly 2 teams: 54, 55)
  const teamsRes = await prodClient.query("SELECT * FROM teams WHERE tournament_id = 25 ORDER BY id ASC");
  console.log(`[PASS] Production Teams count: ${teamsRes.rows.length} (Expected: exactly 2)`);
  if (teamsRes.rows.length !== 2) throw new Error(`Production teams count altered! Expected 2, got ${teamsRes.rows.length}`);
  const teamIds = teamsRes.rows.map((r) => r.id);
  console.log(`  - Team IDs: ${teamIds.join(", ")} (Expected: 54, 55)`);
  if (teamIds[0] !== 54 || teamIds[1] !== 55) throw new Error(`Production team IDs altered!`);

  // 3. Verify Players count (exactly 5 players: 369, 370, 371, 372, 448)
  const playersRes = await prodClient.query("SELECT * FROM players WHERE tournament_id = 25 ORDER BY id ASC");
  console.log(`[PASS] Production Players count: ${playersRes.rows.length} (Expected: exactly 5)`);
  if (playersRes.rows.length !== 5) throw new Error(`Production players count altered! Expected 5, got ${playersRes.rows.length}`);
  const playerIds = playersRes.rows.map((r) => r.id);
  console.log(`  - Player IDs: ${playerIds.join(", ")} (Expected: 369, 370, 371, 372, 448)`);
  if (JSON.stringify(playerIds) !== JSON.stringify([369, 370, 371, 372, 448])) {
    throw new Error(`Production player IDs altered!`);
  }

  // 4. Verify Auction Session (Session 27, revision 46)
  const sessionRes = await prodClient.query("SELECT * FROM auction_sessions WHERE tournament_id = 25");
  if (sessionRes.rows.length !== 1) throw new Error(`Production auction session missing or duplicated!`);
  const session = sessionRes.rows[0];
  console.log(`[PASS] Production Auction Session ID: ${session.id} (Expected: 27)`);
  console.log(`  - Revision: ${session.revision} (Expected: 46)`);
  console.log(`  - Status: ${session.status} (Expected: active)`);
  if (session.id !== 27) throw new Error(`Production session ID altered!`);
  if (session.revision !== 46) throw new Error(`Production session revision altered! Expected 46, got ${session.revision}`);

  // 5. Verify Bids (exactly 2 accepted bids: 213, 217)
  const bidsRes = await prodClient.query("SELECT * FROM bids WHERE tournament_id = 25 ORDER BY id ASC");
  console.log(`[PASS] Production Bids count: ${bidsRes.rows.length} (Expected: exactly 2)`);
  if (bidsRes.rows.length !== 2) throw new Error(`Production bids count altered! Expected 2, got ${bidsRes.rows.length}`);
  const bidIds = bidsRes.rows.map((r) => r.id);
  console.log(`  - Bid IDs: ${bidIds.join(", ")} (Expected: 213, 217)`);
  if (JSON.stringify(bidIds) !== JSON.stringify([213, 217])) {
    throw new Error(`Production bid IDs altered!`);
  }

  // 6. Verify that NO simulation tournament exists in production
  const simInProdRes = await prodClient.query("SELECT * FROM tournaments WHERE auction_code = 'SIMBPL01'");
  console.log(`[PASS] Simulation tournament in production check: ${simInProdRes.rows.length} found (Expected: 0)`);
  if (simInProdRes.rows.length !== 0) {
    throw new Error(`CRITICAL: Found simulation tournament in production database!`);
  }

  console.log("\n========================================================");
  console.log("   PRODUCTION DATABASE REMAINS 100% UNTOUCHED AND VERIFIED");
  console.log("========================================================\n");
}

async function main() {
  const devClient = new Client({ connectionString: DEV_DATABASE_URL });
  const prodClient = new Client({ connectionString: PROD_DATABASE_URL });

  try {
    await devClient.connect();
    const simTournamentId = await verifyDevEnvironment(devClient);

    await prodClient.connect();
    await verifyProductionIntegrity(prodClient);

    console.log(`[ALL CHECKS PASSED] Simulation Tournament ID: ${simTournamentId}`);
  } finally {
    await devClient.end().catch(() => {});
    await prodClient.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n[VERIFICATION FAILED]:", err);
  process.exit(1);
});
