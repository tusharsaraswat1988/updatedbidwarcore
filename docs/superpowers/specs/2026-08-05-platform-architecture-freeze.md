# BidWar Platform Architecture Freeze

**Date:** 2026-08-05  
**Status:** CONSTITUTIONAL — Frozen after EPIC-01 through EPIC-08  
**Scope:** Binding summary of Platform Product Architecture established by EPIC-01…08  
**Authority:** This document is the constitutional reference for every future EPIC. Individual epic designs refine delivery under these laws; they must not redefine them.  
**Precedents:** EPIC-01…08 design specs under `docs/superpowers/specs/`; multi-sport contract in Cricket Platform Master Plan §40

---

## 1. Purpose

BidWar is a **multi-sport platform**. Cricket and Badminton are sport adapters — not separate products with separate identities.

EPIC-01 through EPIC-08 established:

- Platform identities and views
- Catalog-owned definitions
- A planning → freeze → execution pipeline
- Sport Bridges over existing runtimes (no parallel systems)

This freeze exists so EPIC-09 (Rule Engine) and all later work cannot reintroduce architectural drift: second identities, sport-owned platform concepts, dual lifecycles, or runtime leakage into product APIs.

**Architecture correctness takes priority over implementation speed.**

---

## 2. Permanent topology

```
Product Layer
  Catalogs · Identities · Configurations · Views
  Validation · Lifecycles · Execution Contract · History
        ↓
==================== Compatibility Boundary ====================
  (product APIs never leak runtime shapes)
        ↓
Sport Bridges
  Map runtime rows ↔ Product Views
  Materialize contracts · Never own platform identity
        ↓
Runtime Layer
  scoring_matches · badminton_* · scoring_* · auction teams
  Scoring engines · Broadcast · Stats · Sessions · Events
```

**Permanent rules:**

1. Nothing below the Compatibility Boundary leaks into public product APIs.
2. Nothing above the boundary depends on sport runtime storage shapes.
3. Bridges expose **Product Views only**.
4. No second identity for any platform concept already defined.
5. No sport-inherited platform identity (`CricketX`, `BadmintonX` as platform types).

---

## 3. Ownership hierarchy (never violate)

```
Tournament                          (EPIC-01)
  → Catalog bindings                (Sport, Variant, Competition Type,
                                     Rule Profile ref, Presentation Profile ref)
  → Competition                     (EPIC-03)
      → Participant (view)
          → Registration (event)
              → Team Formation (strategy config)
                  → Team                        (EPIC-04)
                      → Fixture                 (EPIC-06)
                          → Fixture Node
                              → Match Blueprint
                                  → Scheduling Plan     (EPIC-07)
                                      → Schedule Slot
                                          → Resource Assignment
                                              → Match Identity      (EPIC-05)
                                                  + Execution Contract
                                                    (Runtime Match View)  (EPIC-08)
                                                      → Scoring / Broadcast /
                                                        Stats / Streaming /
                                                        Analytics / AI
                                                        (consumers — later epics)
```

### 3.1 Hierarchy laws

| Law | Meaning |
|-----|---------|
| Parent owns identity scope | Child cannot invent a parallel parent identity |
| Downstream consumes Views | Scoring never creates Match Identity; Broadcast never creates Runtime Match |
| Planning ≠ Execution | Fixture / Scheduling plan contests; Runtime freezes execution |
| Identity ≠ relationships | Team ≠ members; Match ≠ sides; Fixture ≠ schedules |
| Catalogs define vocabulary | Roles, types, strategies, profiles come from catalogs |

---

## 4. Identity map

| Identity | Epic | What it is | What it is NOT | Storage stance |
|----------|------|------------|----------------|----------------|
| **Tournament** | 01 | Organizer competition container + catalog bindings | Rule Engine, Presentation Engine | `tournaments` (+ binding columns) |
| **Rule Profile** | 02 | Product definition of gameplay policy (id + version) | Scoring reducer, runtime rule JSON | Catalog (no Rule Profile table in EPIC-02) |
| **Presentation Profile** | 01/02 | Visual / broadcast pack definition (ref) | Live OBS/SSE state | Catalog |
| **Competition** | 03 | Competition Configuration / Plan for a Tournament | Fixture, Auction, Match | Working on Tournament; history table |
| **Participant** | 03 | Platform participant **view** | DB table, raw registration row | View via bridges |
| **Team** | 04 | Platform team identity | Auction franchise, Match squad | Reuse `teams` + history; no new Team table |
| **Match** | 05 | Sole playable contest identity | Fixture, Schedule, Score, Broadcast | Reuse `scoring_matches`; no new Match table |
| **Fixture** | 06 | Planned competitive structure | Schedule, Runtime Match, Bracket UI | Bridges over draws/fixtures; no new Fixture table |
| **Match Blueprint** | 06 | Planned contest on a Fixture Node | Runtime Match | Product concept on nodes |
| **Scheduling Plan** | 07 | Execution planning identity (1:1 with Fixture) | Calendar, Court ownership, Match | Bridges; no new Scheduling table |
| **Schedule Slot** | 07 | Execution opportunity | Match, Court, Venue | Bridged structure |
| **Resource Assignment** | 07 | Slot → Resource binding | Resource Management CRUD | Bridged structure |
| **Runtime Match** | 08 | **Execution contract view** of Match Identity | Second Match identity, Scoring, Broadcast | Same Match id; history table only |

### 4.1 Critical identity freeze (EPIC-08)

```
Runtime Match View = Match Identity (EPIC-05) + Execution Contract (EPIC-08)
```

- There is **exactly one** Match Identity.
- Runtime Match does **not** introduce another Match.
- Identity never changes. Execution Contract changes only through execution (new snapshot versions, phase transitions, history).

### 4.2 Identity independence

Changing relationships must **never** change identity:

| Identity | Independent of |
|----------|----------------|
| Team | Members, captain, roster |
| Match | Sides, schedule, venue, officials |
| Fixture | Matches, courts, time slots, results |
| Scheduling Plan | Matches, resources, dates, conflicts |
| Runtime Snapshot | Live score, clock, broadcast state |

---

## 5. Planning pipeline

Planning answers **what contests should exist** and **when/where they may execute** — not execution itself.

```
Tournament bindings (EPIC-01)
        ↓
Competition Setup → Lock → Competition Plan (EPIC-03)
        ↓
Team Setup → Lock → Team Configuration History (EPIC-04)
        ↓
Fixture Setup → Lock → Fixture Configuration + Node/Blueprint structure (EPIC-06)
        ↓
Scheduling Setup → Lock → Scheduling Configuration + Slot/Assignment structure (EPIC-07)
        ↓
Match Setup → Lock → Match Configuration History (EPIC-05)
        ↓
(Runtime Preparation begins — Execution pipeline)
```

### 5.1 Planning ownership

| Layer | Owns | Explicitly does NOT own |
|-------|------|-------------------------|
| **Competition** | Registration mode, formation strategy, squad rules, Participants view, Plan | Teams creation, Fixtures, Matches, Auction execution |
| **Team** | Team Identity, Configuration, Members view, Roles/Types catalogs | Auction bidding, Fixtures, Match squads, Standings |
| **Fixture** | Structure, Nodes, Match Blueprints, Advancement catalog, Fixture Lifecycle | Courts, times, Runtime Matches, Standings, Bracket UI product |
| **Scheduling** | Plan, Slots, Resource Assignments, Strategy catalog (reference), Scheduling Lifecycle | Runtime Match create, Resource Management CRUD, algorithms in platform-core |
| **Match (config)** | Match Identity, Configuration, Sides, Officials, Match Lifecycle | Scoring, Scoreboards, Broadcast, Fixture engine, Schedule engine |

### 5.2 Planning outputs consumed downstream

| Producer | Consumer input |
|----------|----------------|
| Competition Plan | Team / Fixture / Match validation (Ready checks) |
| Fixture View (Nodes + Blueprints) | Scheduling slots; Runtime Snapshot refs |
| Scheduling View (Slots + Assignments) | Runtime Snapshot refs; calendar/broadcast planning (later) |
| Locked Match Configuration | Runtime Snapshot match-config version |

---

## 6. Execution pipeline

Execution answers **what frozen contract runs** — not how scoring or broadcast works.

```
Planning (locked versions)
        ↓
Runtime Validation
  (Competition / Fixture / Scheduling Ready,
   Locked configs & profiles, Snapshot completeness)
        ↓
Freeze Runtime Snapshot          (immutable, self-describing)
        ↓
Runtime Context                  (resolved bindings — constant for snapshot)
        ↓
Execution Phase                  (linear; subordinate to Match Lifecycle)
        ↓
Match Lifecycle transitions      (EPIC-05 authority only — requested, not forked)
        ↓
Runtime History                  (append-only audit)
        ↓
Consumers read Runtime Match View
  Scoring · Broadcast · Statistics · Streaming · Analytics · AI · Highlights
```

### 6.1 Execution ownership

| Layer | Owns | Explicitly does NOT own |
|-------|------|-------------------------|
| **Runtime Match (EPIC-08)** | Snapshot (refs + frozen versions), Context (bindings), Execution Phase, Runtime Validation, Runtime History, Prepare/Ready orchestration | Scores, events, clocks, timers, statistics, broadcast state, second Match identity, Match Lifecycle authority |
| **Match Lifecycle (EPIC-05)** | Sole lifecycle authority for the playable contest | Execution Phase details, scoring status |
| **Scoring (future / existing runtime)** | Events, projections, score state, scorer sessions | Match Identity, Runtime Snapshot |
| **Broadcast (future / existing runtime)** | Presentation fan-out, SSE, OBS | Match Identity, Runtime Snapshot ownership |

### 6.2 Execution Phase vs Match Lifecycle

| Concept | Owner | Example states |
|---------|-------|----------------|
| **Match Lifecycle** | EPIC-05 only | Draft → Scheduled → Ready → Locked → Live → Completed → Verified → Archived |
| **Execution Phase** | EPIC-08 (subordinate, linear) | Preparing → Resources Ready → Officials Ready → Participants Ready → Countdown → Running ↔ Paused → Finished |

**No dual lifecycle.** Runtime requests lifecycle transitions through EPIC-05 authority. Phase never invents a second Match lifecycle.

### 6.3 Runtime Snapshot laws

1. **Immutable** — never recalculated or overwritten after freeze.  
2. **Self-describing** — `snapshotVersion`, `snapshotSchemaVersion`, `createdAt`, `createdBy`.  
3. **References only** — frozen version ids; never product configuration copies.  
4. **No “latest”** — every ref must remain resolvable after configuration evolves.  
5. **New freeze = new version** if planning changes after a prior freeze.

### 6.4 Runtime Context laws

- Contains resolved bindings (Rule, Presentation, Scheduling, Resource Assignment) + execution metadata.  
- Does **not** contain score, overs/rally, clock/timer, statistics, broadcast state, player positions.  
- Bindings remain constant for a given frozen snapshot.  
- Progress belongs to Execution Phase — not Context.

---

## 7. Bridge pattern

### 7.1 Pattern

```
Product View  ←── Bridge ──→  Existing runtime storage
```

Approved stance across EPIC-02…08:

- **Reuse** existing runtime tables  
- **Extend** with additive columns / history tables when required  
- **Bridge** sport-specific shapes into platform views  
- **Rewrite** only when impossible (not the default)

### 7.2 Bridge duties

| Must | Must not |
|------|----------|
| Map runtime → Product View | Expose runtime table shapes in public APIs |
| Materialize Execution Contract (EPIC-08) | Become lifecycle owners |
| Keep sport engines running | Create parallel identity tables |
| Stay replaceable per sport | Leak scoring/broadcast DTOs into product routes |

### 7.3 Named bridge families (illustrative)

| Domain | Bridges |
|--------|---------|
| Rules (temporary adapters) | Badminton / Cricket / Football RuntimeAdapters → `ResolvedRuleSnapshot` |
| Competition / Participants | AuctionPlayersBridge, BadmintonRegistrationsBridge |
| Teams | AuctionTeamsBridge, MasterTeamsBridge |
| Match | ScoringMatchesBridge (+ side/official mapping) |
| Fixture | BadmintonDrawsBridge, CricketDrawsBridge |
| Scheduling | BadmintonSchedulingBridge, CricketSchedulingBridge |
| Runtime Match | BadmintonRuntimeBridge, CricketRuntimeBridge |

Future sports add bridges — not new platform identity models.

---

## 8. Working → Validation → Lock → History pattern

Universal freeze pattern for product configuration layers:

```
Working Configuration (editable)
        ↓
Validation  (Blocking / Warning / Information — shared ValidationIssue model)
        ↓
Lock (once per epic rules; no silent re-freeze unless epic explicitly allows new versions)
        ↓
History (append-only immutable payload)
        ↓
Downstream execution reads locked versions — never re-resolves “current” planning
```

### 8.1 Where it applies

| Layer | Working | History |
|-------|---------|---------|
| Competition | On Tournament | `competition_configuration_history` |
| Team | On `teams` (+ additive fields) | `team_configuration_history` |
| Match | On `scoring_matches` (+ additive fields) | `match_configuration_history` |
| Fixture | Bridged draws (+ additive fields) | `fixture_configuration_history` |
| Scheduling | Bridged draws (+ additive fields) | `scheduling_configuration_history` |
| Runtime Snapshot | Minimal pointers on `scoring_matches` | `runtime_match_history` (snapshots + phase/audit) |

### 8.2 Validation philosophy

- Reuse the shared **ValidationIssue** severity model: `ERROR` (blocking), `WARNING`, `INFO`.  
- Do **not** invent parallel validation response formats per epic.  
- Upstream Ready checks are **referenced**, not reimplemented (e.g. Runtime validates Competition Ready by consulting Competition state — it does not own Competition).

### 8.3 History philosophy

History stores **locked product/execution-contract data only** for its layer:

| History may store | History must never store |
|-------------------|--------------------------|
| Locked configuration | Scores / scoring events |
| Locked structure (nodes, slots, assignments) | Broadcast state |
| Snapshot refs + versions | Statistics |
| Phase / operator / validation audit (Runtime) | Commentary |

---

## 9. Catalog philosophy

### 9.1 CatalogRegistry is the sole gateway

Location: `lib/platform-core/src/catalog/`

- All reads go through **`CatalogRegistry`**.  
- Components and public APIs must **never** import sport pack files directly.  
- Catalog entries are **product assets** (id, version, displayName, status, compatibility), not bare arrays.

### 9.2 What catalogs own

| Catalog family | Examples | Owns | Does not own |
|----------------|----------|------|--------------|
| Sport / Variant / Competition Type | cricket, badminton, league… | Creation vocabulary | Runtime engines |
| Rule Profiles / Definitions | gameplay policy | Product rule definitions | Scoring reducers (until Rule Engine cutover) |
| Presentation Profiles | broadcast packs | Visual policy refs | Live broadcast |
| Registration / Formation | modes, strategies | Competition config options | Registration runtime rows |
| Team Roles / Types | captain, franchise… | Membership vocabulary | Assignment engines |
| Match Types / Roles | league, umpire… | Match vocabulary | Scoring |
| Fixture Types / Node Kinds / Advancement | knockout, bye, winner… | Structure vocabulary | Generators in platform-core |
| Resource Kinds / Scheduling Strategies | court, sequential… | Planning vocabulary | Scheduling algorithms |

### 9.3 Catalog laws

1. **Reference, don’t copy** — Tournament and Snapshots bind by id + version.  
2. **Compatibility is validated** — sport / variant / competition constraints live in the registry.  
3. **Strategies ≠ algorithms** — strategy catalog ids are policy labels; algorithms stay behind Sport Bridges.  
4. **Deprecation is first-class** — `default` | `beta` | `deprecated`; legacy resolution must never leave engines with null bindings.  
5. **Future Rule Engine** must accept the same product resolve contracts (`ResolvedRuleSnapshot` / ResolveResult) without changing organizer selection UX.

---

## 10. Layer ownership matrix (owns / does not own)

| Layer | Owns | Explicitly does NOT own |
|-------|------|-------------------------|
| **EPIC-01 Tournament** | Sport/variant/competition/profile bindings; creation wizard | Rule Engine execution, Presentation Engine, Auction/Fixture wizards |
| **EPIC-02 Rule Profiles** | Typed product rule definitions; resolver contracts; catalog bodies | Scoring engine cutover, Match snapshot persistence, Rule Builder UI |
| **EPIC-03 Competition** | Competition Configuration/Plan; Participants view; registration/formation **config** | Team creation, Fixtures, Matches, Auction runtime rewrite |
| **EPIC-04 Team** | Team Identity/Config/Members/Roles; Team Lifecycle; Team View | Auction execution, Fixtures, Matches, Standings, roster history product |
| **EPIC-05 Match** | Match Identity/Config/Sides/Officials; Match Lifecycle; Match View | Scoring, Broadcast, Fixtures, Scheduling engine |
| **EPIC-06 Fixture** | Fixture Identity/Nodes/Blueprints/Advancement; Fixture Lifecycle; Fixture View | Scheduling, Runtime Match create, Standings, generators as platform APIs |
| **EPIC-07 Scheduling** | Scheduling Plan/Slots/Assignments; Strategy & Resource catalogs (reference); Scheduling View | Runtime Match create, Resource Management CRUD, algorithms in platform-core |
| **EPIC-08 Runtime Match** | Execution Contract (Snapshot/Context/Phase/History); Runtime Match View; Prepare/Ready | Second Match identity, Match Lifecycle authority, Scoring, Broadcast, Statistics |
| **Sport Runtimes** | Engines, events, projections, sport tables, create paths | Platform identity definitions, Product View contracts |
| **Downstream consumers** | Consume Runtime Match View + domain engines | Creating Match / Runtime / Fixture / Scheduling identities |

---

## 11. Modular View law

Public product APIs expose **modular views**, never giant blobs:

| Domain | View modules (typical) |
|--------|------------------------|
| Competition | Configuration, Participants, Validation, History, Status |
| Team | Identity, Configuration, Members, Validation, History, Lifecycle |
| Match | Identity, Configuration, Sides, Officials, Validation, History, Lifecycle |
| Fixture | Identity, Configuration, Nodes, Advancement, Validation, History, Lifecycle |
| Scheduling | Identity, Configuration, Slots, Resources (assignments), Validation, History, Lifecycle |
| Runtime Match | Identity, Snapshot, Context, Execution Phase, Validation, History |

Downstream systems must be able to execute from **Runtime Match View** without sport-specific product endpoints for the execution contract.

---

## 12. Storage laws

1. **No parallel identity tables** for Tournament/Competition/Team/Match/Fixture/Scheduling/Runtime Match identities already bridged.  
2. **History tables are allowed** — they are not second identities; they are append-only locked versions / audit.  
3. **Additive columns only** when a product field cannot be derived — keep working rows minimal (especially `scoring_matches` for Runtime).  
4. **No data migration epics by default** — bridges map current rows.  
5. **Sport extension tables** (e.g. `badminton_match_details`) remain sport runtime — never promoted to platform identity.

---

## 13. Explicitly forbidden (platform-wide)

| Forbidden | Why |
|-----------|-----|
| Second Match / Runtime Match / Fixture / Scheduling / Team identity | Breaks single-identity constitution |
| Sport-prefixed platform identities (`CricketMatch`, `BadmintonFixture` as product types) | Multi-sport drift |
| Score-owned or Broadcast-owned Match Identity | Wrong aggregate root |
| Dual lifecycle owners for the same entity | Dual truth |
| Snapshot / history storing full product configuration copies | Drift + duplication |
| Mutable “latest” refs in frozen snapshots | Non-resolvable history |
| Runtime leakage into product APIs | Boundary violation |
| Scheduling / Fixture algorithms inside platform-core product layer | Catalog/strategy vs engine confusion |
| Elevating a sport scheduler/scorer to Platform Identity | Adapter vs platform inversion |
| New epic inventing a parallel freeze pattern | Pattern fragmentation |
| Downstream module creating its own execution contract identity | EPIC-08 success criterion violation |

---

## 14. Epic index (frozen foundations)

| Epic | Foundation | Status |
|------|------------|--------|
| **01** | Tournament Creation + Catalog bindings | Implemented |
| **02** | Rule Profile System (product definitions) | Implemented |
| **03** | Registration & Competition | Implemented |
| **04** | Team | Implemented |
| **05** | Match Identity | Implemented |
| **06** | Fixture | Implemented |
| **07** | Scheduling | Implemented |
| **08** | Runtime Match (Execution Contract) | Implemented |
| **09+** | Rule Engine, Scoring productization, Broadcast, Stats, … | Must comply with this freeze |

---

## 15. Compliance checklist for future EPICs

Before approving any future epic design, verify:

- [ ] Does not create a second identity for an existing platform concept  
- [ ] Consumes upstream **Views** (Competition / Team / Fixture / Scheduling / Match / Runtime Match)  
- [ ] Respects Compatibility Boundary (no runtime shapes in product APIs)  
- [ ] Uses CatalogRegistry for vocabulary; no hardcoded role/type enums as platform truth  
- [ ] Uses shared ValidationIssue severities  
- [ ] Uses Working → Validation → Lock → History (or explicitly justifies a narrower variant)  
- [ ] Keeps lifecycle authority clear (no dual owners)  
- [ ] Adds sport capability via **bridges/adapters**, not new platform identity models  
- [ ] States non-goals that protect Scoring / Broadcast / Stats ownership boundaries  
- [ ] Prefer reuse → extend → bridge → rewrite only if impossible  

---

## 16. Constitutional line

> **Catalogs define.  
> Identities endure.  
> Planning locks structure.  
> Runtime freezes the execution contract.  
> Engines execute.  
> Bridges adapt sports.  
> No layer steals another layer’s identity.**

This is the BidWar Platform Architecture Freeze after EPIC-01 through EPIC-08.

---

## 17. Related documents

| Document | Role |
|----------|------|
| `docs/superpowers/specs/2026-08-04-tournament-creation-foundation-epic-01-design.md` | EPIC-01 |
| `docs/superpowers/specs/2026-08-04-rule-profile-system-foundation-epic-02-design.md` | EPIC-02 |
| `docs/superpowers/specs/2026-08-05-registration-competition-foundation-epic-03-design.md` | EPIC-03 |
| `docs/superpowers/specs/2026-08-05-team-foundation-epic-04-design.md` | EPIC-04 |
| `docs/superpowers/specs/2026-08-05-match-foundation-epic-05-design.md` | EPIC-05 |
| `docs/superpowers/specs/2026-08-05-fixture-foundation-epic-06-design.md` | EPIC-06 |
| `docs/superpowers/specs/2026-08-05-scheduling-foundation-epic-07-design.md` | EPIC-07 |
| `docs/superpowers/specs/2026-08-05-runtime-match-foundation-epic-08-design.md` | EPIC-08 |
| `docs/cricket-platform-master-plan.md` §40 | Multi-sport adapter contract |

Individual epic specs remain the detailed design record. **On conflict with this freeze about identity, ownership, or boundary, this freeze wins** unless a later Architecture Freeze explicitly supersedes it.
