# EPIC-03 — Registration & Competition Foundation

**Date:** 2026-08-05  
**Status:** APPROVED — Architecture Frozen  
**Depends on:** EPIC-01 (Tournament Creation Foundation), EPIC-02 (Rule Profile System Foundation)  
**Scope:** Competition identity — Configuration, Plan, Participants (views), Registration modes, Team Formation strategy (config only), Squad Rules, Validation, Transition Rules, lock-once freeze  
**Non-goals:** See §Guardrail 3 (Out of Scope)

---

## 1. Objective

Establish **Competition Identity** so every Tournament produces a clear Competition Configuration / Competition Plan that downstream modules consume — without guessing registration, team formation, or squad decisions.

At the end of this epic:

- Every tournament has a Working **Competition Configuration** (editable, on Tournament)
- Organizer can **Lock Competition Setup** exactly once → Version 1 in history (**Competition Plan**)
- Platform APIs expose **Participants** via Sport Bridges — never runtime table shapes
- Existing cricket/auction and badminton registration continue unchanged
- Fixtures, matches, auctions, and scheduling remain out of scope

Architecture correctness takes priority over implementation speed. Reuse before rewrite.

---

## 2. Decision record (audit → approach)

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| EPIC-01 `competitionTypeId` + CatalogRegistry | Competition type identity; no registration runtime |
| EPIC-02 Rule Profiles + RuleResolver | Gameplay policy; no registration / team formation |
| Auction/cricket `players` + `teams` | Live registration runtime (auction-flavored) |
| Badminton `badminton_registrations` | Live entry registration (closest Participant pattern) |
| `product-state-contract.md` | Sole Tournament platform lifecycle (unenforced) |
| Competition / Participant / Team Formation Blueprint | Design only (master plan) — not implemented |

**Finding:** Two incompatible registration runtimes; no platform Participant; `competitionTypeId` unused by registration; no Competition Plan. EPIC-03 adds the Product Layer without replacing runtimes.

### 2.2 Chosen approach — A (Modified)

**Product Layer + Sport Bridges** (same pattern as EPIC-02):

- Competition Configuration / Plan in platform-core
- Participant is a **platform view**, not a database table
- Sport Bridges map `players` / `badminton_registrations` → Participant View
- No new participants table, no dual-write, no data migration
- Freeze once into `competition_configuration_history` (or `_versions`)

---

## 3. Permanent architecture boundary

```
Product Layer
  Competition Configuration (Working — on Tournament)
  Competition Plan (Locked — history)
  Participant (platform identity / view)
  Registration (event + status — conceptual; runtime stores rows)
  Transition Rules
  Validation Result
  Catalog recommendations (Registration Mode, Team Formation, …)
        ↓
==================== Compatibility Boundary ====================
  Sport Bridges (product) / Runtime Adapters (internal)
    AuctionPlayersBridge | BadmintonRegistrationsBridge | Future
        ↓
Runtime Layer (unchanged this epic)
  players / teams (auction)
  badminton_registrations / badminton_players
```

**Permanent rules:**

1. Nothing below the boundary leaks into public APIs.
2. Nothing above the boundary depends on runtime storage shapes.
3. Public APIs speak product language: Plan, Configuration, Participants, Validation, History, Summary.
4. Internal code may use technical names (`ResolvedCompetitionBlueprint`, Runtime Adapter).

### 3.1 Ownership chain (never violate)

```
Tournament
  → Competition Configuration / Plan
      → Participant
          → Registration
              → Team Formation
                  → Team
                      → Fixtures   (out of scope)
```

- Participant exists as platform identity before/alongside registration events.
- Registration creates participation (event); it is not identity.
- Team Formation consumes **Participants**, never raw registration rows or `players` directly.
- This epic produces Team Formation **strategy configuration only** — does not create teams.

---

## 4. Product terminology

| Product name (API / UI / docs) | Meaning | Internal OK |
|--------------------------------|---------|-------------|
| Competition Configuration | Editable working config on Tournament | Working blueprint / resolve-on-read |
| Competition Plan | Locked immutable snapshot (history) | Frozen blueprint |
| Transition Rules | Decides tournament transition requests | Transition Policy |
| Sport Bridge | Maps runtime → Participant View | Runtime Adapter |
| Validation Result | Errors / warnings / info + readiness | Validation report |
| Competition Status | Business readiness + business stage | — |
| Participant | Platform identity entering a competition | Participant View |
| Registration | Event + status workflow | — |
| Lock Competition Setup | Organizer action to freeze | `POST .../competition/ready` |

Avoid in public surfaces: Blueprint, Resolver, Snapshot, Materialization, Provenance.

---

## 5. Three independent concerns (lifecycle)

Never merge. Never share enums across layers. Connect only via Transition Rules + publish/observe.

| Concern | Owner | Vocabulary |
|---------|-------|------------|
| **Tournament State** (platform) | Tournament State Machine | Existing product contract only |
| **Business Stage** | Competition Module | Registration Planning → … → Competition Ready / Configuration Locked |
| **Registration status** | Registration Module | Applied → … → Accepted / Rejected / Withdrawn / Cancelled |

### 5.1 Tournament State (unchanged)

```
Draft → Setup → Draw Ready → Match Scheduling → Ready To Start → Live → Completed → Archived
```

Do not rename. Do not replace. Do not add a third tournament lifecycle.

### 5.2 Competition business stages (examples)

```
Registration Planning
  → Registration Open
  → Registration Closed
  → Verification
  → Team Formation
  → Competition Ready / Configuration Locked
```

These are business milestones, not platform states. Stored as `businessStage` on Tournament (Working).

### 5.3 Registration lifecycle (participant workflow)

```
Applied → Pending Payment → Pending Verification → Verified → Accepted
                                                         ↘ Rejected | Withdrawn | Cancelled
```

Registration never mutates Tournament State or Business Stage directly. Competition observes registration progress for Validation Result / Competition Status.

### 5.4 Transition Rules

Not hardcoded stage→state maps.

```
Competition stage / readiness change
  → Transition Rules (context: competition type, registration mode, format flags, …)
  → may request Tournament transition
  → Tournament State Machine accepts or rejects
```

Default EPIC-03 happy path (as a named rule, not an invariant): Configuration Locked → request **Draw Ready**. Future types (practice, league-without-draw, instant friendly) use different rules without platform rewrites.

---

## 6. Participant

Participant is a **platform concept**, not a DB table, not Player, not Team, not a Registration row.

**Kinds:** Individual | Team | Organization (future) | Mixed (future) | Guest (future)

Participant does **not** know: Auction, Purse, Seed, Captain (downstream modules).

**Sport Bridge** exposes Participant View upward. Public APIs return Participants only.

```
Participant {
  id
  kind
  displayName
  sportId
  registration    // event summary { id, status, … } — not identity
  eligibility
}
```

Forbidden: new `participants` table, dual-write, tournament/team owning participants, sport-specific Participant types, registration-as-identity.

---

## 7. Registration modes & Competition Type

Independent concepts. Catalog recommends; organizer confirms; validation verifies.

| Concept | Answers |
|---------|---------|
| Competition Type | How the tournament is conducted (`auction`, `registered_teams`, `hybrid`, `practice`) |
| Registration Mode | How participants enter (`individual`, `team`, `hybrid`, `invitation`, `import`, `practice`) |

Catalog exposes per Competition Type: default, supported, recommended, unsupported Registration Modes.

**Never** silently persist inferred values when Competition Type changes. Persist Registration Mode only on organizer confirm or tournament create. No UI hardcoded combination matrices.

---

## 8. Team Formation Strategy (configuration only)

Strategies: `auction` | `captain_pick` | `manual` | `random` | `import` | `none`

Same recommend → confirm → validate → persist pattern as Registration Mode. No execution UI this epic.

---

## 9. Squad Rules

On Competition Configuration / Plan:

| Rule | EPIC-03 |
|------|---------|
| Min / max players | Yes |
| Substitutes | Yes |
| Retentions | Yes (meaningful for auction/hybrid) |
| Locked players | Architecture |
| Reserve players | Architecture |
| Gender / age / nationality | Future placeholders only |

---

## 10. Competition Configuration vs Competition Plan

### 10.1 Working — Competition Configuration

- Resolve-on-read over Tournament columns + catalog + bindings
- Editable, recomputable
- Survives refresh / multi-session (persisted on Tournament)
- Organizer-only surfaces may show Working when no Plan exists

### 10.2 Locked — Competition Plan

- Created **exactly once** in EPIC-03 (no re-freeze, unfreeze, or admin override)
- Immutable, versioned, auditable
- Legal definition for execution after lock
- Stores **references** (Rule Profile id+version, Presentation Profile id+version) — not rule bodies
- Also stores: Competition Type, Registration Mode, Team Formation Strategy, Squad Rules, Participant Constraints, Validation Summary, Policy Version, Blueprint/schema version

### 10.3 Freeze contents (not included)

Not fixtures, matches, runtime snapshots, or copied Rule Profile bodies.

### 10.4 Validation at lock

- Working may have WARNINGs
- Freeze requires zero ERROR (blocking) Validation Results
- WARNING / INFO do not block; organizer decides

---

## 11. Storage

### 11.1 Working on Tournament (additive nullable columns)

Examples:

- `registration_mode`
- `team_formation_strategy` (or `team_formation`)
- `squad_rules_json`
- `participant_constraints_json`
- `competition_business_stage` (`businessStage`)

Existing EPIC-01 bindings (`competition_type_id`, rule/presentation profile refs) remain on Tournament.

No separate Working Configuration table.

### 11.2 History — Locked configurations

Table name (prefer): `competition_configuration_history` or `competition_configuration_versions`

- Append-only
- EPIC-03 creates Version 1 only
- Never overwrite
- Future Configuration Management epic may add Version 2+

### 11.3 Pattern (platform-wide)

```
Current (editable on owner entity) → Lock → History (immutable versions)
```

Later: Broadcast, Presentation, Fixture, Match configuration follow the same pattern.

---

## 12. Validation (three independent layers)

Never mix:

| Layer | Validates |
|-------|-----------|
| Participant | Identity, eligibility, duplicates |
| Registration | Status, payment, approval |
| Tournament / Competition | Capacity, Rule Profile, Competition Type, Variant, Registration Mode compatibility, Squad Rules, readiness |

**Severity:** ERROR (blocks Ready) | WARNING (visible) | INFO (guidance)

**Competition Status** (continuous evaluation): Ready | Almost Ready | Not Ready + Blocking Issues | Warnings | Recommendations

System recommends. Organizer approves. Platform validates. Tournament executes.

---

## 13. APIs

Competition is the **aggregate root**.

```
GET  /tournaments/:id/competition
     → { plan, configuration, validation, summary }

GET  /tournaments/:id/competition/configuration
GET  /tournaments/:id/competition/plan
GET  /tournaments/:id/competition/participants
GET  /tournaments/:id/competition/validation
GET  /tournaments/:id/competition/history

PATCH /tournaments/:id/competition/configuration
      → update Working fields (rejected after lock)

POST  /tournaments/:id/competition/ready
      → Lock Competition Setup
```

### 13.1 Lock flow (`POST .../competition/ready`)

```
Organizer initiates
  → Validation Result
  → if ERROR → reject + return Validation Result
  → freeze Configuration → History Version 1 (Competition Plan)
  → Transition Rules
  → request Tournament State transition
  → Tournament State Machine accepts or rejects
  → return { competitionStatus, validation, planVersion, tournamentTransitionResult }
```

Never return internal runtime objects.

### 13.2 Permissions (Ready)

Organizer | Tournament Admin | Platform Admin only.  
Never: Scorer, Viewer, Participant.

### 13.3 Existing registration APIs

Reuse `/register/:code`, badminton registration routes, etc. EPIC-03 does not replace them. Sport Bridges expose Participant views over them.

### 13.4 Future under Competition

`/competition/teams`, `/fixtures`, `/statistics`, `/standings` — not this epic.

---

## 14. UI

### 14.1 Tournament Creation Wizard (extend existing)

Flow addition: Competition Type → Registration Mode → Team Formation → Squad Rules → Review  

Show catalog recommendations (⭐ Recommended). On change, run Validation Result immediately. No sport-specific wizard. No new registration wizard.

Review checklist: Sport, Variant, Competition Type, Registration Mode, Team Formation, Squad Rules, Rule Profile, Presentation Profile, Validation Summary.

### 14.2 Tournament Hub — Competition Setup card

Shows: Competition Plan / Configuration, Competition Status, Validation Result, **Lock Competition Setup** (enabled only when Blocking Errors = 0).

### 14.3 Registration pages

Reuse current pages. Do not redesign. Do not merge cricket and badminton registration UIs.

### 14.4 Out of UI scope

Team management, auction, fixtures, scheduling, match, scoring UIs. Team Formation = configuration only.

---

## 15. Migration & compatibility

- Additive schema only
- No participant data migration
- Null Working fields → catalog suggestions at read time; legacy tournaments remain usable
- Existing badminton and cricket registration paths unchanged
- After lock, public/runtime consumers use Competition Plan (Frozen); no silent re-resolution of Working into execution

---

## 16. Testing

- Registration Mode / Competition Type compatibility (catalog)
- Team Formation recommendations
- Validation Result severities (ERROR blocks Ready; WARNING does not)
- Lock once (second Ready rejected)
- Working Configuration PATCH before/after lock
- Participant views via Sport Bridges (auction + badminton)
- Transition Rules default → Draw Ready request (mock/accept path)
- Backward compatibility: create tournament without new fields; existing register flows
- Cricket + badminton regression

---

## 17. Dead code cleanup

Only after implementation. Remove only **verified** duplicate registration logic / unused validation / unused UI. Produce cleanup report. Do not delete ambiguous shared helpers.

---

## 18. Implementation placement (guidance)

| Concern | Location |
|---------|----------|
| Types, catalog extensions, Transition Rules, Validation, Plan resolver | `lib/platform-core` |
| Sport Bridges | `lib/platform-core` (or thin server adapters calling platform-core) |
| HTTP routes under `/competition` | `artifacts/api-server` (extend, don’t fork) |
| Wizard + Competition Setup card | `artifacts/auction-platform` (shared components) |
| Schema | `lib/db` additive columns + history table |

Follow EPIC-01/02: CatalogRegistry as gateway; no sport pack imports from UI/routes.

---

## 19. Foundation chain

```
EPIC-01  Tournament Identity
            ↓
EPIC-02  Rule Identity
            ↓
EPIC-03  Competition Identity
```

---

# Architecture Guardrails

## Guardrail 1 — Design Principles

1. **Platform First** — Sport-agnostic product contracts; sports plug in via Sport Bridges.
2. **Configuration over Code** — Modes, strategies, and squad rules are data/catalog — not switch statements in UI.
3. **One Source of Truth** — Working Configuration on Tournament; Locked Plan in history; Tournament State only in the product state machine.
4. **Current → Lock → History** — Editable current config; lock creates immutable version; never overwrite history.
5. **Product Layer independent from Runtime Layer** — Compatibility boundary; public APIs never expose runtime tables.
6. **Reuse before Rewrite** — Keep auction `players` and badminton `badminton_registrations` as live runtimes.
7. **No sport-specific business logic in Platform** — Bridges translate; Platform owns Participant / Configuration / Validation / Transition Rules.

## Guardrail 2 — Ownership Matrix

| Concept | Owner |
|---------|--------|
| Tournament | Tournament Module |
| Competition Configuration | Competition Module |
| Competition Plan (history) | Competition Module |
| Participant | Platform |
| Registration | Registration Module |
| Team | Team Formation Module |
| Rule Profile | Rule Catalog |
| Presentation Profile | Presentation Catalog |
| Tournament State | Tournament State Machine |
| Business Stage | Competition Module |
| Transition Rules | Competition Module (requests) → Tournament State Machine (decides) |
| Validation Result | Platform / Competition Module (by layer) |

## Guardrail 3 — Out of Scope

Explicitly **not** in EPIC-03:

- Auction Engine
- Fixture Engine
- Scheduling
- Match Engine
- Rule Engine
- Standings
- Team Management (execution)
- Registration Rewrite (cricket/badminton page merge or replacement)
- Re-freeze / unfreeze / admin override of Competition Plan
- New `participants` table or dual-write
- Replacing Tournament product state contract

## Guardrail 4 — Success Criteria (business outcomes)

1. One Working Competition Configuration per tournament.
2. Competition Setup can be locked **exactly once**, producing Version 1 history (Competition Plan).
3. No sport-specific registration logic in the Platform Product Layer.
4. Existing badminton and cricket registration continue working **unchanged**.
5. Platform APIs expose **Participants**, not runtime table shapes.
6. Organizers see Competition Status and Validation Result before locking; system never auto-freezes.
7. Downstream modules can consume Competition Plan instead of guessing registration / formation / squad decisions.
8. Tournament platform lifecycle remains the single Tournament State Machine.

## Guardrail 5 — Definition of Done

Implementation is complete only when:

- [ ] Audit completed (this epic’s Phase 1 findings reflected)
- [ ] Existing code reused where possible
- [ ] Architecture in this document followed
- [ ] No duplicate registration systems introduced
- [ ] Backward compatibility maintained
- [ ] Tests passing (compatibility, lock-once, bridges, regression)
- [ ] Documentation updated (this spec + any API notes)
- [ ] Dead code report produced (post-implementation)

---

## Backlog (non-blocking — not EPIC-03 scope)

These improve clarity and UI i18n. They do **not** block EPIC-03 implementation. Prefer adopting `#1` column naming if cheap during first implementation; otherwise defer rename.

### B1 — Persist IDs, never labels

Standardize Working Configuration / Plan fields as catalog IDs:

| Prefer | Avoid persisting |
|--------|------------------|
| `registration_mode_id` | `registrationMode` label strings as source of truth |
| `team_formation_strategy_id` | free-text strategy labels |
| `business_stage_id` | ad-hoc stage strings without registry |
| `participant_kind_id` | display labels for kind |

Platform persists IDs. Labels come from catalogs at read time.

### B2 — Business Stage Catalog

Today business stages are implied by Competition Module vocabulary.

Future: first-class **Business Stage Catalog** (same pattern as Rule Catalog), e.g. `registration_open`, `verification`, `team_formation`, `competition_ready`.

Not now.

### B3 — Validation codes

Today: severity `ERROR` | `WARNING` | `INFO`.

Future: stable `validationCode` for UI/i18n, e.g.:

- `REGISTRATION_REQUIRED`
- `INSUFFICIENT_PLAYERS`
- `RULE_PROFILE_INCOMPATIBLE`

UI must not depend on English messages as the contract.

---

## Working style note (from EPIC-04 onward)

Foundations (Tournament / Rule / Competition identity) are stable. Recommended delivery style for execution-oriented epics:

```
Architecture (minimal) → Implementation → Review → Refinement
```

EPIC-01…03 used Architecture → Review → Implementation. That remains valid for new identity layers; prefer the faster loop when extending execution on frozen identities.

---

## Status

**APPROVED**

**Architecture Frozen**

Implementation may begin.

Changes require RFC.
```
