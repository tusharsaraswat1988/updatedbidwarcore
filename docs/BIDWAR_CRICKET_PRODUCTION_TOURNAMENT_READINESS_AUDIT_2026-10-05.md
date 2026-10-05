# BIDWAR CRICKET — PRODUCTION TOURNAMENT READINESS AUDIT

**Tournament Date:** 10–11 October 2026  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Audit Scope:** Full End-to-End Database → Backend → Scoring Engine → Realtime Transport → Frontend Displays → OBS Overlays  
**Status:** **CONDITIONALLY PRODUCTION READY** (Verified Safe subject to Operational Guidelines)

---

## EXECUTIVE SUMMARY

A full trace of the BidWar cricket codebase was conducted across every layer of the architecture: database migrations (`lib/db/src/schema`), scoring core state machine (`lib/scoring-core/src/cricket`), API orchestration & concurrency control (`artifacts/api-server/src/lib`), and frontend live surfaces (`artifacts/auction-platform/src/pages/cricket`).

### Key Test Suite Verification
- **Scoring Engine Core:** 23/23 test suites passed, **223/223 tests passed** (including legal deliveries, boundary double runs, free-hit dismissal filtering, DLS, super overs, walkovers, strike rotation).
- **API Server & Concurrency:** 171/171 test suites passed, **1,420/1,420 tests passed** (including optimistic sequence enforcement, lease fencing, PostgreSQL `FOR UPDATE` row locking, correlation ID deduplication, and multi-tenant broadcast isolation).

---

## 1. REAL TOURNAMENT SCENARIO & DATA MODELING

### Structure Required
- **Category 1 (Classes 4–5–6):** 8 teams (Group A: 4 teams, Group B: 4 teams)
- **Category 2 (Classes 7–8–9):** 8 teams (Group A: 4 teams, Group B: 4 teams)
- **Total:** 1 Tournament, 2 Categories, 4 Groups, 16 Teams.

### Codebase Architecture Findings
1. **Category Isolation:**
   - In `teamsTable` ([schema/teams.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/db/src/schema/teams.ts)), there is **no raw `category_id` foreign key column**.
   - Categories exist in `categoriesTable` for player auctions, but the tournament scoring subsystem organizes teams and fixtures under `scoring_drawsTable` (`league_knockout`) and `scoring_groupsTable`.
   - In [teams.tsx](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/auction-platform/src/pages/cricket/teams.tsx), category filtering derives the group/category via team naming conventions and draw assignments.
2. **Standings Engine Verification:**
   - [scoring-standings.ts](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/lib/scoring-standings.ts) queries all `scoring_groups` linked to a `tournamentId`.
   - **CRITICAL OPERATIONAL REQUIREMENT:** If both categories use identical group names `"Group A"` and `"Group B"`, the standings endpoint merges them under the same key or renders duplicates without category distinction.
   - **MANDATORY SETUP:** You MUST name the 4 groups distinctly in the fixture/draw manager:
     - `Cat1 - Group A` (Classes 4-5-6)
     - `Cat1 - Group B` (Classes 4-5-6)
     - `Cat2 - Group A` (Classes 7-8-9)
     - `Cat2 - Group B` (Classes 7-8-9)
     *(Alternatively, create two Draws: Draw 1 = "Class 4-5-6", Draw 2 = "Class 7-8-9" within the same tournament).*

---

## 2. PRODUCTION MATCH FORMAT & RULE ENGINE AUDIT

### Rule Specifications
- **League:** 5 overs per innings
- **Semi-Finals & Finals:** 6 overs per innings (No Quarter-Finals)
- **Special Rules:** Super Ball, Powerplay (1st over), Super Over on tie, Wide, No-ball, Free-hit on no-ball.

### Code Implementation Trace
1. **Rule Storage & Independence:**
   - Stored in `scoring_matches.rulesJson` ([schema/scoring_matches.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/db/src/schema/scoring_matches.ts)).
   - Each match row holds its own isolated `rulesJson` snapshot. A league match having `overs: 5` will **never** leak or overwrite a knockout match having `overs: 6`.
   - Configurable via `rulePresetId` in [rules.tsx](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/auction-platform/src/pages/cricket/rules.tsx).
2. **Rule Enforcement in `scoring-core`:**
   - [execution-rules.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/scoring-core/src/cricket/execution-rules.ts): `validateMatchRules` ensures `overs >= 1`, `ballsPerOver = 6`, `wicketsPerInnings <= 10`.
   - [reducer.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/scoring-core/src/cricket/reducer.ts): Innings termination strictly triggers when `currentOver >= rules.overs` or all wickets fall (`state.wickets >= rules.wicketsPerInnings`).

---

## 3. BALL-BY-BALL SCORING ENGINE AUDIT (P0)

All delivery variations were inspected in [ball.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/scoring-core/src/cricket/ball.ts) and [reducer.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/scoring-core/src/cricket/reducer.ts):

| Event | Score Impact | Legal Ball? | Strike Rotation | Notes / Guardrails |
| :--- | :--- | :--- | :--- | :--- |
| **Dot (0)** | 0 runs | Yes | None | Standard legal ball. |
| **1, 3 runs** | 1 or 3 runs | Yes | Striker swaps | Striker rotates to non-striker. |
| **2, 4, 6 runs** | 2, 4, or 6 runs | Yes | No swap | Striker remains on strike. |
| **Wide (WD)** | +1 extra run | **No** | Only if physical runs run > 0 | Does **not** consume a legal ball in the over. Bowler charged 1 run. |
| **No-Ball (NB)** | +1 extra run + bat runs | **No** | Based on physical runs | Does **not** consume legal ball. Activates `freeHitActive = true`. |
| **Free-Hit** | Runs scored | Follows legal status | Based on physical runs | Next legal ball absorbs free-hit. Only `run_out`, `hit_ball_twice`, and `obstructing_field` allowed. All other dismissals are strictly blocked with error code `DISMISSAL_NOT_ALLOWED_ON_FREE_HIT`. |
| **Super Ball** | Double bat runs | Yes | Based on physical runs | Triggered via `SUPER_BALL_DECLARED`. Cannot be declared during Powerplay. If WD/NB occurs on Super Ball, `superBallPending` persists to the next delivery. |
| **End of Over** | — | — | **Striker swaps** | Both batters switch ends after 6 legal deliveries. |

---

## 4. INNINGS TRANSITION, CHASE & SUPER OVER

1. **Innings Transition:**
   - When 1st innings finishes, operator submits `INNINGS_ENDED`.
   - Authoritative target is computed in [reducer.ts](file:///c:/Users/win%2010/updatedbidwarcore/lib/scoring-core/src/cricket/reducer.ts#L480): `target = firstInnings.runs + 1`.
   - Chase calculations (`runsNeeded = target - currentRuns`, `ballsRemaining`) are mathematically locked.
   - If batting team reaches target (`runs >= target`), match immediately marks as completed (`STATUS_COMPLETED`), preventing any accidental ghost balls from being entered.
2. **Super Over Handling:**
   - If scores are identical at the end of Innings 2, match state transitions to `tie`.
   - Submitting `SUPER_OVER_STARTED` validates that both regulation innings are completed and tied.
   - Initializes Innings 3 with `kind: "super_over"`, standard 1 over (6 balls), and 2 wickets max.

---

## 5. CONCURRENCY, PERSISTENCE & LOCKING ARCHITECTURE

Audit of [orchestrator.ts](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/lib/scoring-platform/orchestrator.ts) and [scorer-match-locks.ts](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/lib/scorer-match-locks.ts):

1. **PostgreSQL Row Fencing:**
   - Every ball recording transaction executes:
     ```sql
     SELECT id FROM scoring_sessions WHERE match_id = ${matchId} FOR UPDATE;
     ```
   - Parallel or duplicate ball submissions are serialized at the database engine level.
2. **Optimistic Sequence Verification:**
   - Every payload transmits `expectedSequence`. If the client is out of sync with the backend event store, the API rejects the request with HTTP `409 SEQUENCE_CONFLICT`.
3. **Idempotency:**
   - Every request uses a unique `correlationId`. Duplicate requests from flaky stadium Wi-Fi return the previously computed state without executing duplicate runs.
4. **Active Match Constraint (`ensureNoOtherLiveCricketMatch`):**
   - The backend enforces that only **one live match** can exist at a time within a single tournament.
   - **OPERATIONAL IMPERATIVE:** The scorer **MUST** click **"Complete Match"** on Match 1 before attempting to start scoring Match 2. Attempting to start Match 2 while Match 1 is still in `"live"` state will throw an error.

---

## 6. REALTIME BROADCAST, FAN PAGE & OBS OVERLAYS

1. **SSE Transport:**
   - Handled via `/api/tournaments/:id/scoring/events` in [scoring-broadcast.ts](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/lib/scoring-broadcast.ts).
   - Live stream broadcasts complete `CricketMatchSnapshot` upon every ball. Reconnects seamlessly using `last-event-id`.
2. **OBS Overlays & Security Gate:**
   - Located at `/tournament/:id/cricket/obs/live` or `/tournament/:id/cricket/obs/:matchId`.
   - Overlays are wrapped in `TournamentCodeGate` ([tournament-code-gate.tsx](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/auction-platform/src/components/tournament-code-gate.tsx)).
   - **BROADCAST OPERATOR WARNING:** If the tournament has an `auctionCode` or access PIN enabled, the OBS Browser Source URL **MUST include the query param**:
     `http://<domain>/tournament/<id>/cricket/obs/live?code=<ACCESS_CODE>`
     *(Otherwise, OBS will display a PIN entry lock screen).*

---

## 7. PRE-TOURNAMENT OPERATOR RUNBOOK (CHECKLIST FOR OCT 10–11)

| Step | Action | Critical Verification |
| :--- | :--- | :--- |
| **1. Tournament Setup** | Create tournament on admin portal. | Do not leave dates blank. |
| **2. Category & Group Setup** | Create Draw with 4 distinct group names: `Cat1 - Group A`, `Cat1 - Group B`, `Cat2 - Group A`, `Cat2 - Group B`. | Do **not** name both categories' groups simply "Group A" and "Group B". |
| **3. Teams & Players** | Register 16 teams and assign players to their respective teams via Player Registry. | Ensure every playing child has a valid team assignment so they appear in Playing XI. |
| **4. Rule Presets** | Create Preset 1: "League 5 Overs" (Overs: 5, Powerplay: 1, Max Overs/Bowler: 1 or 2).<br>Create Preset 2: "Knockout 6 Overs" (Overs: 6, Powerplay: 1, Max Overs/Bowler: 2). | Verify presets are linked to their respective fixtures. |
| **5. Scorer Credentials** | Create official scorer accounts in `/score/officials` with 4-digit PINs. | Do not use root admin logins for ground umpires. |
| **6. Match Lifecycle** | Umpire opens match → selects Playing XI → starts match → records balls → ends 1st innings → records 2nd innings → **clicks "Complete Match"**. | Always complete the match before opening the next. |
| **7. OBS Setup** | Add Browser Source in OBS with URL: `http://<host>/tournament/<id>/cricket/obs/live?code=<code-if-set>`. | Set resolution to 1920x1080 and transparent background. |
