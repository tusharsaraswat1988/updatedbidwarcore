# Staging Certification Report

**Date:** 2026-07-11  
**Environment under test:** `https://bidwar-staging.onrender.com`  
**Repository branch (local):** `develop` (`27c003c`)  
**Certification type:** Verify-only (no refactors, no business-logic changes)  
**Overall result:** **CONDITIONAL PASS** — core isolation and live auction surfaces work; SEO/runtime URL emission and Render branch bindings need remediation before full sign-off.

---

## Summary

| # | Check | Result | Severity |
|---|--------|--------|----------|
| 1 | Staging uses only staging database | **PASS** | — |
| 2 | Production database cannot be accessed accidentally | **PASS** (staging); **WARN** (local/scripts) | Medium |
| 3 | Staging Render service tracks `develop` only | **NOT VERIFIED** | High |
| 4 | Production Render service tracks `main` only | **NOT VERIFIED** | High |
| 5 | `APP_URL` and `APP_DOMAIN` correct | **PARTIAL FAIL** | High |
| 6 | Authentication works | **PASS** | — |
| 7 | SSE works | **PASS** | — |
| 8 | Owner panel works | **PASS** | — |
| 9 | Operator panel works | **PASS** | — |
| 10 | Viewer works | **PASS** | — |
| 11 | LED screen works | **PASS** | — |
| 12 | No production secrets used unintentionally | **NOT VERIFIED** (dashboard) | Medium |
| 13 | No production URLs hardcoded for runtime | **FAIL** | High |

**Promotion recommendation:** Do **not** treat staging as fully certified for release promotion until checks **3, 4, 5, 12, and 13** are confirmed or fixed. Auction runtime paths (auth, SSE, panels) are operational on staging.

---

## Evidence and methodology

Verification combined:

- Live HTTP probes against `https://bidwar-staging.onrender.com`, `https://bidwar.in`, and `https://updatedbidwarcore.onrender.com`
- Neon MCP read-only queries (project/branch metadata, tournament counts)
- Static code review of env loading, routing, SEO, and auction client paths
- Local env file hostname fingerprinting (secrets redacted; hosts only)

Render Dashboard and secret values were **not** accessible from this workspace (`RENDER_API_KEY` absent; `gh` CLI unavailable).

---

## Detailed findings

### 1. Staging uses only the staging database — **PASS**

**Evidence**

| Resource | Identifier | Endpoint host (redacted) |
|----------|------------|---------------------------|
| Neon **staging** project | `BidWar Staging` (`old-art-20161659`) | `ep-long-sky-aorboyzr-pooler.c-2.ap-southeast-1.aws.neon.tech` (import branch `br-misty-wave-aoyxpl3y`) |
| Neon **production** project | `Bidwar Prduction Database` (`jolly-tree-42208228`) | `ep-late-math-aohd4iep-pooler.c-2.ap-southeast-1.aws.neon.tech` |

- Staging API `GET /api/tournaments` returns four tournaments (IDs 1, 3, 4, 5) with names matching the staging import branch query.
- Staging Neon **default** branch (`br-hidden-mud-aongr3rw`) has **no** `public.tournaments` table (`to_regclass` → `null`). Because the live staging API serves tournament data, the Render service **cannot** be using that empty default branch URL.
- Production and staging use **different Neon projects** and **different pooler hostnames**.

**Conclusion:** Staging is connected to the Neon staging project (import branch with cloned schema/data), not the production Neon endpoint.

---

### 2. Production database cannot be accessed accidentally — **PASS** (staging) / **WARN** (local & scripts)

**Staging / Render protections — PASS**

- `lib/db/src/load-app-env.ts` snapshots and restores host-managed keys (`DATABASE_URL`, `NEON_DATABASE_URL`, `APP_URL`, `APP_DOMAIN`, secrets) on managed hosts (`RENDER`, etc.), preventing committed `.env.production` from overriding dashboard values.
- Live staging serves data from the staging Neon endpoint (see check 1).

**Residual risks — WARN (not staging Render failures)**

| Risk | Location | Notes |
|------|----------|-------|
| Clone script defaults | `scripts/src/clone-tournament-from-prod.ts` | If `PRODUCTION_DATABASE_URL` is unset, source defaults to `.env` `DATABASE_URL` — easy to clone from the wrong DB locally. |
| Local `.env.production` | Repo root (present) | Host fingerprint: `DATABASE_URL` → `ep-late-math-aohd4iep` (production pooler). Safe while unset on Render; risky if used locally for migrations/scripts. |
| Local `.env` | Repo root (present) | `APP_URL=https://bidwar.in` but `DATABASE_URL` → `ep-hidden-band-aogw7hho` (separate dev Neon host, not production). |

**Conclusion:** Staging deployment is isolated from production DB. Local developer workflows and maintenance scripts still require discipline (documented in `CONTRIBUTING.md` / `RENDER_ENV_VARS.md`).

---

### 3. Staging Render service tracks `develop` only — **NOT VERIFIED**

**What was checked**

- Local git: `develop` and `main` both at `27c003c` (0 commits divergence) — branch drift cannot be detected via commit comparison right now.
- No Render API credentials in this environment.
- No `render.yaml` in repository.

**What is documented**

- `DEPLOY.md` / `RENDER_ENV_VARS.md` specify staging service `bidwar-staging` on branch `develop`.

**Required manual confirmation (Render Dashboard)**

1. Open staging web service → **Settings → Build & Deploy → Branch** = `develop`.
2. Confirm **Auto-Deploy** is enabled for that branch only.
3. After next `develop` commit, verify deployed SHA on staging differs from production if branches have diverged.

**Status:** Cannot certify from repository or live URL alone.

---

### 4. Production Render service tracks `main` only — **NOT VERIFIED**

**What was checked**

- `https://bidwar.in` and `https://updatedbidwarcore.onrender.com` both respond healthy and serve the same built asset hash (`/assets/index-BqL25ZW4.js`) as staging — consistent with identical commit on both branches today, not proof of branch binding.

**Required manual confirmation (Render Dashboard)**

1. Production web service (likely `bidwar.in` custom domain target) → **Branch** = `main`.
2. Legacy `updatedbidwarcore.onrender.com` service (if still active) must not auto-deploy from `develop`.

**Status:** Cannot certify without Render Dashboard access.

---

### 5. `APP_URL` and `APP_DOMAIN` are correct — **PARTIAL FAIL**

**PASS (network / service identity)**

- Staging hostname resolves and serves the application: `https://bidwar-staging.onrender.com`.
- Documented staging template in `RENDER_ENV_VARS.md`:
  - `APP_DOMAIN=bidwar-staging.onrender.com`
  - `APP_URL=https://bidwar-staging.onrender.com`

**FAIL (runtime public URL emission)**

Live staging homepage and crawl assets still advertise production:

| Probe | Expected on staging | Observed on staging |
|-------|---------------------|---------------------|
| `rel="canonical"` | `https://bidwar-staging.onrender.com/` | `https://bidwar.in/` |
| `og:url` | staging origin | `https://bidwar.in/` |
| `/robots.txt` Sitemap line | staging host | `Sitemap: https://bidwar.in/sitemap-index.xml` |
| `/sitemap-index.xml` | staging URLs | `https://bidwar.in/sitemap-pages.xml`, etc. |

**Root cause (code, not verified dashboard vars)**

- `artifacts/api-server/src/app.ts` — `registerSeoRoutes(app, CANONICAL_HOST)` with `CANONICAL_HOST = "bidwar.in"`.
- `artifacts/api-server/src/lib/page-meta.ts` — `export const BASE_URL = "https://bidwar.in"`.
- `artifacts/api-server/src/lib/seo-route-policy.ts` — sitemap builders use `BASE_URL`.

`runtime-env.ts` correctly supports env-driven origins for OAuth/email, but SSR/SEO paths bypass it.

**Conclusion:** Service is reachable on the staging host, but **runtime metadata does not reflect staging `APP_URL`/`APP_DOMAIN`**.

---

### 6. Authentication works — **PASS**

| Endpoint | Method | Staging result | Interpretation |
|----------|--------|----------------|----------------|
| `/api/auth/admin/login` | POST (`{"password":"invalid-cert-test"}`) | `401` `{"error":"Incorrect password"}` | Admin auth route live; credential check works |
| `/api/auth/organizer-account/login/status` | GET | `200` guard status JSON | Organizer account guard active |
| `/api/auth/organizer-account/login` | POST (invalid body) | `400` `{"error":"Invalid input"}` | Validation path works |
| `/api/auth/google` | GET | `200` (Google sign-in HTML) | OAuth entry reachable |

**Note:** `POST /api/auth/organizer/login` (without tournament path) returns `403` — expected; real organizer login is under `/api/auth/organizer-account/login` or `/api/auth/organizer/:tournamentId/login`.

---

### 7. SSE works — **PASS**

```
GET https://bidwar-staging.onrender.com/api/tournaments/1/auction/events
Accept: text/event-stream
→ first line: ": connected"
```

Auction SSE endpoint accepts connections on staging. Client hooks use relative paths (`/api/tournaments/:id/auction/events`) — environment-safe.

---

### 8. Owner panel works — **PASS**

| Route | Status | Notes |
|-------|--------|-------|
| `/owner-app/` | `200` | Owner PWA shell |
| `/owner-app/join?tournamentId=1&teamId=1` | `200` | Join entry |
| `/tournament/1/owner/1` | `200` | Legacy redirect shell to owner-app |

---

### 9. Operator panel works — **PASS**

| Route | Status |
|-------|--------|
| `/tournament/1/auction` | `200` |

Operator SPA shell loads for tournament `1` (Vyapari Network Badminton League 3.0 Men).

---

### 10. Viewer works — **PASS**

| Route | Status |
|-------|--------|
| `/tournament/1/liveviewer` | `200` |

---

### 11. LED screen works — **PASS**

| Route | Status |
|-------|--------|
| `/tournament/1/display` | `200` |

Display route loads (TV/LED shell). Side/break-timer variants not individually probed; primary LED path is operational.

---

### 12. No production secrets used unintentionally — **NOT VERIFIED** (dashboard)

**What could be verified**

- Staging and production Neon credentials are **different** at the infrastructure level (separate projects/endpoints).
- Staging admin auth returns `401` on bad password (implies `ADMIN_PASSWORD` is set independently).

**What could not be verified (requires Render Dashboard)**

- Whether `SESSION_SECRET`, `ADMIN_PASSWORD`, OAuth client, Cloudinary, Twilio, BulkSMS, Resend, `GITHUB_PAT`, `REDIS_URL`, and VAPID keys are unique per environment.
- `RENDER_ENV_VARS.md` explicitly recommends omitting `GITHUB_PAT` on staging (admin build trigger hardcodes `ref: "main"` in `artifacts/api-server/src/routes/settings.ts`).

**Recommendation:** Complete a dashboard secret parity checklist before promotion (see `RENDER_ENV_VARS.md` staging integration table).

---

### 13. No production URLs hardcoded for runtime — **FAIL**

**Auction / panel runtime — PASS**

These paths use relative URLs or `window.location.origin` (environment-correct):

- `artifacts/auction-platform/src/hooks/use-auction-socket.ts`
- `artifacts/owner-app/src/hooks/use-auction-socket.ts`
- Owner join / registration share helpers

**Server-driven public pages — FAIL on staging**

Hardcoded `https://bidwar.in` observed in live staging responses and in server code:

| Area | File(s) | Runtime impact on staging |
|------|---------|---------------------------|
| Homepage canonical / OG | `page-meta.ts`, HTML meta injector | Emits `bidwar.in` |
| `robots.txt` | `app.ts` → `register-seo-routes.ts` | Sitemap points to `bidwar.in` |
| Sitemap XML bodies | `seo-route-policy.ts` | All `<loc>` entries use `BASE_URL` = `bidwar.in` |
| Email template fallbacks | `base-layout.ts`, communication templates | Would emit prod links if triggered |
| Static `index.html` (built bundle) | `artifacts/auction-platform/index.html` | Marketing meta in client bundle |

**Conclusion:** Staging **auction operations** are environment-safe; **marketing/SEO SSR** is not.

---

## Neon staging operational note

The staging Neon project contains multiple branches:

| Branch | Schema state |
|--------|----------------|
| `production` (default) | Empty/demo schema only — **no `tournaments` table** |
| `import-2026-07-11T11:18:56.901Z` | Full BidWar schema + 4 tournaments (production clone) |

Live staging API behaviour confirms Render is using the **import branch** connection string, not the default empty branch. Document the active connection string in Render staging secrets and consider setting the import branch as default or renaming for clarity.

---

## Issues requiring action (no fixes applied in this pass)

Per instruction, this certification performed **verify-only** with **no code changes**. The following items block **full** certification:

1. **Confirm Render branch bindings** (checks 3 & 4) in Dashboard.
2. **Confirm per-environment secrets** (check 12) in Dashboard.
3. **Fix runtime SEO URL emission** (checks 5 & 13) — minimal targeted change would wire `getPublicOrigin()` / `APP_URL` into `page-meta.ts`, `seo-route-policy.ts`, and `registerSeoRoutes()` call site in `app.ts` (out of scope for this verify-only pass).
4. **Document active Neon branch** on staging Render `DATABASE_URL` to avoid accidental rotation to the empty default branch.

---

## Live smoke test reference

For human sign-off after remediation, run the auction smoke test in `STAGING_CHECKLIST.md` on `https://bidwar-staging.onrender.com` (15 actions × 4 surfaces). Automated probes in this report covered:

- Health (`/api/healthz`)
- Tournament listing (`/api/tournaments`)
- SSE connect
- Operator / display / liveviewer / owner-app shells

Full bid flow, organizer login with real credentials, and LED live state transitions were **not** executed (no staging credentials in this workspace).

---

## Certification sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Automated verification | Cursor agent | 2026-07-11 | Conditional pass |
| Engineering lead | _pending_ | | |
| Staging owner | _pending_ | | |

---

## Appendix: probe log (staging)

```
GET /api/healthz                          → 200 {"status":"ok"}
GET /api/tournaments                      → 200 [4 tournaments]
POST /api/auth/admin/login                → 401 Incorrect password
GET /api/tournaments/1/auction/events     → SSE ": connected"
GET /tournament/1/auction                 → 200
GET /tournament/1/display                 → 200
GET /tournament/1/liveviewer              → 200
GET /owner-app/join?tournamentId=1&teamId=1 → 200
GET /robots.txt                           → 200 (Sitemap: https://bidwar.in/...)
GET /                                     → 200 (canonical: https://bidwar.in/)
```
