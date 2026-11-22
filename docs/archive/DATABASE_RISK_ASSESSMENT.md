# BidWar Database Risk Assessment

> Phase 1 read-only. Classifies every schema mutation mechanism.  
> Scale: **SAFE** · **MEDIUM RISK** · **HIGH RISK** · **CRITICAL**

---

## Mechanism risk table

| Mechanism | Classification | Why |
|-----------|----------------|-----|
| **A. Drizzle Kit `push`** | **HIGH RISK** | Non-versioned schema sync. Can alter/drop to match TS without a reviewable migration journal. `push-force` increases danger. No automatic backup. Safe only when operators carefully review drizzle-kit prompts. |
| **B. `scripts/src/migrate.ts`** | **MEDIUM RISK** | Idempotent IF NOT EXISTS / duplicate-object skip. No version ledger (re-runs every statement every time). Mostly additive. Constraint-add without IF NOT EXISTS (`organizers_google_id_unique`) relies on error codes. Does not cover full schema. |
| **C. `lib/db/src/index.ts` import DDL** | **CRITICAL** | Runs on every import, unawaited, includes DROP COLUMN/INDEX, DELETE, mass UPDATE, unique index builds, and races with boot/deploy. Failures are logged only. Acts as hidden production migrator. |
| **D. `ensureCoreSchema` at boot** | **HIGH RISK** | Awaited (good) and mostly additive (good), but runs DDL on every start, duplicates other systems, can lock catalogs under concurrency, and is the only gate before listen — long DDL delays availability. |
| **O. Orphan `lib/db/migrations/*.sql`** | **HIGH RISK** (if manually applied) / **MEDIUM** (as docs) | Not wired — drift magnet. `0002` contains `DELETE FROM push_subscriptions` (data wipe). Operators following file headers may apply destructive SQL thinking it is “the” migration path. |
| **V. `verify-master-sports-db.ts`** | **MEDIUM RISK** | Manual; duplicates C; can DROP INDEX; intended for bootstrap/verify. |
| **Local `db-local` setup.ts** | **MEDIUM RISK** | Isolated to SQLite; try/catch ALTER; drift from cloud can break sync semantics. |
| **Seed scripts importing `@workspace/db`** | **HIGH RISK** (collateral) | Trigger System C against whatever DATABASE_URL is loaded — easy to point at prod. |
| **Data migration CLIs** (`migrate-player-spec-values`, badminton→master, repair-*) | **MEDIUM–HIGH** | Row mutation; some repair scripts destructive by design; not schema DDL but can corrupt referential assumptions. |
| **`brandingService.migrateLegacyBrandingAssets`** | **SAFE** | Idempotent DML copy of URLs into assets; no DDL. |
| **Keep-alive `SELECT 1`** | **SAFE** | No schema change. |

---

## Cross-cutting CRITICAL findings

### 1. Dual runtime migrators on every boot (C + D)

Evidence: `index.ts` void queries + `await ensureCoreSchema(pool)` in `artifacts/api-server/src/index.ts`.

**Why CRITICAL:** Production schema changes ship by deploying code that mutates Postgres at process start, without a migration plan, lock strategy, or success gate for System C.

### 2. No single source of applied schema truth

Evidence: no drizzle meta journal; migrate.ts has no `_migrations` table; SQL files unused.

**Why CRITICAL for operability:** Cannot answer “what version is prod on?” from the database.

### 3. System C data mutations

Evidence: DELETE/UPDATE/INSERT blocks in `lib/db/src/index.ts` (player_team_assignments, serial_no, access_code, tournament_player_profiles, scorer_pin).

**Why CRITICAL:** Schema “ensure” code performs data surgery under concurrency.

### 4. Orphan SQL falsely documented as migrate path

Evidence: ARCHITECTURE_MAP / DATABASE_AUDIT claim SQL files run via migrate.ts; code does not.

**Why HIGH:** Mis-operation risk; wrong mental model for engineers.

---

## Per-operation risk notes (runtime)

| Operation pattern | Class | Why |
|-------------------|-------|-----|
| `CREATE TABLE IF NOT EXISTS` | MEDIUM | Usually safe; still takes locks; definition may diverge from Drizzle |
| `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | MEDIUM | Safe additive; rewrite risk if DEFAULT on huge tables (Postgres versions vary) |
| `CREATE INDEX IF NOT EXISTS` (non-unique) | MEDIUM–HIGH | Build cost; concurrent write impact |
| `CREATE UNIQUE INDEX IF NOT EXISTS` | **HIGH** | Fails or blocks if duplicates; long build |
| Partial unique `uq_pta_active_roster` | **HIGH** | Same + only in runtime |
| `DROP INDEX IF EXISTS` | HIGH | Unexpected plan changes |
| `DROP COLUMN` | **CRITICAL** | Irreversible without backup |
| Mass `UPDATE`/`DELETE` in ensure path | **CRITICAL** | Data integrity under race |

---

## CLI mechanism risk notes

| Operation | Class | Why |
|-----------|-------|-----|
| `drizzle-kit push` interactive accept | HIGH | Can drop columns/tables to match schema |
| `push --force` | **CRITICAL** | Skips confirmations |
| migrate.ts additive IF NOT EXISTS | MEDIUM | Re-executes all labels every run (noise + lock checks) |
| migrate.ts UNIQUE constraint without IF NOT EXISTS | MEDIUM | Relies on 42710 skip |
| Manual `0002` DELETE push_subscriptions | **CRITICAL** | Wipes subscriptions |

---

## Deploy / environment risks

| Scenario | Class | Evidence |
|----------|-------|----------|
| Deploy without `db:push` / `migrate` | HIGH | DEPLOY.md/Dockerfile/CI do not run them; relies on C/D |
| Multi-instance simultaneous boot | HIGH | Both run C+D |
| Running seeds against prod URL | CRITICAL | System C + DML seeds |
| Local SQLite drift | MEDIUM | Separate schema owner |

---

## What is relatively SAFE today

- Idempotent additive ALTERs after objects already exist (no-op catalog checks).  
- Branding legacy asset DML.  
- Keep-alive ping.  
- Reading Drizzle schema as the ORM contract (does not mutate DB by itself).

---

## Accuracy note vs prior audit

Prior TECHNICAL_DEBT DB-ARCH-001 rated “four parallel paths” as CRITICAL — **agree on severity**.  
This assessment additionally rates **System C’s DML + unawaited execution** as the single most critical operational hazard, and downgrades orphan SQL from “active system” to “documentation/footgun” unless manually executed.
