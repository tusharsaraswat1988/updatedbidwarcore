# PXP Component Migration Table

**Date:** 2026-08-05  
**Parent:** [`2026-08-05-product-experience-phase-pxp-design.md`](./2026-08-05-product-experience-phase-pxp-design.md)  
**Phase status:** Phase 1 extraction landed · Phase 2 TMC shell landed · Phase 3 workspace migration landed (all EPIC modules Workspace Complete)

**Status legend**

| Symbol | Meaning |
|--------|---------|
| — | Not started |
| ✅ | Done |
| N/A | Not applicable |
| Soft | Eligible under B |
| Twin | Eligible under C |

---

## 1. Phase 1 extraction candidates

| Platform component | Canonical path | Auction source | Badminton source | Eligibility | Canonical | Compat re-export | Old imports remaining | Notes |
|--------------------|----------------|----------------|------------------|-------------|-----------|------------------|-----------------------|-------|
| `PlatformSurface` | `platform/platform-surface.tsx` | `.org-surface-rail` | `hubPanelClass` / `hubCardClass` | Twin | ✅ | ✅ `form-ui` re-exports hub classes | Call sites still import hub classes from form-ui/page-chrome | EPIC cards + hub checklist use `PlatformSurface` |
| `PlatformCard` / `HubKpiCard` | `platform/platform-card.tsx` | `.org-kpi-card` | `HubKpiCard` | Twin | ✅ | ✅ `page-chrome` re-exports `HubKpiCard` | Hub KPI markup still inline on tournament-hub | Progressive rewire later |
| `StatusBadge` | `platform/status-badge.tsx` | status helpers / operator pills | Badge chips | Twin | ✅ | N/A (new named export) | 0 old path | Available for Phase 2 readiness strip |
| `ReadyBadge` | `platform/ready-badge.tsx` | EPIC setup pills | setup status chips | Twin | ✅ | N/A | Rewired in Competition/Team/Fixture/Scheduling/Match cards | |
| `ValidationPanel` | `platform/validation-panel.tsx` | EPIC issue lists | wizard validation twin | Twin | ✅ | N/A | Rewired in 5 setup cards; Runtime keeps distinct list format | |
| `ErrorBanner` | `platform/error-banner.tsx` | setup card error banners | `FormError` twin | Twin | ✅ | N/A | Rewired in all 6 EPIC cards | |
| `ActionBar` | `platform/action-bar.tsx` | lock rows / operator actions | `FormActions` | Twin | ✅ | N/A | Shell only; FormActions body still in form-ui | |
| `SectionHeader` | `platform/section-header.tsx` | `OrganizerSectionHeader` | `HubSectionHeader` | Twin | ✅ | ✅ `organizer-page-chrome` + `page-chrome` | Existing imports via old paths | |
| `PageChrome` | `platform/page-chrome.tsx` | section headers | IA chrome | Soft | ✅ | Re-exports SectionHeader family | PageHeader / IaPageChrome remain badminton | |
| `LoadingState` | `platform/loading-state.tsx` | setup skeletons | AsyncLoading* | Twin | ✅ | N/A | Used by 5 setup cards | |
| `EmptyState` | `platform/empty-state.tsx` | ad-hoc empties | `EmptyState` | Soft+Twin | ✅ | ✅ `page-chrome` re-export | Callers still import from page-chrome | |
| `ConfirmationDialog` | `platform/confirmation-dialog.tsx` | AlertDialog patterns | same | Twin | ✅ | N/A | Available; call sites not force-rewired | |
| `WizardFooter` | `platform/wizard-footer.tsx` | Soft | `BadmintonSetupWizardFooter` | Soft | ✅ | ✅ `setup-wizard-footer.tsx` | Callers keep old import path | |
| `ReviewPanel` | `platform/review-panel.tsx` | Competition InfoRow | summary panels | Twin | ✅ | N/A | Competition card rewired | |
| `ProgressHeader` | `platform/progress-header.tsx` | Setup Checklist | setup progress | Twin | ✅ | N/A | Tournament Hub checklist rewired | |
| `OperatorForm` | `platform/operator-form.tsx` | organizer forms | form-ui fields | Twin | ✅ | Facade re-export of form-ui | Body move deferred (avoid big-bang form extract) | |

---

## 2. Phase 2+ components (not inventing in Phase 1)

| Platform component | Phase | Notes |
|--------------------|-------|-------|
| `ModuleWorkspace` | 2 | Shell wrapping existing domain bodies |
| `HealthBadge` | 2 | Healthy / Warning / Blocked |
| `DependencyChips` | 2 | Needs chips from view facts |
| `PlatformReadinessStrip` | 2 | Pipeline readiness |
| `TournamentHealth` | 2 | Module health rollup |
| `AttentionCenter` | 2 | Blockers / warnings / recommendations |
| `HistoryPanel` | 3 | ✅ `platform/history-panel.tsx` — recommendations in workspace shell |
| `ModuleEntityRow` | 3 | ✅ `platform/module-entity-row.tsx` — list module row chrome |
| `ModuleQuickPeek` | 3 | ✅ Wired from TMC module registry |
| `ModuleRegistry` | 3 | ✅ `tournament-hub/module-registry.tsx` |
| Live Operations workspace | 4 | Navigation only |

---

## 3. EPIC setup card → Module body migration

**Phase 3 status:** Workspace Complete for all six EPIC modules + Live Operations shell.

| Today | Phase 1 | Phase 3 |
|-------|---------|---------|
| `competition-setup-card.tsx` | Uses platform chrome | ✅ **Workspace Complete** — body in `ModuleWorkspace`; chrome in shell |
| `team-setup-card.tsx` | Uses platform chrome | ✅ **Workspace Complete** — `ModuleEntityRow` bodies |
| `fixture-setup-card.tsx` | Uses platform chrome | ✅ **Workspace Complete** — `ModuleEntityRow` bodies |
| `scheduling-setup-card.tsx` | Uses platform chrome | ✅ **Workspace Complete** — `ModuleEntityRow` bodies |
| `match-setup-card.tsx` | Uses platform chrome | ✅ **Workspace Complete** — `ModuleEntityRow` bodies |
| `runtime-preparation-card.tsx` | PlatformSurface + ErrorBanner only (distinct validation UI preserved) | ✅ **Workspace Complete** — per-row plain `[SEVERITY]` list preserved in body |
| `live-operations-panel.tsx` | Standalone surface | ✅ **Workspace Complete** — `LiveOperationsModule` shell + link grid body |

---

## 4. Compatibility re-export map

| Old path | Re-exports |
|----------|------------|
| `components/badminton/form-ui.tsx` | `hubCardClass`, `hubPanelClass` → platform |
| `components/badminton/page-chrome.tsx` | `EmptyState`, `HubKpiCard`, `HubSectionHeader` → platform |
| `components/badminton/setup-wizard-footer.tsx` | `WizardFooter`, `BadmintonSetupWizardFooter` → platform |
| `components/organizer-page-chrome.tsx` | `OrganizerSectionHeader`, `TournamentContextLabel` → platform |

---

## 5. Phase 1 exit checklist

- [x] Platform folder exists under `auction-platform/src/components/platform/`
- [x] No API / runtime / ownership changes
- [x] No duplicated business logic
- [x] Thin re-exports at old paths for moved named exports
- [x] EPIC cards still call same product endpoints
- [x] Runtime preparation validation display format unchanged
- [ ] Manual screenshot parity (operator verification)
- [ ] Existing automated tests green in CI

---

## 6. Update protocol

After every Phase 1+ PR that touches platform components:

1. Mark Canonical / Compat columns
2. Recount old imports (`rg` from previous path)
3. Only delete a re-export when old imports remaining = 0
4. Re-run Phase Exit Checklist in parent design doc §5.1
