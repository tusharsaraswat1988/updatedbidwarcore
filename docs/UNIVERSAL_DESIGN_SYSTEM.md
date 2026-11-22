# Universal Design System in BidWar

## 1. Executive Overview & Purpose

The **Universal Design System (UDS)** is a source-backed, portable design system methodology integrated locally into the BidWar monorepo at `.agents/skills/universal-design-system/`. It serves as the authoritative framework for creating, extending, implementing, auditing, and modernizing UI components, layouts, design tokens, and interaction patterns across BidWar's internal organiser and management workspaces.

Unlike a rigid visual theme or third-party component library, UDS provides the **methodology and governance layer**. It synthesizes industry standards (W3C WCAG 2.2 Level AA, W3C DTCG 2025.10, WAI-ARIA APG, Material 3, IBM Carbon, Apple HIG, Atlassian Design System, and Fluent 2) to build cohesive, accessible, enterprise-grade user interfaces tailored specifically to BidWar's domain requirements.

---

## 2. Future AI Agent Activation & Usage Guide

### 2.1 Autonomous Discovery & System Prompt Registration
Antigravity and Gemini multi-agent systems automatically scan `.agents/skills/*/SKILL.md` in the repository root. By installing `universal-design-system` into `.agents/skills/universal-design-system/SKILL.md` with standard YAML frontmatter:
```yaml
---
name: universal-design-system
description: Create, define, document, implement, audit, or evolve a complete product-specific design system for websites, web apps, SaaS products, dashboards, and native or cross-platform mobile applications. Use when starting a product, establishing visual foundations, defining design tokens or components, modernizing inconsistent UI, or reviewing design-system quality.
---
```
the skill is permanently and automatically loaded into the agent's available `<skills>` catalog across all present and future sessions without requiring any external network access or external repository availability.

### 2.2 Agent Directives Integration
Every AI agent operating in BidWar is governed by directives defined in `AGENTS.md` and `GEMINI.md`:
- **`AGENTS.md` Core Engineering Directives**:
  > **Design System Directive:** Use `.agents/skills/universal-design-system/SKILL.md` when creating, modernising, auditing, or extending UI components, tokens, or layouts for organiser panels and management surfaces. Strictly adhere to token architecture, semantic layers, accessibility, and quality gates while preserving all protected surfaces.
- **`GEMINI.md` Architecture Principles (Rule 4)**:
  > **Organiser Workspace:** Internal management surfaces use the shared light enterprise design system, governed by the Universal Design System skill (`.agents/skills/universal-design-system/SKILL.md`).

### 2.3 Recommended Activation Prompts
When tasking an AI coding agent with UI modernisation, component creation, or design system audits, provide prompts following these patterns:

#### For Organiser Modernisation:
```text
Activate the universal-design-system skill located at .agents/skills/universal-design-system/SKILL.md.
Follow Stage 0 (Modernize) and Stage 2 (Inspect before defining). Modernise the [Specific Organiser Surface, e.g., Tournament Management / Fixtures].
Use the shared light enterprise tokens scoped under .bw-organizer-light.
Strictly observe the Protected Surfaces invariant (public pages, OBS overlays, LED screens, owner app, live scorer pads).
Ensure WCAG 2.2 AA accessibility, clear visual hierarchy, and 0 regression to underlying scoring or tournament business logic.
```

#### For New Component or Template Specification:
```text
Using .agents/skills/universal-design-system/SKILL.md, create a component specification using templates/component-spec.md for [Component Name].
Define semantic tokens, states (default, hover, active, focus-visible, disabled, loading), keyboard navigation semantics (WAI-ARIA APG), and responsive behavior.
Map the component tokens to BidWar's Tailwind CSS v4 and organizer-light-theme.css tokens.
```

#### For Design System Audit:
```text
Execute a Stage 0 (Audit) using .agents/skills/universal-design-system/SKILL.md and templates/design-system-audit.md on [Target Panel/Route].
Evaluate against the 13 UDS Minimum Quality Gates, WCAG 2.2 AA contrast ratios (4.5:1 text, 3:1 non-text), touch targets, and layout density.
Classify findings by P0 (critical/accessibility blocker), P1 (major UX workflow improvement), and P2 (visual polish/consistency).
```

### 2.4 Modular Reference Loading
AI agents should load reference files on-demand according to their task:
- `references/source-map.md`: Authority hierarchy, standard citation, resolving guideline conflicts.
- `references/discovery-and-brief.md`: Product context, user workflows, density and scale definition.
- `references/foundations.md`: Color ramps, typography scale, spacing grids, elevation, motion, content style.
- `references/tokens-and-architecture.md`: 4-tier DTCG token model, naming taxonomy, mode switching.
- `references/components-and-patterns.md`: Component anatomy, states, data tables, modal dialogs, form controls.
- `references/accessibility.md`: WCAG 2.2 AA compliance, keyboard focus loops, ARIA live announcements.
- `references/platform-adaptation.md`: Touch target minimums (44px min, 56–72px high pressure), responsive breakpoints.
- `references/governance-and-validation.md`: Design decision records (DDR), versioning, audit checklists.

---

## 3. Exact Inventory of Files Added and Modified

### 3.1 Files Added (17 Files Total)

#### Skill Root (`.agents/skills/universal-design-system/`):
| File Path | Lines | Description |
|---|---|---|
| `SKILL.md` | 206 | Main skill definition, mission, authority hierarchy, 10 workflow stages, 13 quality gates, output rules. |
| `README.md` | 13 | Package overview and structural summary. |

#### Reference Manuals (`.agents/skills/universal-design-system/references/`):
| File Path | Lines | Description |
|---|---|---|
| `source-map.md` | 95 | Source hierarchy and conflict resolution rules (WCAG > HIG > Material/Carbon/Fluent). |
| `discovery-and-brief.md` | 95 | Product discovery frameworks, density tiers, and user context analysis. |
| `foundations.md` | 124 | Token foundations: semantic color, typography, 4px/8px spacing, elevation, motion. |
| `tokens-and-architecture.md` | 109 | 4-tier DTCG token architecture, namespace taxonomy, theme modes. |
| `components-and-patterns.md` | 122 | Production component anatomy, state models, interactive tables, forms, overlays. |
| `accessibility.md` | 112 | WCAG 2.2 AA standards, 4.5:1/3:1 contrast ratios, keyboard navigation, screen reader affordances. |
| `platform-adaptation.md` | 86 | Platform idioms, touch target sizing (44px/56-72px), desktop vs mobile interaction ergonomics. |
| `governance-and-validation.md` | 93 | Design Decision Records (DDR), audit methodology, deprecation lifecycle. |

#### Design System Templates (`.agents/skills/universal-design-system/templates/`):
| File Path | Lines | Description |
|---|---|---|
| `design-system-brief.md` | 54 | Standard template for scoping new design system projects. |
| `component-spec.md` | 57 | Production specification template for individual UI components. |
| `design-decision-record.md` | 46 | Architecture Decision Record (ADR) adapted for design system decisions. |
| `design-system-audit.md` | 49 | Audit report template evaluating components against quality gates. |
| `design-system-specification.md` | 146 | Comprehensive multi-page system specification master template. |
| `design-token-starter.json` | 39 | Starter token schema adhering to W3C DTCG 2025.10 community specification. |

#### Documentation (`docs/`):
| File Path | Description |
|---|---|
| `docs/UNIVERSAL_DESIGN_SYSTEM.md` | This master guide for human engineers and AI coding agents. |

### 3.2 Files Modified (3 Files Total)
1. **`skills-lock.json`**:
   - Added `"universal-design-system"` registration entry:
     ```json
     "universal-design-system": {
       "source": "tusharsaraswat1988/designskillguidetushar",
       "sourceType": "github",
       "skillPath": "skills/universal-design-system/SKILL.md",
       "computedHash": "67a5ccf0d8a9bff442322415ea58bf2290cae84d63a4c9ea3144099153bf295f"
     }
     ```
2. **`AGENTS.md`**:
   - Appended `Design System Directive` non-destructively under `## Core Engineering Directives`, preserving all pre-existing directives and protected surface invariants.
3. **`GEMINI.md`**:
   - Updated Rule 4 under `## Architecture Principles` to bind the `Organiser Workspace` to `.agents/skills/universal-design-system/SKILL.md` while preserving Rules 1, 2, and 3 unchanged.

---

## 4. Token Architecture & Layers

The Universal Design System adheres to the **4-Tier Token Model** defined by the Design Tokens Community Group (W3C DTCG 2025.10 format):

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: PRIMITIVE TOKENS                              │
│  Raw values: hex colors, pixel scales, font families  │
│  Examples: blue-600: #2563eb, space-4: 16px           │
└──────────────────────────┬─────────────────────────────┘
                           │ referenced by
┌──────────────────────────▼─────────────────────────────┐
│  Tier 2: SEMANTIC TOKENS (Design Intent)               │
│  Meaningful roles: surface, text, action, status       │
│  Examples: surface-default, text-primary, action-hover │
└──────────────────────────┬─────────────────────────────┘
                           │ referenced by
┌──────────────────────────▼─────────────────────────────┐
│  Tier 3: COMPONENT TOKENS                              │
│  Scoped to specific components where needed            │
│  Examples: table-header-bg, dialog-overlay, badge-pill │
└──────────────────────────┬─────────────────────────────┘
                           │ compiled into
┌──────────────────────────▼─────────────────────────────┐
│  Tier 4: PLATFORM MAPPINGS                             │
│  Tailwind CSS v4 theme, CSS Custom Properties scoped   │
│  under .bw-organizer-light / [data-surface="organizer"] │
└────────────────────────────────────────────────────────┘
```

### 4.1 Token Scoping in BidWar
In BidWar, organizer tokens are isolated to prevent bleeding into protected dark/broadcast surfaces:
- **Root Selector**: `:is(.bw-organizer-light, [data-surface="organizer"])`
- **Source of Truth**: `artifacts/auction-platform/src/styles/organizer-light-theme.css`
- **Tailwind CSS v4 Integration**: Utility classes reference CSS variables configured in `artifacts/auction-platform/src/index.css`.

---

## 5. Design System Workflow Stages

When executing design system tasks, agents follow the 10 stages outlined in `SKILL.md`:

| Stage | Name | Key Activities |
|---|---|---|
| **Stage 0** | **Identify Work Mode** | Determine whether the task is **Create**, **Extend**, **Audit**, **Modernize**, or **Implement**. |
| **Stage 1** | **Product & Context Discovery** | Define user groups, critical tasks, information density, and accessibility requirements. |
| **Stage 2** | **Inspect Before Defining** | Audit existing code, components, CSS variables, and routes before proposing changes. |
| **Stage 3** | **Design Principles** | Establish 4–8 concrete principles (e.g. clarity over decoration, high-density readability). |
| **Stage 4** | **Token Architecture** | Organize tokens into Primitive, Semantic, Component, and Platform layers. |
| **Stage 5** | **Specify Foundations** | Define color roles, typography scale, spacing grid (4px/8px), elevation, and shape. |
| **Stage 6** | **Components & Patterns** | Specify component anatomy, states, accessibility semantics, and keyboard interactions. |
| **Stage 7** | **Workflow Patterns** | Design end-to-end user flows including loading, empty, validation, and error states. |
| **Stage 8** | **Implementation Contract** | Translate tokens and components into clean React/TypeScript code using existing libraries. |
| **Stage 9** | **Validation & Governance** | Validate against WCAG 2.2 AA, verify keyboard loops, log decisions with DDR templates. |

---

## 6. The 13 Minimum Quality Gates

Before declaring any design system component, surface, or modernisation complete, verify conformance against these 13 quality gates:

1. **Product Context Documented**: Target users, operational environment, and workflows are identified.
2. **Visual Direction Justified**: Design choices are driven by domain needs, not subjective styling trends.
3. **Strict Token Usage**: Every visual value derives from an approved semantic token or is a documented exception.
4. **Semantic vs Primitive Separation**: Semantic tokens (e.g. `action-primary`) remain distinct from primitive hex codes.
5. **Theme & Mode Consideration**: Light enterprise theme is maintained without impacting dark surfaces.
6. **Definitive Foundations**: Typography scales, spacing units, and responsive breakpoints have documented rules.
7. **Complete Component Anatomy**: Components define all visual states (default, hover, focus, active, disabled, loading).
8. **Comprehensive Interaction Patterns**: Forms, search, tables, modals, and feedback states are properly handled.
9. **Accessibility (WCAG 2.2 AA)**: 4.5:1 text contrast, 3:1 non-text contrast, visible focus rings, ARIA labels.
10. **Content Flexibility**: Layouts accommodate variable content lengths, empty data, and extreme numeric values.
11. **Responsive Viewport Testing**: Tested across desktop, tablet, and mobile viewport widths.
12. **Single Source of Truth**: Token definitions and component primitives have clear architectural ownership.
13. **Governance & Audit Trail**: Design decisions and known exceptions are recorded in decision records.

---

## 7. Protected Surface Boundaries & Architecture Invariants

BidWar is a dual-module sports platform with strict boundary invariants governed by `.agents/skills/bidwar_architecture_skill/SKILL.md` and `scripts/check-domain-boundaries.mjs`.

### 7.1 Protected Surfaces (STRICT NO-TOUCH ZONE)
The following surfaces must **NEVER** have their visual styles, CSS themes, or operational behaviors modified during organiser design system work:
- **Public Homepage & Marketing**: `/`
- **OBS Broadcast Overlays**: `/obs/*` (e.g., cricket OBS overlays, badminton OBS overlays, auction OBS overlays)
- **LED Screens**: `/display*`, `/court-display*`
- **Fan Platform**: `/fan*`
- **Team Owner App**: `artifacts/owner-app`
- **Live Scorer Pads**: `/cricket/:matchId/score`, `/badminton/:matchId/score` (`artifacts/auction-platform/src/pages/cricket/scorer.tsx` and `artifacts/auction-platform/src/pages/badminton/scorer.tsx`)

### 7.2 Surface Isolation Mechanism
Isolation is programmatically enforced in `artifacts/auction-platform/src/lib/portal-theme.ts` via `isOrganizerRoute(path)`. Only paths designated as internal organiser surfaces have the `.bw-organizer-light` class attached to the root document. Protected surfaces always retain their broadcast dark styling.

### 7.3 Architecture Invariants
1. **Module Independence**: The Auction engine and Sports Scoring engine are sibling modules. A tournament can be Auction-only, Scoring-only, or Both. Modernisations must never couple auction code to scoring code.
2. **Global Member Identity**: Human identities use global `members` (`mem_*`), distinct from tournament participant IDs.
3. **Scoring Engine Purity**: `lib/scoring-core` and `lib/badminton-core` are pure deterministic domain engines. Organiser UI surfaces consume APIs and hooks (`@workspace/api-client-react`, `scoring-api.ts`, `badminton-api.ts`) without modifying mathematical reducers or scoring state logic.

---

## 8. Verification Commands

After any modification to design system files, documentation, or organiser components, run the following verification suite:

```powershell
# 1. Verify Domain Boundaries (ensures module independence between Auction and Sports Scoring)
node scripts/check-domain-boundaries.mjs

# 2. Verify Library Typechecks
pnpm run typecheck:libs

# 3. Verify Skill File Integrity
(Get-ChildItem -Recurse d:\bidwar\updatedbidwarcore\.agents\skills\universal-design-system -File).Count
# Expected: 16

# 4. Verify SKILL.md SHA256 Hash matches skills-lock.json
(Get-FileHash d:\bidwar\updatedbidwarcore\.agents\skills\universal-design-system\SKILL.md -Algorithm SHA256).Hash
# Expected: 67A5CCF0D8A9BFF442322415EA58BF2290CAE84D63A4C9EA3144099153BF295F
```
