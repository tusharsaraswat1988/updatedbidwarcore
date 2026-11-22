# BidWar Database Architecture Verification — Phase 1

> Generated: 2026-07-11 — **Read-only** verification audit.  
> Scope: Cloud PostgreSQL (Neon) schema management. Local SQLite (`lib/db-local`) is documented separately where it intersects.  
> Method: Full-repo trace of every DDL entry point; no code changes; no migrations generated.

---

## Executive verdict

**The previous audit’s claim of “four independent schema management systems” is directionally correct for active cloud Postgres mutation paths, but factually imprecise in attribution.**

| Previous claim | Verified reality |
|----------------|------------------|
| Four parallel schema paths | **Four active cloud mutation mechanisms exist** (see below). Additional non-wired / secondary sources also exist. |
| SQL files in `lib/db/migrations/*.sql` are “run via `scripts/src/migrate.ts`” | **FALSE.** `migrate.ts` never reads those files. They are orphan manual SQL. |
| `ensure-schema.ts` is one of the four (ARCHITECTURE_MAP) / omitted from TECHNICAL_DEBT’s numbered list | **It is an active boot-time path**, distinct from `index.ts` import-time DDL. |
| Index names like `auctions_code_idx` / `auctions_organizer_idx` on `tournaments` | **Partially wrong.** Drizzle defines `ix_tournaments_auction_code` only; no `organizer_id` index in Drizzle schema. |

---

## Verified active schema mutation systems (cloud Postgres)

### System A — Drizzle Kit push (CLI, authoritative TypeScript schema)

| Item | Evidence |
|------|----------|
| Config | `lib/db/drizzle.config.ts` — `schema: "./src/schema/index.ts"`, dialect `postgresql`, **no `out` migrations folder** |
| Package script | `lib/db/package.json` → `"push": "drizzle-kit push --config ./drizzle.config.ts"` |
| Root scripts | `package.json` → `db:push:prod`, `db:setup:prod` (= push + migrate) |
| Tables defined | **92** `pgTable(...)` definitions under `lib/db/src/schema/` |
| Journal / drizzle-kit migrate | **None.** No `lib/db/meta/`, no drizzle migration journal. Push is the only Drizzle apply path. |

**When it runs:** Only when a human/CI invokes `pnpm db:push:prod` (or `pnpm --filter @workspace/db run push`). Not on API startup. Not referenced in `Dockerfile`, `DEPLOY.md`, or GitHub Actions.

---

### System B — CLI migrate script (inline SQL array)

| Item | Evidence |
|------|----------|
| File | `scripts/src/migrate.ts` |
| Invocation | `pnpm migrate` / `pnpm migrate:prod` → `@workspace/scripts` `"migrate": "tsx src/migrate.ts"` |
| Mechanism | Hard-coded `migrations: Array<{ label, sql }>` executed sequentially with `client.query` |
| Reads `lib/db/migrations/*.sql`? | **No.** Grep of `readFile`, `.sql`, and `migrations/` path usage in `migrate.ts` finds only the in-memory array named `migrations`. |
| Error handling | Treats Postgres `42710` / `42P07` (duplicate object) as skip; other errors abort |
| Unique ownership | Creates `sessions` table — **not** in Drizzle schema |

**When it runs:** Manual / `db:setup:prod` only. Not on API startup.

---

### System C — Module-import runtime DDL (`lib/db/src/index.ts`)

| Item | Evidence |
|------|----------|
| Trigger | Side-effect `void pool.query(...)` blocks at module top level after `Pool` + `drizzle()` construction |
| Count (approx.) | ~24 fire-and-forget blocks; ~35 `CREATE TABLE`, ~71 `ALTER TABLE`, ~83 index creates, plus `DROP` / `UPDATE` / `DELETE` / `INSERT` |
| Awaited? | **No.** Errors only `console.error`; startup does not wait |
| Runs when | **Every process that imports `@workspace/db`** (API server, seed scripts, verify scripts, tests that import the package) |

**Destructive / data-mutating ops on import (not just DDL):**

- `DROP COLUMN referee_name` (conditional DO block)
- `DROP INDEX uq_pta_player_team_tournament`
- `UPDATE players` (serial_no backfill)
- `UPDATE teams` (access_code backfill)
- `UPDATE badminton_match_details` (scorer_pin backfill)
- `DELETE FROM player_team_assignments` (dedupe)
- `INSERT INTO tournament_player_profiles` (backfill from badminton_players)

---

### System D — Boot-time `ensureCoreSchema` (`lib/db/src/ensure-schema.ts`)

| Item | Evidence |
|------|----------|
| Export | `ensureCoreSchema(pool)` |
| Caller | `artifacts/api-server/src/index.ts` → `await ensureCoreSchema(pool)` **before** `app.listen` |
| Mechanism | Awaited sequential `pool.query` batches: ALTER columns, CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS |
| Overlap | Heavy duplication with Systems B and C (tournaments columns, intelligence archives, academy, push/owner sessions, bulk import, communication_*, etc.) |

**When it runs:** Every API server start. Blocks listen until complete (or throws → process exit).

---

## Non-active / secondary schema sources (not one of the “four runners”)

### Orphan SQL files — `lib/db/migrations/`

| File | Header claim | Actual wiring |
|------|--------------|---------------|
| `0001_scoring_foundation.sql` | “Apply via: pnpm --filter @workspace/db run push” or manual | **Not executed by any TypeScript runner.** Content duplicated in `migrate.ts` + Drizzle scoring schemas + `index.ts` phase-1 scoring DDL |
| `0002_verified_push_subscriptions.sql` | Same | **Not executed by any runner.** Content duplicated in `ensure-schema.ts` (owner_sessions / push columns). Contains `DELETE FROM push_subscriptions` (destructive if ever run manually) |

No code under `lib/db`, `scripts`, or `artifacts/api-server` loads these paths.

### Ad-hoc bootstrap — `scripts/verify-master-sports-db.ts`

Applies master-sports DDL then verifies tables/columns. Manual CLI. Duplicates System C master-sports block.

### Local SQLite — `lib/db-local/src/setup.ts`

Separate engine (libSQL). Own `CREATE TABLE` + try/catch `ALTER TABLE`. Used only by `bidwar-local`. Not a cloud Postgres path, but a **fifth schema ownership domain** for offline mode.

### Data migrations (not schema DDL systems)

Scripts such as `scripts/migrate-player-spec-values.ts`, `scripts/migrate-badminton-to-master.ts`, `scripts/backfill-player-sport-profiles.ts`, repair scripts — mutate **rows**, not table definitions (except where they import `@workspace/db` and thereby trigger System C).

### Boot data migration (not DDL)

`brandingService.migrateLegacyBrandingAssets()` copies legacy URL columns into `branding_assets` rows — DML only.

---

## Previous audit cross-check

### DATABASE_AUDIT.md / ARCHITECTURE_MAP.md / TECHNICAL_DEBT_REPORT.md (DB-ARCH-001)

| Statement | Verdict |
|-----------|---------|
| “4 parallel paths” | **Mostly true** if counting A–D above. |
| SQL migrations run via `migrate.ts` | **Incorrect** — evidence: no file I/O of `*.sql` in `migrate.ts`; orphan files. |
| TECHNICAL_DEBT lists SQL files + migrate.ts + index.ts + push, Location also cites ensure-schema | **Inconsistent listing** — ensure-schema is active; SQL files are not a runner. |
| Runtime DDL adds startup latency / lock risk | **Confirmed** — Systems C + D both run on every API boot; C also on any `@workspace/db` import. |
| Almost no Drizzle `references()` | **Confirmed** — zero `references(` matches under `lib/db/src/schema/`. FKs appear only in raw SQL (runtime / migrate). |
| `sessions` is legacy | **Confirmed** — only created in `migrate.ts`; absent from Drizzle schema. |

---

## Schema validation reality

There is **no dedicated schema validation step** (no checksum, no migration version table, no drizzle journal).

What actually happens:

1. Drizzle ORM maps TypeScript columns → `SELECT`/`INSERT` shapes.
2. If a mapped column is missing in Postgres, queries fail at runtime.
3. Systems C and D exist specifically to paper over that gap with `IF NOT EXISTS` DDL (see comment in `ensure-schema.ts`).

“Schema validation” in the boot flow is therefore **best-effort DDL ensure**, not validation.

---

## Environment-specific logic

| Concern | Behavior | Evidence |
|---------|----------|----------|
| Env file | `loadAppEnv()` loads `.env` (dev) or `.env.production` (prod); host-managed keys restored on Render/Railway/etc. | `lib/db/src/load-app-env.ts` |
| DB URL | `NEON_DATABASE_URL` preferred over `DATABASE_URL` | `lib/db/src/database-url.ts` |
| migrate.ts SSL | `ssl: { rejectUnauthorized: false }` on Client | `scripts/src/migrate.ts` |
| Pool SSL | Default `pg.Pool` (no explicit ssl in `index.ts`) | `lib/db/src/index.ts` |
| Deploy docs | `DEPLOY.md` / `Dockerfile` / `.github` do **not** invoke `db:push` or `migrate` | Grep of those paths |

Production schema evolution currently depends on: (1) someone running `db:setup:prod` / push+migrate, and/or (2) runtime DDL on boot/import.

---

## Confidence

High. Every CREATE/ALTER/DROP/INDEX path under cloud Postgres was traced to Systems A–D, orphan SQL, or the master-sports verify script. No additional automated schema runners were found in CI, Docker, or deploy docs.

---

## Appendix — Index Analysis (Step 7)

> Documentation only. No index recommendations.

### Existing indexes (Drizzle-declared)

Approximately **183** explicit `index(` / `uniqueIndex(` declarations under `lib/db/src/schema/`, plus column-level `.unique()` constraints (e.g. `organizers.email/mobile/googleId`, `auction_sessions.tournamentId`, `push_subscriptions.endpoint`, several `comm_*` uniques).

**Tables with rich Drizzle indexing:** players, scoring_*, communication_*, platform_audit, purse_boosters, badminton_*, bulk_import_*, creative_jobs, sports hierarchy, master-sports (non-partial), etc.

**Tables with PK-only (or PK + column unique) in Drizzle — notable gaps:**

| Table | Drizzle secondary indexes |
|-------|---------------------------|
| `bids` | **None** beyond PK |
| `categories` | **None** beyond PK |
| `teams` | Only `uq_teams_tournament_owner_mobile` (no plain `tournament_id` index) |
| `auction_bid_events` | **None** beyond PK |
| `auction_player_events` | **None** beyond PK |
| `auction_timer_events` | **None** beyond PK |
| `intelligence_archives` (+ children) | **None** in Drizzle (indexes exist in migrate.ts / ensure-schema create path partially) |
| `tournaments` | Only `ix_tournaments_auction_code` (prior audit’s `auctions_organizer_idx` **not present** in schema) |
| `branding_settings`, `settings`, `showcase_events`, `display_auctions`, `sms_notification_settings` | PK / key only |

### Migration-created indexes (`scripts/src/migrate.ts`)

Examples (non-exhaustive):  

- `uq_teams_tournament_owner_mobile`  
- `platform_audit_events` suite (`ix_audit_*`)  
- `IDX_sessions_expire`  
- scoring foundation indexes (`ix_scoring_*`, `uq_scoring_*`)  
- `ix_purse_boosters_tournament_team_status`  
- `ix_creative_jobs_*`  
- intelligence archive indexes (`ix_intel_*`)  
- academy indexes (`ix_academy_*`, `uq_academy_*`)  

These overlap Drizzle for many objects; intelligence archive indexes are **stronger in B than in A**.

### Runtime-created indexes

**System C (`index.ts`)** — ~83 `CREATE INDEX` / `CREATE UNIQUE INDEX` statements, including:

| Index | Ownership note |
|-------|----------------|
| `branding_assets_asset_type_active_idx` | Also in D + Drizzle |
| `uq_players_tournament_serial_no` | Created after serial_no backfill — **runtime-owned enforcement** |
| `uq_psv_*`, `ix_psv_*` | Also in Drizzle |
| `uq_psp_*`, `ix_psp_*` | Also in Drizzle |
| Badminton `ix_bp_*`, `uq_bp_tournament_short_name` (**partial**) | Partial unique **not** expressed the same way in all paths |
| `ix_gp_auction_player_id` (**partial unique**) | **Runtime-only** vs Drizzle `global_players` indexes |
| `uq_pta_active_roster` (**partial unique**) | **Runtime-only**; preceded by DROP of `uq_pta_player_team_tournament` |
| Master sports / scoring phase-1 / contact / google_sheet / admin notification indexes | Duplicate A |

**System D (`ensure-schema.ts`)** — ~40 index creates, including communication_*, bulk_import_*, workbook_*, photo_source_assets, owner_sessions, push_subscriptions, academy, branding_assets.

### Orphan SQL indexes

`0001_scoring_foundation.sql` and `0002_verified_push_subscriptions.sql` declare indexes matching B/D — **not auto-applied**.

### Missing ownership / duplicate creation paths

| Index / class | Declared in | Gap |
|---------------|-------------|-----|
| Most Drizzle indexes | A (+ often C/D/B copies) | Duplicate create paths on boot |
| Intelligence `ix_intel_*` | B (and D creates tables without all B indexes) | **Ownership split** — Drizzle schema has no indexes |
| `uq_pta_active_roster`, `ix_gp_auction_player_id`, `uq_bp_tournament_short_name` | C (and V for some) | **Not in Drizzle** — push will not manage them |
| `uq_players_tournament_serial_no` | C (+ Drizzle uniqueIndex) | Created only after runtime backfill logic |
| `sessions` / `IDX_sessions_expire` | B only | Outside ORM |
| Hot-path missing indexes (`bids.tournament_id`, etc.) | Nowhere | Documented gap; not created by any system |

### Prior audit index-name corrections

| Prior claim | Verified |
|-------------|----------|
| `auctions_code_idx` on tournaments | Actual Drizzle name: **`ix_tournaments_auction_code`** |
| `auctions_organizer_idx` | **Not found** in Drizzle schema |
| `players_tournament_id_idx` / `players_mobile_idx` | Actual: **`ix_players_tournament_id`**, **`ix_players_mobile_number`** (plus name/global indexes) |
| Intelligence indexes “only in migrate.ts” | **Mostly true** vs Drizzle; ensure-schema creates tables but migrate.ts has the richer index set |

