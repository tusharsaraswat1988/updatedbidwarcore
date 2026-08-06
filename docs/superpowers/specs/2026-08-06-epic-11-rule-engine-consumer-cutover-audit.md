# EPIC-11 — Rule Engine Consumer Cutover Audit (Revised)

**Date:** 2026-08-06  
**Status:** DESIGN GATE — Architecture Amended · Awaiting Design Proposal approval  
**Scope:** Connect the existing EPIC-09 Rule Engine into the live cricket execution path  
**Non-goals:** Redesign EPIC-09, Runtime Match, Scoring, Reducer mechanisms; implementation; code  
**Authority:** Platform Architecture Freeze (Constitution), Master Plan, EPIC-01→10, PXP, RC Stabilization, Corporate Box Consumer Cutover Trace  
**Precedents:** EPIC-09 dark launch (zero runtime consumers); EPIC-08 Runtime Snapshot (refs only); Corporate Box Execution Trace Report  

**Revision note:** This document supersedes the prior EPIC-11 audit draft. Four architecture amendments OVERRIDE earlier recommendations where they conflict (Prepare optional; Match Start re-resolve; Match Create inventing rules; `rulesJson` as architectural consumer).

---

## Verdict

**`RuleEngine.resolve()` executes exactly once per execution cycle — at mandatory Runtime Prepare — after Snapshot freeze.**

```
Match Create          → identity / participants / metadata / schedule refs only
        ↓
Runtime Prepare       → freeze Snapshot → RuleEngine.resolve(PREPARE)
                      → ResolvedRuntimeRules (authority)
                      → MatchRuntimePolicy (runtime-facing contract)
                      → temporary rulesJson projection (migration bridge only)
        ↓
Runtime Ready         → EPIC-05 lifecycle request only
        ↓
Match Start           → VERIFY ONLY (snapshotVersion / resolutionId / rulesHash)
        ↓
Scoring Session       → consumes MatchRuntimePolicy (+ temp compatibility)
        ↓
Reducer               → never knows Rule Engine
```

**No Runtime Prepare = No Match Start.**  
There must never be a live scoring session without a successful Runtime Prepare.

---

## Architecture amendments (binding)

These OVERRIDE prior audit recommendations.

### Amendment 1 — Runtime Prepare is mandatory

Runtime Prepare is **no longer optional**. It is the **mandatory execution-contract gate**.

```
Match Create
    ↓
Runtime Prepare (mandatory)
    ↓
Runtime Ready
    ↓
Match Start
    ↓
Scoring
```

Laws:

1. No Runtime Prepare ⇒ No Match Start.  
2. There must never be a live scoring session without a successful Runtime Prepare.  
3. Runtime Prepare is the **single place** where the execution contract becomes immutable.  
4. Any prior statement that Prepare is optional, skippable, or substitutable by Match Create / Match Start is **void**.

### Amendment 2 — Match Create must not invent gameplay rules

Current (invalid architecture):

```
Match Create → rulesJson → overs 20 / maxWickets 10 / …
```

New responsibility — Match Create owns **only**:

- Match Identity  
- Participants  
- Metadata  
- Scheduling references  
- Runtime placeholder  

Gameplay rules belong **exclusively** to Runtime Prepare.

Temporary compatibility dual-writes during migration are acceptable **only** as non-authoritative bridges. Match Create must **never** become the authority.

### Amendment 3 — Match Start never resolves

```
Runtime Prepare
  → RuleEngine.resolve()
  → ResolvedRuntimeRules
  → resolutionId
  → rulesHash
  → Runtime Ready
  → Match Start
  → VERIFY ONLY
```

Match Start may verify:

- Snapshot Version  
- ResolutionId  
- RulesHash  

Match Start must **never** call `RuleEngine.resolve()` again.  
Execution contracts are frozen once.

### Amendment 4 — Explicit Runtime Policy layer

Replace:

```
ResolvedRuntimeRules → rulesJson → Reducer
```

With:

```
ResolvedRuntimeRules          ← execution authority
        ↓
MatchRuntimePolicy            ← runtime-facing execution contract
        ↓
Compatibility Adapter         ← migration only
        ↓
rulesJson                     ← temporary compatibility projection
        ↓
Reducer
```

Architecture law:

| Artifact | Role |
|----------|------|
| `ResolvedRuntimeRules` | Execution authority |
| `MatchRuntimePolicy` | Runtime-facing execution contract |
| `rulesJson` | Temporary migration bridge only — **not architecture** |

Future removal of `rulesJson` must require **zero** Rule Engine changes.

---

## 1. Current execution flow

### 1.1 Designed platform pipeline (frozen foundations)

```
Tournament (ruleProfileId + version)
  → Competition (plan lock; profile refs)
    → Fixture / Nodes / Blueprints
      → Scheduling / Slots / Assignments
        → Match Identity (EPIC-05)
          → Runtime Prepare (EPIC-08)   ← Snapshot freeze (refs only)
          → Runtime Ready               ← lifecycle request only
          → Match Lifecycle → live
          → Scoring Session / events
          → Reducer / projections
```

### 1.2 Actual live cricket path today (Corporate Box Trace — verified gap)

```
Tournament create
  → stores variantId / ruleProfileId / presentationProfileId
  → catalog VALUES never copied to match runtime

Mission Control Competition / Fixture / Scheduling locks
  → freeze planning refs
  → do NOT create scoring matches
  → do NOT call RuleEngine

Runtime Prepare (exists; historically skippable on live score path)
  → freezes RuntimeSnapshot.references only
  → does NOT call RuleEngine
  → does NOT write rulesJson / MatchRuntimePolicy

★ Divergence — actual scoring entry today:
scoring-match-list / scoring-schedule / generateScoringDraw
  → createScoringMatch()
  → rulesJson = { overs: input.oversLimit ?? 20, maxWickets: 10 }
  → NO RuleEngine, NO tournament.ruleProfileId read
  → scoring_sessions.stateJson = createInitialCricketState(MatchMeta)
  → MatchMeta.oversLimit ← rulesJson.overs ?? 20
  → reduceCricket / MATCH_STARTED payload.oversLimit
```

**Result:** Corporate Box profile values (overs 6, XI 8, LBW false, retire@30) do not affect live play unless an operator manually types overs.

Producers exist (`RuleEngine.resolve`, Platform HTTP, Catalog façades, golden tests). **Consumers on the live path: none.**

### 1.3 Target execution flow after EPIC-11 (amended)

```
Tournament / Competition / Fixture / Scheduling / Match Create
  (planning + identity; Match Create does NOT author gameplay policy)
        ↓
Runtime Prepare  [MANDATORY EXECUTION-CONTRACT GATE]
  1. Validate readiness
  2. Freeze Runtime Snapshot (refs only) — EPIC-08
  3. Assemble RuleResolutionContext (caller; already-loaded parts)
  4. RuleEngine.resolve(PREPARE)          ← sole resolve site
  5. Bind ResolvedRuntimeRules            ← execution authority (immutable)
  6. Derive MatchRuntimePolicy            ← runtime-facing contract
  7. Compatibility Adapter → rulesJson    ← temporary bridge only
  8. Record resolutionId / rulesHash / snapshotVersion in Runtime History
  9. Advance Execution Phase
        ↓
Runtime Ready
  → requests Match Lifecycle via EPIC-05 only
  → does NOT resolve rules
        ↓
Match Start
  → VERIFY snapshotVersion + resolutionId + rulesHash
  → NEVER RuleEngine.resolve()
  → fail closed if verify fails
        ↓
Scoring Session
  → consumes MatchRuntimePolicy
  → may read temporary rulesJson via Compatibility Adapter only
        ↓
Reducer
  → MatchMeta / event payloads / policy projection
  → NEVER Rule Engine
```

---

## 2. Possible cutover points (re-evaluated under amendments)

| # | Insertion point | Status under amendments | Notes |
|---|-----------------|-------------------------|-------|
| A | Tournament create | **Rejected** | Preview/validate only; not session authority |
| B | Competition lock | **Rejected** | Planning; wrong owner |
| C | Fixture / Scheduling | **Rejected** | Planning; wrong owner |
| D | Match Create | **Rejected as resolve site / authority** | May hold temporary non-authoritative placeholders during migration only; must not invent gameplay policy |
| **E** | **Runtime Prepare** | **REQUIRED — sole resolve site** | Mandatory gate; freezes contract; sole `RuleEngine.resolve()` |
| F | Runtime Ready | **Rejected** | Lifecycle request only |
| G | Match Start | **Verify only — never resolve** | Checks Snapshot / resolutionId / rulesHash |
| H | Scoring Session create | **Consumer bind only** | Consumes `MatchRuntimePolicy`; never resolves |
| I | Reducer / per-event | **Forbidden** | Never knows Rule Engine |

### Snapshot completeness for `RuleEngine.resolve`

**Does Runtime Snapshot already contain everything needed?**  
**NO.**

Snapshot has (by design): frozen refs — ruleProfile, presentation, competition, fixture, scheduling, sides, officials, match configuration version.

Missing for resolve (assembled by the **caller** into `RuleResolutionContext` — never stuffed onto Snapshot):

| Needed input | Source |
|--------------|--------|
| `sportId` / `variantId` / `competitionTypeId` | Tournament / Competition bindings |
| `ruleProfile` FrozenRef | Must match Snapshot ref |
| Override refs / override documents | Competition / Tournament / Match override stores (when present) |
| `resolutionMode` | Caller — **`PREPARE` only** at the cutover site |
| Snapshot object | Required for `PREPARE` verification |

EPIC-09: Snapshot **verifies identity**; it is not a merge layer and must not hold rule values.

---

## 3. Architecture compatibility matrix

| Option | Constitution | EPIC-08 | EPIC-09 | Amendments | Recommendation |
|--------|--------------|---------|---------|------------|----------------|
| A Tournament | Planning | No Snapshot | Preview | Contradicts mandatory Prepare | Reject |
| B Competition | Planning | No | Wrong owner | Same | Reject |
| C Fixture/Sched | Wrong owner | No | Wrong | Same | Reject |
| D Match Create invents rules | Dual truth | Often no Snapshot | CREATE ≠ session law | **Amd 2 forbids** | Reject as authority |
| **E Runtime Prepare** | Execution Contract | Freeze then bind | **PREPARE** | **Amd 1 + 3 + 4** | **Sole cutover** |
| F Ready | Lifecycle only | Wrong job | No Ready mode | — | Reject |
| G Match Start re-resolve | Late / duplicate | OK structurally | Mode exists but | **Amd 3 forbids** | **Verify only** |
| H Session | Consumer | No | Consume | Consumes Policy | Bind consumer |
| I Reducer | Forbidden | Forbidden | Forbidden | Forbidden | Never |

---

## 4. Recommended insertion point

### Sole resolve site: Runtime Prepare

**`RuleEngine.resolve()` runs here and only here for an execution cycle.**

Why (amended):

1. Amendment 1 makes Prepare the **mandatory** execution-contract gate.  
2. EPIC-08 Prepare already: validate → freeze Snapshot → phase transition.  
3. EPIC-09 `PREPARE` requires Snapshot and compiles on success.  
4. Constitution: Runtime freezes the execution contract; engines execute.  
5. Snapshot remains refs-only; Rule Engine remains sole merge/inheritance/conflict owner.  
6. One immutable authority per `snapshotVersion` — frozen at Prepare, never re-resolved.  
7. Amendment 4 introduces `MatchRuntimePolicy` as the runtime-facing contract derived from `ResolvedRuntimeRules` at this same moment.

### Match Start — verify only

```
VERIFY:
  active snapshotVersion is present
  resolutionId is present and bound to that snapshotVersion
  rulesHash matches the bound contract
FAIL CLOSED if any check fails
NEVER call RuleEngine.resolve()
```

### Match Create — no gameplay authorship

Match Create stops inventing `{ overs: 20, maxWickets: 10 }` as policy.  
It may create identity rows and empty/placeholder runtime fields.  
Gameplay materialization waits for Prepare.

### Explicit non-goals at this insertion point

- Do not resolve at Ready, Fixture, Scheduling, Tournament, Session, or Reducer.  
- Do not store `ResolvedRuntimeRules` or `MatchRuntimePolicy` bodies on Runtime Snapshot.  
- Do not treat `rulesJson` as architecture.

---

## VERIFY answers (amended)

### Once or multiple times?

**Exactly once per execution cycle — at Runtime Prepare.**

- Not at Tournament forever.  
- Not at Match Create (as authority).  
- **Not at Match Start** (verify only — Amendment 3).  
- Not per ball / per event.  
- **New Prepare / new Snapshot version = new execution cycle = new resolve.**  
- Mid-session: no further Rule Engine invocation.

### When does `ResolvedRuntimeRules` become immutable?

**At successful Runtime Prepare for that Snapshot version.**

| Moment | Status |
|--------|--------|
| Match Create | No gameplay authority |
| **Runtime Prepare** | **Becomes immutable for this `snapshotVersion`** |
| Runtime Ready | Lifecycle only; do not mutate rules |
| Match Start | **Verify only** — same frozen contract |

Runtime Prepare is the **single place** where the execution contract becomes immutable (Amendment 1).

### Should `rulesJson` continue to exist?

**Only as a temporary migration bridge — not architecture.**

| Artifact | Role |
|----------|------|
| `ResolvedRuntimeRules` | Execution authority |
| `MatchRuntimePolicy` | Runtime-facing execution contract |
| Compatibility Adapter | Maps Policy → legacy shapes during migration |
| `rulesJson` | Temporary projection for current reducer/`MatchMeta` only |

Future removal of `rulesJson` must require **zero** Rule Engine changes (Amendment 4).

### What should Scoring Session consume?

1. **`MatchRuntimePolicy`** — primary runtime-facing contract  
2. Temporary `rulesJson` via Compatibility Adapter only — while reducer still needs it  
3. **Never** Catalog / Profile / Tournament “current” re-resolve  
4. **Never** raw `ResolvedRuleSnapshot` (product artifact)  
5. Authority remains `ResolvedRuntimeRules`; Policy is the derived runtime face

### Should Reducer know about Rule Engine?

**NO.**

Reducer receives mechanism inputs only (`MatchMeta` / event payloads / policy projection).  
Never imports `RuleEngine`. Never walks catalogs.

### Should Runtime Snapshot store `ResolvedRuntimeRules`?

**NO.**

Violates EPIC-08 (refs only) and EPIC-09 (no rule value copies on Snapshot).

Store **identity** in Runtime History / session bind: `resolutionId`, `rulesHash`, `runtimeRulesVersion`, `snapshotVersion`.  
Bodies live as bound session/runtime artifacts — not Snapshot payload.

### Can Runtime Prepare be the single place Rule Engine executes?

**YES — and under Amendment 1 it must be.**

| Concern | How |
|---------|-----|
| EPIC-08 | Snapshot frozen first; Prepare owns freeze orchestration |
| EPIC-09 | `PREPARE` mode; caller builds context; engine pure |
| Execution Contract | Refs freeze; executable rules bind to that version |
| Immutability | Authority pinned at Prepare for `snapshotVersion` |
| Replay | Re-resolve from stored Snapshot + serializable context yields same `rulesHash` for audit; live path does not re-resolve at Start |
| Determinism | Referential transparency of Rule Engine |
| Amendment 3 | Match Start verifies hashes — does not re-execute resolve |
| Amendment 4 | Policy derived once at Prepare |

---

## 5. Consumer ownership

| Artifact / call | Owner | Must not own |
|-----------------|-------|--------------|
| `RuleEngine.resolve()` | **Rule Engine** (computation). **Sole cutover caller:** Runtime Prepare orchestration | Match Create, Ready, Match Start, Scoring, Reducer, Fixture, Scheduling, UI |
| `ResolvedRuntimeRules` | Rule Engine produces; Prepare binds for the execution cycle | Snapshot body; Catalog; Presentation Engine; Match Start |
| `MatchRuntimePolicy` | Derived at Prepare from `ResolvedRuntimeRules`; owned as runtime-facing contract for the cycle | Rule Engine internals; Snapshot body; independent authorship |
| Compatibility Adapter | Migration infrastructure mapping Policy → legacy `rulesJson` / `MatchMeta` | Becoming a second Rule Engine; surviving as permanent architecture |
| `rulesJson` | Temporary Compatibility Adapter output only | Gameplay authority; Match Create authorship; long-term architecture |
| Reducer input | Scoring (`MatchMeta` / events / policy projection) | Rule Engine; CatalogRegistry; Snapshot merge |
| Runtime Snapshot | EPIC-08 Runtime Match (refs + versions) | Rule values; executable rules; Policy bodies |
| RuleResolutionContext | Caller at Prepare (from already-loaded parts) | Engine DB loaders; Match Start |
| Match Start verify | Scoring / Runtime Start gate | Resolution; Catalog access |
| Match Lifecycle | EPIC-05 | Runtime Ready requests only |
| Temporary RuntimeAdapters (EPIC-02 era) | Transitional; remove after Policy path is live | Permanent second resolver |

---

## 6. Required changes (architectural only — no code)

1. **Mandate Runtime Prepare** before Match Start / Live scoring.  
2. **Sole resolve:** `RuleEngine.resolve(PREPARE)` only inside Prepare, after Snapshot freeze.  
3. **Bind** `ResolvedRuntimeRules` + derive `MatchRuntimePolicy` at Prepare.  
4. **Record** `snapshotVersion`, `resolutionId`, `rulesHash` in Runtime History / session bind.  
5. **Match Start:** verify those three; never resolve.  
6. **Match Create:** stop inventing gameplay policy; identity/participants/metadata/schedule/placeholder only.  
7. **Introduce** Compatibility Adapter: `MatchRuntimePolicy` → temporary `rulesJson` (migration bridge).  
8. **Do not** put ResolvedRuntimeRules / MatchRuntimePolicy on Snapshot.  
9. **Do not** teach Reducer about Rule Engine.  
10. **Preserve** EPIC-08 Prepare/Ready semantics; EPIC-05 lifecycle authority; Catalog discovery vs Engine computation.  
11. **Plan** `rulesJson` removal with zero Rule Engine changes.

---

## 7. Migration strategy

### Phase 1 — Mandatory Prepare + sole resolve + dual projection

- Enforce: **No Prepare ⇒ No Match Start / No Live session.**  
- At Prepare: freeze Snapshot → `RuleEngine.resolve(PREPARE)` → bind `ResolvedRuntimeRules` → derive `MatchRuntimePolicy`.  
- Compatibility Adapter writes temporary `rulesJson` from Policy (not from Match Create defaults).  
- Match Create: stop authoritative `?? 20` / hardcoded wickets; placeholders only (compat shim allowed if non-authoritative and overwritten/ignored once Prepare succeeds).  
- Scoring Session still may read temporary `rulesJson` for reducer parity.  
- History records `resolutionId` / `rulesHash` / `snapshotVersion`.  
- Feature-flag Corporate Box: Prepare produces overs 6 etc. via Policy → bridge.

### Phase 2 — Session consumes MatchRuntimePolicy

- Scoring Session binds **`MatchRuntimePolicy`** as primary runtime contract.  
- Match Start: **verify only** (`snapshotVersion`, `resolutionId`, `rulesHash`); fail closed.  
- UI policy (LBW hide, XI/bench, retire@N) reads Policy — not hardcoded.  
- Compatibility Adapter remains for reducer/`MatchMeta` only.  
- Shadow compare: Policy projection vs legacy invent-at-create (must show Create is no longer authority).

### Phase 3 — Retire temporary bridge

- Remove `rulesJson` as a consumed surface (or leave inert unused column) **without** Rule Engine changes.  
- Reducer consumes Policy-derived `MatchMeta` / expanded policy bag via Scoring — still no Rule Engine.  
- Remove RuntimeAdapters from live path.  
- Match Create inventing rules is gone.  
- Broadcast/Stats/AI use `resolutionId` / `rulesHash` for rule facts.  
- EPIC-09 fully integrated per §9.

---

## 8. Regression risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Live path still skips Prepare | **P0** | Hard gate: No Prepare ⇒ No Match Start / No Live session |
| Match Create still authors `rulesJson` as truth | **P0** | Amd 2: Create non-authoritative; Prepare overwrites via Policy → adapter |
| Match Start re-resolves (drift / double compile) | **P0** | Amd 3: verify only |
| Missing `resolutionId` / `rulesHash` at Start | High | Prepare must fail closed if resolve unsuccessful |
| Snapshot incomplete / profile ref mismatch | High | Existing EPIC-09 verification (`SNAPSHOT_REQUIRED`, `PROFILE_REF_MISMATCH`) |
| Dual authority (Create vs Prepare) | High | Create never authority; session reads Policy / Prepare-bound ids |
| Re-prepare while Live | High | Forbid new Snapshot authority while Live; new version only when allowed |
| Reducer behavior change (overs/wickets/LBW) | Medium–High | Phase 1 bridge + Corporate Box golden fixtures |
| Treating `rulesJson` as permanent architecture | Medium | Amd 4; removal planned with zero Rule Engine change |
| Teaching Scoring to call CatalogRegistry | High | Forbidden |
| Storing full rules/Policy on Snapshot | High | Constitutional reject |
| PXP RC nav debt blocking Prepare UX | Medium | RC1.1 fixed Live Control routes; Prepare remains mandatory product gate |

---

## 9. Success criteria — when is EPIC-09 fully integrated?

EPIC-09 is fully integrated when **all** are true:

1. Every live cricket scoring session is preceded by a **successful mandatory Runtime Prepare**.  
2. `RuleEngine.resolve()` ran **exactly once** for that execution cycle — at Prepare — against a frozen Runtime Snapshot.  
3. `ResolvedRuntimeRules` is bound as execution authority; `MatchRuntimePolicy` is the runtime-facing contract.  
4. Match Start **only verifies** `snapshotVersion` / `resolutionId` / `rulesHash` — never resolves.  
5. Match Create **does not author** gameplay policy.  
6. Corporate Box (and Outdoor) catalog values actually change live gameplay via Prepare → Policy.  
7. `rulesJson` is temporary bridge only — or removed — with **zero** Rule Engine changes required for removal.  
8. Reducer has **zero** Rule Engine imports.  
9. Snapshot still holds **refs only**.  
10. No mid-session Catalog / Profile / Tournament re-resolve for gameplay.  
11. Temporary RuntimeAdapters unused on the live path.  
12. Audit replay: stored Snapshot + RuleResolutionContext → resolve ⇒ same `rulesHash` (offline/audit); live Start path does not re-resolve.

Until then: EPIC-09 remains **capability complete, consumer incomplete**.

---

## 10. Design Gate decisions (amended — for approval)

| Decision | Choice |
|----------|--------|
| Primary / sole resolve site | **Runtime Prepare (mandatory)** |
| Prepare optionality | **Forbidden — No Prepare ⇒ No Match Start** |
| Authority immutability moment | **Successful Runtime Prepare for `snapshotVersion`** |
| Match Start | **VERIFY ONLY — never `RuleEngine.resolve()`** |
| Match Create | **Identity / participants / metadata / schedule / placeholder only — no gameplay authorship** |
| Runtime-facing contract | **`MatchRuntimePolicy`** derived from `ResolvedRuntimeRules` |
| `rulesJson` | **Temporary Compatibility Adapter projection — not architecture** |
| Snapshot contents | **Refs only — unchanged** |
| Reducer | **No Rule Engine** |

---

## 11. Explicitly voided statements from prior audit draft

The following prior recommendations are **void**:

- “Runtime Prepare is optional / may be skipped if Match Create dual-writes.”  
- “Match Start may re-resolve for fail-closed equality.”  
- “Match Create resolve / dual-write as primary pragmatic cutover.”  
- “`rulesJson` as compiled cache considered architectural consumer of Rule Engine.”  
- “Primary chain `ResolvedRuntimeRules → rulesJson → Reducer` without Policy layer.”

---

## 12. Constitutional summary (EPIC-11 amended)

> **Catalogs define.  
> Rule Engine resolves — once — at mandatory Runtime Prepare.  
> ResolvedRuntimeRules authorize execution.  
> MatchRuntimePolicy faces the runtime.  
> rulesJson is a temporary bridge — not architecture.  
> Match Start verifies — never resolves.  
> Match Create never invents gameplay.  
> Snapshot verifies refs — never stores rule bodies.  
> Reducer never knows the Rule Engine.  
> No Prepare — No Start — No Live.**

---

## 13. Related documents

| Document | Role |
|----------|------|
| `docs/superpowers/specs/2026-08-05-platform-architecture-freeze.md` | Constitution |
| `docs/cricket-platform-master-plan.md` | Master Plan |
| `docs/superpowers/specs/2026-08-04-rule-profile-system-foundation-epic-02-design.md` | EPIC-02 |
| `docs/superpowers/specs/2026-08-05-match-foundation-epic-05-design.md` | EPIC-05 |
| `docs/superpowers/specs/2026-08-05-runtime-match-foundation-epic-08-design.md` | EPIC-08 |
| `docs/superpowers/specs/2026-08-05-rule-engine-foundation-epic-09-design.md` | EPIC-09 |
| `docs/superpowers/specs/2026-08-05-presentation-engine-foundation-epic-10-design.md` | EPIC-10 |
| `docs/superpowers/specs/2026-08-05-product-experience-phase-pxp-design.md` | PXP |
| `docs/superpowers/specs/2026-08-06-pxp-rc1-stabilization-report.md` | RC1 |
| `docs/superpowers/specs/2026-08-06-pxp-rc1-1-stabilization-report.md` | RC1.1 |
| Corporate Box Consumer Cutover Trace (`EXECUTION TRACE REPORT`) | Live-path evidence |

---

## Stop

This is the **revised Design Gate audit only**.

**Do not begin Design Proposal Section 1 until this revised audit is approved.**  
**No implementation. No code.**
