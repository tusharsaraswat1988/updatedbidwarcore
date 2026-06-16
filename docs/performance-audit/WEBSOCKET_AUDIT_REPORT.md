# BidWar WebSocket / Realtime Audit Report

**Audit Date:** 2026-06-15  
**Important:** BidWar does **not** use Socket.io or WebSockets for auction sync. Realtime transport is **Server-Sent Events (SSE)** via `EventSource`. This report audits the actual realtime layer; naming in code uses `useAuctionSocket` but implementation is SSE.

**Primary hook:** `src/hooks/use-auction-socket.ts`  
**Server registry:** `api-server/src/lib/broadcast.ts`  
**Server routes:** `api-server/src/routes/auction.ts`

---

## Architecture Overview

```
Operator Action
  → POST /api/tournaments/:id/auction/{action}
  → DB mutation (PostgreSQL via Drizzle)
  → invalidateStateCache(tournamentId)
  → buildAuctionState(tournamentId)  [loads session, ALL players, teams, categories]
  → broadcastToTournament(tid, { type: "auction_state", state, invalidate })
  → All SSE clients for tournament receive full JSON snapshot
  → Client: qc.setQueryData(auctionStateKey, state)
  → Optional: invalidateQueries(bids | purses | players)
  → React re-render → UI update
```

**No granular events.** Every action (bid, sold, pause, defer) emits the same `auction_state` message type with a full state object.

---

## SSE Event Catalog

| Event Type | Payload | Server Emitter | Client Handler |
|------------|---------|----------------|----------------|
| `auction_state` | `{ state: AuctionState, invalidate?: string[] }` | All auction mutations via `broadcastState()` | `setQueryData` + conditional `invalidateQueries` |
| `settings_changed` | (no body read) | `tournaments.ts` PATCH | `invalidateQueries(auction state)` |
| `cheer_message` | Fan reaction data | `POST .../cheer` | Live viewer callback only |
| Heartbeat | `: heartbeat\n\n` (comment line) | Every 20s on SSE connection | Ignored by client |

### `invalidate` hints (secondary HTTP refetches)

| Server Action | `invalidate` array |
|---------------|-------------------|
| next-player, unsold, defer | `["players"]` |
| sell, manual-sell, undo, re-auction | `["bids", "purses", "players"]` |
| bid, start, pause, timer start/stop | `[]` (state only) |

---

## Screen Subscription Map

| Screen | Route | SSE Instances | Additional Realtime |
|--------|-------|---------------|---------------------|
| Operator Panel | `/tournament/:id/auction` | 1× `useAuctionSocket` | None |
| Main LED | `/tournament/:id/display` | 1× in `display-shell.tsx` | `BroadcastChannel` for theme only |
| Portrait Player | `/tournament/:id/side-display?panel=player` | 1× in `side-display-shell.tsx` | Same as LED |
| Portrait Sponsor | `/tournament/:id/side-display?panel=sponsors` | 1× (same shell, different panel) | Sponsor carousel is client timer |
| OBS | `/tournament/:id/obs` | 1× in `obs-overlay.tsx` | None |
| Public Live | `/live/:id` | 1× in `liveviewer.tsx` | `cheer_message` callback |
| Break Timer | `/tournament/:id/break-timer` | **None** | 2s HTTP poll only |

### Admin duplicate connections (production risk if admin open during live)

| Component | SSE Connections per Tournament |
|-----------|-------------------------------|
| `live-auction-monitor.tsx` | 3 (parent + 2× `LiveConnectionStatus`) |
| `live-displays-panel.tsx` (detail) | 5 (one per `DisplayEndpointRow`) |
| `live-operator-sessions-panel.tsx` | 2 |
| `live-displays-panel.tsx` (list) | N (one per live tournament row) |

`LiveConnectionStatus` always calls `useAuctionSocket` internally instead of accepting a shared status prop.

---

## Connection Lifecycle

### Connect (`use-auction-socket.ts:63–126`)

```typescript
new EventSource(`/api/tournaments/${tournamentId}/auction/events`)
```

- `onopen` → `connectionStatus = "connected"`
- `onmessage` → parse JSON, update RQ cache, mark connected
- `onerror` → close, `reconnecting`, retry in **3 seconds** (fixed, no backoff)

### Reconnect behavior

| Trigger | Action | Risk |
|---------|--------|------|
| `onerror` | Close + retry after 3s | Fixed interval reconnect storm if server down |
| 5s continuous retry | Escalate to `disconnected` | Good UX signal |
| Tab `visibilitychange → visible` | `invalidateQueries(auction)` + **new `connect()`** | Burst on multi-tab focus |
| Unmount | `destroyed=true`, close ES, clear timers, remove listener | **Clean** |

### Server connect (`auction.ts:725+`)

1. `addSseClient(tournamentId, res)`
2. Immediate full `auction_state` push
3. 20s heartbeat interval
4. `req.on("close")` → `removeSseClient`

### Server broadcast (`broadcast.ts:20–30`)

- Iterates `clients` Set synchronously
- Failed `res.write` → client removed from Set
- **No batching, no compression, no delta updates**

---

## Findings

### Critical

| ID | Issue | Evidence | Recommendation |
|----|-------|----------|----------------|
| WS-C1 | **No per-tournament SSE singleton** | Every `useAuctionSocket()` opens new `EventSource` | React Context or module registry: one connection per `tournamentId`, fan-out to subscribers |
| WS-C2 | **Full state snapshot per bid** | `broadcastState` sends entire `AuctionState` including player counts | Add delta events (`bid_placed`, `player_sold`) for hot path; keep snapshot for reconnect |
| WS-C3 | **`buildAuctionState` loads ALL players** | `auction.ts:467–470` on every broadcast | Pre-compute counts in DB/materialized view; exclude full player list from broadcast payload |

### High

| ID | Issue | Evidence | Recommendation |
|----|-------|----------|----------------|
| WS-H1 | **Duplicate admin SSE connections** | `LiveConnectionStatus` embeds own hook | Pass `connectionStatus` as prop from parent |
| WS-H2 | **Reconnect storm (3s fixed × N tabs)** | 6 screens + 50 viewers = 56 independent retry loops | Exponential backoff with jitter (1s→2s→4s, cap 30s) |
| WS-H3 | **Visibility reconnect without debounce** | `use-auction-socket.ts:133–137` | Debounce 500ms; coalesce across rapid focus events |
| WS-H4 | **SSE + HTTP poll dual transport** | All screens poll while SSE connected | Disable polls when `connected` (see API audit) |
| WS-H5 | **Break timer has no SSE** | `break-timer.tsx` HTTP-only 2s poll | Add `useAuctionSocket` |

### Medium

| ID | Issue | Evidence | Recommendation |
|----|-------|----------|----------------|
| WS-M1 | **Secondary invalidation after SSE** | `invalidateQueries` for bids/purses/players triggers HTTP GETs | Prefer embedding bid/purse deltas in `auction_state`; or `setQueryData` for known mutations |
| WS-M2 | **500ms server state cache** | `STATE_CACHE_TTL_MS = 500` | Good for DB; but rapid bids within 500ms share cache (acceptable). Monitor `buildAuctionState` >300ms warnings |
| WS-M3 | **Owner app ignores `settings_changed`** | Owner `use-auction-socket.ts` slimmer handler | Add settings invalidation for parity |
| WS-M4 | **No client-side event ordering** | Messages assumed in-order | Add `stateVersion` or `seq` field; client ignores stale sequences |

### Low

| ID | Issue | Evidence | Recommendation |
|----|-------|----------|----------------|
| WS-L1 | **Misleading "socket" naming** | `useAuctionSocket` is SSE | Rename to `useAuctionSSE` in future refactor |
| WS-L2 | **No connection quality metric** | Only connected/reconnecting/disconnected | Track last message timestamp; show latency in operator UI |
| WS-L3 | **Cheer flood** | Unbounded cheer POSTs (client 8s cooldown) | Server rate limit per IP/session |

---

## Listener Leak Analysis

| Component | Listeners | Cleanup on Unmount | Verdict |
|-----------|-----------|-------------------|---------|
| `useAuctionSocket` | `EventSource.onmessage/onerror/onopen`, `visibilitychange` | Yes (lines 143–150) | **OK** |
| `useScoringSocket` | Same pattern | Yes | **OK** |
| `useBroadcastAudio` | click/keydown, intervals | Yes + `mgr.dispose()` | **OK** |
| `ServerCountdown` | 250ms interval | Yes | **OK** |
| `useBadmintonMatch` | EventSource | `es.close()` only | **Partial** |
| `obs-overlay.tsx` soldTimer | setTimeout 7s | **No unmount cleanup** | **Leak risk** |
| `liveviewer.tsx` | Multiple setTimeouts | Partial cleanup | **Low risk** |
| Server `clients` Set | Per HTTP connection | `req.on("close")` | **OK** |

**No `socket.off` pattern exists** (not Socket.io). SSE cleanup via `EventSource.close()` is correctly implemented in the primary auction hook.

---

## Event Flood Analysis

### Per auction action — server work

| Action | DB Writes | `buildAuctionState` | SSE Payload Size | Client HTTP Invalidations |
|--------|-----------|---------------------|------------------|----------------------------|
| Bid | 1 session update | Full rebuild | Large (full state) | 0 from SSE; operator adds 4 GETs |
| Sold | Session + player + team + bid insert | Full rebuild | Large | 3 invalidations × all clients |
| Next player | Session update | Full rebuild | Large | 1 invalidation (players) × all clients |
| Pause | Session update | Full rebuild | Medium | 0 |

### Worst-case: 1 bid/second for 60 seconds

- 60× `buildAuctionState` (each loads ALL players from DB)
- 60× full JSON broadcast to N SSE clients
- 60× operator `invalidate()` → 240 extra GETs
- 60× potential `invalidate["bids"]` on sell transitions

**At 56 SSE clients + server:** 3,360 SSE writes/minute during rapid bidding.

---

## Reconnect Storm Scenario

**Trigger:** Server restart or network blip during live auction.

1. 56 clients detect `onerror` simultaneously
2. Each schedules reconnect in 3s
3. 56 simultaneous `GET /auction/events` + 56 immediate full state pushes
4. Each triggers `buildAuctionState` (cache empty after restart)
5. Tab visibility events add more reconnects
6. HTTP polls continue in parallel

**Mitigation:** SSE singleton + backoff + connection-aware polling disable.

---

## Recommendations Summary

| Priority | Fix | Impact |
|----------|-----|--------|
| P0 | SSE singleton per tournamentId | −80% connection overhead on server |
| P0 | Slim broadcast payload (no full player list in hot path) | −50% SSE bytes per event |
| P1 | Exponential backoff on reconnect | Prevents reconnect storms |
| P1 | Disable HTTP polls when SSE connected | Eliminates dual-transport |
| P2 | Delta events for bids | Sub-100ms propagation to all screens |
| P2 | `stateVersion` for ordering | Prevents stale overwrites |
| P3 | Rename hook to `useAuctionSSE` | Developer clarity |

---

## Server-Side Emission Path Reference

```
auction.ts mutation handler
  → invalidateStateCache(tid)
  → getCachedOrBuildState(tid)     // 500ms TTL cache
  → broadcastToTournament(tid, payload)
      → broadcast.ts: for each client where client.tournamentId === tid
          → res.write(`data: ${JSON.stringify(payload)}\n\n`)
```

**Exported for other modules:** `broadcastState`, `invalidateStateCache` (used by purse-boosters, fortune wheel).
