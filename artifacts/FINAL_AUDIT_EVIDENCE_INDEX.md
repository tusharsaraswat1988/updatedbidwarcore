# FINAL AUDIT EVIDENCE INDEX & REPOSITORY RECONCILIATION CATALOG
## Authoritative Forensic Index of Executed Commands, Source Files, Databases, Logs & Screenshots

**Audit Identifier**: BIDWAR-INDEPENDENT-GO-LIVE-AUDIT-2026-11-04  
**Auditor**: Independent Principal QA, Database Integrity, Concurrency & Security Engineering Team  
**Evaluation Target**: BidWar Premier League Auction System  
**Repository Branch**: `main` (commit `5dc8cf2`)  
**Publication Date**: November 4, 2026  

---

## 1. Database Identification & Redacted Connection Profiles

| Environment | Purpose | Redacted Host Identifier | Port | Database | Authenticated Role | Privilege Level | Enforced Mode |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Production DB** | Authoritative Live League | `ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech` | 5432 | `neondb` | `neondb_owner` | Full DB Owner / DDL | Read-Only Audit (`SET default_transaction_read_only = ON`) |
| **Development DB** | Simulation & Mutations | `ep-long-sky-aorboyzr-pooler.c-2.ap-southeast-1.aws.neon.tech`| 5432 | `neondb` | `neondb_owner` | Full DB Owner / DDL | Read/Write (Isolated to Tournament 18) |

---

## 2. Inventory of Examined Source Code Files

| Relative Repository File Path | Line Range | Subject Matter / Module | Forensic Findings & Observations |
| :--- | :---: | :--- | :--- |
| `artifacts/api-server/src/routes/auction.ts` | 1895–1925 | Live Bid Mutation Handler | Optimistic revision CAS (`WHERE revision = expectedRevision`) correctly serializes bids; advisory lock executed on `tx`. |
| `artifacts/api-server/src/routes/auction.ts` | 1575–1640 | Next-Player Selection | Manual player selection (`if (playerId)`) omits `status = 'available'` check; permits calling already sold players. |
| `artifacts/api-server/src/routes/auction.ts` | 2270–2460 | Manual-Sell Route | SEC-2026-02 and SEC-2026-03 patches verified: squad size and category caps checked in transaction; ₹0 sale inserts into `bidsTable`. |
| `artifacts/api-server/src/routes/auction.ts` | 2589–2740 | Unsold Mutation Route | Enforces revision CAS (`expectedRevision`); verifies `currentBid IS NULL` before marking unsold. |
| `artifacts/api-server/src/routes/auction.ts` | 2915–2960 | Re-Auction All Unsold | Executes `SET status = 'available'` without resetting `teamId` or `soldPrice`. |
| `artifacts/api-server/src/routes/players.ts` | 1403–1725 | Organizer Player PATCH Route | Changes status from `sold` to `available`; recalculates purse used but **does not delete corresponding row in `bidsTable`** (Player 448 bug root cause). |
| `artifacts/api-server/src/lib/player-purse.ts` | 10–28 | Team Purse Recalculation Engine | Sums player prices where `status IN ('sold', 'retained')`. Does not cross-check `bidsTable`. |
| `artifacts/owner-app/src/screens/LiveBid.tsx` | 180–240 | Owner App Live Bidding UI | Client-side debouncing and 8000ms watchdog recovery (`BID_ACK_TIMEOUT_MS`) verified. |
| `scripts/simulation/forensic-audit-m6.ts` | 74–77 | Milestone M6 Audit Script | **Plaintext production credentials embedded in source code**. |
| `scripts/simulation/verify-simulation-environment.ts`| 29–31 | Setup Verification Script | **Plaintext production credentials embedded in source code**. |
| `.env.production` | Line 27 | Production Environment Configuration | **Plaintext production database credentials committed to local environment file**. |
| `.gitignore` | Lines 50–70 | Repository Exclusion Rules | Ignores `.env.production`, but tracked files already committed prior to ignore rule remain in Git history. |

---

## 3. Executed Commands & Verification Scripts Ledger

| Command / Script Executed | Working Directory | Environment Targets | Objectives & Findings | Result |
| :--- | :--- | :--- | :--- | :---: |
| `node scripts/check-domain-boundaries.mjs` | Workspace Root | Local Codebase | Verified architectural domain boundary rules. | **PASS** |
| `npx --prefix scripts tsx --env-file=.env scripts/simulation/forensic-audit-m6.ts` | Workspace Root | Dev DB & Prod DB | Verified 6 mathematical invariants on Dev DB; confirmed Prod DB row counts intact. | **PASS** |
| `git log -S "ep-late-math" --oneline` | Workspace Root | Git History | Scanned commit history for production host strings; identified 10 commits with leaked secrets. | **FAIL (Leak Identified)** |
| `node scratch/check_creds.mjs` | Scratch Directory | 20 Target Files | Scanned tracked files; identified 14 files containing active production connection URIs. | **FAIL (Leak Identified)** |
| `node scratch/check_prod_lines.mjs` | Scratch Directory | `.env.production` | Confirmed unrotated production credentials present on line 27 of `.env.production`. | **FAIL (Unrotated)** |
| `npx --prefix scripts tsx scratch/check_dev_roles.mjs` | Workspace Root | Dev DB | Inspected `pg_roles`; verified zero `audit_readonly` roles provisioned. | **FAIL (No Readonly Role)** |
| `npx --prefix scripts tsx scratch/investigate_player_448.ts` | Workspace Root | Prod DB (Read-Only) | Forensic audit of Player 448, Session 27, Teams 54/55, and Bids 213/217. | **DISCREPANCY CONFIRMED** |
| `npx --prefix scripts tsx scratch/check_448_audit.ts` | Workspace Root | Prod DB (Read-Only) | Reconstructed event timeline from `platform_audit_events` (Event 3121 smoking gun). | **ROOT CAUSE VERIFIED** |
| `npx --prefix scripts tsx scratch/independent_reconciliation.ts` | Workspace Root | Dev DB | Independent recomputation of purse arithmetic and player conservation invariants. | **PASS (100% Math Match)** |
| `npx --prefix scripts tsx scratch/check_seq.ts` | Workspace Root | Dev DB | Verified strict monotonic contiguous sequence continuity 1..N across all 17 sold lots. | **PASS** |
| `npx --prefix scripts tsx scratch/check_dev_notifications.ts` | Workspace Root | Dev DB | Audited notification tables; identified 49 enqueued emails in `communication_jobs`. | **LEAKAGE ATTEMPT DETECTED** |
| `npx --prefix scripts tsx scratch/audit_browser_surfaces.ts` | Workspace Root | Chrome CDP Port 9333 | Rendered, audited, and screenshotted all 5 surfaces on Tournament 18. | **PASS (Screenshots Captured)** |
| `npx --prefix scripts tsx scratch/capture_auth_screens.ts` | Workspace Root | Chrome CDP Port 9333 | Captured authenticated Operator Room and Owner Panel (Team 84) UI states. | **PASS** |
| `npx --prefix scripts tsx scratch/run_concurrency_and_integrity_regressions.ts` | Workspace Root | Dev DB & Express API | Executed 8 live regression scenarios on Tournament 18; confirmed Player 448 bug reproduction. | **PASS (Regression Proven)** |

---

## 4. Raw Simulation Log & Data Artifact Catalog

| Artifact Filename | Relative Repository Path | File Size | Primary Contents & Verification Role |
| :--- | :--- | :---: | :--- |
| `m6-auction-ledger.json` | `public/simulation/m6-auction-ledger.json` | 83,093 bytes | 80 individual HTTP bid transactions (67 accepted, 12 stale 409, 1 boundary 400). |
| `m6-auction-events.json` | `public/simulation/m6-auction-events.json` | 40,008 bytes | 109 state-machine events emitted over SSE during the 20-player auction. |
| `m6-sustained-load-telemetry.json` | `public/simulation/m6-sustained-load-telemetry.json` | 43,476 bytes | 30 one-minute periodic snapshots of server, DB, browser, and SSE metrics. |
| `m6_sustained_load_telemetry.log` | `artifacts/simulation-logs/m6_sustained_load_telemetry.log` | 7,898 bytes | Console log of the 30-minute endurance soak run. |
| `m5_cross_screen_sync.json` | `artifacts/simulation-logs/m5_cross_screen_sync.json` | 2,864 bytes | Millisecond arrival timestamps across Operator, Owner, OBS, and LED surfaces. |
| `rapid-bid-stress-timeline.json` | `artifacts/rapid-bid-stress-timeline.json` | 739 bytes | Multi-bid burst timing and contention resolution log. |

---

## 5. Visual Evidence & Screenshot Repository

All screenshots referenced in this audit were captured directly from real browser contexts over WebSocket Chrome DevTools Protocol (CDP port 9333) and are stored in the repository:

### 5.1 Fresh Independent Audit Screenshots (`artifacts/final-audit-screenshots/`)
1. `obs_v2_preview.png` (77,602 bytes): Transparent OBS V2 preview rendering active player, category badge, timer ring, and team logo.
2. `obs_browser_source.png` (84,445 bytes): Dedicated clean-feed OBS Browser Source rendering transparent lower-third lot graphics.
3. `led_display.png` (936,999 bytes): Arena-scale LED Big Screen display rendering high-contrast yellow typography and 5-team purse sidebar.
4. `operator_room.png` (696,894 bytes): Operator console interface unauthenticated state.
5. `operator_room_authenticated.png` (646,204 bytes): Operator console interface authenticated state displaying live controls.
6. `owner_panel_84.png` (217,311 bytes): Owner Panel for Team 84 (`SIM_TITANS`) unauthenticated access code screen.
7. `owner_panel_84_authenticated.png` (141,184 bytes): Owner Panel for Team 84 authenticated with live interactive bid button.

### 5.2 Primary Milestone M6 Screenshots (`public/simulation/` & `artifacts/simulation-screenshots/`)
- `m6_obs_overlay.png` (94,658 bytes): Milestone M6 broadcast overlay capture.
- `m6_led_display.png` (274,481 bytes): Milestone M6 LED arena display capture.
- `m6_lot1_sequential.png` (136,395 bytes): Sequential bidding on Lot 1.
- `m6_lot5_concurrent.png` (137,370 bytes): 2 concurrent bidders resolving via OCC CAS.
- `m6_lot7_5concurrent.png` (136,084 bytes): 5 simultaneous owners bidding concurrently.
- `m6_lot8_burst.png` (131,905 bytes): 5-click burst debounced to 1 single bid.
- `m6_lot9_throttled.png` (144,098 bytes): Bidding under 250ms network throttling.
- `m6_lot13_paused.png` (447,987 bytes): Operator pause at 10.0s.
- `m6_lot14_reconnect.png` (131,394 bytes): Reconnection after network drop.
- `m6_lot17_escalation.png` (138,863 bytes): Intense 20-bid escalation on Shivam Dube.
- `m6_lot20_purse_boundary.png` (129,181 bytes): ₹950k bid rejected with HTTP 400.

---

## 6. Audit Verdict Summary

| Section | Domain Evaluated | Verified Status | Key Evidence |
| :---: | :--- | :---: | :--- |
| **Sec 2** | 26 Acceptance Criteria | **19 PASS, 4 CONDITIONAL/PARTIAL, 3 FAIL** | Detailed in `FINAL_ACCEPTANCE_CRITERIA_MATRIX.md` |
| **Sec 3** | Production Database Security | **FAIL (BLOCKED - P0)** | Hardcoded `neondb_owner` credentials in 14 tracked files, Git history unpurged, zero read-only DB roles |
| **Sec 4** | Player 448 & Tournament 25 | **FAIL (P1 Structural Defect)** | Event 3121 confirms organizer PATCH created orphaned winning bid; 4/5 players have dangling teams |
| **Sec 5** | Auction Concurrency & Integrity | **PASS** | OCC revision CAS verified under 2/3/5 owners; zero deadlocks, zero double allocations |
| **Sec 6** | Sustained-Load & Performance | **PARTIAL PASS (P2 Gap)** | 30m soak ran on an idle/closed auction with 0 real bids; active bidding endurance untested |
| **Sec 7** | OBS V2 & Broadcast Display | **PASS (Software Preview)** / **NOT TESTED (Hardware)**| Clean 1080p rendering verified; physical arena SDI/LED hardware not tested |
| **Sec 8** | Notification Leakage Safety | **CONDITIONAL PASS** | 0 outbound messages dispatched (due to blank numbers), but 49 emails enqueued in DB queue |
| **Sec 9** | UI / UX & Browser Surfaces | **PASS** | Responsive layouts, debounced bid buttons, accessible high-contrast LED UI |
| **Sec 10**| Mathematical Reconciliation | **PASS (100% Precision)** | ₹6.90L spent + ₹43.10L rem = ₹50.00L; 17 Sold + 3 Unsold + 4 Available = 24 Total Players |

**Authoritative Gate Recommendation**: **NOT APPROVED FOR PRODUCTION**  
*Production Go-Live is conditional upon resolving P0 security blockers, P1 database reconciliation, and executing an active multi-round endurance test.*
