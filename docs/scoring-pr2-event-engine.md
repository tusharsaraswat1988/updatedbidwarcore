# Scoring PR-2: Event Engine

**Branch:** `cursor/scoring-pr2-event-engine-7602`  
**Scope:** Full cricket reducer + REST APIs — no UI, no LED.

## APIs

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/tournaments/:tid/scoring/matches` | Organizer / admin |
| `GET` | `/api/tournaments/:tid/scoring/matches/:mid` | Organizer / admin |
| `POST` | `/api/tournaments/:tid/scoring/matches/:mid/events` | Organizer / admin / scoring PIN |
| `POST` | `/api/tournaments/:tid/scoring/matches/:mid/undo` | Organizer / admin / scoring PIN |

### Create match

```json
POST /api/tournaments/1/scoring/matches
{
  "homeTeamId": 10,
  "awayTeamId": 11,
  "fixtureId": null,
  "oversLimit": 20,
  "roundName": "League",
  "scheduledAt": "2026-06-07T14:00:00.000Z",
  "venue": "Main Ground"
}
```

### Append event

```json
POST /api/tournaments/1/scoring/matches/5/events
{
  "eventType": "cricket.ball.recorded",
  "payload": { ... },
  "expectedSequence": 2
}
```

Returns `409` with `code: SEQUENCE_CONFLICT` on optimistic concurrency mismatch.

### Undo

```json
POST /api/tournaments/1/scoring/matches/5/undo
{ "expectedSequence": 4 }
```

Appends `cricket.ball.undone`; projection replays without the undone ball.

## Cricket reducer

All 7 event types implemented in `@workspace/scoring-core`:

- `cricket.match.started`
- `cricket.lineup.set`
- `cricket.ball.recorded`
- `cricket.innings.ended`
- `cricket.match.completed`
- `cricket.ball.undone` (resolved at replay layer)
- `cricket.match.abandoned`

## Tests

```bash
pnpm --filter @workspace/scoring-core test
pnpm --filter @workspace/api-server test
```

## Next (PR-3)

Mobile-first cricket scorer UI — **after PR-2 review**.
