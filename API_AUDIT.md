# BidWar API Audit

> Generated: July 2026 — Read-only audit.

---

## Overview

The BidWar REST API is an Express 5 application (~40 route files, ~700+ endpoints) serving all frontend applications. All routes are mounted under `/api` via `routes/index.ts`.

**Total SSE endpoints:** 4  
**Total route files:** 40+  
**Authentication model:** JWT cookies (stateless) + per-route enforcement  
**Rate limiting:** 12 named limiters (see §5)

---

## 1. Route Inventory

### 1.1 Health

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/healthz` | None | Liveness probe |

---

### 1.2 Authentication (`routes/auth.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/admin/login` | None | `authLimiter` |
| POST | `/auth/admin/logout` | Admin | |
| GET | `/auth/admin/me` | Admin | |
| GET | `/auth/admin/admin-notifications/events` | Admin | **SSE stream** |
| GET | `/auth/me` | Any JWT | Returns current user info |
| POST | `/auth/organizer/:id/login` | None | `authLimiter`, tournament password |
| POST | `/auth/organizer/:id/logout` | Organizer | |
| GET | `/auth/organizer/:id/me` | Organizer | |
| PATCH | `/auth/organizer/:id/password` | Organizer | |
| GET | `/auth/organizer/:id/google-sheets/status` | Organizer | |
| POST | `/auth/admin/tournaments` | Master Admin | Create tournament |
| GET | `/auth/admin/tournaments` | Master Admin | List all |
| GET | `/auth/admin/tournaments/:id` | Admin | |
| PATCH | `/auth/admin/tournaments/:id/lock` | Master Admin | |
| PATCH | `/auth/admin/tournaments/:id/unlock` | Master Admin | |
| POST | `/auth/admin/tournaments/:id/grant-license` | Master Admin | |
| POST | `/auth/admin/tournaments/:id/revoke-license` | Master Admin | |
| GET | `/auth/admin/organisers` | Admin | List organizer accounts |
| POST | `/auth/admin/organisers` | Master Admin | Create organizer account |
| GET | `/auth/admin/organisers/:id` | Admin | |
| PATCH | `/auth/admin/organisers/:id` | Admin | |
| DELETE | `/auth/admin/organisers/:id` | Master Admin | |
| POST | `/auth/organizer-account/signup` | None | `authLimiter`, `otpSendLimiter` |
| POST | `/auth/organizer-account/verify-otp` | None | `otpVerifyLimiter` |
| POST | `/auth/organizer-account/login` | None | `authLimiter` |
| POST | `/auth/organizer-account/resend-otp` | None | `otpSendLimiter` |
| POST | `/auth/organizer-account/login-otp` | None | `authLimiter` |
| POST | `/auth/organizer-account/verify-login-otp` | None | `otpVerifyLimiter` |
| GET | `/auth/organizer-account/me` | OrgAccount | |
| POST | `/auth/organizer-account/logout` | OrgAccount | |
| PATCH | `/auth/organizer-account/profile` | OrgAccount | |
| PATCH | `/auth/organizer-account/password` | OrgAccount | |
| GET | `/auth/organizer-account/tournaments` | OrgAccount | |
| POST | `/auth/organizer-account/complete-profile` | OAuth state cookie | |
| GET | `/auth/google` | None | OAuth redirect |
| GET | `/auth/google/callback` | None | OAuth callback |
| POST | `/auth/sms-settings` | Admin | Configure DLT SMS |
| GET | `/auth/config` | None | Public auth config (CAPTCHA key, feature flags) |
| POST | `/auth/organizer-account/reset-trial` | Master Admin | Reset trial license |

---

### 1.3 Tournaments (`routes/tournaments.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments` | None | Public tournament list |
| POST | `/tournaments` | OrgAccount | Create tournament |
| GET | `/tournaments/:id` | None | Public tournament detail |
| PATCH | `/tournaments/:id` | Organizer | Update tournament |
| DELETE | `/tournaments/:id` | Master Admin | Delete tournament |
| POST | `/tournaments/:id/venue-auction-guard` | Organizer | Claim local mode lock |
| DELETE | `/tournaments/:id/venue-auction-guard` | Organizer | Release local mode lock |
| GET | `/tournaments/:id/export` | Organizer | `exportLimiter` |
| POST | `/tournaments/:id/sync` | Export-token | Cloud sync from local mode |
| GET | `/tournaments/:id/share-viewer-link` | Organizer | |

---

### 1.4 Auction (`routes/auction.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/auction/events` | **None** | **SSE stream** — real-time auction state |
| GET | `/tournaments/:id/auction` | None | Current auction state |
| POST | `/tournaments/:id/auction/operator-lock` | Organizer | Acquire operator lock |
| PUT | `/tournaments/:id/auction/operator-lock` | Organizer | Heartbeat |
| DELETE | `/tournaments/:id/auction/operator-lock` | Organizer | Release lock |
| POST | `/tournaments/:id/auction/operator-lock/takeover` | Organizer | Force takeover |
| POST | `/tournaments/:id/auction/start` | Organizer | Start auction |
| POST | `/tournaments/:id/auction/pause` | Organizer | Pause |
| POST | `/tournaments/:id/auction/next-player` | Organizer | Select next player |
| POST | `/tournaments/:id/auction/bid` | Access code | **Place bid** |
| POST | `/tournaments/:id/auction/sell` | Organizer | Sell current player |
| POST | `/tournaments/:id/auction/manual-sell` | Organizer | Manual sell with team/amount |
| POST | `/tournaments/:id/auction/unsold` | Organizer | Mark unsold |
| POST | `/tournaments/:id/auction/re-auction` | Organizer | Re-queue unsold |
| POST | `/tournaments/:id/auction/re-auction-all` | Organizer | Re-queue all unsold |
| POST | `/tournaments/:id/auction/reset-trial` | Organizer/Admin | **DESTRUCTIVE** reset |
| POST | `/tournaments/:id/auction/defer-player` | Organizer | Defer to later |
| POST | `/tournaments/:id/auction/undo` | Organizer | Undo last action |
| GET | `/tournaments/:id/auction/display-overlays` | None | Active overlays |
| PUT | `/tournaments/:id/auction/display-overlays` | Organizer | Update overlays |
| POST | `/tournaments/:id/auction/fortune-wheel` | Organizer | Spin fortune wheel |
| GET | `/tournaments/:id/auction/category-filter` | None | |
| POST | `/tournaments/:id/auction/category-filter` | Organizer | |
| POST | `/tournaments/:id/auction/timer` | Organizer | Set timer |
| POST | `/tournaments/:id/auction/conclude` | Organizer | End auction |
| POST | `/tournaments/:id/auction/break-timer` | Organizer | Set break timer |
| GET | `/tournaments/:id/auction/bids` | Organizer | All bids list |
| POST | `/tournaments/:id/auction/cheer` | None | `cheerLimiter` |
| GET | `/tournaments/:id/auction/mirror` | Export-token | Local mode mirror |
| POST | `/tournaments/:id/auction/mirror` | Export-token | Local mode mirror sync |

---

### 1.5 Teams (`routes/teams.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/teams` | None | Public team list |
| POST | `/tournaments/:id/teams` | Organizer | Create team |
| GET | `/tournaments/:id/teams/:teamId` | None | Public team detail |
| PATCH | `/tournaments/:id/teams/:teamId` | Organizer | Update team |
| DELETE | `/tournaments/:id/teams/:teamId` | Organizer | Delete team |
| GET | `/tournaments/:id/teams/scout` | None | Public scout view |
| GET | `/tournaments/:id/teams/:teamId/owner-access-lockout` | None | Check lockout status |
| POST | `/tournaments/:id/teams/:teamId/verify-access` | None | Owner verify access code |
| POST | `/tournaments/:id/teams/:teamId/owner-reset` | Organizer | Reset owner lockout |
| GET | `/tournaments/:id/team-purses` | None | Public team purse summary |

---

### 1.6 Players (`routes/players.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/players` | None | Public player list |
| POST | `/tournaments/:id/players` | Organizer | Create player |
| GET | `/tournaments/:id/players/:playerId` | None | Public player detail |
| PATCH | `/tournaments/:id/players/:playerId` | Organizer | Update player |
| DELETE | `/tournaments/:id/players/:playerId` | Organizer | Delete player |
| POST | `/tournaments/:id/players/bulk` | Organizer | Bulk create |
| POST | `/tournaments/:id/players/register/:code` | None | Public registration |
| POST | `/tournaments/:id/players/:playerId/payment-approve` | Organizer | Approve payment |
| GET | `/tournaments/:id/players/export/google-sheets` | Organizer | Google Sheets export |
| POST | `/tournaments/:id/players/:playerId/withdraw` | Organizer | Withdraw player |
| POST | `/tournaments/:id/players/:playerId/reinstate` | Organizer | Reinstate withdrawn |

---

### 1.7 Categories (`routes/categories.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/categories` | None | |
| POST | `/tournaments/:id/categories` | Organizer | |
| GET | `/tournaments/:id/categories/:catId` | None | |
| PATCH | `/tournaments/:id/categories/:catId` | Organizer | |
| DELETE | `/tournaments/:id/categories/:catId` | Organizer | |

---

### 1.8 Analytics (`routes/analytics.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/analytics/summary` | **None** | Public |
| GET | `/tournaments/:id/analytics/team-purses` | **None** | Public |
| GET | `/tournaments/:id/analytics/top-bids` | **None** | Public |
| GET | `/tournaments/:id/analytics/category-breakdown` | **None** | Public |
| GET | `/tournaments/:id/analytics/insights` | **None** | `insightsLimiter`; can call OpenAI — **SECURITY CONCERN** |

---

### 1.9 Scoring (`routes/scoring.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/scoring/events` | **None** | **SSE stream** |
| GET | `/tournaments/:id/scoring/matches` | None | |
| GET | `/tournaments/:id/scoring/matches/:matchId` | None | |
| POST | `/tournaments/:id/scoring/matches` | Organizer/Pin | |
| PATCH | `/tournaments/:id/scoring/matches/:matchId` | Organizer/Pin | |
| POST | `/tournaments/:id/scoring/matches/:matchId/events` | Organizer/Pin | Score event |
| GET | `/tournaments/:id/scoring/standings` | None | |
| GET | `/tournaments/:id/scoring/leaderboard` | None | |
| GET | `/tournaments/:id/scoring/players` | None | |
| GET | `/tournaments/:id/scoring/global-stats` | None | |

---

### 1.10 Badminton (`routes/badminton.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/badminton/stream` | **None** | **SSE stream** (optional ?matchId) |
| GET | `/tournaments/:id/badminton/matches` | None | |
| GET | `/tournaments/:id/badminton/matches/:matchId` | None | |
| POST | `/tournaments/:id/badminton/matches` | Organizer | |
| PATCH | `/tournaments/:id/badminton/matches/:matchId` | Organizer/MatchPIN | |
| POST | `/tournaments/:id/badminton/matches/:matchId/event` | Organizer/MatchPIN | |
| POST | `/tournaments/:id/badminton/matches/:matchId/umpire/*` | Organizer/MatchPIN | |
| GET | `/tournaments/:id/badminton/players` | None | |
| GET | `/tournaments/:id/badminton/courts` | None | |
| GET | `/tournaments/:id/badminton/categories` | None | |
| GET | `/tournaments/:id/badminton/registrations` | None | |
| GET | `/tournaments/:id/badminton/analytics` | None | |

---

### 1.11 Uploads (`routes/upload.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/upload` | **NONE** | **SECURITY: No auth** — uploads to Cloudinary |
| POST | `/upload/media` | **NONE** | **SECURITY: No auth** |
| POST | `/upload/audio` | **NONE** | **SECURITY: No auth** |

---

### 1.12 Settings (`routes/settings.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/settings/features` | None | Public platform feature flags |
| GET/PATCH | `/settings/installer-url` | Admin | |
| GET/PATCH | `/settings/github-ci` | Admin | |
| GET/PATCH | `/settings/audio` | Organizer | Default audio |
| GET/PATCH | `/settings/session-lock` | Master Admin | |
| GET | `/settings/buzz-studio-assets` | Organizer | |
| PATCH | `/settings/buzz-studio-assets` | Admin | |

---

### 1.13 Branding (`routes/branding.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/branding` | None | Public branding data |
| PATCH | `/branding` | Admin | Update branding |
| GET | `/branding/icon-version` | None | Public — cache buster |
| GET | `/branding/assets` | Admin | |
| POST | `/branding/assets` | Admin | |
| PATCH | `/branding/assets/:id` | Admin | |
| DELETE | `/branding/assets/:id` | Admin | |

---

### 1.14 Admin Reports (`routes/admin-reports.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/admin/reports/*` | Master Admin | `heavyLimiter`; PDF generation |

---

### 1.15 Intelligence (`routes/intelligence.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/intelligence/*` | Admin | LLM analytics, archives, export |

---

### 1.16 Showcase / Display Auctions (Marketing CMS)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/showcase/events` | None | Public marketing events |
| GET/POST/PATCH/DELETE | `/showcase/events/*` | Master Admin | CMS CRUD |
| GET | `/display-auctions` | None | Public landing page auction list |
| GET/POST/PATCH/DELETE | `/display-auctions/*` | Master Admin | CMS CRUD |

---

### 1.17 Purse Boosters (`routes/purse-boosters.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/tournaments/:id/purse-boosters` | Organizer | |
| POST | `/tournaments/:id/purse-boosters` | Organizer | |
| GET | `/tournaments/:id/teams/:teamId/purse-boosters` | None | Public team view |

---

### 1.18 Communication (`routes/comm.ts`, `routes/communication-center.ts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/tournaments/:id/comm/consent` | None | WA consent opt-in |
| GET | `/wa-consent/:token` | None | WA consent landing |
| POST | `/admin/communicate` | Master Admin | Send bulk messages |
| GET | `/communication-center/*` | Master Admin | Full communication CMS |

---

### 1.19 Seed / Demo Data

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/seed/demo` | `X-Seed-Key` header | **Security concern** — no NODE_ENV gate |

---

### 1.20 Non-API Routes (in `app.ts`)

| Path | Purpose |
|------|---------|
| `GET /healthz` | Liveness |
| `GET /og/register/:code.png` | Dynamic OG images |
| `GET /robots.txt` | SEO |
| `GET /sitemap.xml`, `/sitemap-*.xml` | SEO sitemaps |
| `GET /manifest.webmanifest` | PWA manifest |
| `GET /manifest-owner.webmanifest` | Owner app PWA manifest |
| `GET /sw.js` | Service worker (owner app) |
| `GET /branding/icon*` | Branding icon files |
| `GET /favicon.ico`, `/apple-touch-icon*` | Branding icons |
| `GET /` | Homepage SSR (with fallback to SPA) |
| `GET /academy/*` | Academy SSR |
| `GET /` (SPA fallback) | auction-platform SPA |
| `GET /owner-app/*` | owner-app SPA |
| `GET /scoring-app/*` | scoring-app SPA |

---

## 2. SSE Endpoints Summary

| Endpoint | Auth | Channel | Replay | Notes |
|----------|------|---------|--------|-------|
| `GET /api/tournaments/:id/auction/events` | None | Redis `auction:{id}` or in-memory | Yes (500-event buffer) | Main auction stream |
| `GET /api/tournaments/:id/scoring/events` | None | In-memory per match | Partial | Cricket scoring stream |
| `GET /api/tournaments/:id/badminton/stream` | None | In-memory | No | Badminton match stream |
| `GET /api/auth/admin/admin-notifications/events` | Admin | In-memory per admin | No | Admin in-app notifications |

---

## 3. Authentication Matrix

| Category | Endpoint pattern | Auth Method |
|----------|-----------------|-------------|
| Public reads | `GET /tournaments`, `GET /tournaments/:id`, `GET /teams`, `GET /players` | None |
| Live displays | `GET /auction/events`, `GET /scoring/events`, `GET /badminton/stream` | None |
| Public registration | `POST /players/register/:code` | None |
| Owner bids | `POST /auction/bid` | `accessCode` in body |
| Owner sessions | `POST /teams/:teamId/verify-access` | `accessCode` in body |
| Organizer (per-tournament) | Tournament management, players CRUD | `organizer[tournamentId]` JWT claim |
| Organizer account | Account settings, tournament create | `organizerAccountId` JWT claim |
| Scorer | Score events | `scoringPin` or organizer JWT |
| Any admin | Reports, intelligence, admin routes | `isAdmin` JWT claim |
| Master admin | License management, delete, seed | `adminLevel === 'master'` JWT claim |
| Export token | Mirror sync, workbook download | `X-Export-Token` header |

---

## 4. Security Issues Found

### HIGH

| Issue | Route | Description |
|-------|-------|-------------|
| No auth on uploads | `POST /api/upload*` | Anyone can upload to Cloudinary |
| No auth on analytics insights | `GET /analytics/insights` | Can invoke OpenAI at public user's request |
| Demo seed endpoint | `POST /api/seed/demo` | No NODE_ENV guard; uses non-timing-safe comparison |
| Twilio webhook stub mode | `POST /api/webhooks/twilio*` | Validation bypassed when TWILIO_AUTH_TOKEN unset |

### MEDIUM

| Issue | Route | Description |
|-------|-------|-------------|
| All tournaments list public | `GET /tournaments` | May expose metadata for private tournaments |
| Cricket/badminton rosters public | `GET /scoring/*`, `GET /badminton/players` | Squad data for any tournament ID |
| Scoring PIN plain compare | `POST /scoring/.../events` | Not timing-safe |
| Analytics insights rate-limit only | `GET /analytics/insights` | `insightsLimiter` per IP — bypassable with proxies |

### LOW

| Issue | Location | Description |
|-------|----------|-------------|
| CANONICAL_HOST redirect dead code | `app.ts` | Both constants are `"bidwar.in"` — redirect never fires |
| Admin password reuse | `auth.ts`, `seed-demo.ts` | Seed key = ADMIN_PASSWORD |
| Data-entry admin broad access | Various | Can access intelligence, audit, academy by design — review least privilege |

---

## 5. Rate Limiters

| Limiter | Max/Window | Applied to |
|---------|-----------|------------|
| `globalLimiter` | 2500/15min | All except auction, auth, cheer, owner, display, PATCH players/teams |
| `authLimiter` | 100/15min (500 dev) | Admin/organizer login, signup, OTP |
| `otpSendLimiter` | 8/5min | OTP send |
| `otpVerifyLimiter` | 10/15min | OTP verify |
| `exportLimiter` | 5/15min | Tournament/report exports |
| `heavyLimiter` | 10/15min | Intelligence search, admin reports |
| `cheerLimiter` | 30/min | Cheer POST |
| `pushSubscribeLimiter` | 5/10min | Web push subscribe |
| `ownerLookupLimiter` | 15/15min | Owner onboarding lookup |
| `insightsLimiter` | 30/15min | Analytics insights only |
| `contactFormLimiter` | 8/15min | Contact form |

**Bypass:** `RATE_LIMIT_DISABLED=true` disables all limiters. Auction paths always exempt from global limiter.

---

## 6. Unused / Potentially Dead API Endpoints

| Endpoint | Evidence of Disuse |
|----------|-------------------|
| `POST /api/seed/demo` | Debug/seeding endpoint; not called by any UI |
| `GET /api/intelligence/*` | Admin-only; limited UI surface — functionality driven by admin dashboard |
| `GET /api/contact` (no such route — POST only) | Fine |
| `routes/tournament-workbook.ts` | **Not mounted in routes/index.ts** — entire file is dead |

---

## 7. API Consistency Issues

| Issue | Impact |
|-------|--------|
| Mixed inline `req.jwtUser.isAdmin` vs middleware | Auth bypass risk during refactoring |
| `auction.ts` 3,400 lines | Hard to audit, test, maintain |
| Dual badminton mount (`badminton.ts` + `master-sports.ts`) | Confusing ownership of endpoints |
| Some analytics routes return different schemas than documented | OpenAPI spec may be stale |
| `ENABLE_BADMINTON` check alongside `SCORING` | Unnecessary conditional logic |

---

## 8. API Performance Observations

| Issue | Route | Impact |
|-------|-------|--------|
| `organizerNormalizedMobileTaken` loads all organizers | `POST /auth/organizer-account/signup` | O(n) memory; scales poorly |
| LLM call on public endpoint | `GET /analytics/insights` | Variable latency; external cost |
| No pagination on player/team lists | `GET /tournaments/:id/players` | Large tournaments → large payloads |
| Auction state build | `GET /api/tournaments/:id/auction` | Cached by `auction-state-build-cache.ts` |
| SSE in-process client set | All SSE endpoints | No horizontal scale without Redis |
