# BidWar Cleanup Plan

> Generated: July 2026 — Read-only audit.
> This plan organizes all findings from the full codebase audit into actionable cleanup phases.
> Each phase is ordered by safety and impact. Begin with Phase 1 before proceeding.

---

## Cleanup Classification Reference

Each item includes:
- **File/Folder** — what to change
- **Reason** — why it's being removed/changed
- **Current usage** — who references it
- **Risk level** — Low / Medium / High
- **Classification** — SAFE TO DELETE / VERIFY BEFORE DELETE / DO NOT DELETE
- **Expected benefit** — what improves
- **Estimated impact** — qualitative impact on code quality, performance, or security

---

## Phase 1 — 100% Safe (Zero Risk)

Items confirmed dead with no consumers. Can be deleted immediately without verification.

### 1.1 Delete lovableupdates/ directory

| Field | Value |
|-------|-------|
| **Path** | `/workspace/lovableupdates/` |
| **Reason** | Abandoned prototype. Not in workspace. Not deployed. Bypasses API auth (security risk). Duplicates production display components. Multiple audit docs mark as DEAD. |
| **Current usage** | Zero — never used by any production code |
| **Risk level** | **None to codebase** (risk of keeping it: HIGH due to security exposure) |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Eliminates security hazard, removes confusion about canonical LED implementation, reduces repo size by ~50 files |
| **Estimated impact** | High security improvement, high developer clarity |

**Command:** `rm -rf /workspace/lovableupdates/`

---

### 1.2 Delete `pages/obs-lab-overlay.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/obs-lab-overlay.tsx` |
| **Reason** | Routes `/obs/lab` import `obs-v2-overlay.tsx`; this file is never used |
| **Current usage** | Zero |
| **Risk level** | None |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes duplicate page confusion |
| **Estimated impact** | Low — code clarity only |

---

### 1.3 Delete `pages/obs-lab-overlay-preview.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/obs-lab-overlay-preview.tsx` |
| **Reason** | Same as above — v2 preview is used instead |
| **Current usage** | Zero |
| **Risk level** | None |
| **Classification** | **SAFE TO DELETE** |
| **Estimated impact** | Low — code clarity only |

---

### 1.4 Delete `pages/auction-data-manager.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/auction-data-manager.tsx` |
| **Reason** | Route redirects to workbook; this component never renders |
| **Current usage** | Zero |
| **Risk level** | None |
| **Classification** | **SAFE TO DELETE** |

---

### 1.5 Delete `pages/dashboard.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/dashboard.tsx` |
| **Reason** | Route `/dashboard` redirects to `/organizer`; component never renders |
| **Current usage** | Zero |
| **Risk level** | None |
| **Classification** | **SAFE TO DELETE** |

---

### 1.6 Delete `components/display/overlay-manager.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/components/display/overlay-manager.tsx` |
| **Reason** | Only referenced by `display/index.ts` barrel; never imported by any consuming component |
| **Current usage** | Zero active consumers |
| **Risk level** | None |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes dead overlay logic (~200+ lines) |

---

### 1.7 Delete `components/display/use-fortune-wheel-broadcast-live.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/components/display/use-fortune-wheel-broadcast-live.ts` |
| **Reason** | Defined but never imported anywhere in the codebase |
| **Current usage** | Zero |
| **Classification** | **SAFE TO DELETE** |

---

### 1.8 Delete owner-app `hooks/useOrientation.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/hooks/useOrientation.ts` |
| **Reason** | Never imported in owner-app source |
| **Current usage** | Zero |
| **Classification** | **SAFE TO DELETE** |

---

### 1.9 Delete owner-app `lib/utils.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/lib/utils.ts` |
| **Reason** | Contains only `cn()` helper; never imported in owner-app source |
| **Current usage** | Zero |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Also justifies removing `clsx` and `tailwind-merge` from owner-app package.json |

---

### 1.10 Delete `routes/tournament-workbook.ts` (api-server)

| Field | Value |
|-------|-------|
| **File** | `artifacts/api-server/src/routes/tournament-workbook.ts` |
| **Reason** | Marked `@deprecated`; re-exports workbook.ts; **not mounted in routes/index.ts** |
| **Current usage** | Zero — not in routing |
| **Classification** | **SAFE TO DELETE** |

---

### 1.11 Remove unused inline exports (code changes, not file deletions)

| File | Change |
|------|--------|
| `lib/initial-data/initial-data-provider.tsx` | Remove `usePageInitialData` and `useHasServerSnapshot` exports |
| `hooks/use-platform-features.ts` | Remove `useTournamentScoringActive` and `useBadmintonScoringActive` exports |
| `scoring-app/src/App.tsx` | Remove unused `TournamentCodeGate` import |
| `owner-app/src/screens/OwnerRoute.tsx` | Remove unused `stateFetching` destructuring |

---

### 1.12 Gitignore owner-app/dev-dist/

| Field | Value |
|-------|-------|
| **Path** | `artifacts/owner-app/dev-dist/` |
| **Reason** | Workbox vendor build artifacts committed to repo |
| **Action** | Add `artifacts/owner-app/dev-dist/` to `.gitignore`; delete committed files |
| **Classification** | **SAFE TO DELETE + gitignore** |

---

## Phase 2 — Needs Verification Before Deletion

Items that are likely unused but require tracing dynamic imports, CI scripts, or external references.

### 2.1 Legacy display components in `display/` (outside v1/)

| Files | Count |
|-------|-------|
| `display/auction-header.tsx`, `display/player-card.tsx`, `display/bid-display.tsx`, `display/idle-screen.tsx`, `display/static-background.tsx`, `display/animated-effects-layer.tsx`, `display/top5-overlay.tsx` | 7 files |

| Field | Value |
|-------|-------|
| **Reason** | Superseded by `display/v1/` components; exported from `display/index.ts` but no active consumer found |
| **Verify** | Check `display/index.ts` — are these re-exported publicly? Search for any dynamic import() using these names. Check if `bidwar-local` renderer HTML references them. |
| **Risk level** | Low |
| **Classification** | **VERIFY BEFORE DELETE** |
| **Expected benefit** | ~7 legacy UI files removed; clarity about display architecture |

---

### 2.2 Remove `@imgly/background-removal` and `onnxruntime-web`

| Field | Value |
|-------|-------|
| **Packages** | `@imgly/background-removal`, `onnxruntime-web` |
| **Location** | `artifacts/auction-platform/package.json` |
| **Reason** | Zero static imports in `auction-platform/src/` |
| **Verify** | Search for `dynamic import()` patterns. Check `features/buzz-studio/` for any canvas-based background operations. Check if any script loads these lazily without static imports. |
| **Risk level** | Medium (if background removal was planned but not visible in static analysis) |
| **Classification** | **VERIFY BEFORE DELETE** |
| **Expected benefit** | Significant install size reduction (`onnxruntime-web` WASM bundle is large) |

---

### 2.3 `artifacts/auction-platform/server.cjs`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/server.cjs` |
| **Reason** | Legacy standalone static server; production uses api-server with SERVE_STATIC=true |
| **Verify** | Check if any Render/Railway/VPS deployments use the `start` script in auction-platform package.json. Check `DEPLOY.md` for references. |
| **Risk level** | Medium |
| **Classification** | **VERIFY BEFORE DELETE** |

---

### 2.4 Remove `clsx` and `tailwind-merge` from owner-app (after Phase 1.9)

After deleting `owner-app/lib/utils.ts`, confirm no remaining usage before removing from `package.json`.

---

### 2.5 Investigate `@tailwindcss/typography` in auction-platform

| Field | Value |
|-------|-------|
| **Package** | `@tailwindcss/typography` in `artifacts/auction-platform/package.json` |
| **Reason** | Listed as dependency but commented out in CSS |
| **Verify** | Check if any component uses `prose` classes or if the plugin is needed for academy/blog markdown rendering |

---

## Phase 3 — Architecture Cleanup

Structural improvements requiring more careful implementation.

### 3.1 Add Missing Database Indexes

| Index | Table | Priority |
|-------|-------|----------|
| `bids_tournament_id_idx` | `bids` | CRITICAL |
| `bids_player_id_idx` | `bids` | HIGH |
| `auction_bid_events_tournament_id_idx` | `auction_bid_events` | HIGH |
| `auction_player_events_tournament_id_idx` | `auction_player_events` | HIGH |
| `categories_tournament_id_idx` | `categories` | MEDIUM |
| `teams_tournament_id_idx` | `teams` | MEDIUM |

**Action:** Add these indexes to `lib/db/src/schema.ts` via Drizzle `index()` definitions and push to production.

---

### 3.2 Add Drizzle Foreign Key Constraints

| Constraint | Priority |
|-----------|----------|
| `players.tournament_id` → `tournaments.id` | HIGH |
| `teams.tournament_id` → `tournaments.id` | HIGH |
| `categories.tournament_id` → `tournaments.id` | HIGH |
| `bids.player_id` → `players.id` | MEDIUM |
| `bids.team_id` → `teams.id` | MEDIUM |

---

### 3.3 Drop Deprecated global_players Columns

After confirming `player_sport_profiles` migration is complete:
- Drop `handedness`, `auction_player_id`, `sport`, `default_role` from `global_players`
- Remove `@deprecated` comments from schema

---

### 3.4 Drop Deprecated badminton_players.global_player_id (integer)

After confirming all queries use `master_player_id`:
- Drop integer `global_player_id` column from `badminton_players`
- Remove dual-identity logic from badminton service

---

### 3.5 Lazy-Load AuctionOperator and TournamentSettings

| File | Change |
|------|--------|
| `artifacts/auction-platform/src/App.tsx` | Wrap `AuctionOperator` and `TournamentSettings` imports in `React.lazy()` |

**Expected impact:** Reduces main chunk size; improves Time to Interactive for all non-organizer visitors.

---

### 3.6 Consolidate Communication System

| Action | Detail |
|--------|--------|
| Migrate remaining writers from `notification_logs` to `communication_logs` | Verify all notification writes go to new system |
| Review `comm_logs` vs `communication_logs` overlap | Determine which audit trail is canonical |
| Plan deprecation of `comm_logs` and `notification_logs` tables | After migration complete |

---

### 3.7 Fix buzz-studio-render Package Boundary Violation

| Field | Value |
|-------|-------|
| **Issue** | `lib/buzz-studio-render` imports from `artifacts/auction-platform/src/` |
| **Options** | (A) Move templates into a shared `lib/buzz-studio-templates/` package; (B) Move render logic into api-server directly |
| **Action needed** | Decide architecture; implement after discussion |

---

### 3.8 Consolidate Schema Management

Remove runtime DDL from `lib/db/src/index.ts`:
1. Move each `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` into Drizzle schema or proper SQL migration files
2. Remove side effects from module import
3. Test that `ensureCoreSchema()` + Drizzle push covers all cases

---

### 3.9 Add Authentication to Upload Endpoints

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/upload.ts` | Require `requireTournamentOrganizer` or `isAccountOrAdmin` middleware |

---

### 3.10 Restrict Analytics Insights to Authenticated Users

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/analytics.ts` | Add `canAccessPrivateTournamentData` or `requireTournamentOrganizer` to `/analytics/insights` route |

---

### 3.11 Gate Demo Seed Endpoint

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/seed-demo.ts` | Add `if (process.env.NODE_ENV === 'production') return res.sendStatus(404)` |

---

### 3.12 Fix Twilio Webhook Validation

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/webhooks.ts` | Return 403 when `TWILIO_AUTH_TOKEN` is not set; log warning at startup |

---

### 3.13 Fix BidWar Local JWT Secret

| File | Change |
|------|--------|
| `artifacts/bidwar-local/src/server/index.ts` | Throw startup error if `LOCAL_SESSION_SECRET` not set; or auto-generate and persist |

---

## Phase 4 — Performance Optimization

### 4.1 Exclude Non-Production Packages from Cloud Build

**File:** `package.json`

```json
"build:deploy": "pnpm -r --filter !@workspace/mockup-sandbox --filter !@workspace/bidwar-local --if-present run build && node scripts/setup-playwright-browsers.mjs"
```

**Impact:** Eliminates duplicate auction-platform + owner-app builds during cloud deploy.

---

### 4.2 Add Compression to owner-app

**File:** `artifacts/owner-app/vite.config.ts`

Add `vite-plugin-compression2` with brotli and gzip, same as auction-platform config.

---

### 4.3 Add Compression to scoring-app

**File:** `artifacts/scoring-app/vite.config.ts`

Same as above.

---

### 4.4 Add manualChunks to owner-app

Split vendor chunks (react, framer-motion, tanstack-query, lucide, wouter) in owner-app Vite config.

---

### 4.5 Fix CANONICAL_HOST Dead Code

**File:** `artifacts/api-server/src/app.ts`

Either:
- Make `CANONICAL_HOST` / `NON_CANONICAL_HOST` configurable via env vars, OR
- Remove the dead redirect block entirely

---

### 4.6 Remove ENABLE_BADMINTON Deprecated Check

**File:** `artifacts/api-server/src/lib/runtime-env.ts`

Remove fallback to `ENABLE_BADMINTON` once all environments use `SCORING` flag.

---

### 4.7 Switch Remaining console.* to Pino Logger

**Files:**
- `lib/runtime-env.ts`
- `lib/bootstrap.ts`
- `lib/master-sports/sync.ts`
- `lib/master-sports/cricket-roster.ts`
- `lib/badminton-service.ts`
- `lib/bulk-import/photo-queue-service.ts`

---

## Phase 5 — Build Optimization

### 5.1 Create GitHub Actions CI for Main Application

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm --filter @workspace/api-server run test
```

---

### 5.2 Standardize Node.js Version

| Location | Change |
|----------|--------|
| `Dockerfile` | Keep Node 22 |
| `DEPLOY.md` | Update to Node 22 |
| `.github/workflows/build-electron.yml` | Update to Node 22 |

---

### 5.3 Rename Environment File Templates

```bash
mv /workspace/.env.example.example /workspace/.env.example
```

Update all references in `DEPLOY.md`, `replit.md`, runtime error messages.

---

### 5.4 Fix RATE_LIMIT_OTP_SEND_MAX Documentation

**File:** `.env.example` (after rename)

Change documented default from `3` to `8` to match code.

---

### 5.5 Fix Electron CI to Use Frozen Lockfile

**File:** `.github/workflows/build-electron.yml`

Change `--no-frozen-lockfile` to `--frozen-lockfile` for reproducible builds.

---

### 5.6 Add tsconfig Project References for Missing Libs

**File:** `/workspace/tsconfig.json`

Add references for `api-base`, `badminton-core`, `blog-data`, `buzz-studio-render`.

---

## Priority Summary

| Phase | Item | Effort | Impact |
|-------|------|--------|--------|
| 1 | Delete lovableupdates/ | Minutes | Security + clarity |
| 1 | Delete 5 dead pages | Minutes | Clarity |
| 1 | Delete dead components (overlay-manager, etc.) | Minutes | Clarity |
| 1 | Gitignore owner-app/dev-dist/ | Minutes | Repo hygiene |
| 1 | Remove dead inline exports | 1-2 hours | Clarity |
| 2 | Verify + delete legacy display components | Hours | Bundle clarity |
| 2 | Verify + remove @imgly/onnxruntime deps | Hours | Bundle size |
| 3 | Add database indexes (bids, etc.) | Hours | Query performance |
| 3 | Lazy-load AuctionOperator/Settings | 1-2 hours | Bundle performance |
| 3 | Add auth to upload endpoints | Hours | Security |
| 3 | Restrict analytics insights auth | Hours | Security |
| 3 | Gate demo seed endpoint | Minutes | Security |
| 3 | Fix Twilio webhook fallback | Hours | Security |
| 3 | Fix bidwar-local JWT secret | Hours | Security |
| 4 | Exclude mockup/local from deploy build | Minutes | Build time |
| 4 | Add compression to owner-app/scoring-app | Hours | Performance |
| 5 | Add GitHub Actions CI | Hours | Developer velocity |
| 5 | Rename .env.example.example | Minutes | DX |
| 5 | Standardize Node version | Minutes | Consistency |

---

## Risk Assessment by Phase

| Phase | Risk to Production | Deployment Required |
|-------|--------------------|---------------------|
| Phase 1 | **None** — deletes confirmed dead code | No (deletions only) |
| Phase 2 | **Low** — verify first, then delete | No (deletions only) |
| Phase 3 | **Medium** — schema changes, auth changes | Yes — test in staging first |
| Phase 4 | **Low** — build config changes | Yes — validate builds |
| Phase 5 | **None** — CI/config changes | No (or minor) |
