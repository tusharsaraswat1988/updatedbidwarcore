# Phase 2 — buildAuctionState Optimization

## Problem

Every broadcast executed:
```sql
SELECT * FROM players WHERE tournament_id = ?
```
Then filtered in JS for sold/unsold/available counts. For 300 players × 60 bids/min = heavy DB + CPU.

## Solution

### 1. SQL aggregation for counts

**File:** `auction.ts` — `countPlayerStatuses()`

```sql
SELECT status, cast(count(*) as int) FROM players
WHERE tournament_id = ? GROUP BY status
```

Replaces full-table load for `soldPlayersCount`, `unsoldPlayersCount`, `remainingPlayersCount`.

### 2. Purse snapshot uses sold/retained subset only

**File:** `team-purse-snapshot.ts`

```typescript
WHERE tournament_id = ? AND status IN ('sold', 'retained')
```

Passed to `computeAllTeamPurseProtections(..., playersOverride)` — avoids loading available/unsold rows for purse math.

### 3. Parallel fetch

```typescript
const [{ soldCount, unsoldCount, availableCount }, teamPurses] = await Promise.all([
  countPlayerStatuses(tournamentId),
  buildTeamPurseSnapshot(tournamentId),
]);
```

## DB Reads Per broadcastState (estimated)

| Read | Before | After |
|------|--------|-------|
| Full players table | 1 (all rows) | **0** |
| Player count aggregate | 0 | **1** (indexed GROUP BY) |
| Sold/retained players | 0 (included in full) | **1** (subset) |
| Teams | 1+ | 1 |
| Session/tournament | 2+ | 2+ |

For 300-player tournament: **~300 rows/read → ~50–80 rows/read** on sold-heavy auctions.

## Latency Estimate

| Metric | Before | After |
|--------|--------|-------|
| buildAuctionState p50 | 80–150ms | **40–90ms** |
| buildAuctionState p99 | 300–800ms | **150–400ms** |
| Slow warning (>300ms) rate | Frequent under load | **Reduced ~40%** |

## Functionality Preserved

- All count fields unchanged semantically
- Purse protection math unchanged (same `computeAllTeamPurseProtections`)
- Category player counts for current player unchanged (targeted query)
- lastSoldPlayer legacy path unchanged (separate bid/player queries)
