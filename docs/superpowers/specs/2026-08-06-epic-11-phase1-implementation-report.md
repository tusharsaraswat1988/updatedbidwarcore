# EPIC-11 Phase 1 — Rule Engine Consumer Cutover Implementation Report

**Date:** 2026-08-06  
**Status:** Phase 1 complete — awaiting review (do not begin Phase 2)  
**Authority:** EPIC-11 Consumer Cutover Audit (Approved amendments) + Phase 1 mission brief

---

## What shipped

Mandatory Runtime Prepare is the **sole** site of `RuleEngine.resolve(PREPARE)` on the cricket execution path.

Pipeline:

```
Runtime Prepare
  → validate
  → freeze Snapshot (refs only)
  → build RuleResolutionContext
  → RuleEngine.resolve(PREPARE)   ← exactly once
  → ResolvedRuntimeRules (authority)
  → RuntimeExecutionPolicy (runtime-facing contract)
  → Compatibility Adapter → temporary rulesJson
  → save resolutionId / rulesHash / runtimeRulesVersion
  → Runtime Ready path unchanged
Match Start
  → VERIFY snapshotVersion + resolutionId + rulesHash
  → NEVER RuleEngine.resolve()
Reducer
  → unchanged (still reads rulesJson / MatchMeta)
```

---

## Architecture confirmation

| Law | Status |
|-----|--------|
| No Prepare ⇒ No Match Start | Enforced in `appendScoringEvent` for `MATCH_STARTED` |
| Sole resolve at Prepare | Wired in `prepareRuntimeMatch` (cricket only) |
| Snapshot refs only | `freeze_snapshot` payload unchanged; prep metadata strips rule bodies |
| RuntimeExecutionPolicy | Derived from `ResolvedRuntimeRules`; not a second engine |
| rulesJson temporary bridge | Compatibility Adapter projection only |
| Match Create non-authoritative | Placeholder `rulesJson`; Prepare overwrites |
| Reducer / Scoring / Broadcast / Stats untouched | No reducer rewrite |

Naming note: Audit used `MatchRuntimePolicy`; Phase 1 mission uses **`RuntimeExecutionPolicy`**. Same role.

---

## Files changed (primary)

| Area | Path |
|------|------|
| Policy | `lib/platform-core/src/rule-engine/execution-policy.ts` |
| Adapter | `lib/platform-core/src/rule-engine/compatibility-adapter.ts` |
| Match Start verify | `lib/platform-core/src/rule-engine/match-start-verify.ts` |
| Prepare input assembly | `lib/platform-core/src/rule-engine/prepare-resolve.ts` |
| Exports | `lib/platform-core/src/rule-engine/index.ts` |
| Prepare orchestration | `artifacts/api-server/src/lib/runtime-match-service.ts` |
| Match Start gate | `artifacts/api-server/src/lib/scoring-service.ts` |
| Prepare HTTP response | `artifacts/api-server/src/routes/runtime-match-foundation.ts` |
| rulesJson type | `lib/db/src/schema/scoring_matches.ts` |
| Tests | `…/epic-11-phase1-cutover.test.ts`, `…/epic-11-match-start-gate.test.ts` |

---

## Execution flow before / after

**Before:** Match Create invented `{ overs: 20, maxWickets: 10 }` → MATCH_STARTED → reducer. Prepare froze Snapshot refs only. Rule Engine had zero live consumers.

**After:** Match Create may write a non-authoritative placeholder. Prepare freezes Snapshot, resolves once, binds policy, overwrites `rulesJson`. Match Start fails closed without Prepare bind. Corporate Box profile values (6 overs / 8 players / LBW off / retire@30) flow through Policy → adapter.

---

## Phase 2 dependencies (do not implement yet)

1. Scoring Session consumes `RuntimeExecutionPolicy` as primary contract (UI LBW/XI/retire).
2. Shadow compare Create vs Prepare authority.
3. Retire `rulesJson` consumption without Rule Engine changes.
4. Remove transitional `CricketRuntimeAdapter` from live consideration.

---

## Stop

Phase 1 only. Wait for review before Phase 2.
