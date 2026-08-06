# EPIC-12 Phase 1 — Presentation Engine Consumer Cutover (Implementation Report)

**Date:** 2026-08-06  
**Status:** Phase 1 complete — awaiting review (do not begin Phase 2)  
**Authority:** EPIC-10 design + EPIC-12 Phase 1 mission (mirror EPIC-11 Phase 1)

---

## What shipped

Mandatory Runtime Prepare is the **sole** site of `PresentationEngine.resolve(PREPARE)` on the cricket execution path (alongside Rule Engine; engines never call each other).

Pipeline:

```
Runtime Prepare
  → validate
  → freeze Snapshot (refs only)
  → RuleEngine.resolve(PREPARE)              ← EPIC-11 (unchanged ownership)
  → PresentationEngine.resolve(PREPARE)      ← exactly once (EPIC-12)
  → ResolvedPresentationContract (authority)
  → PresentationExecutionPolicy (runtime face)
  → Compatibility Adapter → brandingJson (temporary paint DTO)
  → save presentationResolutionId / presentationHash / presentationVersion
Match Start
  → VERIFY presentation bind (+ existing rule bind)
  → NEVER PresentationEngine.resolve()
Renderers
  → consume paint DTO / theme helpers (no redesign)
```

---

## Architecture confirmation

| Law | Status |
|-----|--------|
| Sole Presentation resolve at Prepare | Wired in `prepareRuntimeMatch` (cricket) |
| Snapshot refs only | Freeze history unchanged; prep metadata strips contract/policy/paint bodies |
| PresentationExecutionPolicy | Derived from ResolvedPresentationContract |
| brandingJson temporary bridge | Compatibility Adapter projection only |
| Match Start never resolves | `verifyPresentationMatchStartContract` only |
| Renderers do not import Presentation Engine | Architecture test updated; consume paint DTO |
| Rule Engine / Reducer / Scoring logic untouched | Presentation verify added beside rule verify only |

---

## Files changed (primary)

| Area | Path |
|------|------|
| Policy | `lib/platform-core/src/presentation-engine/execution-policy.ts` |
| Adapter | `…/compatibility-adapter.ts` |
| Match Start verify | `…/match-start-verify.ts` |
| Prepare input | `…/prepare-resolve.ts` |
| Exports | `…/index.ts` |
| Prepare orchestration | `artifacts/api-server/src/lib/runtime-match-service.ts` |
| Match Start gate | `artifacts/api-server/src/lib/scoring-service.ts` |
| Prepare HTTP | `artifacts/api-server/src/routes/runtime-match-foundation.ts` |
| Match JSON | `artifacts/api-server/src/routes/scoring.ts` |
| Thin LED/score consumers | `display-theme.ts`, `display-shell.tsx`, `score-display-shell.tsx` |
| Thin OBS consumer | `broadcast-settings.ts`, `obs-overlay.tsx` |
| Tests | `epic-12-phase1-cutover.test.ts`, `epic-12-presentation-match-start-gate.test.ts` |

---

## Execution trace

```
Presentation Profile (e.g. presentation.cricket.corporate_box)
  → Runtime Prepare
  → Snapshot.references.presentationProfile (FrozenRef only)
  → PresentationEngine.resolve(PREPARE) once
  → ResolvedPresentationContract
  → PresentationExecutionPolicy
  → Compatibility Adapter → brandingJson
       source: presentation_execution_policy
       displayThemeId: stadium-gold
       broadcastTheme: gold
       safeAreaBottomPx: 12
       sponsorStripEnabled / ticker / …
  → runtimePrepMetadataJson.presentationResolution (identity only)
  → Scoring Session presentationPolicyBind + presentationPaint
  → Match API branding + presentationPolicyBind
  → Score Display Shell (paint → CSS accent/bg)
  → Display Shell (getDisplayThemeFromPresentationPaint)
  → OBS (applyPresentationPaintToBroadcastSettings)
Match Start
  → verifyPresentationMatchStartContract (no resolve)
```

---

## Remaining legacy renderer consumers (Phase 2)

| Surface | Gap |
|---------|-----|
| Auction LED | Still defaults when no match Prepare paint (tournament-scoped auction path) |
| Badminton venue LED / OBS | Still `useBadmintonBranding` / scene JSON |
| Cricket scoreboard chrome | BidWar shell theme still primary; paint only overlays accent/bg |
| OBS auction overlay | Paint overlay helper wired; auction path usually has no match paint |
| Capability Compiler | Not used at Prepare (Phase B optional; not required for Phase 1) |
| brandingJson bridge | Temporary — retire when Slot→Widget cutover lands |

---

## Tests

- `@workspace/platform-core` — **126 passed** (incl. EPIC-12 Phase 1 cutover + architecture)
- api-server EPIC-11/12 gates — **5 passed**
- `@workspace/scoring-core` — **53 passed**

---

## Phase 1 verdict

**PASS** — Presentation Engine executes once at Prepare; PresentationExecutionPolicy bound; Match Start verify-only; Snapshot refs-only; legacy renderers receive adapter-derived paint without redesign.

**Stop.** Do not start Phase 2 until review.
