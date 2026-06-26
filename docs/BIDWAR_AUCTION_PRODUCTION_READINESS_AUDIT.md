# BidWar Auction Engine — Production Readiness Audit

**Scope:** Live auction workflow end-to-end — player sequencing, bidding, purse calculation, sold/unsold logic, SSE realtime sync, browser refresh recovery, reconnection handling, duplicate-event prevention, race conditions, transaction safety, database consistency, multi-device sync, production logging, error handling, network-interruption recovery.

**Method:** Static analysis of the live auction stack:
- `artifacts/api-server/src/routes/auction.ts` (~2,890 LOC — all auction HTTP endpoints)
- `artifacts/api-server/src/lib/auction-events.ts`, `auction-broadcast.ts`, `auction-sse-payload.ts`, `broadcast.ts` (SSE + Redis pub/sub plane)
- `artifacts/api-server/src/lib/operator-lock.ts`, `purse-protection.ts`, `auction-logger.ts`
- `artifacts/auction-platform/src/hooks/use-auction-socket.ts`, `use-mutation-sync.ts`, `use-operator-session-lock.ts`
- `artifacts/auction-platform/src/lib/sync-auction-sse.ts`, `sse-reconnect.ts`, `sse-polling.ts`
- `lib/db/src/schema/auction_sessions.ts`, `teams.ts`, `players.ts`, `bids.ts`
- `lib/api-base/src/auction-bid.ts`, `auction-player-selection.ts`

**No code was modified.** Severity reflects impact on a live, money-bearing tournament.

---

## TL;DR — Top 5 Risks (matches user's hisaab)

| # | Risk | Severity | Where |
|---|------|----------|-------|
| 1 | Race condition writes wrong winning bid / overwrites earlier bid | **CRITICAL** | `POST /auction/bid`, no row lock or `WHERE current_bid=…` guard |
| 2 | Sell / Unsold / Re-auction / Undo touch 3–4 tables with **no transaction** — partial failures leave purse, player.status, bids out of sync | **CRITICAL** | `/auction/sell`, `/auction/manual-sell`, `/auction/unsold`, `/auction/undo`, `/auction/re-auction` |
| 3 | `/auction/bid` has **no organizer/owner authentication** when `team.accessCode` is null/empty — any unauthenticated browser can place valid bids | **CRITICAL** | `routes/auction.ts:1179-1346` |
| 4 | Realtime sync diverges silently: HTTP mutation responses overwrite newer SSE state because GET/mutation responses carry **no event version** | **HIGH** | `use-mutation-sync.ts` + `sync-auction-sse.ts` |
| 5 | Reconnect / refresh works for the persisted core, but SSE replay buffer corruption silently degrades to "full snapshot" without warning, masking event loss; in-memory wheel / cheer / fan-battle state is lost on restart | **HIGH** | `auction-events.ts:128-154`, in-memory maps in `routes/auction.ts:2690-2802` |

---

## CRITICAL

### C1. Bid race condition — two teams bidding simultaneously can both succeed; the earlier bid is silently overwritten
**Location:** `artifacts/api-server/src/routes/auction.ts:1179-1346` (`POST /tournaments/:id/auction/bid`)

**Root cause:** Bid validation reads `session.currentBid` and `session.currentBidTeamId` into local variables, then issues a plain `UPDATE auction_sessions SET current_bid=?, current_bid_team_id=?, timer_ends_at=?` with `WHERE tournament_id=?` — no `AND current_bid=? AND current_bid_team_id=?` guard, no `SELECT … FOR UPDATE`, no row version column on `auction_sessions`.

Two clients (e.g., Team A and Team B at `currentBid=100k`, `increment=20k`) both read `currentBid=100k`, both call `validateBidAmount(120000, …)` → both pass. Both then `UPDATE … SET current_bid=120000, current_bid_team_id=A` / `…=B`. Last writer wins. The team that "won" the race is recorded as leader; the other team's bid is silently dropped from the session even though `logBidEvent` fire-and-forget records it in `auction_bid_events`. Both SSE `bid` deltas are emitted; clients merge the second one over the first, so the displayed leader flips and the auction history (`auction_bid_events`) contains a bid that never appears as a leader event. The lost team thinks they're leading until a state refresh corrects them.

**Why it matters in production:** Owner panels (4–8 phones) issue bids at >1 req/s during the last seconds of bid timer. The window for collision is the network RTT (50–250 ms on mobile). On a 30-team auction this will happen multiple times per session and produce disputed winning bids.

**Recommended fix (do not implement yet):**
- Wrap the bid handler in `db.transaction(async (tx) => …)` with a `SELECT … FOR UPDATE` on `auction_sessions` row keyed by `tournamentId`, or
- Use a conditional update: `UPDATE auction_sessions SET … WHERE tournament_id=? AND current_bid=? AND COALESCE(current_bid_team_id,-1)=COALESCE(?,-1) RETURNING id` — if row count == 0, retry by re-reading state and rejecting if amount is now stale.
- Increment an integer `version`/`revision` column on every session mutation and use it as the conditional predicate (cleaner than comparing every column).

### C2. No DB transactions across multi-table auction mutations — partial-failure leaves purse, player status, bids inconsistent
**Locations:**
- `/auction/sell` — `routes/auction.ts:1349-1490` (4 sequential writes: players, teams, bids, auction_sessions)
- `/auction/manual-sell` — `routes/auction.ts:1491-1630`
- `/auction/unsold` — `routes/auction.ts:1633-1699`
- `/auction/re-auction` — `routes/auction.ts:1702-1793` (reverses purse, deletes bids, updates player, updates session)
- `/auction/undo` — `routes/auction.ts:2205-2315` (reverses purse, deletes bid, updates player, updates session)
- `/auction/reset-trial` — `routes/auction.ts:1849-2010` (deletes from 4 tables, updates players, teams, sessions, tournaments in a loop)

**Root cause:** Each handler calls `db.update(...)`, `db.insert(...)`, `db.delete(...)` as independent statements. No `db.transaction(...)` wrapper exists anywhere in this file. If the API process is restarted (deploy, OOM, Render cold-recycle), or Postgres drops the connection between two `await`s, or any subsequent statement throws (e.g., notifyPlayerSold synchronous failure — though it is awaited only as fire-and-forget so probably not — but `db.insert(bidsTable)` could throw on FK), the auction is left in a half-applied state:

- **Sell partially applied**: `players.status='sold', players.teamId=X` written, but `teams.purseUsed` increment fails → team's purse shows wrong value forever; bid row missing → reports under-count revenue.
- **Undo half-applied**: `players.status='available'` and `players.teamId=null` succeed but `teams.purseUsed -= bid.amount` fails → that team can over-spend.
- **Reset half-applied**: some players reset, some not — operator believes a clean slate, runs the live auction, mid-way old "sold" players appear.

**Why it matters:** Every one of these endpoints touches money state. A single network blip between the two `await db.update(...)` calls strands the auction.

**Recommended fix (do not implement yet):** Wrap each mutation in a single `db.transaction((tx) => …)`. All `db.…` calls become `tx.…`. Logging / WhatsApp / SMS / push side-effects remain outside the transaction (fire-and-forget after commit).

### C3. `/auction/bid` is publicly callable for any team without an `accessCode`
**Location:** `routes/auction.ts:1179-1228`

**Root cause:** Only sell / manual-sell / unsold / undo / start / pause / etc. call `requireTournamentOrganizer`. The bid endpoint deliberately omits it (comment at top of file says rate-limiting is also omitted to "support rapid bidding"). Auth is gated by:
```ts
if (team.accessCode && !isTournamentOrganizer(req, tid, tournament?.organizerId)) {
  if (!accessCode || team.accessCode.toUpperCase() !== accessCode.toUpperCase()) { … 403 … }
}
```
If `team.accessCode` is `null` or empty (which is the default in the DB schema — `teamsTable.accessCode` is nullable, not `notNull`), **the guard is fully bypassed**. Any anonymous browser that knows the public tournament ID + team ID can place a real bid that is recorded in `auction_bid_events`, becomes the session leader, and ultimately can win the player when the operator presses Sell.

This is also a denial-of-service vector: an attacker scripts opening bids on every player as soon as the timer opens, forcing the operator to fight constant invalid bids.

**Why it matters:** Owners forget to set access codes; defaults are blank. Even when codes are set, the comparison is a constant-time-free `.toUpperCase()` equality (timing attack on 4–6-char codes is feasible). Trial mode partially limits this (only first 2 teams can bid), but live licensed tournaments have all teams active.

**Recommended fix (do not implement yet):**
- Make `accessCode` non-null and required for every team, populated on team creation, with a strong default (UUID-like).
- Or require either an organizer JWT or an owner JWT scoped to that team (already plumbed for owner-app — extend the same auth here).
- Use a constant-time string compare (`crypto.timingSafeEqual`) — the same helper `safeCompare` is already defined for the reset endpoint at `routes/auction.ts:1871-1876` but not reused here.

### C4. Session/team/player rows have no concurrency-control column (no `version`, no `updated_at` predicate)
**Location:** `lib/db/src/schema/auction_sessions.ts:5-41`, `teams.ts:5-32`, `players.ts:5-68`

**Root cause:** None of these tables has a row-version integer / xmin / ETag column that the mutation handlers check against. The mitigation for C1 (compare-and-set) cannot be implemented cleanly without one. Same risk applies to `teams.purseUsed` updates from concurrent `/sell`, `/undo`, `/re-auction`, `/manual-sell` (Section C2): one ops panel + an automated bring-later script can drive double-write contention.

**Recommended fix (do not implement yet):** Add `revision INTEGER NOT NULL DEFAULT 0` to `auction_sessions` and `teams`, increment per write, use as a predicate in `UPDATE`.

### C5. Operator-lock fails open on network error — two tabs can both believe they're the controller
**Location:** `artifacts/auction-platform/src/hooks/use-operator-session-lock.ts:52-60`

```ts
try { …await postLock("acquire") … }
catch {
  // Fail open so a network blip does not block the auctioneer entirely.
  if (!cancelled) syncLockState(true);
}
```
If the laptop on the venue has a 5-second wifi drop during `acquire()`, the second tab on another device — which is already the controller — keeps heartbeating, but the new tab silently becomes a controller too. Both tabs can now drive `/start`, `/sell`, `/unsold`, `/next-player`. Combined with C2 (no DB transactions) this is the most likely path to a corrupted live auction in production.

**Recommended fix (do not implement yet):** Fail **closed** by default; show a "Lock unavailable — retrying" banner; surface a manual "Take over" button that issues a forced acquire (server-side) only when the operator confirms.

---

## HIGH

### H1. HTTP mutation responses overwrite newer SSE state because they carry no version
**Locations:**
- API: every mutation returns `res.json(await broadcastState(tid, …))` (or `broadcastBidDelta`, `broadcastSoldDelta`) — the returned payload is the raw `BuiltAuctionState` from `getCachedOrBuildState`, which has no `eventVersion` field. Compare against `auction-events.ts:101-126` where the SSE envelope DOES carry `version`.
- Client: `use-mutation-sync.ts:30-44` does `qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result)` with no version check.
- Client: `sync-auction-sse.ts:69-72` skips SSE messages whose version is ≤ the cached version, but the cached value written by `applyMutationResult` has no version stamp — so the version check passes any incoming SSE.

**Symptom:** A `/sell` mutation returns at T=200 ms (full state snapshot, no version). At T=180 ms the SSE `auction_state` v=51 has already updated the cache. At T=205 ms the SSE `auction_state` v=52 (from the sell publish) arrives. Between T=200 and T=205 ms the client cache holds the unversioned HTTP body, so v=52 is applied on top of that. This usually self-heals on next event, but during rapid bidding the cache can flicker visibly (winning team flips back and forth) and — worse — `teamPurses` from the HTTP body can overwrite a more-recent batch update.

**Recommended fix:** Include `eventVersion` in `BuiltAuctionState`. Set it from the same `getCurrentEventVersion(tid)` call that the SSE envelope uses, made *after* `publishAuctionEvent` so the version matches the broadcast. Or simply return only an ACK from mutations and let the SSE deliver state.

### H2. SSE replay degrades silently to "full snapshot" when buffer entries are corrupt or buffer max is exceeded
**Location:** `routes/auction.ts:817-848`, `lib/auction-events.ts:128-154`

```ts
const missed = await getEventsAfter(tid, afterVersion);
const latestVersion = await getCurrentEventVersion(tid);
const gap = latestVersion - afterVersion;
if (gap > 0 && (gap > EVENT_BUFFER_MAX || missed.length < gap)) {
  // … send full snapshot …
}
```
- `EVENT_BUFFER_MAX = 500` (Redis `lpush` + `ltrim`). Burst bidding (rapid bid → bid → bid) easily emits more than 500 events per tournament. After 500 events, any client that disconnected before is forced into a full-state replay with **no log line indicating how many events were lost**.
- `getEventsAfter` silently `skip`s entries that fail `JSON.parse`. A single corrupt entry (e.g., partial write during a Redis failover) drops one event from `missed.length`, triggering the snapshot path. This is silent.

**Symptom:** Display screens that briefly lose network re-attach, the server thinks "they missed too much, send the snapshot" — but the snapshot is the *current* state, not a list of bids; the cheer/heat/fan-battle state, `lastOutcome`, intermediate bid events, etc. are dropped. The display jumps from "Team A leading at 120k" to "SOLD: Team C 200k" with no intermediate frames.

**Recommended fix (do not implement yet):**
- Log a warning (with `gap`, `latestVersion`, `afterVersion`, `EVENT_BUFFER_MAX`) every time the snapshot fallback fires.
- Increase buffer to, e.g., 2000.
- Persist the buffer in Postgres for tournaments running multi-day breaks (Redis TTL is implicit and is gone after `FLUSHALL` / migration).

### H3. SSE event buffer + publish are not atomic — DB commit can succeed while SSE is dropped
**Location:** `routes/auction.ts:1309-1345` (and every other mutation handler); `lib/auction-events.ts:98-126`

The flow is:
1. `await db.update(auctionSessionsTable).set({…})`
2. `await broadcastBidDelta(...)` → `publishAuctionEvent(...)`:
   1. `await nextEventVersion(tid)` — Redis `INCR`
   2. `await setLastAuctionActivityAt(...)`
   3. `await bufferEvent(tid, serialized)` — `lpush + ltrim`
   4. `await redis.publish(...)`

If step 2.iv throws (e.g., Redis pub failure between command and broadcast — common on Redis failover), the DB is updated but no client gets the event. On next reconnect, the buffer DOES contain the event (step 2.iii succeeded), so replay works for clients that reconnect — but clients still connected at the moment of the failure never receive it. Their session is stale until the next event triggers their own reconnect (which only happens on TCP error). Worst case: a single sold player is invisible on the LED until the next bid is placed.

**Recommended fix:** Either (a) make `publishAuctionEvent` retry the publish with a short backoff and log, or (b) move the SSE write inside the same DB transaction by writing to a Postgres `LISTEN/NOTIFY` queue.

### H4. `purseUsed` updated by read-modify-write, not by `purse_used = purse_used + ?` — racy under concurrent `/sell` and `/manual-sell`
**Locations:**
- `routes/auction.ts:1371-1374` (sell)
- `routes/auction.ts:1536-1541` (manual-sell)
- `routes/auction.ts:1733-1737` (re-auction reverses)
- `routes/auction.ts:2237-2243` (undo reverses)
- `routes/auction.ts:1934-1943` (reset-trial recomputes from retained players)

```ts
const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
await db.update(teamsTable)
  .set({ purseUsed: (team?.purseUsed ?? 0) + soldAmount })
  .where(eq(teamsTable.id, teamId));
```

This is the textbook lost-update pattern. Two concurrent sells against the same team (e.g., operator double-clicks Sell, or undo + sell race) both read the *same* `purseUsed=300k`, both write back `300k+amount`. The earlier increment is lost. With C2 also unfixed, this corrupts the team purse silently.

**Recommended fix:** `tx.update(teamsTable).set({ purseUsed: sql\`${teamsTable.purseUsed} + ${soldAmount}\` }).where(...)` inside the same transaction.

### H5. Bid timer auto-extension recomputed from `session.timerEndsAt` that was already updated by the previous bid in the same window — extension can stack indefinitely
**Location:** `routes/auction.ts:192-211`, `1306-1319`

`computeBidTimerDuration` reads `session.timerEndsAt` to decide whether the new bid lands in the extension threshold. Two concurrent bids in the last 3 seconds (threshold) both observe `remaining=2 ≤ threshold=3` and both add `extensionSecs=5` on top of `remaining`. Result: timer endsAt jumps from now+2s to now+7s twice — but the second write overwrites the first, so it's fine numerically. However when extension chains across a long bidding war (10+ rapid bids each within the last 3 seconds), the timer can effectively never expire — the operator has to manually `stop-timer`. This is a design concern, not a bug, but it should be guarded by a *max-extensions-per-player* counter persisted on the session row.

### H6. `/sell` does not verify the latest bid value actually came from the team being sold to
**Location:** `routes/auction.ts:1349-1376`

```ts
const playerId = session.currentPlayerId;
const teamId = session.currentBidTeamId;
const soldAmount = session.currentBid ?? 0;
await db.update(playersTable).set({ status: "sold", teamId, soldPrice: soldAmount })…
```

The operator may have intended to sell to a *previous* state of the session. If a new bid arrived between when the operator clicked Sell on their UI and the request reaching the server, the player is sold to the wrong team. This is partially mitigated because the bid timer must be expired for a clean sell (line 1193 — but only on `/bid`, not `/sell`). Actually `/sell` does NOT require timer to be expired — the operator can sell mid-bidding. With concurrent bids racing in, the wrong team gets the player.

**Recommended fix:** Make `/sell` accept an `expectedBidId` (or `expectedCurrentBid + expectedTeamId + expectedTimerEndsAt`) and atomically verify in the same transaction; reject with 409 if state diverged.

### H7. `/next-player` race — two concurrent next-player requests can each pick a different player and only one is recorded; the other player is lost from the queue
**Location:** `routes/auction.ts:1039-1176`

Same root cause as C1. Both calls read `allAvailable` from the DB, both run `selectPlayerFromPool` (deterministic for sequential mode, random for random mode), both write `currentPlayerId=…`. For sequential mode, both pick the same player → no harm. For *random* mode, two different players are picked, last writer wins; the unpicked player's `randomDrawQueue` is overwritten too, breaking fair-draw guarantees.

**Recommended fix:** Same as C1 — transaction + conditional update.

### H8. Undo / re-auction racing each other or themselves can double-decrement `purseUsed` and corrupt totals
**Location:** `routes/auction.ts:1733-1747` (re-auction), `2237-2245` (undo)

`undo` reads `lastBid` from `bidsTable`, updates player.status, decrements `team.purseUsed`, deletes the bid. If undo is called twice in quick succession, both invocations read the *same* `lastBid`, both decrement, second one deletes (no-op already deleted). Net: team's purse is decremented twice for one sale. `Math.max(0, …)` clamps to 0 but the team can still over-spend on the next bid.

**Recommended fix:** Transaction + delete the bid first using a conditional `DELETE … WHERE id=? RETURNING …`; only proceed with purse decrement if the delete returned a row.

### H9. In-memory state lost on process restart (wheel auto-stop, cheer counters, heat, rate-limit)
**Locations:**
- `wheelSpinStopTimers` — `routes/auction.ts:91-121`
- `fanBattleCounters` — `routes/auction.ts:2699`
- `recentCheerTimestamps` — `routes/auction.ts:2702`
- `cheerRateLimiter` — `routes/auction.ts:2690-2696`
- `_stateCache` — `routes/auction.ts:717-754`

On Render/Cloudflare cold restart mid-auction:
- A wheel that was spinning at restart never auto-stops; the DB row stays `wheelSpinning=true` until the operator clicks again — display screens stuck on "spinning" forever.
- All cheer counts / heat reset to "CALM" mid-event — feels like cheering broke.
- The 500-ms state cache resets — first SSE replay batch will re-hit Neon for every reconnecting screen.

Also, **none of these are shared across instances**. If the deployment runs >1 Node process (Render's `numWorkers` or horizontal scale), each instance has its own counters / timers. Cheer counts on instance A don't show on instance B's clients.

**Recommended fix:** Move `wheelSpinStopTimers` to a single Redis key with TTL; `setInterval` on one instance per tournament (leader election via Redis lock) to poll for expired spins. Move cheer counters to Redis.

### H10. `validateExportToken` / mirror endpoint is the only path that writes session state without auth — security review needed
**Location:** `routes/auction.ts:2819-2887`

The `/auction/mirror` endpoint accepts a full session replacement (status, currentPlayerId, currentBid, timerEndsAt, etc.) gated solely by `validateExportToken`. If that token leaks (it's persisted in `tournaments.exportToken`) or expires-after timing is misconfigured, an attacker can replay-mirror a session. The Zod schema does **not** validate `status` against an enum (line 2838: `status: z.string()`) — any string is accepted into the DB. The cloud display screens consume this directly. **MEDIUM-bordering-HIGH** depending on token entropy and rotation; flagged HIGH because the consequences (resetting the live auction state from external) are catastrophic.

**Recommended fix:** `status: z.enum(["idle","active","paused","completed"])`; rate-limit `/mirror`; require organizer auth in addition to export token.

---

## MEDIUM

### M1. GET `/auction` mutates the DB while serving a read
**Location:** `routes/auction.ts:538-550` (inside `buildAuctionState`)
```ts
if (new Date(parsed.endsAt).getTime() <= Date.now()) {
  await db.update(auctionSessionsTable).set({ displayCountdown: null })…
}
```
Concurrent GETs all attempt the same UPDATE. Harmless per row but increases write traffic during reconnect storms (every reconnecting display issues a GET). Move the cleanup to a periodic sweeper.

### M2. `getCachedOrBuildState` 500 ms TTL cache is per-instance only
**Location:** `routes/auction.ts:717-741`
Multi-instance deployments will serve stale data to reconnecting clients for up to 500 ms after a mutation processed on another instance. Mutations invalidate only the local cache. Move the cache to Redis with the same TTL — or accept the staleness and document it.

### M3. Sequential player order uses primary-key `id`, not tournament-scoped `serialNo`
**Location:** `routes/auction.ts:186-189`
```ts
return { playerId: pool.reduce((a, b) => (a.id < b.id ? a : b)).id, … };
```
Players imported via bulk CSV get sequential `id`s, but players added manually later get higher `id`s regardless of their `serialNo`. The "Sequential" mode in the UI displays serial number to the operator but auctions by DB insertion order. This is surprising for organizers who pre-numbered their CSV (e.g., 1 = captain, 2 = vice-captain).

**Recommended fix:** Order by `players.serialNo ASC` instead of `id`.

### M4. Bid amount validation requires exact equality — proxying via a slow CDN that retries (`504 → retry`) can submit the bid twice from the client; the second submission is rejected, but if the bid update succeeded on the first try the team is left thinking the bid failed
**Locations:** `routes/auction.ts:1199-1213`, `auction-bid.ts:23-43`

If first attempt succeeded but the response was lost (5xx, timeout), `session.currentBidTeamId` is now equal to `teamId`, so the retry returns `409 Your team is already the highest bidder`. The owner-app UI must treat that 409 as success (since the bid actually went through). Currently `handleBid` `.catch(() => { invalidateFallback(); })` — it just invalidates and lets the user think it failed. The UI doesn't distinguish "duplicate succeeded" from "rejected".

**Recommended fix:** Use idempotency keys: client sends `Idempotency-Key: <uuid>` header; server stores key→result for 60 s; retries return the original 2xx.

### M5. Owner-app and operator-app both compute `nextBid` locally and submit — they can disagree on increment if a category was changed mid-auction
**Location:** `routes/auction.ts:362-386` (`resolveActiveBidIncrement` server-side) vs. client `computeNextBidAmount` at `auction-operator.tsx:368-372` using `state.bidIncrement` cached from the last SSE.

If the operator changes a category's `bidIncrement` mid-bidding, an owner-app device with stale SSE state will submit the old increment value. Server rejects with "Bid must be exactly ₹…". Confusing UX in a live event. Currently masked by exact-equality validation, but UX is poor.

**Recommended fix:** Server should accept any amount ≥ `currentBid + serverIncrement` and ≤ a sensible cap; or surface the latest increment in every SSE bid envelope so clients always see the live value.

### M6. `players.status` transitions are not enforced — DB schema accepts any string
**Location:** `lib/db/src/schema/players.ts:29` `status: text("status").notNull().default("available")`

`sold` / `unsold` / `available` / `retained` are runtime constants. A buggy migration or a typo in code can write `Sold`, `SOLD`, `sold ` etc. and silently break counters (`countPlayerStatuses` uses string equality). Use a CHECK constraint or a Postgres `ENUM`.

### M7. Auction logging is fire-and-forget; failures are silently swallowed
**Location:** `lib/auction-logger.ts:99-100`, every `logBidEvent`, `logPlayerAuctionStart`, `logPlayerAuctionEnd`, `logTimerEvent` call site

```ts
try { … } catch {
  // Never interrupt live bidding for analytics failures
}
```

Consequences:
- Bid events tables may be missing rows after Neon hiccups.
- The undo handler reads from `bidsTable` (sales-only), but live bids are read from `auction_bid_events` by the bid history endpoint (`/auction/bids` returns `auctionBidEventsTable`). If the log write failed, the bid history is missing rows even though the bid went through. Post-tournament audit reports will be inaccurate.

**Recommended fix:** Log the swallowed error at least once with `logger.error`. Page on `auction_bid_events` write failures > 1% per hour.

### M8. Visibility-change handler reconnects SSE without checking whether existing connection is still healthy
**Location:** `use-auction-socket.ts:122-129`

```ts
if (document.visibilityState === "visible") {
  resetAuctionEventVersion(tournamentId);
  qc.invalidateQueries(…);
  reconnectAttempt = 0;
  connect();
}
```

Tabbing back to a window that already has a healthy SSE forces a brand-new EventSource even though the existing one would have delivered the missed events with `Last-Event-ID`. The version reset means the new EventSource has no `Last-Event-ID` → server sends a fresh snapshot (no replay). Combined with H1 (no version on snapshot via REST), this can cause a brief visible jump on tab focus.

**Recommended fix:** Only reconnect if the existing EventSource is in `CLOSED`/`CONNECTING` state; otherwise just `invalidateQueries`.

### M9. `disconnectedTimer` leak in `useAuctionSocket`
**Location:** `use-auction-socket.ts:50-56`

`markReconnecting` schedules `disconnectedTimer`. `markConnected` clears it. But on rapid reconnect cycles, the previous `disconnectedTimer` reference is overwritten without being cleared on every call path — specifically, when `connect()` is called from `handleVisibilityChange`, the previous `disconnectedTimer` is still active. Symptom: status flips to "disconnected" 5 s after a *healthy* reconnect even though SSE is delivering events. Visual-only, but it triggers the connection banner.

### M10. `wheelSpinning` race on multi-instance — server writes `wheelSpinning=true` only on the instance that schedules `scheduleWheelSpinStop`; other instances never auto-stop
**Location:** `routes/auction.ts:101-121, 2412`

If instance A starts the spin but is then drained (rolling deploy), instance B picks up the next request — the in-memory `wheelSpinStopTimers` is empty, so the spin never auto-resolves.

### M11. Bid endpoint allows bidding when `team.isBiddingEnabled=true` AND timer is open — but ignores the operator's read-only "view-only" badge for sold-out teams
Once a team has reached max squad or category limit, the bid endpoint correctly rejects (`routes/auction.ts:1247-1296`), but the owner-app still shows the team's bid buttons enabled until the next state refresh. Cosmetic; surface the constraint via SSE.

### M12. `bidsTable` vs `auction_bid_events` divergence
`bidsTable` only contains rows for *sold* players (one row per sale, inserted in `/sell` and `/manual-sell`). `auction_bid_events` contains every bid attempt. The `/auction/bids` endpoint exposes `auction_bid_events` (every bid), but `undo` operates against `bidsTable` (only sales). This semantic difference is not documented; refactor risk is high.

### M13. `lastOutcome` stored as raw JSON `text` — no schema validation
**Location:** `routes/auction.ts:1390-1401, 1560-1572, 1663-1668`, parsing at `407-575`

A malformed JSON (introduced by a future migration or manual DB edit) is silently dropped by the `try { JSON.parse } catch {}` in `buildAuctionState`. Display screens then show no outcome card. Validate on read with Zod and log a warning.

### M14. Push notification fire-and-forget chain on `/start` can spam owners on every license reactivation
**Location:** `routes/auction.ts:986-995`
Trigger condition is `session.status === "idle"` before the start. If an admin runs `reset-trial`, the session goes idle, and the next `/start` will send another "Auction is Live!" push. Add a per-tournament "already-pushed" flag in DB.

### M15. Server clock vs client clock drift not signalled
`timerEndsAt` is an ISO string. Clients compute `endsAt - Date.now()`. Mobile devices in cellular data with 30–60 s clock drift will show the wrong remaining seconds. Render a server-side `serverNowIso` in every state envelope and let the client compute the offset on first connect.

---

## LOW

### L1. `bidIncrement` default fallback is hard-coded to `50000`
**Location:** `auction.ts:321-322`. Defensive but should be a constant.

### L2. `notifyPlayerSold` is called *before* the DB updates settle (technically after `await db.update(playersTable)` etc., so ok). But `notifyPlayerReAuction` is invoked synchronously in `re-auction` *after* updates. If `notifyPlayer…` ever becomes a heavy call it could delay the broadcast.

### L3. Audit log writes (`auditLog`) inside handlers are fire-and-forget per the helper, but executed inside the handler. Logger errors may bleed into the response path.

### L4. `EventSource` over the browser cannot send custom headers, so any per-connection JWT must travel via the cookie. Already implemented via `credentials: include`, but worth documenting: revoking a JWT does not terminate an existing SSE — server should validate JWT freshness on a periodic heartbeat tick.

### L5. `formatSseFrame` uses `JSON.stringify(payload)` and emits a single `data:` line. RFC requires `data: …\n` per logical line — a payload with `\n` would be split. Mitigated because `JSON.stringify` does not emit literal `\n`. OK but document.

### L6. `setInterval(... 5 * 60 * 1000)` for cache-hit logging (`routes/auction.ts:744-754`) is never cleared on graceful shutdown — minor in long-running container, ok.

### L7. `parseFairQueue` happily accepts a legacy plain array — useful for migration but silently ignores `legacyInvalidIds`. Add a one-line log.

### L8. `display.tsx` has no error boundary; an exception in `DisplayShell` blanks the LED. Add an error boundary that retries the GET.

### L9. CORS allowlist (`isCorsOriginAllowed`) is delegated to `runtime-env.ts` but not audited here — confirm it isn't `*` in production.

### L10. `validateBidAmount` rejects bids below `currentBid + increment` but also rejects bids *above* (exact equality). This is intentional for quick-bid UX but means an owner who wants to jump the bid (`+100k` over the increment) cannot — they're forced to wait for each click. UX issue, not a bug.

### L11. Re-auction-unsold loops one update per player (`routes/auction.ts:1817-1822`). On a 200-player tournament with 50 unsold, that's 50 sequential round-trips. Batch into a single `UPDATE … WHERE id IN (…)`.

### L12. `auction-broadcast.ts:41-43`: `state.teamPurses?.length ? invalidate.filter(k=>k!=="purses") : invalidate`. If `teamPurses` is `[]` (empty array, no teams), purses are still invalidated — fine. If it's `undefined`, also invalidated. Edge case is correct but subtle.

---

## Summary of bug count by category

| Category | Critical | High | Medium | Low |
|----------|---------:|-----:|-------:|----:|
| Bidding race / concurrency | 2 | 4 | 2 | 1 |
| DB transactions / consistency | 1 | 1 | 2 | 1 |
| Auth & security | 1 | 1 | 0 | 1 |
| Realtime sync (SSE / multi-device) | 0 | 3 | 3 | 2 |
| Refresh / reconnect recovery | 1 | 1 | 2 | 0 |
| Logging / error handling | 0 | 0 | 2 | 3 |
| Misc / UX / performance | 0 | 0 | 4 | 4 |
| **Total** | **5** | **10** | **15** | **12** |

---

## Recommended remediation order (safest first)

1. **C3** (auth on `/bid`) — single-file change, no functional impact. Pre-requisite for everything else.
2. **C2 + H4 + H8** — wrap each mutation in `db.transaction(...)` and switch purse updates to `sql\`purse_used + ${amt}\``. Single PR per endpoint, fully covered by existing API contract tests.
3. **C4 + C1 + H6 + H7** — add `revision` column to `auction_sessions`, use it as a CAS predicate. Same PR sequence.
4. **H1** — stamp `eventVersion` into every HTTP mutation response; client checks version before `setQueryData`.
5. **H2 + H3** — buffer + publish atomicity (Redis MULTI), warn on snapshot fallback, raise buffer to 2 000.
6. **C5** — fail closed on operator-lock error; add explicit "Take over" UX.
7. **H10** — validate `/mirror` payload, rate-limit, require organizer auth.
8. **H5 + M5 + M8 + M9** — UX polish for timer extension cap, increment refresh on category change, visibility-change reconnect logic.
9. **H9 + M2 + M10** — move in-memory maps (wheel-stop, cheer counters, state cache) into Redis with leader election.
10. **Mediums and Lows** — batched as engineering hygiene.

Each fix is independently shippable; nothing in this list requires a coordinated big-bang release.

---

*Audit performed without code modifications. All findings are from static reading of the source.*
