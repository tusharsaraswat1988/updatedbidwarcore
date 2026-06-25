# BidWar API Audit Report

**Audit Date:** 2026-06-15  
**Scope:** Six live auction screens + supporting infrastructure  
**Codebase:** `updatedbidwarcore/artifacts/auction-platform`  
**API Client:** Orval-generated TanStack React Query hooks (`@workspace/api-client-react`)  
**Transport:** REST via `customFetch`; realtime via SSE (not polled for state when working correctly)

---

## Executive Summary

BidWar uses a sound React Query + SSE architecture, but **every screen runs redundant HTTP polling alongside SSE**. The operator panel is the worst offender (5s polls on bids and purses while already receiving SSE invalidations). Display screens over-fetch full player rosters on mount. Several fetches bypass React Query entirely, preventing deduplication.

**Estimated redundant API load during a live auction (6 screens + 50 public viewers):**
- ~12–18 unnecessary GETs/minute from operator polling alone
- ~6 GETs/minute from LED/OBS 10s auction-state polls × 4 screens
- ~100 GETs/minute from public viewer 30s polls × 50 viewers (auction state + purses)
- Mutation-triggered `invalidate()` bursts on every operator action

---

## Infrastructure

| Component | Path | Notes |
|-----------|------|-------|
| QueryClient defaults | `src/App.tsx` | `retry: 1`, `staleTime: 5000` |
| HTTP mutator | `lib/api-client-react/src/custom-fetch.ts` | Native fetch wrapper |
| SSE hook | `src/hooks/use-auction-socket.ts` | `setQueryData` + selective `invalidateQueries` |
| LED aggregator | `src/lib/led-view/use-led-view.ts` | 6 parallel queries per LED screen |

---

## Screen API Inventory

### Screen 1 — Operator Panel (`/tournament/:id/auction`)

**File:** `src/pages/auction-operator.tsx`

| Endpoint | Hook/Caller | Frequency | Severity |
|----------|-------------|-----------|----------|
| `GET /api/tournaments/:id/auction/events` | `useAuctionSocket` | Persistent SSE | — |
| `GET /api/tournaments/:id/auction` | `useGetAuctionState` | Mount + SSE `setQueryData` + `invalidate()` per action | Medium |
| `GET /api/tournaments/:id/teams` | `useListTeams` | Mount + `invalidate()` per action | Medium |
| `GET /api/tournaments/:id/players` | `useListPlayers` | Mount + `invalidate()` per action | Medium |
| `GET /api/tournaments/:id/auction/bids` | `useListBids` | Mount + **5s poll** + SSE invalidation | **Critical** |
| `GET /api/tournaments/:id/analytics/team-purses` | `useGetTeamPurses` | Mount + **5s poll** + SSE invalidation | **Critical** |
| `GET /api/tournaments/:id/categories` | `useListCategories` | Mount | Low |
| `GET /api/tournaments/:id` | `useGetTournament` | Mount | Low |
| `GET /api/auth/organizer/:id/me` | `OrganizerGuard` | Mount | Low |
| `GET /api/branding` | `OperatorLayout` (×2 instances) | Mount ×2 | Medium |
| `GET /api/sports/by-slug/:sport/roles` + specs | `useRoleSpecGroups` | Per current-player role change | Low |
| `POST /api/tournaments/:id/auction/fortune-wheel` | Mount `useEffect` | **Every operator page open** | **High** |

**`invalidate()` scope** (lines 317–322): auction state, bids, players, teams — **excludes team-purses** (relies on 5s poll or SSE `invalidate: ["purses"]` on sell/undo only).

---

### Screen 2 — Main LED (`/tournament/:id/display`)

**Files:** `src/pages/display.tsx` → `src/components/display/display-shell.tsx` → `useLedView`

| Endpoint | Caller | Frequency | Severity |
|----------|--------|-----------|----------|
| `GET /api/tournaments/:id` | `TournamentCodeGate` (raw fetch) + `useLedView` + `DisplayShell` | Gate + RQ (deduped after gate) | High |
| `GET /api/tournaments/:id/auction/events` | `useAuctionSocket` | Persistent SSE | — |
| `GET /api/tournaments/:id/auction` | `useLedView` + duplicate in `DisplayShell` | Mount + **10s poll** + SSE | **High** |
| `GET /api/tournaments/:id/analytics/team-purses` | `useLedView` | Mount; SSE invalidates on sell | Medium |
| `GET /api/tournaments/:id/players` | `useLedView` | Mount (full roster) | **High** |
| `GET /api/tournaments/:id/categories` | `useLedView` | Mount (full list) | Medium |
| `GET /api/tournaments/:id/auction/bids` | `useLedView` | When `currentPlayerId` set | Medium |
| `GET /api/branding` | `useBranding` inside `useLedView` | Mount | Medium |

---

### Screen 3 — Portrait Player/Sponsor (`/tournament/:id/side-display`)

**Files:** `src/pages/side-display.tsx` → `side-display-shell.tsx` → `useSideLedView` → `useLedView`

Identical API profile to Main LED. **Two portrait screens = 2× full LED query set.**

---

### Screen 4 — OBS (`/tournament/:id/obs`)

**File:** `src/pages/obs-overlay.tsx`

| Endpoint | Caller | Frequency | Severity |
|----------|--------|-----------|----------|
| `GET /api/tournaments/:id/auction/events` | `useAuctionSocket` | Persistent SSE | — |
| `GET /api/tournaments/:id/auction` | `useGetAuctionState` | Mount + **10s poll** | **High** |
| `GET /api/tournaments/:id` | `useGetTournament` | Mount | Low |
| `GET /api/tournaments/:id/teams` | `useListTeams` | Mount | **Medium** — uses `listTeams` not `team-purses`; purse math may diverge from LED |

---

### Screen 5 — Public Live (`/live/:id`)

**File:** `src/pages/liveviewer.tsx`

| Endpoint | Caller | Frequency | Severity |
|----------|--------|-----------|----------|
| `GET /api/tournaments/:id/auction/events` | `useAuctionSocket` | Persistent SSE | — |
| `GET /api/tournaments/:id` | `useGetTournament` | Mount; `staleTime: 15s` | Low |
| `GET /api/tournaments/:id/auction` | `useGetAuctionState` | Mount + **30s poll** (disabled when completed) | **High** |
| `GET /api/tournaments/:id/analytics/team-purses` | `useGetTeamPurses` | Mount + **30s poll** | **High** |
| `GET /api/tournaments/:id/players` | `useListPlayers` | Mount (full roster, no poll) | **Critical** at scale |
| `GET /api/tournaments/:id/categories` | `useListCategories` | Mount — **data never consumed** | Medium |
| `GET /api/branding` | `useBranding` | Mount | Low |
| `POST /api/tournaments/:id/cheer` | Raw `fetch` | Per cheer (~8s client cooldown) | Low |

---

## Detailed Findings

### Critical

| ID | Endpoint | Caller | Frequency | Recommendation |
|----|----------|--------|-----------|----------------|
| C1 | `GET .../auction/bids` | `auction-operator.tsx:282` | 5s poll + SSE `invalidate["bids"]` + mutation `invalidate()` | Remove `refetchInterval: 5000`. Use SSE + mutation response only. Poll only when `connectionStatus === "disconnected"`. |
| C2 | `GET .../analytics/team-purses` | `auction-operator.tsx:294` | 5s poll + SSE `invalidate["purses"]` on sell/undo | Same as C1. Add purses to `invalidate()` for all sell/unsold paths. |
| C3 | `GET .../players` (full roster) | `liveviewer.tsx` | Every public viewer mount | Lazy-load: use auction-state counts for header; fetch players only when squad sheet opens. Or paginate/slim endpoint. |
| C4 | `POST .../auction/fortune-wheel` reset | `auction-operator.tsx:239–246` | Every operator page load | Gate: only reset if `state.fortuneWheelActive === true`. |

### High

| ID | Endpoint | Caller | Frequency | Recommendation |
|----|----------|--------|-----------|----------------|
| H1 | `GET .../players` + `categories` | `use-led-view.ts:210–221` | Every LED/side-display mount | Split queries: default live view needs state + purses + current bids only. Defer full lists until overlay modes active. |
| H2 | `GET .../auction` 10s poll | `use-led-view.ts:198`, `obs-overlay.tsx:207` | 10s while SSE connected | `refetchInterval: connectionStatus !== "connected" ? 10000 : false` |
| H3 | Duplicate `useGetAuctionState` | `display-shell.tsx:37` | Redundant subscription | Use `view` from `useLedView` for audio/displayMode; remove shell-level duplicate. |
| H4 | `GET .../tournaments/:id` raw fetch | `tournament-code-gate.tsx` | Gate mount, then RQ again | Hydrate RQ cache from gate response or use `useGetTournament` in gate. |
| H5 | `handleBid` triple-update | `auction-operator.tsx:343–350` | Per bid: optimistic + mutation + `invalidate()` | On success: `setQueryData(result)` only; skip `invalidate()`. SSE will also deliver state. |
| H6 | Public 30s polls | `liveviewer.tsx:994,1012` | 30s × N viewers while SSE connected | Disable polls when `connectionStatus === "connected"`. |

### Medium

| ID | Endpoint | Caller | Frequency | Recommendation |
|----|----------|--------|-----------|----------------|
| M1 | `GET /api/branding` | Multiple `useBranding()` instances | 2× operator, 1× per other screen | `BrandingProvider` + RQ with `staleTime: 300000`. |
| M2 | `GET .../categories` unused | `liveviewer.tsx` | Every mount | Remove or wire into squad enrichment. |
| M3 | `invalidate()` omits purses | `auction-operator.tsx:317–322` | After sell/unsold/defer | Add `getGetTeamPursesQueryKey` to `invalidate()`. |
| M4 | Tab visibility burst | `use-auction-socket.ts:133–137` | Each tab focus: GET + SSE reconnect | Debounce 300–500ms; skip reconnect if last message < 5s ago. |
| M5 | OBS `listTeams` vs `team-purses` | `obs-overlay.tsx:212` | Once | Align on `useGetTeamPurses` for consistent purse display. |
| M6 | `break-timer.tsx` 2s poll only | `break-timer.tsx:50` | 2s HTTP, no SSE | Wire `useAuctionSocket`; disable poll when connected. |

### Low

| ID | Endpoint | Caller | Frequency | Recommendation |
|----|----------|--------|-----------|----------------|
| L1 | Sport role/spec chain | `useRoleSpecGroups` | Per role change | Cache roles per sport slug in RQ. |
| L2 | Cheer POST | `liveviewer.tsx` | Per user action | Acceptable; client cooldown exists. |
| L3 | Global `staleTime: 5s` | `App.tsx` | Mixed with per-hook overrides | Document convention: SSE-primary screens use longer staleTime. |

---

## Execution Path Traces

### Bid Increment (worst-case API storm)

```
Operator clicks team bid button
  → optimistic qc.setQueryData (auction state)           [0ms, local]
  → POST /api/tournaments/:id/auction/bid                [50–300ms]
  → Server: DB update → buildAuctionState → SSE broadcast
  → qc.setQueryData(mutation result)                     [response]
  → invalidate() → GET auction, bids, players, teams     [4 parallel GETs]
  → SSE arrives → setQueryData + optional invalidate bids [duplicate GET]
  → Operator 5s poll may also fire bids/purses             [background]
```

**Per bid: 1 POST + up to 6 GETs** (should be: 1 POST + 0 GETs when SSE healthy).

### Sold

```
POST /api/tournaments/:id/auction/sell
  → broadcastState(tid, ["bids", "purses", "players"])
  → All screens: setQueryData(state) + invalidate 3 query keys
  → Operator invalidate() → 4 more GETs
```

### Load Player (next-player)

```
POST /api/tournaments/:id/auction/next-player
  → broadcastState(tid, ["players"])
  → SSE: setQueryData + invalidate players
  → Operator invalidate() → auction, bids, players, teams GETs
  → LED useLedView: useListBids enabled when currentPlayerId changes → new GET
```

---

## Polling Summary Table

| Location | Interval | Endpoint(s) | Runs While SSE Connected? |
|----------|----------|-------------|---------------------------|
| `auction-operator.tsx` | 5s | bids, team-purses | **Yes** |
| `use-led-view.ts` | 10s | auction state | **Yes** |
| `obs-overlay.tsx` | 10s | auction state | **Yes** |
| `liveviewer.tsx` | 30s | auction state, purses | **Yes** |
| `break-timer.tsx` | 2s | auction state | N/A (no SSE) |

---

## Missing Patterns

| Pattern | Status | Impact |
|---------|--------|--------|
| Connection-aware polling | **Missing** | Redundant load on all screens |
| Shared branding cache | **Missing** | Duplicate GET /api/branding |
| Slim auction-state endpoint | **Missing** | Full state includes all player counts; LED still fetches full player list separately |
| Debounced invalidation | **Missing** | Rapid actions cause GET bursts |
| Request coalescing beyond RQ dedup | **Partial** | Raw fetches in gate/branding bypass RQ |

---

## Priority Fix Order

1. Gate all `refetchInterval` on SSE `connectionStatus !== "connected"`
2. Remove operator 5s bids/purses polls
3. Remove `invalidate()` after successful mutations when SSE is connected
4. Slim `useLedView` default queries (lazy player/category lists)
5. Add `BrandingProvider` with React Query
6. Unify OBS on `team-purses` endpoint
7. Lazy-load public viewer player list
8. Remove unused `listCategories` from live viewer
