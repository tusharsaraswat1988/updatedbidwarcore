# EPIC-09 — Rule Engine Foundation

**Date:** 2026-08-05  
**Status:** DESIGN APPROVED (Modified) — Architecture Frozen · Implementation in progress (dark launch)  
**Depends on:** Platform Architecture Freeze (EPIC-01…08); especially EPIC-02 (Rule Profiles) and EPIC-08 (Runtime Match)  
**Scope:** One sport-agnostic Rule Engine that transforms Runtime Snapshot + Rule Resolution Context into immutable `ResolvedRuntimeRules`, with unified diagnostics, Platform APIs, and Catalog façades  
**Non-goals:** Scoring cutover, reducer changes, badminton/cricket runtime behaviour changes, sessions/events/broadcast/statistics wiring, Rule Cache implementation, Rule Builder UI, Snapshot rule-body storage, Runtime Match prepare dependency on Rule Engine

---

## 1. Objective

EPIC-02 created the **Rule Profile Product Layer**.  
EPIC-08 created the **Runtime Execution Contract**.  
EPIC-09 creates the **Rule Engine** — the bridge between Product Rules and Scoring Engines.

At the end of this epic BidWar has **one** Rule Engine that can produce executable rules for every downstream engine. Scoring, Broadcast, Statistics, Analytics, and AI must all eventually consume the same immutable `ResolvedRuntimeRules`.

**EPIC-09 is dark-launched:** fully available, fully tested, **zero runtime consumers**.

Architecture correctness takes priority over implementation speed.

```
Rule Engine owns resolution. It does not own execution.

Rule Engine answers:  "What are the rules?"
Scoring answers:      "Execute those rules."
```

---

## 2. Decision record

### 2.1 Audit summary

| Finding | Evidence |
|---------|----------|
| No dedicated Rule Engine today | No `RuleEngine` symbol; scoring never calls resolve |
| EPIC-02 preview/validate resolver exists | `resolveRuleProfile` — `CREATE`/`MATCH_START` return `MODE_UNSUPPORTED` |
| Rule values duplicated | Catalog + badminton presets + cricket `?? 20` / `maxWickets: 10` + adapters + `tournamentRules` |
| Badminton bypasses profiles | `resolveBadmintonMatchFormat` → `STANDARD_FORMAT` cascade |
| Cricket bypasses profiles | Create/project defaults; catalog packs unused at runtime |
| Inheritance duplicated | Product resolver layers vs badminton `resolveInheritedFormat` |
| Validation duplicated | Catalog typed validation vs format normalize vs scoring Zod vs runtime ref-lock |
| Runtime Snapshot insufficient alone | Refs only — no sport/variant/overrides/values (by design) |
| Engines execute without Rule Engine | Production path today |

### 2.2 Chosen approach — Architecture Validation (Modified)

| Decision | Freeze |
|----------|--------|
| **T1 Input** | Hybrid: `RuntimeSnapshot` + `RuleResolutionContext` (refs-only metadata). Engine does not read Tournament/Match Views at resolve time. No rule copies on Snapshot. |
| **T2 Output** | Two distinct artifacts: `ResolvedRuleSnapshot` (product) → Compilation → `ResolvedRuntimeRules` (executable). Scoring never receives Snapshot. |
| **T3 Order** | Snapshot is **not** a merge layer; it verifies identity only. |
| **T4 Scope** | Capability only — no scoring/reducer/runtime behaviour changes. |
| **T5 Ownership** | Exactly one place for inheritance, dependency, conflict, validation — the Rule Engine. |
| **Determinism** | Referentially transparent; deterministic ordering; cache outside engine. |
| **Diagnostics** | Unified immutable `RuleEngineDiagnostics`. |

### 2.3 Downstream chain (frozen)

```
Catalog
  → Rule Engine
    → ResolvedRuntimeRules
      → Scoring Engine
        → Statistics Engine
          → Broadcast Engine
            → Analytics Engine
```

Never bypass Rule Engine. Never let Scoring consume Rule Profiles directly.

---

## 3. Permanent architecture boundary

```
Product Layer
  Catalog Definitions · Rule Profiles · CatalogRegistry (discovery)
  Runtime Snapshot (EPIC-08 — refs verify)
  Rule Resolution Context (refs-only resolution metadata)
  Rule Engine (computation)
    Verification → Resolution → Compilation
    → ResolvedRuleSnapshot
    → ResolvedRuntimeRules
    → RuleEngineDiagnostics
        ↓
==================== Compatibility Boundary ====================
  Temporary RuntimeAdapters (transitional — deprecate → remove)
        ↓
Runtime Layer (unchanged this epic)
  Scoring engines · sessions · events · broadcast · stats
```

**Permanent rules:**

1. Rule Engine is sport-agnostic. Sports plug into the engine via catalogs; the engine never plugs into sports.  
2. Rule Engine never reads badminton/cricket/sport tables.  
3. Rule Engine never loads persistence (`resolveFromDatabase` forbidden).  
4. CatalogRegistry owns **discovery**; Rule Engine owns **computation**. Dependency is strictly one-way: CatalogRegistry → RuleEngine — never RuleEngine → CatalogRegistry → RuleEngine.  
5. Every public resolution path ultimately calls `RuleEngine.resolve()`.  
6. Cache is infrastructure after the engine; engine correctness must not depend on cache.  
7. Temporary RuntimeAdapters are transitional and scheduled for future removal when Scoring consumes Rule Engine directly.

---

## 4. Ownership

| Owner | Owns | Must not own |
|-------|------|--------------|
| **Rule Engine** | Inheritance, dependency DAG, conflict policies, structural + semantic validation, Compilation, `ResolvedRuntimeRules`, diagnostics | Execution, scoring, broadcast, stats, scheduling, fixtures, match identity, rule editing, catalogs, Snapshot freeze, caching, logging to external systems |
| **Catalog / EPIC-02** | Definitions, Categories, Profiles, discovery via CatalogRegistry | Execution computation (façades only) |
| **Runtime Match / EPIC-08** | Snapshot, Runtime Context, Phase, History | Rule values, inheritance, executable rules |
| **Caller** | Assembling serializable `RuleResolutionContext` from already-loaded parts | Engine-internal stages |
| **Optional Rule Cache (future)** | Store/retrieve by deterministic key | Resolution |
| **Scoring / Broadcast / Stats / AI (future)** | Consume `ResolvedRuntimeRules` | Resolving profiles |

**Single-owner law:** No code outside Rule Engine contains merge, inheritance, dependency resolution, or conflict resolution logic.

---

## 5. Identity and storage

### 5.1 Identities / value objects

| Concept | Kind | Notes |
|---------|------|-------|
| Rule Engine | Domain module | Not a Match/Tournament-like identity; one platform module |
| Runtime Snapshot | EPIC-08 | Verifies frozen refs; no values |
| Rule Resolution Context | Immutable serializable metadata | Refs only; no rule values; no executable rules |
| ResolvedRuleSnapshot | Product resolution artifact | Provenance kept; not for Scoring |
| ResolvedRuntimeRules | Executable contract | Self-contained; sole rule authority for an execution session (future) |
| RuleEngineDiagnostics | Immutable report snapshot | New object per resolve; never incremental mutation |
| RuleEngineResult | Immutable serializable value object | Replayable; hashable excluding `durationMs` |

**Neither Runtime Context nor Rule Resolution Context may contain executable rules.**

### 5.2 Storage stance (EPIC-09)

| Artifact | Storage |
|----------|---------|
| Engine code/contracts | `lib/platform-core/src/rule-engine/` |
| Catalog assets | Existing CatalogRegistry packs |
| Runtime Snapshot | Unchanged (EPIC-08) |
| RuleResolutionContext | Ephemeral; Runtime History may later record **identity only** (not contents) |
| ResolvedRuleSnapshot / ResolvedRuntimeRules | Ephemeral engine outputs — no new tables |
| Rule Cache | Not implemented; not part of engine architecture |

No new identity tables. No rule value copies on Snapshot. No Rule Engine database.

---

## 6. Pipeline

### 6.1 Three stages (frozen)

```
Runtime Snapshot
      +
Rule Resolution Context
      ↓
Verification Stage     (structural validation; Snapshot verify before catalog load)
      ↓
Resolution Stage       (merge · DAG · conflicts · semantic validation)
      ↓
ResolvedRuleSnapshot
      ↓
Compilation Stage      (irreversible)
      ↓
ResolvedRuntimeRules
      ↓
Consumers (future)
```

Each stage receives **immutable** input and produces a **new** output object. No stage mutates the previous stage’s object.

**Compilation is irreversible.** `ResolvedRuntimeRules` cannot be converted back into `ResolvedRuleSnapshot`.

### 6.2 Verification before catalog load

```
Snapshot verification
  → Catalog loading
    → Resolution
```

Invalid Snapshot must not trigger unnecessary catalog work.

### 6.3 Override / merge order (value layers only)

```
Platform Defaults
  → Sport Defaults
    → Variant Defaults
      → Rule Profile
        → Competition Overrides
          → Tournament Overrides
            → Match Overrides
              → ResolvedRuleSnapshot
```

- Lower layers win when the same `definitionId` is set.  
- `"inherit"` / omit → fall through.  
- **Overrides must never create new rules** — only override existing Rule Definitions.  
- Runtime Snapshot is **not** a merge layer.

### 6.4 Validation split

| Type | Stage | Authority |
|------|-------|-----------|
| Structural | Verification (before merge) | Profile/refs/graph structure/policy identity |
| Semantic | Resolution (after merge) | Ranges, deps, conflicts, compatibility |

**Constitutional:** A Structural ERROR guarantees that no semantic result can ever be treated as authoritative (skip merge; no Compilation).

### 6.5 Mode behaviour

`resolutionMode` affects **only**:

1. Validation strictness  
2. Snapshot requirement  
3. Compilation default  

No hidden behaviour switches. No sport branching.

| Mode | Snapshot | Compile default |
|------|----------|-----------------|
| `PREVIEW` | Optional | **No** (unless explicitly requested) |
| `VALIDATE` | Optional | No |
| `CREATE` | Optional | Yes if `ok` |
| `PREPARE` | Required | Yes if `ok` |
| `MATCH_START` | Required | Yes if `ok` |

---

## 7. Rule Resolution Context

```
RuleResolutionContext {
  sportId: string
  variantId: string
  competitionTypeId: string
  ruleProfile: FrozenRef
  tournamentOverrideRef?: FrozenRef
  competitionOverrideRef?: FrozenRef
  matchOverrideRef?: FrozenRef
  resolutionMode: ResolutionMode
}
```

- Fully **serializable** and replayable (byte-comparable).  
- No rule values; no duplicated configuration; no runtime table access.  
- Pure helper allowed: `buildRuleResolutionContextFromParts(parts)`.  
- Forbidden: `buildRuleResolutionContextFromMatchId` / any DB load inside engine.

`ResolutionMode = PREVIEW | VALIDATE | CREATE | PREPARE | MATCH_START`

---

## 8. Executable contract — ResolvedRuntimeRules

### 8.1 Constitutional properties

- Immutable  
- Self-contained (Scoring must never ask CatalogRegistry another question)  
- No provenance, no `"inherit"`, no profile required for execution  
- Deterministic ordering of all collections  
- Referentially transparent production from inputs  
- Sole rule authority for an execution session (future cutover)  
- Compilation strips all inheritance information  

### 8.2 Mandatory top-level fields

```
ResolvedRuntimeRules {
  schemaVersion: string
  runtimeRulesVersion: string
  rulesHash: string
  resolutionId: string
  sportId: string
  variantId: string
  competitionTypeId: string
  rules: readonly ExecutableRule[]    // sorted by definitionId
  effective: {
    enabledDefinitions
    disabledDefinitions
    forcedValues
    disabledByDependencies
    disabledByConflicts
  }
}
```

```
ExecutableRule {
  definitionId: string
  definitionVersion: string   // pin; not a live catalog lookup
  value: ConcreteRuleValue    // final only
}
```

### 8.3 Version fields (do not conflate)

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Wire/envelope schema |
| `runtimeRulesVersion` | Executable contract schema |
| `engineVersion` | Rule Engine implementation (on Result / ResolutionReport) |
| Rule Profile `version` | Product policy document |
| ConflictPolicy `version` | Policy document |
| `inputVersion` | `RuleEngineInput` contract version |

**Scoring MUST reject incompatible major `runtimeRulesVersion` values.**

### 8.4 resolutionId

- Deterministic  
- Changes **only** when `ResolvedRuntimeRules` would change  
- Never affected by timestamps / `durationMs` / localization  

### 8.5 Session authority (future)

After `ResolvedRuntimeRules` is produced for an execution session:

- No further Rule Engine invocation during that session unless a new execution cycle begins  
- A failed `MATCH_START` must never silently reuse a previously compiled contract — a fresh successful resolution is required  
- During execution, nobody may ask Catalog / Profiles / Tournament / Match / Snapshot for rule decisions — only `ResolvedRuntimeRules`  

---

## 9. Dependency graph

- Modeled as a **DAG** — never recursive runtime evaluation  
- Engine resolves the graph **once**; Scoring never traverses dependencies  
- Every dependency edge must reference an existing Rule Definition — dangling edges are **structural ERROR**  
- Cycles are structural ERROR (`DEPENDENCY_CYCLE`)  
- Topological order is stable (tie-break `definitionId`) and exposed on `DependencyReport.topologicalOrder`  

---

## 10. Conflict resolution

```
Conflict detected
  → Conflict Policy (identity + version + priority + strategy)
    → Resolution Outcome
      → Applied in Resolution Stage
        → Folded into ResolvedRuntimeRules.effective
```

- Not “first rule wins”  
- **ConflictPolicy** has explicit identity: `conflictPolicyId`, `version`, `priority`, `strategy`  
- **Higher priority wins**; ties → `conflictPolicyId` → `version` (deterministic)  
- Two policies for the same normalized pair at the same priority → **structural ERROR** (`CONFLICT_POLICY_COLLISION`)  
- Conflict policies themselves must never conflict  

Strategies include: `FAIL`, `DISABLE_LEFT`, `DISABLE_RIGHT`, `DISABLE_DEPENDENT`, `FORCE_VALUE`, `PREFER_LAYER` (extensible).

---

## 11. Diagnostics and error model

### 11.1 ValidationIssue

```
{
  severity: "ERROR" | "WARNING" | "INFO"
  code: string
  message: string          // stable template; localization may vary render only
  path?: string
  origin?: "definition" | "profile" | "override" | "dependency"
         | "conflictPolicy" | "snapshot" | "context" | …
}
```

### 11.2 RuleEngineDiagnostics (immutable wrapper)

```
RuleEngineDiagnostics {
  resolution: ResolutionReport      // includes engineVersion, resolutionId, stagesCompleted, …
  validation: ValidationReport      // structural[] + semantic[]
  dependency: DependencyReport      // nodes, edges, results, topologicalOrder
  conflict: ConflictReport          // policiesApplied, outcomes
  compatibility: CompatibilityReport
}
```

- Diagnostics are **immutable snapshots** — never incremental mutation  
- New resolve → new diagnostics object  
- Deterministic codes, paths, ordering  
- Diagnostics are **outputs**, not side effects — Rule Engine must not log to external systems  

### 11.3 Fail-closed model

| Failure | Behaviour |
|---------|-----------|
| Structural | No merge; no Compilation; semantic outputs non-authoritative |
| Semantic | Snapshot may exist for diagnosis; no `ResolvedRuntimeRules` |
| Success | Snapshot + Compilation per mode |

### 11.4 Compatibility dimensions

- Sport / variant / competition type  
- Definition pins  
- ConflictPolicy scope  
- **`runtimeRulesVersion` major compatibility** (consumers must reject unsupported majors)  

---

## 12. Public APIs

### 12.1 Primary API

```
RuleEngine.resolve(input: RuleEngineInput): RuleEngineResult
```

```
RuleEngineInput {
  inputVersion: string
  snapshot: RuntimeSnapshot | null
  context: RuleResolutionContext
  compile?: boolean    // overrides mode default
}
```

```
RuleEngineResult {
  ok: boolean
  resolutionId: string | null
  engineVersion: string
  resolvedRuleSnapshot: ResolvedRuleSnapshot | null
  resolvedRuntimeRules: ResolvedRuntimeRules | null
  diagnostics: RuleEngineDiagnostics
  durationMs?: number   // diagnostic only; never in hashes; never for Scoring; non-deterministic
}
```

`RuleEngineResult` is an immutable, serializable, replayable value object.

### 12.2 Convenience wrappers only

- `RuleEngine.preview`  
- `RuleEngine.validate`  

**Never public:** `compile()`, `merge()`, `resolveStage()`, `resolveFromDatabase()`.

### 12.3 Catalog façades

```
CatalogRegistry.resolveRuleProfilePreview → RuleEngine.resolve(PREVIEW) → map to ResolveResult
```

Organizer UX / `ResolveResult` contract preserved (Architecture Freeze).

### 12.4 Platform HTTP APIs

| Route | Role |
|-------|------|
| `POST /rule-engine/resolve` | Platform API |
| `POST /rule-engine/validate` | Platform API |

- Explicitly **Platform APIs**, not Organizer-only features  
- **Idempotent:** identical input ⇒ identical output excluding diagnostic timing metadata (`durationMs`)  

### 12.5 Engine purity

Rule Engine is **referentially transparent**: same input ⇒ same output, without side effects.

Forbidden:

- Environment variables altering rule behaviour (configuration belongs to Catalogs)  
- External logging side effects from inside the engine  
- Mutation of returned `ResolvedRuntimeRules` by runtime consumers  

---

## 13. Runtime integration (capability only)

### 13.1 EPIC-09 scope gate

| Action | EPIC-09 |
|--------|---------|
| Implement Rule Engine + contracts + tests | Yes |
| Platform HTTP + Catalog façades | Yes |
| Dark launch (zero runtime consumers) | Yes |
| Runtime Match prepare depends on Rule Engine | **No** |
| Scoring / Broadcast / Stats wiring | **No** |
| Persist rules on Snapshot | **No** |

**No existing runtime service becomes dependent on Rule Engine in EPIC-09.**

### 13.2 Future Scoring

- Receives `ResolvedRuntimeRules` only  
- MUST reject incompatible major `runtimeRulesVersion`  
- Never resolves profiles/catalogs  

### 13.3 Future Statistics / Broadcast

- Never infer rules from events or Catalog  
- Rule-related facts come from `ResolvedRuntimeRules` only  
- Record `resolutionId` / `rulesHash` for reproducibility  

### 13.4 Temporary RuntimeAdapters lifecycle

```
Temporary RuntimeAdapters → deprecated → removed
  → Scoring consumes Rule Engine directly
```

---

## 14. Testing

### 14.1 Pyramid

1. Stage unit tests (verify / resolve / compile)  
2. Engine integration tests  
3. **Public contract tests** (Input DTO → Output DTO → serialization → version compatibility)  
4. Golden replay tests  
5. Façade parity tests  
6. Platform HTTP idempotency tests  

### 14.2 Golden replay requirements

- Serialize input → resolve → serialize result (exclude `durationMs`) → reload → same deterministic fields  
- Include isolation case: resolve under Catalog v1; upgrade **unrelated** catalog assets; replay ⇒ **same** output  

### 14.3 Constitutional tests

- Single-owner: no merge/inheritance/dependency/conflict logic outside `rule-engine/`  
- All public paths delegate to `RuleEngine.resolve`  
- Structural ERROR invalidates semantic authority  
- Conflict policy collisions  
- Override cannot create definitions  

---

## 15. Migration

### Phase A — Introduce (this epic)

1. Add `rule-engine/` module  
2. Move/extend computation from `catalog/resolve` into engine stages  
3. CatalogRegistry façades → RuleEngine  
4. Platform HTTP  
5. Tests (including golden replay + contract tests)  

**No data migration. No Snapshot schema change. No scoring_matches change.**

**End of Phase A:** Rule Engine is **dark launched** — fully available, fully tested, zero runtime consumers.

### Phase B — Capability freeze

Adapters remain transitional; documented for removal.

### Phase C — Future cutover epic (out of scope)

Wire `MATCH_START` / prepare; Scoring consumes `ResolvedRuntimeRules`; retire presets/`rules_json`/`tournamentRules` as sources of truth; remove adapters.

---

## 16. Forbidden list

| ❌ Forbidden |
|-------------|
| Sport-specific Rule Engines |
| Second inheritance / validation engine |
| Runtime-owned Rule Profiles / rule copies on Snapshot |
| Snapshot as merge layer |
| Scoring/Broadcast/Stats resolving profiles |
| Mutable resolved rules or diagnostics |
| Reverse compilation |
| `resolveFromDatabase` / persistence loaders in engine |
| Cache-dependent correctness |
| Executable rules in Runtime Context or RuleResolutionContext |
| Public stage/merge/compile APIs |
| Public resolve path not delegating to `RuleEngine.resolve` |
| Overrides creating Rule Definitions |
| Dangling dependency edges |
| Equal-priority conflicting ConflictPolicies |
| Env-driven rule behaviour |
| External logging side effects inside engine |
| Mutating `ResolvedRuntimeRules` at integration boundary |
| Recursive CatalogRegistry ↔ RuleEngine resolution |
| EPIC-09 runtime service hard dependency on Rule Engine |
| Silent reuse of prior runtime rules after failed MATCH_START (future) |
| Inferring rules from scoring events (future Statistics) |

---

## 17. Implementation files

```
lib/platform-core/src/rule-engine/
  index.ts
  types.ts
  versions.ts
  engine.ts
  context-builder.ts
  hash.ts
  diagnostics.ts
  merge.ts
  dependency-graph.ts
  conflict.ts
  stages/
    verify.ts
    resolve.ts
    compile.ts
  conflict-policies/
    index.ts
    types.ts
  __tests__/
    verify.test.ts
    resolve-stage.test.ts
    compile.test.ts
    engine.test.ts
    contract.test.ts
    golden-replay.test.ts
    determinism.test.ts
    facade-parity.test.ts

lib/platform-core/src/catalog/registry.ts          # façades
lib/platform-core/src/catalog/resolve/*            # types retained; computation moved/façaded
lib/platform-core/src/index.ts                     # public exports

artifacts/api-server/src/routes/rule-engine.ts     # Platform APIs
artifacts/api-server/src/routes/catalog.ts         # external contract unchanged
artifacts/api-server/src/__tests__/rule-engine.test.ts
```

**Untouched this epic:** `badminton-core`, `scoring-core`, scoring/badminton services cutover paths, `runtime-match` behaviour, RuntimeAdapters implementation (document transitional only).

### Implementation order

1. Types + versions + diagnostics shapes  
2. Verification Stage + structural tests  
3. Merge + DAG + ConflictPolicy registry  
4. Resolution Stage + semantic tests  
5. **Engine orchestration** (`RuleEngine.resolve`)  
6. Compilation Stage  
7. Catalog façades + parity tests  
8. Golden replay + public contract tests  
9. Platform HTTP + idempotency tests  
10. Public exports + this spec (done) / freeze pointer if needed  

---

## 18. Definition of Done

- [ ] `RuleEngine.resolve` is the sole computation entry; all public paths delegate to it  
- [ ] Three immutable stages: Verification → Resolution → Compilation  
- [ ] `ResolvedRuleSnapshot` and `ResolvedRuntimeRules` produced per mode rules  
- [ ] `RuleEngineDiagnostics` complete, immutable, deterministic  
- [ ] Catalog façades preserve organizer `ResolveResult`  
- [ ] Platform `/rule-engine/resolve` + `/validate` live and idempotent  
- [ ] Golden replay + public contract tests green  
- [ ] Unrelated catalog change isolation replay green  
- [ ] No scoring/reducer/runtime behaviour changes  
- [ ] No runtime service hard-depends on Rule Engine (dark launch)  
- [ ] No merge/inheritance/dependency/conflict logic outside `rule-engine/`  
- [ ] Engine is referentially transparent (no env-driven behaviour; no external log side effects)  
- [ ] Forbidden list enforced by tests/review checklist  
- [ ] This Design Spec approved  

---

## 19. Constitutional summary

> **Catalogs define.  
> Rule Engine resolves.  
> ResolvedRuntimeRules authorize execution.  
> Engines execute.  
> Snapshot verifies — never merges.  
> One owner per responsibility.  
> Dark launch before cutover.  
> No layer steals another layer’s job.**

---

## 20. Related documents

| Document | Role |
|----------|------|
| `docs/superpowers/specs/2026-08-05-platform-architecture-freeze.md` | Constitution |
| `docs/superpowers/specs/2026-08-04-rule-profile-system-foundation-epic-02-design.md` | Product rules / ResolveResult |
| `docs/superpowers/specs/2026-08-05-runtime-match-foundation-epic-08-design.md` | Runtime Snapshot / Context |
| EPIC-01…07 design specs | Upstream foundations |

---

## 21. Spec self-review notes

- No TBD placeholders for architectural laws  
- `ResolvedRuleSnapshot` vs `ResolvedRuntimeRules` consistently separated  
- Cache explicitly out of engine architecture  
- EPIC-09 scope gated against cutover  
- Conflict priority frozen (higher wins) — not a recommendation  
- File layout uses `stages/` for scale  
- Public contract tests and dark-launch terminology included  
