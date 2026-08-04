# EPIC-02 — Rule Profile System Foundation

**Date:** 2026-08-04  
**Status:** Implemented (2026-08-04) — design review approved; product layer shipped  
**Depends on:** EPIC-01 (Tournament Creation Foundation / CatalogRegistry)  
**Scope:** Product-layer Rule Profiles, definitions, categories, resolver contracts, validation, read-only APIs, Product Catalog UI  
**Non-goals:** Rule Engine, Scoring Engine changes, Match snapshot persistence, Profile editor / Rule Builder, Rule Profile database tables, replacing badminton `tournamentRules`

---

## 1. Objective

Introduce Rule Profiles as the **canonical Product Definition** of gameplay policy, without disturbing existing badminton or cricket scoring runtimes.

At the end of this epic:

- Every tournament continues to reference a Rule Profile (id + version) via EPIC-01 bindings
- Every Rule Profile is loaded only through `CatalogRegistry`
- Every rule has a typed **Rule Definition** + **Rule Value**
- Rule ownership is centralized in the Platform Product Layer
- Existing engines continue to run exactly as today
- The platform is ready for a future Rule Engine that replaces temporary RuntimeAdapters without changing Tournament Creation, CatalogRegistry public APIs, or organizer selection UI

Architecture correctness takes priority over implementation speed.

---

## 2. Decision record (audit → approach)

### 2.1 Audit summary

| Layer today | Role |
|-------------|------|
| EPIC-01 `CatalogRegistry` rule packs | Identity + untyped `preview` stubs |
| Badminton `match-format` presets → `scoring_settings_json.tournamentRules` → stamped `match_format_json` → reducer | **Live Runtime Rule Provider** (production-proven) |
| Cricket hardcoded defaults + `rules_json` `{ overs?, maxWickets? }` | **Live cricket runtime** (narrow) |
| scoring-core / badminton-core reducers | Execution mechanisms |

**Finding:** There is no single product source of truth for gameplay policy. EPIC-02 establishes it without cutting over runtimes.

### 2.2 Chosen approach

**Approach 1 (approved):** Catalog-owned typed bodies + thin sport RuntimeAdapters under `platform-core/runtime/`, with Badminton Strategy A (Modified):

- Map every badminton preset into a first-class Rule Profile that **references** the existing preset via declarative `runtimeBinding`
- Document cricket current defaults as typed Rule Profiles
- Do **not** replace `tournamentRules`, expand `rules_json`, or change reducers

---

## 3. Permanent architecture boundary

```
Product Layer
  CatalogRegistry
  Rule Definitions / Categories / Profiles
  RuleResolver (ResolveContext → ResolveResult)
        ↓
  ResolvedRuleSnapshot
==================== Compatibility Boundary ====================
  platform-core/runtime/ (temporary)
    RuntimeAdapter contracts
    BadmintonRuntimeAdapter | CricketRuntimeAdapter | FootballRuntimeAdapter
        ↓
Runtime Layer (unchanged this epic)
  Badminton Match Format stack
  Cricket defaults + scoring-core
```

**Permanent rules:**

1. Nothing below the boundary may leak into Product public APIs.
2. Nothing above the boundary may depend on Runtime implementation.
3. Future Rule Engine must accept **exactly** the same `ResolvedRuleSnapshot` contract.
4. Public API ends at `ResolveResult` / `ResolvedRuleSnapshot` — never RuntimeAdapter DTOs.

---

## 4. Ownership

| Owner | Owns | Must not own |
|-------|------|----------------|
| **Platform** | Rule Definitions, Categories, Rule Profiles, CatalogRegistry, Validation, Versioning, Resolve contracts, RuntimeAdapter **contracts** | Scorer execution, reducer math |
| **Sports (runtime)** | Translation (adapters), Runtime DTOs, Reducers, Execution, Scoring behaviour | Profile authorship |
| **Tournament** | `ruleProfileId` + `ruleProfileVersion` (and family id if exposed) | Resolved rule bodies, profile documents |
| **Rule Profiles** | Product policy values + declarative runtime binding metadata | Knowledge of adapters, engines, or classes |

### 4.1 Product vs Runtime source of truth

| Layer | Source of truth until Rule Engine epic |
|-------|----------------------------------------|
| **Product** | Rule Profiles + Rule Definitions |
| **Runtime** | Existing badminton presets / cricket defaults + engines |

```
Product Layer → Rule Profile → Rule Resolver → RuntimeAdapter → Current Engine
```

EPIC-02 builds only the Product Layer (+ disposable adapters under `runtime/`).

---

## 5. Rule Definition vs Rule Value

### 5.1 Rule Definition (Platform, immutable)

Globally unique ids — never short local names.

**Good:** `cricket.match.overs_per_innings`, `cricket.dismissal.lbw_enabled`, `badminton.match.max_points`  
**Bad:** `overs`, `lbw`, `maxPoints`

Every definition includes:

| Field | Notes |
|-------|-------|
| `id` | Globally unique |
| `version` | Semver; breaking changes → new definition version |
| `status` | `active` \| `beta` \| `deprecated` \| `legacy` |
| `name` | Display name |
| `description` | Human-readable |
| `categoryId` | Category registry id |
| `sportId` | Owning sport (definitions are sport-scoped but globally unique) |
| `type` | See §5.3 |
| `defaultValue` | Platform default contribution |
| `allowedValues` | Enum / constrained set when applicable |
| `validation` | Range, required, type constraints — **owned here, not on profiles** |
| `dependencies` | Other definition ids that must be satisfied |
| `conflicts` | Definition ids that cannot coexist |
| `futureCompatible` | Flag / notes for forward-compatible unknown handling |
| `createdAt` / `updatedAt` | Asset metadata |

Profiles reference **definition id + definition version**.

### 5.2 Rule Value (Profile)

Profiles contain values only:

```ts
{
  definitionId: string
  definitionVersion: string
  value: ConcreteValue | "inherit"
}
```

- `inherit` (or omit) → take parent layer value in the resolution pipeline
- Profiles must **never** embed validation logic

### 5.3 Definition value types (extensible)

Supported in the schema from day one (not all used immediately):

`integer` · `boolean` · `enum` · `duration` · `percentage` · `decimal` · `string` · `list` · `object` · `custom`

### 5.4 Categories (registry, not engines)

Categories are **organization / validation / UI / documentation / future Rule Builder** structure — never execution groups.

Category Registry examples: `match`, `batting`, `bowling`, `dismissal`, `boundary`, `ground`, `powerplay`, `tie_break`, `penalty`, `tournament`, `statistics`, `validation`

Consumed via `CatalogRegistry.listRuleCategories()`.

### 5.5 Catalog quality invariant

1. Every Rule Definition must be referenced by **at least one** Profile value (no orphan definitions).
2. Every Profile value must reference an **existing** Definition id+version (no orphan values).

Enforced by catalog tests.

---

## 6. Rule Profile model

### 6.1 Profile Family + Version

Profiles are not unrelated documents. They are:

**Family** + **Version**

Example family: `cricket.outdoor.t20_standard`  
Versions: `1.0.0`, `1.1.0`, `2.0.0`

Upgrade paths and version history UX hang off family identity.

### 6.2 Immutable product asset fields

| Field | Required |
|-------|----------|
| `id` | yes (profile document id; for v1 families equals `familyId`) |
| `version` | yes (semver only) |
| `familyId` | yes (stable family key across versions) |
| `displayName` | yes |
| `description` | yes |
| `status` | `active` \| `beta` \| `deprecated` \| `legacy` |
| `sportId` | yes |
| `supportedVariants` | yes |
| `supportedCompetitionTypes` | yes |
| `tags` | yes |
| `author` | yes |
| `createdAt` / `updatedAt` | yes |
| `values` | yes (typed entries) |
| `runtimeBinding` | yes (declarative metadata) |
| `recommendation` | optional (`auto_suggested` \| `recommended` \| `advanced`) — **selection**, not lifecycle |

**Immutability:** `familyId@version` (and `id@version`) never mutates in place.

| Change | Version bump |
|--------|----------------|
| Correction | `1.0.1` |
| Additive behaviour | `1.1.0` |
| Breaking | `2.0.0` |

Never use `latest`, `v1`, or integer versions.

### 6.3 Status model

| Status | Meaning |
|--------|---------|
| `active` | Lifecycle-healthy; selectable |
| `beta` | Selectable with INFO severity |
| `deprecated` | Hidden from create by default; WARNING if used; readable for history |
| `legacy` | Compatibility-only (e.g. `platform.legacy`) |

EPIC-01 `status: "default"` migrates to `"active"`. “Default selection” remains `recommendation`.

### 6.4 Declarative runtimeBinding (metadata only)

```ts
runtimeBinding: {
  runtimeBindingType: string  // registry key, e.g. "badminton_match_format"
  runtimeBindingId: string    // e.g. "standard_bwf"
  metadata?: Readonly<Record<string, string | number | boolean>>
}
```

**Forbidden on profiles:** class, service, adapter, factory, or any runtime implementation handle.

Binding type registry examples: `badminton_match_format`, `cricket_platform_defaults`, future `rule_engine`.

### 6.5 Remove EPIC-01 preview blobs

| Remove | Replace |
|--------|---------|
| `preview?: Record<string, unknown>` | Typed `values` + definition-backed types |

UI chips derive from typed values / Product Catalog helpers — never anonymous JSON.

---

## 7. Sport strategies

### 7.1 Badminton — reference existing runtime provider

Treat the Badminton Match Format system as the current **Runtime Rule Provider**.

- DO NOT replace, bypass, or rewrite it
- Map every preset into a Rule Profile
- Profile `runtimeBinding` points at the preset id
- Reducer and `tournamentRules` continue unchanged

| Preset | Profile family | `runtimeBindingId` |
|--------|----------------|--------------------|
| `standard_bwf` | `badminton.standard_bwf` | `standard_bwf` |
| `fast_match` | `badminton.fast_match` | `fast_match` |
| `single_game` | `badminton.single_game` | `single_game` |
| `custom` | `badminton.custom` | `custom` |

Typed values document the same numbers as `BADMINTON_FORMAT_PRESETS` / `STANDARD_FORMAT`. Tests assert adapter DTO parity with current presets.

### 7.2 Cricket — document current defaults

Treat current cricket defaults as Platform Default Rules expressed as profiles.

- DO NOT move them into Scoring Engine
- DO NOT expand `rules_json`
- DO NOT change reducers or match create behaviour

Example: `cricket.outdoor.t20_standard@1.0.0` documents overs `20`, max wickets `10`, playing squad `11`, LBW enabled, etc., with `runtimeBindingType: "cricket_platform_defaults"`.

Box / indoor / tennis / custom catalog families remain product documents of intended policy; runtime behaviour stays as today until the Rule Engine epic.

### 7.3 Legacy

Null EPIC-01 bindings continue to resolve via `platform.legacy` / `resolveLegacyBindings`. Status: `legacy`.

---

## 8. Resolution pipeline (contracts)

```
Platform Default
      ↓
Sport Default
      ↓
Variant Default
      ↓
Rule Profile values
      ↓
Tournament Override     ← interface only
      ↓
Match Override          ← interface only; not implemented
      ↓
ResolvedRuleSnapshot
```

Lower layers win on conflict. `inherit` / omitted values fall through.

### 8.1 ResolveContext (single immutable input)

```ts
ResolveContext {
  sportId: string
  variantId: string
  competitionTypeId: string
  profileFamilyId: string
  profileId: string
  profileVersion: string
  tournamentOverrides?: TournamentRuleOverrides  // interface
  matchOverrides?: MatchRuleOverrides            // interface; unimplemented
  resolutionMode: ResolutionMode
}
```

Future extensions are additive fields on this object — not new function parameters.

### 8.2 Resolution modes

| Mode | EPIC-02 |
|------|---------|
| `PREVIEW` | Implemented — full `ResolveResult` |
| `VALIDATE` | Implemented — same `ResolveResult` shape; callers may ignore `snapshot` / `summary` |
| `CREATE` | Interface only — typed mode value; resolver returns unsupported-mode ERROR if invoked |
| `MATCH_START` | Interface only — same |
| `MIGRATION` | Interface only — same |

### 8.3 RuleResolver

```
CatalogRegistry → Rule Profile + Definitions
        ↓
RuleResolver.resolve(ResolveContext) → ResolveResult
        ↓ (internal, optional)
RuntimeAdapter.translate(snapshot) → Runtime DTO
```

**Resolver properties (mandatory):**

- Pure, deterministic, side-effect free
- No I/O beyond in-process catalog reads
- Same Definitions + Profiles + Context ⇒ same snapshot (excluding `resolvedAt`)
- Must not know adapter class names
- Must not persist snapshots or call engines

### 8.4 ResolveResult (permanent public contract)

```ts
ResolveResult {
  snapshot: ResolvedRuleSnapshot
  validation: ValidationIssue[]    // all issues (ERROR + WARNING + INFO)
  warnings: ValidationIssue[]      // convenience: WARNING-severity subset of validation
  summary: ResolveSummary          // human/organizer-oriented brief (counts, profile label, binding ids)
  snapshotHash: string             // same value as snapshot.snapshotHash
}
```

HTTP resolve endpoint returns `ResolveResult`, not a bare snapshot.  
`ok` for validate flows: `validation.every(i => i.severity !== "ERROR")`.

### 8.5 ResolvedRuleSnapshot

| Area | Contents |
|------|----------|
| Identity | `sportId`, `variantId`, `competitionTypeId?`, `profileFamilyId`, `profileId`, `profileVersion` |
| Values | Flat resolved entries with **per-rule provenance** |
| Binding | Declarative `runtimeBinding` copy |
| Provenance | Layers applied; override refs (empty until later) |
| Integrity | `snapshotHash` |
| Metadata | `resolvedAt` (excluded from equality and hash) |

**Per-rule provenance (first-class):**

- `definitionId`
- `definitionVersion`
- `resolvedValue`
- `resolvedFromLayer` (`platform` \| `sport` \| `variant` \| `profile` \| `tournament_override` \| `match_override`)
- `resolvedFromProfile` (family / id / version when layer is profile)

### 8.6 snapshotHash algorithm contract (frozen)

Hash input **only**:

1. Definition versions (pins used)
2. Profile versions
3. Resolved values (canonical serialization)
4. Binding ids (`runtimeBindingType` + `runtimeBindingId`)

**Never include:** `resolvedAt`, timestamps, free-form metadata, non-deterministic fields.

Snapshots are comparable; `resolvedAt` is metadata only.

---

## 9. Validation

Validation belongs to **Definitions** + catalog compatibility — not profile-embedded logic.

### 9.1 Checks

| Check | Severity (typical) |
|-------|--------------------|
| Unknown profile / family / version | ERROR |
| Unknown rule definition / definition version | ERROR |
| Unknown category | ERROR |
| Invalid value (type, range, allowedValues) | ERROR |
| Dependency / conflict violation | ERROR |
| Unsupported sport / variant / competition | ERROR |
| Unsupported `runtimeBindingType` for sport | ERROR |
| Deprecated profile | WARNING |
| Beta profile | INFO |
| Semver caution (optional upgrade notes) | WARNING / INFO |

### 9.2 ValidationIssue

```ts
{
  severity: "ERROR" | "WARNING" | "INFO"
  code: string
  message: string
  path?: string  // definitionId / field
}
```

`ok === false` iff any `ERROR` is present.

### 9.3 Semver helpers

`parseSemver` · `isSemver` · `compareSemver` · `satisfiesSemverRange` · `isCompatibleUpgrade`  
Reject `latest`, `v1`, integers.

---

## 10. RuntimeAdapters (temporary, disposable)

### 10.1 Location

```
lib/platform-core/src/runtime/
  contracts/
  adapters/
    badminton.ts
    cricket.ts
    football.ts
```

**Not** under `catalog/adapters/`. Future Rule Engine replaces `runtime/` without touching `catalog/`.

### 10.2 Rules

| Rule | Detail |
|------|--------|
| Sport-specific | `BadmintonRuntimeAdapter`, `CricketRuntimeAdapter`, `FootballRuntimeAdapter` — never `GenericRuntimeAdapter` |
| Stateless | No cache, persist, mutate, or validation ownership |
| Read-only snapshots | May read snapshots; **must never modify** them |
| Single duty | Translate `ResolvedRuleSnapshot` → existing runtime DTO |
| Internal | Not part of Product public API; not returned over HTTP |

Profiles never know adapters exist.

### 10.3 Disposable guarantee

When Rule Engine ships:

```
ResolvedRuleSnapshot → Rule Engine → Scoring Engine → …
```

Adapters disappear without changing Tournament bindings, CatalogRegistry read APIs, Product Catalog UI selection, or the `ResolvedRuleSnapshot` / `ResolveResult` contracts.

---

## 11. CatalogRegistry public API (additive)

| Method | Role |
|--------|------|
| `listRuleCategories()` | Category registry |
| `getRuleDefinition(id, version?)` | Single definition |
| `getRuleDefinitions({ sportId, categoryId? })` | Filtered definitions |
| `listRuleProfiles(filter)` | Existing; status model updated |
| `getRuleProfile(id, version?)` | Existing |
| `listRuleProfileFamilies` / `listRuleProfileVersions` | Family model |
| `validateRuleProfile` / extended `validateCreateBindings` | Compatibility + definition checks |
| `resolveRuleProfilePreview(ResolveContext)` | Returns `ResolveResult` (`PREVIEW`) |

All consumers use CatalogRegistry. Pack files remain internal.

---

## 12. HTTP APIs (read-only)

| Endpoint | Returns |
|----------|---------|
| `GET /api/catalog/rule-profiles` | Families / profiles for filters |
| `GET /api/catalog/rule-profiles/:id` | Profile asset |
| `GET /api/catalog/rule-definitions` | Definitions |
| `GET /api/catalog/rule-categories` | Categories |
| `POST /api/catalog/rule-profiles/validate` | Issues with severity |
| `POST /api/catalog/rule-profiles/resolve` | **`ResolveResult`** |

No mutation, no editor, no CRUD, no adapter DTOs, no snapshot persistence.

---

## 13. Product Catalog UI (read-only)

Do **not** treat this as a mere “browser.” It is a **Product Catalog** surface for organizers to select Rule Profiles.

**Architecture must allow (not implement now):** search, compare, version history, changelog, preview, compatibility.

**EPIC-02 implements:** read-only selection + inspection of families/versions/categories/typed values/status; optional validate/resolve summary. Reuse tournament-creation wizard step; extract shared Product Catalog component if needed.

**Forbidden:** Rule Builder, profile editing, runtime DTO display, scoring controls.

Data only via CatalogRegistry / read-only APIs.

---

## 14. File layout

```
lib/platform-core/src/
  catalog/
    types.ts
    registry.ts
    index.ts
    categories/
    definitions/
      cricket/
      badminton/
    rules/                    # profile families (typed values)
      cricket/
      badminton/
      football/
    resolve/
      types.ts                # ResolveContext, ResolveResult, snapshot, modes
      resolver.ts
      provenance.ts
      hash.ts                 # snapshotHash per frozen algorithm
    versioning/
    catalog.test.ts
    resolve/*.test.ts
  runtime/
    contracts/
    adapters/
      badminton.ts
      cricket.ts
      football.ts
    *.test.ts                 # DTO parity with presets/defaults
```

Export policy:

- `@workspace/platform-core/catalog` — registry, product types, resolve preview, validation
- `runtime/` — internal (or clearly non-UI path); never returned from Product APIs

API server: thin handlers → CatalogRegistry only.  
Auction platform: Product Catalog UI + wizard reuse.

---

## 15. Migration

| Source | Target | Runtime cutover |
|--------|--------|-----------------|
| Badminton presets | Rule Profiles with binding to preset ids | **None** — `tournamentRules` remains |
| Cricket defaults | Typed outdoor/box/… profiles documenting today’s numbers | **None** — no `rules_json` expansion |
| EPIC-01 `status: "default"` | `active` | Catalog-only |
| EPIC-01 `preview` blobs | Typed values | Catalog-only |
| Null bindings | `platform.legacy` | Existing resolveLegacyBindings |

No data loss. No historical tournament DB rewrite required beyond EPIC-01 null handling.

---

## 16. Dead-code cleanup (last, conservative)

**Remove only when verified:**

- `preview?: Record<string, unknown>` on rule profiles
- `status: "default"` literals after migration to `active`
- Unused duplicate UI constants that invent overs/XI **if** proven unused

**Never remove uncertain code.** Do not remove badminton presets, `tournamentRules`, or cricket reducer constants.

Deliver a short cleanup report.

---

## 17. Testing

| Area | Assert |
|------|--------|
| Catalog loading | Via CatalogRegistry only |
| Orphan invariant | No orphan definitions; no orphan profile values |
| Semver | Reject invalid forms; compare; compatible upgrade |
| Validation severity | ERROR / WARNING / INFO cases |
| Inheritance | `inherit` / omit across layers |
| Determinism | Equal snapshots for equal inputs; stable `snapshotHash`; ignore `resolvedAt` |
| Badminton mapping | Adapter DTO ≡ current presets; create path still binds profile refs |
| Cricket mapping | Profiles document defaults; scoring paths unchanged |
| Legacy | Null → legacy; PREVIEW resolve works |
| API | Read-only; `ResolveResult` shape; no adapter DTOs |
| Regression | Badminton scoring-format + cricket match create |

---

## 18. Explicitly forbidden

- New Rule Engine
- New badminton or cricket reducer
- Rule Profile database tables
- Replacing `tournamentRules`
- Expanding cricket `rules_json` this epic
- Runtime scoring behaviour changes
- Breaking existing badminton tournaments
- UI-owned business rules
- Hardcoded Box Cricket product forks as the policy path
- Copying resolved rules onto Tournament rows
- GenericRuntimeAdapter
- Profiles knowing about adapters

---

## 19. Success criteria

1. Every tournament references a Rule Profile (create path + legacy resolution)
2. Every Rule Profile is loaded through `CatalogRegistry`
3. Every rule has a typed Definition + Value
4. Rule ownership is centralized in the Product Layer
5. No duplicate **product** rule definition systems remain (presets remain runtime providers by design)
6. Platform is ready for Rule Engine via unchanged `ResolvedRuleSnapshot` / `ResolveResult` boundary
7. **Catalog quality:** no orphan Definitions; no orphan Profile values
8. Existing badminton and cricket engines continue running exactly as today

---

## 20. Deliverables checklist

1. Audit Report (captured in design process / §2.1)
2. Rule Source Report (§2.1, §4)
3. Files Modified / Added / Removed (implementation phase)
4. Migration Report (§15)
5. Validation Report (tests + severity matrix)
6. Compatibility Report (badminton/cricket runtime unchanged)
7. Testing Report
8. Architecture Compliance Report (boundary + forbidden list)
9. Dead-code cleanup report (§16)

---

## 21. Implementation order (after spec approval)

1. Types: categories, definitions, profile family/status, ResolveContext, ResolveResult, snapshot, hash contract
2. Definition + category registries; migrate rule packs to typed values; remove preview blobs; `default` → `active`
3. Versioning helpers + validation
4. RuleResolver (PREVIEW / VALIDATE) + determinism / hash tests
5. `runtime/adapters` (badminton + cricket parity tests; football stub)
6. CatalogRegistry additive methods + orphan invariant tests
7. Read-only HTTP APIs
8. Product Catalog UI (read-only) + wizard integration
9. Conservative dead-code cleanup + reports

**Do not start implementation until this spec file is reviewed and approved by the user.**
