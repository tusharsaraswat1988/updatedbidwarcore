# Phase 3 — Redis Pub/Sub for Auction Events

## Problem

SSE clients registered only on the Node process that handled their connection. Operator on Server A → viewers on Server B saw stale state.

## Solution

Every auction mutation publishes to Redis channel `auction:event:{tournamentId}`.

All app instances subscribe via `PSUBSCRIBE auction:event:*` and fan out to **local** SSE clients only.

## Architecture

```
Server A (mutation)                Server B (viewer SSE)
      │                                    │
      ├─ publishAuctionEvent()             │
      │    ├─ INCR version                 │
      │    ├─ LPUSH event buffer           │
      │    └─ PUBLISH auction:event:{tid} ─┼──► pmessage handler
      │                                    │         │
      │                                    │         └─ writeSseToLocalClients()
      └─ (Redis pub/sub also delivers      │
          back to A's subscriber)          │
          └─ writeSseToLocalClients()      │
```

**No duplicate writes:** Publisher does not write SSE directly when Redis is enabled — only the subscriber path writes locally (including on the originating node).

## Files

| File | Role |
|------|------|
| `lib/auction-events.ts` | `publishAuctionEvent`, buffer, version |
| `lib/broadcast.ts` | Local SSE client registry + `writeSseToLocalClients` |
| `lib/redis.ts` | Dedicated subscriber connection |
| `index.ts` | `startAuctionEventSubscriber()` on boot |

## Event types published

- `auction_state` — full snapshot (start, pause, next player, etc.)
- `bid` — delta (hot path)
- `sold` — delta with purses + counts
- `cheer_message` — fan cheers
- Future: `unsold`, settings via same pipeline

## Single-node dev

Without `REDIS_URL`, events write directly to local SSE clients (Phase 1 behavior).
