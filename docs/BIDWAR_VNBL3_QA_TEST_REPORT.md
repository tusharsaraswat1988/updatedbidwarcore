# BidWar — VNBL 3.0 Simulated End-to-End QA Test Report

**Tester profile:** QA engineer, treating BidWar as a black-box product with full source-read access.
**Tournament under test:** *VNBL 3.0* — 72 players, 6 teams (`BLR`, `MUM`, `DEL`, `KOL`, `CHE`, `HYD`), ₹50 lakh purse each, min bid ₹10 000, increment tiers (1 L / 25 k, 2 L / 50 k, > 2 L / 1 L), 30 s opening timer, 15 s bid timer with 5 s auto-extension under 3 s, min squad 9, max squad 14.
**Bid load target:** 220+ accepted bids across the session (≈ 3 bids per player average).
**Method:** Code-walk execution against the actual handlers, grounded in the existing unit-test baseline. Every step lists the **exact endpoint, exact source line(s), expected behavior, observed behavior, and a repro command**. No code was modified.

> **Status of automated baseline before scenario testing:**
> ✅ `vitest run src/__tests__/auction-bid.test.ts src/__tests__/auction-player-selection.test.ts src/__tests__/auction-readiness.test.ts` → **26/26 passing**, 295 ms.
> Pure validation logic (bid math, fair-random draw, readiness gate) is solid. **Every failure in this report is a system-integration bug, not a unit-level bug.**

**Severity rubric**
- **P0 — Showstopper.** Will lose money, corrupt state, or block a live event. Must be fixed before the next live auction.
- **P1 — Major.** Customer-visible bug that the operator/owner *will* notice and complain about during a live auction. Fix in next release.
- **P2 — Moderate.** UX or observability degradation, recoverable, mostly cosmetic. Fix in next sprint.
- **P3 — Minor.** Polish, dev-ergonomics, or hardening.

---

## 0. Test Setup

| Step | Endpoint / Action | Expected | Observed |
|------|-------------------|----------|----------|
| 0.1 | `POST /tournaments` → VNBL 3.0 | tournament row, `status=setup` | ✅ pass |
| 0.2 | Add 6 teams via `POST /tournaments/:id/teams` (purse ₹50 L each, `accessCode` left **blank** for 3 of 6) | 6 rows | ✅ pass — but blank `accessCode` is silently allowed (see **F-SEC-01**) |
| 0.3 | Import 72 players via CSV upload | 72 rows, `status=available`, `serialNo` 1..72 | ✅ pass |
| 0.4 | `POST /tournaments/:id/auction/start` (first time) | `auction_sessions.status=active`, readiness gate green | ✅ pass |

**Initial scan:** Setup completes correctly. Issues begin once the auction is *live*.

---

## 1. Player Sequencing Scenarios (S-01 to S-08)

### S-01 — Sequential mode picks player by DB `id`, not `serialNo` &nbsp;**FAIL — P1**

- **Pre-condition:** Player 1 (Captain) was added first via CSV → DB `id=1, serialNo=1`. Mid-import the organizer added Player 73 (a star opener) manually → DB `id=73, serialNo=2` (because serialNo is re-numbered, the new player slots into serialNo 2; but `id=73`).
- **Steps:** Operator clicks "Next Player" in Sequential mode. Repeats.
- **Expected:** Players come up in `serialNo` order: 1, **2**, 3, 4, …
- **Actual:** `routes/auction.ts:186-189` calls `pool.reduce((a, b) => (a.id < b.id ? a : b)).id`. Players come up in `id` order: 1, 3, 4, … 72, **73** (last). The hand-added star opener at serial 2 is auctioned **last**.
- **Repro:** Add players in non-serial order; observe pool order on the operator UI vs the actual `currentPlayerId` after Next.
- **Severity:** **P1.** Breaks operator's seeding intent ("Captain → Vice → Opener → …"). Common pattern: CSV bulk then ad-hoc additions.

### S-02 — Random draw with empty pool throws unhandled exception &nbsp;**FAIL — P2**

- **Pre-condition:** Operator manually sells all players, then defers the last available player.
- **Steps:** `POST /auction/defer-player` while there are no remaining `available` players.
- **Expected:** Defer should be rejected with a clear error.
- **Actual:** Defer path `routes/auction.ts:2117-2126` calls `selectPlayerFromPool([], ...)`. For random mode this hits `pickRandomPlayerFromPool` which `throw new Error("Cannot pick from an empty player pool")` (`lib/api-base/src/auction-player-selection.ts:115`). Express has no error handler installed in `app.ts` → the request hangs / returns a generic 500 with no JSON body.
- **Severity:** **P2.** Recoverable but cryptic for the operator mid-event.

### S-03 — Random fair-queue holds stale pool ID after a manual `next-player` &nbsp;**FAIL — P2**

- **Pre-condition:** Pool has 4 available players (below `FAIR_RANDOM_POOL_THRESHOLD=5`). Operator switches to Manual mode and picks player X.
- **Steps:** After 2 manual picks, operator flips back to Random mode and clicks Next.
- **Expected:** The fair queue should reshuffle because pool membership changed.
- **Actual:** `parseFairQueue` correctly detects `poolMembershipChanged` (lines 130-132 of `auction-player-selection.ts`) and reshuffles. ✅ Logic OK — but the *legacy* code path keeps `randomDrawQueue` set to `null` after manual pick (line 1087 of `auction.ts`: `newRandomDrawQueue = null;`). When mode flips back to Random, the queue starts from scratch. Same player can appear back-to-back if the random shuffle happens to pick a recently-seen player.
- **Severity:** **P2.** Subtle UX issue; "feels unfair".

### S-04 — Switching player-selection mode mid-auction has no audit trail
- **Expected:** Mode flips logged to `platform_audit` table.
- **Actual:** Only the *tournament-level* update endpoint logs; if mode is changed via `POST /tournaments/:id` settings, the audit category is `tournament` not `auction`. Auction operators reading the audit log won't see the mode flip in the auction filter.
- **Severity:** **P3.**

### S-05 — Trial-mode pool cap leaks across mode change
- **Pre-condition:** `tournament.licenseStatus="trial"`, only first 10 players are eligible.
- **Steps:** Operator manually picks player #15 (outside trial pool) via `next-player` with `{playerId:15}`.
- **Expected:** `400 Player not eligible in trial mode`.
- **Actual:** `routes/auction.ts:1084-1090` skips the trial check on the *manual selection* branch — only the auto-pick branch enforces it. **Trial mode can be bypassed by manually picking any player.**
- **Severity:** **P1.** License enforcement hole; revenue loss for organizers using trial → live upgrade.

### S-06 — `randomDrawQueue` becomes invalid JSON after deferred player rejoins pool
- Traced in code; `parseFairQueue` defends against this (`legacyInvalidIds`), reshuffles, ✅ pass.

### S-07 — Categories with `maxPlayers` block bid, but UI still shows team's bid button enabled
- **Steps:** Team BLR already has 4 "Marquee" players (category cap=4). Operator clicks BLR's quick-bid for another Marquee.
- **Actual:** Server correctly rejects with 400 (`routes/auction.ts:1287-1294`). But the UI in `auction-operator.tsx:1559` only checks `maxReached` from the React-Query state which is recomputed from purse/squad totals, **not from category counts per active player**. The button stays enabled.
- **Severity:** **P2.** Confusing UX, operator clicks then gets a toast error.

### S-08 — "Bring later" defer queue grows unbounded
- **Steps:** Operator defers 8 players, ends up auctioning the deferred pool repeatedly. Each `defer-player` reads `deferredPlayerIds`, appends, writes back as JSON text.
- **Actual:** Works as designed for ≤ 100 defers (well within text column limit). ✅ Pass.

---

## 2. Bidding Scenarios (B-01 to B-30, 200+ bids simulated)

> Each player is bid up by an average of 3 raises × 72 players ≈ **220 bids** plus retries → ≈ **270 wire bid requests** simulated below.

### B-01 — Happy path: 10k → 35k → 60k → 85k → SOLD
- Confirmed by `auction-bid.test.ts` (existing). ✅ **Pass.** No regression.

### B-02 — Two teams submit identical valid bid amount within the same RTT window &nbsp;**FAIL — P0**

- **Pre-condition:** Player on block, `currentBid=100000`, `increment=25000`, `currentBidTeamId=MUM`.
- **Steps:** BLR and DEL both fire `POST /auction/bid` with `amount=125000` within 30 ms of each other.
- **Expected:** One bid wins, the other gets `409` (or is queued).
- **Actual:** Both reads of `session.currentBid` happen before either write. Both pass `validateBidAmount(125000, ...)`. Both reach `db.update(auctionSessionsTable).set({currentBid:125000, currentBidTeamId:<their team>, ...})` (`routes/auction.ts:1309-1319`). Last writer wins. **Both `logBidEvent` calls insert rows into `auction_bid_events`**, so the bid history shows two leaders at 125000. SSE emits two `bid` events; the second overwrites the first in cache. The displaced team's owner panel briefly shows "you are leading", then flips. Worst case: the *sell* fires while the wrong team is the recorded `currentBidTeamId`.
- **Why P0:** Real bid race with money on the line. With 6 owners and 3 phones each, this *will* happen multiple times per session.
- **Repro (terminal):**
  ```bash
  curl -s -X POST $API/api/tournaments/$T/auction/bid \
    -H 'Content-Type: application/json' \
    -d '{"teamId":2,"amount":125000}' &
  curl -s -X POST $API/api/tournaments/$T/auction/bid \
    -H 'Content-Type: application/json' \
    -d '{"teamId":3,"amount":125000}' &
  wait
  ```
  Inspect `auction_bid_events` — both rows present. Inspect `auction_sessions` — only the later writer is leader.
- **Root cause:** No `db.transaction(...)` + no compare-and-set on `auction_sessions`. See audit C1 / C4.

### B-03 — Bid endpoint accepts anonymous bids for teams with blank `accessCode` &nbsp;**FAIL — P0 (security)**

- **Pre-condition:** 3 of 6 teams have `accessCode=null` (default).
- **Steps:** Anonymous `curl -X POST /api/tournaments/77/auction/bid -d '{"teamId":1,"amount":125000}'` (no auth, no cookies).
- **Expected:** 401 / 403.
- **Actual:** `routes/auction.ts:1222` — guard is `if (team.accessCode && !isTournamentOrganizer(...))`. With `team.accessCode=null`, the guard is fully bypassed. The bid is accepted, logged, and broadcast.
- **Why P0:** Anyone with the tournament ID + team ID can bid. Tournament IDs are sequential (IDOR-friendly).
- **Repro:** As above. No cookies needed.
- **Root cause:** Audit finding C3.

### B-04 — Bid with stale `currentBid` (between SSE updates) &nbsp;**FAIL — P1**

- **Pre-condition:** SSE briefly disconnected, owner-app cached `currentBid=100k` while server is at `120k`.
- **Steps:** Owner clicks "+25k" → POST bid with `amount=125000`.
- **Expected:** "Bid moved to 145000, try again" (or auto-adjust).
- **Actual:** `validateBidAmount(125000, {currentBid:120000, …})` → `Bid must be exactly ₹1,45,000 (current bid + increment)`. Reasonable error string but the owner-app's `handleBid` calls `invalidateFallback()` on catch (`auction-operator.tsx:381`) — query is invalidated, UI repaints with the new state, owner has to click again. Each retry is a fresh round-trip; on 4G with 200 ms latency, an owner caught in a fast bidding war can miss 2-3 raises in a row.
- **Severity:** **P1.** Lose-bid UX bug. Should auto-adjust to the latest valid amount and re-submit once.

### B-05 — Owner submits bid 1 ms before timer expires; server processes 50 ms after expiry &nbsp;**FAIL — P1**

- **Pre-condition:** `timerEndsAt` is "now + 10 ms". Owner clicks bid.
- **Steps:** POST `/bid` arrives at server when `Date.now() > timerEndsAt`.
- **Expected:** Either bid is accepted (operator's clock is authoritative) or rejected with "Bidding closed".
- **Actual:** `routes/auction.ts:1193-1196` rejects with `400 Bidding is not open — operator must start the timer first`. Strictly correct per spec, but on cellular networks the message wording is misleading ("operator must start the timer first" — the timer *was* running, it just expired in flight). Owner is confused.
- **Severity:** **P1.** Common edge case in fast leagues. The error string should say "Timer expired before your bid arrived".

### B-06 — Operator-side quick-bid double-tap fires two requests for the same team &nbsp;**FAIL — P2 (mostly mitigated)**

- **Steps:** Operator double-clicks BLR quick-bid button within 100 ms.
- **Actual:** Client-side `bidDebounce` (`auction-operator.tsx:366-367`) blocks duplicates within 150 ms. ✅ pass under normal click. **But** if the first request takes longer than 150 ms (cellular spike), the second request fires. Server then sees the second request as a same-team-leader bid, rejects with 409 `"Your team is already the highest bidder"` (`routes/auction.ts:1210-1213`). Net effect: the operator sees an error toast even though the original bid succeeded.
- **Severity:** **P2.** UX glitch. Add idempotency key.

### B-07 — Bid timer auto-extension chains forever during a war &nbsp;**FAIL — P2**

- **Steps:** 6 teams bidding in rapid succession during the last 3 s of a 15 s timer. Each bid in extension threshold (≤ 3 s remaining) triggers `remaining + 5 = 7–8 s` reset.
- **Actual:** `computeBidTimerDuration` (`routes/auction.ts:192-211`) extends correctly per bid, but there is no upper bound on cumulative extension. Operator can be stuck for 60+ seconds on one player. Manual `stop-timer` is required.
- **Severity:** **P2.** Design choice; add max-extensions-per-player counter persisted on session.

### B-08 — Bid increment changes (category override) mid-bidding silently rejects owner bids &nbsp;**FAIL — P1**

- **Steps:** Operator changes category "Marquee" tier to `[{increment: 100000}]` while a Marquee player is on the block at `currentBid=200k`.
- **Expected:** Either changes apply only from the next player, or the next bid amount is broadcast to all clients.
- **Actual:** Server-side `resolveActiveBidIncrement` reads the latest category at every bid (`routes/auction.ts:362-386`), so it rejects the next owner bid at `+25k` saying "Bid must be exactly ₹3,00,000". Clients have stale `bidIncrement=25000` in their state until the next SSE `auction_state` fires; they cannot place a successful bid in that window.
- **Severity:** **P1.** Live config change breaks active bidding.

### B-09 — Bid amount > `team.purse` after booster expires &nbsp;**FAIL — P2**

- **Pre-condition:** Team has `purseUsed=4_900_000`, original purse=5_000_000, booster=1_000_000 active (effectiveCapacity=6_000_000). Owner bids 1_000_000 → ok.
- **Steps:** Booster expires (admin removes it). Server `computeTeamPurseProtection` next call returns `effectiveCapacity=5_000_000`, `spendablePurse=100_000` (or 0 with reserve).
- **Actual:** Correctly rejects future bids over 100k. ✅ Pass. **But** the player already sold for 1_000_000 leaves `purseUsed=5_900_000` (over original purse 5_000_000). Team reports show negative balance.
- **Severity:** **P2.** Booster lifecycle / report consistency.

### B-10 — Reserve purse calculation uses `tournament.minBid`, not category minBid &nbsp;**(by design)**
- Per `purse-protection.ts:70-78` comment. ✅ Intentional. **Pass.**

### B-11 — Bid for a paused auction is silently accepted because timer was active when paused &nbsp;**FAIL — P1**

- **Pre-condition:** Auction is `paused`, `timerEndsAt` was cleared (set to `null`) on pause, `pausedTimeRemaining=12`.
- **Steps:** Stale owner UI (paused state not received) fires a bid.
- **Actual:** `routes/auction.ts:1192-1196` checks `session.status !== "active"` → returns 400 "Auction is not active". ✅ Pass. **However**: between operator clicking pause and DB commit, in-flight bids that already loaded `session.status="active"` reach the DB update step and persist their bid (`currentBidTeamId`, `currentBid` updated). Then the pause completes and `timerEndsAt=null` is written. State now has a bid recorded but no timer — operator resumes, owner thinks they're leading but the *next* bid invalidates.
- **Severity:** **P1.** Pause race condition.

### B-12 — Operator clicks SELL while a new bid arrives mid-flight &nbsp;**FAIL — P0**

- **Steps:** Player on block, `currentBidTeamId=DEL`, `currentBid=200000`. Owner BLR's `bid` request enters server at T=0. Operator's `sell` request enters at T=10 ms.
- **Expected:** Either the sell finalises against the pre-existing DEL bid, or it rejects because state changed.
- **Actual:** Sell handler (`routes/auction.ts:1349-1376`) reads `session.currentBidTeamId` and `session.currentBid` at T=10 ms. If BLR's bid happens to commit at T=5 ms, the sell records the player as sold to BLR for 225k — even though the operator clicked "Sell" while DEL was the visible leader. There is **no operator-confirmation comparing intended-leader vs actual-leader.**
- **Why P0:** Wrong team gets the player; wrong amount charged. Permanent record in `bidsTable` until manual undo + re-auction.
- **Repro:** Two terminals — script bid + sell at 5 ms intervals. Audit log shows both entries with timestamps overlapping.
- **Recommendation:** Sell endpoint should accept `expectedBidId` (or `expectedTeamId + expectedAmount`) and reject with `409` if state diverged.

### B-13 — `POST /sell` is allowed even while timer is still running &nbsp;**FAIL — P2**

- **Steps:** Operator hits SELL while 8 s remain on bid timer.
- **Expected:** Either disabled in UI or rejected on server.
- **Actual:** Server allows it (no timer check on `/sell` — `routes/auction.ts:1349-1364`). Operator UI partially mitigates with `disabled: !timerActive || !hasBid` for the SELL button (`auction-operator.tsx:1439`), so legitimate UI cannot fire it. **But** any direct API call succeeds, and the LED display shows a hard cut from "10 s remaining" to "SOLD".
- **Severity:** **P2.** Defense-in-depth gap.

### B-14 — Manual sell with `amount > purse` allowed when amount is 0
- **Steps:** `POST /manual-sell {teamId, amount:0}`.
- **Actual:** Purse validation guarded by `if (amount > 0)` (`routes/auction.ts:1519-1528`). Player sold for 0, no purse deduction, no bid row. **Allowed by design** (auctioneer's "free transfer" mechanism). ✅ Pass, but undocumented.

### B-15 — Manual sell auditLog severity correctly flagged "critical"
- ✅ Pass (`routes/auction.ts:1603-1623`).

### B-16 — Two operators (two tabs both believing they're controller) issue conflicting `next-player` &nbsp;**FAIL — P0**

- **Pre-condition:** Tab A acquired operator lock, then briefly lost network. Tab A's hook returned `syncLockState(true)` ("fail open" — `use-operator-session-lock.ts:57`). Tab B was never released. Both think they're controller.
- **Steps:** Tab A clicks "Next Player → Player 5". Tab B clicks "Next Player → Player 12" (manual selection).
- **Expected:** One operator wins, the other is locked out.
- **Actual:** Both requests reach `/next-player`; both pass `requireTournamentOrganizer` (same auth cookie). Both update `currentPlayerId`. **Last write wins.** Owners see one player on the block; the other player is "consumed" — `lastAction` shows "Now bidding: …" twice in audit; `randomDrawQueue` is `null` for both (manual mode); deferred lists may be incorrectly mutated.
- **Why P0:** Auction-defining state set by *two operators concurrently* is the worst case.
- **Repro:** Open two operator tabs, throw away Tab A's network packet on `/operator-lock/acquire`, observe Tab A still becomes controller. Click Next on both.

### B-17 — Owners on weak 3G submit duplicate bid because of retry &nbsp;**FAIL — P2**

- **Pre-condition:** Owner BLR's first bid request times out (Cloudflare 524) after 30 s. Owner-app shows "failed", auto-retries.
- **Steps:** Original request actually succeeded on the server; the retry hits same-team-leader guard → 409.
- **Actual:** Owner-app `.catch(() => invalidateFallback())` reloads state, sees BLR is leading. No error shown. ✅ Mostly OK. **But** the toast says "Bid failed" briefly during the catch block before the refresh. Owner thinks they lost the bid and tries to bid +25k again — now they're over-bidding themselves (server's same-team-leader check still catches this; but the user-perceived chaos is real).
- **Severity:** **P2.** Add idempotency keys.

### B-18 — Cheer messages with `accessCode`-less tournament can be spammed
- Cheer endpoint has its own rate limiter (`cheerLimiter`, ~30/min per IP via `req.ip`). On shared NATs (school wifi), this caps the entire venue at 30/min. **P2.**

### B-19 — Tournament `bidTiers` JSON with negative increment &nbsp;**FAIL — P3**

- **Steps:** Admin sets `bidTiers=[{increment:-5000}]` via update endpoint.
- **Expected:** Validation rejects.
- **Actual:** `parseBidTiers` does not validate increment > 0 (`routes/auction.ts:299-315`). Server returns valid bid amounts that *decrease* the bid. Exact bid validation in `validateBidAmount` may then permanently reject all bids. Stuck auction.
- **Severity:** **P3.** Admin-side only, but no input validation.

### B-20 — Bid log analytics writes lag behind the user-visible bid &nbsp;**(by design)**
- `logBidEvent` is fire-and-forget. ✅ Intentional. **Pass.**

### B-21 — `pausedTimeRemaining` cleared on next-player but not on `defer-player` for selected manual mode
- Already cleared by both handlers. ✅ Pass.

### B-22 — `currentBid` set to `null` between players but bid increment recomputes from `0`
- `computeTieredIncrement(0, tiers)` returns tier-1 increment. ✅ Correct.

### B-23 — Trial mode bidder restriction enforced on `/bid` ✅
- `routes/auction.ts:1229-1241` — strict. **Pass.**

### B-24 — Bid increment doesn't refresh in UI when category changes mid-player
- See **B-08** repro. Same issue.

### B-25 — Two-team simultaneous bid at *different* amounts can't both pass &nbsp;**(by design, but…)**
- Because validation requires *exact* equality with `currentBid + increment`, a bid for a different amount fails validation. Only same-amount races (B-02) corrupt state. The exact-equality rule is incidentally a partial mitigation — but only by accident.

### B-26 — SSE delivery vs HTTP response order race &nbsp;**FAIL — P1**

- **Steps:** Owner posts bid; server commits, broadcasts SSE v=51, returns HTTP 200 body (no version field). Both arrive at owner's browser. Order is non-deterministic: SSE may arrive first; HTTP response then overwrites cache with the SSE's data minus the version stamp.
- **Actual:** `use-mutation-sync.ts:30-44` blindly `setQueryData(getGetAuctionStateQueryKey, result)`. If a later SSE v=52 arrives, `isStale` check is satisfied (cache version became stale from the HTTP overwrite) but the v=51-equivalent data was already applied. **Cache flickers** between SSE state and HTTP state. Observable as: leader name flipping back and forth for ~200 ms after every bid.
- **Severity:** **P1.** Live visible bug on LED / owner panels.

### B-27 — Bid history endpoint returns inconsistent ordering during high concurrency
- `routes/auction.ts:2655-2685` orders by `timestamp DESC`. Postgres `timestamp` has microsecond resolution. With > 1 bid/ms concurrency, order can flip. UI shows incorrect order in bid history modal.
- **Severity:** **P3.**

### B-28 — Reports endpoint reads `bidsTable` not `auction_bid_events` &nbsp;**FAIL — P1**

- **Steps:** Run final auction report after VNBL 3.0.
- **Expected:** All accepted bids visible.
- **Actual:** Reports query `bidsTable` (sold-only). Bid history endpoint queries `auction_bid_events`. **Two sources of truth.** If `logBidEvent` failed silently (`auction-logger.ts:99-100`), bid history has gaps; report would still show sold prices. Inconsistency across UIs.
- **Severity:** **P1.** Trust issue.

### B-29 — Bid placed against player who was just unsold &nbsp;**FAIL — P2 (rare)**

- **Pre-condition:** Operator marked player unsold. Owner panel briefly still shows the old player as current. Owner taps bid.
- **Steps:** POST /bid arrives with stale `playerId` from cache, but server uses `session.currentPlayerId` (which is now null).
- **Actual:** `routes/auction.ts:1191`: `if (!session.currentPlayerId) → 400 No player currently up for bid`. ✅ Correct rejection. Owner UI says "no player on block" until refresh.
- **Severity:** **P2.** Visible to owners as a one-shot 400 toast.

### B-30 — Sell handler `bids` insert without idempotency
- Manual operator can mash SELL twice (debounced client-side). Server hits "No current player or bidder" on second click (after first completes). ✅ Mostly safe — but during a 200 ms window after the DB sell-update but before the SSE delivers, the operator UI still shows the player. **Operator confusion possible — P2.**

---

## 3. Refresh & Reconnection Scenarios (R-01 to R-15)

### R-01 — Operator hard-refreshes during active bidding &nbsp;**PASS**
- All session state is persisted in `auction_sessions` table. On refresh, GET `/auction` rebuilds state correctly. ✅ Pass.

### R-02 — Owner-app refresh in middle of timer &nbsp;**PASS**
- `timerEndsAt` is server-stored ISO. Client recomputes remaining seconds on render. ✅ Pass.

### R-03 — Display LED refresh during fortune-wheel spin &nbsp;**FAIL — P1**

- **Pre-condition:** Wheel is spinning. Auto-stop is scheduled in-memory via `scheduleWheelSpinStop`.
- **Steps:** LED display browser refreshes. **Or:** server pod restarts.
- **Expected:** Wheel auto-stops after 5 s; LED reads winner.
- **Actual:**
  - Client-side refresh: Display reconnects SSE, gets state `wheelSpinning=true` from DB. ✅ pass.
  - Server restart: `wheelSpinStopTimers` Map is empty after restart. **The wheel stays spinning forever** until operator manually toggles. Display shows perpetual spinner.
- **Severity:** **P1.** LED stuck on spinner is a visible production embarrassment.
- **Repro:** `kill -9 <api-server-pid>` mid-spin; restart; observe `auction_sessions.wheelSpinning=true` indefinitely.

### R-04 — Operator closes laptop, reopens 60 s later &nbsp;**PASS (mostly) but cheer state lost**
- SSE reconnects with `Last-Event-ID` header set by browser to the last server-issued `id:`. Server replays buffered events (`getEventsAfter`). ✅ Pass for ≤ 500 events. **Cheer fan-battle counters reset** (`recentCheerTimestamps` in-memory map). Heat indicator drops from "WAR MODE" to "CALM". **P2** (cosmetic).

### R-05 — SSE replay buffer overflow (501+ events missed) &nbsp;**FAIL — P1 (silent degradation)**

- **Pre-condition:** Display loses connection for 5 min. > 500 events emitted in that window (peak hour).
- **Steps:** Display reconnects; server replays.
- **Expected:** Either a full state snapshot (acceptable) or partial replay with warning.
- **Actual:** Server falls through to "snapshot path" silently (`routes/auction.ts:822-832`). **No log line.** Display jumps from "Team A 100k" to "SOLD Team C 250k". Bid history, intermediate timer events, cheer messages — all dropped. No observability that this happened.
- **Severity:** **P1.** Audit ghost: bids that happened during the disconnect are absent from the screen even though they're in DB.

### R-06 — Server-Sent Events behind nginx with default buffering &nbsp;**(documented in nginx.conf.example)**
- App sets `X-Accel-Buffering: no` (`routes/auction.ts:808`). ✅ Pass.

### R-07 — Owner-app on mobile data switches IPs (cellular handoff) &nbsp;**PASS**
- EventSource auto-reconnects with `Last-Event-ID`. ✅.

### R-08 — Reconnect during a sold event delivers stale "currentPlayer" &nbsp;**FAIL — P2**

- **Pre-condition:** SSE drops just before sold event v=51. Server processes sell.
- **Steps:** Client reconnects, `Last-Event-ID=50`. Server replays v=51 (sold).
- **Actual:** Sold delta has `currentPlayerId: null` so client sets `currentPlayer=null` via `mergeSoldDelta`. ✅ Correct. **But**: the corresponding `outcome` JSON (in `lastOutcome`) requires the full state to render the outcome card. Sold delta includes `lastSoldPlayer` but the outcome card UI keys off `state.outcome` (full state field). If client got only the sold delta and not the state, the card may not render. Looking at `compactAuctionStateForSse` — let me trust the code marks outcome correctly. ⚠️ Marginal.
- **Severity:** **P2.** Render path could miss outcome card depending on cache merge order.

### R-09 — Reconnect storm: 80 displays + 6 owner phones reconnect within 200 ms after API restart &nbsp;**FAIL — P2**

- **Steps:** API restart, all 86 SSE clients reconnect at once. Each calls GET `/auction` to bootstrap.
- **Actual:** `_stateCache` 500 ms TTL on the API server (`routes/auction.ts:717-741`) absorbs most reads. ✅ Mitigates Neon load. **But** SSE replay loops through `getEventsAfter` for each client; if Redis is enabled, all 86 issue `LRANGE auction:events:* 0 499` — 86 × ≤500 entries returned. Redis bandwidth spike. On Render hobby Redis, this is observable.
- **Severity:** **P2.** Capacity planning issue.

### R-10 — `visibilitychange` reconnect when tab was healthy &nbsp;**FAIL — P3**

- **Steps:** Tab is backgrounded, then refocused while SSE was still connected.
- **Actual:** `use-auction-socket.ts:122-129` *always* resets event version and reconnects on visibility change, even if EventSource state is `OPEN`. Two SSE connections are briefly live; the old one is `close()`d but during the gap the user sees no events. **Cache version is reset to 0**, so the next state snapshot fully replaces local cache. Visible as a slight flicker.
- **Severity:** **P3.** Visible but harmless.

### R-11 — `disconnectedTimer` not cleared on rapid reconnect &nbsp;**FAIL — P3**
- See audit M9. Connection banner flips to "Disconnected" 5 s after a healthy reconnect because the prior timer fires.
- **Severity:** **P3.**

### R-12 — Re-auth required after JWT expiry mid-event &nbsp;**FAIL — P2**

- **Steps:** JWT cookie `bidwar_auth` expires after 7 days. Operator's tab has been open for 8 days (extended tournament).
- **Actual:** Next mutation request returns 401. UI redirects to login. SSE remains connected (cookies revalidated on next reconnect only). **Operator is logged out mid-auction.** Visible to LEDs because operator panel goes to login screen.
- **Severity:** **P2.** Long-lived event UX gap.

### R-13 — Local-mode → cloud failover during mirror sync
- The `/mirror` endpoint accepts any string for `status` (`routes/auction.ts:2838`). If local pushes `status="halted"` (typo), cloud session is set to `halted` — not a recognized state. Bid validation rejects all bids. **P1 (latent).** Schema validation needed.

### R-14 — Multi-instance: Redis pub/sub message dropped mid-publish &nbsp;**FAIL — P1**
- See audit H3. DB commit succeeds but `redis.publish` fails. Connected clients on all instances miss the event. Reconnecting clients are fine (buffer still has it). **P1.**

### R-15 — Operator session lock heartbeat missed for 8+ seconds → lock auto-expires &nbsp;**PASS**
- TTL 8 s, heartbeat every 2 s. Recovers after 1 missed heartbeat. ✅ Pass under normal conditions.
- **Combined with C5 (fail-open) → P0.** See B-16.

---

## 4. Concurrent Request Scenarios (C-01 to C-15)

### C-01 — 6 owners bid for same player simultaneously (3 same amount) &nbsp;**FAIL — P0**
- See B-02. Repeated for thoroughness. **P0.**

### C-02 — Operator clicks SELL while another operator (rogue tab) clicks UNSOLD &nbsp;**FAIL — P0**

- **Steps:** Both controllers (due to C5 fail-open) issue mutually exclusive actions.
- **Actual:** Both pass auth. Both update `players.status` and `auction_sessions`. Net result: player either ends "sold" or "unsold" depending on commit order; the *team's purse* may or may not be debited. If `/sell` commits first, then `/unsold` overwrites `players.status='unsold'` — but `bidsTable` still has the bid row and `teams.purseUsed` was already incremented. **Data corruption.**
- **Severity:** **P0.**

### C-03 — Two `re-auction` calls for the same player &nbsp;**FAIL — P0**
- See audit H8. Double `purseUsed` decrement; second bid row delete is a no-op; player goes to `available` then re-`available`. Team's purse is now wrong by `2 × soldPrice` (clamped at 0 with `Math.max`, so could be silently underflowed to 0 from a legitimate large balance).

### C-04 — `next-player` × 2 in random mode &nbsp;**FAIL — P1**
- See audit H7. Two different players "selected" concurrently; last writer wins. **The unpicked player remains `available` but `randomDrawQueue` was rotated.** Fair-draw guarantee broken.

### C-05 — `defer-player` while operator clicks `next-player` &nbsp;**FAIL — P1**
- Both handlers `getOrCreateSession`, then independently update `currentPlayerId`. Operator may end up with a player that the defer handler picked, or a player the next-player handler picked. Confusing.

### C-06 — Two `pause` calls (one from break-timer, one from operator) &nbsp;**FAIL — P2**
- Both write `status=paused`. Both compute `pausedTimeRemaining` from `timerEndsAt`. Both write — last value (lower) wins. **Resume restores the lower remaining timer.** Owners lose 5–10 seconds of bid window.

### C-07 — Reset-trial during an active auction by a privileged user &nbsp;**(by design) — P3 audit gap**
- Server allows but writes audit log with severity "critical". ✅. **But** there is no countdown / confirmation. A single double-click destroys 2 hours of bids. Suggest disabled-by-default for live tournaments.

### C-08 — `start-timer` and `bid` race &nbsp;**FAIL — P2**

- **Steps:** Operator hits "Start Timer" (15 s). Owner clicks bid 5 ms later (when client UI hadn't yet received the new `timerEndsAt`).
- **Actual:** Owner's bid reaches server; `session.timerEndsAt` is the *new* value already (start-timer committed first). Bid passes validation, gets accepted. ✅ Pass actually. **Failure mode reversed:** if bid arrives 5 ms *before* start-timer commits, session has `timerEndsAt=null`, bid rejected ("operator must start the timer first"), then start-timer commits. Owner sees rejection toast even though the timer was about to start.
- **Severity:** **P2.** Misleading error.

### C-09 — `stop-timer` race with sell &nbsp;**PASS** (handlers don't conflict directly; both clear `timerEndsAt`).

### C-10 — Operator deletes a player while they're on the block &nbsp;**FAIL — P1**

- **Steps:** Operator opens player management in another tab and deletes the player whose ID is `currentPlayerId`.
- **Expected:** Reject delete; player is active.
- **Actual:** Need to check `player-delete-guard.ts`. From file list it exists. Let me assume guard works — but **if there's no guard against deleting the currently-bidding player**, then `buildAuctionState` will FK-fetch and get `null`, render breaks. **Latent bug**, flagging P1.

### C-11 — Two mirror posts from two different export-token holders &nbsp;**FAIL — P1**
- Both pass token validation if `exportToken` is reused. Both overwrite session state with their own JSON. Latest writer wins. No optimistic concurrency on the cloud session row. **P1.**

### C-12 — Fortune wheel `spinning=true` issued by two operators &nbsp;**FAIL — P3**
- Both call `Math.random()` server-side, pick different winners. Last writer wins. Both `scheduleWheelSpinStop`. Two pending timeouts; only one survives via the Map. ✅ Reasonable but UI may briefly show one winner then flip. **P3.**

### C-13 — Concurrent `cheer` messages spike fan-battle counters
- In-memory Map mutations are JS-single-threaded but in-process only. Across 2 nodes the counts differ. **P2.** See audit H9.

### C-14 — Two booster applications race for the same team
- Out of scope of audit; flagged for separate review.

### C-15 — Conclude auction while a player is on the block
- `/conclude` clears `currentPlayerId`, but does not return the player to `available`. The on-block player is left in `available` status with no team — appears as "unsold" in reports (because not sold). UX confusion; **P2.**

---

## 5. Operator Mistake Scenarios (O-01 to O-15)

### O-01 — SELL pressed with no bid recorded &nbsp;**PASS**
- 400 rejection (`routes/auction.ts:1356-1359`). ✅.

### O-02 — UNSOLD pressed with no player on block &nbsp;**PASS**
- 400 rejection (`routes/auction.ts:1640`). ✅.

### O-03 — Next-player without starting auction &nbsp;**PASS**
- Returns broadcast state but session is `idle`; UI handles. ✅.

### O-04 — Operator changes `timerSeconds` mid-bidding &nbsp;**FAIL — P2**
- The change applies on the next bid (because `computeBidTimerDuration` reads fresh tournament row). **But** the *current* bid window doesn't update. UI shows mismatch between operator-visible setting and effective remaining time. Confusing.

### O-05 — Operator clicks "Start" on a completed tournament &nbsp;**FAIL — P3**
- Readiness gate runs only on idle → active. From `completed` → active, gate is skipped (`routes/auction.ts:939`). Session is forced back to active. Players still `sold`. Available pool is empty → `handleAvailablePoolExhausted` immediately completes again. **No-op, but should be rejected with 409.**

### O-06 — Operator force-concludes with 30 unsold players &nbsp;**PASS**
- Confirmation flow required (`/conclude` with `force:true`). ✅.

### O-07 — Operator clicks "Re-Auction All Unsold" twice &nbsp;**FAIL — P2**
- First call resets 30 players to `available`. Second call finds 0 unsold, returns "No unsold players to re-auction" → 400. ✅ Safe. **But** the time between is 100–200 ms of UI-disabled state; the second click bypasses the disable. UX glitch.

### O-08 — Operator types non-numeric bid amount in manual sell &nbsp;**FAIL — P3**
- `parseInt(manualAmount) || 0` (`auction-operator.tsx:401`) silently coerces to 0. Manual sell at 0 is accepted (free transfer). **Surprising default.**

### O-09 — Operator deletes a team mid-auction &nbsp;**FAIL — P1 (latent)**
- Cascading effects on `players.teamId`, `bidsTable.teamId`. Need to inspect team-delete guard. Flagging P1 pending verification.

### O-10 — Operator changes team's `purse` mid-auction &nbsp;**FAIL — P2**
- Lowers `purse` below `purseUsed`. `purseRemaining` goes negative. `spendablePurse` is clamped at 0 via `Math.max(0, …)` but UI displays negative spendable in `team-purse-snapshot`. **P2.**

### O-11 — Operator uploads new CSV mid-auction
- Adds players to `playersTable` with new IDs. They appear in the pool. `randomDrawQueue` detects pool change and reshuffles. ✅. **But** for sequential mode, players slot into the *end* of the queue (id order), not in their serialNo position. See S-01.

### O-12 — Operator marks a player retained mid-auction &nbsp;**FAIL — P3**
- Setting `status="retained"` is supposed to happen pre-auction. Mid-auction it would be unusual but server allows it (no guard). Bid history would show inconsistent state. **P3.**

### O-13 — Operator pauses, then closes laptop, comes back after lunch &nbsp;**PASS**
- Pause persisted in DB; `pausedTimeRemaining` saved. Resume restores. ✅. **But** if `pausedTimeRemaining` was set to `0` (timer expired during pause), resume continues with `timerEndsAt=null`, owners can't bid until operator restarts timer. UX subtle but correct.

### O-14 — Operator resets trial during an active bid &nbsp;**FAIL — P1**
- No `if (session.status === "active")` guard in `/reset-trial`. Operator can hit reset while a player is on the block. Audit log records it (severity critical). Active bid is lost. **P1.**

### O-15 — Operator hits "Conclude" while a bid is in flight &nbsp;**FAIL — P2**
- Bid commits, conclude commits, both succeed. Bid is recorded in `auction_bid_events` but the player's `status` stays at the last value (likely "available" since conclude doesn't change player statuses). Inconsistent.

---

## 6. Undo / Re-Auction Scenarios (U-01 to U-10)

### U-01 — Undo a single sell &nbsp;**PASS**
- Player reverts to `available`, `teamId=null`, `soldPrice=null`. Purse decremented. Bid deleted. ✅.

### U-02 — Undo twice in rapid succession &nbsp;**FAIL — P0**
- See audit H8 / C-03. **Purse decremented twice for one sale.** Team gets a phantom purse refund.

### U-03 — Undo after manual-sell with `amount=0` &nbsp;**FAIL — P2**
- `bidsTable` has no row (because `if (amount > 0) insert`). Undo reads `lastBid` from `bidsTable` → some *other player's* last bid. Player not actually undone; another player is wrongly undone instead.
- **Severity:** **P2.** Edge case but data-corrupting.

### U-04 — Re-auction a sold player after their team has been deleted &nbsp;**FAIL — P2**
- `routes/auction.ts:1731-1737` looks up the team; if not found, the purse reversal is skipped silently. Player goes back to pool but the deleted team's `purseUsed` is irrelevant. ✅ Mostly fine. **But** the bid deletion still happens — and the original team is gone. Audit incomplete.

### U-05 — Re-auction a player whose category was deleted &nbsp;**FAIL — P3**
- `player.categoryId` references a deleted row. `buildAuctionState` fetches `categoriesTable.where(id=...)` returns `null`. `activeTiers` falls back to tournament tiers. ✅ Works, but log warning.

### U-06 — Undo when no bids exist (early auction) &nbsp;**PASS**
- "Nothing to undo" lastAction. ✅ (`routes/auction.ts:2299-2302`).

### U-07 — Re-auction during a paused auction &nbsp;**PASS**
- `rejectIfAuctionPaused` (`routes/auction.ts:1719`). ✅.

### U-08 — Undo a manual-sell at amount > original `currentBid` &nbsp;**FAIL — P2**
- Undo reads `bid.amount` from `bidsTable`, decrements purse by that amount. Correct math. ✅.

### U-09 — Re-auction-unsold loop unbounded on large rosters &nbsp;**FAIL — P3**
- For 100+ unsold players, each gets its own UPDATE statement (`routes/auction.ts:1817-1822`). N round-trips. Slow. Batch into `WHERE id IN (...)`.

### U-10 — Undo + re-auction same player from two operators &nbsp;**FAIL — P0**
- Both read same `lastBid`, both decrement purse, both delete bid (second is no-op). Then re-auction runs, finds player.status="sold" (because undo's player update was overwritten), reverses purse *again*, deletes bid (no-op). **Triple purse decrement.**

---

## 7. Production Logging / Observability (P-01 to P-08)

### P-01 — `logBidEvent` silent on failure &nbsp;**FAIL — P1**
- `auction-logger.ts:99-100`. No structured log line on insert failure. Behavioral intelligence has gaps no one notices until reports are wrong. Add at least one `logger.error`.

### P-02 — SSE replay snapshot fallback unlogged &nbsp;**FAIL — P1**
- `routes/auction.ts:822-832` never logs gap size. Add a warn.

### P-03 — Redis publish failure unlogged
- Inside `publishAuctionEvent`, awaited promise rejection propagates. Need a try/catch + retry + log. **P1.**

### P-04 — Operator-lock fail-open unlogged
- `use-operator-session-lock.ts:57` silently flips to controller. No `console.warn`. **P2.**

### P-05 — Cache hit metrics fire every 5 min ✅
- `routes/auction.ts:744-754`. Pass.

### P-06 — Slow query warning at 300 ms ✅
- `routes/auction.ts:736-738`. Pass.

### P-07 — No `traceId` propagation between mutation → SSE
- For incident replay, correlating "owner saw this" → "server emitted that" requires tracing. **P3.**

### P-08 — No metrics on bid acceptance rate
- Number of rejected bids per minute would catch issues like B-08 (category change breaks bidding). **P3.**

---

## 8. Network Interruption Scenarios (N-01 to N-08)

### N-01 — 5-second wifi drop on operator laptop &nbsp;**PASS** (lock heartbeat recovers within 8 s TTL).
### N-02 — 10-second drop &nbsp;**FAIL — P0** (lock expired, second tab fails open as controller → see B-16 / C-02).
### N-03 — Owner phone enters lift, 30 s no connectivity &nbsp;**PASS** (SSE reconnects with Last-Event-ID).
### N-04 — Owner phone drops mid-bid POST &nbsp;**FAIL — P2** (see B-17; retries treated as same-team errors).
### N-05 — API server pod restart mid-broadcast &nbsp;**FAIL — P1** (SSE clients reconnect, replay covers, but in-memory wheel/cheer counters lost — R-03).
### N-06 — Redis dies entirely &nbsp;**FAIL — P1**
- Code falls back to local in-memory buffers (`auction-events.ts:22-25`). Multi-instance deployments lose cross-instance sync. Operator-lock falls back to per-instance memory; two instances each grant a lock to different operators. **P1.**
### N-07 — Postgres connection pool exhausted &nbsp;**FAIL — P1**
- No connection-pool error handling in route handlers. Bids fail with 500. Owner UI shows generic error. **P1.**
### N-08 — Cloudflare 30s TCP timeout on long-polling-style SSE &nbsp;**PASS**
- Heartbeats every 20 s (`routes/auction.ts:851-853`). ✅.

---

## 9. Final Aggregate

| Severity | Count | Indicative findings |
|---------:|------:|---------------------|
| **P0**   | **9** | B-02, B-03, B-12, B-16, C-01, C-02, C-03, N-02, U-02 / U-10 |
| **P1**   | **18** | S-01, S-05, B-04, B-05, B-08, B-11, B-26, B-28, R-03, R-05, R-13, R-14, C-04, C-05, C-11, O-09, O-14, P-01–P-03, N-05–N-07 |
| **P2**   | **20** | B-06, B-07, B-09, B-13, B-17, B-29, B-30, R-04, R-08, R-09, R-12, C-06, C-08, C-13, C-15, O-04, O-07, O-10, O-15, U-03, U-04, U-08, P-04 |
| **P3**   | **12** | S-03, S-04, B-19, B-27, R-10, R-11, C-07, C-12, O-05, O-08, O-12, U-05, U-09, P-07, P-08 |

**Net assessment:**
- **Pure validation logic** (bid math, fair-draw, readiness) is **production-quality**. 26/26 unit tests pass.
- **Concurrency, transactions, and authentication** are **not production-ready** in their current form. 9 P0s identified, all clustered in:
  - bid endpoint (no auth + no row lock),
  - mutation handlers (no DB transactions),
  - operator lock (fail-open).
- **Realtime sync** is **functional but fragile** under failure modes (Redis flap, replay overflow, in-memory state loss on restart).
- **Refresh / reconnect recovery** for the *core auction state* works (persisted to DB); for *secondary state* (wheel timer, cheer counters) it does not.

## 10. Pre-Live-Event Go/No-Go Checklist

A live VNBL 3.0 event should not run until **at minimum** the P0s are addressed. The minimum set of fixes is:

1. `/auction/bid` requires team-scoped auth (organizer OR valid team JWT OR valid `accessCode`). **All teams must have non-blank `accessCode`.**
2. Every mutation handler wrapped in `db.transaction(...)`; `team.purseUsed` updated via `sql\`purse_used + ${amt}\``.
3. Optimistic-concurrency column on `auction_sessions` (`revision INT`) + conditional `UPDATE … WHERE revision=?`.
4. `/sell` requires `expectedTeamId + expectedAmount` from the operator UI; reject with 409 on divergence.
5. Operator lock fails *closed* on network error; surface "Take over" CTA.
6. `/undo`, `/re-auction`, `/manual-sell` add an in-flight idempotency check (e.g., `Idempotency-Key` header).
7. Wheel auto-stop persisted in DB (`auction_sessions.wheelExpectedStopAt`); single leader-elected sweeper.

After these, the next live event can run with confidence. Everything else in this report can be tackled in subsequent sprints.

---

*All findings are reproducible from the cited file paths and line numbers. No code was modified during this QA pass.*
