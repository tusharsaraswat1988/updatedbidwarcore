# EPIC-07 — Scheduling Foundation

**Date:** 2026-08-05  
**Status:** APPROVED (Modified) — Architecture Frozen · Implemented  
**Depends on:** EPIC-01, EPIC-02, EPIC-03, EPIC-04, EPIC-05, EPIC-06  
**Scope:** Platform Scheduling Identity (Scheduling Plan) — Configuration, Schedule Slots, Resource Assignment, Resource Catalog (reference), Strategy Catalog, Lifecycle (separate), Validation, Scheduling View, lock-once Configuration History (+ locked slot + assignment structure)  
**Non-goals:** Runtime Match creation, Scoring, Broadcast, Standings, Analytics, Calendar UI, Resource Management (CRUD product), Match Engine, Scheduling algorithms inside platform-core

---

## 1. Objective

Establish **Scheduling** as the Platform Execution Planning layer so Runtime Match Creation, Resource Allocation, Conflict Detection, Calendar Views, and Broadcast Planning consume **Scheduling View** — never sport-specific scheduler models.

Scheduling determines **when** and **where** a planned contest may execute, and **which resource** is allocated — as a plan, not as execution.

Scheduling consumes:

- Fixture Nodes / Match Blueprints (EPIC-06)
- Competition Configuration (EPIC-03)
- Resource Catalog (reference)

Scheduling produces **Scheduled Match Plans** (Schedule Slots + Resource Assignments bound to Match Blueprints).

Scheduling does **not** create runtime Matches, score, generate standings, or broadcast.

Architecture correctness takes priority. Reuse before rewrite. No parallel Scheduling systems.

---

## 2. Decision record

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| `fixture-scheduling.ts` + badminton schedule UI | Mature court/time engine on `badminton_fixtures` |
| Court conflict helpers (±45 min) | Badminton-only conflict gate |
| `badminton_courts` | Sport court entities |
| Cricket `distributeMatchDates` + venues | Thin date stamps + `scoring_venues` |
| Scoring-foundation generate (optional matches) | Draw + schedule + match create coupled |
| EPIC-05 Match venue/date/time | Match Configuration fields — not a scheduling engine |
| EPIC-06 Fixture View | Planned structure — forbids court/time |
| Resource Catalog / Scheduling Identity / History | **Missing** |

**Finding:** Two parallel scheduling runtimes; no Platform Scheduling Plan, Schedule Slot, Resource Assignment, Resource/Strategy catalogs, lifecycle, lock history, or Scheduling View.

### 2.2 Chosen approach — A (Modified)

**Product Layer + Sport Bridges** (same pattern as EPIC-03…06):

- Scheduling Identity / Configuration / Slots / Resource Assignments / Validation / Lifecycle in `platform-core`
- Resource Catalog + Scheduling Strategy Catalog in `platform-core` catalogs
- Bridges map badminton fixture schedule fields (+ courts) and cricket fixture/venue schedule fields → Scheduling View
- **No new Scheduling table**
- No dual-write, no data migration this epic
- Freeze once into `scheduling_configuration_history` (locked configuration **and** locked slot + resource assignment structure)
- Scheduling algorithms remain behind Sport Bridges — never in platform-core

---

## 3. Permanent architecture boundary

```
Product Layer
  Scheduling Identity (Scheduling Plan)
  Scheduling Configuration (Working)
  Locked Scheduling Configuration + Slot + Assignment Structure (History)
  Schedule Slots
  Resource Assignments
  Resource Catalog (reference only)
  Scheduling Strategy Catalog (reference only)
  Scheduling Lifecycle (separate)
  Validation Result
        ↓
==================== Compatibility Boundary ====================
  Sport Bridges
    BadmintonSchedulingBridge | CricketSchedulingBridge | Future
        ↓
Runtime Layer (unchanged)
  badminton_fixtures (court_id, scheduled_at, status)
  badminton_courts
  scoring_fixtures / scoring_venues / scoring_matches.scheduled_at
  (runtime match create / live ops — consumers, not owned here)
```

**Permanent rules:**

1. Nothing below the boundary leaks into public product APIs.
2. Nothing above depends on runtime storage shapes.
3. Public APIs: Identity, Configuration, Slots, Resources (assignments view), Validation, History, Lifecycle.
4. Bridges expose Scheduling View only.
5. Scheduling algorithms are runtime/bridge concerns — never platform-core.

### 3.1 Ownership chain (never violate)

```
Tournament
  → Competition
      → Fixture
          → Fixture Node → Match Blueprint
              → Scheduling Plan              (execution plan)
                  → Schedule Slot            (execution opportunity)
                      → Resource Assignment  (binding to a Resource)
                          → Resource         (catalog / bridged entity)
                      → Match Blueprint      (planned contest)
                          → Runtime Match    (later — not this epic)
```

### 3.2 Identity independence (critical)

A Scheduling Plan exists independently of:

- Matches
- Resources
- Dates
- Time Slots
- Conflicts

Changing any of those must **never** change Scheduling Identity.

Scheduling represents **the execution plan** — not the execution itself.

---

## 4. Product terminology

| Product name | Meaning | Forbidden |
|--------------|---------|-----------|
| Scheduling Identity / Plan | Stable platform identity for execution planning | Badminton Scheduler, Cricket Scheduler, Calendar |
| Scheduling Configuration | Editable working config | Resources, slots, assigned matches, conflicts |
| Schedule Slot | Execution opportunity | Match, Court, Venue, Fixture |
| Resource Assignment | Binding Slot → Resource | Resource ownership, court row |
| Resource | Catalog-driven facility kind (+ bridged instance) | Owned by Scheduling |
| Scheduling Strategy | Catalog-driven planning policy | Algorithm implementation |
| Locked Configuration | Immutable history version | Actual start/end, results, runtime matches |
| Scheduling View | Modular public contract | Giant schedule blob, runtime tables |

---

## 5. Scheduling Identity

Scheduling is **not** Fixture, Match, Venue, Court, Ground, or Calendar.

Scheduling is **Execution Planning**.

One Scheduling Plan manages resource allocation for one Fixture Identity (1:1 with EPIC-06 Fixture). A tournament may have many Scheduling Plans. Product plan ids reuse Fixture Identity encoding (`bd-{id}` / `sd-{id}`) so Fixture Ready maps cleanly — without a Scheduling table.

**Plan kinds** (no sport-specific inheritance) — product labels for configuration/strategy context:

| id | Display |
|----|---------|
| `tournament` | Tournament Scheduling |
| `league` | League Scheduling |
| `knockout` | Knockout Scheduling |
| `practice` | Practice Scheduling |
| `custom` | Custom |

---

## 6. Scheduling Configuration

Working configuration fields only:

- Scheduling Strategy (`strategyId` — catalog)
- Working Days
- Operating Hours
- Buffer Time / Buffer Rules
- Parallel Matches / Parallel Limits
- Court Rotation / Resource Preferences
- Break Rules
- Venue Rules
- Custom Settings

**Explicitly excluded from Configuration:**

- Resources (instances)
- Schedule Slots
- Assigned Matches
- Conflicts
- Lifecycle Status (separate module)

Execution belongs later.

---

## 7. Schedule Slots (first-class)

**Schedule Slot is a first-class platform concept** — an execution opportunity.

```
Scheduling Plan
  → Schedule Slot
       → Resource Assignment → Resource
       → Match Blueprint
            → Runtime Match  (later — never owned by Scheduling)
```

A Schedule Slot is **not** a Match, Court, Venue, or Fixture.

### 7.1 Slot properties (product)

- Stable slot identity within the Scheduling Plan
- Date
- Start Time
- End Time
- Duration
- Availability
- Status (planning status — not runtime match status)
- Optional Match Blueprint reference (from Fixture View)
- Resource Assignments (separate — see §8)

Slots may exist before a Resource is assigned and before a Blueprint is bound.

---

## 8. Resource Assignment (first-class)

**Do not attach Resources directly to Scheduling Plan or treat Resource as a Slot property blob.**

Introduce **Resource Assignment** as a first-class relationship:

```
Scheduling Plan
  → Schedule Slot
       → Resource Assignment
            → Resource
```

Why:

- Keeps the Slot independent
- Later the assignment may change without changing Slot Identity
- Supports re-courting / venue moves as assignment updates, not Slot recreation

Assignment properties (product):

- Assignment identity
- Slot reference
- Resource reference (catalog kind + bridged instance id)
- Optional preference / priority
- Status (planned / confirmed — planning only)

---

## 9. Resource Catalog

Resources are **generic** catalog kinds. Scheduling **references** Resources. Scheduling **never owns** Resources.

| id | Display |
|----|---------|
| `court` | Court |
| `ground` | Ground |
| `arena` | Arena |
| `mat` | Mat |
| `table` | Table |
| `lane` | Lane |
| `track` | Track |
| `virtual` | Virtual |
| `future` | Future / reserved |

Bridges map:

- `badminton_courts` → Resource instances (`court`)
- `scoring_venues` → Resource instances (`ground` / venue-equivalent)

**Resource Management** (organizer CRUD product for facilities) is **out of scope**. Catalog + bridged views only.

---

## 10. Scheduling Strategy Catalog

Strategies belong to **Catalogs**. Schedulers (bridges) **consume** strategies. Strategies **never contain** scheduling algorithms.

| id | Display |
|----|---------|
| `manual` | Manual |
| `sequential` | Sequential |
| `parallel` | Parallel |
| `round_robin_optimized` | Round Robin Optimized |
| `knockout_optimized` | Knockout Optimized |
| `balanced` | Balanced |
| `future` | Future / reserved |

Algorithms remain behind Sport Bridges (`fixture-scheduling.ts`, cricket date helpers, future optimizers).

---

## 11. Scheduling Lifecycle (separate module)

```
Draft → Generated → Validated → Locked → Ready → Executed → Archived
```

| State | Meaning |
|-------|---------|
| Draft | Identity/config may exist; structure not materialized |
| Generated | **Execution structure exists** (slots ± assignments produced) |
| Validated | Validation passed (Competition / Fixture / conflicts) |
| Locked | Configuration (+ slot + assignment structure) frozen to history |
| Ready | **Execution may begin** (downstream may instantiate Matches) |
| Executed | Plan consumed / run through |
| Archived | Terminal |

**Keep Generated and Ready distinct.**

- Independent of Tournament, Competition, Fixture, Match lifecycles
- Never stored inside Scheduling Configuration product view

---

## 12. Validation

Validate:

- **Competition Ready** — reference EPIC-03 (do not duplicate Competition logic)
- **Fixture Ready** — reference EPIC-06 (do not duplicate Fixture logic)
- Match Blueprint integrity (references resolve via Fixture View)
- Resource compatibility (catalog kind + assignment present where required)
- Scheduling conflicts (time / resource / team / participant — via bridge conflict checks; product surfaces Validation Result only)
- Scheduling Rules (config consistency: hours, buffer, parallel limits)

**Do not validate:**

- Runtime match state
- Scoring
- Broadcast
- Actual start/end times

---

## 13. Scheduling View (modular)

Never one giant Scheduling object. Separate:

1. Identity  
2. Configuration  
3. Schedule Slots  
4. Resource Assignments  
5. Validation  
6. History  

(Lifecycle exposed as its own subresource, consistent with Match/Fixture.)

Never expose runtime scheduling tables or algorithms.

---

## 14. Lock pattern

Exactly EPIC-03…06:

```
Working Scheduling Configuration
  → Validation
  → Lock
  → Scheduling Configuration History
  → Execution (downstream)
```

No silent updates after lock.

### 14.1 History contents

History stores **only**:

- Locked Scheduling Configuration
- Locked Slot Structure
- Locked Resource Assignment Structure

History must **never** store:

- Runtime Matches
- Results
- Actual Start Times
- Actual End Times

Execution belongs later.

---

## 15. Storage

### 15.1 Working — bridges over existing runtimes (additive only if required)

**No new Scheduling table.**

Working product fields map through bridges onto existing storage where needed (additive nullable columns only if a platform field cannot be derived):

| Runtime | Bridge |
|---------|--------|
| `badminton_fixtures` (+ `badminton_courts`) | BadmintonSchedulingBridge |
| `scoring_fixtures` / `scoring_venues` (+ match schedule fields as projection only) | CricketSchedulingBridge |

Reuse existing `scheduled_at` / court / venue columns as persistence behind Slots and Resource Assignments. Do not rename tables this epic.

Product Scheduling Plan identity **equals** Fixture Identity (`bd-{id}` / `sd-{id}`). No Scheduling table.

### 15.2 History

`scheduling_configuration_history` — append-only locked configurations **including** locked slot + resource assignment structure (Version 1 this epic). Keyed by product scheduling plan id (no FK to a Scheduling table).

---

## 16. Bridges

| Bridge | Source | Exposes |
|--------|--------|---------|
| BadmintonSchedulingBridge | `badminton_fixtures` schedule fields + `badminton_courts` | Scheduling Identity, Configuration, Slots, Resource Assignments |
| CricketSchedulingBridge | `scoring_fixtures` / `scoring_venues` (+ related) | Same Scheduling View contracts |
| Future | Other sports | Same Scheduling View contracts |

Bridges must expose **Scheduling View only**. Never runtime entities, generator/algorithm internals, or match rows.

Existing engines remain behind bridges:

- `fixture-scheduling.ts`, court conflict helpers
- Cricket `distributeMatchDates` / venue assignment paths

Refactor only as needed so bridges **consume Strategy Catalog** rather than embedding strategy names as platform algorithms.

---

## 17. APIs

Aggregate root — product naming, no technical leakage:

```
GET    /tournaments/:id/scheduling
GET    /tournaments/:id/scheduling/:schedulingId/identity
GET    /tournaments/:id/scheduling/:schedulingId/configuration
PATCH  /tournaments/:id/scheduling/:schedulingId/configuration
GET    /tournaments/:id/scheduling/:schedulingId/slots
GET    /tournaments/:id/scheduling/:schedulingId/resources
GET    /tournaments/:id/scheduling/:schedulingId/validation
GET    /tournaments/:id/scheduling/:schedulingId/history
GET    /tournaments/:id/scheduling/:schedulingId/lifecycle
POST   /tournaments/:id/scheduling/:schedulingId/ready
```

`GET .../resources` returns **Resource Assignments** (and catalog-compatible resource references) — not Resource Management CRUD.

`POST .../ready` = Lock Scheduling Setup (validation → freeze configuration + slot + assignment structure → history → Ready).

Existing `/badminton/*` schedule/court routes and `/scoring-foundation/*` venue/schedule routes remain **runtime** surfaces — not Scheduling View.

---

## 18. UI

- Extend Tournament Setup with **Scheduling Setup**
- One job = one screen
- No live calendar editing
- No scoring UI
- No broadcast UI
- No runtime controls

---

## 19. Migration

None this epic.

- Bridge Badminton scheduling
- Bridge Cricket scheduling
- Bridge court / venue as Resources
- Bridge existing generators / conflict helpers
- No runtime rewrite
- No data migration

---

## 20. Testing

- Scheduling Identity independent of matches / resources / dates / slots / conflicts
- Configuration excludes resources, slots, assigned matches, conflicts
- Schedule Slot ≠ Match ≠ Court ≠ Fixture
- Resource Assignment independent of Slot Identity
- Strategies from catalog; algorithms not in platform-core
- Lifecycle: Generated ≠ Ready
- Validation references Competition Ready (EPIC-03) and Fixture Ready (EPIC-06) without duplicating them
- Lock-once history includes config + slots + assignments only
- Bridge never leaks runtime
- Cricket / Badminton regression (existing schedule/court/venue APIs still work)

---

## 21. Explicitly forbidden

- New Scheduling table
- Runtime Match ownership by Scheduling
- Resource ownership by Scheduling
- Calendar ownership
- Scheduling algorithms in platform-core
- Runtime leakage into Scheduling View
- Sport-specific Scheduling inheritance models
- Elevating badminton or cricket schedulers to Platform Scheduling Identity
- Attaching Resources directly to Plan without Resource Assignment
- One giant Scheduling response blob
- Silent edits after lock

---

## 22. Success criteria

At the end of EPIC-07, BidWar has **Platform Scheduling Foundation**.

Runtime Match Creation, Resource Allocation, Conflict Detection, Calendar Views, and Broadcast Planning consume **Scheduling View**.

No downstream module creates another Scheduling identity.

---

## 23. Files expected (implementation phase — not this approval)

Indicative only; exact paths set during implementation planning:

**Likely added**

- `lib/platform-core/src/scheduling/*` (types, configuration, lifecycle, validation, plan/view, bridges)
- `lib/platform-core/src/catalog/resource-kinds/*`
- `lib/platform-core/src/catalog/scheduling-strategies/*`
- `lib/db/src/schema/scheduling-configuration-history.ts`
- `artifacts/api-server/src/lib/scheduling-service.ts`
- `artifacts/api-server/src/routes/scheduling-foundation.ts`
- `artifacts/auction-platform/src/components/tournament-hub/scheduling-setup-card.tsx`
- Tests under `platform-core` and `api-server`

**Likely modified**

- `lib/platform-core/src/index.ts`, catalog registry, package exports
- `lib/db/src/schema/index.ts`, `ensure-schema.ts`
- Tournament hub pages (Scheduling Setup entry)
- Route index + catalog routes
- Minimal additive columns on badminton/scoring runtime rows if required for lock/lifecycle

**Removed**

- None (no parallel system deletion this epic)

---

## 24. Architecture compliance

| Constraint | Compliance |
|------------|------------|
| Platform Constitution / multi-sport identity | Scheduling is platform identity; sports via bridges |
| Draw & Fixtures Architecture Freeze | Scheduling layer after Fixtures; before Matches |
| EPIC-01 Catalog | Resource kinds + Strategies as catalogs |
| EPIC-02 Rule Profiles | Not owned; Blueprint refs remain Fixture/Match concern |
| EPIC-03 Competition | Validation references Competition Ready; no duplicate |
| EPIC-04 Teams | Team conflict checks reference Team View; no ownership |
| EPIC-05 Match | Runtime Match consumes Scheduled Match Plan later; Scheduling ≠ Match |
| EPIC-06 Fixture | Consumes Fixture Ready / Nodes / Blueprints; no court/time on Fixture |
| No new Scheduling table | Affirmed |
| No algorithms in platform-core | Affirmed |
| No calendar / resource management / match create | Affirmed non-goals |
