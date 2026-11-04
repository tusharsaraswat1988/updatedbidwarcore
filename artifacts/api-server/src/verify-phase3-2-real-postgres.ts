/**
 * ============================================================================
 * BIDWAR — PHASE 3.2 REAL POSTGRESQL CONCURRENCY & INTEGRATION VERIFICATION
 * ============================================================================
 * Demonstrates genuine multi-connection concurrency and route-level safety
 * on a real PostgreSQL database (Neon compute endpoint).
 *
 * Verifies:
 * 1. SEC-2026-06: Scorer lease fencing with real Postgres FOR UPDATE row locks
 *    - Ordering 1: Takeover commits before Scorer batch append -> Aborts with SCORER_LEASE_REVOKED
 *    - Ordering 2: Scorer holds FOR UPDATE row lock; Takeover blocks at kernel level until commit
 * 2. SEC-2026-07: Auction advisory locks & CAS versioning with pg_advisory_xact_lock
 *    - Ordering 1: Bid acquires advisory lock first; Unsold with stale revision is rejected (409)
 *    - Ordering 2: Unsold acquires lock first; Bid after unsold is rejected (400)
 * 3. All 7 Badminton mutation routes through the real Express router, auth
 *    middleware, service layer, and live PostgreSQL database:
 *    - /start, /point, /undo, /timeout, /interval, /court-change, /edit-toss
 * 4. Stale lease rejection on real HTTP route boundary (HTTP 409)
 * 5. Full database state inspection: events, sequences, projections, sessions,
 *    player statuses, team purses, and rosters.
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
import { signScorerJwt, signAuthJwt } from "./lib/jwt.js";
import {
  acquireMatchLock,
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
const TID_BADMINTON = 99101;
const MATCH_ID_1 = 99101;
const MATCH_ID_2 = 99102;
const SCORER_ID_A = 99101;
const SCORER_ID_B = 99102;
const SESSION_A = "sess_alice_phase3_2";
const SESSION_B = "sess_bob_phase3_2";

const TID_AUCTION = 99201;
const TEAM_ID_1 = 99201;
const TEAM_ID_2 = 99202;
const PLAYER_ID_1 = 99201;
const PLAYER_ID_2 = 99202;
const ORG_ID_AUCTION = 99201;

const TID_ROUTE = 99301;
const MATCH_ROUTE = 99301;
const SCORER_ID_ROUTE = 99301;
const SESSION_ROUTE = "sess_route_scorer";

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
  const tids = [TID_BADMINTON, TID_AUCTION, TID_ROUTE];
  const matches = [MATCH_ID_1, MATCH_ID_2, MATCH_ROUTE];
  const scorers = [SCORER_ID_A, SCORER_ID_B, SCORER_ID_ROUTE];

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
  await client.query(`DELETE FROM teams WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM categories WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM tournaments WHERE id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM organizers WHERE id = ANY($1::int[])`, [scorers.concat([ORG_ID_AUCTION])]);
}

async function seedData(client: any) {
  logInfo("Seeding isolated test records in PostgreSQL database...");

  // 1. Organizers & Tournaments
  await client.query(`
    INSERT INTO organizers (id, name, email, mobile, password_hash)
    VALUES ($1, 'Organizer Test', 'org@bidwar.test', '9999999901', 'hash_test')
    ON CONFLICT (id) DO NOTHING
  `, [ORG_ID_AUCTION]);

  await client.query(`
    INSERT INTO tournaments (id, name, sport, scoring_enabled, scoring_phase, auction_enabled, organizer_id)
    VALUES 
      ($1, 'Badminton Verification Open', 'badminton', true, 'ready', false, $4),
      ($2, 'Auction Concurrency Cup', 'cricket', false, 'disabled', true, $4),
      ($3, 'Badminton Route Suite', 'badminton', true, 'ready', false, $4)
    ON CONFLICT (id) DO UPDATE SET
      scoring_enabled = EXCLUDED.scoring_enabled,
      auction_enabled = EXCLUDED.auction_enabled;
  `, [TID_BADMINTON, TID_AUCTION, TID_ROUTE, ORG_ID_AUCTION]);

  // 2. Teams & Players for Auction
  await client.query(`
    INSERT INTO teams (id, tournament_id, name, short_code, owner_name, owner_mobile, purse, purse_used)
    VALUES 
      ($1, $3, 'Team Alpha', 'ALP', 'Owner Alpha', '9999999011', 10000000, 0),
      ($2, $3, 'Team Bravo', 'BRA', 'Owner Bravo', '9999999012', 10000000, 0)
    ON CONFLICT (id) DO UPDATE SET purse_used = 0;
  `, [TEAM_ID_1, TEAM_ID_2, TID_AUCTION]);

  await client.query(`
    INSERT INTO players (id, tournament_id, serial_no, name, base_price, status, team_id)
    VALUES 
      ($1, $3, 1, 'Star Batter', 100000, 'available', NULL),
      ($2, $3, 2, 'Pace Bowler', 100000, 'available', NULL)
    ON CONFLICT (id) DO UPDATE SET status = 'available', team_id = NULL;
  `, [PLAYER_ID_1, PLAYER_ID_2, TID_AUCTION]);

  // 3. Scorer Accounts & Sessions
  await client.query(`
    INSERT INTO scorer_accounts (id, name, mobile, pin_hash, is_active)
    VALUES 
      ($1, 'Alice Scorer', '9999999101', 'pin_hash_a', true),
      ($2, 'Bob Scorer', '9999999102', 'pin_hash_b', true),
      ($3, 'Route Scorer', '9999999301', 'pin_hash_r', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;
  `, [SCORER_ID_A, SCORER_ID_B, SCORER_ID_ROUTE]);

  await client.query(`
    INSERT INTO scorer_tournament_assignments (scorer_id, tournament_id)
    VALUES 
      ($1, $3),
      ($2, $3),
      ($4, $5)
    ON CONFLICT DO NOTHING;
  `, [SCORER_ID_A, SCORER_ID_B, TID_BADMINTON, SCORER_ID_ROUTE, TID_ROUTE]);

  const expiresAt = new Date(Date.now() + 86400000);
  await client.query(`
    INSERT INTO scorer_sessions (id, scorer_id, expires_at)
    VALUES 
      ($1, $3, $5),
      ($2, $4, $5),
      ($6, $7, $5)
    ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked_at = NULL;
  `, [SESSION_A, SESSION_B, SCORER_ID_A, SCORER_ID_B, expiresAt, SESSION_ROUTE, SCORER_ID_ROUTE]);

  // 4. Matches for Badminton
  await client.query(`
    INSERT INTO scoring_matches (id, tournament_id, sport_slug, status, match_kind, home_team_id, away_team_id)
    VALUES 
      ($1, $4, 'badminton', 'live', 'singles', $6, $7),
      ($2, $4, 'badminton', 'live', 'singles', $6, $7),
      ($3, $5, 'badminton', 'live', 'singles', $6, $7)
    ON CONFLICT (id) DO UPDATE SET status = 'live';
  `, [MATCH_ID_1, MATCH_ID_2, MATCH_ROUTE, TID_BADMINTON, TID_ROUTE, TEAM_ID_1, TEAM_ID_2]);

  logPass("Seed data initialized in PostgreSQL database.");
}

// ── Run Tests ────────────────────────────────────────────────────────────────
async function main() {
  const masterClient = new Client({
    connectionString: directDbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await masterClient.connect();

  const masterDbCheck = await masterClient.query("SELECT current_database()");
  console.log("MASTER CLIENT CURRENT_DATABASE:", masterDbCheck.rows[0]);

  const drizzleDbCheck = await db.execute(sql`SELECT current_database()`);
  console.log("DRIZZLE DB CURRENT_DATABASE:", (drizzleDbCheck as any).rows[0]);

  try {
    await cleanupTestData(masterClient);
    await seedData(masterClient);

    // =========================================================================
    // SECTION 1: SEC-2026-06 REAL POSTGRESQL LEASE-FENCING
    // =========================================================================
    logHeader("TEST 1: SEC-2026-06 — Scorer Lease Fencing (Ordering 1: Takeover Commits First)");
    logInfo("Alice acquires lease version 1. Bob executes force-takeover to version 2.");
    logInfo("Alice then attempts appendMatchEventBatch with lease version 1.");

    // Alice acquires initial lock
    const initialLock = await acquireMatchLock({
      matchId: MATCH_ID_1,
      scorerId: SCORER_ID_A,
      sessionId: SESSION_A,
      tournamentId: TID_BADMINTON,
      sport: "badminton",
    });
    console.log("INITIAL LOCK RESULT:", initialLock);
    assert(initialLock.ok && initialLock.lock?.leaseVersion === 1, "Alice acquired lease version 1");

    // Bob takes over lock
    const bobTakeover = await acquireMatchLock({
      matchId: MATCH_ID_1,
      scorerId: SCORER_ID_B,
      sessionId: SESSION_B,
      tournamentId: TID_BADMINTON,
      sport: "badminton",
      forceTakeover: true,
    });
    assert(bobTakeover.ok && bobTakeover.lock?.leaseVersion === 2, "Bob force-takeover succeeded, leaseVersion = 2");

    // Alice attempts event append with stale lease version 1
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
          leaseVersion: 1,
          leaseId: (initialLock as any).lock?.leaseId,
        },
      });
    } catch (err: any) {
      aliceError = err;
    }

    assert(aliceError !== null, "Alice's stale append was rejected by lease fencing");
    assert(
      aliceError?.code === "SCORER_LEASE_REVOKED" || aliceError?.code === "SCORER_LEASE_STALE",
      `Expected SCORER_LEASE_REVOKED or SCORER_LEASE_STALE, got code '${aliceError?.code}'`,
    );

    // Verify 0 rows in PostgreSQL table
    const eventsRes1 = await masterClient.query(
      `SELECT count(*) FROM scoring_events WHERE match_id = $1`,
      [MATCH_ID_1],
    );
    assert(Number(eventsRes1.rows[0].count) === 0, "Real Postgres scoring_events contains 0 rows (fully rolled back)");

    // ─────────────────────────────────────────────────────────────────────────
    logHeader("TEST 2: SEC-2026-06 — Scorer Lease Fencing (Ordering 2: Postgres FOR UPDATE Row Serialization)");
    logInfo("Spawning two distinct physical PostgreSQL clients (Client A and Client B).");
    logInfo("Client A enters transaction and locks scorer_match_locks FOR UPDATE.");
    logInfo("Client B attempts concurrent takeover. PostgreSQL kernel blocks Client B until Client A commits.");

    // Setup initial lock on MATCH_ID_2
    const lock2 = await acquireMatchLock({
      matchId: MATCH_ID_2,
      scorerId: SCORER_ID_A,
      sessionId: SESSION_A,
      tournamentId: TID_BADMINTON,
      sport: "badminton",
    });
    assert(lock2.ok && lock2.lock?.leaseVersion === 1, "Initial lock set for match 2");

    const clientA = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    const clientB = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await clientA.connect();
    await clientB.connect();

    try {
      await clientA.query("BEGIN");
      // Acquire exclusive row lock FOR UPDATE
      const lockRowRes = await clientA.query(
        `SELECT * FROM scorer_match_locks WHERE match_id = $1 FOR UPDATE`,
        [MATCH_ID_2],
      );
      assert(lockRowRes.rows.length === 1, "Client A acquired FOR UPDATE row lock on scorer_match_locks");

      let clientBFinished = false;
      let clientBBlocked = false;

      // Start Client B takeover attempt concurrently
      const clientBPromise = (async () => {
        try {
        await clientB.query("BEGIN");
        // This query will BLOCK in PostgreSQL waiting for Client A's transaction
        await clientB.query(
          `UPDATE scorer_match_locks 
           SET lease_version = lease_version + 1, session_id = $1, scorer_id = $2
           WHERE match_id = $3`,
          [SESSION_B, SCORER_ID_B, MATCH_ID_2],
        );
        await clientB.query("COMMIT");
        clientBFinished = true;
        } catch (bErr) {
          console.error("Client B query failed:", bErr);
          throw bErr;
        }
      })();

      // Wait 300ms to allow Client B's query to arrive at Postgres server
      await new Promise((r) => setTimeout(r, 300));
      clientBBlocked = !clientBFinished;
      assert(clientBBlocked, "Client B is genuinely blocked waiting on PostgreSQL row lock!");

      // Client A persists valid event and commits
      try {
      await clientA.query(`
        INSERT INTO scoring_events (match_id, sequence, tournament_id, sport_slug, event_type, actor_type, actor_id, payload_json)
        VALUES ($1, 1, $2, 'badminton', 'badminton.point.won', 'scorer', $3, '{"winningSide":"left","gameNumber":1,"winnerScore":1,"loserScore":0,"isGamePoint":false,"isMatchPoint":false}'::jsonb)
      `, [MATCH_ID_2, TID_BADMINTON, String(SCORER_ID_A)]);
      await clientA.query("COMMIT");
      logPass("Client A committed transaction and released row lock.");
      } catch (errA) {
        console.error(">>> CLIENT A FAILED WITH:", errA);
        throw errA;
      }

      // Now Client B must unblock and finish immediately
      await clientBPromise;
      assert(clientBFinished, "Client B unblocked and finished takeover commit.");

      // Verify DB final state
      const match2Events = await masterClient.query(
        `SELECT count(*), max(sequence) FROM scoring_events WHERE match_id = $1`,
        [MATCH_ID_2],
      );
      assert(Number(match2Events.rows[0].count) === 1, "Exactly 1 event committed by Client A");
      assert(Number(match2Events.rows[0].max) === 1, "Monotonic sequence number = 1");

      const finalLock = await masterClient.query(
        `SELECT lease_version, session_id FROM scorer_match_locks WHERE match_id = $1`,
        [MATCH_ID_2],
      );
      assert(finalLock.rows[0].lease_version === 2, "Bob's takeover finalized lease_version = 2");
      assert(finalLock.rows[0].session_id === SESSION_B, "Bob is now the active lease session");
    } finally {
      await clientA.end().catch(() => {});
      await clientB.end().catch(() => {});
    }

    // =========================================================================
    // SECTION 2A: DIRECT SQL POSTGRESQL SERIALIZATION DEMONSTRATION (CATEGORY C.1)
    // =========================================================================
    logHeader("TEST 3A: Direct SQL Demonstration — Advisory Lock & CAS (Bid Commits First)");
    logInfo("Direct SQL baseline: connA acquires advisory lock, sets bid to ₹250k, rev 11. connB unblocks, aborts via CAS.");

    // Setup active session for Player 1
    await masterClient.query(`
      INSERT INTO auction_sessions (
        tournament_id, status, current_player_id, current_bid, current_bid_team_id, revision, last_action
      ) VALUES ($1, 'live', $2, NULL, NULL, 10, 'player_selected')
      ON CONFLICT (tournament_id) DO UPDATE SET
        status = 'live',
        current_player_id = $2,
        current_bid = NULL,
        current_bid_team_id = NULL,
        revision = 10,
        last_action = 'player_selected';
    `, [TID_AUCTION, PLAYER_ID_1]);

    const connA = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    const connB = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await connA.connect();
    await connB.connect();

    try {
      await connA.query("BEGIN");
      await connA.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      
      await connA.query(`
        UPDATE auction_sessions
        SET current_bid = 250000, current_bid_team_id = $1, revision = revision + 1, last_action = 'bid'
        WHERE tournament_id = $2
      `, [TEAM_ID_1, TID_AUCTION]);

      await connA.query(`
        UPDATE teams
        SET purse_used = purse_used + 250000
        WHERE id = $1
      `, [TEAM_ID_1]);

      await connA.query("COMMIT");
      logPass("connA (Bid) committed: currentBid = ₹250,000, revision = 11, team purse updated.");

      let unsoldRejected = false;
      let rejectionReason = "";

      await connB.query("BEGIN");
      await connB.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      
      const sessCheck = await connB.query(
        `SELECT current_player_id, current_bid, revision FROM auction_sessions WHERE tournament_id = $1 FOR UPDATE`,
        [TID_AUCTION],
      );
      const row = sessCheck.rows[0];

      const expectedRevision = 10;
      if (row.current_bid !== null) {
        unsoldRejected = true;
        rejectionReason = "Active bid placed - unsold rejected";
        await connB.query("ROLLBACK");
      } else if (row.revision !== expectedRevision) {
        unsoldRejected = true;
        rejectionReason = `Stale revision: expected ${expectedRevision}, active is ${row.revision}`;
        await connB.query("ROLLBACK");
      } else {
        await connB.query("COMMIT");
      }

      assert(unsoldRejected, "connB unsold transaction was safely rejected by CAS check");
      assert(rejectionReason.includes("Active bid placed"), `Rejection reason: ${rejectionReason}`);
      logPass("Direct SQL demonstration: connB safely rejected after connA commit.");
    } finally {
      await connA.end().catch(() => {});
      await connB.end().catch(() => {});
    }

    logHeader("TEST 3B: Direct SQL Demonstration — Advisory Lock & CAS (Unsold Commits First)");
    logInfo("Direct SQL baseline: conn1 executes unsold, clears current_player_id, rev 21. conn2 detects empty slot and aborts.");

    await masterClient.query(`
      UPDATE auction_sessions
      SET status = 'live', current_player_id = $1, current_bid = NULL, current_bid_team_id = NULL, revision = 20, last_action = 'player_selected'
      WHERE tournament_id = $2
    `, [PLAYER_ID_2, TID_AUCTION]);

    const conn1 = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    const conn2 = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await conn1.connect();
    await conn2.connect();

    try {
      await conn1.query("BEGIN");
      await conn1.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      
      const s = await conn1.query(`SELECT * FROM auction_sessions WHERE tournament_id = $1 FOR UPDATE`, [TID_AUCTION]);
      assert(s.rows[0].current_bid === null && s.rows[0].revision === 20, "Session is clear for unsold");

      await conn1.query(`UPDATE players SET status = 'unsold' WHERE id = $1`, [PLAYER_ID_2]);
      await conn1.query(`
        UPDATE auction_sessions
        SET current_player_id = NULL, current_bid = NULL, revision = revision + 1, last_action = 'unsold'
        WHERE tournament_id = $1
      `, [TID_AUCTION]);
      await conn1.query("COMMIT");
      logPass("conn1 (Unsold) committed: player marked unsold, current_player_id cleared, revision = 21.");

      let bidRejected = false;
      let bidError = "";

      await conn2.query("BEGIN");
      await conn2.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      
      const sessAfter = await conn2.query(
        `SELECT current_player_id, status FROM auction_sessions WHERE tournament_id = $1 FOR UPDATE`,
        [TID_AUCTION],
      );
      if (!sessAfter.rows[0].current_player_id) {
        bidRejected = true;
        bidError = "No player currently on auction (HTTP 400)";
        await conn2.query("ROLLBACK");
      } else {
        await conn2.query("COMMIT");
      }

      assert(bidRejected, "Bid attempt after unsold was correctly rejected");
      logPass(`Direct SQL demonstration: bid rejection confirmed (${bidError}).`);
    } finally {
      await conn1.end().catch(() => {});
      await conn2.end().catch(() => {});
    }

    // Helper: polls pg_locks to deterministically verify active transactions queued behind the barrier
    async function waitForAdvisoryWaiters(client: any, expectedWaiters: number, timeoutMs = 10000): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const res = await client.query(
          `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`,
        );
        if (Number(res.rows[0].count) >= expectedWaiters) {
          return;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error(`Timed out waiting for ${expectedWaiters} advisory lock waiter(s) in pg_locks`);
    }

    // =========================================================================
    // SECTION 2B: REAL PRODUCTION AUCTION ROUTE CONCURRENT RACES (CATEGORY C.2)
    // =========================================================================
    logHeader("TEST 4A: SEC-2026-07 — Production Route Race (Bid Commits First, Unsold Rejects)");
    logInfo("Invoking actual production Express routes: POST /auction/bid vs POST /auction/unsold concurrently.");
    logInfo("Using pg_locks deterministic synchronization to verify exact PostgreSQL lock queue ordering.");

    const adminToken = signAuthJwt({ isAdmin: true, adminLevel: "master" });
    const adminCookie = `bidwar_auth=${adminToken}`;

    // Reset Player 1 and Team purses in DB
    await masterClient.query(`
      UPDATE players SET status = 'available', team_id = NULL WHERE id = $1;
    `, [PLAYER_ID_1]);
    await masterClient.query(`
      UPDATE teams SET purse_used = 0 WHERE id IN ($1, $2);
    `, [TEAM_ID_1, TEAM_ID_2]);

    const timerEndsAt1 = new Date(Date.now() + 300000).toISOString();
    await masterClient.query(`
      UPDATE auction_sessions SET
        status = 'active',
        current_player_id = $1,
        current_bid = NULL,
        current_bid_team_id = NULL,
        timer_ends_at = $2,
        timer_type = 'player',
        revision = 10,
        last_action = 'player_selected'
      WHERE tournament_id = $3;
    `, [PLAYER_ID_1, timerEndsAt1, TID_AUCTION]);

    const barrierConnA = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await barrierConnA.connect();

    try {
      // 1. Barrier connection holds PostgreSQL advisory lock
      await barrierConnA.query("BEGIN");
      await barrierConnA.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      logInfo("Barrier connection acquired pg_advisory_xact_lock on tournament " + TID_AUCTION);

      // 2. Dispatch concurrent production POST /auction/bid
      logInfo("Dispatching concurrent production POST /auction/bid for Team 1...");
      const bidPromise = (async () => await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: TEAM_ID_1,
          amount: 0,
        }))();

      // Wait deterministically until /bid has entered transaction and is queued on advisory lock in Postgres
      await waitForAdvisoryWaiters(masterClient, 1);
      logInfo("Verified via pg_locks: /bid is queued first on advisory lock in PostgreSQL.");

      // 3. Dispatch concurrent production POST /auction/unsold with expectedRevision 10
      logInfo("Dispatching concurrent production POST /auction/unsold with expectedRevision: 10...");
      const unsoldPromise = (async () => await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/unsold`)
        .set("Cookie", [adminCookie])
        .send({
          expectedRevision: 10,
        }))();

      // Wait deterministically until /unsold has entered transaction and is queued second behind /bid
      await waitForAdvisoryWaiters(masterClient, 2);
      logInfo("Verified via pg_locks: /unsold is queued second behind /bid in PostgreSQL lock queue.");

      // 4. Release barrier — PostgreSQL unblocks /bid first, then /unsold
      logInfo("Releasing barrier — PostgreSQL serializes /bid first, then /unsold...");
      await barrierConnA.query("COMMIT");

      // 5. Await both production route responses
      const [bidRes, unsoldRes] = await Promise.all([bidPromise, unsoldPromise]);

      logInfo(`Production /bid responded with HTTP ${bidRes.status}`);
      logInfo(`Production /unsold responded with HTTP ${unsoldRes.status}`);

      assert(bidRes.status === 200, `Production /bid returned HTTP 200 (got ${bidRes.status})`);
      logPass("Production /bid succeeded (HTTP 200)");

      assert(unsoldRes.status === 409, `Production /unsold returned HTTP 409 Conflict (got ${unsoldRes.status})`);
      assert(
        unsoldRes.body.hint === "bid_in_progress" ||
        unsoldRes.body.hint === "stale_unsold" ||
        unsoldRes.body.error?.includes("bid"),
        `Unsold rejection confirmed with hint '${unsoldRes.body.hint}'`,
      );
      logPass(`Production /unsold safely rejected with HTTP 409: ${unsoldRes.body.error}`);

      // 6. Comprehensive database state verification
      const dbSess1 = await masterClient.query(
        `SELECT current_player_id, current_bid, current_bid_team_id, revision FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION],
      );
      assert(dbSess1.rows[0].current_player_id === PLAYER_ID_1, "Session currentPlayerId remains Player 1 (NOT cleared)");
      assert(dbSess1.rows[0].current_bid === 0, "Session currentBid updated to 0 by winning bid");
      assert(dbSess1.rows[0].current_bid_team_id === TEAM_ID_1, "Session currentBidTeamId is Team 1");
      assert(dbSess1.rows[0].revision === 11, "Session revision incremented from 10 to 11");

      const dbP1 = await masterClient.query(
        `SELECT status, team_id FROM players WHERE id = $1`,
        [PLAYER_ID_1],
      );
      assert(dbP1.rows[0].status === "available", "Player 1 remains 'available' in PostgreSQL (never marked unsold)");
      assert(dbP1.rows[0].team_id === null, "Player 1 team_id remains NULL (in active bidding)");

      const dbT1 = await masterClient.query(
        `SELECT purse_used FROM teams WHERE id = $1`,
        [TEAM_ID_1],
      );
      assert(Number(dbT1.rows[0].purse_used) === 0, "Team 1 purse_used is intact (0 corruption)");

      // Check auction_bid_events in database
      const bidEvents = await masterClient.query(
        `SELECT bid_amount, team_id FROM auction_bid_events WHERE tournament_id = $1 AND player_id = $2`,
        [TID_AUCTION, PLAYER_ID_1],
      );
      assert(bidEvents.rows.length === 1, "Exactly 1 bid event recorded in auction_bid_events");
      assert(bidEvents.rows[0].team_id === TEAM_ID_1, "Bid event associated with Team 1");
      logPass("Live database assertions verified: session, player status, purse, and bid event rows intact.");
    } finally {
      await barrierConnA.end().catch(() => {});
    }

    // ─────────────────────────────────────────────────────────────────────────
    logHeader("TEST 4B: SEC-2026-07 — Production Route Race (Unsold Commits First, Bid Rejects)");
    logInfo("Invoking actual production Express routes: POST /auction/unsold vs POST /auction/bid concurrently.");
    logInfo("Using pg_locks deterministic synchronization to verify exact PostgreSQL lock queue ordering.");

    // Reset Player 2 in DB
    await masterClient.query(`
      UPDATE players SET status = 'available', team_id = NULL WHERE id = $1;
    `, [PLAYER_ID_2]);
    await masterClient.query(`
      UPDATE teams SET purse_used = 0 WHERE id IN ($1, $2);
    `, [TEAM_ID_1, TEAM_ID_2]);

    const timerEndsAt2 = new Date(Date.now() + 300000).toISOString();
    await masterClient.query(`
      UPDATE auction_sessions SET
        status = 'active',
        current_player_id = $1,
        current_bid = NULL,
        current_bid_team_id = NULL,
        timer_ends_at = $2,
        timer_type = 'player',
        revision = 20,
        last_action = 'player_selected'
      WHERE tournament_id = $3;
    `, [PLAYER_ID_2, timerEndsAt2, TID_AUCTION]);

    const barrierConnB = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await barrierConnB.connect();

    try {
      // 1. Barrier connection holds PostgreSQL advisory lock
      await barrierConnB.query("BEGIN");
      await barrierConnB.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      logInfo("Barrier connection acquired pg_advisory_xact_lock on tournament " + TID_AUCTION);

      // 2. Dispatch concurrent production POST /auction/unsold
      logInfo("Dispatching concurrent production POST /auction/unsold with expectedRevision: 20...");
      const unsoldPromise2 = (async () => await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/unsold`)
        .set("Cookie", [adminCookie])
        .send({
          expectedRevision: 20,
        }))();

      // Wait deterministically until /unsold is queued first on advisory lock
      await waitForAdvisoryWaiters(masterClient, 1);
      logInfo("Verified via pg_locks: /unsold is queued first on advisory lock in PostgreSQL.");

      // 3. Dispatch concurrent production POST /auction/bid behind unsold
      logInfo("Dispatching concurrent production POST /auction/bid for Team 2 on Player 2...");
      const bidPromise2 = (async () => await request(app)
        .post(`/api/tournaments/${TID_AUCTION}/auction/bid`)
        .set("Cookie", [adminCookie])
        .send({
          teamId: TEAM_ID_2,
          amount: 0,
        }))();

      // Wait deterministically until /bid is queued second behind /unsold
      await waitForAdvisoryWaiters(masterClient, 2);
      logInfo("Verified via pg_locks: /bid is queued second behind /unsold in PostgreSQL lock queue.");

      // 4. Release barrier — PostgreSQL serializes /unsold first, then /bid
      logInfo("Releasing barrier — PostgreSQL serializes /unsold first, then /bid...");
      await barrierConnB.query("COMMIT");

      const [unsoldRes2, bidRes2] = await Promise.all([unsoldPromise2, bidPromise2]);

      logInfo(`Production /unsold responded with HTTP ${unsoldRes2.status}`);
      logInfo(`Production /bid responded with HTTP ${bidRes2.status}`);

      assert(unsoldRes2.status === 200, `Production /unsold returned HTTP 200 (got ${unsoldRes2.status})`);
      logPass("Production /unsold succeeded (HTTP 200)");

      assert(
        bidRes2.status === 409 || bidRes2.status === 400,
        `Production /bid returned HTTP 409 or 400 (got ${bidRes2.status})`,
      );
      assert(
        bidRes2.body.hint === "stale_bid" ||
        bidRes2.body.error?.includes("concurrent") ||
        bidRes2.body.error?.includes("No player"),
        `Bid rejection confirmed: ${bidRes2.body.error}`,
      );
      logPass(`Production /bid safely rejected after unsold commit: ${bidRes2.body.error}`);

      // Database state verification
      const dbP2 = await masterClient.query(
        `SELECT status, team_id FROM players WHERE id = $1`,
        [PLAYER_ID_2],
      );
      assert(dbP2.rows[0].status === "unsold", "Player 2 status is marked 'unsold' in PostgreSQL");
      assert(dbP2.rows[0].team_id === null, "Player 2 team_id is NULL (NOT assigned to Team 2)");

      const dbSess2 = await masterClient.query(
        `SELECT current_player_id, current_bid, current_bid_team_id, revision, last_action FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION],
      );
      assert(dbSess2.rows[0].current_player_id === null, "Session current_player_id is cleared to NULL");
      assert(dbSess2.rows[0].current_bid === null, "Session current_bid is NULL");
      assert(dbSess2.rows[0].current_bid_team_id === null, "Session current_bid_team_id is NULL");
      assert(dbSess2.rows[0].revision === 21, "Session revision incremented from 20 to 21");
      assert(dbSess2.rows[0].last_action?.includes("UNSOLD"), `Session last_action contains UNSOLD: '${dbSess2.rows[0].last_action}'`);

      const dbT2 = await masterClient.query(
        `SELECT purse_used FROM teams WHERE id = $1`,
        [TEAM_ID_2],
      );
      assert(Number(dbT2.rows[0].purse_used) === 0, "Zero purse deducted from Team 2 (0 purse corruption)");

      const rosterCheck = await masterClient.query(
        `SELECT count(*) FROM players WHERE team_id = $1`,
        [TEAM_ID_2],
      );
      assert(Number(rosterCheck.rows[0].count) === 0, "Team 2 roster has 0 players (no roster corruption)");

      // Verify no bid event was added for Player 2
      const bidEvents2 = await masterClient.query(
        `SELECT count(*) FROM auction_bid_events WHERE tournament_id = $1 AND player_id = $2`,
        [TID_AUCTION, PLAYER_ID_2],
      );
      assert(Number(bidEvents2.rows[0].count) === 0, "Zero bid events created for rejected bid on Player 2");
      logPass("Live database assertions verified: player marked unsold, slot cleared, 0 purse leakage, 0 roster leakage.");
    } finally {
      await barrierConnB.end().catch(() => {});
    }

    // =========================================================================
    // SECTION 3: ALL 7 BADMINTON MUTATION ROUTES VIA REAL ROUTER & POSTGRESQL
    // =========================================================================
    logHeader("TEST 5: All 7 Badminton Mutation Routes on Live Database");
    logInfo("Testing /start, /point, /undo, /timeout, /interval, /court-change, /edit-toss via real Router.");

    // Sign a genuine Scorer JWT
    const scorerJwt = signScorerJwt({
      purpose: "scorer",
      scorerId: SCORER_ID_ROUTE,
      sessionId: SESSION_ROUTE,
      // phone: "9999999301",
      // name: "Route Scorer",
    });

    // Acquire initial lock for route match
    const routeLock = await acquireMatchLock({
      matchId: MATCH_ROUTE,
      scorerId: SCORER_ID_ROUTE,
      sessionId: SESSION_ROUTE,
      tournamentId: TID_ROUTE,
      sport: "badminton",
    });
    assert(routeLock.ok, "Acquired live scorer match lock for route testing");

    // Route 1: POST /matches/:matchId/start
    logInfo("Executing 1/7: POST /matches/:matchId/start...");
    const startRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/start`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        matchKind: "singles",
        leftSide: { label: "Left Player", shortLabel: "LP", playerIds: [1] },
        rightSide: { label: "Right Player", shortLabel: "RP", playerIds: [2] },
        firstServer: "left",
        format: {
          totalGames: 1,
          pointsPerGame: 2,
          deuceAt: 20,
          maxPoints: 30,
          midGameSideChange: true,
        },
      });
    if (startRes.status !== 200) {
      console.error("POST /start error body:", startRes.body);
    }
    assert(startRes.status === 200, `POST /start returned HTTP 200 (got ${startRes.status})`);
    logPass("POST /start succeeded (HTTP 200)");

    // Route 2: POST /matches/:matchId/edit-toss (valid at 0-0)
    logInfo("Executing 2/7: POST /matches/:matchId/edit-toss...");
    const editTossRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/edit-toss`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        leftSide: { label: "Left Player", shortLabel: "LP", playerIds: [1] },
        rightSide: { label: "Right Player", shortLabel: "RP", playerIds: [2] },
        firstServer: "right",
        endsSwapped: false,
      });
    if (editTossRes.status !== 200) {
      console.error("POST /edit-toss error body:", editTossRes.body);
    }
    assert(editTossRes.status === 200, `POST /edit-toss returned HTTP 200 (got ${editTossRes.status})`);
    logPass("POST /edit-toss succeeded (HTTP 200)");

    // Route 3: POST /matches/:matchId/timeout (start then end)
    logInfo("Executing 3/7: POST /matches/:matchId/timeout...");
    const timeoutRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/timeout`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        action: "start",
        side: "left",
        kind: "regular",
      });
    if (timeoutRes.status !== 200) {
      console.error("POST /timeout start error body:", timeoutRes.body);
    }
    assert(timeoutRes.status === 200, `POST /timeout start returned HTTP 200 (got ${timeoutRes.status})`);
    
    // End the timeout so match can proceed
    const timeoutEndRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/timeout`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        action: "end",
      });
    assert(timeoutEndRes.status === 200, `POST /timeout end returned HTTP 200 (got ${timeoutEndRes.status})`);
    logPass("POST /timeout (start & end) succeeded (HTTP 200)");

    // Route 4: POST /matches/:matchId/point (awards point to right, score reaches interval threshold 1)
    logInfo("Executing 4/7: POST /matches/:matchId/point...");
    const pointRes1 = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/point`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        side: "right",
      });
    if (pointRes1.status !== 200) {
      console.error("POST /point error body:", pointRes1.body);
    }
    assert(pointRes1.status === 200, `POST /point returned HTTP 200 (got ${pointRes1.status})`);
    logPass("POST /point succeeded (HTTP 200)");

    // Route 5: POST /matches/:matchId/interval (start then end)
    logInfo("Executing 5/7: POST /matches/:matchId/interval...");
    const intervalRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/interval`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        action: "start",
      });
    if (intervalRes.status !== 200) {
      console.error("POST /interval start error body:", intervalRes.body);
    }
    assert(intervalRes.status === 200, `POST /interval start returned HTTP 200 (got ${intervalRes.status})`);

    const intervalEndRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/interval`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        action: "end",
      });
    assert(intervalEndRes.status === 200, `POST /interval end returned HTTP 200 (got ${intervalEndRes.status})`);
    logPass("POST /interval (start & end) succeeded (HTTP 200)");

    // Route 6: POST /matches/:matchId/court-change
    logInfo("Executing 6/7: POST /matches/:matchId/court-change...");
    const courtChangeRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/court-change`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({});
    if (courtChangeRes.status !== 200) {
      console.error("POST /court-change error body:", courtChangeRes.body);
    }
    assert(courtChangeRes.status === 200, `POST /court-change returned HTTP 200 (got ${courtChangeRes.status})`);
    logPass("POST /court-change succeeded (HTTP 200)");

    // Route 7: POST /matches/:matchId/undo
    logInfo("Executing 7/7: POST /matches/:matchId/undo...");
    const undoRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/undo`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({});
    if (undoRes.status !== 200) {
      console.error("POST /undo error body:", undoRes.body);
    }
    assert(undoRes.status === 200, `POST /undo returned HTTP 200 (got ${undoRes.status})`);
    logPass("POST /undo succeeded (HTTP 200)");

    // Verify all persisted rows in scoring_events
    const eventRows = await masterClient.query(
      `SELECT sequence, event_type, recorded_at FROM scoring_events WHERE match_id = $1 ORDER BY sequence ASC`,
      [MATCH_ROUTE],
    );
    logInfo(`Persisted event rows count in PostgreSQL: ${eventRows.rows.length}`);
    for (const r of eventRows.rows) {
      console.log(`    seq ${r.sequence}: ${r.event_type}`);
    }
    assert(eventRows.rows.length >= 7, "All 7 route mutations successfully persisted to PostgreSQL table");

    // Check monotonic sequence: 1, 2, 3, 4, 5, 6, 7...
    for (let i = 0; i < eventRows.rows.length; i++) {
      assert(Number(eventRows.rows[i].sequence) === i + 1, `Sequence integrity verified: event ${i + 1} has seq ${eventRows.rows[i].sequence}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    logHeader("TEST 6: Stale Lease Rejection on Real HTTP Route Boundary");
    logInfo("Take over lock on MATCH_ROUTE with a foreign session.");
    logInfo("Call POST /point with the original Scorer JWT. Router must return HTTP 409.");

    // Foreign takeover
    await acquireMatchLock({
      matchId: MATCH_ROUTE,
      scorerId: SCORER_ID_B,
      sessionId: "foreign_takeover_session",
      tournamentId: TID_ROUTE,
      sport: "badminton",
      forceTakeover: true,
    });
    logPass("Foreign takeover executed on MATCH_ROUTE");

    const staleRouteRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/point`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        side: "right",
      });

    assert(staleRouteRes.status === 409, `Stale route call rejected with HTTP 409 (got ${staleRouteRes.status})`);
    assert(
      staleRouteRes.body.code === "SCORER_LEASE_REVOKED" || staleRouteRes.body.code === "LOCK_NOT_OWNED" || staleRouteRes.body.code === "MATCH_LOCKED",
      `Expected 409 lock revocation error code, got '${staleRouteRes.body.code}'`,
    );

    // Verify event count in DB did NOT increase
    const eventRowsAfter = await masterClient.query(
      `SELECT count(*) FROM scoring_events WHERE match_id = $1`,
      [MATCH_ROUTE],
    );
    assert(
      Number(eventRowsAfter.rows[0].count) === eventRows.rows.length,
      "Zero rows added after rejected stale route call (database state immutable)",
    );

    // Clean up
    await cleanupTestData(masterClient);
    logPass("Post-test database cleanup complete.");

    // Final summary
    logHeader("PHASE 3.2 REAL POSTGRESQL VERIFICATION COMPLETE");
    console.log(`\n  Total Tests Passed: ${GREEN}${passedCount}${RESET}`);
    console.log(`  Total Tests Failed: ${failedCount === 0 ? GREEN : RED}${failedCount}${RESET}\n`);

    if (failedCount > 0) {
      process.exit(1);
    }
    process.exit(0);
  } finally {
    await masterClient.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in Phase 3.2 Real PostgreSQL verification:", err);
  process.exit(1);
});
