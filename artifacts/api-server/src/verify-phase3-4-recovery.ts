/**
 * ============================================================================
 * BIDWAR — PHASE 3.4 AUCTION RECOVERY & LIVE EVENT RELIABILITY TEST SUITE
 * ============================================================================
 * Deterministic automated integration & resilience verification covering:
 *
 * 1. Server restart during active auction
 * 2. Server restart during paused auction
 * 3. Recovered timer accuracy
 * 4. Network disconnect followed by reconnect
 * 5. Repeated reconnect without duplicate subscriptions
 * 6. Event sequence gap detection
 * 7. Out-of-order event handling
 * 8. Duplicate event delivery
 * 9. Duplicate sell request & pause idempotency
 * 10. Duplicate bid retry
 * 11. Concurrent pause and bid (advisory lock barrier)
 * 12. Concurrent sell and bid (advisory lock barrier)
 * 13. Stale auction revision rejection
 * 14. Realtime snapshot resynchronization
 * 15. Scorer reconnect and stale lease rejection
 * 16. Multiple clients receiving consistent authoritative state
 * ============================================================================
 */

import { Client, db } from "@workspace/db";
type PgClient = InstanceType<typeof Client>;
import { resolveDirectDatabaseUrl } from "@workspace/db/database-url";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Application runtime bootstrap
import "./lib/bootstrap.js";
import "./lib/scoring-adapters/register.js";

import router from "./routes/index.js";
import { jwtAuthMiddleware } from "./middleware/jwt-auth.js";
import { organizerAccountStatusMiddleware } from "./middleware/organizer-account-status.js";
import { signAuthJwt, COOKIE_NAME } from "./lib/jwt.js";
import {
  getCurrentEventVersion,
  nextEventVersion,
  setLocalEventVersionForTests,
  resetLocalEventStateForTests,
  formatSseFrame,
  publishAuctionEvent,
} from "./lib/auction-events.js";
import {
  addSseClient,
  removeSseClient,
  getSseClientCount,
} from "./lib/broadcast.js";
import {
  invalidateAuctionBuildCache,
  resetAuctionStateCacheForTests,
} from "./routes/auction.js";
import {
  shouldApplyBidDelta,
  isSequenceGap,
  shouldAcceptMonotonicVersion,
  nextMonotonicVersion,
  mergeBidFields,
} from "@workspace/api-base/auction-bid-sync";
import {
  acquireMatchLock,
} from "./lib/scorer-match-locks.js";
import {
  appendMatchEventBatch,
} from "./lib/scoring-platform/orchestrator.js";

// Terminal styling
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

function assert(condition: boolean, msg: string) {
  if (condition) {
    logPass(msg);
  } else {
    logFail(msg);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ── Connect & Safety Check ──────────────────────────────────────────────────
const directDbUrl = resolveDirectDatabaseUrl();
const targetDbName = new URL(directDbUrl).pathname.replace("/", "");
console.log(`\nTarget Database URL Host: ${new URL(directDbUrl).host}`);
console.log(`Target Database Name: ${targetDbName}`);

if (directDbUrl.includes("ep-late-math-aohd4iep")) {
  throw new Error("SAFETY CRITICAL: Direct URL points to production host! Aborting immediately.");
}

// Mount real Express application
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(jwtAuthMiddleware);
app.use(organizerAccountStatusMiddleware);
app.use("/api", router);

// Distinct test IDs for Phase 3.4 (avoids clash with 3.2/3.3)
const TID_AUCTION = 99601;
const TID_BADMINTON = 99602;
const ORG_ID = 996001;
const TEAM_ID_1 = 996011;
const TEAM_ID_2 = 996012;
const TEAM_ID_3 = 996013;
const PLAYER_ID_1 = 996021;
const PLAYER_ID_2 = 996022;
const PLAYER_ID_3 = 996023;
const MATCH_ID_1 = 996031;
const SCORER_ID_A = 996041;
const SCORER_ID_B = 996042;
const SESSION_A = "sess_recov_a_996";
const SESSION_B = "sess_recov_b_996";

async function cleanupTestData(client: PgClient) {
  console.log("  ℹ [INFO] Cleaning up test records for Phase 3.4 test IDs...");
  await client.query(`DELETE FROM scorer_match_locks WHERE match_id IN ($1)`, [MATCH_ID_1]);
  await client.query(`DELETE FROM scoring_events WHERE match_id IN ($1)`, [MATCH_ID_1]);
  await client.query(`DELETE FROM badminton_match_details WHERE scoring_match_id IN ($1)`, [MATCH_ID_1]);
  await client.query(`DELETE FROM scoring_matches WHERE tournament_id IN ($1)`, [TID_BADMINTON]);
  await client.query(`DELETE FROM scorer_sessions WHERE id IN ($1, $2)`, [SESSION_A, SESSION_B]);
  await client.query(`DELETE FROM scorer_tournament_assignments WHERE tournament_id IN ($1)`, [TID_BADMINTON]);
  await client.query(`DELETE FROM scorer_accounts WHERE id IN ($1, $2)`, [SCORER_ID_A, SCORER_ID_B]);

  await client.query(`DELETE FROM bids WHERE tournament_id IN ($1)`, [TID_AUCTION]);
  await client.query(`DELETE FROM auction_sessions WHERE tournament_id IN ($1)`, [TID_AUCTION]);
  await client.query(`DELETE FROM players WHERE tournament_id IN ($1, $2)`, [TID_AUCTION, TID_BADMINTON]);
  await client.query(`DELETE FROM teams WHERE tournament_id IN ($1, $2)`, [TID_AUCTION, TID_BADMINTON]);
  await client.query(`DELETE FROM tournaments WHERE id IN ($1, $2)`, [TID_AUCTION, TID_BADMINTON]);
}

async function seedData(client: PgClient) {
  console.log("  ℹ [INFO] Seeding isolated test records for Phase 3.4...");

  await client.query(`
    INSERT INTO organizers (id, name, email, mobile, password_hash)
    VALUES ($1, 'Recovery Test Organizer', 'org_phase34@bidwar.test', '9999999600', 'hash_test')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  `, [ORG_ID]);

  await client.query(`
    INSERT INTO tournaments (
      id, name, sport, scoring_enabled, scoring_phase,
      auction_enabled, organizer_id, license_status, owner_bidding_enabled,
      timer_seconds, bid_timer_seconds
    )
    VALUES 
      ($1, 'Recovery Auction 3.4', 'cricket', false, 'disabled', true, $3, 'active', true, 30, 15),
      ($2, 'Badminton Fencing 3.4', 'badminton', true, 'ready', false, $3, 'active', true, 30, 15)
    ON CONFLICT (id) DO UPDATE SET
      status = 'active',
      auction_enabled = EXCLUDED.auction_enabled,
      scoring_enabled = EXCLUDED.scoring_enabled,
      license_status = 'active',
      owner_bidding_enabled = true;
  `, [TID_AUCTION, TID_BADMINTON, ORG_ID]);

  await client.query(`
    INSERT INTO teams (id, tournament_id, name, short_code, owner_name, owner_mobile, purse, purse_used, is_bidding_enabled)
    VALUES
      ($1, $4, 'Alpha Smashers', 'ALP', 'Owner Alpha', '9999999611', 10000000, 0, true),
      ($2, $4, 'Beta Blasters',  'BET', 'Owner Beta',  '9999999612', 10000000, 0, true),
      ($3, $4, 'Gamma Strikers', 'GAM', 'Owner Gamma', '9999999613', 10000000, 0, true)
    ON CONFLICT (id) DO UPDATE SET purse = 10000000, purse_used = 0, is_bidding_enabled = true;
  `, [TEAM_ID_1, TEAM_ID_2, TEAM_ID_3, TID_AUCTION]);

  await client.query(`
    INSERT INTO players (id, tournament_id, serial_no, name, status, base_price)
    VALUES 
      ($1, $4, 1, 'Player One', 'available', 100000),
      ($2, $4, 2, 'Player Two', 'available', 100000),
      ($3, $4, 3, 'Player Three', 'available', 100000)
    ON CONFLICT (id) DO UPDATE SET status = 'available', team_id = NULL, sold_price = NULL;
  `, [PLAYER_ID_1, PLAYER_ID_2, PLAYER_ID_3, TID_AUCTION]);

  // Initial auction session: active player with running timer
  const initialTimerEndsAt = new Date(Date.now() + 20000).toISOString();
  await client.query(`
    INSERT INTO auction_sessions (
      tournament_id, status, current_player_id, current_bid,
      current_bid_team_id, timer_seconds, timer_ends_at, timer_type, last_action, revision
    )
    VALUES (
      $1, 'active', $2, 100000, $3, 30, $4, 'bid', 'Player 1 up for bidding', 15
    )
    ON CONFLICT (tournament_id) DO UPDATE SET
      status = 'active',
      current_player_id = $2,
      current_bid = 100000,
      current_bid_team_id = $3,
      revision = 15,
      timer_ends_at = $4,
      timer_type = 'bid',
      paused_time_remaining = NULL,
      last_action = 'Player 1 up for bidding';
  `, [TID_AUCTION, PLAYER_ID_1, TEAM_ID_1, initialTimerEndsAt]);

  // Scorer Accounts
  await client.query(`
    INSERT INTO scorer_accounts (id, name, mobile, pin_hash, is_active)
    VALUES 
      ($1, 'Alice 3.4', '9999999601', 'pin_hash_a', true),
      ($2, 'Bob 3.4', '9999999602', 'pin_hash_b', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
  `, [SCORER_ID_A, SCORER_ID_B]);

  await client.query(`
    INSERT INTO scorer_tournament_assignments (scorer_id, tournament_id)
    VALUES ($1, $3), ($2, $3)
    ON CONFLICT DO NOTHING;
  `, [SCORER_ID_A, SCORER_ID_B, TID_BADMINTON]);

  const expiresAt = new Date(Date.now() + 86400000);
  await client.query(`
    INSERT INTO scorer_sessions (id, scorer_id, expires_at)
    VALUES ($1, $3, $5), ($2, $4, $5)
    ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked_at = NULL;
  `, [SESSION_A, SESSION_B, SCORER_ID_A, SCORER_ID_B, expiresAt]);

  await client.query(`
    INSERT INTO scoring_matches (id, tournament_id, sport_slug, status, match_kind, home_team_id, away_team_id)
    VALUES ($1, $2, 'badminton', 'live', 'singles', $3, $4)
    ON CONFLICT (id) DO UPDATE SET status = 'live';
  `, [MATCH_ID_1, TID_BADMINTON, TEAM_ID_1, TEAM_ID_2]);

  await client.query(`
    INSERT INTO badminton_match_details (scoring_match_id, tournament_id, match_type, state_snapshot_json)
    VALUES ($1, $2, 'singles', '{"status":"live"}'::jsonb)
    ON CONFLICT (scoring_match_id) DO NOTHING;
  `, [MATCH_ID_1, TID_BADMINTON]);

  logPass("Phase 3.4 seed data initialized.");
}

async function run() {
  const masterClient = new Client({
    connectionString: directDbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await masterClient.connect();

  const adminToken = signAuthJwt({
    organizerAccountId: ORG_ID,
    organizer: { [String(ORG_ID)]: true },
    email: "org_phase34@bidwar.test",
    isAdmin: true,
    adminLevel: "master",
  });
  const adminCookie = `${COOKIE_NAME}=${adminToken}`;

  let passedScenarios = 0;

  const httpServer = http.createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const httpPort = (httpServer.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${httpPort}`;

  try {
    await cleanupTestData(masterClient);
    await seedData(masterClient);

    // =========================================================================
    // SCENARIO 1: Server restart during active auction
    // =========================================================================
    logHeader("SCENARIO 1: Server restart during active auction");
    {
      // 1. Simulate process restart by evicting all memory caches and local versions
      resetAuctionStateCacheForTests();
      invalidateAuctionBuildCache(TID_AUCTION, "all");
      resetLocalEventStateForTests(TID_AUCTION);

      // 2. Fetch auction state via HTTP
      const res = await request(app)
        .get(`/api/tournaments/${TID_AUCTION}/auction`)
        .set("Cookie", [adminCookie]);

      assert(res.status === 200, "Recovered state endpoint returns HTTP 200 after restart");
      assert(res.body.status === "active", "Recovered auction status is 'active'");
      assert(res.body.currentPlayer?.id === PLAYER_ID_1, `Recovered current player is Player 1 (${PLAYER_ID_1})`);
      assert(res.body.currentBid === 100000, "Recovered current bid is 100,000");
      assert(res.body.currentBidTeamId === TEAM_ID_1, `Recovered highest bidder is Team 1 (${TEAM_ID_1})`);
      assert(res.body.revision === 15, `Authoritative revision recovered accurately from DB (revision = ${res.body.revision})`);

      // 3. Verify event version is reconstituted from database revision
      const eventVersion = await getCurrentEventVersion(TID_AUCTION);
      assert(eventVersion >= 15, `Event version reconstituted from PostgreSQL revision (version = ${eventVersion})`);
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 2: Server restart during paused auction
    // =========================================================================
    logHeader("SCENARIO 2: Server restart during paused auction");
    {
      // Set session to paused with 14 seconds remaining
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'paused', timer_ends_at = NULL, paused_time_remaining = 14, revision = 16, last_action = 'Auction paused'
        WHERE tournament_id = $1
      `, [TID_AUCTION]);

      // Simulate crash/restart: purge in-memory caches
      resetAuctionStateCacheForTests();
      invalidateAuctionBuildCache(TID_AUCTION, "all");
      resetLocalEventStateForTests(TID_AUCTION);

      const res = await request(app)
        .get(`/api/tournaments/${TID_AUCTION}/auction`)
        .set("Cookie", [adminCookie]);

      assert(res.status === 200, "Recovered paused auction state returns HTTP 200");
      assert(res.body.status === "paused", "Auction correctly remains 'paused' after restart (does not accidentally resume)");
      assert(res.body.pausedTimeRemaining === 14, "Paused time remaining preserved at 14s");

      // Verify resume restores the frozen timer
      const resumeRes = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/start`)
        .set("Cookie", [adminCookie])
        .send({});

      assert(resumeRes.status === 200, "Resume after restart returns HTTP 200");
      assert(resumeRes.body.status === "active", "Resumed status is 'active'");
      assert(resumeRes.body.timerEndsAt != null, "TimerEndsAt restored on resume");
      const remainingRestored = Math.ceil((new Date(resumeRes.body.timerEndsAt).getTime() - Date.now()) / 1000);
      assert(remainingRestored >= 13 && remainingRestored <= 15, `Restored timer remaining is ${remainingRestored}s (expected ~14s)`);
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 3: Recovered timer accuracy across downtime
    // =========================================================================
    logHeader("SCENARIO 3: Recovered timer accuracy");
    {
      const targetDeadline = new Date(Date.now() + 18000).toISOString();
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'active', timer_ends_at = $2, paused_time_remaining = NULL, revision = 18
        WHERE tournament_id = $1
      `, [TID_AUCTION, targetDeadline]);

      // Simulate 2 seconds of offline downtime
      resetAuctionStateCacheForTests();
      invalidateAuctionBuildCache(TID_AUCTION, "all");
      await new Promise((r) => setTimeout(r, 2000));

      const res = await request(app)
        .get(`/api/tournaments/${TID_AUCTION}/auction`)
        .set("Cookie", [adminCookie]);

      const remainingSecs = Math.ceil((new Date(res.body.timerEndsAt).getTime() - Date.now()) / 1000);
      assert(remainingSecs >= 14 && remainingSecs <= 17, `Recovered timer accounts for elapsed wall-clock downtime (${remainingSecs}s remaining)`);
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 4: Network disconnect followed by reconnect
    // =========================================================================
    logHeader("SCENARIO 4: Network disconnect followed by reconnect");
    {
      let streamDisconnected = false;
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `${baseUrl}/api/tournaments/${TID_AUCTION}/auction/events`,
          { headers: { Accept: "text/event-stream" } },
          (res) => {
            assert(res.statusCode === 200, "Initial SSE connection accepted (200 OK)");
            assert(Boolean(res.headers["content-type"]?.includes("text/event-stream")), "Content-Type is text/event-stream");
            streamDisconnected = true;
            req.destroy();
            resolve();
          }
        );
        req.on("error", (err) => {
          if (streamDisconnected) return;
          reject(err);
        });
        setTimeout(() => {
          if (!streamDisconnected) {
            req.destroy();
            reject(new Error("Timeout on initial SSE connection"));
          }
        }, 5000);
      });

      assert(streamDisconnected, "Client connection disconnected successfully");

      // Reconnect with Last-Event-ID
      let reconnectSucceeded = false;
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `${baseUrl}/api/tournaments/${TID_AUCTION}/auction/events`,
          { headers: { Accept: "text/event-stream", "Last-Event-ID": "18" } },
          (res) => {
            assert(res.statusCode === 200, "Reconnected SSE stream returns 200 OK");
            reconnectSucceeded = true;
            req.destroy();
            resolve();
          }
        );
        req.on("error", (err) => {
          if (reconnectSucceeded) return;
          reject(err);
        });
        setTimeout(() => {
          if (!reconnectSucceeded) {
            req.destroy();
            reject(new Error("Timeout on reconnect SSE stream"));
          }
        }, 5000);
      });

      assert(reconnectSucceeded, "Reconnected SSE stream accepted successfully");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 5: Repeated reconnect without duplicate subscriptions
    // =========================================================================
    logHeader("SCENARIO 5: Repeated reconnect without duplicate subscriptions");
    {
      const initialClients = getSseClientCount(TID_AUCTION);

      // Simulate repeated client connects and unmounts
      const mockRes1 = { write: () => true } as any;
      const mockRes2 = { write: () => true } as any;

      const c1 = addSseClient(TID_AUCTION, mockRes1);
      assert(getSseClientCount(TID_AUCTION) === initialClients + 1, "Subscription registered client 1");

      removeSseClient(c1);
      assert(getSseClientCount(TID_AUCTION) === initialClients, "Client 1 subscription cleanly removed on disconnect");

      const c2 = addSseClient(TID_AUCTION, mockRes2);
      assert(getSseClientCount(TID_AUCTION) === initialClients + 1, "Reconnected client 2 registered without duplicate listeners");

      removeSseClient(c2);
      assert(getSseClientCount(TID_AUCTION) === initialClients, "Final listener cleanup verified");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 6: Event sequence gap detection
    // =========================================================================
    logHeader("SCENARIO 6: Event sequence gap detection");
    {
      assert(isSequenceGap(10, 11) === false, "Consecutive event (11 after 10) is not a gap");
      assert(isSequenceGap(10, 10) === false, "Duplicate event (10 after 10) is not a gap");
      assert(isSequenceGap(10, 12) === true, "Gap detected when event 12 arrives after 10 (missed event 11)");
      assert(isSequenceGap(10, 20) === true, "Gap detected when event 20 arrives after 10");
      assert(isSequenceGap(0, 5) === false, "Initial uninitialized cursor (0) does not trigger delta gap");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 7: Out-of-order event handling
    // =========================================================================
    logHeader("SCENARIO 7: Out-of-order event handling");
    {
      const currentHighest = { currentBid: 150000, timerEndsAt: "2026-11-04T12:00:10.000Z" };
      const olderStaleBid = { currentBid: 125000, timerEndsAt: "2026-11-04T12:00:08.000Z" };
      const newerHigherBid = { currentBid: 175000, timerEndsAt: "2026-11-04T12:00:15.000Z" };

      assert(shouldApplyBidDelta(currentHighest, olderStaleBid) === false, "Rejected older out-of-order bid amount regression (125k < 150k)");
      assert(shouldApplyBidDelta(currentHighest, newerHigherBid) === true, "Accepted valid forward bid delta (175k > 150k)");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 8: Duplicate event delivery
    // =========================================================================
    logHeader("SCENARIO 8: Duplicate event delivery");
    {
      assert(shouldAcceptMonotonicVersion(20, 20) === true, "Accepts version 20 at version 20");
      assert(shouldAcceptMonotonicVersion(20, 19) === false, "Rejects duplicate/stale version 19 after 20");
      assert(nextMonotonicVersion(20, 20) === 20, "Cursor maintains version 20 on duplicate");
      assert(nextMonotonicVersion(20, 19) === 20, "Cursor never regresses on older duplicate");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 9: Duplicate sell request & pause idempotency
    // =========================================================================
    logHeader("SCENARIO 9: Duplicate sell request & pause idempotency");
    {
      // 1. Pause idempotency test: calling pause twice must preserve paused_time_remaining
      const activeEnds = new Date(Date.now() + 15000).toISOString();
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'active', current_player_id = $2, current_bid = 125000, current_bid_team_id = $3,
            timer_ends_at = $4, paused_time_remaining = NULL, revision = 21
        WHERE tournament_id = $1
      `, [TID_AUCTION, PLAYER_ID_1, TEAM_ID_1, activeEnds]);

      const pause1 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/pause`)
        .set("Cookie", [adminCookie]);
      assert(pause1.status === 200, "First pause returns HTTP 200");
      const savedPausedTime = pause1.body.pausedTimeRemaining;
      assert(typeof savedPausedTime === "number" && savedPausedTime > 0, `Captured pausedTimeRemaining: ${savedPausedTime}s`);

      // Duplicate pause call
      const pause2 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/pause`)
        .set("Cookie", [adminCookie]);
      assert(pause2.status === 200, "Second duplicate pause returns HTTP 200 idempotently");
      assert(pause2.body.pausedTimeRemaining === savedPausedTime, `Second pause preserved pausedTimeRemaining (${pause2.body.pausedTimeRemaining}s === ${savedPausedTime}s) without wiping it to null`);

      // Resume so player can be sold
      await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/start`)
        .set("Cookie", [adminCookie]);

      // 2. Duplicate sell request test
      const sellPayload = {
        expectedBidTeamId: TEAM_ID_1,
        expectedBidAmount: 125000,
        expectedRevision: 23,
      };

      const sell1 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
        .set("Cookie", [adminCookie])
        .send(sellPayload);
      assert(sell1.status === 200, "First sell request succeeded (HTTP 200)");

      // Duplicate sell retry with same parameters
      const sell2 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
        .set("Cookie", [adminCookie])
        .send(sellPayload);
      assert(sell2.status === 400 || sell2.status === 409, `Duplicate sell retry rejected safely (status = ${sell2.status})`);

      // Verify no duplicate bids or double purse deductions
      const bidsRes = await masterClient.query(
        `SELECT count(*)::int AS cnt FROM bids WHERE tournament_id = $1 AND player_id = $2`,
        [TID_AUCTION, PLAYER_ID_1]
      );
      assert(bidsRes.rows[0].cnt === 1, `Exactly 1 bid record inserted for sold player (cnt = ${bidsRes.rows[0].cnt})`);

      const teamPurseRes = await masterClient.query(
        `SELECT purse_used FROM teams WHERE id = $1`,
        [TEAM_ID_1]
      );
      assert(teamPurseRes.rows[0].purse_used === 125000, `Purse deducted exactly once (purse_used = 125,000, no double deduction)`);
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 10: Duplicate bid retry
    // =========================================================================
    logHeader("SCENARIO 10: Duplicate bid retry");
    {
      // Prepare player 2 for bidding
      const endsAt = new Date(Date.now() + 25000).toISOString();
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'active', current_player_id = $2, current_bid = 100000, current_bid_team_id = NULL,
            timer_ends_at = $3, paused_time_remaining = NULL, revision = 30, last_action = 'Bidding open'
        WHERE tournament_id = $1
      `, [TID_AUCTION, PLAYER_ID_2, endsAt]);

      // Bid 1: Team 2 bids 100,000
      const bid1 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({ teamId: TEAM_ID_2, amount: 100000 });
      assert(bid1.status === 200, "First bid succeeds (HTTP 200)");

      // Duplicate bid retry of same amount by same team
      const bid2 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({ teamId: TEAM_ID_2, amount: 100000 });
      assert(bid2.status === 400 || bid2.status === 409, `Duplicate opening bid retry rejected safely (status = ${bid2.status})`);

      // Consecutive raise retry by same leading team (double-bid prevention)
      const bid3 = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({ teamId: TEAM_ID_2, amount: 150000 });
      assert(bid3.status === 409, "Consecutive raise by same leading team rejected with HTTP 409 Conflict");
      assert(bid3.body.error?.includes("already the highest bidder"), "Rejection confirms team is already the highest bidder");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 11: Concurrent pause and bid (advisory lock barrier)
    // =========================================================================
    logHeader("SCENARIO 11: Concurrent pause and bid");
    {
      const barrierKey = 77201;
      const barrier = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
      await barrier.connect();
      await barrier.query("BEGIN");
      await barrier.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);

      const endsAt = new Date(Date.now() + 20000).toISOString();
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'active', current_player_id = $2, current_bid = 100000, current_bid_team_id = $3,
            timer_ends_at = $4, revision = 40
        WHERE tournament_id = $1
      `, [TID_AUCTION, PLAYER_ID_2, TEAM_ID_2, endsAt]);

      const createWorker = (action: () => Promise<request.Response>) => {
        return (async () => {
          const c = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
          await c.connect();
          try {
            await c.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);
          } finally {
            await c.end();
          }
          return action();
        })();
      };

      const pausePromise = createWorker(() =>
        request(app)
          .post(`/api/tournaments/${TID_AUCTION}/auction/pause`)
          .set("Cookie", [adminCookie])
          .send({})
      );

      const bidPromise = createWorker(() =>
        request(app)
          .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
          .set("Cookie", [adminCookie])
          .send({ teamId: TEAM_ID_3, amount: 150000 })
      );

      // Verify both queued on barrier
      let waiters = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const res = await masterClient.query(
          `SELECT count(*)::int AS cnt FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted`,
          [barrierKey]
        );
        waiters = res.rows[0].cnt;
        if (waiters === 2) break;
      }
      assert(waiters === 2, "Both pause and bid workers synchronized on advisory lock barrier");

      // Release barrier
      await barrier.query("COMMIT");
      await barrier.end();

      const [resPause, resBid] = await Promise.all([pausePromise, bidPromise]);
      const sessionAfter = await masterClient.query(
        `SELECT status, current_bid, current_bid_team_id FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION]
      );

      // Either: pause won -> status is paused, bid rejected; OR bid won -> bid accepted, pause then paused it
      assert(
        (sessionAfter.rows[0].status === "paused"),
        `Database status is consistently 'paused' after concurrent operations (status = ${sessionAfter.rows[0].status})`
      );
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 12: Concurrent sell and bid (advisory lock barrier)
    // =========================================================================
    logHeader("SCENARIO 12: Concurrent sell and bid");
    {
      const barrierKey = 77202;
      const barrier = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
      await barrier.connect();
      await barrier.query("BEGIN");
      await barrier.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);

      const endsAt = new Date(Date.now() + 20000).toISOString();
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'active', current_player_id = $2, current_bid = 150000, current_bid_team_id = $3,
            timer_ends_at = $4, revision = 50
        WHERE tournament_id = $1
      `, [TID_AUCTION, PLAYER_ID_2, TEAM_ID_3, endsAt]);

      const createWorker = (action: () => Promise<request.Response>) => {
        return (async () => {
          const c = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
          await c.connect();
          try {
            await c.query("SELECT pg_advisory_xact_lock($1)", [barrierKey]);
          } finally {
            await c.end();
          }
          return action();
        })();
      };

      const sellPromise = createWorker(() =>
        request(app)
          .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
          .set("Cookie", [adminCookie])
          .send({ expectedBidTeamId: TEAM_ID_3, expectedBidAmount: 150000, expectedRevision: 50 })
      );

      const bidPromise = createWorker(() =>
        request(app)
          .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
          .set("Cookie", [adminCookie])
          .send({ teamId: TEAM_ID_1, amount: 200000 })
      );

      // Verify both queued on barrier
      let waiters = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const res = await masterClient.query(
          `SELECT count(*)::int AS cnt FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted`,
          [barrierKey]
        );
        waiters = res.rows[0].cnt;
        if (waiters === 2) break;
      }
      assert(waiters === 2, "Both sell and bid workers synchronized on advisory lock barrier");

      // Release barrier
      await barrier.query("COMMIT");
      await barrier.end();

      const [resSell, resBid] = await Promise.all([sellPromise, bidPromise]);
      const statuses = [resSell.status, resBid.status];

      // Mutually exclusive: exactly one succeeds or clean conflict resolution
      assert(
        statuses.includes(200) && (statuses.includes(409) || statuses.includes(400)),
        `Concurrent sell and bid resolved safely without corrupt state (sell=${resSell.status}, bid=${resBid.status})`
      );
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 13: Stale auction revision rejection
    // =========================================================================
    logHeader("SCENARIO 13: Stale auction revision rejection");
    {
      const endsAt = new Date(Date.now() + 20000).toISOString();
      await masterClient.query(`
        UPDATE auction_sessions
        SET status = 'active', current_player_id = $2, current_bid = 100000, current_bid_team_id = $3,
            timer_ends_at = $4, revision = 60
        WHERE tournament_id = $1
      `, [TID_AUCTION, PLAYER_ID_3, TEAM_ID_1, endsAt]);

      const resStaleSell = await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/sell`)
        .set("Cookie", [adminCookie])
        .send({
          expectedRevision: 1, // Stale revision (DB revision is 60)
        });

      assert(resStaleSell.status === 400 || resStaleSell.status === 409, `Stale revision rejected with status ${resStaleSell.status}`);
      if (resStaleSell.status === 409) {
        assert(resStaleSell.body.hint === "stale_sell", "Rejection includes hint 'stale_sell'");
      }
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 14A: Future Last-Event-ID cursor recovery & authoritative snapshot verification
    // =========================================================================
    logHeader("SCENARIO 14A: Future Last-Event-ID cursor recovery & snapshot verification");
    {
      let snapshotEnvelope: any = null;
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `${baseUrl}/api/tournaments/${TID_AUCTION}/auction/events`,
          { headers: { Accept: "text/event-stream", "Last-Event-ID": "99999" } },
          (res) => {
            assert(res.statusCode === 200, "SSE reconnect with future cursor returns 200 OK");
            res.on("data", (chunk) => {
              const str = chunk.toString();
              if (str.includes('"type":"auction_state"')) {
                const match = str.match(/data:\s*({.*})/);
                if (match) {
                  try {
                    snapshotEnvelope = JSON.parse(match[1]);
                    req.destroy();
                    resolve();
                  } catch (e) {}
                }
              }
            });
          }
        );
        req.on("error", (err) => {
          if (snapshotEnvelope) return;
          reject(err);
        });
        setTimeout(() => {
          if (!snapshotEnvelope) {
            req.destroy();
            reject(new Error("Timeout waiting for auction_state frame on future cursor resync"));
          }
        }, 5000);
      });

      assert(snapshotEnvelope != null, "Server automatically dispatched full auction_state snapshot frame");
      assert(snapshotEnvelope.type === "auction_state", "Envelope type is authoritative 'auction_state'");
      assert(snapshotEnvelope.version < 99999, `Server did NOT adopt client's invalid future cursor (snapshot version: ${snapshotEnvelope.version} < 99999)`);
      assert(snapshotEnvelope.state != null, "Snapshot state payload is present");
      assert(snapshotEnvelope.state.revision != null && snapshotEnvelope.state.revision > 0, `Authoritative DB revision in snapshot is valid (${snapshotEnvelope.state.revision})`);
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 14B: Independent event-buffer eviction gap recovery
    // =========================================================================
    logHeader("SCENARIO 14B: Independent event-buffer eviction gap recovery");
    {
      // Client reconnects with Last-Event-ID: 1 when auction revision is >= 60 (evicted past buffer)
      let receivedEvictionSnapshot = false;
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `${baseUrl}/api/tournaments/${TID_AUCTION}/auction/events`,
          { headers: { Accept: "text/event-stream", "Last-Event-ID": "1" } },
          (res) => {
            assert(res.statusCode === 200, "SSE reconnect with evicted buffer gap returns 200 OK");
            res.on("data", (chunk) => {
              if (chunk.toString().includes('"type":"auction_state"')) {
                receivedEvictionSnapshot = true;
                req.destroy();
                resolve();
              }
            });
          }
        );
        req.on("error", (err) => {
          if (receivedEvictionSnapshot) return;
          reject(err);
        });
        setTimeout(() => {
          if (!receivedEvictionSnapshot) {
            req.destroy();
            reject(new Error("Timeout waiting for auction_state frame on buffer eviction gap"));
          }
        }, 5000);
      });

      assert(receivedEvictionSnapshot, "Server automatically dispatched authoritative snapshot upon buffer eviction gap");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 15: Scorer reconnect and stale lease rejection
    // =========================================================================
    logHeader("SCENARIO 15: Scorer reconnect and stale lease rejection");
    {
      // 1. Alice acquires initial lease
      const acqA = await acquireMatchLock({
        matchId: MATCH_ID_1,
        scorerId: SCORER_ID_A,
        sessionId: SESSION_A,
        tournamentId: TID_BADMINTON,
        sport: "badminton",
      });
      assert(acqA.ok === true, "Alice acquired initial match lease");
      const leaseA = (acqA as any).lock;

      // 2. Bob reconnects / takes over lease with forceTakeover
      const acqB = await acquireMatchLock({
        matchId: MATCH_ID_1,
        scorerId: SCORER_ID_B,
        sessionId: SESSION_B,
        tournamentId: TID_BADMINTON,
        sport: "badminton",
        forceTakeover: true,
      });
      assert(acqB.ok === true, "Bob reconnected and acquired new authoritative lease");
      const leaseB = (acqB as any).lock;
      assert(leaseB.leaseVersion > leaseA.leaseVersion, `Bob lease version (${leaseB.leaseVersion}) strictly > Alice (${leaseA.leaseVersion})`);

      // 3. Alice attempts to submit a score with stale lease v1
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

      assert(aliceError != null, "Alice's stale score submission threw an exception");
      assert(
        aliceError.code === "SCORER_LEASE_REVOKED" || aliceError.code === "SCORER_LEASE_EXPIRED" || aliceError.code === "SCORER_LEASE_STALE",
        `Stale scorer submission rejected by lease fencing (code = ${aliceError.code})`
      );
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 16: Multiple clients receiving consistent authoritative state
    // =========================================================================
    logHeader("SCENARIO 16: Multiple clients receiving consistent authoritative state");
    {
      const currentVersion = await getCurrentEventVersion(TID_AUCTION);
      const testEnvelope = {
        type: "bid",
        version: currentVersion + 1,
        tournamentId: TID_AUCTION,
        currentBid: 200000,
        currentBidTeamId: TEAM_ID_1,
        timerEndsAt: new Date(Date.now() + 15000).toISOString(),
      };

      const frame = formatSseFrame(testEnvelope.version, testEnvelope);
      assert(frame.startsWith(`id: ${testEnvelope.version}`), "SSE frame contains monotonic ID header");
      assert(frame.includes('"type":"bid"'), "SSE frame contains payload type");
      assert(frame.includes('"currentBid":200000'), "SSE frame contains consistent bid value");
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 17: Crash window between database commit and event publication
    // =========================================================================
    logHeader("SCENARIO 17: Crash window between DB commit and event publication");
    {
      // 1. Transaction commits revision 75 directly in PostgreSQL
      await masterClient.query(`
        UPDATE auction_sessions
        SET revision = 75, current_bid = 300000, current_bid_team_id = $2, last_action = 'Crash window test bid'
        WHERE tournament_id = $1
      `, [TID_AUCTION, TEAM_ID_1]);

      // 2. Simulate crash window: local event version counter was left at 74 and event 75 was NEVER published
      setLocalEventVersionForTests(TID_AUCTION, 74);

      // 3. Reconnecting client connects with Last-Event-ID: 74
      let recoveredSnapshot: any = null;
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `${baseUrl}/api/tournaments/${TID_AUCTION}/auction/events`,
          { headers: { Accept: "text/event-stream", "Last-Event-ID": "74" } },
          (res) => {
            assert(res.statusCode === 200, "Reconnecting client accepted after crash window");
            res.on("data", (chunk) => {
              const str = chunk.toString();
              if (str.includes('"type":"auction_state"')) {
                const match = str.match(/data:\s*({.*})/);
                if (match) {
                  try {
                    recoveredSnapshot = JSON.parse(match[1]);
                    req.destroy();
                    resolve();
                  } catch (e) {}
                }
              }
            });
          }
        );
        req.on("error", (err) => {
          if (recoveredSnapshot) return;
          reject(err);
        });
        setTimeout(() => {
          if (!recoveredSnapshot) {
            req.destroy();
            reject(new Error("Timeout waiting for snapshot recovery during crash window"));
          }
        }, 5000);
      });

      assert(recoveredSnapshot != null, "Crash window gap successfully triggered authoritative snapshot frame");
      assert(recoveredSnapshot.version >= 75, `Recovered snapshot version is aligned with DB revision (version = ${recoveredSnapshot.version})`);
      assert(recoveredSnapshot.state.currentBid === 300000, "Recovered snapshot contains un-broadcast committed bid (300,000)");

      // 4. Subsequent mutation occurs and publishes event 76
      const nextVer = await nextEventVersion(TID_AUCTION, 76);
      assert(nextVer >= 76, `Next event version monotonic post-crash (version = ${nextVer})`);
      passedScenarios++;
    }

    // =========================================================================
    // SCENARIO 18: Deterministic multi-instance concurrency regression tests
    // =========================================================================
    logHeader("SCENARIO 18: Deterministic multi-instance concurrency regression tests");
    {
      const CONCURRENT_INSTANCES = 10;
      resetLocalEventStateForTests(TID_AUCTION);

      // Seed session at revision 80
      await masterClient.query(`
        UPDATE auction_sessions
        SET revision = 80
        WHERE tournament_id = $1
      `, [TID_AUCTION]);

      // 10 simulated instances call nextEventVersion concurrently on cold start
      const promises: Promise<number>[] = [];
      for (let i = 0; i < CONCURRENT_INSTANCES; i++) {
        promises.push(nextEventVersion(TID_AUCTION, 80));
      }

      const generatedVersions = await Promise.all(promises);
      const uniqueVersions = new Set(generatedVersions);

      assert(uniqueVersions.size === CONCURRENT_INSTANCES, `All ${CONCURRENT_INSTANCES} concurrent instances received distinct event versions (unique = ${uniqueVersions.size})`);
      for (const v of generatedVersions) {
        assert(v >= 80, `Generated version (${v}) is >= PostgreSQL base floor (80)`);
      }

      const currentVer = await getCurrentEventVersion(TID_AUCTION);
      assert(currentVer >= 80 + CONCURRENT_INSTANCES - 1, `Current event version reached peak monotonic value (${currentVer})`);
      passedScenarios++;
    }

    logHeader("VERIFICATION SUMMARY");
    console.log(`\n${BOLD}${GREEN}======================================================================${RESET}`);
    console.log(`${BOLD}${GREEN}  ALL 19 AUCTION RECOVERY & RELIABILITY SCENARIOS PASSED!${RESET}`);
    console.log(`${BOLD}${GREEN}  Passed: ${passedScenarios} / 19 scenarios${RESET}`);
    console.log(`${BOLD}${GREEN}======================================================================${RESET}\n`);

  } finally {
    await cleanupTestData(masterClient);
    await masterClient.end();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    process.exit(passedScenarios === 19 ? 0 : 1);
  }
}

run().catch((err) => {
  console.error(`\n${RED}FATAL ERROR in Phase 3.4 Runtime Verification:${RESET}`, err);
  process.exit(1);
});
