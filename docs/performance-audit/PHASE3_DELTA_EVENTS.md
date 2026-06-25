# Phase 3 — Delta SSE Events

## Problem

Every bid sent a full `auction_state` snapshot (~14–18 KB compact). At 1 bid/sec × 500 viewers = heavy bandwidth and parse cost.

## Solution

Hot-path mutations emit **delta events**. Full snapshots only on initial connect, reconnect gap recovery, and complex state transitions.

## Event types

### Bid (every POST /bid)

```json
{
  "type": "bid",
  "version": 142,
  "tournamentId": 1,
  "currentBid": 550000,
  "currentBidTeamId": 3,
  "currentBidTeamName": "Mumbai",
  "currentBidTeamColor": "#004BA0",
  "currentBidTeamLogoUrl": "...",
  "timerEndsAt": "2026-06-15T12:00:15.000Z",
  "timerType": "bid",
  "lastAction": "Mumbai bid ₹5,50,000",
  "bidIncrement": 50000,
  "invalidate": []
}
```

**Payload size:** ~350–500 bytes (~97% reduction vs full state)

### Sold (POST /sell, POST /manual-sell)

```json
{
  "type": "sold",
  "version": 143,
  "playerId": 88,
  "teamId": 3,
  "amount": 550000,
  "lastOutcome": { "type": "sold", ... },
  "teamPurses": [ ... ],
  "soldPlayersCount": 42,
  "unsoldPlayersCount": 5,
  "remainingPlayersCount": 153,
  "currentPlayerId": null,
  "lastSoldPlayer": { ... },
  "invalidate": ["bids", "players"]
}
```

**Payload size:** ~3–6 KB (purses inline, no full player roster)

### Full snapshot (`auction_state`)

Used for: start, pause, next player, undo, re-auction, fortune wheel, mirror, initial SSE connect.

## Client merge

**File:** `auction-platform/src/lib/sync-auction-sse.ts`

- `bid` → shallow merge into React Query auction state cache
- `sold` → merge outcome, counts, purses; invalidate bids/players lists only when needed
- No full cache replace on bid → faster LED/OBS re-render

## HTTP responses

Mutation endpoints still return **full** `buildAuctionState()` JSON for operator panel — SSE path is optimized separately.

## Compatibility

Clients that only handle `auction_state` still work — they receive snapshots on connect and non-bid mutations. Delta handlers are additive.
