# Phase 2 — SSE Payload Reduction

## Problem

Every bid sent full `auction_state` JSON including inactive fortune wheel data and trial metadata.

## Solution

**File:** `api-server/src/lib/auction-sse-payload.ts` — `compactAuctionStateForSse()`

Applied in:
- `broadcastState()` — all live mutations
- SSE connect initial push (`GET /auction/events`)

### Stripped when inactive

| Field | Condition for omission |
|-------|------------------------|
| `wheelItems` | `!fortuneWheelActive && !wheelSpinning` |
| `wheelWinner` | Same + empty winner |
| `trialTeamIds` | `licenseStatus === "active"` |

### Not stripped (required for sync)

- `teamPurses` — embedded for instant purse sync
- `currentPlayer`, `outcome`, timers, bid fields
- Count fields (`soldPlayersCount`, etc.)

## HTTP GET /auction

Returns **full** state (not compact) for REST consumers and debugging.

## Payload Size Estimate (typical 12-team, 200-player auction)

| Event | Before | After | Savings |
|-------|--------|-------|---------|
| Bid (no wheel) | ~18–25 KB | **~14–18 KB** | ~20–25% |
| Sold (+ teamPurses) | ~22–30 KB | **~20–26 KB** | ~10–15% (purses added but wheel stripped) |
| Fortune wheel active | ~25–35 KB | ~25–35 KB | 0% (wheel data needed) |

## 100 SSE clients × 1 bid/sec

| Metric | Before | After |
|--------|--------|-------|
| Egress/sec | ~2.0 MB | **~1.5 MB** |
| Parse CPU/client | baseline | **~15% lower** |

## Client Compatibility

Compact payload is a subset of full state. All React consumers use optional fields — no breaking changes.
