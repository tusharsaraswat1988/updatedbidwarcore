# BidWar Local Auction Mode — Commercial Launch Plan

**Target:** Paying organizers, non-technical users  
**Timeline:** 30–60 days  
**Constraints:** No rewrites, no architecture changes, auction only (scoring out of scope)  
**Related:** [BIDWAR_LOCAL_AUCTION_ARCHITECTURE_AUDIT.md](./BIDWAR_LOCAL_AUCTION_ARCHITECTURE_AUDIT.md), [LOCAL_MODE_AUDIT.md](./LOCAL_MODE_AUDIT.md)

---

## Table of contents

1. [Overview](#overview)
2. [P0 — Launch blockers](#p0--launch-blockers)
3. [P1 — Important](#p1--important)
4. [P2 — Nice to have](#p2--nice-to-have)
5. [Minimum Launch Version](#1-minimum-launch-version)
6. [Recommended Launch Version](#2-recommended-launch-version)
7. [Post-launch backlog](#3-features-that-can-safely-wait-until-after-launch)
8. [Summary timeline](#summary-timeline)

---

## Overview

This plan identifies the **minimum work** required to make Local Auction Mode commercially usable by a non-technical organizer, based on the June 2026 architecture audit and current codebase state.

**Classification:**

| Priority | Meaning |
|----------|---------|
| **P0** | Launch blocker — cannot sell without this |
| **P1** | Important — needed for a credible 60-day commercial launch |
| **P2** | Nice to have — safe to defer until after first paying events |

---

## P0 — Launch blockers

These must ship before selling Local Auction Mode. Without them, a venue auction cannot be completed end-to-end on LAN.

---

### P0-1: Local operator access (fix `OrganizerGuard` on LAN)

| Field | Detail |
|-------|--------|
| **Description** | Allow the operator panel to load and remain usable on `http://<LAN-IP>:3741` without cloud cookies. Use export-embedded tournament organizer credentials or a local session issued at import. |
| **Why required** | `OrganizerGuard` calls cloud `/api/auth/organizer/:id/me`. The local server has no auth routes — the operator is redirected to cloud login and cannot run the auction offline. |
| **Files affected** | `artifacts/auction-platform/src/components/organizer-guard.tsx`, `artifacts/auction-platform/src/hooks/use-auth.ts`, `artifacts/auction-platform/src/lib/auth.ts`, `artifacts/bidwar-local/src/server/index.ts` (mount minimal local auth routes), `artifacts/bidwar-local/src/server/routes/local.ts` (issue session at import), optionally `artifacts/api-server/src/routes/tournaments.ts` (embed auth material in export) |
| **Estimated effort** | 3–5 days |
| **Risk level** | **High** if skipped — product unusable at venue |

---

### P0-2: Bundle and serve owner-app on local server

| Field | Detail |
|-------|--------|
| **Description** | Build `owner-app` alongside `auction-platform` and serve it at `/owner-app/*` from the local Express server (same origin as API). |
| **Why required** | `copy-frontend.mjs` only bundles `auction-platform`. Owner join URLs (`/owner-app/join?...`) return 404 on the local server — team owners cannot bid. |
| **Files affected** | `artifacts/bidwar-local/scripts/copy-frontend.mjs`, `artifacts/bidwar-local/src/server/index.ts`, `artifacts/bidwar-local/package.json` (build script chain) |
| **Estimated effort** | 2–3 days |
| **Risk level** | **High** — core product promise (owner bidding) broken |

---

### P0-3: Owner access-code verification on local server

| Field | Detail |
|-------|--------|
| **Description** | Port `POST /api/tournaments/:tournamentId/teams/:teamId/verify-access` to the local `teams` router. |
| **Why required** | Owner-app access gate depends on this endpoint (`artifacts/api-server/src/routes/teams.ts` ~465). Without it, owners cannot unlock the bid screen. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/teams.ts`, reference logic from `artifacts/api-server/src/routes/teams.ts` |
| **Estimated effort** | 1–2 days |
| **Risk level** | **High** — owners blocked at gate screen |

---

### P0-4: Conclude auction endpoint on local server

| Field | Detail |
|-------|--------|
| **Description** | Add `POST /tournaments/:id/auction/conclude` to local `auction.ts`, matching cloud behavior (mark completed, finalize session). |
| **Why required** | Operator panel calls `useConcludeAuction()` (`auction-operator.tsx`). Route is missing locally — organizer cannot officially end the auction. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 1–2 days |
| **Risk level** | **High** — auction cannot be closed cleanly |

---

### P0-5: Venue connection kit (display + owner deep links & QR)

| Field | Detail |
|-------|--------|
| **Description** | Replace base-LAN QR with actionable links: LED display URL, operator URL, and **per-team** owner join URLs. Show a copy/print panel in the Electron renderer and cloud setup wizard. |
| **Why required** | Non-technical organizers cannot type IPs or construct URLs. Current QR encodes base URL only (`local.ts` `/local/qr.png`). |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/local.ts`, `artifacts/bidwar-local/renderer/index.html`, `artifacts/auction-platform/src/pages/local-mode.tsx`, `lib/api-base/src/owner-urls.ts` (reuse URL helpers) |
| **Estimated effort** | 2–3 days |
| **Risk level** | **High** — venue setup fails without technical help |

---

### P0-6: Enable Local Mode in organizer navigation

| Field | Detail |
|-------|--------|
| **Description** | Remove "Coming Soon" and link sidebar to `/tournament/:id/local-mode` when `localModeEnabled`. |
| **Why required** | Setup wizard exists but is hidden. Paying customers cannot discover the feature without admin sending a direct URL. |
| **Files affected** | `artifacts/auction-platform/src/components/layout.tsx`, possibly `artifacts/auction-platform/src/App.tsx` |
| **Estimated effort** | 0.5 day |
| **Risk level** | **Medium** — commercial discoverability and support burden |

---

### P0-7: Verified end-to-end launch path (manual QA gate)

| Field | Detail |
|-------|--------|
| **Description** | Document and execute one repeatable test: cloud export → install → import → operator login → owner bid on phone → LED display → conclude → sync to cloud. Fix any failures found. |
| **Why required** | No integration tests exist for `bidwar-local`. Cannot sell without proving the path works once. |
| **Files affected** | New checklist doc (e.g. `docs/LOCAL_MODE_LAUNCH_CHECKLIST.md`); fixes wherever E2E breaks |
| **Estimated effort** | 2–3 days (test + fixes) |
| **Risk level** | **High** — revenue risk from failed live events |

**P0 total: ~12–18 dev-days (≈ 3–4 weeks with 1 developer)**

---

## P1 — Important

Not strictly blocking a LAN auction, but expected by paying customers and needed for a credible 60-day launch.

---

### P1-1: LED display overlay control (`display-overlay`)

| Field | Detail |
|-------|--------|
| **Description** | Port `POST .../auction/display-overlay` to local server. |
| **Why required** | Operator uses `useSetDisplayOverlay()` (~14 call sites). Missing route breaks team/player/banner/pause overlays on LED during live auction. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts`, `lib/db-local/src/schema/auction_sessions.ts` (verify fields exist) |
| **Estimated effort** | 1–2 days |
| **Risk level** | **Medium** — degraded LED control at venue |

---

### P1-2: Stop timer endpoint

| Field | Detail |
|-------|--------|
| **Description** | Port `POST .../auction/stop-timer` to local server. |
| **Why required** | Operator uses `useStopTimer()`. Auction timer control fails without it. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 1 day |
| **Risk level** | **Medium** |

---

### P1-3: Defer player endpoint

| Field | Detail |
|-------|--------|
| **Description** | Port `POST .../auction/defer-player` to local server. |
| **Why required** | Operator uses `useDeferPlayer()`. Common live-auction workflow breaks without it. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 1–2 days |
| **Risk level** | **Medium** |

---

### P1-4: Owner scout endpoint

| Field | Detail |
|-------|--------|
| **Description** | Port `GET /tournaments/:id/teams/scout` to local server. |
| **Why required** | Owner-app scout screen (`Scout.tsx`) calls `useGetTeamScout`. Live bidding works without it; scout/squad UX fails. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/teams.ts`, logic from `artifacts/api-server/src/routes/teams.ts` |
| **Estimated effort** | 2–3 days |
| **Risk level** | **Medium** — owner UX incomplete |

---

### P1-5: Local branding endpoint

| Field | Detail |
|-------|--------|
| **Description** | Serve `GET /api/branding` from data embedded at import (or sensible defaults). |
| **Why required** | `useBranding()` fetches cloud branding; local falls back to defaults — wrong logos/colors vs cloud for paying customers. |
| **Files affected** | `artifacts/api-server/src/routes/tournaments.ts` (include branding in export), `artifacts/bidwar-local/src/server/routes/local.ts` (import), new small branding route or extend `tournaments.ts`, `lib/db-local/src/setup.ts` |
| **Estimated effort** | 2–3 days |
| **Risk level** | **Medium** — brand/consistency issue |

---

### P1-6: Offline image fallbacks (minimum viable media)

| Field | Detail |
|-------|--------|
| **Description** | When Cloudinary URLs fail (no WAN), show placeholders/initials instead of broken images on LED, operator, and owner screens. Optionally bundle tournament logo from export. |
| **Why required** | Export stores URL strings only. Offline venues show broken player photos and team logos — visible quality failure on big screens. |
| **Files affected** | `artifacts/auction-platform/src/lib/cloudinary.ts`, display components (`components/display/`), `artifacts/owner-app/src/screens/LiveBid.tsx`, import/export if embedding logo bytes is chosen |
| **Estimated effort** | 3–5 days |
| **Risk level** | **Medium** — poor customer perception, not a hard functional block |

---

### P1-7: Operator PIN in export + enforced at venue

| Field | Detail |
|-------|--------|
| **Description** | Generate/export `operatorPin`, persist on import, require PIN for auction mutations (already partially implemented — PIN is optional today). |
| **Why required** | Open LAN API (`cors()`, no PIN) allows anyone on venue Wi‑Fi to mutate auction state. Unacceptable for commercial venues. |
| **Files affected** | `artifacts/api-server/src/routes/tournaments.ts`, `artifacts/bidwar-local/src/server/routes/local.ts`, `artifacts/bidwar-local/src/server/routes/auction.ts`, `artifacts/auction-platform` (PIN entry UI for local), Electron renderer |
| **Estimated effort** | 2–3 days |
| **Risk level** | **Medium** — security/reputation risk |

---

### P1-8: Post-auction sync UX (one-click, no manual cloud URL)

| Field | Detail |
|-------|--------|
| **Description** | After conclude, prompt organizer to sync. Use `cloudBaseUrl` from import (already in export). Remove any manual URL prompts in renderer. Show clear success/failure. |
| **Why required** | Paying customers need official results in cloud. `sync-to-cloud` fails if `cloudBaseUrl` missing; renderer still has manual sync patterns. |
| **Files affected** | `artifacts/bidwar-local/renderer/index.html`, `artifacts/bidwar-local/src/server/routes/local.ts`, `artifacts/auction-platform/src/pages/local-mode.tsx` (sync status copy) |
| **Estimated effort** | 1–2 days |
| **Risk level** | **Medium** — data stuck on venue PC |

---

### P1-9: Sync queue retry for failed mirror/sync entries

| Field | Detail |
|-------|--------|
| **Description** | Retry `sync_queue` rows marked `failed: true` with backoff when connectivity returns. |
| **Why required** | `sync-worker.ts` marks failures permanent. Spotty internet during event loses mirror/sync permanently. |
| **Files affected** | `artifacts/bidwar-local/src/server/sync-worker.ts` |
| **Estimated effort** | 1–2 days |
| **Risk level** | **Medium** — data/sync reliability |

---

### P1-10: Setup wizard copy & step accuracy

| Field | Detail |
|-------|--------|
| **Description** | Fix misleading cloud sync status text and align 6-step wizard with actual working flow (installer download, export, import, links, test, sync). |
| **Why required** | Non-technical users follow this page. Wrong copy causes support calls and failed events. |
| **Files affected** | `artifacts/auction-platform/src/pages/local-mode.tsx` |
| **Estimated effort** | 1 day |
| **Risk level** | **Low–Medium** — support/trust |

---

### P1-11: Windows installer build pipeline fix

| Field | Detail |
|-------|--------|
| **Description** | Fix CI step that runs `db-local build` (no script exists). Verify `build-electron.yml` produces installable `.exe` reliably. |
| **Why required** | Organizers download installer from admin-configured URL. Broken CI = no deliverable. |
| **Files affected** | `.github/workflows/build-electron.yml`, `lib/db-local/package.json`, `artifacts/bidwar-local/package.json` |
| **Estimated effort** | 1 day |
| **Risk level** | **Medium** — distribution blocked |

---

### P1-12: Concurrent cloud + local auction guard

| Field | Detail |
|-------|--------|
| **Description** | Warn or block starting cloud auction while local session is active for same tournament (and vice versa). |
| **Why required** | No dual-master protection today. Risk of conflicting results after sync. |
| **Files affected** | `artifacts/api-server/src/routes/auction.ts`, `artifacts/api-server/src/routes/tournaments.ts`, possibly `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 2 days |
| **Risk level** | **Medium** — data integrity |

**P1 total: ~17–26 dev-days (≈ 4–5 weeks additional)**

---

## P2 — Nice to have

Safe to defer until after first commercial launches.

---

### P2-1: Fan cheer endpoint (`POST /cheer`)

| Field | Detail |
|-------|--------|
| **Description** | Port cheer endpoint for live viewer fan engagement. |
| **Why wait** | LAN auction works without it. Remote cheer needs cloud anyway. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 1–2 days |
| **Risk level** | Low |

---

### P2-2: Display player filter endpoint

| Field | Detail |
|-------|--------|
| **Description** | Port `POST .../auction/display-player-filter`. |
| **Why wait** | Not referenced in operator via generated hooks; niche LED feature. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 1 day |
| **Risk level** | Low |

---

### P2-3: Code-signed Windows installer

| Field | Detail |
|-------|--------|
| **Description** | Sign Windows `.exe` for SmartScreen trust. |
| **Why wait** | Unsigned works with SmartScreen warning; document click-through for early customers. |
| **Files affected** | `.github/workflows/build-electron.yml`, signing cert setup |
| **Estimated effort** | 2–5 days |
| **Risk level** | Low |

---

### P2-4: macOS / Linux installers

| Field | Detail |
|-------|--------|
| **Description** | Validate and ship macOS DMG and Linux AppImage builds. |
| **Why wait** | CI is Windows-only; primary market appears Windows-first. |
| **Files affected** | `.github/workflows/build-electron.yml` |
| **Estimated effort** | 3–5 days |
| **Risk level** | Low |

---

### P2-5: Full offline media bundle (all photos, logos, audio, banners)

| Field | Detail |
|-------|--------|
| **Description** | Download and serve all media assets locally at export time (OMB). |
| **Why wait** | P1-6 fallbacks cover worst case; full OMB is larger effort. |
| **Files affected** | `artifacts/api-server/src/routes/tournaments.ts`, `artifacts/bidwar-local/src/server/routes/local.ts`, `src/server/index.ts` |
| **Estimated effort** | 8–12 days |
| **Risk level** | Low (if P1-6 shipped) |

---

### P2-6: Custom audio offline (countdown, sold sounds)

| Field | Detail |
|-------|--------|
| **Description** | Bundle and serve custom auction sounds locally. |
| **Why wait** | Functional auction works silent; audio is polish. |
| **Files affected** | Export/import, `use-broadcast-audio.ts`, local static `/media` |
| **Estimated effort** | 3–4 days |
| **Risk level** | Low |

---

### P2-7: Owner push notifications offline

| Field | Detail |
|-------|--------|
| **Description** | Local VAPID/push endpoints. |
| **Why wait** | Owner-app already no-ops on push failure. |
| **Files affected** | `artifacts/owner-app/src/screens/OwnerRoute.tsx` |
| **Estimated effort** | 0 (no work needed) |
| **Risk level** | Low |

---

### P2-8: Multi-operator leader lock

| Field | Detail |
|-------|--------|
| **Description** | Prevent conflicting actions from multiple operator screens. |
| **Why wait** | Shared SSE works for multiple operator screens; lock is edge case. |
| **Files affected** | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| **Estimated effort** | 3–5 days |
| **Risk level** | Low |

---

### P2-9: Automated integration tests in CI

| Field | Detail |
|-------|--------|
| **Description** | Add automated test suite for local server auction flow. |
| **Why wait** | Manual P0-7 checklist sufficient for first commercial launch. |
| **Files affected** | New `artifacts/bidwar-local/src/__tests__/` |
| **Estimated effort** | 5–8 days |
| **Risk level** | Low |

---

### P2-10: Mid-auction local roster CRUD

| Field | Detail |
|-------|--------|
| **Description** | Allow roster changes during local auction with sync implications. |
| **Why wait** | Export snapshot is pre-auction; roster changes mid-event are rare for v1. |
| **Files affected** | See `docs/LOCAL_MODE_ROSTER_ARCHITECTURE.md` |
| **Estimated effort** | 5+ days |
| **Risk level** | Low |

---

### P2-11: Remote viewer mirror field parity

| Field | Detail |
|-------|--------|
| **Description** | Mirror all display overlay fields to cloud for remote viewers. |
| **Why wait** | LAN OBS/LED/display are primary; remote viewers are bonus when internet exists. |
| **Files affected** | `artifacts/bidwar-local/src/server/mirror.ts` |
| **Estimated effort** | 2–3 days |
| **Risk level** | Low |

---

### P2-12: `fork()` env sanitization

| Field | Detail |
|-------|--------|
| **Description** | Stop passing full `process.env` to forked local server child. |
| **Why wait** | Production installer doesn't ship cloud secrets; dev-machine risk only. |
| **Files affected** | `artifacts/bidwar-local/electron/main.ts` |
| **Estimated effort** | 0.5 day |
| **Risk level** | Low |

---

## 1. Minimum Launch Version

**Scope:** P0 only (~30 days, 1 developer)

### What the organizer can do

- Discover Local Mode in sidebar (admin enables flag)
- Download Windows installer
- Export tournament from cloud (while online, Google login)
- Import into BidWar Local
- See QR/links for display and each team owner
- Run operator panel on LAN without cloud login
- Conduct core auction: start, bid, sell, undo, next player, fortune wheel, break timer (already local)
- Team owners bid via phones on same Wi‑Fi
- LED and OBS work on LAN via browser URLs
- Conclude auction
- Sync results back to cloud in one step

### Known limitations (acceptable for v1)

- Broken player/team images without internet
- No defer, stop-timer, LED overlay buttons (operator errors if used)
- No owner scout screen
- Default branding only
- Open LAN if no operator PIN
- Unsigned installer
- Remote cloud viewers depend on mirror (best effort)

### Critical path

```
P0-1 (auth) → P0-2 (owner-app) → P0-3 (verify-access) → P0-4 (conclude)
  → P0-5 (links/QR) → P0-7 (E2E validation)
```

P0-6 (nav) can ship in parallel on day one.

**Calendar:** ~3–4 weeks focused development + 1 week QA/buffer

---

## 2. Recommended Launch Version

**Scope:** P0 + P1 (~45–60 days, 1–2 developers)

Everything in Minimum Launch Version, plus:

| Addition | Benefit |
|----------|---------|
| Defer, stop-timer, LED overlays | Full operator panel parity |
| Owner scout screen | Complete owner UX |
| Branding from export | Matches cloud identity |
| Image fallbacks | No broken photos on LED |
| Operator PIN enforced | Venue security |
| One-click post-auction sync | Results reliably in cloud |
| Sync queue retry | Survives spotty internet |
| Accurate setup wizard | Fewer support calls |
| Working installer CI | Reliable distribution |
| Cloud/local auction guard | Data integrity |

**This is the version worth putting on a pricing page** and selling to paying customers without heavy hand-holding.

**Calendar:** ~6–8 weeks total

---

## 3. Features that can safely wait until after launch

| Category | Defer |
|----------|-------|
| **Fan engagement** | Cheer messages, heat meter remote sync |
| **Media polish** | Full offline media bundle, custom audio files |
| **Distribution** | Code signing, macOS/Linux builds |
| **Operations** | Automated CI tests, multi-operator locks, roster CRUD mid-auction |
| **Remote audience** | Full mirror field parity for cloud-only viewers |
| **Security hardening** | Env sanitization on fork, signed export packages |
| **Scoring** | All cricket/badminton/match systems (explicitly out of scope) |
| **Architecture** | Electron → Node SEA, Tauri, PWA — no packaging changes needed for launch |

---

## Summary timeline

| Version | Tasks | Dev effort | Calendar (1 dev) |
|---------|-------|------------|------------------|
| **Minimum** | P0 (7 items) | 12–18 days | ~30 days with QA |
| **Recommended** | P0 + P1 (19 items) | 29–44 days | ~45–60 days |
| **Post-launch** | P2 backlog (12 items) | As needed | After first paying events |

---

## Task index (quick reference)

| ID | Task | Priority |
|----|------|----------|
| P0-1 | Local operator access | P0 |
| P0-2 | Bundle owner-app | P0 |
| P0-3 | Owner verify-access | P0 |
| P0-4 | Conclude auction endpoint | P0 |
| P0-5 | Venue connection kit (QR/links) | P0 |
| P0-6 | Enable Local Mode nav | P0 |
| P0-7 | E2E launch validation | P0 |
| P1-1 | Display overlay endpoint | P1 |
| P1-2 | Stop timer endpoint | P1 |
| P1-3 | Defer player endpoint | P1 |
| P1-4 | Owner scout endpoint | P1 |
| P1-5 | Local branding endpoint | P1 |
| P1-6 | Offline image fallbacks | P1 |
| P1-7 | Operator PIN export + enforce | P1 |
| P1-8 | Post-auction sync UX | P1 |
| P1-9 | Sync queue retry | P1 |
| P1-10 | Setup wizard copy fix | P1 |
| P1-11 | Installer CI fix | P1 |
| P1-12 | Cloud/local auction guard | P1 |
| P2-1 | Cheer endpoint | P2 |
| P2-2 | Display player filter | P2 |
| P2-3 | Code-signed installer | P2 |
| P2-4 | macOS/Linux installers | P2 |
| P2-5 | Full offline media bundle | P2 |
| P2-6 | Custom audio offline | P2 |
| P2-7 | Owner push offline | P2 |
| P2-8 | Multi-operator lock | P2 |
| P2-9 | Automated integration tests | P2 |
| P2-10 | Mid-auction roster CRUD | P2 |
| P2-11 | Mirror field parity | P2 |
| P2-12 | Fork env sanitization | P2 |

---

*Plan based on codebase inspection and architecture audit, June 2026. Re-verify task scope before sprint planning.*
