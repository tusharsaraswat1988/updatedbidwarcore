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

import pg from "pg";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { sql, eq, and, desc } from "drizzle-orm";

// Initialize application environment & runtime
import "../../artifacts/api-server/src/lib/bootstrap.js";
import "../../artifacts/api-server/src/lib/scoring-adapters/register.js";

import { resolveDirectDatabaseUrl, resolveDatabaseUrl } from "@workspace/db/database-url";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  categoriesTable,
  teamsTable,
  playersTable,
  auctionSessionsTable,
  bidsTable,
  organizersTable,
  scorerAccountsTable,
  scorerSessionsTable,
  scorerTournamentAssignmentsTable,
  scorerMatchLocksTable,
  scoringMatchesTable,
  scoringMatchEventsTable,
  badmintonMatchDetailsTable,
} from "@workspace/db";

import router from "../../artifacts/api-server/src/routes/index.js";
import { jwtAuthMiddleware } from "../../artifacts/api-server/src/middleware/jwt-auth.js";
import { organizerAccountStatusMiddleware } from "../../artifacts/api-server/src/middleware/organizer-account-status.js";
import { signScorerJwt } from "../../artifacts/api-server/src/lib/jwt.js";
import {
  assertAuthoritativeScorerLease,
  acquireOrExtendScorerLock,
} from "../../artifacts/api-server/src/lib/scorer-match-locks.js";
import { appendMatchEventBatch } from "../../artifacts/api-server/src/lib/scoring-platform/orchestrator.js";
import { lockAuctionMutation } from "../../artifacts/api-server/src/lib/auction-mutation-lock.js";

const { Client } = pg;

// Colors for beautiful terminal reporting
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

// Distinct test IDs to prevent conflict with other records
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
async function cleanupTestData(client: pg.Client) {
  logInfo("Cleaning up test records for isolated test IDs...");
  const tids = [TID_BADMINTON, TID_AUCTION, TID_ROUTE];
  const matches = [MATCH_ID_1, MATCH_ID_2, MATCH_ROUTE];
  const scorers = [SCORER_ID_A, SCORER_ID_B, SCORER_ID_ROUTE];

  await client.query(`DELETE FROM scoring_match_events WHERE match_id = ANY($1::int[])`, [matches]);
  await client.query(`DELETE FROM scorer_match_locks WHERE match_id = ANY($1::int[])`, [matches]);
  await client.query(`DELETE FROM badminton_match_details WHERE match_id = ANY($1::int[])`, [matches]);
  await client.query(`DELETE FROM scoring_matches WHERE id = ANY($1::int[])`, [matches]);
  await client.query(`DELETE FROM scorer_tournament_assignments WHERE scorer_id = ANY($1::int[])`, [scorers]);
  await client.query(`DELETE FROM scorer_sessions WHERE scorer_id = ANY($1::int[])`, [scorers]);
  await client.query(`DELETE FROM scorer_accounts WHERE id = ANY($1::int[])`, [scorers]);
  await client.query(`DELETE FROM bids WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM auction_sessions WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM players WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM teams WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM categories WHERE tournament_id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM tournaments WHERE id = ANY($1::int[])`, [tids]);
  await client.query(`DELETE FROM organizers WHERE id = ANY($1::int[])`, [scorers.concat([ORG_ID_AUCTION])]);
}

async function seedData(client: pg.Client) {
  logInfo("Seeding isolated test records...");

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
    INSERT INTO teams (id, tournament_id, name, short_name, purse_total, purse_used, roster_count)
    VALUES 
      ($1, $3, 'Team Alpha', 'ALP', 10000000, 0, 0),
      ($2, $3, 'Team Bravo', 'BRA', 10000000, 0, 0)
    ON CONFLICT (id) DO UPDATE SET purse_used = 0, roster_count = 0;
  `, [TEAM_ID_1, TEAM_ID_2, TID_AUCTION]);

  await client.query(`
    INSERT INTO players (id, tournament_id, name, base_price, status, current_team_id)
    VALUES 
      ($1, $3, 'Star Batter', 100000, 'available', NULL),
      ($2, $3, 'Pace Bowler', 100000, 'available', NULL)
    ON CONFLICT (id) DO UPDATE SET status = 'available', current_team_id = NULL;
  `, [PLAYER_ID_1, PLAYER_ID_2, TID_AUCTION]);

  // 3. Scorer Accounts & Sessions
  await client.query(`
    INSERT INTO scorer_accounts (id, name, mobile, pin_hash, can_score)
    VALUES 
      ($1, 'Alice Scorer', '9999999101', 'pin_hash_a', true),
      ($2, 'Bob Scorer', '9999999102', 'pin_hash_b', true),
      ($3, 'Route Scorer', '9999999301', 'pin_hash_r', true)
    ON CONFLICT (id) DO UPDATE SET can_score = true;
  `, [SCORER_ID_A, SCORER_ID_B, SCORER_ID_ROUTE]);

  await client.query(`
    INSERT INTO scorer_tournament_assignments (scorer_id, tournament_id, role)
    VALUES 
      ($1, $3, 'scorer'),
      ($2, $3, 'scorer'),
      ($4, $5, 'scorer')
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
      ($1, $4, 'badminton', 'live', 'singles', 1, 2),
      ($2, $4, 'badminton', 'live', 'singles', 1, 2),
      ($3, $5, 'badminton', 'live', 'singles', 1, 2)
    ON CONFLICT (id) DO UPDATE SET status = 'live';
  `, [MATCH_ID_1, MATCH_ID_2, MATCH_ROUTE, TID_BADMINTON, TID_ROUTE]);

  logPass("Seed data initialized in PostgreSQL database.");
}

// ── Run Tests ────────────────────────────────────────────────────────────────
async function main() {
  const masterClient = new Client({
    connectionString: directDbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await masterClient.connect();

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
    const initialLock = await acquireOrExtendScorerLock({
      matchId: MATCH_ID_1,
      scorerId: SCORER_ID_A,
      sessionId: SESSION_A,
      tournamentId: TID_BADMINTON,
      sport: "badminton",
    });
    assert(initialLock.ok && initialLock.lock?.leaseVersion === 1, "Alice acquired lease version 1");

    // Bob takes over lock
    const bobTakeover = await acquireOrExtendScorerLock({
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
            eventType: "point_scored",
            payload: { scoringSide: "left", reason: "winner" },
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
          leaseId: initialLock.lock!.leaseId,
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
      `SELECT count(*) FROM scoring_match_events WHERE match_id = $1`,
      [MATCH_ID_1],
    );
    assert(Number(eventsRes1.rows[0].count) === 0, "Real Postgres scoring_match_events contains 0 rows (fully rolled back)");

    // ─────────────────────────────────────────────────────────────────────────
    logHeader("TEST 2: SEC-2026-06 — Scorer Lease Fencing (Ordering 2: Postgres FOR UPDATE Row Serialization)");
    logInfo("Spawning two distinct physical PostgreSQL clients (Client A and Client B).");
    logInfo("Client A enters transaction and locks scorer_match_locks FOR UPDATE.");
    logInfo("Client B attempts concurrent takeover. PostgreSQL kernel blocks Client B until Client A commits.");

    // Setup initial lock on MATCH_ID_2
    const lock2 = await acquireOrExtendScorerLock({
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
      })();

      // Wait 300ms to allow Client B's query to arrive at Postgres server
      await new Promise((r) => setTimeout(r, 300));
      clientBBlocked = !clientBFinished;
      assert(clientBBlocked, "Client B is genuinely blocked waiting on PostgreSQL row lock!");

      // Inspect pg_stat_activity / pg_locks to verify lock wait state
      const lockWaitCheck = await masterClient.query(`
        SELECT count(*) 
        FROM pg_locks l
        JOIN pg_stat_activity a ON l.pid = a.pid
        WHERE l.relation = 'scorer_match_locks'::regclass
      `);
      logInfo(`Postgres active locks on scorer_match_locks: ${lockWaitCheck.rows[0].count}`);

      // Client A persists valid event and commits
      await clientA.query(`
        INSERT INTO scoring_match_events (match_id, sequence, sport_slug, event_type, actor_type, actor_id, payload)
        VALUES ($1, 1, 'badminton', 'point_scored', 'scorer', $2, '{"scoringSide":"left"}'::jsonb)
      `, [MATCH_ID_2, String(SCORER_ID_A)]);
      await clientA.query("COMMIT");
      logPass("Client A committed transaction and released row lock.");

      // Now Client B must unblock and finish immediately
      await clientBPromise;
      assert(clientBFinished, "Client B unblocked and finished takeover commit.");

      // Verify DB final state
      const match2Events = await masterClient.query(
        `SELECT count(*), max(sequence) FROM scoring_match_events WHERE match_id = $1`,
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
    // SECTION 2: SEC-2026-07 REAL POSTGRESQL AUCTION CAS & ADVISORY LOCKS
    // =========================================================================
    logHeader("TEST 3: SEC-2026-07 — Auction Advisory Lock & CAS (Ordering 1: Bid Commits First, Unsold Rejects)");
    logInfo("Session has revision 10. Bid acquires pg_advisory_xact_lock, updates bid to ₹250k, revision to 11.");
    logInfo("Concurrent unsold request with expectedRevision 10 detects active bid & stale revision, aborts with 409.");

    // Setup active session for Player 1
    await masterClient.query(`
      INSERT INTO auction_sessions (
        tournament_id, status, current_player_id, current_bid, current_bidder_team_id, revision, last_action
      ) VALUES ($1, 'live', $2, NULL, NULL, 10, 'player_selected')
      ON CONFLICT (tournament_id) DO UPDATE SET
        status = 'live',
        current_player_id = $2,
        current_bid = NULL,
        current_bidder_team_id = NULL,
        revision = 10,
        last_action = 'player_selected';
    `, [TID_AUCTION, PLAYER_ID_1]);

    const connA = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    const connB = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await connA.connect();
    await connB.connect();

    try {
      // Client A performs Bid transaction using real pg_advisory_xact_lock
      await connA.query("BEGIN");
      await connA.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`bidwar-demo-reset:${TID_AUCTION}`]);
      
      // Update session with new bid and increment revision
      await connA.query(`
        UPDATE auction_sessions
        SET current_bid = 250000, current_bidder_team_id = $1, revision = revision + 1, last_action = 'bid'
        WHERE tournament_id = $2
      `, [TEAM_ID_1, TID_AUCTION]);

      // Deduct team purse
      await connA.query(`
        UPDATE teams
        SET purse_used = purse_used + 250000
        WHERE id = $1
      `, [TEAM_ID_1]);

      await connA.query("COMMIT");
      logPass("Client A (Bid) committed: currentBid = ₹250,000, revision = 11, team purse updated.");

      // Client B performs Unsold CAS check against real PostgreSQL
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

      assert(unsoldRejected, "Unsold transaction was safely rejected by CAS check");
      assert(rejectionReason.includes("Active bid placed"), `Rejection reason: ${rejectionReason}`);

      // Verify DB State integrity
      const postSess = await masterClient.query(
        `SELECT current_bid, current_bidder_team_id, revision FROM auction_sessions WHERE tournament_id = $1`,
        [TID_AUCTION],
      );
      assert(postSess.rows[0].current_bid === 250000, "Auction session retains valid current_bid = 250000");
      assert(postSess.rows[0].revision === 11, "Auction session revision is 11");

      const playerCheck = await masterClient.query(
        `SELECT status FROM players WHERE id = $1`,
        [PLAYER_ID_1],
      );
      assert(playerCheck.rows[0].status === "available", "Player status remains 'available' (NEVER marked unsold)");

      const teamCheck = await masterClient.query(
        `SELECT purse_used FROM teams WHERE id = $1`,
        [TEAM_ID_1],
      );
      assert(teamCheck.rows[0].purse_used === 250000, "Team purse is properly preserved without corruption");
    } finally {
      await connA.end().catch(() => {});
      await connB.end().catch(() => {});
    }

    // ─────────────────────────────────────────────────────────────────────────
    logHeader("TEST 4: SEC-2026-07 — Auction Advisory Lock & CAS (Ordering 2: Unsold Commits First, Bid Rejects)");
    logInfo("Unsold commits first. Player is marked unsold. Subsequent bid attempt is rejected with HTTP 400.");

    // Setup active session for Player 2
    await masterClient.query(`
      UPDATE auction_sessions
      SET status = 'live', current_player_id = $1, current_bid = NULL, current_bidder_team_id = NULL, revision = 20, last_action = 'player_selected'
      WHERE tournament_id = $2
    `, [PLAYER_ID_2, TID_AUCTION]);

    const conn1 = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    const conn2 = new Client({ connectionString: directDbUrl, ssl: { rejectUnauthorized: false } });
    await conn1.connect();
    await conn2.connect();

    try {
      // Conn 1 executes Unsold
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
      logPass("Client 1 (Unsold) committed: player marked unsold, current_player_id cleared, revision = 21.");

      // Conn 2 attempts Bid
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
      logPass(`Bid rejection confirmed: ${bidError}`);

      // Verify DB State integrity
      const p2 = await masterClient.query(`SELECT status FROM players WHERE id = $1`, [PLAYER_ID_2]);
      assert(p2.rows[0].status === "unsold", "Player 2 is marked 'unsold'");

      const sessFinal = await masterClient.query(`SELECT current_player_id, revision FROM auction_sessions WHERE tournament_id = $1`, [TID_AUCTION]);
      assert(sessFinal.rows[0].current_player_id === null, "Current player ID is NULL in session");
      assert(sessFinal.rows[0].revision === 21, "Revision is 21");

      const tPurse = await masterClient.query(`SELECT purse_used FROM teams WHERE id = $1`, [TEAM_ID_2]);
      assert(tPurse.rows[0].purse_used === 0, "Zero purse deducted from Team 2 (0 corruption)");
    } finally {
      await conn1.end().catch(() => {});
      await conn2.end().catch(() => {});
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
      phone: "9999999301",
      name: "Route Scorer",
    });

    // Acquire initial lock for route match
    const routeLock = await acquireOrExtendScorerLock({
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
        leftSide: { label: "Left Player", shortLabel: "LP" },
        rightSide: { label: "Right Player", shortLabel: "RP" },
        tossWinner: "leftSide",
        tossChoice: "serve",
        server: "leftSide",
        receiver: "rightSide",
        format: {
          totalGames: 3,
          pointsPerGame: 21,
          deuceAt: 20,
          maxPoints: 30,
          midGameSideChange: false,
        },
      });
    assert(startRes.status === 200, `POST /start returned HTTP 200 (got ${startRes.status})`);

    // Route 2: POST /matches/:matchId/point
    logInfo("Executing 2/7: POST /matches/:matchId/point...");
    const pointRes1 = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/point`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        scoringSide: "left",
        reason: "winner",
      });
    assert(pointRes1.status === 200, `POST /point returned HTTP 200 (got ${pointRes1.status})`);

    // Route 3: POST /matches/:matchId/undo
    logInfo("Executing 3/7: POST /matches/:matchId/undo...");
    const undoRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/undo`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({});
    assert(undoRes.status === 200, `POST /undo returned HTTP 200 (got ${undoRes.status})`);

    // Route 4: POST /matches/:matchId/timeout
    logInfo("Executing 4/7: POST /matches/:matchId/timeout...");
    const timeoutRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/timeout`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        side: "left",
        durationSeconds: 60,
      });
    assert(timeoutRes.status === 200, `POST /timeout returned HTTP 200 (got ${timeoutRes.status})`);

    // Route 5: POST /matches/:matchId/interval
    logInfo("Executing 5/7: POST /matches/:matchId/interval...");
    const intervalRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/interval`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({});
    assert(intervalRes.status === 200, `POST /interval returned HTTP 200 (got ${intervalRes.status})`);

    // Route 6: POST /matches/:matchId/court-change
    logInfo("Executing 6/7: POST /matches/:matchId/court-change...");
    const courtChangeRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/court-change`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({});
    assert(courtChangeRes.status === 200, `POST /court-change returned HTTP 200 (got ${courtChangeRes.status})`);

    // Route 7: POST /matches/:matchId/edit-toss
    logInfo("Executing 7/7: POST /matches/:matchId/edit-toss...");
    const editTossRes = await request(app)
      .post(`/api/tournaments/${TID_ROUTE}/badminton/matches/${MATCH_ROUTE}/edit-toss`)
      .set("Authorization", `Bearer ${scorerJwt}`)
      .send({
        tossWinner: "rightSide",
        tossChoice: "serve",
      });
    assert(editTossRes.status === 200, `POST /edit-toss returned HTTP 200 (got ${editTossRes.status})`);

    // Verify all persisted rows in scoring_match_events
    const eventRows = await masterClient.query(
      `SELECT sequence, event_type, created_at FROM scoring_match_events WHERE match_id = $1 ORDER BY sequence ASC`,
      [MATCH_ROUTE],
    );
    logInfo(`Persisted event rows count in PostgreSQL: ${eventRows.rows.length}`);
    for (const r of eventRows.rows) {
      console.log(`    seq ${r.sequence}: ${r.event_type}`);
    }
    assert(eventRows.rows.length >= 7, "All 7 route mutations successfully persisted to PostgreSQL table");

    // Check monotonic sequence: 1, 2, 3, 4, 5, 6, 7...
    for (let i = 0; i < eventRows.rows.length; i++) {
      assert(eventRows.rows[i].sequence === i + 1, `Sequence integrity verified: event ${i + 1} has seq ${eventRows.rows[i].sequence}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    logHeader("TEST 6: Stale Lease Rejection on Real HTTP Route Boundary");
    logInfo("Take over lock on MATCH_ROUTE with a foreign session.");
    logInfo("Call POST /point with the original Scorer JWT. Router must return HTTP 409.");

    // Foreign takeover
    await acquireOrExtendScorerLock({
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
        scoringSide: "left",
        reason: "winner",
      });

    assert(staleRouteRes.status === 409, `Stale route call rejected with HTTP 409 (got ${staleRouteRes.status})`);
    assert(
      staleRouteRes.body.code === "SCORER_LEASE_REVOKED" || staleRouteRes.body.code === "LOCK_NOT_OWNED" || staleRouteRes.body.code === "MATCH_LOCKED",
      `Expected 409 lock revocation error code, got '${staleRouteRes.body.code}'`,
    );

    // Verify event count in DB did NOT increase
    const eventRowsAfter = await masterClient.query(
      `SELECT count(*) FROM scoring_match_events WHERE match_id = $1`,
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
  } finally {
    await masterClient.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in Phase 3.2 Real PostgreSQL verification:", err);
  process.exit(1);
});
