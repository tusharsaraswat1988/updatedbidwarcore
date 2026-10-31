import pg from "pg";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });

async function runForensicAudit() {
  console.log("==========================================================================");
  console.log("   FORENSIC AUDITOR INDEPENDENT DATABASE AUDIT (MILESTONE M3)");
  console.log("==========================================================================\n");

  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error("Missing DATABASE_URL in .env");

  const prodUrl = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

  // 1. DEVELOPMENT DATABASE VERIFICATION
  console.log("--- 1. AUDITING DEVELOPMENT DATABASE (ep-long-sky-aorboyzr) ---");
  const devClient = new pg.Client({ connectionString: devUrl });
  await devClient.connect();

  const t18Res = await devClient.query("SELECT id, name, auction_code, license_status, timer_seconds, bid_timer_seconds, base_purse FROM tournaments WHERE id = 18");
  console.log("Tournament 18 config:", t18Res.rows[0]);

  const devTeams = await devClient.query("SELECT id, name, short_code, access_code, purse, purse_used FROM teams WHERE tournament_id = 18 ORDER BY id");
  console.log(`Development Teams (${devTeams.rows.length}):`);
  devTeams.rows.forEach(t => console.log(`  Team ${t.id} (${t.name}): purse=${t.purse}, purse_used=${t.purse_used}`));

  const devBids = await devClient.query("SELECT id, player_id, team_id, amount, timestamp FROM bids WHERE tournament_id = 18 ORDER BY id");
  console.log(`\nTotal bids recorded for Tournament 18: ${devBids.rows.length}`);
  devBids.rows.forEach(b => console.log(`  Bid ${b.id}: Player ${b.player_id}, Team ${b.team_id}, Amount ₹${b.amount}, Time: ${b.timestamp}`));

  const devSoldPlayers = await devClient.query("SELECT id, name, status, team_id, sold_price FROM players WHERE tournament_id = 18 AND status = 'sold' ORDER BY id");
  console.log(`\nTotal sold players for Tournament 18: ${devSoldPlayers.rows.length}`);
  devSoldPlayers.rows.forEach(p => console.log(`  Player ${p.id} (${p.name}): Team ${p.team_id}, Sold Price: ₹${p.sold_price}`));

  const devSession = await devClient.query("SELECT id, tournament_id, status, revision, current_player_id, current_bid, current_bid_team_id FROM auction_sessions WHERE tournament_id = 18");
  console.log("\nAuction Session 18 State:", devSession.rows[0]);

  // Check for duplicate bids for the same player
  const dupBids = await devClient.query(`
    SELECT player_id, amount, COUNT(*) 
    FROM bids 
    WHERE tournament_id = 18 
    GROUP BY player_id, amount 
    HAVING COUNT(*) > 1
  `);
  console.log(`Duplicate bids count (same player, same amount): ${dupBids.rows.length}`);

  await devClient.end();

  // 2. PRODUCTION DATABASE VERIFICATION (LOCKED READ-ONLY)
  console.log("\n--- 2. AUDITING PRODUCTION DATABASE (ep-late-math-aohd4iep) ---");
  const prodClient = new pg.Client({ connectionString: prodUrl });
  await prodClient.connect();

  const prodT = await prodClient.query("SELECT id, name, auction_code, organizer_name, sport FROM tournaments WHERE id = 25");
  console.log("Production Tournament 25:", prodT.rows[0]);

  const prodTeams = await prodClient.query("SELECT id, name, short_code, purse, purse_used FROM teams WHERE tournament_id = 25 ORDER BY id");
  console.log(`Production Teams (${prodTeams.rows.length}):`);
  prodTeams.rows.forEach(t => console.log(`  Team ${t.id} (${t.name}): purse=${t.purse}, purse_used=${t.purse_used}`));

  const prodPlayers = await prodClient.query("SELECT id, name, status, team_id, sold_price FROM players WHERE tournament_id = 25 ORDER BY id");
  console.log(`Production Players (${prodPlayers.rows.length}):`);
  prodPlayers.rows.forEach(p => console.log(`  Player ${p.id} (${p.name}): status=${p.status}, team=${p.team_id}, soldPrice=${p.sold_price}`));

  const prodSession = await prodClient.query("SELECT id, status, revision, current_player_id FROM auction_sessions WHERE tournament_id = 25");
  console.log("Production Session:", prodSession.rows[0]);

  const prodBids = await prodClient.query("SELECT id, player_id, team_id, amount, timestamp FROM bids WHERE tournament_id = 25 ORDER BY id");
  console.log(`Production Bids (${prodBids.rows.length}):`);
  prodBids.rows.forEach(b => console.log(`  Bid ${b.id}: Player ${b.player_id}, Team ${b.team_id}, Amount ₹${b.amount}`));

  const prodSimCheck = await prodClient.query("SELECT COUNT(*) FROM tournaments WHERE name LIKE 'SIM%' OR auction_code LIKE 'SIM%'");
  console.log(`Production Pollution Check (SIM tournaments): ${prodSimCheck.rows[0].count}`);

  const prodSimTeams = await prodClient.query("SELECT COUNT(*) FROM teams WHERE name LIKE 'SIM%' OR short_code LIKE 'SIM%'");
  console.log(`Production Pollution Check (SIM teams): ${prodSimTeams.rows[0].count}`);

  const prodSimPlayers = await prodClient.query("SELECT COUNT(*) FROM players WHERE name LIKE 'SIM%'");
  console.log(`Production Pollution Check (SIM players): ${prodSimPlayers.rows[0].count}`);

  await prodClient.end();

  console.log("\n==========================================================================");
  console.log("   INDEPENDENT AUDIT COMPLETED");
  console.log("==========================================================================");
}

runForensicAudit().catch(err => {
  console.error("Forensic audit error:", err);
  process.exit(1);
});
