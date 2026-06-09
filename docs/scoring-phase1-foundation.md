# Cricket Scoring Phase 1 — Tournament Foundation

> **Architecture context:** See [cricket-scoring-architecture.md](./cricket-scoring-architecture.md) for the full product architecture, CricHeroes parity matrix, gap analysis, and roadmap.

**Status:** Shipped (merged to `main`)

## Schema

| Table | Purpose |
|-------|---------|
| `scoring_venues` | Grounds / venues |
| `scoring_officials` | Umpires, scorers |
| `scoring_draws` | League / knockout / groups config |
| `scoring_groups` | Group containers |
| `scoring_group_members` | Team membership per group |
| `scoring_match_squads` | Playing XI + bench per match |

Extended: `scoring_fixtures` (draw_id, group_id, bracket_*, venue_id), `scoring_matches` (venue_id, officials_json).

Migration: `lib/db/migrations/0002_scoring_phase1_foundation.sql`

## APIs

Base: `/api/tournaments/:tournamentId/scoring`

| Method | Path | Auth |
|--------|------|------|
| GET | `/public/schedule` | Public |
| GET/POST | `/venues` | Organizer |
| PATCH/DELETE | `/venues/:venueId` | Organizer |
| GET/POST | `/officials` | Organizer |
| GET | `/draws` | Organizer |
| POST | `/draws/generate` | Organizer |
| GET | `/fixtures` | Organizer |
| GET | `/draws/:drawId/groups` | Organizer |
| GET | `/matches/:matchId/squads` | Organizer |
| PUT | `/matches/:matchId/squads/:teamId` | Organizer |

## Schedule generators

`lib/scoring-core/src/cricket/schedule.ts` — round robin, knockout (first round), group stage.

## UI

| Route | Screen |
|-------|--------|
| `/tournament/:id/score/schedule` | Generate draw, venues, fixture list |
| `/tournament/:id/cricket` | Public tournament page |

Pre-match setup: squad picker with playing XI (11) + bench (up to 4).
