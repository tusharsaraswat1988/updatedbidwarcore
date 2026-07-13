# Database Boot Metrics Report

> Generated: 2026-07-11  
> Scope: Observability only for Systems C and D.  
> **No schema changes. No SQL changes. No healer removal. No behaviour change to boot sequencing.**

---

## Summary

Startup database work is now measured and logged **once per process** after System D finishes and System C query batches settle. The API still does **not** await System C before `listen` (unchanged).

---

## Files changed

| File | Change |
|------|--------|
| `lib/db/src/boot-metrics.ts` | **New** — statement classification, System C/D metric store, one-shot summary printer |
| `lib/db/src/index.ts` | System C: `systemCQuery` metrics wrapper around existing `pool.query` + SQL; `finalizeSystemCTracking()` after registration |
| `lib/db/src/ensure-schema.ts` | System D: timing + query counter + success/failure via local `q()` wrapper; records metrics in `finally` |
| `DATABASE_BOOT_METRICS_REPORT.md` | This report |

Unrelated prior freeze banners in the same files remain; SQL strings are byte-for-byte unchanged.

---

## Metrics added

### System C (`lib/db/src/index.ts`)

| Metric | Description |
|--------|-------------|
| `executionTimeMs` | Wall time from first System C batch to `Promise.allSettled` of all batches |
| `createStatements` | Count of `CREATE TABLE` in registered SQL |
| `alterStatements` | Count of `ALTER TABLE` |
| `createIndexStatements` | Count of `CREATE INDEX` / `CREATE UNIQUE INDEX` |
| `dropStatements` | Count of `DROP TABLE` / `DROP INDEX` / `DROP COLUMN` |
| `dmlStatements` | Count of `UPDATE` / `INSERT` / `DELETE` |
| `queryBatches` | Number of `pool.query` invocations registered |
| `failures` | Batches that rejected (still logged by existing `.catch`) |

### System D (`ensureCoreSchema`)

| Metric | Description |
|--------|-------------|
| `executionTimeMs` | Wall time for the full `ensureCoreSchema` call |
| `queryCount` | Number of `pool.query` batches executed (9 today) |
| `success` | `true` if all batches completed without throw |
| `failure` | `true` if thrown (original error still rethrown) |

### Combined

| Metric | Description |
|--------|-------------|
| `totalDatabaseBootTimeMs` | From metrics module load to summary print (covers C∪D window) |

---

## Logging behaviour

- **No per-query logs**
- **One** human-readable block + **one** structured JSON line (`event: "database_startup_summary"`)
- Printed only when **both** System C has settled **and** System D has recorded metrics
- Does **not** block `app.listen` (summary is async / non-blocking)
- Scripts that import `@workspace/db` but never call `ensureCoreSchema` do **not** print a summary

---

## Sample startup output

Statement counts below reflect current System C SQL inventory (classification at registration time). Timings are illustrative and vary with Neon cold start / network.

```
=========================================
DATABASE STARTUP SUMMARY
=========================================
System C
Execution Time: 1842ms
DDL Statements: 191 (CREATE 35, ALTER 71, CREATE INDEX 83, DROP 2)
DML Statements: 10
System D
Execution Time: 956ms
Queries: 9
Success: true
Failure: false
Total Database Boot Time: 2104ms
=========================================
{"event":"database_startup_summary","systemC":{"executionTimeMs":1842,"createStatements":35,"alterStatements":71,"createIndexStatements":83,"dropStatements":2,"dmlStatements":10,"queryBatches":24,"failures":0},"systemD":{"executionTimeMs":956,"queryCount":9,"success":true,"failure":false},"totalDatabaseBootTimeMs":2104}
```

---

## Implementation notes

1. **System C wrapper** — `systemCQuery(sql)` calls `observeSystemCQuery(sql, () => pool.query(sql))`. Same SQL, same fire-and-forget `.catch` handlers.
2. **System D wrapper** — local `q(sql)` increments a counter then `return pool.query(sql)`. Same SQL batches.
3. **Boot order unchanged** — import still starts System C unawaited; `start()` still `await ensureCoreSchema(pool)` then continues; listen is not gated on System C completion.
4. **Failure path** — System D still throws; metrics `success: false` / `failure: true` recorded in `finally` before rethrow.

---

## Risk assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Extra overhead per System C/D query | **Low** | Regex classify on SQL string + counter increment only |
| Summary never prints | **Low** | Requires both C settle + D record; API always calls D |
| Summary prints twice | **None expected** | `summaryPrinted` guard |
| Delayed listen | **None** | Summary is non-blocking; listen path unchanged |
| SQL/behaviour drift | **None intended** | Wrappers pass through identical SQL; errors still propagate/log as before |
| Double-count DML in `DO $$` / comments | **Low** | Heuristic regex; metrics are directional for ops, not a ledger |
| Test mocks of `@workspace/db` | **None** | Mocks bypass real ensureCoreSchema / index side effects |

**Overall risk: Low.** Safe to ship as observe-only instrumentation on `develop`.
