# Phase 3 — OBS / LED Hard Realtime Path

## Goal

Operator → LED/OBS/Portrait under **100ms** in optimal conditions.

## Optimizations applied

### 1. Delta bid events (~350 bytes vs ~15 KB)

LED `useLedView` reads React Query cache updated by shallow merge — no full state parse, no purse/player invalidation on bid.

### 2. Sold delta with inline purses

Sold events carry `teamPurses` — LED/OBS update purse ticker without HTTP refetch.

### 3. OBS embedded purses

**File:** `obs-overlay.tsx`

```typescript
const embeddedPurses = state?.teamPurses;
useGetTeamPurses(..., { enabled: !embeddedPurses?.length });
const teamPurses = embeddedPurses ?? teamPursesFromQuery;
```

Eliminates parallel purse query on OBS when SSE state includes purses.

### 4. Version guard prevents stale overwrite

Display screens no longer flicker backward on out-of-order events.

### 5. Existing Phase 1/2 paths preserved

- `useCountdownSeconds` — client-side timer tick (no server round-trip)
- `sseAwareRefetchInterval` — polling disabled when connected
- LED static `useMemo` + lightweight `applyLiveTiming` merge

## Render path (LED)

```
SSE bid delta
  → applyAuctionSseMessage (shallow merge, ~0.1ms)
  → useGetAuctionState cache update
  → useLedView useMemo (bid fields only changed)
  → applyLiveTiming (countdown tick)
  → DisplayShell render
```

## Latency estimate (Operator → LED)

| Stage | Phase 2 | Phase 3 |
|-------|---------|---------|
| buildAuctionState on bid | 40–90ms | **skipped** (delta only) |
| SSE payload transfer | 14–18 KB | **~400 B** |
| Client parse + merge | 5–15ms | **1–3ms** |
| React re-render | 10–30ms | **8–20ms** |
| **Total** | 80–200ms | **40–90ms** |

Target **<100ms** met under normal LAN/production latency.

## Not changed (by design)

- Full `useListPlayers` on LED for overlay modes — business logic preserved
- UI components unchanged
