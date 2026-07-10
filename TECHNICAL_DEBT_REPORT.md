# BidWar Technical Debt Report

> Generated: July 2026 — Read-only audit.

---

## Severity Classification

- **CRITICAL** — Active bugs or production risks
- **HIGH** — Significant maintenance burden or scaling blocker
- **MEDIUM** — Noticeable developer friction, drift risk, or reliability concern
- **LOW** — Code quality, naming, or minor inconsistency

---

## 1. Architecture Debt

### DB-ARCH-001 · CRITICAL · Four Parallel Schema Migration Paths

**Location:** `lib/db/src/index.ts`, `lib/db/migrations/*.sql`, `scripts/src/migrate.ts`, `lib/db/src/ensure-schema.ts`

**Problem:** Database schema is managed via four independent, uncoordinated mechanisms:
1. Drizzle Kit `db:push` — Drizzle schema definitions
2. SQL migration files (2 files: scoring, push subscriptions)
3. `scripts/src/migrate.ts` — idempotent DDL for sessions, intelligence, academy
4. Runtime DDL inside `lib/db/src/index.ts` — `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` on every module import

**Impact:** Schema state is unpredictable across environments. Adding a column requires updating multiple sources. The runtime DDL on import adds startup latency and increases risk of production boot failures if DDL runs against a locked table.

**References:** `lib/db/src/index.ts` lines with `pool.query('ALTER TABLE...')`, `lib/db/src/ensure-schema.ts`

---

### DB-ARCH-002 · HIGH · No Drizzle Foreign Key Constraints

**Location:** `lib/db/src/schema*.ts` (all schema files)

**Problem:** Drizzle schema defines almost no `references()` constraints. All relationships (e.g., player→tournament, team→tournament, bid→player) are enforced only in application code. Referential integrity depends entirely on correct service logic.

**Impact:** Orphaned records accumulate silently. A deleted tournament leaves orphaned players, teams, bids with no cascade. Data repair scripts (`scripts/repair-*.ts`) exist precisely because of this gap.

---

### DB-ARCH-003 · HIGH · Missing Indexes on Hot Tables

**Location:** `lib/db/src/schema.ts`

**Problem:** The following tables lack query indexes in Drizzle beyond PK/unique constraints:
- `bids` — No index on `tournament_id` or `player_id`; every auction live-path query is a full table scan
- `categories` — No index on `tournament_id`
- `teams` — No index on `tournament_id`
- `auction_bid_events`, `auction_player_events`, `auction_timer_events` — No indexes; intelligence/analytics queries scan entire tables
- `intelligence_archives` — Indexes added in `migrate.ts` only, not in Drizzle
- `badminton_registrations` — Missing index on `player2_id`

**Impact:** As database grows, analytics and auction state reconstruction degrade. `bids` is directly in the bidding hot path.

---

### PKG-ARCH-001 · MEDIUM · buzz-studio-render Violates Package Boundaries

**Location:** `lib/buzz-studio-render/` imports from `artifacts/auction-platform/src/`

**Problem:** `lib/buzz-studio-render` (a library package) directly imports React template components from the `auction-platform` application artifact. Libraries should not depend on applications.

**Impact:** Changes to `auction-platform` template paths silently break the server-side PNG render worker. The package is excluded from root `tsconfig.json` project references, so TypeScript cannot catch these breakages at build time.

---

### PKG-ARCH-002 · LOW · Incomplete tsconfig Project References

**Location:** `/workspace/tsconfig.json`

**Problem:** Root `tsconfig.json` only references 6 of 11 lib packages. Missing: `api-base`, `badminton-core`, `blog-data`, `buzz-studio-render`, `api-spec`.

**Impact:** `tsc --build` cannot check cross-package type correctness for these libs. Type errors in them surface only at app-level builds.

---

## 2. Frontend Debt

### FE-DEBT-001 · HIGH · AuctionOperator and TournamentSettings Are Not Lazy-Loaded

**Location:** `artifacts/auction-platform/src/App.tsx`

**Problem:** `AuctionOperator` (~2,506 lines) and `TournamentSettings` (~1,818 lines) are imported statically at the top of `App.tsx`, shipping them in the main chunk for all visitors including those who never access them (marketing visitors, owners, public scoreboard viewers).

**Expected fix:** Wrap both in `React.lazy()` like all other organizer pages.

---

### FE-DEBT-002 · HIGH · Unreachable Scoring/Badminton Page Tree Maintained in auction-platform

**Location:** `artifacts/auction-platform/src/pages/scoring-*.tsx`, `pages/badminton/*.tsx` (~19 files)

**Problem:** All scoring and badminton routes in `auction-platform/App.tsx` redirect to the scoring-app (`RedirectToScoringApp`). The scoring/badminton page components remain in `auction-platform/src/pages/` and their associated hooks (`use-scoring-socket`, `use-scoring-match`, `use-badminton-match`, `use-badminton-branding`, `use-umpire-assistance`) remain in `hooks/`. These files are never rendered from auction-platform directly.

**Impact:** ~20+ files (and their imports) add maintenance burden and increase the risk of confusion about which scoring implementation is canonical.

---

### FE-DEBT-003 · MEDIUM · admin.tsx Is a 3,994-Line Monolith

**Location:** `artifacts/auction-platform/src/pages/admin.tsx`

**Problem:** This file is not a page component — it's a shared admin UI module (~3,994 lines) imported by multiple admin-* pages. It is effectively an undeclared barrel of admin functionality that resists code-splitting.

---

### FE-DEBT-004 · MEDIUM · Duplicate OBS Page Files (obs-lab-overlay.tsx)

**Location:**
- `artifacts/auction-platform/src/pages/obs-lab-overlay.tsx`
- `artifacts/auction-platform/src/pages/obs-lab-overlay-preview.tsx`

**Problem:** Both files are near-identical duplicates of `obs-v2-overlay.tsx` and `obs-v2-overlay-preview.tsx`. The app routes for `/obs/lab` and `/obs/lab/preview` import the v2 versions, not the obs-lab versions. The obs-lab files are unreachable.

**Evidence:** `lib/broadcast-overlay.ts` marks `broadcastOverlayLabPath` as `@deprecated` alias of v2 paths.

---

### FE-DEBT-005 · MEDIUM · obs/ vs obs-lab/ Directory Duplication

**Location:**
- `artifacts/auction-platform/src/components/broadcast/obs/`
- `artifacts/auction-platform/src/components/broadcast/obs-lab/`

**Problem:** Parallel component directories share ~11 filenames (`auction-lower-third`, `countdown-ring`, `hex-photo`, `obs-lower-third-scene`, etc.). They represent two broadcast overlay "designs" being maintained in parallel with risk of drift.

---

### FE-DEBT-006 · MEDIUM · Unused Context Exports

**Location:** `artifacts/auction-platform/src/lib/initial-data/initial-data-provider.tsx`

**Problem:** `usePageInitialData()` and `useHasServerSnapshot()` are exported from the provider but never imported anywhere. Only `useHomeInitialData()` is actually used.

---

### FE-DEBT-007 · MEDIUM · Unused Hook Exports from use-platform-features.ts

**Location:** `artifacts/auction-platform/src/hooks/use-platform-features.ts`

**Problem:** `useTournamentScoringActive` and `useBadmintonScoringActive` are exported but never imported elsewhere. Only `useScoringPlatformEnabled` and `useCricketScoringActive` are consumed.

---

### FE-DEBT-008 · LOW · pages/dashboard.tsx — Route Redirects, Component Exists

**Location:** `artifacts/auction-platform/src/pages/dashboard.tsx`

**Problem:** The `/dashboard` route in `App.tsx` redirects to `/organizer`. The `dashboard.tsx` page component is never rendered but remains in the codebase.

---

### FE-DEBT-009 · LOW · Dead npm Dependencies in auction-platform

**Location:** `artifacts/auction-platform/package.json`

**Problem:** `@imgly/background-removal` and `onnxruntime-web` are listed as dependencies but have **zero imports** in `artifacts/auction-platform/src/`. They add install weight and wasted download/build time.

---

### FE-DEBT-010 · LOW · Dead Code in owner-app

**Location:** `artifacts/owner-app/src/`

**Problem:**
- `hooks/useOrientation.ts` — never imported
- `lib/utils.ts` (contains only `cn()`) — never imported
- `components.json` references `@/components/ui` but no UI component directory exists
- `OwnerRoute.tsx` `stateFetching` destructured but unused
- `Warmup` component receives `onSync` prop declared but unused internally

---

### FE-DEBT-011 · LOW · scoring-app Dead Import

**Location:** `artifacts/scoring-app/src/App.tsx`

**Problem:** `TournamentCodeGate` is imported but never used in the scoring-app `App.tsx`.

---

### FE-DEBT-012 · LOW · dev-dist/ in owner-app Committed to Repo

**Location:** `artifacts/owner-app/dev-dist/`

**Problem:** Workbox vendor build artifacts are committed to the repository, causing unnecessary repo size growth and merge conflicts.

---

## 3. Backend / API Debt

### API-DEBT-001 · HIGH · Unauthenticated File Upload Endpoint

**Location:** `artifacts/api-server/src/routes/upload.ts`

**Problem:** `POST /api/upload`, `/api/upload/media`, `/api/upload/audio` have no authentication. Any client can upload files to Cloudinary when credentials are configured.

**Impact:** Storage cost abuse, content policy violations.

---

### API-DEBT-002 · HIGH · Public Analytics with LLM Cost Exposure

**Location:** `artifacts/api-server/src/routes/analytics.ts`

**Problem:** `GET /api/tournaments/:id/analytics/*` including `/analytics/insights` is unauthenticated. The insights endpoint can call OpenAI when `OPENAI_API_KEY` is configured, with only a rate limiter (30/15min per IP) as mitigation. Enumerating tournament IDs enables cost abuse.

---

### API-DEBT-003 · MEDIUM · auction.ts Is a 3,400-Line Monolith

**Location:** `artifacts/api-server/src/routes/auction.ts`

**Problem:** The auction route file is ~3,400 lines and mixes SSE setup, bid processing, display overlays, fortune wheel, cheer, mirror sync, break timer, and conclude logic. This makes it hard to test, review, and maintain.

---

### API-DEBT-004 · MEDIUM · Inconsistent Admin Auth Patterns

**Location:** Various route files in `artifacts/api-server/src/routes/`

**Problem:** Some routes use `requireAdmin` middleware, others inline `req.jwtUser.isAdmin` checks. This inconsistency increases risk of auth bypass via refactoring.

---

### API-DEBT-005 · MEDIUM · Demo Seed Endpoint in Production

**Location:** `artifacts/api-server/src/routes/seed-demo.ts`

**Problem:** `POST /api/seed/demo` writes real demo data to production DB when `X-Seed-Key` header matches `ADMIN_PASSWORD`. It uses plain `!==` comparison (not timing-safe) and is never disabled based on `NODE_ENV`.

---

### API-DEBT-006 · MEDIUM · Duplicate Badminton Route Mount

**Location:** `artifacts/api-server/src/routes/index.ts`

**Problem:** Both `badminton.ts` and `master-sports.ts` are mounted on `/tournaments/:id/badminton`. This works but creates confusing route overlap and makes it unclear which file owns which endpoints.

---

### API-DEBT-007 · MEDIUM · organizerNormalizedMobileTaken Loads All Organizers

**Location:** `artifacts/api-server/src/routes/auth.ts`

**Problem:** A mobile uniqueness check loads all organizer records into memory to find duplicates. This will not scale as the organizer count grows.

---

### API-DEBT-008 · LOW · tournament-workbook.ts — Deprecated, Not Mounted

**Location:** `artifacts/api-server/src/routes/tournament-workbook.ts`

**Problem:** File is marked `@deprecated`, only re-exports from `workbook.ts`, and is **not imported** in `routes/index.ts`. Dead file.

---

### API-DEBT-009 · LOW · CANONICAL_HOST Redirect Is Dead Code

**Location:** `artifacts/api-server/src/app.ts`

**Problem:** `CANONICAL_HOST` and `NON_CANONICAL_HOST` are both hardcoded to `"bidwar.in"`. The canonical host redirect block (`ENABLE_APP_HOST_REDIRECT`) never fires.

---

### API-DEBT-010 · LOW · ENABLE_BADMINTON Env Var Deprecated But Still Checked

**Location:** `artifacts/api-server/src/lib/runtime-env.ts`

**Problem:** `ENABLE_BADMINTON` env var is deprecated; the `SCORING` feature flag supersedes it. The old variable is still checked with a fallback, adding unnecessary conditional logic.

---

### API-DEBT-011 · LOW · Remaining console.* Calls in Production Code

**Location:** Various `lib/` files

**Problem:** Raw `console.error`/`console.info` calls remain in:
- `lib/runtime-env.ts`
- `lib/bootstrap.ts`
- `lib/master-sports/sync.ts`
- `lib/master-sports/cricket-roster.ts`
- `lib/badminton-service.ts`
- `lib/bulk-import/photo-queue-service.ts`

Structured Pino logging is used elsewhere; these are inconsistent.

---

## 4. Communication System Debt

### COMM-DEBT-001 · MEDIUM · Three Parallel Notification Systems

**Location:** `lib/db/src/schema*.ts`, `lib/api-server/src/lib/communication/`, `lib/api-server/src/lib/notifications/`

**Problem:** Three separate notification/communication audit trails exist:
1. `notification_logs` (legacy)
2. `comm_logs` + `wa_consent_events` (WhatsApp/SMS legacy comm.ts)
3. `communication_jobs` + `communication_logs` (new communication center)

New features send via system 3; some legacy features still write to 1 or 2. This creates fragmented audit history and maintenance burden.

---

### COMM-DEBT-002 · LOW · WhatsApp Consent Blast Scheduler Always Active

**Location:** `artifacts/api-server/src/index.ts`, `lib/communication/`

**Problem:** `startConsentBlastScheduler` starts on every boot even when WhatsApp/Twilio is not configured. No-ops gracefully but wastes a worker process.

---

## 5. Local Mode / Electron Debt

### LOCAL-DEBT-001 · HIGH · auction.ts ~1,750 Lines Mirrors Cloud But Drifts

**Location:** `artifacts/bidwar-local/src/server/auction.ts`

**Problem:** The local Express auction handler is ~1,750 lines and mirrors the cloud auction API. Feature additions to cloud auction must be manually duplicated here. No automated parity testing exists.

**Impact:** Feature drift between cloud and local mode will grow over time.

---

### LOCAL-DEBT-002 · MEDIUM · Hardcoded JWT Fallback Secret

**Location:** `artifacts/bidwar-local/src/server/index.ts`

**Problem:** `LOCAL_SESSION_SECRET` has a hardcoded fallback: `'bidwar-local-session-secret-min-32-chars'`. Installer deployments without setting this variable use a predictable secret.

---

### LOCAL-DEBT-003 · MEDIUM · Scoring App Not Bundled in Local Mode

**Location:** `artifacts/bidwar-local/scripts/copy-frontend.mjs`

**Problem:** `copy-frontend.mjs` builds and copies auction-platform and owner-app into local mode, but not scoring-app. Cricket scoring is unavailable in offline/local auction mode.

---

### LOCAL-DEBT-004 · LOW · Renderer is a Single 755-Line HTML File

**Location:** `artifacts/bidwar-local/renderer/index.html`

**Problem:** The connection kit / import UI is a single large HTML file with inline JavaScript. Hard to test, lint, or maintain compared to a proper React component.

---

## 6. Shared Library Debt

### LIB-DEBT-001 · MEDIUM · api-zod Underutilized

**Location:** `lib/api-zod/`

**Problem:** `api-zod` generates a large file (~10k+ lines of Zod schemas from OpenAPI). Only the health route confirms direct usage. Most API validation is done inline in route handlers, making the generated schemas largely redundant.

**Impact:** Generation step must run on every OpenAPI change; output is nearly unused.

---

### LIB-DEBT-002 · MEDIUM · api-base Has Mixed Concerns

**Location:** `lib/api-base/src/`

**Problem:** `api-base` mixes domain logic (auction math, purse), URL constants, Vite plugin helpers, and React utilities in a single package. The Vite plugin code (dev proxy, alias generation) lives alongside server-used business logic, yet Vite is not a server dependency.

---

### LIB-DEBT-003 · LOW · Deprecated global_players Columns Not Removed

**Location:** `lib/db/src/schema-global-players.ts`

**Problem:** Four columns on `global_players` are marked `@deprecated` in schema comments: `handedness`, `auction_player_id`, `sport`, `default_role`. These were superseded by `player_sport_profiles` during the multi-sport migration but remain in the table, adding confusion to queries.

---

### LIB-DEBT-004 · LOW · badminton_players.global_player_id (integer) Deprecated

**Location:** `lib/db/src/schema-badminton.ts`

**Problem:** `global_player_id` (integer FK) on `badminton_players` is deprecated in favor of `master_player_id` (text). Both exist simultaneously. Migration to drop the old column is incomplete.

---

## 7. Build System Debt

### BUILD-DEBT-001 · HIGH · mockup-sandbox and bidwar-local Build on Every Cloud Deploy

**Location:** `package.json` → `build:deploy` → `pnpm -r --if-present run build`

**Problem:** `pnpm -r run build` includes `mockup-sandbox` (dev-only design tool) and `bidwar-local` (Electron desktop app) in the cloud deploy build. `bidwar-local` even re-builds auction-platform and owner-app internally during its `copy-frontend` step. These are unnecessary during cloud deployments and add significant build time.

---

### BUILD-DEBT-002 · MEDIUM · No CI Pipeline for Main Application

**Location:** `.github/workflows/`

**Problem:** Only one GitHub Actions workflow exists (`build-electron.yml` — for Windows desktop app, triggered manually). There is no automated CI for:
- TypeScript type checking
- Vitest test suite
- Production `build:deploy`
- PR validation

---

### BUILD-DEBT-003 · MEDIUM · Node Version Mismatch

**Location:** `Dockerfile`, `DEPLOY.md`, `.github/workflows/build-electron.yml`

**Problem:** Dockerfile uses Node 22; deployment docs reference Node 20; Electron CI uses Node 20. Three different Node versions across three deployment targets.

---

### BUILD-DEBT-004 · MEDIUM · Duplicate Vite Alias Configurations

**Location:** `vite.config.ts` files across `auction-platform`, `owner-app`, `scoring-app`, `bidwar-local`

**Problem:** `apiBaseAliases()` and similar alias maps are duplicated across multiple Vite configurations. A change to `api-base` package structure requires updating multiple config files.

---

### BUILD-DEBT-005 · LOW · .env.example.example Naming Confusion

**Location:** `/workspace/.env.example.example`, `/workspace/.env.production.example`

**Problem:** The committed template files use unusual names (`.env.example.example`). Runtime error messages and docs refer to `.env.example` which does not exist. Onboarding friction for new developers.

---

### BUILD-DEBT-006 · LOW · RATE_LIMIT_OTP_SEND_MAX Documentation Drift

**Location:** `/workspace/.env.example.example` vs `lib/rate-limiters.ts`

**Problem:** Documentation says default is 3, code defaults to 8. Operators configuring rate limits from documentation will set wrong expectations.

---

## 8. lovableupdates/ — Full Directory Debt

### LOVABLE-001 · HIGH · Stale Prototype with Security Risk

**Location:** `/workspace/lovableupdates/`

**Problem:** This directory is an abandoned Lovable.dev TanStack Start prototype that:
- Is **not** in the pnpm workspace
- Is **not** in the deploy pipeline
- Contains raw SQL database queries bypassing all API auth
- Polls database every 350ms (would hammer production DB if run with prod credentials)
- Is explicitly marked DEAD in multiple `docs/` audit files
- Duplicates production LED components (creating confusion about what's canonical)

**Impact:** If accidentally run with production `DATABASE_URL`, it exposes auction data without authentication. Confuses new developers about which LED implementation is authoritative.

**Recommendation:** DELETE this directory.

---

## Summary Table

| ID | Severity | Area | Short Description |
|----|----------|------|-------------------|
| DB-ARCH-001 | CRITICAL | Database | 4 parallel schema migration paths |
| DB-ARCH-002 | HIGH | Database | No foreign key constraints |
| DB-ARCH-003 | HIGH | Database | Missing indexes on hot tables (bids, teams, categories) |
| PKG-ARCH-001 | MEDIUM | Architecture | buzz-studio-render imports from artifact |
| PKG-ARCH-002 | LOW | Architecture | Incomplete tsconfig project references |
| FE-DEBT-001 | HIGH | Frontend | AuctionOperator/TournamentSettings not lazy-loaded |
| FE-DEBT-002 | HIGH | Frontend | 20+ unreachable scoring/badminton page files |
| FE-DEBT-003 | MEDIUM | Frontend | admin.tsx 3,994-line monolith |
| FE-DEBT-004 | MEDIUM | Frontend | obs-lab-overlay.tsx duplicate of v2 |
| FE-DEBT-005 | MEDIUM | Frontend | obs/ vs obs-lab/ component duplication |
| FE-DEBT-006 | MEDIUM | Frontend | Unused context exports |
| FE-DEBT-007 | MEDIUM | Frontend | Unused hook exports |
| FE-DEBT-008 | LOW | Frontend | dashboard.tsx never rendered |
| FE-DEBT-009 | LOW | Frontend | Dead npm deps (@imgly, onnxruntime) |
| FE-DEBT-010 | LOW | Frontend | owner-app dead code items |
| FE-DEBT-011 | LOW | Frontend | scoring-app dead import |
| FE-DEBT-012 | LOW | Frontend | owner-app/dev-dist/ committed |
| API-DEBT-001 | HIGH | API | Unauthenticated upload endpoint |
| API-DEBT-002 | HIGH | API | Public analytics with LLM exposure |
| API-DEBT-003 | MEDIUM | API | auction.ts 3,400-line monolith |
| API-DEBT-004 | MEDIUM | API | Inconsistent admin auth patterns |
| API-DEBT-005 | MEDIUM | API | Demo seed in production |
| API-DEBT-006 | MEDIUM | API | Duplicate badminton route mount |
| API-DEBT-007 | MEDIUM | API | All organizers loaded for uniqueness check |
| API-DEBT-008 | LOW | API | tournament-workbook.ts deprecated and unmounted |
| API-DEBT-009 | LOW | API | Dead canonical host redirect |
| API-DEBT-010 | LOW | API | ENABLE_BADMINTON deprecated flag still checked |
| API-DEBT-011 | LOW | API | Remaining console.* calls |
| COMM-DEBT-001 | MEDIUM | Comm | Three parallel notification systems |
| LOCAL-DEBT-001 | HIGH | Local | bidwar-local auction.ts drifts from cloud |
| LOCAL-DEBT-002 | MEDIUM | Local | Hardcoded JWT fallback secret |
| LOCAL-DEBT-003 | MEDIUM | Local | Scoring not bundled in local mode |
| LOCAL-DEBT-004 | LOW | Local | Renderer is 755-line HTML file |
| LIB-DEBT-001 | MEDIUM | Libs | api-zod underutilized |
| LIB-DEBT-002 | MEDIUM | Libs | api-base mixed concerns |
| LIB-DEBT-003 | LOW | Libs | Deprecated global_players columns not removed |
| LIB-DEBT-004 | LOW | Libs | badminton_players dual identity columns |
| BUILD-DEBT-001 | HIGH | Build | mockup-sandbox/bidwar-local build on every deploy |
| BUILD-DEBT-002 | MEDIUM | Build | No CI for main application |
| BUILD-DEBT-003 | MEDIUM | Build | Node version mismatch (22 vs 20) |
| BUILD-DEBT-004 | MEDIUM | Build | Duplicate Vite alias configs |
| BUILD-DEBT-005 | LOW | Build | .env.example.example naming confusion |
| BUILD-DEBT-006 | LOW | Build | Rate limit OTP doc drift |
| LOVABLE-001 | HIGH | Misc | lovableupdates/ stale prototype with security risk |
