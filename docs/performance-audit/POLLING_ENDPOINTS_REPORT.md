# Polling Endpoints Report

**Generated:** 2026-07-09  
**Scope:** All client-side HTTP polling and server-side background poll workers in `updatedbidwarcore`

---

## Executive Summary

| Metric | Value |
|---|---|
| Distinct HTTP endpoints polled (client) | 35 |
| Fastest client poll | 350ms (`getLiveSnapshot` demo) |
| Most common auction fallback | 5s–30s when SSE is disconnected |
| SSE-aware endpoints | Auction state, bids, purses, players, cricket live, badminton match |

Many live views use **`sseAwareRefetchInterval`**: polling is **disabled while SSE is connected** and only runs at the listed fallback interval when the connection is `reconnecting` or `disconnected`.

```typescript
// artifacts/auction-platform/src/lib/sse-polling.ts
// artifacts/owner-app/src/lib/sse-polling.ts
return connectionStatus === "connected" ? false : fallbackMs;
```

---

## 1. Auction & Tournament (React Query)

| Endpoint | Interval | Source | Conditions |
|---|---|---|---|
| `GET /api/tournaments/:id/auction` | **10s** fallback | `use-led-view.ts`, `obs-overlay.tsx` | SSE disconnected |
| `GET /api/tournaments/:id/auction` | **30s** fallback | `liveviewer.tsx` | Not completed; SSE disconnected |
| `GET /api/tournaments/:id/auction` | **2s** | `break-timer.tsx` | Always |
| `GET /api/tournaments/:id/auction` | **10s** | `local-mode.tsx` (CloudSyncStatus) | Always |
| `GET /api/tournaments/:id/auction` | **Dynamic** | `owner-app/OwnerRoute.tsx` | See §1.1 |
| `GET /api/tournaments/:id/auction/bids` | **5s** fallback | `auction-operator.tsx` | SSE disconnected |
| `GET /api/tournaments/:id/analytics/team-purses` | **5s** fallback | `auction-operator.tsx` | SSE disconnected |
| `GET /api/tournaments/:id/analytics/team-purses` | **30s** fallback | `liveviewer.tsx`, `obs-overlay.tsx` | Not completed / no embedded purses; SSE disconnected |
| `GET /api/tournaments/:id/analytics/team-purses` | **10s** fallback | `owner-app/OwnerRoute.tsx` | Not completed; SSE disconnected |
| `GET /api/tournaments/:id/players` | **15s** fallback | `obs-overlay.tsx` | SSE disconnected |
| `GET /api/tournaments/:id/registration-status` | **15s** | `players.tsx` | Always |
| `GET /api/tournaments/:id` | **5s** | `auction-reset.tsx` | Always |
| `GET /api/tournaments/:id/analytics/insights` | **75s** | `use-tournament-insights.ts` | Only when tournament status is `active` |
| `GET /api/tournaments/:id/teams` | **10s** | `teams.tsx` | Only when a team has `ownerAccessLocked` |
| `GET /api/tournaments/:id/teams/scout` | **30s** | `owner-app/Scout.tsx` | Always |

### 1.1 Owner App — Dynamic Auction State Polling

`GET /api/tournaments/:id/auction` in `owner-app/OwnerRoute.tsx`:

| State | Interval |
|---|---|
| Completed | **Off** |
| Break active / paused / paused-for-break + SSE connected | **2s** |
| Break active / paused / paused-for-break + SSE disconnected | **1s** (live/squad/scout screens) or **5s** (other screens) |
| Normal + SSE disconnected | **1s** (live/squad/scout) or **5s** (other) |
| Normal + SSE connected | **Off** |

**Screen-based fallback constant:**

```typescript
const pollFallbackMs =
  screen === "live" || screen === "squad" || screen === "scout" ? 1000 : 5000;
```

---

## 2. Cricket Scoring

| Endpoint | Interval | Source | Conditions |
|---|---|---|---|
| `GET /api/tournaments/:id/scoring/live` | **15s** (or SSE-aware 15s fallback) | `use-scoring-match.ts` → `useScoringLive` | SSE disconnected when status provided |
| `GET /api/tournaments/:id/scoring/matches/:matchId` | **4s** | `use-scoring-match.ts` → `useScoringMatch` | When enabled |
| `GET /api/tournaments/:id/scoring/standings` | **30s** | `use-scoring-match.ts`, `scoring-public.tsx` | Always |
| `GET /api/tournaments/:id/scoring/public/schedule` | **20s** if any match is live, else **60s** | `scoring-public.tsx` | Dynamic |
| `GET /api/tournaments/:id/scoring/leaderboards/:category` | **30s** | `scoring-public.tsx` | Always |
| `GET /api/tournaments/:id/scoring/matches/:matchId/scorecard` | **10s** when match is live, else **off** | `scoring-match-public.tsx` | Dynamic |

---

## 3. Badminton

| Endpoint | Interval | Source | Conditions |
|---|---|---|---|
| `GET /api/tournaments/:id/badminton/matches/:matchId` | **15s** fallback | `use-badminton-match.ts` | Only when match status is `live` or `paused`; SSE disconnected |
| `GET /api/tournaments/:id/badminton/matches/:matchId/incidents` | **5s** | `match-control-center.tsx` | Always |
| `GET /api/tournaments/:id/badminton/matches` | **10s** | `badminton/matches.tsx` | Always |

---

## 4. Admin, Auth, Branding & Integrations

| Endpoint | Interval | Source | Conditions |
|---|---|---|---|
| `GET /api/intelligence/live/:tid` | **5s** | `admin-intelligence.tsx` (Live tab) | When tournament selected |
| `GET /api/auth/admin/tournaments/:id/detail` | **15s** | `live-auction-monitor.tsx` | Always |
| `GET /api/auth/admin/audit/feed` | **60s** | `admin-recent-activity-feed.tsx` | Always |
| `GET /api/auth/admin/builds/status` | **15s** | `admin.tsx` | Only while build status is `in_progress` or `queued` |
| `GET /api/branding/icon-version` | **30s** | `use-branding.ts` (auction-platform + owner-app) | Triggers full `GET /api/branding` on version change |
| `GET /api/auth/organizer-account/me` | **30s** | `organizer-portal.tsx` | While organizer is logged in |
| `GET /api/google/sheets/status?tournamentId=…` | **3s** | `use-google-sheets-export.ts` | Only while `syncStatus === "SYNCING"` |
| `GET /api/tournaments/:id/workbook/import/jobs/:jobId/photos` | **3s** | `tournament-master-workbook.tsx` | During photo import job; stops when complete |
| `GET /api/tournaments/:id/creative-jobs` | **15s** | `template-studio-page.tsx` | Always |
| `GET /api/tournaments/:id/teams/:teamId/owner-access-lockout` | **3s** | `owner-app/AccessCode.tsx` | Only while access is locked out |

---

## 5. Demo / Prototype (`lovableupdates`)

| Endpoint | Interval | Source |
|---|---|---|
| `getLiveSnapshot` server function | **350ms** | `lovableupdates/src/lib/auction-demo/use-auction-state.ts` |

Also uses a local **250ms** `setInterval` for countdown smoothing (no HTTP).

---

## 6. Server-Side Background Polling

These poll internal queues/DB — not browser-facing REST endpoints.

| Worker | Default Interval | Config / Constant | Source |
|---|---|---|---|
| Communication jobs | **5s** | `COMMUNICATION_WORKER_POLL_MS` (default 5000) | `api-server/src/lib/communication/worker.ts` |
| Communication recovery sweep | **60s** | Hardcoded | `api-server/src/lib/communication/worker.ts` |
| Creative render jobs | **5s** | `CREATIVE_RENDER_POLL_MS` (default 5000) | `api-server/src/lib/creative-render-worker.ts` |
| BidWar local cloud sync | **30s** | `CHECK_INTERVAL_MS` | `bidwar-local/src/server/sync-worker.ts` |
| Consent blast scheduler | **1 hour** | Hardcoded | `api-server/src/lib/scheduler.ts` |
| Neon DB keep-alive (`SELECT 1`) | **4 min** | `KEEP_ALIVE_INTERVAL_MS` | `lib/db/src/index.ts` |

---

## 7. Excluded (Not API Polling)

The following `setInterval` usages were found but **do not poll HTTP endpoints**:

| Interval | Purpose | Examples |
|---|---|---|
| 100–500ms | Local UI countdown / animation ticks | `use-broadcast-audio.ts`, `server-countdown.tsx`, `break-countdown-overlay.tsx` |
| 1–4s | Carousel / mascot / landing animations | `landing.tsx`, `EyesMascot.tsx` |
| 1s | Lockout countdown display (no fetch) | `AccessCode.tsx` |
| 20s | SSE heartbeat writes (`: heartbeat`) | `auction.ts` routes (server-side) |
| 1s | Vite dev file watcher | `vite.config.ts` (`usePolling: true`) |

---

## 8. Interval Distribution (Client HTTP Only)

| Interval | Count (approx.) | Use cases |
|---|---|---|
| 350ms | 1 | Demo live snapshot |
| 2s | 2 | Break timer, owner break/pause with SSE |
| 3s | 3 | Google Sheets sync, photo import, access lockout |
| 4s | 1 | Cricket match detail (scorer) |
| 5s | 5 | Operator bids/purses, badminton incidents, admin live intel, auction reset tournament |
| 10s | 6 | LED view, OBS overlay state, local mode, badminton matches list, teams (locked), public scorecard (live) |
| 15s | 5 | OBS players, registration status, creative jobs, badminton match (SSE fallback), admin tournament detail |
| 20s | 1 | Public cricket schedule (live matches) |
| 30s | 8 | Live viewer purses, scout, standings, leaderboard, branding, organizer portal |
| 60s | 2 | Public schedule (no live), admin audit feed |
| 75s | 1 | Tournament insights (live auctions) |
| Dynamic | 4 | Owner auction state, scoring public schedule, public scorecard, badminton match |

---

## 9. Key Files Reference

| File | Role |
|---|---|
| `artifacts/auction-platform/src/lib/sse-polling.ts` | SSE-aware refetch helper |
| `artifacts/owner-app/src/lib/sse-polling.ts` | Same helper (owner app) |
| `artifacts/auction-platform/src/hooks/use-scoring-match.ts` | Cricket scoring poll hooks |
| `artifacts/auction-platform/src/hooks/use-badminton-match.ts` | Badminton match poll + SSE |
| `artifacts/auction-platform/src/hooks/use-tournament-insights.ts` | 75s insights poll |
| `artifacts/owner-app/src/screens/OwnerRoute.tsx` | Most complex dynamic auction polling |
| `lib/api-client-react/src/generated/api.ts` | Generated endpoint URL helpers |

---

## 10. Recommendations (Optional Follow-ups)

1. **Consolidate auction fallbacks** — intervals vary (5s, 10s, 15s, 30s) across similar views; consider a shared config map per audience (operator / display / owner / public).
2. **Document SSE fallback contract** — new live views should use `sseAwareRefetchInterval` rather than unconditional `refetchInterval`.
3. **Review 350ms demo poll** — only in `lovableupdates`; ensure it never ships to production bundles.
4. **Conditional polls** — Google Sheets (3s), build status (15s), and photo import (3s) are well-scoped; keep this pattern for new job-status UIs.

---

*End of report.*
