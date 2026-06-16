# Phase 3 — Event Versioning

## Problem

Clients applied the latest received message unconditionally. Out-of-order delivery (reconnect race, pub/sub jitter) could briefly show stale bid amounts.

## Solution

Monotonic **version** per tournament, incremented on every published event.

## Server

```typescript
// Redis: INCR auction:version:{tournamentId}
// Local dev: in-memory counter
```

Every SSE frame includes:

```
id: 142
data: {"type":"bid","version":142,...}
```

## Client

**File:** `sync-auction-sse.ts`

```typescript
const versionByTournament = new Map<number, number>();

function isStale(tournamentId, version) {
  return version <= versionByTournament.get(tournamentId) ?? 0;
}
```

- Events with `version <= localVersion` are **ignored**
- Applied events update `eventVersion` on cached state
- `resetAuctionEventVersion()` on tab visibility reconnect before full refetch

## Guarantees

| Scenario | Behavior |
|----------|----------|
| Duplicate delivery | Second copy ignored |
| Out-of-order (rare) | Older version ignored |
| Reconnect snapshot | New version overwrites |

## Limitation

Version is per-tournament, not per-client. Sufficient for auction linearization where mutations are serialized per tournament session.
