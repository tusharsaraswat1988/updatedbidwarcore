# Draw & Fixtures Module — BidWar Scoring Architecture v1.0

**Date:** 2026-07-13  
**Status:** Approved — Architecture Freeze  
**Version:** BidWar Scoring Architecture v1.0  
**Scope:** Product architecture + Phase 1 prep (not full feature implementation)

---

## Architecture freeze

This document is the **official BidWar Sports Scoring architecture**.

After publication:

- Future work focuses on **implementation, UX, and features**.
- Do **not** introduce new architectural abstractions unless a real tournament exposes a genuine limitation.
- New generators, importers, and sports plug into the layers and adapter contract defined here.

---

## Problem

The current badminton workflow assumes every organizer wants BidWar to **generate** the draw.

That is false for many tournaments that already have:

- Official association draw
- Printed fixture sheet
- Excel fixture list
- PDF draw
- Manual bracket

Those organizers need BidWar for **scheduling and live scoring**, not draw generation.

Therefore draw generation cannot be the only entry point into fixtures.

---

## Official hierarchy

```
Tournament
    ↓
Categories
    ↓
Fixture Collections
    ↓
Fixtures
    ↓
Scheduling
    ↓
Matches
    ↓
Scoring
    ↓
Results
```

This is the official BidWar Sports Scoring hierarchy. All sports should eventually share this product model. Badminton is the first implementation (`badminton_draws` / `badminton_fixtures` as storage).

---

## Three layers

Every future feature must fit into one of these layers.

### Planning layer

```
Categories
    ↓
Fixture Collections
    ↓
Fixtures
```

Owned by the **Draw & Fixtures** module (plus Categories for event definition only).

### Execution layer

```
Scheduling
    ↓
Matches
    ↓
Scoring
```

Owned by **Matches** (schedule / create match) and the **scoring engine** (live play).

### Result layer

```
Results
    ↓
Standings
    ↓
Statistics
    ↓
Winner Progression
```

Downstream of completed matches. Not part of Phase 1 Draw & Fixtures work.

### Responsibility separation (hard rule)

| Module | Owns | Must never own |
|--------|------|----------------|
| **Categories** | What competitions exist | How fixtures are created |
| **Draw & Fixtures** | Planning (collections + fixtures); Schedule / Create Match CTAs | Start Match, Open Scoring, Live |
| **Matches** | Execution (schedule details, match create, ops) | Fixture source adapters |
| **Scoring** | Recording live play | Fixture creation |

> Draw & Fixtures **plans** the tournament.  
> Matches **executes** the tournament.  
> Scoring **records** the tournament.

---

## Core concepts

### Categories

Answer only: **what competitions exist?**

Examples: Men's Singles, Women's Singles, Mixed Doubles.

Categories must **not** know Auto / Manual / Import. They may only expose a CTA such as **Open Draw & Fixtures**.

### Fixture Collection

Sport-agnostic **reusable tournament planning container**.

Not a temporary object. Not synonymous with “Draw.”

A **Draw** is one *kind* of Fixture Collection (typically auto-generated). Collections also cover leagues, imports, practice lists, day sheets, etc.

Examples under one category:

```
Men's Singles
    Main Draw
    Practice Fixtures
    Imported Day 2

Women's Singles
    Main Draw
```

**Cardinality:** A category may have **zero** collections (valid — organizer returns later). Architecture must allow **many** collections per category. Phase 1 UX may create one collection per workflow action; structure must not block N.

**Metadata (conceptual; no Phase 1 schema migration):**

| Field | Phase 1 storage |
|-------|-----------------|
| Collection name | `badminton_draws.roundName` (organizer-owned; suggest defaults) |
| Collection kind | `drawKind`: `generated` \| `imported` \| `manual` |
| Created at | existing `createdAt` |
| Created by / notes | `metaJson` when needed |

Suggested default names (editable): Main Draw, League Fixtures, Knockout, Practice, Imported Fixtures.

### Fixture

Simply:

**Player A vs Player B** (registration / side A vs side B).

Everything else is optional: stage, bracket slot, court, time, practice/friendly flags.

**Not every fixture belongs to a bracket.**

Fixtures are the **source of truth** for everything downstream.

### Internal mapping (Phase 1 — no table rename)

| Product concept | Badminton storage |
|-----------------|-------------------|
| Fixture Collection | `badminton_draws` |
| Fixture | `badminton_fixtures` |
| Category | `badminton_categories` |
| Match | `scoring_matches` + `badminton_match_details` |

`drawId` remains required on fixtures: every fixture belongs to a collection. That is intentional — collections are real parents, not fake draws.

---

## Module: Draw & Fixtures

### Product naming

- UI module name: **Draw & Fixtures**
- Internal/generic concept: **Fixture Collection**
- Never present the module as “Draw Generator” only
- Product wording should not treat “Draw” as the universal container name

### Setup flow

```
Branding
  → Players
  → Categories
  → Match Format
  → Courts
  → Draw & Fixtures
  → Matches
  → Broadcast
```

### UI structure (category-first)

Landing must **never** be fixture-first:

```
Category
  → Fixture Collections
    → Fixtures
```

Example:

```
Men's Singles
    Main Draw
    Imported Fixtures
Women's Singles
    Main Draw
Mixed Doubles
    Manual Fixtures
```

Three entry workflows (current Fixture Source Adapters):

1. **Auto Generate Draw** — BidWar generates fixtures (existing algorithm, wrapped).
2. **Import Existing Draw** — stub in Phase 1 (Excel/CSV/PDF later).
3. **Create Fixtures Manually** — organizer enters A vs B (+ optional stage/court/time later).

Draw & Fixtures may expose only:

- Schedule
- Create Match

It must **never** expose: Start Match, Open Scoring, Live.

---

## Fixture Source Adapter contract

### Single write path

There is **one** fixture writer. Every source calls it.

```
Fixture Source Adapter
        ↓
Fixture Collection
        ↓
Fixtures
        ↓
Scheduling → Matches → Scoring → Results
```

**No adapter may directly create matches or start scoring.**

### Conceptual contract

```ts
type FixtureCollectionKind = "generated" | "imported" | "manual"; // extensible

type CreateFixturesResult = {
  collection: /* badminton_draws row */;
  fixtures: /* badminton_fixtures rows */;
};

// All adapters → same writer → CreateFixturesResult
```

### Current implementations

| Adapter | Kind | Phase 1 |
|---------|------|---------|
| Auto Generator | `generated` | Wrap existing `POST .../generate-draw` |
| Manual Entry | `manual` | New create path via same writer |
| Import | `imported` | Stub UI / contract only |

### Future adapters (same writer)

Swiss Generator, Round Robin Generator, Double Elimination Generator, API Import, Excel Import, PDF Import, AI Fixture Generator, etc.

Every future feature plugs into the adapter layer — **not** into new downstream pipelines.

---

## Downstream pipeline (unchanged engines)

```
Fixture
  → Stage (optional DrawStageKey when present)
  → Match Format Resolution
  → Scheduling (court / time on fixture)
  → Match (scoring_matches from fixture)
  → Live Scoring
  → Results / Standings / Stats / Winner Progression
```

Rules:

- Scheduling always starts from **Fixtures**, never from Categories or “Draws” as a separate path.
- Scoring never cares how the fixture was created.
- Do not fork scheduling or scoring by source.

### Manual match compatibility

Today: Matches UI allows “None — manual match” (match without fixture).

**Temporary compatibility path only.**

Target architecture:

```
Create Match → ensure Fixture → create Match from Fixture
```

Even manually created matches should eventually have a fixture. One hierarchy.

---

## Assumptions that forced “Generate Draw” only (baseline)

| Location | Assumption |
|----------|------------|
| `badminton-setup-workflow.ts` | Step “Generate draws”; done iff fixtures exist; copy implies brackets required before scheduling |
| `tournament-hub.tsx` | Checklist driven by that workflow |
| `categories.tsx` | Only write UX: “Generate Knockout Draw”; owns fixture list |
| `POST .../generate-draw` | Only fixture insert path |
| `generateKnockoutDraw()` | Always power-of-2 knockout; ignores `drawType` |
| Schema `drawKind` default | `knockout_round` implies bracket-only collections |
| Docs / `api-base` comments | Draw Generator as sole stage assigner |
| Soft bypass | Match create without `fixtureId` skips planning layer |

---

## Phase 1 — in scope

1. First-class Draw & Fixtures route + hub nav + setup step rename.
2. Category-first landing (0..N collections per category).
3. Chooser: Auto / Manual / Import (stub).
4. Categories: remove generate + fixture UI; CTA **Open Draw & Fixtures** only.
5. Single fixture writer service; Auto wraps existing generate-draw.
6. Manual path creates collection (`manual`) + fixtures via writer.
7. Import = placeholder + documented stub adapter.
8. Comments / `drawKind` semantics; metadata via existing fields + `metaJson` — **no schema migration**.
9. Soften draw-only language in setup copy and type/doc comments.
10. This design document as Architecture v1.0.

## Phase 1 — out of scope

- Excel / CSV / PDF / API import implementation
- Swiss / RR / double-elim generators
- Scoring engine changes
- Tournament lifecycle / product-state lock enforcement
- Schema migrations (table renames, `stageKey` column, cricket `scoring_fixtures` merge)
- Multi-collection polish beyond “structure allows N”
- Removing match-without-fixture compat path
- Visual redesign / mockups
- Full Results layer implementation

### Success criteria

- Organizer can produce fixtures without auto-generating a draw.
- Auto and Manual both yield the same Fixture model via one writer.
- Categories never expose how fixtures are created.
- Scheduling / match create remain fixture-driven.
- A fourth adapter can be added without new downstream pipelines.

---

## Files requiring modification (Phase 1)

| File | Change |
|------|--------|
| `artifacts/auction-platform/src/lib/badminton-setup-workflow.ts` | Rename step to Draw & Fixtures; update description |
| `artifacts/auction-platform/src/lib/badminton-routes.ts` | Hub nav item |
| `artifacts/auction-platform/src/pages/badminton/tournament-hub.tsx` | Checklist wiring |
| `artifacts/auction-platform/src/pages/badminton/categories.tsx` | Strip generate/fixtures; Open Draw & Fixtures CTA |
| **New** Draw & Fixtures page under `pages/badminton/` | Category-first module UI |
| `artifacts/scoring-app/src/App.tsx` (+ auction-platform redirects) | Route mount |
| `artifacts/api-server/src/routes/badminton.ts` | Keep generate-draw; add manual collection/fixture create; import stub |
| **New** fixture writer module under `api-server/src/lib/` | Single insert path |
| `lib/db/src/schema/badminton.ts` | Comments: Fixture Collection semantics |
| `lib/api-base/src/tournament-rules/types.ts` | Soften Draw-Generator-only language |
| `docs/product-state-contract.md` | Align with Fixture Collection terminology (docs only) |

---

## Approach (locked)

**Thin Fixture Source Adapters over existing schema** (Approach 1 + Approach B module boundary).

- No Phase 1 migration.
- `badminton_draws` = Fixture Collection storage.
- `badminton_fixtures` = Fixture storage.
- Sport-agnostic product model; badminton tables are v1 storage.

Rejected for Phase 1: nullable `drawId` migration; merge into cricket `scoring_fixtures`.

---

## Related documents

- `docs/product-state-contract.md` — lifecycle / edit locks (not enforced in Phase 1)
- `lib/api-base/src/tournament-rules/types.ts` — DrawStageKey / format inheritance
- `lib/db/src/schema/badminton.ts` — current badminton tables
