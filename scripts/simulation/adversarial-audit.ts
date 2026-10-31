/**
 * Independent Adversarial Verification Script for Milestone M2
 * Author: teamwork_reviewer_m2_2 (Reviewer & Critic)
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Client } = pg;
import { assertSafeDatabaseUrl, provisionSimulationTournament } from "./provision-simulation-tournament";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const DEV_DATABASE_URL = process.env.DATABASE_URL!;
const PROD_DATABASE_URL = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

interface TestReport {
  name: string;
  category: string;
  status: "PASS" | "FAIL";
  details: string;
}

const reports: TestReport[] = [];

function record(name: string, category: string, status: "PASS" | "FAIL", details: string) {
  reports.push({ name, category, status, details });
  console.log(`[${status}] [${category}] ${name}: ${details}`);
}

async function runAdversarialTests() {
  console.log("================================================================");
  console.log("   STARTING ADVERSARIAL VERIFICATION FOR MILESTONE M2");
  console.log("================================================================\n");

  // -------------------------------------------------------------
  // TEST SUITE 1: Safety Guard & URL Assertion Stress Testing
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 1: Safety Guard & URL Assertion Stress Testing ---");

  // Test 1.1: Exact Production URL must throw
  try {
    assertSafeDatabaseUrl(PROD_DATABASE_URL);
    record("Safety Guard - Exact Prod URL", "SAFETY", "FAIL", "assertSafeDatabaseUrl failed to throw on PROD_DATABASE_URL!");
  } catch (err: any) {
    if (err.message.includes("STRICTLY PROHIBITED")) {
      record("Safety Guard - Exact Prod URL", "SAFETY", "PASS", "Blocked production URL as expected: " + err.message);
    } else {
      record("Safety Guard - Exact Prod URL", "SAFETY", "FAIL", "Threw unexpected error: " + err.message);
    }
  }

  // Test 1.2: Host fragment anywhere in connection string
  try {
    assertSafeDatabaseUrl("postgresql://foo:bar@ep-late-math-aohd4iep.somewhere.com/db");
    record("Safety Guard - Fragment Match", "SAFETY", "FAIL", "Failed to block arbitrary URL with prod fragment!");
  } catch (err: any) {
    record("Safety Guard - Fragment Match", "SAFETY", "PASS", "Blocked URL with prod host fragment.");
  }

  // Test 1.3: Empty or missing URL
  try {
    assertSafeDatabaseUrl("");
    record("Safety Guard - Empty URL", "SAFETY", "FAIL", "Failed to block empty database URL!");
  } catch (err: any) {
    record("Safety Guard - Empty URL", "SAFETY", "PASS", "Blocked empty URL as expected: " + err.message);
  }

  // Test 1.4: Uppercase Host fragment vulnerability check (CRITIC STRESS TEST)
  try {
    assertSafeDatabaseUrl("postgresql://foo:bar@EP-LATE-MATH-AOHD4IEP.c-2.ap-southeast-1.aws.neon.tech/db");
    record("Safety Guard - Case Sensitivity Check", "ADVERSARIAL_CRITIC", "FAIL", "WARNING/VULNERABILITY: assertSafeDatabaseUrl does not normalize casing! Uppercase host fragment bypassed check!");
  } catch (err: any) {
    record("Safety Guard - Case Sensitivity Check", "ADVERSARIAL_CRITIC", "PASS", "Handled uppercase host fragment.");
  }

  // Test 1.5: Valid Dev URL must pass
  try {
    assertSafeDatabaseUrl(DEV_DATABASE_URL);
    record("Safety Guard - Valid Dev URL", "SAFETY", "PASS", "Accepted valid dev database URL.");
  } catch (err: any) {
    record("Safety Guard - Valid Dev URL", "SAFETY", "FAIL", "Rejected valid dev URL: " + err.message);
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: Idempotency & Repeat Provisioning Stress Test
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 2: Idempotency & Repeat Provisioning Stress Test ---");

  try {
    console.log("Triggering re-provisioning of simulation tournament...");
    const reprovisionResult = await provisionSimulationTournament();
    
    if (reprovisionResult.tournament.id === 18) {
      record("Idempotency - Tournament ID Preservation", "IDEMPOTENCY", "PASS", `Tournament ID preserved at 18.`);
    } else {
      record("Idempotency - Tournament ID Preservation", "IDEMPOTENCY", "FAIL", `Tournament ID changed to ${reprovisionResult.tournament.id}!`);
    }

    if (reprovisionResult.teamsCount === 5) {
      record("Idempotency - Teams Count", "IDEMPOTENCY", "PASS", "Exactly 5 teams recreated.");
    } else {
      record("Idempotency - Teams Count", "IDEMPOTENCY", "FAIL", `Expected 5 teams, got ${reprovisionResult.teamsCount}.`);
    }

    if (reprovisionResult.playersCount === 24) {
      record("Idempotency - Players Count", "IDEMPOTENCY", "PASS", "Exactly 24 players recreated.");
    } else {
      record("Idempotency - Players Count", "IDEMPOTENCY", "FAIL", `Expected 24 players, got ${reprovisionResult.playersCount}.`);
    }

    if (reprovisionResult.session.revision === 0) {
      record("Idempotency - Session Revision Reset", "IDEMPOTENCY", "PASS", "Session revision reset to 0.");
    } else {
      record("Idempotency - Session Revision Reset", "IDEMPOTENCY", "FAIL", `Session revision not reset: ${reprovisionResult.session.revision}`);
    }
  } catch (err: any) {
    record("Idempotency - Re-provision Execution", "IDEMPOTENCY", "FAIL", "Failed to execute re-provisioning: " + err.message);
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: Dev Database State & Domain Model Validation
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 3: Dev Database State & Domain Model Validation ---");

  const devClient = new Client({ connectionString: DEV_DATABASE_URL });
  await devClient.connect();

  try {
    // 3.1: Check Tournament attributes
    const tRes = await devClient.query("SELECT * FROM tournaments WHERE auction_code = 'SIMBPL01'");
    if (tRes.rows.length === 1) {
      const t = tRes.rows[0];
      const match =
        t.name === "SIM_BIDWAR_PREMIER_LEAGUE" &&
        t.license_status === "trial" &&
        t.sport === "cricket" &&
        t.sport_id === 1 &&
        t.base_purse === 1000000 &&
        t.min_bid === 10000 &&
        t.bid_increment === 5000 &&
        t.timer_seconds === 10 &&
        t.bid_timer_seconds === 10 &&
        t.status === "active" &&
        t.auction_enabled === true;

      if (match) {
        record("Dev DB - Tournament Attributes", "DATA_INTEGRITY", "PASS", "All tournament attributes match contract (ID: " + t.id + ").");
      } else {
        record("Dev DB - Tournament Attributes", "DATA_INTEGRITY", "FAIL", "Tournament attributes mismatch: " + JSON.stringify(t));
      }
    } else {
      record("Dev DB - Tournament Lookup", "DATA_INTEGRITY", "FAIL", "Expected 1 simulation tournament, found " + tRes.rows.length);
    }

    const simTid = tRes.rows[0]?.id;

    // 3.2: Check Teams: access codes, bidding enabled, purse, purse_used, synthetic phone numbers
    const teamsRes = await devClient.query("SELECT * FROM teams WHERE tournament_id = $1 ORDER BY id ASC", [simTid]);
    const expectedCodes = new Set(["SIMT01", "SIMW02", "SIMR03", "SIMK04", "SIMS05"]);
    let allTeamsValid = teamsRes.rows.length === 5;
    const teamCodesFound: string[] = [];

    for (const team of teamsRes.rows) {
      teamCodesFound.push(team.access_code);
      if (!expectedCodes.has(team.access_code)) allTeamsValid = false;
      if (!team.is_bidding_enabled) allTeamsValid = false;
      if (team.purse !== 1000000) allTeamsValid = false;
      if (team.purse_used !== 0) allTeamsValid = false;
      if (!team.owner_mobile.startsWith("999900000")) allTeamsValid = false;
    }

    if (allTeamsValid) {
      record("Dev DB - Team Access Codes & Settings", "DATA_INTEGRITY", "PASS", `5 teams valid: codes [${teamCodesFound.join(", ")}], bidding enabled, purse 10L, used 0.`);
    } else {
      record("Dev DB - Team Access Codes & Settings", "DATA_INTEGRITY", "FAIL", `Team validation failed: ${JSON.stringify(teamsRes.rows)}`);
    }

    // 3.3: Check Players: roles, serials, available, mobile blank
    const playersRes = await devClient.query("SELECT * FROM players WHERE tournament_id = $1 ORDER BY serial_no ASC", [simTid]);
    let allPlayersValid = playersRes.rows.length === 24;
    const rolesCount: Record<string, number> = {};

    for (let i = 0; i < playersRes.rows.length; i++) {
      const p = playersRes.rows[i];
      rolesCount[p.role] = (rolesCount[p.role] || 0) + 1;
      if (p.serial_no !== i + 1) allPlayersValid = false;
      if (p.status !== "available") allPlayersValid = false;
      if (p.team_id !== null) allPlayersValid = false;
      if (p.sold_price !== null) allPlayersValid = false;
      if (p.mobile_number !== "") allPlayersValid = false;
      if (p.base_price < 10000 || p.base_price > 50000) allPlayersValid = false;
    }

    const expectedRoles = rolesCount["Batsman"] === 6 && rolesCount["Bowler"] === 6 && rolesCount["All-Rounder"] === 6 && rolesCount["Wicketkeeper"] === 6;

    if (allPlayersValid && expectedRoles) {
      record("Dev DB - Player Pool & Roles", "DATA_INTEGRITY", "PASS", `24 players valid: 6 Batsmen, 6 Bowlers, 6 All-Rounders, 6 Wicketkeepers; serials 1-24 contiguous; mobile blank.`);
    } else {
      record("Dev DB - Player Pool & Roles", "DATA_INTEGRITY", "FAIL", `Player validation failed. Valid: ${allPlayersValid}, Roles: ${JSON.stringify(rolesCount)}`);
    }

    // 3.4: Check Auction Session
    const sRes = await devClient.query("SELECT * FROM auction_sessions WHERE tournament_id = $1", [simTid]);
    if (sRes.rows.length === 1) {
      const s = sRes.rows[0];
      if (s.status === "active" && s.revision === 0 && s.current_player_id === null && s.current_bid === null && s.timer_seconds === 10) {
        record("Dev DB - Auction Session State", "DATA_INTEGRITY", "PASS", `Session ID ${s.id} is active, revision 0, idle between lots.`);
      } else {
        record("Dev DB - Auction Session State", "DATA_INTEGRITY", "FAIL", `Session state invalid: ${JSON.stringify(s)}`);
      }
    } else {
      record("Dev DB - Auction Session State", "DATA_INTEGRITY", "FAIL", `Expected 1 session row, got ${sRes.rows.length}`);
    }
  } finally {
    await devClient.end().catch(() => {});
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: Strict Read-Only Production Preservation Check
  // -------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: Strict Read-Only Production Preservation Check ---");

  const prodClient = new Client({ connectionString: PROD_DATABASE_URL });
  await prodClient.connect();

  try {
    // 4.1: Production Tournament 25
    const pTRes = await prodClient.query("SELECT * FROM tournaments WHERE id = 25");
    if (pTRes.rows.length === 1 && pTRes.rows[0].name === "BIDWAR PREMIER LEAGUE" && pTRes.rows[0].auction_code === "SL972608") {
      record("Prod DB - Tournament 25 Intact", "PROD_PRESERVATION", "PASS", "Tournament 25 untouched (Name: BIDWAR PREMIER LEAGUE, Code: SL972608).");
    } else {
      record("Prod DB - Tournament 25 Intact", "PROD_PRESERVATION", "FAIL", "Production Tournament 25 corrupted or missing!");
    }

    // 4.2: Production Teams (exactly 2: 54, 55)
    const pTeams = await prodClient.query("SELECT id, name, purse, purse_used FROM teams WHERE tournament_id = 25 ORDER BY id ASC");
    if (pTeams.rows.length === 2 && pTeams.rows[0].id === 54 && pTeams.rows[1].id === 55) {
      record("Prod DB - Teams Intact", "PROD_PRESERVATION", "PASS", `Exactly 2 teams (54, 55). Team 54 purseUsed: ${pTeams.rows[0].purse_used}, Team 55 purseUsed: ${pTeams.rows[1].purse_used}.`);
    } else {
      record("Prod DB - Teams Intact", "PROD_PRESERVATION", "FAIL", `Production teams modified! Count: ${pTeams.rows.length}`);
    }

    // 4.3: Production Players (exactly 5: 369, 370, 371, 372, 448)
    const pPlayers = await prodClient.query("SELECT id, serial_no, name, status, sold_price FROM players WHERE tournament_id = 25 ORDER BY id ASC");
    const pPlayerIds = pPlayers.rows.map(r => r.id);
    if (JSON.stringify(pPlayerIds) === JSON.stringify([369, 370, 371, 372, 448])) {
      record("Prod DB - Players Intact", "PROD_PRESERVATION", "PASS", `Exactly 5 players ([369, 370, 371, 372, 448]) untouched.`);
    } else {
      record("Prod DB - Players Intact", "PROD_PRESERVATION", "FAIL", `Production player IDs modified: ${JSON.stringify(pPlayerIds)}`);
    }

    // 4.4: Production Session (session 27, revision 46)
    const pSession = await prodClient.query("SELECT id, revision, status, current_player_id FROM auction_sessions WHERE tournament_id = 25");
    if (pSession.rows.length === 1 && pSession.rows[0].id === 27 && pSession.rows[0].revision === 46) {
      record("Prod DB - Auction Session Intact", "PROD_PRESERVATION", "PASS", `Session 27 untouched with revision = 46.`);
    } else {
      record("Prod DB - Auction Session Intact", "PROD_PRESERVATION", "FAIL", `Production session modified: ${JSON.stringify(pSession.rows)}`);
    }

    // 4.5: Production Bids (bids 213, 217)
    const pBids = await prodClient.query("SELECT id, player_id, team_id, amount FROM bids WHERE tournament_id = 25 ORDER BY id ASC");
    const pBidIds = pBids.rows.map(r => r.id);
    if (JSON.stringify(pBidIds) === JSON.stringify([213, 217])) {
      record("Prod DB - Bids Intact", "PROD_PRESERVATION", "PASS", `Exactly 2 bids ([213, 217]) untouched.`);
    } else {
      record("Prod DB - Bids Intact", "PROD_PRESERVATION", "FAIL", `Production bids modified: ${JSON.stringify(pBidIds)}`);
    }

    // 4.6: Zero simulation footprint in production
    const pSim = await prodClient.query("SELECT * FROM tournaments WHERE auction_code = 'SIMBPL01' OR name LIKE '%SIM_%'");
    if (pSim.rows.length === 0) {
      record("Prod DB - Zero Simulation Footprint", "PROD_PRESERVATION", "PASS", "Zero simulation tournaments or records found in production.");
    } else {
      record("Prod DB - Zero Simulation Footprint", "PROD_PRESERVATION", "FAIL", `CRITICAL: Found simulation records in production: ${JSON.stringify(pSim.rows)}`);
    }
  } finally {
    await prodClient.end().catch(() => {});
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n================================================================");
  console.log("   ADVERSARIAL VERIFICATION SUMMARY");
  console.log("================================================================");
  const total = reports.length;
  const passed = reports.filter(r => r.status === "PASS").length;
  const failed = reports.filter(r => r.status === "FAIL").length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFAILED CHECKS:");
    for (const r of reports.filter(r => r.status === "FAIL")) {
      console.log(` - [${r.category}] ${r.name}: ${r.details}`);
    }
  }

  return { total, passed, failed, reports };
}

runAdversarialTests().catch(err => {
  console.error("FATAL in adversarial test runner:", err);
  process.exit(1);
});
