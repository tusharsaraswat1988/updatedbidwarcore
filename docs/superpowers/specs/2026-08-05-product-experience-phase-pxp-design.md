# BidWar Product Experience Phase (PXP) Design

**Date:** 2026-08-05  
**Status:** PHASES 0–4 landed (shell + Live Operations); Phase 5 cutover + Phase 6 polish pending  
**Scope:** Product Experience only. Platform Foundation EPIC-01 → EPIC-10 remains frozen.  
**Authority:** This document freezes PXP migration rules. It does not redefine platform ownership, APIs, or business rules.  
**Precedents:** `2026-08-05-platform-architecture-freeze.md`; Auction Operator UX; Badminton Mission Control UX; EPIC setup cards on Tournament Hub.

---

## 1. Mission

Transform BidWar into one unified operator experience while preserving every mature operational workflow.

The product must feel like: **"This has always been BidWar."**

Not: **"This is the new Platform."**

### 1.1 Non-goals (frozen)

- Do not redesign BidWar
- Do not rewrite existing modules
- Do not create another frontend architecture
- Do not invent new business logic
- Do not modify Platform ownership
- Do not modify APIs
- Do not create frontend-owned validation
- Do not create a new design system / CSS framework / `shared-ui` package
- Do not duplicate mature operational screens

### 1.2 Hard design system (frozen)

Auction Operator + Badminton Mission Control **are** BidWar's design system.

CricHeros is **light inspiration only**. Auction + Badminton remain the hard reference.

---

## 2. Product Experience Constitution

1. **Tournament Mission Control** is the operator home. Everything starts here. Everything returns here.
2. **Hub orchestrates.** Pipeline: Competition → Teams → Fixtures → Scheduling → Matches → Runtime Preparation → Live Operations → Post Match → Tournament Complete.
3. **Sport modules operate.** Auction Operator, Badminton Mission Control, Scoring, Draw, Scheduling, Registration remain operational workspaces.
4. **Never redesign operational workflows.** Reuse them.
5. **Validation before Action.**
6. **One Job = One Screen.**
7. **Progressive Disclosure.**
8. **Fast Tournament Operations.**
9. Operator always knows **where they are**, **what is next**, **what is blocked**.
10. Every action returns back to Tournament Mission Control.

---

## 3. Naming Hierarchy (frozen)

```
Tournament Mission Control          ← operator home (airport control tower)
│
├── Competition
├── Teams
├── Fixtures
├── Scheduling
├── Matches
├── Runtime Preparation
├── Live Operations                 ← first-class destination (not a button)
│     ├── Badminton Mission Control ← KEEP existing name
│     ├── Cricket Live Control
│     ├── Auction Live Control      ← surface name from TMC; "Operator" may remain internally
│     ├── OBS
│     ├── LED
│     └── Broadcast
├── Post Match
└── Tournament Complete
```

**Rule:** Do not rename Badminton Mission Control. Scope separation removes ambiguity; renaming creates churn without architectural benefit.

---

## 4. Architecture boundaries (frozen)

### 4.1 Platform ownership untouched

EPIC-01 Catalog → EPIC-10 Presentation Engine: **no changes**.

### 4.2 Product layer consumption only

Tournament Mission Control and Module Workspaces consume:

- Competition View
- Team View
- Fixture View
- Scheduling View
- Match View
- Runtime Match View
- Rule Engine
- Presentation Engine

Never:

- runtime tables
- duplicate validation
- duplicate business rules
- duplicate state
- duplicate ownership

### 4.3 Hub vs sport modules

| Layer | Owns | Does not own |
|-------|------|--------------|
| Tournament Mission Control | Orchestration, health rollup, attention, readiness strip, navigation, return context | Operational workflows |
| Module Workspace | Shared chrome: status, health, deps, validation display, actions, progress, history | Domain fetch/mutate rules |
| Sport operational surfaces | Mature workflows (auction, badminton live, scheduling screens, registration) | Platform identity / views |

---

## 5. Phase Ladder (approved)

```
Phase 0  Preparation          ← no UI / no refactors
Phase 1  Extract              ← canonical platform components + thin re-exports
Phase 2  Tournament Mission Control shell
Phase 3  Workspace Migration  ← chrome moves into ModuleWorkspace; bodies remain
Phase 4  Live Operations
Phase 5  Home Cutover         ← C → A end state
Phase 6  Polish               ← keyboard, a11y, motion, density — never mixed with migration
```

### 5.1 Phase Exit Checklist (every phase)

- [ ] No visual regression
- [ ] No API changes
- [ ] No runtime changes
- [ ] No platform ownership changes
- [ ] No duplicated components
- [ ] No duplicated business logic
- [ ] Screenshot parity (where baselines exist)
- [ ] Auction parity
- [ ] Badminton parity
- [ ] Existing tests green
- [ ] Migration table updated
- [ ] Compatibility layer still valid (until Phase 1 cleanup complete)

---

## 6. Operator Home Migration Rule (frozen)

| Step | Rule |
|------|------|
| Phase 0–1 | Prepare + extract. Old homes unchanged. |
| Phase 2 | New home introduced at `/tournament/:id` as Tournament Mission Control shell. `/tournament/:id/badminton` unchanged. |
| Phase 3–4 | Navigation, breadcrumbs, and return actions point back to Tournament Mission Control. Live Operations routes to sport live surfaces. |
| Phase 5 | All "Home" buttons in sport modules return to Tournament Mission Control. Old hub routes become operational workspaces only. |
| End state (A) | `/tournament/:id` is the only operator entry point. Sport routes remain destinations, not homes. |

**Transitional strategy:** C now → A end state. Do not force A immediately.

---

## 7. Extraction Strategy (A Modified — frozen)

```
Existing implementation
    ↓
components/platform/     ← canonical
    ↓
Thin re-export at old path (no logic, no styling, no prop transforms)
    ↓
Progressive rewire of imports when screens are touched
    ↓
Delete compatibility re-exports when old-import count = 0
```

### 7.1 Extraction eligibility (B + C mix)

A candidate may become a platform component when **either**:

1. **Soft (B):** Used on one mature surface today **and** clearly required by Tournament Mission Control in Phase 2+, or  
2. **Family (C):** Auction **or** Badminton owns a production implementation **and** the other side has an equivalent visual/UX twin (even if differently named).

Never invent greenfield chrome in Phase 1.

### 7.2 Canonicalization checklist

Before a component is canonical in `components/platform/`:

- [ ] Pixel-identical to current implementation
- [ ] No API/prop changes
- [ ] No behavior changes
- [ ] No new dependencies
- [ ] Satisfies B+C eligibility
- [ ] Existing visual regression screenshots still pass (when available)

### 7.3 Module Workspace model (B Modified — frozen)

- `ModuleWorkspace` = shared platform shell
- Existing EPIC setup cards progressively reduce to **domain body only**
- Shared chrome (status, health, dependencies, validation display, actions, progress, history) moves into `ModuleWorkspace`
- Do **not** immediately convert setup cards into hooks/helpers — later cleanup after shell/domain separation is complete

```
ModuleWorkspace
  └── CompetitionBody   ← today's CompetitionSetupCard domain content
```

Not: inventing a separate "Competition Workspace" product.

---

## 8. Phase 0 Deliverables

### 8.1 UX Constitution

See §2–§4. Frozen.

### 8.2 Design Tokens Audit

**Source of truth:** existing Auction organizer utilities + Badminton form/page chrome. Do not invent tokens.

| Category | Canonical sources today | Notes |
|----------|------------------------|-------|
| Typography | `--font-display`, `font-display`, hub/org heading classes | Bebas/Barlow via existing font pipeline |
| Spacing | 8px grid; `org-page-content`, `space-y-6/8`, hub `p-5` | Keep |
| Radius | `rounded-xl`, `rounded-lg`, `--radius-lg` | Keep |
| Elevation | `--shadow-panel`, lovable surface gradients | Keep; do not add new shadow language |
| Surfaces | `.org-surface-rail`, `.org-surface-card`, `hubPanelClass`, `hubCardClass` | Phase 1 → `PlatformSurface` / `PlatformCard` |
| KPI cards | `.org-kpi-card`, `HubKpiCard` | Twins (C) |
| Status colors | `.status-active/trial/done/locked`, green/amber/destructive badges in setup cards | Keep |
| Forms | Badminton `form-ui` (`FormField`, `BtnPrimary`, …), organizer forms | Extract carefully; no new form DSL |
| Buttons | `Button`, `BtnPrimary`, `BtnSecondary`, `min-h-12` operator CTAs | Touch targets preserved |
| Dialogs | `AlertDialog`, `Dialog`, `Sheet` | Confirmation wraps existing AlertDialog |
| Headers | `OrganizerSectionHeader`, Badminton `PageHeader` / `BadmintonIaPageChrome` | Twins (C) |
| Loading | `Skeleton`, `AsyncLoadingPanel`, `AsyncLoadingInline` | Twins (C) |
| Empty | Badminton `EmptyState` | Auction has ad-hoc empties — adopt Badminton as twin target |
| Error | destructive bordered banners in setup cards | Shared pattern already |
| Dark mode | existing `.dark` / theme variables | No new theme |
| Safe areas | existing operator/mobile patterns | Phase 6 polish only |

**Rule:** Reuse. Do not invent another design language.

### 8.3 Component Inventory + Old → New Mapping

See companion: [`2026-08-05-pxp-component-migration-table.md`](./2026-08-05-pxp-component-migration-table.md)

### 8.4 Route Migration Plan

| Route today | Role today | Phase 2–4 | Phase 5 end state |
|-------------|------------|-----------|-------------------|
| `/tournament/:id` | Auction/platform Tournament Hub + EPIC setup cards | Becomes **Tournament Mission Control** shell; cards remain as bodies | Canonical operator home |
| `/tournament/:id/badminton` | Badminton operational hub (setup + live entry) | Unchanged operational hub | Operational workspace / Live Ops destination entry, not home |
| Badminton Mission Control / Live Control routes | Live badminton ops | Listed under Live Operations | Destination under Live Operations |
| Auction Operator routes | Live auction ops | Surfaced as **Auction Live Control** from TMC | Destination under Live Operations |
| Cricket scoring / live routes | Cricket ops | Surfaced as **Cricket Live Control** | Destination under Live Operations |
| OBS / LED / Broadcast routes | Presentation surfaces | Listed under Live Operations | Destinations under Live Operations |

Deep-link return rule (Phase 3–4): every large workflow returns to Tournament Mission Control and restores prior context.

### 8.5 Screenshot Baseline + Regression Checklist

**Baseline surfaces (capture before Phase 1 if tooling available; otherwise treat as manual parity checklist):**

1. Tournament Hub `/tournament/:id` — setup phase + active phase
2. Each EPIC setup card loaded state (Competition, Team, Fixture, Scheduling, Match, Runtime)
3. Auction Operator main board
4. Badminton Mission Control / Live Control
5. Badminton setup wizard step + sticky footer
6. Badminton EmptyState example page
7. Organizer Teams / Players section headers

**Regression checklist (run every phase exit):**

- [ ] Tournament Hub still loads all six EPIC cards
- [ ] Lock / Ready actions still call the same product endpoints
- [ ] Validation issue lists still render ERROR/WARNING/INFO identically
- [ ] Auction Operator keyboard + action targets unchanged
- [ ] Badminton Mission Control health strip / courts / queues unchanged
- [ ] Badminton setup wizard Back/Continue gating unchanged
- [ ] No new network calls introduced by chrome extraction
- [ ] No changes under API server product ownership / EPIC routes

---

## 9. Phase plans (summary)

### Phase 1 — Extraction

- Create `artifacts/auction-platform/src/components/platform/`
- Move eligible implementations to canonical platform files
- Leave thin re-exports at old paths
- Update migration table counts
- **Success:** platform components exist; nothing user-visible changes

### Phase 2 — Tournament Mission Control Shell

Build shell only on `/tournament/:id`:

- Rename conceptually to Tournament Mission Control
- Platform Readiness strip
- Tournament Health rollup (Healthy / Warning / Blocked) — distinct from Ready lifecycle
- Attention Center (Blockers / Warnings / Recommendations by module)
- Pipeline
- `ModuleWorkspace` shell wrapping existing domain bodies
- Shared navigation / page chrome

Cards never disappear. Domain content stays.

### Phase 3 — Workspace Migration

Progressively move common UX into `ModuleWorkspace`:

- validation display
- review
- history (when present)
- dependency chips
- next recommended action
- action bar

Hybrid editing begins here:

- **Small edits:** side sheets inside Mission Control
- **Large workflows:** deep-link into mature modules → return

### Phase 4 — Live Operations

First-class destination under Tournament Mission Control listing sport live surfaces + OBS/LED/Broadcast. Navigation changes; do not rewrite live implementations. Restore Mission Control context on return.

### Phase 5 — Home Cutover

`/tournament/:id` becomes canonical home. Badminton hub becomes operational workspace. Home buttons return to TMC.

### Phase 6 — Polish

Keyboard, accessibility, animations, history UX, loading/transitions, responsive/density tweaks. Never mix with migration.

---

## 10. Health vs Ready (frozen)

| Concept | Meaning | Values |
|---------|---------|--------|
| **Ready** | Lifecycle readiness from product views | existing readiness enums / locked |
| **Health** | Operator information rollup | Healthy / Warning / Blocked |

Tournament Health = rollup of module health. Not a substitute for Ready.

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Big-bang import rewires hide extraction bugs | A Modified: extract + re-export first; progressive rewire |
| Duplicate badges/systems | Migration table + delete compat only at zero |
| Accidental Badminton hub rewrite | C→A cutover; hub unchanged until Phase 5 |
| Invented chrome | B+C eligibility + "which Auction/Badminton component did this replace?" |
| Frontend validation creep | Display-only validation panels; product APIs remain source of truth |
| Density loss | Explicit non-goal; keep Auction + Badminton information density |

---

## 12. Success criteria

- A first-time organizer can operate an entire tournament from Tournament Mission Control
- Auction and Badminton feel like one product while preserving optimized workflows
- No mature operational screen rewritten unnecessarily
- Platform orchestrates; sports operate
- EPIC-01 → EPIC-10 architecture untouched

---

## 13. Approval log

| Decision | Choice |
|----------|--------|
| Scope of work | Full PXP design + implement phases in sequence |
| Naming | A Modified — TMC → Live Operations → sport live surfaces; keep Badminton Mission Control name |
| CricHeros | D — light inspiration only |
| Extraction | A Modified — canonicalize → thin re-export → progressive rewire → remove |
| Operator home | C transitional → A end state |
| Extraction eligibility | Mix of B + C |
| Module Workspace | B Modified — shell + progressive domain reduction |
| Phase ladder | Phase 0–6 as in §5 |

**Phase 0 status:** Foundation artifacts written.  
**Phase 1 status:** Canonical `components/platform/*` extracted; thin re-exports; EPIC cards consume platform chrome.  
**Phase 2 status:** Tournament Mission Control shell on `/tournament/:id` — readiness strip, tournament health, attention center, ModuleWorkspace wrappers. Cards preserved.  
**Phase 3 status:** Hybrid shell (`ModuleQuickPeek` side sheet) + deep-link `from=` return to TMC started (Team Manage). Full per-module chrome migration still progressive.  
**Phase 4 status:** Live Operations module workspace deep-links Auction Live Control / Badminton Mission Control / LED / Broadcast.  
**Phase 5 pending:** Canonical home cutover (badminton hub becomes workspace-only).  
**Phase 6 pending:** Keyboard, a11y, motion polish.
