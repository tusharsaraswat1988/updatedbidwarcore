# BidWar Database Migration Strategy

> Phase 2 — roadmap from multi-path healing to single versioned migrator.  
> Each phase is independently deployable and reversible. No SQL/code in this document.

---

## Strategy overview

Move BidWar in **small, gated phases**. Never remove a healer until the replacement path has run successfully in production for a defined soak period.

```
Phase 0  Freeze & observe
Phase 1  Introduce versioned migrator (parallel, non-authoritative)
Phase 2  Baseline production onto the ledger
Phase 3  Deploy-gate: migrate-before-rollout
Phase 4  Neutralize System C DML (highest risk)
Phase 5  Freeze Systems C/D (no new DDL added)
Phase 6  Make startup validation read-only (D becomes check-only)
Phase 7  Remove System C DDL
Phase 8  Remove System D DDL; retire B for new work
Phase 9  Ban prod push; archive orphans; governance steady-state
```

Phases are numbered for the *stabilization program* (not to be confused with this document’s “Phase 2 design”).

---

## Phase 0 — Freeze and observe

**Goal:** Stop the bleeding of new dual-writes into multiple systems without removing healers.

**Deployable independently:** Yes (policy + process).  
**Reversible:** Yes (policy rollback).  
**Risk:** Low.

**Actions (process):**

- Declare: new columns/tables must be designed for versioned migrations going forward.  
- Temporary rule: if a healer must be touched for an emergency, document the dual-write in the PR.  
- Enable logging/metrics around System C failures and `ensureCoreSchema` duration (observe only).  
- Inventory prod: table/column/index list; note runtime-only objects (partial indexes, FKs, `sessions`).

**Exit criteria:** Written inventory; team agreement on freeze; baseline metrics for boot DDL duration.

---

## Phase 1 — Introduce versioned migrator (parallel)

**Goal:** Add Drizzle Generate + Migrate (or equivalent journaled migrator) **alongside** A/B/C/D without trusting it yet.

**Deployable independently:** Yes.  
**Reversible:** Yes — unused migrator can be ignored; no removal of old paths.  
**Risk:** Low.

**Actions:**

- Configure migrations `out` directory + journal.  
- Add CI job that can generate/apply migrations to **staging only**.  
- Do **not** remove push or healers.  
- Do **not** auto-apply on API start.

**Exit criteria:** Staging can apply a no-op or additive test migration via ledger; journal committed.

---

## Phase 2 — Baseline production onto the ledger

**Goal:** Record “current prod shape” as applied baseline without destructive rebuild.

**Deployable independently:** Yes (ops procedure).  
**Reversible:** Yes — ledger rows can be corrected with a documented ops procedure; schema unchanged.  
**Risk:** Medium (ops error marking baseline wrong).

**Actions:**

- Diff information_schema vs Drizzle schema; reconcile runtime-only objects into schema or explicit exceptions list.  
- Produce baseline migration set representing current desired state.  
- On production: mark baseline as applied **without re-running destructive DDL** (baseline stamp).  
- Keep C/D running.

**Exit criteria:** Prod ledger has baseline version; staging/prod ledgers comparable; exception list signed off.

---

## Phase 3 — Deploy-gate: migrate before rollout

**Goal:** New releases that need schema changes apply migrations via CD **before** API rollout.

**Deployable independently:** Yes.  
**Reversible:** Yes — gate can be made warning-only temporarily.  
**Risk:** Medium (process change; failed gates block deploys — desirable).

**Actions:**

- CD step: run migrator against prod with migration files from the release.  
- CD step: verify ledger version.  
- Only then deploy API.  
- Healers still present as backup for forgotten columns during soak.

**Exit criteria:** At least N production releases completed with migrate-before-rollout; no reliance on healers for those releases’ new columns.

---

## Phase 4 — Neutralize System C DML

**Goal:** Remove data surgery from import path (DELETE/UPDATE/INSERT/DROP COLUMN) while leaving additive IF NOT EXISTS DDL temporarily.

**Deployable independently:** Yes.  
**Reversible:** Yes — re-enable specific backfills behind a one-shot ops script if needed (not on import).  
**Risk:** Medium–High (if backfills still needed for old rows).

**Actions:**

- Prove each backfill is complete in prod (queries).  
- Move any remaining one-shot repairs to explicit ops runbooks.  
- Strip DML/DROP from `index.ts` import side effects.

**Exit criteria:** Import path has no DML/DROP; auctions unaffected over soak window.

---

## Phase 5 — Freeze Systems C/D content

**Goal:** No new ALTER/CREATE added to C or D; all new DDL goes only through versioned migrations.

**Deployable independently:** Yes (enforced by review checklist / CI grep).  
**Reversible:** Yes (emergency exception process).  
**Risk:** Low–Medium.

**Exit criteria:** CI fails PRs that add DDL strings to `index.ts` / `ensure-schema.ts` without exemption.

---

## Phase 6 — Startup validation becomes read-only

**Goal:** Replace `ensureCoreSchema` DDL with validation that required version/objects exist; fail closed.

**Deployable independently:** Yes (feature-flagged: validate-and-heal → validate-only).  
**Reversible:** Yes — flag back to heal mode.  
**Risk:** Medium (misconfigured validation can block boot).

**Actions:**

- Dual-run: validate first; if missing and flag allows, heal (temporary).  
- Then validate-only in staging → prod.  
- System C still present until Phase 7.

**Exit criteria:** Prod boots in validate-only mode for soak period; zero heal invocations.

---

## Phase 7 — Remove System C DDL

**Goal:** Delete import-time schema mutation entirely.

**Deployable independently:** Yes.  
**Reversible:** Yes within one release (restore previous artifact) — schema itself unchanged.  
**Risk:** Medium (forgotten objects only created by C).

**Preconditions:** Phase 2–6 complete; exception objects migrated into journaled migrations; partial indexes/FKs represented.

**Exit criteria:** No `pool.query` DDL at module scope in `@workspace/db`; seeds/scripts no longer mutate schema on import.

---

## Phase 8 — Remove System D DDL; retire System B for new work

**Goal:** API boot has zero DDL; `migrate.ts` accepts no new entries; remaining B concerns folded into journal.

**Deployable independently:** Yes (two PRs preferred: remove D call; archive B).  
**Reversible:** Yes per PR.  
**Risk:** Medium.

**Exit criteria:** `ensureCoreSchema` is validate-only or gone; `sessions` and any B-only objects owned by versioned migrations; `pnpm migrate` deprecated.

---

## Phase 9 — Ban production push; archive orphans; steady-state governance

**Goal:** Production may not use `drizzle-kit push`. Orphan SQL archived. Governance docs enforced.

**Deployable independently:** Yes.  
**Reversible:** Policy only.  
**Risk:** Low if Phases 1–8 done.

**Exit criteria:** Prod scripts/docs forbid push; drift detection on schedule; SCHEMA_GOVERNANCE followed.

---

## Phase independence matrix

| Phase | Can ship without later phases? | Breaks auctions if failed? |
|-------|--------------------------------|----------------------------|
| 0 | Yes | No |
| 1 | Yes | No |
| 2 | Yes | No (if stamp-only) |
| 3 | Yes | No (blocks bad deploys) |
| 4 | Yes | Possible if backfill still needed — gate with proofs |
| 5 | Yes | No |
| 6 | Yes with flag | Yes if validate wrong — use flag |
| 7 | Needs 2–6 | Medium |
| 8 | Needs 7 | Medium |
| 9 | Needs 8 | No |

---

## Risk minimization rules (all phases)

1. Prefer **additive** migrations during auction season.  
2. Never combine “remove healer” and “apply risky unique index” in one release.  
3. Soak each removal phase across multiple live auction events when possible.  
4. Keep Neon PITR enabled; document restore owner and RPO.  
5. No shortcuts that reintroduce startup DDL “just for this one column.”
