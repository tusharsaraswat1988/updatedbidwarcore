# EPIC-11 Phase 2 — Scoring Consumer Cutover (Implementation Report)

**Date:** 2026-08-06  
**Status:** COMPLETE  
**Mission:** Connect existing `RuntimeExecutionPolicy` (via Phase 1 Compatibility Adapter → `rulesJson`) to every cricket scoring consumer.  
**Non-goals:** Rule Engine changes, Runtime Prepare/Snapshot ownership, reducer architecture, Catalog/Rule Profile reads, new adapters.

---

## Architecture (unchanged)

```
Runtime Prepare
  → RuleEngine.resolve(PREPARE)        [sole resolve site — Phase 1]
  → ResolvedRuntimeRules
  → RuntimeExecutionPolicy
  → Compatibility Adapter
  → rulesJson (+ resolutionId / rulesHash / runtimeRulesVersion)
  → Scoring Session stateJson.executionPolicyBind
  → MatchMeta (buildMatchMetaFromRules)
  → Pre Match / XI / Bench / Dismissal / Retire / MATCH_STARTED
  → Reducer (unchanged; consumes MatchMeta overs/maxWickets only)
```

No `RuleEngine.resolve()`, `CatalogRegistry`, or rule-profile lookups were added to scoring UI or reducer.

---

## Consumer migration summary

| Surface | Before | After |
|--------|--------|-------|
| MatchMeta | Overs/maxWickets only (often Create defaults) | Full Policy fields via `buildMatchMetaFromRules` |
| MATCH_STARTED | Client `oversLimit` trusted | Server forces `oversLimit` from Policy MatchMeta; requires `source=runtime_execution_policy` |
| LINEUP_SET | Zod max 11 / soft validation | Service enforces `playingSquadSize` from MatchMeta |
| setMatchSquad | Hardcoded 11 / 4 | Requires Policy sizes; enforces XI/bench limits |
| Pre Match Setup | Hardcoded XI 11 / Bench 4 | Displays + enforces Policy limits; Start blocked until Policy ready |
| Live Scoring Pad | Always showed LBW | `availableDismissalTypes(lbwEnabled)` — LBW removed when false |
| Retire | Manual sheet only | Policy `retireAtRuns` banner + auto-open existing Retire sheet |
| Scoring Session | Overs projection only | Also binds `executionPolicyBind` (resolutionId/rulesHash/runtimeRulesVersion) |
| Match API JSON | rulesJson only | + `executionPolicyBind` for session identity without Rule Engine |
| Squad readiness | MIN_PLAYING_XI = 11 | Soft floor (2); match XI from Policy after Prepare |

---

## Corporate Box expected behaviour (via prepared Policy)

| Field | Value | Consumed at |
|-------|-------|-------------|
| Overs | 6 | MatchMeta → MATCH_STARTED → session/reducer oversLimit; Toss label |
| Playing Squad | 8 | Pre Match XI picker; setMatchSquad; LINEUP_SET |
| Bench | 2 | Pre Match bench picker; setMatchSquad |
| LBW | Disabled | Dismissal sheet — option removed |
| Retire at runs | 30 | Live pad banner + Retire sheet prompt |
| Free Hit | Enabled | Nb sublabel / free-hit strip (reducer free-hit activation unchanged) |

---

## Execution trace (Corporate Box)

1. **Runtime Prepare** — freezes Snapshot refs; `RuleEngine.resolve(PREPARE)` once; builds `RuntimeExecutionPolicy`; adapter writes `rulesJson` with `source: "runtime_execution_policy"`.
2. **Session bind** — idle `scoring_sessions.stateJson` refreshed with Policy overs/maxWickets + `executionPolicyBind`.
3. **Scoring Session / Match GET** — `match.rules` + `executionPolicyBind` returned to client.
4. **Pre Match Setup** — `executionLimitsFromMatch` reads Policy XI/bench/overs; blocks Start until Policy ready.
5. **Playing XI / Bench** — pickers cap at `playingSquadSize` / `benchSize`; `setMatchSquad` + `LINEUP_SET` enforce same.
6. **Dismissal UI** — `availableDismissalTypes(false)` omits `lbw`.
7. **MATCH_STARTED** — server overwrites `payload.oversLimit` from MatchMeta; rejects non-Policy rules.
8. **Reducer** — unchanged; receives Policy-derived overs via MatchMeta / event payload.

---

## Remaining legacy defaults (documented, Phase 3 candidates)

- **Match Create / Schedule Generate** UI still accepts an overs placeholder (non-authoritative; overwritten by Prepare).
- **Placeholder MatchMeta path** (`executionRulesSource: "placeholder"`) retains bootstrap defaults for pre-Prepare session rows only; Match Start refuses this path.
- **Reducer** does not yet gate free-hit activation on `freeHitEnabled` (architecture freeze — no reducer redesign).
- **Tournament squad readiness** is no longer gated on XI=11; still not match-Policy-aware (match-scoped after Prepare).

---

## Tests

- `lib/scoring-core` — EPIC-11 Phase 2 consumers (Corporate Box MatchMeta, LBW removal, retire@30, no Rule Engine/Catalog in execution-rules or reducer).
- `artifacts/api-server` — MATCH_STARTED overs forced from Policy MatchMeta; Phase 1 gate tests remain green.
- `artifacts/auction-platform` — Pre-match limit helper Corporate Box 8/2; LBW absent when disabled.

---

## Phase 2 verdict

**PASS** — Scoring surfaces consume RuntimeExecutionPolicy-derived values through prepared `rulesJson` / MatchMeta. Rule Engine, Prepare ownership, Snapshot, and reducer architecture were not modified.
