# BIDWAR — Findings Register & Vulnerability Matrix
**Audit Date:** November 3, 2026  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Target Branch:** `main`  
**Evaluated Commit SHA:** `5dc8cf27b09ce0b580dc718ac19b732be0c07427`  
**Deployed Environments:** Railway Staging (`5dc8cf2`) & Production (`5dc8cf2`)  
**Audit Scope:** Full Codebase Forensic Audit — Security, Concurrency, Authorization, Data Integrity, Identity & Reliability  

---

## 1. Executive Findings Summary

| Finding ID | Severity | Category | Component / File | Title | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SEC-2026-01** | **P1** | Concurrency / Integrity | `routes/auction.ts:1898-1918` | Auction Bid Advisory Lock Transaction Detachment (`db.update` vs `tx.update`) | Confirmed Open |
| **SEC-2026-02** | **P1** | Business Logic / Data Integrity | `routes/auction.ts:2268-2355` | Manual-Sell Squad Capacity & Available Status Bypass | Confirmed Open |
| **SEC-2026-03** | **P1** | Business Logic / Data Integrity | `routes/auction.ts:2357-2363` & `3264-3299` | ₹0 Manual Sale Bypasses `bidsTable` and Corrupts Undo Stack | Confirmed Open |
| **SEC-2026-04** | **P1** | Authorization / Authentication | `routes/players.ts:906-1050` | Unauthenticated Player Profile Overwrite via Public Registration Link | Confirmed Open |
| **SEC-2026-05** | **P1** | Authorization / Multi-Tenancy | `lib/scorer-auth.ts:754-764` | Zero-Assignment Scorer Authorization Bypass (Global Cross-Tenant Scorer Access) | Confirmed Open |
| **SEC-2026-06** | **P2** | Concurrency / Data Integrity | `lib/badminton-service.ts:510` & `orchestrator.ts:738` | Badminton Scoring Lease Fencing TOCTOU Gap (Missing In-Transaction Row Lock) | Confirmed Open |
| **SEC-2026-07** | **P2** | Concurrency / Race Condition | `routes/auction.ts:2485-2530` | Auction Unsold Mutation Lacks Optimistic Concurrency / CAS Revision Check | Confirmed Open |
| **SEC-2026-08** | **P2** | Architecture / Identity | `schema/members.ts`, `schema/organizers.ts`, `routes/auth.ts` | Dual Identity Architecture & Incomplete Canonical Member Cutover | Architectural Debt |
| **SEC-2026-09** | **P3** | Database / Hygiene | `schema/scoring_dls_calculations.ts`, `migrations/0001` | Abandoned `scoring_dls_calculations` Schema Table | Technical Debt |
| **SEC-2026-10** | **P3** | Test Suite / Reliability | `tests/phase3-2-final-security-gate.test.ts`, `player-specs` | Test Suite Flakiness on Inbound WhatsApp Deduplication & Dual-Write Timeout | Low / Maintenance |

---

## 2. Detailed Vulnerability Dossiers

### Finding SEC-2026-01: Auction Bid Advisory Lock Transaction Detachment
- **Severity:** P1 (High / Financial & Concurrency Integrity)
- **Component:** Auction Engine — Bid Mutation
- **Primary Location:** `artifacts/api-server/src/routes/auction.ts#L1898-L1918`
- **Impact:** Lost bid updates, broken transactional atomicity, race conditions under high-frequency live bidding.
- **Description:**  
  In `POST /tournaments/:tournamentId/auction/bid`, the handler opens a transaction:
  ```typescript
  const updatedSession = await db.transaction(async (tx) => {
    await lockAuctionMutation(tx, tid);
    const [row] = await db
      .update(auctionSessionsTable)
      .set({
        currentBid: nextBid,
        currentBidTeamId: teamId,
        timerEndsAt: newTimerEndsAt,
        ...
      })
  ```
  Notice that while `lockAuctionMutation(tx, tid)` executes on the transactional client `tx` (acquiring an advisory xact lock on the connection), line 1900 executes `db.update(auctionSessionsTable)` against the global connection pool `db` instead of `tx`.
- **Root Cause:** A typo calling `db.update` instead of `tx.update` inside `db.transaction(async (tx) => { ... })`.
- **Exploitation / Failure Scenario:** The mutation executes on a separate pool connection that does NOT hold the advisory lock. As a result, PostgreSQL transaction isolation is broken for the auction session update, allowing racing concurrent requests to mutate `auctionSessionsTable` out of order or bypass the lock.
- **Recommended Remediation:** Replace `db.update(auctionSessionsTable)` with `tx.update(auctionSessionsTable)`.

---

### Finding SEC-2026-02: Manual-Sell Squad Capacity & Available Status Bypass
- **Severity:** P1 (High / Data Integrity & Business Rules)
- **Component:** Auction Engine — Manual Sell Route
- **Primary Location:** `artifacts/api-server/src/routes/auction.ts#L2268-L2355`
- **Impact:** Overcrowded rosters exceeding tournament `maximumSquadSize`, category player limit violations, and accidental/malicious overwrite of already-sold players.
- **Description:**  
  In `POST /tournaments/:tournamentId/auction/manual-sell`:
  1. The handler calculates purse protection if `amount > 0`, but does NOT validate `maximumSquadSize` or category limits.
  2. In the database update (line 2354):
     ```typescript
     await tx
       .update(playersTable)
       .set({ status: "sold", teamId, soldPrice: amount })
       .where(eq(playersTable.id, playerId));
     ```
     The query omits `and(eq(playersTable.status, "available"))`.
- **Root Cause:** Incomplete validation logic in manual operator override path.
- **Exploitation / Failure Scenario:**  
  1. A team that has already purchased its maximum squad limit (e.g. 15 players) can be assigned a 16th player without error.
  2. If an operator selects a player who was already marked as `sold` or `retained` in a previous lot, `manual-sell` will force-reassign that player to a different team without checking prior status.
- **Recommended Remediation:**  
  1. Check team squad count against `tournament.maximumSquadSize` and category limits before executing sale.
  2. Add `eq(playersTable.status, "available")` to the `playersTable` update condition, or require an explicit `overrideExistingStatus: true` parameter in `req.body`.

---

### Finding SEC-2026-03: ₹0 Manual Sale Bypasses `bidsTable` and Corrupts Undo Stack
- **Severity:** P1 (High / Data Integrity & Financial Records)
- **Component:** Auction Engine — Manual Sell & Undo Lifecycles
- **Primary Location:**  
  - Manual Sell: `artifacts/api-server/src/routes/auction.ts#L2357-L2363`  
  - Undo: `artifacts/api-server/src/routes/auction.ts#L3264-L3299`
- **Impact:** The `undo` operation undoes the wrong player, reverting an earlier valid sale and permanently de-syncing tournament financial and squad state.
- **Description:**  
  In `manual-sell`, line 2357 gates bid record creation:
  ```typescript
  if (amount > 0) {
    await tx
      .update(teamsTable)
      .set({ purseUsed: sql`COALESCE(purse_used, 0) + ${amount}` })
      .where(eq(teamsTable.id, teamId));
    await tx.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount });
  }
  ```
  When `amount === 0` (allowed by schema `z.number().int().min(0)`):
  - No row is inserted into `bidsTable`.
  - When the operator subsequently clicks "Undo", `POST /auction/undo` queries:
    ```typescript
    const lastBid = await db
      .select()
      .from(bidsTable)
      .where(eq(bidsTable.tournamentId, tid))
      .orderBy(desc(bidsTable.timestamp))
      .limit(1);
    ```
  - It fetches the bid for the PREVIOUS player who was sold for > ₹0.
  - It marks that previous player as `available`, restores their purse, and leaves the ₹0 player sold to their team!
- **Root Cause:** Asymmetric handling of `bidsTable` writes on ₹0 transactions while relying exclusively on `bidsTable` to drive the auction undo stack.
- **Recommended Remediation:**  
  Always insert a transaction record into `bidsTable` (with `amount: 0`), or maintain a dedicated `auction_sales_log` that records every player transition (`sold`, `unsold`, `retained`) regardless of purse amount.

---

### Finding SEC-2026-04: Unauthenticated Player Profile Overwrite via Public Registration Link
- **Severity:** P1 (High / Authentication & Authorization Bypass)
- **Component:** Player Registration Endpoint
- **Primary Location:** `artifacts/api-server/src/routes/players.ts#L906-L1050`
- **Impact:** Unauthenticated third parties can overwrite registered players' profiles, categories, photos, and custom registration questionnaire answers.
- **Description:**  
  In `POST /register/:code`:
  When a public user submits the registration form with a mobile number that is already registered in the tournament (`findDuplicatePlayerMobile(tid, mobileNumber)`), the server treats this as an update to the existing record.
  It updates the player row in `playersTable` directly:
  - If registration is closed and `profileUpdatesAllowed` is true: updates photo and role.
  - If registration is open: updates name, role, specifications, categoryId, photo, and custom answers.
  At NO POINT does the handler require an OTP verification, session token, or access code.
- **Root Cause:** Presumption of user authenticity based purely on knowledge of the 10-digit mobile number on public registration links.
- **Exploitation / Failure Scenario:** An attacker or disgruntled competitor who knows a registered player's phone number can submit `POST /register/:code` with that phone number and maliciously replace their photo, role, and answers.
- **Recommended Remediation:**  
  If `existingDup` is detected during public registration, require mobile OTP verification before applying any updates to an existing player profile.

---

### Finding SEC-2026-05: Zero-Assignment Scorer Authorization Bypass (Global Cross-Tenant Scorer Access)
- **Severity:** P1 (High / Multi-Tenant Isolation & Authorization)
- **Component:** Scorer Authorization Guard
- **Primary Location:** `artifacts/api-server/src/lib/scorer-auth.ts#L754-L764`
- **Impact:** Scorer accounts from ANY tournament on the platform can take over and score matches in unassigned tournaments, as well as trigger live OBS director overlays.
- **Description:**  
  In `assertScorerMayAccessTournament`:
  ```typescript
  export async function assertScorerMayAccessTournament(
    scorerId: number,
    tournamentId: number,
  ): Promise<void> {
    const assignedCount = await countScorerAssignmentsForTournament(tournamentId);
    if (assignedCount === 0) return;
    const ok = await isScorerAssignedToTournament(scorerId, tournamentId);
    if (!ok) {
      throw new ScorerAuthError("You are not assigned to this tournament", ...);
    }
  }
  ```
  If an organizer creates a tournament and has not explicitly added a scorer to `scorer_tournament_assignments` (i.e. `assignedCount === 0`), the check returns immediately without validating whether the scorer has any relationship to this tournament.
- **Root Cause:** A legacy "open rollout" backward-compatibility bypass that was never closed.
- **Exploitation / Failure Scenario:** Any registered scorer on the BidWar platform can authenticate to their own account, call `POST /tournaments/:targetId/scoring/matches/:matchId/lock` or `POST /tournaments/:targetId/scoring/obs-director`, and take over match scoring or inject OBS overlays into another tenant's live broadcast.
- **Recommended Remediation:**  
  Eliminate the `assignedCount === 0` open-access fallback. Require explicit tournament scorer assignment or tournament organizer credentials for all scoring mutations.

---

### Finding SEC-2026-06: Badminton Scoring Lease Fencing TOCTOU Gap (Missing In-Transaction Row Lock)
- **Severity:** P2 (Medium / Concurrency & Scorer Fencing)
- **Component:** Badminton Scoring Engine & Platform Event Store
- **Primary Location:**  
  - `artifacts/api-server/src/lib/badminton-service.ts#L510`  
  - `artifacts/api-server/src/lib/scoring-platform/orchestrator.ts#L738`
- **Impact:** Stale or superseded scorers can commit scoring event batches during lock takeover windows.
- **Description:**  
  In Cricket scoring, `orchestrator.ts:465` performs strict transactional lease fencing:
  ```typescript
  if (input.lease) {
    await assertAuthoritativeScorerLease(tx, { matchId, scorerId, sessionId, ... });
  }
  ```
  which executes `SELECT ... FROM scorer_match_locks WHERE match_id = ... FOR UPDATE`.  
  In Badminton scoring, the route checks `assertSessionOwnsMatchLock` outside the transaction, and then invokes `appendMatchEventBatch`. `appendMatchEventBatch` does not accept `lease`, does not take a `FOR UPDATE` lock on `scorer_match_locks`, and relies solely on the unique sequence constraint `23505`.
- **Root Cause:** Sport adapter inconsistency between Cricket orchestrator and Badminton command batch pipeline.
- **Recommended Remediation:**  
  Pass `lease` into `appendMatchEventBatch` and enforce `assertAuthoritativeScorerLease(tx, ...)` inside the batch database transaction.

---

### Finding SEC-2026-07: Auction Unsold Mutation Lacks Optimistic Concurrency / CAS Revision Check
- **Severity:** P2 (Medium / Concurrency & Race Conditions)
- **Component:** Auction Engine — Unsold Mutation
- **Primary Location:** `artifacts/api-server/src/routes/auction.ts#L2485-L2530`
- **Impact:** In-flight bids placed right as the operator clicks "Unsold" are silently dropped without conflict detection.
- **Description:**  
  `POST /tournaments/:tournamentId/auction/sell` enforces optimistic concurrency via `expectedRevision`:
  ```typescript
  if (session.revision !== expectedRevision) { ... }
  ```
  `POST /tournaments/:tournamentId/auction/unsold` does not accept `expectedRevision` in its request body and performs no CAS check on `session.revision` or `session.currentBid`.
- **Root Cause:** Asymmetric endpoint parameter design between `/sell` and `/unsold`.
- **Recommended Remediation:**  
  Require `expectedRevision` in `/unsold` body and verify `session.currentBid === null` within the locked transaction.

---

### Finding SEC-2026-08: Dual Identity Architecture & Incomplete Canonical Member Cutover
- **Severity:** P2 (Medium / Architecture & Governance)
- **Component:** Global Identity & Multi-Role Authorization
- **Primary Location:** `lib/db/src/schema/members.ts`, `schema/organizers.ts`, `routes/auth.ts`
- **Impact:** User fragmentation, inability to revoke all sessions for a single person across roles, redundant credential tables.
- **Description:**  
  The canonical Person identity schema (`members`, `member_auth_identities`, `member_sessions`, `member_roles`, `tournament_participations`) is fully defined and tested. However, live API endpoints still authenticate against legacy siloed tables (`organizers`, `owner_sessions`, `scorer_accounts`). While `member_identity_links` and `organizer_sessions.member_id` provide bridges, single-identity convergence is incomplete.
- **Root Cause:** Phased migration where the data model has been created but live route controllers have not yet cut over to the new schema.
- **Recommended Remediation:** Complete Phase 2 identity migration: wire `member_sessions` as the universal session provider and map tournament roles dynamically through `member_roles`.

---

### Finding SEC-2026-09: Abandoned `scoring_dls_calculations` Schema Table
- **Severity:** P3 (Low / Codebase Hygiene & Technical Debt)
- **Component:** Scoring Schema
- **Primary Location:** `lib/db/src/schema/scoring_dls_calculations.ts`, `lib/db/migrations/0001_scoring_foundation.sql`
- **Impact:** Redundant table, unused schema definitions.
- **Description:**  
  The table `scoring_dls_calculations` was created in initial migration `0001` and is referenced only by delete statements in `cricket-match-repair.ts` and `scoring-service.ts`. No route or scoring pipeline writes calculations to this table.
- **Recommended Remediation:**  
  Implement the DLS calculation persistence service if DLS audits are required, or deprecate and drop the unused table.

---

### Finding SEC-2026-10: Test Suite Flakiness on Inbound WhatsApp Deduplication & Dual-Write Timeout
- **Severity:** P3 (Low / CI & Test Suite Reliability)
- **Component:** Automated Vitest Suite
- **Primary Location:**  
  - `tests/phase3-2-final-security-gate.test.ts` (Scenarios 3 and 7)  
  - `src/__tests__/player-specification-service.test.ts` (dual-write timeout)
- **Impact:** False-negative CI/CD build failures during parallel test execution.
- **Description:**  
  Full test execution runs 217 test files and 2110 tests. 215 test files pass (2107 tests pass). 3 tests fail due to:
  1. Simulated transient crash retry mock spy count expectation (`sendSpy` called 3 times vs expected 2).
  2. 5000ms test timeout in `player-specification-service.test.ts` under CPU load during parallel worker execution.
- **Recommended Remediation:**  
  Refactor test mock assertions in `phase3-2-final-security-gate.test.ts` to reset spy counts between scenarios, and increase test timeout in `player-specification-service.test.ts` to 10000ms.

---

## 3. Findings Matrix by Architectural Domain

```
+-----------------------------------+--------------------+-----------------------+
| Domain                            | High (P1)          | Medium (P2) / Low (P3)|
+-----------------------------------+--------------------+-----------------------+
| 1. Identity & Multi-Role Access   |                    | SEC-2026-08 (P2)      |
| 2. Auction Concurrency & Finance  | SEC-2026-01 (P1)   | SEC-2026-07 (P2)      |
|                                   | SEC-2026-02 (P1)   |                       |
|                                   | SEC-2026-03 (P1)   |                       |
| 3. Authorization & Tenant Boundary| SEC-2026-04 (P1)   |                       |
|                                   | SEC-2026-05 (P1)   |                       |
| 4. Scoring Integrity & Fencing    |                    | SEC-2026-06 (P2)      |
|                                   |                    | SEC-2026-09 (P3)      |
| 5. Public / OBS Display Surfaces  |                    |                       |
| 6. Database, Migrations & Ops     |                    | SEC-2026-10 (P3)      |
+-----------------------------------+--------------------+-----------------------+
```
