# EPIC-08 — Runtime Match Foundation

**Date:** 2026-08-05  
**Status:** APPROVED (Modified) — Architecture Frozen · Implemented  

**Depends on:** EPIC-01, EPIC-02, EPIC-03, EPIC-04, EPIC-05, EPIC-06, EPIC-07  
**Scope:** Platform Runtime Execution Contract — Snapshot (immutable refs), Context (bindings), Execution Phase (subordinate), Validation, Runtime History, Runtime Match View, Prepare/Ready orchestration, Sport Bridges  
**Non-goals:** Scoring, Scoreboards, Broadcast, Statistics, Analytics, Streaming, Highlights, Commentary, Fixture Engine, Scheduling algorithms, second Match identity, Runtime Match identity table

---

## 1. Objective

Establish **Runtime Match** as the immutable **execution contract view** of EPIC-05 Match so Scoring, Broadcast, Statistics, Streaming, Analytics, AI, and Highlights consume **Runtime Match View** — never sport-specific runtime match models, never planning re-resolution at execution time.

Runtime Match is created from:

```
Fixture → Fixture Node → Match Blueprint → Scheduling Plan → Schedule Slot
```

and freezes everything required for execution as references to locked versions.

Architecture correctness takes priority. Reuse before rewrite. No parallel Runtime Match systems. No second Match Identity.

---

## 2. Decision record

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| `scoring_matches` | Canonical playable identity (cricket + badminton); EPIC-05 Match Identity storage |
| EPIC-05 Match Foundation | Product Identity / Configuration / Sides / Officials / Lifecycle / History |
| `badminton_match_details` | Sport scoring extension (FK to `scoring_matches`) — not a second identity |
| Cricket / Badminton create paths | Materialize `scoring_matches` (+ sessions / details); scoring owns create in practice |
| `scoring_sessions` / events / snapshots | Scoring runtime projections — not execution contract |
| Broadcast / SSE / scoreboards | Presentation consumers |
| EPIC-06 Fixture / Blueprints | Planned contests — upstream of Runtime |
| EPIC-07 Scheduling / Slots | Execution planning — upstream of Runtime |
| Dual status fields | `lifecycle_status` (product) vs scoring `status` — must not become dual lifecycle |

**Finding:** Mature sport scoring runtimes and EPIC-05 Match Identity exist. No Platform Runtime Snapshot, Runtime Context, Execution Phase module, Runtime History, or Runtime Match View. Scoring services create identity rows today; product layer must own execution-contract freeze without inventing a second identity.

### 2.2 Chosen approach — A (Modified)

**Runtime Match = Match Identity + Execution Contract** (same identity):

- Exactly **one** Match Identity (EPIC-05); Runtime Match does **not** introduce another
- No Runtime Match table
- EPIC-05 Match Lifecycle remains the **only** lifecycle authority
- Execution Phase is subordinate (linear phases under Match Lifecycle)
- Freeze immutable Runtime Snapshot (references + frozen versions only)
- Runtime Context holds resolved bindings — not execution progress or scoring state
- Append-only `runtime_match_history` for snapshot / phase / preparation / operator audit
- Minimal additive working fields on `scoring_matches` only
- Sport bridges materialize Execution Contract; never expose sport storage in product APIs

---

## 3. Permanent architecture boundary

```
Product Layer
  Match Identity                         (EPIC-05 — sole identity)
  Match Configuration / History          (EPIC-05)
  Runtime Snapshot                       (EPIC-08 — immutable refs + versions)
  Runtime Context                        (EPIC-08 — bindings + metadata)
  Match Lifecycle                        (EPIC-05 — sole lifecycle authority)
  Execution Phase                        (EPIC-08 — subordinate, linear)
  Runtime Validation                     (EPIC-08)
  Runtime History                        (EPIC-08)
  Runtime Match View                     (modular public contract)
        ↓
==================== Compatibility Boundary ====================
  Sport Bridges
    BadmintonRuntimeBridge | CricketRuntimeBridge | Future
        ↓
Runtime Layer (unchanged ownership)
  scoring_matches / badminton_match_details
  scoring_sessions / scoring_events / fixtures / courts / venues
```

**Permanent rules:**

1. Nothing below the boundary leaks into public Runtime Match View APIs.
2. Nothing above depends on sport runtime storage shapes.
3. Public APIs: Identity, Snapshot, Context, Execution Phase, Validation, History, Prepare, Ready.
4. Bridges expose Runtime Match View only — never sport engines, scores, or broadcast payloads.
5. Downstream modules consume Runtime Match View; they never create another execution contract identity.

### 3.1 Ownership chain (never violate)

```
Tournament
  → Competition
      → Fixture
          → Fixture Node → Match Blueprint
              → Scheduling Plan → Schedule Slot
                  → Match Identity (EPIC-05)
                      + Execution Contract (EPIC-08 Runtime Snapshot / Context / Phase)
                          → Scoring / Broadcast / Stats / Streaming / Analytics (consumers)
```

### 3.2 Identity independence (critical)

There is exactly one Match Identity. Runtime Match is **not** another Match.

```
Runtime Match View = Match Identity + Execution Contract
```

Identity never changes. Execution Contract changes only through execution (new snapshot versions, phase transitions, history appends) — never by mutating a frozen snapshot.

---

## 4. Product terminology

| Product name | Meaning | Forbidden |
|--------------|---------|-----------|
| Match Identity | Sole platform identity for a playable contest (EPIC-05) | Runtime Match identity, Cricket/Badminton Runtime Match |
| Execution Contract | Frozen snapshot + context + phase under that identity | Scoring runtime, broadcast state |
| Runtime Snapshot | Immutable refs + frozen versions for one execution freeze | Config copies, “latest” aliases, recalculation |
| Runtime Context | Resolved execution bindings (constant during a freeze) | Score, clock, timer, stats, broadcast, player positions |
| Execution Phase | Linear subordinate phase under Match Lifecycle | Second lifecycle, parallel phase trees |
| Runtime History | Append-only audit of snapshot / phase / prep / validation | Scoring events, broadcast events, statistics |
| Runtime Match View | Modular public contract | Giant blob, scoring/broadcast payloads |
| Prepare / Ready | Orchestration that freezes snapshot and requests lifecycle moves | Direct Match Lifecycle mutation by Runtime |

---

## 5. Runtime Snapshot

### 5.1 Purpose

Freeze **which locked versions** were bound for execution. Never duplicate product configuration bodies.

### 5.2 Self-describing header (required on every snapshot)

| Field | Purpose |
|-------|---------|
| `snapshotVersion` | Monotonic version for this Match Identity |
| `snapshotSchemaVersion` | Schema of the snapshot payload (migration future-proofing) |
| `createdAt` | Freeze timestamp |
| `createdBy` | Actor who froze |

### 5.3 Reference payload (refs + frozen version ids only)

- Rule Profile reference + locked version  
- Presentation Profile reference + locked version  
- Competition reference  
- Fixture reference  
- Fixture Node reference  
- Match Blueprint reference  
- Scheduling Plan reference  
- Schedule Slot reference  
- Resource Assignment reference(s)  
- Side references  
- Official references  
- Match Configuration history version  

### 5.4 Immutability and resolvability

1. **Immutable:** Once frozen, a snapshot is never recalculated or overwritten.  
2. **New freeze = new version:** If planning changes after freeze, create a **new** Runtime Snapshot version.  
3. **No “latest”:** Every reference must resolve to a **frozen version**, not a mutable alias, so it remains resolvable after configuration evolves.

---

## 6. Runtime Context

Runtime Context contains **resolved execution bindings** for the active snapshot. It does **not** own execution progress.

**Contains:**

- Rule Binding  
- Presentation Binding  
- Scheduling Binding  
- Resource Assignment Binding  
- Execution metadata (preparation notes / operator tags that are not clocks or scores)

**Does not contain:**

- Current score, overs, rally  
- Clock / timer  
- Statistics  
- Broadcast state  
- Player positions / lineup live state  

**Rules:**

- Bindings remain **constant** for a given frozen snapshot.  
- Execution **progress** belongs to **Execution Phase**, not Context.  
- Context must not slowly become a scoring document.

---

## 7. Match Lifecycle vs Execution Phase

### 7.1 Lifecycle authority (EPIC-05 only)

Match Lifecycle remains the **only** lifecycle owner:

```
Draft → Scheduled → Ready → Locked → Live → Completed → Verified → Archived
```

Runtime **never** mutates Match Lifecycle directly. Orchestration **requests** lifecycle transitions through EPIC-05 authority.

### 7.2 Execution Phase (subordinate, linear)

Execution Phase is linear. No parallel phase trees. Future checkpoints may exist **inside** a phase without branching the phase model.

Example linear progression (with Pausable Running):

```
Preparing
  → Resources Ready
  → Officials Ready
  → Participants Ready
  → Countdown
  → Running
  → Paused
  → Running
  → Finished
```

### 7.3 Phase ↔ Lifecycle constraints (no dual ownership)

Execution Phase advances only when Match Lifecycle permits. Runtime requests lifecycle changes; it does not write lifecycle itself.

| Execution Phase | Allowed only when Match Lifecycle is |
|-----------------|--------------------------------------|
| Preparing, Resources Ready, Officials Ready, Participants Ready, Countdown | `ready` or `locked` |
| Running, Paused | `live` |
| Finished | `live` (terminal phase) or `completed` |

Entering `Running` requires a successful Ready→ request that moves Match Lifecycle to `live` (via EPIC-05). Entering `Finished` may accompany a request to move Match Lifecycle to `completed`. Implementation may refine guards; it must not add a second lifecycle field that competes with EPIC-05.

**No dual truth:** one lifecycle owner; phase is subordinate.

---

## 8. Runtime Validation

Reuse the Validation model from earlier epics (`ValidationIssue` severities / readiness). Do **not** invent another response format.

Distinguish:

- **Blocking** (error)  
- **Warning**  
- **Information**  

Validate:

- Competition Ready  
- Fixture Ready  
- Scheduling Ready  
- Locked Match Configuration  
- Locked Rule Profile  
- Locked Presentation Profile  
- Locked Resource Assignment  
- Runtime Snapshot completeness (all required refs + frozen versions present)

**No scoring validation.**

---

## 9. Freeze pattern

```
Planning
  → Validation
  → Freeze Runtime Snapshot (immutable, self-describing)
  → Execution (reads snapshot; never re-resolves planning)
  → History (append)
```

Execution engines never re-resolve “current” planning configuration; they consume the frozen snapshot (or `/current` alias that points at the active frozen version).

---

## 10. Runtime History

Append-only table `runtime_match_history`, keyed by Match Identity (`match_id`). **Not** a Runtime Match identity table.

Each entry includes:

| Field | Purpose |
|-------|---------|
| `timestamp` | When |
| `actor` | Who |
| `operation` | What (freeze, phase transition, prepare, ready request, …) |
| `snapshotVersion` | Active / related snapshot version |
| `executionPhase` | Phase after / related to the operation |
| `reason` | Optional |
| payload | Snapshot / validation summary / prep audit as needed |

**Stores:** snapshot versions, execution phase transitions, preparation audit, operator audit, validation results.

**Never stores:** scores, scoring events, statistics, commentary, broadcast state.

---

## 11. Runtime Match View

Modular — never one giant object. Separate:

1. Identity (EPIC-05 Match Identity)  
2. Snapshot  
3. Context  
4. Execution Phase  
5. Validation  
6. History  

**Stable contract:** Downstream systems must not require sport-specific endpoints to obtain the execution contract. Runtime Match View is sufficient for execution consumers.

**Never returns:** Scoring, Broadcast, Statistics, Analytics, Streaming payloads.

---

## 12. Prepare / Ready orchestration

### 12.1 `prepare`

```
prepare
  → validation
  → freeze snapshot (new immutable version if freezing)
  → execution phase transition (e.g. into Preparing / readiness phases)
```

### 12.2 `ready`

```
ready
  → requests Match Lifecycle transition via EPIC-05 authority
```

Runtime never mutates Match Lifecycle directly. Lifecycle authority stays with EPIC-05.

---

## 13. Storage

### 13.1 Working — minimal additive fields on `scoring_matches`

**No Runtime Match table.**

Working execution data must remain **minimal**. Store only:

- Execution Phase  
- Current Runtime Version pointer (active snapshot version)  
- Preparation metadata **only if not derivable**

Do **not** slowly turn `scoring_matches` into a Runtime document. Everything else belongs in Runtime History.

### 13.2 History

`runtime_match_history` — append-only; keyed by `match_id` (existing Match Identity).

### 13.3 Migration

None this epic.

- Bridge Badminton create / bulk-from-fixtures  
- Bridge Cricket create / foundation createMatches  
- No dual-write rewrite of scoring engines  
- No data migration of historical scores into Runtime History  

---

## 14. Bridges

| Bridge | Source | Exposes |
|--------|--------|---------|
| BadmintonRuntimeBridge | `scoring_matches` + `badminton_match_details` + fixture/slot links | Runtime Match View |
| CricketRuntimeBridge | `scoring_matches` + sessions/fixture links as needed | Runtime Match View |
| Future | Other sports | Same Runtime Match View contracts |

Bridges **materialize** the Execution Contract onto existing create paths. They:

- Never become lifecycle owners  
- Never expose sport runtime storage shapes in product APIs  
- Never promote scoring snapshots / events into Runtime Snapshot  

Existing `/scoring/*` and `/badminton/matches/*` remain **scoring runtime** surfaces — not Runtime Match View.

---

## 15. APIs

Aggregate root — product naming, no technical leakage:

```
GET    /tournaments/:id/runtime-matches
GET    /tournaments/:id/runtime-matches/:matchId/identity
GET    /tournaments/:id/runtime-matches/:matchId/snapshot
GET    /tournaments/:id/runtime-matches/:matchId/context
GET    /tournaments/:id/runtime-matches/:matchId/execution-phase
GET    /tournaments/:id/runtime-matches/:matchId/validation
GET    /tournaments/:id/runtime-matches/:matchId/history
POST   /tournaments/:id/runtime-matches/:matchId/prepare
POST   /tournaments/:id/runtime-matches/:matchId/ready
```

### 15.1 `/current` routing philosophy (reserved)

Future-proof aliases (not required to implement in this epic):

```
GET /tournaments/:id/runtime-matches/:matchId/current/snapshot
GET /tournaments/:id/runtime-matches/:matchId/current/context
```

Internally resolve to the **active** frozen snapshot version (the Current Runtime Version pointer). First implementation may omit dedicated `/current/*` route handlers if equivalent data is available via `snapshot` / `context` using that pointer; the alias shape remains reserved for consumers.

**No scoring endpoints** under Runtime Match APIs.

---

## 16. UI

Extend Tournament Hub with **Runtime Preparation**.

One job = one screen. Show:

- Validation  
- Snapshot Summary  
- Execution Phase  
- Preparation Checklist  

Do **not** expose Scoring, Broadcast, or Statistics controls.

---

## 17. Testing

- One Match Identity — Runtime View never invents a second id  
- Snapshot immutability — no overwrite / recalculation  
- Snapshot self-describing header present  
- References resolve to frozen versions only (no “latest”)  
- Context bindings constant for a snapshot; no score/clock/broadcast fields  
- Execution Phase linear; subordinate to Match Lifecycle  
- Prepare freezes snapshot; Ready requests EPIC-05 lifecycle transition only  
- Validation reuses shared Validation model (blocking / warning / information)  
- History append-only; excludes scoring/broadcast/stats  
- Working columns on `scoring_matches` remain minimal  
- Bridge never leaks sport runtime storage  
- Cricket / Badminton regression (existing scoring APIs still work)  

---

## 18. Explicitly forbidden

- Second Match identity / Runtime Match identity  
- Runtime Match table  
- Snapshot mutation or recalculation  
- Snapshot storing product configuration copies  
- References to mutable “latest” aliases  
- Dual lifecycle owner  
- Mutable bindings during a frozen snapshot’s execution  
- Runtime-specific configuration parallel to product configuration  
- Runtime-owned scores, clocks, timers  
- Runtime-owned broadcast  
- Runtime-owned statistics  
- Runtime leakage into product APIs  
- Sport-specific endpoints required for execution consumers  

---

## 19. Success criteria

At the end of EPIC-08, BidWar has an **immutable Runtime Execution Contract**.

Scoring, Broadcast, Statistics, Streaming, Analytics, and AI consume **Runtime Match View**.

No downstream module creates another execution contract or Match identity.

---

## 20. Files expected (implementation phase — not this approval)

Indicative only; exact paths set during implementation planning:

**Likely added**

- `lib/platform-core/src/runtime-match/*` (types, snapshot, context, phase, validation, history, view, bridges)  
- `lib/db/src/schema/runtime-match-history.ts`  
- `artifacts/api-server/src/lib/runtime-match-service.ts`  
- `artifacts/api-server/src/routes/runtime-match-foundation.ts`  
- `artifacts/auction-platform/src/components/tournament-hub/runtime-preparation-card.tsx`  
- Tests under `platform-core` and `api-server`  
- This design doc (already added)

**Likely modified**

- `lib/platform-core/src/index.ts`, package exports  
- `lib/db/src/schema/index.ts`, `ensure-schema.ts`  
- Minimal additive columns on `scoring_matches` (execution phase, current runtime version pointer, optional prep metadata)  
- Tournament hub pages (Runtime Preparation entry)  
- Route index  
- Thin hooks in badminton/cricket create bridges so materialization can freeze/link Execution Contract without scoring owning the contract

**Removed**

- None (no parallel system deletion this epic)

---

## 21. Architecture compliance

| Constraint | Compliance |
|------------|------------|
| Platform Constitution / multi-sport identity | Runtime Match is platform execution contract; sports via bridges |
| EPIC-01 Tournament | Aggregate under tournament; catalog patterns reused |
| EPIC-02 Rule Profiles | Snapshot holds Rule Profile frozen version refs only |
| EPIC-03 Competition | Validation references Competition Ready; no duplicate |
| EPIC-04 Teams | Side refs via Match Sides; no Runtime team ownership |
| EPIC-05 Match | Sole Match Identity + Lifecycle authority; Runtime is execution contract view |
| EPIC-06 Fixture | Consumes Blueprint / Node / Fixture Ready; does not own Fixture |
| EPIC-07 Scheduling | Consumes Slot / Resource Assignment frozen refs; does not own Scheduling |
| No Runtime Match table | Affirmed |
| No second Match identity | Affirmed |
| No dual lifecycle | Affirmed — Execution Phase subordinate |
| No scoring / broadcast / stats in this epic | Affirmed non-goals |
| Snapshot immutability + frozen-version refs | Affirmed |
| Minimal working columns on `scoring_matches` | Affirmed |

---

## 22. Deliverables checklist (epic close-out)

| # | Deliverable | Status at design freeze |
|---|-------------|-------------------------|
| 1 | Audit Report | Complete (pre-design) |
| 2 | Reuse Report | Complete (pre-design) |
| 3 | Architecture Validation | Complete (pre-design) |
| 4 | Design Proposal | This document |
| 5–7 | Files Modified / Added / Removed | Implementation phase |
| 8 | Migration Report | None planned |
| 9 | Testing Report | Implementation phase |
| 10 | Architecture Compliance Report | §21 |

---

## 23. Implementation gate

No implementation code until this design is reviewed as the written spec and an implementation plan is written.

Order: **Audit → Design approval → Spec → Implementation plan → Code.**
