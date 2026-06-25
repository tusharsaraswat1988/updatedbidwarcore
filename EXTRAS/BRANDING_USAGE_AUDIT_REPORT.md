# BidWar Brand Asset Usage Audit Report

**Audit date:** 24 June 2026  
**Scope:** Production codebase (`artifacts/`, `lib/`, static assets)  
**Method:** Static code analysis — grep, import tracing, consumer mapping  
**Auditor:** Automated platform audit (no runtime/deployment verification)

---

## Executive Summary

The **branding storage layer is production-ready** (`branding_assets` table, admin UI, migration, `/api/branding` with merged asset map). However, **platform-wide consumption is partial**. Most UI surfaces consume logos indirectly via `useBranding()` → `logos.main` / `logos.mini` / `logos.mainReverse`, which correctly resolves `PRIMARY_LOGO`, `SYMBOL_LOGO`, and `REVERSE_LOGO` from the asset table when populated.

**Four of ten asset types are effectively stored but not consumed:**

| Asset | Integration status |
|-------|-------------------|
| `SPLASH_LOGO` | Exposed in hook, **zero UI consumers** |
| `OBS_WATERMARK` | **Not connected** (streaming uses `SYMBOL_LOGO`) |
| `PDF_WATERMARK` | **Not connected** (PDF engine uses legacy columns + text watermark) |
| `PWA_ICON` | **Not connected** to manifests (static files used) |

**Overall production readiness score: 52 / 100**

The system **stores assets professionally** but **does not yet fully consume them platform-wide**. Critical server-side PDF and email paths bypass `BrandingService` and read `branding_settings` directly.

---

## Architecture Reference

```
branding_assets (DB)
       ↓
BrandingService (api-server) ──→ GET /api/branding (merged legacy + assets map)
       ↓
useBranding() hook (auction-platform, owner-app)
       ↓
logos.main | logos.mainReverse | logos.mini | logos.favicon | …
       ↓
UI components (getBrandLogoSrc, cldUrl, direct img src)
```

**Intended client contract:** `useBranding()` is the browser-side equivalent of `BrandingService.getAsset()` — it resolves typed assets from the `assets` map with legacy column fallback.

**Naming collision:** `lib/api-base/src/sponsor-priority.ts` exports a **different** `brandingService` (sponsor priority helpers). Platform asset service lives at `artifacts/api-server/src/lib/branding-service.ts`.

---

## Asset Coverage

| Asset | Connected Areas | Missing Areas | Status |
|-------|-----------------|---------------|--------|
| **PRIMARY_LOGO** | Public navbar, landing hero/footer fallback, organizer portal, owner app (MobileEntry, Launcher), operator layout main mark, team reports (client print), schema markup, blog schema, admin preview | PDF server header (`team-reports.ts` uses `miniLogoUrl`), email templates (uses `miniLogoUrl` → favicon fallback), certificates (no cert feature found), tournament player-register (brand name only, no logo) | **PARTIAL** |
| **REVERSE_LOGO** | Landing footer, blog footer, SEO sport landing footer, organizer portal hero, badminton branding wordmark, owner MobileEntry, public navbar fallback chain | LED break screen (`EffectsLayer` uses `miniLogoUrl`/`mainLogoUrl` legacy fields, not reverse), admin header | **PARTIAL** |
| **SYMBOL_LOGO** | Admin sidebar (`admin-shell`), organizer layout, operator topbar, admin login, live viewer, LED overlays, OBS broadcast mark, team/player overlays, tournament code gate, powered-by link, ChyronStrip fallback, most compact branding | Collapsed sidebar uses same mini path (OK); some LED paths still read `view.branding.miniLogoUrl` legacy shape | **CONNECTED** |
| **FAVICON** | `App.tsx` `BrandingEffects` — dynamic update of `link[rel="icon"]` from `logos.favicon` | `index.html` hardcoded `/favicon.svg`, `/favicon-32.png`; `site.webmanifest` hardcoded `/favicon-32.png`; email fallback `/favicon-32.png`; JSON-LD logo hardcoded `bidwar.in/favicon.svg`; no 16/32/48 generation pipeline | **PARTIAL** |
| **PWA_ICON** | Resolved in `useBranding()` as `logos.pwaIcon` / `logos.appIcon` | `site.webmanifest` static `/favicon-32.png`; owner-app Vite PWA manifest static `pwa-icon-192.png` / `pwa-icon-512.png`; install prompt never reads branding API | **NOT CONNECTED** |
| **APPLE_TOUCH_ICON** | `App.tsx` updates `link[rel="apple-touch-icon"]` from `logos.appleTouchIcon` | `index.html` hardcoded `/apple-touch-icon.png`; owner-app `index.html` hardcoded `pwa-icon-192/512.png` | **PARTIAL** |
| **SPLASH_LOGO** | Mapped in `useBranding()` as `logos.splash` | No component reads `logos.splash`; owner Launcher welcome screen uses `logos.main`/`logos.mini`; PWA loading uses theme color only; logo animation URL separate from splash asset | **NOT CONNECTED** |
| **OPEN_GRAPH_IMAGE** | `App.tsx` sets `og:image` + `twitter:image` when asset uploaded (client-side only) | `index.html` hardcoded `opengraph.jpg`; `html-meta-injector.ts` fallback `opengraph.jpg`; `page-meta.ts` `DEFAULT_OG_IMAGE`; `seo-sport-landing.tsx` hardcoded OG; SSR/crawler path ignores `OPEN_GRAPH_IMAGE`; tournament share pages have no per-tournament OG | **PARTIAL** |
| **OBS_WATERMARK** | Admin UI only | `BidwarBrandWatermark` component exists but **is never imported**; OBS overlay uses `BroadcastOverlayBrandMark` with `SYMBOL_LOGO`; badminton overlays use tournament branding; no score overlay uses `OBS_WATERMARK` | **NOT CONNECTED** |
| **PDF_WATERMARK** | Admin UI only | `team-reports.ts` embeds `miniLogoUrl` from `branding_settings`; `admin-reports.ts` uses text `watermarkText` from settings (not image asset); client print view uses `logos.mini`/`logos.main`; no PDF engine reads `PDF_WATERMARK` | **NOT CONNECTED** |

---

## Detailed Audit by Area

### Area 1 — PRIMARY_LOGO

| Location | Status | Evidence |
|----------|--------|----------|
| Admin Sidebar | **USED** (via symbol, not primary) | `admin-shell.tsx` prefers `logos.mini` (SYMBOL_LOGO) |
| Admin Header | **USED** (via symbol) | `admin.tsx` uses `logos.mini` → `logos.main` fallback |
| Login Page | **USED** (via symbol) | `admin-login.tsx` — `logos.mini \|\| logoSrc` |
| Public Landing Page | **USED** | `landing.tsx` — `logos.mainReverse \|\| logos.main` |
| Tournament Website | **PARTIAL** | `organizer-portal.tsx`, `player-register.tsx` (name only) |
| PDF Reports | **LEGACY** | Server: `team-reports.ts` → `miniLogoUrl ?? mainLogoUrl` from `branding_settings` |
| Certificates | **NOT USED** | No certificate generation module found |
| Email Templates | **LEGACY** | `notification-service.ts` → `miniLogoUrl`; fallback `favicon-32.png` |
| Print Views | **USED** | `team-reports.tsx` client — `logos.mini \|\| logos.main` |

### Area 2 — REVERSE_LOGO

| Location | Status | Evidence |
|----------|--------|----------|
| Footer | **USED** | `landing.tsx`, `blog-layout.tsx`, `seo-sport-landing.tsx` — `mainReverse` first in chain |
| Dark Navigation | **USED** | `public-navbar.tsx`, `organizer-portal.tsx` |
| Dark Hero Sections | **USED** | `landing.tsx` footer CTA |
| LED Display Screens | **LEGACY** | `EffectsLayer.tsx` reads `branding.miniLogoUrl` / `mainLogoUrl` on LedView, not reverse |
| Streaming Screens | **NOT USED** | `broadcast-overlay-brand-mark.tsx` uses `logos.mini` only |

### Area 3 — SYMBOL_LOGO

| Location | Status | Evidence |
|----------|--------|----------|
| Collapsed Sidebar | **USED** | `layout.tsx`, `admin-shell.tsx` |
| Mobile Navigation | **USED** | `public-navbar.tsx` fallback chain includes mini |
| Compact Branding Areas | **USED** | Widespread via `logos.mini` |
| Small Cards | **USED** | Overlays, powered-by, tournament gate |

### Area 4 — FAVICON

| Check | Status | Evidence |
|-------|--------|----------|
| `index.html` | **HARDCODED** | `/favicon.svg`, `/favicon-32.png` |
| Dynamic favicon update | **USED** | `App.tsx` `BrandingEffects` — `logos.favicon` → icon links |
| Browser tab icon | **PARTIAL** | Works after JS hydration; static fallback before load |
| Hardcoded favicon remains | **YES** | See Hardcoded References section |

### Area 5 — PWA_ICON

| Check | Status | Evidence |
|-------|--------|----------|
| `site.webmanifest` | **HARDCODED** | `/favicon-32.png` only |
| Install prompt | **NOT CONNECTED** | Static manifest |
| Android home screen | **NOT CONNECTED** | Owner-app: `vite.config.ts` PWA manifest → `pwa-icon-192/512.png` |
| Branding service output | **NOT USED** | No dynamic manifest generation |

### Area 6 — APPLE_TOUCH_ICON

| Check | Status | Evidence |
|-------|--------|----------|
| `<link rel="apple-touch-icon">` | **PARTIAL** | Dynamic in `App.tsx`; static in `index.html`, owner-app |
| iOS install support | **PARTIAL** | Owner-app uses static PNGs, not branding API |

### Area 7 — SPLASH_LOGO

| Check | Status | Evidence |
|-------|--------|----------|
| PWA loading screen | **NOT USED** | Theme color only |
| Mobile loading screen | **NOT USED** | Owner screens use main/mini logos |
| Loading overlays | **NOT USED** | `logos.splash` never referenced in components |

### Area 8 — OPEN_GRAPH_IMAGE

| Check | Status | Evidence |
|-------|--------|----------|
| `<meta property="og:image">` | **PARTIAL** | Client dynamic when asset set; SSR hardcoded |
| `<meta name="twitter:image">` | **PARTIAL** | Same as OG |
| Tournament share pages | **NOT USED** | App routes served with generic shell |
| Landing page share preview | **HARDCODED** | `index.html`, `page-meta.ts`, `html-meta-injector.ts` |
| Public pages (SSR) | **HARDCODED** | Marketing pages use `opengraph.jpg` default |

### Area 9 — OBS_WATERMARK

| Check | Status |
|-------|--------|
| OBS overlays | **NOT CONNECTED** — uses `SYMBOL_LOGO` via `BroadcastOverlayBrandMark` |
| Score overlays | **NOT CONNECTED** |
| Streaming layouts | **NOT CONNECTED** |
| Auction broadcast layouts | **NOT CONNECTED** — brand mark is mini logo + text |

**Verdict: NOT CONNECTED**

`BidwarBrandWatermark` (`bidwar-brand-watermark.tsx`) was built for venue branding but is **dead code** — zero imports in the repository.

### Area 10 — PDF_WATERMARK

| Check | Status | Evidence |
|-------|--------|----------|
| PDF reports (server) | **PARTIALLY CONNECTED** | Logo: `miniLogoUrl` (SYMBOL/PRIMARY legacy). Watermark: text from `watermarkText` setting, not image |
| Invoices | **NOT CONNECTED** | No invoice PDF module using `PDF_WATERMARK` |
| Certificates | **NOT CONNECTED** | No certificate module |
| Exports | **PARTIALLY CONNECTED** | `admin-reports.ts` text watermark only |
| Client print | **LEGACY** | `team-reports.tsx` uses `logos.mini`/`logos.main`, not `pdfWatermark` |

**Verdict: PARTIALLY CONNECTED** (legacy logo + text watermark; image asset unused)

---

## Hardcoded Branding References

| File | Reference | Type |
|------|-----------|------|
| `artifacts/auction-platform/index.html` | `opengraph.jpg`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, JSON-LD `favicon.svg` | Static fallback |
| `artifacts/auction-platform/public/site.webmanifest` | `/favicon-32.png`, hardcoded name "BidWar" | Static PWA |
| `artifacts/owner-app/index.html` | `pwa-icon-192.png`, `pwa-icon-512.png` | Static Apple touch |
| `artifacts/owner-app/vite.config.ts` | PWA manifest icons `pwa-icon-192/512/svg` | Static PWA |
| `artifacts/api-server/src/lib/html-meta-injector.ts` | `https://bidwar.in/opengraph.jpg` default | SSR OG fallback |
| `artifacts/api-server/src/lib/page-meta.ts` | `DEFAULT_OG_IMAGE = .../opengraph.jpg`, `favicon.svg` in schema | SSR meta |
| `artifacts/auction-platform/src/pages/seo-sport-landing.tsx` | `ogImage="https://bidwar.in/opengraph.jpg"` | Hardcoded SeoHead |
| `artifacts/api-server/src/lib/notifications/templates/email-branding.ts` | `/favicon-32.png` fallback | Email logo fallback |
| `artifacts/auction-platform/public/favicon.svg` | Static file | Fallback asset |
| `artifacts/auction-platform/public/favicon-32.png` | Static file | Fallback asset |
| `artifacts/auction-platform/public/apple-touch-icon.png` | Static file | Fallback asset |
| `artifacts/auction-platform/public/opengraph.jpg` | Static file | Fallback OG |
| `artifacts/owner-app/public/pwa-icon-*.png/svg` | Static files | Owner PWA |
| `lovableupdates/src/lib/bidwar-live.functions.ts` | Direct SQL `branding_settings` | Legacy demo code |

---

## Legacy References

Files reading `branding_settings` **directly** (bypassing `BrandingService.getAsset()`):

| File | What it reads | Classification |
|------|---------------|----------------|
| `artifacts/api-server/src/routes/branding.ts` | Settings + merges via `brandingService` | **Safe** (orchestration layer) |
| `artifacts/api-server/src/lib/branding-service.ts` | Both tables; syncs legacy columns | **Safe** (service implementation) |
| `artifacts/api-server/src/routes/team-reports.ts` | `miniLogoUrl`, `mainLogoUrl`, `showBrandingPdf` | **Needs Migration** |
| `artifacts/api-server/src/routes/admin-reports.ts` | `watermarkText`, `watermarkOpacity`, `brandName` | **Needs Migration** |
| `artifacts/api-server/src/lib/notifications/notification-service.ts` | `miniLogoUrl`, `brandName`, `poweredByText` | **Needs Migration** |
| `artifacts/auction-platform/src/hooks/use-branding.ts` | Legacy URL fields as fallback | **Safe** (client compat layer) |
| `artifacts/owner-app/src/hooks/useBranding.ts` | Legacy URL fields as fallback | **Safe** (client compat layer) |
| `artifacts/auction-platform/src/components/display/v1/EffectsLayer.tsx` | `branding.miniLogoUrl`, `mainLogoUrl` on LedView | **Needs Migration** |
| `artifacts/auction-platform/src/components/display/v1/ChyronStrip.tsx` | `branding.miniLogoUrl` | **Needs Migration** |
| `artifacts/auction-platform/src/lib/led-view/use-led-view.ts` | Maps to `mainLogoUrl`/`miniLogoUrl` keys | **Needs Migration** |
| `artifacts/auction-platform/src/lib/led-view/types.ts` | Legacy field names in type | **Needs Migration** |
| `lovableupdates/` | Raw SQL branding_settings | **Broken** (stale demo, not production) |

Frontend components using **legacy field names** on LedView/branding objects (not typed asset keys):

- `EffectsLayer.tsx`, `ChyronStrip.tsx`, `use-led-view.ts`

These receive merged data from `/api/branding` so URLs are correct, but they **do not use the asset type system** and will not pick up new asset-only fields (e.g. `PDF_WATERMARK`).

---

## BrandingService Compliance

| Layer | Expected | Actual | Result |
|-------|----------|--------|--------|
| Asset CRUD (admin API) | `brandingService.upsertAsset/removeAsset` | ✅ Used in `routes/branding.ts` | **PASS** |
| Public read API | `brandingService.getAssetsMap` + merge | ✅ Used in `GET /api/branding` | **PASS** |
| Server PDF generation | `brandingService.getAsset('PDF_WATERMARK')` | ❌ Direct `branding_settings` query | **FAIL** |
| Server email enrichment | `brandingService.getAsset('SYMBOL_LOGO')` | ❌ Direct `miniLogoUrl` column | **FAIL** |
| Server admin reports PDF | `brandingService.getAsset(...)` | ❌ Direct settings query | **FAIL** |
| SSR meta injection | `brandingService.getAsset('OPEN_GRAPH_IMAGE')` | ❌ Hardcoded `opengraph.jpg` | **FAIL** |
| Client UI | `useBranding()` → asset map | ✅ All major UI surfaces | **PASS** |
| Client favicon/OG | Typed asset keys | ✅ `App.tsx` uses `favicon`, `appleTouchIcon`, `openGraph` | **PASS** |
| PWA manifests | Dynamic from `PWA_ICON` | ❌ Static files | **FAIL** |
| OBS / PDF watermark assets | `getAsset('OBS_WATERMARK'/'PDF_WATERMARK')` | ❌ Zero consumers | **FAIL** |

**Overall BrandingService compliance: FAIL** (5/10 integration points pass)

**Note:** No production code calls `brandingService.getAsset()` except inside `branding-service.ts` itself and route handlers. Server-side consumers were never migrated.

---

## Production Readiness Score

| Asset | Score | Rationale |
|-------|-------|-----------|
| PRIMARY_LOGO | **78** | Wide UI coverage via `logos.main`; server PDF/email bypass |
| REVERSE_LOGO | **72** | Good footer/dark UI; LED/streaming gaps |
| SYMBOL_LOGO | **88** | Primary workhorse; minor legacy field names in LED |
| FAVICON | **58** | Dynamic post-hydration; static fallbacks dominate SSR/first paint |
| PWA_ICON | **22** | Stored only; manifests ignore it |
| APPLE_TOUCH_ICON | **55** | Partial dynamic; owner-app static |
| SPLASH_LOGO | **12** | Hook exposes; zero consumers |
| OPEN_GRAPH_IMAGE | **42** | Client-only when set; crawlers see hardcoded image |
| OBS_WATERMARK | **8** | Dead component; not wired |
| PDF_WATERMARK | **18** | Text watermark exists; image asset unused |

### Overall Platform Score: **52 / 100**

**Interpretation:** Storage and admin are production-grade. Consumption is **logo-centric** (primary/reverse/symbol) with legacy server bypasses. Four dedicated asset slots and PWA/OG SSR paths remain unintegrated.

---

## Required Fixes

### Critical

1. **Wire `PDF_WATERMARK` into PDF engine** — Update `team-reports.ts` and `admin-reports.ts` to use `brandingService.getAsset('PDF_WATERMARK')` for image watermark; fall back to `SYMBOL_LOGO` then text watermark.
2. **Wire `OPEN_GRAPH_IMAGE` into SSR** — `html-meta-injector.ts` and `page-meta.ts` should read from `brandingService.getAsset('OPEN_GRAPH_IMAGE')` at startup or per-request; remove hardcoded `opengraph.jpg` as primary.
3. **Migrate server-side branding reads** — Replace direct `brandingSettingsTable` logo queries in `team-reports.ts`, `notification-service.ts`, `admin-reports.ts` with `brandingService.getAssetsMap()` or `getAsset()`.
4. **Connect `PWA_ICON` to manifests** — Generate or inject `site.webmanifest` and owner-app PWA icons from branding API (or build-time fetch).

### Medium

5. **Connect `SPLASH_LOGO`** — Owner app Launcher/Warmup and PWA splash should use `logos.splash`; consider `logoAnimationUrl` coordination.
6. **Connect `OBS_WATERMARK`** — Import `BidwarBrandWatermark` or replace `BroadcastOverlayBrandMark` image source with `logos.obsWatermark` fallback chain.
7. **Unify LED branding shape** — Migrate `LedView.branding` from `miniLogoUrl`/`mainLogoUrl` to typed asset keys or `useBranding().logos`.
8. **Favicon pipeline** — Generate 16/32/48 from `FAVICON` source; update `site.webmanifest` sizes array.
9. **Remove hardcoded OG from `seo-sport-landing.tsx`** — Use `useBranding().logos.openGraph` or server meta.
10. **Email templates** — Use `PRIMARY_LOGO` or `SYMBOL_LOGO` via service, not `miniLogoUrl` column.

### Low

11. **Rename sponsor `brandingService`** in `sponsor-priority.ts` to `sponsorBrandingService` to avoid confusion.
12. **Delete or wire `BidwarBrandWatermark`** — Currently dead code.
13. **Certificates module** — When built, consume `PRIMARY_LOGO` + `PDF_WATERMARK` from service.
14. **Tournament share OG** — Per-tournament pages could use tournament logo + platform `OPEN_GRAPH_IMAGE` template.
15. **Local mode** — Embed `branding_assets` in export package (documented gap in `FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md`).

---

## Conclusion

BidWar's branding system **successfully centralizes asset storage** and **partially centralizes consumption**. The three logo assets (`PRIMARY_LOGO`, `REVERSE_LOGO`, `SYMBOL_LOGO`) flow correctly to most React surfaces through `useBranding()`. Favicon and Apple touch icon work **after client hydration**.

The platform is **not yet fully asset-driven**:

- Server-side PDF, email, and SSR paths **bypass BrandingService**
- **PWA manifests, splash, OBS watermark, and PDF watermark** assets are **stored but not consumed**
- **Hardcoded static files** remain the source of truth for crawlers, first paint, and install icons

**Recommendation:** Treat this audit as the integration backlog. Priority order: SSR OG → server PDF/email migration → PWA manifest → OBS/PDF watermark wiring → splash screen.

---

*Generated from static analysis of `C:\CWP\updatedbidwarcore` on 24 June 2026.*
