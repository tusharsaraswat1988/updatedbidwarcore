# BidWar Legacy Code Report

> Generated: July 2026 — Read-only audit.
> This report covers code that is technically active but represents outdated patterns, superseded implementations, or architecture in transition.

---

## 1. lovableupdates/ — Abandoned Prototype

**Status: DEAD / LEGACY**

| Item | Detail |
|------|--------|
| **Path** | `/workspace/lovableupdates/` |
| **Technology** | TanStack Start + Cloudflare Nitro (never used in production) |
| **Origin** | Lovable.dev AI-generated prototype from June 2026 |
| **What it was** | LED auction display redesign experiment |
| **Why it's legacy** | Not in pnpm workspace; never deployed; uses raw SQL against production DB (security risk); duplicates production display/v1/ components; plans for v2/v3 never completed |
| **Canonical replacement** | `artifacts/auction-platform/src/components/display/v1/` + OBS lab overlay |
| **Explicitly marked dead in** | `docs/MULTI_SPORT_DEPENDENCY_AUDIT.md`, `docs/LEGACY_FIELD_USAGE_REPORT.md`, `EXTRAS/BRANDING_USAGE_AUDIT_REPORT.md`, `report.md` |
| **Action** | DELETE |

**Legacy components duplicated here vs production:**

| lovableupdates | Production equivalent |
|---------------|----------------------|
| `components/auction-demo/v1/DisplayShell.tsx` | `artifacts/auction-platform/src/components/display/v1/DisplayShell.tsx` |
| `components/auction-demo/v1/TopStrip.tsx` | `artifacts/auction-platform/src/components/display/v1/TopStrip.tsx` |
| `components/auction-demo/v1/BidCenter.tsx` | `artifacts/auction-platform/src/components/display/v1/BidCenter.tsx` |
| `lib/bidwar-live.functions.ts` (raw SQL) | `lib/auction-state-build-cache.ts` + API layer |
| `lib/auction-demo/use-auction-state.ts` (350ms poll) | `lib/led-view/use-led-view.ts` + SSE |

---

## 2. display/ Legacy Components (Inactive in Production)

**Status: SUPERSEDED**

The following display components in `artifacts/auction-platform/src/components/display/` were part of an earlier display architecture and are no longer used by the active LED route:

| Component | Status | Replaced By |
|-----------|--------|-------------|
| `auction-header.tsx` | Legacy export, no consumers | `display/v1/TopStrip.tsx` header zone |
| `player-card.tsx` | Legacy export, no consumers | `display/v1/PlayerPortrait.tsx` |
| `bid-display.tsx` | Legacy export, no consumers | `display/v1/BidCenter.tsx` |
| `idle-screen.tsx` | Legacy export, no consumers | `display/v1/EffectsLayer.tsx` idle state |
| `static-background.tsx` | Legacy export, no consumers | `display/v1/StageThemeProvider.tsx` |
| `animated-effects-layer.tsx` | Legacy export, no consumers | `display/v1/EffectsLayer.tsx` (~1235 lines) |
| `top5-overlay.tsx` | Legacy export, no consumers | `display/v1/EffectsLayer.tsx` top5 section |
| `overlay-manager.tsx` | Legacy, never used | Superseded entirely by EffectsLayer |

**Note on naming:** Despite being named `v1/`, `display/v1/` is the **current production implementation**, not legacy. The legacy code is the "flat" components listed above (outside `v1/`).

---

## 3. OBS Overlay Evolution

**Status: TRANSITION — obs/ superseded by obs-lab/**

BidWar has evolved through three OBS overlay generations:

### Generation 1 — `broadcast/obs/` + `/tournament/:id/obs`

| Item | Detail |
|------|--------|
| **Routes** | `/tournament/:id/obs`, `/tournament/:id/obs/preview` |
| **Page** | `pages/obs-overlay.tsx` |
| **Layout** | `BroadcastLayout` |
| **Components** | `components/broadcast/obs/*.tsx` |
| **Status** | **Still active** (classic overlay) |

### Generation 2 (Current) — `broadcast/obs-lab/` + `/tournament/:id/obs/v2` or `/obs/lab`

| Item | Detail |
|------|--------|
| **Routes** | `/tournament/:id/obs/v2`, `/tournament/:id/obs/lab` (both load same component) |
| **Page** | `pages/obs-v2-overlay.tsx` |
| **Layout** | `BroadcastLabLayout` |
| **Components** | `components/broadcast/obs-lab/*.tsx` |
| **Status** | **Current active design** |
| **Note** | `broadcastOverlayLabPath` in `lib/broadcast-overlay.ts` is marked `@deprecated` as alias of v2 |

### Dead duplicate pages — `obs-lab-overlay.tsx` files

| File | Status |
|------|--------|
| `pages/obs-lab-overlay.tsx` | **Dead** — was supposed to be obs-lab, routes import v2 instead |
| `pages/obs-lab-overlay-preview.tsx` | **Dead** — same issue |

**Component duplication between obs/ and obs-lab/:**

Both directories share ~11 nearly identical component files. `obs-lab/` has 2 additions (`broadcast-lab-overlay-top-bar.tsx`, `lab-sponsor-ticker.tsx`). This is an intentional fork but creates drift risk.

---

## 4. Player Registration Legacy Flow

**Status: SUPPORTED (backward compatibility)**

| Item | Detail |
|------|--------|
| **Legacy route** | `/tournament/:id/register` (sequential integer ID in path) |
| **Page** | `pages/player-register-legacy.tsx` |
| **Behavior** | Shows "Registration link expired" message only |
| **New route** | `/register/:code` (opaque code) |
| **New page** | `pages/player-register.tsx` |
| **Action** | Keep for backward compatibility; route should remain to handle old links gracefully |

---

## 5. Communication System Transition

**Status: MIGRATION IN PROGRESS**

BidWar has two parallel communication/notification systems. The old system is still active for WhatsApp consent flows; the new system handles campaign templates and bulk sends.

### Old System (`comm.ts` / database tables: `comm_*`)

| Component | Location | Purpose |
|-----------|----------|---------|
| `routes/comm.ts` | API route | WhatsApp consent, OTP, blast, quality |
| `notification_logs` table | Database | Legacy notification audit |
| `comm_logs` table | Database | WhatsApp/SMS message audit |
| `consent_tokens`, `otp_sessions` | Database | Auth flow logs |
| `wa_templates`, `bot_sessions`, `wa_consent_events` | Database | WA automation |

### New System (`communication/` / database tables: `communication_*`)

| Component | Location | Purpose |
|-----------|----------|---------|
| `routes/communication-center.ts` | API route | Master-admin campaign management |
| `lib/communication/` | Services | Email/SMS/WA job queue |
| `communication_jobs`, `communication_logs` | Database | New audit trail |
| `communication_templates`, `communication_template_versions` | Database | Template management |

### Legacy `notifications/` vs `admin-notifications/`

| Module | Status | Purpose |
|--------|--------|---------|
| `lib/notifications/` | Legacy | Original notification service |
| `lib/admin-notifications/` | Active | In-app admin notifications + SSE |

**Action needed:** Consolidate old `comm_*` tables and `notification_logs` into the new `communication_*` schema; migrate any remaining writers.

---

## 6. Badminton Dual Identity Columns

**Status: MIGRATION INCOMPLETE**

| Table | Old Column | New Column | Status |
|-------|-----------|------------|--------|
| `badminton_players` | `global_player_id` (integer) | `master_player_id` (text, e.g. `gp_xxx`) | Both exist; migration not complete |
| `global_players` | `sport`, `default_role`, `handedness`, `auction_player_id` | `player_sport_profiles` table | Deprecated columns not yet dropped |

**Action needed:** Complete migration; remove deprecated integer `global_player_id` and deprecated `global_players` columns.

---

## 7. Scoring Platform Phase Tracking

**Status: ACTIVE MIGRATION**

Scoring was added incrementally. The `scoring_phase` column on `tournaments` table tracks migration state. Several `scoring_platform/` service files are marked as projection snapshots that may need architectural review.

| Feature | Status |
|---------|--------|
| Cricket scoring (`scoring-core`) | Active production |
| Badminton scoring (`badminton-core`) | Active production |
| `scoring_fixtures` table | Created but appears underused (matches go directly to `scoring_matches`) |
| `scoring_groups`, `scoring_draws` | Active for tournament structure |

---

## 8. Sessions Table — Legacy Express Session Store

**Status: ACTIVE BUT OUTDATED PATTERN**

| Item | Detail |
|------|--------|
| **Table** | `sessions` (PostgreSQL) |
| **Created by** | `scripts/src/migrate.ts` only (not in Drizzle schema) |
| **Used by** | `connect-pg-simple` for Express session middleware (if enabled) |
| **Current JWT approach** | `bidwar_auth` JWT cookie (stateless) |
| **Status** | The `sessions` table exists but JWT cookies are the primary auth mechanism; the session table may be remnant of an earlier implementation |

---

## 9. Feature Flags (Runtime vs Environment)

### Active Feature Flags

| Flag | Mechanism | Status |
|------|-----------|--------|
| `SCORING` env var | `runtime-env.ts` platform flag | Active — enables scoring UI and routes |
| `ENABLE_BADMINTON` env var | `runtime-env.ts` | **Deprecated** — superseded by `SCORING` flag |
| `PLAYER_SPECS_V2_ENABLED` | Env var | Active — multi-sport spec dual-write |
| `PLAYER_SPORT_PROFILES_ENABLED` | Env var | Active — sport profiles migration toggle |
| `settings.features_json` per-tournament | Database | Active — per-tournament scoring/badminton feature |

### Removed Feature Flags (from docs)

Per `docs/FEATURE_FLAG_REMOVAL_AUDIT.md`, several flags were removed. The `ENABLE_BADMINTON` flag should be next for removal once all environments use `SCORING`.

---

## 10. bidwar-local — Offline Mode Evolution

**Status: ACTIVE but INCOMPLETE**

| Gap | Status |
|-----|--------|
| Owner mobile lookup (`/api/owner/onboarding/lookup`) | Missing in local mode — documented in `docs/FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md` |
| Push notifications / VAPID | Not implemented locally |
| Cricket scoring in local mode | Not included in `copy-frontend.mjs` |
| Scoring platform events/replay | No local scoring SSE |

The architecture doc `docs/BIDWAR_LOCAL_AUCTION_ARCHITECTURE_AUDIT.md` details current state and roadmap.

---

## 11. academy-lessons.ts / academy-public.ts

**Status: ACTIVE but SEPARATE**

The Academy (knowledge center) is a blog-style content system with its own:
- Database tables: `academy_categories`, `academy_lessons`
- API routes: `/api/academy/lessons` (admin CMS), `/api/academy/public/*` (public)
- SSR path: `academy-ssr.ts` (standalone from homepage SSR)
- Frontend: `pages/academy/`, `components/academy/`

This is a fully functional content publishing system embedded in the auction platform. No legacy concerns, but worth noting it's a separate product surface with its own content model.

---

## 12. Homepage SSR — Fail-Open Pattern

**Status: ACTIVE — technically stable but architecturally fragile**

`lib/homepage-ssr.ts` and the corresponding `server-render/entry-server.tsx` implement server-side rendering for the homepage. The pattern:
- Tries to load the SSR bundle (`dist/server/entry-server.js`)
- If it fails or isn't built, falls back to SPA shell (fail-open)
- Adds cache layer (`homepage-page-cache.ts`)

This works but means the SSR bundle must be built separately from the main client bundle (via `vite.config.ssr.ts`). Build failures for SSR don't break production — they silently degrade to SPA mode, which may not be caught in CI.

---

## 13. Google Sheets Integration — Parallel Implementations

**Status: TWO PARALLEL PATHS**

| Path | Use Case | Tables |
|------|----------|--------|
| `google-sheets-service.ts` (OAuth-based) | Organizer export via Google OAuth | `google_sheet_syncs` |
| `bulk-import/google-sheet-workbook-reader.ts` (service account) | Bulk import via service account | `bulk_import_jobs` |

Both are active but serve different purposes. Not technically legacy, but worth noting the architectural split.

---

## Summary by Priority

| Priority | Item | Action |
|----------|------|--------|
| P1 (Delete now) | `lovableupdates/` entire directory | DELETE |
| P2 (Archive/clean) | Legacy display components (7 files outside v1/) | VERIFY + DELETE |
| P2 (Remove) | `obs-lab-overlay.tsx`, `obs-lab-overlay-preview.tsx` | DELETE |
| P3 (Consolidate) | Communication system (3 parallel audit trails) | MIGRATE then drop old tables |
| P3 (Complete) | Badminton dual identity columns migration | ADD migration, DROP old columns |
| P3 (Complete) | `global_players` deprecated columns | ADD migration, DROP columns |
| P4 (Remove) | `ENABLE_BADMINTON` deprecated env var | REMOVE check after all envs updated |
| P5 (Document) | Scoring platform phase migration | DOCUMENT current state |
