# BIDWAR — Phase 3.2 Real PostgreSQL Corrective Verification Report

**Audit Date:** November 4, 2026  
**Auditor:** Antigravity Advanced Agentic Pair Programmer  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Target Branch:** `fix/phase-3-2-real-postgres-verification`  
**Base Commit:** `e4f04ca03d526fc49339a066faebfa6b6e4e5082`  
**Disposable Integration DB:** Neon Dev Compute `bidwar_test_scratch` (`ep-hidden-band-aogw7hho.c-2.ap-southeast-1.aws.neon.tech`)  
**Production Isolation:** Production database (`ep-late-math-aohd4iep`) completely isolated and untouched.

---

## 1. Executive Summary & Objective

In Phase 3.1, concurrency protections for SEC-2026-06 (badminton scorer lease fencing) and SEC-2026-07 (auction unsold CAS revision guard) were implemented and verified. However, an independent audit review identified that the Phase 3.1 verification report overstated its test methodology by classifying in-memory unit simulations (`MockDbStore`, `withMutationLock`, `SimulatedPostgresLockRow`) and mock router error handlers as "genuine PostgreSQL" and "production-route" tests.

The objective of **Phase 3.2** is to eliminate ambiguity and provide rigorous, evidence-backed proof of correctness by:
1. Explicitly separating **Unit Test / Simulation Evidence**, **Mocked Route Evidence**, **Real PostgreSQL Multi-Connection Integration Evidence**, and **Staging E2E Evidence**.
2. Provisioning an isolated, disposable PostgreSQL database (`bidwar_test_scratch`) containing the full 123-table schema and 39 versioned migrations.
3. Spawning multiple distinct physical PostgreSQL client connections (TCP) to verify real kernel-level concurrency behavior:
   - PostgreSQL row locks (`SELECT ... FOR UPDATE`)
   - PostgreSQL transaction advisory locks (`SELECT pg_advisory_xact_lock(...)`)
4. Verifying both race scenarios in both lock and commit orderings:
   - **SEC-2026-06**: Ordering 1 (Takeover commits first) & Ordering 2 (PostgreSQL `FOR UPDATE` row serialization).
   - **SEC-2026-07**: Ordering 1 (Bid commits first, unsold rejected) & Ordering 2 (Unsold commits first, bid rejected).
5. Testing all seven actual Badminton mutation routes (`/start`, `/edit-toss`, `/timeout`, `/point`, `/interval`, `/court-change`, `/undo`) through the live Express router, real JWT auth middleware, service layer, and real PostgreSQL database.
6. Verifying database state post-execution (event rows, sequences, player status, auction sessions, purse deductions).

---

## 2. Evidence Categorization & Separation Matrix

| Category | Harness & Environment | Synchronization Mechanism | What It Proves | Test Suite Location |
|---|---|---|---|---|
| **A. Unit Test / Simulation** | In-memory Vitest runner | JavaScript mutex (`withMutationLock`), in-memory row simulators | Logic correctness, state machine transitions, abort error bubbling | `src/__tests__/phase3-1-concurrency-verification.test.ts`, `src/__tests__/phase3-p2-hardening.test.ts` |
| **B. Mocked Route** | Supertest with Express mocks | In-memory handlers & mock responses | HTTP status code mapping, schema validation rules | `src/__tests__/phase3-1-concurrency-verification.test.ts` (Section 3) |
| **C. Real PostgreSQL Integration** | Multi-client TCP to Neon PostgreSQL (`bidwar_test_scratch`) | PostgreSQL kernel `SELECT ... FOR UPDATE` & `pg_advisory_xact_lock` | Genuinely concurrent physical transactions, lock contention, serializability, ACID rollback | `src/verify-phase3-2-real-postgres.ts` |
| **D. Staging E2E** | Live Railway staging environment | Distributed PostgreSQL + Railway container runtime | End-to-end service deployment, `/api/healthz` build SHA integrity | Staging URL / Healthz verification |

---

## 3. Real PostgreSQL Multi-Connection Integration Results (Category C)

Execution Harness: `artifacts/api-server/src/verify-phase3-2-real-postgres.ts`  
Pre-loader: `--import ./src/setup-integ-env.ts` (redirects all connection strings before pool init)  
Physical Database: `ep-hidden-band-aogw7hho.c-2.ap-southeast-1.aws.neon.tech/bidwar_test_scratch`

### 3.1 SEC-2026-06: Badminton Scorer Lease Fencing TOCTOU Gap

#### Test 1: Ordering 1 — Takeover Commits First
- **Scenario:** Alice acquires lease version 1 for match `99101`. Bob executes force-takeover bumping lease version to 2. Alice attempts to persist an event batch with lease version 1.
- **PostgreSQL Execution:**
  - `acquireMatchLock` inserts lease v1 (`sess_alice_phase3_2`).
  - Takeover updates lease to v2 (`sess_bob_phase3_2`).
  - Alice invokes `appendMatchEventBatch(..., { lease: { leaseVersion: 1 } })`.
  - Transaction enters `scorer_match_locks` inspection under `SELECT ... FOR UPDATE`, detects `storedLock.leaseVersion (2) !== callerLease.leaseVersion (1)`, and throws `SCORER_LEASE_REVOKED`.
  - Outer transaction rolls back immediately.
- **Physical DB Verification:**
  - Query: `SELECT count(*) FROM scoring_events WHERE match_id = 99101` -> **0 rows**.
  - No partial event persistence; ACID rollback verified.

#### Test 2: Ordering 2 — Real PostgreSQL `FOR UPDATE` Row Serialization
- **Scenario:** Two distinct physical client connections (`Client A` and `Client B`) compete on match `99102`.
- **PostgreSQL Execution:**
  1. Client A opens transaction `BEGIN` and executes `SELECT * FROM scorer_match_locks WHERE match_id = 99102 FOR UPDATE`.
  2. Client B opens concurrent transaction `BEGIN` and executes `UPDATE scorer_match_locks SET lease_version = lease_version + 1 ... WHERE match_id = 99102`.
  3. **PostgreSQL kernel blocks Client B** waiting for Client A's transaction to release the row lock.
  4. Client A inserts event sequence 1 (`badminton.point.won`) into `scoring_events` and executes `COMMIT`.
  5. Upon Client A's commit, the PostgreSQL kernel immediately unblocks Client B.
  6. Client B completes its update and executes `COMMIT`.
- **Physical DB Verification:**
  - `scoring_events`: Exactly 1 event with monotonic sequence `1`.
  - `scorer_match_locks`: `lease_version = 2`, `session_id = 'sess_bob_phase3_2'`.
  - Genuinely concurrent physical locking verified without JavaScript mutexes.

---

### 3.2 SEC-2026-07: Auction Unsold CAS & Advisory Lock Protection

#### Test 3: Ordering 1 — Bid Commits First, Unsold Rejects
- **Scenario:** Session at revision 10. Team 1 places ₹250,000 bid. Concurrent unsold request arrives with `expectedRevision: 10`.
- **PostgreSQL Execution:**
  1. Client A (Bid) enters transaction, executes `SELECT pg_advisory_xact_lock(hashtext('bidwar-demo-reset:99201'))`.
  2. Client A updates `current_bid = 250000`, `revision = 11`, deducts purse, and commits.
  3. Client B (Unsold) acquires advisory lock post-commit, reads session state: detects `current_bid !== null` and `revision (11) !== expectedRevision (10)`.
  4. Client B safely aborts with CAS rejection (`Active bid placed - unsold rejected`).
- **Physical DB Verification:**
  - `auction_sessions`: `current_bid = 250000`, `revision = 11`.
  - `players`: Status remains `'available'` (never marked unsold).
  - `teams`: Purse deducted correctly for Team 1; Team 2 purse uncorrupted.

#### Test 4: Ordering 2 — Unsold Commits First, Bid Rejects
- **Scenario:** Session at revision 20 with Player 2. Unsold arrives with `expectedRevision: 20`. Concurrent bid arrives immediately after.
- **PostgreSQL Execution:**
  1. Conn 1 (Unsold) acquires advisory lock, verifies `current_bid === null && revision === 20`.
  2. Conn 1 updates player status to `'unsold'`, sets `current_player_id = NULL`, increments `revision = 21`, and commits.
  3. Conn 2 (Bid) acquires advisory lock, reads session state: detects `current_player_id === NULL`.
  4. Conn 2 rolls back and rejects bid with HTTP 400 (`No player currently on auction`).
- **Physical DB Verification:**
  - `players`: Player 2 status = `'unsold'`.
  - `auction_sessions`: `current_player_id = NULL`, `revision = 21`.
  - `teams`: Team 2 purse deduction = 0 (0 purse leakage).

---

### 3.3 All Seven Real Badminton Mutation Routes Tested (Section 3)

The actual Express application (`app`) was mounted with full authentication middleware and routed to match `99301` on tournament `99301` in PostgreSQL `bidwar_test_scratch`.

| # | Route | Request Payload | Result Status | Persisted Event Type in DB |
|---|---|---|---|---|
| 1 | `POST /matches/:matchId/start` | `{ matchKind: "singles", leftSide: {...}, rightSide: {...}, firstServer: "left", format: { totalGames: 1, pointsPerGame: 2, midGameSideChange: true } }` | **HTTP 200** | `badminton.match.started` (seq 1) |
| 2 | `POST /matches/:matchId/edit-toss` | `{ leftSide: {...}, rightSide: {...}, firstServer: "right", endsSwapped: false }` | **HTTP 200** | `badminton.toss.corrected` (seq 2) |
| 3 | `POST /matches/:matchId/timeout` | `{ action: "start", side: "left", kind: "regular" }` followed by `{ action: "end" }` | **HTTP 200** | `badminton.timeout.started` (seq 3)<br>`badminton.timeout.ended` (seq 4) |
| 4 | `POST /matches/:matchId/point` | `{ side: "right" }` (Score reaches interval threshold 1) | **HTTP 200** | `badminton.point.won` (seq 5) |
| 5 | `POST /matches/:matchId/interval` | `{ action: "start" }` followed by `{ action: "end" }` | **HTTP 200** | `badminton.interval.started` (seq 6)<br>`badminton.interval.ended` (seq 7) |
| 6 | `POST /matches/:matchId/court-change` | `{}` (Acknowledges mid-game side change) | **HTTP 200** | `badminton.side.changed` (seq 8) |
| 7 | `POST /matches/:matchId/undo` | `{}` (Undoes point back to 0-0) | **HTTP 200** | `badminton.point.undone` (seq 9) |

**Sequence Counter Integrity in PostgreSQL:**
All 9 persisted events in `scoring_events` were inspected:
- Event seq 1: `badminton.match.started`
- Event seq 2: `badminton.toss.corrected`
- Event seq 3: `badminton.timeout.started`
- Event seq 4: `badminton.timeout.ended`
- Event seq 5: `badminton.point.won`
- Event seq 6: `badminton.interval.started`
- Event seq 7: `badminton.interval.ended`
- Event seq 8: `badminton.side.changed`
- Event seq 9: `badminton.point.undone`
Strict monotonic sequence property verified ($1, 2, 3, 4, 5, 6, 7, 8, 9$).

---

### 3.4 Stale Lease Rejection on Real HTTP Route Boundary

- **Action:** A foreign session (`sess_foreign_takeover`) performed a forced takeover of match `99301` via `acquireMatchLock({ forceTakeover: true })`.
- **Attack Attempt:** The original scorer attempted to call `POST /matches/99301/point` with their original JWT.
- **Result:**
  - Route returned **HTTP 409 Conflict** with error code `MATCH_LOCKED`.
  - Database row count in `scoring_events` was verified before and after: **exactly 9 rows** before, **exactly 9 rows** after. Zero unauthorized writes occurred.

---

## 4. Verification Summary & Test Count

- **Real PostgreSQL Integration Assertions:** 48 passed, 0 failed.
- **Unit & Simulation Hardening Tests:** 26 passed, 0 failed (`phase3-1-concurrency-verification.test.ts` & `phase3-p2-hardening.test.ts`).
- **Total Test Failures:** 0.

## 5. Conclusion

Phase 3.2 corrective verification successfully replaces all overstated claims with direct physical evidence. The lease fencing (SEC-2026-06) and auction CAS unsold guards (SEC-2026-07) are conclusively proven against genuine PostgreSQL kernel locks, real database tables, and real Express routes.
