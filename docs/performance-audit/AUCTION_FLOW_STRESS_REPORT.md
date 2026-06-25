# BidWar Auction Flow Stress Report

**Audit Date:** 2026-06-15  
**Method:** End-to-end execution path trace for each critical auction action  
**Data flow:** Operator Action → API → Database → SSE Broadcast → React Query → UI (all 6 screens)

---

## Architecture Reference

```
┌──────────────┐    POST     ┌─────────────┐    SQL     ┌──────────┐
│   Operator   │ ──────────► │ auction.ts  │ ─────────► │ Postgres │
│    Panel     │             │   routes    │            │          │
└──────┬───────┘             └──────┬──────┘            └──────────┘
       │                            │
       │ optimistic setQueryData    │ broadcastState()
       │                            ▼
       │                     ┌─────────────┐
       │                     │ buildAuction│
       │                     │    State    │
       │                     └──────┬──────┘
       │                            │ SSE: auction_state
       ▼                            ▼
┌──────────────────────────────────────────────┐
│           React Query Cache (shared)          │
│  getGetAuctionStateQueryKey(tournamentId)    │
└──────────────────────┬───────────────────────┘
                       │
     ┌─────────────────┼─────────────────┐
     ▼                 ▼                 ▼
  Operator          LED/Portrait        OBS/Public
  (direct)       (useLedView)        (direct/SSE)
```

---

## Action 1: Load Player (Next Player)

### Operator path
| Step | Component | Action |
|------|-----------|--------|
| 1 | `auction-operator.tsx:324` | `handleNextPlayer(mode, playerId?)` |
| 2 | API | `POST /api/tournaments/:id/auction/next-player` |
| 3 | DB | Update `auction_sessions`: `currentPlayerId`, reset `currentBid`, clear timer, `lastAction` |
| 4 | Server | `broadcastState(tid, ["players"])` |
| 5 | SSE | `{ type: "auction_state", state, invalidate: ["players"] }` |
| 6 | All clients | `setQueryData(auction)` + `invalidateQueries(players)` |
| 7 | Operator | `invalidate()` → refetch auction, bids, players, teams |

### Screen updates
| Screen | Update mechanism | Latency risk |
|--------|-------------------|--------------|
| Operator | Mutation response + SSE + invalidate | Low (150–300ms) |
| Main LED | SSE → `useLedView` rebuild | **Medium** (250ms tick delay) |
| Portrait | Same as LED | **Medium** |
| OBS | SSE → direct state | Low (150–400ms) |
| Public | SSE → liveviewer | Low–medium |

### Stress risks
- **Race:** Operator `invalidate()` and SSE `invalidate["players"]` cause duplicate player list GETs
- **Over-fetch:** LED loads full player list to show one current player
- **Queue integrity:** `deferredPlayerIds` and `randomDrawQueue` parsed server-side — client displays derived lists without validation

### Target: <500ms — **Estimated: 200–600ms** (LED upper bound)

---

## Action 2: Start Auction

### Operator path
| Step | Action |
|------|--------|
| 1 | `handleStartAuction()` L527–558 |
| 2 | `POST /api/tournaments/:id/auction/start` |
| 3 | DB: `status → "active"`, tournament `status → "active"`, readiness gate if idle |
| 4 | `broadcastState(tid)` — no invalidate hints |
| 5 | SSE → all screens: `setQueryData` only |

### Screen updates
| Screen | Behavior |
|--------|----------|
| All | `state.status === "active"` → pause overlay off, break countdown cleared |
| LED | `derivedState` transitions from idle/paused to active |

### Stress risks
- **Readiness gate:** Server may reject start if operator skipped setup — operator shows error, screens stay idle (correct)
- **First-start fortune wheel clear:** Side effect in start handler — unexpected state mutation
- **No race** — single mutation, no optimistic update

### Target: <500ms — **Estimated: 150–400ms** ✓

---

## Action 3: Pause Auction

### Operator path
| Step | Action |
|------|--------|
| 1 | `pauseAuction.mutateAsync({ tournamentId })` L791 |
| 2 | `POST /api/tournaments/:id/auction/pause` |
| 3 | DB: `status → "paused"`, `timerEndsAt → null`, `pausedTimeRemaining` saved |
| 4 | `broadcastState(tid)` |
| 5 | Operator `invalidate()` |

### Timer sync
| Screen | Timer behavior |
|--------|---------------|
| Operator | `ServerCountdown` / `CircularTimer` stop (no `timerEndsAt`) |
| LED | `useLedView` countdown → 0; `derivedState: "paused"` |
| OBS | `deriveAuctionDisplayMode` → pause overlay |
| Public | Pause banner |

### Stress risks
- **Timer consistency:** GOOD — server clears `timerEndsAt`; clients derive from server field
- **Pause during bid window:** `pausedTimeRemaining` preserved for resume — verify resume restores correctly
- **Screen sync:** All screens use same `state.status` — consistent

### Target: <300ms — **Estimated: 150–400ms** ✓

---

## Action 4: Resume Auction

Uses **same endpoint as start:** `POST /api/tournaments/:id/auction/start`

| Step | Action |
|------|--------|
| DB | `status → "active"`, restores `timerEndsAt` from `pausedTimeRemaining` if player on block |
| SSE | `broadcastState(tid)` |

### Stress risks
- **Dual-purpose start endpoint:** Resume and cold-start share handler — logic branches on current status (acceptable but complex)
- **Timer restore:** If `pausedTimeRemaining` is null, timer stays off — operator must manually start timer

### Target: <500ms — **Estimated: 150–400ms** ✓

---

## Action 5: Bid Increment

### Operator path (most critical hot path)
| Step | Action |
|------|--------|
| 1 | `handleBid(teamId)` L333 — 150ms debounce per team |
| 2 | **Optimistic** `qc.setQueryData` — instant UI update |
| 3 | `POST /api/tournaments/:id/auction/bid` `{ teamId, amount }` |
| 4 | DB: session `currentBid`, `currentBidTeamId`, `timerEndsAt` (extension logic), `timerType: "bid"` |
| 5 | `broadcastState(tid)` — no invalidate hints |
| 6 | SSE → all screens `setQueryData` |
| 7 | Mutation `.then` → `setQueryData(result)` + `invalidate()` |

### Update propagation
| Screen | Bid display source | Lag source |
|--------|-------------------|------------|
| Operator | Optimistic → mutation → SSE | Near-instant (0–50ms optimistic) |
| LED | SSE → `useLedView` | Server 100–300ms + 0–250ms tick |
| Portrait | Same | Same |
| OBS | SSE → direct | Server 100–300ms |
| Public | SSE → liveviewer | Server 100–300ms + render |

### Stress risks
- **CRITICAL: Triple update** — optimistic + mutation + invalidate + SSE = 4 state writes per bid
- **Rapid bidding (1/sec):** Server `buildAuctionState` × 60/min; 55 SSE writes/sec
- **Out-of-order:** If bid N+1 response arrives before bid N (unlikely with debounce), optimistic state may flash wrong value until SSE corrects
- **Purse stale on bid:** Purses don't change on bid — correct (only changes on sell)

### Target: <200ms — **Estimated: Operator 50ms, LED 200–500ms** ⚠️ LED exceeds target

---

## Action 6: Sold

### Operator path
| Step | Action |
|------|--------|
| 1 | `handleSell()` → `POST /api/tournaments/:id/auction/sell` |
| 2 | DB: player `status → "sold"`, `teamId`, `soldPrice`; `teams.purseUsed += amount`; insert `bids` row; session clears player, sets `lastOutcome` |
| 3 | `broadcastState(tid, ["bids", "purses", "players"])` |
| 4 | SSE: `setQueryData` + invalidate 3 query keys on ALL clients |
| 5 | Operator `invalidate()` → 4 more GETs |

### Screen updates
| Screen | Sold display |
|--------|-------------|
| LED | `useSoldAnimation`, `lastOutcome`, sold audio via `useBroadcastAudio` |
| OBS | `soldSnap` local state from outcome change detection |
| Public | Outcome card + sound |
| Operator | Player moves to sold list on players refetch |

### Stress risks
- **Double-click sold:** No client-side debounce on `handleSell` — second click may error server-side if no current player
- **Purse update race:** SSE invalidates purses → HTTP GET on all screens; until GET completes, purse may show stale value for 100–500ms
- **OBS outcome detection:** `initialOutcomeSeenRef` skips first outcome on mount — correct for refresh; may miss sold if refresh happens exactly during sold animation

### Target: <300ms — **Estimated: 200–600ms** (purse refetch extends tail) ⚠️

---

## Action 7: Unsold

### Path
| Step | Action |
|------|--------|
| 1 | `POST /api/tournaments/:id/auction/unsold` |
| 2 | DB: player `status → "unsold"`, session cleared, `lastOutcome` unsold |
| 3 | `broadcastState(tid, ["players"])` |

### Stale state risks
- Player list refetch triggered — until complete, LED may briefly show player as "live"
- `lastOutcome` in SSE state is authoritative — screens using `outcome` field update immediately via `setQueryData`

### Target: <300ms — **Estimated: 150–400ms** ✓

---

## Action 8: Defer

### Path
| Step | Action |
|------|--------|
| 1 | `POST /api/tournaments/:id/auction/defer-player` |
| 2 | DB: append to `deferredPlayerIds`, auto-select next player |
| 3 | `broadcastState(tid, ["players"])` |

### Queue integrity
- Server-side queue management — **authoritative**
- Client displays derived `deferredPlayers` list from full player roster — may lag until players refetch
- **Risk:** If defer + next-player race (operator double-click), server serializes via DB — safe

### Target: <300ms — **Estimated: 200–500ms** ✓

---

## Action 9: Undo

### CRITICAL FINDING: UI does not use undo API

| Path | UI "Undo" [Z] | API `POST /auction/undo` |
|------|---------------|--------------------------|
| Handler | `handleInstantReauction()` L437 | `useUndoLastAction` exists in generated API but **never imported** |
| Endpoint | `POST /api/tournaments/:id/auction/re-auction` | `POST /api/tournaments/:id/auction/undo` |
| Behavior | Reverses sold, puts player back on block at base price | Deletes last bid row, reverses purse |

### Stress implications
- Operator expects "undo" but gets "re-auction" — different semantics
- True undo API requires `reason` audit field — not exposed in UI
- Rollback consistency: re-auction triggers `["bids","purses","players"]` invalidation — same as undo

### Target: <500ms — **Estimated: 300–700ms** (multiple refetches) ⚠️

---

## Cross-Action Stress Matrix

| Action | API calls | SSE events | RQ invalidations (all clients) | Operator re-renders |
|--------|-----------|------------|-------------------------------|---------------------|
| Load Player | 1 POST + 4 GET | 1 | players × 55 | 3–5 |
| Start | 1 POST | 1 | 0 | 1–2 |
| Pause | 1 POST + 4 GET | 1 | 0 | 3–5 |
| Bid | 1 POST + 4 GET | 1 | 0 | 4–6 |
| Sold | 1 POST + 4 GET | 1 | 3 × 55 | 3–5 |
| Unsold | 1 POST + 4 GET | 1 | players × 55 | 3–5 |
| Defer | 1 POST + 4 GET | 1 | players × 55 | 3–5 |
| Undo/Reauction | 1 POST + 4 GET | 1 | 3 × 55 | 3–5 |

---

## Race Condition Catalog

| ID | Scenario | Current behavior | Risk |
|----|----------|------------------|------|
| RC-1 | Bid during SSE disconnect | Optimistic shows bid; server may reject; `invalidate()` on catch refetches | Medium — flash of wrong state |
| RC-2 | Sold double-click | Second POST likely fails (no current player) | Low — server rejects |
| RC-3 | Two operator tabs | Both can POST mutations; last write wins | **High** — no tab leadership |
| RC-4 | LED refresh during sold | OBS `initialOutcomeSeenRef` skips first outcome | Medium — missed animation |
| RC-5 | Rapid defer + next | Server serializes via DB transaction | Low |
| RC-6 | Optimistic bid + SSE stale | SSE delivers authoritative state, overwrites optimistic | Low — self-correcting |

---

## Recommendations

1. **Remove `invalidate()` when SSE connected** — cuts 4 GETs per action
2. **Add `isPending` guard on sell/unsold/defer** — prevent double-click
3. **Wire true undo or rename UI** to "Re-auction" for clarity
4. **Decouple `useLedView` tick** — meet bid <200ms LED target
5. **Embed purse snapshot in `auction_state`** — eliminate purse refetch on sold
6. **Operator tab leadership** via `BroadcastChannel` or server-side session lock
