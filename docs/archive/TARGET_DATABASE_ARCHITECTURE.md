# BidWar Target Database Architecture

> Phase 2 design document — **no implementation**.  
> Builds on Phase 1 verification (`DATABASE_ARCHITECTURE_VERIFICATION.md`).  
> Priority: production stability for live auctions over simplicity.

---

## Design principles

1. **One authoritative schema owner** for cloud PostgreSQL.  
2. **All production DDL is versioned, reviewed, and applied before application rollout.**  
3. **Application processes never mutate schema** (startup is read-only with respect to DDL).  
4. **Expand → migrate data → contract** for breaking changes (zero-downtime compatible).  
5. **Every production change is reversible** within a defined rollback window.  
6. **Compatibility with existing Neon databases** — no wipe/rebuild assumption.  
7. **Local SQLite (`db-local`) is a separate bounded context** — synced by contract, not by sharing DDL runners.

---

## Single Source of Truth (SSOT)

### What is authoritative

| Layer | Role | Authority |
|-------|------|-----------|
| `lib/db/src/schema/**/*.ts` | Desired schema shape for the ORM and for migration generation | **Canonical design SSOT** |
| Versioned migration files under a dedicated migrations directory (Drizzle journal + SQL) | Exact DDL that has been or will be applied | **Canonical apply SSOT** |
| Database table `__drizzle_migrations` (or equivalent ledger) | What has been applied to *this* environment | **Canonical environment state** |

### What is explicitly *not* SSOT in the target state

| Mechanism | Target status |
|-----------|---------------|
| `drizzle-kit push` against production | Forbidden |
| `scripts/src/migrate.ts` inline array | Retired after cutover |
| `lib/db/src/index.ts` runtime DDL/DML | Removed |
| `ensureCoreSchema` DDL | Removed (replaced by read-only validation) |
| Orphan `lib/db/migrations/*.sql` (current unwired files) | Archived / superseded by journaled migrations |
| Ad-hoc verify/bootstrap scripts that apply DDL | Verify-only; no DDL |

**Rule:** If a column exists in TypeScript but not in a committed migration, it is not production-ready. If a migration exists but is not in the ledger on an environment, that environment is not ready for the matching app version.

---

## Schema lifecycle

```
Design change in Drizzle schema (TS)
        ↓
Generate versioned migration (reviewable SQL artifact)
        ↓
Human + CI review (expand/contract safety, locks, indexes)
        ↓
Apply migration to staging → verify
        ↓
Apply migration to production (pre-rollout gate)
        ↓
Deploy application build that depends on the new schema
        ↓
(Optional later) Contract migration to drop obsolete objects
        ↓
Ledger records applied versions forever
```

### Rules for schema changes

| Change type | Pattern |
|-------------|---------|
| Add nullable column / new table / new index (non-unique, `CONCURRENTLY` where required) | Single forward migration; deploy app after |
| Add NOT NULL column | Expand: add nullable → backfill job → set NOT NULL in later migration |
| Rename column | Expand: add new → dual-write/read → backfill → switch reads → drop old |
| Drop column/table | Only after app no longer references it (contract phase) |
| Unique index on existing data | Separate data-cleanup job + verification → then create unique index |
| Foreign keys | Additive only after orphan audit; prefer `NOT VALID` + validate later if lock risk |

---

## Migration lifecycle

1. **Author** — schema TS change + generated migration.  
2. **Classify** — expand / backfill / contract / index / data-repair.  
3. **Review** — lock analysis, auction-hot-path impact, rollback notes in PR.  
4. **Stage apply** — run migrator against staging Neon branch/DB.  
5. **Verify** — schema checksum / column presence / ledger version / smoke queries.  
6. **Prod apply** — same migrator, same migration set, during controlled window if locks expected.  
7. **Gate** — deployment pipeline refuses app rollout unless prod ledger ≥ required version.  
8. **Observe** — error budgets on auction paths for N minutes.  
9. **Close** — migration marked complete; contract work scheduled if needed.

**Idempotency:** The migrator applies each version once via the ledger. Re-running is a no-op for already-applied versions (unlike today’s `migrate.ts`, which re-executes every statement every time).

---

## Deployment lifecycle (target)

```
CI build app artifact (immutable)
        ↓
Pre-deploy: schema drift check (prod ledger vs required)
        ↓
Pre-deploy: apply pending migrations (migrator job — NOT the web process)
        ↓
Pre-deploy: post-migration verification
        ↓
Roll out app instances (no DDL on start)
        ↓
Startup: read-only schema validation (fail closed if mismatch)
        ↓
Health: ready only if validation passed
        ↓
Post-deploy: smoke + auction canary checks
```

Database updates **always precede** application rollout for schema-dependent releases.

---

## Rollback lifecycle

See also `ROLLBACK_STRATEGY.md`. Summary:

| Situation | Action |
|-----------|--------|
| Migration applied, app not yet rolled out | Do not roll out app; fix forward or apply reviewed down-migration if one exists |
| App rolled out, bug in app only | Roll back app artifact; schema stays (expand-compatible) |
| Migration is unsafe / data wrong | Stop rollout; restore from Neon point-in-time if needed; never rely on startup DDL to “heal” |
| Contract migration already dropped columns | Restore from backup / PITR — drops are last-resort and gated |

**Invariant:** Application rollback must remain safe against the *current* schema. That requires expand/contract discipline so older app binaries still run after expand migrations.

---

## Startup lifecycle (target)

```
Process start
  → load env / assert runtime config
  → create pool / drizzle client
  → run read-only schema validation:
       - required migration version present in ledger
       - critical columns/tables exist (checklist derived from schema)
  → if fail: exit non-zero (do not listen)
  → if pass: seed/cache/redis as today (DML only where product requires)
  → listen
```

**Forbidden at startup:**

- `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` / `DROP *`  
- Mass `UPDATE` / `DELETE` “ensure” backfills  
- Fire-and-forget DDL  

**Allowed at startup:**

- `SELECT` validation queries  
- Product DML that is not schema healing (e.g. branding cache refresh) — kept separate from schema governance  

---

## How the future architecture works end-to-end

1. Engineers change **only** the Drizzle schema (and app code) for structural intent.  
2. The migration toolchain produces a **versioned SQL file** committed to git.  
3. CI refuses merge if schema changed without a migration (or if push is used in prod scripts).  
4. Release operators (or CD) run the **migrator job** against Neon **before** switching traffic to a new API build.  
5. API instances start, **verify**, and serve — they never heal schema.  
6. Drift detectors periodically compare ledger + information_schema against expected.  
7. Local offline SQLite continues with its own setup path, versioned against a documented cloud compatibility matrix — not against runtime Postgres DDL.

---

## Compatibility with today’s production

The target architecture does **not** require rebuilding Neon from scratch.

Cutover assumes:

- Baseline migration(s) that capture “schema as of cutover” (possibly marked already-applied after inventory).  
- Runtime healers remain temporarily as a **safety net** until baseline + deploy gates are proven.  
- Removal of Systems C/D is a late phase after evidence that every environment is ledger-driven.

---

## Non-goals (explicit)

- Not “use push forever because it is easy.”  
- Not “keep ensure-schema forever as the migrator.”  
- Not “big-bang rewrite of all 92 tables.”  
- Not unifying SQLite and Postgres into one DDL runner in Phase 2–3.
