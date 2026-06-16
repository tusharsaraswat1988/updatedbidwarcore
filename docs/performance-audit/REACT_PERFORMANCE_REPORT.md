# BidWar React Performance Audit Report

**Audit Date:** 2026-06-15  
**Framework:** React 18 + TanStack React Query v5  
**State Management:** React Query (server state) + local `useState` (UI state). No Redux/Zustand for auction.

---

## Executive Summary

The auction platform has **two monolithic page components** (`auction-operator.tsx` ~2,036 lines, `liveviewer.tsx` ~2,024 lines) that dominate render cost. The LED pipeline (`useLedView`) forces a **full view rebuild every 250ms** regardless of whether auction data changed. Duplicate React Query subscriptions exist on display shells. Context usage is minimal and appropriate except `StageThemeProvider`.

---

## Critical Render Issues

### R1 — `useLedView` 250ms Full Rebuild

**File:** `src/lib/led-view/use-led-view.ts:235–239, 241–626`

```typescript
const [now, setNow] = useState(() => Date.now());
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 250);
  return () => clearInterval(id);
}, []);

return useMemo<LedView>(() => {
  // ... maps ALL players, builds squads, top-5, filters, countdown
}, [/* 20+ deps including `now` */]);
```

| Attribute | Value |
|-----------|-------|
| Screens affected | Main LED, both Portrait panels |
| Rebuild frequency | 4×/second continuously |
| Work per rebuild | O(players × teams) mapping |
| Severity | **Critical** |
| Recommendation | Split countdown into isolated `ServerCountdown` component (already exists elsewhere). Remove `now` from `useMemo` deps. Only rebuild `LedView` when `state`, `players`, `purses` change. |

---

### R2 — Operator Monolith: Unmemoized Derived Data

**File:** `src/pages/auction-operator.tsx:592–662`

Every render recomputes without `useMemo`:
- `available`, `soldPlayers`, `unsoldPlayers`, `deferredPlayers`
- `leftPanelList`, `teamMap`
- Filter/sort of entire player roster

| Attribute | Value |
|-----------|-------|
| Trigger | Any state change (SSE, 5s polls, bid optimistic update) |
| Severity | **High** |
| Recommendation | `useMemo` for filtered lists keyed on `players`, `state.currentPlayerId`, filter state. |

---

### R3 — Duplicate `useGetAuctionState` on Display Shell

**File:** `src/components/display/display-shell.tsx:30–42`

```typescript
const view = useLedView(tournamentId, connectionStatus);  // already calls useGetAuctionState
const { data: state } = useGetAuctionState(tournamentId, { ... });  // duplicate
```

| Attribute | Value |
|-----------|-------|
| Impact | Extra hook subscription; same cache but double render trigger path |
| Severity | **Medium** |
| Recommendation | Use `view` state slice or pass `state` from `useLedView` return. |

---

### R4 — Operator Bid Handler: Triple State Update

**File:** `src/pages/auction-operator.tsx:333–351`

```
1. optimistic qc.setQueryData
2. mutation .then → qc.setQueryData(result)
3. .then → invalidate() → 4 query refetches → 4 re-renders
```

Plus SSE will deliver a 4th `setQueryData`.

| Severity | **High** |
| Recommendation | On success with SSE connected: `setQueryData(result)` only, no `invalidate()`. |

---

### R5 — `liveviewer.tsx` Monolith

**File:** `src/pages/liveviewer.tsx` (~2,024 lines)

- Single component tree for 50 concurrent public instances
- Multiple `useEffect` chains on `state` change: sound engine (L1163+), outcome persistence (L1189+)
- `AnimatePresence` re-layout on cheer messages
- No component splitting for team cards, auction header, squad sheet

| Severity | **High** (at 50 viewer scale) |
| Recommendation | Extract `LiveAuctionHeader`, `TeamPurseGrid`, `SquadSheet` with `React.memo`. |

---

## useEffect Dependency Issues

| Location | Issue | Severity |
|----------|-------|----------|
| `auction-operator.tsx:617–634` | Keyboard shortcuts: `eslint-disable` for incomplete deps | **High** — stale closures for hotkeys under rapid state change |
| `auction-operator.tsx:268–273` | `displayPlayerFilter` sync from state | OK |
| `obs-overlay.tsx:228–274` | Outcome detection effect depends on `state` (whole object) | **Medium** — fires on any state field change |
| `use-auction-socket.ts:37–151` | Correctly excludes `onCheerMessage` via ref | OK |
| `display.tsx` | `BroadcastChannel` theme listener | OK — cleaned up |

---

## useMemo / useCallback Audit

### Good patterns

| Location | Pattern |
|----------|---------|
| `server-countdown.tsx` | Isolated 250ms interval, memoized display |
| `use-timer-expired.ts` | Single timeout, avoids parent rerender |
| `use-sold-animation.ts` | Timer cleanup on unmount |
| `auction-operator.tsx:284–289` | `lastSaleBid` memoized from bids |
| `obs-overlay.tsx:223–226` | `displayMode` memoized |

### Missing memoization

| Location | Should Memoize | Severity |
|----------|----------------|----------|
| `auction-operator.tsx:592–662` | Player lists, teamMap | High |
| `obs-overlay.tsx:301–309` | Teams array mapping | Medium |
| `use-led-view.ts:241–626` | Split: static data vs countdown | Critical |
| `liveviewer.tsx` | Team cards, purse calculations | High |

---

## Re-render Chain Analysis

### Bid increment propagation

```
Operator handleBid
  → qc.setQueryData (auction query)
    → auction-operator re-render (entire 2036-line tree)
  → POST bid
  → qc.setQueryData (mutation result)
    → auction-operator re-render #2
  → invalidate()
    → bids query refetch
    → players query refetch
    → teams query refetch
    → auction query refetch
    → auction-operator re-render #3–6

SSE (parallel, all screens)
  → qc.setQueryData (auction)
    → useLedView useMemo (if state changed)
      → LedStageContent re-render
      → EffectsLayer re-render
    → liveviewer re-render
    → obs-overlay re-render
```

**Operator: 6+ renders per bid.** LED: 1–2 (plus 250ms tick renders).

### Sold propagation

```
POST sell → broadcastState → SSE to all screens
  → setQueryData + invalidate["bids","purses","players"]
    → 3 HTTP refetches per screen with those queries active
    → useLedView full rebuild
    → useSoldAnimation / OBS soldSnap / Live outcome effects
```

---

## Context Over-Rendering

### `StageThemeProvider`

**File:** `src/components/display/v1/` (theme context)

- `setThemeId` / `setCustomAccent` in context value
- Theme picker changes re-render entire LED subtree including `EffectsLayer`
- **Severity:** Low (infrequent during live auction)
- **Recommendation:** Split context into state + dispatch, or use `useRef` for setters

### No auction-wide context

Auction state flows through React Query — **correct pattern**. No global auction context over-rendering issue.

---

## Large Component Trees

| Component | Lines | Child Depth | Risk |
|-----------|-------|-------------|------|
| `auction-operator.tsx` | ~2,036 | Deep inline JSX | High |
| `liveviewer.tsx` | ~2,024 | Deep + animations | High |
| `obs-overlay.tsx` | ~627 | Moderate | Medium |
| `LedStageContent` | Large | Effects + overlays | Medium |
| `use-led-view.ts` | ~628 | N/A (hook) | Critical |

---

## React Query Interaction

| Pattern | Assessment |
|---------|------------|
| `setQueryData` on SSE | **Good** — primary update path |
| `invalidateQueries` after SSE | **Redundant** — triggers unnecessary refetches |
| `refetchInterval` while SSE connected | **Bad** — see API audit |
| `staleTime: 5000` global | Acceptable; per-hook overrides inconsistent |
| Optimistic updates on bid | **Good** intent; undermined by immediate `invalidate()` |

---

## Recommendations by Priority

| Priority | Fix | Files | Expected Impact |
|----------|-----|-------|-----------------|
| P0 | Decouple countdown tick from `useLedView` useMemo | `use-led-view.ts` | −75% LED CPU, −200ms sync lag |
| P0 | Remove `invalidate()` on successful mutations (SSE connected) | `auction-operator.tsx` | −80% operator re-renders per action |
| P1 | Memoize operator derived lists | `auction-operator.tsx` | −50% operator render time |
| P1 | Split `liveviewer.tsx` into memoized subcomponents | `liveviewer.tsx` | −60% public viewer render cost |
| P2 | Remove duplicate queries in display shells | `display-shell.tsx`, `side-display-shell.tsx` | Cleaner subscription graph |
| P2 | Fix keyboard shortcut stale closures | `auction-operator.tsx` | Correctness under stress |
| P3 | `React.memo` on `LedStageContent` with custom comparator | `v1/DisplayShell.tsx` | Minor LED improvement |

---

## Profiling Checklist (Pre-Production)

- [ ] React DevTools Profiler: record 10 bids on operator, count commits
- [ ] React DevTools Profiler: record LED during same 10 bids, measure `useLedView` time
- [ ] Chrome Performance tab: 2-min auction sim, check scripting time on LED tab
- [ ] Verify `why-did-you-render` on `useLedView` output during countdown-only ticks
