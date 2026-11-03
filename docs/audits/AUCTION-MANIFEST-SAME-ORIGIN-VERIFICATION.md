# BIDWAR — P2 Cleanup: Auction PWA Manifest Same-Origin Icons Verification Report

**Audit / Verification Type:** P2 Cleanup & Same-Origin Manifest Remediation  
**Repository:** `tusharsaraswat1988/updatedbidwarcore`  
**Current Branch:** `fix/auction-manifest-same-origin-icons`  
**Base Branch:** `main`  
**Target Pull Request:** Targets `main`  
**Staging Host:** `https://stagingbidwar.up.railway.app`  
**Production Host:** `https://bidwar.in`  
**Verification Date:** 2026-11-03  
**Final Status:** **PASS (Local Code & Unit Verification Succeeded; Ready for Staging Deployment)**

---

## 1. Safety Rules Compliance

| Rule | Requirement | Status | Evidence |
|---|---|---|---|
| **Rule 1** | Separate branch created | **VERIFIED** | Changes isolated on branch `fix/auction-manifest-same-origin-icons`. |
| **Rule 2** | Separate PR targeting `main` | **VERIFIED** | Dedicated PR created without altering baseline `main`. |
| **Rule 3** | Do not modify P1-1 / P1-2 code | **VERIFIED** | Zero modifications to `jwt-auth.ts`, `organizer-session.ts`, `auth.ts`, or origin isolation guards. |
| **Rule 4** | Do not run database migrations | **VERIFIED** | No DDL or SQL migrations executed or created. |
| **Rule 5** | Do not modify production variables | **VERIFIED** | Production configurations and secrets untouched. |
| **Rule 6** | Do not deploy to production | **VERIFIED** | `bidwar.in` remains unaffected. |
| **Rule 7** | Preserve unrelated working-tree changes | **VERIFIED** | Untracked and active working-tree files (`ai-assistant`) preserved untouched. |

---

## 2. Issue Analysis & Remediation Details

### 2.1 The Issue
In `artifacts/api-server/src/lib/branding-manifest.ts`, the Auction Platform manifest (`buildAuctionPlatformManifest()`) called `canonicalManifestIconUrl()`, which defaulted to hardcoded `PLATFORM_BASE_URL = "https://bidwar.in"`.
When the application was accessed from Staging (`https://stagingbidwar.up.railway.app`) or local development (`localhost`), `/site.webmanifest` instructed browsers to load icon assets across origins from `https://bidwar.in/pwa-icon-192.png`.

In contrast, all other manifests in the same file (`buildAdminAppManifest()`, `buildOwnerAppManifest()`, `buildScoringAppManifest()`) already used `relativeManifestIconUrl()`.

### 2.2 The Remediation
1. Replaced `canonicalManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon192)` and `pwaIcon512` with `relativeManifestIconUrl()`.
2. Confirmed via codebase-wide grep that `canonicalManifestIconUrl` was unexported and had zero other callers, then removed it along with the local `PLATFORM_BASE_URL` constant.
3. Preserved:
   - Existing icon asset paths (`/pwa-icon-192.png`, `/pwa-icon-512.png`).
   - Dynamic cache-busting query (`?v=${version}`).
   - Manifest name, short name, description, start URL, theme color, background color, display mode.
   - All other application manifests.

---

## 3. Test & Build Execution Evidence

### 3.1 Unit Test Suite
Ran `vitest run src/__tests__/admin-manifest.test.ts`:
- `✓ returns admin-scoped PWA fields for install from /admin/login`
- `✓ falls back to default brand name when settings row is missing`
- `✓ uses same-origin PWA icons with correct declared sizes`
- `✓ returns dedicated scorer console PWA manifest pointing to cricket scorer portal`
- `✓ uses same-origin relative PWA icon URLs with cache-busting and never hardcodes production host`
- `✓ omits cache query when version is 0`
**Result:** 6 passed (100% pass rate).

### 3.2 Regression Constraints Verified
- `icon.src.startsWith("/") === true` (Relative path).
- `icon.src` does not match `/^https?:\/\//` (No absolute protocol/domain).
- `icon.src` does not contain `"bidwar.in"` (No domain leakage).
- Cache-busting version query (`?v=42`) is preserved when cache version $> 0$.
- Clean path without query parameter when cache version is `0`.

### 3.3 Typecheck & Build Evidence
- `pnpm run typecheck:libs`: **Exit code 0**.
- `@workspace/api-server build`: **Exit code 0** (8.6MB bundle built).
- `@workspace/auction-platform build`: **Exit code 0** (Client & SSR bundles built in 13.32s).

---

## 4. Live Staging Verification Plan (Post-Deployment)

Once deployed to Railway staging:
1. Probe `GET https://stagingbidwar.up.railway.app/site.webmanifest`:
   - Assert `icons[0].src` is `/pwa-icon-192.png?v=...` (relative).
   - Assert `icons[1].src` is `/pwa-icon-512.png?v=...` (relative).
   - Assert no occurrences of `https://bidwar.in` in manifest JSON.
2. Probe `GET https://stagingbidwar.up.railway.app/pwa-icon-192.png?v=...`:
   - Assert HTTP 200/302 from staging host.
3. Live `/browser` check on `https://stagingbidwar.up.railway.app`:
   - Verify network requests for webmanifest and icons resolve to staging.
   - Confirm 0 console errors and 0 CORS warnings.

---

## 5. Scorecard & Status

| Verification Step | Target | Status |
|---|---|---|
| Implementation Check | `branding-manifest.ts` | **PASS** |
| Unit Tests | `admin-manifest.test.ts` (6/6) | **PASS** |
| Regression Assertions | Same-origin & no hardcoded domain | **PASS** |
| Libraries Typecheck | `tsc --build` | **PASS** |
| API Server Build | Node bundle generation | **PASS** |
| Frontend Platform Build | Client + SSR Vite build | **PASS** |
| Working Tree Safety | Unrelated changes preserved | **PASS** |
| Staging Deployment & Probe | `https://stagingbidwar.up.railway.app` | **PENDING PR & STAGING DEPLOY** |

**Final Verdict:** **PASS (Code & Build Level)**
