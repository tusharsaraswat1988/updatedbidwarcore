# BidWar Real-Time Synchronization Report

**Audit Date:** 2026-06-15  
**Priority:** CRITICAL — Live auction synchronization is the primary success metric  
**Transport:** SSE (`EventSource`) → TanStack React Query `setQueryData` → React render  
**Note:** Latency figures are **architectural estimates** from code-path analysis, not live benchmarks. Run k6/browser profiling to validate.

---

## Synchronization Model

```
Operator Click
    │
    ├─► [0ms] Optimistic setQueryData (bid only)
    │
    ▼
POST /api/tournaments/:id/auction/{action}
    │
    ├─► [50–150ms] DB transaction
    ├─► [100–500ms] buildAuctionState() — loads ALL players
    │
    ▼
broadcastToTournament → SSE write to N clients
    │
    ├─► [10–50ms] Network to LAN clients
    ├─► [100–500ms] Network to 4G clients
    │
    ▼
Client: es.onmessage → JSON.parse → qc.setQueryData
    │
    ├─► [0–16ms] React schedule re-render
    ├─► [0–250ms] useLedView 250ms tick alignment (LED only)
    │
    ▼
UI Paint
```

**Authoritative source:** Server `auction_state` snapshot. Operator optimistic updates are ephemeral until confirmed.

---

## Current Estimated Sync Latency

### Critical Auction Events (ms from operator action to screen paint)

| Event | Operator | Main LED | Portrait | OBS | Public |
|-------|----------|----------|----------|-----|--------|
| **Load Player** | 150–300 | 300–600 | 300–600 | 200–450 | 250–500 |
| **Start Auction** | 150–300 | 250–500 | 250–500 | 200–400 | 250–450 |
| **Pause Auction** | 150–300 | 250–500 | 250–500 | 200–400 | 250–450 |
| **Resume Auction** | 150–300 | 250–500 | 250–500 | 200–400 | 250–450 |
| **Bid Increment** | **30–80*** | **250–550** | **250–550** | 200–450 | 250–500 |
| **Sold** | 200–400 | 350–700 | 350–700 | 300–600 | 350–650 |
| **Unsold** | 200–400 | 300–550 | 300–550 | 250–450 | 300–500 |
| **Defer** | 200–400 | 300–600 | 300–600 | 250–450 | 300–500 |
| **Undo (Reauction)** | 300–500 | 400–700 | 400–700 | 350–600 | 400–650 |
| **Team Purse Update** | 200–400 | 400–800† | 400–800† | 300–700† | 400–750† |

\* Operator bid shows **optimistic** in 0–30ms; confirmed in 150–300ms  
† Purse updates require secondary `invalidate["purses"]` → HTTP GET; LED uses `useGetTeamPurses` separate from SSE state

### Target vs Actual

| Event | Target | Operator | LED (worst) | Verdict |
|-------|--------|----------|-------------|---------|
| Player Load | <500ms | ✓ | ⚠️ 600ms | Borderline |
| Bid Update | <200ms | ✓ | **✗ 550ms** | **FAIL** |
| Sold | <300ms | ⚠️ 400ms | **✗ 700ms** | **FAIL** |
| Unsold | <300ms | ⚠️ 400ms | **✗ 550ms** | **FAIL** |
| Defer | <300ms | ⚠️ 400ms | **✗ 600ms** | **FAIL** |
| Undo | <500ms | ✓ | ⚠️ 700ms | Borderline |

### Screen Synchronization Gap (fastest vs slowest screen)

| Event | Fastest | Slowest | Gap | Target (<100ms) | Acceptable (<300ms) |
|-------|---------|---------|-----|-----------------|---------------------|
| Bid | Operator 30ms | LED 550ms | **520ms** | **✗** | **✗** |
| Sold | OBS 300ms | LED 700ms | **400ms** | **✗** | **✗** |
| Pause | Operator 150ms | LED 500ms | **350ms** | **✗** | **✗** |
| Load Player | OBS 200ms | LED 600ms | **400ms** | **✗** | **✗** |

**Classification: PROBLEMATIC (500ms range) approaching CRITICAL (1s) for LED during sold with purse refetch.**

---

## Root Cause Analysis

### RC-1: `useLedView` 250ms Global Tick (PRIMARY LED LAG)

**File:** `use-led-view.ts:235–239`

The LED pipeline rebuilds the entire view object 4×/second because countdown needs `now`. SSE may deliver a bid update at T+150ms, but the LED may not repaint until the next tick at T+0–250ms.

**Contribution to lag:** 0–250ms on every event.

### RC-2: `buildAuctionState` Server Latency

**File:** `api-server/src/routes/auction.ts:373–470`

Every mutation calls `buildAuctionState` which:
- Fetches session, tournament, current player, category, ALL players (full table scan), teams
- Warns if >300ms

**Contribution:** 100–500ms before SSE even fires.

### RC-3: Full-State SSE Payload

No delta events. Every bid sends the entire `AuctionState` JSON to 55 clients.

**Contribution:** 10–100ms LAN; 200–500ms 4G.

### RC-4: Secondary HTTP Refetch on Sold/Undo

`invalidate: ["bids", "purses", "players"]` triggers 3 HTTP GETs on every client that subscribes to those queries. LED purse display waits for `useGetTeamPurses` refetch.

**Contribution:** 100–400ms tail on sold/undo for purse display.

### RC-5: Operator `invalidate()` Cascade

After every mutation, operator triggers 4 parallel GETs, competing for bandwidth and server attention.

**Contribution:** Does not directly delay LED, but loads server during critical moments.

### RC-6: No Event Ordering Version

Clients apply last-received `setQueryData`. Under reconnect, older state could theoretically overwrite newer (low probability).

**Contribution:** Rare stale state; severity increases with reconnect storms.

---

## Per-Screen Sync Mechanism

| Screen | Primary sync | Secondary sync | Lag profile |
|--------|-------------|----------------|-------------|
| Operator | Optimistic + SSE + invalidate | 5s polls | Fastest (source of truth UI) |
| Main LED | SSE → useLedView | 10s poll | **Slowest** (250ms tick + heavy useMemo) |
| Portrait | SSE → useSideLedView → useLedView | 10s poll | **Slowest** (same as LED) |
| OBS | SSE → direct useGetAuctionState | 10s poll | Fast-middle |
| Public | SSE → direct useGetAuctionState | 30s poll | Middle (heavy component) |

### Why OBS is faster than LED

OBS reads `useGetAuctionState` directly without `useLedView`'s 250ms tick wrapper. This confirms the tick is the primary LED-specific lag source.

---

## Detected Sync Risks

| Risk | Type | Screens affected | Severity |
|------|------|------------------|----------|
| LED 250ms tick delay | Render lag | LED, Portrait | **Critical** |
| Purse stale after sold | Cache inconsistency | LED, Public (until GET returns) | **High** |
| Optimistic bid without revert | Stale state | Operator | **High** |
| Two operator tabs | Race condition | All | **Critical** |
| SSE reconnect gap (3–5s) | Lost events | All (brief) | **High** |
| OBS uses listTeams not team-purses | Data inconsistency | OBS vs LED | **Medium** |
| Out-of-order SSE on reconnect | Stale overwrite | All | **Low** |
| `initialOutcomeSeenRef` on OBS refresh | Missed animation | OBS only | **Low** |
| Break timer no SSE | Total desync | Break timer display | **Medium** |
| Public 30s poll masking SSE failure | Hidden disconnect | Public | **Medium** |

---

## Worst-Case Load: 6 Screens + 50 Viewers, 1 Bid/Second

### Predicted behavior

| Metric | Prediction |
|--------|------------|
| LED bid display lag | 250–550ms behind operator |
| Purse after sold | 400–800ms until all screens match |
| Server `buildAuctionState` p99 | 300–800ms under load |
| SSE delivery | Reliable on LAN; degraded on 4G public viewers |
| Screen consistency at T+1s | All screens converged (except purse tail) |
| Screen consistency at T+300ms | Operator + OBS correct; LED may still show old bid |

### Failure threshold

At 2 bids/second sustained:
- `buildAuctionState` queue depth grows
- LED lag extends to 500–1000ms (**CRITICAL**)
- Operator optimistic state may temporarily disagree with server

---

## Recommended Fixes (Ordered by Sync Impact)

| # | Fix | Sync improvement | Effort |
|---|-----|------------------|--------|
| 1 | **Decouple countdown from `useLedView` useMemo** | LED −200ms on all events | Medium |
| 2 | **Slim `buildAuctionState` for hot path** (exclude full player load on bid) | All screens −100–300ms | High |
| 3 | **Embed team purses in `auction_state` snapshot** | Sold purse −200–400ms | Medium |
| 4 | **Remove `invalidate()` when SSE connected** | Server −30% load; fewer tail latencies | Low |
| 5 | **Disable HTTP polls when SSE connected** | Eliminate poll/SSE race flicker | Low |
| 6 | **Delta SSE event for bids** (`bid_placed` with amount/team/timer) | Bid −50–100ms payload parse | High |
| 7 | **Add `stateVersion` monotonic counter** | Eliminate stale reconnect | Low |
| 8 | **Block operator mutations when disconnected** | Prevent false-local state | Low |
| 9 | **Operator session lock (one tab)** | Eliminate conflicting mutations | Medium |
| 10 | **Align OBS on team-purses** | OBS/LED purse consistency | Low |

---

## Predicted Production Behavior

### Venue LAN (ideal conditions)
- Operator: near-instant bids (optimistic)
- LED: **noticeable 0.3–0.5s lag** on bids — audience may see operator raise paddle before screen updates
- OBS stream: 0.2–0.4s lag — acceptable for broadcast
- Public on venue WiFi: 0.3–0.5s

### Cloud + 4G public viewers
- LED/OBS on venue LAN: same as above
- Public viewers: 0.5–1.5s lag possible
- Risk of purse display lag up to 2s after sold

### Under stress (rapid bidding, 50 viewers)
- LED may fall **1–2 seconds behind** — matches user's worst fear
- Disputes risk: "screen showed X when hammer fell at Y"

---

## Readiness Score

| Category | Score (0–100) | Weight | Weighted |
|----------|---------------|--------|----------|
| Transport reliability (SSE) | 75 | 20% | 15.0 |
| State authority model | 85 | 15% | 12.8 |
| Cross-screen consistency | 55 | 25% | 13.8 |
| Latency vs targets | 40 | 25% | 10.0 |
| Failure recovery | 60 | 10% | 6.0 |
| Scale readiness (50+ viewers) | 45 | 15% | 6.8 |
| **Overall** | | | **54/100** |

### Verdict

**NOT PRODUCTION-READY for high-stakes live auctions** without addressing LED render lag and server state build time. Acceptable for low-pressure practice auctions with informed operators.

**Minimum viable fixes for production:** Items 1, 3, 4, 5 from recommendations above. Target score after fixes: **75/100**.

---

## Measurement Plan (Validate Estimates)

```javascript
// Inject into broadcast.ts broadcastToTournament:
{ type: "auction_state", state, invalidate, _ts: Date.now(), _seq: ++seq }

// Inject into use-auction-socket.ts onmessage:
const latency = Date.now() - msg._ts;
console.log(`[SYNC] ${msg._seq} latency=${latency}ms screen=LED`);
```

1. Record 20 bids → compute p50/p95 operator→LED latency
2. Record 10 sold events → measure purse convergence time across screens
3. Load test 50 SSE connections → measure `buildAuctionState` p99
4. Compare OBS direct state vs LED useLedView for same events

---

## Synchronization Target Roadmap

| Phase | Changes | Target gap |
|-------|---------|------------|
| Phase 1 (1–2 days) | Remove polls when connected; remove invalidate(); fix useLedView tick | <300ms |
| Phase 2 (3–5 days) | Embed purses in state; sold button guard; disconnect block | <200ms |
| Phase 3 (1–2 weeks) | Slim buildAuctionState; delta bid events; SSE singleton | <100ms |
