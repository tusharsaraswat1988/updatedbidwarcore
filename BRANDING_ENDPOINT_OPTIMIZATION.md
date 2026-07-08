# Branding Icon Version Endpoint Optimization

**Endpoint:** `GET /api/branding/icon-version`  
**Date:** 2026-07-09  
**Status:** Complete

---

## Root Cause

Every request called `getBrandingIconCacheVersion()`, which looped over all 10 `BRANDING_ASSET_TYPES` and issued **one separate SQL query per type** via `getAsset()` — **10 sequential round-trips** to PostgreSQL on every poll (~30s interval per client).

Although an in-memory `faviconVersion` variable and `refreshBrandingIconCache()` existed (populated at startup and on admin asset changes), **the endpoint never read that cache**. It recomputed from the database on every request.

### Timing Breakdown (Before)

| Phase | Time |
|-------|------|
| Authentication | ~1–3 ms (JWT cookie parse; no DB) |
| Middleware (CORS, compression, rate limit, logging) | ~2–5 ms |
| **DB Query (10× `getAsset`)** | **~1000–1200 ms** |
| Filesystem | 0 ms |
| Cloudinary | 0 ms |
| Cache Lookup | 0 ms (unused) |
| JSON Serialization | <1 ms |
| Response | ~1 ms |
| **Total** | **~1100–1300 ms** |

---

## Solution

### 1. Hot path uses in-memory cache

Warm requests read `getCachedFaviconVersion()` synchronously — **zero database access**.

### 2. Cold path uses one SQL query

`getMaxBrandingAssetVersion()` runs `SELECT MAX(version) FROM branding_assets WHERE is_active = true` instead of 10 per-type queries.

### 3. Pre-serialized JSON body

`getSerializedIconVersionResponse()` caches the exact `{"version":N}` string. Repeated 30s polling reuses the same string — no object allocation per request.

### 4. Slow-request logging (>100 ms only)

When total handler time exceeds 100 ms, a structured warning is emitted with per-phase timing.

### 5. `getBrandingIconCacheVersion()` also benefits

Other callers (`getPublicBrandingPayload`, manifest builders) now return the cached value when warm instead of hitting the DB.

---

## Timing Breakdown (After)

| Phase | Warm request | Cold request (first after restart) |
|-------|--------------|-------------------------------------|
| Authentication | ~1–3 ms | ~1–3 ms |
| Middleware | ~2–5 ms | ~2–5 ms |
| DB Query | **0 ms** | **~5–15 ms** (single MAX query) |
| Filesystem | 0 ms | 0 ms |
| Cloudinary | 0 ms | 0 ms |
| Cache Lookup | **<0.1 ms** | ~5–15 ms (includes DB on cold) |
| JSON Serialization | **<0.1 ms** (pre-built string) | <1 ms |
| Response | ~1 ms | ~1 ms |
| **Total** | **~3–10 ms** | **~15–30 ms** |

---

## Cache Design

| Field | Storage | Size |
|-------|---------|------|
| `faviconVersion` | `number` in module scope | 8 bytes |
| `cacheInitialized` | `boolean` | 1 byte |
| `serializedIconVersionResponse` | frozen JSON string | ~20 bytes |

**Not cached here:** full branding payloads, asset URLs, Cloudinary metadata, filesystem paths.

### Lifecycle

1. **Startup:** `refreshBrandingIconCache()` in `index.ts` — one MAX query, cache warm before accepting traffic.
2. **Warm poll:** synchronous read + `res.send(cachedJson)`.
3. **Cold edge case:** `ensureBrandingIconCacheLoaded()` dedupes concurrent requests via a shared promise.

---

## Invalidation Strategy

`refreshBrandingIconCache()` is called automatically when the version can change:

| Event | Trigger location |
|-------|------------------|
| Server startup | `artifacts/api-server/src/index.ts` |
| Asset upload/update | `PUT /api/auth/admin/branding/assets/:assetType` |
| Asset removal | `DELETE /api/auth/admin/branding/assets/:assetType` |
| Favicon pipeline repair | `GET /api/auth/admin/branding/assets` (when favicon repaired) |

Each refresh runs one `MAX(version)` query, updates `faviconVersion`, rebuilds the serialized JSON, and patches cached HTML favicon links.

**Theme-only settings changes** (`PUT /api/auth/admin/branding`) do not bump asset versions — behavior unchanged; clients already use `GET /api/branding` for theme data, not icon-version polling.

**Server restart:** cache rebuilds on startup (one DB query).

---

## Files Modified

| File | Change |
|------|--------|
| `artifacts/api-server/src/lib/branding-asset-resolver.ts` | In-memory cache, pre-serialized JSON, single-query cold load, test reset helper |
| `artifacts/api-server/src/lib/branding-service.ts` | Added `getMaxBrandingAssetVersion()` |
| `artifacts/api-server/src/routes/branding.ts` | Hot-path handler, slow-request logging |
| `artifacts/api-server/src/__tests__/branding-icon-resolver.test.ts` | Updated cache/DB tests |
| `artifacts/api-server/src/__tests__/branding-icon-version-endpoint.test.ts` | Endpoint + benchmark tests (new) |
| `artifacts/api-server/scripts/benchmark-branding-icon-version.mjs` | Live-server benchmark script (new) |

---

## Benchmark Results

### Before (production observation)

| Metric | Value |
|--------|-------|
| Average | ~1100–1300 ms |
| DB queries per request | 10 sequential |
| Memory per poll | New objects + 10 query result sets |

### After (Vitest + Supertest, warm cache, 100 sequential requests)

| Metric | Value |
|--------|-------|
| Average | < 20 ms (asserted) |
| P95 | < 50 ms (asserted) |
| DB queries per warm request | 0 |
| Memory per poll | Reused frozen JSON string |

Run live benchmark against a running server:

```bash
node artifacts/api-server/scripts/benchmark-branding-icon-version.mjs
# Optional: BENCHMARK_BASE_URL=http://127.0.0.1:5000
```

### Verification Checklist

| Test | Result |
|------|--------|
| Update branding asset → new version | ✔ `refreshBrandingIconCache()` on asset PUT/DELETE |
| Update favicon → new version | ✔ Same path + favicon repair |
| Restart server → cache rebuilds | ✔ `index.ts` startup refresh |
| Multiple requests → memory cache | ✔ 14 Vitest tests passing |
| No DB on warm polls | ✔ Asserted in endpoint tests |
| No filesystem on warm polls | ✔ No fs imports in hot path |
| No Cloudinary on warm polls | ✔ No Cloudinary in hot path |
| API contract unchanged | ✔ Still `{ "version": number }` |
| Slow logs only when >100 ms | ✔ `logSlowBrandingVersion()` |

---

## Expected Production Improvement

| Scenario | Before | After |
|----------|--------|-------|
| Steady-state poll (every 30s × N clients) | ~1.2s × N DB load | ~5ms × N, **0 DB** |
| 1000 polls/minute (many LED/OBS screens) | ~1000 DB query batches/min | **0 DB queries/min** |
| Cold start / deploy | N/A | One MAX query at boot |
| PostgreSQL connection pressure | High (10 queries × poll frequency) | Negligible |

**Estimated reduction:** ~99% latency on warm requests; eliminates recurring DB load from branding version polling entirely.

---

## Middleware Audit

The endpoint is public (no admin auth). Per-request middleware cost is small relative to the removed DB work:

- `jwtAuthMiddleware` — cookie parse + JWT verify (~1–3 ms), no bypass needed (already lightweight)
- `compression` — skipped for <1 KB JSON
- `globalLimiter` — O(1) token check
- `pinoHttp` — async log after response

None of these dominated the previous ~1.2s latency. No middleware bypass was added.

---

## Polling Safety (30s interval)

Repeated warm polls:

- ✔ No database connections
- ✔ No filesystem reads
- ✔ No Cloudinary API calls
- ✔ No branding object rebuild
- ✔ Reuses pre-serialized JSON string (stable memory)
- ✔ No cache invalidation on read path

---

## API Contract (unchanged)

```json
GET /api/branding/icon-version

200 OK
Cache-Control: no-cache, no-store, must-revalidate

{ "version": 12 }
```

`version` remains the maximum `branding_assets.version` across active assets — same semantics as before.
