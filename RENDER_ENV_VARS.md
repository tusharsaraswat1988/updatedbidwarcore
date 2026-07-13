# Render Deployment — Environment Variables

Configure these under **Environment** in each Render Web Service dashboard.

BidWar runs **two Render services** from one repository:

| Service | Git branch | Neon database | Docs |
|---------|------------|---------------|------|
| **Staging** | `develop` | Staging | [Staging template](#staging-render-service-develop-branch) |
| **Production** | `main` | Production | [Production template](#production-render-service-main-branch) |

**Never copy production secrets into staging** (or vice versa). See [docs/STAGING_ENVIRONMENT_AUDIT.md](./docs/STAGING_ENVIRONMENT_AUDIT.md).

Render injects `PORT` automatically; you do not need to set it unless overriding.

**Release workflow:** [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) · **Runbook:** [RUNBOOK.md](./RUNBOOK.md) · **Checklists:** [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) · [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)

**Auction rule:** Do not deploy **production** during a live auction. See [Auction Release Safety](./RELEASE_PROCESS.md#auction-release-safety).

Build command (copy exactly into Render **Settings → Build Command** for **both** services):

```bash
NODE_ENV=development pnpm install --frozen-lockfile && pnpm run build:deploy
```

Why two parts:

1. **`NODE_ENV=development` during install** — Render sets `NODE_ENV=production` in your env vars, which makes `pnpm install` skip devDependencies (`esbuild`, `vite`, etc.). Overriding to `development` for install only fixes that.
2. **`build:deploy`** — compiles the app (API + frontends) **without** `tsc --build` typecheck, which needs `@types/node` / `@types/pg` and fails on hosts when dev deps are omitted.

Do **not** use `pnpm run build` on Render — it runs typecheck first and will fail with the same `@types/node` / `pg` errors you saw.

Start command:

```bash
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

---

## Staging Render service (`develop` branch)

Use on the **staging** web service only. Staging auto-deploys when commits merge to `develop`.

```env
NODE_ENV=production
BIDWAR_ENV=staging
SERVE_STATIC=true

# Neon STAGING ONLY — must NOT be production (jolly-tree / ep-late-math-aohd4iep)
# Expected project: BidWar Staging (old-art-20161659)
# Expected host contains: ep-long-sky-aorboyzr
DATABASE_URL=postgresql://...@ep-long-sky-aorboyzr-pooler....neon.tech/neondb?sslmode=require

# Staging public URL (Render default or custom staging subdomain)
# Hostname must include "staging" (or set BIDWAR_ENV=staging) so schema auto-heal stays on.
APP_DOMAIN=bidwar-staging.onrender.com
APP_URL=https://bidwar-staging.onrender.com
APP_PUBLIC_SCHEME=https

# Unique to staging — generate fresh values
SESSION_SECRET=<openssl rand -hex 32>
ADMIN_PASSWORD=<staging-only-password>

SCORING=true
LOG_LEVEL=info
```

**Verify before deploy:** In Render → staging service → Environment, confirm `DATABASE_URL` host contains `ep-long-sky-aorboyzr` (or your current staging pooler) and does **not** contain `ep-late-math-aohd4iep`. Startup fails closed if staging points at production Neon.

### Staging integration guidance

| Integration | Recommendation |
|-------------|----------------|
| `EMAIL_ENABLED` | `false` or separate Resend sandbox key |
| `GOOGLE_CLIENT_ID` | Separate OAuth client with **staging** callback URI registered |
| `CLOUDINARY_*` | Separate folder prefix or sub-account |
| `TWILIO_*` / `BULKSMS_*` | Sandbox / test credentials only |
| `VAPID_*` | Staging-only keys or omit (push disabled) |
| `GITHUB_PAT` | Omit on staging (avoids triggering `main` workflows) |
| `REDIS_URL` | Staging-only instance, or omit for single-node in-memory SSE |
| `CORS_ORIGINS` | Usually omit — derived from `APP_DOMAIN` |

Validate with [STAGING_CHECKLIST.md](./STAGING_CHECKLIST.md) before promoting to `main`.

---

## Production Render service (`main` branch)

Use on the **production** web service only. Production auto-deploys when commits merge to `main`.

```env
NODE_ENV=production
BIDWAR_ENV=production
SERVE_STATIC=true

# Neon PRODUCTION ONLY — must NOT be staging (old-art / ep-long-sky-aorboyzr)
# Expected project: Bidwar Production (jolly-tree-42208228)
# Expected host contains: ep-late-math-aohd4iep
DATABASE_URL=postgresql://...@ep-late-math-aohd4iep-pooler....neon.tech/neondb?sslmode=require

# Production public site
APP_DOMAIN=bidwar.in,www.bidwar.in
APP_URL=https://bidwar.in
APP_PUBLIC_SCHEME=https

SESSION_SECRET=<unique-production-secret>
ADMIN_PASSWORD=<strong-production-password>

# Do NOT set SCHEMA_AUTO_HEAL=true on production
SCORING=true
LOG_LEVEL=info
```

**Verify before deploy:** In Render → production service → Environment, confirm `DATABASE_URL` host contains `ep-late-math-aohd4iep` and does **not** contain `ep-long-sky-aorboyzr`. Production is validate-only; auto-heal cannot mutate this database.

Add production Cloudinary, Google OAuth, Twilio, VAPID, BulkSMS, and Resend variables when those features are live. Register OAuth redirect URI: `https://bidwar.in/api/auth/google/callback`.

Verify with [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) after every deploy.

---

## Variable reference (both environments)

### Required

| Name | Required | Example format | Source | What breaks if missing |
|------|----------|----------------|--------|------------------------|
| `NODE_ENV` | Yes | `production` | Dashboard / secret | API exits at startup: "NODE_ENV is required". Safe to set on Render; use `--prod=false` in the **build command** (see above) so devDependencies still install at build time. |
| `DATABASE_URL` | Yes* | `postgresql://user:pass@host/db?sslmode=require` | Secret (Neon/Render Postgres) | API exits: "DATABASE_URL or NEON_DATABASE_URL is required" |
| `APP_DOMAIN` | Yes | `your-app.onrender.com` or `bidwar.in,www.bidwar.in` | Dashboard | API exits: "APP_DOMAIN is required"; CORS and public URLs break |
| `APP_URL` | Yes | `https://bidwar.in` | Dashboard | API exits in production without it; OAuth redirect_uri and email links derive from this |
| `APP_PUBLIC_SCHEME` | Yes (prod) | `https` | Dashboard | Legacy fallback when APP_URL unset; must not be `http` in prod |
| `SESSION_SECRET` | Yes | 64-char hex (`openssl rand -hex 32`) | Secret | API exits: session secret missing or &lt; 32 chars; auth breaks |
| `ADMIN_PASSWORD` | Yes | Strong password string | Secret | API exits: "ADMIN_PASSWORD is required"; admin login disabled |
| `SERVE_STATIC` | Yes | `true` | Dashboard | Without build + static serving, UI returns 404; defaults to `true` in prod |
| `PORT` | No | *(leave unset on Render)* | **Injected by Render** | Render assigns the port automatically. **Do not set `PORT=3000`** in the dashboard — it can cause "no open ports detected". The app reads `process.env.PORT` at startup. |

\* `NEON_DATABASE_URL` is an accepted alias for `DATABASE_URL` (takes priority when both are set).

---

### Optional — recommended for production features

| Name | Required | Example format | Source | What breaks if missing |
|------|----------|----------------|--------|------------------------|
| `NEON_DATABASE_URL` | No | Same as `DATABASE_URL` | Secret | Falls back to `DATABASE_URL` |
| `CORS_ORIGINS` | No | `https://bidwar.in,https://www.bidwar.in` | Dashboard | Origins derived from `APP_DOMAIN` + scheme instead |
| `ADMIN_DATA_PASSWORD` | No | Strong password | Secret | Export-only admin login unavailable |
| `LOG_LEVEL` | No | `info` | Dashboard | Defaults to `info` |
| `CLOUDINARY_CLOUD_NAME` | No | `dxxxxxxxx` | Secret | Image upload routes return 503 |
| `CLOUDINARY_API_KEY` | No | Numeric string | Secret | Image upload routes return 503 |
| `CLOUDINARY_API_SECRET` | No | Alphanumeric secret | Secret | Image upload routes return 503 |
| `GOOGLE_CLIENT_ID` | No | `xxxx.apps.googleusercontent.com` | Secret | Google OAuth login disabled |
| `GOOGLE_CLIENT_SECRET` | No | `GOCSPX-...` | Secret | Google OAuth callback fails |
| `VAPID_PUBLIC_KEY` | No | Base64 URL-safe key | Generated (`npx web-push generate-vapid-keys`) | Web push subscribe/send disabled |
| `VAPID_PRIVATE_KEY` | No | Base64 URL-safe key | Generated (pair with public key) | Web push subscribe/send disabled |
| `BULKSMS_KEY` | No | API key string | Secret | SMS sends in stub/demo mode |
| `BULKSMS_PASSWORD` | No | API key string | Secret | Alias for `BULKSMS_KEY` |
| `BULKSMS_SENDER` | No | `BIDWRR` | Dashboard | SMS sender ID missing in gateway calls |
| `BULKSMS_TEMPLATE_ID` | No | UUID-like template ID | Dashboard | OTP SMS template missing |
| `BULKSMS_PLAYER_SOLD_TEMPLATE_ID` | No | Template ID | Dashboard | Player-sold SMS uses empty template |
| `BULKSMS_TEAM_OWNER_TEMPLATE_ID` | No | Template ID | Dashboard | Team-owner SMS uses empty template |
| `BULKSMS_VIEWER_LINK_TEMPLATE_ID` | No | Template ID | Dashboard | Viewer-link SMS uses empty template |
| `TWILIO_ACCOUNT_SID` | No | `ACxxxxxxxx...` | Secret | WhatsApp sends in stub mode |
| `TWILIO_AUTH_TOKEN` | No | Auth token string | Secret | WhatsApp stub mode; webhook signature check skipped |
| `TWILIO_WHATSAPP_FROM` | No | `whatsapp:+14155238886` | Dashboard | WhatsApp sends fail |
| `TWILIO_WA_TEMPLATES` | No | `tpl_a,tpl_b` | Dashboard | WhatsApp template list empty in comm UI |
| `EMAIL_ENABLED` | No | `true` | Dashboard | Email notifications run in stub mode (logged, not sent) |
| `RESEND_API_KEY` | No | `re_...` | Secret | Resend API calls fail; emails stubbed when `EMAIL_ENABLED=true` |
| `MAIL_FROM` | No | `BidWar <notifications@bidwar.in>` | Dashboard | Resend rejects sends without verified sender |
| `SMS_OTP_ENABLED` | No | `true` | Dashboard | OTP uses default Twilio/BulkSMS path (not SMS-only mode) |
| `GITHUB_PAT` | No | `ghp_...` | Secret | GitHub workflow trigger in settings returns 500 |
| `RATE_LIMIT_DISABLED` | No | `false` | Dashboard | Rate limiting enabled (default) |
| `RATE_LIMIT_GLOBAL_MAX` | No | `2500` | Dashboard | Defaults to 2500 req/window |
| `RATE_LIMIT_AUTH_MAX` | No | `100` | Dashboard | Defaults to 100 (500 in dev) |
| `RATE_LIMIT_OTP_SEND_MAX` | No | `3` | Dashboard | Defaults to 3 |
| `RATE_LIMIT_OTP_VERIFY_MAX` | No | `10` | Dashboard | Defaults to 10 |
| `RATE_LIMIT_EXPORT_MAX` | No | `5` | Dashboard | Defaults to 5 |
| `RATE_LIMIT_CHEER_MAX` | No | `30` | Dashboard | Defaults to 30 |
| `RATE_LIMIT_PUSH_SUBSCRIBE_MAX` | No | `5` | Dashboard | Defaults to 5 |
| `RATE_LIMIT_OWNER_LOOKUP_MAX` | No | `15` | Dashboard | Defaults to 15 |
| `SCORING` | No | `true` | Dashboard | Sport scoring modules; when unset/false, scoring routes return 404. Legacy alias: `ENABLE_BADMINTON` when `SCORING` unset. |

---

### Do not set on Render

| Name | Why |
|------|-----|
| `PORT=3000` (manual override) | Let Render inject `PORT` — overriding it often causes port scan timeout |
| `BYPASS_OTP=true` | Startup fails in production |
| `EXTRA_CORS_ORIGINS` | Development-only CORS helper |
| `API_PORT`, `FRONTEND_PORT`, `WEB_PORT`, `OWNER_APP_PORT` | Split-dev Vite ports only |
| `API_DEV_PROXY_TARGET`, `VITE_DEV_API_TARGET` | Local Vite proxy only |
| `OWNER_APP_DEV_PROXY_TARGET`, `VITE_DEV_OWNER_APP_TARGET` | Local Vite proxy only |
| `VERIFY_*` | Local/production smoke-test scripts only |
| `BASE_PATH` | Build-time Vite setting; production uses `/` and `/owner-app/` |
| `DB_PATH`, `CLOUD_BASE_URL` | bidwar-local Electron app only |
| `NODE_VERSION` | Set Node version in Render **Environment** dropdown, not app code |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Not referenced in codebase (use `GITHUB_PAT`) |
| `TWILIO_VERIFY_SERVICE_SID` | Not referenced in codebase (removed from `.env.example`) |

---

## Minimal starter sets (legacy quick reference)

Use the full [staging](#staging-render-service-develop-branch) and [production](#production-render-service-main-branch) templates above. Minimal sets:

**Staging:**

```env
NODE_ENV=production
BIDWAR_ENV=staging
SERVE_STATIC=true
DATABASE_URL=postgresql://...   # Neon staging
APP_DOMAIN=your-staging.onrender.com
APP_URL=https://your-staging.onrender.com
APP_PUBLIC_SCHEME=https
SESSION_SECRET=<openssl rand -hex 32>
ADMIN_PASSWORD=<staging-password>
```

**Production:**

```env
NODE_ENV=production
SERVE_STATIC=true
DATABASE_URL=postgresql://...   # Neon production
APP_DOMAIN=bidwar.in,www.bidwar.in
APP_URL=https://bidwar.in
APP_PUBLIC_SCHEME=https
SESSION_SECRET=<openssl rand -hex 32>
ADMIN_PASSWORD=<strong-password>
```

Add Cloudinary, Google OAuth, Twilio, VAPID, and BulkSMS variables when you need those features on the target environment.
