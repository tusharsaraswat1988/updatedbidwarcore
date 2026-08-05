# EPIC-06 — Fixture Foundation

**Date:** 2026-08-05  
**Status:** APPROVED (Modified) — Architecture Frozen · Implemented  
**Depends on:** EPIC-01, EPIC-02, EPIC-03, EPIC-04, EPIC-05  
**Scope:** Platform Fixture Identity — Configuration, Fixture Nodes, Match Blueprints, Advancement Rule Catalog, Lifecycle (separate), Validation, Fixture View, lock-once Configuration History (+ locked node/blueprint structure)  
**Non-goals:** Scheduling, Runtime Match creation, Brackets UI, Standings, Rule Engine, Scoring, Broadcast, Analytics, Swiss/Double-Elimination generators (catalog stubs only)

---

## 1. Objective

Establish **Fixture** as a Platform Identity so Scheduling, Match Creation, Scoring, Standings, and Broadcast consume **Fixture View** — never sport-specific draw/fixture models.

A Fixture determines **what contests must exist**. It owns **Fixture Nodes**; nodes may carry **Match Blueprints**. It does **not** create runtime Matches in this epic.

Architecture correctness takes priority. Reuse before rewrite. No parallel Fixture systems.

---

## 2. Decision record

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| `badminton_draws` / `badminton_fixtures` + Fixture Collection Writer | Production planning (badminton); Architecture Freeze 2026-07-13 |
| Knockout planner / progression / league / promote-to-KO | Badminton generators + advancement wiring |
| `scoring_draws` / `scoring_fixtures` / `scoring_groups` | Cricket scoring-foundation planning |
| Cricket `schedule.ts` (RR / KO / group) | Pure generators (reusable kernel) |
| Scheduling + bulk-from-fixtures / `createMatches` | Execution — **out of scope** |
| EPIC-01…05 product layers | Identity / Config / Lock / View pattern — Fixture not built |
| Format keys (swiss, double elim) | Vocabulary only — no generators |

**Finding:** Two parallel fixture runtimes; mature generators; no Platform Fixture Identity, Fixture Node, Match Blueprint product concept, Advancement Rule catalog, Fixture Lifecycle, Lock History, or Fixture View.

### 2.2 Chosen approach — A (Modified)

**Product Layer + Sport Bridges** (same pattern as EPIC-03 / 04 / 05):

- Fixture Identity / Configuration / Nodes / Blueprints / Advancement / Validation / Lifecycle in `platform-core`
- Bridges map badminton draws/fixtures and cricket draws/fixtures → Fixture View
- **No new Fixture table**
- No dual-write, no data migration this epic
- Freeze once into `fixture_configuration_history` (locked configuration **and** locked node/blueprint structure)

---

## 3. Permanent architecture boundary

```
Product Layer
  Fixture Identity
  Fixture Configuration (Working)
  Locked Fixture Configuration + Node Structure (History)
  Fixture Nodes (structure)
  Match Blueprints (planned contests — not runtime)
  Advancement Rules (catalog)
  Fixture Lifecycle (separate)
  Validation Result
        ↓
==================== Compatibility Boundary ====================
  Sport Bridges
    BadmintonDrawsBridge | CricketDrawsBridge | Future
        ↓
Runtime Layer (unchanged)
  badminton_draws / badminton_fixtures
  scoring_draws / scoring_fixtures / scoring_groups
  (scheduling / scoring_matches — consumers, not owned here)
```

**Permanent rules:**

1. Nothing below the boundary leaks into public product APIs.
2. Nothing above depends on runtime storage shapes.
3. Public APIs: Identity, Configuration, Nodes, Advancement, Validation, History.
4. Bridges expose Fixture View only.
5. Generators are runtime/bridge concerns — never exposed as platform APIs.

### 3.1 Ownership chain (never violate)

```
Tournament
  → Competition
      → Teams / Participants
          → Fixture                    (planned competitive structure)
              → Fixture Node           (position in structure)
                  → Match Blueprint    (planned contest — optional per node)
                      → Runtime Match  (later epics / execution — not this epic)
```

### 3.2 Identity independence (critical)

A Fixture exists independently of:

- Matches
- Scheduling
- Courts
- Time Slots
- Results

Changing any of those must **never** change Fixture Identity.

Fixture Identity represents **the planned competitive structure** — not its execution.

---

## 4. Product terminology

| Product name | Meaning | Forbidden |
|--------------|---------|-----------|
| Fixture Identity | Stable platform identity for planned structure | Badminton Draw, Cricket Draw, Schedule |
| Fixture Configuration | Editable working config | Court, date, time, officials, matches |
| Fixture Node | Position in competition structure | Runtime match, bracket UI widget |
| Match Blueprint | Planned contest definition | Runtime Match, `scoring_matches` row |
| Advancement Rule | Catalog-driven progression policy | Hardcoded winner/loser in generators |
| Locked Configuration | Immutable history version | Schedules, results, standings |
| Fixture View | Modular public contract | Giant fixture blob, runtime tables |

---

## 5. Fixture Identity

Fixture is **not** Schedule, Match, Bracket UI, Score, Standing, or Broadcast.

Fixture defines **which contests should exist**.

**Type catalog** (no sport-specific inheritance):

| id | Display | Notes |
|----|---------|-------|
| `league` | League | |
| `knockout` | Knockout | |
| `round_robin` | Round Robin | |
| `group` | Group | |
| `swiss` | Swiss | Future generator |
| `double_elimination` | Double Elimination | Future generator |
| `custom` | Custom | |

---

## 6. Fixture Configuration

Working configuration fields only:

- Fixture Type (`fixtureTypeId`)
- Competition Format
- Number of Rounds
- Legs
- Groups
- Qualification Rules
- Third Place Match
- Placement Matches / Placement Rules
- Custom Settings

**Explicitly excluded from Configuration:**

- Schedule
- Court
- Date
- Time
- Officials
- Matches
- Lifecycle Status (separate module)

Execution belongs later.

---

## 7. Fixture Nodes (first-class)

**Fixture Node is a first-class platform concept** — the structural equivalent of Match Side for Matches.

```
Fixture
  → Fixture Node           (position in competition structure)
       → Match Blueprint   (optional — when the node is a planned contest)
            → Runtime Match  (later — never owned by Fixture)
```

A Fixture **never owns** runtime Matches. It owns Match Blueprints (via nodes). Runtime creates Matches later.

### 7.1 Why Nodes exist

Not every node is a match.

| Example node | Role |
|--------------|------|
| Quarter Final 1 | Contestable position |
| Winner Group A vs Runner-up Group B | Placeholder until sources resolve |
| Semi Final Winner | Structural / advancement slot |
| BYE | Structural placeholder |
| Qualifier | Structural |
| Playoff Slot | Structural |
| Third Place Slot | Contestable when configured |

A **Fixture Node** represents a **position in the competition structure**.

- Some nodes eventually carry **Match Blueprints**
- Some remain structural placeholders until earlier rounds finish

This abstraction supports Knockout, Double Elimination, Swiss, League + Knockout hybrids, and IPL-style playoffs **without** changing platform architecture.

### 7.2 Node properties (product)

- Stable node identity within the Fixture
- Round / stage label (product language)
- Slot / position
- Node kind (catalog-driven: e.g. `contest`, `bye`, `placeholder`, `qualifier`)
- Optional Match Blueprint reference
- Advancement references (catalog rule ids + target node ids)

Nodes are **not** runtime matches and **not** schedule entries.

---

## 8. Match Blueprint (first-class product concept)

**Match Blueprint is a first-class product concept.**

- Not a database table
- Not runtime
- Not Match Identity

Blueprint contains:

- Sides (planned side slots — references Team / Participant / TBD placeholders)
- Rule Profile reference
- Presentation Profile reference
- Expected Outcome
- Advancement reference (catalog rule + target nodes)

**Nothing execution-specific:** no court, time, score, officials assignment, or live state.

**Future:** Match Identity (EPIC-05) consumes Blueprint when runtime Matches are created.

---

## 9. Advancement Rules (catalog-driven)

Advancement Rules belong to **Catalogs** — exactly like Rule Profiles.

Generators **consume** catalog rules. Generators must **not** embed:

- Winner Advances
- Loser Advances
- Group Winner
- Best Runner Up

as hardcoded platform logic.

**Catalog support (initial):**

| id | Display |
|----|---------|
| `winner_advances` | Winner Advances |
| `loser_advances` | Loser Advances |
| `points_table` | Points Table |
| `group_qualification` | Group Qualification |
| `best_performer` | Best Performer |
| `manual` | Manual |
| `future` | Future / reserved |

No hardcoded tournament logic in the product layer.

---

## 10. Fixture Lifecycle (separate module)

```
Draft → Generated → Validated → Locked → Ready → Completed → Archived
```

| State | Meaning |
|-------|---------|
| Draft | Identity/config may exist; structure not materialized |
| Generated | **Structure exists** (nodes / blueprints produced) |
| Validated | Validation passed against Competition / Teams / Rules |
| Locked | Configuration (+ node/blueprint structure) frozen to history |
| Ready | **Execution may consume** Fixture View |
| Completed | Planned structure fully consumed / finished |
| Archived | Terminal |

**Keep Generated and Ready distinct.**

- Independent of Tournament, Competition, Match, Scheduling lifecycles
- Never stored inside Fixture Configuration product view

---

## 11. Validation

Validate:

- Competition compatibility
- **Competition State** before Fixture Ready (reference EPIC-03 — Competition must be Ready / locked; **do not duplicate** Competition logic)
- Team count / Team availability
- Participant count (where applicable)
- Qualification rules consistency
- Competition format consistency
- Rule Profile compatibility (refs)

**Do not validate:**

- Scheduling
- Scoring
- Standings
- Court / time assignment

---

## 12. Fixture View (modular)

Never one giant Fixture object. Separate:

1. Identity  
2. Configuration  
3. Nodes  
4. Advancement  
5. Validation  
6. History  

Maintain platform consistency with Team View / Match View.

Never expose runtime generators or storage shapes.

---

## 13. Lock pattern

Exactly EPIC-03 / 04 / 05:

```
Working Fixture Configuration
  → Validation
  → Lock
  → Fixture Configuration History
  → Execution (downstream)
```

No silent updates after lock.

### 13.1 History contents

History stores **only**:

- Locked Configuration
- Locked Node + Match Blueprint structure

History must **never** store:

- Schedules
- Runtime Matches
- Results
- Standings

Execution belongs elsewhere.

---

## 14. Storage

### 14.1 Working — bridges over existing runtimes (additive only if required)

**No new Fixture table.**

Working product fields map through bridges onto existing storage where needed (additive nullable columns only if a platform field cannot be derived):

| Runtime | Bridge |
|---------|--------|
| `badminton_draws` + `badminton_fixtures` | BadmintonDrawsBridge |
| `scoring_draws` + `scoring_fixtures` (+ groups) | CricketDrawsBridge |

Reuse existing draw/fixture rows as the persistence behind Nodes/Blueprints views. Do not rename tables this epic.

### 14.2 History

`fixture_configuration_history` — append-only locked configurations **including** locked node/blueprint structure (Version 1 this epic).

---

## 15. Bridges

| Bridge | Source | Exposes |
|--------|--------|---------|
| BadmintonDrawsBridge | `badminton_draws` / `badminton_fixtures` (+ related) | Fixture Identity, Configuration, Nodes, Blueprints |
| CricketDrawsBridge | `scoring_draws` / `scoring_fixtures` / `scoring_groups` | Same Fixture View contracts |
| Future | Other sports | Same Fixture View contracts |

Bridges must expose **Fixture View only**. Never runtime entities, generator internals, or schedule/match rows.

Existing generators remain behind bridges:

- `planKnockoutBracket`, league planners, Fixture Collection Writer
- Cricket `schedule.ts` + `generateScoringDraw`

Refactor only as needed so generators **consume Advancement Rule catalogs** rather than embedding winner/loser/group logic as platform truth.

---

## 16. APIs

Aggregate root — product naming, no technical leakage:

```
GET    /tournaments/:id/fixtures
GET    /tournaments/:id/fixtures/:fixtureId/identity
GET    /tournaments/:id/fixtures/:fixtureId/configuration
PATCH  /tournaments/:id/fixtures/:fixtureId/configuration
GET    /tournaments/:id/fixtures/:fixtureId/nodes
GET    /tournaments/:id/fixtures/:fixtureId/advancement
GET    /tournaments/:id/fixtures/:fixtureId/validation
GET    /tournaments/:id/fixtures/:fixtureId/history
GET    /tournaments/:id/fixtures/:fixtureId/lifecycle
POST   /tournaments/:id/fixtures/:fixtureId/ready
```

`POST .../ready` = Lock Fixture Setup (validation → freeze configuration + node/blueprint structure → history → Ready).

Existing `/badminton/*` draw/fixture routes and `/scoring-foundation/*` draw routes remain **runtime** surfaces — not Fixture View.

---

## 17. UI

- Extend Tournament Setup with **Fixture Setup**
- One job = one screen
- No scheduling UI
- No scoring UI
- No bracket editor
- No match editor

---

## 18. Migration

None this epic.

- Bridge Badminton Draws / Fixtures
- Bridge Cricket Draws / Fixtures
- Bridge existing generators
- No runtime rewrite
- No data migration

---

## 19. Testing

- Fixture Identity independent of matches / schedule / courts / time / results
- Configuration excludes execution fields
- Fixture Node ≠ Match Blueprint ≠ Runtime Match
- Match Blueprint has no execution fields
- Advancement Rules from catalog (generators consume, do not define platform rules)
- Lifecycle: Generated ≠ Ready; Archive path
- Validation references Competition State (EPIC-03) without duplicating it
- Lock-once history includes config + node/blueprint structure only
- Bridge never leaks runtime
- Cricket / Badminton regression (existing draw/fixture APIs still work)

---

## 20. Explicitly forbidden

- New Fixture table
- Runtime Match ownership by Fixture
- Scheduling inside Fixture
- Standings inside Fixture
- Generator-specific platform logic (advancement hardcoded in product layer)
- Runtime leakage into Fixture View
- Sport-specific Fixture inheritance models
- Elevating cricket or badminton draw tables to Platform Fixture Identity
- One giant Fixture response blob
- Silent edits after lock

---

## 21. Success criteria

At the end of EPIC-06, BidWar has **Platform Fixture Identity**.

Scheduling, Match Creation, Scoring, Standings, and Broadcast consume **Fixture View**.

No downstream module creates another Fixture identity.

---

## 22. Files expected (implementation phase — not this approval)

Indicative only; exact paths set during implementation planning:

**Likely added**

- `lib/platform-core/src/fixture/*` (types, configuration, lifecycle, validation, plan/view)
- `lib/platform-core/src/catalog/fixture-types/*`
- `lib/platform-core/src/catalog/advancement-rules/*`
- `lib/db/src/schema/fixture-configuration-history.ts`
- `artifacts/api-server/src/lib/fixture-service.ts`
- `artifacts/api-server/src/routes/fixture-foundation.ts`
- `artifacts/auction-platform/src/components/tournament-hub/fixture-setup-card.tsx`
- Tests under `platform-core` and `api-server`

**Likely modified**

- `lib/platform-core/src/index.ts`, catalog registry
- `lib/db/src/schema/index.ts`, `ensure-schema.ts`
- Tournament hub pages (Fixture Setup entry)
- Route index registration
- Minimal bridge adapters over existing badminton / cricket services

**Removed**

- None (no parallel system deletion this epic)

---

## 23. Architecture compliance

| Constraint | Compliance |
|------------|------------|
| Platform Constitution / multi-sport identity | Fixture is platform identity; sports via bridges |
| Draw & Fixtures Architecture Freeze | Planning layer preserved; Collection/Fixture map to Fixture/Nodes |
| EPIC-01 Catalog | Fixture Type + Advancement catalogs |
| EPIC-02 Rule Profiles | Blueprint holds Rule Profile ref only |
| EPIC-03 Competition | Validation references Competition State; no duplicate |
| EPIC-04 Teams | Blueprint sides reference Teams/Participants |
| EPIC-05 Match | Runtime Match consumes Blueprint later; Fixture ≠ Match |
| No new Fixture table | Affirmed |
| No scheduling / match creation | Affirmed non-goals |
