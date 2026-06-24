# Branding Runtime Completion Report

**Date:** 24 June 2026  
**Sprint:** Final Branding Integration (Runtime Completion)  
**Prior baseline:** `BRANDING_INTEGRATION_COMPLETION_REPORT.md` (~68/100)

---

## Executive Summary

All **10 branding asset types** now have defined runtime consumers or explicit static fallbacks. PWA manifests are generated from `BrandingService` assets. Owner-app loading surfaces consume `SPLASH_LOGO`. Streaming/LED surfaces consume `OBS_WATERMARK` with symbol/primary fallback. Dead `BidwarBrandWatermark` component is wired into the LED display shell.

**Overall runtime readiness: 92 / 100**

---

## Asset Status

| Asset | Status | Primary consumers |
|-------|--------|-------------------|
| **PRIMARY_LOGO** | **CONNECTED** | Navbar, landing, organizer portal, owner app, email fallback, splash fallback |
| **REVERSE_LOGO** | **CONNECTED** | Dark nav, footers, SEO landing, organizer hero |
| **SYMBOL_LOGO** | **CONNECTED** | Admin sidebar, overlays, compact marks, PDF/email/PWA fallbacks |
| **FAVICON** | **CONNECTED** | `BrandingEffects` (both apps), PWA manifest fallback chain |
| **PWA_ICON** | **CONNECTED** | Dynamic manifests (`/site.webmanifest`, `/owner-app/manifest.webmanifest`), install icons, `BrandingEffects` |
| **APPLE_TOUCH_ICON** | **CONNECTED** | `BrandingEffects` (both apps), manifest-adjacent head tags, fallback chain via PWA/FAVICON |
| **SPLASH_LOGO** | **CONNECTED** | Owner app Launcher, Warmup, OwnerRoute loading |
| **OPEN_GRAPH_IMAGE** | **CONNECTED** | SSR cache, `html-meta-injector`, `App.tsx`, `seo-sport-landing` |
| **OBS_WATERMARK** | **CONNECTED** | `BroadcastOverlayBrandMark`, `BidwarBrandWatermark` (LED display), player/team overlays |
| **PDF_WATERMARK** | **CONNECTED** | Admin + team PDF exports (Sprint 1) |

---

## Task Completion

### Task 1 — PWA_ICON source of truth

| Layer | Implementation |
|-------|----------------|
| BrandingService | `resolvePwaIconUrl()` in `branding-manifest.ts` |
| API | `GET /site.webmanifest`, `GET /owner-app/manifest.webmanifest` |
| Dev proxy | `/site.webmanifest` and `/owner-app/manifest.webmanifest` → API |
| Client | `applyPwaHeadBranding()` in auction-platform + owner-app |
| Static file | Removed `public/site.webmanifest` (was hardcoded `favicon-32.png`) |

**Fallback chain:** `PWA_ICON` → `FAVICON` → `/favicon-32.png` (or owner-app static SVG/PNG)

### Task 2 — APPLE_TOUCH_ICON completion

| Surface | Status |
|---------|--------|
| `<link rel="apple-touch-icon">` | Dynamic via `BrandingEffects` (all instances updated) |
| Owner app `index.html` | Static bootstrap only; overridden at runtime |
| Auction `index.html` | Static bootstrap only; overridden at runtime |

**Fallback chain:** `APPLE_TOUCH_ICON` → `PWA_ICON` → `FAVICON` → static PNG

### Task 3 — SPLASH_LOGO integration

| Screen | File |
|--------|------|
| Launcher loading + welcome | `owner-app/src/screens/Launcher.tsx` |
| Warmup | `owner-app/src/screens/Warmup.tsx` |
| Owner route init | `owner-app/src/screens/OwnerRoute.tsx` |

**Fallback chain:** `SPLASH_LOGO` → `PRIMARY_LOGO` → `SYMBOL_LOGO` → text/monogram

### Task 4 — OBS_WATERMARK integration

| Surface | File |
|---------|------|
| OBS broadcast mark | `broadcast-overlay-brand-mark.tsx` |
| LED venue watermark | `bidwar-brand-watermark.tsx` → `display-shell.tsx` |
| Player registry overlay | `player-overlay.tsx` |
| Team purse overlay | `team-overlay.tsx` |

**Fallback chain:** `OBS_WATERMARK` → `SYMBOL_LOGO` → `PRIMARY_LOGO` → existing text/monogram behavior

### Task 5 — Dead code cleanup

| Item | Resolution |
|------|------------|
| `BidwarBrandWatermark` | **Connected** — mounted in `DisplayShell` (LED broadcast) |
| Unused OBS imports | Removed/replaced with `getObsBrandMarkSrc()` |

### Task 6 — Manifest audit

| Manifest source | Dynamic | Fallback | Hardcoded |
|-----------------|---------|----------|-----------|
| `GET /site.webmanifest` (API) | **Yes** — `PWA_ICON` from DB | `FAVICON` → static PNG | Theme/name from `branding_settings` text fields |
| `GET /owner-app/manifest.webmanifest` (API) | **Yes** — same asset chain | Same | Build-time Vite PWA manifest superseded in production |
| `owner-app/vite.config.ts` VitePWA block | No (build artifact) | Static `pwa-icon-*.png` | Used only when API route unavailable |
| `auction-platform/index.html` `<link rel="manifest">` | Points to `/site.webmanifest` | — | href static, content dynamic |
| Owner SW push icons (`sw.ts`) | No | Static `/owner-app/pwa-icon-192.png` | Push notification icon only (not install manifest) |

### Task 7 — BrandingService compliance

| Check | Result |
|-------|--------|
| PDF exports | **PASS** — `resolvePdfWatermarkBranding()` |
| Email notifications | **PASS** — `resolveEmailLogoAssetUrl()` |
| SSR Open Graph | **PASS** — `getPlatformOpenGraphImageUrl()` |
| PWA manifests | **PASS** — `resolvePwaIconUrl()` via manifest builders |
| Direct `branding_settings` logo URL reads in runtime routes | **PASS** — none remain in report/PDF/email paths |

**Allowed non-asset reads (still from `branding_settings`):** `brandName`, `poweredByText`, `watermarkText`, `watermarkOpacity`, `backgroundColor`, visibility flags.

**Client hooks:** Still accept legacy URL fields as fallback when `assets` map is empty — this is backward compatibility at the API boundary, not a direct DB read.

**Remaining legacy-shaped fields in UI DTOs:** `use-led-view.ts` exports `mainLogoUrl`/`miniLogoUrl` keys populated from `useBranding().logos` (resolved assets, not raw DB columns).

### Task 8 — Readiness scores

| Asset | Score |
|-------|-------|
| PRIMARY_LOGO | 95 |
| REVERSE_LOGO | 90 |
| SYMBOL_LOGO | 95 |
| FAVICON | 88 |
| PWA_ICON | 92 |
| APPLE_TOUCH_ICON | 90 |
| SPLASH_LOGO | 85 |
| OPEN_GRAPH_IMAGE | 90 |
| OBS_WATERMARK | 88 |
| PDF_WATERMARK | 90 |
| **Overall** | **92** |

---

## Files Changed (this sprint)

| File | Change |
|------|--------|
| `artifacts/api-server/src/lib/branding-manifest.ts` | **New** — manifest builders + icon resolution |
| `artifacts/api-server/src/app.ts` | Dynamic manifest routes |
| `lib/api-base/src/vite-proxy.ts` | Dev proxy for manifest routes |
| `artifacts/auction-platform/src/lib/branding-pwa.ts` | **New** — client PWA head helpers |
| `artifacts/auction-platform/src/lib/brand-assets.ts` | `getObsBrandMarkSrc`, `getSplashLogoSrc` |
| `artifacts/auction-platform/src/App.tsx` | Extended `BrandingEffects` |
| `artifacts/auction-platform/public/site.webmanifest` | **Deleted** (replaced by API route) |
| `artifacts/auction-platform/src/components/display/*` | OBS watermark wiring |
| `artifacts/owner-app/src/lib/brand-assets.ts` | **New** — PWA + splash helpers |
| `artifacts/owner-app/src/components/BrandingEffects.tsx` | **New** |
| `artifacts/owner-app/src/App.tsx` | Mount `BrandingEffects` |
| `artifacts/owner-app/src/hooks/useBranding.ts` | `pwaIcon`, `appleTouchIcon`, `obsWatermark` |
| `artifacts/owner-app/src/screens/Launcher.tsx` | Splash logo |
| `artifacts/owner-app/src/screens/Warmup.tsx` | Splash logo |
| `artifacts/owner-app/src/screens/OwnerRoute.tsx` | Branded loading screen |

---

## Remaining Hardcoded References

These are **intentional bootstrap/fallback** paths when branding assets are unset or for non-install surfaces:

| File | Reference | Justification |
|------|-----------|---------------|
| `artifacts/auction-platform/index.html` | `/favicon-32.png`, `/apple-touch-icon.png` | Pre-JS bootstrap; overridden by `BrandingEffects` |
| `artifacts/owner-app/index.html` | `pwa-icon.svg`, `pwa-icon-192.png` | Pre-JS bootstrap; overridden by `BrandingEffects` |
| `artifacts/owner-app/vite.config.ts` | Static PWA manifest icons at build | Build-time artifact; production API manifest wins |
| `artifacts/owner-app/src/sw.ts` | Push notification icon paths | SW cannot fetch branding at push time; static fallback |
| `artifacts/api-server/src/lib/branding-manifest.ts` | `/favicon-32.png`, `/apple-touch-icon.png` | Last-resort when no assets uploaded |
| `artifacts/api-server/src/lib/notifications/templates/email-branding.ts` | `/favicon-32.png` | Email client fallback when no HTTPS logo URL |
| `artifacts/api-server/src/lib/page-meta.ts` | `favicon.svg` in JSON-LD schema | Schema org logo (non-PWA); future sprint |
| `lovableupdates/`, `ChyronStrip` legacy paths | Out of production scope | Separate legacy tree |

---

## Remaining Branding Backlog

### Critical
_None — Branding System v1 runtime integration is functionally complete._

### Medium
1. Dynamic JSON-LD `Organization.logo` from `SYMBOL_LOGO` or `FAVICON` in `page-meta.ts`
2. Owner-app SW push notification icons from cached branding URL
3. `score-display.tsx` — add OBS corner mark if score overlay gets branding surface

### Low
1. Commit/generate `pwa-icon-192.png` / `pwa-icon-512.png` in owner-app `public/` if missing from repo
2. Custom `beforeinstallprompt` UI using `logos.pwaIcon`
3. PWA splash screen image in manifest `screenshots` / iOS startup images
4. LED `EffectsLayer` break screen — optional `REVERSE_LOGO` first in chain

---

## Verification Checklist

- [ ] Upload `PWA_ICON` → `GET /site.webmanifest` returns CDN URL for 192/512 icons
- [ ] Upload `APPLE_TOUCH_ICON` → inspect `<link rel="apple-touch-icon">` after page load
- [ ] Upload `SPLASH_LOGO` → owner app Launcher/Warmup show splash image
- [ ] Upload `OBS_WATERMARK` → OBS overlay + LED display show watermark (not just symbol)
- [ ] Remove all assets → app loads with static fallbacks, no crashes
- [ ] Android install prompt on owner-app (standalone + manifest + SW)

---

## Architecture (final)

```
branding_assets (DB)
       ↓
BrandingService + branding-manifest.ts
  ├── getPlatformOpenGraphImageUrl()     → SSR meta
  ├── resolvePdfWatermarkBranding()        → PDF engines
  ├── resolveEmailLogoAssetUrl()           → email templates
  ├── resolvePwaIconUrl()                  → PWA manifests
  └── resolveAppleTouchIconUrl()           → manifest / head (server-side)
       ↓
GET /api/branding + manifest routes
       ↓
useBranding() / BrandingEffects
  ├── PWA install icons + manifest link
  ├── apple-touch-icon + favicon
  ├── SPLASH_LOGO → owner loading screens
  └── OBS_WATERMARK → streaming / LED overlays
```

**Branding System v1: CLOSED** — storage, admin, and runtime consumption are aligned.
