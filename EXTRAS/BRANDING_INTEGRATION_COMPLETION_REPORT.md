# Branding Integration Completion Report — Sprint 1

**Date:** 24 June 2026  
**Scope:** Critical runtime wiring only — no admin UI, schema, or new asset types  
**Baseline:** `BRANDING_USAGE_AUDIT_REPORT.md` (score 52/100)

---

## Sprint 1 Goals

| # | Goal | Status |
|---|------|--------|
| 1 | `OPEN_GRAPH_IMAGE` becomes SSR source of truth; remove `opengraph.jpg` hardcoded defaults | **COMPLETE** |
| 2 | `PDF_WATERMARK` becomes actual PDF watermark (fallback: PDF → SYMBOL → text) | **COMPLETE** |
| 3 | Email branding migrates from `branding_settings` logo columns to `BrandingService` asset resolution | **COMPLETE** |
| 4 | Completion report with before/after integration status | **COMPLETE** |

---

## Integration Status — Before vs After

### OPEN_GRAPH_IMAGE

| Consumer | Before | After |
|----------|--------|-------|
| SSR `page-meta.ts` | Hardcoded `DEFAULT_OG_IMAGE = …/opengraph.jpg` on all marketing pages | Resolves via `getPlatformOpenGraphImageUrl()` cache; omitted when asset unset |
| SSR `html-meta-injector.ts` | Fallback to `https://bidwar.in/opengraph.jpg` | Emits `og:image` / `twitter:image` only when asset URL present |
| Server startup | No branding cache | `refreshPlatformBrandingCache()` after legacy migration |
| Asset admin upsert/remove | No cache refresh | Cache refreshed on every asset upsert/remove |
| `index.html` static shell | Hardcoded `opengraph.jpg` OG tags | OG image tags removed; SSR injector adds them when configured |
| `seo-sport-landing.tsx` | Hardcoded `opengraph.jpg` | Uses `useBranding().logos.openGraph` |
| `App.tsx` (client hydration) | Already used `logos.openGraph` | Unchanged — complements SSR |

**Status:** **CONNECTED** (SSR + client)

---

### PDF_WATERMARK

| Consumer | Before | After |
|----------|--------|-------|
| `admin-reports.ts` PDF export | Text-only watermark from `branding_settings.watermarkText` | `resolvePdfWatermarkBranding()` → image watermark via `drawPdfPageWatermark()` |
| `team-reports.ts` PDF export | Footer logo from `miniLogoUrl` column; no page watermark | Page watermark + footer logo via `BrandingService` asset chain |
| Fallback chain | N/A | `PDF_WATERMARK` → `SYMBOL_LOGO` → text watermark |
| Text/opacity settings | From `branding_settings` | Still from `branding_settings` (non-asset fields, unchanged) |

**Status:** **CONNECTED** (server PDF engines)

---

### Email Logo (SYMBOL_LOGO / PRIMARY_LOGO)

| Consumer | Before | After |
|----------|--------|-------|
| `notification-service.ts` `enrichPlayerRegisteredPayload` | `miniLogoUrl` from `branding_settings` | `brandingService.resolveEmailLogoAssetUrl()` |
| Asset resolution chain | Legacy column only | `SYMBOL_LOGO` → `PRIMARY_LOGO` from `branding_assets` |
| `email-branding.ts` `resolveEmailLogoUrl` | HTTPS URL or `/favicon-32.png` fallback | Unchanged — receives resolved asset URL from service layer |
| Brand name / powered-by text | From `branding_settings` | Unchanged (text fields, not assets) |

**Status:** **CONNECTED** (email notification path)

---

## Files Changed

| File | Change |
|------|--------|
| `artifacts/api-server/src/lib/branding-service.ts` | Added OG cache, `resolveEmailLogoAssetUrl`, `resolvePdfWatermarkBranding` |
| `artifacts/api-server/src/lib/pdf-branding.ts` | **New** — shared `fetchImageBuffer`, `drawPdfPageWatermark` |
| `artifacts/api-server/src/lib/page-meta.ts` | Removed `DEFAULT_OG_IMAGE`; `withPlatformOgImage()` wrapper |
| `artifacts/api-server/src/lib/html-meta-injector.ts` | Conditional OG/Twitter image tags |
| `artifacts/api-server/src/index.ts` | Refresh branding cache at startup |
| `artifacts/api-server/src/routes/branding.ts` | Refresh cache on asset upsert/remove |
| `artifacts/api-server/src/routes/admin-reports.ts` | PDF watermark via BrandingService |
| `artifacts/api-server/src/routes/team-reports.ts` | PDF watermark + footer logo via BrandingService |
| `artifacts/api-server/src/lib/notifications/notification-service.ts` | Email logo via `resolveEmailLogoAssetUrl` |
| `artifacts/auction-platform/index.html` | Removed hardcoded OG image tags |
| `artifacts/auction-platform/src/pages/seo-sport-landing.tsx` | Dynamic OG from `useBranding` |

---

## Asset Coverage Scorecard (Sprint 1 scope)

| Asset | Pre-Sprint | Post-Sprint | Notes |
|-------|------------|-------------|-------|
| OPEN_GRAPH_IMAGE | PARTIAL (client only) | **CONNECTED** | SSR cache + client |
| PDF_WATERMARK | NOT CONNECTED | **CONNECTED** | Admin + team PDF exports |
| SYMBOL_LOGO (email/PDF fallback) | PARTIAL | **CONNECTED** | Used in PDF watermark fallback + email logo |
| PRIMARY_LOGO (email fallback) | PARTIAL | **CONNECTED** | Email logo secondary fallback |

**Estimated platform readiness:** 52/100 → **~68/100** (Sprint 1 critical paths only)

---

## Explicitly Out of Scope (unchanged)

- Admin UI / branding schema
- PWA manifest (`PWA_ICON` still static in `site.webmanifest`)
- OBS watermark (`OBS_WATERMARK` still unused in broadcast overlay)
- Splash logo (`SPLASH_LOGO` still has zero UI consumers)
- LED display legacy `branding_settings` field reads
- Per-tournament share OG images
- Static `public/opengraph.jpg` file (retained on disk but no longer referenced as default)

---

## Runtime Architecture (post-Sprint 1)

```
branding_assets (DB)
       ↓
BrandingService
  ├── getPlatformOpenGraphImageUrl()  → SSR page-meta + html-meta-injector
  ├── resolvePdfWatermarkBranding()   → admin-reports + team-reports PDF
  └── resolveEmailLogoAssetUrl()      → notification-service email templates
       ↓
GET /api/branding (unchanged public API)
       ↓
useBranding() → client OG, favicon, logos (unchanged)
```

---

## Verification Checklist

- [ ] Upload `OPEN_GRAPH_IMAGE` in admin → view page source on `/` → `og:image` matches CDN URL
- [ ] Remove `OPEN_GRAPH_IMAGE` → marketing pages omit `og:image` in SSR HTML (no `opengraph.jpg` fallback)
- [ ] Upload `PDF_WATERMARK` → export admin report PDF → centered image watermark visible
- [ ] Remove `PDF_WATERMARK`, keep `SYMBOL_LOGO` → PDF uses symbol as watermark image
- [ ] Remove both → PDF uses text watermark from settings
- [ ] Trigger player registration email → logo uses `SYMBOL_LOGO` or `PRIMARY_LOGO` asset URL

---

## Next Recommended Sprint (not implemented)

1. Wire `OBS_WATERMARK` into broadcast overlay / `BidwarBrandWatermark`
2. Wire `SPLASH_LOGO` into owner app launcher / PWA splash
3. Wire `PWA_ICON` into `site.webmanifest` generation
4. Replace LED `EffectsLayer` legacy logo field reads with typed assets
