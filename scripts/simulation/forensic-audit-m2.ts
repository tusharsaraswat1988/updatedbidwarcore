/**
 * Independent Forensic Audit Script for Milestone M2
 * Teamwork Auditor M2.1
 *
 * Performs exhaustive empirical verification of:
 * 1. Development DB: Tournament 18, 5 teams, 24 players, active session (revision 0), zero residual history.
 * 2. Production DB: Tournament 25, 2 teams, 5 players, session 27 (rev 46), 2 bids, zero simulation leakage.
 */

import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Client } = pg;

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const DEV_DATABASE_URL = process.env.DATABASE_URL!;
const PROD_DATABASE_URL = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

interface AuditResult {
  check: string;
  verdict: "PASS" | "FAIL";
  evidence: any;
}

const auditLog: AuditResult[] = [];

function recordCheck(check: string, pass: boolean, evidence: any) {
  auditLog.push({
    check,
    verdict: pass ? "PASS" : "FAIL",
    evidence,
  });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${check}`);
  if (!pass) {
    console.error("  FAILED EVIDENCE:", JSON.stringify(evidence, null, 2));
  }
}

async function auditDevDb(client: pg.Client) {
  console.log("\n=======================================================");
  console.log("   FORENSIC AUDIT — DEVELOPMENT DATABASE");
  console.log("=======================================================\n");

  // Check 1: Tournament 18 presence and exact attributes
  const tRes = await client.query("SELECT * FROM tournaments WHERE auction_code = 'SIMBPL01'");
  const tPass = tRes.rows.length === 1 && tRes.rows[0].id === 18;
  recordCheck("DEV_TOURNAMENT_18_EXISTS", tPass, tRes.rows);

  if (tRes.rows.length > 0) {
    const t = tRes.rows[0];
    recordCheck("DEV_TOURNAMENT_NAME", t.name === "SIM_BIDWAR_PREMIER_LEAGUE", { actual: t.name });
    recordCheck("DEV_TOURNAMENT_SPORT", t.sport === "cricket" && t.sport_id === 1, { sport: t.sport, sportId: t.sport_id });
    recordCheck("DEV_TOURNAMENT_LICENSE_TRIAL", t.license_status === "trial", { licenseStatus: t.license_status });
    recordCheck("DEV_TOURNAMENT_PURSE_CONFIG", t.base_purse === 1000000 && t.min_bid === 10000 && t.bid_increment === 5000, {
      basePurse: t.base_purse,
      minBid: t.min_bid,
      bidIncrement: t.bid_increment,
    });
    recordCheck("DEV_TOURNAMENT_TIMERS", t.timer_seconds === 10 && t.bid_timer_seconds === 10, {
      timerSeconds: t.timer_seconds,
      bidTimerSeconds: t.bid_timer_seconds,
    });
    recordCheck("DEV_TOURNAMENT_MODULES", t.auction_enabled === true && t.scoring_enabled === true, {
      auctionEnabled: t.auction_enabled,
      scoringEnabled: t.scoring_enabled,
    });
  }

  // Check 2: Exactly 5 teams with required codes and purse
  const teamsRes = await client.query("SELECT * FROM teams WHERE tournament_id = 18 ORDER BY id ASC");
  const expectedTeams = [
    { name: "SIM_TITANS", short: "ST101", access: "SIMT01", mobile: "9999000001" },
    { name: "SIM_WARRIORS", short: "SW102", access: "SIMW02", mobile: "9999000002" },
    { name: "SIM_ROYALS", short: "SR103", access: "SIMR03", mobile: "9999000003" },
    { name: "SIM_KINGS", short: "SK104", access: "SIMK04", mobile: "9999000004" },
    { name: "SIM_STRIKERS", short: "SS105", access: "SIMS05", mobile: "9999000005" },
  ];

  const teamsCountPass = teamsRes.rows.length === 5;
  recordCheck("DEV_TEAMS_COUNT_5", teamsCountPass, { count: teamsRes.rows.length });

  let allTeamsMatch = teamsCountPass;
  for (let i = 0; i < expectedTeams.length; i++) {
    const act = teamsRes.rows[i];
    const exp = expectedTeams[i];
    if (
      !act ||
      act.name !== exp.name ||
      act.short_code !== exp.short ||
      act.access_code !== exp.access ||
      act.owner_mobile !== exp.mobile ||
      act.purse !== 1000000 ||
      act.purse_used !== 0 ||
      act.is_bidding_enabled !== true
    ) {
      allTeamsMatch = false;
    }
  }
  recordCheck("DEV_TEAMS_METADATA_EXACT_MATCH", allTeamsMatch, teamsRes.rows.map(t => ({
    id: t.id,
    name: t.name,
    short_code: t.short_code,
    access_code: t.access_code,
    owner_mobile: t.owner_mobile,
    purse: t.purse,
    purse_used: t.purse_used,
    is_bidding_enabled: t.is_bidding_enabled,
  })));

  // Check 3: Exactly 24 players with contiguous serials and correct roles
  const playersRes = await client.query("SELECT * FROM players WHERE tournament_id = 18 ORDER BY serial_no ASC");
  recordCheck("DEV_PLAYERS_COUNT_24", playersRes.rows.length === 24, { count: playersRes.rows.length });

  const roleCounts: Record<string, number> = {};
  let serialsContiguous = true;
  let allAvailable = true;
  let allBlankMobile = true;
  let allBasePricesValid = true;

  playersRes.rows.forEach((p, idx) => {
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
    if (p.serial_no !== idx + 1) serialsContiguous = false;
    if (p.status !== "available") allAvailable = false;
    if (p.mobile_number !== "") allBlankMobile = false;
    if (p.base_price < 10000 || p.base_price > 50000) allBasePricesValid = false;
  });

  recordCheck("DEV_PLAYERS_ROLES_EQUAL_DISTRIBUTION",
    roleCounts["Batsman"] === 6 &&
    roleCounts["Bowler"] === 6 &&
    roleCounts["All-Rounder"] === 6 &&
    roleCounts["Wicketkeeper"] === 6,
    roleCounts
  );
  recordCheck("DEV_PLAYERS_SERIALS_CONTIGUOUS_1_24", serialsContiguous, { serialsCount: playersRes.rows.length });
  recordCheck("DEV_PLAYERS_STATUS_ALL_AVAILABLE", allAvailable, { allAvailable });
  recordCheck("DEV_PLAYERS_MOBILE_BLANK_ISOLATION", allBlankMobile, { allBlankMobile });
  recordCheck("DEV_PLAYERS_BASE_PRICES_VALID", allBasePricesValid, { min: 10000, max: 50000 });

  // Check 4: Auction Session (exactly 1 active session with revision 0)
  const sessionRes = await client.query("SELECT * FROM auction_sessions WHERE tournament_id = 18");
  const sPass =
    sessionRes.rows.length === 1 &&
    sessionRes.rows[0].status === "active" &&
    sessionRes.rows[0].revision === 0 &&
    sessionRes.rows[0].current_player_id === null &&
    sessionRes.rows[0].current_bid === null &&
    sessionRes.rows[0].timer_seconds === 10;
  recordCheck("DEV_SESSION_PRISTINE_STATE", sPass, {
    sessionId: sessionRes.rows[0]?.id,
    status: sessionRes.rows[0]?.status,
    revision: sessionRes.rows[0]?.revision,
    currentPlayerId: sessionRes.rows[0]?.current_player_id,
    currentBid: sessionRes.rows[0]?.current_bid,
    timerSeconds: sessionRes.rows[0]?.timer_seconds,
  });

  // Check 5: Historical tables for tournament 18 are empty (clean slate)
  const bidsCount = await client.query("SELECT count(*)::int as c FROM bids WHERE tournament_id = 18");
  const bidEventsCount = await client.query("SELECT count(*)::int as c FROM auction_bid_events WHERE tournament_id = 18");
  const playerEventsCount = await client.query("SELECT count(*)::int as c FROM auction_player_events WHERE tournament_id = 18");
  const timerEventsCount = await client.query("SELECT count(*)::int as c FROM auction_timer_events WHERE tournament_id = 18");

  const historyEmpty =
    bidsCount.rows[0].c === 0 &&
    bidEventsCount.rows[0].c === 0 &&
    playerEventsCount.rows[0].c === 0 &&
    timerEventsCount.rows[0].c === 0;

  recordCheck("DEV_HISTORY_TABLES_CLEAN_SLATE", historyEmpty, {
    bids: bidsCount.rows[0].c,
    bidEvents: bidEventsCount.rows[0].c,
    playerEvents: playerEventsCount.rows[0].c,
    timerEvents: timerEventsCount.rows[0].c,
  });
}

async function auditProdDb(client: pg.Client) {
  console.log("\n=======================================================");
  console.log("   FORENSIC AUDIT — PRODUCTION DATABASE (LOCKED READ-ONLY)");
  console.log("=======================================================\n");

  // Check 1: Tournament 25 intact
  const t25Res = await client.query("SELECT * FROM tournaments WHERE id = 25");
  const t25 = t25Res.rows[0];
  const t25Pass =
    t25Res.rows.length === 1 &&
    t25.name === "BIDWAR PREMIER LEAGUE" &&
    t25.auction_code === "SL972608" &&
    t25.venue === "Pitch & Paddle" &&
    t25.organizer_name === "Tushar Saraswat" &&
    t25.organizer_mobile === "8707488250";
  recordCheck("PROD_TOURNAMENT_25_UNTOUCHED", t25Pass, {
    id: t25?.id,
    name: t25?.name,
    code: t25?.auction_code,
    venue: t25?.venue,
  });

  // Check 2: Exactly 2 teams (54, 55)
  const teamsRes = await client.query("SELECT id, name, short_code, purse, purse_used FROM teams WHERE tournament_id = 25 ORDER BY id ASC");
  const teamsPass =
    teamsRes.rows.length === 2 &&
    teamsRes.rows[0].id === 54 &&
    teamsRes.rows[1].id === 55;
  recordCheck("PROD_TEAMS_COUNT_AND_IDS_UNTOUCHED", teamsPass, teamsRes.rows);

  // Check 3: Exactly 5 players (369, 370, 371, 372, 448)
  const playersRes = await client.query("SELECT id, serial_no, name, role, base_price, status FROM players WHERE tournament_id = 25 ORDER BY id ASC");
  const expectedPIds = [369, 370, 371, 372, 448];
  const actualPIds = playersRes.rows.map((p) => p.id);
  const playersPass = JSON.stringify(actualPIds) === JSON.stringify(expectedPIds);
  recordCheck("PROD_PLAYERS_COUNT_AND_IDS_UNTOUCHED", playersPass, actualPIds);

  // Check 4: Auction Session 27 Revision 46 (OCC counter invariant)
  const sessionRes = await client.query("SELECT id, status, revision, current_player_id, timer_seconds FROM auction_sessions WHERE tournament_id = 25");
  const s27 = sessionRes.rows[0];
  const sessionPass =
    sessionRes.rows.length === 1 &&
    s27.id === 27 &&
    s27.revision === 46 &&
    s27.status === "active";
  recordCheck("PROD_SESSION_27_REVISION_46_INVARIANT", sessionPass, s27);

  // Check 5: Exactly 2 accepted bids (213, 217)
  const bidsRes = await client.query("SELECT id, player_id, team_id, amount FROM bids WHERE tournament_id = 25 ORDER BY id ASC");
  const expectedBIds = [213, 217];
  const actualBIds = bidsRes.rows.map((b) => b.id);
  const bidsPass = JSON.stringify(actualBIds) === JSON.stringify(expectedBIds);
  recordCheck("PROD_BIDS_COUNT_AND_IDS_UNTOUCHED", bidsPass, bidsRes.rows);

  // Check 6: Event log counts unchanged (13 bid events, 15 player events, 14 timer events)
  const beCount = await client.query("SELECT count(*)::int as c FROM auction_bid_events WHERE tournament_id = 25");
  const peCount = await client.query("SELECT count(*)::int as c FROM auction_player_events WHERE tournament_id = 25");
  const teCount = await client.query("SELECT count(*)::int as c FROM auction_timer_events WHERE tournament_id = 25");

  const eventsPass =
    beCount.rows[0].c === 13 &&
    peCount.rows[0].c === 15 &&
    teCount.rows[0].c === 14;
  recordCheck("PROD_EVENT_LOGS_ROW_COUNTS_UNTOUCHED", eventsPass, {
    bidEvents: beCount.rows[0].c,
    playerEvents: peCount.rows[0].c,
    timerEvents: teCount.rows[0].c,
  });

  // Check 7: Absolute zero simulation contamination
  const simTourneys = await client.query("SELECT id, name, auction_code FROM tournaments WHERE auction_code LIKE 'SIM%' OR name LIKE 'SIM%'");
  const simTeams = await client.query("SELECT id, name FROM teams WHERE name LIKE 'SIM%' OR short_code LIKE 'SIM%'");
  const simPlayers = await client.query("SELECT id, name FROM players WHERE name LIKE '%(Sim)%'");

  const zeroPollution =
    simTourneys.rows.length === 0 &&
    simTeams.rows.length === 0 &&
    simPlayers.rows.length === 0;

  recordCheck("PROD_ZERO_SIMULATION_POLLUTION", zeroPollution, {
    simTournaments: simTourneys.rows.length,
    simTeams: simTeams.rows.length,
    simPlayers: simPlayers.rows.length,
  });
}

async function main() {
  const devClient = new Client({ connectionString: DEV_DATABASE_URL });
  const prodClient = new Client({ connectionString: PROD_DATABASE_URL });

  try {
    await devClient.connect();
    await auditDevDb(devClient);

    await prodClient.connect();
    await auditProdDb(prodClient);

    const totalChecks = auditLog.length;
    const failedChecks = auditLog.filter((c) => c.verdict === "FAIL");

    console.log("\n=======================================================");
    console.log("   AUDIT SUMMARY");
    console.log("=======================================================");
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`Passed: ${totalChecks - failedChecks.length}`);
    console.log(`Failed: ${failedChecks.length}`);

    if (failedChecks.length > 0) {
      console.error("\nFAILURES DETECTED:");
      console.error(JSON.stringify(failedChecks, null, 2));
      process.exit(1);
    } else {
      console.log("\nALL FORENSIC CHECKS PASSED EMPIRICALLY (CLEAN).");
      process.exit(0);
    }
  } finally {
    await devClient.end().catch(() => {});
    await prodClient.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("CRITICAL AUDIT ERROR:", err);
  process.exit(1);
});
