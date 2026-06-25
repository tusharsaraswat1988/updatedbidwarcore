# Phase 2 — Public Viewer Optimization

## Problem

Each `/live/:id` viewer on mount fetched:
- Full player list (~100–500 rows)
- Categories (unused)
- Team purses (separate query)
- Tournament + auction state

100 viewers = 100× full player payloads.

## Solution

### 1. Lazy player list

**File:** `liveviewer.tsx`

```typescript
const needsPlayerList = isCompleted || selectedTeamId !== null;

useListPlayers(tournamentId, {
  enabled: !!tournamentId && needsPlayerList,
});
```

Players load only when:
- Auction completed (`CompletedScreen` needs sold roster), OR
- User opens a team squad sheet (`selectedTeamId !== null`)

Live auction main view uses `state.currentPlayer` and `state.*Count` — no full roster required.

### 2. Removed categories fetch

Removed unused `useListCategories` call — categories were never read in liveviewer.

### 3. Embedded purses from auction state

```typescript
const embeddedPurses = state?.teamPurses;
useGetTeamPurses(..., { enabled: !embeddedPurses?.length });
const teamPurses = embeddedPurses ?? queriedTeamPurses;
```

Initial load: 0 purse HTTP requests when SSE/auction state includes `teamPurses`.

## Before vs After (per viewer mount)

| Request | Before | After (live auction) |
|---------|--------|----------------------|
| GET /players | Always | **Only on squad open or completed** |
| GET /categories | Always | **Removed** |
| GET /team-purses | Always | **Skipped when embedded in state** |
| GET /auction | Yes | Yes (once) |
| GET /tournament | Yes | Yes (once) |
| SSE connect | Yes | Yes |

## 100 Viewer Burst Estimate

| Metric | Before | After |
|--------|--------|-------|
| HTTP GETs on open | ~500 (5×100) | **~200** (2×100) |
| Player list bytes | ~100 × 200KB | **~0** until squad opens |
| Time to interactive | 2–5s on 4G | **<1.5s** |
