# Cricket Rules & format — choice chips + editable key overrides

**Date:** 2026-08-12  
**Status:** Approved (user: chips + approach A key edits)  
**Scope:** Rules & format page (`/tournament/:id/score/rules`) + wire overrides into Runtime Prepare

## Problems

1. Short catalog fields use dropdowns for 4–6 options (extra friction).
2. Playing rules panel is read-only preset inspection — organisers cannot change overs / XI / etc.

## Decisions

1. **Choice chips** for short catalog picks (format, formation, profiles).
2. **Preset + key overrides:** keep Rule Profile as base; store organiser edits as **tournament rule overrides**; merge at Prepare via existing Rule Engine override layer.
3. Out of scope: app-wide Select→chips; full free-form rule builder; presentation overrides; editing balls-per-over / ball type in v1.

## Editable key fields (v1)

| UI label | Rule definition id | Type |
|---|---|---|
| Overs per innings | `cricket.match.overs_per_innings` | number |
| Max wickets | `cricket.match.max_wickets` | number |
| Playing squad size | `cricket.match.playing_squad_size` | number |
| Bench size | `cricket.match.bench_size` | number |
| Retire at runs | `cricket.batting.retire_at_runs` | number \| null (empty = null) |
| LBW | `cricket.dismissal.lbw_enabled` | boolean |
| Free hit | `cricket.bowling.free_hit_enabled` | boolean |

Not editable in v1: balls per over, ball type, powerplay, super over, boundary values (remain from profile).

## UI (Rules & format)

1. **Format / formation / profiles:** chip groups (one tap). Selected description under chips.
2. **Playing rules:** chip to pick profile → **editable form** for the seven keys above, prefilled from profile values merged with saved overrides.
3. Show a small “Customised from preset” hint when any override differs from profile.
4. Keep a compact read-only “Other rules from preset” list for non-editable profile values (optional; can collapse).
5. Squad size fields (min/max/subs/retentions) stay as today.
6. Locked competition → chips + override inputs disabled.

## Data model

- Add tournament column `rule_overrides_json` (jsonb, nullable):  
  `{ values: Record<definitionId, ConcreteRuleValue> }`  
  Only keys that differ from the selected profile need to be stored (sparse). Changing profile clears overrides that no longer apply, or clears all overrides (prefer **clear all overrides when profile id/version changes** — simple, predictable).
- Competition GET returns `configuration.ruleOverrides` (or `ruleOverridesJson`).
- Competition PATCH accepts `ruleOverrides: { values: ... } | null`.

## Prepare / Apply wiring

Today `buildPrepareRuleEngineInput(snapshot, bindings)` passes **no** `overrideDocuments`.

Change:

1. Load `rule_overrides_json` with tournament competition row.
2. Extend `buildPrepareRuleEngineInput` (or Prepare call site) to attach inline tournament override the same way as `resolveContextToEngineInput`:
   - `tournamentOverrideRef = { id: "__inline_tournament__", version: "1.0.0" }`
   - `overrideDocuments[overrideDocKey(...)] = { values }`
3. Apply-to-matches / auto-prepare then project overrides into match `rules_json` via existing `projectRuntimeExecutionPolicyToRulesJson`.

No Rule Engine constitutional changes — overrides already supported; storage + call-site wiring were missing.

## Validation

- Overrides may only reference known cricket definition ids from the v1 allowlist (reject unknown keys on PATCH).
- Numeric ranges: overs ≥ 1; wickets ≥ 1; squad/bench ≥ 0; retire null or ≥ 1.
- Structural Rule Engine verify still applies at Prepare.

## Files (expected)

- UI: `artifacts/auction-platform/src/pages/cricket/rules.tsx` (+ small chip helper; reuse badminton chip look).
- API: `competition` route + `competition-service` patch/get.
- DB: `tournaments.rule_overrides_json` + ensure-schema.
- Prepare: `runtime-match-service.ts`, `prepare-resolve.ts` (optional signature extension).
- Specs: this doc supersedes the chips-only note for implementation scope; chips-only doc remains historical.

## Success criteria

- Organiser picks Cricket type / profiles with chips (no dropdown for those fields).
- Organiser edits overs/XI/etc. after choosing a preset; Save persists overrides.
- Lock + Apply → Start match uses overridden values (e.g. overs 8 instead of Corporate Box’s 6).
- Changing playing-rules profile resets overrides.
- Locked rules cannot be edited.
