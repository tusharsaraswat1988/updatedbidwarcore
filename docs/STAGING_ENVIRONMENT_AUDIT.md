# Staging Environment Audit

**Date:** 2026-07-11  
**Scope:** Prepare `updatedbidwarcore` for a two-environment workflow (Production = `main` + Neon prod + Render prod; Staging = `develop` + Neon staging + Render staging).  
**Constraint:** Audit only — no business logic, auction logic, or API behavior was changed.

---

## Executive summary

The codebase has a **solid runtime foundation** for multi-environment deploys: `APP_URL`, `APP_DOMAIN`, CORS, cookies, OAuth redirect URIs, and most transactional links are resolved from environment variables via `runtime-env.ts` when Render dashboard values are set correctly.

However, the repository still **behaves as a single-production deployment** in several critical areas:

| Area | Staging readiness | Risk if unchanged |
|------|-------------------|-------------------|
| Runtime URL config (`APP_URL`, `APP_DOMAIN`, CORS, cookies) | **Good** — env-driven | Low *if* Render staging vars are distinct |
| SEO / sitemaps / marketing metadata | **Poor** — hardcoded `bidwar.in` | Staging URLs leak into Google; canonical conflicts |
| GitHub Actions / deploy automation | **Minimal** — one Electron build workflow | No branch-aware CI; admin build trigger targets `main` |
| Render repo config | **Absent** — dashboard-only | No `render.yaml`; branch mapping lives outside git |
| Third-party integrations | **Shared-by-default** | Staging can send real SMS/email/WhatsApp or hit prod webhooks |
| Operational scripts | **Production-named** | Easy to run prod checks or clone against wrong DB |
| Build artifacts (`index.html`, Vite bundles) | **Baked `bidwar.in`** | Wrong OG/canonical even when API env is correct |

**Bottom line:** Staging can run as a separate Render service with separate Neon DB **today**, but only if every Render secret and public URL is manually isolated. The **code and docs still assume one public site (`bidwar.in`)** and will mis-route SEO, email footers, sample templates, and several admin flows unless made environment-aware.

---

## Target architecture (confirmed intent)

| Layer | Production | Staging |
|-------|------------|---------|
| Git branch | `main` | `develop` |
| Render service | Production web service → `main` | Staging web service → `develop` |
| Database | Neon production | Neon staging (separate) |
| Public URL | `https://bidwar.in` (expected) | Staging hostname (e.g. `*.onrender.com` or `staging.bidwar.in`) |

There is **no `NODE_ENV=staging`** (or similar) in the application. Both Render services will almost certainly run `NODE_ENV=production`. Environment identity is **only** distinguishable by injected env vars (`APP_URL`, `DATABASE_URL`, integration keys, etc.).

---

## 1. GitHub Actions and deployment workflows

### 1.1 Workflows in repository

| File | Trigger | Purpose | Environment awareness |
|------|---------|---------|----------------------|
| `.github/workflows/build-electron.yml` | `workflow_dispatch` only | Build & release **BidWar Local** Windows installer | **None** — not tied to `main`/`develop` deploy; uses `GITHUB_TOKEN` for release upload |

**Findings:**

- **No GitHub Action deploys the web app** to Render. Render auto-deploy is configured in the Render dashboard (branch → service), not in this repo.
- **No CI workflow** runs `build:deploy`, tests, or `verify:production` on push/PR.
- **No staging-specific workflow** exists.
- The Electron workflow is unrelated to cloud staging/production parity (desktop artifact only).

### 1.2 In-app GitHub workflow trigger (API)

`artifacts/api-server/src/routes/settings.ts` — `POST /api/auth/admin/builds/trigger`:

- Dispatches workflow via GitHub API with **`ref: "main"` hardcoded** (line ~184).
- Uses `GITHUB_PAT` from environment and `github_owner` / `github_repo` / `github_workflow_file` from DB settings.
- Default workflow file: `build-electron.yml`.

**Must become environment-aware:**

- Workflow dispatch branch (`main` vs `develop`) should be configurable per environment, or derived from an env var (e.g. `GITHUB_DEPLOY_REF`).
- Staging admin UI triggering a `main`-only Electron release is a **cross-environment footgun**.

### 1.3 Post-merge hook

`scripts/post-merge.sh`:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/scripts run migrate
pnpm --filter db push-force
```

Referenced from `.replit` `[postMerge]`. Runs **migrate + `drizzle-kit push --force`** against whatever `DATABASE_URL` is active — no environment guard.

**Risk:** Accidental schema push against production when intended for staging (or vice versa).

---

## 2. Render deployment assumptions

### 2.1 In-repo Render configuration

| Artifact | Present? | Notes |
|----------|----------|-------|
| `render.yaml` | **No** | All Render settings are manual (dashboard) |
| Branch → service mapping | **Not in repo** | Must be configured per Render service |
| Build command | Documented in `RENDER_ENV_VARS.md`, `DEPLOY.md` | Same for all environments |

**Documented build (Render):**

```bash
NODE_ENV=development pnpm install --frozen-lockfile && pnpm run build:deploy
```

**Documented start:**

```bash
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Both production and staging Render services are expected to use **identical** build/start commands; differentiation is **env vars only**.

### 2.2 Host-managed env protection (good)

`lib/db/src/load-app-env.ts` detects managed hosts (`RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `VERCEL`, `REPL_ID`) and **restores dashboard values** for:

- `DATABASE_URL`, `NEON_DATABASE_URL`
- `SESSION_SECRET`, `ADMIN_PASSWORD`, `ADMIN_DATA_PASSWORD`
- `APP_URL`, `APP_DOMAIN`, `APP_PUBLIC_SCHEME`, `NODE_ENV`

This prevents a committed `.env.production` from overriding Render staging/production dashboard config **when those keys are set on the host**.

**Gap:** Keys **not** in `HOST_MANAGED_KEYS` (e.g. `GOOGLE_CLIENT_ID`, `CLOUDINARY_*`, `REDIS_URL`, `GITHUB_PAT`, `CORS_ORIGINS`) can still be loaded from `.env.production` if present in the image/filesystem.

### 2.3 Docker / single-process assumptions

`Dockerfile` bakes:

- `NODE_ENV=production`
- `SERVE_STATIC=true`
- `PORT=3000`

`DEPLOY.md` documents **single Node process** + in-memory SSE registry. Staging must also run **one instance** (or configure shared `REDIS_URL` per environment — never shared *across* environments).

### 2.4 Replit legacy config

`.replit` `[userenv.production]`:

```
APP_DOMAIN = "bidwar.in"
APP_PUBLIC_SCHEME = "https"
```

Assumes production domain only. Not used by Render but shows **single-environment defaults** in repo config.

### 2.5 nginx example

`nginx.conf.example` uses `YOUR_DOMAIN` placeholder — environment-agnostic if substituted per host. SSE block is correct for any domain.

---

## 3. Single-deployment-environment assumptions

### 3.1 No first-class “staging” mode

- `runtime-env.ts` accepts only `NODE_ENV` ∈ `{ production, development, test }`.
- Staging Render services will run as **`production`** from the app’s perspective.
- No `STAGING=true`, `DEPLOY_ENV`, or `RENDER_SERVICE_NAME`-based branching exists in application code.

### 3.2 Documentation and examples

| File | Assumption |
|------|------------|
| `.env.example.example` | Default `APP_DOMAIN=bidwar.in,www.bidwar.in`, `APP_URL=https://bidwar.in` |
| `.env.production.example` | Same production URLs |
| `DEPLOY.md` | Single deploy guide; `bidwar.in` in nginx/certbot examples |
| `RENDER_ENV_VARS.md` | “Minimal Render starter” uses one `onrender.com` host — no staging/prod matrix |
| `scripts/src/verify-production.ts` | Named and documented for production only |
| `DATABASE_GOVERNANCE_ADR.md` | Mentions “production and staging” for **DB governance** but app code does not distinguish |

### 3.3 Database bootstrap on every start

`artifacts/api-server/src/index.ts` calls `ensureCoreSchema(pool)` at startup (`lib/db/src/ensure-schema.ts` — large inline DDL/DML).

- Runs against **whatever `DATABASE_URL` is configured**.
- Same behavior on staging and production; isolation depends entirely on **correct Neon URL per Render service**.

---

## 4. Environment variables — audit matrix

### 4.1 Required at startup (`runtime-env.ts`)

| Variable | Environment-aware mechanism | Staging action |
|----------|---------------------------|----------------|
| `NODE_ENV` | `production` on both Render services | Set `production` on staging too |
| `PORT` | Render-injected | Do not override manually |
| `DATABASE_URL` / `NEON_DATABASE_URL` | Per-service Neon URL | **Must differ** from production |
| `APP_DOMAIN` | Hostname list → CORS + cookie domain | Staging hostname only (no `bidwar.in`) |
| `APP_URL` | Canonical origin; OAuth + links | Staging HTTPS URL |
| `APP_PUBLIC_SCHEME` | `https` in production | `https` on staging |
| `SESSION_SECRET` | Signed cookies/JWT | **Unique per environment** |
| `ADMIN_PASSWORD` | Admin login | **Unique per environment** (recommended) |
| `SERVE_STATIC` | Static frontends | `true` on Render |

### 4.2 Runtime public URL resolution (good pattern)

These modules correctly use `getPublicOrigin()`, `buildPublicUrl()`, or `process.env.APP_URL || getPublicOrigin()`:

- `artifacts/api-server/src/routes/auth.ts` — Google OAuth `redirect_uri`
- `artifacts/api-server/src/routes/google-sheets.ts`, `google-sheets-oauth-callback.ts`
- `artifacts/api-server/src/lib/communication/merge-data-builder.ts`
- `artifacts/api-server/src/lib/communication/event-bridge.ts`
- `artifacts/api-server/src/lib/communication/player-registration-merge-data.ts`
- `artifacts/api-server/src/lib/communication/player-sold-merge-data.ts`
- `artifacts/api-server/src/lib/communication/render-organiser-teams-bundle.ts`
- `artifacts/api-server/src/lib/notifications/notification-service.ts`
- `artifacts/api-server/src/lib/admin-notifications/notification-service.ts`
- `artifacts/api-server/src/routes/comm.ts`, `tournaments.ts`, `teams.ts`, `auction.ts`, `push.ts`

**Inconsistency:** Several call sites read `process.env.APP_URL` directly before falling back to `getPublicOrigin()`. Functionally OK if both match; redundant.

### 4.3 CORS

Built in `runtime-env.ts` → `buildCorsOrigins()`:

1. Explicit `CORS_ORIGINS` (full URLs)
2. Origins from `APP_DOMAIN` + scheme from `APP_URL` / `APP_PUBLIC_SCHEME`
3. `EXTRA_CORS_ORIGINS` — **disabled when `NODE_ENV=production`**

`artifacts/api-server/src/app.ts` applies `cors({ credentials: true })` using `isCorsOriginAllowed()`.

**Staging requirement:** Set `APP_DOMAIN` (and optionally `CORS_ORIGINS`) to **staging host only**. Do not include production domains on staging CORS lists.

### 4.4 Cookies

`artifacts/api-server/src/lib/jwt.ts` and `google-sheets-oauth.ts`:

| Cookie | Name | Domain behavior |
|--------|------|-----------------|
| Auth | `bidwar_auth` | `secure: true` in production; `Domain` = `COOKIE_DOMAIN` or `.{apex}` when `APP_DOMAIN` has multiple hosts |
| OAuth state | `bidwar_oauth` | Same |
| Owner session | `bidwar_owner` | Same |
| Google Sheets OAuth | `bidwar_google_sheets_oauth` | Same |

**Staging risks:**

- If staging `APP_DOMAIN` accidentally includes `bidwar.in` or `www.bidwar.in`, cookies may be scoped to `.bidwar.in` and **collide with production**.
- If `COOKIE_DOMAIN=.bidwar.in` is set on staging, sessions can leak across subdomains/environments.
- Single-host staging (`your-app.onrender.com`) → host-only cookies (no `Domain` attribute) — **correct isolation**.

### 4.5 OAuth callbacks

| Flow | Callback path | URI construction |
|------|---------------|------------------|
| Organizer Google login | `/api/auth/google/callback` | `buildPublicUrl(...)` → `{APP_URL}/api/auth/google/callback` |
| Google Sheets | Same shared callback | `GOOGLE_OAUTH_CALLBACK_PATH` in `google-sheets-oauth-callback.ts` |

Logged at startup: `[bidwar] Google OAuth redirect URI: ...`

**Staging requirement:** Register **separate redirect URI** in Google Cloud Console for staging `APP_URL`. Using production OAuth client without staging URI → `redirect_uri_mismatch`.

`VITE_GOOGLE_SITE_VERIFICATION` in `.env.example` is for Search Console — should be **production-only** or omitted on staging.

### 4.6 Redirects

`artifacts/api-server/src/app.ts`:

- `ENABLE_APP_HOST_REDIRECT` (default **off**)
- When enabled: `CANONICAL_HOST` and `NON_CANONICAL_HOST` are both hardcoded **`"bidwar.in"`** — redirect logic is effectively dead (noted in `DEAD_CODE_REPORT.md`, `TECHNICAL_DEBT_REPORT.md`)

**Must become environment-aware if ever enabled:** derive canonical host from `APP_DOMAIN` / `APP_URL`, not constants.

### 4.7 WebSocket / SSE / public API URLs

| Transport | Client pattern | Environment coupling |
|-----------|----------------|----------------------|
| Auction SSE | Relative `/api/tournaments/:id/auction/events` | **Good** — same-origin |
| Admin notifications SSE | `apiUrl("/auth/admin/admin-notifications/events")` | **Good** — relative |
| Badminton scoring SSE | `EventSource(url, { withCredentials: true })` with API-relative paths | **Good** |
| Owner app SSE | `/api/tournaments/${id}/auction/events` | **Good** |
| `VITE_API_URL` | Used in some badminton pages when set; default `""` (same-origin) | Only needed for split dev |

No hardcoded production SSE/WebSocket URLs in live client code. `DEPLOY.md` correctly states SSE is plain HTTP.

**Redis note:** If `REDIS_URL` is set, auction events pub/sub crosses processes **within that Redis namespace**. Staging and production **must use different `REDIS_URL`** (or leave unset for in-memory on single instance).

### 4.8 Optional integration variables (shared-risk)

Documented in `RENDER_ENV_VARS.md` / `.env.example.example`:

| Variable | Cross-environment risk if shared |
|----------|-------------------------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth redirects; same client needs all URIs registered |
| `CLOUDINARY_*` | Same media namespace (`bidwar/...` folders) |
| `TWILIO_*` | Real WhatsApp/SMS; webhooks point to one URL |
| `BULKSMS_*` | Real SMS from staging |
| `RESEND_API_KEY` / `EMAIL_ENABLED` / `MAIL_FROM` | Real email; `notifications@bidwar.in` sender |
| `VAPID_*` | Push subscriptions; `mailto:admin@bidwar.app` hardcoded in `push.ts` |
| `GITHUB_PAT` | Triggers workflows on `main` |
| `REDIS_URL` | SSE/locks shared across services using same URL |
| `TURNSTILE_*` | CAPTCHA site key may be domain-bound |

---

## 5. Hardcoded production URLs (`bidwar.in`)

### 5.1 Critical — affects crawlers, SEO, and social previews

These **ignore `APP_URL`** at runtime:

| Location | Hardcoded value | Impact on staging |
|----------|-----------------|-------------------|
| `artifacts/auction-platform/index.html` | `canonical`, `og:url`, JSON-LD `url`/`logo` → `https://bidwar.in` | Built into static bundle; wrong meta on staging |
| `artifacts/api-server/src/lib/page-meta.ts` | `BASE_URL = "https://bidwar.in"` | All server-injected marketing meta |
| `artifacts/api-server/src/lib/seo-route-policy.ts` | Sitemaps use `BASE_URL`; `buildRobotsTxt(host = "bidwar.in")` | Sitemap `<loc>` point to production |
| `artifacts/api-server/src/lib/register-seo-routes.ts` | `registerSeoRoutes(app, "bidwar.in")` via `CANONICAL_HOST` in `app.ts` | `robots.txt` Sitemap line uses staging host param but sitemap bodies use `BASE_URL` |
| `artifacts/api-server/src/lib/cricket-page-meta.ts` | `BASE_URL = "https://bidwar.in"` | Cricket public page OG/canonical |
| `artifacts/api-server/src/lib/academy-public-service.ts` | `BASE = "https://bidwar.in"` | Academy sitemap entries |
| `lib/blog-data/src/index.ts` | `BLOG_BASE_URL = "https://bidwar.in/blog"` | Blog URLs in sitemaps/meta |
| `lib/api-base/src/branding-assets.ts` | `PLATFORM_BASE_URL = "https://bidwar.in"` | Default absolute logo URLs |
| `artifacts/api-server/src/lib/branding-manifest.ts` | `PLATFORM_BASE_URL = "https://bidwar.in"` | PWA manifest icon absolute URLs |

### 5.2 Frontend marketing pages (client bundle)

| Location | Notes |
|----------|-------|
| `artifacts/auction-platform/src/pages/seo-sport-landing.tsx` | Many `canonical: "https://bidwar.in/..."` per sport |
| `artifacts/auction-platform/src/components/schema-markup.tsx` | JSON-LD URLs |
| `artifacts/auction-platform/src/pages/academy/index.tsx`, `lesson.tsx` | Canonical URLs |
| `artifacts/auction-platform/src/pages/blog/*.tsx` | Canonical URLs |
| `artifacts/auction-platform/src/hooks/use-academy-json-ld.ts` | `BASE = "https://bidwar.in"` |
| `artifacts/auction-platform/src/components/academy/academy-schema.tsx` | `BASE = "https://bidwar.in"` |
| `artifacts/auction-platform/src/components/blog/blog-schema.tsx` | Blog schema URLs |

### 5.3 Email / communication templates

| Location | Hardcoded | Notes |
|----------|-----------|-------|
| `artifacts/api-server/src/lib/notifications/templates/email-branding.ts` | `BIDWAR_WEBSITE_URL = "https://bidwar.in/"` | Email footers |
| `artifacts/api-server/src/lib/notifications/templates/base-layout.ts` | Default `appUrl ?? "https://bidwar.in"` | Fallback when caller omits URL |
| `artifacts/api-server/src/lib/communication/player-registration-email-template.ts` | Links to `https://bidwar.in` | Registration emails |
| `artifacts/api-server/src/lib/communication/player-sold-email-template.ts` | `https://bidwar.in`, `support@bidwar.in` | Sold-player emails |
| `artifacts/api-server/src/lib/communication/seed-templates.ts` | Default asset `https://bidwar.in/bidwar-primary-logo.png` | Seeded on **every** DB (including staging) |
| `artifacts/api-server/src/lib/communication/merge-variables.ts` | `buildSampleMergeData()` uses `https://bidwar.in` | Admin template preview only |

### 5.4 UI copy / branding (lower risk for isolation, wrong for staging UX)

| Location | Example |
|----------|---------|
| `artifacts/auction-platform/src/components/powered-by-bidwar-link.tsx` | `BIDWAR_HOME_URL = "https://bidwar.in/"` |
| `artifacts/auction-platform/src/components/badminton/bidwar-badminton-branding.tsx` | Same |
| `artifacts/auction-platform/src/components/broadcast/director/frame-builder.ts` | `websiteLabel: "bidwar.in"` |
| `artifacts/auction-platform/src/pages/landing.tsx` | Footer links to `bidwar.in` |
| `artifacts/api-server/src/routes/webhooks.ts` | WhatsApp bot messages mention `bidwar.in` |

### 5.5 Tests referencing production URL (acceptable but document)

Many `__tests__` files use `https://bidwar.in` as fixtures — not runtime risk.

### 5.6 Patterns that are already environment-safe

| Pattern | Example |
|---------|---------|
| `window.location.origin` | `players.tsx` registration share URL, `teams.tsx` owner join link, broadcast URLs |
| `getPublicOrigin()` / `buildPublicUrl()` | OAuth, most SMS/email merge data |
| Relative `/api/...` | SSE, fetch clients in production same-origin mode |

---

## 6. Cross-environment connection risks

### 6.1 High severity

| Risk | Mechanism | Mitigation (configuration + future code) |
|------|-----------|------------------------------------------|
| **Wrong database** | Same `DATABASE_URL` on staging Render as production | Separate Neon URLs; verify in Render dashboard |
| **Session forgery / shared sessions** | Same `SESSION_SECRET` on both environments | Unique secrets per Render service |
| **Cookie domain collision** | Staging `APP_DOMAIN` includes `bidwar.in` or `COOKIE_DOMAIN=.bidwar.in` | Staging host only; omit `COOKIE_DOMAIN` on `onrender.com` |
| **OAuth token exchange on wrong host** | Shared Google client; staging `APP_URL` not registered | Separate OAuth client or add staging redirect URIs |
| **Real customer communications** | Shared Twilio/BulkSMS/Resend keys | Staging-specific keys or `EMAIL_ENABLED=false` + stub modes |
| **Redis cross-talk** | Shared `REDIS_URL` | Separate Redis per environment or unset on single-instance staging |
| **Cloudinary media pollution** | Shared account; folders `bidwar/workbook/*`, `bidwar/buzz/*`, etc. | Separate Cloudinary sub-account or prefix per env |
| **Twilio webhooks** | Inbound webhooks configured to production URL | Staging needs separate Twilio sandbox or disabled webhooks |
| **Google indexing staging** | `robots.txt` allows `/`; sitemaps list `bidwar.in` URLs | Block crawlers on staging; fix sitemap `BASE_URL` |
| **Admin build trigger → `main`** | `settings.ts` hardcodes `ref: "main"` | Env-specific ref or disable on staging |

### 6.2 Medium severity

| Risk | Mechanism |
|------|-----------|
| **`clone-tournament-from-prod.ts`** | Defaults `PRODUCTION_DATABASE_URL` to `.env` `DATABASE_URL`; target defaults to same if `LOCAL_DATABASE_URL` unset |
| **`post-merge.sh` / `db:setup:prod`** | Applies migrations to whichever DB URL is loaded |
| **`verify:production`** | No `verify:staging`; naming implies prod; example URL `https://bidwar.in` |
| **Seeded comm templates** | `seedCommunicationDefaults()` writes `bidwar.in` logo URL into **staging DB** |
| **VAPID subject** | `mailto:admin@bidwar.app` hardcoded — not environment-specific |
| **`.env.production` in image** | If committed/copied, non-host-managed keys may bleed into container |

### 6.3 Low severity

| Risk | Mechanism |
|------|-----------|
| Marketing footer links to production | UX confusion, not data leak |
| `scripts/src/seed-demo.ts` uses `admin@bidwar.in` | Dev seed only |
| Replit `APP_DOMAIN=bidwar.in` | Legacy hosting config |

---

## 7. Build-time vs runtime configuration

| Concern | Build-time (Vite) | Runtime (Node) |
|---------|-------------------|----------------|
| API base URL | Empty / relative in production (`VITE_API_URL` optional) | N/A |
| Google site verification | `VITE_GOOGLE_SITE_VERIFICATION` baked into client | — |
| Homepage OG tags | `index.html` static `bidwar.in` | `html-meta-injector` overrides **some** routes from `page-meta.ts` — but `page-meta.BASE_URL` is still hardcoded |
| Owner app base | `/owner-app/` in production build | Served by same host |
| `BASE_PATH` | Build env | `/` in production |

**Implication:** Even with correct Render staging env vars, **built `index.html` and client SEO pages** may still advertise `bidwar.in` until code reads `APP_URL` or build-time staging env injection is added.

---

## 8. Local development isolation (reference)

`scripts/dev.mjs` **intentionally overrides** production `APP_*` from `.env`:

```javascript
// Local dev public origin — always overrides production APP_* from .env
APP_URL: `http://localhost:${frontendPort}`,
APP_DOMAIN: `localhost:${frontendPort}`,
```

This pattern is **good** for dev/prod separation and should be mirrored conceptually for staging (host dashboard overrides, never share prod `.env` values).

---

## 9. Complete checklist — what must become environment-aware

### 9.1 Render / infrastructure (no code — dashboard)

- [ ] Staging service connected to `develop` branch; production to `main`
- [ ] Distinct `DATABASE_URL` / `NEON_DATABASE_URL` per service
- [ ] Distinct `APP_URL` and `APP_DOMAIN` (staging hostname only)
- [ ] Distinct `SESSION_SECRET`, `ADMIN_PASSWORD`
- [ ] Do **not** set `COOKIE_DOMAIN=.bidwar.in` on staging unless using a dedicated staging subdomain under `bidwar.in`
- [ ] Separate or disabled: `REDIS_URL`, `GITHUB_PAT`, messaging keys, `CLOUDINARY_*`
- [ ] Google OAuth: staging redirect URI registered or separate OAuth client
- [ ] Twilio webhooks: point to staging URL or disable on staging
- [ ] Consider `robots.txt` disallow-all on staging (until code supports env-based SEO)

### 9.2 Code — priority P0 (wrong URLs / crawler / auth)

| Item | File(s) |
|------|---------|
| Replace `BASE_URL` / `PLATFORM_BASE_URL` constants with `getPublicOrigin()` or build-time inject | `page-meta.ts`, `seo-route-policy.ts`, `cricket-page-meta.ts`, `academy-public-service.ts`, `branding-assets.ts`, `branding-manifest.ts`, `blog-data/index.ts` |
| Pass runtime host to SEO routes | `app.ts` (`registerSeoRoutes`), `register-seo-routes.ts` |
| Build `index.html` meta from env or inject only server-side | `artifacts/auction-platform/index.html` |
| Sport landing canonicals | `seo-sport-landing.tsx` |
| Email template fallbacks | `email-branding.ts`, `base-layout.ts`, registration/sold templates |
| Communication seed assets | `seed-templates.ts` |
| GitHub workflow dispatch ref | `settings.ts` |
| Host redirect constants | `app.ts` (`CANONICAL_HOST`) |

### 9.3 Code — priority P1 (UX / admin / integrations)

| Item | File(s) |
|------|---------|
| Client schema components | `schema-markup.tsx`, `academy-schema.tsx`, `blog-schema.tsx`, `use-academy-json-ld.ts` |
| Blog/academy page canonicals | `pages/blog/*`, `pages/academy/*` |
| Powered-by / branding links | `powered-by-bidwar-link.tsx`, `bidwar-badminton-branding.tsx` |
| VAPID mailto subject | `push.ts` |
| `buildSampleMergeData()` | `merge-variables.ts` |
| WhatsApp bot copy | `webhooks.ts` (optional: env-based app URL in messages) |

### 9.4 Tooling / docs — priority P1

| Item | File(s) |
|------|---------|
| Add `verify:staging` or env-parametric verify script | `scripts/src/verify-production.ts` |
| Guard `clone-tournament-from-prod.ts` against equal source/target URLs | `scripts/src/clone-tournament-from-prod.ts` |
| Document staging env matrix | `RENDER_ENV_VARS.md`, `DEPLOY.md`, `.env.example.example` |
| Add `render.yaml` or `docs/STAGING_RENDER_SETUP.md` (optional) | New doc / IaC |
| Rename or split `.env.production.example` vs staging example | `.env.production.example` |
| Review `post-merge.sh` for environment safety | `scripts/post-merge.sh` |

### 9.4 GitHub Actions — priority P2

| Item | Notes |
|------|-------|
| Optional CI on `develop` / `main` | `pnpm run build:deploy`, smoke test |
| Branch-aware Electron workflow dispatch | If staging admins should not release Local builds |
| No workflow currently deploys Render | Confirm dashboard branch settings |

---

## 10. Suggested staging environment variable template

Use on **Render staging** (values are placeholders):

```env
NODE_ENV=production
SERVE_STATIC=true
# DATABASE_URL — Neon staging branch only
APP_DOMAIN=<staging-host>.onrender.com
APP_URL=https://<staging-host>.onrender.com
APP_PUBLIC_SCHEME=https
SESSION_SECRET=<unique-staging-secret>
ADMIN_PASSWORD=<unique-staging-password>

# Recommended staging isolation
EMAIL_ENABLED=false
# Or separate RESEND_API_KEY + MAIL_FROM for staging-only sender

# Omit or use staging-only credentials:
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
# CLOUDINARY_*
# TWILIO_* / BULKSMS_*
# VAPID_*
# GITHUB_PAT
# REDIS_URL
# CORS_ORIGINS — only if needed beyond APP_DOMAIN

SCORING=true
```

**Do not copy production values** for secrets or integration keys unless intentionally shared (generally discouraged).

---

## 11. Files reviewed (index)

### Workflows & deploy

- `.github/workflows/build-electron.yml`
- `Dockerfile`
- `DEPLOY.md`
- `RENDER_ENV_VARS.md`
- `.replit`
- `artifacts/api-server/.replit-artifact/artifact.toml`
- `scripts/post-merge.sh`
- `package.json` (`build:deploy`, `start:prod`, `verify:production`)

### Runtime config

- `artifacts/api-server/src/lib/bootstrap.ts`
- `artifacts/api-server/src/lib/runtime-env.ts`
- `lib/db/src/load-app-env.ts`
- `lib/api-base/src/dev-cors.ts`
- `artifacts/api-server/src/app.ts`
- `artifacts/api-server/src/lib/jwt.ts`
- `artifacts/api-server/src/lib/google-sheets-oauth.ts`
- `artifacts/api-server/src/lib/redis.ts`

### Auth & integrations

- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/routes/google-sheets.ts`
- `artifacts/api-server/src/routes/settings.ts`
- `artifacts/api-server/src/routes/push.ts`
- `artifacts/api-server/src/routes/webhooks.ts`

### SEO & static meta

- `artifacts/auction-platform/index.html`
- `artifacts/api-server/src/lib/page-meta.ts`
- `artifacts/api-server/src/lib/seo-route-policy.ts`
- `artifacts/api-server/src/lib/register-seo-routes.ts`

### Client realtime

- `artifacts/auction-platform/src/hooks/use-auction-socket.ts`
- `artifacts/owner-app/src/hooks/use-auction-socket.ts`

### Operational scripts

- `scripts/dev.mjs`
- `scripts/src/verify-production.ts`
- `scripts/src/clone-tournament-from-prod.ts`

### Env examples

- `.env.example.example`
- `.env.production.example`

---

## 12. Conclusion

The project is **deployable to two Render services with two Neon databases today** using existing build commands and `runtime-env.ts`, provided Render dashboard configuration is strictly isolated.

The repository is **not yet workflow-ready** in the sense of:

1. **Code-level URL identity** — dozens of `bidwar.in` constants bypass `APP_URL`
2. **Automation** — no branch-aware CI; admin API triggers `main` workflows
3. **Operational clarity** — scripts and docs speak “production” only
4. **Integration defaults** — third-party services assume one live site

Addressing section **9.2 (P0)** before exposing staging publicly will prevent SEO contamination, OAuth failures, and accidental production hyperlinks in emails. Configuration isolation (section **9.1**) must be enforced in Render regardless of code changes.

---

*Audit performed without modifying application logic. Next step: implement environment-aware changes per section 9, starting with P0 items.*
