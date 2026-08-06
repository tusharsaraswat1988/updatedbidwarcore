# PXP RC1 STABILIZATION REPORT

**Date:** 2026-08-06  
**Scope:** Product Experience (PXP) Phases 0–4 verification only  
**Authority:** Pre–Phase-5 gate. No features, no redesign, no architecture changes, no Phase 5/6 work.  
**Codebase tip:** `develop` @ audit time (post `f23588fd` PXP Phases 1–3 + Live Operations Phase 4)

---

## Executive Summary

**Overall Release Candidate status: GO WITH FIXES**

Platform Foundation (EPIC-01 → EPIC-10) and PXP Phases 0–4 are structurally present. Tournament Mission Control exists on `/tournament/:id` without replacing operational homes. Phase 5 Home Cutover has **not** started.

RC1 is **not** a clean GO. Three **P0** defects block treating this build as production-stable for multi-sport operators:

1. Badminton incomplete-setup hub mounts registry-backed EPIC cards **without** `ModuleRegistryProvider` → hard crash.
2. Cricket Live Control deep-link uses `/scoring` — **no matching route** (canonical is `/score`).
3. List modules (Teams / Fixtures / Scheduling / Matches / Runtime) leave shell `ValidationPanel` on the default empty state (**“No validation issues”**) while entity/body rows show real product validation — operators get contradictory truth.

Architecture contracts, thin re-exports, and route ownership remain intact. Foundation automated tests are green. Unrelated existing test failures are documented separately and are not PXP regressions.

---

## Architecture Compliance

**PASS**

| Check | Result |
|-------|--------|
| Platform components under `components/platform/` | Present (canonical) |
| Thin re-export layer | Intact: `form-ui`, `page-chrome`, `setup-wizard-footer`, `organizer-page-chrome` |
| Migration table vs implementation | Matches Phase 1–4 status; Workspace Complete for all six EPIC modules + Live Ops |
| Old paths | Compatibility exports only (no logic forks at re-export sites) |
| Product APIs / ownership / state machines | Untouched in PXP layer (consumption only) |
| Phase 5 route ownership | **Not started** — badminton hub still operational |

**Notes (not FAIL):** Dual operator homes (TMC + badminton hub) remain intentional until Phase 5 cutover per PXP design §6.

---

## Mission Control Audit

**FAIL**

| Check | Result |
|-------|--------|
| TMC shell on `/tournament/:id` | Present — title, readiness strip, health, attention, module stack |
| Modules appear once under TMC | PASS — Competition → Teams → Fixtures → Scheduling → Matches → Runtime → Live Ops |
| Nested / duplicate chrome on TMC page | FAIL — Attention Center + Setup Checklist + Insights all surface overlapping readiness/attention |
| Readiness strip vs module health | Desync — strip is coarse auction-readiness; health rolls up per-module snapshots |
| Duplicate headers/cards in module stack | No duplicate module mounts under TMC |

---

## Module Workspace Audit

**FAIL**

Shell API (`ModuleWorkspace`) supports Header / Icon / Title / Health / Ready / Dependencies / Validation / History / Action Bar / Quick Peek / Platform Surface.

| Module | Shell wrap | Ready | Deps | Shell validation | History | Action Bar | Quick Peek | Domain-only body |
|--------|------------|-------|------|------------------|---------|------------|------------|------------------|
| Competition | ✓ | ✓ | ✓* | ✓ | ✓ | ✓ | ✓ | ✓ |
| Teams | ✓ | ✗ | ✓* | ✗ empty lie | — | ✗ in rows | ✓ | ✗ entity chrome |
| Fixtures | ✓ | ✗ | ✓* | ✗ empty lie | — | ✗ in rows | ✓ | ✗ entity chrome |
| Scheduling | ✓ | ✗ | ✓* | ✗ empty lie | — | ✗ in rows | ✓ | ✗ entity chrome |
| Matches | ✓ | ✗ | ✓* | ✗ empty lie | — | ✗ in rows | ✓ | ✗ entity chrome |
| Runtime | ✓ | ✗ | ✓* | ✗ empty lie | ✗ inline | ✗ in body | ✓ | ✗ reinvented chrome |
| Live Operations | ✓ | ✗ | empty | empty noise | — | ✗ links only | ✓ | ✓ link grid |

\*Dependencies are client snapshot heuristics / hardcoded — not Product API view facts.

`ModuleEntityRow` re-embeds `ReadyBadge` + `ValidationPanel` inside bodies — shared chrome outside the shell contract.

---

## Navigation Audit

**FAIL**

| Path | Result |
|------|--------|
| TMC ↔ auction operator Setup | Works (`setupAreaPath` / `openSetupArea`) |
| Live Ops → Auction Live Control | Opens auction room; no structured return |
| Live Ops → Badminton Mission Control / Broadcast | Links append `?from=`; destinations **ignore** `from`; Back stays badminton-hub-local |
| Live Ops → Cricket Live Control | **Dead link** `/tournament/:id/scoring` |
| Live Ops → LED / OBS-display | Reachable; return is browser-back |
| Teams Manage `?from=` | Unused by `teams.tsx` |
| Breadcrumbs | Not implemented (deferred / Phase 5–6 territory) |
| Phase 5 Home buttons → TMC | Not started (expected) |

Every reversible path requirement for Phase 3–4 Live Ops return is incomplete.

---

## Operator Journey Audit

**FAIL** (code-path simulation; no business-logic changes)

| Scenario | Orchestration path | Outcome |
|----------|--------------------|---------|
| Cricket Auction | Create → TMC pipeline → Auction Live Control | Pipeline OK; Cricket Live Control dead if used |
| Badminton Knockout | Create → TMC (parallel) + badminton hub for real ops | **P0 crash** on incomplete badminton hub EPIC cards |
| Badminton League | Same as knockout; fork at draw/fixture generate | Same P0 crash on incomplete hub |
| Practice | Same TMC modules; catalog defaults only | Auction Live Control still offered for non-badminton practice |
| Registered Teams | Same TMC modules | Same Live Ops sport gating; auction link may be inappropriate |
| Hybrid | Same TMC modules + auction economics at create | Cricket Live Control dead if cricket |

Shared finding: competition-type forks are create-time catalog only; TMC module stack does not diverge. Sport forks only at Live Operations.

---

## Design System Audit

**PASS** (documented progressive debt)

- Canonical platform components exist; no second implementation of `ValidationPanel` / `ReadyBadge` / `HubKpiCard` / platform `EmptyState`.
- Compatibility re-exports match migration table.
- Known drift (not RC1 blockers): inline `.org-kpi-card` on TMC vs `HubKpiCard`; unused `StatusBadge` / `ConfirmationDialog`; `OperatorForm` reverse facade to form-ui; platform chrome still imports badminton `BtnPrimary` / loading helpers.

---

## Performance Audit

**FAIL**

| Risk | Severity | Evidence |
|------|----------|----------|
| `ModuleRegistry.register` equality omits `attentionItems`, `validationIssues`, `peekSummary`, `recommendations` | P1 | Stale Attention / Quick Peek when issue **text** changes but counts do not |
| `aggregateValidationIssues(...)` creates a new array each render → snapshot identity churn → `useEffect` → `register` | P1 | Team/Fixture/Scheduling/Match cards |
| Any successful register replaces context → all registry consumers re-render | P1 | Cascading module re-renders during mount |
| Quick Peek / Attention Center themselves | OK | No poll loops; Quick Peek is state-driven |

No confirmed infinite render loop when equality short-circuits.

---

## Health / Attention / Dependencies / Validation / History / Quick Peek

| Area | Verdict | Key finding |
|------|---------|-------------|
| Module Health | Partial | Aggregates registered snapshots in pipeline order; missing snapshot → `"warning"` fallback |
| Tournament Health | Partial | Works when all modules register; Live Ops always reports healthy |
| Attention Center | FAIL | Auction readiness items all tagged `moduleId: "competition"` / label `"Setup"`; WARNINGs often lack actions; duplicates Setup Checklist |
| Dependencies | FAIL | Snapshot/hardcoded chips — not Product API facts; Competition always “Tournament met” |
| Validation | FAIL | Shell empty state lies on list/runtime modules; Competition OK |
| History | Partial | Shared `HistoryPanel`; Competition feeds recommendations; no timestamps in practice; other modules unused |
| Quick Peek | PASS* | Every module supplies non-empty lines; *stale risk from registry equality |

---

## Live Operations

**FAIL**

Destinations present: Auction Live Control, Badminton Mission Control, Cricket Live Control, LED, Broadcast/OBS.

| Item | Result |
|------|--------|
| Deep links (except Cricket) | Structurally present |
| Cricket Live Control | **Broken** — must use `scoringPath()` / `/score` |
| Return navigation | Advertised via `from=` but not consumed |
| OBS auction-specific helper | Not linked (non-badminton uses `/display`) |
| Workflow rewrite | None — deep-link only (correct for Phase 4) |

---

## Route Audit

**PASS**

- Phase 5 **has not started**.
- `/tournament/:id` = TMC; `/tournament/:id/badminton*` = operational badminton hub (scoring-app); `/tournament/:id/auction` = auction operator.
- TMC coexists without replacing operational homes.

---

## Code Quality Scan

**PASS** (report-only; no cleanup performed)

- No `TODO` / `FIXME` / `HACK` under `components/platform/` or `components/tournament-hub/`.
- Leftovers (do not auto-remove):
  - Deprecated unused `LiveOperationsPanel` body export
  - Stale comments referencing “until Phase 2”
  - Unused platform extracts (`StatusBadge`, `ConfirmationDialog`)
  - `buildMatchDependencies` noop alias of scheduling builder

---

## Testing

| Suite | Result | Notes |
|-------|--------|-------|
| `@workspace/platform-core` | **113/113 pass** | Foundation contracts green |
| API EPIC foundation tests (competition/team/fixture/scheduling/match/runtime/rule/presentation + stage) | **38/38 pass** (9 files) + stage suite green | No PXP-introduced API regression |
| `@workspace/scoring-core` | **45/45 pass** | Unrelated to PXP UI |
| `@workspace/api-server` full | **647 pass / 5 fail / 7 failed files** | Failures: DB-required SEO/meta/blog tests + SPA index shell without build artifact — **pre-existing / env**, not PXP |
| `@workspace/badminton-core` | 3 failures in `match-state-guard` | **Unrelated** existing failure; not PXP |
| auction-platform `src/lib/__tests__` via raw `node:test` | Harness/path-alias failures | Not evidence of product regression; needs Vite/alias runner |

**PXP-specific automated coverage gap:** no dedicated ModuleRegistry / ModuleWorkspace / Live Ops navigation unit tests.

---

## Regression Report

### P0

1. **Badminton incomplete-setup crash** — `pages/badminton/tournament-hub.tsx` mounts EPIC cards that call `useRegisterModuleSnapshot` → `useModuleRegistry` throws without `ModuleRegistryProvider`. Breaks badminton setup workflow.
2. **Cricket Live Control dead link** — `live-operations-panel.tsx` href `/tournament/:id/scoring` has no route; canonical is `/score` via `scoringPath()`.
3. **Shell validation false empty state** — Teams/Fixtures/Scheduling/Matches/Runtime omit `validationIssues` on `ModuleWorkspace` while issues exist in entity/body UI → shell shows “No validation issues”.

### P1

1. Live Ops / Manage `?from=` return context advertised but not consumed on badminton control/broadcast (and teams page).
2. Attention readiness blockers all attributed to Competition/`Setup` regardless of teams/players/settings.
3. Duplicate operator attention surfaces on TMC (Attention Center + Setup Checklist + Insights).
4. Dependency chips are client snapshot / hardcoded heuristics, not Product API view facts.
5. ModuleRegistry shallow equality omits attention/validation/peek content → stale Attention/Quick Peek.
6. Snapshot `allIssues` identity churn causes excess register/effect work and cascading re-renders.
7. Module shell contract incomplete vs Competition reference (Ready / History / Action Bar missing on list modules; actions live in `ModuleEntityRow`).
8. Non-auction competition types (practice / registered_teams) still offered Auction Live Control when sport ≠ badminton.
9. Platform readiness strip coarse-marks pipeline complete from auction readiness while EPIC modules may remain unlocked.

### P2

1. History entries lack timestamps; only Competition feeds HistoryPanel.
2. Nested `PlatformSurface` density; KPI twin languages (`.org-kpi-card` vs `HubKpiCard`).
3. Unused platform extracts / deprecated `LiveOperationsPanel` / stale Phase-2 comments.
4. Live Ops always healthy; empty ValidationPanel noise on nav module.
5. Sidebar “Tournament Home” vs page “Tournament Mission Control” naming drift.
6. Badminton setup copy still implies knockout-only while league UI exists.
7. `post_match` id exists on shell type but is not in pipeline (deferred — expected).
8. Manual screenshot parity still unchecked in migration table Phase 1 exit checklist.

---

## Required Fixes Before Phase 5

1. Provide `ModuleRegistryProvider` (or optional registry) around badminton incomplete-setup EPIC card mount — restore badminton setup without changing business logic.
2. Point Cricket Live Control at `scoringPath(tournamentId)` (or equivalent `/score` path).
3. Stop shell “No validation issues” lies: pass aggregated `validationIssues` into `ModuleWorkspace` for list/runtime modules, **or** suppress empty ValidationPanel when validation is entity-scoped.
4. Either honor `from=` on Live Ops destinations (control / broadcast / teams) for return to TMC, or remove the unused query param so return contract is honest.
5. Include attention/validation/peek content in ModuleRegistry equality (or stabilize snapshot identity) so Attention Center and Quick Peek cannot go stale.
6. Attribute readiness Attention items to the correct module (or a dedicated Setup source) — stop mapping every checklist gap to Competition.
7. Deduplicate TMC attention chrome: one primary attention channel for readiness blockers (Attention Center **or** Setup Checklist, not both presenting the same gaps).

---

## Nice To Have

1. Wire dependency chips from Product API view facts (replace snapshot heuristics) — when touching modules, not as a redesign.
2. Align Platform Readiness Strip with per-module lock/health facts.
3. Lift list-module primary actions into shell `ActionBar` (or formally document entity-row actions as the approved pattern).
4. Gate Auction Live Control on competition types that require auction economics.
5. Add unit tests for ModuleRegistry equality, Live Ops hrefs, and badminton provider mount.
6. Progressive rewire of unused extracts / KPI twin / sidebar label — Phase 6 polish territory.
7. History timestamps when product views expose them.

---

## Final Recommendation

**GO WITH FIXES**

Do **not** start Phase 5 (Home Cutover) or Phase 6 (Polish) until the numbered Required Fixes are verified.

The PXP architecture is the right shape: platform chrome is canonical, TMC orchestrates without rewriting sport ops, and Phase 5 has correctly not begun. RC1 is blocked on concrete stability defects (crash, dead link, contradictory validation), not on missing features or redesign needs.

After Required Fixes land, re-run this gate as **RC1.1** before Home Cutover.
