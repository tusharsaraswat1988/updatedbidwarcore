# Sport Generalization Plan

**Principle:** Minimum changes for cricket + badminton today. No enterprise abstractions unless they solve a real problem.

---

## Target Model: SPORT CORE

```
SPORT CORE
├── sports                    ✅ exists
├── sport_rules               ❌ missing (embedded in JSON columns)
├── sport_event_types         ❌ missing (hardcoded in TS)
├── sport_stat_types          ❌ missing (NRR hardcoded)
│
├── tournaments               ✅ exists
├── teams                     ✅ exists (auction module)
├── players                   ⚠️ split (players + badminton_players)
├── squads                    ⚠️ event-only (cricket lineup events)
├── fixtures                  ⚠️ duplicated (scoring_fixtures + badminton_fixtures)
├── matches                   ✅ scoring_matches (leaky)
├── standings                 ❌ cricket-only table
├── events                    ✅ scoring_events
│
├── broadcasts                ⚠️ in-memory only, per-sport
├── overlays                  ⚠️ per-sport components
├── streams                   ⚠️ per-sport SSE endpoints
└── channels                  ❌ not modeled

SPORT EXTENSIONS
├── cricket_*                 → reducer + standings logic (in scoring-core)
├── badminton_*               → 8 tables + badminton-core (branch)
└── future_sport_*            → must NOT copy badminton table sprawl
```

---

## What Production Got Right

1. **`scoring_events` as universal event store** — Correct foundational bet.
2. **`scoring_matches` with `sport_slug`, `match_kind`, side JSON columns** — Forward-looking schema.
3. **`sports` + role spec tables** — Registration generalization started.
4. **Orthogonal `scoring_enabled` on tournaments** — Scoring independent of auction status.
5. **Auction as separate module** — Aligns with "auction optional" business direction.

---

## Where Architecture Violates Target Model

| Violation | Evidence | Severity |
|-----------|----------|----------|
| Duplicate fixture tables | `scoring_fixtures` unused; `badminton_fixtures` built | High |
| Duplicate player tables | `players` vs `badminton_players` | High |
| Cricket standings on generic table | `scoring_standings.net_run_rate` | High |
| Fake team IDs | `homeTeamId: 0` for badminton | High |
| Per-sport API namespaces without dispatcher | `/scoring` + `/badminton` | Medium |
| Per-sport core packages without registry | `scoring-core` + `badminton-core` | Medium |
| Per-sport SSE modules | 3 broadcast files | Medium |
| `MatchMeta` cricket-shaped | `oversLimit`, `homeTeamId` required | Medium |
| Event types not in DB | `cricket.ts`, `badminton.ts` constants | Low |
| `tournaments.sport` text vs `sport_id` FK | Both exist, inconsistent usage | Low |

---

## Recommended Layering (2 sports, practical)

```
┌─────────────────────────────────────────────────────────┐
│  Platform (auction, auth, organizers, comms)          │  ← unchanged
├─────────────────────────────────────────────────────────┤
│  Competition Core (tournaments, matches, events)        │  ← evolve scoring_matches
├─────────────────────────────────────────────────────────┤
│  Sport Modules                                          │
│    ├── cricket.module  (scoring-core/cricket/*)         │  ← keep
│    └── badminton.module (badminton-core/*)              │  ← keep separate
├─────────────────────────────────────────────────────────┤
│  Sport Ops Extensions (optional per sport)              │
│    ├── cricket: auction teams → squads                  │
│    └── badminton: categories, draws, courts             │  ← keep badminton_* for now
└─────────────────────────────────────────────────────────┘
```

**Key decision:** Badminton tournament ops (`badminton_categories`, draws, registrations) are **legitimately sport-specific**. Do not force them into generic tables until sport #3 proves the pattern.

---

## Generic Entity Evolution

### `scoring_matches` — minimal fix

| Field | Today | Target |
|-------|-------|--------|
| `home_team_id` | NOT NULL | Nullable |
| `away_team_id` | NOT NULL | Nullable |
| `home_side_json` | Optional, unused | **Required** for non-team sports |
| `away_side_json` | Optional, unused | **Required** for non-team sports |
| `rules_json` | `{ overs, maxWickets }` | `{ format: string, ...sportRules }` |

### `scoring_sessions` — unify projections

All sports write live state here. Sport-specific extension tables (`badminton_match_details`) hold metadata only (PIN, court, match type), not `state_snapshot_json`.

### `scoring_standings` — rename or extend

**Option A (minimal):** Rename to `cricket_standings` in documentation; badminton doesn't use it.

**Option B (slightly more work):** Add `sport_slug` column; move NRR to `extras_json`; badminton writes knockout results elsewhere.

**Recommendation:** Option A for now. Badminton uses draws, not league tables.

### Players — accept duplication for 2 sports

| Sport | Table | When to generalize |
|-------|-------|-------------------|
| Cricket auction | `players` | Keep |
| Badminton | `badminton_players` | Keep until sport #3 |
| Future | `competition_participants` + extension JSON | Sport #3 trigger |

---

## Sport Module Interface (design only)

```typescript
interface SportScoringModule {
  slug: ScoringSportSlug;
  replay(meta: MatchMeta, events: ScoringEventEnvelope[]): unknown;
  parsePayload(eventType: string, payload: unknown): unknown;
  resolveUndo(events: ScoringEventEnvelope[]): ScoringEventEnvelope[];
}
```

Cricket and badminton implement this interface in their own packages. Dispatcher in `scoring-core` (~30 lines).

**Do not** create:
- Abstract `SportState` union covering all sports
- Database-driven rule engine
- Plugin classloader framework

---

## Registration Engine Relationship

Business direction includes Registration as independent module. Current state:

| Registration type | Implementation | Product journey |
|-------------------|----------------|-----------------|
| Auction player registration | `players` + `/register` | Auction + Scoring |
| Badminton category entry | `badminton_registrations` | Registration + Scoring |
| Global identity | `global_players` | Cross-tournament |

**Recommendation:** Keep separate until Registration Engine is a deliberate product build. Scoring must work without registration (badminton can create players inline).

---

## Streaming Engine Relationship

Broadcast should eventually be sport-agnostic transport with sport-specific renderers. Today:

- Transport: SSE (keep)
- Registry: unify (P1)
- Renderers: per-sport components (keep)

---

## Anti-Patterns to Avoid

1. **`generic_scoring_events` + `cricket_scoring_events`** — duplication; current `scoring_events` is fine.
2. **Single mega-reducer** — unmaintainable across sports.
3. **EAV schema for all sport stats** — premature; JSON projections suffice.
4. **Forcing badminton into cricket team model** — caused `teamId: 0` hack.
5. **Merging badminton-core into scoring-core prematurely** — packages can coexist with dispatcher.

---

## Violations Summary Table

| Entity | Status | Action for 2-sport |
|--------|--------|-------------------|
| `sports` | PASS | Use consistently |
| `sport_rules` | FAIL | Keep in `rules_json` / `match_format_json` |
| `sport_event_types` | FAIL | Keep in TS constants |
| `sport_stat_types` | FAIL | Cricket NRR in standings; OK for now |
| `tournaments` | PASS | Add hub routing by sport |
| `teams` | PASS | Auction only |
| `players` | WARNING | Accept 2 tables |
| `fixtures` | FAIL | Document; converge at sport #3 |
| `matches` | WARNING | Fix side JSON (P0) |
| `standings` | FAIL | Cricket-only; OK for now |
| `events` | PASS | No change |
| `broadcasts` | WARNING | Unify registry (P1) |
