# Scoring PR-6: Auction Hub Integration

**Branch:** `cursor/scoring-pr6-auction-integration-7602`

## Deliverables

### Standings projection

- `buildStandingsFromMatches()` in `@workspace/scoring-core`
- Rebuilds `scoring_standings` when a match completes or is abandoned
- Points: win 2, tie/no-result 1 each, loss 0
- NRR from innings summaries

### API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/tournaments/:tid/scoring/standings` | Public |
| `GET` | `/api/tournaments/:tid/scoring/squads` | Organizer |

Tournament API exposes `scoringEnabled`, `scoringPhase`, `hasScoringPin`, and `scoringPin` (organizer/admin only).

### UI

- **Hub:** Points table when scoring enabled; enable CTA when disabled
- **Settings:** Cricket Scoring tab — toggle + delegate PIN
- **Scorer:** Squad player counts in match create dialog; gated on `scoringEnabled`

## Local test

1. `pnpm dev`
2. `pnpm --filter @workspace/scripts run seed:scoring-local`
3. Hub → points table + scorer links
4. Complete a match → standings update on hub

## Stack

Base branch: `cursor/scoring-pr4-led-display-7602`
