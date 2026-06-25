# Phase 2 — SSE Reconnect Backoff

## Problem

Fixed 3s reconnect on all clients. Server restart with 100 connections → 100 simultaneous reconnects every 3s (reconnect storm).

## Solution

**Files:**
- `auction-platform/src/lib/sse-reconnect.ts`
- `auction-platform/src/hooks/use-auction-socket.ts`
- `owner-app/src/hooks/use-auction-socket.ts`

### Algorithm

```typescript
function nextSseReconnectDelayMs(attempt: number): number {
  const cappedAttempt = Math.min(attempt, 5);
  const base = Math.min(30_000, 1_000 * Math.pow(2, cappedAttempt));
  const jitter = Math.floor(Math.random() * base * 0.25);
  return base + jitter;
}
```

| Attempt | Base delay | With jitter (max) |
|---------|------------|-------------------|
| 0 | 1s | ~1.25s |
| 1 | 2s | ~2.5s |
| 2 | 4s | ~5s |
| 3 | 8s | ~10s |
| 4 | 16s | ~20s |
| 5+ | 30s | ~37.5s |

- **Reset** `reconnectAttempt = 0` on successful `onopen` / `onmessage`
- **Reset** on tab visibility reconnect (intentional refresh)

## Before vs After (100 clients, server down 60s)

| Metric | Before (3s fixed) | After (backoff + jitter) |
|--------|-------------------|--------------------------|
| Reconnect attempts/min/client | ~20 | ~8–15 (spread) |
| Simultaneous peak load | All align on 3s boundary | **Desynchronized** |
| Server recovery time | Spike every 3s | Gradual ramp |

## Offline Recovery

Unchanged: when `connectionStatus !== "connected"`, HTTP polling fallback remains active (Phase 1).
