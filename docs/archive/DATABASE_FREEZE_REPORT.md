# Database Freeze Report — Phase 1 Governance

> Generated: 2026-07-11  
> Scope: Freeze current schema architecture before migration.  
> Method: Comment-only freeze markers + full-repo DDL scan.  
> **No behaviour changes. No code deleted. No systems removed.**

---

## Freeze actions completed

| Target | System | File | Status |
|--------|--------|------|--------|
| Runtime DDL on `@workspace/db` import | **C** | `lib/db/src/index.ts` | **FROZEN** — freeze banner added |
| Boot-time `ensureCoreSchema` | **D** | `lib/db/src/ensure-schema.ts` | **FROZEN** — freeze banner added |
| Manual inline migrate CLI | **B** | `scripts/src/migrate.ts` | **FROZEN** — freeze banner added |

Freeze banner text (all three files):

```
This file is frozen.
Do not add new schema changes here.
Future schema changes must follow the database governance process.
```

Existing DDL/DML in these files remains **active and unchanged** for production compatibility.

---

## Runtime DDL locations (System C)

| Item | Detail |
|------|--------|
| **File** | `lib/db/src/index.ts` |
| **Trigger** | Module import of `@workspace/db` |
| **Mechanism** | Fire-and-forget `void pool.query(...)` |
| **Awaited?** | No |
| **Approx. DDL statement matches** | ~190 (`CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` / `DROP *`) |
| **Also includes** | Import-time DML (`UPDATE`, `DELETE`, `INSERT` backfills) |
| **Freeze** | Marked FROZEN — do not add new schema changes |

Runs on every process that imports `@workspace/db` (API server, seed scripts, verify scripts, tests that import the package).

---

## Boot DDL locations (System D)

| Item | Detail |
|------|--------|
| **File** | `lib/db/src/ensure-schema.ts` |
| **Export** | `ensureCoreSchema(pool)` |
| **Caller** | `artifacts/api-server/src/index.ts` → `await ensureCoreSchema(pool)` before `app.listen` |
| **Mechanism** | Awaited sequential `pool.query` batches |
| **Awaited?** | Yes (blocks listen) |
| **Approx. DDL statement matches** | ~150 |
| **Freeze** | Marked FROZEN — do not add new schema changes |

---

## Manual migration locations (System B)

| Item | Detail |
|------|--------|
| **File** | `scripts/src/migrate.ts` |
| **Invocation** | `pnpm migrate` / `pnpm migrate:prod` / part of `pnpm db:setup:prod` |
| **Mechanism** | Hard-coded `migrations: Array<{ label, sql }>` executed via `client.query` |
| **Reads `lib/db/migrations/*.sql`?** | **No** |
| **Approx. DDL statement matches** | ~86 |
| **Unique ownership** | Creates `sessions` table (not in Drizzle schema) |
| **Freeze** | Marked FROZEN — do not add new feature DDL here |

---

## Drizzle locations (System A)

| Item | Detail |
|------|--------|
| **Schema** | `lib/db/src/schema/**/*.ts` (~56 schema modules; ~92 `pgTable` definitions) |
| **Config** | `lib/db/drizzle.config.ts` — `schema: "./src/schema/index.ts"`, dialect `postgresql` |
| **Apply path** | `drizzle-kit push` via `lib/db` package script `"push"` |
| **Root scripts** | `db:push:prod`, `db:setup:prod` (= push + migrate) |
| **Journaled migrations** | **None** — no `out` migrations folder / drizzle meta journal configured |
| **Runs on API start?** | No — CLI only |

Drizzle schema TypeScript remains the declarative ORM shape. Push is **not** frozen by this phase (governance still routes future *applied* DDL through the eventual versioned migrator). Healers C/D/B are frozen against new entries.

---

## Secondary / non-primary DDL sources (documented, not newly frozen)

These are **not** Systems C/D freeze targets, but appear in the repo DDL inventory:

### Orphan SQL files — `lib/db/migrations/`

| File | Wired to a runner? |
|------|-------------------|
| `0001_scoring_foundation.sql` | **No** — manual / docs only; content overlaps B + C + Drizzle |
| `0002_verified_push_subscriptions.sql` | **No** — manual / docs only; overlaps D; contains `DELETE FROM push_subscriptions` |

### Ad-hoc CLI bootstrap — `scripts/verify-master-sports-db.ts`

| Item | Detail |
|------|--------|
| **When** | Manual CLI |
| **What** | Inline `BOOTSTRAP_SQL` (~40 DDL matches) then verifies tables/columns |
| **Overlap** | Duplicates System C master-sports block |

### Local SQLite — `lib/db-local/src/setup.ts`

| Item | Detail |
|------|--------|
| **Engine** | libSQL / SQLite (offline `bidwar-local`) |
| **Approx. DDL matches** | ~51 |
| **Cloud Postgres?** | No — separate schema ownership domain |

---

## Full-repo DDL scan (violations check)

**Search pattern:** `CREATE TABLE` | `ALTER TABLE` | `CREATE INDEX` | `CREATE UNIQUE INDEX` | `DROP TABLE` | `DROP INDEX` | `DROP COLUMN`  
**Scope:** `*.{ts,js,mjs,cjs,sql}` across the repository (excluding docs).

### Files containing DDL

| File | Role | Classification |
|------|------|----------------|
| `lib/db/src/index.ts` | System C runtime | Known — **frozen** |
| `lib/db/src/ensure-schema.ts` | System D boot | Known — **frozen** |
| `scripts/src/migrate.ts` | System B manual | Known — **frozen** |
| `scripts/verify-master-sports-db.ts` | Ad-hoc CLI | Known secondary |
| `lib/db-local/src/setup.ts` | Local SQLite setup | Known secondary (non-cloud) |
| `lib/db/migrations/0001_scoring_foundation.sql` | Orphan SQL | Known secondary |
| `lib/db/migrations/0002_verified_push_subscriptions.sql` | Orphan SQL | Known secondary |

### Application / route code

No `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` / `DROP *` statements found under:

- `artifacts/api-server/`
- `artifacts/auction-platform/`
- `artifacts/bidwar-local/` (beyond db-local setup)
- `lovableupdates/`

Data-migration scripts (e.g. `scripts/migrate-player-spec-values.ts`, `artifacts/api-server/src/lib/master-sports/migrate-badminton.ts`) perform **row DML** via Drizzle; they do not embed schema DDL. Importing `@workspace/db` still triggers System C as a side effect.

---

## New violations found

**None.**

No additional runtime `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` / `DROP` statements were discovered outside the already-documented systems (A/B/C/D) and documented secondaries (orphan SQL, verify-master-sports CLI, local SQLite setup).

---

## Explicit non-actions (this phase)

- Did **not** remove any schema system  
- Did **not** delete runtime DDL  
- Did **not** delete `ensureCoreSchema`  
- Did **not** replace migrations  
- Did **not** change production behaviour  
- Did **not** refactor or disable existing healers  

---

## Governance implication

From this freeze forward:

1. **Do not** add new columns/tables/indexes to Systems B, C, or D.  
2. **Do** design new schema changes for the database governance / versioned migrator path.  
3. Existing healers continue to run unchanged until a later removal phase after soak.

See also: `SCHEMA_GOVERNANCE.md`, `DATABASE_MIGRATION_STRATEGY.md`, `DATABASE_ARCHITECTURE_VERIFICATION.md`.
