# Rapid Bid Button Hang — Investigation

> **Evidence only. No fixes. No optimizations. No code changes.**  
> Priority: Highest engineering focus (post database-governance freeze)  
> Date: 2026-07-11  
> Symptom: Bid buttons stop responding after approximately **7–8 rapid bids** (observed during VNBL)

---

## 1. Scope and method

| Item | Detail |
|------|--------|
| Surfaces in scope | Owner LiveBid (`artifacts/owner-app`), Operator quick-bid (`artifacts/auction-platform`), API bid route + SSE (`artifacts/api-server`) |
| Out of scope | Database System A/B/C/D, schema cleanup, performance tuning work |
| Method | Static code + existing RCA/QA docs + commit history |
| Runtime | **Not re-proved in this session** — live VNBL traces / `[bid-lifecycle]` logs still required to confirm which residual mode matches the field report |

### Related written evidence (already in repo)

| Document | Relevance |
|----------|-----------|
| `docs/BID_BUTTON_STUCK_RCA.md` (2026-07-10, P0) | Exact rapid-bid hang class: stale HTTP ACK vs SSE |
| Commit `3702aa2` | `fix(auction): never-stuck bid button after rapid bids` |
| `docs/BIDWAR_VNBL3_QA_TEST_REPORT.md` | VNBL scenarios B-06, B-07, B-08, R-10/R-11 |
| `lib/api-base/src/auction-bid-sync.ts` | Monotonic version gate + timeouts |
| `artifacts/owner-app/src/hooks/use-bid-lifecycle.ts` | Owner never-stuck controller |

**Implication:** The hang class is **known**. Mitigations exist in tree as of `3702aa2`. This investigation maps **why** buttons stop responding and which mechanisms can still produce a “dead button” UX after a short rapid sequence.

---

## 2. End-to-end bid path (evidence map)

```
Owner/Operator tap
  → UI gate (canBid / bidding / bidGateLocked / debounce)
  → POST /api/tournaments/:id/auction/bid
  → DB compare-and-set on auction_sessions.revision
  → emitBidEvent (SSE version++)
  → HTTP body { bidAck, eventVersion, ...delta }   [fast ACK path]
  → parallel: SSE "bid" to all EventSource clients
  → applyMutationAuctionState / applyAuctionSseMessage (React Query)
  → isLeading / canBid recompute → BidButton render
```

Key files:

| Layer | Path |
|-------|------|
| Owner button | `artifacts/owner-app/src/screens/LiveBid.tsx` |
| Owner lifecycle | `artifacts/owner-app/src/hooks/use-bid-lifecycle.ts` |
| Owner submit | `artifacts/owner-app/src/screens/OwnerRoute.tsx` |
| Operator quick-bid | `artifacts/auction-platform/src/pages/auction-operator.tsx` |
| SSE client | `*/hooks/use-auction-socket.ts` + `*/lib/sync-auction-sse.ts` |
| Shared sync | `lib/api-base/src/auction-bid-sync.ts` |
| Bid route / ACK | `artifacts/api-server/src/routes/auction.ts` (`broadcastBidDelta`) |
| Event bus | `artifacts/api-server/src/lib/auction-events.ts` |

**Transport fact:** Auction realtime is **SSE only** (`EventSource`). Despite hook name `useAuctionSocket`, there is **no WebSocket bid channel**.

---

## 3. Focus-area findings

### 3.1 SSE event pipeline

**Evidence**

- Clients open `EventSource(/api/tournaments/:id/auction/events)`.
- Server assigns monotonic `version` (`Redis INCR` or in-memory), buffers last **500** events, publishes on Redis pub/sub when configured, writes to local SSE clients.
- Bid path emits typed `bid` delta via `emitBidEvent` → `publishAuctionEvent` (**awaited** before HTTP ACK returns).
- Reconnect: exponential backoff (`sse-reconnect.ts`, 1s→30s + jitter). On tab `visibilitychange`, clients **reset event version** and reconnect (`use-auction-socket.ts`) — VNBL QA **R-10** notes brief dual-connection / flicker and full snapshot replace.

**Hang relevance**

- Out-of-order **HTTP vs SSE** was the historical stuck-leader cause (RCA).
- Reconnect mid-war can reset version cursor to 0 and replace cache (R-10) — can briefly desync UI from live leader.
- Buffer overflow (>500 events while disconnected) forces full-state replay — can feel like a freeze/flash, not specifically a disabled button.

---

### 3.2 Bid acknowledgement flow

**Evidence**

- Server `broadcastBidDelta` (auction.ts ~1030–1053):
  - Invalidates state cache
  - `await emitBidEvent(...)`
  - Returns `{ bidAck: true, eventVersion, ...delta }`
  - **Does not await** full `buildAuctionState` (background warm only)
- Comment in code: full rebuild on the ACK path previously **blocked HTTP** and left buttons spinning.
- Client applies ACK via `decideBidMutationApply` → `merge_bid_ack` or `reject_stale` or `replace_full`.

**Hang relevance**

- Pre-`3702aa2`: slow ACK = spinner forever (`bidding` / `isPending`).
- Post-fix: ACK is fast-path; residual hang more likely from **wrong `isLeading`** than infinite spinner (unless timeout path fails — see §3.4).

---

### 3.3 Frontend state locking

**Owner (`LiveBid.tsx` + `useBidLifecycle`)**

| Lock | Behaviour |
|------|-----------|
| `bidding` / phase `submitting` | Button `disabled={!canBid \|\| bidding}`; spinner |
| `isLeading` | Entire CTA replaced with **HIGHEST BIDDER** (not a disabled button — appears “stuck”) |
| `canBid` | Requires active timer, not leading, purse/squad/category OK |

**Operator (`auction-operator.tsx`)**

| Lock | Behaviour |
|------|-----------|
| `bidGateLocked` | Blocks **all** team quick-bid buttons until ACK/`finally` or timeout |
| `controlsLocked` | `operatorReadOnly \|\| auctionMutationPending` — intentionally **excludes** sole reliance on `placeBid.isPending` |
| Comment L301 | *“never rely solely on placeBid.isPending (can stick if fetch hangs)”* |

**Hang relevance**

- After ~7–8 rapid cross-team bids, the UX that looks like “button dead” is often **`isLeading === true` with wrong team** (HIGHEST BIDDER), not `disabled={true}` forever.
- Operator: global `bidGateLocked` means **one hung bid blocks every team’s button** until unlock (8s timeout or `finally`).

---

### 3.4 Pending request queue

**Evidence**

- `customFetch` = plain `fetch` — **no abort**, **no queue**, **no concurrency limiter**.
- React Query `usePlaceBid` — standard mutation; **does not serialize** globally by itself.
- Owner: `useBidLifecycle` enforces **one in-flight submit** (`isBidUiBusy`); uses `Promise.race` vs 8s timeout; `requestIdRef` ignores late results.
- Operator: fire-and-forget `mutateAsync`; gate via `bidGateLocked` for all teams.

**Hang relevance**

- No server-side bid queue; concurrency is CAS on `revision` (409 on conflict).
- Multiple overlapping POSTs are possible if UI gates fail (operator debounce window elapsed while first still in flight — VNBL **B-06**).
- Hung fetch without abort: UI unlocks via timers; network request may still complete later.

---

### 3.5 Optimistic UI

**Evidence**

- **Operator:** patches React Query cache **before** POST (`currentBid`, `currentBidTeamId`, names/colors).
- **Owner:** no pre-POST optimistic amount; relies on mutation response + SSE.
- Stale/optimistic operator patch can briefly show wrong leader until SSE/HTTP corrects — or until a **stale HTTP** regresses (pre-gate).

**Hang relevance**

- Optimistic operator patch + late wrong HTTP was part of the stuck-leader story.
- Version gate now rejects stale HTTP; optimistic patch still races SSE until corrected.

---

### 3.6 Bid debounce / throttle

| Location | Window | Effect |
|----------|--------|--------|
| Owner `useBidLifecycle` | **600 ms** default | `tap_blocked` / `detail: "debounce"` |
| Operator `bidDebounce` | **150 ms per teamId** | Silent drop |
| Server `/auction/*` | **None** | Explicitly **not** rate-limited for rapid bidding (`auction.ts` header note; `rate-limiters.ts` skips auction paths) |

**Hang relevance**

- Debounce alone does **not** explain a permanent hang after 7–8 bids.
- VNBL **B-06**: if first POST >150ms, second operator tap fires → 409 “already highest bidder” toast (UX glitch, not permanent lock) — **unless** error handling leaves gate locked (should clear in `finally`).
- Owner 600ms debounce + lifecycle busy gate limits self-spam; wars are **cross-team**, so each owner’s own debounce does not serialize the war.

---

### 3.7 WebSocket / SSE reconnect logic

**Evidence**

- No WebSocket for bids.
- SSE `onerror` → close → backoff reconnect.
- Visibility: always reconnect + `resetAuctionEventVersion` + invalidate (R-10).
- VNBL **R-11**: `disconnectedTimer` not cleared on rapid reconnect → false “disconnected” banner possible.

**Hang relevance**

- Reconnect does not by itself set `bidding=true`, but **version reset + snapshot replace** can briefly wrong-foot `isLeading` / `canBid`.
- During reconnect gap, taps may 409 or apply against stale local state.

---

### 3.8 Race conditions

**Primary documented race (BID_BUTTON_STUCK_RCA)**

1. Owner A POST in flight (will be eventVersion `N`)
2. Owner B wins; SSE `N+1` updates A’s UI (B leading)
3. Late A HTTP for `N` overwrites cache → A shown as leader
4. Version cursor regresses
5. A stuck on **HIGHEST BIDDER** until later full sync

**Mitigation in code (evidence of intent, not runtime proof):**

- `decideBidMutationApply`: reject when `eventVersion < cachedVersion`
- `shouldApplyBidDelta`: reject regressing bid amounts
- Stress tests in `lib/api-base/src/__tests__/auction-bid-sync.test.ts`

**Other races**

| ID | Evidence | Effect |
|----|----------|--------|
| Server 409 `stale_bid` | revision CAS fail | Client must refresh; button should unlock |
| Same-team 409 | already highest bidder | Owner maps to `leading` |
| B-08 | Mid-player increment change | Clients compute wrong next amount → repeated rejects |
| B-11 (VNBL) | Pause vs in-flight bid | Confusing reject strings / state |

**Hang relevance**

- Cross-team rapid wars maximize HTTP/SSE interleaving — matches “after ~7–8 bids” (enough for out-of-order ACKs).
- If deploy **lacks** `3702aa2`, this race remains the leading explanation.
- If deploy **includes** `3702aa2`, residual causes shift to reconnect, gate lock, or wrong `canBid` inputs (purse/timer/increment).

---

### 3.9 React rendering

**Evidence**

- Bid CTA is phase-driven (`motion.button` vs HIGHEST BIDDER `motion.div`).
- Auction state lives in React Query; SSE and mutations both `setQueryData`.
- Shared mutation key `["placeBid"]` — hung mutation can affect other consumers; operator calls `placeBid.reset()` on gate timeout.

**Hang relevance**

- No evidence of a render infinite loop as the hang cause.
- Stuck UX is **state-derived** (`isLeading` / `bidding` / `bidGateLocked`), not a failed paint.

---

### 3.10 Disabled-button lifecycle

**Owner phases** (`BidUiPhase`): `idle | submitting | success | error | leading | timed_out`

| Mechanism | Unlock condition |
|-----------|------------------|
| ACK timeout | `BID_ACK_TIMEOUT_MS` = **8000** → `timed_out` → schedule idle |
| Watchdog | `BID_WATCHDOG_MS` = **10000** → force idle if still `submitting` |
| Feedback | `feedbackMs` ~1600 → return idle |
| Request ID | Late responses ignored if superseded |

**Operator**

- `bidGateLocked` true from submit until `finally` or 8s timeout + `placeBid.reset()`.

**Hang relevance**

- Spinner hang >10s should be impossible with watchdog **if** `useBidLifecycle` is wired (owner).
- **HIGHEST BIDDER** is not cleared by ACK timeout — it clears only when `currentBidTeamId !== teamId` via SSE/state. That is the durable “button won’t bid” lookalike.
- Operator: if `finally` never runs and timeout fails to fire (tab background throttling?), gate could stick longer — evidence suggests timeout is set; needs runtime confirmation under mobile Safari/background.

---

### 3.11 API latency

**Evidence**

- Critical path after DB commit: emit + Redis publish (awaited), not full state rebuild.
- Auction endpoints exempt from API rate limiting to support 2–3 bids/sec.
- Cellular / Render free-tier cold paths can inflate POST duration (VNBL B-06 assumes >150ms).

**Hang relevance**

- High latency increases probability of **overlapping** HTTP responses and SSE events (race window).
- Latency alone does not disable buttons permanently post-timeout mitigations.

---

### 3.12 Database transaction timing

**Evidence**

- Bid update uses optimistic concurrency: `WHERE revision = currentRevision` then `revision = revision + 1`.
- Not `SERIALIZABLE` / not explicit `SELECT FOR UPDATE` of session row.
- Losers get **409** with `hint: "stale_bid"`.
- Bid event log insert is fire-and-forget (does not block ACK).

**Hang relevance**

- Contended wars → more 409s; clients should unlock and allow retry.
- DB slowdown widens race window between commit and SSE delivery vs HTTP return ordering (same process usually: emit before `res.json`, so HTTP ACK version ≥ just-emitted; **cross-client** interleaving remains the issue).

---

### 3.13 Event ordering

**Evidence**

- Server versions are monotonic per tournament.
- Client must apply SSE and HTTP with **monotonic gate**.
- Equal-amount bid deltas only apply if `timerEndsAt` moves forward (`shouldApplyBidDelta`).

**Hang relevance**

- Pre-gate: order violations produced stuck leader.
- Post-gate: stale HTTP rejected (`stale_mutation_rejected` log). Missing `eventVersion` on payload falls through `shouldAcceptMonotonicVersion` as **accept** (`incomingVersion == null → true`) — residual risk if ACK somehow omits version.

---

### 3.14 Broadcast timing

**Evidence**

- HTTP ACK **waits** for `publishAuctionEvent` (buffer + Redis publish).
- Full state rebuild is **background** after bid.
- Multi-instance: Redis pub/sub fan-out; local write path is sync when Redis absent.

**Hang relevance**

- Publish delay adds to ACK latency (spinner duration), not permanent disable.
- Multi-node: subscriber lag could deliver SSE after HTTP on same client — gate must handle both orders (tests cover interleaved cases).

---

## 4. Why “~7–8 rapid bids” fits the evidence

| Observation | Mechanistic fit |
|-------------|-----------------|
| Happens after a short war, not first tap | Needs interleaved POSTs + SSE from **multiple** teams |
| Button “stops responding” | Matches **HIGHEST BIDDER** panel (`isLeading`) more than gray `disabled` |
| VNBL context | Multi-team rapid succession; timer extensions (B-07 mentions 7–8 s resets — different “7–8” but same war conditions) |
| Known P0 RCA | Same symptom class documented 2026-07-10 |

**Not primary explanations (evidence weak for permanent hang):**

- Server rate limit (auction exempt)
- WebSocket drop (no WS)
- System C DDL (unrelated to bid path)
- Debounce alone (temporary block only)

---

## 5. Hypothesis ranking (evidence-based, unproven at runtime)

| Rank | Hypothesis | Evidence strength | What UI looks like |
|-----:|------------|-------------------|--------------------|
| 1 | Stale HTTP ACK regresses SSE leader (`isLeading` stuck) | **Strong** — RCA + code comments + tests; depends on whether field build predates `3702aa2` | HIGHEST BIDDER / won’t bid |
| 2 | Operator `bidGateLocked` held across multi-team war until timeout | **Medium** — global lock by design | All quick-bid buttons dead ~until 8s/`finally` |
| 3 | SSE reconnect / version reset mid-war (R-10) | **Medium** — QA FAIL | Flicker then wrong gates |
| 4 | Hung fetch + failed unlock (pre-fix or lifecycle not mounted) | **Medium historical** | Spinner forever |
| 5 | Stale `bidIncrement` (B-08) causing repeated rejects | **Medium** for “can’t bid”; less for false leading | Error toasts / disabled via `canBid` amount mismatch |
| 6 | Browser connection limit / proxy stall without UI timeout firing | **Low–medium** — needs Network panel | Spinner until 8–10s |

---

## 6. What would confirm the field report (no code changes)

Collect during a rapid-bid repro (owner + operator):

1. Console `[bid-lifecycle]` events: `submit_start`, `stale_mutation_rejected`, `ack_timeout`, `watchdog_force_idle`, `tap_blocked`
2. Network: POST `/auction/bid` durations + response JSON (`bidAck`, `eventVersion`) interleaved with SSE `id:` / `bid` payloads
3. React Query auction cache snapshot at hang: `currentBidTeamId`, `eventVersion`, `timerEndsAt`
4. Confirm deploy SHA includes `3702aa2` / contains `decideBidMutationApply` + `useBidLifecycle`
5. Note surface: **owner**, **operator**, or both
6. Server logs: `bid_ack_emitted` timestamps vs client ACK apply

---

## 7. Freeze note

Database governance investigation is **complete and frozen** (no further System A/B/C/D / migration / DDL work in this track).

This document is the **handoff baseline** for the rapid-bid hang as the highest engineering priority. **No remediation was implemented here.**

---

## 8. Evidence index

| Claim | Location |
|-------|----------|
| Stuck RCA | `docs/BID_BUTTON_STUCK_RCA.md` |
| Fix commit | `3702aa2` (2026-07-10) |
| Version gate | `lib/api-base/src/auction-bid-sync.ts` |
| Owner lifecycle | `artifacts/owner-app/src/hooks/use-bid-lifecycle.ts` |
| Owner CTA / `isLeading` | `artifacts/owner-app/src/screens/LiveBid.tsx` |
| Operator gate / debounce / optimistic | `artifacts/auction-platform/src/pages/auction-operator.tsx` |
| Fast ACK | `artifacts/api-server/src/routes/auction.ts` `broadcastBidDelta` |
| SSE publish | `artifacts/api-server/src/lib/auction-events.ts` |
| VNBL B-06/B-07/R-10 | `docs/BIDWAR_VNBL3_QA_TEST_REPORT.md` |
| Auction not rate-limited | `artifacts/api-server/src/routes/auction.ts` header; `rate-limiters.ts` |
