# EPIC-10 — Presentation Engine Foundation

**Date:** 2026-08-05  
**Status:** DESIGN APPROVED (Modified) — Architecture Frozen · Testing §13 APPROVED (Modified) · Spec ready for implementation planning  
**Depends on:** Platform Architecture Freeze (EPIC-01…09); especially EPIC-02 (catalog bindings), EPIC-08 (Runtime Match), EPIC-09 (Rule Engine pattern)  
**Scope:** Typed Presentation product assets (Definitions, Tokens, Styles, Features, Regions, Slots, Profiles) + one sport-/surface-agnostic Presentation Engine + optional Capability Compiler + Platform APIs + Catalog façades  
**Non-goals:** Broadcast/OBS/LED/scoreboard/streaming/UI behaviour changes; Presentation Session runtime; Snapshot presentation bodies; renderer cutover; `PresentationEngine.replay` implementation; Presentation Cache infra

---

## 1. Objective

EPIC-02 introduced Presentation Profile **identity stubs**.  
EPIC-08 freezes presentation **refs** on Runtime Snapshot.  
EPIC-09 established the Rule Engine pattern (verify → resolve → compile → executable contract).

EPIC-10 creates the **Presentation Engine** — the presentation twin of the Rule Engine — and the missing **typed presentation product layer**.

```
Presentation Engine owns resolution. It does not own rendering.

Presentation Engine answers:  "What should be presented?"
Capability Compiler answers:  "How much can this consumer support?"
Consumers answer:             "Paint Slot → Widget."
```

**EPIC-10 is dark-launched:** fully available, fully tested, **zero surface consumers**.

Architecture correctness takes priority over implementation speed.

---

## 2. Decision record

### 2.1 Audit summary

| Finding | Evidence |
|---------|----------|
| No Presentation Engine | No module/symbol; surfaces never resolve profiles for paint |
| Presentation Profiles are stubs | `preview?: Record<string, unknown>` only — no typed bodies |
| Systemic duplication | Themes, layouts, sponsors, typography, safe areas across LED/OBS/scoreboards |
| Directors own scene timing locally | Auction/badminton broadcast directors |
| Snapshot has `presentationProfile` FrozenRef | Refs only — no bodies (correct) |
| All renderers work without an engine | Production path today |

### 2.2 Chosen approach — Architecture Validation (Modified)

| Decision | Freeze |
|----------|--------|
| **T1 = A** | Same epic: Presentation Definitions (product) **and** Presentation Engine (computation) |
| Definitions vs Profiles | Definitions own semantics; Profiles only assign values |
| Input | Runtime Snapshot (verify) + Presentation Resolution Context (refs-only) |
| Dual artifacts | `ResolvedPresentationSnapshot` → Semantic Compiler → `ResolvedPresentationContract` |
| Capability | Separate Capability Compiler after semantics; optional |
| Cache | Outside engine; engine pure without cache |
| Scope | Capability only; dark launch |
| T8 | No consumer-name branching; capabilities via catalog Capability Profiles |

### 2.3 Downstream chain (frozen)

```
Presentation Definitions / Tokens / Styles / Features / Regions / Slots
  → Presentation Profiles
    → Runtime Snapshot + Presentation Resolution Context
      → Presentation Engine
        → ResolvedPresentationContract
          → (optional) Capability Compiler → AdaptedPresentationContract
            → Broadcast · OBS · LED · Scoreboards · Streaming · Mobile · Web · TV
```

Nothing downstream may resolve Presentation Profiles directly (target law; cutover later).

---

## 3. Permanent architecture boundary

```
Product Layer
  CatalogRegistry (discovery)
  Presentation Definitions · Tokens · Styles · Features · Regions · Slots · Profiles
  Capability Definitions · Capability Profiles
  Runtime Snapshot (EPIC-08 — refs verify)
  Presentation Resolution Context
  Presentation Engine (computation)
  Capability Compiler (adaptation only)
        ↓
==================== Compatibility Boundary ====================
  Local themes / directors (transitional until cutover)
        ↓
Surfaces (unchanged this epic)
  Broadcast · OBS · LED · Scoreboards · Streaming · UI
```

**Permanent rules:**

1. One Presentation Engine — never surface-specific engines.  
2. Engine never reads sport tables, DB, renderer packages, or OBS/LED configs.  
3. CatalogRegistry → PresentationEngine only (one-way).  
4. Every Phase A path → `PresentationEngine.resolve()`.  
5. Capability Compiler accepts **Contract only** — never Snapshot/Profile/Context.  
6. Contract is semantic: regions/slots/tokens/styles/features — never pixels, CSS, React, OBS JSON, binary assets.  
7. Consumers map **Slot → Widget** only; never Region → Widget as the mount boundary.  
8. Diagnostics are descriptive, never prescriptive.  
9. Snapshot remains renderer-independent forever (no adaptedContractId / rendererId / adaptationHash on Snapshot).

---

## 4. Ownership

| Owner | Owns | Must not own |
|-------|------|--------------|
| **Presentation Definitions** | Semantics (region kinds, token types, style schemas, feature/slot capabilities, validation, deps, conflicts) | Profile values, rendering |
| **Presentation Profiles** | Value choices only | Redefining semantics |
| **CatalogRegistry** | Discovery | Computation |
| **Presentation Engine** | Inheritance, dual graphs, conflicts, validation stages, Semantic Compilation, diagnostics | Rendering, animation execution, OBS/LED paint, caching, Snapshot freeze |
| **Capability Compiler** | Disable/omit unsupported optionals; adaptation diagnostics / `adaptationHash` | Substituting/transforming semantics; Phase A mutation |
| **Runtime Match** | Snapshot refs / Context bindings | Presentation bodies / contracts |
| **Future Session Bootstrap** | Compose `ResolvedRuntimeRules` + `ResolvedPresentationContract` | Being inside either engine |
| **Future Presentation Session** | Bind one immutable Contract for a session | Re-resolving mid-session |
| **Consumers** | Slot→Widget paint; rendering state (animation/viewport) | Presentation policy authority; mutating contracts; traversing engine graphs for execution |

**Laws:**

- Presentation Engine owns the **layout dependency graph**, not rendering / paint order.  
- Dependency graph order ≠ render order.  
- Rule Engine and Presentation Engine never invoke each other.  
- Consumers are **stateless w.r.t. presentation policy**; they may hold rendering state only.

---

## 5. Identity and storage

### 5.1 Concepts

| Concept | Kind |
|---------|------|
| Presentation Engine | Domain module |
| Presentation Definition / Token / Style / Feature / Region / Slot | Catalog product assets |
| Presentation Profile | Catalog product asset (family@version) |
| Capability Definition / Capability Profile | Catalog-backed consumer capability assets |
| Runtime Snapshot | EPIC-08 refs |
| Presentation Resolution Context | Immutable serializable metadata |
| ResolvedPresentationSnapshot | Product artifact + provenance |
| ResolvedPresentationContract | Executable semantic contract |
| AdaptedPresentationContract | Post-capability view (same vocabulary) |
| PresentationEngineDiagnostics | Immutable descriptive reports |
| Presentation Session (reserved) | Future session binding one Contract |

### 5.2 Storage (EPIC-10)

| Artifact | Stance |
|----------|--------|
| Catalog assets | In-process CatalogRegistry packs — extend stubs to typed bodies |
| Engine code | `lib/platform-core/src/presentation-engine/` |
| Snapshot | Unchanged — refs only |
| Context / Contracts / Diagnostics | Ephemeral |
| Cache / Presentation Session | Not implemented |

No new identity tables. No presentation value copies on Snapshot.

---

## 6. Semantic stack

```
Definitions → Tokens → Styles → Features → Regions → Slots → Consumers (Slot→Widget)
```

| Layer | Role |
|-------|------|
| **Tokens** | Atomic vocabulary (`color.primary`, `font.score`, …) |
| **Styles** | Named collections of tokens |
| **Features** | Enablement units; own enablement via `FeatureState` |
| **Regions** | Structural semantic spaces only — **no enablement field**; no visual props |
| **Slots** | What may occupy a region; reference Features; **renderer boundary** |

Regions never know widgets. Contracts never contain z-index, opacity, rotation, transform, margin, padding, assets, URLs, CSS, or UI framework types.

---

## 7. Pipeline

### 7.1 Phase A — Presentation Engine

```
Runtime Snapshot + Presentation Resolution Context
  → Input Validation
  → Compatibility Validation
  → Structural Validation
  → Semantic Resolution (merge · graphs · policies · FeatureState · SlotState)
  → ResolvedPresentationSnapshot
  → Semantic Compiler (irreversible)
  → ResolvedPresentationContract
```

**CompilationMode:** `NONE` | `AUTO` | `REQUIRED` (replaces boolean `compile`).

Mode affects only: validation strictness, Snapshot requirement, compilation default.

### 7.2 Phase B — Capability Compiler (optional)

```
ResolvedPresentationContract + PresentationCapabilityProfile (catalog)
  → Capability Compiler
  → AdaptedPresentationContract
```

May only **disable / omit / diagnose**. Never substitute, transform, or reinterpret semantics.  
Optional capabilities → omit only. Required missing → block that consumer.  
Phase B diagnostics are a **new** object — never mutate Phase A diagnostics.

### 7.3 Inheritance / override order

```
Platform Defaults
  → Sport Defaults
  → Variant Defaults
  → Presentation Profile
  → Competition Overrides
  → Tournament Overrides
  → Match Overrides
  → ResolvedPresentationSnapshot
```

- Overrides never create definitions.  
- Snapshot is not a merge layer.  
- Capability Profile is not a merge layer and must not enter Phase A.

### 7.4 Dual graphs

| Graph | Purpose |
|-------|---------|
| **Layout Graph** | Region/slot/feature layout dependencies |
| **Style Graph** | Style → token dependencies |

Each exposes nodes, edges, topologicalOrder (dependency order ≠ paint), and **`graphHash`**.

---

## 8. ResolvedPresentationContract

### 8.1 Properties

Immutable · self-contained · deterministic · renderer-agnostic · no provenance · no assets/UI types · stands alone without capability adaptation · irreversible from Semantic Compiler.

### 8.2 Mandatory fields (conceptual)

```
ResolvedPresentationContract {
  schemaVersion
  presentationContractVersion
  semanticHash
  resolutionId
  sportId, variantId, competitionTypeId, matchTypeId?

  tokens[]
  styles[]
  features: FeatureState[]      // enabled | disabled | forced + resolvedBy
  slots: SlotState[]            // occupancy for consumers
  regions: PresentationRegionGraph

  layoutGraph (+ graphHash)
  styleGraph (+ graphHash)

  effective summary (forced values, disabledByDependencies, disabledByConflicts, …)
}
```

```
FeatureState { featureId, state, reasonCode?, reasonPath?, resolvedBy? }
SlotState    { slotId, regionId, occupied, featureId?, reason? }
```

Consumers may read: SlotState, FeatureState, Tokens, Styles.  
Consumers must **not** traverse regions/dependency/conflict/style graphs for execution.

### 8.3 Versions

| Field | Meaning |
|-------|---------|
| `inputVersion` | Input DTO contract |
| `engineVersion` | Engine implementation |
| `schemaVersion` | Serialized envelope / schema |
| `compilerVersion` | Semantic compiler implementation |
| `presentationContractVersion` | Executable semantic contract schema |
| Profile / Capability / ConflictPolicy versions | Catalog documents |

Consumers **MUST** reject incompatible major `presentationContractVersion`.

### 8.4 Hashes

| Hash | Scope |
|------|-------|
| `semanticHash` | Semantic Contract only |
| `adaptationHash` | Adapted contract / capability outcome |
| `graphHash` | Per layout/style graph |
| `resolutionId` | Changes only when semantic Contract changes |

Timings (`durationMs`) never enter hashes.

---

## 9. Conflict resolution

```
Conflict → ConflictPolicy (id, version, priority, strategy) → Resolution Outcome
  → FeatureState / SlotState / forced values
```

Higher priority wins; ties → `conflictPolicyId` → `version`.  
Equal priority same pair → Structural ERROR.  
Not first-wins. Strategies include FAIL, DISABLE_FEATURE, DISABLE_SLOT, FORCE_TOKEN/STYLE, etc.

---

## 10. Validation and diagnostics

### 10.1 Validation stages (four + compatibility gate)

```
Input Validation
  → Compatibility Validation   (Rule Profile, Competition Type, Match Type, Sport, Variant)
  → Structural Validation      (graphs, definitions, slots, regions)
  → Semantic Validation        (tokens, styles, features, policies)
  → (optional) Capability Validation via Capability Compiler
```

**Structural/Input invalid** vs **unresolvable** semantics are distinct failure classes (`EngineIssue.kind`).

Structural/input ERROR ⇒ no authoritative semantic result; no Semantic Compilation.

### 10.2 `EngineIssue`

```
{ kind: "invalid" | "unresolvable" | "warning" | "info"
  severity, origin, path?, code, message }
```

Shared long-term with Rule Engine.

### 10.3 `PresentationEngineDiagnostics`

Unified immutable wrapper including Resolution, Validation, Dependency (dual graphs), Conflict, Compatibility — plus **`StageResult[]`**:

```
StageResult {
  stage, started, completed, success
  warnings[], errors[]
  durationMs?    // per-stage profiling; non-deterministic
}
```

Also `CompilationReport { compiled, compilerVersion, contractVersion, semanticHash, durationMs?, warnings[] }`.

**Law:** Diagnostics never drive execution — only Contract / Adapted Contract do.

---

## 11. Public APIs

### 11.1 Phase A

```
PresentationEngine.resolve(input: PresentationEngineInput): PresentationEngineResult
PresentationEngine.preview(context)   // → resolve
PresentationEngine.validate(input)    // → resolve
```

```
PresentationEngineInput {
  inputVersion
  snapshot: RuntimeSnapshot | null
  context: PresentationResolutionContext
  compilationMode: "NONE" | "AUTO" | "REQUIRED"
  overrideDocuments?
}
```

Input, stage outputs, and Result are **immutable**. No stage mutates Context/Snapshot/Overrides.

**Forbidden:** public stages; `resolveFromDatabase`; `resolveLatest`; capability on Phase A resolve; surface-specific resolve.

### 11.2 Phase B

```
CapabilityCompiler.adapt(
  contract: ResolvedPresentationContract,
  capability: PresentationCapabilityProfile  // catalog-backed
): CapabilityCompilerResult
```

### 11.3 Context builder

```
buildPresentationResolutionContextFromParts(parts)
```

Same conventions as Rule Engine context builders. No DB.

### 11.4 Catalog

Discovery on CatalogRegistry; preview/validate façades → `PresentationEngine.resolve`.  
Organizer UX preserved; typed bodies replace anonymous preview as source of truth.

### 11.5 Platform HTTP

| Route | Role |
|-------|------|
| `POST /presentation-engine/resolve` | Phase A |
| `POST /presentation-engine/validate` | VALIDATE |
| `POST /presentation-engine/adapt` | Phase B |

Platform APIs; idempotent excl. timings; root response includes `engineVersion`, `schemaVersion`, `contractVersion` (when present).  
APIs stop at contracts — never invoke renderers.

### 11.6 Reserved

`PresentationEngine.replay({ input, expectedSemanticHash })` — not implemented in EPIC-10.

---

## 12. Runtime integration (dark launch)

### 12.1 EPIC-10 gate

No Runtime Match prepare dependency. No Broadcast/OBS/LED/scoreboard/streaming/UI behaviour changes. No Contract on Snapshot/Context.

### 12.2 Future session model (reserved)

```
ResolvedRuntimeRules + ResolvedPresentationContract
  → Session Bootstrap (orchestration; engines independent)
  → Presentation Session (one immutable Contract)
  → Consumers Slot → Widget
```

Audit fields only: `presentationResolutionId`, `semanticHash`, `presentationContractVersion` — not full contract bodies.

### 12.3 Consumer laws (future)

- Mount SlotState (+ FeatureState/Tokens/Styles)  
- Never traverse engine graphs for execution  
- Never mutate Contract  
- Never become second presentation authority  
- Optional capability → omit only; never substitute  
- Capability Compiler remains platform infrastructure  
- Semantic presentation cache authority is centralized (not Broadcast-owned)  

### 12.4 Temporary local modules

```
Local themes/directors → deprecated → removed → Engine contracts
```

---

## 13. Testing

> **Section approval:** Testing & verification strategy — **APPROVED (Modified)** 2026-08-05.  
> Many EPIC-10 rules are architectural rather than behavioral; the suite below makes them verifiable.

### 13.1 Pyramid

```
Catalog assets
  → Stages
    → Engine
      → Capability Compiler
        → Public contracts
          → Golden replay
            → Façade parity
              → HTTP
                → Architecture compliance
                  → Determinism stress
                    → Contract backward-compat
                      → Consumer isolation
                        → Package boundaries
                          → Catalog evolution
```

### 13.2 Architecture compliance suite (required)

Dedicated suite — not only unit/integration coverage. Examples that must remain green:

| Check | Intent |
|-------|--------|
| No renderer imports Presentation Engine internals | Production renderer paths must not import `@workspace/platform-core/presentation-engine` or engine internals (dark-launch DoD) |
| No stage exported publicly | Stages are private; only `resolve` / `preview` / `validate` / `adapt` |
| No `resolveLatest()` | Frozen refs only; no “latest” resolution |
| No DB access inside engine | Pure computation; no matchId/database loaders |
| No renderer DTOs in contracts | Contract is semantic — no pixels, CSS, React, assets, surface DTOs |
| No consumer-specific branches | No OBS/LED/Broadcast `if` branches inside Phase A or B; capabilities via catalog Capability Profiles only |

### 13.3 Determinism stress suite (required)

Golden replay is required. Additionally include randomized / repeated execution-order stress:

```
same catalog
same profile
same snapshot
  → resolve 1000×
  → same semanticHash
  → same adaptationHash (when adapted)
  → same resolutionId
```

Catches accidental dependence on map/object iteration order or non-deterministic staging.

### 13.4 Contract backward-compatibility suite (required)

Distinct from golden replay — protects API consumers across serialization boundaries:

```
Contract v1
  → serialize
  → deserialize
  → same semanticHash
```

Every `presentationContractVersion` must verify serialization stability.

### 13.5 Consumer isolation suite (required)

Each renderer capability profile adapts independently:

```
OBS capability → adapt → LED capability unaffected
Mobile capability → adapt → Broadcast unchanged
```

Validates the Capability Compiler boundary: adaptation of one consumer must not mutate shared Phase A contracts or other consumers’ adapted outputs.

### 13.6 Package boundary suite (required)

Because the architecture spans multiple packages, enforce layering over time:

```
presentation-engine ↛ auction-platform
presentation-engine ↛ api-server
presentation-engine ↛ renderer packages
```

### 13.7 Catalog evolution suite (required)

When new catalog assets are added:

```
Definitions → Profiles → Resolution → Compilation
```

must continue to succeed automatically for existing sports/packs. Prevents regressions as sports expand.

### 13.8 Required suites summary (EPIC-10)

| Suite | Intent |
|-------|--------|
| Architecture compliance | §13.2 checks |
| Determinism stress | Resolve 1000× → same hashes / resolutionId |
| Contract backward-compat | Serialize/deserialize → same semanticHash |
| Consumer isolation | OBS/LED/Mobile adaptations do not cross-contaminate |
| Package boundaries | Engine must not import app/renderer packages |
| Catalog evolution | New assets still resolve/compile |
| Dark-launch DoD | **No production renderer path imports `presentation-engine`** |

### 13.9 Reserved (not EPIC-10 implementation)

**Capability version migration tests** — direction reserved:

```
Capability Profile v1
  → Capability Profile v2
  → Adaptation remains deterministic
```

**Shared Engine Conformance suite** — future engines (Rule, Presentation, Workflow, …) should all pass:

| Conformance property | Meaning |
|----------------------|---------|
| Deterministic | Same inputs → same hashes / ids |
| Immutable | Outputs frozen; no in-place mutation |
| Replayable | Serialize input → re-resolve → equal (excl. timings) |
| Versioned | Input/schema/contract/engine versions on I/O |
| Stage-based | Ordered pipeline with diagnostics |
| Pure | No DB, env, or log side effects inside engine |

Presentation Engine is the second implementation after Rule Engine.

---

## 14. Migration

**Phase A (this epic):** Typed catalog + Engine + Capability Compiler + Platform APIs + tests → **dark launched**.  
**Phase B:** Document transitional local modules.  
**Phase C (future cutover):** Session bootstrap, Presentation Session, Slot→Widget cutover, retire local hardcoding.

No tournament data migration required beyond existing profile id/version bindings. No Snapshot schema change.

---

## 15. Forbidden list

| ❌ Forbidden |
|-------------|
| Surface-specific Presentation Engines |
| Snapshot presentation bodies / adapted refs / renderer ids |
| Mutable contracts |
| **Contracts containing runtime state** (permanently forbidden) |
| **Renderer / consumer writes or mutates Contract** (permanently forbidden) |
| Reverse semantic compilation |
| Capability on Phase A; capability substitutes semantics |
| Pixel/CSS/UI/asset leakage in contracts |
| Region enablement; Region→Widget mount boundary |
| Consumer graph traversal for execution |
| `resolveFromDatabase` / `resolveLatest` / public stage bypass |
| Engine↔Engine or Catalog↔Engine recursion |
| Platform API → Renderer |
| Consumer-owned semantic presentation cache authority |
| Env-driven behaviour; log side effects inside engine |
| Consumer-specific branches inside engine (OBS/LED/…) |
| EPIC-10 **production renderer path** import of `presentation-engine` |

---

## 16. Implementation files

```
lib/platform-core/src/catalog/presentation/
  definitions|tokens|styles|features|regions|slots|capabilities/
  cricket|badminton|football/...  (typed bodies)

lib/platform-core/src/presentation-engine/
  index.ts, types.ts, versions.ts, engine.ts, capability-compiler.ts
  context-builder.ts, diagnostics.ts, hash.ts, merge.ts, conflict.ts
  graphs/layout-graph.ts, graphs/style-graph.ts
  stages/input.ts, compatibility.ts, structural.ts
  stages/semantic-resolve.ts, semantic-compile.ts
  conflict-policies/
  __tests__/  (architecture, stress, contract-compat, isolation, boundaries, catalog-evolution)

artifacts/api-server/src/routes/presentation-engine.ts
lib/platform-core/package.json  → "./presentation-engine"
```

### Implementation order (frozen)

Refined to minimize rework:

1. Shared types (`EngineIssue`, asset types, versions, `CompilationMode`)  
2. Catalog assets (Definitions → Profiles → Capability Profiles)  
3. Stage infrastructure  
4. Engine orchestration (`resolve`)  
5. Semantic Compiler  
6. Capability Compiler  
7. HTTP  
8. Golden replay  
9. Architecture / stress / contract-compat / isolation / boundary / catalog-evolution suites  
10. Exports + package surface  

---

## 17. Definition of Done

- [ ] Typed catalog presentation assets + capability catalog  
- [ ] `PresentationEngine.resolve` sole Phase A entry; immutable I/O  
- [ ] Pipeline Input → Compatibility → Structural → Semantic → Semantic Compilation  
- [ ] `CompilationMode` NONE|AUTO|REQUIRED  
- [ ] Contract with FeatureState (`resolvedBy`), SlotState, dual graphs + graphHash  
- [ ] Irreversible Semantic Compiler; `semanticHash` / `resolutionId`  
- [ ] CapabilityCompiler.adapt (Contract only); `adaptationHash`; separate diagnostics  
- [ ] Platform HTTP resolve/validate/adapt + root version metadata  
- [ ] Architecture, stress, contract-compat, isolation, package-boundary, catalog-evolution tests green  
- [ ] **Architectural dark-launch DoD (verifiable):** no production renderer path may import `presentation-engine` during EPIC-10  
- [ ] Forbidden list enforced (incl. no consumer mutation of contracts; no runtime state in contracts)  
- [ ] No presentation merge/inheritance/dependency/conflict logic outside Presentation Engine  
- [ ] This Design Spec approved  

---

## 18. Constitutional summary

> **Definitions define. Profiles choose.  
> Presentation Engine resolves. Capability Compiler adapts.  
> Contracts authorize presentation. Consumers paint slots.  
> Snapshot verifies — never merges.  
> One immutable contract per presentation session.  
> Consumers never become a second presentation authority.  
> Dark launch before cutover.**

---

## 19. Related documents

| Document | Role |
|----------|------|
| `docs/superpowers/specs/2026-08-05-platform-architecture-freeze.md` | Constitution |
| `docs/superpowers/specs/2026-08-04-rule-profile-system-foundation-epic-02-design.md` | Catalog / Rule Profiles pattern |
| `docs/superpowers/specs/2026-08-05-runtime-match-foundation-epic-08-design.md` | Snapshot refs |
| `docs/superpowers/specs/2026-08-05-rule-engine-foundation-epic-09-design.md` | Engine pattern twin |
| `docs/cricket-platform-master-plan.md` §12 | Aspirational presentation packs (historical) |

---

## 20. Spec self-review notes

- T1=A and Definitions/Profiles law explicit  
- Phase A vs Phase B / Capability Compiler isolation explicit  
- Tokens → Styles → Features → Regions → Slots stack complete  
- Dual graphs, FeatureState/SlotState, dual hashes included  
- Four validation stages + Compatibility gate  
- Testing §13 APPROVED (Modified): architecture, stress, contract-compat, isolation, boundaries, catalog evolution; reserved migration + engine conformance  
- Forbidden list extends consumer-mutation + runtime-state-in-contract bans  
- Implementation order refined (shared types → … → golden → suites → exports)  
- Dark-launch DoD verifiable via architecture suite (no renderer imports)  
- No TBD on constitutional laws; cutover/session/replay/capability-migration reserved clearly  
