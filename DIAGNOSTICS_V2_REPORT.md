# Diagnostics V2 Report

> Date: 2026-07-11  
> Branch: `develop`  
> Extends: [DIAGNOSTICS_IMPLEMENTATION_REPORT.md](./DIAGNOSTICS_IMPLEMENTATION_REPORT.md)

---

## Summary

Diagnostics now exposes additional **process / memory / infra** fields on the same master-admin API and System Settings page. All values are read from **in-process state** — no new database queries, no startup/healer/auction/schema changes.

---

## Fields added

| # | Field | Source | Notes |
|---|--------|--------|-------|
| 1 | Server start time | `Date.now() - process.uptime()` | ISO timestamp |
| 2 | Current server uptime | `process.uptime()` | Seconds + human string |
| 3 | Process PID | `process.pid` | |
| 4 | Node version | `process.version` | |
| 5 | Git branch | `BIDWAR_GIT_BRANCH` / `RENDER_GIT_BRANCH` / `GIT_BRANCH` | Env only; no `git` exec |
| 6 | Memory RSS / Heap Used / Heap Total | `process.memoryUsage()` | Bytes + MB |
| 7 | Event loop delay | **Skipped** | Not instrumented in-process; API returns `null`, UI shows “not instrumented” |
| 8 | Redis status | Existing Redis module flags + client `.status` | No ping |
| 9 | SSE status | Existing broadcast counters (auction/scoring/badminton) | No auction logic changes |
| 10 | Database connection status | `pg.Pool` `totalCount` / `idleCount` / `waitingCount` | In-memory pool stats only |

---

## Files changed

| File | Change |
|------|--------|
| `lib/diagnostics/collect-runtime-diagnostics.ts` | **New** — gathers process/memory/redis/sse/pool |
| `lib/redis.ts` | Added `getRedisDiagnosticsStatus()` (read-only) |
| `lib/diagnostics/build-startup-payload.ts` | Embeds runtime block in API payload |
| `routes/diagnostics.ts` | Passes `pool` into collector |
| `diagnostics-panel.tsx` | Displays all v2 fields |
| Diagnostics tests | Updated for v2 payload |

---

## Explicit non-changes

- No database queries added  
- No System C/D / `ensureCoreSchema` behaviour changes  
- No auction / SSE implementation changes (counters only)  
- No schema / SQL / migration changes  
- No new dependencies  
- Event loop delay **not** added (per “skip if unavailable”)

---

## Tests

```
pnpm --filter @workspace/api-server test -- \
  src/__tests__/diagnostics-helpers.test.ts \
  src/__tests__/diagnostics-route.test.ts
```

**Result:** 13 passed.

---

## UI

`/admin/settings/system/diagnostics` now shows:

- Process card (start time, uptime, PID, Node version)  
- Memory card (RSS, heap used, heap total)  
- Infrastructure card (Redis, SSE, DB pool, event-loop note)  
- Existing build / DB identity / startup metrics  

---

## Ops notes

- Git branch shows `unknown` unless Render/env injects a branch variable.  
- Redis `disabled` is normal when `REDIS_URL` is unset (in-memory fallback).  
- DB pool status reflects this Node process only; it is not a live SQL health check.
