# BidWar Database Boot Sequence

> Phase 1 read-only. Evidence from `artifacts/api-server/src/index.ts`, `lib/bootstrap.ts`, `lib/db/src/index.ts`, `lib/db/src/ensure-schema.ts`.

---

## Production / API server lifecycle (exact call order)

```
Process start
  │
  ├─①  import "./lib/bootstrap.js"          [artifacts/api-server/src/index.ts L1]
  │      ├─ configureSharpMemory()
  │      ├─ loadAppEnv()                    [@workspace/db/load-app-env]
  │      └─ assertRuntimeEnv()              [runtime-env.ts — requires DATABASE_URL/NEON_DATABASE_URL]
  │
  ├─②  import "./lib/scoring-adapters/register.js"
  ├─③  import app from "./app"              [pulls route graph → many `@workspace/db` imports]
  │
  ├─④  import { ensureCoreSchema, pool } from "@workspace/db"
  │      │
  │      │  ★ MODULE EVALUATION OF lib/db/src/index.ts (System C)
  │      ├─ resolveDatabaseUrl()
  │      ├─ new Pool({ connectionString, connectionTimeoutMillis: 20000, idleTimeoutMillis: 30000, max: 10 })
  │      ├─ drizzle(pool, { schema })
  │      ├─ setInterval(keep-alive SELECT 1, 4 min)
  │      └─ void pool.query(...) × ~24 blocks   ← FIRE-AND-FORGET DDL/DML (NOT awaited)
  │           CREATE TABLE / ALTER TABLE / CREATE INDEX / DROP / UPDATE / DELETE / INSERT
  │
  ├─⑤  other static imports (logger, workers, branding, redis, …)
  │      (any further `@workspace/db` import is a no-op for module side effects — already evaluated)
  │
  └─⑥  start() async
         ├─ await ensureCoreSchema(pool)     ★ System D — BLOCKS until complete
         ├─ await brandingService.migrateLegacyBrandingAssets()   (DML only)
         ├─ await brandingService.refreshPlatformBrandingCache()
         ├─ await refreshBrandingIconCache()
         ├─ await seedCommunicationDefaults()  (may insert template rows)
         ├─ await initRedisClients()
         ├─ await startAuctionEventSubscriber()
         └─ app.listen(port, "0.0.0.0", …)
              ├─ startConsentBlastScheduler()
              ├─ startCreativeRenderWorker()
              ├─ startCommunicationWorker()
              └─ startMemoryDiagnostics()
```

---

## Function / dependency map

| Step | Function / symbol | Module | Depends on | Schema effect |
|------|-------------------|--------|------------|---------------|
| ① | `loadAppEnv` | `lib/db/src/load-app-env.ts` | dotenv, repo root | None (env only) |
| ① | `assertRuntimeEnv` | `artifacts/api-server/src/lib/runtime-env.ts` | process.env | None; fails if no DB URL |
| ④ | `resolveDatabaseUrl` | `lib/db/src/database-url.ts` | env | None |
| ④ | `Pool` / `drizzle` | `lib/db/src/index.ts` | pg, drizzle-orm, schema | Connection only |
| ④ | anonymous `void pool.query` | `lib/db/src/index.ts` | pool | **Runtime DDL/DML** |
| ⑥ | `ensureCoreSchema` | `lib/db/src/ensure-schema.ts` | pool | **Awaited DDL** |
| ⑥ | `migrateLegacyBrandingAssets` | branding-service | db | DML |
| ⑥ | `seedCommunicationDefaults` | communication/seed-templates | db | DML (+ template key rename helper) |
| ⑥ | `app.listen` | express | — | Application ready |

---

## Parallelism and races during boot

1. **System C starts before System D and is not awaited.**  
   Import-time `void pool.query` races with `await ensureCoreSchema(pool)`. Both issue overlapping `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... IF NOT EXISTS` against the same Neon database.

2. **Multi-instance deploy race.**  
   If two API instances start together, both run Systems C and D concurrently. Most statements are idempotent (`IF NOT EXISTS`), but:
   - unique index builds can contend
   - `UPDATE` / `DELETE` / `INSERT` backfills can race
   - `DROP COLUMN` / `DROP INDEX` can race with readers

3. **Listen gate.**  
   HTTP listen waits for System D (and branding/seed/redis). It does **not** wait for System C completion. Early requests after listen could still hit incomplete System C work (rare, but possible under slow Neon / lock wait).

---

## What does *not* run on server start

| Mechanism | Runs on start? |
|-----------|----------------|
| `drizzle-kit push` | No |
| `scripts/src/migrate.ts` | No |
| `lib/db/migrations/*.sql` | No (never auto-run) |
| `scripts/verify-master-sports-db.ts` | No |
| Drizzle migration journal | N/A (does not exist) |

---

## Non-API processes that still mutate schema

Any script importing `@workspace/db` evaluates System C:

- `scripts/src/seed-demo.ts`, `seed-sports.ts`, `seed-scoring-local.ts`
- `scripts/src/verify-root-cause-rcv.ts`, `purge-badminton-matches.ts`
- API tests that import the real package (mocked in some tests)

`scripts/src/migrate.ts` does **not** import `@workspace/db`’s pool/index side effects for DDL — it uses its own `pg.Client` — but it does import `loadAppEnv` / `resolveDatabaseUrl` from subpath exports (`./database-url`, `./load-app-env`), which do **not** trigger System C.

---

## Idealized vs actual “Migration” step

Previous audits drew:

```
Server Start → Connection → Schema Validation → Migration → Ready
```

**Actual:**

```
Server Start
  → Env load + assert
  → Connection pool create (on @workspace/db import)
  → Concurrent opportunistic DDL (System C, unawaited)
  → Awaited opportunistic DDL (System D)
  → Data seeds / caches
  → Listen (Ready)
```

There is no versioned migration step and no schema validation beyond “try to add missing objects.”
