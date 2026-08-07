# EPIC-12 Phase 1 — Presentation Engine Consumer Cutover (Design)

**Date:** 2026-08-06  
**Status:** APPROVED BY MISSION BRIEF — Architecture frozen (mirror EPIC-11 Phase 1)  
**Authority:** Platform Constitution, Master Plan, EPIC-08/09/10, EPIC-11 Phase 1 & 2, Phase 1 mission

---

## Objective

Connect the existing EPIC-10 Presentation Engine to Runtime Prepare exactly as EPIC-11 connected the Rule Engine.

```
Presentation Profile
  → Runtime Prepare
  → PresentationEngine.resolve(PREPARE)   ← exactly once
  → ResolvedPresentationContract
  → PresentationExecutionPolicy
  → Compatibility Adapter → legacy paint DTO (brandingJson)
  → bind presentationResolutionId / presentationHash / presentationVersion
Match Start
  → VERIFY presentation bind (never resolve)
Renderers
  → consume adapter-derived legacy DTO (no redesign)
```

---

## Decisions (frozen)

| Decision | Choice |
|----------|--------|
| Sole resolve site | `prepareRuntimeMatch` (alongside Rule Engine; engines never call each other) |
| Runtime face | `PresentationExecutionPolicy` derived from `ResolvedPresentationContract` |
| Temporary bridge | Compatibility Adapter → `brandingJson` (mirror `rulesJson`) |
| Snapshot | Refs only — never contract / policy / theme / layout bodies |
| Match Start | Verify-only; fail closed without presentation bind (cricket) |
| Renderers | No redesign; thin preference of Policy-derived paint when present |
| Scope Phase 1 | Cricket Prepare path (same gate as EPIC-11 Rule resolve) |

---

## Non-goals (Phase 1)

No new Presentation Engine, LED/OBS/scoreboard redesign, CSS/React rewrites, Rule Engine / Reducer / Snapshot ownership changes, Phase 2 renderer cutover.

---

## Files (planned)

| Area | Path |
|------|------|
| Policy | `lib/platform-core/src/presentation-engine/execution-policy.ts` |
| Adapter | `…/compatibility-adapter.ts` |
| Match Start verify | `…/match-start-verify.ts` |
| Prepare input | `…/prepare-resolve.ts` |
| Orchestration | `artifacts/api-server/src/lib/runtime-match-service.ts` |
| Match Start gate | `artifacts/api-server/src/lib/scoring-service.ts` |
| Thin consumers | display-theme / score-display / broadcast helpers |
| Tests | `…/epic-12-phase1-cutover.test.ts` + Match Start gate |

---

## Phase 2 (do not implement)

Direct Slot→Widget consumption; retire brandingJson bridge; auction LED tournament-scoped Prepare; badminton surfaces.
