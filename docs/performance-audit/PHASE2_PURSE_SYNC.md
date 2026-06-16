# Phase 2 — Purse Sync via SSE

## Problem

Sold / Undo / Re-auction triggered `invalidate: ["purses"]` → separate `GET /analytics/team-purses` on every client. LED, OBS, and Public could show stale purse values for 100–500ms after sold.

## Solution

Embed `teamPurses[]` in every `buildAuctionState()` response and SSE `auction_state` payload.

## Changes

| Layer | File | Change |
|-------|------|--------|
| Server | `api-server/src/lib/team-purse-snapshot.ts` | **NEW** — shared purse builder (sold/retained roster only) |
| Server | `api-server/src/routes/auction.ts` | `buildAuctionState` includes `teamPurses`; `broadcastState` strips `purses` from invalidate when embedded |
| Server | `api-server/src/routes/analytics.ts` | Delegates to `buildTeamPurseSnapshot` |
| Server | `api-server/src/routes/purse-boosters.ts` | Removed `purses` invalidation (state includes purses) |
| OpenAPI | `lib/api-spec/openapi.yaml` | `AuctionState.teamPurses` array |
| Types | `lib/api-client-react/.../api.schemas.ts` | `teamPurses?: TeamPurse[]` on `AuctionState` |
| Client | `auction-platform/src/lib/sync-auction-sse.ts` | **NEW** — `setQueryData` for auction + team-purses caches |
| Client | `use-auction-socket.ts` | Uses `applyAuctionSseMessage`; skips purse invalidation when embedded |
| Client | `use-mutation-sync.ts` | Syncs `teamPurses` from mutation response |
| Client | `use-led-view.ts` | Prefers `state.teamPurses` over separate query |
| Client | `liveviewer.tsx` | Prefers embedded purses; disables purse query when present |
| Owner | `owner-app/use-auction-socket.ts` | Same purse cache sync + backoff |

## Data Flow (Sold)

```
POST /auction/sell
  → buildAuctionState (includes teamPurses)
  → SSE { type: auction_state, state: { ..., teamPurses }, invalidate: ["bids","players"] }
  → applyAuctionSseMessage
      → setQueryData(auctionState)
      → setQueryData(teamPurses)   // immediate, no HTTP
  → All screens render updated purses from cache
```

## invalidate["purses"] Status

| Location | Before | After |
|----------|--------|-------|
| sell / manual-sell / undo / re-auction | `["bids","purses","players"]` | `["bids","players"]` (purses stripped server-side when embedded) |
| purse-boosters | `["purses"]` | `[]` |
| SSE client | Always invalidated purses query | Invalidates only if `teamPurses` missing from payload |

## Expected Latency Improvement

| Screen | Before (purse after sold) | After |
|--------|---------------------------|-------|
| LED | 200–800ms (HTTP refetch tail) | **0–50ms** (same SSE message) |
| OBS | 200–700ms | **0–50ms** |
| Public | 200–750ms | **0–50ms** |
