# P0.3 — Tournament Stage Propagation Design

**Date:** 2026-08-04  
**Status:** Approved  
**Scope:** Architecture consolidation — make Tournament Stage a true Single Source of Truth  
**Approach:** Server-first consolidation (Option B + Approach 1)  
**Non-goals:** Stage machine (P0.4), multi-day tournaments, scheduling engine, match creation automation, cricket schedule unification, DrawStageKey format inheritance, UI presentation rewrites for `roundName`

---

## 1. Problem

P0.2 introduced a centralized Tournament Stage helper and persisted `current_stage` on categories. The rest of the platform still:

- Writes `currentStage` directly (promotion engine bypasses `writeCategoryStage` / `setPromotionStage`)
- Resolves stage via scattered calls to core `resolveCurrentStage` or raw column reads
- Leaves `writeCategoryStage` / `setPromotionStage` defined but unused
- Has no standard DTO for APIs returning stage

P0.3 consolidates architecture only. Tournament progression behavior must remain identical.

---

## 2. Goals

1. Route **all** stage reads through Tournament Stage Helper
2. Route **all** stage writes through Tournament Stage Helper
3. Standardize the stage DTO returned by APIs
4. Remove direct `currentStage` reads/writes outside the helper (business path)
5. Structure the helper as the permanent home for future stage APIs (P0.4+)
6. Leave behavior unchanged (no QF → SF → Final → completed advancement)

---

## 3. Invariants

### 3.1 Sole public API

`artifacts/api-server/src/lib/tournament-stage.ts` is the **only** public API for category tournament stage.

Contributors must **never** introduce parallel modules such as:

- `TournamentStageHelper2`
- `StageUtils`
- `StageResolver`
- `StageMapper`

All future stage APIs (`advanceStage`, `completeTournament`, `canPromote`, `canSchedule`, `canScore`, etc.) extend this file.

### 3.2 Server owns business state

| Layer | Responsibility |
|---|---|
| Server helper | Persist, resolve, lifecycle map, compare, validate, DTO |
| Client | Display and react to DTO — never calculate stage |
| Core package | Implementation detail of resolution (`resolveCurrentStage`, stage enum) — consumers use the helper, not core, for category stage decisions |

### 3.3 Stage ≠ Round Name

| Concept | Role | Examples |
|---|---|---|
| **Tournament Stage** | Business lifecycle | `league`, `quarter_final`, `semi_final`, `final`, `completed` |
| **Round Name** | Match presentation | `"Quarter-Finals"`, `"Semi Final A"`, `"Final"`, court/match labels |

Round name planners and OBS/display chrome that show `roundName` are **out of scope**. Do not use round name, draw type, fixture count, or bracket size to determine stage.

### 3.4 No stage machine in P0.3

Do **not** implement automatic advancement:

```
quarter_final → semi_final → final → completed
```

That is **P0.4 — Tournament Stage Machine**.

---

## 4. Architecture

```
@workspace/badminton-core (tournament-engine)
  TOURNAMENT_ENGINE_STAGES / resolveCurrentStage / initialStageForDrawType
        ↑ implementation detail
tournament-stage.ts  (SOLE PUBLIC API)
  normalize → resolve DTO → predicates → writes
        ↑
promotion-engine / tournament-engine / routes / future consumers
        ↑
API response (TournamentStageDto)
        ↑
Client (display only)
```

---

## 5. Helper organization

File: `artifacts/api-server/src/lib/tournament-stage.ts`

```
Tournament Stage Helper
────────────────────────
Types
  TournamentStageDto
  PersistedTournamentStage
  LifecycleStage

Read
  getTournamentStage()      — load row fields + resolve (if needed)
  resolveStageDto()         — standard entry point from category row fields

Write
  writeCategoryStage()      — sole generic write
  setPromotionStage()       — promotion write (→ quarter_final today)

Predicates
  isLeague()
  isElimination()
  isCompleted()
  (future: canPromote, canSchedule, canScore — stubs/structure only if natural; no new behavior)

Presentation
  stageDisplayLabel()       — convenience only; never used for business logic

Internal
  normalizeStage()          — canonicalize known inputs; reject unknown
  toLifecycleStage()        — persisted → lifecycle mapping
```

### 5.1 TournamentStageDto

```ts
interface TournamentStageDto {
  currentStage: PersistedTournamentStage | null;
  lifecycleStage: LifecycleStage | null;
  displayLabel?: string | null;
}
```

- `currentStage` and `lifecycleStage` are **domain** fields
- `displayLabel` is **optional presentation** convenience
- Business logic must **never** depend on `displayLabel`
- Every API returning tournament stage builds the DTO **only** via `resolveStageDto()` (or `getTournamentStage()` which delegates to it)

### 5.2 normalizeStage()

- Explicitly supported values only (persisted literals; optional known aliases if defined in one map)
- Unknown values → reject / return null — **do not** silently invent mappings
- Single future migration point for terminology changes

### 5.3 Determinism

`resolveStageDto(input)` is pure with respect to its inputs:

- Same input → same DTO every call
- No mutation of input
- No hidden module state affecting the result

### 5.4 Writes

| Operation | API |
|---|---|
| Generic set/clear | `writeCategoryStage(executor, tournamentId, categoryId, stage)` |
| League → knockout promote | `setPromotionStage(executor, tournamentId, categoryId)` |
| Future reset / admin / repair | `writeCategoryStage(...)` only |
| Future advancement | `advanceStage` / `completeTournament` (P0.4) — same file |

No `currentStage = ...` / Drizzle `.set({ currentStage })` outside this helper.

---

## 6. File-level changes

### 6.1 Write path

| File | Change |
|---|---|
| `badminton-promotion-engine.ts` | Replace direct `currentStage` write with `setPromotionStage()`; gates via helper DTO / predicates |
| `badminton-tournament-engine.ts` | PUT stage via `writeCategoryStage`; reads via `resolveStageDto`; promote eligibility via `isLeague` (or equivalent predicate), not raw `=== "league"` |
| `routes/badminton.ts` | Category create initial stage via helper; Zod enum sourced from `TOURNAMENT_ENGINE_STAGES`; engine GET/PUT returns DTO fields |

### 6.2 Read path

- Replace business uses of raw `cat.currentStage` and direct core `resolveCurrentStage` with `resolveStageDto` / predicates
- Core `resolveCurrentStage` remains used **inside** the helper (implementation detail)

### 6.3 Explicit non-changes

| Area | Reason |
|---|---|
| `badminton-knockout-plan.ts` round names | Presentation |
| OBS / LED / display `roundName` chrome | Presentation |
| Champion detection via Final round name | Not stage SSoT; separate concern |
| `badminton-lifecycle.ts` `phase` | Coarse lifecycle, not `current_stage` machine |
| Cricket schedule round labels | Out of scope |
| `DrawStageKey` / format inheritance | Different vocabulary |

### 6.4 Client

- Consume API stage DTO where tournament status is shown
- Remove any client logic that determines stage from `roundName` / `drawType` / fixture count
- Do not rewrite match presentation surfaces that only display `roundName`

---

## 7. API contract

APIs that return category tournament stage should expose the same structure (field names may nest under a `stage` key if that fits existing response shapes, but values must originate from `resolveStageDto`):

```json
{
  "currentStage": "quarter_final",
  "lifecycleStage": "elimination",
  "displayLabel": "Quarter Final"
}
```

Avoid duplicate stage calculations in handlers.

---

## 8. Testing

### 8.1 Helper (`tournament-stage.test.ts`)

- `normalizeStage` — canonical pass-through; unknown rejected
- `resolveStageDto` — league / QF / SF / final / completed / legacy null+drawType/phase; **determinism** (same input twice → deep equal; no mutation)
- Predicates — `isLeague` / `isElimination` / `isCompleted`
- `stageDisplayLabel` — presentation mapping
- Writes — `writeCategoryStage` / `setPromotionStage` update path via mocked executor

### 8.2 Consumer / regression

- Promotion: uses `setPromotionStage`; response stage remains `quarter_final`; behavior identical
- Engine GET/PUT: DTO shape; PUT uses helper write
- Legacy resolution matches pre-P0.3 outcomes for null `current_stage`

### 8.3 Architectural drift guard

Add a static test or CI-friendly grep assertion:

- Search for `currentStage` assignments / Drizzle patches outside `tournament-stage.ts`
- Fail if new direct reads/writes appear on the business write path

(Exact mechanism: unit test scanning known offender patterns, or documented grep in test — prefer a maintainable automated check.)

### 8.4 Out of test scope

OBS roundName chrome, champion-via-Final-name, cricket schedule, QF→SF→Final advancement.

---

## 9. Performance

- No additional DB queries for resolution
- Helper translates already-loaded category fields
- Writes remain a single update (same as today), routed through the helper

---

## 10. Backward compatibility

- No schema changes
- No migrations
- Existing tournaments behave identically
- Legacy null `current_stage` continues to resolve via the same drawType/phase fallback, now inside the helper

---

## 11. P0.4 preparation (document only)

Future home in the same helper:

- `advanceStage()`
- `completeTournament()`
- `canPromote()` / richer eligibility
- Hooks for analytics, awards, broadcast, notifications, certificates

Do **not** implement in P0.3.

---

## 12. Definition of done

- [ ] No direct `currentStage` writes outside helper
- [ ] Promotion uses `setPromotionStage()`
- [ ] Engine PUT uses `writeCategoryStage()`
- [ ] Consumers resolve via `resolveStageDto()` / predicates
- [ ] APIs return standardized DTO fields
- [ ] Helper structured for P0.4 extension
- [ ] Tests: helper + promotion + engine + legacy + drift guard
- [ ] Behavior unchanged (promotion still → `quarter_final`; no stage machine)
- [ ] Design invariant documented (this file): helper is sole public API

---

## 13. Audit summary (pre-implementation)

| Area | Finding |
|---|---|
| Helper | Exists; write helpers unused by callers |
| Promotion | Direct `currentStage` write ~line 696 |
| Engine | Uses core resolve + raw `=== "league"`; PATCH sets `currentStage` on patch object |
| Routes | Hardcoded Zod stage enum; create sets initial stage |
| Frontend | No `currentStage` consumers; uses drawType/phase/roundName for display |
| Knockout plan / OBS | Round names — leave alone |

---

## 14. Related docs

- `docs/superpowers/specs/2026-08-03-tournament-engine-p0-2-audit.md` — P0.2 engine audit
- Next: P0.4 Tournament Stage Machine (separate design)
