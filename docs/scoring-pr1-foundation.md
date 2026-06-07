# Scoring PR-1: Foundation

**Branch:** `cursor/scoring-pr1-foundation-7602`  
**Scope:** Schema + `lib/scoring-core` only — no API, UI, or LED.

## Database

### Tournament columns

- `scoring_enabled`, `scoring_phase`, `scoring_pin`, `scoring_settings_json`

### Tables

| Table | Purpose |
|-------|---------|
| `scoring_fixtures` | Optional scheduling container (Flow B) |
| `scoring_matches` | Playable unit; `fixture_id` nullable (Flow A direct) |
| `scoring_sessions` | Live projection (`state_json` derived from events) |
| `scoring_events` | Append-only source of truth |
| `scoring_standings` | Points table projection |

### Apply schema

```bash
pnpm --filter @workspace/db run push
```

Or run SQL manually: `lib/db/migrations/0001_scoring_foundation.sql`

## lib/scoring-core

- **Types:** `ScoringEventEnvelope`, `MatchMeta`, sport slugs
- **Events:** Cricket event constants + Zod payload schemas (all 7 V1 types)
- **Projector:** Sequence locking, `replayEvents`, error types
- **Cricket reducer (foundation):** `match.started`, `lineup.set` implemented; ball/innings/complete deferred to PR-2

## Tests

```bash
pnpm --filter @workspace/scoring-core test
```

14 tests: sequence locking, event parsing, reducer foundation, replay.

## Next (PR-2)

Event engine API + full cricket reducer — **after PR-1 review**.
