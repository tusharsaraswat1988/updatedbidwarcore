# BidWar Dead Code Report

> Generated: July 2026 — Read-only audit.
> 
> **Important:** Items marked SAFE TO DELETE have no active references found.
> Items marked VERIFY BEFORE DELETE require checking dynamic imports, runtime registration, or indirect references.
> DO NOT DELETE without reviewing the risk column and current usage.

---

## Legend

- **SAFE TO DELETE** — No imports found; confirmed unreachable
- **VERIFY BEFORE DELETE** — Potentially unused; trace dynamic/indirect references before removing
- **DO NOT DELETE** — Active code; listed for completeness

---

## 1. Dead Pages (Frontend — auction-platform)

### DEAD-PAGE-001 — `pages/obs-lab-overlay.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/obs-lab-overlay.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/` |
| **Reason** | Route `/tournament/:id/obs/lab` imports `obs-v2-overlay.tsx`, not this file |
| **Current usage** | None — no route imports this component |
| **Who references it** | Nobody (confirmed in App.tsx routing) |
| **Risk level** | Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes duplicate page file; reduces confusion |

---

### DEAD-PAGE-002 — `pages/obs-lab-overlay-preview.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/obs-lab-overlay-preview.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/` |
| **Reason** | Route `/tournament/:id/obs/lab/preview` imports `obs-v2-overlay-preview.tsx`, not this file |
| **Current usage** | None |
| **Who references it** | Nobody |
| **Risk level** | Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes duplicate |

---

### DEAD-PAGE-003 — `pages/auction-data-manager.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/auction-data-manager.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/` |
| **Reason** | Route `/admin/tournaments/:id/players/auction-data-manager` redirects to workbook; page never rendered |
| **Current usage** | None |
| **Who references it** | Redirect only in App.tsx |
| **Risk level** | Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes dead page |

---

### DEAD-PAGE-004 — `pages/dashboard.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/dashboard.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/` |
| **Reason** | Route `/dashboard` redirects to `/organizer`; component never rendered |
| **Current usage** | None |
| **Who references it** | Redirect in App.tsx only |
| **Risk level** | Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes confusing dead page |

---

### DEAD-PAGE-005 — Scoring pages in auction-platform (7 files)

| Field | Value |
|-------|-------|
| **Files** | `pages/scoring-match.tsx`, `pages/scoring-match-list.tsx`, `pages/scoring-match-public.tsx`, `pages/scoring-player-public.tsx`, `pages/scoring-public.tsx`, `pages/scoring-schedule.tsx`, `pages/scoring-team-public.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/` |
| **Reason** | All corresponding routes in auction-platform use `RedirectToScoringApp` — these pages are never rendered from auction-platform. The actual pages live in scoring-app (which aliases back to auction-platform pages for its own routes) |
| **Current usage** | Only accessible via scoring-app, never via auction-platform URLs |
| **Who references it** | scoring-app aliases these pages; audit carefully before deletion |
| **Risk level** | Medium (scoring-app imports them via `@/` alias) |
| **Classification** | **DO NOT DELETE** — scoring-app uses them via vite alias |
| **Expected benefit** | Clarification only; cannot delete without breaking scoring-app |

---

### DEAD-PAGE-006 — Badminton pages in auction-platform (12 files)

| Field | Value |
|-------|-------|
| **Files** | `pages/badminton/analytics.tsx`, `branding.tsx`, `broadcast.tsx`, `categories.tsx`, `courts.tsx`, `display.tsx`, `match-control.tsx`, `matches.tsx`, `overlay.tsx`, `players.tsx`, `scorer.tsx`, `tournament-hub.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/badminton/` |
| **Reason** | All auction-platform routes for badminton redirect to scoring-app |
| **Current usage** | scoring-app routes import these via alias |
| **Who references it** | scoring-app App.tsx via `@/pages/badminton/*` |
| **Risk level** | Medium (scoring-app dependency) |
| **Classification** | **DO NOT DELETE** — scoring-app uses them |
| **Expected benefit** | None; already correctly separated |

---

### DEAD-PAGE-007 — `pages/score-display.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/pages/score-display.tsx` |
| **Folder** | `artifacts/auction-platform/src/pages/` |
| **Reason** | Route `/tournament/:id/score-display` uses `RedirectToScoringApp` |
| **Current usage** | Used only by scoring-app via alias |
| **Who references it** | scoring-app |
| **Risk level** | Medium |
| **Classification** | **DO NOT DELETE** — scoring-app uses it |

---

### DEAD-PAGE-008 — `pages/cricket-global-leaderboards.tsx`, `pages/cricket-global-player.tsx`

| Field | Value |
|-------|-------|
| **Files** | `artifacts/auction-platform/src/pages/cricket-global-leaderboards.tsx`, `cricket-global-player.tsx` |
| **Reason** | Routes in auction-platform redirect to scoring-app |
| **Current usage** | scoring-app uses them via alias |
| **Classification** | **DO NOT DELETE** — scoring-app uses them |

---

## 2. Dead Components (Frontend)

### DEAD-COMP-001 — `components/display/overlay-manager.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/components/display/overlay-manager.tsx` |
| **Folder** | `artifacts/auction-platform/src/components/display/` |
| **Reason** | Exported from `display/index.ts` but never imported by any active component. Fortune wheel, team/player overlays are handled inside `display/v1/EffectsLayer.tsx` |
| **Current usage** | None |
| **Who references it** | Only `display/index.ts` (barrel export) |
| **Risk level** | Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes dead overlay management logic |

---

### DEAD-COMP-002 — Legacy display components exported but unused

| Field | Value |
|-------|-------|
| **Files** | `display/auction-header.tsx`, `display/player-card.tsx`, `display/bid-display.tsx`, `display/idle-screen.tsx`, `display/static-background.tsx`, `display/animated-effects-layer.tsx`, `display/top5-overlay.tsx` |
| **Folder** | `artifacts/auction-platform/src/components/display/` |
| **Reason** | Exported from `display/index.ts` but not imported by any active consumer. Production display uses `display/v1/EffectsLayer.tsx` and related v1 components instead |
| **Current usage** | None (only in barrel index.ts) |
| **Who references it** | `display/index.ts` only |
| **Risk level** | Low |
| **Classification** | **VERIFY BEFORE DELETE** — confirm no dynamic imports or external consumers |
| **Expected benefit** | Removes ~7 legacy UI files; reduces confusion about canonical display stack |

---

### DEAD-COMP-003 — `components/scoring-feature-guard.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/components/scoring-feature-guard.tsx` |
| **Reason** | Exported but never imported in auction-platform component tree (used only in scoring-app via alias) |
| **Current usage** | scoring-app uses it via alias |
| **Classification** | **DO NOT DELETE** — scoring-app dependency |

---

### DEAD-COMP-004 — `components/badminton-feature-guard.tsx`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/components/badminton-feature-guard.tsx` |
| **Reason** | Same pattern as scoring-feature-guard |
| **Current usage** | scoring-app |
| **Classification** | **DO NOT DELETE** |

---

## 3. Dead Hooks (Frontend)

### DEAD-HOOK-001 — `hooks/use-scoring-socket.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/hooks/use-scoring-socket.ts` |
| **Reason** | Only consumed by scoring pages, which are not routed from auction-platform |
| **Current usage** | scoring-app via alias |
| **Classification** | **DO NOT DELETE** — scoring-app uses it |

---

### DEAD-HOOK-002 — `hooks/use-scoring-match.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/hooks/use-scoring-match.ts` |
| **Same pattern as above** | scoring-app dependency |
| **Classification** | **DO NOT DELETE** |

---

### DEAD-HOOK-003 — `hooks/use-badminton-match.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/hooks/use-badminton-match.ts` |
| **Same pattern** | scoring-app dependency |
| **Classification** | **DO NOT DELETE** |

---

### DEAD-HOOK-004 — `hooks/use-badminton-branding.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/hooks/use-badminton-branding.ts` |
| **Same pattern** | scoring-app dependency |
| **Classification** | **DO NOT DELETE** |

---

### DEAD-HOOK-005 — `hooks/use-umpire-assistance.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/hooks/use-umpire-assistance.ts` |
| **Same pattern** | scoring-app dependency |
| **Classification** | **DO NOT DELETE** |

---

### DEAD-HOOK-006 — `use-fortune-wheel-broadcast-live.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/components/display/use-fortune-wheel-broadcast-live.ts` |
| **Reason** | Defined but never imported anywhere in auction-platform or scoring-app |
| **Current usage** | None found |
| **Who references it** | Nobody |
| **Risk level** | Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes dead hook |

---

### DEAD-HOOK-007 — owner-app `hooks/useOrientation.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/hooks/useOrientation.ts` |
| **Reason** | Never imported in owner-app src/ |
| **Current usage** | None |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes unused utility |

---

## 4. Dead Utilities / Lib Functions

### DEAD-UTIL-001 — owner-app `lib/utils.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/lib/utils.ts` |
| **Reason** | Contains only `cn()` helper (clsx + tailwind-merge); never imported anywhere in owner-app |
| **Current usage** | None |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes scaffold file; also removes justification for `clsx`/`tailwind-merge` deps |

---

### DEAD-UTIL-002 — `lib/initial-data/` unused exports

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/lib/initial-data/initial-data-provider.tsx` |
| **Reason** | `usePageInitialData()` and `useHasServerSnapshot()` are exported but never imported anywhere |
| **Current usage** | None (only `useHomeInitialData()` is used) |
| **Classification** | **SAFE TO DELETE** (unused export functions only; keep the file) |
| **Expected benefit** | Cleans dead API surface |

---

### DEAD-UTIL-003 — use-platform-features unused exports

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/src/hooks/use-platform-features.ts` |
| **Reason** | `useTournamentScoringActive` and `useBadmintonScoringActive` exported but never imported |
| **Current usage** | None |
| **Classification** | **SAFE TO DELETE** (remove the unused exports; keep the file) |
| **Expected benefit** | Cleaner public API surface |

---

### DEAD-UTIL-004 — scoring-app dead import

| Field | Value |
|-------|-------|
| **File** | `artifacts/scoring-app/src/App.tsx` |
| **Reason** | `TournamentCodeGate` is imported but never used in scoring-app App.tsx |
| **Current usage** | None |
| **Classification** | **SAFE TO DELETE** (remove the import line) |

---

## 5. Dead API Route Files

### DEAD-API-001 — `routes/tournament-workbook.ts`

| Field | Value |
|-------|-------|
| **File** | `artifacts/api-server/src/routes/tournament-workbook.ts` |
| **Folder** | `artifacts/api-server/src/routes/` |
| **Reason** | Marked `@deprecated`; only re-exports `workbook.ts`; **not mounted** in `routes/index.ts` |
| **Current usage** | None — not in routing |
| **Who references it** | Nobody |
| **Risk level** | Very Low |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes confusing deprecated file |

---

## 6. Dead npm Packages

### DEAD-NPM-001 — `@imgly/background-removal` and `onnxruntime-web`

| Field | Value |
|-------|-------|
| **Packages** | `@imgly/background-removal`, `onnxruntime-web` |
| **Location** | `artifacts/auction-platform/package.json` |
| **Reason** | Zero imports of either package found in `artifacts/auction-platform/src/` |
| **Current usage** | None in source files |
| **Who references it** | Nobody |
| **Risk level** | Low (but increases install size significantly — background removal WASM is large) |
| **Classification** | **VERIFY BEFORE DELETE** — confirm not used via dynamic import() or in a config not covered by static analysis |
| **Expected benefit** | Significant reduction in install size and build time |

---

### DEAD-NPM-002 — `clsx` and `tailwind-merge` in owner-app (if utils.ts deleted)

| Field | Value |
|-------|-------|
| **Packages** | `clsx`, `tailwind-merge` |
| **Location** | `artifacts/owner-app/package.json` |
| **Reason** | Only used in `lib/utils.ts` which is itself dead code |
| **Current usage** | None if utils.ts removed |
| **Classification** | **VERIFY BEFORE DELETE** — check all owner-app imports after removing utils.ts |

---

## 7. Dead Files — lovableupdates/ (Entire Directory)

### DEAD-DIR-001 — lovableupdates/

| Field | Value |
|-------|-------|
| **Path** | `/workspace/lovableupdates/` |
| **Reason** | Abandoned Lovable.dev prototype; not in pnpm workspace; not in deploy pipeline; explicitly marked DEAD in `docs/MULTI_SPORT_DEPENDENCY_AUDIT.md`, `docs/LEGACY_FIELD_USAGE_REPORT.md`, and `EXTRAS/BRANDING_USAGE_AUDIT_REPORT.md` |
| **Current usage** | None |
| **Who references it** | Nobody in production code |
| **Risk level** | High (security risk if accidentally run with prod credentials) |
| **Classification** | **SAFE TO DELETE** |
| **Expected benefit** | Removes ~50+ files, eliminates security risk, removes duplicate LED component confusion |
| **Estimated impact** | Reduces repository confusion, prevents accidental prod-DB access |

---

## 8. Dead Build Artifacts

### DEAD-BUILD-001 — `artifacts/owner-app/dev-dist/`

| Field | Value |
|-------|-------|
| **Path** | `artifacts/owner-app/dev-dist/` |
| **Reason** | Workbox vendor build artifacts committed to repo; should be gitignored |
| **Current usage** | Referenced by owner-app dev service worker config |
| **Classification** | **VERIFY BEFORE DELETE** — add to .gitignore; regenerate as needed |
| **Expected benefit** | Reduces repo size; prevents stale artifact confusion |

---

### DEAD-BUILD-002 — `artifacts/auction-platform/server.cjs`

| Field | Value |
|-------|-------|
| **File** | `artifacts/auction-platform/server.cjs` |
| **Reason** | Legacy standalone static server. Production uses `api-server` with `SERVE_STATIC=true`. The `start` script in auction-platform `package.json` references this file. |
| **Current usage** | None in production; superseded |
| **Classification** | **VERIFY BEFORE DELETE** — confirm no manual deployment uses this |
| **Expected benefit** | Removes legacy server approach; clarifies production architecture |

---

## 9. Dead Code Inside Files

### DEAD-INLINE-001 — OwnerRoute.tsx stateFetching

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/screens/OwnerRoute.tsx` (approx.) |
| **Issue** | `stateFetching` is destructured from a hook return value but never used in the component |
| **Risk** | Low |
| **Classification** | **SAFE TO DELETE** (remove destructuring) |

---

### DEAD-INLINE-002 — Warmup onSync prop

| Field | Value |
|-------|-------|
| **File** | `artifacts/owner-app/src/screens/Warmup.tsx` (approx.) |
| **Issue** | `onSync` prop declared in Props interface and passed from OwnerRoute but never used inside the Warmup component body |
| **Risk** | Low |
| **Classification** | **SAFE TO DELETE** (remove prop declaration and usage) |

---

### DEAD-INLINE-003 — CANONICAL_HOST redirect block

| Field | Value |
|-------|-------|
| **File** | `artifacts/api-server/src/app.ts` |
| **Issue** | `CANONICAL_HOST` and `NON_CANONICAL_HOST` are both hardcoded to `"bidwar.in"`. The redirect block inside `ENABLE_APP_HOST_REDIRECT` never fires. |
| **Risk** | Low (dead conditional) |
| **Classification** | **SAFE TO DELETE** (remove or make configurable) |

---

## Summary: Safe Deletions

Files confirmed safe to delete (no active consumers):

1. `pages/obs-lab-overlay.tsx`
2. `pages/obs-lab-overlay-preview.tsx`
3. `pages/auction-data-manager.tsx`
4. `pages/dashboard.tsx`
5. `components/display/overlay-manager.tsx`
6. `components/display/use-fortune-wheel-broadcast-live.ts`
7. `hooks/useOrientation.ts` (owner-app)
8. `lib/utils.ts` (owner-app)
9. `routes/tournament-workbook.ts` (api-server)
10. `/workspace/lovableupdates/` (entire directory)

Unused code inside files (safe to remove as inline changes):
- `usePageInitialData`, `useHasServerSnapshot` exports
- `useTournamentScoringActive`, `useBadmintonScoringActive` exports
- `TournamentCodeGate` import in scoring-app
- `stateFetching` destructuring in OwnerRoute
- `onSync` prop in Warmup
- Canonical host redirect block

Verify before deleting:
- Legacy display components (`auction-header.tsx`, `player-card.tsx`, etc.)
- `@imgly/background-removal`, `onnxruntime-web` npm packages
- `artifacts/owner-app/dev-dist/`
- `artifacts/auction-platform/server.cjs`
