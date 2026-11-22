# BidWar Final Architecture Recommendation

> Phase 2 decision record.  
> Based on Phase 1 evidence and the designs in this document set.  
> Priority: **production stability for live auctions** over simplicity.

---

## Recommendation

**Adopt: Drizzle Generate + Migrate (versioned SQL migrations + ledger) as the sole production schema apply path.**

**Reject as production SSOT:** Drizzle Push alone, ad-hoc `migrate.ts`, and runtime healers (Systems C/D).

**Allow temporarily:** Hybrid operation during the published roadmap — migrator authoritative for *new* changes; healers frozen then removed.

**Keep separately:** `db-local` SQLite setup as a bounded offline schema — not part of the cloud SSOT.

---

## Options considered

### Option 1 — Drizzle Push only

| Pros | Cons |
|------|------|
| Already in repo (`db:push:prod`) | No version ledger |
| Fast for empty DBs | Interactive / can drop objects |
| Matches TS schema directly | Non-reviewable history in git as SQL |
| | Unsafe for live auction prod |
| | `push-force` is CRITICAL risk |

**Verdict:** Acceptable for **disposable local DBs only**. Unfit as enterprise production architecture for BidWar.

---

### Option 2 — Keep / expand `scripts/src/migrate.ts` only

| Pros | Cons |
|------|------|
| Familiar | Not generated from schema |
| Idempotent IF NOT EXISTS | Re-executes all SQL every run |
| | Diverges from Drizzle constantly |
| | Incomplete coverage historically |
| | No real version ledger |

**Verdict:** Transitional artifact to **retire**, not the destination.

---

### Option 3 — Hand-written versioned SQL only (no Drizzle generate)

| Pros | Cons |
|------|------|
| Full control | Dual maintenance vs 92-table TS schema |
| | Drift between ORM and SQL guaranteed over time |
| | Team already invested in Drizzle schema |

**Verdict:** Inferior to generate-from-schema given BidWar’s existing SSOT candidate (`lib/db/src/schema`).

---

### Option 4 — Drizzle Generate + Migrate (RECOMMENDED)

| Pros | Cons |
|------|------|
| TS schema remains design SSOT | Requires baseline stamp for existing Neon DBs |
| Reviewable SQL artifacts in git | Team must learn migrate-before-deploy |
| Ledger answers “what version is prod?” | Concurrent index patterns need care |
| Fits CD: migrator job ≠ web process | |
| Aligns with expand/contract | |
| Removes need for C/D long-term | |

**Verdict:** Best fit for BidWar’s codebase and risk profile.

---

### Option 5 — Permanent hybrid (push + healers + migrate.ts)

| Pros | Cons |
|------|------|
| Matches today’s habits | Exactly the CRITICAL architecture Phase 1 found |
| | Multi-path drift forever |
| | Auction-time races |

**Verdict:** Reject as end state. Hybrid is **only** a time-boxed bridge.

---

## Why this fits the current BidWar codebase

1. **92 tables already defined in Drizzle** — the design SSOT exists; it lacks an apply ledger.  
2. **No migration journal today** — Generate+Migrate adds the missing piece without abandoning Drizzle.  
3. **Runtime DDL exists because SELECT fails on missing columns** — that is a deploy-order problem; migrator-before-rollout + read-only validation solves it without startup mutation.  
4. **Live auctions** — require single migrator, expand/contract, and no multi-instance DELETE/UPDATE on import.  
5. **Neon** — supports PITR for true rollback of destructive mistakes; pairs with versioned migrations.  
6. **Orphan SQL + migrate.ts duplication** — proves hand-maintained parallel SQL already failed; generation from schema reduces that class of error.  
7. **`sessions` and runtime-only indexes** — can be explicitly owned once in journaled migrations; today they are tribal knowledge.

---

## Target end state (one page)

| Concern | Owner |
|---------|--------|
| Desired shape | `lib/db/src/schema/*.ts` |
| DDL to apply | Generated versioned migrations + journal |
| Applied state | DB ledger table |
| Who runs DDL | CD migrator job only |
| API startup | Read-only validation |
| Prod push | Banned |
| `migrate.ts` | Retired |
| System C/D DDL | Removed |
| System C DML | Removed (ops jobs if ever needed) |
| SQLite local | Separate setup + compatibility matrix |

---

## Systems A–D final disposition

| System | End state |
|--------|-----------|
| A Push | Dev/disposable only |
| B migrate.ts | Retired after baseline absorption |
| C index.ts DDL/DML | Removed |
| D ensureCoreSchema DDL | Removed; replaced by validation |

---

## Sequencing reminder

Do **not** jump to “delete ensure-schema.” Follow `DATABASE_MIGRATION_STRATEGY.md` and `RUNTIME_DDL_REMOVAL_PLAN.md`:

freeze → migrator → baseline → deploy gate → strip C DML → validate-only → remove C → remove D → ban push.

Each step independently deployable and reversible.

---

## Success criteria (program complete)

- Production schema version queryable from ledger.  
- Zero DDL on API import/boot.  
- Zero production `drizzle-kit push`.  
- New columns require one migration PR path — not 3–4 duplicated ALTER sites.  
- Rolling deploys during auction weekends without schema healer races.  
- Documented rollback/PITR drill completed successfully.

---

## Explicit non-recommendations

- Do not make System D “smarter” as the long-term migrator.  
- Do not replace healers with push-on-boot.  
- Do not big-bang rewrite all tables.  
- Do not block cloud stabilization on merging SQLite and Postgres DDL engines.

---

## Document index (Phase 2)

| File | Purpose |
|------|---------|
| `TARGET_DATABASE_ARCHITECTURE.md` | SSOT + lifecycles |
| `DATABASE_MIGRATION_STRATEGY.md` | Phased roadmap |
| `ZERO_DOWNTIME_PLAN.md` | Expand/contract + live auctions |
| `DEPLOYMENT_ARCHITECTURE.md` | Migrate-before-rollout |
| `ROLLBACK_STRATEGY.md` | Failure scenarios |
| `SCHEMA_GOVERNANCE.md` | Rules and drift |
| `RUNTIME_DDL_REMOVAL_PLAN.md` | A/B/C/D disposition |
| `BLOCKER_ANALYSIS.md` | Why not today |
| `FINAL_RECOMMENDATION.md` | This decision |

Phase 1 evidence remains in `DATABASE_ARCHITECTURE_VERIFICATION.md` and related audit docs.
