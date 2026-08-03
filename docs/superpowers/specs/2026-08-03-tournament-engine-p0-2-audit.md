# P0.2 Tournament Engine — Codebase Audit

**Date:** 2026-08-03  
**Status:** Awaiting approval (audit only — no implementation)  
**Scope:** Badminton tournament engine — extend existing capabilities  
**Out of scope:** Auth rewrite, multi-day support, cricket engine unification, UI redesign

---

## Executive Summary

BidWar already has the hard pieces for a tournament engine:

| Capability | Status |
|---|---|
| League standings (W/L/margin/rank) | Exists — extend |
| Knockout bracket planning | Exists — reuse |
| Knockout winner auto-advance | Exists — reuse |
| League fixture generation | Exists — reuse |
| Qualifiers API | Exists — config not persisted |
| League → Knockout auto progression | **Missing** |
| Configurable ranking rules | **Missing** (hardcoded) |
| Unified `currentStage` | **Missing** |
| PF / PA / remaining / win % | **Missing** |

Highest leverage path: **wire existing standings + knockout planner** behind persisted config + an explicit promote endpoint. Do not rebuild either engine.

---

## 1. Existing Reusable Components

### 1.1 League standings

| Piece | Location | Notes |
|---|---|---|
| Pure compute | `lib/badminton-core/src/league/standings.ts` → `buildPairStandingsFromMatches` | `played`, `won`, `lost`, `marginPoints` |
| Comparator | `comparePairStandings` | Hardcoded: wins → margin → registrationId |
| Rebuild + persist | `artifacts/api-server/src/lib/badminton-league-service.ts` → `rebuildCategoryPairStandings` | Delete-all + reinsert |
| Ranked query | `getCategoryPairStandings` | Modes: `category` \| `per_group`; optional `limit` |
| Unit tests | `lib/badminton-core/src/league/standings.test.ts` | Exists |

**Important:** Standings rebuild runs on:
1. Every `GET /standings` and `GET /qualifiers` (synchronous)
2. Every terminal match completion (fire-and-forget)

→ Auto-progression must **never** attach to these paths.

### 1.2 Knockout planner

| Piece | Location | Notes |
|---|---|---|
| Bracket plan | `artifacts/api-server/src/lib/badminton-knockout-plan.ts` → `planKnockoutBracket` | Power-of-2 pad, bye → walkover |
| Round names | `ROUND_NAMES` | Final / Semi-Finals / Quarter-Finals / R16… |
| Tests | `badminton-knockout-plan.test.ts` | Exists |

### 1.3 Knockout progression

| Piece | Location | Notes |
|---|---|---|
| Wire links | `badminton-knockout-progression.ts` → `wireKnockoutProgressionLinks` | Stamps `winnerAdvancesTo` |
| Advance winner | `advanceKnockoutWinner` | Conflict-checked; called on match completion |
| Generate-draw route | `routes/badminton.ts` `POST …/generate-draw` | Full knockout from all registrations |

Within a knockout draw, QF → SF → Final already auto-advances winners. What is missing is **creating** that knockout draw from league qualifiers.

### 1.4 Qualification

| Piece | Location | Notes |
|---|---|---|
| Groups CRUD | `PUT/GET …/categories/:catId/groups` | Full replace of groups/members |
| Qualifiers API | `GET …/categories/:catId/qualifiers?limit=&mode=` | `limit` defaults to **4** (query-only) |
| Mode detection | Auto `per_group` if >1 groups | Not persisted |

### 1.5 Fixture / draw generation

| Piece | Location | Notes |
|---|---|---|
| League fixtures | `generateLeagueFixtures` | Requires `round_robin` \| `group_knockout` |
| Knockout draw | `POST …/generate-draw` | Rejects league draw types |
| Shared writer | `createFixtureCollection` | Single insertion path |

Draw types already on category: `knockout` \| `round_robin` \| `group_knockout`.

### 1.6 Match completion flow

`artifacts/api-server/src/lib/badminton-service.ts` (terminal branch):

1. Update match + fixture status  
2. `advanceKnockoutWinner` (no-op unless linked)  
3. Debounced `refreshBadmintonLifecycle` (phase / scoringPhase only)  
4. Fire-and-forget `rebuildCategoryPairStandings`  
5. Analytics / emails  

**Does not** inspect standings or create next-stage draws.

### 1.7 Tournament / category state today

| Field | Values | Role |
|---|---|---|
| `badminton_categories.phase` | `setup` \| `draw_generated` \| `live` \| `completed` | Coarse lifecycle |
| `tournaments.scoring_phase` | `disabled` \| `active` \| `completed` | Tournament-wide |
| `badminton_draws.status` | `pending` \| `active` \| `completed` | Mostly vestigial |
| `badminton_draws.round_name` | Free text | Display only |
| `DrawStageKey` | `league`…`final` | **Match-format inheritance only** — must not be overloaded as tournament progression state |

### 1.8 Leaderboards

`artifacts/auction-platform/src/lib/badminton-leaderboards.ts` — display/pagination only. Consumes server ranks; does not re-rank by alternate rules.

---

## 2. Missing Functionality

| # | Gap | Impact |
|---|---|---|
| 1 | Points For / Points Against | Required standings columns; current margin only sums won-game margins |
| 2 | Matches Remaining | Not computed (needs scheduled fixtures − played) |
| 3 | Win Percentage | Trivial once played/won exist |
| 4 | Configurable `rankingRules` | Today hardcoded; no H2H / random |
| 5 | Persisted qualifiers per group | Query param only; silent default 4 |
| 6 | Auto progression league → knockout | Explicitly out of VNBL Day-2 scope; still missing |
| 7 | Unified `currentStage` | No single SSoT for Dashboard/OBS/Operator |
| 8 | Stage / bracket validation suite | Only ad-hoc 400s; no state machine |
| 9 | Idempotent promote marker | Risk of duplicate knockout draws if promote retried |

---

## 3. Duplicate Logic

| Area | Badminton | Cricket (`scoring_*`) | P0.2 action |
|---|---|---|---|
| Knockout plan | Full + progression wiring | Schedule only, no advance | **Reuse badminton; do not unify** |
| Standings | Pair W/L/margin | Team points + NRR | Sport-specific; leave |
| Intra-badminton ranking | Single `comparePairStandings` | — | No duplicate |

Cross-sport consolidation is **out of scope** for P0.2.

---

## 4. APIs to Extend

All under `artifacts/api-server/src/routes/badminton.ts` unless noted.

| Route | Action | Compat |
|---|---|---|
| `GET …/standings` | Add PF/PA/remaining/win% fields | Additive |
| `GET …/qualifiers` | Default `limit`/`mode` from persisted config; query params remain overrides | Additive |
| `PUT …/groups` | Optional `qualifiersCount` on items **or** separate config endpoint | Additive optional |
| `PATCH …/categories/:catId` | Optional ranking/qualification/stage fields | Additive optional |
| `POST …/generate-league` | Leave as-is | — |
| `POST …/generate-draw` | Leave as-is (sources all registrations) | — |
| **NEW** `POST …/categories/:catId/promote-to-knockout` | Qualifiers → `planKnockoutBracket` → wire → stage update | New |
| **NEW** `GET/PUT …/categories/:catId/tournament-engine` (or similar) | rankingRules + qualificationRules + currentStage | New |

Promote must be:
- Explicit (admin/API trigger or guarded auto-call when league stage complete)
- **Never** inside standings rebuild / GET standings
- Idempotent (reject if knockout already promoted for category)

---

## 5. Database Changes Required (Additive)

### Recommended columns

**`badminton_categories`**
- `current_stage` `text` NULL — e.g. `league` \| `quarter_final` \| `semi_final` \| `final` \| `completed` (plus optional `setup`)
- `ranking_rules_json` `jsonb` NULL — ordered criteria array; null → today’s comparator
- `qualifiers_per_group` `smallint` NULL
- `qualifier_mode` `text` NULL — `per_group` \| `category`
- Optional: `promoted_knockout_draw_id` or marker in `meta_json` for idempotency

**`badminton_pair_standings`**
- `points_for` `integer` NOT NULL DEFAULT 0
- `points_against` `integer` NOT NULL DEFAULT 0  
  (`matches_remaining` / `win_percentage` preferably **computed on read**)

**`badminton_groups`** (optional override)
- `qualifiers_count` `smallint` NULL — falls back to category default

### Do NOT overload
- `badminton_categories.phase`
- `DrawStageKey` (match-format inheritance)

### Migration impact

| Item | Detail |
|---|---|
| Pattern | `lib/db/migrations/0009_*.sql` + Drizzle schema update |
| Style | `ADD COLUMN IF NOT EXISTS`, nullable/defaulted |
| Production | Schema governance validate-only → migration file required |
| Existing tournaments | Null config → current hardcoded behavior; no backfill required for stage |
| PF/PA backfill | Optional: recompute from match snapshots on next standings rebuild (rebuild already deletes+reinserts) |
| Reversibility | Drop columns / ignore in app; no destructive transforms |

---

## 6. Ranking Rules Architecture (design intent for later)

Default (matches product requirement; today’s code uses id instead of H2H/random):

```json
["wins", "pointsDifference", "headToHead", "random"]
```

Today’s effective default for backward compat:

```json
["wins", "pointsDifference", "registrationId"]
```

P0.2 implementation should:
1. Persist ordered rule keys
2. Build comparator from rules (default = today’s order for null config)
3. Add `headToHead` + `random` as first-class rule keys
4. Keep `registrationId` available as stable fallback for tests/determinism

---

## 7. Automatic Progression Design Constraint

```
League complete (all league fixtures terminal)
  → explicit promote (API / guarded job)
  → read persisted qualification config
  → getCategoryPairStandings(limit, mode)
  → planKnockoutBracket(qualifiers)
  → createFixtureCollection + wireKnockoutProgressionLinks
  → set current_stage = first knockout round present
  → existing advanceKnockoutWinner handles QF→SF→Final
  → Final terminal → current_stage = completed
```

**Forbidden hooks:** `rebuildCategoryPairStandings`, `GET /standings`, `GET /qualifiers`.

---

## 8. Validation Requirements (gaps)

Must fail early for:

- Final before Semi / Semi before QF (stage machine)
- Promote while league incomplete
- Qualifier count > group size
- Duplicate promote / duplicate knockout draw
- Empty qualifier set / empty bracket
- Invalid group mapping (member without team)
- Missing winners on progression conflict (partially exists via `KnockoutProgressionError`)

---

## 9. Risk Analysis

| Risk | Mitigation |
|---|---|
| Ranking order change mid-event | Null config preserves today’s comparator; config opt-in |
| Duplicate knockout on double-promote | Idempotency marker + validation |
| Standings GET cost rises with PF/PA | Same rebuild path; compute PF/PA in existing pass |
| UI breaks on new fields | Additive JSON only |
| Overloading `phase` / `DrawStageKey` | New `current_stage` column only |
| Accidental auto-promote on refresh | Dedicated endpoint; no standings hook |

---

## 10. Recommended Implementation Slices (post-approval)

Small reviewable commits suggested after audit approval:

1. Schema migration + defaults (no behavior change)  
2. Extend standings compute (PF/PA/remaining/win%) + API additive fields  
3. Configurable ranking comparator (null = legacy)  
4. Persist qualification config; wire `/qualifiers` defaults  
5. `current_stage` + lifecycle updates (read path for Dashboard/OBS)  
6. `promote-to-knockout` + validation + idempotency  
7. Tests (matrix below)

---

## 11. Test Matrix (planned)

- League standings fields (played, remaining, PF, PA, win%)  
- Ranking: wins / pointsDifference / headToHead / random  
- Null ranking config ≡ legacy comparator  
- Qualification per_group / category; top 1/2/4  
- Promote → QF fixtures generated  
- Winner advance → SF → Final (existing + stage updates)  
- Tournament/category completed  
- Invalid states rejected  
- Existing knockout-only / round_robin-only tournaments unchanged  

---

## 12. Approval Gate

**Ask:** Approve this audit (or request changes) before any implementation.

Specifically confirm:

1. **Promote model:** Explicit `POST …/promote-to-knockout` (recommended) vs fully automatic on last league match (higher risk)?  
2. **Stage vocabulary:** Use `league | quarter_final | semi_final | final | completed` (product) vs align with existing `DrawStageKey` strings for labels only?  
3. **Default ranking for new categories:** Product default (incl. H2H + random) vs legacy (wins → margin → id) until organizer configures?

No code will be written until this audit is approved.
