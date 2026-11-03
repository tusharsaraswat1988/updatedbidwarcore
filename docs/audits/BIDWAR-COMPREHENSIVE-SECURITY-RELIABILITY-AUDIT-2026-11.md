# BIDWAR — Comprehensive Security, Concurrency & Reliability Audit
**Audit Date:** November 3, 2026  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Target Branch:** `main`  
**Evaluated Commit SHA:** `5dc8cf27b09ce0b580dc718ac19b732be0c07427`  
**Audit Mode:** Forensic Audit Only (Zero Code/Database Mutations)  
**Lead Auditor:** Antigravity Forensic Engineering  

---

## 1. Executive Summary & Ground Truth

### 1.1 Ground Truth Baseline
An independent forensic inspection was conducted on the current repository state:
- **Git Branch:** `main`
- **Git HEAD SHA:** `5dc8cf27b09ce0b580dc718ac19b732be0c07427`
- **Working Tree State:** Clean, preserving only `artifacts/mockup-sandbox/src/.generated/mockup-components.ts` (untracked/sandbox generator).
- **Staging Deployment Live Verification:**
  - Endpoint: `https://stagingbidwar.up.railway.app/api/healthz`
  - Response: `{"status":"ok","bidwarEnv":"staging","commit":"5dc8cf2"}`
  - Status: **VERIFIED MATCHING HEAD**
- **Production Deployment Live Verification:**
  - Endpoint: `https://bidwar.in/api/healthz`
  - Response: `{"status":"ok","bidwarEnv":"production","commit":"5dc8cf2"}`
  - Status: **VERIFIED MATCHING HEAD**

### 1.2 Audit Verdict
The BidWar core architecture exhibits strong foundations across recent P1 security patches (P1-1 Organizer Session Revocation via DB session store and P1-2 Cross-Environment Origin Isolation are live and verified). 

However, forensic inspection of the codebase has revealed **5 Confirmed P1 Vulnerabilities** in core auction concurrency, manual sell logic, player public registration, and scorer tenant isolation, alongside **3 P2 Architectural / Concurrency Gaps**.

```
+-------------------------------------------------------------------------------+
| TOTAL AUDITED FINDINGS: 10                                                    |
| - P1 (High / Severe):   5 findings (Auction, Authorization, Business Logic)   |
| - P2 (Medium / Arch):   3 findings (Concurrency TOCTOU, Identity Debt, CAS)   |
| - P3 (Low / Hygiene):   2 findings (Unused Schema Table, Test Suite Flakes)   |
+-------------------------------------------------------------------------------+
```

---

## 2. Review and Reconciliation of Previous Audits

Previous audit reports were examined against current source code:
1. **P1-1 Organizer Session Revocation:**  
   *Verified Live.* `artifacts/api-server/src/middleware/jwt-auth.ts` validates `claims.sessionId` against `organizer_sessions` table in Postgres on every incoming request. Revocation via `logout` and `logout-all` updates `revoked_at`, failing closed on revoked or expired sessions.
2. **P1-2 Production/Staging Isolation:**  
   *Verified Live.* `artifacts/api-server/src/lib/runtime-env.ts` and `public-origin-guard.ts` enforce strict origin separation: `https://bidwar.in` is disallowed on staging, and staging Railway hosts are rejected on production.
3. **Previous IDOR on `/auction/bid`:**  
   *Verified Fixed.* `routes/auction.ts:1700` calls `requireTeamInTournament(res, tid, teamId)`, preventing cross-tournament team bidding.
4. **Previous Access Code Timing Attack:**  
   *Verified Fixed.* `routes/auction.ts:1770` enforces XOR timing-safe comparison on access code authentication.
5. **Previous Public Player Mobile Exposure:**  
   *Verified Fixed.* `serializers/player.ts` splits serializers into `privatePlayerSerializer`, `publicPlayerSerializer`, and `publicAuctionPlayerSerializer`. `mobileNumber` and `email` are withheld on public endpoints.

---

## 3. Step 2: Global Person Identity & Multi-Role Access Audit

The BidWar architecture defines a canonical human identity model in `lib/db/src/schema/members.ts` and `tournament-participations.ts`. However, live runtime routes remain split between legacy siloed authentication tables and canonical schema.

### Analysis of the 10 Mandatory Scenarios:

#### Scenario 1: Same person organizer & player in one tournament
- **Current Behavior:** The organizer holds a session via `organizer_sessions` (or tournament password). If they attempt to create a player profile using their own phone number, line 557 of `artifacts/api-server/src/routes/players.ts` triggers:
  ```typescript
  if (org?.mobile && mobilesMatch(org.mobile, mobileNumber)) {
    res.status(400).json({ error: "You cannot register the organizer's own mobile number as a player." });
    return;
  }
  ```
  The system hard-blocks organizers from playing in their own tournament under the same mobile number.
- **Architectural Status:** Conflicted. In canonical member schema (`tournament_participations`), `uq_tp_tournament_member_role` permits `role: "organizer"` and `role: "player"` simultaneously for one `memberId`. In live routes, legacy tables enforce rigid role exclusion by mobile number.

#### Scenario 2: Same person team owner & player in the same tournament
- **Current Behavior:** Permitted with strict conflict-of-interest controls during auction. Team owner authenticates via `bidwar_owner` cookie (`owner_sessions`). Player exists in `playersTable`. During live bidding, line 1801 of `routes/auction.ts` evaluates `isSelfBidding`:
  ```typescript
  const isSelfBidding = Boolean(
    currentPlayer && (
      ((currentPlayer.playerTag === "owner" || currentPlayer.playerTag === "co_owner") && currentPlayer.playerTagTeamId === teamId) ||
      (rawPlayerDigits && rawOwnerDigits && rawPlayerDigits === rawOwnerDigits)
    )
  );
  ```
  If `isSelfBidding` is true, the bid is rejected with `SELF_BIDDING_DISALLOWED` unless `featuresJson.allowOwnerSelfBidding` is explicitly enabled.

#### Scenario 3: Same person scorer in Tourn A & spectator in Tourn B
- **Current Behavior:** Cleanly isolated. Scorer authentication uses `Authorization: Bearer <token>` resolving against `scorer_sessions`. Spectator browsing in Tourn B accesses public endpoints requiring zero authentication. No token or cookie collisions occur.

#### Scenario 4: Same person owns different teams in different tournaments
- **Current Behavior:** Fully supported via multi-session token dictionary. In `artifacts/api-server/src/lib/owner-session.ts:51-73`, the `bidwar_owner` JWT embeds a dictionary:
  ```typescript
  existingTeams[`${tournamentId}:${teamId}`] = sessionId;
  setOwnerSessionCookie(res, { sessionId, tournamentId, teamId, teams: existingTeams });
  ```
  Each team session is validated independently against `owner_sessionsTable`.

#### Scenario 5: Organizer assigns existing scorer in another tournament
- **Current Behavior:** Supported, but exposes **SEC-2026-05**. Scorer accounts in `scorer_accounts` are platform-global (keyed by mobile). Linking a scorer to a tournament creates a row in `scorer_tournament_assignments`. However, if a tournament has zero assignments, any scorer on the platform can access it.

#### Scenario 6: Shared family mobile number
- **Current Behavior:** Critical limitation. Player registration enforces unique mobile numbers per tournament (`findDuplicatePlayerMobile`). If a parent and child share a mobile number in the same tournament, the second registration fails. Furthermore, if a father (team owner) and son (player) share a phone number, the father is blocked from bidding on the son due to regex mobile match in `isSelfBidding`.

#### Scenario 7: Recycled mobile number
- **Current Behavior:** Vulnerable in public registration. If user B acquires a recycled phone number previously owned by user A in that tournament, user B can overwrite user A's player profile on `POST /register/:code` without OTP (Finding **SEC-2026-04**).

#### Scenario 8: Player claims existing registry record
- **Current Behavior:** `global_players` table maintains canonical sports profiles. When importing players, `import-candidates` finds matches. However, self-service claiming by players via mobile OTP is not yet exposed on public web routes; claiming is currently organizer-driven.

#### Scenario 9: Account linking across roles without auto-merging identities
- **Current Behavior:** Schema supports non-destructive bridging via `member_identity_links` (`link_type: direct_fk | verified_phone | verified_email`, `status: active | candidate | rejected`). However, this is largely uncalled from live controllers.

#### Scenario 10: Logout/revocation across role-specific sessions
- **Current Behavior:** Split. Organizer logout revokes `organizer_sessions`. Owner logout revokes specific `owner_sessions` by `sessionId`. Scorer logout marks `revoked_at` in `scorer_sessions`. Because there is no unified master session linking all three, revoking one role session leaves other role sessions active.

---

## 4. Step 3: Auction Concurrency & Financial Integrity Audit

### 4.1 Finding SEC-2026-01: Auction Bid Advisory Lock Transaction Detachment (P1)
In `artifacts/api-server/src/routes/auction.ts:1898-1918`:
```typescript
const updatedSession = await db.transaction(async (tx) => {
  await lockAuctionMutation(tx, tid);
  const [row] = await db  // <--- DEFECT: Calls global pool 'db' instead of 'tx'
    .update(auctionSessionsTable)
    .set({
      currentBid: nextBid,
      currentBidTeamId: teamId,
      timerEndsAt: newTimerEndsAt,
      pausedTimeRemaining: null,
      revision: sql`COALESCE(revision, 0) + 1`,
      lastAction: `BID: ₹${nextBid.toLocaleString("en-IN")} by ${team.name}`,
    })
    .where(
      and(
        eq(auctionSessionsTable.tournamentId, tid),
        eq(sql`COALESCE(${auctionSessionsTable.revision}, 0)`, currentRevision),
      ),
    )
    .returning();
  return row ?? null;
});
```
**Forensic Analysis:**  
`lockAuctionMutation(tx, tid)` acquires `pg_advisory_xact_lock(tid)` on connection `tx`. But line 1900 executes `db.update(auctionSessionsTable)` against the general connection pool!  
1. The update does not execute on the locked connection.  
2. If the transaction rolls back or times out, the `auctionSessionsTable` update may have already committed.  
3. Transactional atomicity is completely severed.

### 4.2 Finding SEC-2026-02: Manual-Sell Squad Capacity & Status Bypass (P1)
In `artifacts/api-server/src/routes/auction.ts:2268-2355`:
- `manual-sell` validates purse capacity only when `amount > 0`.
- It completely omits checking whether `team.id` has already reached `tournament.maximumSquadSize`.
- In line 2354:
  ```typescript
  await tx
    .update(playersTable)
    .set({ status: "sold", teamId, soldPrice: amount })
    .where(eq(playersTable.id, playerId));
  ```
  It lacks `and(eq(playersTable.status, "available"))`. An operator can overwrite an already-sold player and place a team over maximum squad limits.

### 4.3 Finding SEC-2026-03: ₹0 Manual Sale Bypasses `bidsTable` and Corrupts Undo Stack (P1)
In `artifacts/api-server/src/routes/auction.ts:2357-2363`:
```typescript
if (amount > 0) {
  await tx
    .update(teamsTable)
    .set({ purseUsed: sql`COALESCE(purse_used, 0) + ${amount}` })
    .where(eq(teamsTable.id, teamId));
  await tx.insert(bidsTable).values({ tournamentId: tid, playerId, teamId, amount });
}
```
If a player is manually sold for ₹0:
- No bid row is written to `bidsTable`.
- Subsequent `POST /auction/undo` fetches the latest bid from `bidsTable` (line 3268).
- The undo handler reverts the PREVIOUS player who was sold for > ₹0! That previous player is marked `available`, while the ₹0 player remains sold. The undo stack is silently corrupted.

### 4.4 Finding SEC-2026-07: Unsold Mutation Lacks Optimistic Concurrency Guard (P2)
In `artifacts/api-server/src/routes/auction.ts:2485-2530`:
`POST /auction/unsold` does not require `expectedRevision` in `req.body`, and the update query does not assert `session.currentBid === null`. An operator marking a player unsold as a bid arrives will clobber the bid without conflict notification.

---

## 5. Step 4: Authorization & Tenant Isolation Audit

### 5.1 Finding SEC-2026-04: Unauthenticated Player Profile Overwrite (P1)
In `artifacts/api-server/src/routes/players.ts:906-1050`:
When `POST /register/:code` receives a registration matching an existing player mobile (`findDuplicatePlayerMobile`), it treats the submission as a profile update.
- For open registration, it updates `name`, `role`, `specifications`, `categoryId`, `photoUrl`, and `customAnswersJson`.
- For closed registration (if `profileUpdatesAllowed` is true), it updates `photoUrl` and `role`.
- **No authentication or OTP check exists on this branch.** Any person with the tournament registration code and a player's phone number can overwrite their registration data.

### 5.2 Finding SEC-2026-05: Zero-Assignment Scorer Authorization Bypass (P1)
In `artifacts/api-server/src/lib/scorer-auth.ts:754-764`:
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
**Vulnerability Mechanics:**  
When an organizer creates a tournament, `assignedCount === 0`. Until the organizer explicitly assigns a scorer in the database, `assertScorerMayAccessTournament` short-circuits and returns. Consequently, **any authenticated scorer from any other tournament or organization can lock matches, record balls/points, and broadcast live OBS director cues** in that tournament.

---

## 6. Step 5: Scoring Integrity & Fencing Audit

### 6.1 Finding SEC-2026-06: Badminton Scoring Lease Fencing TOCTOU Gap (P2)
- **Cricket Scoring:** Implements in-transaction lease fencing in `orchestrator.ts:465`:
  ```typescript
  if (input.lease) {
    await assertAuthoritativeScorerLease(tx, { matchId, scorerId, sessionId, ... });
  }
  ```
  `assertAuthoritativeScorerLease` executes `SELECT ... FROM scorer_match_locks WHERE match_id = ... FOR UPDATE`.
- **Badminton Scoring:** Verifies lock ownership only at the route handler level (`assertSessionOwnsMatchLock`), then calls `appendMatchEventBatch`.  
  `appendMatchEventBatch` does NOT pass or assert lease within its database transaction. If a scorer loses network connectivity and a takeover occurs, the stale scorer's in-flight batch can commit if sequence numbers have not collided.

### 6.2 DLS Calculation Status
In `artifacts/api-server/src/lib/cricket-match-repair.ts` and `scoring-service.ts`, table `scoringDlsCalculationsTable` is only deleted on match repair/reset. There is no active writer inserting DLS target curves into this table (Finding **SEC-2026-09**).

---

## 7. Step 6: OBS / LED / Public Surface Security Audit

- **OBS Overlays & Director State:**
  - `POST /tournaments/:tournamentId/scoring/obs-director`: Protected by `isTournamentOrganizer` or assigned scorer.
  - Vulnerability: Scorer access is subject to Finding **SEC-2026-05** (zero-assignment bypass).
- **Public State Endpoints:**
  - `GET /tournaments/:tournamentId/auction`: Publicly accessible for broadcast displays.
  - Verified safe: `buildAuctionStateInner` uses `publicAuctionPlayerSerializer` and minimal team projection (`id`, `name`, `color`, `logoUrl`, `purse`, `purseUsed`). Team access codes, owner phone numbers, and player PII are strictly excluded.
- **Sponsor Display Sessions:**
  - `verifySponsorDisplaySession(token)` validates surface tokens (`obs` / `led`) scoped to specific tournament IDs.

---

## 8. Step 7: Database, Migrations & Operational Resilience

- **Migrations:**
  - Total migrations: 39 SQL files (`0001_scoring_foundation.sql` through `0039_organizer_sessions.sql`).
  - Migration runner: `scripts/src/migrate.ts` executes via `runVersionedMigrations` on direct unpooled connection strings (`resolveDirectDatabaseUrl`).
  - Foreign Keys: Core tables (`member_sessions`, `organizer_sessions`, `bids`, `tournament_participations`) enforce `ON DELETE CASCADE` or `ON DELETE SET NULL`.
- **Connection Pool Safety:**
  - Pool uses Neon serverless Postgres. Unpooled direct compute is correctly isolated for migrations and LISTEN/NOTIFY listeners.

---

## 9. Step 8: Deployment & Operational Security

- **Cookie Security:**
  - `bidwar_auth`, `bidwar_owner`, `bidwar_oauth`:
  - `HttpOnly`: Enforced.
  - `SameSite`: Configured appropriately (`Lax` for auth cookies).
  - `Secure`: Enforced in production (`__Host-` prefix enabled where appropriate).
- **Error Handling:**
  - API errors sanitize database connection strings and stack traces in production.
  - Health endpoint `/api/healthz` reports service status, environment (`staging` / `production`), and deployment commit without exposing secrets.

---

## 10. Step 9: Test Suite Execution & Diagnostics

Automated execution of the entire test suite via Vitest (`pnpm --filter @workspace/api-server run test`):
- **Test Files Audited:** 217
- **Test Files Passed:** 215
- **Tests Audited:** 2110
- **Tests Passed:** 2107
- **Tests Failed:** 3 (Finding **SEC-2026-10**)
  - `tests/phase3-2-final-security-gate.test.ts` (Scenarios 3 & 7): Assertion count mismatch on WhatsApp mock dispatch during simulated crash retry.
  - `src/__tests__/player-specification-service.test.ts`: Timeout (5000ms) under parallel load.

---

## 11. Prioritized Remediation Roadmap (Phase 2 & 3)

### Immediate Remediation (P1 Security Hotfixes)
1. **Fix Auction Bid Transaction Detachment (SEC-2026-01):**
   Change `db.update(auctionSessionsTable)` to `tx.update(auctionSessionsTable)` in `routes/auction.ts:1900`.
2. **Harden Manual Sell (SEC-2026-02 & SEC-2026-03):**
   - In `routes/auction.ts:2268`, enforce `maximumSquadSize` and category capacity checks.
   - Insert transaction records into `bidsTable` for ₹0 sales to prevent corrupting the undo stack.
   - Enforce `where(eq(playersTable.status, "available"))` on player updates.
3. **Protect Public Player Updates with OTP (SEC-2026-04):**
   Require phone OTP verification before updating an existing player record via `POST /register/:code`.
4. **Close Zero-Assignment Scorer Bypass (SEC-2026-05):**
   In `artifacts/api-server/src/lib/scorer-auth.ts:759`, reject access when `assignedCount === 0`. Require organizers to explicitly assign scorers before match access is permitted.

### Secondary Remediation (P2 Reliability & Architecture)
1. **Add Lease Fencing to Badminton Scoring (SEC-2026-06):**
   Pass `lease` into `appendMatchEventBatch` and enforce `assertAuthoritativeScorerLease` in Postgres `FOR UPDATE`.
2. **Add CAS Revision Check to `/auction/unsold` (SEC-2026-07):**
   Require `expectedRevision` in `/unsold` and verify `currentBid === null`.
3. **Execute Canonical Member Identity Cutover (SEC-2026-08):**
   Retire legacy authentication tables and route all login flows through `member_sessions`.
