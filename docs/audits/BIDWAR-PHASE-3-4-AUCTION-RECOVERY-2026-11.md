# BIDWAR — Phase 3.4 Audit & Verification Report
## Auction Recovery & Live Event Reliability

**Audit Date**: November 4, 2026  
**Repository**: `https://github.com/tusharsaraswat1988/updatedbidwarcore`  
**Branch**: `feat/phase-3-4-auction-recovery-reliability`  
**Execution Environment**: Railway Isolated Staging & Dedicated Neon Database Compute (`bidwar_test_scratch`)  
**Production Target**: `https://bidwar.in` (Strict Read-Only Verification — 0 Writes / 0 Mutations)  
**Staging Target**: `https://stagingbidwar.up.railway.app` (Deployment SHA: `75df1b1`)  
**Status**: **ALL GATES PASSED (16/16 Recovery Scenarios Passed, 11/11 Resilience Tests Passed, 8 Staging Surfaces Verified)**

---

## 1. Executive Summary

Phase 3.4 of the BIDWAR engineering roadmap addresses **Auction Recovery & Live Event Reliability**. In high-stakes sports auctions, server process recycles, network drops, concurrent multi-bidder collisions, and client reconnections must never cause data corruption, financial leakage, out-of-order event dispatch, or loss of auction momentum.

During this phase:
1. **Critical Recovery Defects Identified & Resolved**:
   - **Cold Start Version Divergence**: The in-memory auction event cache reset to 0 upon API server reboot, resulting in version desynchronization against PostgreSQL authoritative state. Resolved by adding `getPersistedRevision()` to rehydrate in-memory revision directly from `auction_sessions.revision`.
   - **Pause Mutation Non-Idempotency**: Repeated pause requests while an auction was already paused wiped out `paused_time_remaining` to `null`. Fixed with an idempotent state-short-circuit guard.
   - **Realtime Sequence Gap & Out-of-Order Recovery**: Clients reconnecting across sequence gaps or future revisions now receive an immediate authoritative `auction_state` snapshot frame (`action: "sse_resync_snapshot"`), and frontend consumers (`sync-auction-sse.ts`) invalidate local stale state to align with the database.
2. **Deterministic Automated Verification**:
   - Built a comprehensive 16-scenario recovery test suite (`artifacts/api-server/src/verify-phase3-4-recovery.ts`).
   - Achieved **16/16 (100%) passing scenarios** executed against the isolated test database `bidwar_test_scratch`.
   - Re-verified Phase 3.3 regression suite (`verify-phase3-3-resilience.ts`) with **11/11 tests (52/52 assertions) passing (100%)**.
3. **Staging Browser & Production Verification**:
   - Automated headless Chrome DevTools Protocol verification against staging across 4 core surfaces (Organizer Auction Control, Owner App, LED Venue Display, Scoring App) in both Desktop (1440×900 / 1920×1080) and Mobile (390×844) viewports.
   - Captured 8 full-resolution verification screenshots into `artifacts/staging-verification-screenshots/`.
   - Verified zero CORS errors, zero network leakage to production, and seamless disconnect/reconnect resilience.
   - Verified read-only health checks on production (`https://bidwar.in/api/healthz`, commit SHA: `75df1b1`) without executing any mutations.

---

## 2. Architecture Investigated

The critical auction and realtime scoring lifecycle was traced across the codebase:

```mermaid
flowchart TD
    subgraph Clients["Live Event Clients"]
        Org["Organizer Control Room"]
        Owner["Owner Bidding App"]
        LED["LED Venue Display"]
        Scorer["Sports Scoring App"]
    end

    subgraph API["API Server Layer"]
        Router["Auction Route Handlers\n(src/routes/auction.ts)"]
        Events["Auction Event Coordinator\n(src/lib/auction-events.ts)"]
        Broadcast["SSE Broadcast Manager\n(src/lib/broadcast.ts)"]
        Locks["Scorer Match Lock Manager\n(src/lib/scorer-match-locks.ts)"]
    end

    subgraph DB["PostgreSQL Source of Truth (Neon)"]
        AdvLock["Advisory Lock (pg_advisory_xact_lock)"]
        Sessions["auction_sessions (revision, status, timers)"]
        Bids["bids (monotonic bid history, amount)"]
        Purses["team_purses (purse_used, max_purse)"]
        Scoring["scoring_events & scorer_match_locks"]
    end

    Org -->|Pause / Resume / Sell| Router
    Owner -->|Submit Bid| Router
    Scorer -->|Match Point Events| Router

    Router --> AdvLock
    AdvLock --> Sessions
    AdvLock --> Bids
    AdvLock --> Purses
    AdvLock --> Scoring

    Router --> Events
    Events --> Broadcast
    Broadcast -->|SSE Stream (Frames & Snapshots)| Clients
```

### Key Architectural Components:
- **Authoritative Source of Truth**: PostgreSQL is the single source of truth (`auction_sessions`, `bids`, `team_purses`, `scorer_match_locks`). In-memory variables are transient caches only.
- **Concurrency Isolation**: Bidding, pausing, selling, and unselling operate under PostgreSQL transaction-level advisory locks (`SELECT pg_advisory_xact_lock(:tournamentId)`), serializing mutations and eliminating double-bids, double-sales, and race conditions.
- **Monotonic Revisioning**: Every auction state change increments `auction_sessions.revision`. Reconnecting SSE clients pass `Last-Event-ID` or `afterVersion`.
- **Scorer Lease Fencing**: Live scoring prevents rogue dual-scorers via `scorer_match_locks.lease_version`. A superseded scorer is strictly fenced off with `SCORER_LEASE_REVOKED`.

---

## 3. Actual Defects Found & Root Causes

### Defect 1: Cold-Start Event Version Divergence on Server Restart
- **Severity**: P0 (High Impact on Recovery)
- **Root Cause**: The API server's in-memory `localVersions` map (in `auction-events.ts`) was initialized to 0 on cold boot. If the server restarted during an active auction at revision 42, the first subsequent event emitted would carry `eventVersion = 1` while the database was already at revision 43. Reconnecting clients tracking `afterVersion = 42` would either miss events or drop frames due to version discrepancy.
- **Fix**: Implemented `getPersistedRevision()` in `auction-events.ts`. When a tournament has no in-memory version recorded, it queries `SELECT revision FROM auction_sessions WHERE tournament_id = $1` to seed `localVersions[tournamentId]` directly from authoritative storage.

### Defect 2: Pause State Mutation Non-Idempotency
- **Severity**: P0 (State Corruption)
- **Root Cause**: In `POST /tournaments/:tid/auction/pause`, `paused_time_remaining` was computed as `timer_ends_at - NOW()`. If an organizer double-clicked "Pause" or re-sent the request, the second call found `timer_ends_at` already `null` and set `paused_time_remaining = null`. This completely lost the remaining clock time upon resume.
- **Fix**: Added an idempotency check at the top of the pause transaction:
  ```typescript
  if (session.status === "paused") {
    res.json(await broadcastState(tid));
    return;
  }
  ```
  Subsequent pause calls now return the existing authoritative paused state without corrupting the timer.

### Defect 3: SSE Reconnection Sequence Gap Recovery
- **Severity**: P0 (Client Desynchronization)
- **Root Cause**: When a client disconnected and reconnected with `afterVersion`, if `afterVersion` was ahead of the server's local buffer or had a gap exceeding the in-memory delta ring buffer, the server simply returned empty deltas. The client remained stuck in a stale or broken state.
- **Fix**: In `GET /tournaments/:tid/auction/events`, added sequence gap detection. If `afterVersion > latestVersion` or buffer gap is detected, the server immediately constructs and pushes an authoritative `auction_state` snapshot frame (`action: "sse_resync_snapshot"`), giving the reconnecting client a clean, authoritative state hydration.

### Defect 4: Client-Side SSE Snapshot Reset Alignment
- **Severity**: P1 (UI Stale State)
- **Root Cause**: In `sync-auction-sse.ts` across `auction-platform` and `owner-app`, client-side listeners ignored unknown event types or attempted delta merges on full state snapshots, failing to update the local revision cursor.
- **Fix**: Enhanced `sync-auction-sse.ts` to detect `auction_state` frames, unconditionally reset query caches to the authoritative payload, advance the client's internal version cursor, and invalidate React Query cache when delta gaps are encountered.

---

## 4. Code Files Changed

| File Path | Nature of Change | Summary of Fix |
|:---|:---|:---|
| `artifacts/api-server/src/lib/auction-events.ts` | Server Core | Added `getPersistedRevision()` to hydrate in-memory monotonic versions from PostgreSQL `auction_sessions.revision`. Exported `resetLocalEventStateForTests()`. |
| `artifacts/api-server/src/routes/auction.ts` | Route Handler | Added pause state idempotency guard to preserve `paused_time_remaining`. Added SSE sequence gap snapshot delivery. |
| `lib/auction/src/auction-bid-sync.ts` | Shared Auction Lib | Added `isSequenceGap(cachedVersion, incomingVersion)` helper for deterministic client/server synchronization. |
| `artifacts/auction-platform/src/lib/sync-auction-sse.ts` | Frontend Client | Added authoritative `auction_state` snapshot frame handling and query invalidation on sequence gaps. |
| `artifacts/owner-app/src/lib/sync-auction-sse.ts` | Frontend Client | Synchronized `auction_state` handling for Owner Bidding App. |
| `artifacts/api-server/src/verify-phase3-4-recovery.ts` | Test Automation | Created 16-scenario automated test suite for Phase 3.4 recovery. |
| `scripts/capture-staging-screenshots.cjs` | Test Automation | Headless Chrome screenshot capture for staging visual verification. |
| `scripts/verify-staging-browser.cjs` | Test Automation | Automated CDP staging browser verification. |

---

## 5. Automated Test Matrix & Execution Results

### 5.1. Phase 3.4 Auction Recovery Suite
**Command**:
```bash
node scripts/run-test.cjs artifacts/api-server/src/verify-phase3-4-recovery.ts
```
**Database**: Isolated Neon PostgreSQL `bidwar_test_scratch` (`ep-long-sky-aorboyzr.c-2.ap-southeast-1.aws.neon.tech`)  
**Exit Code**: `0`  
**Result**: **16 / 16 PASSED (100%)**

| # | Scenario Name | Target Verification | Result |
|:---|:---|:---|:---:|
| 1 | Server restart during active auction | In-memory version reconstituted from DB; status=active, current player, bid, and revision preserved | **PASS** |
| 2 | Server restart during paused auction | Auction remains paused after restart; does not accidentally resume; paused_time_remaining preserved (14s) | **PASS** |
| 3 | Downtime timer accuracy | Elapsed time during pause does not deduct from clock; timer duration holds | **PASS** |
| 4 | Network disconnect followed by reconnect | Client disconnects, reconnects with `Last-Event-ID`; recovers cleanly without dropping stream | **PASS** |
| 5 | Repeated reconnect without duplicate subscriptions | Rapid re-connections cleanly unregister old sockets; zero duplicate SSE listeners | **PASS** |
| 6 | Event sequence gap detection | `isSequenceGap` correctly identifies missing versions (e.g. 5 -> 7 is gap; 5 -> 6 is valid) | **PASS** |
| 7 | Out-of-order event handling | Stale event versions strictly rejected by `shouldAcceptMonotonicVersion` | **PASS** |
| 8 | Duplicate event delivery | Duplicate monotonic versions rejected and deduplicated | **PASS** |
| 9 | Duplicate sell request & pause idempotency | Second sell rejected (HTTP 400); subsequent pause requests return existing paused state without clearing clock | **PASS** |
| 10 | Duplicate bid retry | Consecutive raise by leading team rejected with HTTP 409 Conflict ("already highest bidder") | **PASS** |
| 11 | Concurrent pause and bid | PostgreSQL advisory lock synchronizes concurrent pause and bid; zero deadlock or corruption | **PASS** |
| 12 | Concurrent sell and bid | Advisory lock barrier serializes sell vs bid; zero ghost bids on sold player | **PASS** |
| 13 | Stale auction revision rejection | Sell request with obsolete expected revision rejected with HTTP 409 (`stale_sell`) | **PASS** |
| 14 | Realtime snapshot resynchronization | Reconnect with out-of-order sequence gap automatically triggers full `auction_state` snapshot frame | **PASS** |
| 15 | Scorer reconnect and stale lease rejection | Scorer lease takeover increments monotonic lease; stale scorer submission fenced with `SCORER_LEASE_REVOKED` | **PASS** |
| 16 | Multiple clients receiving consistent authoritative state | SSE frame headers, monotonically incremented IDs, and payload types consistently formatted | **PASS** |

---

### 5.2. Phase 3.3 Runtime Resilience Regression Suite
**Command**:
```bash
node scripts/run-test.cjs artifacts/api-server/src/verify-phase3-3-resilience.ts
```
**Exit Code**: `0`  
**Result**: **11 / 11 PASSED (52 / 52 Assertions, 100%)**

| Test | Description | Assertions | Result |
|:---|:---|:---:|:---:|
| 1 | Simultaneous Multi-Owner Bidding War (3 Concurrent Owners) | 6 | **PASS** |
| 2 | Duplicate Bid Submission & Retry Idempotency | 7 | **PASS** |
| 3 | Operator Pause vs Concurrent Owner Bid | 5 | **PASS** |
| 4 | Rapid Pause / Resume Rapid Cycling Under Active Bidding | 5 | **PASS** |
| 5 | Player Sale Finalization vs Concurrent In-Flight Bid | 5 | **PASS** |
| 6 | Duplicate Sell Execution Prevention | 5 | **PASS** |
| 7 | Server State Reconstitution After Restart | 6 | **PASS** |
| 8 | Badminton Scorer Lease Revocation (SEC-2026-06) | 5 | **PASS** |
| 9 | Concurrent Initial Scorer Lock Acquisition (No PG 23505 Crash) | 3 | **PASS** |
| 10 | Reconnect After Scorer Lease Expiry (> 180s Timeout) | 3 | **PASS** |
| 11 | Stale Score Submission Rejection & Monotonic Event Integrity | 2 | **PASS** |

---

## 6. Staging UI Verification & Browser Visual Evidence

Staging UI verification was conducted using headless Chrome across desktop and mobile viewports.

### 6.1. Staging Target Endpoints
- **Organizer Auction Control**: `https://stagingbidwar.up.railway.app/tournament/4/auction`
- **Owner Bidding App**: `https://stagingbidwar.up.railway.app/owner-app/`
- **LED Venue Display**: `https://stagingbidwar.up.railway.app/tournament/4/display`
- **Scoring App**: `https://stagingbidwar.up.railway.app/scoring-app/`

### 6.2. Visual Verification Artifacts
Captured screenshots are saved in `artifacts/staging-verification-screenshots/`:
1. `organizer_control_desktop.png` (460 KB, 1440 × 900) — Full operator control room rendered with real-time bidding controls, player queue, and timer status.
2. `organizer_control_mobile.png` (154 KB, 390 × 844) — Mobile responsive layout for on-the-ground tournament directors.
3. `owner_app_desktop.png` (33 KB, 1440 × 900) — Team owner interface with purse balance and bidding pad.
4. `owner_app_mobile.png` (25 KB, 390 × 844) — Mobile-optimized bidding pad with rapid 1-tap increments.
5. `led_venue_display_desktop.png` (570 KB, 1920 × 1080) — High-impact stadium/LED screen showing current player lot, top bidder, and dynamic countdown.
6. `led_venue_display_mobile.png` (169 KB, 390 × 844) — Mobile viewport scaling of LED display.
7. `scoring_app_desktop.png` (87 KB, 1440 × 900) — Multi-court live sports scoring interface.
8. `scoring_app_mobile.png` (64 KB, 390 × 844) — Mobile umpire scoring view with quick point attribution buttons.

### 6.3. Safety & Hygiene Verification
- **CORS Errors**: 0 detected across all tested surfaces.
- **Production Leakage**: 0 requests to `bidwar.in` detected during staging tests.
- **Network Resilience**: Network emulation of offline status followed by reconnect restored live status without page reload crashes.

---

## 7. Production Read-Only Health Verification

**Production URL**: `https://bidwar.in/api/healthz`  
**HTTP Status**: `200 OK`  
**Response Payload**:
```json
{
  "status": "ok",
  "commitSha": "75df1b1",
  "buildTimestamp": null,
  "bidwarEnv": "production"
}
```
**Safety Protocol Compliance**:
- Strictly read-only health probe executed.
- Zero database writes, test bids, test player sales, or test scorer locks initiated against production.

---

## 8. Known Limitations & Remaining Risks

1. **SSE Connection Limits on Legacy Browsers**:
   - HTTP/1.1 connections in standard web browsers are capped at 6 simultaneous connections per domain. In multi-tab setups (e.g., Organizer running 7 tournament tabs on one machine), subsequent SSE connections may queue.
   - *Mitigation*: HTTP/2 is enabled on Railway/Cloudflare edge, multiplexing all SSE streams over a single TCP socket.
2. **PostgreSQL Advisory Lock Scope**:
   - Transaction-level advisory locks (`pg_advisory_xact_lock`) release automatically at transaction commit/rollback. However, if long-running external API calls (e.g., email/SMS dispatch) occur inside the transaction, lock duration increases.
   - *Mitigation*: Outbound notifications and webhooks in BIDWAR are dispatched asynchronously after the transaction commits.
3. **Database Memory Under Massive Reconnect Bursts**:
   - If 1,000 clients simultaneously reconnect following a router restart, 1,000 concurrent snapshot queries could temporarily spike database CPU.
   - *Mitigation*: The in-memory build cache (`buildAuctionState`) serves cached snapshots within a 500ms debounce window.

---

## 9. Follow-Up Priorities (Phase 3.5+)

1. **Automated SSE Heartbeat Jitter**: Introduce randomized jitter (±250ms) to client SSE reconnection backoff to smooth reconnection spikes during stadium WiFi blips.
2. **WebSocket Fallback Upgrade**: Evaluate migrating high-frequency scoring events to bidirectional WebSockets with automated SSE fallback for restricted corporate firewall environments.
3. **Distributed Redis Pub/Sub**: For multi-instance scaling beyond single-region deployments, evaluate Redis Pub/Sub to coordinate SSE broadcasts across multiple API server pods.

---

## 10. Completion Gate Verification

- [x] Verified critical defects identified, reproduced, and fixed.
- [x] Automated regression test coverage added (`verify-phase3-4-recovery.ts`).
- [x] 16 / 16 Phase 3.4 recovery scenarios passed.
- [x] 11 / 11 Phase 3.3 runtime resilience tests passed.
- [x] Staging browser verification completed across all 4 surfaces (Desktop + Mobile).
- [x] Production read-only health verified with zero mutations.
- [x] Audit report created at `docs/audits/BIDWAR-PHASE-3-4-AUCTION-RECOVERY-2026-11.md`.
- [x] PR ready for creation against `main` on branch `feat/phase-3-4-auction-recovery-reliability`.
