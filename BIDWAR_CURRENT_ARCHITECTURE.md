# BIDWAR — CURRENT ARCHITECTURE
### Forensic Audit Report
**Status:** Current-state documentation only. Not a target or frozen architecture.
**Date:** 2026-09-24
**Method:** Direct code inspection, schema analysis, route mapping, subagent parallel forensic investigation.
**Scope:** Complete repository at `d:\bidwar`

---

> **IMPORTANT — Read Before Using This Document**
> This document describes WHAT EXISTS in the BIDWAR codebase today, verified against actual source code.
> It is NOT an approved architecture. It is NOT a frozen design. It is NOT a recommended architecture.
> The architecture described here contains legacy systems, partially migrated code, and acknowledged inconsistencies.
> This document is Phase 1 of a larger architecture process.

---

## TABLE OF CONTENTS

1. [Repository Inventory](#1-repository-inventory)
2. [Monorepo Structure](#2-monorepo-structure)
3. [System Hierarchy](#3-system-hierarchy)
4. [Identity and Member Architecture](#4-identity-and-member-architecture)
5. [Authentication and Authorization](#5-authentication-and-authorization)
6. [Tournament Architecture](#6-tournament-architecture)
7. [Team Architecture](#7-team-architecture)
8. [Player Architecture](#8-player-architecture)
9. [Auction Architecture](#9-auction-architecture)
10. [Sports Platform Architecture](#10-sports-platform-architecture)
11. [Cricket — Deep Forensic Analysis](#11-cricket--deep-forensic-analysis)
12. [Cricket Match Lifecycle](#12-cricket-match-lifecycle)
13. [Cricket Scoring Engine](#13-cricket-scoring-engine)
14. [Cricket Ball-by-Ball Final Trace](#14-cricket-ball-by-ball-final-trace)
15. [Badminton Architecture](#15-badminton-architecture)
16. [Scoreboard and Projection Architecture](#16-scoreboard-and-projection-architecture)
17. [Realtime Architecture](#17-realtime-architecture)
18. [API Architecture](#18-api-architecture)
19. [Frontend Architecture](#19-frontend-architecture)
20. [Shared Libraries](#20-shared-libraries)
21. [Database Architecture](#21-database-architecture)
22. [Database Migration Architecture](#22-database-migration-architecture)
23. [Audit and Logging Architecture](#23-audit-and-logging-architecture)
24. [Test Architecture](#24-test-architecture)
25. [Deployment Architecture](#25-deployment-architecture)
26. [Legacy / Duplicate / Parallel Architecture](#26-legacy--duplicate--parallel-architecture)
27. [Source of Truth Matrix](#27-source-of-truth-matrix)
28. [Domain Dependency Graph](#28-domain-dependency-graph)
29. [Cross-Domain Coupling](#29-cross-domain-coupling)
30. [State Ownership](#30-state-ownership)
31. [Current Architectural Risks](#31-current-architectural-risks)
32. [Documentation vs. Actual Implementation](#32-documentation-vs-actual-implementation)
33. [Unknown / Unverified Architecture Register](#33-unknown--unverified-architecture-register)
34. [Complete Current Architecture Map](#34-complete-current-architecture-map)
35. [Evidence Index](#35-evidence-index)
36. [Confidence Model Summary](#36-confidence-model-summary)

---

## 1. REPOSITORY INVENTORY

### Root Directory: `d:\bidwar`

```
d:\bidwar\
├── artifacts/                  ← Deployable applications (8 packages)
│   ├── api-server/             ← Main Express backend API (PRIMARY)
│   ├── auction-platform/       ← Auction + marketing + organizer web app (PRIMARY)
│   ├── scoring-app/            ← Scorer/umpire web application (PRIMARY)
│   ├── owner-app/              ← Team owner bidding PWA (PRIMARY)
│   ├── bidwar-local/           ← Electron offline auction app (PREMIUM FEATURE)
│   ├── mobile-app/             ← Capacitor Android wrapper
│   ├── mockup-sandbox/         ← Design mockup environment (DEV ONLY)
│   └── tmp/                    ← Temporary files
│
├── lib/                        ← Shared TypeScript libraries (23 packages)
│   ├── db/                     ← Cloud PostgreSQL (Neon) schema + ORM (PRIMARY)
│   ├── db-local/               ← SQLite schema for offline mode
│   ├── auth/                   ← Owner auth helpers
│   ├── scoring-core/           ← Cricket/Badminton scoring engine
│   ├── sports-cricket/         ← Cricket sport re-export (minimal)
│   ├── sports-badminton/       ← Badminton sport (UNKNOWN STATUS)
│   ├── sports-football/        ← Football sport (UNKNOWN - likely placeholder)
│   ├── auction/                ← Auction business logic helpers
│   ├── platform-core/          ← Member/identity platform (NEWER)
│   ├── player-registry/        ← Global player registry
│   ├── api-spec/               ← OpenAPI YAML specification
│   ├── api-base/               ← Shared API types, owner URL helpers
│   ├── api-client-react/       ← React Query API client (Orval-generated)
│   ├── api-zod/                ← Zod validation schemas
│   ├── shared-ui/              ← Shared React UI components
│   ├── branding/               ← Branding assets
│   ├── buzz-studio-render/     ← Broadcast/studio rendering (DEAD - see §26)
│   ├── notifications/          ← Push notification utilities
│   ├── analytics/              ← Analytics helpers
│   ├── media/                  ← Cloudinary media utilities
│   ├── blog-data/              ← Static blog/academy content
│   ├── badminton-core/         ← Badminton core logic
│   └── cheer-presets/          ← Auction cheer message presets
│
├── scripts/                    ← Development, migration, verification scripts
├── docs/                       ← Design documents / specs
├── standalone/                 ← External standalone apps
│   └── bpl-kids-registration/  ← Standalone registration form (ISOLATED)
├── updatedbidwarcore/          ← External project (bidwar-core)
│   └── bidwar-core/            ← UNKNOWN — appears separate project
├── EXTRAS/                     ← Extra files (unknown purpose)
└── [many .md documents]        ← Internal documentation, reports, ADRs
```

### Technology Stack Summary

| Layer | Technology |
|---|---|
| Package Manager | pnpm 9.15.0 (workspace) |
| Runtime | Node.js 22 |
| Language | TypeScript ~5.9 |
| Frontend Framework | React 19, Vite 7 |
| Frontend Routing | wouter 3.x |
| Frontend State | TanStack Query v5 |
| Backend Framework | Express.js |
| Database (cloud) | PostgreSQL via Neon (serverless) |
| Database (local) | SQLite via better-sqlite3 |
| ORM | Drizzle ORM 0.45.2 |
| Schema Validation | Zod 3.25 |
| Realtime | Server-Sent Events (SSE) |
| Cache / Pub-Sub | Redis (Upstash) |
| Auth | Custom JWT (HTTP-only cookies) |
| File Storage | Cloudinary |
| Email | Resend |
| SMS/WhatsApp | BulkSMS, Twilio |
| Build (API) | esbuild |
| Build (frontend) | Vite |
| Styling | Tailwind CSS v4 |
| Deployment | Docker / Render.com / Railway |

---

## 2. MONOREPO STRUCTURE

**Package Manager:** pnpm 9.15.0
**Workspace Configuration:** `pnpm-workspace.yaml`
**Workspace Packages:**
- `artifacts/*` — Deployable applications
- `lib/*` — Shared libraries
- `lib/integrations/*` — Integration packages
- `scripts` — Dev tooling

**Build System:**
1. `pnpm run typecheck` → TypeScript type checking across all packages
2. `pnpm run build:deploy` → Builds all packages (TypeScript libs then Vite frontends)
3. API server uses esbuild (see `artifacts/api-server/build.mjs`)
4. Frontends use Vite

**Root Scripts (from `package.json`):**
- `dev` → delegates to `@workspace/scripts`
- `start` → `migrate:prod` then runs Node on `artifacts/api-server/dist/index.mjs`
- `migrate:prod` → Drizzle migrations on production

---

## 3. SYSTEM HIERARCHY

The following hierarchy is derived from actual code, not documentation.

```
BIDWAR
│
├── Platform / Identity Layer [PARTIALLY IMPLEMENTED]
│   ├── members table             ← Canonical human identity (new)
│   ├── member_auth_identities    ← Auth methods per member (new)
│   ├── member_sessions           ← Session store (new)
│   ├── member_roles              ← Extensible role assignments (new)
│   ├── member_sport_profiles     ← Per-sport identity attributes (new)
│   ├── tournament_participations ← Member ↔ Tournament ↔ Role mapping (new)
│   │
│   ├── organizers table          ← Legacy organizer identity (ACTIVE, legacy)
│   └── global_players table      ← Cross-tournament player identity (ACTIVE, migrating)
│
├── Tournament Domain [IMPLEMENTED]
│   ├── tournaments table         ← Tournament configuration (single table, very wide)
│   ├── teams table               ← Tournament-scoped teams
│   ├── players table             ← Tournament-scoped player registration
│   ├── categories table          ← Auction/division categories
│   ├── sports table              ← Sport registry
│   └── scoring_fixtures table    ← Optional scheduling container for matches
│
├── Auction Domain [IMPLEMENTED]
│   ├── auction_sessions          ← Live auction state (one per tournament)
│   ├── bids                      ← Bid history
│   ├── purse_boosters            ← Purse boost events
│   ├── auction_bid_events        ← Intelligence event log (append-only)
│   ├── auction_player_events     ← Player auction history (append-only)
│   └── auction_timer_events      ← Timer history (append-only)
│
├── Scoring Domain [IMPLEMENTED]
│   ├── scoring_matches           ← Match records (sport-agnostic header)
│   ├── scoring_events            ← Append-only event store (SOURCE OF TRUTH)
│   ├── scoring_sessions          ← Projected scoreboard cache (derived)
│   ├── scoring_match_player_stats← Per-player per-match stats (projected)
│   ├── scoring_match_squads      ← Playing XI per match
│   ├── scoring_fixtures          ← Optional fixture scheduling
│   ├── scoring_draws             ← Draw/bracket containers
│   ├── scoring_groups            ← Group-stage containers
│   ├── scoring_venues            ← Venue registry
│   ├── scoring_officials         ← Match officials (umpires, referees)
│   ├── scoring_standings         ← Tournament standings (projected)
│   ├── scoring_leaderboard_snapshots ← Leaderboard snapshots
│   ├── scoring_player_awards     ← Man of match, etc.
│   └── scoring_dls_calculations  ← DLS calculation records
│
├── Cricket-Specific [IMPLEMENTED — within Scoring Domain]
│   └── All scoring_events with sportSlug = "cricket"
│       Reducer: lib/scoring-core/src/cricket/reducer.ts
│
├── Badminton Domain [IMPLEMENTED — separate schema]
│   ├── badminton_players         ← Extended badminton player profiles
│   ├── badminton_courts          ← Physical courts
│   ├── badminton_categories      ← Tournament event types (Singles, Doubles)
│   ├── badminton_registrations   ← Player entries per category
│   ├── badminton_draws           ← Fixture collections (draw containers)
│   ├── badminton_fixtures        ← Fixtures within a draw
│   └── badminton_match_details   ← Extended match info
│
├── Scorer Identity [IMPLEMENTED — separate from Member system]
│   ├── scorer_accounts           ← Mobile + PIN auth (legacy, active)
│   ├── scorer_sessions           ← Active sessions
│   ├── scorer_match_locks        ← One active lock per match
│   ├── scorer_audit_log          ← Scoring business audit trail
│   └── scorer_tournament_assignments ← Tournament access control
│
├── Communication [IMPLEMENTED]
│   ├── comm.ts / communication.ts tables
│   ├── push_subscriptions        ← Web push subscriptions
│   ├── admin_notifications       ← System notifications
│   └── notifications table
│
├── Audit / Logging [IMPLEMENTED]
│   ├── platform_audit_events     ← Platform-wide append-only audit
│   ├── scorer_audit_log          ← Scoring-specific audit
│   ├── entity_audit_logs (audit_logs) ← Field-level audit
│   └── auction_bid_events        ← Auction-specific intelligence log
│
├── Configuration History [IMPLEMENTED]
│   ├── competition_configuration_history
│   ├── match_configuration_history
│   ├── team_configuration_history
│   ├── scheduling_configuration_history
│   └── fixture_configuration_history
│
├── Media / External [IMPLEMENTED]
│   ├── branding_assets / branding
│   ├── bulk_import / bulk_import_photo_items
│   ├── google_sheet_syncs
│   └── workbook_mapping_profiles / workbook_versions
│
├── BidWar Local (Offline) [IMPLEMENTED — premium feature]
│   ├── SQLite database (subset of cloud schema)
│   ├── Electron wrapper
│   ├── Export/sync token mechanism
│   └── Mirror polling system
│
└── Academy / Blog [IMPLEMENTED]
    └── academy.ts, blog_data package
```

---

## 4. IDENTITY AND MEMBER ARCHITECTURE

### Current Reality: Dual Identity System

BIDWAR currently has **two co-existing identity systems** — an older system (organizers, scorer_accounts) and a newer platform-core identity system (members). Both are **active in production**.

### System A — Legacy Identity (ACTIVE)

**Organizer Identity:**
```
organizers table
├── id (serial PK)
├── name, email, mobile
├── passwordHash (scrypt)
├── googleId, googleEmail (OAuth)
├── licenseStatus, maxTournaments
└── whatsappConsent, phoneVerified
```
- File: `lib/db/src/schema/organizers.ts`
- Auth: Email/password or Google OAuth → JWT cookie `bidwar_auth`
- One organizer can own multiple tournaments via `tournaments.organizerId`

**Scorer Identity:**
```
scorer_accounts table
├── id (serial PK)
├── name, mobile
├── pinHash (scrypt)
└── isActive

scorer_sessions table
├── id (text PK)
├── scorerId → scorer_accounts.id
└── expiresAt, revokedAt
```
- File: `lib/db/src/schema/scorer_accounts.ts`
- Auth: Mobile + 4-digit PIN → Bearer JWT token
- Completely separate from organizer identity

**Team Owner Identity:**
```
owner_sessions table
├── id (serial PK)
├── teamId, tournamentId
└── expiresAt
```
- File: `lib/db/src/schema/owner_sessions.ts`
- Auth: Access code verification → `bidwar_owner` HTTP-only cookie
- Session-scoped, not a named person identity

### System B — New Platform Identity (PARTIALLY IMPLEMENTED)

**Member (canonical person):**
```
members table
├── id (text PK, format: mem_<32hex>)
├── displayName, firstName, lastName
├── primaryMobile, primaryEmail
├── isMobileVerified, isEmailVerified
├── dob, gender, country, state, city
└── accountStatus (active|suspended|pending_verification|deactivated)
```
- File: `lib/db/src/schema/members.ts`
- Comment: "Canonical future platform-level human identity."

**Auth Identities (per member):**
```
member_auth_identities table
├── id (serial PK)
├── memberId → members.id
├── provider (password|google|phone_otp|apple)
├── providerSubject
├── normalizedIdentifier
├── passwordHash (scrypt)
└── isVerified, isEnabled
```

**Member Sessions:**
```
member_sessions table
├── id (text PK)
├── memberId → members.id
└── expiresAt
```

**Member Roles (extensible):**
```
member_roles table
├── id (serial PK)
├── memberId → members.id
├── role (organizer|player|scorer|umpire|team_owner|coach|...)
├── scope (global|tournament|team|match)
├── tournamentId (nullable) → tournaments.id
├── teamId (nullable) → teams.id
└── matchId (nullable) → scoring_matches.id
```

**Member Sport Profiles:**
```
member_sport_profiles table
├── id (serial PK)
├── memberId → members.id
├── sportSlug (cricket|badminton|...)
├── primaryRole, secondaryRole
├── handedness
└── profileJson (extensible)
```

**Tournament Participation:**
```
tournament_participations table
├── id (serial PK)
├── tournamentId → tournaments.id
├── memberId → members.id
├── role (player|scorer|team_owner|organizer|...)
├── status (active|withdrawn|disqualified|completed)
└── teamId (nullable) → teams.id
```

### Global Player Registry (Third System, ACTIVE - migrating)

```
global_players table
├── id (text PK, format: gp_XXXXXX)
├── canonicalName, firstName, lastName
├── mobileNumber (unique dedup key)
├── sport (DEPRECATED - use player_sport_profiles)
├── defaultRole (DEPRECATED)
├── handedness (DEPRECATED)
└── auctionPlayerId (DEPRECATED)
```
- File: `lib/db/src/schema/global_players.ts`
- Multiple `@deprecated` fields documented in the schema itself
- Active linking: `players.globalPlayerId → global_players.id`

### Actual Identity Relationship Graph

```
organizers (LEGACY — ACTIVE)
    ↓ organizerId
tournaments
    ↓ tournamentId
players (tournament-scoped, auction-era)
    ↓ globalPlayerId (nullable)
global_players (cross-tournament identity, migrating)
    ↓ masterPlayerId (nullable)
player_sport_profiles (new)

members (NEW CANONICAL — partially connected)
    ↓ memberId
member_auth_identities (multi-provider auth)
member_sessions
member_roles (scoped roles)
member_sport_profiles
tournament_participations ← new linking table

scorer_accounts (LEGACY — ACTIVE, separate from members)
    ↓ scorerId
scorer_sessions
scorer_tournament_assignments
scorer_match_locks
```

### Key Findings

**IMPLEMENTED:**
- Both identity systems exist and are active
- New `members` system has full schema: identity + auth + roles + sport profiles + participations
- Legacy `organizers` system handles all organizer auth in the current API
- Legacy `scorer_accounts` handles all scorer auth in the current API

**CRITICALLY OBSERVED:**
- The new `members` system schema exists but its **API integration is unclear** — the primary auth routes (`auth.ts`) predominantly use the `organizers` table. Whether `members` table is actively populated in production API requests requires further verification.
- A single person operating as organizer AND scorer would have **two disconnected identity records** in the current system.
- Identity fragmentation is an acknowledged architectural risk (see §31).

**CONFIDENCE:** MEDIUM — Schema confirmed by direct file inspection. Runtime activation of `members` system in production API flow: UNKNOWN / NOT FULLY VERIFIED.

---

## 5. AUTHENTICATION AND AUTHORIZATION

### Authentication Mechanisms

#### Organizer Authentication
- **Method:** Email/password OR Google OAuth
- **Token:** HTTP-only cookie `bidwar_auth` (signed JWT)
- **JWT Claims:** `{ isAdmin, adminLevel, organizerAccountId, ... }`
- **Storage:** Stateless JWT — no session table for organizers
- **File:** `artifacts/api-server/src/routes/auth.ts` (110 KB — fat route)

#### Scorer Authentication
- **Method:** Mobile number + 4-digit PIN (hashed with scrypt)
- **Token:** Bearer JWT in `Authorization` header
- **Session:** Stored in `scorer_sessions` table (stateful, with expiry)
- **Rate limiting:** Brute-force protection on PIN attempts
- **File:** `artifacts/api-server/src/routes/scorer.ts`

#### Team Owner Authentication
- **Method:** Access code lookup (tournament + team specific)
- **Token:** HTTP-only cookie `bidwar_owner`
- **Session:** `owner_sessions` table (stateful, with expiry)
- **Frontend:** `sessionStorage` flag `owner_verified_${teamId}` for frontend routing
- **File:** `lib/auth/src/owner-auth.ts`

#### Admin Authentication
- **Method:** Derived from organizer JWT with elevated `adminLevel` claim
- **No separate admin accounts** — admins are organizers with elevated claims

#### Public Access
- Many read endpoints are unauthenticated (viewer/display screens, public scoreboards, public auction display)

### Authorization Middleware Stack (per request)

```
Request
   ↓
globalLimiter (rate limit all requests)
   ↓
jwtAuthMiddleware (decode bidwar_auth cookie → req.jwtUser)
   ↓
organizerAccountStatusMiddleware (check organizer not suspended)
   ↓
Route-specific guards:
   ├── requireAdmin / requireMasterAdmin (admin level check)
   ├── requireTournamentOrganizer (tournament ownership check)
   ├── resolveScorerAuthFromToken (scorer session DB check)
   └── verifyOwnerSession (owner cookie + DB check)
```

### Authorization Enforcement

**Organizer Routes:** Checked by `requireTournamentOrganizer` — verifies:
1. JWT present
2. `organizerAccountId` matches `tournament.organizerId` OR `isAdmin = true`
3. Organizer license not suspended

**Scorer Routes:** Checked by `resolveScorerAuthFromToken`:
1. Bearer token valid
2. `scorer_sessions` row exists and not expired/revoked
3. `scorer_tournament_assignments` — if tournament has assignments, scorer must be assigned

**Operator Lock:** Active auction operator enforced via `operator-lock.ts` (Redis or in-memory). Only one operator tab per tournament can perform live mutations.

**Match Lock:** Only one scorer per match via `scorer_match_locks` table. One lock per `matchId`.

### Security Observations (Not Recommendations)

1. **Frontend sessionStorage gate:** `owner_verified_${teamId}` in sessionStorage controls owner-side UI routing. The actual API requires the `bidwar_owner` cookie. The sessionStorage can be manipulated in browser devtools to bypass frontend routing, though API calls would still fail without the cookie.

2. **Scorer system is isolated from Members system:** A scorer must be a `scorer_accounts` record, not a `members` record.

3. **No Better Auth:** Despite `better-auth-best-practices` skill existing in the workspace, Better Auth is NOT implemented. Auth is entirely custom JWT.

---

## 6. TOURNAMENT ARCHITECTURE

### The `tournaments` Table

```
tournaments
├── id (serial PK)
├── organizerId → organizers.id
├── name, sport (text), sportId (nullable → sports.id)
├── auctionCode (unique 8-char, e.g. "RC732504")
├── venue, city, auctionDate, auctionTime
│
├── Auction Configuration (inline — many columns)
│   ├── basePurse, minBid, bidIncrement
│   ├── bidTier1/2/3 settings
│   ├── timerSeconds, bidTimerSeconds
│   ├── bidExtensionEnabled/threshold/seconds
│   ├── ownerBiddingEnabled
│   ├── playerSelectionMode
│   └── auctionUnit (rupee|points)
│
├── Registration Settings
│   ├── registrationDeadline, registrationLimit
│   ├── enableRegistrationPayment, registrationFee
│   ├── playerRegistrationMode (auction|scoring)
│   └── registrationFieldsJson
│
├── Product Modules ← KEY ARCHITECTURAL FIELDS
│   ├── auctionEnabled (boolean, default true — backward compat bridge)
│   └── scoringEnabled (boolean, default false)
│
├── Scoring Settings
│   ├── scoringPhase (disabled|...)
│   ├── scoringPin (optional delegate PIN for V1 scoring without JWT)
│   └── scoringSettingsJson
│
├── Feature Flags
│   └── featuresJson (JSON, per-tournament feature flags)
│
├── Catalog Bindings (EPIC-01 — newer)
│   ├── variantId, competitionTypeId
│   ├── ruleProfileId, ruleProfileVersion
│   ├── presentationProfileId, presentationProfileVersion
│   ├── registrationModeId, teamFormationStrategyId
│   └── businessStageId
│
├── License / Admin Controls
│   ├── licenseStatus (trial|active|...)
│   ├── adminLocked
│   └── resetCount, lastResetAt
│
├── Audio / Display Settings (auction)
│   ├── audioEnabled, masterVolume
│   ├── countdownSound, soldSound, breakEndMusic
│   └── cheerMessages settings
│
├── BidWar Local
│   ├── localModeEnabled
│   ├── exportToken, exportTokenExpiresAt
│   └── exportTokenSyncedAt, exportTokenLastMirrorAt
│
└── createdAt, updatedAt
```

**File:** `lib/db/src/schema/tournaments.ts`

### Observations

1. The `tournaments` table is **extremely wide** — 70+ columns, embedding auction configuration, scoring configuration, registration, audio, branding, licensing, and feature flags all in one table.
2. `sport` (text) is the primary sport field. `sportId` (nullable FK to `sports`) is a Phase 2 dynamic reference — **nullable for backward compatibility**.
3. `auctionEnabled` defaults to `true` with an explicit code comment: *"NOTE: default(true) is strictly a backward-compatibility database bridge for legacy rows. It is NOT a permanent business default."*
4. No separate `Competition` or `Season` table exists as a first-class entity for cricket tournaments at this level.

### Tournament Hierarchy (Actual)

```
Tournament (tournaments table)
    │
    ├── Teams (teams table, tournamentId FK)
    │   └── Players (players table, teamId FK — after auction)
    │
    ├── Players (players table, tournamentId FK — registration)
    │
    ├── Categories (categories table, tournamentId FK)
    │
    ├── [Auction]
    │   └── auction_sessions (1:1 per tournament)
    │       └── bids (many per session)
    │
    └── [Scoring]
        ├── scoring_fixtures (optional scheduling)
        │   └── scoring_matches (matchId, fixtureId nullable)
        │       └── scoring_events (the event store)
        │
        └── scoring_draws / scoring_groups (badminton-specific)
```

---

## 7. TEAM ARCHITECTURE

### The `teams` Table

```
teams
├── id (serial PK)
├── tournamentId (FK → tournaments.id)
├── name, shortCode, displayName
├── ownerName, ownerMobile, ownerEmail
├── ownerPhotoUrl
├── color, secondaryColor, logoUrl
├── masterTeamId (text → master_teams, nullable — cross-tournament identity)
├── teamTypeId (catalog ref, default "competitive")
├── themeJson
├── lifecycleStatus (draft|...)
├── configurationLocked
├── purse (integer, auction purse balance)
├── purseUsed (integer, spent)
├── isBiddingEnabled
├── accessCode (team owner access code)
├── coachName, coachMobile
└── whatsappConsent fields
```

**Unique constraint:** `(tournamentId, ownerMobile)` — one owner per tournament per mobile

### Team Relationships

- Teams are **tournament-scoped** — no global team entity exists at the primary level
- `masterTeamId` is a nullable reference to a `master_teams` table (cross-tournament identity for the same physical team) — this table's schema was not located in `lib/db/src/schema/` during this audit
- Players are linked to teams via `players.teamId` (set after auction sale)
- Scorer match squads are stored in `scoring_match_squads`

### Team Purse

- `teams.purse` — total purse allocated
- `teams.purseUsed` — spent amount
- `purse_boosters` table — additional purse allocations

**Concurrency note:** Purse deduction happens in the auction bid flow. The bid flow uses optimistic concurrency via `auction_sessions.revision`.

---

## 8. PLAYER ARCHITECTURE

### Three Coexisting Player Representations

#### 1. Tournament Player (`players` table) — PRIMARY for auction/scoring
```
players
├── id (serial PK)
├── tournamentId (FK, NOT NULL)
├── serialNo (unique per tournament)
├── categoryId (nullable)
├── teamId (nullable, set after auction sale)
├── name, city, role, battingStyle, bowlingStyle, age, gender
├── photoUrl, photoOriginalUrl
├── basePrice, selectedBidValue, soldPrice, retainedPrice
├── status (available|sold|unsold|retained)
├── jerseyNumber, jerseySize
├── mobileNumber, email, cricheroUrl
├── globalPlayerId (nullable → global_players.id)
├── playerTag, isNonPlayingMember
└── registrationPaymentStatus
```

This is the operational player record. It is tournament-scoped. One physical person playing in 3 tournaments = 3 rows.

#### 2. Global Player (`global_players` table) — Cross-tournament identity
```
global_players
├── id (text PK, "gp_*")
├── canonicalName, mobileNumber (unique dedup key)
├── sport (DEPRECATED), defaultRole (DEPRECATED), handedness (DEPRECATED)
├── auctionPlayerId (DEPRECATED)
└── Multiple sport-agnostic demographic fields
```

The `players.globalPlayerId` links a tournament player to this global identity. **This link is nullable** — many players have no global identity record.

#### 3. Member + Sport Profile (NEW — platform-core)
```
members → member_sport_profiles
```

This is the new canonical model but is **not yet the primary path** for player registration/scoring.

#### 4. Badminton Players (`badminton_players` table)
```
badminton_players
├── id (serial PK)
├── tournamentId (FK)
├── masterPlayerId (text → global_players.id, nullable)
├── globalPlayerId (integer, DEPRECATED)
├── bwfCode (BWF federation code)
└── Extended demographics + rankings
```

Badminton has its own player table, separate from the cricket-era `players` table.

### Player Flow (Cricket auction scenario)

```
Physical Person
    ↓ Registers (mobile number)
players (tournament-scoped, status=available)
    ↓ [Optional] auto-linking by mobile
global_players (cross-tournament identity)
    ↓ Auction runs
players.teamId = winning team
players.status = sold
players.soldPrice = bid amount
    ↓ [Scoring phase]
scoring_match_squads (matchId, playerId, teamId)
    ↓ [Match complete]
scoring_match_player_stats (per-player batting/bowling/fielding stats)
```

---

## 9. AUCTION ARCHITECTURE

### Auction State Machine

**Tables:** `auction_sessions` (1:1 per tournament), `bids`, `players`, `teams`

```
auction_sessions.status values:
    idle → active → (paused ↔ active) → completed
```

**Player status in `players.status`:**
```
    available → (in auction) → sold | unsold | retained
```

### The `auction_sessions` Table (Key State)

```
auction_sessions
├── id (serial PK)
├── tournamentId (unique FK — one session per tournament)
├── status (idle|active|paused|completed)
├── currentPlayerId → players.id (player currently on block)
├── currentBid (integer)
├── currentBidTeamId → teams.id
├── timerSeconds, timerEndsAt, timerType
├── lastAction (text, human-readable last event)
├── lastOutcome (JSON snapshot for display)
├── isBreak, breakEndsAt
├── fortuneWheelActive, wheelSpinning
├── teamPurseViewActive
├── displayOverlay, obsContextJson (OBS context)
├── deferredPlayerIds, randomDrawQueue
├── reAuctionStrategyJson
├── soldPlayersCount, unsoldPlayersCount
├── revision (monotonically incrementing — optimistic concurrency)
└── updatedAt
```

### Bid Flow (Verified)

```
1. Operator: POST /api/tournaments/:id/auction/bid
   (or Team Owner via owner-app: POST to same endpoint)
2. Auth: JWT cookie (organizer) or bidwar_owner cookie (owner)
3. Validation:
   - auctionSession.status === "active"
   - currentPlayerId exists
   - bidAmount >= current + bidIncrement
   - team purse sufficient
   - ownerBiddingEnabled check for owner bids
4. DB Transaction:
   - INSERT into bids (tournamentId, playerId, teamId, amount)
   - UPDATE auction_sessions SET currentBid, currentBidTeamId, revision++ WHERE revision = $expectedRevision
   - If revision conflict → 409 (concurrency rejection)
5. Fire-and-forget: INSERT into auction_bid_events (intelligence log)
6. Redis Pub/Sub publish on channel "auction:event:<tournamentId>"
7. SSE fans out updated auction state to all connected clients
```

### Realtime: Auction

- **Transport:** SSE at `GET /api/tournaments/:id/auction/events`
- **Broker:** Redis Pub/Sub (Upstash Redis)
- **Fallback:** In-memory event emitter when Redis unavailable
- **Clients:** auction-platform (organizer view), owner-app (team owners), display screens (LED/OBS)

### Concurrency Control

- `auction_sessions.revision` — monotonically incrementing integer
- Every bid and next-player write does `WHERE revision = $current_revision`
- If another write arrived first, the UPDATE affects 0 rows → 409 Conflict

### Post-Auction Player Handoff to Scoring

Function `handoffAuctionParticipantsToSports(tournamentId)` copies sold players to scoring-compatible structures. This is the bridge between Auction and Scoring domains.

### Operator Lock

- Redis key (or in-memory map): one active operator tab per tournament
- Controls live mutations (bid, next player, sold/unsold)

### Buzz Studio

- **STATUS: DEAD** — `isBuzzStudioEnabled()` hardcoded to `return false`
- Replaced by OBS overlay routes (`obs-overlay.tsx`)
- Evidence: `lib/buzz-studio-render/` package exists but is effectively dormant

### Intelligence Event Logs (auction_events.ts)

Three append-only tables for AI/analytics:
- `auction_bid_events` — every live bid with timing and sequence
- `auction_player_events` — player lifecycle (in_progress, sold, unsold, deferred)
- `auction_timer_events` — timer interactions

**Engineering contract:** Writes are fire-and-forget, failures silently swallowed. Never in the hot bid path.

---

## 10. SPORTS PLATFORM ARCHITECTURE

### Sport Registry

```
sports table
├── id (serial PK)
├── slug (text, e.g. "cricket", "badminton")
├── name, description
└── isActive
```

### Shared Infrastructure

The following is shared across sports:
- `scoring_matches` (sport-agnostic header record)
- `scoring_events` (append-only event store, `sportSlug` field distinguishes sport)
- `scoring_sessions` (projected state cache)
- `scoring_fixtures`, `scoring_draws`, `scoring_groups` (scheduling)
- Scorer authentication system (`scorer_accounts`, `scorer_sessions`, `scorer_match_locks`)
- SSE realtime broadcast infrastructure

### Sport-Specific Implementation

| Component | Cricket | Badminton |
|---|---|---|
| Player table | `players` (shared with auction) | `badminton_players` (separate) |
| Reducer | `lib/scoring-core/src/cricket/reducer.ts` | «UNKNOWN» |
| Event types | `CricketEventType` (14 types) | «UNKNOWN» |
| Score model | Runs/wickets/overs | Sets/points |
| DB details | All in `scoring_events.payloadJson` | `badminton_match_details` |
| Route | `scoring.ts` | `badminton.ts` |

### Football

- `lib/sports-football/` directory exists
- No schema tables found for football in `lib/db/src/schema/`
- **STATUS: UNKNOWN — possibly a placeholder or planned**

### Module Enablement

Determined by `tournaments.scoringEnabled` (boolean) + sport validation at API layer.

---

## 11. CRICKET — DEEP FORENSIC ANALYSIS

### Data Hierarchy (Actual Implementation)

```
Tournament (tournaments table)
    │ tournamentId
    ↓
Scoring Match (scoring_matches table)
    │ matchId
    ↓
Scoring Session (scoring_sessions table) ← PROJECTED CACHE
    │ + ↓ (rebuilt from)
Scoring Events (scoring_events table) ← SOURCE OF TRUTH
    │
    └── Each event has payloadJson containing:
        For BALL_RECORDED events:
        ├── innings (number, 1-4)
        ├── over (number, 0-based)
        ├── ball (number, 1-6)
        ├── strikerId (playerId)
        ├── nonStrikerId (playerId, nullable)
        ├── bowlerId (playerId)
        ├── runsOffBat (0-20)
        ├── extras { type, runs }
        ├── wicket { type, dismissedPlayerId, fielderId }
        ├── isLegalDelivery (boolean)
        └── isSuperBall (boolean, optional)
```

### Key Finding: There Is No "Ball" Table or "Innings" Table or "Over" Table

Cricket data lives as follows:

| Concept | Where it lives |
|---|---|
| **Ball / Delivery** | Row in `scoring_events` where `eventType = "cricket.ball.recorded"`, data in `payloadJson` |
| **Innings** | Derived field in reducer state — exists as `CricketInningsState` in `scoring_sessions.stateJson` |
| **Over** | Implicit — derived from ball's `over` number; NOT a separate DB entity |
| **Match** | `scoring_matches` row |
| **Score** | Computed by reducer from events; cached in `scoring_sessions.stateJson` |

### Event Types (14 total)

```typescript
CricketEventType = {
  MATCH_STARTED:       "cricket.match.started",
  LINEUP_SET:          "cricket.lineup.set",
  BALL_RECORDED:       "cricket.ball.recorded",
  INNINGS_ENDED:       "cricket.innings.ended",
  MATCH_COMPLETED:     "cricket.match.completed",
  BALL_UNDONE:         "cricket.ball.undone",
  MATCH_ABANDONED:     "cricket.match.abandoned",
  MATCH_INTERRUPTED:   "cricket.match.interrupted",
  MATCH_RESUMED:       "cricket.match.resumed",
  DLS_APPLIED:         "cricket.dls.applied",
  PENALTY_AWARDED:     "cricket.penalty.awarded",
  PLAYER_RETIRED:      "cricket.player.retired",
  SUPER_BALL_DECLARED: "cricket.super_ball.declared",
  SUPER_OVER_STARTED:  "cricket.super_over.started",
}
```

### Supported Dismissal Types (from `DISMISSAL_TYPES` constant)

- `bowled`, `caught`, `run_out`, `stumped`, `lbw`, `hit_wicket`
- `timed_out`, `obstructing_field`, `hit_ball_twice`, `retired_out`

### Supported Extra Types

- `wide`, `no_ball`, `bye`, `leg_bye`, `penalty`

### Special Features

- **Super Ball** (`isSuperBall`): Custom rule — doubles bat runs (2x). Declared separately, used once per innings per team. Cannot be used in powerplay or with one batsman available.
- **Free Hit** (`freeHitEnabled`): After no-ball, next delivery is free hit. Limited dismissal types allowed.
- **LBW** (`lbwEnabled`): Can be disabled per match rules.
- **Leg Bye** (`legByeEnabled`): Can be disabled per match rules.
- **DLS** (`DLS_APPLIED` event): Revised overs + target applied.
- **Super Over** (`SUPER_OVER_STARTED`): innings 3 or 4, custom overs/wickets limits.
- **Playing XI Enforcement** (`playingXiEnforced`): Players must be in configured lineup.

---

## 12. CRICKET MATCH LIFECYCLE

### Match Lifecycle States (Actual)

**`scoring_matches.lifecycleStatus` values:**
```
draft → [configured] → live → completed | abandoned
```

**`scoring_matches.executionPhase` values (EPIC-08):**
```
preparing → [started] → ...
```

**`scoring_matches.status` values:**
```
scheduled → live → completed | abandoned
```

**`CricketScoreboardState.matchStatus` (in-memory/projected):**
```
scheduled → live → completed | abandoned
```

**`CricketScoreboardState.sessionStatus` (in-memory/projected):**
```
idle → live ↔ paused
```

### Transitions (via reducer and events)

| Event | Transition |
|---|---|
| `cricket.match.started` | matchStatus: "scheduled" → "live"; sessionStatus: "idle" → "live" |
| `cricket.match.interrupted` | sessionStatus: "live" → "paused" |
| `cricket.match.resumed` | sessionStatus: "paused" → "live" |
| `cricket.innings.ended` (innings=1) | Creates innings 2 state, sets target |
| `cricket.innings.ended` (innings=2) | Does not auto-complete (separate MATCH_COMPLETED event needed) |
| `cricket.match.completed` | matchStatus: → "completed"; sessionStatus: → "idle" |
| `cricket.match.abandoned` | matchStatus: → "abandoned"; sessionStatus: → "idle" |
| `cricket.super_over.started` | Creates super over innings (3 or 4) |

### Validation on Ball Recording

The reducer enforces (when `enforceLiveRules = true`):
- Match not interrupted (sessionStatus ≠ "paused")
- Innings matches current innings
- Innings is in_progress
- Wickets not exceeded unless only one batsman
- Target not already reached
- Overs limit not exceeded
- Players must be in Playing XI (if enforced)
- Leg bye/LBW checks per match rules
- Free hit dismissal restrictions
- Super Ball restrictions

---

## 13. CRICKET SCORING ENGINE

### Architecture: Event Sourcing with Reducer

```
scoring_events (append-only, Postgres)
    ↓ resolveEventsForReplay() [removes BALL_UNDONE tombstones]
    ↓ replayEvents()
    ↓ reduceCricket() [pure function: (state, event) → state]
    ↓
CricketScoreboardState (in-memory)
    ↓ cached as
scoring_sessions.stateJson (Postgres JSONB)
```

### The Reducer (`lib/scoring-core/src/cricket/reducer.ts`)

Pure function: `reduceCricket(state, event, options?) → state`

Handles all 14 event types. State transitions are deterministic and reproducible from the event stream.

### Scorecard Projection (`lib/scoring-core/src/cricket/scorecard.ts`)

Computed separately from the reducer state. Reads all `BALL_RECORDED` events to build:
- `BattingCardRow[]` (runs, balls, fours, sixes, strikeRate, dismissal)
- `BowlingCardRow[]` (overs, maidens, runs, wickets, economy)
- `FallOfWicket[]`
- `InningsExtras`

### Player Statistics (`scoring_match_player_stats` table)

Projected at match completion. Contains:
- `battingJson: { runs, balls, fours, sixes, strikeRate, notOut, dismissalType }`
- `bowlingJson: { overs, maidens, runs, wickets, wides, noBalls, economy }`
- `fieldingJson: { catches, runOuts, stumpings }`

### Undo Mechanism

- Undo emits a `cricket.ball.undone` event with `{ undoesEventId, undoesSequence }`
- During replay, `resolveEventsForReplay()` removes the target event and the BALL_UNDONE marker
- The reducer itself never receives BALL_UNDONE (throws if it does)
- **Compensation pattern** — events are never deleted from `scoring_events`

### Scoring API Routes (`artifacts/api-server/src/routes/scoring.ts`)

Key endpoints (verified by file size: 33KB, significant):
```
POST /tournaments/:id/scoring/matches/:matchId/events  ← Record event
GET  /tournaments/:id/scoring/events                   ← SSE stream
GET  /tournaments/:id/scoring/matches/:matchId         ← Get state + events
GET  /tournaments/:id/scoring/live                     ← Public snapshot
```

---

## 14. CRICKET BALL-BY-BALL FINAL TRACE

### Question: Where does a cricket ball live?

**Direct Answer:** A cricket ball (delivery) is a **row in `scoring_events`** where `eventType = "cricket.ball.recorded"`. The ball's complete data lives in `payloadJson` (JSONB). There is no separate "ball" table, no "innings" table, and no "over" table.

### Complete Trace: Scorer records "4 runs off bat"

```
Step 1: SCORER UI
  File: artifacts/scoring-app/src/... (UI component)
  Action: User taps "4" on scoring screen
  Creates: HTTP POST request body:
  {
    eventType: "cricket.ball.recorded",
    payload: {
      innings: 1,
      over: 2,
      ball: 3,
      strikerId: 45,
      nonStrikerId: 67,
      bowlerId: 89,
      runsOffBat: 4,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true
    }
  }

Step 2: API ROUTE HANDLER
  File: artifacts/api-server/src/routes/scoring.ts
  Route: POST /tournaments/:tournamentId/scoring/matches/:matchId/events
  Auth:  resolveScorerAuthFromToken() validates scorer JWT
  Lock:  scorer_match_locks verified — this scorer holds the match lock

Step 3: SERVICE / ORCHESTRATOR
  File: artifacts/api-server/src/lib/scoring-service.ts
              and scoring orchestrator
  Action: appendScoringEvent()
    1. Load scoring_sessions row (lock row with SELECT FOR UPDATE)
    2. Verify sequence number (lastEventSeq + 1 must be monotonic)
    3. Parse payload via parseCricketEventPayload() [Zod validation]
    4. Trial reduction: reduceCricket(currentState, newEvent, {enforceLiveRules:true})
       → Validates live rules (not paused, innings matches, etc.)
       → Throws InvalidEventPayloadError if invalid

Step 4: PERSIST
  DB Transaction:
    INSERT INTO scoring_events (
      matchId, tournamentId, sportSlug,
      eventType, eventVersion, sequence,
      occurredAt, recordedAt,
      actorType, actorId,
      payloadJson: { innings:1, over:2, ball:3, strikerId:45,
                     nonStrikerId:67, bowlerId:89, runsOffBat:4,
                     extras:{type:null,runs:0}, wicket:null,
                     isLegalDelivery:true }
    )
    
    UPDATE scoring_sessions SET
      stateJson = <new CricketScoreboardState as JSON>,
      lastEventSeq = <sequence>
    WHERE matchId = :matchId
    
    UPDATE scoring_matches SET
      status = 'live',
      currentProjectionVersion = <sequence>
    WHERE id = :matchId

Step 5: BROADCAST
  File: artifacts/api-server/src/lib/scoring-broadcast.ts
  Action: broadcastScoringState(matchId, tournamentId)
    → Reads updated state from scoring_sessions
    → SSE push: { type: "scoring_state", data: { match, state, summary } }
    → All SSE clients on /tournaments/:id/scoring/events receive update

Step 6: CLIENT RECEIVES
  scoring-app frontend (scorer)
  + Any viewer clients subscribed to SSE
  → React Query cache updated
  → UI re-renders showing 4 runs on scoreboard
```

### Ball Identity Map

| Attribute | Where Stored |
|---|---|
| Unique ID | `scoring_events.id` (bigserial) |
| Per-match sequence | `scoring_events.sequence` (UNIQUE constraint with matchId) |
| Match reference | `scoring_events.matchId` → `scoring_matches.id` |
| Tournament reference | `scoring_events.tournamentId` |
| Sport | `scoring_events.sportSlug` |
| Innings number | `payloadJson.innings` |
| Over number | `payloadJson.over` |
| Ball number | `payloadJson.ball` |
| Striker | `payloadJson.strikerId` → `players.id` |
| Non-striker | `payloadJson.nonStrikerId` → `players.id` |
| Bowler | `payloadJson.bowlerId` → `players.id` |
| Runs off bat | `payloadJson.runsOffBat` |
| Extra type | `payloadJson.extras.type` |
| Extra runs | `payloadJson.extras.runs` |
| Wicket type | `payloadJson.wicket.type` (nullable) |
| Dismissed player | `payloadJson.wicket.dismissedPlayerId` (nullable) |
| Fielder | `payloadJson.wicket.fielderId` (nullable) |
| Legal delivery flag | `payloadJson.isLegalDelivery` |
| Super Ball flag | `payloadJson.isSuperBall` (optional) |
| Recorded by | `scoring_events.actorType`, `actorId` |
| Timestamp | `scoring_events.occurredAt`, `recordedAt` |
| Correlation | `scoring_events.correlationId` (UUID, nullable) |
| Causation (undo) | `scoring_events.causationId` (nullable → parent event) |

### Undo of a Ball

```
SCORER clicks UNDO
  ↓
POST /scoring/matches/:matchId/events
  { eventType: "cricket.ball.undone",
    payload: { undoesEventId: 123, undoesSequence: 45 } }
  ↓
INSERT into scoring_events (type: cricket.ball.undone, ...)
  ↓
resolveEventsForReplay() called:
  → Finds all BALL_UNDONE events
  → Removes the target ball event + the BALL_UNDONE tombstone
  ↓
replayCricketEvents() from start → new state (without undone ball)
  ↓
scoring_sessions.stateJson updated with replayed state
  ↓
SSE broadcast updated state
```

### Score Reconstruction

Score can be fully reconstructed at any time by:
1. `SELECT * FROM scoring_events WHERE matchId = :id ORDER BY sequence`
2. `resolveEventsForReplay(events)` — remove undo tombstones
3. `replayCricketEvents(meta, events)` — replay through reducer

---

## 15. BADMINTON ARCHITECTURE

### Status: IMPLEMENTED (separate from cricket architecture)

### Separate Schema

Badminton has its own tables in `lib/db/src/schema/badminton.ts`:
- `badminton_players` — extended player profiles (BWF code, rankings, handedness)
- `badminton_courts` — physical courts in a tournament
- `badminton_categories` — event definitions (Men's Singles, Mixed Doubles, etc.)
- `badminton_registrations` — player entries per category
- `badminton_draws` — Fixture Collections (draw containers per category)
- `badminton_fixtures` — Fixtures within a draw (Player A vs Player B)
- `badminton_match_details` — Extended match info beyond `scoring_matches`

### Relationship to Shared Scoring

Badminton matches use the shared `scoring_matches` table for the match header. Badminton-specific scoring events would use the shared `scoring_events` table with `sportSlug = "badminton"`, but the scoring reducer for badminton was **not located** during this audit.

### API Route

`artifacts/api-server/src/routes/badminton.ts` (133 KB — very large, indicating significant implementation)

### Product Naming (from schema comments)

The schema explicitly maps:
- "Fixture Collection" → `badminton_draws`
- "Fixture" → `badminton_fixtures`
- "Category" → `badminton_categories`

### Badminton Player Identity

- `badminton_players.masterPlayerId` → `global_players.id` (new canonical link)
- `badminton_players.globalPlayerId` (integer, DEPRECATED)
- Has BWF code, world ranking, national ranking

---

## 16. SCOREBOARD AND PROJECTION ARCHITECTURE

### State Authority

```
scoring_events (APPEND-ONLY — SOURCE OF TRUTH)
    ↓ replayCricketEvents() / reduceCricket()
scoring_sessions.stateJson (PROJECTED CACHE — derived, NOT authoritative)
    ↓ read by
SSE broadcast → all clients
```

### The `scoring_sessions.stateJson`

- Explicit schema comment: *"state_json is derived from scoring_events — never the source of truth"*
- Contains full `CricketScoreboardState` as JSONB
- Updated on every event append (within same transaction)
- Contains: match status, session status, innings array, current batters, bowler, this-over balls, target, free hit state, etc.

### Scorecard (Not in stateJson)

The scorecard (batting card rows, bowling card rows) is **re-projected from raw events** each time it's requested. It is NOT cached in the session. It reads all `BALL_RECORDED` events and accumulates stats.

### Player Stats (`scoring_match_player_stats`)

A separate materialized projection written at match completion. Contains structured batting/bowling/fielding JSON per player per innings.

### Potential Stale State Vectors

1. `scoring_sessions.stateJson` — could be stale if DB write succeeded but state update failed (within same transaction, low risk)
2. Client SSE stream — could miss events if disconnected (SSE reconnect uses `Last-Event-ID`, behavior on reconnect unclear)
3. `scoring_matches.summaryJson` — separate summary projection, sync with events unclear

---

## 17. REALTIME ARCHITECTURE

### Protocol: Server-Sent Events (SSE) Only

No WebSockets are used anywhere in BIDWAR. All realtime is SSE (one-way server push over HTTP).

### Auction Realtime

```
Bid/Action written to DB
    ↓
Redis Pub/Sub publish: "auction:event:<tournamentId>"
    ↓ (fan-out via Redis subscriber on each Node process)
SSE connections at GET /api/tournaments/:id/auction/events
    ↓ sends to:
    ├── auction-platform (organizer view)
    ├── owner-app (team owners)
    └── display screens (LED/OBS/viewer)
```

**Redis fallback:** In-memory event emitter used when Redis unavailable.

### Scoring Realtime

```
Event appended to scoring_events
    ↓
broadcastScoringState() in scoring-broadcast.ts
    ↓
SSE connections at GET /tournaments/:id/scoring/events
    ↓ sends to:
    ├── scoring-app (active scorer)
    └── viewer apps / display
```

**SSE Payload:** `{ type: "scoring_state", data: { match, state, summary } }`

### Admin Notifications Realtime

```
SSE at /admin-notifications/events
```

### SSE and Compression

Express `compression` middleware is active globally but **deliberately skips SSE paths** to prevent proxy buffering from breaking the stream.

### Reconnection

SSE clients support `Last-Event-ID` header for reconnection. The server behavior on reconnect (whether it replays missed events or sends current state only) was **not fully traced** during this audit.

**CONFIDENCE:** MEDIUM on reconnection behavior.

### Multi-Client Behavior

- Multiple clients can subscribe to the same SSE stream
- Clients are purely receivers — they cannot send data over SSE
- Multiple scorer tabs: only one holds the match lock (`scorer_match_locks`). Others can view but not score.
- Multiple auction operator tabs: Redis-backed operator lock allows only one active operator.

---

## 18. API ARCHITECTURE

### Architecture Pattern: Fat Routes (No Controllers/Services Layer)

The `api-server` does NOT use a classical Controller → Service → Repository pattern. Business logic lives directly in route files (`artifacts/api-server/src/routes/*.ts`).

Utility functions exist in `artifacts/api-server/src/lib/` but are not uniformly organized as services.

### Route Map (Verified from directory listing)

| Route File | Domain |
|---|---|
| `auth.ts` (110KB) | All authentication: organizer login, Google OAuth, scorer auth, owner auth |
| `auction.ts` (146KB) | All auction operations: bids, next player, sold/unsold, SSE, display |
| `scoring.ts` (33KB) | Cricket scoring: events, SSE, live view, OBS director |
| `badminton.ts` (133KB) | Badminton scoring and management |
| `tournaments.ts` (59KB) | Tournament CRUD, settings, module configuration |
| `players.ts` (80KB) | Player registration, import, management |
| `teams.ts` (29KB) | Team management |
| `categories.ts` | Auction categories |
| `global-players.ts` | Global player registry |
| `scorer.ts` | Scorer account management, match locks |
| `master-sports.ts` | Sports catalog management |
| `intelligence.ts` (76KB) | AI/analytics intelligence |
| `admin-reports.ts` (43KB) | Admin reporting |
| `webhooks.ts` (34KB) | Webhook handlers |
| `comm.ts` (40KB) | Communications (WhatsApp, SMS) |
| `scoring-foundation.ts` | Scoring module setup (fixtures, draws, groups) |
| `match-foundation.ts` | Match creation and configuration |
| `fixture-foundation.ts` | Fixture management |
| `team-foundation.ts` | Team lifecycle foundation |
| `runtime-match-foundation.ts` | Runtime match preparation (EPIC-08) |
| `scheduling-foundation.ts` | Match scheduling |
| `competition.ts` | Competition configuration |
| `catalog.ts` | Platform catalog |
| `rule-engine.ts` | Rule engine |
| `presentation-engine.ts` | Presentation engine |
| `branding.ts` | Tournament branding assets |
| `purse-boosters.ts` | Auction purse boosters |
| `display-auctions.ts` | Public display auction endpoints |
| `audit.ts` | Audit log queries |
| `analytics.ts` | Analytics data |
| `settings.ts` | Tournament settings |
| `upload.ts` | File upload (Cloudinary) |
| `google-sheets.ts` | Google Sheets sync |
| `notifications.ts` / `push.ts` | Push notifications |
| `academy-lessons.ts` | Academy content |
| `showcase.ts` | Public showcase pages |
| `health.ts` | Health check |
| `diagnostics.ts` | System diagnostics |
| `seed-demo.ts` | Demo data seeding |

### API Request Flow

```
Frontend
    ↓ HTTP request (fetch with credentials)
Express middleware stack:
  globalLimiter → cors → compression → cookieParser → pinoHttp → jwtAuthMiddleware → organizerAccountStatusMiddleware
    ↓
Route handler (fat route in routes/*.ts)
    ↓ direct Drizzle ORM calls
Database (Neon PostgreSQL)
    ↓
Response
```

### Business Logic Location

Business logic is **inside route handlers**. There is no consistent service layer. Some utility functions exist in `src/lib/` (e.g., `scoring-service.ts`, `scoring-broadcast.ts`, `operator-lock.ts`, `cloudinary-media-service.ts`).

---

## 19. FRONTEND ARCHITECTURE

### Application Inventory

| Application | Path | Purpose | Status |
|---|---|---|---|
| `auction-platform` | `/` | Main marketing, organizer admin, auction operator, public viewer | ACTIVE (PRIMARY) |
| `scoring-app` | `/scoring-app/` | Scorer and umpire interface | ACTIVE (PRIMARY) |
| `owner-app` | `/owner-app/` | Team owner bidding PWA | ACTIVE |
| `mobile-app` | `/mobile/` | Capacitor Android wrapper | ACTIVE |
| `bidwar-local` | Electron desktop app | Offline premium auction | ACTIVE (premium) |
| `mockup-sandbox` | dev only | Design mockups | DEV ONLY |

All web applications share:
- React 19
- Vite 7
- wouter (routing)
- TanStack Query v5 (server state)
- Tailwind CSS v4

### State Management

- **Server state:** TanStack Query (fetching, caching, invalidation)
- **UI state:** React local state (`useState`, `useReducer`)
- **No global state manager** (no Redux, no Zustand, no Jotai) — confirmed by lack of such packages in workspace catalog
- **URL state:** wouter provides URL params

### API Client

- Library: `@workspace/api-client-react`
- Generated from `lib/api-spec/openapi.yaml` using Orval
- Wraps TanStack Query hooks
- Custom fetch in `custom-fetch.ts` handles credentials and error mapping

### Realtime (Frontend)

- SSE via `EventSource` browser API
- Reconnection handled by browser's built-in `EventSource` reconnect with `Last-Event-ID`
- Scoring SSE and Auction SSE initialized separately

### Static Serving (Production)

Single Express server serves all frontend assets:
- `/` → auction-platform/dist/public
- `/owner-app/` → owner-app/dist/public
- `/scoring-app/` → scoring-app/dist/public
- `/mobile/` → mobile-app/dist/public

Assets are Brotli + Gzip compressed (`express-static-gzip`).

### SEO / SSR

The API server injects Open Graph / meta tags server-side for public pages (tournament pages, scorecard pages, academy pages). This is a partial SSR / HTML injection approach, not full Next.js SSR.

### BidWar Local (Electron)

- Electron shell wrapping a Vite React app
- Local Express server runs inside Electron
- Local SQLite database (separate from cloud)
- Export token mechanism for data sync with cloud
- Premium paid feature (controlled by `tournaments.localModeEnabled`)

---

## 20. SHARED LIBRARIES

| Library | Purpose | Consumers | Status |
|---|---|---|---|
| `@workspace/db` | Cloud Postgres schema + Drizzle ORM | api-server, scripts | ACTIVE |
| `@workspace/db-local` | SQLite schema for offline | bidwar-local | ACTIVE |
| `@workspace/scoring-core` | Cricket/Badminton reducer + scorecard | api-server, scoring-app | ACTIVE |
| `@workspace/auction` | Auction business logic helpers | api-server, auction-platform | ACTIVE |
| `@workspace/auth` | Owner auth helpers | api-server, owner-app | ACTIVE |
| `@workspace/platform-core` | Member/identity services | api-server (partially) | PARTIALLY ACTIVE |
| `@workspace/player-registry` | Global player registry helpers | api-server | PARTIALLY ACTIVE |
| `@workspace/api-spec` | OpenAPI YAML | api-client-react (codegen) | ACTIVE |
| `@workspace/api-base` | Shared API types, URL helpers | All frontends + server | ACTIVE |
| `@workspace/api-client-react` | Generated React Query hooks | All web frontends | ACTIVE |
| `@workspace/api-zod` | Zod validators | All packages | ACTIVE |
| `@workspace/shared-ui` | React UI components | All web frontends | ACTIVE |
| `@workspace/branding` | Branding assets | api-server | ACTIVE |
| `@workspace/notifications` | Push notification utils | api-server | ACTIVE |
| `@workspace/analytics` | Analytics helpers | api-server | ACTIVE |
| `@workspace/media` | Cloudinary media utils | api-server | ACTIVE |
| `@workspace/blog-data` | Static blog/academy content | api-server | ACTIVE |
| `@workspace/buzz-studio-render` | Broadcast studio render | NONE (dead) | DEAD |
| `@workspace/sports-cricket` | Cricket re-export (lib/sports-cricket) | Minimal | PARTIALLY ACTIVE |
| `@workspace/sports-badminton` | Badminton sport | api-server? | UNKNOWN |
| `@workspace/sports-football` | Football sport | NONE | PLACEHOLDER |
| `@workspace/badminton-core` | Badminton core logic | api-server | UNKNOWN |
| `@workspace/cheer-presets` | Auction cheer presets | auction-platform | ACTIVE |

### Domain Boundary Script

`scripts/check-domain-boundaries.mjs` — A script exists to enforce domain boundary checks. **Status of this script's effectiveness:** UNKNOWN without running it.

---

## 21. DATABASE ARCHITECTURE

### Cloud Database: Neon PostgreSQL

**Connection:** `DATABASE_URL` environment variable (Neon pooled connection, ap-southeast-1)
**ORM:** Drizzle ORM 0.45.2
**Dialect:** `drizzle-orm/pg-core`

### Complete Table Inventory (71+ tables)

**Identity & Auth:**
- `members`, `member_auth_identities`, `member_sessions`, `member_roles`, `member_sport_profiles`
- `organizers` (legacy)
- `scorer_accounts`, `scorer_sessions`, `scorer_match_locks`, `scorer_audit_log`, `scorer_tournament_assignments`
- `owner_sessions`
- `tournament_participations`
- `member_identity_links` (cross-linking)

**Tournament Core:**
- `tournaments`, `teams`, `players`, `categories`, `sports`

**Player Registry:**
- `global_players`, `player_sport_profiles`, `player_spec_values`, `player_import_logs`

**Auction:**
- `auction_sessions`, `bids`, `purse_boosters`, `display_auctions`
- `auction_bid_events`, `auction_player_events`, `auction_timer_events`

**Cricket Scoring:**
- `scoring_matches`, `scoring_events`, `scoring_sessions`
- `scoring_match_player_stats`, `scoring_match_squads`
- `scoring_fixtures`, `scoring_draws`, `scoring_groups`
- `scoring_venues`, `scoring_officials`
- `scoring_standings`, `scoring_leaderboard_snapshots`
- `scoring_player_awards`, `scoring_dls_calculations`
- `runtime_match_history`

**Badminton:**
- `badminton_players`, `badminton_courts`, `badminton_categories`
- `badminton_registrations`, `badminton_draws`, `badminton_fixtures`
- `badminton_match_details`

**Configuration History:**
- `competition_configuration_history`, `match_configuration_history`
- `team_configuration_history`, `scheduling_configuration_history`
- `fixture_configuration_history`

**Audit/Logging:**
- `platform_audit_events` (append-only, bigserial PK)
- `entity_audit_logs` (field-level audit, stored as `audit_logs`)
- `scorer_audit_log`

**Communication:**
- `comm` and `communication` tables (jobs, templates)
- `push_subscriptions`, `notifications`, `admin_notifications`

**Media/Content:**
- `branding`, `branding_assets`, `photo_source_assets`, `bulk_import`, `bulk_import_photo_items`

**Other:**
- `settings`, `clients`, `google_sheet_syncs`
- `workbook_mapping_profiles`, `workbook_versions`
- `showcase`, `contact_inquiries`
- `academy` (lessons), `intelligence_archive`
- `tournament_license_requests`

### Local Database: SQLite (bidwar-local)

**Dialect:** `drizzle-orm/sqlite-core`
**Tables (~10):** `tournaments`, `teams`, `players`, `categories`, `bids`, `auction_sessions`, `sync_queue`, `purse_boosters`, `venue_snapshots`
**Type differences:** boolean → integer(mode:"boolean"), timestamp → text(ISO), jsonb → text(JSON string)
**Extra fields:** `cloudId`, `cloudBaseUrl`, `exportToken` for sync coordination

### Key Relationships

```
organizers.id ←── tournaments.organizerId
tournaments.id ←── teams.tournamentId
tournaments.id ←── players.tournamentId
teams.id       ←── players.teamId
players.id     ←── global_players.id (via players.globalPlayerId)
tournaments.id ←── auction_sessions.tournamentId (UNIQUE)
tournaments.id ←── scoring_matches.tournamentId
scoring_matches.id ←── scoring_events.matchId
scoring_matches.id ←── scoring_sessions.matchId (UNIQUE)
scoring_matches.id ←── scoring_match_player_stats.matchId
scoring_fixtures.id ←── scoring_matches.fixtureId (nullable)
members.id ←── member_auth_identities.memberId
members.id ←── member_roles.memberId
members.id ←── member_sport_profiles.memberId
members.id ←── tournament_participations.memberId
tournaments.id ←── tournament_participations.tournamentId
```

---

## 22. DATABASE MIGRATION ARCHITECTURE

### Migration Files (21 SQL migrations)

Located in `lib/db/migrations/`:
```
0001_scoring_foundation.sql
0002_verified_push_subscriptions.sql
0003_tournaments_city.sql
0004_badminton_court_scorer.sql
0005_scorer_module.sql
0006_organizer_phone_verification.sql
0007_scorer_tournament_assignments.sql
0008_badminton_league_groups.sql
0009_badminton_tournament_engine.sql
0010_badminton_standings_enrichment.sql
0011_badminton_promoted_knockout_draw.sql
0012_tournament_catalog_bindings.sql
0013_platform_epic_foundation.sql
0014_scoring_player_registration.sql
0015_owner_bidding_enabled.sql
0016_academy_thumbnail_url.sql
0017_clients.sql
0018_tournament_auction_enabled.sql
0019_canonical_member_schema.sql
0020_canonical_member_auth.sql
0021_tournament_licensing.sql
```

### Migration Governance — Hybrid Mode

**For Development/Staging:**
- `lib/db/src/ensure-schema.ts` (50KB) — Contains idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` DDL for auto-healing schema
- Applied on server boot in dev/staging

**For Production (Neon):**
- Validate-only mode on boot
- Schema drift check: Drizzle metadata vs live DB
- If critical drift detected (missing tables/columns) → server refuses to start
- Migrations must be applied explicitly via Drizzle Kit
- Root script: `pnpm run migrate:prod` → runs Drizzle migrator

**Schema Governance Scripts:**
- `scripts/schema-drift-audit.mjs` — Three-way diff: Drizzle schema ↔ Boot DDL ↔ Live prod
- `scripts/schema-drift-vs-prod.mjs` — Production drift check
- `scripts/verify-schema-governance.mjs` — Governance verification

### Schema Authority Problem

Two independent schema declarations exist:
1. `lib/db/src/schema/*.ts` — Drizzle schema (authoritative for type-generation and migrations)
2. `lib/db/src/ensure-schema.ts` — Manual DDL (authoritative for dev/staging auto-healing)

These two can drift. Documented as a known risk in `RUNTIME_DDL_ANALYSIS.md` and `SCHEMA_GOVERNANCE.md`.

**Verdict: The 21 SQL migration files are the production schema authority for Neon. The `ensure-schema.ts` bootstrap DDL is the dev/staging authority. These could diverge.**

---

## 23. AUDIT AND LOGGING ARCHITECTURE

### Audit Systems (Three Separate Mechanisms)

#### 1. Platform Audit Events (`platform_audit_events`)
- **Table:** `platform_audit_events` (bigserial PK, append-only)
- **Contract:** INSERT-only from application code
- **Captures:** eventCategory, eventAction, eventSeverity, outcome
- **Actor:** actorType (organizer|scorer|admin|system|owner), actorId, actorLabel, actorIp, sessionId
- **Resource:** resourceType, resourceId, tournamentId, teamId, playerId
- **Data:** summary, reason, beforeJson, afterJson, changesJson, requestMethod, requestPath
- **Features:** alertKey, monitoringFlagsJson (rule-based alert scoring), exportable flag
- **Searchable:** Multiple indexes (by tournament, actor, resource, category, severity, time)
- **Immutable:** By engineering contract (no UPDATE/DELETE in application code; not enforced at DB level)
- **File:** `lib/db/src/schema/platform_audit.ts`

#### 2. Scorer Audit Log (`scorer_audit_log`)
- **Table:** `scorer_audit_log`
- **Contract:** Business audit trail for scorer / organizer scoring actions
- **Captures:** actorType, actorId, scorerId, sessionId, tournamentId, matchId, sport, action, payload
- **File:** `lib/db/src/schema/scorer_accounts.ts`
- **Purpose:** Specific to scoring actions (lock acquisition, event recording, undo, etc.)

#### 3. Entity Audit Logs (`audit_logs`)
- **Table:** `entity_audit_logs` (stored as `audit_logs`)
- **Purpose:** Field-level audit for entity mutations (bulk import, rollback, manual update)
- **Captures:** entityType, entityId, fieldName, oldValue, newValue, action, performedBy, ipAddress, jobId
- **File:** `lib/db/src/schema/entity-audit-logs.ts`

#### 4. Auction Intelligence Logs (append-only analytics)
- `auction_bid_events` — Every bid placed
- `auction_player_events` — Player auction lifecycle
- `auction_timer_events` — Timer interactions
- **NOT** a security audit log — designed for AI/analytics use

### Application Logging

- Framework: `pino` + `pino-http` (structured JSON logging)
- Logger: `artifacts/api-server/src/lib/logger.ts`
- Log output: stdout (structured JSON)
- No centralized log aggregation configured in the repository (Render/Railway would handle this)

### Audit Trail Capability

**Can an action be traced to a human?**

| Action | Traceable? | Evidence |
|---|---|---|
| Organizer login | PARTIALLY | `platform_audit_events` if implemented; JWT has `organizerAccountId` |
| Scorer PIN login | YES | `scorer_sessions`, `scorer_audit_log` |
| Bid placed (owner) | YES | `bids` table, `auction_bid_events` (teamId, tournamentId, amount, timestamp) |
| Ball recorded | YES | `scoring_events.actorType + actorId`, `scorer_audit_log` |
| Ball undone | YES | `scoring_events` (BALL_UNDONE event with causationId) |
| Player sold | YES | `bids`, `auction_player_events`, `players.soldPrice` |
| Match started | YES (if logged) | `scoring_events.actorType + actorId` |
| Schema change | UNKNOWN | No DB-level audit; relies on deployment logs |

### Areas with No Reliable Audit Trail

1. Direct database modifications by admin (no DB-level trigger logging)
2. Organizer account creation/modification — coverage depends on `platform_audit_events` actual usage
3. Tournament settings changes — unclear if systematically logged

---

## 24. TEST ARCHITECTURE

### Test Infrastructure Found

- `lib/scoring-core/vitest.config.ts` — Vitest config for scoring-core
- `lib/scoring-core/src/__tests__/` — Test directory
- `artifacts/api-server/vitest.config.ts` — Vitest config for API server
- `artifacts/api-server/src/__tests__/` — API server tests
- `artifacts/api-server/test-reports/` — Test reports

### Test Coverage Map (What Was Found)

**Scoring Core Tests (`lib/scoring-core/src/__tests__/`):**
- Status: PRESENT — directory confirmed
- Coverage area: Cricket reducer, ball calculations, scoring rules
- Type: Unit tests using Vitest

**API Server Tests:**
- Status: PRESENT — directory confirmed
- Coverage: UNKNOWN — specific test files not enumerated

**No test files found for:**
- Authentication (no auth test directory located)
- Auction flow
- Realtime/SSE
- Database integration
- E2E tests (no Playwright or Cypress configuration found)

### Test-Related Scripts

- `artifacts/api-server/test_match_55.mjs` — One-off match test
- `artifacts/api-server/test_roster.mjs` — Roster validation test
- `artifacts/api-server/test_scorecard.mjs` — Scorecard test
- `artifacts/api-server/test_sim.mjs` — Simulation test
- `artifacts/api-server/run_test.mjs` (1.24 MB) — Large test/simulation runner

### Assessment (Observed Only)

| Area | Test Coverage |
|---|---|
| Cricket reducer (unit) | PRESENT |
| Cricket scoring (integration) | PARTIALLY PRESENT (simulation scripts) |
| Auction bid flow | NOT FOUND |
| Auth / JWT | NOT FOUND |
| Concurrency (duplicate bids) | NOT FOUND |
| Realtime / SSE | NOT FOUND |
| Browser reconnection | NOT FOUND |
| Match complete guard | NOT FOUND |
| E2E | NOT FOUND |

**CONFIDENCE:** MEDIUM — test directory structure confirmed, specific test content not fully enumerated.

---

## 25. DEPLOYMENT ARCHITECTURE

### Production Deployment (Verified from Dockerfile + .env)

```
Source Repository (GitHub)
    ↓ pnpm install --frozen-lockfile
    ↓ pnpm run build:deploy (TypeScript libs → API esbuild bundle → Vite frontends)
    ↓ Docker multi-stage build (node:22-bookworm-slim)
    ↓ pnpm deploy --prod (flat node_modules for runtime)
Single Docker Container
    ├── Node.js 22 process
    ├── Express API server (artifacts/api-server/dist/index.mjs)
    ├── Static assets served by Express:
    │   ├── /                → auction-platform frontend
    │   ├── /owner-app/      → owner-app frontend
    │   ├── /scoring-app/    → scoring-app frontend
    │   └── /mobile/         → mobile-app frontend
    └── PORT 3000
```

### External Services (from .env)

| Service | Purpose | Provider |
|---|---|---|
| PostgreSQL | Cloud database | Neon (ap-southeast-1) |
| Redis | Auction pub/sub, operator lock | Upstash Redis |
| File storage | Player/team photos | Cloudinary |
| Email | Transactional email | Resend |
| SMS/WhatsApp | Player notifications | BulkSMS |
| WhatsApp (API) | WhatsApp messaging | Twilio |
| Web Push | Browser notifications | VAPID (self-managed) |
| Google OAuth | Organizer auth | Google |
| Google Sheets | Player export | Google |

### Deployment Targets (from config files)

- `railway.json` — Railway.com deployment config
- `nginx.conf.example` — Nginx reverse proxy config (example)
- `RENDER_API_SETUP.md` — Render.com setup guide
- Staging: `bidwar-staging.onrender.com` (from .env APP_DOMAIN)
- Production: `bidwar.in` (from CANONICAL_HOST in app.ts)

### Environments

| Environment | DATABASE_URL | Notes |
|---|---|---|
| Development | Local/Neon dev DB | `BIDWAR_ENV=local`, auto-healing schema |
| Staging | Neon staging DB | On Render.com |
| Production | Neon production DB | Validate-only schema boot |

### No Separate Workers / Background Jobs

No worker processes, no cron jobs, no message queues (BullMQ/Celery/etc.) found in the deployment configuration. All processing is synchronous within request handlers.

**Exception:** Communication jobs (`comm` tables) suggest some async processing, but mechanism is UNKNOWN without further investigation.

### BidWar Local (Separate Deployment Model)

- Electron desktop application
- Ships as standalone executable
- Contains embedded local Express server + SQLite
- Syncs data with cloud via export token mechanism

---

## 26. LEGACY / DUPLICATE / PARALLEL ARCHITECTURE

### Buzz Studio Render

| Classification | DEAD |
|---|---|
| Evidence | `isBuzzStudioEnabled()` returns `false` hardcoded |
| Library | `lib/buzz-studio-render/` — package exists but effectively unused |
| Replacement | OBS overlay routes in api-server |

### Legacy Organizer Identity vs New Members System

| Component | Status |
|---|---|
| `organizers` table + JWT auth | ACTIVE (primary) |
| `members` + `member_auth_identities` tables | ACTIVE (new, schema exists, runtime activation unconfirmed in primary auth flow) |

### Deprecated Fields in `global_players`

| Field | Status | Replacement |
|---|---|---|
| `sport` | DEPRECATED | `player_sport_profiles.sport_slug` |
| `defaultRole` | DEPRECATED | `player_sport_profiles.primary_role` |
| `handedness` | DEPRECATED | `player_sport_profiles.handedness` |
| `auctionPlayerId` | DEPRECATED | Direct linkage |

### `badminton_players.globalPlayerId` (integer)

- **STATUS: DEPRECATED** — schema comment says "Use masterPlayerId. Kept for backward compat."
- `masterPlayerId` (text → `global_players.id`) is the new field

### `tournaments.sport` vs `tournaments.sportId`

- `sport` (text, e.g. "cricket") — legacy, active
- `sportId` (integer → `sports.id`) — Phase 2 dynamic reference, nullable, backward compat

### Multiple Schema Authority Sources

| Source | Status |
|---|---|
| `lib/db/src/schema/*.ts` (Drizzle) | AUTHORITATIVE for type generation + migrations |
| `lib/db/src/ensure-schema.ts` (DDL) | ACTIVE for dev/staging auto-healing |
| `lib/db/migrations/*.sql` | AUTHORITATIVE for production Neon schema |

All three can drift. This is a documented risk.

### `scoring_matches.status` vs `scoring_matches.lifecycleStatus`

Two status fields on the same table:
- `status` (default "scheduled") — operational status
- `lifecycleStatus` (default "draft") — lifecycle module storage (EPIC comment: "not part of Match Configuration product view")

### `scoring_matches.executionPhase`

A third phase concept (EPIC-08): `executionPhase` (default "preparing") — subordinate to lifecycleStatus.

---

## 27. SOURCE OF TRUTH MATRIX

| Domain | Data | Source of Truth | Derived From | Consumers |
|---|---|---|---|---|
| Identity | Organizer identity | `organizers` table | — | api-server auth routes |
| Identity | Member identity (new) | `members` table | — | platform-core (partially) |
| Identity | Scorer identity | `scorer_accounts` table | — | scoring routes |
| Identity | Owner session | `owner_sessions` table | — | owner-app |
| Identity | Player cross-tournament | `global_players` table | Mobile number dedup | Auction, scoring |
| Tournament | Tournament config | `tournaments` table | — | All domains |
| Team | Team record | `teams` table | — | Auction, scoring |
| Player | Tournament player | `players` table | — | Auction, scoring |
| Auction | Auction state | `auction_sessions` table | — | Auction UI, SSE clients |
| Auction | Bid history | `bids` table | — | Team purse, display |
| Auction | Team purse | `teams.purse` / `teams.purseUsed` | — | Auction validation |
| Auction | Intelligence | `auction_bid_events` etc. | `bids` | Analytics/AI |
| Cricket | Delivery (ball) | `scoring_events` row (BALL_RECORDED) | — | Reducer, scorecard |
| Cricket | Innings state | `scoring_sessions.stateJson` | `scoring_events` replay | SSE clients, display |
| Cricket | Match status | `scoring_matches.status` | Events | API, display |
| Cricket | Score | `scoring_sessions.stateJson` | `scoring_events` replay | All consumers |
| Cricket | Scorecard | Computed from events | `scoring_events` | API on demand |
| Cricket | Player stats | `scoring_match_player_stats` | `scoring_events` projection | Leaderboard, display |
| Badminton | Match data | `badminton_match_details` + `scoring_matches` | — | Badminton UI |
| Schema | Production DB schema | SQL migrations in `lib/db/migrations/` | `lib/db/src/schema/*.ts` | Neon PostgreSQL |

---

## 28. DOMAIN DEPENDENCY GRAPH

Based on actual imports and data relationships (verified):

```
External Services (Neon, Redis, Cloudinary, Resend, BulkSMS, Twilio)
    ↑

api-server (artifacts/api-server)
    ├── @workspace/db (schema + Drizzle — ALL routes depend on this)
    ├── @workspace/scoring-core (scoring routes)
    ├── @workspace/auction (auction routes)
    ├── @workspace/auth (owner auth)
    ├── @workspace/api-base (shared types)
    ├── @workspace/branding
    ├── @workspace/notifications
    ├── @workspace/analytics
    ├── @workspace/media
    └── @workspace/blog-data

Frontend Apps → @workspace/api-client-react → api-server HTTP
Frontend Apps → @workspace/api-base
Frontend Apps → @workspace/shared-ui

@workspace/scoring-core
    ├── Cricket reducer, events, scorecard, projector
    ├── Badminton (UNKNOWN — not confirmed in scoring-core src)
    └── (NO dependency on @workspace/auction)

@workspace/auction
    └── Auction business logic helpers
    └── (NO confirmed dependency on @workspace/scoring-core)

@workspace/db
    └── All schema tables (both auction AND scoring)
    └── (This is the ONE package both auction AND scoring depend on)
```

**Key observation:** Both Auction and Scoring share the same `@workspace/db` package (schema). The database schema does not enforce complete domain isolation — a single Drizzle client can query any table.

---

## 29. CROSS-DOMAIN COUPLING

| Coupling | From | To | Classification | Evidence |
|---|---|---|---|---|
| Auction → Scoring handoff | Auction | Scoring | INTENTIONAL | `handoffAuctionParticipantsToSports()` function |
| Tournament → Both Auction + Scoring | Tournament | Auction + Scoring | INTENTIONAL | `auctionEnabled` + `scoringEnabled` flags |
| Players table shared | Auction (sold players) | Scoring (squad, stats) | STRONG COUPLING | Same `players` table used by both |
| Teams table shared | Auction (purse) | Scoring (match teams) | STRONG COUPLING | Same `teams` table |
| DB package shared | All domains | All domains | ACCEPTABLE | Single Drizzle schema package |
| `scoring_matches.tournamentId` | Scoring | Tournament | ACCEPTABLE | FK relationship |
| `scorer_accounts` isolated from `members` | Scoring auth | Identity | SUSPICIOUS | Scorer not linked to Member |
| `auction_sessions.obsContextJson` | Auction | Presentation | ACCEPTABLE | OBS overlay data |
| Fat routes in api-server | All | All | STRONG COUPLING | Single Express app handles all domains |

---

## 30. STATE OWNERSHIP

| State | Location | Owner | Type |
|---|---|---|---|
| Auction current bid | `auction_sessions.currentBid` | Auction domain | Mutable DB |
| Auction timer | `auction_sessions.timerEndsAt` | Auction domain | Mutable DB |
| Auction status | `auction_sessions.status` | Auction domain | Mutable DB |
| Auction revision | `auction_sessions.revision` | Auction domain | Optimistic counter |
| Operator lock | Redis / in-memory map | Auction domain | Ephemeral |
| Cricket match status | `scoring_matches.status` | Scoring domain | Mutable DB |
| Cricket innings/score | `scoring_sessions.stateJson` | Scoring domain | Derived/cached |
| Cricket event log | `scoring_events` | Scoring domain | Append-only |
| Match scorer lock | `scorer_match_locks` | Scoring domain | Mutable DB |
| Team purse | `teams.purse` + `teams.purseUsed` | Auction/Tournament | Mutable DB |
| Player status | `players.status` | Auction domain | Mutable DB |
| SSE subscribers | In-memory Map (per process) | API server runtime | Ephemeral |
| Redis Pub/Sub state | Redis | Shared | External |
| Frontend auction state | TanStack Query cache | Frontend (auction-platform) | Derived |
| Frontend scoring state | TanStack Query cache + SSE | Frontend (scoring-app) | Derived |

---

## 31. CURRENT ARCHITECTURAL RISKS

### Risk 1: Identity Fragmentation

**What was found:** Three parallel identity systems exist simultaneously: `organizers` (legacy), `scorer_accounts` (separate), `members` (new). A single physical person who is both an organizer and a scorer has two disconnected identity records.

**Location:** `lib/db/src/schema/organizers.ts`, `scorer_accounts.ts`, `members.ts`

**Evidence:** Schema files confirmed. No migration path implemented to unify these.

**Affected Areas:** Identity, Authentication, Authorization, Audit Trail

**Current Behaviour:** Users must manage separate credentials for different roles. Audit trails cannot correlate a person's organizer activity with their scorer activity.

---

### Risk 2: Duplicate Schema Authority

**What was found:** `lib/db/src/ensure-schema.ts` (50KB, Bootstrap DDL) and `lib/db/migrations/*.sql` (21 migrations) are both schema authorities for different environments.

**Location:** `lib/db/src/ensure-schema.ts`, `lib/db/migrations/`

**Evidence:** Both files exist with different mechanisms. Multiple documentation files (SCHEMA_GOVERNANCE.md, RUNTIME_DDL_ANALYSIS.md) acknowledge this risk.

**Affected Areas:** Database, Deployment, Production safety

**Current Behaviour:** Dev/staging uses Bootstrap DDL. Production uses SQL migrations. If they diverge, dev/staging schema != production schema.

---

### Risk 3: Fat Route Architecture

**What was found:** Business logic lives directly in route handler files. `auction.ts` is 146KB, `auth.ts` is 110KB, `badminton.ts` is 133KB. No consistent service/repository layer.

**Location:** `artifacts/api-server/src/routes/*.ts`

**Evidence:** File sizes, confirmed pattern from inspection.

**Affected Areas:** All API domains — maintainability, testability, business logic isolation

**Current Behaviour:** New developers must navigate huge files to understand domain logic. Business logic cannot be tested without HTTP layer.

---

### Risk 4: `tournaments` Table Over-Wide

**What was found:** The `tournaments` table has 70+ columns embedding auction config, scoring config, registration, audio, branding, licensing, catalog bindings, feature flags.

**Location:** `lib/db/src/schema/tournaments.ts`

**Evidence:** Direct inspection — 177 lines defining one table.

**Affected Areas:** Tournament domain, database maintainability

**Current Behaviour:** Schema migrations to `tournaments` require careful coordination. Rollbacks are risky. The table is a single point of configuration for unrelated domains.

---

### Risk 5: `scoring_sessions.stateJson` Could Be Stale

**What was found:** The projected state in `scoring_sessions.stateJson` is updated within the same transaction as event insertion. If the server crashes between event insert and session update, the state could be stale.

**Location:** `artifacts/api-server/src/lib/scoring-service.ts` (scoring orchestrator)

**Evidence:** The transaction wraps both writes, but crash recovery behavior not confirmed.

**Affected Areas:** Cricket scoring, state consistency

**Current Behaviour:** On reconnect, clients receive the cached state. If stale, they see incorrect score until a new event or refresh occurs. Full replay from events is the correct recovery path.

---

### Risk 6: Scorer Identity Isolated from Platform Identity

**What was found:** `scorer_accounts` is a completely separate identity table from `members`. No FK relationship. A scorer cannot be the same "member" record as a player or organizer without separate database records.

**Location:** `lib/db/src/schema/scorer_accounts.ts`

**Evidence:** Direct schema inspection. No `memberId` foreign key on `scorer_accounts`.

**Affected Areas:** Identity, Audit, Statistics

**Current Behaviour:** Scorer actions in `scorer_audit_log.actorId` reference scorer account IDs, not member IDs. Cross-domain audit correlation impossible.

---

### Risk 7: No E2E Test Coverage Found

**What was found:** No Playwright or Cypress configuration found. No E2E tests for critical flows (auction bid, scoring a ball, match completion).

**Location:** Test directories confirmed empty or limited to unit tests

**Evidence:** No e2e/ directory, no playwright.config.ts, no cypress.json found.

**Affected Areas:** All domains — production safety

**Current Behaviour:** Critical user flows are untested by automated E2E tests. Reliance on manual testing.

---

### Risk 8: SSE Reconnection Behavior Unclear

**What was found:** SSE reconnection uses browser's built-in Last-Event-ID mechanism. Whether the server replays missed events or sends current state snapshot only was not traced.

**Location:** `artifacts/api-server/src/lib/scoring-broadcast.ts`, `auction-events.ts`

**Evidence:** SSE endpoint exists. Reconnection handler not verified.

**Affected Areas:** Realtime, Client state consistency

**Current Behaviour:** Unknown — a scorer who disconnects briefly may receive a stale state or may catch up correctly.

---

## 32. DOCUMENTATION VS. ACTUAL IMPLEMENTATION

| Area | Documentation Says | Actual Code Does | Status |
|---|---|---|---|
| Identity | "Single global Member identity" (Architecture skill §3) | Dual system: `organizers` + `members` + `scorer_accounts` all active | PARTIAL MISMATCH — intended model exists in schema, not fully implemented in API auth |
| Auction modules | "Auction must be independent from Scoring" (§13) | Separate routes, but share same DB schema package and `players`/`teams` tables | PARTIALLY ALIGNED |
| Scoring modules | "Scoring must be independent from Auction" (§14) | Scoring has no code dependency on auction; shared DB tables remain | PARTIALLY ALIGNED |
| Tournament type | "Do NOT use licenseType as permanent source of truth" (§7) | `licenseStatus` still exists in `organizers` and `tournaments` tables | PARTIAL MISMATCH — field exists but `auctionEnabled`/`scoringEnabled` flags now primary |
| Module flags | "Use explicit `auction_enabled` and `scoring_enabled`" (§8) | Both flags exist in `tournaments` table | MATCH |
| Player identity | "Player is a Role / Participation, Not Separate Person" (§6) | `players` table is a separate tournament-scoped record with no Member FK | MISMATCH — old system still primary |
| Sport profiles | "Sport-specific info in sport-specific/profile/stat structures" (§5) | `member_sport_profiles` exists; `global_players` has deprecated sport fields | PARTIAL MATCH |
| Routing | "Canonical: /tournament/:id/scoring/cricket" (§32) | Actual routes not verified in frontend routing files | UNKNOWN |
| Buzz Studio | Documented as a feature | `isBuzzStudioEnabled()` hardcoded `return false` | DEAD |
| Better Auth | Skill file references Better Auth | NOT IMPLEMENTED — custom JWT only | MISMATCH |

---

## 33. UNKNOWN / UNVERIFIED ARCHITECTURE REGISTER

### UNKNOWN #001
**Question:** Is the `members` table actively populated in the production API auth flow?

**Evidence found:** `members` table schema is fully defined with migration 0019. `member_auth_identities`, `member_sessions`, `member_roles` also exist. But primary `auth.ts` route (110KB) was not fully read — organizer auth appears to use `organizers` table.

**What is missing:** Reading `auth.ts` route file completely to trace which tables are written on login.

**Confidence:** LOW

---

### UNKNOWN #002
**Question:** Does the badminton scoring system use the same `scoring_events` event-sourcing architecture as cricket?

**Evidence found:** `scoring_events` has a `sportSlug` field. `badminton.ts` route (133KB) exists. No badminton reducer found in `lib/scoring-core/`.

**What is missing:** Reading `badminton.ts` and any badminton-specific reducer.

**Confidence:** LOW

---

### UNKNOWN #003
**Question:** What is the SSE reconnection behavior? Does the server replay missed events or send current snapshot?

**Evidence found:** SSE endpoints exist. `Last-Event-ID` is a standard SSE mechanism. Scoring broadcast sends current state on each event.

**What is missing:** Reading `scoring-broadcast.ts` reconnect handler.

**Confidence:** LOW

---

### UNKNOWN #004
**Question:** What is `updatedbidwarcore/bidwar-core/`? Is this a separate project, an old version, or an active dependency?

**Evidence found:** Directory exists at root. One subdirectory `bidwar-core`. Not referenced in `pnpm-workspace.yaml`.

**What is missing:** Inspecting contents of this directory.

**Confidence:** LOW

---

### UNKNOWN #005
**Question:** What is `lib/sports-football/`? Is it a placeholder, a partially built system, or dead code?

**Evidence found:** Directory exists. No schema tables found for football.

**What is missing:** Reading the sports-football package contents.

**Confidence:** LOW

---

### UNKNOWN #006
**Question:** Is `platform_audit_events` actively written to on important business actions (auction sold, match complete, etc.)?

**Evidence found:** Table schema exists with comprehensive structure. `audit.ts` route exists (12KB).

**What is missing:** Tracing write paths from `auction.ts` and `scoring.ts` to confirm actual writes.

**Confidence:** MEDIUM — table exists and is structured for audit; actual write coverage unknown.

---

### UNKNOWN #007
**Question:** What is the complete behavior when a scorer disconnects mid-match and reconnects?

**Evidence found:** `scorer_match_locks` provides locking. SSE reconnect via browser. Lock has `lastHeartbeatAt`.

**What is missing:** Lock expiration behavior, what happens when the lock expires due to disconnection.

**Confidence:** LOW

---

### UNKNOWN #008
**Question:** Is `handoffAuctionParticipantsToSports()` actually called automatically after auction, or is it a manual step?

**Evidence found:** Function referenced in auction audit report. Location: somewhere in auction route handlers.

**What is missing:** Reading the complete auction route to find when this is called.

**Confidence:** LOW

---

### UNKNOWN #009
**Question:** What does `lib/player-registry/` contain and is it actually used?

**Evidence found:** Directory exists. Listed as a lib package.

**What is missing:** Reading package contents.

**Confidence:** LOW

---

### UNKNOWN #010
**Question:** Production schema authority — are the 21 SQL migrations fully synchronized with `ensure-schema.ts`?

**Evidence found:** `schema-drift-audit.mjs` script exists specifically to detect this drift. Multiple documentation files acknowledge the risk.

**What is missing:** Running the audit script or comparing the two.

**Confidence:** MEDIUM — risk is documented, actual drift status unknown.

---

## 34. COMPLETE CURRENT ARCHITECTURE MAP

### 34.1 System Hierarchy (Actual)

```
BIDWAR
│
├── Platform / Identity [DUAL SYSTEM]
│   ├── Legacy: organizers + scorer_accounts + owner_sessions
│   └── New: members + member_auth_identities + member_sessions + member_roles
│       + member_sport_profiles + tournament_participations
│
├── Tournament Domain
│   ├── tournaments (single wide table — owns: auction config, scoring config, registration)
│   ├── teams (tournament-scoped)
│   ├── players (tournament-scoped, also auction roster)
│   ├── categories (auction divisions)
│   ├── sports (registry)
│   └── global_players (cross-tournament identity, migrating)
│
├── Auction Domain
│   ├── auction_sessions (1:1 per tournament, owns live state + revision)
│   ├── bids (bid history)
│   ├── purse_boosters
│   ├── auction_bid_events / auction_player_events / auction_timer_events (intelligence)
│   ├── SSE transport (/auction/events)
│   └── Redis pub/sub
│
├── Scoring Domain [Sport-agnostic infrastructure]
│   ├── scoring_matches (match header, sport-agnostic)
│   ├── scoring_events (APPEND-ONLY — SOURCE OF TRUTH for all scoring)
│   ├── scoring_sessions (projected state cache)
│   ├── scoring_fixtures / scoring_draws / scoring_groups (scheduling)
│   ├── scorer_accounts + scorer_sessions + scorer_match_locks (scorer auth/lock)
│   ├── SSE transport (/scoring/events)
│   └── scoring_match_player_stats (projected stats)
│
├── Cricket [Sport-specific layer ON TOP OF Scoring Domain]
│   ├── Reducer: lib/scoring-core/src/cricket/reducer.ts
│   ├── Events: lib/scoring-core/src/events/cricket.ts (14 event types)
│   ├── State: CricketScoreboardState (in-memory, cached in scoring_sessions)
│   ├── Scorecard: lib/scoring-core/src/cricket/scorecard.ts (projected from events)
│   ├── Ball: scoring_events row (eventType="cricket.ball.recorded")
│   └── Player Stats: scoring_match_player_stats (projected at match complete)
│
├── Badminton [Sport-specific layer]
│   ├── badminton_players, courts, categories, registrations, draws, fixtures
│   ├── badminton_match_details
│   └── Route: artifacts/api-server/src/routes/badminton.ts
│
├── BidWar Local [Premium offline]
│   ├── Electron desktop app
│   ├── SQLite (subset of cloud schema)
│   └── Export/sync token mechanism
│
├── Audit / Logging
│   ├── platform_audit_events (platform-wide append-only)
│   ├── scorer_audit_log (scoring actions)
│   ├── entity_audit_logs (field-level mutations)
│   └── Application logs (pino → stdout)
│
├── Communication
│   ├── comm / communication tables
│   ├── push_subscriptions (Web Push)
│   └── SMS/WhatsApp via BulkSMS + Twilio
│
└── Academy / Content
    └── academy table + blog_data package
```

### 34.2 Domain Dependency Graph (Actual)

```
Neon PostgreSQL ←─────────────────────────────────────────────┐
Redis (Upstash) ←────────────────────────────────────────────┐│
Cloudinary ←──────────────────────────────────────────────┐ ││
                                                           │ ││
api-server                                                 │ ││
   ├── @workspace/db ──────────────────────────────────────┘ ││
   │   (all schemas: tournament, auction, scoring, identity)   ││
   ├── @workspace/scoring-core ─────────────────────────────── ││
   │   (cricket reducer, events, scorecard)                     ││
   ├── @workspace/auction                                        ││
   │   (bid helpers, purse logic)                               ││
   ├── @workspace/auth                                          ││
   │   (owner auth)                                            ││
   └── Redis client ──────────────────────────────────────────┘│
                                                                 │
Frontend Apps ─── HTTP ──→ api-server                           │
   ├── auction-platform                                          │
   ├── scoring-app                                               │
   ├── owner-app                                                 │
   └── mobile-app                                               │
                                                                 │
bidwar-local (Electron)                                         │
   ├── Local SQLite                                              │
   └── HTTP → api-server (sync) ──────────────────────────────┘
```

### 34.3 Database Relationship Graph (Key Tables)

```
organizers
    └─────────────────────────── tournaments.organizerId
                                         │
                    ┌────────────────────┼─────────────────────┐
                    ▼                    ▼                       ▼
                  teams             players                categories
                    │                   │
                 teamId             tournamentId
                    │                   │
                 players            (roster)
                (after auction)         │
                                   global_players (via globalPlayerId)

tournaments
    ├──── auction_sessions (1:1)
    │         ├── bids (many)
    │         └── auction_bid_events (intelligence)
    │
    └──── scoring_matches (many)
              ├── scoring_events (SOURCE OF TRUTH, append-only)
              │       └── payloadJson (ball data, innings, over, etc.)
              ├── scoring_sessions (1:1, PROJECTED CACHE)
              ├── scoring_match_player_stats (many)
              └── scoring_fixtures (via fixtureId, nullable)
                      └── scoring_draws (via drawId)
                              └── scoring_groups

members
    ├── member_auth_identities (many)
    ├── member_sessions (many)
    ├── member_roles (many, scoped)
    ├── member_sport_profiles (many, per sport)
    └── tournament_participations (many)
             ├── → tournaments
             └── → teams
```

### 34.4 Frontend → API → Backend → Database

```
Frontend (React + TanStack Query)
    │
    ↓ HTTP (fetch with credentials, cookies)
API Client (@workspace/api-client-react, generated from OpenAPI spec)
    │
    ↓ HTTP request to Express
Middleware stack:
    globalLimiter → cors → cookieParser → pinoHttp → jwtAuthMiddleware → organizerAccountStatusMiddleware
    │
    ↓ Matched route
Fat Route Handler (artifacts/api-server/src/routes/*.ts)
    │ Contains all business logic
    ↓ Drizzle ORM
Neon PostgreSQL
    │
    ↓ Response JSON
Frontend (TanStack Query cache updated)
    │
    ↓ [For realtime]
SSE stream (scoring events / auction events)
    ↓
React UI re-render
```

### 34.5 Realtime Graph (Actual)

```
Scoring event written to DB
    ↓
broadcastScoringState() in scoring-broadcast.ts
    ↓ (no Redis for scoring — direct in-process broadcast)
EventSource connections at /tournaments/:id/scoring/events
    ↓
Scoring App UI + Viewer UI

Auction action written to DB
    ↓
Redis Pub/Sub publish on "auction:event:<tournamentId>"
    ↓ (cross-process broadcast via Redis)
    ↓ (fallback: in-memory EventEmitter)
EventSource connections at /api/tournaments/:id/auction/events
    ↓
Auction Platform + Owner App + Display screens
```

### 34.6 Cricket Scoring Graph (Actual)

```
Scorer (scoring-app)
    ↓ Tap "4 runs" (UI event)
    ↓ HTTP POST /tournaments/:tId/scoring/matches/:mId/events
        { eventType: "cricket.ball.recorded", payload: {...} }
Route handler (scoring.ts)
    ↓ resolveScorerAuthFromToken() ← verify scorer JWT
    ↓ verify scorer_match_locks (scorer holds lock)
    ↓ parseCricketEventPayload() ← Zod validation
    ↓ reduceCricket(currentState, event, {enforceLiveRules:true}) ← trial validation
        [validates: not paused, innings matches, overs limit, etc.]
    ↓ DB Transaction:
        INSERT scoring_events (payloadJson = ball data)
        UPDATE scoring_sessions.stateJson = new state
        UPDATE scoring_matches.status
    ↓ broadcastScoringState()
    ↓ SSE push to all /scoring/events subscribers
        { type: "scoring_state", data: { match, state, summary } }
    ↓ All connected clients update UI
```

### 34.7 Auction Graph (Actual)

```
Operator (auction-platform) or Owner (owner-app)
    ↓ Click "Bid ₹200,000" (UI)
    ↓ HTTP POST /api/tournaments/:id/auction/bid
Route handler (auction.ts)
    ↓ verify JWT cookie (organizer) or bidwar_owner cookie (owner)
    ↓ verify ownerBiddingEnabled
    ↓ verify purse sufficient
    ↓ verify bid >= current + increment
    ↓ DB Transaction:
        INSERT bids (tournamentId, playerId, teamId, amount)
        UPDATE auction_sessions SET currentBid, currentBidTeamId, revision++
            WHERE revision = $expectedRevision
        UPDATE teams SET purseUsed++ WHERE id = :teamId
    ↓ [if revision conflict → 409 Conflict]
    ↓ Fire-and-forget: INSERT auction_bid_events (intelligence log)
    ↓ Redis Pub/Sub publish "auction:event:<tournamentId>"
    ↓ Redis subscriber fans out to all SSE clients
    ↓ auction-platform + owner-app + display screens update
```

### 34.8 Identity / Member / Role Graph (Actual)

```
LEGACY (ACTIVE):
organizer (organizers table) ──→ creates/owns tournaments
scorer (scorer_accounts table) ──→ scores matches
team_owner (owner_sessions, team.accessCode) ──→ bids in auction

NEW (PARTIALLY IMPLEMENTED):
member (members table, mem_* ID)
    ↓ via member_auth_identities
    → can login via password | Google | phone_otp
    ↓ via member_sessions
    → has active sessions
    ↓ via member_roles (scoped)
    → organizer (global/tournament)
    → player (tournament)
    → scorer (global/tournament)
    → team_owner (team)
    → coach / mentor / fan / etc.
    ↓ via member_sport_profiles
    → cricket profile (batting style, bowling style, etc.)
    → badminton profile
    ↓ via tournament_participations
    → linked to specific tournament, role, team

PLAYER IDENTITY (THREE LEVELS):
players (tournament-scoped, active, auction-era)
    ↓ globalPlayerId (nullable)
global_players (cross-tournament, gp_* ID, mobile-based dedup)
    ↓ [future]
members (canonical, mem_* ID)
    ↓ member_sport_profiles
```

---

## 35. EVIDENCE INDEX

| Claim | Evidence | File | Symbol | Confidence |
|---|---|---|---|---|
| Cricket score is derived from scoring events | "Append-only event store — source of truth for all scoring state" | `lib/db/src/schema/scoring_events.ts:17-23` | `scoringEventsTable` | HIGH |
| Ball is a row in scoring_events | `eventType = "cricket.ball.recorded"` with full payload | `lib/scoring-core/src/events/cricket.ts:8,56-68` | `cricketBallRecordedPayloadSchema` | HIGH |
| Innings is not a DB table | No innings table found in schema directory | `lib/db/src/schema/` | (absence) | HIGH |
| Cricket reducer is pure function | `export function reduceCricket(state, event) → state` | `lib/scoring-core/src/cricket/reducer.ts:674` | `reduceCricket` | HIGH |
| scoring_sessions is a cache, not source of truth | "state_json is derived from scoring_events — never the source of truth" | `lib/db/src/schema/scoring_sessions.ts:16-17` | `scoringSessionsTable` | HIGH |
| Auction uses optimistic concurrency | `revision column` with WHERE clause on UPDATE | `lib/db/src/schema/auction_sessions.ts:48` | `revision` | HIGH |
| Buzz Studio is dead | `isBuzzStudioEnabled()` returns false | auction audit report | `isBuzzStudioEnabled` | HIGH |
| SSE for auction, not WebSocket | SSE endpoint at `/auction/events` | API route map | `auction.ts` | HIGH |
| SSE for scoring, not WebSocket | SSE endpoint at `/scoring/events` | Scoring audit report | `scoring.ts` | HIGH |
| Auction uses Redis pub/sub | "Redis Pub/Sub channels auction:event:*" | API audit report | `auction-events.ts` | HIGH |
| Members table is new platform identity | "Canonical future platform-level human identity" comment | `lib/db/src/schema/members.ts:15-18` | `membersTable` | HIGH |
| Scorer_accounts is separate from members | No `memberId` FK on `scorer_accounts` | `lib/db/src/schema/scorer_accounts.ts` | `scorerAccountsTable` | HIGH |
| Ball undo is a compensation event | BALL_UNDONE event resolved before replay | `lib/scoring-core/src/cricket/reducer.ts:761-765` | `reduceCricket` BALL_UNDONE case | HIGH |
| Organizer JWT is stateless | No session table for organizers; JWT cookie only | Auth audit report | `jwtAuthMiddleware` | HIGH |
| Production uses SQL migrations | `lib/db/migrations/` with 21 .sql files | `find_by_name` result | migration files | HIGH |
| Dev/staging uses ensure-schema.ts | "idempotent CREATE/ALTER IF NOT EXISTS" | DB audit report | `ensure-schema.ts` | HIGH |
| auctionEnabled default is backward compat | Explicit comment in schema | `lib/db/src/schema/tournaments.ts:131-132` | `auctionEnabled` | HIGH |
| Super Ball doubles bat runs | `batRuns = payload.isSuperBall ? payload.runsOffBat * 2 : payload.runsOffBat` | `lib/scoring-core/src/cricket/ball.ts:5-7` | `totalRunsOnBall` | HIGH |
| DLS is implemented | `DLS_APPLIED` event type + reducer handler + `scoringDlsCalculations` table | `lib/scoring-core/src/events/cricket.ts:15`, reducer.ts:758 | `applyDlsApplied` | HIGH |
| Super Over is implemented | `SUPER_OVER_STARTED` event, creates innings 3 or 4 | `lib/scoring-core/src/cricket/reducer.ts:474-521` | `applySuperOverStarted` | HIGH |
| Single Express process serves all frontends | Dockerfile copies 4 frontend dist/ directories into same image | `Dockerfile:52-56` | (Dockerfile) | HIGH |

---

## 36. CONFIDENCE MODEL SUMMARY

| Architectural Area | Confidence | Basis |
|---|---|---|
| Cricket event sourcing model | HIGH | Direct code inspection of reducer, events, schema |
| Ball-by-ball data location | HIGH | Schema + events + reducer directly inspected |
| Auction state machine | HIGH | Schema + audit report |
| Auction concurrency (revision) | HIGH | Schema directly inspected |
| SSE as realtime transport | HIGH | Multiple independent confirmations |
| Redis for auction pub/sub | HIGH | Confirmed by subagent investigation |
| Database schema (tables, columns) | HIGH | Direct schema file inspection |
| Migration mechanism | HIGH | 21 SQL files found + ensure-schema.ts confirmed |
| Frontend tech stack | HIGH | Workspace catalog, Dockerfile, subagent |
| Deployment model | HIGH | Dockerfile directly read |
| Auth mechanism (organizers) | HIGH | Schema + subagent auth audit |
| Auth mechanism (scorer PIN) | HIGH | Schema + subagent auth audit |
| Buzz Studio dead | HIGH | Hardcoded return false confirmed |
| Identity fragmentation (dual system) | HIGH | Both schemas exist, both active in API |
| Members system runtime activation | MEDIUM | Schema exists, API routes not fully traced |
| Badminton reducer | LOW | Route exists (133KB), reducer not found |
| SSE reconnection behavior | LOW | Not traced |
| Football sport status | LOW | Directory only, no schema |
| Production schema drift status | MEDIUM | Risk documented, actual state not verified |
| `platform_audit_events` write coverage | MEDIUM | Table exists, write paths not traced |
| `updatedbidwarcore/` purpose | UNKNOWN | Not inspected |
| Background job mechanism | UNKNOWN | comm tables exist, processor not found |

---

*Document end. This is the CURRENT ARCHITECTURE of BIDWAR as verified by direct forensic code inspection on 2026-09-24.*

*Next step: Human review → Architecture discussion → Identify required changes → DO NOT proceed to architecture freeze without that process.*
