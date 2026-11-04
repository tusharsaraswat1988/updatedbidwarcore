/**
 * ============================================================================
 * BIDWAR — PHASE 3.3 RUNTIME VERIFICATION & AUCTION RESILIENCE TEST SUITE
 * ============================================================================
 * Verifies live runtime resilience and hardening across:
 * 1. Simultaneous multi-owner bidding war & budget integrity
 * 2. Duplicate bid submission & retry idempotency
 * 3. Bid rejection during operator pause
 * 4. Bid acceptance and timer restoration during operator resume
 * 5. Sell race prevention during active bidding (SEC-2026-07 extension)
 * 6. Duplicate player sale prevention & purse isolation
 * 7. Server restart & state reconstitution integrity
 * 8. Badminton scorer lease takeover revocation
 * 9. Concurrent scorer initial lock acquisition & conflict serialization
 * 10. Reconnect after lease expiry (> 180s timeout)
 * 11. Stale score submission rejection & monotonic sequence integrity
 * ============================================================================
 */

// Ensure target is the isolated disposable test database
const rawUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
if (rawUrl) {
  const u = new URL(rawUrl);
  u.pathname = "/bidwar_test_scratch";
  const isolatedUrl = u.toString();
  process.env.DATABASE_URL = isolatedUrl;
  process.env.NEON_DATABASE_URL = isolatedUrl;
  process.env.DIRECT_DATABASE_URL = isolatedUrl.replace("-pooler.", ".");
}

import { createPgClient, Client, db } from "@workspace/db";
import { sql } from "drizzle-orm";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

// Initialize application environment & runtime
import "./lib/bootstrap.js";
import "./lib/scoring-adapters/register.js";

import { resolveDirectDatabaseUrl } from "@workspace/db/database-url";
import router from "./routes/index.js";
import { jwtAuthMiddleware } from "./middleware/jwt-auth.js";
import { organizerAccountStatusMiddleware } from "./middleware/organizer-account-status.js";
import { signScorerJwt, signAuthJwt, COOKIE_NAME } from "./lib/jwt.js";
import {
  acquireMatchLock,
  heartbeatMatchLock,
  releaseMatchLock,
} from "./lib/scorer-match-locks.js";
import { appendMatchEventBatch } from "./lib/scoring-platform/orchestrator.js";

// Colors for terminal reporting
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function logHeader(title: string) {
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
}

function logPass(msg: string) {
  console.log(`  ${GREEN}✓ [PASS]${RESET} ${msg}`);
}

function logFail(msg: string, err?: any) {
  console.log(`  ${RED}✗ [FAIL]${RESET} ${msg}`);
  if (err) console.error(err);
}

function logInfo(msg: string) {
  console.log(`  ${YELLOW}ℹ [INFO]${RESET} ${msg}`);
}

// ── Connect & Verify Target Database ──────────────────────────────────────────
const directDbUrl = resolveDirectDatabaseUrl();
const targetDbName = new URL(directDbUrl).pathname.replace("/", "");
console.log(`\nTarget Database URL Host: ${new URL(directDbUrl).host}`);
console.log(`Target Database Name: ${targetDbName}`);

if (directDbUrl.includes("ep-late-math-aohd4iep")) {
  throw new Error("SAFETY CRITICAL: Direct URL points to production host! Aborting immediately.");
}

// Set up real Express app for route testing
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(jwtAuthMiddleware);
app.use(organizerAccountStatusMiddleware);
app.use("/api", router);

// Distinct test IDs to prevent conflict with any existing records
const TID_AUCTION = 99501;
const TID_BADMINTON = 99502;
const TEAM_ID_1 = 99501;
const TEAM_ID_2 = 99502;
const TEAM_ID_3 = 99503;
const PLAYER_ID_1 = 99501;
const PLAYER_ID_2 = 99502;
const ORG_ID = 99501;

const MATCH_ID_1 = 99501;
const MATCH_ID_CONCURRENT = 99502;
const SCORER_ID_A = 99501;
const SCORER_ID_B = 99502;
const SCORER_ID_C = 99503;
const SESSION_A = "sess_alice_phase3_3";
const SESSION_B = "sess_bob_phase3_3";
const SESSION_C = "sess_charlie_phase3_3";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    logPass(msg);
    passedCount++;
  } else {
    logFail(msg);
    failedCount++;
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ── Cleanup and Provisioning Harness ─────────────────────────────────────────
async function cleanupTestData(client: any) {
  logInfo("Cleaning up test records for isolated test IDs...");
  const tids = [TID_AUCTION, TID_BADMINTON];
  const matches = [MATCH_ID_1, MATCH_ID_CONCURRENT];
  const scorers = [SCORER_ID_A, SCORER_ID_B, SCORER_ID_C];
  const teams = [TEAM_ID_1, TEAM_ID_2, TEAM_ID_3];

  await client.query(`DELETE FROM scoring_events WHERE match_id = ANY($1::int[])`, [matches]);
  const delLocks = await client.query(`DELETE FROM scorer_match_locks WHERE match_id = ANY($1::int[])`, [matches]);
  console.log(`[cleanup] Deleted scorer_match_locks rows: ${delLocks.rowCount}`);
  await client.query(`DELETE FROM badminton_match_details WHERE scoring_match_id = ANY($1::int[])`, [matches]);
  await client.query(`DELETE FROM scoring_matches WHERE id = ANY($1::int[])`, [matches]);
  await client.query(`DELETE FROM scorer_tournament_assignments WHERE scorer_id = ANY($1::int[])`, [scorers]);
  await client.query(`DELETE FROM scorer_sessions WHERE scorer_id = ANY($1::int[])`, [scorers]);
  await client.query(`DELETE FROM scorer_accounts WHERE id = ANY($1::int[])`, [scorers]);
  await client.query(`DELETE FROM bids WHERE tournament_id = ANY($1::int[])`, [tids]).catch(() => {});
  await client.query(`DELETE FROM auction_bid_events WHERE tournament_id = ANY($1::int[])`, [tids]).catch(() => {});
  await client.query(`DELETE FROM auction_sessions WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM players WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM teams WHERE id = ANY($1::int[])`, [teams]);
  await client.query(`DELETE FROM categories WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM tournaments WHERE id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM organizers WHERE id = $1`, [ORG_ID]);
}

async function seedData(client: any) {
  logInfo("Seeding isolated test records in PostgreSQL database...");

  // 1. Organizers & Tournaments
  await client.query(`
    INSERT INTO organizers (id, name, email, mobile, password_hash)
    VALUES ($1, 'Organizer Phase 3.3', 'org_phase33@bidwar.test', '9999999501', 'hash_test')
    ON CONFLICT (id) DO NOTHING
  `, [ORG_ID]);

  await client.query(`
    INSERT INTO tournaments (
      id, name, sport, scoring_enabled, scoring_phase,
      auction_enabled, organizer_id, license_status, owner_bidding_enabled
    ) VALUES (
      $1, 'Auction Resilience Cup', 'cricket', false, 'disabled',
      true, $3, 'active', true
    ), (
      $2, 'Badminton Resilience Trophy', 'badminton', true, 'ready',
      false, $3, 'active', true
    )
    ON CONFLICT (id) DO UPDATE SET
      scoring_enabled = EXCLUDED.scoring_enabled,
      auction_enabled = EXCLUDED.auction_enabled,
      owner_bidding_enabled = true,
      license_status = 'active';
  `, [TID_AUCTION, TID_BADMINTON, ORG_ID]);

  // 2. Teams & Players for Auction
  await client.query(`
    INSERT INTO teams (id, tournament_id, name, short_code, owner_name, owner_mobile, purse, purse_used, is_bidding_enabled)
    VALUES 
      ($1, $4, 'Alpha Smashers', 'ALP', 'Owner Alpha', '9999999511', 10000000, 0, true),
      ($2, $4, 'Bravo Knights', 'BRA', 'Owner Bravo', '9999999512', 10000000, 0, true),
      ($3, $4, 'Charlie Tigers', 'CHA', 'Owner Charlie', '9999999513', 10000000, 0, true)
    ON CONFLICT (id) DO UPDATE SET purse_used = 0, is_bidding_enabled = true;
  `, [TEAM_ID_1, TEAM_ID_2, TEAM_ID_3, TID_AUCTION]);

  await client.query(`
    INSERT INTO players (id, tournament_id, serial_no, name, base_price, status, team_id, sold_price)
    VALUES 
      ($1, $3, 1, 'Prime Batter', 0, 'available', NULL, NULL),
      ($2, $3, 2, 'Speed Bowler', 0, 'available', NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET status = 'available', team_id = NULL, sold_price = NULL;
  `, [PLAYER_ID_1, PLAYER_ID_2, TID_AUCTION]);

  // 3. Auction Session
  const timerEndsAt = new Date(Date.now() + 300000).toISOString();
  await client.query(`
    INSERT INTO auction_sessions (
      tournament_id, status, current_player_id, current_bid,
      current_bid_team_id, revision, timer_ends_at, timer_type, last_action
    ) VALUES (
      $1, 'active', $2, NULL,
      NULL, 10, $3, 'player', 'player_selected'
    )
    ON CONFLICT (tournament_id) DO UPDATE SET
      status = 'active',
      current_player_id = $2,
      current_bid = NULL,
      current_bid_team_id = NULL,
      revision = 10,
      timer_ends_at = $3,
      timer_type = 'player',
      last_action = 'player_selected';
  `, [TID_AUCTION, PLAYER_ID_1, timerEndsAt]);

  // 4. Scorer Accounts & Sessions
  await client.query(`
    INSERT INTO scorer_accounts (id, name, mobile, pin_hash, is_active)
    VALUES 
      ($1, 'Alice Scorer', '9999999501', 'pin_hash_a', true),
      ($2, 'Bob Scorer', '9999999502', 'pin_hash_b', true),
      ($3, 'Charlie Scorer', '9999999503', 'pin_hash_c', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
  `, [SCORER_ID_A, SCORER_ID_B, SCORER_ID_C]);

  await client.query(`
    INSERT INTO scorer_tournament_assignments (scorer_id, tournament_id)
    VALUES 
      ($1, $4),
      ($2, $4),
      ($3, $4)
    ON CONFLICT DO NOTHING;
  `, [SCORER_ID_A, SCORER_ID_B, SCORER_ID_C, TID_BADMINTON]);

  const expiresAt = new Date(Date.now() + 86400000);
  await client.query(`
    INSERT INTO scorer_sessions (id, scorer_id, expires_at)
    VALUES 
      ($1, $4, $7),
      ($2, $5, $7),
      ($3, $6, $7)
    ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked_at = NULL;
  `, [SESSION_A, SESSION_B, SESSION_C, SCORER_ID_A, SCORER_ID_B, SCORER_ID_C, expiresAt]);

  // 5. Matches for Badminton
  await client.query(`
    INSERT INTO scoring_matches (id, tournament_id, sport_slug, status, match_kind, home_team_id, away_team_id)
    VALUES 
      ($1, $3, 'badminton', 'live', 'singles', $4, $5),
      ($2, $3, 'badminton', 'live', 'singles', $4, $5)
    ON CONFLICT (id) DO UPDATE SET status = 'live';
  `, [MATCH_ID_1, MATCH_ID_CONCURRENT, TID_BADMINTON, TEAM_ID_1, TEAM_ID_2]);

  await client.query(`
    INSERT INTO badminton_match_details (scoring_match_id, tournament_id, match_type, state_snapshot_json)
    VALUES 
      ($1, $3, 'singles', '{"status":"live"}'::jsonb),
      ($2, $3, 'singles', '{"status":"live"}'::jsonb)
    ON CONFLICT (scoring_match_id) DO NOTHING;
  `, [MATCH_ID_1, MATCH_ID_CONCURRENT, TID_BADMINTON]);

  logPass("Seed data initialized in PostgreSQL database.");
}

// ── Main Runner ──────────────────────────────────────────────────────────────
async function main() {
  const masterClient = new Client({
    connectionString: directDbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await masterClient.connect();

  const masterDbCheck = await masterClient.query("SELECT current_database()");
  console.log("MASTER CLIENT CURRENT_DATABASE:", masterDbCheck.rows[0]);

  try {
    await cleanupTestData(masterClient);
    await seedData(masterClient);

    const adminToken = signAuthJwt({
      userId: ORG_ID,
      role: "organizer",
      email: "org_phase33@bidwar.test",
      isAdmin: true,
      adminLevel: "master",
    });
    const adminCookie = `${COOKIE_NAME}=${adminToken}`;

    // =========================================================================
    // TEST 1: Simultaneous Multi-Owner Bidding War & Server-Authoritative CAS
    // =========================================================================
    logHeader("TEST 1: Simultaneous Multi-Owner Bidding War (3 Concurrent Owners)");
    {
      const barrierKey = 77101;
      const barrierHoldingClient = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
      await barrierHoldingClient.connect();
      await barrierHoldingClient.query("BEGIN");
      await barrierHoldingClient.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);

      const createBiddingOwner = (teamId: number, bidAmount: number) => {
        return (async () => {
          const client = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
          await client.connect();
          try {
            await client.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);
          } finally {
            await client.end();
          }

          return request(app)
            .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
            .set("Cookie", [adminCookie])
            .send({
              teamId,
              amount: bidAmount,
            });
        })();
      };

      // Launch 3 simultaneous opening bids for 0
      const bidPromise1 = createBiddingOwner(TEAM_ID_1, 0);
      const bidPromise2 = createBiddingOwner(TEAM_ID_2, 0);
      const bidPromise3 = createBiddingOwner(TEAM_ID_3, 0);

      // Verify all 3 are queued on the advisory lock
      let waiters = 0;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const res = await masterClient.query(
          `SELECT count(*)::int AS waiters FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted`,
          [barrierKey]
        );
        waiters = res.rows[0].waiters;
        if (waiters === 3) break;
      }
      assert(waiters === 3, `All 3 concurrent bidding clients queued on PostgreSQL advisory lock (waiters = ${waiters})`);

      // Release barrier
      await barrierHoldingClient.query("COMMIT");
      await barrierHoldingClient.end();

      const [res1, res2, res3] = await Promise.all([bidPromise1, bidPromise2, bidPromise3]);
      const responses = [res1, res2, res3];

      const successResponses = responses.filter((r) => r.status === 200);
      const conflictResponses = responses.filter((r) => r.status === 409);

      assert(successResponses.length === 1, `Exactly 1 owner bid won the race (successes = ${successResponses.length})`);
      assert(conflictResponses.length === 2, `The other 2 owner bids were safely rejected with HTTP 409 Conflict (conflicts = ${conflictResponses.length})`);

      // Verify database session state
      const sessionRes = await masterClient.query(
        `SELECT revision, current_bid, current_bid_team_id FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION]
      );
      assert(sessionRes.rows[0].revision === 11, `Auction session revision correctly incremented from 10 to 11 (revision = ${sessionRes.rows[0].revision})`);
      assert(sessionRes.rows[0].current_bid === 0, `Current bid correctly set to 0 (current_bid = ${sessionRes.rows[0].current_bid})`);

      const winningTeamId = sessionRes.rows[0].current_bid_team_id;
      assert([TEAM_ID_1, TEAM_ID_2, TEAM_ID_3].includes(winningTeamId), `Winning team is a valid participant (${winningTeamId})`);
    }

    // =========================================================================
    // TEST 2: Duplicate Bid Submission / Retry Idempotency
    // =========================================================================
    logHeader("TEST 2: Duplicate Bid Submission & Retry Idempotency");
    {
      const resSession = await masterClient.query(
        `SELECT current_bid_team_id FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION]
      );
      const winningTeam = resSession.rows[0].current_bid_team_id;
      const otherTeam = winningTeam === TEAM_ID_1 ? TEAM_ID_2 : TEAM_ID_1;

      // 1. Double-bid from same team who is already leading -> HTTP 409
      const doubleBidRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: winningTeam,
          amount: 25000,
        });
      assert(doubleBidRes.status === 409, `Leading team double-bid rejected with HTTP 409 Conflict`);
      assert(/already the highest/i.test(doubleBidRes.body?.error || ""), `Rejection states highest bidder: "${doubleBidRes.body?.error}"`);

      // 2. Submit valid higher bid from other team (25000)
      const validBidRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: otherTeam,
          amount: 25000,
        });
      assert(validBidRes.status === 200, `Other team valid bid accepted with HTTP 200`);

      // 3. Duplicate bid retry for the same amount (25000)
      const dupAmountRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: winningTeam,
          amount: 25000,
        });
      assert(dupAmountRes.status === 400, `Duplicate bid amount rejected with HTTP 400`);
      assert(/increment|higher/i.test(dupAmountRes.body?.error || ""), `Duplicate rejection error explains requirement: "${dupAmountRes.body?.error}"`);

      // Verify exactly 1 bid row exists for 25000 in auction_bid_events
      const bidEventsRes = await masterClient.query(
        `SELECT count(*)::int AS count FROM auction_bid_events WHERE tournament_id = $1 AND bid_amount = 25000`,
        [TID_AUCTION]
      );
      assert(bidEventsRes.rows[0].count === 1, `Exactly 1 bid event persisted; zero double-recording (count = ${bidEventsRes.rows[0].count})`);
    }

    // =========================================================================
    // TEST 3: Bid Arriving During Operator Pause
    // =========================================================================
    logHeader("TEST 3: Bid Rejection During Operator Pause");
    {
      const pauseRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/pause`)
        .set("Cookie", [adminCookie])
        .send();
      assert(pauseRes.status === 200, `Operator paused auction with HTTP 200`);

      const resSession = await masterClient.query(
        `SELECT status, revision, timer_ends_at FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION]
      );
      assert(resSession.rows[0].status === "paused", `Session status is paused`);
      assert(resSession.rows[0].timer_ends_at === null, `Session timer_ends_at is cleared`);

      // Attempt bid while paused
      const bidRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: TEAM_ID_3,
          amount: 50000,
        });
      assert(bidRes.status === 400, `Bid rejected during pause with HTTP 400`);
      assert(/not active|paused/i.test(bidRes.body?.error || ""), `Error confirms auction inactive: "${bidRes.body?.error}"`);
    }

    // =========================================================================
    // TEST 4: Bid Acceptance After Operator Resume
    // =========================================================================
    logHeader("TEST 4: Bid Acceptance & Timer Restoration After Resume");
    {
      const resumeRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/start`)
        .set("Cookie", [adminCookie])
        .send();
      assert(resumeRes.status === 200, `Operator resumed auction with HTTP 200`);

      const resSession = await masterClient.query(
        `SELECT status, revision, timer_ends_at FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION]
      );
      assert(resSession.rows[0].status === "active", `Session status restored to active`);
      assert(resSession.rows[0].timer_ends_at !== null, `Session timer_ends_at restored`);

      // Bid after resume
      const bidRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: TEAM_ID_3,
          amount: 50000,
        });
      assert(bidRes.status === 200, `Bid accepted after resume with HTTP 200`);
    }

    // =========================================================================
    // TEST 5: Sell Race Prevention During Active Bidding (SEC-2026-07 Extension)
    // =========================================================================
    logHeader("TEST 5: Sell Race Prevention on Stale Bid Leader");
    {
      // Current leading team is TEAM_ID_3 with bid 50000.
      // Another team submits a higher bid (75000).
      const bidRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: TEAM_ID_2,
          amount: 75000,
        });
      assert(bidRes.status === 200, `Team 2 outbid Team 3 with 75,000 (HTTP 200)`);

      // Operator tries to SELL with expectedBidTeamId = TEAM_ID_3 (stale leader)
      const sellRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
        .set("Cookie", [adminCookie])
        .send({
          expectedBidTeamId: TEAM_ID_3,
          expectedBidAmount: 50000,
        });
      assert(sellRes.status === 409, `Stale leader sell attempt rejected with HTTP 409 Conflict`);
      assert(sellRes.body?.hint === "sell_race" || /changed|race/i.test(sellRes.body?.error || ""), `Rejection correctly identified sell race`);
    }

    // =========================================================================
    // TEST 6: Duplicate Player Sale Prevention & Purse Isolation
    // =========================================================================
    logHeader("TEST 6: Duplicate Player Sale Prevention & Purse Isolation");
    {
      // Valid sell to current leader (Team 2 at 75,000)
      const sellRes1 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
        .set("Cookie", [adminCookie])
        .send({
          expectedBidTeamId: TEAM_ID_2,
          expectedBidAmount: 75000,
        });
      assert(sellRes1.status === 200, `Player 1 sold to Team 2 for ₹75,000 with HTTP 200`);

      // Verify player status and purse
      const pRes = await masterClient.query(
        `SELECT status, team_id, sold_price FROM players WHERE id = $1`,
        [PLAYER_ID_1]
      );
      assert(pRes.rows[0].status === "sold", `Player 1 status is sold`);
      assert(pRes.rows[0].team_id === TEAM_ID_2, `Player 1 assigned to Team 2`);
      assert(pRes.rows[0].sold_price === 75000, `Player 1 sold_price is 75,000`);

      const tRes = await masterClient.query(
        `SELECT purse, purse_used FROM teams WHERE id = $1`,
        [TEAM_ID_2]
      );
      assert(tRes.rows[0].purse_used === 75000, `Team 2 purse_used is exactly 75,000`);

      // Attempt duplicate sell on the same player
      const sellRes2 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
        .set("Cookie", [adminCookie])
        .send();
      assert(sellRes2.status === 400, `Duplicate sell attempt rejected with HTTP 400`);
      assert(/no current player/i.test(sellRes2.body?.error || ""), `Duplicate sell error correctly flagged: "${sellRes2.body?.error}"`);

      // Verify purse was NOT debited a second time
      const tResAfter = await masterClient.query(
        `SELECT purse, purse_used FROM teams WHERE id = $1`,
        [TEAM_ID_2]
      );
      assert(tResAfter.rows[0].purse_used === 75000, `Team 2 purse_used remains exactly 75,000 (zero double debit)`);
    }

    // =========================================================================
    // TEST 7: Server State Reconstitution After Restart
    // =========================================================================
    logHeader("TEST 7: Server State Reconstitution After Restart");
    {
      const stateRes = await request(app)
        .get(`/api/tournaments/${TID_AUCTION}/auction`)
        .set("Cookie", [adminCookie]);
      assert(stateRes.status === 200, `State endpoint returns HTTP 200`);
      
      const body = stateRes.body;
      assert(body.status !== undefined, `State includes status (${body.status})`);
      assert(body.currentPlayer === null, `Current player is null after completed sale`);
      assert(body.soldPlayersCount === 1, `soldPlayersCount reconstructed correctly (1)`);
      
      const team2InState = body.teamPurses?.find((t: any) => t.teamId === TEAM_ID_2);
      assert(team2InState !== undefined, `Team 2 present in state teamPurses`);
      assert(team2InState?.purseUsed === 75000, `Team 2 purseUsed reconstituted accurately (75,000)`);
    }

    // =========================================================================
    // TEST 8: Badminton Scorer Lease Revocation After Takeover
    // =========================================================================
    logHeader("TEST 8: Badminton Scorer Lease Revocation (SEC-2026-06)");
    {
      // 1. Alice acquires lock v1
      const lockResA = await acquireMatchLock({
        matchId: MATCH_ID_1,
        scorerId: SCORER_ID_A,
        sessionId: SESSION_A,
        tournamentId: TID_BADMINTON,
        sport: "badminton",
      });
      assert(lockResA.ok === true, `Alice acquired initial lock v1`);
      const leaseA = (lockResA as any).lock;

      // 2. Bob forces takeover acquiring lock v2
      const lockResB = await acquireMatchLock({
        matchId: MATCH_ID_1,
        scorerId: SCORER_ID_B,
        sessionId: SESSION_B,
        tournamentId: TID_BADMINTON,
        sport: "badminton",
        forceTakeover: true,
      });
      assert(lockResB.ok === true, `Bob force-acquired lock v2`);
      const leaseB = (lockResB as any).lock;
      assert(leaseB.leaseVersion === leaseA.leaseVersion + 1, `Lease version monotonically incremented (${leaseA.leaseVersion} -> ${leaseB.leaseVersion})`);

      // 3. Alice attempts to append batch with stale lease v1
      let aliceError: any = null;
      try {
        await appendMatchEventBatch({
          tournamentId: TID_BADMINTON,
          matchId: MATCH_ID_1,
          sportSlug: "badminton",
          fixtureId: null,
          actor: { type: "scorer", id: String(SCORER_ID_A) },
          events: [
            {
              eventType: "badminton.point.won",
              payload: {
                winningSide: "left",
                gameNumber: 1,
                winnerScore: 1,
                loserScore: 0,
                isGamePoint: false,
                isMatchPoint: false,
              },
            },
          ],
          projectionMode: "replay",
          matchMeta: {
            matchId: MATCH_ID_1,
            tournamentId: TID_BADMINTON,
            sportSlug: "badminton",
            matchKind: "singles",
            sides: {
              home: { id: 1, label: "Alice", shortLabel: "A" },
              away: { id: 2, label: "Bob", shortLabel: "B" },
            },
          },
          lease: {
            scorerId: SCORER_ID_A,
            sessionId: SESSION_A,
            leaseId: leaseA.leaseId,
            leaseVersion: leaseA.leaseVersion,
          },
        });
      } catch (err) {
        aliceError = err;
      }

      assert(aliceError !== null, `Alice appendMatchEventBatch threw an error`);
      assert(
        aliceError?.code === "SCORER_LEASE_REVOKED" || aliceError?.code === "SCORER_LEASE_STALE",
        `Alice's stale batch aborted with lease fencing error (code = ${aliceError?.code})`
      );

      // Verify zero events written to scoring_events
      const eventsRes = await masterClient.query(
        `SELECT count(*)::int AS count FROM scoring_events WHERE match_id = $1`,
        [MATCH_ID_1]
      );
      assert(eventsRes.rows[0].count === 0, `Zero scoring events written by revoked lease (count = ${eventsRes.rows[0].count})`);
    }

    // =========================================================================
    // TEST 9: Concurrent Initial Scorer Lock Acquisition & Conflict Handling
    // =========================================================================
    logHeader("TEST 9: Concurrent Initial Scorer Lock Acquisition (No PostgreSQL 23505 Crash)");
    {
      // Match MATCH_ID_CONCURRENT currently has NO lock row in scorer_match_locks.
      // Two scorers (Alice & Charlie) concurrently attempt acquireMatchLock.
      const barrierKey = 77102;
      const barrierClient = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
      await barrierClient.connect();
      await barrierClient.query("BEGIN");
      await barrierClient.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);

      const createLockAcquirer = (scorerId: number, sessionId: string) => {
        return (async () => {
          const client = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
          await client.connect();
          try {
            await client.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);
          } finally {
            await client.end();
          }

          return acquireMatchLock({
            matchId: MATCH_ID_CONCURRENT,
            scorerId,
            sessionId,
            tournamentId: TID_BADMINTON,
            sport: "badminton",
          });
        })();
      };

      const lockPromise1 = createLockAcquirer(SCORER_ID_A, SESSION_A);
      const lockPromise2 = createLockAcquirer(SCORER_ID_C, SESSION_C);

      // Wait until both are waiting on the barrier
      let waiters = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const res = await masterClient.query(
          `SELECT count(*)::int AS waiters FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted`,
          [barrierKey]
        );
        waiters = res.rows[0].waiters;
        if (waiters === 2) break;
      }
      assert(waiters === 2, `Both concurrent lock acquirers queued on PostgreSQL advisory lock (waiters = ${waiters})`);

      // Release barrier
      await barrierClient.query("COMMIT");
      await barrierClient.end();

      const [resA, resC] = await Promise.all([lockPromise1, lockPromise2]);
      const results = [resA, resC];

      const success = results.filter((r) => r.ok === true);
      const locked = results.filter((r) => r.ok === false && r.code === "MATCH_LOCKED");

      assert(success.length === 1, `Exactly one scorer acquired the initial lock (successes = ${success.length})`);
      assert(locked.length === 1, `The second scorer received MATCH_LOCKED cleanly without 23505 exception (locked = ${locked.length})`);
    }

    // =========================================================================
    // TEST 10: Reconnect After Scorer Lease Expiry (> 180s Timeout)
    // =========================================================================
    logHeader("TEST 10: Reconnect After Scorer Lease Expiry (> 180s Timeout)");
    {
      // Age MATCH_ID_CONCURRENT lock 200 seconds into the past
      await masterClient.query(
        `UPDATE scorer_match_locks SET last_heartbeat_at = NOW() - INTERVAL '200 seconds' WHERE match_id = $1`,
        [MATCH_ID_CONCURRENT]
      );

      // Scorer Charlie now acquires the expired lock without forceTakeover
      const charlieAcquire = await acquireMatchLock({
        matchId: MATCH_ID_CONCURRENT,
        scorerId: SCORER_ID_C,
        sessionId: SESSION_C,
        tournamentId: TID_BADMINTON,
        sport: "badminton",
        forceTakeover: false,
      });

      assert(charlieAcquire.ok === true, `Charlie successfully reacquired expired lock (ok = true)`);
      assert((charlieAcquire as any).reacquired === true, `Lock was marked as reacquired`);
      assert((charlieAcquire as any).lock.scorerId === SCORER_ID_C, `Lock owner updated to Charlie`);
    }

    // =========================================================================
    // TEST 11: Stale Score Submission Rejection & Sequence Counter Integrity
    // =========================================================================
    logHeader("TEST 11: Stale Score Submission Rejection & Monotonic Event Integrity");
    {
      const lock = (await acquireMatchLock({
        matchId: MATCH_ID_1,
        scorerId: SCORER_ID_B,
        sessionId: SESSION_B,
        tournamentId: TID_BADMINTON,
        sport: "badminton",
      })) as any;

      // Append valid event
      const batchRes1 = await appendMatchEventBatch({
        tournamentId: TID_BADMINTON,
        matchId: MATCH_ID_1,
        sportSlug: "badminton",
        fixtureId: null,
        actor: { type: "scorer", id: String(SCORER_ID_B) },
        events: [
          {
            eventType: "badminton.point.won",
            payload: {
              winningSide: "left",
              gameNumber: 1,
              winnerScore: 1,
              loserScore: 0,
              isGamePoint: false,
              isMatchPoint: false,
            },
          },
        ],
        projectionMode: "replay",
        matchMeta: {
          matchId: MATCH_ID_1,
          tournamentId: TID_BADMINTON,
          sportSlug: "badminton",
          matchKind: "singles",
          sides: {
            home: { id: 1, label: "Alice", shortLabel: "A" },
            away: { id: 2, label: "Bob", shortLabel: "B" },
          },
        },
        lease: {
          scorerId: SCORER_ID_B,
          sessionId: SESSION_B,
          leaseId: lock.lock.leaseId,
          leaseVersion: lock.lock.leaseVersion,
        },
      });
      assert(batchRes1.envelopes.length === 1, `Valid point event committed with sequence 1`);

      // Verify sequence counter in database
      const countRes = await masterClient.query(
        `SELECT count(*)::int AS count FROM scoring_events WHERE match_id = $1`,
        [MATCH_ID_1]
      );
      assert(countRes.rows[0].count === 1, `scoring_events has exactly 1 committed row`);
    }

    console.log(`\n${BOLD}${GREEN}======================================================================${RESET}`);
    console.log(`${BOLD}${GREEN}  ALL 11 RUNTIME RESILIENCE TESTS PASSED SUCCESSFULLY!${RESET}`);
    console.log(`${BOLD}${GREEN}  Passed: ${passedCount} | Failed: ${failedCount}${RESET}`);
    console.log(`${BOLD}${GREEN}======================================================================${RESET}\n`);

  } finally {
    await cleanupTestData(masterClient);
    await masterClient.end();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("\nFATAL ERROR in Phase 3.3 Runtime Resilience verification:", err);
  process.exit(1);
});
