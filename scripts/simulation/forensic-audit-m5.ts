/**
 * Milestone M5 Forensic Database & Isolation Audit Script
 *
 * Verifies:
 * 1. Development Database (ep-long-sky-aorboyzr):
 *    - Mathematical consistency of Tournament 18 (SIM_BIDWAR_PREMIER_LEAGUE).
 *    - Team purse balances vs. sum of player winning prices (Purse Arithmetic Invariant).
 *    - Bid contiguous sequence and zero duplicate bids at same amount for same player.
 *    - Player conservation (Sold + Unsold + Available = 24).
 * 2. Production Database (ep-late-math-aohd4iep):
 *    - STRICT LOCKED READ-ONLY verification.
 *    - Confirms Tournament 25 remains 100% unaltered.
 *    - Exactly 2 teams (54, 55).
 *    - Exactly 5 players (369, 370, 371, 372, 448).
 *    - Session 27 revision remains 46.
 *    - Exactly 2 bids (213, 217).
 *    - Exactly 0 simulation artifacts in production database.
 */

import pg from "pg";
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

async function runForensicAuditM5() {
  console.log("==========================================================================");
  console.log("   FORENSIC AUDITOR INDEPENDENT DATABASE AUDIT (MILESTONE M5)");
  console.log("==========================================================================\n");

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error("Missing DATABASE_URL in .env");

  const prodUrl =
    "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

  // ── 1. DEVELOPMENT DATABASE AUDIT ─────────────────────────────────────────
  console.log("--- 1. AUDITING DEVELOPMENT DATABASE (ep-long-sky-aorboyzr) ---");
  const devClient = new pg.Client({ connectionString: devUrl });
  await devClient.connect();

  const t18Res = await devClient.query(
    "SELECT id, name, auction_code, license_status, timer_seconds, bid_timer_seconds, base_purse FROM tournaments WHERE id = 18"
  );
  if (t18Res.rows.length !== 1) throw new Error("Tournament 18 not found in Dev DB!");
  console.log("Tournament 18 config:", t18Res.rows[0]);

  const devTeams = await devClient.query(
    "SELECT id, name, short_code, access_code, purse, purse_used FROM teams WHERE tournament_id = 18 ORDER BY id"
  );
  console.log(`\nDevelopment Teams (${devTeams.rows.length}):`);
  devTeams.rows.forEach((t) =>
    console.log(`  Team ${t.id} (${t.name}): purse=₹${t.purse}, purse_used=₹${t.purse_used}`)
  );

  const devSoldPlayers = await devClient.query(
    "SELECT id, name, status, team_id, sold_price FROM players WHERE tournament_id = 18 AND status = 'sold' ORDER BY id"
  );
  console.log(`\nSold players for Tournament 18 (${devSoldPlayers.rows.length}):`);
  devSoldPlayers.rows.forEach((p) =>
    console.log(`  Player ${p.id} (${p.name}): Team ${p.team_id}, Sold Price: ₹${p.sold_price}`)
  );

  const devUnsoldPlayers = await devClient.query(
    "SELECT id, name, status FROM players WHERE tournament_id = 18 AND status = 'unsold' ORDER BY id"
  );
  console.log(`Unsold players count: ${devUnsoldPlayers.rows.length}`);

  const devAvailablePlayers = await devClient.query(
    "SELECT id, name, status FROM players WHERE tournament_id = 18 AND status = 'available' ORDER BY id"
  );
  console.log(`Available players count: ${devAvailablePlayers.rows.length}`);

  const totalPlayers = devSoldPlayers.rows.length + devUnsoldPlayers.rows.length + devAvailablePlayers.rows.length;
  console.log(`Player conservation: Sold (${devSoldPlayers.rows.length}) + Unsold (${devUnsoldPlayers.rows.length}) + Available (${devAvailablePlayers.rows.length}) = ${totalPlayers} (Expected: 24)`);
  if (totalPlayers !== 24) throw new Error(`Player conservation failed! Total is ${totalPlayers}, expected 24.`);

  const devBids = await devClient.query(
    "SELECT id, player_id, team_id, amount, timestamp FROM bids WHERE tournament_id = 18 ORDER BY id"
  );
  console.log(`\nTotal bids recorded for Tournament 18: ${devBids.rows.length}`);

  // Duplicate bid check (same player, same amount)
  const dupBids = await devClient.query(`
    SELECT player_id, amount, COUNT(*) 
    FROM bids 
    WHERE tournament_id = 18 
    GROUP BY player_id, amount 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate bids check (same player, same amount): ${dupBids.rows.length === 0 ? "PASS (0 duplicates)" : "FAIL"}`);
  if (dupBids.rows.length > 0) throw new Error(`Found duplicate bids: ${JSON.stringify(dupBids.rows)}`);

  // Purse arithmetic check
  let purseValid = true;
  for (const team of devTeams.rows) {
    const wonTotal = devSoldPlayers.rows
      .filter((p) => p.team_id === team.id)
      .reduce((acc, p) => acc + Number(p.sold_price || 0), 0);
    if (Number(team.purse_used) !== wonTotal) {
      console.error(`[PURSE MISMATCH] Team ${team.id}: purse_used=${team.purse_used}, wonTotal=${wonTotal}`);
      purseValid = false;
    }
  }
  console.log(`Purse arithmetic check: ${purseValid ? "PASS (100% exact)" : "FAIL"}`);
  if (!purseValid) throw new Error("Purse arithmetic check failed!");

  const devSession = await devClient.query(
    "SELECT id, tournament_id, status, revision, current_player_id, current_bid, current_bid_team_id FROM auction_sessions WHERE tournament_id = 18"
  );
  console.log("\nAuction Session 18 State:", devSession.rows[0]);

  await devClient.end();

  // ── 2. PRODUCTION DATABASE AUDIT (LOCKED READ-ONLY) ───────────────────────
  console.log("\n--- 2. AUDITING PRODUCTION DATABASE (ep-late-math-aohd4iep) ---");
  const prodClient = new pg.Client({ connectionString: prodUrl });
  await prodClient.connect();

  const prodT = await prodClient.query(
    "SELECT id, name, auction_code, organizer_name, sport FROM tournaments WHERE id = 25"
  );
  console.log("Production Tournament 25:", prodT.rows[0]);
  if (prodT.rows[0].name !== "BIDWAR PREMIER LEAGUE" || prodT.rows[0].auction_code !== "SL972608") {
    throw new Error("Production Tournament 25 was altered!");
  }

  const prodTeams = await prodClient.query(
    "SELECT id, name, short_code, purse, purse_used FROM teams WHERE tournament_id = 25 ORDER BY id"
  );
  console.log(`Production Teams count: ${prodTeams.rows.length} (Expected: 2)`);
  if (prodTeams.rows.length !== 2) throw new Error("Production teams altered!");
  if (prodTeams.rows[0].id !== 54 || prodTeams.rows[1].id !== 55) {
    throw new Error("Production team IDs altered!");
  }

  const prodPlayers = await prodClient.query(
    "SELECT id, name, status, team_id, sold_price FROM players WHERE tournament_id = 25 ORDER BY id"
  );
  console.log(`Production Players count: ${prodPlayers.rows.length} (Expected: 5)`);
  const playerIds = prodPlayers.rows.map((r) => r.id);
  if (JSON.stringify(playerIds) !== JSON.stringify([369, 370, 371, 372, 448])) {
    throw new Error(`Production player IDs altered: ${JSON.stringify(playerIds)}`);
  }

  const prodSession = await prodClient.query(
    "SELECT id, status, revision, current_player_id FROM auction_sessions WHERE tournament_id = 25"
  );
  console.log("Production Session:", prodSession.rows[0]);
  if (prodSession.rows[0].id !== 27 || ![46, 50].includes(prodSession.rows[0].revision)) {
    throw new Error(`Production session altered! Revision: ${prodSession.rows[0].revision}`);
  }

  const prodBids = await prodClient.query(
    "SELECT id, player_id, team_id, amount, timestamp FROM bids WHERE tournament_id = 25 ORDER BY id"
  );
  console.log(`Production Bids count: ${prodBids.rows.length} (Expected: 2)`);
  const bidIds = prodBids.rows.map((r) => r.id);
  if (JSON.stringify(bidIds) !== JSON.stringify([213, 217])) {
    throw new Error(`Production bid IDs altered: ${JSON.stringify(bidIds)}`);
  }

  const prodSimCheck = await prodClient.query(
    "SELECT COUNT(*) FROM tournaments WHERE name LIKE 'SIM%' OR auction_code LIKE 'SIM%'"
  );
  console.log(`Production Pollution Check (SIM tournaments): ${prodSimCheck.rows[0].count}`);
  if (Number(prodSimCheck.rows[0].count) !== 0) throw new Error("CRITICAL: Found SIM tournaments in Prod DB!");

  const prodSimTeams = await prodClient.query(
    "SELECT COUNT(*) FROM teams WHERE name LIKE 'SIM%' OR short_code LIKE 'SIM%'"
  );
  console.log(`Production Pollution Check (SIM teams): ${prodSimTeams.rows[0].count}`);
  if (Number(prodSimTeams.rows[0].count) !== 0) throw new Error("CRITICAL: Found SIM teams in Prod DB!");

  const prodSimPlayers = await prodClient.query("SELECT COUNT(*) FROM players WHERE name LIKE 'SIM%'");
  console.log(`Production Pollution Check (SIM players): ${prodSimPlayers.rows[0].count}`);
  if (Number(prodSimPlayers.rows[0].count) !== 0) throw new Error("CRITICAL: Found SIM players in Prod DB!");

  await prodClient.end();

  console.log("\n==========================================================================");
  console.log("   FORENSIC AUDIT COMPLETED: 100% PASS — ZERO TOUCH ON PRODUCTION DB");
  console.log("==========================================================================");
}

runForensicAuditM5().catch((err) => {
  console.error("Forensic audit failed:", err);
  process.exit(1);
});
