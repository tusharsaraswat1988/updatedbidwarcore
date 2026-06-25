# Brand Visual Consistency Report

**Date:** 2025-06-24  
**Scope:** UI-only visual consistency sprint (no branding schema, API, or upload changes)  
**Source of truth:** `artifacts/auction-platform/src/lib/brand-usage.ts`

---

## Summary

Created centralized logo usage rules and applied fixes across marketing pages, auth flows, sidebars, auction operator chrome, LED/OBS surfaces, and the owner app. Primary outcomes:

- Landing header logo reduced to **28–40px** visual height
- Footer logos reduced ~**33%** (`h-24`/`h-28` → `h-16`)
- Auth screens use **REVERSE_LOGO** wordmarks, large and centered, with no adjacent “BidWar” text
- Sidebars and compact chrome use **SYMBOL_LOGO** only (no duplicate brand name)
- LED/OBS zones show **one brand identifier per zone** (symbol OR powered-by, never both)
- Operator header uses visible symbol mark; redundant footer “Powered by BIDWAR” removed

---

## Logo Usage Matrix

| Location | Logo Type | Size (after fix) | Status |
|----------|-----------|------------------|--------|
| Landing / marketing header (`PublicNavbar`) | PRIMARY_LOGO | `h-7` → `h-10` (28–40px) | ✅ Fixed |
| Landing footer | REVERSE_LOGO | `h-16` (~33% smaller) | ✅ Fixed |
| Blog / SEO sport landing footer | REVERSE_LOGO | `h-16` | ✅ Fixed |
| Admin login | REVERSE_LOGO | `h-16 md:h-20` centered | ✅ Fixed |
| Organizer login | REVERSE_LOGO | `h-16 md:h-20` centered | ✅ Fixed |
| Owner app join (`MobileEntry`) | REVERSE_LOGO | `h-16 md:h-20` | ✅ Fixed |
| Owner app launcher splash | SPLASH → REVERSE → PRIMARY | `h-20` splash / auth sizes | ✅ Fixed |
| Admin sidebar (`AdminShell`) | SYMBOL_LOGO | `h-9 w-9` | ✅ Fixed |
| Organizer sidebar (`layout.tsx`) | SYMBOL_LOGO | `h-9 w-9` | ✅ Fixed |
| Organizer dashboard header | SYMBOL_LOGO | `h-9 w-9` | ✅ Fixed |
| Legacy super-admin header (`admin.tsx`) | SYMBOL_LOGO | `h-9 w-9` | ✅ Fixed |
| Auction operator center mark | SYMBOL_LOGO | `h-9 sm:h-10` | ✅ Fixed |
| Live viewer header | SYMBOL_LOGO | `h-7 sm:h-8` | ✅ Fixed |
| Player registration header credit | SYMBOL_LOGO | `h-5 sm:h-6` | ✅ Correct |
| LED venue watermark | SYMBOL_LOGO | `h-6 md:h-8` | ✅ Fixed |
| OBS top-center mark | SYMBOL_LOGO | 22px height | ✅ Fixed |
| LED chyron strip (right zone) | SYMBOL_LOGO | `h-8 w-8` | ✅ Fixed |
| LED team overlay mark | SYMBOL_LOGO | `h-10 md:h-12` | ✅ Fixed |
| Badminton LED chyron | SYMBOL_LOGO | `h-8 w-8` | ✅ Fixed |
| PDF / team reports footer | SYMBOL_LOGO + powered-by text | `h-5 w-5` | ✅ Correct |
| OBS sponsor ticker footer | Text “Powered by BidWar” only | Ticker credit | ✅ Allowed |

---

## Dark Theme Compliance

| Dark Page | Previous Logo | Expected Logo | Result |
|-----------|---------------|---------------|--------|
| Landing body / footer | PRIMARY in footer | REVERSE_LOGO | ✅ Pass |
| Organizer login | REVERSE (partial) | REVERSE_LOGO large | ✅ Pass |
| Admin login | SYMBOL + text | REVERSE_LOGO large | ✅ Pass |
| Admin shell / lock screen | SYMBOL + “BidWar” text | SYMBOL only | ✅ Pass |
| Organizer dashboard | SYMBOL + “BidWar” text | SYMBOL only | ✅ Pass |
| Auction operator | PRIMARY wordmark + powered-by | SYMBOL only | ✅ Pass |
| Live viewer header | SYMBOL + “BidWar” text | SYMBOL only | ✅ Pass |
| LED watermark | Symbol + powered-by + name | SYMBOL only | ✅ Pass |
| OBS overlay | Symbol + powered-by text | SYMBOL only | ✅ Pass |
| Owner app (all screens) | PRIMARY on dark | REVERSE → PRIMARY chain | ✅ Pass |
| Public navbar (light bar on dark page) | PRIMARY wordmark | PRIMARY_LOGO | ✅ Pass (intentional contrast) |

**Overall dark theme compliance:** ✅ **Pass**

---

## Duplication Fixes

| File | Location | Issue | Fix Applied |
|------|----------|-------|-------------|
| `admin-login.tsx` | Login header | SYMBOL + `brandName` | REVERSE wordmark only |
| `admin-lock-screen.tsx` | Lock overlay | SYMBOL + `brandName` | SYMBOL only |
| `admin-shell.tsx` | Sidebar header | SYMBOL + `brandName` | SYMBOL + “Super Admin” label only |
| `layout.tsx` | Organizer sidebar | SYMBOL + `brandName` | SYMBOL only |
| `organizer-portal.tsx` | Dashboard header | SYMBOL + `brandName` | SYMBOL only |
| `admin.tsx` | Super-admin header | Logo + `brandName` | SYMBOL only |
| `liveviewer.tsx` | Viewer header | SYMBOL + `brandName` | SYMBOL only |
| `operator-layout.tsx` | Center brand | Wordmark + powered-by | SYMBOL only |
| `auction-operator.tsx` | Footer bar | Hardcoded “BIDWAR” + header mark | Footer credit removed |
| `bidwar-brand-watermark.tsx` | LED bottom-left | Logo + powered-by + name | SYMBOL only |
| `broadcast-overlay-brand-mark.tsx` | OBS top | Logo + powered-by text | SYMBOL only |
| `ChyronStrip.tsx` | LED chyron right | Logo + name + powered-by | SYMBOL only |
| `badminton-led-chrome.tsx` | Badminton chyron | Logo + name + powered-by | SYMBOL only |
| `team-overlay.tsx` | Top-right mark | Logo + `brandName` | SYMBOL only |
| `player-overlay.tsx` | Under title | Logo + powered-by together | Logo OR powered-by fallback |
| `Launcher.tsx` (owner-app) | Splash / header | Wordmark + `brandName` | Wordmark OR symbol fallback only |

---

## Size Fixes

### Oversized (fixed)

| Location | Before | After |
|----------|--------|-------|
| `PublicNavbar` | `w-[136–188px]` width-driven | `h-7 sm:h-8 md:h-10` height-capped |
| Landing footer | `h-24` (96px) | `h-16` (64px) |
| Blog / SEO footer | `h-28` (112px) | `h-16` (64px) |
| Owner `MobileEntry` | `h-[8.4rem]` (134px) | `h-16 md:h-20` |

### Undersized (fixed)

| Location | Before | After |
|----------|--------|-------|
| Operator center mark | `h-7` wordmark (weak) | `h-9 sm:h-10` symbol |
| LED player overlay mark | `h-4` | `h-5` |
| Live viewer header | `h-6 sm:h-7` | `h-7 sm:h-8` |

### Correct (unchanged)

| Location | Size | Notes |
|----------|------|-------|
| Registration header credit | `h-5 sm:h-6` | Compact, appropriate |
| PDF report footer | `h-5 w-5` | Symbol + powered-by allowed |
| OBS symbol mark | 22px | Subtle watermark per spec |

---

## Powered-By Rules Applied

| Surface | Allowed? | Action |
|---------|----------|--------|
| Navbar / header | ❌ | Removed from operator center, viewer duplication |
| Login pages | ❌ | No powered-by on auth screens |
| Hero sections | ❌ | Not added |
| LED/OBS footer ticker | ✅ | Retained in sponsor ticker (`obs-overlay.tsx`) |
| PDF footer | ✅ | Retained in `team-reports.tsx` |
| Player register page footer | ✅ | Text-only `PoweredByBidWarLink variant="footer"` |
| Owner app empty state | ✅ | Single line at page bottom (no logo duplicate) |

---

## Remaining Recommendations (low priority)

1. **`EffectsLayer.tsx` (LED v1 break screen)** — Still reads legacy `branding.miniLogoUrl` / `mainLogoUrl` instead of `useBranding().logos`. Migrate to `brand-usage` presets when touching LED v1.
2. **`PoweredByBidWarLink` default variant** — Shows logo + “Powered by” card together; acceptable on registration marketing blocks but could be split into explicit `symbolOnly` / `textOnly` variants for clarity.
3. **`badminton/bidwar-badminton-branding.tsx`** — Public broadcast variants still combine logo + powered-by on some scorer layouts; audit when badminton broadcast UX is next revised.
4. **Shared package** — Consider moving `brand-usage.ts` to a workspace package so auction-platform and owner-app share one file instead of mirrored presets.
5. **Wordmark detection at runtime** — `shouldShowBrandNameAlongsideLogo()` is available but most surfaces now hard-disable name text; optional future enhancement if dynamic tournament white-label wordmarks are uploaded.

---

## Files Created / Modified

**Created**

- `artifacts/auction-platform/src/lib/brand-usage.ts`
- `artifacts/owner-app/src/lib/brand-usage.ts`
- `BRAND_VISUAL_CONSISTENCY_REPORT.md`

**Key UI updates (auction-platform)**

- `components/public-navbar.tsx`
- `pages/landing.tsx`, `pages/seo-sport-landing.tsx`
- `components/blog/blog-layout.tsx`
- `pages/admin-login.tsx`, `pages/organizer-portal.tsx`, `pages/admin.tsx`
- `components/admin-shell.tsx`, `components/layout.tsx`, `components/admin-lock-screen.tsx`
- `components/operator-layout.tsx`, `pages/auction-operator.tsx`
- `pages/liveviewer.tsx`
- `components/display/bidwar-brand-watermark.tsx`
- `components/display/broadcast-overlay-brand-mark.tsx`
- `components/display/v1/ChyronStrip.tsx`
- `components/display/team-overlay.tsx`, `components/display/player-overlay.tsx`
- `components/badminton/badminton-led-chrome.tsx`
- `components/powered-by-bidwar-link.tsx`
- `lib/brand-assets.ts` (exported `BrandLogos` type)

**Key UI updates (owner-app)**

- `screens/Launcher.tsx`, `screens/MobileEntry.tsx`
- `lib/brand-assets.ts`

---

## Success Criteria Checklist

| Criterion | Status |
|-----------|--------|
| No logo/text duplication on nav, auth, LED, OBS | ✅ |
| Reverse logo on dark auth / footer surfaces | ✅ |
| Header branding balanced (28–40px) | ✅ |
| Footer branding balanced (~33% reduction) | ✅ |
| Auction branding visible, not excessive | ✅ |
| OBS branding subtle (symbol only) | ✅ |
| Consistent logo hierarchy via `brand-usage.ts` | ✅ |
