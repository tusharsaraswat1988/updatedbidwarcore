# DATABASE_GOVERNANCE_ADR.md

# BidWar Database Governance  
## Architecture Decision Record (Permanent)

| Field | Value |
|-------|--------|
| Status | **Accepted** |
| Scope | Cloud PostgreSQL (Neon) — production and staging |
| Horizon | Next 2–5 years of continuous production deployment |
| Audience | Engineering, on-call, release operators |
| Related | Phase 1 verification (evidence); Phase 2 design docs (supporting) |

This ADR is the **binding governance model**. Supporting design docs elaborate; they do not override this record.

---

# ADR-001 — Single Source of Truth

## Decision

**Choose: Drizzle Generate + Migrate.**

One path only for production schema change:

1. **Design SSOT** — `lib/db/src/schema/**/*.ts` (intended shape for the ORM).  
2. **Apply SSOT** — versioned migration files produced by Drizzle generate, committed to git, applied by `drizzle-kit migrate` (or equivalent ledgered runner).  
3. **Environment SSOT** — the migration ledger table in each database (what has been applied here).

## Rejected alternatives

| Option | Why rejected for BidWar |
|--------|-------------------------|
| Drizzle Push | No durable version history; interactive and drop-capable; unfit for multi-instance live auctions. |
| Hand-maintained versioned SQL only | Guarantees drift from the 90+ table Drizzle ORM contract over multi-year evolution. |
| Hybrid (push + healers + CLI arrays) | Permanent multi-writer chaos; schema drift by construction. |

## Justification

BidWar already expresses product schema in Drizzle. What it lacks is a **reviewable, once-applied, ledgered** apply mechanism. Generate + Migrate preserves the TypeScript design SSOT while giving production the properties push and runtime healers cannot: git history, deploy gating, multi-instance safety, and an answer to “what version is this database on?”

**Rule:** A schema change is not production-ready until it exists in both the Drizzle schema **and** a committed, reviewable migration. The ledger—not application boot—proves it was applied.

---

# ADR-002 — Fate of Systems A, B, C, D

## System A — Drizzle Push

| Disposition | **Transformed / demoted** |
|-------------|---------------------------|
| Production | **Removed** from all production and staging apply paths. |
| Local disposable DBs | **Allowed** only for empty/scratch databases where wipe is acceptable. |

**Why:** Push remains useful for greenfield local setup speed. It is structurally unsafe as a production mutator (no ledger, can reconcile by dropping). Governance forbids it on shared environments.

---

## System B — `scripts/src/migrate.ts`

| Disposition | **Removed** (after absorption) |
|-------------|-------------------------------|
| Near term | Frozen — no new labels for new features. |
| End state | Retired; its historical intent lives only inside the migration ledger baseline. |

**Why:** An unlabeled, re-executable SQL array is not a migration system. It duplicates Generate + Migrate poorly and cannot remain a second writer.

---

## System C — Runtime DDL/DML in `lib/db/src/index.ts`

| Disposition | **Removed** |
|-------------|----------------|
| Near term | Strip data mutations first; freeze new DDL; then delete all import-time schema mutation. |
| End state | Module constructs pool/ORM/keepalive only. |

**Why:** Import-time mutation is incompatible with multi-instance deploys, zero-downtime guarantees, and safe rollback. Perpetual UPDATE/DELETE/INSERT “ensure” logic is data migration disguised as schema setup and must never return.

---

## System D — `ensureCoreSchema`

| Disposition | **Transformed**, then DDL **removed** |
|-------------|----------------|
| Near term | Become dual-mode (heal optional → validate-only). |
| End state | Replaced by **read-only schema validation** at startup (may live in a differently named module). No `CREATE`/`ALTER`/`DROP`. |

**Why:** The original motive—prevent serving traffic when mapped columns are missing—is correct. The mechanism—mutating production on boot—is wrong. Validation without mutation preserves the motive permanently.

---

## Summary

| System | End state |
|--------|-----------|
| A | Dev/scratch only |
| B | Removed after baseline absorption |
| C | Removed entirely |
| D | Transformed to validate-only (no DDL) |

No hybrid end state. Temporary coexistence during transition is a bridge, not a destination.

---

# ADR-003 — Production Deployment Lifecycle

## Guarantees this lifecycle must hold

| Guarantee | How it is achieved |
|-----------|-------------------|
| No startup schema mutation | API process never runs DDL |
| Zero downtime | Expand/contract; rolling app deploy; single migrator |
| No schema drift | Same migration set promotes env→env; drift checks gate release |
| Safe rollback | Expand keeps old binaries viable; contract is separate |
| Multi-instance safety | Exactly one migrator leader per environment per release |

## Lifecycle

```
1. Build immutable release (app + migrations + required_schema_version)
2. Pre-check: drift / pending migrations / hot-path risk class
3. Migrator job (sole DDL actor):
     acquire lock → apply pending versions → verify ledger → release lock
4. Post-migration verification (blocking)
5. Roll API instances (N copies):
     connect → validate (read-only) → ready
6. Canary / smoke (auction-critical paths)
7. Complete rollout
8. Observe
```

**Ordering invariant:** Database expand completes **before** any instance of the new application binary receives traffic.

**Contract migrations** (drops, destructive renames) are a **separate release** after all instances run code that no longer needs the old objects.

---

# ADR-004 — Introducing a New Schema Change

## Example: developer adds one nullable column

### Future workflow (commit → production)

1. **Design** — Add the column to the Drizzle table definition.  
2. **Generate** — Produce a versioned migration from the schema diff; commit schema + migration together.  
3. **Classify** in the PR: expand (this example), backfill, contract, or index.  
4. **Review** — Hot-path impact, lock risk, rollback note (app-only vs PITR).  
5. **CI** — Fail if schema changed without migration; fail if DDL was added to import/boot healers.  
6. **Staging** — Migrator applies the version; app deploys; tests pass.  
7. **Production** — CD runs migrator against prod; verification passes.  
8. **Production** — CD rolls API; startup validation confirms ledger ≥ required version.  
9. **Done** — Column exists once in design SSOT, once in apply SSOT, once in ledger. No ensure-schema copy. No import-time `ALTER`.

### Non-nullable / rename / drop

Same workflow with expand → (optional dual-write/backfill job) → switch reads → later contract migration. Never a single “break old app” migration bundled with app rollout.

---

# ADR-005 — Schema Migrations vs Data Migrations

## Permanent separation

| Kind | Definition | Who runs it | When |
|------|------------|-------------|------|
| **Schema migration** | DDL: tables, columns, indexes, constraints | Migrator job only | Before app rollout (expand) or after old app gone (contract) |
| **Data migration** | DML: backfill, dedupe, rewrite, purge | Explicit job / script / worker with ownership, batching, metrics | After expand schema is live; never inside module import or boot DDL |

## Rules

1. Schema migrations **must not** contain open-ended business backfills (mass UPDATE/DELETE/INSERT that repair product data).  
2. Data migrations **must not** create or alter schema. If they need a column, the schema migration ships first.  
3. Idempotent “ensure” DML on every process start is **forbidden**.  
4. One-shot data repairs are runbooks or versioned jobs with progress reporting and pause/resume—not side effects of `import "@workspace/db"`.  
5. Product startup DML that is not repair (e.g. cache warm, seed defaults into already-existing tables) is allowed only if it cannot create schema and cannot lock hot auction tables at scale; it remains outside schema governance.

## Why

Coupling DDL with DML in startup paths caused multi-instance races and made “schema ensure” a silent data mutator. Separation restores auditability and safe retries.

---

# ADR-006 — Startup Behavior

## Decision

Application startup is **schema-read-only**.

## Future startup sequence

```
1. Load environment / assert runtime configuration
2. Create connection pool and ORM client
3. Run schema compatibility validation (ADR-007)
4. On failure → exit non-zero; do not listen; do not mark ready
5. On success → optional product initialization (non-DDL)
6. Bind listen / become ready
7. Start background workers
```

## Forbidden at startup

- `CREATE` / `ALTER` / `DROP` / index builds  
- Schema “healing”  
- Mass ensure backfills  

## Allowed

- Read-only validation queries  
- Keepalive pings  
- Explicitly approved product DML that does not change schema  

---

# ADR-007 — Schema Validation

## Purpose

Before serving traffic, prove this process’s **required schema version** is satisfied by **this database’s ledger** (and, optionally, a small critical-object checklist).

## Validation model

1. **Primary check** — Migration ledger version ≥ `required_schema_version` embedded in the release artifact (same git SHA as the app).  
2. **Secondary check** — Lightweight presence checks for a curated critical set (core auction tables/columns) to catch emergency hotfixes or ledger stamp errors.  
3. **Outcome** — Fail closed: instance unhealthy until fixed by migrator or by rolling back the app artifact.  

## What validation is not

- Not a migrator  
- Not IF NOT EXISTS DDL  
- Not a substitute for CD migrate-before-rollout  

## Pre-traffic gates (outside the process)

- CD post-migrate verification before rollout  
- Scheduled drift detection (ledger vs expected migrations; optional information_schema vs schema snapshot) with alerting  

Together: **deploy-time proof** + **boot-time refusal to serve on mismatch**.

---

# ADR-008 — Rollback Strategy

## Principles

1. Prefer **fix-forward** for schema after a successful expand.  
2. **App rollback** must remain safe against the current DB (expand/contract discipline).  
3. **Destructive undo** uses Neon PITR—not startup DDL and not push.  
4. Never delete ledger history casually to “re-run everything.”  

## Mid-flight failure matrix

| Failure point | Action |
|---------------|--------|
| Migrator fails; app not rolled out | Stop release. Fix-forward migration or PITR if DB inconsistent. Do not roll app. |
| Migrator succeeds; new instances fail validation | Halt rollout. Keep old instances. DB stays expanded. Fix app or required version metadata. |
| Full rollout; app bug only | Redeploy previous app artifact (must still be within compatibility window). |
| Bad expand already applied | Fix-forward corrective migration; PITR only if data corruption requires it. |
| Contract migration already dropped needed objects | PITR to pre-contract; redeploy compatible app; treat as severity-1 process failure. |

## Compatibility window

Every release publishes:

- `app_version`  
- `min_db_version`  
- `max_db_version` (if a later contract removes support)

Rolling back an app across a contract boundary requires database restore, not only artifact rollback.

---

# ADR-009 — Operational Guidelines (Developer Rules)

Every engineer and operator must follow:

1. **One production writer** — Only the migrator job applies DDL in staging/production.  
2. **Schema + migration in the same PR** — No schema-only merges for shared environments.  
3. **Expand first** — Old binaries must keep working after expand migrations.  
4. **No healer edits** — Do not add DDL to import or boot paths.  
5. **No production push** — `drizzle-kit push` is forbidden on Neon staging/prod.  
6. **Classify every change** — expand / data / contract / index; call out auction hot-path tables.  
7. **Data ≠ schema** — Backfills are jobs, not migrations-on-boot.  
8. **Indexes on hot tables** — Plan lock strategy; avoid peak live auctions for heavy builds.  
9. **Document rollback** in the PR (app-only vs PITR).  
10. **Emergency DDL** — Incident commander only; capture into a migration and ledger immediately after; postmortem required.  
11. **Local SQLite is separate** — Offline schema changes follow `db-local` rules and a compatibility matrix; they do not justify cloud runtime DDL.  
12. **Do not invent a fifth system** — No new ensure scripts, orphan SQL “docs that apply,” or side-effect importers.

Violation of these rules is a governance defect, not a style preference.

---

# ADR-010 — Migration Roadmap (Transition to This Model)

Each phase is **independently deployable**, has an explicit **rollback**, and lists **risk** plus **relative engineering effort** (S/M/L — not calendar duration).

| Phase | Intent | Risk | Effort | Rollback |
|-------|--------|------|--------|----------|
| **P0 — Freeze** | Policy: no new healer DDL; observe boot mutation metrics | Low | S | Revert policy |
| **P1 — Migrator parallel** | Enable Generate + Migrate on staging; no prod cutover | Low | M | Ignore unused migrator |
| **P2 — Baseline stamp** | Inventory prod; stamp ledger to match reality without destructive replay | Medium | M | Correct stamp via controlled ops; schema unchanged |
| **P3 — Deploy gate** | Migrate-before-rollout in CD; healers still present but unused for new work | Medium | M | Gate → warn-only temporarily |
| **P4 — Neutralize C DML** | Remove import-time UPDATE/DELETE/INSERT/DROP; proofs first | Medium–High | M | Restore previous artifact; keep one-shot ops scripts |
| **P5 — Healer freeze CI** | CI blocks new DDL in C/D paths | Low | S | Exemption flag |
| **P6 — Validate-only boot** | D becomes check-only (flagged); fail closed when ready | Medium | M | Re-enable heal flag |
| **P7 — Remove C DDL** | Import path schema-clean | Medium | M | Prior artifact |
| **P8 — Remove D DDL / retire B** | Boot schema-clean; absorb B; deprecate old migrate CLI | Medium | M | Prior artifact; keep B read-only temporarily if needed |
| **P9 — Ban prod push / archive orphans** | Steady-state governance; drift job on schedule | Low | S | Policy only |

### Exit criteria for “governance complete”

- Production DDL exclusively via ledgered migrations  
- Zero schema mutation on API import/boot  
- Zero production push  
- New column workflow matches ADR-004 with a single apply path  
- Rollback drill (app-only + PITR tabletop) completed once  

### Non-negotiable ordering

Do not remove C/D before P2–P3.  
Do not ban push before the migrator has owned real production expands.  
Do not combine healer removal with a contract drop in one release.

---

# Governance permanence

This ADR outlives the transition. After P9, BidWar’s database evolves only through:

**Drizzle schema → generated versioned migration → migrator job → read-only validated app.**

Anything else is an exception under incident command—not a normal feature path.

---

*End of Architecture Decision Record*
