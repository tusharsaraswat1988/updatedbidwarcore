# Bid Button Stuck After Rapid Bids — Root Cause & Fix

**Date:** 2026-07-10  
**Severity:** P0  
**Surfaces:** Owner LiveBid button, Operator quick-bid buttons

## Symptom

After repeated rapid bids (especially cross-team bidding wars), the owner bid button could remain disabled / show **HIGHEST BIDDER** incorrectly, or spin forever waiting for an ACK that never unlocked the UI.

## Lifecycle traced

```
tap → useBidLifecycle(submit)
    → POST /tournaments/:id/auction/bid
    → DB optimistic revision commit
    → emitBidEvent (SSE pub/sub, version++)
    → HTTP bid ACK (eventVersion + delta)
    → applyMutationAuctionState (React Query)
    → parallel SSE bid delta → applyAuctionSseMessage
    → canBid / isLeading recompute → BidButton render
```

## Root cause (exact failure point)

`applyMutationAuctionState` **blindly replaced** the auction React Query cache and could **regress** the SSE version cursor.

Race under rapid bidding:

1. Owner A `POST /bid` starts (will be eventVersion `N`)
2. Owner B’s bid commits; SSE `bid` event `N+1` arrives on A’s client → A correctly sees B as leader
3. A’s delayed HTTP response for version `N` arrives and **overwrites** cache with A as leader
4. Version cursor regresses to `N`
5. Bid button stuck on **HIGHEST BIDDER** until a later full-state sync

Secondary failure modes:

- Bid HTTP waited on full `buildAuctionState` after publish → slow/hung ACK left `bidding=true` / `placeBid.isPending` forever
- Owner error parsing used axios-shaped `err.response.data` against `ApiError.data` → “already highest bidder” never mapped to `leading`
- Operator locked all controls on `placeBid.isPending` with no timeout/reset

## Permanent fix

1. **Monotonic version gate** (`@workspace/api-base/auction-bid-sync`) — stale HTTP mutations are rejected
2. **Fast bid ACK** — server returns `{ bidAck, eventVersion, ...delta }` without blocking on full state rebuild; client **merges** ACK into existing state
3. **Never-stuck bid lifecycle** (`useBidLifecycle`) — ACK timeout + watchdog force-idle; request IDs ignore late responses
4. **Operator bid gate** — local lock with `BID_ACK_TIMEOUT_MS` + `placeBid.reset()` on timeout
5. **Structured logging** — `[bid-lifecycle]` events for submit/success/error/timeout/stale rejection
6. **Automated stress tests** — reproduce stale HTTP-after-SSE race and 50 submit/timeout cycles

## Verification

```bash
pnpm --filter @workspace/api-server exec vitest run ../api-base/src/__tests__/auction-bid-sync.test.ts
# or from repo with vitest configured for api-base tests via api-server package
```
