# BIDWAR PHASE 3 — P2 CONCURRENCY & RELIABILITY HARDENING REPORT

**Audit Date:** November 3, 2026  
**Auditor:** Antigravity Pair Programming Agent  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Target Branch:** `fix/phase-3-p2-concurrency-hardening`  
**Verified P1 Baseline SHA:** `7ea3cf7bd75fa18b31bc08bfd420d751f5e35448`  
**Base Commit on main:** `f4ad707811348c9cee56635c5efb7f9ea33f5bb4`  

---

## 1. Executive Summary

This report documents the design, implementation, and automated verification of **Phase 3: P2 Concurrency & Reliability Hardening**, addressing the two confirmed P2 concurrency findings from the November 2026 Comprehensive Security & Reliability Audit:

1. **SEC-2026-06 (Badminton Scorer Lease Fencing TOCTOU Gap):** Remediated by enforcing server-authoritative lease verification inside the atomic event batch transaction write boundary under a PostgreSQL `SELECT ... FOR UPDATE` row lock on `scorer_match_locks`, mirroring the Cricket lease fencing contract. Stale or revoked lease batches fail closed with HTTP 409 before state mutation.
2. **SEC-2026-07 (Auction Unsold CAS Revision Guard):** Remediated by adding an optional `expectedRevision` parameter to `POST /tournaments/:tournamentId/auction/unsold`, acquiring a mutation lock, and enforcing atomic Compare-and-Swap (CAS) update requiring `isNull(auctionSessionsTable.currentBid)` and `revision = expectedRevision`. In-flight bids are protected, and concurrent/stale requests fail closed with HTTP 409 `bid_in_progress` or `stale_unsold`.

All automated regression test suites, life-cycle integration tests, and production builds pass with zero regressions.

---

## 2. Findings & Root Cause Analysis

### SEC-2026-06: Badminton Scorer Lease Fencing TOCTOU Gap
- **Vulnerability Class:** Time-of-Check to Time-of-Use (TOCTOU) Race Condition / Authorization Bypass.
- **Affected Components:**
  - `artifacts/api-server/src/lib/badminton-service.ts`
  - `artifacts/api-server/src/lib/scoring-platform/orchestrator.ts`
  - `artifacts/api-server/src/lib/scoring-platform/event-store.ts`
  - `artifacts/api-server/src/routes/badminton.ts`
- **Root Cause:**
  Prior to Phase 3, badminton scorer lease validation was performed only at the HTTP route guard layer (`canWriteScoring`). Between the route-layer check and the event append, another scorer could initiate a match takeover (acquiring lock with higher `leaseVersion` and different `sessionId`). The first scorer's in-flight batch would continue executing in `badminton-service.ts` and `orchestrator.ts:appendMatchEventBatch`, where sequence allocation and batch inserts occurred outside an authoritative lease fence. A disconnected or displaced scorer could overwrite live scoring state after being displaced.

### SEC-2026-07: Auction Unsold CAS Revision Guard
- **Vulnerability Class:** Concurrency Race Condition / Data Integrity Gap.
- **Affected Components:**
  - `artifacts/api-server/src/routes/auction.ts`
- **Root Cause:**
  While `/sell` and `/manual-sell` had revision guards and bid checks, `POST /tournaments/:tournamentId/auction/unsold` accepted unversioned requests and performed an unconditional reset of `currentPlayerId: null` without validating `expectedRevision` or verifying that no in-flight bid had been placed between the operator clicking "Unsold" and the server transaction executing. A concurrent bid placed in that window would be silently obliterated by the unsold commit.

---

## 3. Remediation Architecture & Implementation

### 3.1 SEC-2026-06: Transactional Lease Fencing in Badminton Scoring

#### A. Event Store Transaction Propagation (`event-store.ts`)
- Updated `getNextEventSequence(matchId: number, tx: EventStoreTx | typeof db = db)` to accept an existing transaction client `tx`, preventing sequence numbering drift during concurrent writes.
- Updated `persistScoringEventBatch(matchId: number, inputs: PersistEventInput[], tx?: EventStoreTx)` to participate in an outer transaction, ensuring atomic sequence allocation, event row persistence, and rollback semantics if fencing checks fail.

#### B. Authoritative Scorer Lease Assertion in Batch Append (`orchestrator.ts`)
- Extended `AppendEventBatchInput` to accept optional `lease?: { scorerId: number; sessionId: string; leaseId?: string | null; leaseVersion?: number | null }`.
- Encapsulated event persistence inside `db.transaction(async (tx) => { ... })`.
- Within the transaction, invoked `assertAuthoritativeScorerLease(tx, input.lease)` before any sequence allocation or event insert.
- `assertAuthoritativeScorerLease` executes `SELECT * FROM scorer_match_locks WHERE match_id = $1 FOR UPDATE`. This guarantees that if a concurrent takeover transaction is in flight, one transaction blocks until the other finishes, and any stale lease holder immediately receives `ScorerLockError("SCORER_LEASE_REVOKED" | "SCORER_LEASE_STALE" | "SCORER_LEASE_EXPIRED")`.
- Transaction aborts immediately on lease error, leaving the `scoring_events` table and snapshot JSON completely untouched.

#### C. Service Layer Lease Plumbing (`badminton-service.ts`)
- Exported `type ScorerLeaseContext = { scorerId: number; sessionId: string; leaseId?: string | null; leaseVersion?: number | null; }`.
- Updated `persistBadmintonCommandEvents` and `persistCommandResult` to accept `opts?: { lease?: ScorerLeaseContext }`.
- Allowed `ScorerLockError` to re-throw directly without being intercepted or converted into generic platform errors.
- Updated all scorer command mutation handlers (`startBadmintonMatch`, `awardPoint`, `undoLastPoint`, `handleTimeout`, `handleInterval`, `handleCourtChangeAck`, `handleCorrectToss`, `handleRetirement`, `handleWalkover`, `handleDisqualification`, `handlePauseMatch`, `handleAddMatchNote`) to accept optional `lease` context.

#### D. Route Layer Lease Extraction & Error Formatting (`routes/badminton.ts`)
- Imported `scorerMatchLocksTable` and updated `ScoringActorContext` to preserve `lock?: typeof scorerMatchLocksTable.$inferSelect`.
- Implemented `leaseFrom(req, auth)`:
  - If caller is organizer/admin (`usedScorer: false`), returns `undefined`.
  - If caller is scorer, extracts `leaseId` and `leaseVersion` from request body with fallback to the active lock loaded during session validation.
- Implemented `handleBadmintonError(res, e)`:
  - Catches `ScorerLockError` and returns structured HTTP 409 responses with `{ error, code, leaseCode, message }`:
    - `SCORER_LEASE_REVOKED` -> HTTP 409 `MATCH_LOCKED` (`leaseCode: SCORER_LEASE_REVOKED`)
    - `SCORER_LEASE_STALE` -> HTTP 409 `SCORER_LEASE_STALE` (`leaseCode: SCORER_LEASE_STALE`)
    - `SCORER_LEASE_EXPIRED` -> HTTP 409 `SCORER_LEASE_EXPIRED` (`leaseCode: SCORER_LEASE_EXPIRED`)
    - `SCORER_LEASE_REQUIRED` -> HTTP 409 `SCORER_LEASE_REQUIRED`
- Connected `leaseFrom` and `handleBadmintonError` to all scoring routes (`/start`, `/point`, `/undo`, `/timeout`, `/interval`, `/court-change`, `/edit-toss`).

---

### 3.2 SEC-2026-07: Auction Unsold Atomic CAS Revision Guard

#### A. Request Validation & Preflight Checks (`routes/auction.ts`)
- Added schema validation for optional `expectedRevision?: z.number().int().optional()`.
- Implemented fast-rejection preflight checks:
  - If `session.currentBid !== null`, immediately rejects with HTTP 409 `bid_in_progress` and details of the current bid.
  - If `expectedRevision !== undefined && session.revision !== expectedRevision`, immediately rejects with HTTP 409 `stale_unsold`.

#### B. Transaction Mutation Lock & Row Re-Read
- Inside `db.transaction(async (tx) => { ... })`:
  - Enforced mutual exclusion via `lockAuctionMutation(tx, tid)`.
  - Re-read `auctionSessionsTable` with PostgreSQL row lock: `.where(eq(auctionSessionsTable.tournamentId, tid)).for("update")`.
  - Re-validated that `currentPlayerId` matches the session target, `currentBid` is still null, and revision matches `expectedRevision`.

#### C. Atomic CAS Updates with Row-Count Verification
- Executed atomic CAS update on `auction_sessions`:
  ```ts
  const updatedSessions = await tx
    .update(auctionSessionsTable)
    .set({
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerEndsAt: null,
      pausedTimeRemaining: null,
      revision: sql`COALESCE(revision, 0) + 1`,
      lastAction: `UNSOLD: ${player?.name ?? "Player"}`,
      lastOutcome: JSON.stringify({ type: "unsold", playerId, playerName, photoUrl }),
    })
    .where(
      and(
        eq(auctionSessionsTable.tournamentId, tid),
        eq(auctionSessionsTable.currentPlayerId, currentPlayerId),
        isNull(auctionSessionsTable.currentBid),
        sql`COALESCE(${auctionSessionsTable.revision}, 0) = ${expectedRevision}`,
      ),
    )
    .returning();
  ```
- If `updatedSessions.length === 0`, throws `UnsoldTransactionAbortError("stale_unsold")`.
- Executed atomic update on `playersTable`:
  ```ts
  const updatedPlayers = await tx
    .update(playersTable)
    .set({ status: "unsold" })
    .where(
      and(
        eq(playersTable.id, currentPlayerId),
        eq(playersTable.status, "available"),
      ),
    )
    .returning();
  ```
- If `updatedPlayers.length === 0`, throws `UnsoldTransactionAbortError("player_not_available")`.
- Handled `UnsoldTransactionAbortError` cleanly, returning HTTP 409 with exact hint (`bid_in_progress`, `player_not_available`, `stale_unsold`).

---

## 4. Verification & Test Matrix

### 4.1 Dedicated Phase 3 Hardening Tests (`phase3-p2-hardening.test.ts`)
A dedicated suite covering all edge cases was created and executed:

| Test Case | Scenario / Assertion | Status |
| :--- | :--- | :--- |
| **SEC-2026-06.1** | `assertAuthoritativeScorerLease` succeeds when scorer holds active fresh lease | **PASS** |
| **SEC-2026-06.2** | `assertAuthoritativeScorerLease` fails closed when lease heartbeat is expired | **PASS** |
| **SEC-2026-06.3** | `assertAuthoritativeScorerLease` rejects stale lease holder after takeover | **PASS** |
| **SEC-2026-06.4** | `assertAuthoritativeScorerLease` rejects request with stale `leaseVersion` | **PASS** |
| **SEC-2026-06.5** | `appendMatchEventBatch` enforces `assertAuthoritativeScorerLease` within transactional boundary | **PASS** |
| **SEC-2026-06.6** | `leaseFrom` extracts lease from request body with lock fallback | **PASS** |
| **SEC-2026-06.7** | `handleBadmintonError` maps `ScorerLockError` codes to HTTP 409 responses | **PASS** |
| **SEC-2026-07.1** | Unsold rejects when `currentBid` is not null (`bid_in_progress`, 409) | **PASS** |
| **SEC-2026-07.2** | Unsold rejects when `expectedRevision` does not match session revision (`stale_unsold`, 409) | **PASS** |
| **SEC-2026-07.3** | Unsold succeeds when `currentBid` is null and `expectedRevision` matches | **PASS** |
| **SEC-2026-07.4** | Concurrent bid vs unsold race condition: bid wins, unsold CAS fails closed | **PASS** |
| **SEC-2026-07.5** | Unsold transaction aborts cleanly when player is no longer available | **PASS** |

### 4.2 Existing Suite Regression Matrix
All related test suites were executed to verify backward compatibility:
- `badminton-scorer-home.test.ts` (14/14 tests passing)
- `badminton-lifecycle.test.ts` (3/3 tests passing)
- `scorer-lock-takeover-fencing.test.ts` (31/31 tests passing)
- `auction-sell-duplicate-safety.test.ts` (15/15 tests passing)
- `phase2-5-independent-verification.test.ts` (11/11 tests passing)

**Total automated tests passing:** 86/86.

### 4.3 Build Verification
- `@workspace/api-server` production build executed:
  `pnpm --filter @workspace/api-server build` -> **0 errors, generated `dist/index.mjs` (8.7mb) in 542ms**.

---

## 5. Audit Register Status (November 2026)

| Finding ID | Severity | Category | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-2026-01** | P1 | Concurrency | Auction Transaction Lock Detachment | **VERIFIED FIXED** (Phase 2 & 2.5) |
| **SEC-2026-02** | P1 | Business Logic | Manual Sell Validation Bypass | **VERIFIED FIXED** (Phase 2 & 2.5) |
| **SEC-2026-03** | P1 | Authorization | Player Profile Unauthenticated Overwrite | **VERIFIED FIXED** (Phase 2 & 2.5) |
| **SEC-2026-04** | P1 | Authorization | Scorer Tournament Tenant Isolation Bypass | **VERIFIED FIXED** (Phase 2 & 2.5) |
| **SEC-2026-05** | P1 | Authorization | OBS Director Cues Missing Authentication | **VERIFIED FIXED** (Phase 2 & 2.5) |
| **SEC-2026-06** | P2 | Concurrency | Badminton Scorer Lease Fencing TOCTOU Gap | **VERIFIED FIXED** (Phase 3) |
| **SEC-2026-07** | P2 | Concurrency | Auction Unsold CAS Revision Guard | **VERIFIED FIXED** (Phase 3) |
| **SEC-2026-08** | P2 | Architecture | Dual Identity Architecture & Role Consolidation | Scheduled for Phase 4 |
| **SEC-2026-09** | P3 | Reliability | Neon Connection Pooling & Failover Resilience | Open |
| **SEC-2026-10** | P3 | Maintainability | API Server Dead Code Pruning | Open |

---

## 6. Deployment & Safety Compliance
- **Production Database:** NOT TOUCHED.
- **Production Environment:** NO DEPLOYMENTS PERFORMED.
- **Main Branch:** NOT MERGED. Working branch remains `fix/phase-3-p2-concurrency-hardening`.
- **Documentation Integrity:** Maintained.
