# BidWar Multi-Screen Load Report

**Audit Date:** 2026-06-15  
**Simulation:** 1 Operator + 1 Main LED + 1 Player Portrait + 1 Sponsor Portrait + 1 OBS + 50 Public Viewers  
**Scenario:** Active live auction, fast auctioneer (~1 bid/second sustained)

---

## Simulation Topology

```
                    ┌─────────────────┐
                    │   API Server    │
                    │  (Express + PG) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    SSE (56 conns)      HTTP REST            DB
         │                   │                   │
    ┌────┴────┐         ┌────┴────┐              │
    │         │         │         │              │
 Operator   LED×2    Public×50   Admin?         │
 Portrait×2  OBS                              buildAuctionState
```

| Client | Count | SSE Connections | Primary Queries on Mount |
|--------|-------|-----------------|--------------------------|
| Operator | 1 | 1 | 8 queries + 2×5s polls |
| Main LED | 1 | 1 | 7 queries + 10s poll |
| Player Portrait | 1 | 1 | 7 queries + 10s poll |
| Sponsor Portrait | 1 | 1 | 7 queries + 10s poll |
| OBS | 1 | 1 | 3 queries + 10s poll |
| Public Live | 50 | 50 | 5 queries + 2×30s polls each |
| **Total** | **55** | **55** | — |

*Note: Portrait player and sponsor are typically two browser windows/tabs, each opening a full `useLedView` stack.*

---

## Steady-State Load (Auction Running, 1 bid/second)

### SSE Load

| Metric | Per Second | Per Minute | Notes |
|--------|------------|------------|-------|
| `auction_state` broadcasts | 1 | 60 | Full JSON snapshot per bid |
| SSE writes to clients | 55 | 3,300 | 1 broadcast × 55 connections |
| `buildAuctionState` calls | 1 (+ cache hits) | ~60 | Each loads ALL players from DB |
| Heartbeats | ~2.75 | 165 | 55 clients × 1/20s |

**Estimated SSE payload per bid:** 15–80 KB (depends on player count, teams, session fields) × 55 clients = **0.8–4.4 MB/sec** at 1 bid/sec.

### HTTP REST Load (Redundant Polling)

| Source | Interval | Endpoints | Requests/min (55 clients) |
|--------|----------|-----------|---------------------------|
| Operator bids poll | 5s | `/auction/bids` | 12 |
| Operator purses poll | 5s | `/analytics/team-purses` | 12 |
| LED × 3 screens | 10s | `/auction` | 18 |
| OBS | 10s | `/auction` | 6 |
| Public × 50 | 30s | `/auction` + `/team-purses` | 200 |
| **Polling subtotal** | — | — | **~248/min** |

### HTTP REST Load (Per Bid — Operator Path)

| Step | Requests |
|------|----------|
| `POST /auction/bid` | 1 |
| `invalidate()` → GET auction, bids, players, teams | 4 |
| SSE `setQueryData` (no GET) | 0 |
| Other screens react via SSE only | 0 |
| **Per bid subtotal** | **5** |

**At 1 bid/sec:** 5 × 60 = **300 mutation-driven GETs/min** (operator only).

### Combined HTTP Estimate (1 bid/sec)

| Category | Requests/min |
|----------|--------------|
| Background polling | ~248 |
| Per-bid operator invalidation | ~300 |
| Mount queries (amortized) | ~20 |
| **Total** | **~568 REST requests/min** |

For a 3-hour auction: **~102,000 REST requests** beyond initial page loads.

---

## Initial Page Load Burst (50 Public Viewers Open Together)

**Scenario E from failure report — all 50 open within 30 seconds.**

| Request | Count | Size Estimate |
|---------|-------|---------------|
| `GET /auction/events` (SSE) | 50 | Long-lived connections |
| `GET /auction` (initial) | 50 | Medium |
| `GET /team-purses` | 50 | Small–medium |
| `GET /players` (full roster) | 50 | **Large** (100–500 players × 50) |
| `GET /tournament` | 50 | Small |
| `GET /categories` (unused) | 50 | Wasted |
| `GET /branding` | 50 | Small |
| Immediate SSE state push | 50 | Medium–large each |

**Burst in 30s:** ~350 HTTP GETs + 50 SSE handshakes + 50× `buildAuctionState` for initial SSE push.

**Risk:** Database connection pool saturation; `buildAuctionState` slow warnings (>300ms) cascade.

---

## Render Load (Client-Side)

| Screen | Re-render Triggers | Estimated Rate During Bidding |
|--------|-------------------|-------------------------------|
| Operator | SSE, polls (5s), optimistic bid, mutation | ~4–8/sec during fast bidding |
| Main LED | SSE, 250ms `useLedView` tick, 10s poll | **4/sec minimum** (250ms tick alone) |
| Portrait ×2 | Same as LED | 4/sec × 2 |
| OBS | SSE, 10s poll | ~1–2/sec |
| Public ×50 | SSE, 30s poll, sound effects, cheer | ~1/sec per client (50 total trees) |

### `useLedView` CPU cost

- 250ms `setNow` interval forces `useMemo` rebuild of entire `LedView` object
- Rebuilds: player maps, team squads, top-5 sold, filtered players, countdown
- **3 LED screens × 4 rebuilds/sec = 12 full view derivations/sec**

This is the primary **client-side bottleneck** for LED synchronization lag.

---

## Bottleneck Ranking

| Rank | Bottleneck | Layer | Impact |
|------|------------|-------|--------|
| 1 | `useLedView` 250ms global tick | Client render | LED lags operator by 0–250ms on every change |
| 2 | Full `buildAuctionState` per bid | Server/DB | 100–500ms server latency before SSE |
| 3 | 55 independent SSE connections | Server/network | Memory + write amplification |
| 4 | Operator `invalidate()` per action | HTTP | 4 extra GETs per bid |
| 5 | Public viewer 50× full player list | HTTP/DB | Mount storm |
| 6 | Redundant HTTP polling (248/min) | HTTP | Wasted capacity |
| 7 | Full-state SSE payload | Network | Bandwidth at scale |

---

## Screen Synchronization Speed Model

Estimated end-to-end latency from operator click to UI update:

| Screen | Estimated Latency | Dominant Factor |
|--------|-------------------|-----------------|
| Operator | **50–150ms** | Optimistic update (instant) + mutation confirm |
| Main LED | **200–600ms** | Server buildState + SSE + useLedView 250ms tick |
| Portrait | **200–600ms** | Same as LED |
| OBS | **150–400ms** | Direct `useGetAuctionState` (no useLedView tick) |
| Public | **200–500ms** | SSE + heavy liveviewer re-render |

**Fastest vs slowest gap:** 150–450ms (Operator vs LED) — **exceeds 100ms target, within 500ms problematic threshold.**

---

## Capacity Estimates

### Server (single Node instance, typical cloud)

| Resource | Comfortable | Stressed | Failure |
|----------|-------------|----------|---------|
| SSE connections | <100 | 100–300 | >500 |
| `buildAuctionState`/sec | <5 | 5–15 | >20 |
| REST req/sec | <20 | 20–50 | >100 |
| Concurrent tournaments | 1 live | 2–3 live | 5+ live |

### Client (LED machine — venue PC)

| Resource | Comfortable | Stressed |
|----------|-------------|----------|
| `useLedView` rebuilds/sec | <4 | >8 |
| Chrome tabs (6 screens) | 6 | 10+ |
| Memory per LED tab | ~150MB | >400MB |

---

## Load Test Recommendations

1. **k6 SSE load:** 55 concurrent `EventSource` connections, measure `buildAuctionState` p99
2. **k6 REST burst:** 50 parallel `GET /players` + `GET /auction`
3. **Bid throughput:** 2 bids/sec for 5 min, measure operator→LED delay with timestamp injection
4. **Reconnect storm:** Kill server, restart, measure 55-client reconnect time to consistent state
5. **Memory:** Chrome DevTools heap snapshot on LED tab after 2-hour simulated auction

---

## Optimization Impact Predictions

| Fix | SSE Writes/min | HTTP req/min | LED Sync Gap |
|-----|----------------|--------------|--------------|
| SSE singleton (55→1 per screen type) | −0% (same events) | −0% | No change |
| Remove polling when connected | 0 | −248 | No change |
| Remove operator invalidate() | 0 | −300 | No change |
| Slim SSE payload | −40% bytes | 0 | −50ms |
| useLedView: decouple tick from full rebuild | 0 | 0 | **−200ms** |
| Lazy public player list | 0 | −100 on mount | No change |

**Combined realistic improvement:** HTTP −90%, LED sync gap **<200ms**, server CPU −30%.
