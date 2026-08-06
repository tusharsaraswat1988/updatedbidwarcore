# RC1.1 STABILIZATION REPORT

**Date:** 2026-08-06  
**Baseline:** [`2026-08-06-pxp-rc1-stabilization-report.md`](./2026-08-06-pxp-rc1-stabilization-report.md)  
**Scope:** Reclassify RC1 findings; fix confirmed P0 + critical P1 only. No Phase 5. No polish. No features.  
**Branch:** `cursor/pxp-rc1-1-stabilization-fixes-b722`

---

## Executive Summary

**GO**

RC1 over-classified several UX / consistency / speculative performance items as release blockers. After reclassification and four targeted fixes, remaining items are non-blocking P1/P2.

Confirmed blockers that were real and are now fixed:

1. Badminton incomplete-setup **crash** (ModuleRegistryProvider)
2. Cricket Live Control **dead route** (`/scoring` → `scoringPath()` / `/score`)
3. Shell **validation contradiction** (false “No validation issues”)
4. Live Ops **`from=` return** (badminton control/broadcast, teams, cricket nav)

Phase 5 (Home Cutover) may proceed as a **separate** effort. This pass does **not** start Phase 5.

---

## Issue Reclassification

| RC1 issue | RC1 | RC1.1 | Decision | Reason |
|-----------|-----|-------|----------|--------|
| Badminton incomplete-setup ModuleRegistry crash | P0 | P0 → **FIXED** | Keep | Application crash; blocks badminton setup workflow |
| Cricket Live Control `/scoring` dead link | P0 | P0 → **FIXED** | Keep | Broken navigation; prevents cricket live ops from TMC |
| Shell “No validation issues” while body shows issues | P0 | **P1** → **FIXED** | Lower then fix | Not a crash/wrong API; **contradictory operator information** (critical P1). Fixed because mandatory |
| Live Ops `from=` advertised but unused | P1 | P1 → **FIXED** | Keep | Broken return navigation / lost context |
| Attention readiness all tagged Competition/`Setup` | P1 | **P2** | Lower | Operator confusion only; Fix links still work; no workflow break |
| Duplicate Attention + Setup Checklist + Insights | P1 | **P2** | Lower | UX density / duplicate chrome; not a crash or dead end |
| Dependency chips snapshot/hardcoded vs Product API | P1 | **P2** | Lower | Technical debt / future accuracy; chips still informative; not wrong ownership |
| ModuleRegistry equality omits attention/peek text | P1 | **P2** | Lower | Speculative stale-content risk; counts still update; no measured user-facing failure |
| `allIssues` array identity → excess register | P1 | Observation | Lower / Remove as fail | Speculative performance; no measured loop or UI freeze |
| Cascading registry consumer re-renders | P1 | Observation | Lower / Remove as fail | Speculative; mount-time cost only |
| Incomplete shell vs Competition (Ready/History/ActionBar) | P1 | **P2** | Lower | Shell consistency / future polish; actions still available in entity rows |
| Auction Live Control offered for practice/registered_teams | P1 | **P2** | Lower | Operator confusion for some catalogs; auction room still valid destination for many cricket flows; not a crash |
| Readiness strip coarse vs module health | P1 | **P2** | Lower | Incorrect readiness display nuance; pipeline still operable |
| Dual TMC + badminton hub | (Mission FAIL) | Expected | Remove as FAIL | Intentional until Phase 5 per PXP design §6 |
| History lacks timestamps | P2 | P2 | Keep | Visual / data display polish |
| Nested PlatformSurface / KPI twin languages | P2 | P2 | Keep | Visual consistency |
| Unused extracts / deprecated LiveOperationsPanel | P2 | P2 | Keep | Technical debt |
| Live Ops always healthy / empty validation noise | P2 | **P2** (noise reduced) | Keep | Empty shell validation suppressed by ModuleWorkspace fix; synthetic health remains P2 |
| Sidebar “Tournament Home” vs TMC naming | P2 | P2 | Keep | Naming |
| Badminton setup copy “knockout only” | P2 | P2 | Keep | Copy drift |
| `post_match` unused in pipeline | P2 | P2 | Keep | Deferred module; expected |
| Screenshot parity unchecked | P2 | P2 | Keep | Process leftover |

---

## Implemented Fixes

1. **`pages/badminton/tournament-hub.tsx`** — Wrap incomplete-setup EPIC cards in `ModuleRegistryProvider` so `useRegisterModuleSnapshot` no longer throws.
2. **`components/platform/live-operations-panel.tsx`** — Cricket Live Control uses `scoringPath()` (`/scoring-app/tournament/:id/score`) with full navigation assign; appends safe `from=`.
3. **`components/platform/module-workspace.tsx`** — Render `ValidationPanel` only when `validationIssues.length > 0` (same empty policy as `HistoryPanel`). Ends shell false-empty contradiction; entity-row issues remain authoritative for list modules.
4. **Live Ops return contract**
   - `badminton-hub-nav.tsx` — On control/broadcast, honor safe `from=` → TMC (cross-app `<a>` when leaving scoring-app).
   - `pages/badminton/broadcast.tsx` — Preserve `from=` across redirect to control.
   - `pages/teams.tsx` — Show return link when Manage Teams opened with `from=`.
   - `cricket-page-chrome.tsx` — Cricket scoring nav uses `resolveReturnPath` / `returnPathBackLabel` (same-tab return to TMC).
5. **`lib/__tests__/live-ops-return-paths.test.ts`** — Guards scoringPath + safe `from=` helpers (3/3 pass).

---

## Remaining P0

**None.**

---

## Remaining P1

**None that block Phase 5 readiness.**

(Former critical P1 validation contradiction and return-nav gaps are fixed. Remaining RC1 “P1” items were reclassified to P2 / Observations.)

---

## Remaining P2

1. Attention readiness attribution still coarse (`Setup` / Competition tagging)
2. Duplicate attention surfaces on TMC (Attention + Checklist + Insights)
3. Dependency chips not Product-API-backed
4. Module shell ActionBar / Ready / History parity vs Competition for list modules
5. Auction Live Control visibility for non-auction competition catalogs
6. Readiness strip vs per-module health desync
7. History timestamps; KPI twin languages; naming drift; unused extracts
8. Live Ops synthetic always-healthy snapshot
9. Registry equality / snapshot identity micro-optimizations (Observations)

---

## Operator Workflow Validation

Code-path + helper verification after fixes (no business-logic changes). Simulated organizer / auction operator / badminton referee / scorekeeper roles against navigation contracts.

| Workflow | Mission Control → Modules → Validation → Runtime → Live Ops → Return | Result |
|----------|----------------------------------------------------------------------|--------|
| Cricket Auction | TMC modules OK; Auction Live Control OK; Cricket Live Control → `/score`; return via cricket nav `from=` / TMC link | **Pass** |
| Badminton Knockout | Incomplete hub no longer crashes; modules register; Live Ops → control `from=` → Back to TMC; broadcast preserves `from=` | **Pass** |
| Badminton League | Same hub/provider fix; league fork remains at categories/fixtures (unchanged) | **Pass** |
| Practice Tournament | Same TMC pipeline; Live Ops sport gating unchanged (Auction link still offered for non-badminton — P2) | **Pass** |
| Registered Teams | Same TMC pipeline; no dead ends introduced | **Pass** |

Residual friction (non-blocking): auction Live Control still offered for some non-auction catalogs; TMC attention chrome still dense — both P2.

---

## Performance Review

**Measured / observable issues:** None found that fail RC1.1.

**Observations (not failures):**

- ModuleRegistry shallow equality still ignores attention/peek text — potential stale Attention text if counts unchanged.
- Snapshot `allIssues` identity can trigger extra register calls — no confirmed render loop.

Do not block Phase 5 on these.

---

## Architecture Compliance

**PASS**

Platform ownership intact. Product APIs untouched. Thin re-exports intact. Phase 5 not started. Dual homes remain transitional by design.

---

## Mission Control

**PASS**

TMC orchestrates modules once under provider. Remaining duplicate attention chrome is P2 density, not a stability fail for RC1.1.

---

## Module Workspace

**PASS**

Shared shell stable. Validation contradiction removed. List-module ActionBar/Ready parity remains progressive P2 debt, not a release blocker.

---

## Navigation

**PASS**

No dead Cricket Live Control link. Live Ops `from=` honored on badminton control/broadcast, teams Manage, and cricket scoring nav. Phase 5 home cutover still pending (expected).

---

## Live Operations

**PASS**

Deep links reach Auction / Badminton Mission Control / Cricket `/score` / LED / Broadcast. Return to TMC works for Live Ops entry paths covered above. Auction room still uses new-tab open (pre-existing; reversible via browser/opener patterns — not treated as P0).

---

## Final Recommendation

**GO**

BidWar PXP RC1.1 is stable enough to proceed to **Phase 5 (Home Cutover)** as a separate, explicit effort.

Do **not** auto-start Phase 5 from this pass. Remaining work is non-blocking P2 / Observations and should not be mixed into cutover unless it directly unblocks home ownership change.
