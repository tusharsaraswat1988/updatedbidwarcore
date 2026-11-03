# BIDWAR — Phase 3.1 Production-Code Verification & Test Hardening Report

**Audit Date:** November 3, 2026  
**Auditor:** Antigravity Advanced Agentic Pair Programmer  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Target Branch:** `fix/phase-3-p2-concurrency-hardening`  
**Base Commit:** `cb55d989508df066b92226947f4b60e1f0ead832`  
**Staging Healthz Endpoint:** `https://stagingbidwar.up.railway.app/api/healthz`  
**Environment Target:** Dedicated Staging Only (Production Untouched)

---

## 1. Executive Summary & Verification Classification

| Finding ID | Vulnerability Title | Severity | Remediation Scope | Final Status |
|---|---|---|---|---|
| **SEC-2026-06** | Badminton Scorer Lease Fencing TOCTOU Gap | **P2** | Real `SELECT ... FOR UPDATE` row-lock fencing on `scorer_match_locks`, outer transaction propagation in `appendMatchEventBatch`, rollback on takeover/expired lease | **VERIFIED FIXED** |
| **SEC-2026-07** | Auction Unsold CAS Revision Guard & In-Flight Bid Protection | **P2** | Mandatory `expectedRevision` in `POST /auction/unsold` (HTTP 400 on missing), pre-flight bid/revision guards, atomic CAS update under `lockAuctionMutation` | **VERIFIED FIXED** |

Both vulnerabilities have been independently verified against the actual production codebase, production routers, and real transaction engines. All mock Express handlers recreating production logic have been replaced with tests invoking production routes and services.

---

## 2. SEC-2026-07 — Real Production Auction Route Verification

### 2.1 Mandatory `expectedRevision` Enforcement
In accordance with the Phase 3.1 specification, `expectedRevision` was promoted from an optional parameter to a **strictly mandatory** contract requirement:
1. **API Server Route (`artifacts/api-server/src/routes/auction.ts`)**:
   - `unsoldBodySchema`: `z.object({ expectedRevision: z.number().int({ message: "expectedRevision must be an integer" }) })`
   - Requests omitting `expectedRevision` or supplying a non-integer value immediately fail validation and return **HTTP 400 Bad Request** (`expectedRevision is required and must be an integer`).
   - Inside the transaction under `lockAuctionMutation(tx, tid)` and `SELECT ... FOR UPDATE`:
     ```ts
     if ((currentSession.revision ?? 0) !== unsoldConfirmation.expectedRevision) {
       throw new UnsoldTransactionAbortError("stale_unsold");
     }
     const expectedRevision = unsoldConfirmation.expectedRevision;
     ```
     The unversioned fallback was completely removed.
2. **Auction State Output**:
   - In `buildAuctionStateInner`, `revision: session.revision ?? 0` is now explicitly exposed on the root `AuctionState` return object, allowing clients to receive and transmit the authoritative counter.
3. **OpenAPI 3.1 Specification (`lib/api-spec/openapi.yaml`)**:
   - Added `UnsoldInput` schema with `required: [expectedRevision]`.
   - Updated `/tournaments/{tournamentId}/auction/unsold` with `requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UnsoldInput" } } } }`.
   - Added `revision: { type: integer }` to `AuctionState` schema.
4. **Generated React Client SDK (`lib/api-client-react`)**:
   - Regenerated via `pnpm --filter @workspace/api-spec run codegen`.
   - `markUnsold` and `useMarkUnsold` now require `{ tournamentId: number, data: BodyType<UnsoldInput> }`.
5. **Caller Updates**:
   - `artifacts/auction-platform/src/pages/auction-operator.tsx`:
     ```tsx
     async function handleUnsold() {
       if (controlsLocked || markUnsold.isPending) return;
       const currentRev = (state as { revision?: number } | undefined)?.revision ?? 0;
       const result = await markUnsold.mutateAsync({
         tournamentId,
         data: { expectedRevision: currentRev },
       });
       applyMutationResult(result);
     }
     ```
   - All simulation scripts (`run-browser-concurrency-simulation.ts`, `run-network-throttling-simulation.ts`, `run-obs-led-sync-simulation.ts`, `inspect-dom.ts`, `test-operator.ts`) were upgraded to pass `{ expectedRevision: ... }`.

### 2.2 Integration Test Evidence
In `artifacts/api-server/src/__tests__/phase3-1-concurrency-verification.test.ts`:
- **Auth Middleware**:
  - Request with no JWT -> **HTTP 403** (`Authentication required`).
  - Request with organizer token from mismatched tournament -> **HTTP 403** (`Authentication required`).
  - Request with authorized tournament organizer -> authorized and processed.
- **Route Input Validation**:
  - Empty body `{}` -> **HTTP 400** (`expectedRevision is required and must be an integer`).
  - `{ expectedRevision: "not-an-integer" }` -> **HTTP 400**.
- **Pre-Flight Guards**:
  - In-flight bid active on block (`currentBid !== null`) -> **HTTP 409** `bid_in_progress`.
  - Stale revision sent (`expectedRevision !== session.revision`) -> **HTTP 409** `stale_unsold`.
- **Real Transaction Concurrency**:
  - **Scenario A (Bid commits first)**:
    - Operation 1 (Bid) and Operation 2 (Unsold with base revision 10) fire simultaneously.
    - Bid acquires lock first: sets `currentBid = 125_000`, `currentBidTeamId = 2`, increments `revision = 11`.
    - Unsold executes second under lock: evaluates `currentSession.currentBid !== null` and `revision = 11 !== 10`:
      - Throws `UnsoldTransactionAbortError("bid_in_progress")`.
      - Transaction rolls back completely.
      - Returns **HTTP 409** `bid_in_progress`.
    - State assertions: exactly one outcome committed; player 100 remains `available`; Team 2 purse is deducted for the bid; roster has 0 corruption.
  - **Scenario B (Unsold commits first)**:
    - Operation 1 (Unsold with base revision 10) and Operation 2 (Bid) fire simultaneously.
    - Unsold acquires lock first: sets `players.status = 'unsold'`, clears `session.currentPlayerId = null`, increments `revision = 11`.
    - Subsequent bid request discovers `currentPlayerId === null` -> rejected cleanly with **HTTP 400** (`No current player`).
    - State assertions: player 100 is `unsold`; `currentPlayerId` is null; zero purse deductions occurred.

---

## 3. SEC-2026-06 — Real PostgreSQL Lease-Fencing Verification

### 3.1 Architectural Implementation
1. **Outer Database Transaction & Row Lock**:
   - In `artifacts/api-server/src/lib/scoring-platform/orchestrator.ts`, `appendMatchEventBatch` wraps event persistence in `db.transaction(async (tx) => { ... })`.
   - Before any event sequence check or insert, it executes:
     `await assertAuthoritativeScorerLease(tx, input.lease);`
   - In `scorer-match-locks.ts`, `assertAuthoritativeScorerLease` executes:
     ```ts
     const rows = await tx
       .select()
       .from(scorerMatchLocksTable)
       .where(eq(scorerMatchLocksTable.matchId, input.matchId))
       .for("update");
     ```
2. **Lease Version Fencing**:
   - Verifies `lock.sessionId === input.sessionId`, `lock.scorerId === input.scorerId`, and `lock.leaseVersion === input.leaseVersion`.
   - If a takeover occurred, `lock.leaseVersion` is incremented to `N+1` and `lock.sessionId` is updated.
   - The stale holder throws `ScorerLockError("SCORER_LEASE_REVOKED", 409)`.
   - When thrown inside `db.transaction`, the entire transaction rolls back, preventing sequence increments, event persistence, and snapshot updates.

### 3.2 Verification Test Evidence
In `artifacts/api-server/src/__tests__/phase3-1-concurrency-verification.test.ts`:
- **Takeover Serialization**:
  - Scorer A holds Lease Version 1 (`sess_scorer_a`).
  - Scorer B executes takeover, committing Lease Version 2 (`sess_scorer_b`).
  - Scorer A attempts to commit batch with Lease Version 1:
    - Throws `ScorerLockError` with code `SCORER_LEASE_REVOKED`.
    - Batch append aborts; 0 events written.
- **Heartbeat Expiration**:
  - Scorer holds matching session, but `lastHeartbeatAt` is older than `SCORER_LOCK_TIMEOUT_SEC`:
    - Throws `ScorerLockError` with code `SCORER_LEASE_EXPIRED`.
- **Valid Scorer Commit**:
  - Scorer B with active fresh lease commits batch append:
    - Row lock confirmed, events persisted, sequence incremented, projections updated.

---

## 4. Badminton Mutation Route Coverage

All 7 mutation routes in `artifacts/api-server/src/routes/badminton.ts` were inspected and verified:
1. `POST /tournaments/:id/badminton/matches/:matchId/start`
2. `POST /tournaments/:id/badminton/matches/:matchId/point`
3. `POST /tournaments/:id/badminton/matches/:matchId/undo`
4. `POST /tournaments/:id/badminton/matches/:matchId/timeout`
5. `POST /tournaments/:id/badminton/matches/:matchId/interval`
6. `POST /tournaments/:id/badminton/matches/:matchId/court-change`
7. `POST /tournaments/:id/badminton/matches/:matchId/edit-toss`

### 4.1 Route-Level Behaviors
- Each route utilizes `guardBadmintonScoring` and extracts the scorer lease context via `leaseFrom(req, auth.auth)`.
- Handlers pass `{ lease: leaseFrom(req, auth.auth) }` into the service functions (`startBadmintonMatch`, `awardPoint`, `undoLastPoint`, `handleTimeout`, `handleInterval`, `handleCourtChangeAck`, `handleCorrectToss`).
- `handleBadmintonError(res, e)` traps `ScorerLockError` and formats HTTP 409 responses with explicit error codes:
  - `SCORER_LEASE_REVOKED` -> HTTP 409
  - `SCORER_LEASE_STALE` -> HTTP 409
  - `SCORER_LEASE_EXPIRED` -> HTTP 409
  - `SCORER_LEASE_REQUIRED` -> HTTP 409

### 4.2 Director Routes & Interventions
- Administrative terminal routes (`/retirement`, `/walkover`, `/disqualification`, `/pause`) utilize `guardBadmintonDirector`.
- These routes enforce tournament organizer/admin JWT credentials without requiring a scorer lease.
- Upon terminal match outcome, `maybeReleaseLockAfterTerminal` safely releases the active match lock from `scorer_match_locks`.

---

## 5. Quality, Build & Regression Matrix

### 5.1 Test Suites Execution
```
 Test Files  10 passed (10)
      Tests  137 passed (137)
```
- `src/__tests__/phase3-1-concurrency-verification.test.ts`: **14/14 PASS**
- `src/__tests__/phase3-p2-hardening.test.ts`: **12/12 PASS**
- `src/__tests__/scorer-lock-takeover-fencing.test.ts`: **31/31 PASS**
- `src/__tests__/auction-owner-bidding.test.ts`: **16/16 PASS**
- `src/__tests__/auction-sell-duplicate-safety.test.ts`: **15/15 PASS**
- `src/__tests__/badminton-scorer-home.test.ts`: **14/14 PASS**
- `src/__tests__/auction-transactions.test.ts`: **12/12 PASS**
- `src/__tests__/phase2-5-independent-verification.test.ts`: **11/11 PASS**
- `src/__tests__/phase2-p1-hotfixes.test.ts`: **9/9 PASS**
- `src/__tests__/badminton-lifecycle.test.ts`: **3/3 PASS**

### 5.2 Build Verification
- **API Server Build**: `pnpm --filter @workspace/api-server build` -> **0 errors**, built in 464ms.
- **Auction Platform Build**: `pnpm --filter @workspace/auction-platform build` -> **0 errors**, built in 10.48s.
- **Client Codegen**: `pnpm --filter @workspace/api-spec run codegen` -> **0 errors**.

---

## 6. Staging Deployment Verification

- **Staging Service Health Check**:
  ```json
  {
    "status": "ok",
    "commitSha": "38838c1",
    "buildTimestamp": null,
    "bidwarEnv": "staging"
  }
  ```
- **Environment Isolation**:
  - `bidwarEnv`: `"staging"`
  - Host: `stagingbidwar.up.railway.app`
  - Production (`bidwar.in`) remains completely untouched and isolated.
- **Origin Isolation**:
  - PWA manifest and static asset URLs use same-origin relative paths.

---

## 7. Sign-Off & Recommendation

Phase 3.1 verification is complete and all tests pass with zero regressions. The branch `fix/phase-3-p2-concurrency-hardening` is verified and ready for staging testing and pull request review.
