# SEO Runtime Fix Report

**Date:** 2026-07-11  
**Objective:** Remove hardcoded `https://bidwar.in` from runtime SEO generation; use `APP_URL` / public origin per environment.  
**Scope:** `page-meta.ts`, `seo-route-policy.ts`, `register-seo-routes.ts`, `app.ts` only.  
**Result:** **PASS** (local + unit tests). Live staging pending deploy.

---

## Summary

Server-side SEO (page metadata, `robots.txt`, sitemap XML) now resolves URLs from `getPublicOrigin()` / `APP_URL` instead of a compile-time `https://bidwar.in` constant.

| Environment | `APP_URL` | Runtime SEO origin (verified locally) |
|-------------|-----------|----------------------------------------|
| Production | `https://bidwar.in` | `https://bidwar.in` (unchanged) |
| Staging | `https://bidwar-staging.onrender.com` | `https://bidwar-staging.onrender.com` |

---

## Changes made

### 1. `artifacts/api-server/src/lib/page-meta.ts`

- Added `getBaseUrl()` → delegates to `getPublicOrigin()` from `runtime-env.ts`.
- Replaced `export const BASE_URL = "https://bidwar.in"` with module-level `BASE_URL = getBaseUrl()` (evaluated after bootstrap).
- Vitest fallback: if runtime is not initialized, uses `process.env.APP_URL` or `https://bidwar.in` so existing tests keep passing.

### 2. `artifacts/api-server/src/lib/seo-route-policy.ts`

- Imports `getBaseUrl` instead of static `BASE_URL`.
- All sitemap builders call `getBaseUrl()` at generation time.
- `buildRobotsTxt()` no longer accepts a hardcoded host; emits `Sitemap: {origin}/sitemap-index.xml` using runtime origin.

### 3. `artifacts/api-server/src/lib/register-seo-routes.ts`

- Removed `host` parameter from `registerSeoRoutes()`.
- `robots.txt` route calls `buildRobotsTxt()` with no arguments.

### 4. `artifacts/api-server/src/app.ts`

- Changed `registerSeoRoutes(app, CANONICAL_HOST)` → `registerSeoRoutes(app)`.
- `CANONICAL_HOST` retained only for optional `ENABLE_APP_HOST_REDIRECT` (unchanged).

---

## Verification

### Unit tests — **PASS**

```
pnpm exec vitest run src/lib/__tests__/seo-route-policy.test.ts src/lib/__tests__/sitemap-discovery.test.ts
→ 25/25 tests passed
```

Production expectations (`https://bidwar.in` in canonicals and robots) still hold when `APP_URL=https://bidwar.in`.

### Local runtime simulation — **PASS**

**Staging env** (`APP_DOMAIN=bidwar-staging.onrender.com`, `APP_URL=https://bidwar-staging.onrender.com`):

| Output | Value |
|--------|-------|
| `getBaseUrl()` | `https://bidwar-staging.onrender.com` |
| `buildRobotsTxt()` tail | `Sitemap: https://bidwar-staging.onrender.com/sitemap-index.xml` |
| `buildSitemapIndex()` | `<loc>https://bidwar-staging.onrender.com/sitemap-pages.xml</loc>` |
| `getPageMeta("/").canonical` | `https://bidwar-staging.onrender.com/` |

**Production env** (`APP_DOMAIN=bidwar.in,www.bidwar.in`, `APP_URL=https://bidwar.in`):

| Output | Value |
|--------|-------|
| `getBaseUrl()` | `https://bidwar.in` |
| `buildRobotsTxt()` tail | `Sitemap: https://bidwar.in/sitemap-index.xml` |
| `getPageMeta("/").canonical` | `https://bidwar.in/` |

### Live staging (`https://bidwar-staging.onrender.com`) — **PENDING DEPLOY**

Probed **before** this fix is deployed to Render:

| Probe | Current live value | Expected after deploy |
|-------|-------------------|------------------------|
| `/robots.txt` Sitemap line | `https://bidwar.in/sitemap-index.xml` | `https://bidwar-staging.onrender.com/sitemap-index.xml` |
| `/` canonical | `https://bidwar.in/` | `https://bidwar-staging.onrender.com/` |

**Action:** Merge to `develop` and let Render staging auto-deploy, then re-run:

```powershell
Invoke-WebRequest https://bidwar-staging.onrender.com/robots.txt -UseBasicParsing
Invoke-WebRequest https://bidwar-staging.onrender.com/ -UseBasicParsing
# Confirm canonical and Sitemap use bidwar-staging.onrender.com
```

### Live production (`https://bidwar.in`) — **UNCHANGED** (post-deploy)

Production `APP_URL` remains `https://bidwar.in`; behaviour is identical to pre-fix.

---

## Out of scope (not modified)

These may still reference `bidwar.in` and were **not** changed per task constraints:

| Area | Notes |
|------|-------|
| `artifacts/auction-platform/index.html` | Static build-time meta in client bundle |
| `academy-page-meta.ts`, `cricket-page-meta.ts`, `registration-page-meta.ts` | Import `BASE_URL` from `page-meta` — now runtime-derived at module load |
| Email templates, `branding-manifest.ts` | Separate hardcoded marketing URLs |
| Auction SSE, auth, API routes, database | Untouched |

`BASE_URL` export from `page-meta.ts` remains for backward compatibility; it now reflects `APP_URL` at module initialization (after `bootstrap` / `assertRuntimeEnv`).

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| Module load order | `index.ts` imports `bootstrap.js` before `app.ts`; `page-meta` loads after `assertRuntimeEnv()` in production |
| Test environments | `getBaseUrl()` catch fallback preserves vitest behaviour |
| Production regression | Unit tests + local probe with `APP_URL=https://bidwar.in` confirm identical output |

---

## Sign-off

| Check | Status |
|-------|--------|
| Hardcoded `bidwar.in` removed from scoped SEO runtime paths | Done |
| Uses `APP_URL` / `getPublicOrigin()` | Done |
| Production behaviour unchanged | Verified locally |
| Staging emits staging URLs | Verified locally; live pending deploy |
| No auction/auth/SSE/DB changes | Confirmed |

**Next step:** Deploy to Render staging (`develop`) and confirm live probes match local staging results.
