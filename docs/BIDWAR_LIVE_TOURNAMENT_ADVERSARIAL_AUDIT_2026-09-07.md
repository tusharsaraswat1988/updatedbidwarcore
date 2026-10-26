# BidWar Live Tournament — Adversarial Production Audit

**Date:** 2026-09-07  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Audited revision:** `617ecc6b` (`main` — "fix: sync OBS to live auction on LED MAIN VIEW…")  
**Method:** Static adversarial review of the **current** production path only. No code was modified.  
**Production path:** `artifacts/api-server` (`start:prod` / Docker `@workspace/api-server`). Shared math: `@workspace/auction` (`lib/auction`).  
**Not production:** `artifacts/bidwar-local` (offline Electron fork; bid path has **no** revision CAS). `lib/api-base/src/auction-bid*.ts` are deprecated shims.

## Business-rule addendum (2026-09-07)

Product constraints (SOLD only after timer close; re-auction + manual sell; undo = last outcome until Next Player) **supersede C1/C3/H1/H2/H3 wording below** where they assumed the operator sells during a live timer or that undo should be removed.

See `docs/BIDWAR_LIVE_TOURNAMENT_AUDIT_RECLASSIFICATION_2026-09-07.md`.

## Verdict

**NO-GO FOR REAL AUCTION** — competing owner bids are serialized, but sell/undo/pause/stop-timer are not, and the operator lock is UI-only. A live money auction can still award the wrong team, double-count purse, or run two controllers. The remaining sell/bid hole is the **timer-zero in-flight bid**, not “Sold during live bidding.”

Older docs such as `docs/BIDWAR_AUCTION_PRODUCTION_READINESS_AUDIT.md` are **stale**. That document claims “no revision / no transactions / empty accessCode allows bids.” Current code has revision CAS on bid/next-player, `db.transaction()` on sell/unsold/undo/re-auction, and rejects anonymous bids on codeless teams. Every finding below was re-verified against this branch.

---

## How the live flow actually works

### 1. Auction operator

Organizer authenticates → `/auction-operator` → `POST …/auction/operator-lock/acquire` (Redis/memory, TTL 8s, heartbeat 2s). Mutations (`start`, `pause`, `next-player`, `sell`, `unsold`, `undo`, overlays) check **`requireTournamentOrganizer` only**. The lock is never re-checked on those routes.

Typical loop: Start → Next Player → Start Timer → owners bid → Stop Timer / clock expiry → Sold / Unsold / Manual Sell / Defer → repeat. Pause/resume freeze `timerEndsAt`. Broadcast tab drives LED overlay + OBS `presentationContext`.

### 2. Team owner / bidder

Owner enters access code → `POST …/teams/:teamId/verify-access` (httpOnly session cookie + `sessionStorage`). LiveBid uses SSE + `POST …/auction/bid` `{ teamId, amount, accessCode }`. Server authorizes the **access code** (or organizer session), not the owner cookie. Purse / max bid / squad / category come from `teamPurses` snapshot embedded in auction state.

### 3. Live Viewer / LED / OBS

All three subscribe to `GET …/auction/events` (SSE) and `GET …/auction` (snapshot). LED uses `displayOverlay`; OBS uses `presentationContext` / `obsContextJson`. Bid deltas are merged client-side; sold/unsold trigger fuller state rebuilds.

---

# 1. CRITICAL

Issues that can lose/accept an invalid bid, corrupt purse or player status, create conflicting auction state, allow unauthorized bidding, create two operators, or show the wrong live leader as durable state.

---

### C1. Sell does not use revision CAS — concurrent winning bid can be discarded; player sold to previous leader

| Field | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Path** | `artifacts/api-server/src/routes/auction.ts` — `POST /tournaments/:tournamentId/auction/sell` (~1755–1853) |
| **Function/route** | `router.post("…/auction/sell")` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Optional `expectedBidTeamId` / `expectedBidAmount` are checked against a **pre-transaction** session read. The transaction then sells captured `teamId` / `soldAmount` and updates `auction_sessions` with `WHERE tournament_id = :tid` only. Revision is incremented **without** `WHERE revision = :readRevision`. Bid path *does* CAS on revision (`1699–1725`). |
| **Expected behaviour** | Sell must abort unless the session row still matches the leader, amount, player, and revision the operator confirmed. |
| **Reproduction** | Team A leads at ₹100k (revision R). Operator clicks Sold (UI sends expected A/100k). In the same window Team B’s bid CAS-wins ₹125k (revision R+1). Sell transaction still writes player sold to **A @ 100k**, inserts that `bids` row, clears the session. B’s accepted raise is gone. |
| **Why it matters** | Last-second bids vs Sold is the hottest live path. Wrong winner is a disputed, money-bearing result. |
| **Minimal fix** | Inside the sell transaction: `UPDATE auction_sessions SET … revision = revision+1 WHERE tournament_id=:tid AND revision=:R AND current_player_id=:pid AND current_bid_team_id=:tid AND current_bid=:amt`. If 0 rows, return 409 `sell_race`. Make `expectedBid*` mandatory. Re-validate `maxAllowedBid` / max squad / category inside the same transaction. |

---

### C2. Concurrent double-sell can double-count `purseUsed` and insert two `bids` rows

| Field | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Path** | `artifacts/api-server/src/routes/auction.ts` — sell (~1811–1853) and manual-sell (~1996–2037) |
| **Function/route** | `POST …/auction/sell`, `POST …/auction/manual-sell` |
| **Status** | **CONFIRMED** (logic). UI `sellPlayer.isPending` only serializes **one tab**. |
| **Current behaviour** | Player update is `WHERE id = playerId` (no `status = 'available'`). Purse is `purse_used = purse_used + amount`. `bids` has **no unique constraint** on `(tournament_id, player_id)` (`lib/db/src/schema/bids.ts`). Two overlapping sell transactions both succeed. |
| **Expected behaviour** | Second sell must 409. Purse incremented once. One ledger row. |
| **Reproduction** | Two operator devices (see C5) both POST `/sell` on the same player. Or a retried HTTP sell after a slow response. |
| **Why it matters** | Team purse is overstated; undo only reverses the latest `bids` row; roster vs purse diverge. |
| **Minimal fix** | Same CAS as C1, plus `UPDATE players SET status='sold' … WHERE id=:id AND status='available'` and unique `(tournament_id, player_id)` on `bids` for sold ledger (or reject insert if a sold bid already exists). |

---

### C3. Bid CAS does not include status, timer, player, or leader — pause / stop-timer / unsold / manual-sell can lose the race to an in-flight bid

| Field | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Path** | Bid commit: `auction.ts` `1699–1716`. Pause: `1373–1393` (no revision bump). Stop-timer: `2973–2983` (no revision bump). Unsold: `2128–2150` (no revision bump). Manual-sell: `2015–2037` (no revision bump). Start/resume: `1328–1346` (no revision bump). |
| **Function/route** | `POST …/auction/bid` vs `pause`, `stop-timer`, `unsold`, `manual-sell` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Bid pre-checks `status === 'active'` and `timerEndsAt > now()`, then does purse/squad I/O, then `UPDATE … WHERE revision = :R`. Pause/stop/unsold/manual-sell **do not change `revision`**. An in-flight bid still matches `:R` and commits. Bid SET writes `currentBid`, `currentBidTeamId`, **new** `timerEndsAt`, and does **not** set `currentPlayerId` or `status`. After unsold/manual-sell this yields a ghost leader with `currentPlayerId = null`. After pause, status can remain `paused` while a new timer is opened. After stop-timer, bidding restarts against operator intent. |
| **Expected behaviour** | Once the operator closes the window (pause, stop, unsold, sell), in-flight bids must 409. CAS predicate must include `status='active'`, live timer, `current_player_id`, and `current_bid_team_id IS DISTINCT FROM :teamId`. Pause/stop/unsold/manual-sell must bump revision (or use `SELECT … FOR UPDATE`). |
| **Reproduction** | Owner taps Bid as operator hits Stop Timer or Pause, or marks Unsold. Bid HTTP is already in flight. Bid CAS succeeds. |
| **Why it matters** | Operator believes the lot is closed; a bid still lands (or a ghost bid appears with no player). Live displays and owner panels disagree with the operator’s action. |
| **Minimal fix** | Extend bid `WHERE`; bump `revision` on pause, stop-timer, start-timer, unsold, manual-sell, resume. Optionally `SELECT … FOR UPDATE` the session row in those transactions. |

Note: **Sell does bump revision**, so the opposite order (sell commits, then bid CAS) correctly 409s. C1 is the remaining sell/bid hole.

---

### C4. Concurrent undo can reverse purse twice for the same sale

| Field | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Path** | `artifacts/api-server/src/routes/auction.ts` — `POST …/auction/undo` (~2658–2706) |
| **Function/route** | `router.post("…/auction/undo")` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Loads latest `bids` row by timestamp **outside** the transaction. Transaction: set player available, `purse_used -= bid.amount`, delete that bid id. No lock, no `player.status === 'sold'` check, no revision CAS. Two overlapping undos both read the same last bid and both decrement purse. Second delete is a no-op. |
| **Expected behaviour** | Undo is single-step, serialized, and no-ops if that bid is already gone / player is not sold. |
| **Reproduction** | Double-submit Undo (two devices, or retry). Both read bid id=5. Both subtract ₹X. |
| **Why it matters** | Team can show more remaining purse than they legally have; later max-bid gates are wrong. |
| **Minimal fix** | `SELECT … FOR UPDATE` the latest bid inside the tx; `UPDATE players … WHERE status='sold' AND sold_price=:amount`; abort if 0 rows; bump session revision. |

---

### C5. Operator lock is not enforced on mutations — two live controllers are possible

| Field | Detail |
|---|---|
| **Severity** | CRITICAL |
| **Path** | `artifacts/api-server/src/lib/operator-lock.ts`; lock routes `auction.ts` `1212–1260`; mutations only call `requireTournamentOrganizer`. Client: `artifacts/auction-platform/src/hooks/use-operator-session-lock.ts` (`HEARTBEAT_MS=2000`, heartbeat `.catch` keeps last state at 261–263). |
| **Function/route** | `acquireOperatorLock`, `heartbeatOperatorLock`; **not** called from sell/next/pause/overlay |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Lock TTL is 8s. Device A network drop: heartbeats fail **silently**; UI stays `controller`. After 8s Device B can acquire. Both UIs can look live. **Neither sell nor any other mutation checks `getOperatorLockHolder`.** Additionally, expired-lock heartbeat does unconditional `SET` (not NX) at `operator-lock.ts` 113–115: A’s late heartbeat can overwrite B’s fresh lock (TOCTOU). |
| **Expected behaviour** | Exactly one mutating controller. After A’s TTL expiry, A’s next mutation is 409 until it takes over explicitly. Heartbeat reclaim must be compare-and-set. |
| **Reproduction (the required test)** | Device A is operator. Disconnect A’s network. Wait >8s. Device B acquires operator access. A still shows controller (stale heartbeat catch). Both POST `/sell` or `/next-player`. Combined with C2 this double-sells. |
| **Why it matters** | Live venues always have a backup laptop. Silent dual control is the failure mode that produces C1/C2 in the real world. |
| **Minimal fix** | (1) Pass `tabId` on every operator mutation; `if (holder !== tabId) return 409`. (2) Heartbeat expired reclaim via Redis Lua / `SET NX` after delete, never blind `SET`. (3) On heartbeat failure, client must leave `controller` (or mark `uncertain` and disable mutations). Keep explicit `/takeover` for intentional failover. |

---

# 2. HIGH

---

### H1. Undo is not limited to the last outcome and is allowed while another player is on the block

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Path** | `auction.ts` `2658–2706` |
| **Function/route** | `POST …/auction/undo` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Always reverses the latest `bids` row in the tournament, even if `currentPlayerId` is set. Repeated undo walks sale history. Session `currentPlayerId` is **not** cleared. ₹0 manual sells create **no** bid, so they are invisible to undo. |
| **Expected behaviour** | Undo only the last concluded lot, only when no player is on the block (or only that lot’s outcome), and block a second undo without a new sale. |
| **Reproduction** | Sell A, next-player B, Undo → A returns to pool, B stays on block, A’s purse restored. Undo again → previous sale reversed. |
| **Why it matters** | Fat-finger during a live lot silently unsells a previous player. Roster on LED/owner panels jumps. |
| **Minimal fix** | Reject undo if `currentPlayerId` is set; require `lastOutcome.type==='sold'` matching that bid; optional one-undo-per-lot flag. Always insert a `bids` row for ₹0 manual sells. |

---

### H2. Sell / manual-sell do not re-validate purse, max squad, or category at commit time

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Path** | Bid checks: `auction.ts` `1635–1694`. Sell: **no** re-check. Manual-sell: maxAllowedBid only if `amount > 0` (`1987–1992`); **no** max squad / category. |
| **Function/route** | `POST …/auction/sell`, `POST …/auction/manual-sell` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Caps are enforced when the raise is placed, not when the player is awarded. Booster cancel, squad fill via another lot, or category PATCH between bid and sell can make the award illegal. Manual sell can exceed max squad / category by design of the handler. |
| **Expected behaviour** | Award-time server enforcement of the same gates as bid (with an explicit, audited override flag if operators truly need one). |
| **Reproduction** | Team at max squad minus 1 bids; another manual-sell fills the slot; original sell still awards. Or cancel booster after a high bid, then sell. |
| **Why it matters** | Final roster/purse can violate the published rules even though every bid looked legal. |
| **Minimal fix** | Re-run `computeTeamPurseProtection` + squad + category inside the sell/manual-sell transaction before writing. |

---

### H3. API re-auction of a retained player leaves `purseUsed` including retained spend

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Path** | `auction.ts` `2187–2242`. Purse reverse only if `player.status === "sold" && teamId && soldPrice`. Operator UI hides the button for retained (`auction-operator.tsx` ~2232). |
| **Function/route** | `POST …/auction/re-auction` |
| **Status** | **CONFIRMED** (API). UI-gated for the normal operator. |
| **Current behaviour** | Retained player is set `available`, `teamId=null`, **no** purse reverse (retained lives in `retainedPrice`, not `soldPrice`). |
| **Expected behaviour** | Reject `status === 'retained'`, or reverse retained spend and `recalcTeamPurseUsed`. |
| **Reproduction** | `POST /re-auction` with a retained player id while no one is on the block. |
| **Why it matters** | Direct API / scripted ops (or a future UI slip) silently inflates used purse vs roster. |
| **Minimal fix** | `if (player.status === 'retained') return 400`. |

---

### H4. GET `/auction` has no `eventVersion`; in-flight state builds can publish a stale snapshot

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Path** | `auction.ts` `buildAuctionStateInner` result `914–964` (no `eventVersion`); GET `1204–1208`; cache write `getCachedOrBuildState` `995–1022` (500ms TTL, last writer wins, no generation). Client HTTP bid ACK is gated (`lib/auction/src/auction-bid-sync.ts` `decideBidMutationApply`). React Query **poll** uses the GET body directly. SSE reconnect: `use-auction-socket.ts` `new EventSource(url)` without `Last-Event-ID` (full snapshot). |
| **Function/route** | `GET …/auction`, `GET …/auction/events` |
| **Status** | **CONFIRMED** cache stampede; poll overwrite **CONFIRMED in code**, race depends on timing. |
| **Current behaviour** | Bid invalidates cache then emits SSE delta. A `buildAuctionState` that **started before** the bid can finish **after** and write the old leader into `_stateCache` for up to 500ms. New SSE clients in that window get the wrong snapshot. When SSE is `reconnecting`/`disconnected`, operator polls every 5s (`sseAwareRefetchInterval`) and can replace a newer SSE merge with a versionless GET. |
| **Expected behaviour** | Snapshot carries `eventVersion`. Clients ignore HTTP whose version is behind the SSE cursor. Cache writes must not land if a newer mutation generation exists. |
| **Reproduction** | Rapid bids + a slow `buildAuctionState` (~300ms+ is already logged as slow). Open a new LED tab immediately after a bid. Or drop SSE for 5s on the operator and allow poll. |
| **Why it matters** | LED/OBS can show the previous bidder as leader. Usually brief, but it is exactly the “wrong live display” failure. |
| **Minimal fix** | Stamp `eventVersion` on GET and broadcasts; generation token on `_stateCache`; client: reject versionless GET while `cachedVersion > 0` unless SSE is disconnected **and** the payload’s bid/timer is not older than cache. |

---

### H5. Redis publish failure fans out only to the local node

| Field | Detail |
|---|---|
| **Severity** | HIGH (multi-instance). MEDIUM if production is pinned to one API process. |
| **Path** | `artifacts/api-server/src/lib/auction-events.ts` `publishAuctionEvent` `118–149` |
| **Function/route** | `publishAuctionEvent` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | On Redis publish error: `markRedisUnavailable` then `writeSseToLocalClients` only. Other app instances stop receiving bids until poll/reconnect. Version INCR may have already advanced on Redis before publish failed (or fallen back to local counters) — version planes can split. |
| **Expected behaviour** | All connected displays follow one event plane, or the instance fails closed with a visible operator alarm — not silent split-brain. |
| **Reproduction** | Two API instances, Redis briefly rejects `PUBLISH`. Instance A’s owners see the bid; instance B’s LED does not. |
| **Why it matters** | Venue LED on a different node than the operator shows a stale auction. |
| **Minimal fix** | Health-check Redis; if pub/sub is down, refuse new bids or force all SSE onto one instance; never mix Redis INCR with in-memory versions for the same tournament. |

---

### H6. OBS presentation context writes LED overlay fields (and LED MAIN resets OBS)

| Field | Detail |
|---|---|
| **Severity** | HIGH (operational / display). Not purse corruption. |
| **Path** | `POST …/auction/presentation-context` `auction.ts` `2816–2863` spreads `ledOverlaySessionPatch(...)` into the same session row. LED MAIN: `presentationContextAfterLedOverlay('off')` forces OBS `context: 'auction'` (`led-overlay-patch.ts` `83–90`). Tests in `led-overlay-patch.test.ts` document OBS→LED mapping as intended. |
| **Function/route** | `presentation-context`, `display-overlay` |
| **Status** | **CONFIRMED** coupling |
| **Current behaviour** | Switching OBS to Top 5 / Team also sets LED `displayOverlay`. LED Team/Player/Top5/Banner do **not** rewrite OBS, except LED MAIN VIEW which **does** reset OBS to live auction (commit `617ecc6b`). |
| **Expected behaviour** | If APL runs a hall LED and an OBS stream as independent outputs, mode switches must not move the other surface. If a single director is supposed to drive both, this is intended — then document it as a runbook constraint, not a bug. |
| **Reproduction** | LED on Main (live player). Operator switches OBS to Top 5. LED wall follows Top 5. |
| **Why it matters** | Hall audience loses the live player while the stream shows Top 5 (or the reverse on MAIN). |
| **Minimal fix** | Stop spreading `overlayPatch` from `presentation-context` if independence is required; keep only the documented MAIN→OBS follow. |

---

### H7. Owner LiveBid max-bid fallback ignores boosters and reserve if `teamPurses` is missing

| Field | Detail |
|---|---|
| **Severity** | HIGH (UI). Server still rejects over-max bids. |
| **Path** | `artifacts/owner-app/src/screens/LiveBid.tsx` `1712`; similar operator fallback `auction-operator.tsx` `1515`. Footer helper in tests prefers null (`owner-live-bid-purse.test.ts`). Bid button path still uses the fallback. |
| **Function/route** | `LiveBid` `canBid` / `maxAllowedBid` |
| **Status** | **CONFIRMED** in UI; server gate **ALREADY SAFE** |
| **Current behaviour** | `teamPurse?.maxAllowedBid ?? (team.purse - purseUsed)` — no booster, no future reserve. |
| **Expected behaviour** | If snapshot is missing, disable Bid (or show “syncing”), never a higher local ceiling than the server. |
| **Reproduction** | Reconnect with auction state but empty `teamPurses`; owner sees Bid enabled; server returns 400. |
| **Why it matters** | Panic / “app is broken” during live bidding; not a silent invalid accept. |
| **Minimal fix** | Treat missing snapshot as `maxAllowedBid = null` → `canBid = false`. |

---

### H8. Category occupancy shown to owners includes non-playing members; bid gate excludes them

| Field | Detail |
|---|---|
| **Severity** | HIGH (display vs server disagreement on “full”) |
| **Path** | State counts: `auction.ts` `605–622` (no NPM filter). Bid gate: `1679–1680` (`!isNonPlayingMember`). LiveBid: `1727–1732` uses state counts. |
| **Function/route** | `buildAuctionStateInner` vs `POST …/auction/bid` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | UI can show category full while the server still accepts a bid (or the reverse if an NPM is later flagged). |
| **Expected behaviour** | Same NPM rule in snapshot and bid gate. |
| **Reproduction** | Team has `maxPlayers` NPMs + sold in a category. Owner button disabled; organizer proxy bid may still work (or owner thinks they cannot bid). |
| **Why it matters** | Category rules are part of APL-style auctions. Split SOT causes disputed eligibility. |
| **Minimal fix** | Apply the same `!isNonPlayingMember` filter when building `teamCategoryPlayerCounts`. |

---

### H9. Multi-team purse booster apply is not one transaction

| Field | Detail |
|---|---|
| **Severity** | HIGH |
| **Path** | `artifacts/api-server/src/routes/purse-boosters.ts` `206–265` |
| **Function/route** | `POST …/purse-boosters` `target: "all"` |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Loop of inserts + audit. Mid-loop failure leaves some teams boosted and some not. LED overlay is built from `applied` only. Cancel is a separate check-then-update (TOCTOU with two cancels / a concurrent sell). |
| **Expected behaviour** | All-or-nothing apply; cancel `WHERE status='active'` inside a capacity lock. |
| **Reproduction** | Apply booster to all teams; crash/timeout after N inserts. |
| **Why it matters** | Owner panels and LED toast show mixed capacities; max-bid math diverges across teams mid-auction. |
| **Minimal fix** | Single `db.transaction` for the batch; cancel with conditional update. |

---

# 3. MEDIUM

---

### M1. Bid authorization is access-code only — owner session cookie is unused

| Field | Detail |
|---|---|
| **Severity** | MEDIUM (defense in depth). **Not** an open anonymous bid hole. |
| **Path** | Bid: `auction.ts` `1594–1629`. Session: `lib/auth/src/owner-auth.ts`; `teams.ts` `verify-access` `569+`. Logout clears storage and revokes cookie; bid still accepts the code. |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Non-organizers must present the team access code (timing-safe). Empty team code → 403. Wrong tournament `teamId` → 403 via `requireTeamInTournament`. Organizers may bid without a code. Anyone who knows the code can `POST /bid` without the owner cookie. Verify-access allows empty code (`!team.accessCode \|\| match` at `teams.ts` 587) while bid rejects codeless teams — inconsistency. |
| **Expected behaviour** | Access code remains the shared secret; optionally also require `requireVerifiedOwnerSession` so logout actually stops bidding from that browser’s stolen cookie jar. Align verify-access with bid for empty codes. |
| **Reproduction** | `POST /auction/bid` with correct `teamId` + `accessCode`, no cookie → 200 if the raise is valid. |
| **Why it matters** | Codes are often shared on WhatsApp in club auctions. Session-binding would not stop that, but it would stop “logged out but still bidding via replayed code in a script” and align logout with operator expectation. |
| **Minimal fix** | Require verified owner session **or** organizer; keep accessCode as second factor. Reject verify-access when the team has no code unless organizer. |

---

### M2. Live bid events are fire-and-forget analytics; `bids` table is sell-only

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Path** | `auction.ts` `1727–1738` `logBidEvent`; `bids` insert only in sell/manual-sell. |
| **Status** | **CONFIRMED** by design |
| **Current behaviour** | Authoritative live leader is `auction_sessions`. Analytics `auction_bid_events` can miss or reorder. Displays use session + SSE, not the analytics table. |
| **Expected behaviour** | For disputes, reconstruct from session + SSE buffer, not analytics. If a full bid ladder is required for APL, persist raises in the same CAS transaction. |
| **Why it matters** | Post-auction “who bid what” reports can disagree with what the hall saw. |
| **Minimal fix** | Insert a raise ledger row in the bid CAS transaction, or clearly mark analytics as non-authoritative in the runbook. |

---

### M3. SSE reconnect always takes a full snapshot (no `Last-Event-ID`)

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Path** | `artifacts/auction-platform/src/hooks/use-auction-socket.ts` `94–120`; owner-app copy `artifacts/owner-app/src/hooks/use-auction-socket.ts` `43–48`. Server replay exists (`auction.ts` `1145–1169`, buffer 500). |
| **Status** | **CONFIRMED** |
| **Current behaviour** | `close()` + new `EventSource` does not send `Last-Event-ID` → `afterVersion=0` → full snapshot. Gap >500 also snapshots. This **recovers**, it does not replay. |
| **Expected behaviour** | Snapshot recovery is acceptable if the snapshot is not stale (see H4). |
| **Reproduction** | Kill network 30s, restore. New snapshot; missed deltas not replayed. |
| **Minimal fix** | Pass last seen version as `Last-Event-ID` **after** H4 is fixed so snapshots cannot regress. |

---

### M4. Category rules can be PATCHed mid-auction; next bid uses the new min/increment/max with no freeze

| Field | Detail |
|---|---|
| **Severity** | MEDIUM (ops) |
| **Path** | Category PATCH routes; bid increment `resolveActiveBidIncrement` `auction.ts` `419–442`; opening `lib/auction/src/re-auction-strategy.ts` `resolveOpeningBid`. |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Engine **does** enforce current category min/increment/`maxPlayers`. Editing config live changes the next raise. |
| **Expected behaviour** | Either freeze category economics when `session.status==='active'`, or require an audited “rules change” broadcast. |
| **Reproduction** | Change category increment while a player is on the block. Next bid must match the new increment. |
| **Minimal fix** | Reject category economic PATCHes while auction is active, or snapshot rules onto the session at nomination. |

---

### M5. Opening bid on single-player re-auction uses `player.basePrice` / `soldPrice`, not `resolveOpeningBid`

| Field | Detail |
|---|---|
| **Severity** | MEDIUM |
| **Path** | `auction.ts` `2222` `startingBid = startFromBase ? player.basePrice : (player.soldPrice ?? player.basePrice)`. Next-player uses `resolveOpeningBidForPlayer` (category min). |
| **Status** | **CONFIRMED** |
| **Current behaviour** | Re-auction can open below category min bid if `basePrice` is lower. |
| **Expected behaviour** | Same opening function as next-player, honoring category min and bulk strategy. |
| **Reproduction** | Category min ₹50k, player base ₹20k, re-auction with `startFromBase: true`. Session `currentBid` is 20k. |
| **Minimal fix** | Call `resolveOpeningBidForPlayer` in the re-auction handler. |

---

# 4. LOW

---

### L1. No HTTP idempotency key on bid

Successful bid + client retry returns 409 `"already the highest bidder"` or `stale_bid`, not a replay of the ACK. Owner UI maps “already the highest bidder” → phase `leading`. Not a double-accept (CAS prevents that). Cleanup: accept `Idempotency-Key` and return the prior ACK.

### L2. Auction endpoints skip rate limits

`artifacts/api-server/src/lib/rate-limiters.ts` `isAuctionEndpoint` — intentional so live bidding is not frozen. Residual abuse risk if access codes leak (see M1).

### L3. `auction_sessions.soldPlayersCount` / `unsoldPlayersCount` columns exist but live state counts from the players table

Display counts are rebuilt from roster. Column drift is cosmetic unless something still reads the columns.

### L4. Wheel / cheer / fan-battle are not durable across API restart

Not money-critical. LED would drop the wheel overlay until re-triggered.

---

# 5. ALREADY SAFE

Verified on this branch. Do **not** treat the stale 2025/2026 readiness audit as current.

| # | Control | Where | Notes |
|---|---|---|---|
| S1 | Competing bids: exactly one next state | `auction.ts` `1699–1725` | Optimistic `revision` CAS. No row lock, but equivalent for **bid vs bid**. |
| S2 | Exact opening bid / exact increment / no jump-bid | `lib/auction/src/auction-bid.ts` `validateBidAmount` | Opening = `currentBid` while `currentBidTeamId == null`; else `currentBid + increment`. |
| S3 | Consecutive same-team bid blocked | `auction.ts` `1584–1587` | 409 if already leader. Parallel double-tap: CAS, one 200, one `stale_bid`. |
| S4 | Category increment / min bid used by engine | `resolveActiveBidIncrement`, `resolveOpeningBid` | Category `bidTiers` / `bidIncrement` override tournament tiers. Opening: `categoryMinBid` if >0 else `player.basePrice` (`keep_existing`). |
| S5 | Purse math SOT | `lib/auction/src/purse-protection.ts` `computePurseProtection` | `effectiveCapacity = purse + boosters`; `maxAllowedBid = remaining − futureReserve`. Bid uses `maxAllowedBid`. Snapshot: `team-purse-snapshot.ts`. Tests: `purse-validation-matrix.test.ts`, `owner-live-bid-purse.test.ts`. |
| S6 | Boosters do not mutate `teams.purse` | `purse_boosters` schema + `purse-capacity.ts` | Cancel blocked if capacity would fall below `purseUsed`. Reset-trial cancels boosters in the same tx. |
| S7 | Access code + tournament membership on bid | `auction.ts` `1590–1629`, `team-tournament-guard.ts` | Empty code rejected; timing-safe compare; forged cross-tournament `teamId` rejected. |
| S8 | Sell/unsold/re-auction/undo/reset **internal** writes are transactional | `auction.ts` txs at 1811, 1996, 2128, 2227, 2339, 2469, 2687 | Partial **in-handler** failure rolls back those tables. (Races **across** requests are C1–C4.) |
| S9 | Purse increment/decrement is SQL-atomic | `COALESCE(purse_used,0)+X` / `GREATEST(0,…-X)` | No lost update on the column itself when a **single** statement runs. |
| S10 | Next-player uses revision CAS | `auction.ts` `1502–1523` | Two simultaneous next-player calls: one wins. |
| S11 | Client stale HTTP bid ACK vs newer SSE | `lib/auction/src/auction-bid-sync.ts` `decideBidMutationApply`; `sync-auction-sse.ts` `applyMutationAuctionState` | `reject_stale` / monotonic version. Rapid-bid stress tests cover this client gate. |
| S12 | SSE gap >500 → full snapshot | `auction.ts` `1154–1164`, `EVENT_BUFFER_MAX=500` | Corrupt buffer entries skipped in `getEventsAfter`. |
| S13 | Owner bid button cannot stick forever | `BID_ACK_TIMEOUT_MS=8000`, watchdog 10s, `use-bid-lifecycle.ts` | Timeout ≠ server rollback. |
| S14 | Polling disabled while SSE `connected` | `sse-polling.ts` | Operator 5s / LED 10s / viewer 30s fallback when not connected. |
| S15 | Trial team gate on bid and sell | `assertTeamAllowedInTrialAuction` | Same first-N teams rule. |
| S16 | `isBiddingEnabled` honored | `auction.ts` `1592` | Disabled teams cannot bid. |
| S17 | Category delete blocked if players assigned | `categories.ts` | Invalid category ids in filter → empty pool, not a crash. |
| S18 | Re-auction unsold bulk only flips `unsold→available` in a transaction | `auction.ts` `2289+` | Does not nominate; opening applied later via strategy JSON. |
| S19 | Reset trial is one transaction across players, purseUsed, boosters, bids, intel, session | `auction.ts` `2377–2579` | Safe for practice auctions. |
| S20 | LED overlay patch TTL (3s) | `led-overlay-patch.ts` | Reduces stale rebuild flipping Top 5. |
| S21 | Viewer / LED / OBS share `useAuctionSocket` + `useGetAuctionState` | display-shell / liveviewer / obs-overlay / `use-led-view.ts` | Same auction state object; overlay fields differ. |

---

# 6. TEST COVERAGE GAPS

Existing tests that **do** help:

| Area | Tests |
|---|---|
| Bid amount sequence | `artifacts/api-server/src/__tests__/auction-bid.test.ts`, `auction-transactions.test.ts` (pure `validateBidAmount`) |
| Purse / reserve / booster math | `lib/api-base/src/__tests__/purse-protection.test.ts`, `purse-capacity.test.ts`, `artifacts/api-server/src/__tests__/purse-validation-matrix.test.ts`, `owner-live-bid-purse.test.ts`, `owner-live-bid-squad.test.ts` |
| Client stale HTTP vs SSE | `auction-bid-sync.test.ts`, `rapid-bid-stress.test.ts` (simulated OCC + client merge; **not** live sell/pause races) |
| Opening / re-auction strategy | `re-auction-strategy.test.ts` |
| Transaction **presence** (mocked DB) | `auction-transactions.test.ts` — asserts `db.transaction()` is called; **cannot** prove Postgres rollback or CAS |
| Access lockout / serializers hide codes | `security-hardening.test.ts`, `access-lockout-override.test.ts` |
| LED/OBS overlay coupling | `led-overlay-patch.test.ts` |
| Connection banners | `auction-connection-state.test.ts` |
| Reset-trial auth | `reset-trial-auth.test.ts` |

### Gap matrix

| FEATURE | EXISTING TEST | GAP | SEVERITY |
|---|---|---|---|
| Simultaneous cross-team bids at same `currentBid` | Rapid-bid stress (simulated revision) | No integration test hitting real `UPDATE … WHERE revision` against Postgres with two HTTP clients | HIGH (logic S1 is code-confirmed; still untested in CI against DB) |
| Consecutive same-team bid | Unit comment in `auction-transactions.test.ts` that route (not `validateBidAmount`) checks team | No HTTP 409 test on the route | MEDIUM |
| Stale bid (wrong amount after another raise) | `validateBidAmount` unit | No HTTP test that CAS 409 maps to owner UI | MEDIUM |
| Duplicate bid / double-click | Client phase machine | No idempotency-key test; no parallel same-team HTTP | HIGH |
| Bid vs pause / stop-timer | **None** | C3 untested | CRITICAL |
| Bid vs unsold / manual-sell (ghost leader) | **None** | C3 untested | CRITICAL |
| Bid vs sell (wrong winner) | UI sends `expectedBid*`; no overlapping HTTP test | C1 untested | CRITICAL |
| Double sell / retried sell | UI `isPending` only | C2 untested | CRITICAL |
| Purse exhaustion / exact increment remaining | `purse-validation-matrix` math | No HTTP bid at `maxAllowedBid` vs `maxAllowedBid+increment` against DB | HIGH |
| Max squad / min squad / category cap | squad/purse unit tests; bid handler logic | No HTTP sell/manual-sell re-validation test | HIGH |
| Booster apply-all atomicity / cancel vs sell | capacity unit tests | No multi-row tx / TOCTOU test | HIGH |
| Sell transaction vs concurrent bid | **None** | C1 | CRITICAL |
| Undo transaction / double undo / undo on-block | **None** | C4, H1 | CRITICAL |
| Re-auction retained | **None** | H3 | HIGH |
| Owner auth on bid (empty/missing/wrong code, forged teamId, no cookie) | Lockout on **verify-access** only | Bid route untested | HIGH |
| Operator lock dual acquire / heartbeat TOCTOU / mutation without holder | **None** (`getOperatorLockHolder` unused outside module) | C5 | CRITICAL |
| SSE reconnect `Last-Event-ID` | Server replay code untested from client | M3 | MEDIUM |
| Stale HTTP GET vs SSE cursor | Bid ACK gated; GET not | H4 | HIGH |
| Display reconnect LED/OBS/viewer | Overlay unit tests | No e2e reconnect | HIGH |
| Redis publish fail multi-node | **None** | H5 | HIGH |

`auction-transactions.test.ts` header states the DB is **mocked**. Do not treat “transaction() was invoked” as proof of atomicity under concurrency.

---

## Primary-flow traces (short)

### Bid engine

1. All enabled, trial-eligible teams may bid while `status==='active'` and timer is open (S16, pre-checks).  
2. Consecutive same-team: blocked while leading (S3).  
3. Opening / increment / category: enforced (S2, S4).  
4. Concurrent A/B same amount: **one** CAS winner (S1).  
5. Rapid-fire 5–10 teams: serialized by revision; no auction rate limit (L2).  
6. Double-click / retry / duplicate HTTP: second request 409, not a second leader (S1, L1).  
7. Out-of-order HTTP ACK vs SSE: client rejects stale ACK (S11). Out-of-order SSE bid amounts: `shouldApplyBidDelta` rejects regression.  
8. DB vs analytics vs display: session is SOT; analytics can disagree (M2); display can briefly disagree (H4).  
9. Concurrency guarantee on **bids**: **revision compare-and-set**. No transaction around bid, no `FOR UPDATE`, no unique live-bid constraint. **Equivalent for bid-vs-bid. Not equivalent for bid-vs-operator** (C1, C3).

### Purse / roster

Server `computePurseProtection` is authoritative. Owner/operator/LED **should** use `teamPurses`. Fallback paths (H7) and category NPM counts (H8) can diverge. Boosters included in snapshot when present; apply-all is not atomic (H9).

### Sell / unsold / undo / re-auction

Atomic **within** one request (S8). Not serialized **across** requests (C1–C4, H1–H3). Unsold does not touch purse (safe). Re-auction unsold bulk restores eligibility (`unsold→available`) (S18). Undo purse uses `bid.amount` (matches sell insert); edited `soldPrice` via player PATCH can desync (not CRITICAL unless ops edit sold prices live).

### Owner login

Server-side code check on bid: yes (S7). Session on bid: no (M1). Frontend guards are not trusted for bid accept/reject.

### Operator Device A drop → Device B

TTL 8s then B can acquire. A remains UI-controller. Mutations unconstrained. **Two controllers: yes** (C5).

### Internet failure (what the code does)

| Scenario | User sees | Persisted? | Duplicate? | Auto recover? |
|---|---|---|---|---|
| Owner idle, 5s drop | Reconnecting → disconnected banner; poll if SSE down | N/A | N/A | SSE reconnect + snapshot (M3) |
| Owner bidding in flight | Spinner ≤8s then timeout/watchdog | If CAS committed: yes, even if ACK lost | Retry 409 if still leading | Refresh not required if SSE returns |
| Owner tap then immediate drop | Same | Same | Same | Same |
| Operator drop | Lock UI stale-controller; mutations may still fire if they retry when back | Yes if HTTP reached server | Dual device → C2 | Manual takeover intended but not required by server |
| Display drop | Banner; poll 10–30s | N/A | N/A | Snapshot; possible stale cache (H4) |
| Redis down | Local SSE only (H5) | DB yes | N/A | Poll/reconnect |
| API down | All fail | Uncommitted no | Retry after restore: C1/C2 if sell retried | Manual refresh |
| Refresh during outage | Full GET snapshot | N/A | N/A | Yes, if API up |

---

## Minimal fix order (do not implement in this PR)

1. **C5** — bind operator mutations to lock holder; fix heartbeat CAS; fail closed on heartbeat loss.  
2. **C1 + C2** — sell/manual-sell revision + player-status CAS; unique sold bid; re-validate purse/squad.  
3. **C3** — bid `WHERE` includes status/timer/player/leader; bump revision on pause/stop/unsold/manual-sell.  
4. **C4 + H1** — locked, single-step undo; block while a player is on the block.  
5. **H4** — `eventVersion` on GET + cache generation.  
6. Tests from the gap matrix for C1–C5 against a real Postgres, not mocks.

---

## GO / NO-GO FOR REAL AUCTION

**NO-GO** — bid-vs-bid is safe, but sell/undo/timer/operator-lock races can still award the wrong team, double-count purse, or run two controllers on a live APL night.
