# Scoring PR-3: Mobile Cricket Scorer UI

**Branch:** `cursor/scoring-pr3-mobile-scorer-7602`  
**Scope:** Mobile-first organizer scorer — no LED, no match summary page.

## Routes

| Path | Screen |
|------|--------|
| `/tournament/:id/score` | Match list + create match |
| `/tournament/:id/score/:matchId` | Pre-match setup + live scoring pad |

Organizer auth required (`OrganizerGuard`). Tournament hub shows **Open Scorer** for cricket tournaments.

## Flow

1. **Match list** — create match (home/away teams, overs limit)
2. **Toss** — winner + bat/bowl → `cricket.match.started`
3. **Playing XI** — sold/retained squad players per team → `cricket.lineup.set`
4. **Openers + bowler** — local bowler selection; openers via lineup batting order
5. **Live pad** — 0–6, Wd, Nb, Wicket (2-tap), Undo
6. **Secondary** — change bowler, end innings, end match

## API additions (PR-3)

| Method | Path |
|--------|------|
| `GET` | `/api/tournaments/:tid/scoring/matches` |

Client: `artifacts/auction-platform/src/lib/scoring-api.ts`

## Key files

- `src/pages/scoring-match-list.tsx`
- `src/pages/scoring-match.tsx`
- `src/components/scoring/live-scoring-pad.tsx`
- `src/components/scoring/pre-match-setup.tsx`

## Tests

```bash
pnpm install
pnpm run typecheck:libs
pnpm --filter @workspace/auction-platform typecheck
pnpm --filter @workspace/scoring-core test
pnpm --filter @workspace/api-server test
```

## Next (PR-4)

LED score display + SSE — **after PR-3 review**.
