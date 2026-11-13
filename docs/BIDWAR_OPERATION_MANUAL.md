# BIDWAR — OFFICIAL OPERATION MANUAL
### The Permanent Operational Knowledge Base & Living Product Guide

> **MANDATORY DEFINITION-OF-DONE REQUIREMENT:**
> This Operation Manual is a living document and the permanent source of truth for the implemented BidWar platform.
> Whenever any feature, screen, button, workflow, setting, permission, or validation rule is **created, modified, renamed, moved, deprecated, or removed**, this manual **MUST be updated in the same pull request / commit** as the code change.
> No feature is considered complete until this manual reflects its exact shipped behavior.

---

## Document Metadata

| Attribute | Specification |
|:---|:---|
| **Canonical File Path** | `docs/BIDWAR_OPERATION_MANUAL.md` |
| **Current Platform Version** | BidWar Core v2.4 (Multi-Sport & Hybrid Local/Cloud Edition) |
| **Repository** | `tusharsaraswat1988/updatedbidwarcore` |
| **Last Verified Commit / Audit** | November 2026 Comprehensive Codebase Inspection |
| **Status** | Living Document — Enforced via repository governance and automated validation |
| **Primary Maintainers** | BidWar Core Engineering Team & AI Coding Agents |

---

## Table of Contents

1. [Section 1 — Purpose, Audience, Scope & Maintenance Governance](#section-1--purpose-audience-scope--maintenance-governance)
2. [Section 2 — Product Overview, Core Concepts & Glossary](#section-2--product-overview-core-concepts--glossary)
3. [Section 3 — Applications, Roles & Permission Matrix](#section-3--applications-roles--permission-matrix)
4. [Section 4 — Complete Screen & Route Directory](#section-4--complete-screen--route-directory)
5. [Section 5 — Domain Feature Catalog](#section-5--domain-feature-catalog)
   - 5.1 [Tournament Management & Lifecycle](#51-tournament-management--lifecycle)
   - 5.2 [Auction Engine & Live Operator Console](#52-auction-engine--live-operator-console)
   - 5.3 [Team Owner Bidding Experience](#53-team-owner-bidding-experience)
   - 5.4 [Cricket Scoring Engine & Match Center](#54-cricket-scoring-engine--match-center)
   - 5.5 [Badminton Scoring Engine & Court Management](#55-badminton-scoring-engine--court-management)
   - 5.6 [Public Fan Experience, Spectator Displays & Broadcast Overlays](#56-public-fan-experience-spectator-displays--broadcast-overlays)
   - 5.7 [Admin Super-Control Platform](#57-admin-super-control-platform)
   - 5.8 [Offline Operations — BidWar Local](#58-offline-operations--bidwar-local)
6. [Section 6 — Step-by-Step Operating Procedures & End-to-End Workflows](#section-6--step-by-step-operating-procedures--end-to-end-workflows)
   - Workflow 1: Creating a Tournament & Selecting Modules
   - Workflow 2: Launching Public Player Registration & Verifying Payments
   - Workflow 3: Setting Up Teams, Purses & Auction Categories
   - Workflow 4: Conducting a Live Player Auction (Operator + Team Owners)
   - Workflow 5: Handling Unsold Players, Re-Auctions & Purse Boosters
   - Workflow 6: Handing Off Rosters from Auction to Sports Scoring
   - Workflow 7: Conducting Cricket Scoring (Toss to Result)
   - Workflow 8: Conducting Badminton Tournament (Draws, Courts, Match Scoring)
   - Workflow 9: Generating Reports, Scorecards & Master Workbooks
   - Workflow 10: Running Offline Auction with Cloud Synchronization
7. [Section 7 — Registration Guide, Form Fields & Validations](#section-7--registration-guide-form-fields--validations)
8. [Section 8 — Buttons, Controls & Actions Reference](#section-8--buttons-controls--actions-reference)
9. [Section 9 — Statuses & State Transition Reference](#section-9--statuses--state-transition-reference)
10. [Section 10 — Settings, Configuration, Reports & Integrations](#section-10--settings-configuration-reports--integrations)
11. [Section 11 — Troubleshooting, Known Limitations & FAQs](#section-11--troubleshooting-known-limitations--faqs)
12. [Section 12 — Needs-Verification Registry & Source Code Map](#section-12--needs-verification-registry--source-code-map)
13. [Section 13 — Change Log & Maintenance Record](#section-13--change-log--maintenance-record)

---

## Section 1 — Purpose, Audience, Scope & Maintenance Governance

### 1.1 Purpose
The **BidWar Operation Manual** is the definitive operational specification and user guide for the entire BidWar ecosystem. It bridges actual TypeScript/PostgreSQL implementation with real-world operating workflows for tournament organizers, auction operators, match scorers, team owners, system administrators, and future software engineers/AI agents.

### 1.2 Target Audience
- **Tournament Organizers:** Organizing leagues, managing rosters, setting budgets, verifying registrations.
- **Auction Operators:** Running live stage auctions, controlling timers, managing bidding wars.
- **Match Scorers & Umpires:** Operating digital scoring pads for Cricket and Badminton.
- **Franchise / Team Owners:** Bidding on players during live auctions via mobile web.
- **Platform Administrators:** Managing white-label branding, SMS/WhatsApp gateways, billing, and system diagnostics.
- **Software Developers & AI Agents (Antigravity/Cursor/Claude):** Understanding implemented functionality, constraints, and operational dependencies before modifying code.

### 1.3 Scope
- **Applications Covered:** `artifacts/api-server`, `artifacts/auction-platform`, `artifacts/scoring-app`, `artifacts/owner-app`, `artifacts/bidwar-local`, `artifacts/mobile-app`, `standalone/bpl-kids-registration`.
- **Domains Covered:** Tournaments, Auctions, Cricket, Badminton, Football (schema-stage), Member Identity, Registrations, Displays, Broadcast/OBS, Admin, Communications.

### 1.4 Non-Negotiable Maintenance Rule
1. **Same-Task Requirement:** Any code change that introduces, modifies, renames, relocates, deprecates, or removes any user-facing feature, API route, form field, validation rule, button, permission, or setting **MUST include a corresponding update to this Operation Manual in the same pull request / commit**.
2. **No Fabrication:** Every description in this manual must derive from verified source code and database schemas. If a feature is incomplete, planned, or unverified, it must be explicitly marked **“Needs verification”** in [Section 12](#section-12--needs-verification-registry--source-code-map).
3. **Automated Enforcement:** Continuous integration runs `pnpm run check:manual` (`node scripts/verify-operation-manual.mjs`) to verify manual integrity, required sections, and link health before build and release.

---

## Section 2 — Product Overview, Core Concepts & Glossary

### 2.1 Architectural Foundation
BidWar is a **multi-module sports tournament management and auction platform**.
Key architectural principle: **Tournament is independent of Auction and Scoring**.
- A Tournament can be **Auction Only**.
- A Tournament can be **Sports Scoring Only**.
- A Tournament can be **Both (Auction + Sports Scoring)**.
- Auction and Scoring are sibling modules that communicate via a structured handoff (`/api/tournaments/:id/auction/handoff-to-sports`).

```
                              ┌─────────────────────────┐
                              │     Global Member       │
                              │ (Identity: mem_0194...) │
                              └────────────┬────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
         ┌──────────▼──────────┐                       ┌──────────▼──────────┐
         │ Organizer Identity  │                       │   Tournament Entity │
         │ (Mobile, Org Auth)  │                       │   (Sport, Modules)  │
         └─────────────────────┘                       └──────────┬──────────┘
                                                                  │
                                      ┌───────────────────────────┴───────────────────────────┐
                                      │                                                       │
                           ┌──────────▼──────────┐                                 ┌──────────▼──────────┐
                           │   Auction Module    │                                 │   Scoring Module    │
                           │ (Teams, Purse, Bids)│                                 │ (Cricket, Badminton)│
                           └──────────┬──────────┘                                 └──────────┬──────────┘
                                      │              Roster Handoff                           │
                                      └───────────────────────────────────────────────────────┘
```

### 2.2 Terminology & Glossary

| Term | Implemented Definition | Source Reference |
|:---|:---|:---|
| **Member** | Canonical physical human identity (`members` table, ID prefix `mem_`). Global across all sports and tournaments. | `lib/db/src/schema/members.ts` |
| **Organizer** | Person or organization hosting a tournament. Authenticates via mobile/password or Google OAuth. | `lib/db/src/schema/organizers.ts` |
| **Tournament** | Event container defined by sport, venue, dates, module flags (`auctionEnabled`, `scoringEnabled`), and licensing status. | `lib/db/src/schema/tournaments.ts` |
| **Auction Code** | Unique 8-character alphanumeric string (e.g., `RC732504`) identifying the tournament for owner login and spectator links. | `lib/db/src/schema/tournaments.ts` |
| **Purse / Budget** | Total spending capacity allocated to a team for buying players. Tracked in Points (Pt.) or Rupees (₹). | `lib/db/src/schema/teams.ts` |
| **Purse Booster** | Append-only capacity adjustment granting additional purse to a team without altering base historical purse. | `lib/db/src/schema/purse_boosters.ts` |
| **Bid Tier** | Price threshold tiers configuring automatic increment escalations (e.g., ₹25k up to ₹1L, ₹50k up to ₹2L, ₹1L thereafter). | `lib/db/src/schema/tournaments.ts` |
| **Paddle Mode** | In-person auction mode where `ownerBiddingEnabled = false`. Online team owners watch live stream, but only stage operator submits bids. | `lib/db/src/schema/tournaments.ts` |
| **Player Serial No** | Tournament-scoped sequential integer (1..N) uniquely numbering lots in that tournament. | `lib/db/src/schema/players.ts` |
| **Player Tag** | Cosmetic designation (`captain`, `vice_captain`, `owner`, `co_owner`, `booster`, `icon`, `star_player`) with team association. | `lib/db/src/schema/players.ts` |
| **Non-Playing Member** | Squad member tagged for roster visibility but excluded from squad size and category limit calculations. | `lib/db/src/schema/players.ts` |
| **Match Lock** | Lease-based concurrency token (180s expiry, 30s heartbeat) ensuring only one scorer pad modifies a match at a time. | `lib/db/src/schema/scorer_accounts.ts` |
| **Fixture Collection** | Planning draw container in Badminton (historically stored in `badminton_draws` table). | `lib/db/src/schema/badminton.ts` |
| **BidWar Local** | Offline Electron desktop distribution utilizing local SQLite to run auctions without active internet connection. | `artifacts/bidwar-local` |

### 2.3 Global Organiser Light Mode & Surface Architecture

BidWar enforces a strict architectural boundary between **Internal Organiser Workspaces** and **Protected Live / Broadcast / Public Surfaces**:

```
                                  BidWar Visual Architecture
                                              │
                ┌─────────────────────────────┴─────────────────────────────┐
                ▼                                                           ▼
    Organiser Workspaces (Light Mode)                       Protected Surfaces (Dark Mode)
   Scope: .bw-organizer-light / [data-surface="organizer"]   Scope: lovable-theme dark / theme-broadcast-console
   ───────────────────────────────────────                 ───────────────────────────────────────
   • Organiser Portal & Profile (/organizer)               • Public Homepage & Marketing (/)
   • Tournament Creation Wizard (/tournament/new)          • Live Stage LED & Projector Displays (/display)
   • Auction Setup & Overview (/tournament/:id/*)          • Transparent OBS Broadcast Overlays (/obs/*)
   • Cricket Organiser Workspace (/score/*)                • Live Auction Operator Console (/auction)
   • Badminton Organiser Workspace (/badminton/*)          • Digital Match Scorer Pads (/cricket/:id/score)
   • Organiser Dialogs, Sheets, Dropdowns, Tooltips        • Team Owner Live Bidding App (artifacts/owner-app)
                                                           • Public Player Registration (/register/:code)
```

#### Organiser Workspace Design Principles
1. **Calm, High-Contrast Workspace Canvas:** Off-white canvas (`#F3F6FA`), pure white card surfaces (`#FFFFFF`), with fine neutral borders (`#E2E8F0`) and soft natural elevation.
2. **Recognisable Brand Anchors:** Deep navy (`#172B4D`) for structural headings and typography; BidWar gold (`#EAB308`) exclusively for primary actions and active selections.
3. **Restrained Semantic Palette:** Status indicators use accessible light-mode tints (Emerald success, Amber warning, Rose danger, Blue informational) paired with explicit iconography and labels.
4. **Data-Dense Layouts:** High information density preserved for roster grids, financial tables, and fixture schedules using tabular numerals (`tabular-nums`) and clean padding.
5. **Dynamic Radix Portal Inheritance:** Modal dialogs, dropdown menus, selects, popovers, and tooltips automatically resolve their theme via `getPortalThemeClass()`: applying `.bw-organizer-light` inside organiser routes and `.lovable-theme dark` on protected operational routes.

---

## Section 3 — Applications, Roles & Permission Matrix

### 3.1 Application Inventory

| Application | Directory | Default Port / Base URL | Tech Stack | Primary Purpose |
|:---|:---|:---|:---|:---|
| **API Server** | `artifacts/api-server` | `:5000` (`/api`) | Express, Drizzle ORM, PostgreSQL, Redis, SSE | Backend API, authentication, WebSocket/SSE streams, state machines, webhooks |
| **Auction Platform** | `artifacts/auction-platform` | `:5173` (`/`) | React 19, Vite, Tailwind CSS v4, Wouter, Radix UI | Marketing site, Organizer Portal, Auction Setup, Live Operator, LED Display, OBS Overlays, Super Admin |
| **Scoring App** | `artifacts/scoring-app` | `:5174` (`/scoring-app`) | React 19, Vite, Tailwind CSS v4, Wouter | Cricket & Badminton Organizer Workspaces, Digital Scorer Pad, Match Centers, Fan Pages |
| **Owner App** | `artifacts/owner-app` | `:5175` (`/owner-app`) | React 19, Vite, PWA, Tailwind CSS | Mobile-first live bidding console for team franchise owners |
| **BidWar Local** | `artifacts/bidwar-local` | Standalone App | Electron, Node.js, SQLite / Local PostgreSQL | Offline auction room execution with cloud bundle import and replay-protected sync |
| **Mobile App** | `artifacts/mobile-app` | Android APK | Capacitor 6, React, Vite | Native wrapper for mobile operators and scorers |
| **BPL Kids Registration** | `standalone/bpl-kids-registration` | Standalone | Vite, React | Specialized registration portal for junior leagues |

### 3.2 User Roles & Identities

```
[Super Admin] ─── Key / Password ──► System diagnostics, licenses, branding, communications
[Organizer]   ─── Mobile + Password / OAuth ──► Tournament creation, team/player management, settings
[Team Owner]  ─── Tournament Code + Team Code ──► Live bidding console, squad inspection, scout
[Scorer]      ─── Mobile + 4-digit PIN ──► Ball-by-ball cricket pad, badminton point scoring pad
[Player/Member]── Mobile OTP / Registration ──► Registration, profile view, stats history
[Spectator]   ─── Public URL ──► Live viewer, fan pages, cheer reactions, public scorecards
```

### 3.3 Implemented Permission Matrix

| Feature / Action | Public / Fan | Registered Player | Team Owner | Official Scorer | Tournament Organizer | Super Admin |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| View Public Marketing & Academy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit Player Registration | ✅ | ✅ | ❌ | ❌ | ✅ (Manual) | ✅ |
| Access Team Bidding Pad | ❌ | ❌ | ✅ (Own Team) | ❌ | ❌ | ❌ |
| View Live Auction Viewer (`/live/:id`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send Cheer Reactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View LED Display & OBS Overlays | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Tournaments | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Teams & Players | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Control Live Auction Console | ❌ | ❌ | ❌ | ❌ | ✅ (Owner) | ✅ |
| Issue Purse Boosters | ❌ | ❌ | ❌ | ❌ | ✅ (Logged) | ✅ |
| Acquire Scorer Match Lock | ❌ | ❌ | ❌ | ✅ (Assigned) | ✅ (Fallback) | ✅ |
| Record Balls / Points in Matches | ❌ | ❌ | ❌ | ✅ (Active Lock) | ✅ (Active Lock) | ✅ |
| Force Unlock Stalled Match | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Hand Off Auction to Sports | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Generate Scorecards & Reports | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Access Admin Intelligence / Diagnostics | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Grant Tournament Licenses | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configure White-label Branding | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Section 4 — Complete Screen & Route Directory

### 4.1 Public & Marketing Surfaces (`artifacts/auction-platform` — **Protected Dark / High-Contrast**)
> **Theme Scope:** `lovable-home` / `lovable-theme dark`. Strictly protected from organiser light-mode modifications.
- `/`: Public Homepage / Landing page (features, testimonials, pricing, CTA).
- `/bpl`: BidWar Premier League portal.
- `/bpl/:edition`: BPL edition-specific public portal.
- `/upcoming-auctions`: Public directory of upcoming auctions and live streams.
- `/contact`: Contact sales and support form.
- `/pricing`: Transparent pricing calculator and tier comparison.
- `/auction-tips`: Educational tips for running professional player auctions.
- `/legal/:slug`: Terms of service, privacy policy, refund policy (`terms`, `privacy`, `refund`).
- `/blog`: Article directory with categories and author tags.
- `/academy`: Video and step-by-step guides for league management.
- `/cricket-auction-software` (and 14 sport landing slugs): Dedicated SEO search landing pages.
- `/live/:id`: Interactive public spectator live stream viewer with cheer reactions and chat heat meter.
- `/register/:code`: Universal modern mobile-first player registration portal.
- `/wa-consent/:token`: Dedicated WhatsApp notification opt-in confirmation page.

### 4.2 Organiser Auction Workspace (`AppLayout` — `artifacts/auction-platform` — **Light Mode**)
> **Theme Scope:** `.bw-organizer-light`, `[data-surface="organizer"]`. Full light-mode enterprise workspace.
- `/organizer`: Logged-in Organizer Dashboard (tournament cards, quick stats, creation CTA).
- `/organizer/profile`: Organizer profile, password change, WhatsApp consent settings.
- `/tournament/new`: Multi-step tournament creation wizard.
- `/tournament/:id`: Tournament Home / Module chooser.
- `/tournament/:id/auction-overview`: Auction Command Center (KPIS, readiness checklist, quick launch).
- `/tournament/:id/teams`: Team list, purse management, owner mobile numbers, access codes, logos.
- `/tournament/:id/categories`: Auction categories, price tiers, minimum bids, squad limits.
- `/tournament/:id/players`: Player roster table, bulk import, filters, approval status, payment status.
- `/tournament/:id/settings`: Complete tournament configuration (auction rules, sound, registration fields).
- `/tournament/:id/reports`: Downloadable Excel planning sheets, team purses, roster printouts.
- `/tournament/:id/links`: Quick share links for team owners, live displays, OBS, registration.
- `/tournament/:id/fortune-wheel`: Visual random draw wheel for stage lots.
- `/tournament/:id/break-timer`: Standalone countdown timer with looping stage music.
- `/tournament/:id/local-mode`: Offline token generation and bundle export for BidWar Local.
- `/tournament/:id/reset`: Safe auction reset interface (clears sold state, preserves teams/players).

### 4.3 Live Auction & Display Surfaces (**Protected Operational Dark**)
> **Theme Scope:** `OperatorLayout` / `lovable-theme dark`. High-contrast dark surfaces optimized for stage screens, projectors, and video broadcasts.
- `/tournament/:id/auction`: Live Auction Operator Console (`OperatorLayout` — operational dark console).
- `/tournament/:id/display`: Fullscreen Stage LED / Projector Display.
- `/tournament/:id/side-display`: Secondary display for team tables showing squad tables and purses.
- `/tournament/:id/obs/v2`: Transparent chroma-keyed OBS broadcast browser source.
- `/tournament/:id/obs/v2/preview`: OBS overlay test preview with simulated lot data.
- `/cricket/obs/wedding`: Royal Wedding Edition Cricket OBS Broadcast Overlay.

### 4.4 Team Owner App Surfaces (`artifacts/owner-app` — **Protected Mobile Dark**)
> **Theme Scope:** Isolated standalone mobile application. Protected dark visual styling with haptic triggers and wake-lock.
- `/join`: Mobile entry screen for team owners.
- `/join/teams`: Team picker when an owner phone number owns multiple teams.
- `/tournament/:id/owner/:teamId`: Real-time owner bidding console with wake-lock and haptics.

### 4.5 Sports Management & Cricket Scoring Workspace (`artifacts/scoring-app`)
> **Theme Scope:** Management surfaces use `.bw-organizer-light` under `SportsShell`. Live scoring pads (`/cricket/:matchId/score`) and scorer login (`/cricket/scorer`, `/scoring-app/login`) are **Protected Operational Surfaces**.
- `/tournament/:id/mission-control`: Sports Product Home (Cricket & Badminton unified portal) — *Light Mode*.
- `/tournament/:id/score/dashboard`: Cricket Organiser Dashboard — *Light Mode*.
- `/tournament/:id/score/settings`: Cricket Tournament Settings (overs, ball types, LBW, free hits) — *Light Mode*.
- `/tournament/:id/score/rules`: Cricket Rule Presets manager — *Light Mode*.
- `/tournament/:id/score/teams`: Cricket Team Roster management — *Light Mode*.
- `/tournament/:id/score/players`: Cricket Player Directory and performance profiles — *Light Mode*.
- `/tournament/:id/score/fixtures`: Match creation, group draws, knockout fixtures — *Light Mode*.
- `/tournament/:id/score/schedule`: Calendar view and ground allocation — *Light Mode*.
- `/tournament/:id/score/live-control`: Match toss, status override, official assignment — *Light Mode*.
- `/tournament/:id/score/standings`: Points table, Net Run Rate (NRR) calculator — *Light Mode*.
- `/tournament/:id/score/stats`: Tournament leaderboards (Orange Cap, Purple Cap, MVP) — *Light Mode*.
- `/tournament/:id/score/officials`: Umpires, scorers, and match referees roster — *Light Mode*.
- `/tournament/:id/score/awards`: Post-match awards (MOM, best bowler, best batter) — *Light Mode*.
- `/tournament/:id/score/reports`: Scorecard PDFs, match summaries — *Light Mode*.
- `/tournament/:id/score/links`: Public fan links, scorer PIN links, OBS scorebug URLs — *Light Mode*.
- `/cricket/scorer`: Scorer Portal Login (mobile + 4-digit PIN) — *Protected Operational Dark*.
- `/cricket/:matchId/score`: Ball-by-ball digital Cricket scoring pad — *Protected Operational Dark*.
- `/tournament/:id/score/:matchId`: Cricket Match Center (live scorecard, commentary, wagon wheel).

### 4.6 Badminton Workspace (`artifacts/scoring-app`)
> **Theme Scope:** Management surfaces use `.bw-organizer-light` under `SportsShell`. Scorer pad (`/badminton/:matchId/score`) is **Protected Operational Dark**.
- `/tournament/:id/badminton`: Badminton Tournament Hub — *Light Mode*.
- `/tournament/:id/badminton/categories`: Categories (Men's Singles, Doubles, Mixed, Age groups) — *Light Mode*.
- `/tournament/:id/badminton/players`: Badminton player entries and BWF rankings — *Light Mode*.
- `/tournament/:id/badminton/courts`: Physical court configuration (Court 1..N, PINs, streams) — *Light Mode*.
- `/tournament/:id/badminton/scorers`: Court scorer assignments and credentials — *Light Mode*.
- `/tournament/:id/badminton/fixtures`: Draw generator (Knockout, Round Robin, Group+Knockout) — *Light Mode*.
- `/tournament/:id/badminton/schedule`: Court scheduling matrix and time slots — *Light Mode*.
- `/tournament/:id/badminton/control`: Multi-Court Live Command Center — *Light Mode*.
- `/tournament/:id/badminton/results`: Completed match records and scores — *Light Mode*.
- `/tournament/:id/badminton/categories`: Categories (Men's Singles, Doubles, Mixed, Age groups).
- `/tournament/:id/badminton/players`: Badminton player entries and BWF rankings.
- `/tournament/:id/badminton/courts`: Physical court configuration (Court 1..N, PINs, streams).
- `/tournament/:id/badminton/scorers`: Court scorer assignments and credentials.
- `/tournament/:id/badminton/fixtures`: Draw generator (Knockout, Round Robin, Group+Knockout).
- `/tournament/:id/badminton/schedule`: Court scheduling matrix and time slots.
- `/tournament/:id/badminton/control`: Multi-Court Live Command Center.
- `/tournament/:id/badminton/results`: Completed match records and scores.
- `/tournament/:id/badminton/summary`: Tournament completion and winners podium.
- `/tournament/:id/badminton/scoring-format`: Scoring format rules (21x3, 11x5, sudden death).
- `/tournament/:id/badminton/analytics`: Player match stats and duration analysis.
- `/tournament/:id/badminton/branding`: Scoreboard logos and sponsor media.
- `/tournament/:id/badminton/broadcast`: Badminton OBS overlays and display feeds.
- `/badminton/scorer`: Badminton Scorer Portal Login.
- `/badminton/:matchId/score`: Point-by-point digital Badminton scoring pad.
- `/badminton/:matchId/display`: Court-side LED scoreboard.
- `/badminton/:matchId/overlay`: Broadcast lower-third graphics overlay.

### 4.7 Super Admin Platform (`artifacts/auction-platform` — `/admin`)
- `/admin/login`: Super admin authentication.
- `/admin`: Platform Overview Dashboard (total tournaments, live auctions, platform revenue).
- `/admin/events-activities`: Live global event audit trail.
- `/admin/live`: Live operations command center (active auctions, displays, connected owners, emergency shutdown).
- `/admin/tournaments`: All tournaments list, license status, sport breakdown.
- `/admin/tournaments/:id`: Deep tournament inspection and audit logs.
- `/admin/tournaments/:id/workbook`: Tournament Master Workbook (read/write data grid).
- `/admin/organisers`: Registered organizers list, verification status, contact details.
- `/admin/organisers/:id`: Organizer details, license grants, owned tournaments.
- `/admin/settings/branding`: Global white-label branding, logos, favicons, PWA icons, SEO tags.
- `/admin/settings/reports`: System financial and usage reports.
- `/admin/settings/intelligence`: Platform analytics, user growth, conversion metrics.
- `/admin/communication`: Bulk SMS and WhatsApp messaging center.
- `/admin/notifications`: Automated alert triggers and webhooks.
- `/admin/knowledge-center/academy`: CMS for adding and editing Academy lessons.
- `/admin/settings/system/diagnostics`: System health, database connection pool, Redis cache stats.
- `/admin/settings/system/audit-logs`: Immutable platform security audit trail.
- `/admin/settings/system/sms`: Gateway credentials for Fast2SMS / BulkSMS.
- `/admin/settings/system/session-lock`: Active operator lock inspector and force release.

---

## Section 5 — Domain Feature Catalog

### 5.1 Tournament Management & Lifecycle
- **Module Independence:** Explicit flags `auctionEnabled` (default true for backwards compatibility) and `scoringEnabled` (default false). Organizers can toggle modules at any time in tournament settings without data loss.
- **Multi-Sport Support:** Native sport configurations for `cricket`, `badminton`, and `football` with dynamic sport extension architecture (`sportsTable`).
- **Auction Readiness Engine:** Pre-flight checklist validating team count (min 2), player count, base prices, categories, and purse balance before allowing live auction start.
- **Licensing System:** States include `trial` (max 15 players/lots), `active` (full licensed features), `suspended` (locked by admin), `unlicensed`. Includes trial reset mechanism with audit logging.
- **Audio & Soundfx System:** Master volume, countdown ticks, gavel sold sound, unsold buzzer, cheer reactions, and looping break music with custom audio URL overrides.

### 5.2 Auction Engine & Live Operator Console
- **Operator Lock Lease:** Single active operator enforcement. Heartbeat sent every 30 seconds. Automatic release after 180 seconds of inactivity. Emergency takeover capability for authorized organizers.
- **Player Draw Mechanics:** Four selection modes:
  1. *Random Draw:* Unbiased shuffle from available player pool.
  2. *Serial Draw:* Sequential ordering by assigned `serialNo` (1, 2, 3...).
  3. *Category Draw:* Filtered by active categories selected in the operator drawer.
  4. *Fortune Wheel:* Visual spinning wheel picking lots randomly on stage displays.
- **Timer Engine:** Default timer (e.g. 30s) resetting on each bid, or Bid Extension Mode (if bid occurs in last 3s, timer extends by 5s instead of full reset). Operator can pause, resume, +10s, or stop timer at will.
- **Bidding Mechanics:**
  - Online owner bidding via mobile app.
  - Operator manual bid placement on behalf of stage bidders (paddle mode).
  - Configurable tier increments (Tier 1: 0-1L @ 25k, Tier 2: 1-2L @ 50k, Tier 3: 2L+ @ 1L).
  - Custom increment override per bid.
- **Sold / Unsold / Retain Actions:**
  - *Sell:* Allocates player to highest bidding team, debits team purse, records transaction in `bids` and `auction_events`, triggers sold banner and audio on displays.
  - *Manual Sell:* Direct allocation to any chosen team at any entered price.
  - *Unsold:* Moves player to unsold pool, updates session KPI, plays unsold sound.
  - *Retain:* Marks player retained by original franchise at contracted price.
- **Re-Auction Strategies:**
  - Individual player re-auction (resets status to available).
  - Bulk "Bring Back Unsold Players" with optional base price percentage discount (e.g. 50% discount) or customized opening bid strategy.
- **Undo Engine:** Transactional rollback restoring previous team purse, player status, and bid history in case of operator misclick.
- **Purse Booster System:** Allows organizers to grant emergency purse funds to teams during live auctions with immutable audit logging and on-screen LED toast notifications.
- **Roster Handoff:** Seamlessly clones auction sold rosters into Cricket or Badminton team squads with one click.

### 5.3 Team Owner Bidding Experience
- **Mobile-First PWA:** Accessible via phone browser without app store installation.
- **Authentication:** Dual-mode login via 8-char Tournament Code + Team Access Code, or mobile number OTP lookup.
- **Live Bid Button:** Prominently displays the exact next bid amount. Touch-optimized with haptic vibration feedback.
- **Safety Rails:**
  - Prevents bidding if team purse is insufficient.
  - Prevents bidding if squad maximum limit is reached.
  - Prevents bidding against oneself (when team already holds highest bid).
  - Disabled when auction is paused or timer reaches 0.
- **Pass Button:** Informs stage operator that the franchise drops out of current lot bidding.
- **Scout & Shortlist:** Browse upcoming lots, filter by role/category, star targets to alert owner when lot appears on stage.
- **Squad & Purse Monitor:** Live breakdown of remaining purse, average purse per remaining slot, and current roster breakdown by category.

### 5.4 Cricket Scoring Engine & Match Center
- **Rule Presets:** Customizable overs (T20, T10, 8-over Box Cricket, 50-over), balls per over (standard 6 or box 5), max wickets, bowler over quotas, and LBW/Free Hit toggles.
- **Powerplay Management:** Configurable powerplay overs (Mandatory, Batting, Bowling) with visual indicator on scorer pad and OBS overlay.
- **Digital Scoring Pad:**
  - Touch-friendly ball-by-ball entry (0, 1, 2, 3, 4, 6).
  - Extras handling: Wide (WD), No Ball (NB), Bye (B), Leg Bye (LB), Penalty runs.
  - Wicket modals: Bowled, Caught (with fielder attribution), Run Out (batsman, end, fielder), Stumped, LBW, Hit Wicket, Retired Hurt.
  - Multi-ball undo: Reverts match state, ball count, player runs/balls, and bowler figures accurately.
- **Over & Innings Transitions:** Automatic bowler change prompts at over end, automatic innings break prompt when overs or wickets expire, target chase calculation.
- **Rain & DLS Support:** Implemented Duckworth-Lewis-Stern target revision calculations (`scoring_dls_calculations`).
- **Super Over Engine:** Automated tie resolution supporting configurable super over overs, wickets, and bowler rules.
- **Officials Assignment:** Allocation of accredited umpires, scorers, and match referees from tournament registry.

### 5.5 Badminton Scoring Engine & Court Management
- **BWF Scoring Formats:** Standard 21 points x Best of 3, 11 points x Best of 5, or 15 points x Best of 3 with customizable deuce thresholds and sudden-death maximum points (e.g. 30 points cap in standard BWF).
- **Service & Court Mechanics:** Automated tracking of server, receiver, even/odd court positioning, and side changes.
- **Interactions & Intervals:**
  - Automatic 60-second interval trigger when either side reaches 11 points.
  - Automatic 120-second interval trigger between games.
  - Mid-game side change in deciding game (at 11 points).
- **Card Sanctions:** Yellow card (warning), Red card (fault + point awarded to opponent), Black card (disqualification).
- **Multi-Court Command Center:** Real-time bird's-eye view of all physical courts, live scoreboards, match durations, and scorer assignment status.
- **Draw Generation:** Single elimination knockout, double elimination, round-robin league groups, and automated promotion from group winners to knockout brackets.

### 5.6 Public Fan Experience, Spectator Displays & Broadcast Overlays
- **Main Stage LED Display (`/tournament/:id/display`):** Optimized for 16:9 4K/1080p projectors and stage LED walls. High-contrast typography, player portrait, bidding war animations, sponsor rotation, and live countdown timer.
- **Side Display (`/tournament/:id/side-display`):** Shows complete team tables, remaining purses, and squad sizes for venue monitor side-screens.
- **OBS V2 Broadcast Overlays (`/tournament/:id/obs/v2`):** Transparent browser-source graphic overlays with dynamic lower-thirds, player stats cards, "SOLD" full-screen stings, and sponsor carousels.
- **Royal Wedding OBS V3 Stage:** Premium celebratory broadcast graphic scene featuring specialized layout, typography, and entitlement gating.
- **Interactive Fan Live Viewer (`/live/:id`):** Spectator streaming hub with low-latency score updates, interactive emoji cheer reactions, and a live Cheer Heat Meter driving fan battles between rival teams.

### 5.7 Admin Super-Control Platform
- **Global License Governance:** Grant, extend, or revoke tournament licenses; manage organizer quotas.
- **Emergency Live Operations:** Live auction kill switch, connected socket monitoring, force lock release, and real-time database connection metrics.
- **Tournament Master Workbook:** Interactive grid allowing platform administrators to mass-edit player base prices, roles, teams, and stats in seconds.
- **White-Label Branding Engine:** Configure custom domain brand names, upload logos, set dark/light theme accents, generate dynamic PWA manifest files and social Open Graph image cards.
- **Omnichannel Communication Center:** Manage SMS gateway templates (Fast2SMS / BulkSMS DLT), WhatsApp Meta Cloud API templates, and broadcast urgent SMS alerts to organizers or owners.

### 5.8 Offline Operations — BidWar Local
- **Zero-Latency Offline Execution:** Standalone Electron app using embedded SQLite/PostgreSQL, eliminating dependency on venue internet during high-stakes auctions.
- **Cloud Bundle Export:** Organizers export an encrypted tournament bundle from the cloud portal via time-limited token (`export_token`).
- **Cryptographic Replay Prevention:** `exportTokenSyncedAt` ensures an exported bundle can only be synced back to cloud once.
- **Bid Replay & Reconciliation:** Offline bid logs and sold outcomes sync back to the cloud database when internet connectivity returns.

---

## Section 6 — Step-by-Step Operating Procedures & End-to-End Workflows

### Workflow 1: Creating a Tournament & Selecting Modules
1. Navigate to `/organizer` and click **“+ New Tournament”**.
2. **Step 1 (Basic Details):** Enter Tournament Name, City, Venue, Sport (Cricket, Badminton, Football), and Auction Date/Time.
3. **Step 2 (Module Selection):** Check **“Auction Module”** (if player bidding is required) and/or **“Sports Scoring Module”** (if match fixtures and scoring are required).
4. **Step 3 (Branding):** Upload Tournament Logo and Sponsor Logos.
5. Click **“Create Tournament”**. System generates a unique 8-character `auctionCode` (e.g. `RC732504`) and redirects to the Tournament Workspace.

### Workflow 2: Launching Public Player Registration & Verifying Payments
1. Go to **Settings > Registration** in the tournament workspace.
2. Configure registration deadline, registration limit, and category selection mode.
3. To collect registration fees, enable **“Registration Payment Verification”**, enter UPI ID, fee amount in ₹, and select verification method (`utr`, `screenshot`, or `utr_and_screenshot`).
4. Enable **“Registration Declaration”** and input organizer consent terms.
5. Copy the public registration link: `https://<domain>/register/<auctionCode>` and share with players.
6. As players submit forms, navigate to **Players > Payment Verification** tab:
   - Review uploaded payment screenshot and entered UTR number.
   - Click **“Approve”** to verify player into the auction/scoring pool, or **“Reject”** with a reason.

### Workflow 3: Setting Up Teams, Purses & Auction Categories
1. **Configure Categories:**
   - Go to **Categories** tab.
   - Click **“+ Add Category”** (e.g. "A+ All-Rounder", "Batsman", "Icon Player").
   - Set Minimum Base Price, Default Bid Increment, Bid Tiers, and Max Players per team for this category.
2. **Add Teams:**
   - Go to **Teams** tab.
   - Click **“+ Add Team”**.
   - Enter Team Name, Short Code (e.g. "MI", "CSK"), Franchise Owner Name, Owner Mobile Number, and Team Color.
   - Allocate Total Purse (e.g. ₹1,00,00,000 or 10,000 Points).
   - System automatically generates a secure 6-digit `accessCode` for the owner app.

### Workflow 4: Conducting a Live Player Auction (Operator + Team Owners)
1. **Pre-Flight Check:** Navigate to **Auction Overview**. Ensure all checklist items are green (Teams added, Players assigned base prices, Categories defined).
2. **Setup Displays:** Open Stage LED Display on secondary monitor: `/tournament/:id/display`.
3. **Launch Operator Console:** Click **“Start Live Auction”** to enter `/tournament/:id/auction`. Operator console acquires exclusive session lock.
4. **Connect Team Owners:** Owners open `/join`, enter their mobile number, receive their team pad, and enter their team's access code.
5. **Draw Player:** Click **“Next Player”** (or press Spacebar). System draws a lot based on active selection mode (Random, Serial, or Category).
6. **Bidding:**
   - Owners tap **“Bid”** on their phone screens, or stage operator clicks **“Place Bid”** for in-person paddles.
   - Timer counts down from configured timer seconds. Each bid resets or extends the timer.
7. **Concluding the Lot:**
   - When timer expires or no further bids occur, call "Going Once, Twice, Sold".
   - Click **“Sell Player”** (or Enter). The player is assigned to the highest bidding team, purse is debited, and the stage display plays celebratory audio.
   - If no bids were placed, click **“Mark Unsold”**.

### Workflow 5: Handling Unsold Players, Re-Auctions & Purse Boosters
1. **Re-Auction Single Player:** In the operator console, open the player drawer, locate the unsold player, and click **“Bring to Table”**.
2. **Bulk Re-Auction:** In **Players** tab, click **“Re-Auction Unsold”**. Select whether to discount base prices (e.g. 50% discount) or maintain original values.
3. **Issue Purse Booster:** If an organizer permits a team to inject extra purse during the auction:
   - Operator clicks **“Purse Booster”** icon next to the team.
   - Enter booster amount (e.g. ₹5,00,000) and mandatory operational reason (e.g. "Sponsor Bonus").
   - Click **“Confirm Booster”**. Team's available capacity increases instantly; on-screen LED toast announces the adjustment.

### Workflow 6: Handing Off Rosters from Auction to Sports Scoring
1. Once all auction lots are concluded, navigate to **Auction Overview**.
2. Click **“Conclude Auction”**.
3. Click **“Hand Off to Sports Scoring”**.
4. System validates sold rosters, maps auction teams to tournament sport teams, creates player profiles in `scoring_match_squads`, and unlocks the Cricket or Badminton match scheduling interface.

### Workflow 7: Conducting Cricket Scoring (Toss to Result)
1. In Cricket Workspace (`/tournament/:id/score`), navigate to **Fixtures** and click **“+ New Match”**. Select Home Team, Away Team, Venue, Date, and Rule Preset.
2. Scorer opens `/cricket/scorer`, enters mobile number + 4-digit PIN, and selects the assigned match.
3. System grants a 3-minute heartbeat match lock.
4. **Toss:** Record Toss Winner and Decision (Bat / Bowl).
5. **Playing XI:** Select playing squads and designate Opening Batsmen and Opening Bowler.
6. **Scoring:** Tap ball outcomes (runs, boundaries, extras). For wickets, select dismissal type, fielder, and new batsman.
7. System automatically tallies over transitions and prompt innings changes. Upon completion, match result string is locked and tournament points table / NRR update instantly.

### Workflow 8: Conducting Badminton Tournament (Draws, Courts, Match Scoring)
1. In Badminton Hub (`/tournament/:id/badminton`), create categories (e.g. "Men's Singles").
2. Assign registered players to categories.
3. Go to **Fixtures**, choose draw format (Knockout / Round Robin), and click **“Generate Draw”**.
4. Go to **Courts**, configure Court 1..N and set court PINs.
5. In **Schedule**, drag fixtures onto court time slots.
6. Scorer logs into `/badminton/scorer`, opens the court match, records toss winner/side, and scores points. System handles side switches at game end and 11-point mid-game mark in deciding sets.

### Workflow 9: Generating Reports, Scorecards & Master Workbooks
1. **Auction Reports:** Go to **Reports** tab. Export Master Auction Summary (Excel), Team Squad Printouts (PDF), and Unsold Player Rosters.
2. **Cricket Reports:** Go to **Score > Reports**. Export official Match Scorecard PDFs, tournament batting/bowling statistics, and league standings.
3. **Admin Master Workbook:** Admins access `/admin/tournaments/:id/workbook` to inspect, filter, and batch export the entire tournament relational dataset.

### Workflow 10: Running Offline Auction with Cloud Synchronization
1. Prior to event day with internet connectivity, go to **Settings > Local Mode**.
2. Click **“Generate Export Bundle”**. The server signs a secure export bundle with a single-use token (`export_token`).
3. Download the bundle and open **BidWar Local** on the offline auction laptop. Import the bundle.
4. Conduct the auction locally with zero network latency. All transactions are logged to local database.
5. After the event, reconnect laptop to internet, open BidWar Local, and click **“Sync to Cloud”**. Cloud validates the token, reconciles sold lots, and updates live spectator records.

---

## Section 7 — Registration Guide, Form Fields & Validations

### 7.1 Registration Architecture
Public player registration runs through `/register/:code` (where `:code` is the tournament's 8-character `auctionCode`).
The registration journey includes:
1. Mobile number entry with Indian 10-digit validation (`^[6-9]\d{9}$`).
2. Global profile autofill from `global_players` (cross-tournament identity) triggered only when a returning player enters an existing 10-digit mobile number.
3. Clean unselected initial form state: On initial page load or form reset, all fields start unselected/blank so players explicitly fill in all their details. Primary Sport Role initializes to "Select role" without defaulting to any role (such as Batsman), kit sizing (jersey size, lower size) and gender initialize with "Select size" / "Select gender" placeholders without pre-selecting "Not specified", and match schedule availability chips start unselected.
4. Mandatory field indication: All mandatory / required fields display a prominent red star mark (`*`) directly adjacent to the field label in addition to the uppercase `Required` badge (`RegLabel`, `JerseySizeSelect`, `LowerSizeSelect`, `PlayerGenderSelect`, Rules Declaration, and WhatsApp consent).
5. Personal details and photo capture.
6. Sport-specific roles and technical specifications.
7. Date availability matching tournament match schedule.
8. Organizer custom questions.
9. Payment gateway verification (UPI + UTR / Screenshot).
10. Legal terms declaration and WhatsApp opt-in.

### 7.2 Implemented Registration Fields Reference

| Field Name | Data Key | Required / Optional | Validation Rule | Purpose & Implementation |
|:---|:---|:---:|:---|:---|
| **Mobile Number** | `mobileNumber` | Required | 10 Indian digits, starting with 6, 7, 8, or 9. | Primary identifier. Triggers autofill lookup in `global_players`. |
| **Player Name** | `name` | Required | 2 to 100 characters, trimmed. | Full name displayed on auction screens and scorecards. |
| **City** | `city` | Configurable | String via `CityAutocomplete`. | Player home location for player profile and roster scouting. |
| **Age** | `age` | Configurable | Integer between 5 and 99. | Verification for age-bracketed tournaments (U-15, U-19, Veterans). |
| **Gender** | `gender` | Configurable | `Male`, `Female`, `Other`. | Division filtering and tournament eligibility. |
| **Player Photo** | `photoUrl` | Configurable | JPG/PNG, max 10MB. Enforces 1:1 square crop via `ImageEditorDialog`. | Uploaded to Cloudinary with facial centering; used on stage LED and OBS cards. |
| **Category** | `categoryId` | Conditional | Valid `categories.id` when `registrationCategoryMode = 'player_select'`. | Self-selected tournament division or skill bracket. |
| **Primary Sport Role** | `role` | Configurable | Sport-dependent (e.g. Batsman, Bowler, All-Rounder, Wicketkeeper). | Core classification driving auction valuation and squad balance. |
| **Batting Style** | `battingStyle` | Configurable | `Right Hand Bat`, `Left Hand Bat`. | Cricket technical profile displayed on scoreboard. |
| **Bowling Style** | `bowlingStyle` | Configurable | `Right Arm Fast`, `Right Arm Spin`, `Left Arm Fast`, `Left Arm Spin`. | Cricket technical bowling classification. |
| **Handedness** | `handedness` | Configurable | `Right`, `Left`. | Badminton technical hand orientation. |
| **Base Price / Bid Value** | `basePrice` | Conditional | Picked from `bidValueOptions` when `bidValueMode = 'player'`. | Self-selected starting bid for specialized corporate leagues. |
| **Jersey Number** | `jerseyNumber` | Configurable | Alphanumeric (1 to 3 characters, e.g. "07", "18", "99"). | Printed on player kits and displayed in line-ups. |
| **Jersey Size** | `jerseySize` | Configurable | `XS`, `S`, `M`, `L`, `XL`, `XXL`, `3XL`, `4XL`. | Organizer apparel procurement sizing. |
| **Lower / Pant Size** | `lowerSize` | Configurable | `28`, `30`, `32`, `34`, `36`, `38`, `40`, `42`. | Organizer uniform bottoms procurement sizing. |
| **Availability Dates** | `availabilityDates` | Configurable | Array of dates matching tournament `matchDates`. | Player confirms availability for specific tournament match days. |
| **Achievements** | `achievements` | Configurable | Text up to 1000 characters. | Highlights, previous league honors, or career stats. |
| **CricHeroes URL** | `cricheroUrl` | Configurable | Valid web URL. | External cricket stats profile link for franchise scouting. |
| **Custom Questions** | `customAnswersJson` | Configurable | Type: `short_text`, `number`, `single_choice`, `multiple_choice`, `dropdown`. | Organizer-defined fields (e.g. "Company Branch", "Shoe Size"). |
| **Payment UTR** | `utrNumber` | Conditional | 12-digit alphanumeric transaction reference. | Required when fee payment enabled and method includes UTR. |
| **Payment Screenshot** | `paymentScreenshotUrl` | Conditional | Image file (JPG/PNG). | Required when fee payment enabled and method includes screenshot. |
| **Declaration Acceptance** | `declarationAccepted` | Conditional | Boolean (`true`). | Required when organizer declaration points are enabled. |
| **WhatsApp Consent** | `whatsappConsent` | Optional | Boolean. | Meta-compliant opt-in for receiving score updates and notifications. |

---

## Section 8 — Buttons, Controls & Actions Reference

### 8.1 Auction Workspace & Operator Console Controls

| Control Label | Location | Eligible Roles | Prerequisites | Action & Effect | Confirmation / Error Behavior |
|:---|:---|:---|:---|:---|:---|
| **“Start Live Auction”** | `/tournament/:id/auction-overview` | Organizer, Admin | Pre-flight checklist green | Enters `/tournament/:id/auction` and acquires operator lock lease. | Blocks entry if lock held by another active operator session. |
| **“Next Player” / [Space]** | Operator Console Top Bar | Active Operator | Auction active, no lot in progress | Draws next player lot and starts bidding timer. | Disabled while current lot is active. |
| **“Place Bid” (+Increment)** | Operator Console Bidding Pane | Active Operator | Lot active on stage | Submits bid on behalf of selected stage franchise. | Auto-validates purse sufficiency; plays bid click sound. |
| **“Custom Bid”** | Operator Console Bidding Pane | Active Operator | Lot active on stage | Allows operator to enter arbitrary bid amount exceeding current bid. | Rejects if amount is less than current bid + min increment. |
| **“Sell Player” / [Enter]** | Operator Console Action Bar | Active Operator | Current bid held by a team | Sells player to holding team, debits purse, triggers sold celebration. | Requires confirmation dialog if squad limit reached. |
| **“Mark Unsold”** | Operator Console Action Bar | Active Operator | Lot active, no bids placed | Marks player as unsold, clears table, prompts next player. | Warning toast if bids already exist. |
| **“Undo Last Action”** | Operator Console Action Bar | Active Operator | At least one action in session history | Reverts the last sold, unsold, or bid action; restores purse. | Prompts: "Are you sure you want to rollback the last lot?". |
| **“Pause Auction”** | Operator Console Action Bar | Active Operator | Auction in progress | Freezes timer and disallows incoming mobile bids. | Status updates to `paused`. |
| **“Resume Auction”** | Operator Console Action Bar | Active Operator | Auction paused | Resumes timer from paused seconds. | Status updates to `active`. |
| **“Stop Timer”** | Operator Console Timer Widget | Active Operator | Timer running | Halts countdown clock indefinitely. | Timer border changes to orange. |
| **“Start Timer (+10s)”** | Operator Console Timer Widget | Active Operator | Lot active | Adds 10 seconds to clock and resumes countdown. | Audio countdown tick re-engages. |
| **“Break Timer”** | `/tournament/:id/break-timer` | Organizer, Admin | None | Sets scheduled intermission (e.g. 15m) with looping background music on displays. | Broadcast displays overlay full-screen break clock. |
| **“Fortune Wheel”** | `/tournament/:id/fortune-wheel` | Organizer, Admin | Available lots in pool | Spins interactive wheel on stage screen to pick random lot. | Stage audio plays spinning tick; locks winner on landing. |
| **“Bring Back Unsold”** | `/tournament/:id/players` | Organizer, Admin | Unsold players exist | Reopens unsold players for a second bidding round. | Modal asks for base price discount percentage (0% to 75%). |
| **“Purse Booster”** | Operator Team Cards | Organizer, Admin | Active auction session | Injects emergency capacity into team purse. | Logs reason and amount to immutable audit trail. |
| **“Conclude Auction”** | Operator Console Header | Organizer, Admin | All lots completed | Sets tournament status to `completed`, finalizes purses. | Irreversible confirmation dialog. |
| **“Hand Off to Sports”** | `/tournament/:id/auction-overview` | Organizer, Admin | Auction completed, scoring module enabled | Clones auction rosters into Cricket/Badminton teams. | Warns if existing sport squads exist. |
| **“Reset Auction Data”** ⚠️ | `/tournament/:id/reset` | Organizer, Admin | Danger Zone | Wipes all bids, sold states, and resets purses to base. | Requires typing tournament name to confirm. Irreversible! |

### 8.2 Cricket & Badminton Scorer Controls

| Control Label | Location | Eligible Roles | Prerequisites | Action & Effect | Confirmation / Error Behavior |
|:---|:---|:---|:---|:---|:---|
| **“Acquire Match Lock”** | Match Center Header | Scorer, Organizer | Match scheduled/live | Claims exclusive scoring rights for current session. | Fails if another scorer has an active lease. |
| **“Record Toss”** | Cricket Match Center | Active Scorer | Match scheduled | Sets toss winner and elected action (Bat/Bowl). | Locks team inning order. |
| **“Runs (0, 1, 2, 3, 4, 6)”** | Cricket Scorer Pad | Active Scorer | Match live, ball active | Records ball event, adds runs to batter & team total. | Updates wagon wheel and run rate. |
| **“Extras (WD, NB, B, LB)”** | Cricket Scorer Pad | Active Scorer | Match live | Records extra, adds run penalty, adjusts legal ball count. | Wide/No-ball does not advance legal ball count. |
| **“Wicket”** | Cricket Scorer Pad | Active Scorer | Match live | Opens wicket modal (dismissal type, fielder, outgoing batter). | Advances wicket count; prompts for incoming batter. |
| **“Undo Ball”** | Cricket Scorer Pad | Active Scorer | Previous ball exists | Rolls back last ball event, restores batsman runs & bowler overs. | Toast confirms ball rollback. |
| **“Complete Over”** | Cricket Scorer Pad | Active Scorer | 6 legal balls bowled | Prompts for next bowler; changes bowling end. | Prevents same bowler from bowling consecutive overs. |
| **“Innings Break”** | Cricket Scorer Pad | Active Scorer | All wickets down or overs completed | Closes 1st innings, calculates target score, prepares 2nd innings. | Displays 1st innings scorecard summary. |
| **“Point (Team A / B)”** | Badminton Scorer Pad | Active Scorer | Badminton match live | Adds point to side, tracks serving court (even/odd). | Updates game score; checks for 11-point interval. |
| **“Card (Yellow/Red)”** | Badminton Scorer Pad | Active Scorer | Badminton match live | Issues sanction; Red card awards point to opponent. | Logs card in official match history. |
| **“Undo Point”** | Badminton Scorer Pad | Active Scorer | Points scored in game | Reverts last point, resets server position. | Instant rollback. |
| **“End Match”** | Cricket / Badminton Pad | Active Scorer | Victory condition met | Marks match `completed`, computes player stats and MOM. | Final confirmation prompt. |

### 8.3 Form Controls, Help Tooltips & Dynamic Portal Theme Resolution

| Control / Primitive | Implementation | Accessibility & Interaction Behaviors | Theming Behavior |
|:---|:---|:---|:---|
| **FieldTooltip** | `artifacts/auction-platform/src/components/ui/field-tooltip.tsx` | • **Keyboard Focusable:** `tabIndex={0}`, responds to `Enter` and `Space` to toggle.<br>• **Dismissible:** Pressing `Escape` closes the tooltip.<br>• **Collision-Aware:** Bounds to viewport with `collisionPadding={12}`, auto flip & shift.<br>• **Focus Ring:** Accessible `focus-visible:ring-2 focus-visible:ring-blue-600`. | Inherits surrounding theme; renders pure white tooltip card with fine border in light mode, high-contrast dark card in protected surfaces. |
| **Dynamic Portal Resolver** | `artifacts/auction-platform/src/lib/portal-theme.ts` (`getPortalThemeClass()`) | Portals mount to `document.body` outside the regular React tree. The dynamic resolver inspects current route pathname and active DOM surfaces to inject proper scoping class. | Injects `bw-organizer-light` inside organiser routes; injects `lovable-theme dark` on protected broadcast, display, and scoring pad routes. |
| **Modal Dialogs & Sheets** | Radix `Dialog`, `Sheet`, `AlertDialog` | Focus trap, keyboard navigation (`Escape`, `Tab`), backdrop blur. | Styled with `bg-card text-card-foreground border-border shadow-xl`. In organiser workspace, cards render in crisp `#FFFFFF` with neutral borders. |
| **Select & Dropdowns** | Radix `Select`, `DropdownMenu` | Arrow key navigation, auto-scroll to selected option, typeahead search. | Options highlight with subtle light-mode hover (`bg-accent text-accent-foreground`). |

---

## Section 9 — Statuses & State Transition Reference

### 9.1 Tournament Lifecycle States

```
[draft] ──► [setup] ──► [registration] ──► [active] ──► [completed] ──► [archived]
```

- `draft`: Initial tournament shell, basic info being entered.
- `setup`: Teams, categories, and rules being configured.
- `registration`: Public player registration link open and accepting submissions.
- `active`: Live auction in progress or sports matches being played.
- `completed`: All auction lots sold/unsold, or championship match concluded.
- `archived`: Read-only historic record.

### 9.2 Auction Session States

```
[idle] ──► [active] ──► [paused] ──► [active] ──► [break] ──► [concluded]
```

- `idle`: Auction room created; operator has not clicked Start.
- `active`: Live bidding underway; timer active; accepting bids.
- `paused`: Temporarily halted by operator; timer frozen; bids rejected.
- `break`: Scheduled intermission; display screens render countdown and music.
- `concluded`: Final lot processed; results locked.

### 9.3 Player Auction Lot States

```
[available] ──┬──► [sold]
              ├──► [unsold] ──► [available] (via Re-Auction)
              └──► [retained]
```

- `available`: Eligible to be drawn onto stage.
- `sold`: Knocked down to a franchise at final hammer price.
- `unsold`: Passed without qualifying bids; eligible for re-auction.
- `retained`: Kept by franchise prior to auction at designated retained price.

### 9.4 Match Lifecycle States (Cricket & Badminton)

```
[scheduled] ──► [in_progress / live] ──┬──► [completed]
                                       ├──► [abandoned] (Rain / Technical)
                                       └──► [walkover]
```

### 9.5 Scorer Match Lock State Lifecycle
- **Acquired:** Token generated (`leaseId`), `expiresAt` set to `now() + 180s`.
- **Heartbeat:** Scorer client pings `/api/scorer/matches/:id/lock/heartbeat` every 30s, extending lease.
- **Released:** Scorer logs out or unloads match, setting lock free.
- **Expired:** If no heartbeat received for 180s (app crashed or battery died), lock automatically expires, allowing another scorer to acquire it.

### 9.6 Registration Payment Verification States
- `pending`: Player submitted UPI UTR / Screenshot; awaiting organizer review.
- `approved`: Organizer validated funds; player approved into auction/scoring roster.
- `rejected`: Invalid transaction ID or missing payment; player excluded from lot pool.

---

## Section 10 — Settings, Configuration, Reports & Integrations

### 10.1 Tournament Settings Inventory
- **Auction Engine Settings:**
  - `basePurse`: Default budget allocated to newly created teams (e.g. ₹1,00,00,000).
  - `minBid`: Minimum opening bid for un-categorized players.
  - `bidIncrement`: Standard increment step.
  - `bidTier1UpTo`, `bidTier1Increment`: Tier 1 escalation rules.
  - `bidTier2UpTo`, `bidTier2Increment`: Tier 2 escalation rules.
  - `bidTier3Increment`: Upper tier increment rule.
  - `timerSeconds`: Clock duration for lots (default 30s).
  - `bidExtensionEnabled`: Extends clock if bid submitted near zero.
  - `ownerBiddingEnabled`: Toggles online owner bidding vs paddle mode.
  - `playerSelectionMode`: `random`, `serial`, `category`.
- **Audio & Sound Settings:**
  - `audioEnabled`: Master audio toggle.
  - `masterVolume`: 0 to 100%.
  - `countdownSoundEnabled`, `countdownSoundUrl`, `countdownSoundVolume`.
  - `soldSoundEnabled`, `soldSoundUrl`, `soldSoundVolume`.
  - `breakEndMusicEnabled`, `breakEndMusicUrl`, `breakEndMusicVolume`.
- **Interactive Cheer Settings:**
  - `cheerMessagesEnabled`: Toggles live spectator emoji reactions.
  - `cheerCooldownSeconds`: Rate limiter per fan device (default 2s).
  - `cheerHeatMeterEnabled`: Shows live fan battle bar on stream.

### 10.2 Reports & Exports Engine
- **Master Auction Workbook (Excel):** Full roster data, sold prices, team purses, category distribution.
- **Team Planning Dossier (PDF):** Squad list per franchise with jersey numbers and player roles.
- **Cricket Official Scorecard (PDF):** Complete ball-by-ball summary, fall of wickets, bowling analysis.
- **Badminton Bracket Poster (PDF/PNG):** Tournament elimination tree with match scores.

### 10.3 Third-Party Integrations & Gateways
- **Cloudinary:** Cloud storage, facial crop detection, and optimized thumbnail delivery for player photos and team logos.
- **Fast2SMS / BulkSMS:** Indian DLT-compliant SMS gateway for organizer verification OTPs and urgent tournament announcements.
- **Meta WhatsApp Cloud API:** Automated delivery of onboarding welcomes, player registration receipts, and match results.
- **Google Sheets API:** One-click OAuth synchronization to export player rosters directly into an organizer's personal Google Drive.
- **OBS Studio:** Browser Source integration utilizing transparent web overlays with zero Chroma-key artifacts.

### 10.4 Organiser Light Mode Design System Specification

The BidWar Organiser Light Mode is implemented in `artifacts/auction-platform/src/styles/organizer-light-theme.css` and scoped via `.bw-organizer-light` and `[data-surface="organizer"]`.

#### 10.4.1 Semantic Design Tokens

| CSS Variable | Hex / Value | Purpose & Application |
|:---|:---|:---|
| `--org-background` | `#F3F6FA` | Primary workspace canvas background (cool off-white). |
| `--org-surface` | `#FFFFFF` | Cards, modals, sheets, popovers, dropdown menus, and form inputs. |
| `--org-surface-muted` | `#F8FAFC` | Secondary panels, table headers, and neutral well containers. |
| `--org-foreground` | `#0F172A` | Slate-900 deep high-contrast primary text and headings for strong readability. |
| `--org-muted-foreground` | `#475569` | Slate-600 readable metadata, timestamps, helper descriptions, and icons. |
| `--org-primary` | `#EAB308` | BidWar Gold accent for primary action buttons and active highlights. |
| `--org-primary-foreground` | `#0F172A` | Slate-900 text on gold action buttons ensuring high contrast. |
| `--org-border` | `#CBD5E1` | Slate-300 crisp borders for inputs, selection boxes, cards, and structural dividers. |
| `--org-input` | `#FFFFFF` | Form input backgrounds paired with `#CBD5E1` 1.5px solid borders. |
| `--org-focus` | `#2563EB` | High-visibility accessible focus ring. |
| `--org-sidebar` | `#FFFFFF` | Navigation rail and sidebar background. |
| `--org-sidebar-active` | `#FEF3C7` | Warm gold-tinted highlight for active navigation items. |

#### 10.4.2 Semantic Status Palette

| Status | Background | Text / Border | Use Cases |
|:---|:---|:---|:---|
| **Success** | `#ECFDF5` (`bg-emerald-50`) | `#047857` (`text-emerald-700`) | Approved registrations, sold lots, completed matches, live connection. |
| **Warning** | `#FFFBEB` (`bg-amber-50`) | `#B45309` (`text-amber-800`) | Trial license badges, unsaved changes, impending purse depletion. |
| **Danger** | `#FEF2F2` (`bg-rose-50`) | `#B91C1C` (`text-rose-700`) | Auction reset danger zones, disqualified players, rejected payments. |
| **Informational** | `#EFF6FF` (`bg-blue-50`) | `#1D4ED8` (`text-blue-700`) | Help tooltips, active lot notifications, module handoff status. |

#### 10.4.3 Universal Typography, Elevation & Interactive Elements

- **Universal Fonts:**
  - **Body & Inputs:** Inter (`--font-sans`) applied universally across navigation links, data tables, inputs, labels, tooltips, dialogs, and body text.
  - **Headings & Page Titles:** Space Grotesk (`--font-display`) applied consistently across all page titles, section headers, KPI counters, and modal titles with tighter tracking (`-0.02em`) for a cohesive BidWar feel.
  - **Numeric Figures:** `tabular-nums` enforced universally on all currency amounts, bids, points, player counts, and timers so numbers align neatly.
- **Shadows, Lines & Elevated Surfaces:**
  - **Cards & Rails:** Crisp white (`#FFFFFF`) with a clean 1px solid `#E2E8F0` border line and subtle elevation (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)`).
  - **Tables:** Table headers use `#F8FAFC` background with a crisp bottom divider (`1px solid #E2E8F0`). Rows have visible horizontal border lines (`1px solid #F1F5F9`) with soft yellow hover highlights (`#FEF9C3` on active/hovered row).
  - **Modals & Dialogs:** Elevated with `box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`. Inset sections (`form-section-inset`, `player-form-section`, `settings-inset-block`, `bg-card/40`, `bg-card/50`) use clean `#F8FAFC` background, `#E2E8F0` borders, and `#172B4D` labels.
  - **Popovers & Dropdowns:** Elevated with `box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.08)`.
- **Buttons Unification:**
  - **Primary Action (BidWar Gold):** Background `#EAB308`, text `#172B4D`, font-weight 600, radius `0.5rem`, subtle shadow (`0 1px 2px rgb(0 0 0 / 0.05)`), hover `#CA8A04`.
  - **Secondary / Outline Buttons:** Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#172B4D`, hover `#F8FAFC` / border `#CBD5E1`.
  - **Destructive / Red Buttons:** Background `#FEF2F2`, border `#FECACA`, text `#DC2626`, hover `#FEE2E2`.
- **Universal Loaders & Skeletons:**
  - Skeletons and loading pulses are bound to neutral light shimmer (`#E2E8F0` / `#F1F5F9` pulse) rather than dark overlays.
  - Route loading fallbacks use clean `#F3F6FA` canvas and light spinner.
- **Sidebar Sticky Navigation:**
  - `CurrentTournamentContext` is pinned `sticky top-0 z-20` so the tournament card remains permanently visible when navigating or scrolling down to bottom links.

---

## Section 11 — Troubleshooting, Known Limitations & FAQs

### 11.1 Troubleshooting Operational Issues

| Symptom | Root Cause | Solution |
|:---|:---|:---|
| **“Operator Lock Held by Another Session”** | Another browser tab or computer is holding the 180s operator lease. | Click **“Take Over Lock”** (if authorized organizer) or wait 3 minutes for heartbeat expiry. |
| **Team Owner Cannot Bid on Mobile** | 1. Purse is lower than next required bid.<br>2. Team has reached maximum squad size.<br>3. `ownerBiddingEnabled` is turned off. | 1. Issue Purse Booster if authorized.<br>2. Check Category player caps.<br>3. Enable Owner Bidding in Tournament Settings. |
| **OBS Overlay Shows Dark Background Instead of Video** | OBS Browser Source CSS background is set to default `#000` instead of transparent. | In OBS Browser Source properties, ensure "Custom CSS" contains `body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }`. |
| **Scorer Cannot Score Cricket Match** | Previous scorer crashed without releasing lock. | Organizer navigates to match live control and clicks **“Force Unlock Match”**. |
| **Audio Effects Not Playing on LED Display** | Modern browsers (Chrome, Edge) block autoplay audio without user interaction. | Click anywhere on the LED display screen once after opening to enable browser audio context. |

### 11.2 Known Limitations
1. **Local Mode Cloud Sync Replay:** An export bundle can only be synced back to cloud once (`exportTokenSyncedAt`). If an organizer attempts to sync the same file twice, it is rejected to prevent duplicate purse deductions.
2. **Concurrent Bidding Millisecond Ties:** If two owners press bid at the exact same millisecond, Redis optimistic locking awards the bid to the first processed write; the second receives an updated current price and must tap again.
3. **Football Scoring Engine:** Football tables exist in schema (`sports-football`), but full digital scoring pad is currently under Phase 2 active development.

---

## Section 12 — Needs-Verification Registry & Source Code Map

### 12.1 Codebase Source Map
- **API Server Entry & Core:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/index.ts`
- **Database Schemas:** `lib/db/src/schema/*.ts`
- **Auction Engine Routes:** `artifacts/api-server/src/routes/auction.ts`
- **Cricket Scoring Core:** `lib/scoring-core`, `artifacts/auction-platform/src/pages/cricket/scorer.tsx`
- **Badminton Core:** `lib/badminton-core`, `artifacts/auction-platform/src/pages/badminton/scorer.tsx`
- **Team Owner Application:** `artifacts/owner-app/src`
- **Stage LED & Overlays:** `artifacts/auction-platform/src/pages/display.tsx`, `obs-v2-overlay.tsx`
- **Public Player Registration:** `artifacts/auction-platform/src/pages/player-register.tsx`
- **Super Admin Portal:** `artifacts/auction-platform/src/pages/admin-*.tsx`
- **Organiser Light Theme & Design System:** `artifacts/auction-platform/src/styles/organizer-light-theme.css`, `artifacts/auction-platform/src/lib/portal-theme.ts`
- **Organiser Workspace Shells:** `artifacts/auction-platform/src/components/layout.tsx`, `artifacts/auction-platform/src/components/sports-shell/sports-shell.tsx`

### 12.2 Needs-Verification Items

| Item / Feature | Code Location | Nature of Limitation / Note |
|:---|:---|:---|
| **Football Scoring Engine** | `lib/sports-football` | Database schema present; interactive scoring UI is currently in prototype / planned status. |
| **DLS Calculation Precision** | `scoring_dls_calculations.ts` | Mathematical Duckworth-Lewis table references standard ICC resources; custom local league tables require organizer audit. |
| **Automated WhatsApp Media Delivery** | `artifacts/api-server/src/lib/whatsapp.ts` | Meta WhatsApp Cloud API credentials required in environment (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`); falls back to web consent if unconfigured. |

---

## Section 13 — Change Log & Maintenance Record

| Date | Author / Agent | Changes & Domains Affected | Operational Impact |
|:---|:---|:---|:---|
| **2026-11-13** | Antigravity AI Engineering | Player Registration Autofill & Mandatory Star Mark Fix: 1. Resolved unintended field pre-population on fresh tournament registration (`/register/:code`) by removing automatic defaulting of `role` to first sport role ("Batsman"), removing automatic pre-selection of all `availabilityDates`, and fixing `JerseySizeSelect`, `LowerSizeSelect`, and `PlayerGenderSelect` so empty values do not default to "Not specified" and instead display "Select size" / "Select gender" placeholders. 2. Added prominent red star mark (`*`) on all mandatory fields across `RegLabel`, `JerseySizeSelect`, `LowerSizeSelect`, `PlayerGenderSelect`, Email address field, Tournament Rules Declaration, and WhatsApp consent. 3. Replaced ad-hoc `OptionalEmailField` in registration form with standard `reg-field` + `RegLabel` and `emailAuto` state for consistent UI alignment. | Ensures all players start with clean unselected forms where all details must be filled explicitly, with crystal-clear red asterisk indicators on all required inputs. |
| **2026-11-13** | Antigravity AI Engineering | Typography & UI Contrast Unification (User Verification Feedback Execution): 1. Enforced 100% Inter font family universally across both left sidebar and right-side content (headings, cards, tables, inputs, and descriptions), eliminating previous Space Grotesk font divergence. 2. Upgraded Tournament Creation Wizard and universal form controls with crisp 2px border definition, distinct hover states, and BidWar gold focus glow (3px rgba(234, 179, 8, 0.25)). 3. Established strict typographic scale (h1 24px/700, h2 18px/700, h3 15px/600, h4 13px/700 uppercase, subheadings 14px/400) and WCAG AA contrast by remapping faded text classes (.text-slate-400 to #475569, .text-slate-500 to #334155, placeholders to #64748B). 4. Universalized light loader screens (#F3F6FA background with amber spinner) across all tournament route fallbacks and OrganizerGuard, completely preventing dark blue loading screens. 5. Refined Badminton Mission Control / Operator Panel by fixing invisible white court names (switched to text-slate-900), setting score typography to font-sans, and removing duplicate desktop header logos in SportsShell. | Resolved font inconsistency, low-contrast box edges, faded text legibility, dark blue loader flashes, and operator panel visual defects across the entire organiser experience. |
| **2026-11-12** | Antigravity AI Engineering | Organiser Light Mode Refinements & User Feedback Execution: 1. Strengthened edge definition with 1.5px solid #CBD5E1 borders on all inputs and clickable sport/module selection boxes. 2. Universalized Inter for body/inputs and Space Grotesk with high-contrast hierarchy (#0F172A headings vs #475569 subheadings). 3. Fixed cold-load dark blue screens by enforcing #F3F6FA light loading surfaces on OrganizerGuard, RouteSuspenseFallback, and portal-theme. 4. Enabled admin-customized platform logo / reverse logo resolution on organizer toolbars. 5. Overhauled Badminton Operator Controls with high-contrast buttons, removal of washed-out white text, and elimination of dark purple background gradients. 6. Resolved faded text colors across insights, sponsor tiers, and team budget metrics. | Resolved all 7 user-reported issues from live browser testing; verified builds and tests across auction-platform and scoring-app. |
| **2026-11-12** | Antigravity AI Engineering | Universal Organiser UX Polish: Enforced Inter body typography, Space Grotesk headings (-0.02em tracking), and tabular-nums figures. Unified natural elevation shadows and table dividers with soft yellow (#FEF9C3) active highlights. Purged hardcoded dark containers from modals (Add Team, Add Player, Sponsor Logos Editor, Tournament Creation Wizard). Bound loaders to neutral light shimmer and pinned CurrentTournamentContext sticky in sidebar navigation. | Standardized visual harmony and component ergonomics across all organiser modals, tables, dialogs, and navigation flows. |
| **2026-11-12** | Antigravity AI Engineering | Global Organiser Light Mode & UX Unification (`BIDWAR_GLOBAL_ORGANISER_LIGHT_MODE_BRIEF.md`). Migrated all organiser workspaces under AppLayout, SportsShell, and OrganizerPortal to `.bw-organizer-light` and `[data-surface="organizer"]`. Preserved all protected dark surfaces (marketing, OBS, LED displays, owner app, and live scoring pads). Upgraded accessible FieldTooltip and dynamic Radix portal resolution. | Converted entire internal organiser operations to enterprise light mode while maintaining full operational continuity and zero regressions on live scoring and broadcast. |
| **2026-11-12** | Antigravity AI Engineering | Initial creation and comprehensive repository-wide audit of BidWar Operation Manual. Documented Tournaments, Auctions, Cricket Scoring, Badminton Scoring, Owner App, Admin Platform, Registrations, Controls, and State Transitions. | Established permanent operational knowledge base and definition-of-done governance. |

---
*End of BidWar Operation Manual — Permanent Repository Documentation*
