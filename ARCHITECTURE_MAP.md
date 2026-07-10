# BidWar Architecture Map

> Generated: July 2026 — Read-only audit. Do not modify application code based on this document without review.

---

## Table of Contents

1. [Overall Architecture](#1-overall-architecture)
2. [Repository Structure](#2-repository-structure)
3. [Data Flow](#3-data-flow)
4. [Bid Lifecycle](#4-bid-lifecycle)
5. [Authentication Flow](#5-authentication-flow)
6. [SSE (Server-Sent Events) Flow](#6-sse-flow)
7. [API Flow](#7-api-flow)
8. [Database Flow](#8-database-flow)
9. [Folder Responsibilities](#9-folder-responsibilities)
10. [Dependency Graph](#10-dependency-graph)
11. [Inter-App Communication](#11-inter-app-communication)

---

## 1. Overall Architecture

BidWar is a **pnpm monorepo** that deploys as a **single Node process** (`api-server`) serving the REST API plus pre-built static Vite SPAs. It runs on Render/Railway/VPS with PostgreSQL (Neon) and optional Redis for horizontal-scale SSE fan-out.

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRODUCTION SERVER                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              api-server (Express 5 + Node 22)              │  │
│  │  ┌──────────────────┐  ┌───────────────────────────────┐   │  │
│  │  │  REST API /api/* │  │    Static file servers        │   │  │
│  │  │  ~40 route files │  │  /           → auction-plat.  │   │  │
│  │  │  SSE endpoints   │  │  /owner-app/ → owner-app      │   │  │
│  │  │  Auth (JWT/OTP)  │  │  /scoring-app/ → scoring-app  │   │  │
│  │  └──────────────────┘  └───────────────────────────────┘   │  │
│  │         │                                                    │  │
│  │  ┌──────┴──────────────────────────────────────────────┐    │  │
│  │  │  Background Workers                                  │    │  │
│  │  │  • Creative render (Playwright → Buzz Studio PNG)    │    │  │
│  │  │  • Communication (email/SMS/WA job queue)            │    │  │
│  │  │  • Auction event subscriber (Redis pub/sub)          │    │  │
│  │  │  • Consent blast scheduler                           │    │  │
│  │  │  • Memory diagnostics                                │    │  │
│  │  └──────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │          │                            │
│              ┌────────────┘          └────────────┐              │
│              ▼                                    ▼              │
│  ┌───────────────────────┐         ┌──────────────────────────┐  │
│  │  PostgreSQL (Neon)    │         │  Redis (optional)        │  │
│  │  ~92 tables           │         │  SSE pub/sub fan-out     │  │
│  │  Drizzle ORM          │         │  Auction event buffer    │  │
│  └───────────────────────┘         └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Client Applications

| App | URL Prefix | Purpose | Stack |
|-----|-----------|---------|-------|
| `auction-platform` | `/` | Organizer portal, operator console, LED display, OBS overlays, marketing | React 19 + Wouter + TanStack Query + Tailwind v4 |
| `owner-app` | `/owner-app/` | Team owner bid interface (mobile PWA) | React 19 + Wouter + TanStack Query |
| `scoring-app` | `/scoring-app/` | Cricket + badminton scoring UI | React 19 shell; pages from auction-platform |
| `bidwar-local` | Electron desktop | Offline LAN auction server | Electron + Express + SQLite |

### Non-production Artifacts

| Path | Status | Notes |
|------|--------|-------|
| `artifacts/mockup-sandbox/` | Dev-only | Static Replit Canvas UI design tool |
| `lovableupdates/` | **DEAD** | Abandoned Lovable prototype; not in pnpm workspace |

---

## 2. Repository Structure

```
/workspace
├── artifacts/                  # Deployable applications (pnpm workspace)
│   ├── api-server/             # Express REST API + workers
│   │   ├── src/
│   │   │   ├── app.ts          # Express app + middleware chain
│   │   │   ├── index.ts        # Boot sequence + background workers
│   │   │   ├── routes/         # ~40 route modules
│   │   │   ├── lib/            # Business logic services (~200 files)
│   │   │   ├── middleware/     # JWT auth, organizer check, admin check
│   │   │   └── __tests__/      # ~60 vitest test files
│   │   ├── build.mjs           # esbuild bundle config
│   │   └── vitest.config.ts    # Test runner config
│   │
│   ├── auction-platform/       # Main SPA (React 19)
│   │   ├── src/
│   │   │   ├── App.tsx         # Root router + providers (80+ routes)
│   │   │   ├── main.tsx        # Bootstrap (SSR hydrate or createRoot)
│   │   │   ├── pages/          # ~95 page components
│   │   │   ├── components/     # ~200+ UI components
│   │   │   │   ├── ui/         # shadcn/Radix primitives
│   │   │   │   ├── display/    # LED broadcast UI
│   │   │   │   │   └── v1/     # Active production stage components
│   │   │   │   ├── broadcast/  # OBS director + overlays
│   │   │   │   │   ├── obs/    # Classic overlay
│   │   │   │   │   └── obs-lab/ # v2/lab overlay (active)
│   │   │   │   ├── badminton/  # Badminton scoring UI (served via scoring-app)
│   │   │   │   ├── scoring/    # Cricket scoring UI
│   │   │   │   └── admin/      # Admin panel components
│   │   │   ├── features/
│   │   │   │   └── buzz-studio/ # Creative media template engine
│   │   │   ├── hooks/          # ~30 custom hooks
│   │   │   ├── contexts/       # Admin notifications, PWA
│   │   │   ├── lib/            # Utilities, API clients, SSE
│   │   │   └── server-render/  # SSR entry point (homepage)
│   │   ├── vite.config.ts      # Client build
│   │   └── vite.config.ssr.ts  # SSR bundle
│   │
│   ├── owner-app/              # Team owner PWA
│   │   └── src/                # ~43 files, entry + screens + hooks
│   │
│   ├── scoring-app/            # Scoring UI shell (3 files; pages from auction-platform)
│   ├── bidwar-local/           # Electron offline desktop app
│   └── mockup-sandbox/         # Static design mockup server (dev-only)
│
├── lib/                        # Shared workspace packages
│   ├── api-base/               # Shared business logic + URLs + Vite plugins
│   ├── api-spec/               # OpenAPI spec (source for codegen)
│   ├── api-zod/                # Generated Zod schemas from OpenAPI
│   ├── api-client-react/       # Generated TanStack Query hooks (from OpenAPI)
│   ├── db/                     # PostgreSQL schema + Drizzle ORM + connection
│   ├── db-local/               # SQLite schema for bidwar-local (offline mode)
│   ├── scoring-core/           # Cricket scoring event-sourcing engine
│   ├── badminton-core/         # Badminton scoring engine
│   ├── buzz-studio-render/     # Server-side PNG render (imports auction-platform)
│   ├── cheer-presets/          # Shared cheer message constants
│   └── blog-data/              # Blog posts metadata + helpers
│
├── scripts/                    # Dev orchestration + DB migrations + one-off tools
├── docs/                       # Engineering docs (93 files)
├── EXTRAS/                     # Branding audit reports
└── lovableupdates/             # DEAD: Abandoned Lovable prototype (not in workspace)
```

---

## 3. Data Flow

### Public Registration Flow

```
User → Browser → /register/:code
    → auction-platform (SPA)
    → GET /api/tournaments (public metadata)
    → POST /api/players/register/:code (register player)
    → OG image at /og/register/:code.png (server-side)
    → PostgreSQL: players table insert
```

### Auction Display Flow (LED / Live Viewer)

```
Browser → /tournament/:id/display
    → DisplayView → TournamentCodeGate → DisplayShell
    → SSE connection: GET /api/tournaments/:id/auction/events
        ← Redis pub/sub subscriber in api-server
        ← auction_sessions table changes
    → Continuous React state updates
    → LED canvas renders (display/v1/ components)
```

### Organizer Portal Flow

```
Organizer → /organizer (login)
    → POST /api/auth/organizer-account/login (OTP or password)
    → JWT cookie: bidwar_auth (organizerAccountId claim)
    → /tournament/:id (Dashboard)
        → GET /api/tournaments/:id (tournament metadata)
        → GET /api/tournaments/:id/players (player list)
        → GET /api/tournaments/:id/teams (team list)
```

### Bid Flow

```
Team owner → /owner-app → LiveBid screen
    → SSE: GET /api/tournaments/:id/auction/events (real-time state)
    → POST /api/tournaments/:id/auction/bid
        {teamId, amount, accessCode}
        → api-server validates access code
        → Checks bid amount vs current state
        → Updates auction_sessions (current_bid, current_bid_team_id)
        → Publishes SSE event via Redis pub/sub
        → All connected displays + owner apps update instantly
```

---

## 4. Bid Lifecycle

```
State Machine: auction_sessions.status
─────────────────────────────────────────────────────────────

IDLE ──[start auction]──► READY
READY ──[select player]──► PLAYER_UP
PLAYER_UP ──[bid placed]──► BIDDING
BIDDING ──[new bid]──► BIDDING (recursive, timer resets)
BIDDING ──[timer expires]──► SOLD | UNSOLD
BIDDING ──[operator sells]──► SOLD
BIDDING ──[operator marks unsold]──► UNSOLD
SOLD ──[next player]──► PLAYER_UP
UNSOLD ──[next player / re-queue]──► PLAYER_UP
PLAYER_UP ──[conclude]──► COMPLETED
```

### Bid Validation Chain

```
POST /api/tournaments/:id/auction/bid
    1. jwtAuthMiddleware (parse JWT, non-blocking)
    2. Route handler: validate tournamentId
    3. Load current auction_sessions state
    4. Verify accessCode against team record (plain string compare)
    5. Check team.is_bidding_enabled
    6. Check bid amount ≥ current_bid + increment (purse-protection.ts)
    7. Check team purse capacity (purse-capacity.ts)
    8. Update auction_sessions (Drizzle UPDATE + Redis PUBLISH)
    9. Return {success: true, bid: amount}
```

### Sell / Unsold Flow

```
Operator action: POST .../auction/sell | .../auction/unsold
    1. requireTournamentOrganizer middleware
    2. Operator lock check (operator-lock.ts)
    3. Update players.status = 'sold' | 'unsold'
    4. If sold: deduct team purse (UPDATE teams.purse_used)
    5. Create audit log entry
    6. Publish SSE event (outcome_result)
    7. Broadcast to all displays + OBS overlays
```

---

## 5. Authentication Flow

### JWT Cookie Architecture

Three separate JWT cookies for different roles:

| Cookie | Claims | TTL | Use |
|--------|--------|-----|-----|
| `bidwar_auth` | `isAdmin`, `adminLevel`, `organizer[tournamentId]`, `organizerAccountId`, `tournamentDirector` | 7 days | All organizer/admin flows |
| `bidwar_oauth` | Google OAuth state (profile completion) | 30 min | Google login |
| `bidwar_owner` | `sessionId`, `tournamentId`, `teamId` | 7 days | Owner app sessions |

### Middleware Chain

```
All requests:
    jwtAuthMiddleware (non-blocking, populates req.jwtUser)
    → organizerAccountStatusMiddleware (loads license status)

Per-route enforcement:
    requireAdmin()        → isAnyAdmin check
    requireMasterAdmin()  → adminLevel === 'master' check
    requireTournamentOrganizer() → organizer[tournamentId] claim
    isAccountOrAdmin()    → organizerAccountId or admin
```

### Organizer Account Registration Flow

```
POST /api/auth/organizer-account/signup
    → Generate OTP → send via BulkSMS / Twilio
POST /api/auth/organizer-account/verify-otp
    → Create organizer record
    → Issue bidwar_auth JWT
    → Return session

Google OAuth path:
    GET /api/auth/google → redirect to Google
    GET /api/auth/google/callback → create/link account
    GET /api/auth/complete-profile (if new user, issue bidwar_oauth)
    PATCH /api/auth/organizer-account/complete-profile
```

### Owner App Auth Flow

```
POST /api/owner/onboarding/lookup (mobile number)
    → Returns list of tournaments with team access
POST /api/tournaments/:id/teams/:teamId/verify-access
    → Validates access code
    → Creates owner_session record
    → Issues bidwar_owner JWT
```

---

## 6. SSE Flow

### SSE Architecture

BidWar uses Server-Sent Events (not WebSockets) for all real-time communication. Four SSE endpoints exist:

```
/api/tournaments/:id/auction/events       (public)
/api/tournaments/:id/scoring/events       (public)
/api/tournaments/:id/badminton/stream     (public)
/api/auth/admin/admin-notifications/events (admin only)
```

### Auction SSE Pipeline

```
Operator action
    │
    ▼
auction-events.ts (buildAuctionEventPayload)
    │ publishes to Redis channel: "auction:{tournamentId}"
    │ (also pushes to in-process buffer: EVENT_BUFFER_MAX=500)
    │
    ▼
Redis Pub/Sub subscriber (started at boot)
    │ receives events from all api-server instances
    │
    ▼
broadcast.ts (SSE client registry: Map<tournamentId, Set<Response>>)
    │ iterates connected SSE clients for this tournament
    │ writes "id: {seq}\ndata: {...}\n\n"
    │
    ▼
Browser EventSource
    │ maintains persistent connection
    │ reconnects on disconnect (sse-reconnect.ts, exponential backoff)
    │
    ▼
sync-auction-sse.ts (state reducer in frontend)
    │ merges server events into local React state
    │
    ▼
React components re-render (Display, LiveBid, Operator)
```

### SSE Replay (Last-Event-ID)

```
Client disconnect → reconnect with Last-Event-ID header
    → api-server checks in-memory buffer (last 500 events)
    → Replays missed events from Last-Event-ID onward
    → Gap detection: if seq gap > buffer, sends full state refresh
```

### SSE Infrastructure Notes

- gzip disabled for SSE paths (buffering breaks delivery)
- Heartbeat comments every ~20s (`X-Accel-Buffering: no`)
- Without Redis: single-process in-memory fan-out only
- With Redis: multi-instance fan-out via pub/sub

---

## 7. API Flow

### Request Middleware Chain

```
HTTP Request
    │
    ├── trust proxy (1)
    ├── canonical host redirect (if ENABLE_APP_HOST_REDIRECT=true)
    ├── compression middleware (skips SSE paths)
    ├── pino-http request logging
    ├── CORS (isCorsOriginAllowed — domain allowlist)
    ├── express.json (1MB limit)
    ├── express.urlencoded
    ├── cookie-parser
    ├── jwtAuthMiddleware → populates req.jwtUser, req.oauthState
    ├── organizerAccountStatusMiddleware → req.organizerAccountLicenseStatus
    ├── globalLimiter (2500 req/15min; skips auction/auth/cheer/owner/display)
    │
    └── /api → routes/index.ts → route module handlers
```

### API Prefix Map

| Prefix | Router file | Auth scope |
|--------|-------------|-----------|
| `/api/auth/*` | `auth.ts` | Mixed (public registration, protected admin) |
| `/api/tournaments/*` | `tournaments.ts` | Public reads; organizer/admin for writes |
| `/api/tournaments/:id/auction/*` | `auction.ts` | Public SSE; organizer for controls; access-code for bids |
| `/api/tournaments/:id/teams/*` | `teams.ts` | Organizer |
| `/api/tournaments/:id/players/*` | `players.ts` | Public registration; organizer for CRUD |
| `/api/tournaments/:id/scoring/*` | `scoring.ts`, `scoring-foundation.ts` | Public reads; organizer/pin for writes |
| `/api/tournaments/:id/badminton/*` | `badminton.ts`, `master-sports.ts` | Public reads; organizer/pin for writes |
| `/api/branding/*` | `branding.ts` | Public reads; admin for writes |
| `/api/settings/*` | `settings.ts` | Admin |
| `/api/admin/*` | Various admin route files | Admin/Master admin |
| `/api/upload*` | `upload.ts` | **NONE** (security issue — see SECURITY_REPORT.md) |
| `/api/analytics/*` | `analytics.ts` | **NONE** on most (security issue) |
| `/healthz` | `health.ts` | Public |

---

## 8. Database Flow

### Schema Management (4 parallel paths — technical debt)

```
1. Drizzle Kit push (lib/db/drizzle.config.ts)
   → pnpm db:push:prod
   → Pushes Drizzle schema definitions to PostgreSQL

2. SQL migrations (lib/db/migrations/*.sql)
   → 0001_scoring_foundation.sql
   → 0002_verified_push_subscriptions.sql
   → Run via scripts/src/migrate.ts

3. Runtime DDL on module import (lib/db/src/index.ts)
   → CREATE TABLE IF NOT EXISTS
   → ALTER TABLE ADD COLUMN IF NOT EXISTS
   → Runs every time db package is imported (startup cost)

4. ensure-schema.ts (called at API boot)
   → Additional column/table gap detection
```

### Connection Architecture

```
api-server
    → lib/db (Drizzle + pg pool)
        → Neon serverless PostgreSQL (NEON_DATABASE_URL / DATABASE_URL)
        → Neon keep-alive (setInterval)
    → lib/db-local (Drizzle + libsql/SQLite) — bidwar-local only

bidwar-local Electron
    → lib/db-local (SQLite via libsql)
        → {userData}/bidwar-data/auction.db
```

### Query Patterns

```
Drizzle ORM queries (primary):
    import { db } from '@workspace/db'
    await db.select().from(tournaments).where(eq(tournaments.id, id))

Raw SQL (special cases):
    pool.query('...') for complex joins, analytics, intelligence
    
React Query on client:
    useListPlayers() → GET /api/tournaments/:id/players
    useGetTournament() → GET /api/tournaments/:id
    → TanStack Query caches + deduplicates
```

---

## 9. Folder Responsibilities

### `artifacts/api-server/src/lib/` — Service Layer

| Sub-folder / file | Responsibility |
|-------------------|----------------|
| `auction-events.ts`, `broadcast.ts`, `auction-broadcast.ts` | SSE event build + fan-out |
| `auction-state-build-cache.ts` | Cached auction state construction |
| `scoring-platform/` | Event-sourced cricket scoring projections |
| `scoring-service.ts`, `scoring-broadcast.ts` | Scoring persistence + SSE |
| `badminton-service.ts`, `badminton-broadcast.ts` | Badminton match + SSE |
| `master-sports/` | Global player profiles, branding, sync |
| `bulk-import/` | Google Sheets import, ZIP import, photo queue |
| `communication/` | Email/SMS/WA communication center (new system) |
| `admin-notifications/` | In-app admin notifications |
| `notifications/` | Legacy notification service |
| `branding-service.ts` | Branding settings read/write |
| `cloudinary-media-service.ts`, `sharp-pipeline.ts` | Image processing |
| `jwt.ts` | JWT sign/verify |
| `operator-lock.ts` | Redis/in-memory operator lock |
| `og-image/` | Server-side OG image generation |
| `tournament-insights/` | OpenAI-powered analytics briefings |
| `intelligence-*.ts` | Behavioral event analytics/AI |
| `serializers/` | Public vs private field filtering |

### `artifacts/auction-platform/src/` — Frontend

| Sub-folder | Responsibility |
|-----------|----------------|
| `pages/` | Route-level page components (95 files) |
| `components/display/` | LED broadcast UI (v1/ = active production) |
| `components/broadcast/` | OBS overlay layouts and scenes |
| `components/admin/` | Admin panel sections |
| `components/badminton/` | Badminton scoring UI (served via scoring-app) |
| `components/scoring/` | Cricket scoring UI |
| `components/ui/` | shadcn/Radix primitives |
| `features/buzz-studio/` | Creative media template system |
| `hooks/` | Custom React hooks (30) |
| `lib/` | Utilities, API clients, SSE sync, branding |
| `contexts/` | Admin notifications, PWA install |
| `server-render/` | SSR entry (homepage + academy) |

### `lib/` — Shared Packages

| Package | Responsibility |
|---------|----------------|
| `api-base` | Shared URLs, auction math, purse logic, Vite plugins |
| `api-spec` | OpenAPI YAML (source for codegen) |
| `api-zod` | Generated Zod schemas |
| `api-client-react` | Generated TanStack Query hooks |
| `db` | PostgreSQL schema + Drizzle + pool |
| `db-local` | SQLite schema for offline mode |
| `scoring-core` | Cricket event-sourcing engine |
| `badminton-core` | Badminton engine + tests |
| `buzz-studio-render` | Server-side PNG rendering (Playwright) |
| `cheer-presets` | Cheer message constants |
| `blog-data` | Blog post metadata |

---

## 10. Dependency Graph

### Package Dependencies (no circular dependencies found)

```
EXTERNAL DEPENDENCIES
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│   cheer-presets  │    │    blog-data     │    │   scoring-core │
│   (standalone)   │    │   (standalone)   │    │   (standalone)  │
└────────┬────────┘    └──────────────────┘    └───────┬────────┘
         │                                             │
         ▼                                             │
┌─────────────────┐    ┌──────────────────┐            │
│    api-base     │    │  badminton-core  │            │
│ (standalone lib)│    │   (standalone)   │            │
└────────┬────────┘    └──────────────────┘            │
         │                                             │
         ├──────────────────────────────────────────── │ ──┐
         ▼                                             │   │
┌─────────────────┐    ┌──────────────────┐            │   │
│      db         │    │   api-spec       │            │   │
│ (pg + drizzle)  │    │  (codegen only)  │            │   │
└────────┬────────┘    └──────┬───────────┘            │   │
         │                   │                         │   │
         │          codegen  ▼                         │   │
         │        ┌──────────────────┐                 │   │
         │        │    api-zod       │                 │   │
         │        └──────────────────┘                 │   │
         │                   │                         │   │
         │          codegen  ▼                         │   │
         │        ┌──────────────────┐                 │   │
         │        │ api-client-react  │                 │   │
         │        └──────────────────┘                 │   │
         │                                             │   │
         ▼                                             ▼   ▼
┌─────────────────────────────────────────────────────────────────┐
│                         api-server                              │
│  (imports: db, api-base, scoring-core, badminton-core,          │
│   cheer-presets, blog-data, api-client-react for health zod)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               auction-platform / owner-app / scoring-app        │
│  (imports: api-base, api-client-react, scoring-core,            │
│   badminton-core, cheer-presets, blog-data)                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         buzz-studio-render                      │
│  ⚠️  (imports: artifacts/auction-platform/src directly)          │
│  → Boundary violation: lib → artifact                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                           db-local                              │
│  (standalone SQLite schema — imported by bidwar-local only)     │
└─────────────────────────────────────────────────────────────────┘
```

### Known Boundary Violation

`lib/buzz-studio-render` imports React components directly from `artifacts/auction-platform/src/`. This is an inverted dependency (lib should not depend on artifact). The practical risk is that changes to auction-platform template paths can break the server-side render worker silently.

---

## 11. Inter-App Communication

### Cloud Mode (Production)

```
Browser Clients ──────────────────────────────────────► api-server
                    REST /api/*
                    SSE /api/*/events

auction-platform ──[Vite proxy in dev]──► api-server
owner-app        ──[Vite proxy in dev]──► api-server
scoring-app      ──[Vite proxy in dev]──► api-server
```

### Local Mode (Electron / LAN)

```
LAN Clients
    → Browser → [Electron port 3741] → bidwar-local Express
                    → SQLite auction.db (lib/db-local)
                    → In-memory SSE fan-out
                    → Optional: POST /mirror → cloud api-server
                    → Optional: POST /sync   → cloud api-server

Electron main
    → forks dist-server/index.js
    → loads renderer/index.html (connection kit UI)
    → IPC: get-local-ip, open-browser, open-external
```

### bidwar-local → Cloud Sync

```
POST {cloud}/api/tournaments/:id/auction/mirror
    (requires export token header)
    → Syncs live display state to cloud during local auction

POST {cloud}/api/tournaments/:id/sync
    → After-event sync: copies local SQLite state to cloud DB
```

---

## Appendix: Scoring App Alias Architecture

The `scoring-app` is a thin Vite entry-point shell that re-uses all auction-platform source code:

```
scoring-app/vite.config.ts:
    resolve.alias['@'] = '../auction-platform/src'

scoring-app/src/App.tsx:
    lazy(() => import('@/pages/scoring-match'))        // ← auction-platform page
    lazy(() => import('@/pages/badminton/scorer'))     // ← auction-platform page

scoring-app/src/index.css:
    @import '../auction-platform/src/index.css'        // ← reuses Tailwind config
    @source '../auction-platform/src/**/*'             // ← scans auction-platform for classes
```

This means all scoring/badminton pages are maintained in `auction-platform/src/pages/`, but routed under `/scoring-app/` base path.
