# Scoring PR-4 + PR-5: LED Display & Match Summary

**Branch:** `cursor/scoring-pr4-led-display-7602`

## PR-4 — LED score display + SSE

### API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/tournaments/:tid/scoring/live` | Public |
| `GET` | `/api/tournaments/:tid/scoring/events` | Public (SSE) |

SSE payload: `{ type: "scoring_state", match, state, summary }`

Broadcast fires on every append/undo via `scoring-broadcast.ts`.

### UI

| Path | Component |
|------|-----------|
| `/tournament/:id/score-display` | `ScoreDisplayShell` (TournamentCodeGate) |

Hook: `useScoringSocket` — mirrors auction SSE pattern.

## PR-5 — Match summary

- `buildCricketMatchSummary()` in `@workspace/scoring-core`
- Persisted to `scoring_matches.summary_json` on match complete/abandon
- `MatchSummaryCard` on scorer when match ends
- LED display shows summary after match completes

## Local test

1. `pnpm dev`
2. Scorer: http://localhost:3000/tournament/1/score
3. LED: http://localhost:3000/tournament/1/score-display
4. Score a few balls on phone — LED updates in real time

## Next (PR-6)

Auction hub integration — sold/retained squads, standings.
