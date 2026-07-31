# Badminton League Groups — Design Spec

**Date:** 2026-07-29  
**Status:** Approved  
**Scope:** VNBL-style team group league with pair-level margin points

## Goal

Support franchise team groups where each team fields N registered pairs. Fixtures are generated as pair-vs-pair rubbers between teams in the same group. Standings rank **pairs** by margin points from won games. Top 4 pairs qualify for knockout.

## Points formula (confirmed)

For each **won game**, add `(winner score − loser score)` rally points. Lost games contribute 0. Example: win 21-15, 21-18 → `6 + 3 = 9` margin points.

## Data model

```
badminton_categories (drawType: round_robin | group_knockout | knockout)
  └── badminton_groups (name, sortOrder)
        └── badminton_group_members (teamId, seed)
  └── badminton_registrations (pairs per category)
  └── badminton_draws (fixture collection, groupId text)
        └── badminton_fixtures (pair A vs pair B)
  └── badminton_pair_standings (registrationId, played, won, lost, marginPoints)
```

## Fixture generation — team tie model

For each group with teams `[T1, T2, T3]` and N pairs per team:

- For each team pair `(Ti, Tj)`, create N rubbers: `Ti.pair[k] vs Tj.pair[k]`
- 3 teams × 5 pairs → 15 fixtures per group (VNBL Group 1/2)

Pairs are sorted by registration `seedNumber` then `id` within each team.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/categories/:catId/groups` | List groups + members |
| PUT | `/categories/:catId/groups` | Replace groups + team assignments |
| POST | `/categories/:catId/generate-league` | Generate group fixtures |
| GET | `/categories/:catId/standings` | Pair standings table |
| GET | `/categories/:catId/qualifiers?limit=4` | Top N pairs |

## Standings rebuild

On match completion, rebuild category standings from completed fixtures + match state snapshots.

## Frontend

Fixtures page: when `drawType === round_robin`, show Groups panel + Generate League instead of knockout auto-generate.

Categories form: allow `round_robin` and `group_knockout` draw types.
