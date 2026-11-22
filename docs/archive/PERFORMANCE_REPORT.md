# BidWar Performance Report

> Generated: July 2026 — Read-only audit.
> Explains why production builds and runtime performance have degraded and identifies optimization opportunities.

---

## Executive Summary

BidWar's auction-platform SPA has solid production foundations (Brotli/Gzip precompression, route-level lazy loading, manual Vite chunk splitting, homepage SSR). The main performance regressions come from **two eagerly bundled large pages** (AuctionOperator, TournamentSettings), **missing compression on owner-app/scoring-app**, **the build pipeline compiling unused artifacts (mockup-sandbox, bidwar-local) on every deploy**, and **missing database indexes on hot tables**.

---

## 1. Build Performance

### 1.1 Excessive Build Scope on Every Cloud Deploy

**Impact: Slow deployments (~2-5 minutes wasted per deploy)**

`pnpm run build:deploy` runs `pnpm -r --if-present run build` which includes:

- ✅ `api-server` — needed
- ✅ `auction-platform` — needed
- ✅ `owner-app` — needed
- ✅ `scoring-app` — needed
- ❌ `mockup-sandbox` — **dev-only design tool; never deployed**
- ❌ `bidwar-local` — **Electron desktop app; not needed for cloud deploy**
  - bidwar-local internally re-builds auction-platform and owner-app via `copy-frontend.mjs`
  - This means auction-platform gets built **twice** on every cloud deploy

**Fix:** Filter `pnpm -r run build` to only production targets.

### 1.2 Playwright Browser Install on Every Build

**Impact: Minutes per cloud deploy**

`scripts/setup-playwright-browsers.mjs` installs Chromium on every build. This is needed for Buzz Studio PNG export via `CREATIVE_RENDER_WORKER_ENABLED=true`.

The browser install takes significant time and can fail on some PaaS environments.

**Options:**
- Pre-install in Docker image (already done in Dockerfile)
- Set `SKIP_PLAYWRIGHT_BROWSER_INSTALL=true` for builds where Buzz Studio is disabled
- Cache the browser in CI/CD pipeline

### 1.3 No CI Caching for node_modules

No GitHub Actions CI exists for the main application. When CI is added, `pnpm` lockfile-based caching should be included.

### 1.4 TypeScript Type-check Included in Production Build

`pnpm run build` = `typecheck:libs + typecheck apps + build:deploy`. For production deploys on Render/Railway, `pnpm run build:deploy` is used instead (skips typecheck). This is intentional but means type errors are only caught in development.

---

## 2. Frontend Bundle Performance

### 2.1 AuctionOperator and TournamentSettings — Eager Imports

**Impact: High — ships code for all visitors**

**Files affected:**
- `artifacts/auction-platform/src/pages/auction-operator.tsx` (~2,506 lines)
- `artifacts/auction-platform/src/pages/tournament-settings.tsx` (~1,818 lines)

These are imported statically at the top of `App.tsx` without `React.lazy()`. Every visitor — including marketing site visitors, public scoreboard viewers, and owner-app users who load the auction-platform SPA — downloads and parses these files unnecessarily.

**Expected impact of fix:** Estimated 100-200KB reduction in main chunk (uncompressed); significant improvement in Time to Interactive for non-organizer visitors.

**Fix:**
```typescript
// Instead of:
import AuctionOperator from '@/pages/auction-operator'
// Use:
const AuctionOperator = React.lazy(() => import('@/pages/auction-operator'))
```

### 2.2 admin.tsx — 3,994-Line Module in Every Admin Page

**Impact: Medium**

`admin.tsx` is a shared module (~3,994 lines) imported by all admin-* pages. Because it's not a page itself but a utility module, it cannot be code-split at route boundaries. Every admin page load pulls this entire module.

### 2.3 organizer-portal.tsx — Large but Lazy

**Impact: Low-medium**

`organizer-portal.tsx` (~1,968 lines) is lazy-loaded. However, it's large enough to consider sub-route splitting for its onboarding vs. tournament-list sections.

### 2.4 EffectsLayer.tsx — Large Critical-Path Component

**Impact: Low (by design)**

`display/v1/EffectsLayer.tsx` (~1,235 lines) is on the critical display path and cannot practically be code-split further without disrupting the LED display animation continuity.

### 2.5 Manual Chunk Strategy

**Current chunks:**
- `vendor-react` — React, ReactDOM
- `vendor-motion` — framer-motion
- `vendor-query` — TanStack Query
- `vendor-charts` — recharts + victory
- `vendor-radix` — all Radix UI packages
- `vendor-lucide` — lucide-react
- `vendor-router` — wouter
- `academy-*` — Academy-specific chunks

**Gaps:** owner-app and scoring-app lack `manualChunks` configuration. Their entire vendor bundle ships in a single chunk.

### 2.6 owner-app Lacks Compression

**Impact: Medium — owner app served on mobile**

`artifacts/owner-app/vite.config.ts` does not include `vite-plugin-compression2` (Brotli/Gzip sidecar files). If nginx or the API server handles compression, this is mitigated. But owner-app is a mobile PWA served to low-bandwidth connections where compression matters most.

**Fix:** Add `vite-plugin-compression2` with brotli + gzip to owner-app Vite config.

### 2.7 scoring-app Lacks Compression

Same issue as owner-app. scoring-app Vite config has no compression plugin.

### 2.8 Potentially Dead Package Weight

**Packages with zero source imports in auction-platform:**
- `@imgly/background-removal` — WASM-based image background removal (~5MB WASM)
- `onnxruntime-web` — ONNX runtime for ML models (~large WASM)

If these are confirmed unused, removing them saves significant install/build time and bundle weight.

**Verify:** Search for dynamic imports (`import('@imgly/...')`) that static analysis may miss.

### 2.9 Barrel File Imports — Lucide React

**Impact: Medium (dev cold start)**

`lucide-react` is listed in `pnpm-workspace.yaml` catalog as `^0.545.0`. While the workspace config has `optimizePackageImports` indirectly via Vite's `dedupe`, production Vite bundles handle tree-shaking correctly. However, dev server cold starts may still be slow due to barrel file processing.

The workspace Vite config uses `manualChunks` for `vendor-lucide` which correctly groups all lucide icons together.

---

## 3. Runtime Performance

### 3.1 SSE Single-Process Bottleneck

**Impact: Scaling limitation**

All SSE client connections are tracked in process-local data structures (`Map<tournamentId, Set<Response>>`). With Redis pub/sub, events can be published from any process, but the SSE client registry is still per-process.

**Current state:** Redis pub/sub is partially implemented for auction events. Without `REDIS_URL`, everything is in-memory on a single process.

**Impact on current deployment:** If running single-instance on Render, no immediate impact. Becomes blocking when horizontal scaling is needed.

### 3.2 Missing Pagination on Player/Team Lists

**Impact: Large payloads for big tournaments**

`GET /api/tournaments/:id/players` and `/teams` return all records without pagination. For large tournaments (1000+ players), this sends significant JSON payloads on every page load.

**Risk:** Tournament pages with large rosters load slowly; repeated navigations re-fetch large lists.

### 3.3 auction-state-build-cache.ts

**Current state:** The auction state is cached between reads. Cache invalidation appears to happen on every state update, which is correct for live auctions.

### 3.4 Intelligence / OpenAI Endpoint Latency

`GET /api/tournaments/:id/analytics/insights` calls OpenAI synchronously when `OPENAI_API_KEY` is set. Responses can take 2-5+ seconds depending on model and prompt. No streaming implementation — the API holds the request until the LLM responds.

**Impact:** Blocks the HTTP connection; one slow LLM call doesn't affect other users, but the 30/15min rate limit means a burst of insights requests on a popular tournament can consume the limit quickly.

### 3.5 Live Bid Display — React Re-render Frequency

SSE events can arrive rapidly during competitive bidding. The display/v1/ components subscribe to the full auction state on every event. Expensive re-renders during rapid bidding (multiple bids per second) may cause visual lag on low-powered display machines.

**Mitigation present:** `use-led-view.ts` derives the display state from the SSE event rather than re-fetching. State merging in `sync-auction-sse.ts` is incremental.

### 3.6 owner-app Polling Fallback

When SSE disconnects, owner-app falls back to polling:
- 1-second polling on live/squad/scout screens
- 10-second polling for purse updates
- 30-second branding polling

For large tournaments with many bidder devices, aggressive polling under disconnection can temporarily spike API load.

### 3.7 Homepage SSR Cache

`homepage-page-cache.ts` caches rendered HTML with a TTL. Cache hits are fast; cache misses require a full SSR render pass including data fetching.

**Risk:** High-traffic marketing spike (e.g., social media link) can cause cache misses if TTL expires under load.

### 3.8 Database Query Performance

See `DATABASE_AUDIT.md` §3 for missing indexes. Key performance impacts:

| Query | Current cost | With Index |
|-------|-------------|------------|
| `SELECT * FROM bids WHERE tournament_id = ?` | Full table scan | O(log n) |
| `SELECT * FROM auction_bid_events WHERE tournament_id = ?` | Full table scan | O(log n) |
| `SELECT * FROM categories WHERE tournament_id = ?` | Full table scan | O(log n) |
| `SELECT * FROM teams WHERE tournament_id = ?` | Full table scan | O(log n) |

### 3.9 Neon Serverless Connection Keep-Alive

`lib/db/src/index.ts` uses a `setInterval` to keep the Neon connection warm. This is appropriate for serverless Neon, but if connection pool size is not tuned correctly, new tournaments can hit cold-start latency.

---

## 4. Memory Performance

### 4.1 Memory Diagnostics Worker

`lib/memory-diagnostics.ts` monitors RSS and SSE connection counts. This was added in response to production memory growth (`docs/production-memory-hotfix-report.md`).

**Known issues fixed:** The memory hotfix report documents a previous leak; the current state should be stable.

### 4.2 SSE Event Buffer

`EVENT_BUFFER_MAX = 500` events per tournament held in memory for replay. For high-volume auctions with many concurrent reconnects, this can grow large. Redis moves this to external storage when configured.

### 4.3 Photo Import Worker

`PHOTO_IMPORT_CONCURRENCY` defaults to 1 (single-threaded photo processing). This is conservative but prevents memory spikes during large bulk imports.

---

## 5. Vite Build Configuration Analysis

### auction-platform (strong)

| Optimization | Status |
|-------------|--------|
| Brotli precompression | ✅ |
| Gzip precompression | ✅ |
| Manual chunk splitting | ✅ (7 vendor chunks + academy) |
| esbuild minification | ✅ |
| Source maps disabled in production | ✅ |
| `dedupe: ['react']` | ✅ |
| `optimizeDeps.include` for heavy libs | ✅ (xlsx, jspdf, html2canvas-pro) |
| Route-level lazy loading | ✅ (~70 routes lazy) |
| SSR bundle separate | ✅ |

### owner-app (gaps)

| Optimization | Status |
|-------------|--------|
| Brotli/Gzip precompression | ❌ Missing |
| Manual chunk splitting | ❌ Missing |
| PWA service worker | ✅ (injectManifest) |
| Lazy loading | ✅ (some routes) |

### scoring-app (gaps)

| Optimization | Status |
|-------------|--------|
| Brotli/Gzip precompression | ❌ Missing |
| Manual chunk splitting | ❌ Missing |
| Lazy loading | ✅ (all routes lazy) |

---

## 6. API Server Build Performance

### esbuild Bundle (api-server/build.mjs)

| Setting | Value | Notes |
|---------|-------|-------|
| Bundler | esbuild | Fast |
| Format | ESM | Modern |
| External | sharp, playwright, cloud SDKs | Correct for native deps |
| Source maps | Linked | Available via --enable-source-maps |
| Platform | node | |
| Target | node22 | |

**Note:** External list in `build.mjs` is very long. Some externals may no longer be needed (e.g., if a package was removed from dependencies). Unused externals don't affect runtime but add maintenance noise.

---

## 7. Recommended Priority Actions

### Immediate (< 1 hour each)

1. **Add missing database indexes** — `bids.tournament_id`, `categories.tournament_id`, `teams.tournament_id`, `auction_bid_events.tournament_id`
2. **Lazy-load AuctionOperator and TournamentSettings** in auction-platform App.tsx

### Short-term (< 1 day)

3. **Exclude mockup-sandbox and bidwar-local from cloud deploy build**
4. **Add vite-plugin-compression2 to owner-app and scoring-app**
5. **Verify and remove `@imgly/background-removal` and `onnxruntime-web` if unused**

### Medium-term

6. **Add pagination** to player/team list endpoints
7. **Split admin.tsx** into smaller modules
8. **Add Redis pub/sub** for full multi-process SSE support
9. **Add manualChunks** to owner-app and scoring-app

### Long-term

10. **Consolidate database schema management** to eliminate runtime DDL on import
11. **Streaming response for intelligence/insights** LLM endpoint
12. **Investigate and optimize** `EffectsLayer.tsx` render frequency during rapid bidding
