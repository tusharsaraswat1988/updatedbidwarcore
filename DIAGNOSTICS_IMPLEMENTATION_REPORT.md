# Diagnostics Implementation Report

> Date: 2026-07-11  
> Branch: `develop`  
> Spec: [DIAGNOSTICS_DESIGN.md](./DIAGNOSTICS_DESIGN.md)

---

## Summary

Implemented the Admin Diagnostics module as designed: master-admin-only API + System Settings UI that **reads** existing boot-metrics. No SQL/schema/auction/SSE/deploy changes. No Render API integration.

---

## What shipped

### API

| Item | Detail |
|------|--------|
| Route | `GET /api/auth/admin/diagnostics/startup` |
| Auth | `requireMasterAdmin` (existing middleware; unchanged) |
| Mount | `artifacts/api-server/src/routes/diagnostics.ts` via `routes/index.ts` |
| Behaviour | Assembles JSON from `getBootMetricsSnapshot()` + masked DB identity + env/build helpers |

### UI

| Item | Detail |
|------|--------|
| Path | `/admin/settings/system/diagnostics` |
| Tab | **Diagnostics** (first tab under System Settings) |
| Component | `artifacts/auction-platform/src/components/admin/diagnostics-panel.tsx` |
| Features | Refresh, Copy JSON, env badge, build/DB/startup cards, settling banner, instance footer |

### Boot metrics (read path only)

| Change | Detail |
|--------|--------|
| `getBootMetricsSnapshot()` | Now includes `ready` + `totalDatabaseBootTimeMs` |
| Exports | Re-exported from `@workspace/db` and `@workspace/db/boot-metrics` |
| Healers | **Unchanged** — no SQL recomputation, no re-run of startup DDL |

### Helpers (pure)

- `lib/diagnostics/mask-database-url.ts`
- `lib/diagnostics/classify-environment.ts`
- `lib/diagnostics/resolve-build-info.ts`
- `lib/diagnostics/build-startup-payload.ts`

---

## Fields exposed

| UI / API field | Source |
|----------------|--------|
| Environment | `classifyEnvironment` (`BIDWAR_ENV` override → APP_DOMAIN/APP_URL/NODE_ENV) |
| Build SHA | `BIDWAR_GIT_SHA` / `RENDER_GIT_COMMIT*` / optional `build-info.json` |
| Build timestamp | `BIDWAR_BUILD_TIMESTAMP` / Render timestamp env / file |
| Masked DB host | Parsed from runtime `DATABASE_URL`, credentials stripped |
| Database name | URL pathname |
| System C / D times | Existing boot-metrics snapshot |
| Total boot time | Snapshot `totalDatabaseBootTimeMs` |
| Startup DDL batches | C `queryBatches` + D `queryCount` |
| Startup failures | C `failures` + (D failure ? 1 : 0) |
| `ready=false` | When C or D metrics not yet available |

---

## Tests

```
pnpm --filter @workspace/api-server exec vitest run \
  src/__tests__/diagnostics-helpers.test.ts \
  src/__tests__/diagnostics-route.test.ts
```

**Result:** 2 files, **13 passed**.

Coverage includes masking (no password leak), env classification (local/staging/production/override), payload ready/not-ready, and route auth (non-master 403, master 200).

---

## Compatibility

| Environment | How it works |
|-------------|--------------|
| **Local** | Env → `local`; metrics after API start + `ensureCoreSchema`; open `/admin/settings/system/diagnostics` as master admin |
| **Staging** | `APP_DOMAIN`/`APP_URL` with `staging` → `staging`; same API/UI; commit SHA from Render injects when present |
| **Production** | Prod hosts → `production`; same code path; **no deploy script changes** required |

Build identity falls back to `unavailable` when no env/file is present — UI shows `unknown` (not an error).

**Auth note:** Existing `requireMasterAdmin` returns **403** for both missing JWT and non-master admins (design table mentioned 401 for unauthenticated). Auth middleware was intentionally **not** modified.

---

## Explicit non-changes

- No schema / SQL / healer edits  
- No auction or SSE logic  
- No Render API  
- No `build:deploy` / Render build command changes  
- No new npm dependencies  

---

## How to verify locally

1. Start API as usual (so System C/D metrics settle).  
2. Log in as **master** admin.  
3. Open `/admin/settings/system/diagnostics`.  
4. Confirm timings and `ready: true` after a few seconds if needed.  
5. Confirm JSON copy has no `DATABASE_URL` / passwords.

---

## Follow-ups (optional, not in this commit)

- Bake `dist/build-info.json` in `build:deploy` (design option 2) when deploy changes are allowed.  
- Set `BIDWAR_GIT_SHA` / `BIDWAR_BUILD_TIMESTAMP` on Render for clearer SHA display.  
- Optional audit event on diagnostics view.
