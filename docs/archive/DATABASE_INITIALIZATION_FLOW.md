# BidWar Database Initialization Flow

> Phase 1 read-only. Complements `DATABASE_BOOT_SEQUENCE.md` with all initialization *paths*, not only API boot.

---

## Path 1 — Fresh / empty database (intended operator flow)

Documented by root `package.json`:

```
pnpm db:setup:prod
  = pnpm db:push:prod
      → cross-env NODE_ENV=production
      → pnpm --filter @workspace/db run push
      → drizzle-kit push --config ./drizzle.config.ts
      → syncs 92 Drizzle tables + declared indexes to Postgres
  + pnpm migrate:prod
      → scripts/src/migrate.ts
      → applies inline SQL labels (sessions, scoring foundation tables,
        purse_boosters, creative_jobs, intelligence archives, academy, …)
```

**Gaps after this path alone:**

- Many objects exist only in Systems C/D (communication_*, bulk_import_*, contact_inquiries, google_sheet_syncs, admin_notifications, badminton full set, master sports extras, cricket scoring phase-1 extras, serial_no unique index, partial indexes, etc.).
- Those appear when the API first imports `@workspace/db` and/or runs `ensureCoreSchema`.

So “setup” is **incomplete without a subsequent API boot** (or equivalent import of `@workspace/db`).

---

## Path 2 — API process start (always)

See `DATABASE_BOOT_SEQUENCE.md`.

Summary:

1. Bootstrap env  
2. Import `@workspace/db` → System C DDL (async, unawaited)  
3. `await ensureCoreSchema` → System D DDL  
4. Listen  

This is the **primary production schema healer**.

---

## Path 3 — Manual migrate only

```
pnpm migrate / migrate:prod
```

Applies System B only. Does not push Drizzle schema. Does not run ensure-schema. Does not run orphan `*.sql` files.

---

## Path 4 — Manual Drizzle push only

```
pnpm db:push:prod
# or
pnpm --filter @workspace/db run push
# force:
pnpm --filter @workspace/db run push-force
```

Applies System A only. Will create/alter to match TypeScript schema. Will **not** create `sessions`. Will **not** create runtime-only partial indexes unless also declared in Drizzle (many are not).

---

## Path 5 — Orphan SQL (manual only)

```
psql $DATABASE_URL -f lib/db/migrations/0001_scoring_foundation.sql
psql $DATABASE_URL -f lib/db/migrations/0002_verified_push_subscriptions.sql
```

**Not wired.** `0002` includes `DELETE FROM push_subscriptions` — destructive.

---

## Path 6 — Master sports verify bootstrap

```
npx tsx scripts/verify-master-sports-db.ts
```

Applies duplicated master-sports DDL, then asserts tables/columns exist.

---

## Path 7 — Local offline (SQLite)

```
bidwar-local → lib/db-local setupTables()
```

Independent schema. Incremental ALTER list in `lib/db-local/src/setup.ts`. Can drift from cloud.

---

## Dependency graph (cloud)

```
                    ┌─────────────────────────┐
                    │  lib/db/src/schema/*.ts │  (92 tables — source of truth for ORM)
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
     drizzle-kit push    ensure-schema.ts    index.ts runtime DDL
        (CLI)              (API boot)         (import side effect)
              │                 │                 │
              └────────────┬────┴─────────────────┘
                           ▼
                 Neon PostgreSQL (public schema)
                           ▲
                           │
                  scripts/src/migrate.ts (CLI)
                           │
                  sessions + subset of tables/columns
                           ▲
                           │ (NOT connected)
                  lib/db/migrations/*.sql
```

---

## Initialization vs application readiness

| State | Meaning |
|-------|---------|
| Pool constructed | TCP/auth to Neon possible |
| System C in flight | Schema may still be mutating |
| `ensureCoreSchema` resolved | Boot-critical columns/tables for mapped queries intended to exist |
| `app.listen` | HTTP ready — **not** a guarantee System C finished |
| Workers started | Background DML against same schema |

---

## Seed scripts (data, not schema — but trigger System C)

| Script | Package script | Effect |
|--------|----------------|--------|
| `scripts/src/seed-demo.ts` | `seed:demo` | Inserts demo tournament data; imports `@workspace/db` |
| `scripts/src/seed-sports.ts` | `seed:sports` | Seeds sports/roles/specs |
| `scripts/src/seed-scoring-local.ts` | `seed:scoring-local` | Local scoring seed |

---

## Environment branching

| Variable / host | Effect on init |
|-----------------|----------------|
| `NODE_ENV=production` | Loads `.env.production` if present; `db:push:prod` / `migrate:prod` set this |
| Managed host (`RENDER`, `RAILWAY_*`, `FLY_*`, `VERCEL`, `REPL_ID`) | Host env wins over file for secrets/public URL keys |
| Missing env file in production | Warning only if host injected vars; `assertRuntimeEnv` still requires DB URL |
| `NEON_DATABASE_URL` vs `DATABASE_URL` | Neon alias preferred |

No environment flag disables Systems C or D.
