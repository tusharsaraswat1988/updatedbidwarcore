# BidWar Build Report

> Generated: July 2026 — Read-only audit.

---

## 1. Build System Overview

BidWar uses **pnpm v9.15.0** as the package manager in a workspace configuration. The build pipeline produces:
1. `artifacts/api-server/dist/index.mjs` — Express API server (esbuild bundle)
2. `artifacts/auction-platform/dist/` — Main SPA (Vite client + SSR)
3. `artifacts/owner-app/dist/` — Owner PWA (Vite)
4. `artifacts/scoring-app/dist/` — Scoring shell (Vite)
5. `artifacts/bidwar-local/dist*` — Electron app (esbuild + Electron builder)

---

## 2. Build Commands

| Command | Purpose | Used when |
|---------|---------|-----------|
| `pnpm run build` | Typecheck all + build all | Local full builds |
| `pnpm run build:deploy` | Build all without typecheck | Cloud deploys (Render/Railway) |
| `pnpm run build:prod` | Install + build:deploy | Full production build |
| `pnpm run typecheck:libs` | Type-check `lib/` packages only | CI/local |
| `pnpm run typecheck` | All typechecks | Full validation |
| `pnpm run start:prod` | Start production server | After build |

---

## 3. Build Pipeline (compile chain)

```
pnpm run build
│
├── pnpm run typecheck:libs         (tsc --build for lib/ packages)
│   └── Checks: db, db-local, api-client-react, api-zod, scoring-core, cheer-presets
│
├── pnpm run typecheck              (recursive for artifacts/ + scripts)
│   ├── api-server tsc
│   ├── auction-platform tsc
│   ├── owner-app tsc
│   ├── scoring-app tsc
│   └── scripts tsc
│
└── pnpm run build:deploy
    │
    ├── pnpm -r --if-present run build  (builds ALL workspace packages)
    │   ├── @workspace/db-local          (tsc -b)
    │   ├── @workspace/api-server        (esbuild build.mjs → dist/index.mjs)
    │   ├── @workspace/auction-platform  (Vite client + Vite SSR)
    │   ├── @workspace/owner-app         (Vite)
    │   ├── @workspace/scoring-app       (Vite)
    │   ├── @workspace/mockup-sandbox    ⚠️ Dev-only — included wastefully
    │   └── @workspace/bidwar-local      ⚠️ Electron — included wastefully
    │       └── copy-frontend.mjs rebuilds auction-platform + owner-app again ⚠️
    │
    └── node scripts/setup-playwright-browsers.mjs
        └── Installs Chromium for Buzz Studio export
```

**Waste on cloud deployments:**
- `mockup-sandbox` builds but is never served
- `bidwar-local` builds Electron (unused) + re-builds auction-platform + owner-app (already built above)

---

## 4. Individual App Build Configs

### 4.1 api-server (esbuild)

**File:** `artifacts/api-server/build.mjs`

| Setting | Value |
|---------|-------|
| Entry | `src/index.ts` |
| Output | `dist/index.mjs` |
| Format | ESM |
| Platform | Node |
| Target | Node 22 |
| Source maps | Linked |
| Minification | No (production Node apps rarely need it) |
| Bundle | Yes (inline all non-external deps) |

**External packages (keeps out of bundle):**
`sharp`, `playwright-core`, `@playwright/browser-chromium`, `cloudinary`, `@aws-sdk/*`, `nodemailer`, `pino`, `express`, `pg`, `@google-cloud/*`, `adm-zip`, `xlsx`, `better-sqlite3`, `@libsql/client`, all native Node modules.

**Technical debt:** External list is very long and may include packages no longer in dependencies.

---

### 4.2 auction-platform (Vite 7)

**File:** `artifacts/auction-platform/vite.config.ts`

**Client build:**

| Setting | Value |
|---------|-------|
| Output | `dist/public/` |
| Minification | esbuild |
| Source maps | Disabled |
| Compression | Brotli + Gzip (vite-plugin-compression2) |
| Tree-shaking | Rollup |
| CSS | @tailwindcss/vite |

**Manual chunks (vendor splitting):**

| Chunk | Libraries |
|-------|-----------|
| `vendor-react` | react, react-dom |
| `vendor-motion` | framer-motion |
| `vendor-query` | @tanstack/react-query |
| `vendor-charts` | recharts |
| `vendor-radix` | All @radix-ui/* packages |
| `vendor-lucide` | lucide-react |
| `vendor-router` | wouter |
| `academy-*` | Academy page chunks |

**Dev server:**
- Port: `FRONTEND_PORT` (default 3000)
- Proxies: `/api` → api-server, `/owner-app` → owner-app dev, `/scoring-app` → scoring-app dev
- `ANALYZE=true` → bundle visualizer

**SSR build:**

**File:** `artifacts/auction-platform/vite.config.ssr.ts`

| Setting | Value |
|---------|-------|
| Entry | `src/server-render/entry-server.tsx` |
| Output | `dist/server/entry-server.js` |
| Format | ESM for Node |
| Compression | None (server bundle) |

---

### 4.3 owner-app (Vite 7)

**File:** `artifacts/owner-app/vite.config.ts`

| Setting | Value |
|---------|-------|
| Output | `dist/` |
| PWA | vite-plugin-pwa (injectManifest, service worker) |
| Compression | **None** ⚠️ |
| Manual chunks | **None** ⚠️ |
| Base path | `/owner-app/` |
| Dev proxy | `/api` → api-server |

---

### 4.4 scoring-app (Vite 7)

**File:** `artifacts/scoring-app/vite.config.ts`

| Setting | Value |
|---------|-------|
| Output | `dist/` |
| Alias `@` | `../auction-platform/src` (entire auction-platform source) |
| Compression | **None** ⚠️ |
| Manual chunks | **None** ⚠️ |
| Base path | `/scoring-app/` |
| `fs.strict` | `false` (allows cross-app imports) |

---

### 4.5 bidwar-local (esbuild + Electron)

| Step | File | Output |
|------|------|--------|
| Electron main | `build-electron.mjs` | `dist/main.cjs`, `dist/preload.cjs` |
| Express server | `build-server.mjs` | `dist-server/index.js` |
| Frontend copy | `scripts/copy-frontend.mjs` | Runs full builds of auction-platform + owner-app |

---

## 5. Docker Build

**File:** `Dockerfile`

### Multi-stage build

**Stage 1 (builder):** `node:22-bookworm-slim`
- Install pnpm via corepack
- `pnpm install --frozen-lockfile --prod=false`
- `pnpm run build` (full typecheck + build)
- Install Playwright browsers

**Stage 2 (runtime):** `node:22-bookworm-slim`
- Copy runtime `node_modules` (via `pnpm deploy --prod`)
- Copy built `dist/` directories
- Copy Playwright browsers
- Install system deps for Playwright (Chromium system libraries)

**Environment baked into image:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `SERVE_STATIC` | `true` |
| `CREATIVE_RENDER_WORKER_ENABLED` | `true` |
| `PLAYWRIGHT_BROWSERS_PATH` | `/app/.playwright-browsers` |

**Note:** `PORT=3000` in Dockerfile may conflict with PaaS `PORT` injection. Override at runtime with `-e PORT=...`.

**`.dockerignore` (correctly excludes):**
- `bidwar-local/`
- `mockup-sandbox/`
- `attached_assets/`
- `lovableupdates/`
- `.env.*`
- `node_modules/`
- `dist/`

---

## 6. Environment Files

| File | Status |
|------|--------|
| `.env.example.example` | ⚠️ Unusual name — docs refer to `.env.example` (doesn't exist) |
| `.env.production.example` | Template for production values |
| `.env` | Developer local (gitignored) |
| `.env.production` | Production values (gitignored) |

**Env loading priority (managed-host precedence):**
```
Dashboard secrets (Render/Railway/Fly) > .env.production > .env
```

Detected by checking `process.env.RENDER`, `RAILWAY_ENVIRONMENT`, `FLY_APP_NAME`, `VERCEL`, `REPL_ID`.

---

## 7. Tailwind CSS

**Version:** Tailwind v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.ts`)

| App | Tailwind setup |
|-----|--------------|
| auction-platform | `@import "tailwindcss"` in `index.css` + `@tailwindcss/vite` |
| owner-app | Same pattern |
| scoring-app | `@source` directive scanning auction-platform `src/` |
| mockup-sandbox | Same pattern |

**Notable:** `@tailwindcss/typography` is in auction-platform `package.json` but commented out in CSS.

**scoring-app CSS:** Scans `../auction-platform/src/**/*` for Tailwind classes, which means Tailwind processes the entire auction-platform source tree for the scoring-app CSS bundle. This is correct but slower than necessary.

---

## 8. CI/CD

### Current Workflows

**`.github/workflows/build-electron.yml`** — Only workflow that exists:

| Property | Value |
|----------|-------|
| Trigger | Manual `workflow_dispatch` only |
| Platform | `windows-latest` |
| Node version | 20 |
| pnpm | via actions/setup-node |
| Steps | checkout → install → build db-local → build bidwar-local → bump version → package Windows |
| Release | GitHub Release (auto) |
| Issue | Uses `--no-frozen-lockfile` (reproducibility risk) |
| Code signing | Disabled (`CSC_IDENTITY_AUTO_DISCOVERY=false`) |

### Missing Workflows

| Workflow | Status |
|----------|--------|
| PR validation (typecheck + test) | **Missing** |
| Build verification on push | **Missing** |
| Production deploy (Render/Railway) | **Missing** (manual via DEPLOY.md) |
| `vitest` test run | **Missing** |

---

## 9. Development Scripts

### Dev Orchestrator (`scripts/dev.mjs`)

Starts all services:
1. Kills any processes on API/frontend ports
2. Starts api-server in background (polls `/healthz` until healthy)
3. Starts auction-platform Vite dev server
4. Starts owner-app Vite dev server
5. Optionally starts scoring-app (`DEV_ENABLE_SCORING=true`)

**Port defaults:**
- API: 8080
- auction-platform: 3000
- owner-app: 5174
- scoring-app: 5175

### Migration Scripts (`scripts/src/migrate.ts`)

Runs idempotent SQL DDL for: sessions table, scoring tables, intelligence tables, academy tables, communication tables, player specs tables.

Must be run separately from Drizzle push.

### One-off Repair Scripts (not in build pipeline)

Located in `scripts/src/` and `scripts/`:
- `repair-player-sport-profiles.ts` — Data repair
- `repair-player-statistics.ts` — Data repair
- `repair-team-assignments.ts` — Data repair
- `clone-tournament-from-prod.ts` — Dev data sync
- `audit-multi-sport-data.ts` — Data validation
- `validate-multi-sport-e2e.ts` — Integration validation
- `backfill-player-sport-profiles.ts` — Migration backfill
- `migrate-badminton-to-master.ts` — Migration
- `verify-master-sports-db.ts` — Validation

These are CLI tools run manually, not part of the automated pipeline.

---

## 10. Node Version Inconsistency

| Context | Node Version |
|---------|-------------|
| Dockerfile (builder + runtime) | **22** |
| `DEPLOY.md` recommended | **20** |
| `build-electron.yml` | **20** |
| `pnpm-workspace.yaml` `engines` | Not specified |

**Risk:** Node 22 vs 20 behavior differences (V8 version, API changes). Should standardize across all contexts.

---

## 11. Technical Debt Summary

| ID | Severity | Item |
|----|----------|------|
| BUILD-1 | HIGH | mockup-sandbox + bidwar-local build on every cloud deploy |
| BUILD-2 | HIGH | bidwar-local re-builds auction-platform (double build) |
| BUILD-3 | MEDIUM | No CI pipeline for main application |
| BUILD-4 | MEDIUM | Node version mismatch (22 vs 20) |
| BUILD-5 | MEDIUM | owner-app lacks Brotli/Gzip compression |
| BUILD-6 | MEDIUM | scoring-app lacks Brotli/Gzip compression |
| BUILD-7 | MEDIUM | owner-app lacks manualChunks |
| BUILD-8 | MEDIUM | scoring-app lacks manualChunks |
| BUILD-9 | LOW | .env.example.example naming confusion |
| BUILD-10 | LOW | RATE_LIMIT_OTP_SEND_MAX documented as 3, defaults to 8 |
| BUILD-11 | LOW | Electron CI uses --no-frozen-lockfile |
| BUILD-12 | LOW | Duplicate Vite alias configurations across apps |

---

## 12. Recommended Quick Wins

1. **Exclude `mockup-sandbox` and `bidwar-local` from `pnpm -r run build`:**
   ```json
   "build:deploy": "pnpm -r --filter !@workspace/mockup-sandbox --filter !@workspace/bidwar-local --if-present run build && ..."
   ```

2. **Add vite-plugin-compression2 to owner-app and scoring-app** (same config as auction-platform)

3. **Create basic GitHub Actions CI workflow:**
   ```yaml
   on: [push, pull_request]
   jobs:
     validate:
       steps:
         - pnpm install
         - pnpm run typecheck
         - pnpm run test (once test command exists)
   ```

4. **Rename `.env.example.example` to `.env.example`**

5. **Fix Node version inconsistency** — standardize on Node 22 across Dockerfile, DEPLOY.md, and Electron workflow
