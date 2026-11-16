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
6. **Root Document Surface Synchronization & Isolation:** `syncDocumentSurfaceTheme(location)` dynamically manages document-level classes and data attributes (`bw-organizer-light` and `data-surface="organizer"`). When navigating from an organizer workspace or auth page back to a public protected surface (such as the homepage `/`), the synchronization immediately strips organizer light classes from `<html>` and `<body>`, restoring the pristine dark theme tokens (`lovable-home`) without any text color distortion.
7. **Theme-Aware Boot Loader & Preboot Styling:** Cold loads on organizer and tournament routes (`/organizer*`, `/tournament/*`) render an instant `#F8FAFC` light canvas with the official dark-text primary BidWar logo and amber spinner, completely eliminating dark-blue screen flashes before hydration.

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
| Access Members Directory & Resolve Contacts | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Master / Super Admin) |
| Grant Tournament Licenses | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Transfer / Reassign Tournament Organiser | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Master / Super Admin) |
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
- `/organizer`: Organizer Authentication & Workspace Hub (when unauthenticated: centered 380px maximum bounded authentication card with 16px radius, visible 1px border `#E2E8F0`, subtle shadow, light neutral segmented control tabs, 44px inputs and gold action buttons, Google sign-in, eye password toggle, terms links, and mobile OTP verification; when authenticated: Organizer Dashboard with tournament cards, quick stats, creation CTA).
- `/organizer?tab=signup`: Organizer Account Registration Portal (exact same 380px bounded shell and geometry, Google sign-up with compact OTP notice, full name, email, and mobile OTP verification).
- `/organizer/profile`: Organizer profile, password change, WhatsApp consent settings.
- `/tournament/new`: Multi-step tournament creation wizard.
- `/tournament/:id`: Tournament Home / Module chooser.
- `/tournament/:id/auction-overview`: Auction Command Center (KPIS, readiness checklist, quick launch).
- `/tournament/:id/teams`: Team list, purse management, owner mobile numbers, access codes, logos.
- `/tournament/:id/categories`: Auction categories, price tiers, minimum bids, squad limits.
- `/tournament/:id/players`: High-density enterprise player roster workspace. Features scannable 10/11-column data table (`#`, `Photo` preview, `Player`, `Category`, `Payment` status badge when registration payment enabled, auction `Status`, `Base`, `Sold`, `Team`, `Actions` menu, dedicated `Expand` chevron toggle). Clickable row expansion into compact structured panel (`.ops-player-expand`): Registration Payment Review FIRST with UTR copy and receipt preview; Player Identity bar; 2-column Auction valuation and Player Specifications with formatted match availability dates and sanitized achievements; and Historical Auction Performance (`🏆 TOP 5 STAR` badge or clean `"No previous auction history"` fallback). In-page accessible Radix image preview modal (`ImagePreviewModal`) for player photos and payment screenshots with contain-fit, zoom toggle, and escape-key dismissal.
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
- `/tournament/:id/owner/:teamId`: Real-time owner bidding console with wake-lock and haptics. Includes Access Code verification gate with live animated line, tournament context display, and two-way back/change-team navigation.

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

### 4.7 Super Admin Platform (`artifacts/auction-platform` — `/admin` — **High-Contrast Executive Dark Mode**)
> **Theme Scope:** `.bw-admin-dark`, `[data-surface="admin"]`. Scoped with canonical `--admin-*` tokens (`#090D1A` canvas, `#111827` cards, `#161F33` elevated surfaces, `#1E293B` borders, `#F8FAFC` foreground, `#94A3B8` secondary text, `#EAB308` BidWar gold active accents). Completely isolated from Organizer Light Mode.
- `/admin/login`: Super admin authentication featuring a luxurious Champagne Gold & Pearl Ivory aesthetic matching the architectural visual reference. The 3D Neural Core features a sculpted warm pearl-beige metallic central sphere with soft ivory highlights, surface crater docking ports, and internal golden core luminescence. Floating network features porcelain pearl nodes, metallic champagne nodes, radiant amber-gold miniature suns with 4-point starburst flares, delicate warm golden-beige filaments, and a ground plane with concentric champagne ripples and realistic bronze-taupe shadow. Completely free of blue/cyan halos and dark navy coloring. Direct boot architecture: eagerly mounted directly on root router with synchronous preboot pearl styling to eliminate any intermediate blue console loader (`#090D1A`) or boot splash on cold boot or refresh. Zero mobile vertical scrolling: fully constrained to dynamic mobile viewport height (`100dvh` / `fixed inset-0` / `overflow-hidden` / `overscroll-none`) with body scroll locking and responsive core scaling (220px–250px on mobile viewports), ensuring that brand logo, 3D Neural Core, and "TAP CORE TO AUTHENTICATE" CTA or password prompt fit seamlessly on mobile screens without any overscroll or scrollbars. Includes compact primary logo, refined "TAP CORE TO AUTHENTICATE" CTA, single streamlined password input, 5-second inactivity auto-reset, and direct redirect to `/admin`.
- `/admin`: Platform Overview Dashboard (total tournaments, live auctions, platform revenue).
- `/admin/events-activities`: Live global event audit trail.
- `/admin/live`: Live operations command center (active auctions, displays, connected owners, emergency shutdown).
- `/admin/tournaments`: All tournaments list with independent dual-axis filtering (Tournament Status vs License Status with high-contrast active states), clear 'Live License' terminology, modern status dot indicators (eliminating heavy colored badge boxes), dedicated columns (Tournament Name, Sport, Tournament/Auction Code with 1-click copy, Organiser Contact, Created Date, Schedule, Tournament Status, License Status), a direct 'Grant License' action button with audit logging dialog for immediate live activation, and interactive "Transfer Organiser" controls (both an inline action button and a hover icon button in the Host column) opening the Transfer Organizer Modal to reassign ownership to any pre-created organiser account.
- `/admin/tournaments/:id`: Deep tournament inspection and audit logs. Includes an interactive "Transfer" pill in the header next to the current Host badge and a dedicated "Tournament Host & Organiser Assignment" card on the Overview tab displaying host status, account link, phone/email, and a 1-click "Transfer Organiser" action modal.
- `/admin/tournaments/:id/workbook`: Tournament Master Workbook (read/write data grid).
- `/admin/organisers`: Registered organizers list, verification status, contact details.
- `/admin/organisers/:id`: Organizer details, license grants, and owned tournaments table. Each owned tournament row features a direct "Transfer" action button to reassign tournament ownership to another registered organiser account.
- `/admin/members`: Super Admin Members Directory. 360-degree platform-wide human identity hub, multi-role filtering (Player, Team Owner, Organiser, Scorer, Multi-role), cross-tournament associated teams, sport profiles, inline missing mobile resolver, and deep-dive profile drawer.
- `/admin/members/:id`: Detailed member profile route.
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
- **Brand & Logo Surface Architecture (Light vs Dark Unification):** 
  - `PRIMARY_LOGO` (`main`): Wordmark with dark typography ("WAR" in dark slate/charcoal) and dark tagline. Mandatory for light background surfaces: Organizer Portal auth (`organizer-auth`), logged-in Organizer Header, Player Registration platform topbar (`RegistrationPlatformBar`), PDF reports, invoices, and certificates.
  - `REVERSE_LOGO` (`mainReverse`): Wordmark with white typography ("WAR" in pure white) and white tagline. Mandatory for dark background surfaces: Public landing header, dark footers, Super Admin login, Live Viewer screens, LED displays, and broadcast overlays.
  - `SYMBOL_LOGO` (`mini`): Square monogram / emblem for compact collapsed sidebars and small branding placements.
  - **Player Registration Platform Bar vs Tournament Card Independence:** The public player registration page (`/register/:code`) strictly decouples platform identity from tournament identity:
    1. *Top Sticky Platform Bar (`RegistrationPlatformBar`):* Dedicated full-width platform header showcasing the prominent BidWar primary wordmark logo, "Player Registration Portal" label, "Verified Tournament" security badge, and canonical link to `bidwar.in`.
    2. *Dedicated Tournament Card (`RegistrationPageHeader`):* Preserves 100% tournament organizer focus (tournament logo / initial avatar, sponsor logos, tournament name, subtitle, and auction schedule), completely removing the legacy merged BidWar badge box next to the tournament logo.
  - **Admin Branding Asset Manager (`/admin/settings/branding`):** Features contextual contrast preview containers (Primary Logo defaults to clean light surface; Reverse Logo defaults to dark surface) and an interactive 1-click preview contrast switcher (☀️ Light / 🌙 Dark / 🏁 Checkerboard) on all asset cards, eliminating dark-on-dark unreadable preview defects.

### 5.2 Auction Engine & Live Operator Console
- **Operator Lock Lease:** Single active operator enforcement. Heartbeat sent every 30 seconds. Automatic release after 180 seconds of inactivity. Emergency takeover capability for authorized organizers.
- **Intelligent Pre-Auction Launchpad (`isPreAuction`):** Before a tournament auction commences (`state.status !== "active" && !isPaused && !isCompleted`), the operator console shifts away from displaying confusing disabled in-game bidding controls (Sold, Unsold, Next Player, 0 bid) and instead prominently presents a dedicated Pre-Auction Launchpad in the center workspace:
  - *Pre-Flight Operational Vitals:* Real-time summary cards displaying registered teams and purse status, available player pool count, active draw mode (Random Draw, Sequential, or Manual Pick), and online team owner bidding status (Phones active vs Paddle mode).
  - *Proactive Readiness Diagnostic Gate:* Proactively validates readiness criteria (`validateAuctionReadiness`) including minimum teams, squad sizes, and bid rules. If issues exist, displays an alert with direct fix links (`Review checklist →`); when all checks pass, shows a green verified banner (`All pre-flight rules validated`).
  - *Grand Call-To-Action:* High-visibility `START LIVE AUCTION` emerald hero button (also operable via keyboard `Enter` key) that launches the live auction, synchronizes venue LED displays, enables team owner bidding pads, and unlocks the player nomination queue.
  - *Synchronized Toolbar Control:* Prominent `Start Live Auction` button in the top toolbar that mirrors session lifecycle startup without creating clutter or confusing operators.
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
- **Mobile-First PWA & Zero-Scroll Cockpit:** Accessible via phone browser without app store installation. Specifically engineered for mobile viewports (360×740 Samsung Galaxy S8+, 375×667 iPhone SE, 390×844 iPhone 14/15) with an integrated single-screen cockpit layout that completely eliminates vertical scrolling during live auction turns.
- **Compact Mobile Player HUD (`PlayerCard`):** Displays avatar thumbnail (14×16 rounded), serial number (`#serialNo`), player name, role pill, base price, and quick batting/bowling specs within an ultra-compact ~75px height envelope.
- **Player Dossier & History Side Drawer (`PlayerBioSideDrawer`):** Slide-over side panel animating in from the right edge upon tapping the player card or "Bio & Stats" button. Displays high-resolution player portrait, full demographic metadata (age, gender, city, jersey #), comprehensive batting/bowling specifications, achievements bio, and untruncated historical auction track record (`OwnerPlayerAuctionHistory`) with `🏆 TOP 5 STAR` badging.
- **3-Pillar Essential Budget Strip (`TeamPurseFooter`):** On mobile viewports (`tier === "mobile"`), consolidates the overcrowded 5-to-7 column layout into 3 high-impact, readable pillars:
  1. *Purse Left:* Spendable budget remaining (emerald-400 accent).
  2. *Max Bid Limit:* Calculated maximum allowable bid respecting squad reserve constraints (amber-400 accent).
  3. *Spent & Details:* Current expenditure with tap-to-expand trigger (`PurseBreakdownModal`) itemizing total purse capacity, active purse boosters, retained player spend, bought player spend, and minimum slot reserve funds.
- **Ergonomic Docked Bid Button (`BidButton`):** Pinned bottom action dock optimized to an ergonomic 80px–96px height (`h-20 sm:h-24`) with tactile scale-down transform (`active:scale-[0.98]`), vibrant team color glow, and safe-area inset protection to prevent accidental home-indicator swipe gestures on iOS.
- **Auto-Collapsing Side Popups & Drawers on Bidding Start:** Any open side drawers or modal overlays (`PlayerBioSideDrawer`, `PurseBreakdownModal`, or inline `TeamSquadSnapshot` rosters) automatically collapse without requiring manual user dismissal the moment bidding starts or advances (operator starts countdown timer, status transitions to active with a player on stage, a new bid is placed by any team, or when placing a bid). This ensures that team owners never have critical bid controls obscured or delayed by lingering inspection panels during fast 10–15s countdowns.
- **Header Navigation Polish & Team Name Auto-Flex (`LiveBidHeader`):** Slimmed top branding bar (`h-7 sm:h-8`), gave team name `flex-1 min-w-0` to eliminate truncated `"S.."` rendering on narrow 360px screens, and separated the "Leave" button with distinct red danger styling to avoid accidental auction room abandonment.
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
- **Unified Fan Page (`/tournament/:id/fan`):** Consolidated public spectator experience for BidWar tournaments. Dynamically adapts according to enabled modules: displays Auction directly when Auction-only, displays Cricket or Badminton scoring directly when Scoring-only, and displays adaptive segmented module navigation pills (`[⚡ Live Auction]` and `[🏏 Matches & Scoring]`) with real-time LIVE pulse beacons when Both modules are enabled. Synchronizes active tab state to URL query parameters (`?tab=auction` / `?tab=scoring`) with full browser Back/Forward navigation support. Includes official white-label tournament branding, venue metadata, Web Audio live sound toggle, and WhatsApp share modal.
  - *Auction Renderer (`AuctionFanRenderer`):* Integrates the production `LiveViewerPage` in embedded spectator mode. Features on-stage player presentation, career auction history, live leading bid, bid increments, team purses, sold/unsold outcome overlays, hammer timer, break countdown, live cheer reactions, heat meter, floating emojis, sponsor ticker, and real-time Auction SSE stream (`/api/tournaments/:id/auction/events`).
  - *Cricket Scoring Renderer (`CricketFanRenderer`):* Integrates production `ScoringPublicPage` in embedded spectator mode. Features ball-by-ball scoreboards, live match moments (OUT/SIX/FOUR/FREE HIT), match cards, tournament schedule, completed results, standings table, bracket tree, batting/bowling leaderboards, sponsor strips, stream embedding, and spectator cheer arena.
  - *Badminton Scoring Renderer (`BadmintonFanRenderer`):* Dedicated spectator Badminton scoring center. Features multi-court live tracking, category points tables (`MatchPointsSummary`), completed results with full game scorelines, tournament fixture schedules, and real-time SSE stream (`/api/tournaments/:id/badminton/stream`).
  - *Realtime Lifecycle & Stream Isolation:* Inactive module renderers are strictly unmounted upon tab switching, which invokes cleanup effects to close active EventSource connections and suspend background polling, guaranteeing zero duplicate connections or hidden network waterfalls.
  - *Graceful Unsupported Sport Fallback:* Renders an informative setup state for new or unconfigured sports without crashing the spectator shell.
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

### 5.9 Player Auction Performance History & Cross-Tournament Recognition
- **Cross-Tournament Historical SOLD Records:** Automatically aggregates past successful auction records for players across previous tournaments without manual data entry.
- **Strict Integrity Boundaries:**
  - Excludes the currently active tournament completely from historical results.
  - Excludes all UNSOLD records, available pool lots, and pre-auction retained players.
  - Displays a maximum of 3 tournament records, sorted strictly by final SOLD price descending (best auction performance first), NOT by latest tournament date.
  - If a player has only 1 or 2 qualifying SOLD records, displays only those records without dummy padding.
  - Bid counts and appearance frequency counts are strictly omitted to maintain a clean, compact financial performance focus.
- **Top 5 Special Recognition Badge (`🏆 TOP 5 STAR`):**
  - Calculated across all sold players in that particular historical tournament.
  - If the player's sold price ranked among the top 5 highest final sold prices in that tournament, a metallic gold/amber recognition badge is displayed: `🏆 TOP 5 STAR`.
  - Tied prices are handled consistently via standard competition ranking (`RANK() <= 5`): if multiple players tie at the fifth-highest price, all tied players are awarded the badge.
  - Top 5 status is never calculated from the player's personal history, nor does it factor in bid counts or number of tournament appearances.
- **Global Identity Deduplication & Linking:**
  - Resolved via canonical `global_players` (`globalPlayerId`) and verified 10-digit Indian mobile numbers.
  - Cross-linking by player name alone is strictly forbidden to prevent accidental identity collision between players with identical or similar names.
  - If duplicate entries exist within the same tournament (e.g. from legacy re-imports), deduplication retains strictly the highest sold price record.
  - Handled resiliently across deleted players, archived tournaments, auction resets, undos, and re-auction rounds.
- **Organizer Workspace Integration:**
  - **Player Detail Drawer (`PlayerDetailPanel`):** Displayed prominently alongside current tournament auction valuation when inspecting any player from the roster table.
  - **Add/Edit Player Modal (`PlayerForm`):** Dynamically surfaces historical performance as soon as a registered player is matched via global search or upon entering a 10-digit mobile number, informing organizers of player market value before setting base prices.
- **Live Auction Real-Time Integration Across Live Surfaces:**
  - **Smart Single-Event Consolidation (`isSameEvent`):** When a player's highest price and most recent price originate from the exact same previous tournament (`bestSoldRecord.tournamentId === lastSoldRecord.tournamentId` or single past league appearance), all live surfaces intelligently consolidate into a single cohesive presentation (`PAST HIGHEST & LAST AUCTION`) with the price stated once, buying team, tournament name, and Top 5 badge, completely eliminating confusing duplicate prices or redundant cards. When the player was sold in multiple different tournaments where the peak and recent sales differ, two distinct cards/lines are rendered.
  - **Owner Panel (`OwnerPlayerAuctionHistory.tsx` in `LiveBid.tsx`):** `PLAYER AUCTION HISTORY` card with smart unified card (`PAST HIGHEST & LAST AUCTION`) or distinct side-by-side cards (`PAST HIGHEST` and `LAST AUCTION PRICE`) with zero horizontal overflow and responsive vertical stacking on mobile (390×844).
  - **OBS V2 Broadcast Overlay (`Scenes.tsx` / `AuctionScene`):** Lower-third broadcast band rendering unobstructed player photo, single role label, and clean two-line historical area without encroaching upon camera safe zones.
  - **Live LED Stage Screen (`PlayerPortrait.tsx`):** Stadium-grade stat banner below player specs with clean `#serialNo` badge and high-contrast typography.
  - **Organiser Auction Operator Panel (`auction-operator.tsx`):** Compact two-line or consolidated one-line history beside base price on the active on-the-block player card with accessible hover tooltips.
  - **Live Viewer (`liveviewer.tsx`):** Secondary historical performance area below player specifications preserving prominence of current bid, timer, and leading team.
- **Shared Data Contract & Independent Metric Calculations:**
  - `bestSoldRecord`: Strictly the historically highest sold price record across previous tournaments.
  - `lastSoldRecord`: Chronologically most recent tournament sale across ALL previous tournaments (not derived from highest-price sorted arrays).
  - Client-side cached query via `usePlayerAuctionHistory` (`staleTime: 5min`, `gcTime: 15min`, `retry: 1`) ensures sub-5ms rendering on revisits with zero burden on live SSE feeds or bidding engine performance.
- **Tournament Feature Controls Hierarchy:**
  - Master toggle `liveAuctionHistory` (default: `true`, pre-enabled).
  - Granular surface sub-toggles: `ownerAppHistory` (`true`), `obsHistory` (`true`), `ledHistory` (`true`).
  - Hierarchy Rule: A live surface renders history if and only if both the Master toggle AND its specific surface toggle are active. If Master is OFF, all surfaces are disabled.
  - Accessible to Organizers under **Settings > Auction Rules > Live Auction Features** and Master Admins under Tournament Details.
- **Public & Live Authorization Boundaries:**
  - Live player auction history route `GET /tournaments/:tournamentId/players/:playerId/auction-history` serves public performance summary metrics to live team owners, OBS Studio instances, and LED screens without exposing private contact info (no phone numbers or email addresses).
  - Private mobile probe route `GET /tournaments/:tournamentId/player-auction-history` remains strictly guarded by `requireTournamentOrganizer`.

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

### Workflow 11: Admin Payment Verification & Direct Live License Activation
1. Master Admin navigates to `/admin/tournaments/:id` or opens the **Action Required** tab in the Super Admin Notification Center.
2. For tournaments on Free Trial, click **“Verify Payment & Upgrade License”** (or **“Verify Payment & Grant Live License”**).
3. The **Verify Payment & Grant Live License** dialog opens.
4. Enter payment parameters:
   - **Amount Received (₹):** Total verified payment amount (e.g. ₹12,000).
   - **Payment Mode:** `upi`, `bank_transfer`, `cash`, `waiver`, or `other`.
   - **Payment Ref / UTR / Order ID:** Mandatory for bank/UPI transfers. **Optional for Cash or Admin Waiver** (auto-assigns `"CASH"` or `"WAIVER"` if blank).
   - **Internal Notes:** Optional context (e.g. payer name, offline receipt note).
   - **Enable WhatsApp Messaging Service:** Check to include WhatsApp notifications; uncheck for discounted plans without WhatsApp.
   - **Administrative Reason:** Mandatory audit reason (minimum 10 characters, e.g. "Personal Auction verified cash receipt").
5. Click **“Verify & Grant Live License”**.
6. The system activates the live production license (`licenseStatus = 'active'`), auto-provisions or updates the `tournament_license_requests` record with full audit metadata (`verifiedBy`, `verifiedAt`, `paymentAmount`, `paymentMode`, `paymentRef`), marks pending license notifications as resolved, and clears any demo session data.

### Workflow 12: Admin Tournament Organiser Transfer & Account Reassignment
1. **Initiate Transfer:** Master / Super Admin can trigger organiser transfer from three administrative entry points:
   - On `/admin/tournaments`: Hover over any tournament row and click the **Transfer** icon in the Host column, or click the **Transfer** button in the Actions column.
   - On `/admin/tournaments/:id`: Click the **Transfer** pill in the top header next to the current Host badge, or click **Transfer Organiser** inside the **Tournament Host & Organiser Assignment** card on the Overview tab.
   - On `/admin/organisers/:id`: In the **Tournaments Owned by this Organiser** table, click the **Transfer** button on any tournament row.
2. **Review Current Assignment:** The `TransferOrganizerDialog` opens in high-contrast executive dark mode, displaying tournament name, sport, auction code, current linked organiser name, email, phone, and account status.
3. **Select Target Organiser:**
   - Filter pre-created organisers in real time via the search box (by name, email, phone, or company).
   - Click an organiser from the directory list. Each organiser option displays active tournament count, license status, and account limits.
   - Alternatively, choose **Unlink Organiser (Set to None)** if the tournament should be detached from any organiser account.
4. **Compare Capacity & Limits:** The dialog shows a side-by-side comparison card highlighting the transition from the current host to the target organiser, including a quota warning if the target organiser has reached their configured `maxTournaments` allocation.
5. **Configure Contact Synchronization:**
   - Toggle **Sync tournament contact details with target organiser** (default: `true`).
   - When enabled, the tournament's public host contact fields (`organizerName`, `organizerMobile`, `organizerEmail`) are automatically updated to match the target organiser's verified profile details.
   - When disabled, only the internal account link (`organizerId`) is reassigned, preserving custom host branding on public and player registration pages.
6. **Confirm Transfer:** Click **Confirm Transfer**.
7. **System Execution & Audit Logging:**
   - The backend validates caller admin authority and ensures the target organiser exists in `organizersTable`.
   - `tournamentsTable.organizerId` is updated atomically, immediately granting the new organiser management access in their Organiser Portal (`/organizer`).
   - If contact sync is selected, `organizerName`, `organizerMobile`, and `organizerEmail` in `tournamentsTable` are synchronized.
   - Any pending license requests in `tournamentLicenseRequestsTable` are automatically migrated to the new organiser (`organizerId` and `organizerMobile`).
   - An immutable audit trail entry is recorded (`tournament.organizer_transferred` or `tournament.organizer_unlinked`) with complete before/after snapshots.
   - A success toast is displayed and UI state across tables and cards refreshes instantaneously.

---

## Section 7 — Registration Guide, Form Fields & Validations

### 7.1 Registration Architecture
Public player registration runs through `/register/:code` (where `:code` is the tournament's 8-character `auctionCode`).
The registration journey includes:
1. **Platform Header Separation:** Sticky top bar (`RegistrationPlatformBar`) establishes BidWar's prominent platform presence (official primary logo, portal label, verified tournament badge, and platform link) decoupled from the tournament card (`RegistrationPageHeader`), ensuring the tournament name and logo are never merged with BidWar branding.
2. Mobile number entry with Indian 10-digit validation (`^[6-9]\d{9}$`).
3. **Cross-Tournament Smart Profile Autofill:** Returning players entering their 10-digit mobile number trigger automated cross-tournament identity retrieval from `global_players`. The lookup employs window-function fallbacks (`FIRST_VALUE`) across historical tournament registrations: if the most recent tournament omitted optional details (e.g. `age`, `city`, `gender`, `email`, `achievements`, `photoUrl`), the system seamlessly populates the most recent non-empty values from prior registrations.
4. Clean unselected initial form state: On initial page load or form reset, all fields start unselected/blank so players explicitly fill in all their details. Primary Sport Role, Batting Style, Bowling Style, and dynamic role specifications (such as Batting Hand) initialize with blank box triggers (`<SelectValue />`) without pre-filling text placeholders inside the box, eliminating user confusion. Kit sizing (jersey size, lower size) and gender initialize with clean unselected states without pre-selecting "Not specified", and match schedule availability chips start unselected.
5. Mandatory field indication: All mandatory / required fields display a prominent red star mark (`*`) directly adjacent to the field label in addition to the uppercase `Required` badge (`RegLabel`, `JerseySizeSelect`, `LowerSizeSelect`, `PlayerGenderSelect`, Rules Declaration, and WhatsApp consent).
6. Personal details, contact information, and photo capture: Mobile number triggers cross-tournament identity autofill, retrieving player details including previously registered email address.
7. **Sport-specific roles and technical specifications:** Dynamic role specifications (e.g. Batting Hand, Bowling Arm) synchronize with player technical profile and specifications payloads. Initial autofill population from `""` to the player's saved role preserves their handedness and style specifications; manual user changes to a different role explicitly reset technical specifications to prevent cross-role contamination.
8. **MANDATORY RULE — Zero Bid Value Autofill:** Bid value (`basePrice` / `selectedBidValue`) is strictly tournament-specific. Under NO circumstances is Bid Value ever prefilled or autofilled from past tournaments. In tournaments with `player` bid value mode, the selection box always remains unselected (`Choose your bid value`) requiring the registrant to explicitly select their category/valuation tier for this tournament.
9. Date availability matching tournament match schedule.
10. Organizer custom questions.
11. Payment gateway verification (UPI + UTR / Screenshot).
12. Legal terms declaration and WhatsApp opt-in.

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
| **“Start Live Auction” / [Enter]** | Operator Console Center Launchpad & Toolbar | Active Operator | Auction idle (`isPreAuction`), pre-flight checks ready | Starts the auction session, syncs LED displays, opens mobile bidding for team owners, and unlocks player nominations. | If readiness rules fail (e.g. squad sizes missing), immediately opens Readiness Dialog with direct "Fix →" links; keyboard Enter shortcut supported. |
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

### 8.2 Organizer Player Roster & Historical Performance Controls

| Control Label | Location | Eligible Roles | Prerequisites | Action & Effect | Confirmation / Error Behavior |
|:---|:---|:---|:---|:---|:---|
| **“Player Details Expand / Drawer” (Row Click / Chevron Toggle)** | `/tournament/:id/players` | Organizer, Admin | Player exists in roster | On desktop: expands an inline elevated enterprise card (`.ops-player-expand`) directly beneath the highlighted row with pure white background (`#FFFFFF`), BidWar gold anchor left border (`4px solid #EAB308`), compact structured sub-panels (`#F8FAFC`, slate-200 border) for Auction and Specifications, high-contrast typography (slate-900 values, slate-600 labels), Registration Payment Review FIRST with UTR copy and receipt preview, and Historical Auction Performance. On mobile: opens bottom slide-over Sheet. Dedicated chevron indicates expansion state. | Graceful fallback if no prior sold auction records exist. Nested actions (photo, actions menu, category select) isolate click events via `stopPropagation()`. Fully WCAG AA compliant. |
| **“Image Preview Modal” (Player Photo / Payment Receipt)** | `/tournament/:id/players` | Organizer, Admin | Image available | Opens in-page Radix dialog (`ImagePreviewModal`) displaying player portrait or payment receipt in contain-fit mode with backdrop blur, zoom toggle, and escape-key dismissal. | Replaces previous new-tab navigation; preserves operational context on the page. |
| **“Payment Verification Controls” (Approve / Reject / UTR Copy)** | `/tournament/:id/players` (Expanded Panel / Drawer) | Organizer, Admin | Registration payment enabled | Displays registration fee, payment status badge, UTR with 1-click clipboard copy button, clickable receipt preview thumbnail, and direct inline Approve and Reject action buttons. | Optimistic updates via React Query; validates payment status transitions immediately. |
| **“Historical Auction Performance”** | `/tournament/:id/players` (Detail Drawer & Add/Edit Form) | Organizer, Admin | Player selected / mobile number entered | Retrieves up to 3 highest sold historical auction records across previous tournaments with tournament name, prominent final sold price, buying team, and `🏆 TOP 5 STAR` badge. | Read-only; strictly excludes current tournament and unsold records; enforces organizer authorization. |
| **“🏆 TOP 5 STAR Badge”** | Historical Auction Record Cards | Organizer, Admin | Player ranked among top 5 sold prices in that historical tournament | Displays premium metallic badge recognizing elite auction performance in that historical competition. | Automatically handles fifth-place ties (`RANK() <= 5`). |
| **“Player Auction History (Master)”** | `/tournament/:id/settings` (Auction Rules > Live Auction Features) | Organizer, Admin | Auction module enabled | Enables or disables player auction history across all live surfaces (Owner App, OBS V2, LED Screen) tournament-wide. | Default: `true` (pre-enabled). When toggled OFF, suppresses history on all three live surfaces simultaneously. |
| **“Owner Panel Display Toggle”** | `/tournament/:id/settings` (Auction Rules > Live Auction Features) | Organizer, Admin | Master toggle ON | Controls whether Team Owner bidding panel displays the compact historical performance pill. | Default: `true`. Toggling OFF hides history from Owner App while leaving OBS and LED active. |
| **“OBS Broadcast Overlay Toggle”** | `/tournament/:id/settings` (Auction Rules > Live Auction Features) | Organizer, Admin | Master toggle ON | Controls whether OBS V2 broadcast overlay renders the floating gold history chip on the player avatar. | Default: `true`. Toggling OFF hides chip from OBS stream without affecting Owner App or LED screen. |
| **“Live LED Stage Screen Toggle”** | `/tournament/:id/settings` (Auction Rules > Live Auction Features) | Organizer, Admin | Master toggle ON | Controls whether the live LED stage display renders the high-contrast previous best / last sold stat banner. | Default: `true`. Toggling OFF hides banner from stage screen without affecting OBS or Owner App. |
| **“Owner App Player History Pill”** | Owner App `/live-bid` | Team Owner | Master + OwnerApp toggles ON, player has valid history | Renders compact pill inside PlayerCard below metadata pills (`🏆 TOP 5 STAR · Best: ₹XX · Last: ₹XX (Team)`). | Read-only; zero layout shift; never blocks or delays bid submission. Hides if no history exists. |
| **“OBS V2 History Chip”** | OBS V2 `/obs/v2` (AuctionScene) | Stream Viewers / OBS Operator | Master + OBS toggles ON, player has valid history | Renders floating gold broadcast chip (`🏆 TOP 5 · BEST ₹XX` or `PREV BEST: ₹XX`) anchored at top-left of player avatar. | Read-only; strictly contained within 880–1040px lower third band; zero intrusion into camera safe zone. |
| **“LED Screen History Banner”** | Live LED Display `/display` | Arena Audience / In-Person Bidders | Master + LED toggles ON, player has valid history | Displays high-contrast stadium banner across top of `PlayerPortrait` (`PREVIOUS BEST: ₹XX 🏆 TOP 5 STAR | LAST SOLD: ₹XX · TEAM`). | Legible from 15–30m in arena lighting; clean 300ms fade; `#serialNo` badge remains completely unobstructed. |
| **“Edit Player”** | `/tournament/:id/players` (Row / Drawer) | Organizer, Admin | Auction not completed | Opens player edit modal with auto-loaded historical auction record and valuation hints. | Updates player in tournament upon submission. |
| **“Add Player”** | `/tournament/:id/players` | Organizer, Admin | Player quota not exceeded | Opens add player modal; typing mobile number dynamically retrieves player profile and historical auction performance. | Blocks submission if mandatory fields missing. |

### 8.3 Cricket & Badminton Scorer Controls

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

### 8.4 Form Controls, Help Tooltips & Dynamic Portal Theme Resolution

| Control / Primitive | Implementation | Accessibility & Interaction Behaviors | Theming Behavior |
|:---|:---|:---|:---|
| **FieldTooltip** | `artifacts/auction-platform/src/components/ui/field-tooltip.tsx` | • **Keyboard Focusable:** `tabIndex={0}`, responds to `Enter` and `Space` to toggle.<br>• **Dismissible:** Pressing `Escape` closes the tooltip.<br>• **Collision-Aware:** Bounds to viewport with `collisionPadding={12}`, auto flip & shift.<br>• **Focus Ring:** Accessible `focus-visible:ring-2 focus-visible:ring-blue-600`. | Inherits surrounding theme; renders pure white tooltip card with fine border in light mode, high-contrast dark card in protected surfaces. |
| **Dynamic Portal Resolver** | `artifacts/auction-platform/src/lib/portal-theme.ts` (`getPortalThemeClass()`) | Portals mount to `document.body` outside the regular React tree. The dynamic resolver inspects current route pathname and active DOM surfaces to inject proper scoping class. | Injects `bw-organizer-light` inside organiser routes; injects `lovable-theme dark` on protected broadcast, display, and scoring pad routes. |
| **Modal Dialogs & Sheets** | Radix `Dialog`, `Sheet`, `AlertDialog` | Focus trap, keyboard navigation (`Escape`, `Tab`), backdrop blur. | Styled with `bg-card text-card-foreground border-border shadow-xl`. In organiser workspace, cards render in crisp `#FFFFFF` with neutral borders. |
| **Select & Dropdowns** | Radix `Select`, `DropdownMenu` | Arrow key navigation, auto-scroll to selected option, typeahead search. | Options highlight with subtle light-mode hover (`bg-accent text-accent-foreground`). |

### 8.5 Super Admin Licensing, Payment & Organiser Reassignment Controls

| Control Label | Location | Eligible Roles | Prerequisites | Action & Effect | Confirmation / Error Behavior |
|:---|:---|:---|:---|:---|:---|
| **“Grant License” (Direct Row Action)** | `/admin/tournaments` (List row) | Master Admin | Tournament on Trial | Opens Direct Grant Live License dialog with audit reason presets (Bank verified, Cash verified, Complimentary, Super admin approval). Grants full live license immediately (`licenseStatus = 'active'`) without navigating away from the tournaments list. | Rejects with 403 if caller is not Master Admin; rejects with 400 if audit reason < 10 characters. Displays instant toast feedback and reloads table. |
| **“Account Active” Switch & “Suspend / Activate Account” Buttons** | `/admin/organisers/:id` (Account Access Card) | Master Admin, Super Admin | Organiser account exists | Toggles organiser account access between Active and Suspended. Action is strictly intercepted by an executive dark modal (`Dialog`) enforcing a mandatory administrative audit reason (minimum 10 characters) and providing 1-click reason presets (Administrative review, Payment default, Terms violation, Re-verified, etc.). Updates backend `/auth/admin/organizers/:id` with `{ licenseStatus, reason }` and records immutable audit log snapshot. | Rejects with 400 if reason < 10 characters. Freezes organiser portal access and tournament management when suspended. Provides in-modal validation, live loading spinner, error banners, and non-blocking toast confirmation. |
| **“Verify Payment & Upgrade License” / “Verify Payment & Grant Live License”** | `/admin/tournaments/:id` & Notification Inbox | Master Admin | Tournament on trial or awaiting payment verification | Opens Payment Verification dialog to record amount, mode (UPI, Cash, Bank, Waiver), reference, notes, and audit reason. Grants full production license (`licenseStatus = 'active'`), lifting trial caps on players and squads. | Rejects with 403 if caller is not Master Admin; rejects with 400 if audit reason < 10 characters or if UPI/Bank payment is missing UTR reference. Auto-provisions license request row if no prior organizer request existed. |
| **“Transfer Organiser” (List Row, Header Pill & Overview Card)** | `/admin/tournaments`, `/admin/tournaments/:id`, `/admin/organisers/:id` | Master Admin, Super Admin | Tournament exists | Opens `TransferOrganizerDialog` in executive dark mode. Allows searching all pre-created organiser accounts, comparing tournament quotas, optionally synchronizing host contact details (`organizerName`, `organizerMobile`, `organizerEmail`), or unlinking. Migrates pending license requests to the new host and writes immutable audit log with before/after snapshots. | Rejects with 404 if tournament or target organiser is not found. Shows warning badge if target organiser has reached `maxTournaments`. Instant toast confirmation and table refresh upon success. |
| **“Switch to Trial License”** | `/admin/tournaments/:id` | Master Admin | Tournament currently active | Reverts tournament license status to `trial` with mandatory audit reason logging. | Requires audit reason. |
| **“Emergency Lock / Unlock”** ⚠️ | `/admin/tournaments/:id` | Master Admin | None | Freezes all live operations (bidding, messaging, scoring) immediately during disputes. | Requires audit reason; triggers critical audit alert. |
| **“Reconcile Identities”** | `/admin/members` (Directory Header) | Master Admin, Super Admin | None | Triggers transactional canonical identity reconciliation (`applyIdentityLinkingProposal`) across historical players, teams, organizers, and scorers into members without mutating legacy tables. | Disables button with loading spinner during run; delivers instant toast confirmation upon completion. |
| **“Quick-Add Mobile”** | `/admin/members` (List Table Row) | Master Admin, Super Admin | Member missing mobile | Inline 10-digit mobile number input and Save button directly in table row. Normalizes mobile, validates Indian format, updates `membersTable`, and cascades to linked `playersTable`, `teamsTable`, and `globalPlayersTable`. | Rejects invalid phone numbers with error toast; clears input and updates row state upon success. |
| **“View 360° Profile”** | `/admin/members` (List Table Row) | Master Admin, Super Admin | Member row exists | Slides open `AdminMemberDetailDrawer` (Sheet) displaying chronological team history, auction sold prices, sport specifications, communication delivery flags, and edit contact form. | Accessible slide-over overlay; preserves table filter and pagination state behind drawer. |

### 8.6 Team Owner App Access Gate & Navigation Controls

| Control Label | Location | Eligible Roles | Prerequisites | Action & Effect | Confirmation / Error Behavior |
|:---|:---|:---|:---|:---|:---|
| **“Change team” (Top Navigation Bar)** | Owner App Access Gate (`/tournament/:id/owner/:teamId`) | Team Owner | None | Navigates back from access gate to team picker (`/join/teams`) if multiple teams exist for the mobile number; if single team, returns to mobile entry (`/join`); otherwise browser history back or launcher (`/`). Preserves onboarding session entries. | Allows owner to immediately correct team selection if wrong team was tapped. Zero data loss. |
| **“Wrong team? Select another team” (Form Link)** | Owner App Access Gate (`/tournament/:id/owner/:teamId`) | Team Owner | None | Secondary contextual return action directly beneath the Enter button. Invokes same safe team reselection routing. | Ergonomic one-thumb tap on mobile viewports. |
| **“Live Auction Room Pulse & Animated Beam”** | Owner App Access Gate (`/tournament/:id/owner/:teamId`) | All Viewers | None | Renders full-width top viewport laser beam and badge-level glowing animated gradient line with emerald live pulse indicator, creating real-time broadcast atmosphere. | Pure visual/ambient indicator; zero performance overhead; GPU-accelerated Framer Motion keyframes. |

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
| **“No pending license request found for this tournament” when granting license** | Admin attempted to verify payment on a tournament where the organizer had not submitted a license request via the organizer portal first. | Resolved in system: Super Admin can directly verify payment and grant live licenses to any tournament. The system auto-provisions the license request record with payment audit trails. |
| **“Payment reference / UTR is required for verification” for cash payments** | Admin selected Cash payment mode without entering a bank transaction UTR. | Resolved in system: Payment reference is now strictly optional for Cash and Admin Waiver modes, automatically defaulting to `CASH` or `WAIVER`. |
| **“BidWar Platform — We encountered an issue loading this view” during navigation** | Stale dynamic import JS chunk hash after new deployment or brief network packet loss while navigating between code-split routes. | Resolved in system: `lazyWithRetry` automatically retries failed chunk imports twice; global `vite:preloadError` and unhandled rejection listeners seamlessly reload to fresh assets without displaying an error; self-healing `ErrorBoundary` auto-reloads and provides 1-click 'Reload Page' and 'Try Again' with automatic history reset (`resetKey={location}`). |

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
- **Player Auction Performance History Engine & UI:** `artifacts/api-server/src/lib/player-auction-history-service.ts`, `artifacts/auction-platform/src/components/player-auction-history.tsx`, `artifacts/api-server/src/__tests__/player-auction-history.test.ts`, `artifacts/auction-platform/src/components/__tests__/player-auction-history-ui.test.ts`
- **Tournament Organiser Transfer Engine & Modal:** `artifacts/api-server/src/routes/auth.ts`, `artifacts/auction-platform/src/components/admin/transfer-organizer-dialog.tsx`, `artifacts/api-server/src/__tests__/tournament-transfer-organizer.test.ts`

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
| **2026-11-16** | Antigravity AI Engineering | Smart Consolidation for Live Player Auction History (`OwnerPlayerAuctionHistory.tsx`, `Scenes.tsx`, `PlayerPortrait.tsx`, `auction-operator.tsx`, `liveviewer.tsx`): 1. Root Cause Resolution — Confusing Redundant Cards on Single-Tournament Peak: Identified that when a player had only one past tournament, or their most recent tournament was their career peak (`bestSoldRecord.tournamentId === lastSoldRecord.tournamentId`), all live surfaces rendered two separate, identical cards repeating the exact same price and tournament twice. This led viewers and franchise owners to assume the player had participated in two conflicting tournaments or suspect a duplicate data glitch. 2. Smart Single-Event Dynamic Consolidation (`isSameEvent`): Engineered dynamic layout detection across all 5 live surfaces. When `bestSoldRecord.tournamentId === lastSoldRecord.tournamentId`, the UI intelligently merges into a single cohesive card/block (`PAST HIGHEST & LAST AUCTION`) rendering the price once in bold font, attributing the buying franchise, mentioning the tournament name once, and rendering the `🏆 PAST TOURNAMENT TOP 5` badge. When the player has distinct historical milestones across different leagues (`best.tournamentId !== last.tournamentId`), the UI gracefully branches to two distinct comparative cards (`PAST HIGHEST` and `LAST AUCTION PRICE`). 3. Multi-Surface Synchronization: Applied identical consolidated logic across Team Owner Panel, OBS V2 broadcast lower-thirds, Live LED stadium screen, Organiser Console, and Live Viewer. 4. Automated Tests: Updated 15 Vitest component tests in `player-auction-history-ui.test.ts` verifying consolidation logic, clean builds, and manual compliance. | Completely eliminates viewer confusion and redundant duplicate cards during live bidding, delivering crystal-clear, intelligent historical player valuation across all broadcast, arena, owner, and operator surfaces. |
| **2026-11-16** | Antigravity AI Engineering | BidWar Unified Fan Page — Phase 3 Child Renderers Integration (`/tournament/:id/fan`, `liveviewer.tsx`, `scoring-public.tsx`, `auction-fan-renderer.tsx`, `cricket-fan-renderer.tsx`, `badminton-fan-renderer.tsx`, `unified-fan-page.tsx`): 1. Production Auction Live Viewer Extraction: Integrated `LiveViewerPage` into `AuctionFanRenderer` with `embedded: true` mode. Preserved on-stage player card, live bid amounts, team purse cards, career auction history, sold/unsold outcome overlays, hammer timer, break countdown, live sound engine, fan cheers, heat meter, sponsor ticker, and real-time SSE stream (`/auction/events`). Streamlined top header to prevent duplicate title and branding. 2. Production Cricket Scoring Integration: Integrated `ScoringPublicPage` into `CricketFanRenderer` with `embedded: true` mode. Preserved ball-by-ball scoreboards, live match moments (OUT/SIX/FOUR/FREE HIT), match cards, schedule, completed results, category standings, bracket progress, statistics leaderboards, sponsor strips, stream embedding, and cheer reactions. 3. Dedicated Badminton Scoring Center: Implemented `BadmintonFanRenderer` featuring multi-court live tracking, category points tables (`MatchPointsSummary`), completed match results with full game scorelines, fixture schedule, and active SSE stream (`/badminton/stream`). 4. Realtime Lifecycle & Stream Isolation: Enforced strict conditional unmounting between tabs; switching between Auction and Scoring cleanly tears down the inactive module's EventSource SSE connection and suspends polling timers, eliminating background waterfalls. 5. Graceful Fallback: Built `UnsupportedSportFallback` rendering an informative spectator card for new or unconfigured sports without crashing the shell. 6. Automated Testing: Added 11 Vitest tests in `unified-fan-page-phase3.test.ts` (27 total passing fan page tests), verified boundaries, and updated Operation Manual. | Delivers a complete, unified spectator experience hosting production Auction, Cricket, and Badminton scoring engines under a single responsive URL (`/tournament/:id/fan`) with strict stream lifecycle isolation. |
| **2026-11-16** | Antigravity AI Engineering | BidWar Unified Fan Page — Phase 2 Shell Implementation (`/tournament/:id/fan`, `unified-fan-page.tsx`, `unified-fan-page-shell.tsx`, `unified-module-nav.tsx`, `platform-app.tsx`): 1. Foundational Unified Fan Page Shell: Built consolidated public spectator surface adaptively rendering Auction, Cricket Scoring, or Badminton experiences based on enabled tournament modules and configured sport. 2. Adaptive Module Navigation (`UnifiedModuleNav`): Implemented segmented pill switcher with pulsing LIVE beacons (`[⚡ Live Auction]` and `[🏏 Matches & Scoring]`) for multi-module tournaments, with automatic tab suppression on single-module events to avoid visual clutter. 3. Real-Time URL Query State Synchronization: Bound active module tab to URL search parameters (`?tab=auction` / `?tab=scoring`) using `window.history.replaceState` without full-page reloads, with automatic browser Back/Forward navigation (`popstate`) and persistent `localStorage` preference memory. 4. Spectator Header & Modals: Integrated official white-label tournament branding, location metadata, Web Audio live sound effects toggle, and WhatsApp share modal. 5. Strict Domain Boundaries & Testing: Verified zero premature domain coupling with 16 automated Vitest tests, domain boundary checks, and Operation Manual governance. | Delivers a unified, responsive, high-contrast spectator portal for BidWar tournaments across desktop, tablet, and mobile devices while preserving independent domain boundaries. |
| **2026-11-16** | Antigravity AI Engineering | Platform Identity Reconciliation & Team Owners / Missing Mobile Engine Audit (`/admin/members`, `member-directory-service.ts`, `admin-members.ts`, `admin-members-list.tsx`): 1. Root Cause Resolution — Team Owners = 0: Identified that historical `classifier.ts` hardcoded team owners as `CATEGORY_B`, and `applyIdentityLinkingProposal` exclusively executed `CATEGORY_A` records (`candidates.filter(c => c.category === 'CATEGORY_A')`), completely ignoring all 37 team owner records and omitting `role: 'team_owner'` and `tournament_participations` insertions. 2. Root Cause Resolution — Missing Organizers: Unverified organizers or organizers authenticated via Google OAuth / Email whose mobile stored as `eml:<email>` were categorized as `CATEGORY_B` and discarded. Overhauled organizer reconciliation to normalize mobile/email, clean `eml:` prefixes, and link all organizers into canonical `members` with global `organizer` role. 3. Root Cause Resolution — Missing Mobile = 0 on Live Directory: Players without mobile numbers were previously categorized as `CATEGORY_C` and omitted from `members`, so `SELECT COUNT(*) WHERE primary_mobile IS NULL` returned 0 while 24+ players in live tournaments actually lacked phone numbers. Enhanced player reconciliation to create canonical `members` records for ALL players (with `primary_mobile = null`), enabling instant discovery and resolution in the directory. 4. High-Performance In-Memory Batch Reconciliation Engine (`reconcileAllPlatformMembers`): Replaced slow sequential row-by-row queries with in-memory map matching and 100-row chunked database batch inserts, executing full platform identity synchronization (300+ records) in ~2.4 seconds with zero timeouts. 5. Associated Teams & Tournaments Display Elevation: Replaced restrictive single-table query with a typed 3-way SQL UNION (participations + owner identity links + owner roles) correctly displaying owned teams with an explicit `Owner` badge, squad players with sold price and status, and contextual labels (`Tournament Organiser`, `Match Official / Scorer`) when no squad team is assigned. 6. Interactive KPI Strip: Turned directory KPI summary cards into 1-click active filters (Total Members, Active Players, Team Owners, Scorers, Missing Mobile). 7. Verified with automated tests, `pnpm run check:manual`, and clean client + SSR production builds. |
| **2026-11-16** | Antigravity AI Engineering | Team Owner App Mobile Responsiveness, Zero-Scroll Live Bidding Cockpit & Auto-Collapsing Drawers (`artifacts/owner-app`, `LiveBid.tsx`): 1. Root Cause Resolution — Severe Vertical Viewport Cannibalization: Identified that on standard mobile screens (360×740 Samsung Galaxy S8+, 375×667 iPhone SE), the double-decker header (~76px) and fixed bottom dock (~252px) consumed over 50% of the entire viewport, forcing 110px–170px of middle content below the fold. This caused owners to continually scroll between player identity and the live bid button under high-pressure 10–15s auction countdowns. 2. Compact Mobile Player HUD & Side Dossier Drawer: Engineered a mobile-first compact player HUD (~75px) displaying avatar thumbnail, serial number, player name, role pill, base price, and quick specifications. Built an interactive "Bio & Stats" trigger that slides in a dedicated right-side drawer (`PlayerBioSideDrawer`) with full-resolution photo, demographic details, full batting/bowling specifications, achievements bio, and complete historical auction track record (`OwnerPlayerAuctionHistory`) without horizontal truncation or layout shifts. 3. 3-Pillar Essential Budget Strip: Consolidated the overcrowded 5-to-7 column purse grid on mobile into 3 high-impact, readable pillars: Purse Left (emerald-400), Max Bid Limit (amber-400), and Spent • Details (white) with an interactive trigger opening an itemized Purse & Budget Breakdown modal (`PurseBreakdownModal`) covering total capacity, boosters, retained spend, bought spend, and minimum slot reserve funds. 4. Auto-Collapsing Popups & Drawers on Bidding Start: Implemented lifecycle signal hooks (`collapseSignal`, `biddingActive`) that automatically dismiss open side drawers (`PlayerBioSideDrawer`), purse breakdown sheets (`PurseBreakdownModal`), and squad category accordions (`TeamSquadSnapshot`) whenever bidding begins or advances (operator countdown timer starts, auction status becomes active, current bid changes, new lot arrives, or team bids), ensuring 100% zero-friction access to the bid button. 5. Header Bar Polish & "S.." Truncation Fix: Slimmed top branding bar (`h-7 sm:h-8`), assigned `flex-1 min-w-0` to team names so franchise names render fully without clipping to `"S.."`, and isolated the "Leave" action button with distinct red danger styling to eliminate accidental auction departures. 6. Ergonomic Pinned Bid Button: Optimized docked mobile button height to `h-20 sm:h-24` (80px–96px) with tactile `active:scale-[0.98]` tap feedback and safe-area inset protection. | Completely eliminates vertical scrolling on mobile devices, providing team owners with a high-impact, zero-scroll live bidding cockpit, instant situational awareness, an interactive side dossier for deep player analytics, and auto-collapsing panels when bidding starts. |
| **2026-11-16** | Antigravity AI Engineering | Super Admin Members Directory & Global Identity Hub (`/admin/members`, `admin-members-list.tsx`, `admin-members.ts`, `member-directory-service.ts`): 1. "Members Can Be Anyone" Foundational Identity Engine: Implemented global platform member identity management allowing any human (`mem_*`) to hold multiple roles simultaneously (Player in one tournament, Team Owner in another, Organiser, Scorer, Umpire) with unified cross-tournament team associations and auction records. 2. Super Admin Members Directory (`/admin/members`): Built enterprise dark-themed directory featuring KPI summary strip (Total Members, Active Players, Franchise Owners, Scorers/Officials, Missing Phone), real-time search across names, 10-digit mobiles, emails, and `mem_*` IDs, multi-role filter pills, sport filter, contact quality selector, and pagination. 3. 360-Degree Deep-Dive Drawer (`AdminMemberDetailDrawer`): Slide-over Radix Sheet providing detailed profile inspection across three tabs: (a) Teams & Roles (chronological tournament history, team names, auction sold prices, jersey numbers); (b) Sports Specs (cricket batting/bowling handedness, badminton primary roles); (c) Audit & Communication Delivery (verified flags, WhatsApp consent status, account status). 4. Inline Missing Mobile Resolver: Added high-visibility amber warning badges for players with missing phone numbers and built instant inline 10-digit mobile input with Save action, immediately updating `membersTable` and cascading to linked `playersTable`, `teamsTable`, and `globalPlayersTable`. 5. Backend Service & Routes: Created `member-directory-service.ts` and `admin-members.ts` with `GET /auth/admin/members`, `GET /auth/admin/members/:id`, `PATCH /auth/admin/members/:id`, `POST /auth/admin/members/sync`, and patched communication resolver endpoints. 6. Verified with unit tests and clean client + SSR Vite production builds. | Centralizes cross-platform human identity, eliminates player/member identification ambiguity, and provides instant resolution for missing contact numbers across all tournaments. |
| **2026-11-16** | Antigravity AI Engineering | Auction Operator Pre-Auction UI/UX Overhaul & Intelligent Launchpad (`/tournament/:id/auction`, `auction-operator.tsx`): 1. Root Cause Resolution — Operator Confusion with Tucked "Start Auction" Button: Identified that prior to starting an auction (`state.status !== "active"`), the operator console presented an in-game bidding cockpit with 15+ dead, disabled controls (Sold, Unsold, Next Player, 0 bid, 10s timer), while the only trigger to officially launch the tournament was tucked away as a tiny 28px green button in the top toolbar beside player counts and LED screen toggles. Because "Start Auction" is a one-time session lifecycle event, its peripheral placement created friction and confusion for organizers. 2. Center Stage Intelligent Pre-Auction Launchpad (`preAuctionLaunchpad`): Transformed the central workspace during pre-auction mode into a high-visibility, confidence-inspiring launch deck: (a) Header with pulsing beacon (`Pre-Auction Stage · Ready to Launch`) and tournament auction code; (b) Pre-flight operational vitals grid summarizing registered teams and purses, available player pool, draw mode (Random Draw / Sequential / Manual), and owner mobile bidding status (Online Active vs Paddle mode); (c) Proactive readiness diagnostic gate that evaluates `validateAuctionReadiness` in real-time, showing a green verified banner when ready or an amber warning banner with direct fix links if setup criteria are missing; (d) Grand Emerald Hero CTA: High-contrast `START LIVE AUCTION` button with luminous glow and keyboard `[Enter]` shortcut, synchronizing stage LED screens, owner mobile bidding pads, and the player nomination deck upon launch. 3. Coordinated Toolbar Action: Upgraded the top toolbar button to `Start Live Auction` with emerald ring styling during pre-auction, transforming cleanly to `Pause Auction` once live and `Resume Auction` when paused. 4. Positive Readiness Dialog Reassurance: Enhanced the readiness modal to display an affirmative "All Pre-Flight Checks Passed" confirmation card when zero issues are detected. 5. Automated Tests: Added 10 unit test cases in `auction-operator-pre-auction-launchpad.test.ts` verifying pre-auction state boundaries, launchpad composition, vitals rendering, and keyboard shortcuts. | Completely eliminates pre-auction operator confusion, transforming a field of dead, disabled buttons into an authoritative, intelligent command launchpad that gives organizers 100% confidence before going live. |
| **2026-11-16** | Antigravity AI Engineering | SPA Dynamic Chunk Loading Resilience, Global Vite Preload Recovery & Smart ErrorBoundary (`lazy-with-retry.ts`, `error-boundary.tsx`, `App.tsx`, `platform-app.tsx`, `scoring-app`): 1. Root Cause Resolution — Intermittent "BidWar Platform" Error Screen: Identified that during client-side SPA navigation between lazy routes (e.g. `/admin/settings/reports`, tournaments, organizers), Vite attempts to fetch individual split chunks. If a new deployment occurred while the browser tab was open or a transient network packet drop occurred, the stale chunk hash returned 404 or failed, causing React.lazy to reject and crashing the entire router into `<ErrorBoundary fallbackTitle="BidWar Platform">`. Refreshing the page fixed it because full reloads fetch the fresh `index.html` with current chunk hashes. 2. `lazyWithRetry` Utility: Wrapped all dynamic imports across `App.tsx`, `platform-app.tsx`, and `scoring-app/src/App.tsx` with automatic 2-attempt backoff retries and version mismatch detection (`isChunkLoadError`). If retries are exhausted and a chunk loading error is confirmed, automatically triggers throttled page reload (`reloadForFreshVersion`) without throwing to the error boundary. 3. Global `vite:preloadError` & Unhandled Rejection Listeners: In `main.tsx` (auction platform & scoring app), registered global listeners for Vite's `vite:preloadError` event and unhandled chunk rejections to transparently reload to the latest deployment before users encounter a broken UI. 4. Self-Healing `ErrorBoundary`: Enhanced `ErrorBoundary` to detect `isChunkLoadError`, auto-reload when throttled limits permit, provide "Update Available" messaging with 1-click 'Reload Page' and 'Try Again' recovery buttons, collapsible technical details toggle, and location-keyed auto-reset on browser back/forward history navigation (`resetKey={location}`). 5. Verified with 92 passing test suites (786 tests) and clean production Vite builds across all applications. | Eliminates intermittent broken page crashes during navigation after updates or network drops, seamlessly transitioning users to the latest deployed version without requiring manual troubleshooting. |
| **2026-11-16** | Antigravity AI Engineering | Organizer Portal Suspended / Locked State UX & Contrast Overhaul (`/organizer`, `organizer-portal.tsx`): 1. High-Contrast Light Alert Banner: Replaced translucent dark-mode pink banner (`bg-red-500/10 text-red-100/200` which had near-zero contrast on light backgrounds) with a crisp, authoritative `border-2 border-rose-300 bg-rose-50/95` card featuring deep rose text (`text-rose-950 font-bold`), clear explanation, and a direct 'Contact Support' button (`mailto:support@bidwar.in`). 2. Profile Status Synchronization (`OrganizerAvatarMenu`): Fixed contradictory indicator where locked accounts displayed a green active dot (`bg-emerald-400`); updated to a red pulsing indicator (`bg-rose-500`) with bold 'Account Locked' text and an in-menu warning notice. 3. Clean Neutral Disabled CTA Buttons (`TournamentModuleCta`): Eliminated muddy faded yellow and cyan buttons (`opacity: 0.5`) on locked accounts and purged dark-mode charcoal styling on inactive modules (`bg-slate-900/30 text-slate-300`); rendered uniform, high-contrast disabled buttons (`bg-slate-100 text-slate-500 border border-slate-200`) with a Lock icon. 4. Explicit Tournament Card Badging: Removed disruptive 60% card opacity that washed out tournament details; introduced a dedicated `[Lock] Account Locked` status badge (`bg-rose-50 text-rose-700 border border-rose-200`) on cards and updated '+ New Tournament' to a disabled button with '(Locked)' label. 5. Automated Tests: Added 8 unit tests in `organizer-portal-locked-ux.test.ts` verifying banner contrast, menu indicators, neutral CTA styling, and card badging. | Eliminates washed-out and confusing color collisions, providing clear, high-contrast visual indicators across the Organizer Hub when an account is administratively locked. |
| **2026-11-16** | Antigravity AI Engineering | Organiser Account Access Governance & Audit Reason Dialog (`/admin/organisers/:id`): 1. Root Cause Resolution — Unprompted 400 Error: Identified that flipping the 'Account Active' toggle switch on `/admin/organisers/:id` immediately invoked `updateAdminOrganizer` without collecting an administrative reason. Because backend `PATCH /auth/admin/organizers/:id` strictly enforces `parseAuditReason(req.body, true)` when `licenseStatus` changes, the server rejected the mutation with 400 `Reason is required (minimum 10 characters)`, displaying an unhandled red error message and preventing the switch from disabling the account. 2. Account Access Governance Modal (`Dialog`): Replaced blind toggle firing with an executive dark confirmation dialog requiring a valid audit reason (min 10 characters). Provided 1-click audit reason presets for both suspension ('Administrative review of organiser operations', 'Payment default or overdue platform charges', 'Terms of service violation under investigation', 'Organiser requested temporary account freeze', 'Duplicate or unverified organiser profile') and reactivation ('Administrative verification completed and approved', 'Account reactivated following compliance clearance', 'Payment received and account balance settled', 'Reactivated upon verified organiser request'). 3. Dual Control Triggers: Embedded both the `Switch` toggle and explicit action buttons ('Suspend Account' / 'Activate Account') inside the Account Access card, both safely routing through `handleOpenAccessDialog`. 4. Client API Types Updated: Added `reason?: string` to `updateAdminOrganizer` in `artifacts/auction-platform/src/lib/auth.ts`. 5. Verification & Tests: Added 9 automated unit tests in `admin-organiser-detail.test.ts` verifying dialog interception, preset availability, min-10-char validation, and API payload conformity. | Eliminates the unhandled 400 'Reason is required' error, ensuring admins can seamlessly suspend or reactivate organiser accounts with 1-click presets and compliant audit logs. |
| **2026-11-16** | Antigravity AI Engineering | Team Owner App Access Gate Polish — Duplicate Branding Elimination, Back Navigation & Live Animated Line: 1. Duplicate Branding Elimination: Removed hardcoded top BidWar branding header (`logos.mini` + `{brandName}` wordmark) from the Access Code gate (`AccessCode.tsx`), which previously rendered duplicate "bid WAR BidWar" and conflicted with footer branding. Footer now cleanly respects white-label `showPoweredBy`. Also refined `TeamPicker.tsx`, `Warmup.tsx`, and `Completed.tsx` so `{brandName}` is not rendered redundantly when image logo already contains the wordmark. 2. Two-Way Back / Change Team Navigation: Added prominent top-left "Change team" button and contextual "Wrong team? Select another team" link on `AccessCode.tsx`. Updated `TeamPicker.tsx` to retain onboarding session entries until verification, enabling instant return to `/join/teams` without re-entering mobile number. Added fallback to `/join`, `window.history.back()`, or launcher. 3. Live Animated Line & Room Indicator: Added GPU-accelerated full-width top edge live animated beam and card-level glowing gradient line with pulsing emerald "LIVE AUCTION ROOM" badge, transforming the static screen into an energetic, broadcast-grade live console. | Resolves duplicate branding, eliminates trap state when selecting wrong team, and delivers vibrant live room aesthetics on owner app access gate. |
| **2026-11-16** | Antigravity AI Engineering | Tournament Organiser Transfer & Account Reassignment Restoration (Professional Feature Audit): 1. Root Cause Resolution: Identified that during the modularization of `/admin` into independent pages (`82b966b9`), the tournament organiser transfer/reassignment UI was omitted from `admin-tournament-detail.tsx` and tournament listings, leaving backend `/link-organizer` disconnected. Additionally, the backend route lacked target organiser existence validation, contact synchronization, and pending license request re-assignment. 2. Enterprise Dark Modal (`TransferOrganizerDialog`): Implemented a dedicated high-contrast executive dark dialog with live search filtering of pre-created organisers, active tournament quota check, side-by-side host comparison card, optional contact detail sync toggle (`organizerName`, `organizerMobile`, `organizerEmail`), and 1-click unlink capability. 3. Multi-Surface Integration: Embedded Transfer action into `/admin/tournaments` (table row action and Host column hover trigger), `/admin/tournaments/:id` (header Host pill and dedicated Overview Host Assignment card), and `/admin/organisers/:id` (owned tournaments table). 4. Robust Backend Route Architecture (`auth.ts`): Overhauled `/auth/admin/tournaments/:tournamentId/link-organizer` and added `/transfer-organizer` route alias. Added target organiser existence verification (404), automatic contact sync when requested, automatic migration of pending license requests, before/after audit logging (`tournament.organizer_transferred` / `tournament.organizer_unlinked`), and safe Google-placeholder mobile normalization during tournament creation. 5. Verified with 8 automated unit & integration test cases (`tournament-transfer-organizer.test.ts`) and verified full production builds across both `@workspace/api-server` and `@workspace/auction-platform`. | Fully restores and professionally elevates the tournament organiser transfer capability, allowing platform administrators to seamlessly reassign any tournament to another pre-created organiser with full auditability, contact syncing, and zero regressions. |
| **2026-11-15** | Antigravity AI Engineering | Player Registration Cross-Tournament Profile Fallback, Dynamic Role Specifications & Strict Zero Bid Value Autofill Governance (`/register/:code`, `global-players.ts`, `player-specifications.ts`, `player-register.tsx`): 1. Cross-Tournament Historical Profile Aggregation: Updated `/api/global-players/search` SQL queries with `FIRST_VALUE(...)` window functions across a returning player's historical registrations (`PARTITION BY COALESCE(mobile_number, id)`). If the most recent tournament omitted optional details (e.g. `age`, `city`, `gender`, `email`, `achievements`, `photoUrl`), the lookup automatically falls back to the most recent non-empty values from earlier tournaments, resolving missing age and profile data for returning players. 2. Dynamic Role Specifications & Batting Hand Auto-Selection: In `player-specifications.ts`, enhanced `applySpecificationsToSelections` to match groups by `groupName` as well as `specGroupId`, and to populate `extraSelections` for all matched groups so dynamic spec triggers immediately bind their value. In `player-register.tsx`, tracked `prevRoleRef` so initial autofill population (transitioning from empty role `""` to player's saved role) never wipes handedness, bowling style, or technical specs; explicit role changes by the user continue to safely reset technical specifications. 3. Strict Mandatory Rule — Zero Bid Value Autofill: Reaffirmed and strictly enforced that Bid Value (`basePrice` / `selectedBidValue`) is 100% tournament-specific and is NEVER autofilled or pre-populated from past tournaments under any circumstances. In `player` bid value mode, the selection box remains unselected (`Choose your bid value`) requiring the registrant to explicitly select their category/valuation tier for each specific tournament. 4. Test Suite Coverage: Added test cases in `player-specifications.test.ts` and `registration-autofill.test.ts` verifying specification group name matching, dynamic extraSelections prefill, and strict exclusion of bid values from autofill payloads. | Delivers seamless, smart cross-tournament profile autofill (including Batting Hand and age recovery) while strictly enforcing tournament-level autonomy for player bid value selection. |
| **2026-11-15** | Antigravity AI Engineering | Organizer Players Page Professional UX/UI Audit & Restructuring (`/tournament/:id/players`): 1. Information Architecture & Density Overhaul: Restructured the main player table to 10/11 columns (`#`, `Photo` preview thumbnail, `Player`, `Category`, `Payment` badge when payment verification is enabled, `Status`, `Base`, `Sold`, `Team`, `Actions` menu, dedicated `Expand` chevron toggle). Decreased table row height from 54px to 42px via high-density padding (`0.45rem 0.65rem`), optimizing scanning for large rosters. 2. Root Cause Resolution — Broken Dates & 'None' Rendering: Discovered that `PlayerDetailPanel` appended an unlabelled orphan `<p>` below `PlayerAuctionHistorySection` rendering raw comma-separated dates (`player.availabilityDates`) and raw string `"None"` (`player.achievements`). Removed the orphan paragraph, formatted availability into readable dates (`formatMatchAvailability`, e.g. "30 May 2026, 31 May 2026, 1 Jun 2026") under Player Specifications, and sanitized `player.achievements` with regex to discard `"None"`, `"null"`, `"n/a"`, and dash values. 3. Payment Verification UX Elevation: Reordered expanded section to display Registration Payment Review FIRST when `enableRegistrationPayment` is enabled, featuring UTR number with 1-click clipboard copy, semantic status containers (pending amber, approved emerald, rejected rose), receipt preview thumbnail, and direct inline Approve/Reject action buttons. Added Payment column to desktop table with sorting support. 4. In-Page Image Preview Modal (`ImagePreviewModal`): Replaced previous disruptive `target="_blank"` new-tab navigation for payment screenshots and added click-to-preview for player photos. Built accessible Radix dialog with contain-fit preservation, backdrop blur, zoom toggle, and escape-key dismissal. 5. Coherent Interaction Model: Established clean interaction contract where clicking the table row or dedicated chevron toggles expansion, while nested actions (photo preview, category select dropdown, 3-dots actions menu) isolate click events via `stopPropagation()`. 6. Preserved 100% of underlying API contracts, export to Excel/CSV/Google Sheets, bulk upload, and status transition workflows. | Delivers a high-density, scannable, professional enterprise player management workspace with immediate payment verification affordances, in-page asset previews, clean historical auction performance, and coherent interaction mechanics. |
| **2026-11-15** | Antigravity AI Engineering | Organizer Sidebar Header Logo & Expand/Collapse Rail Alignment Fix (`layout.tsx`, `organizer-app-chrome.tsx`): 1. Root Cause Resolution — Collapsed Overflow: Identified that when the desktop sidebar collapsed to 56px (`w-14`), `BidwarOrganizerBrandMark` was invoked with `surface="organizer-main-toolbar" iconOnly`. The component ignored `iconOnly` for preset resolution and rendered the wide horizontal wordmark (`h-7 max-w-[8.5rem]`, measured ~87px wide), causing the logo to overflow into negative coordinates (`x = -15.8px`), chopping off "Bi" on the left and "r" on the right ("id WA"). Furthermore, `flex-col` stacked the expand button underneath the overflowing logo, breaking the 56px header bounds. 2. Clean Centered Collapsed Rail: In `layout.tsx`, updated the collapsed header to a dedicated centered flex container rendering a clean, centered `w-9 h-9` expand toggle button (`<ChevronRight className="w-4 h-4" />`), matching `sports-shell.tsx` ergonomics. 3. Desktop Duplicate Logo Elimination: Resolved redundant side-by-side BidWar logos where both the sidebar header and the top bar (`OrganizerDesktopBrandBar`) simultaneously rendered the BidWar logo. Updated `OrganizerDesktopBrandBar` to accept `sidebarCollapsed` prop, displaying the BidWar platform logo in the top bar only when the sidebar is collapsed (or on compact views) and displaying clean contextual tournament breadcrumbs when the sidebar is expanded. 4. Resilient `iconOnly` Brand Mark Safeguards: Updated `BidwarOrganizerBrandMark` in `organizer-app-chrome.tsx` to route `iconOnly` strictly through `"sidebar-compact"` preset (`SYMBOL_LOGO`), prioritizing square symbol assets (`mini` / `appIcon`) and falling back to `miniBrandText` ("BW") box rather than wide horizontal wordmarks. | Eliminates the clipped "id WA" logo defect in collapsed sidebars, eliminates duplicate desktop logos, and ensures seamless, professional sidebar expand/collapse transitions. |
| **2026-11-15** | Antigravity AI Engineering | Player Details Expanded Background & High-Contrast Visual Overhaul (`/tournament/:id/players`): 1. Root Cause Resolution: Identified that `.ops-player-expand` inherited `background: var(--ops-input)` from `index.css`, where `--ops-input: color-mix(in oklab, var(--stage) 78%, black)`. In the organizer light theme (`--stage: #F1F5F9`), this formula produced a dark, muddy, dreary concrete-gray background (`#94A3B8` / `#9ca3af`), resulting in severe contrast collapse against dark text, yellow base price values (`#EAB308`), and clashing against the inner white `PlayerAuctionHistorySection` card. 2. Light Enterprise Expanded Surface (`organizer-light-theme.css`): Upgraded `.ops-player-expand` under `:is(.bw-organizer-light, [data-surface="organizer"])` to a pure white elevated surface (`background: #FFFFFF !important`, `border: 1px solid #CBD5E1 !important`, `box-shadow: 0 4px 6px -1px rgb(15 23 42 / 0.05)`), featuring a distinctive 4px BidWar gold anchor border on the left (`border-left: 4px solid #EAB308 !important`) that visually connects the expanded details card to the soft gold highlighted row (`#FEF9C3`) above. 3. Structured Sub-Panels & High-Contrast Typography: Styled `ops-detail__sections` sub-panels (Auction and Specifications) as crisp subtle cards (`background: #F8FAFC`, `border: 1px solid #E2E8F0`, `border-radius: 0.5rem`, `padding: 0.75rem 0.875rem`). Remapped labels (`.ops-detail__label`) to high-contrast slate-600 (`#475569`, 11px uppercase bold), `dt` to slate-500 (`#64748B`), and `dd` values to slate-900 (`#0F172A`). 4. Legibility Fixes for Values & Buttons: Replaced low-contrast yellow Base Price (`text-primary`) in `PlayerDetailPanel` with crisp `font-mono font-semibold tabular-nums text-foreground` (`#0F172A`). Enhanced Crichero and availability dates to accessible `text-blue-600 dark:text-blue-300` and `text-blue-600 hover:text-blue-700 dark:text-blue-400`. Enhanced Registration Payment review Approve/Reject action buttons to `text-emerald-700` and `text-rose-700` with light hover states. 5. Scoped Light Token Unification: Bound `--ops-input: #FFFFFF`, `--ops-surface: #FFFFFF`, `--ops-border: #CBD5E1`, and accessible semantic status tokens (`--ops-available: #2563EB`, `--ops-sold: #059669`, `--ops-unsold: #E11D48`, `--ops-retained: #7C3AED`, `--ops-withdrawn: #D97706`, `--ops-approved: #059669`, `--ops-pending: #D97706`, `--ops-rejected: #DC2626`) directly within `.bw-organizer-light`, and fixed base `--ops-input` fallback in `index.css`. | Completely eliminates the dreary dark gray player details background, delivering a clean, elevated enterprise card with high-contrast typography, structured information hierarchy, and seamless aesthetic harmony with the BidWar organizer portal. |
| **2026-11-15** | Antigravity AI Engineering | Live Player Auction History Across Owner Panel, OBS V2 & Live LED Screen (P0/P1 Special Feature): 1. Master Feature Hierarchy & Tournament Controls (`tournament-features.ts` & `tournament-settings.tsx`): Added `liveAuctionHistory` (master toggle, default true), `ownerAppHistory` (default true), `obsHistory` (default true), and `ledHistory` (default true) to `TournamentFeatures` with safe fallback helpers (`isLiveAuctionHistoryEnabled`, `isOwnerAppHistoryEnabled`, `isObsHistoryEnabled`, `isLedHistoryEnabled`). Added 'Live Auction Features' Card under Settings > Auction Rules with master switch and granular surface sub-toggles. 2. Shared History Summary Contract (`player-auction-history-service.ts`): Implemented `PlayerAuctionHistorySummary` and `processHistoricalAuctionSummary` independently computing `bestSoldRecord` (highest historical sold price across past tournaments) and `lastSoldRecord` (chronologically most recent tournament sale from all tournaments, not derived from top 3). Excluded current tournament, unsold, released, and non-sold records. Calculated tournament-scoped `🏆 TOP 5 STAR` badge via SQL `RANK() <= 5`. 3. Owner Panel Live Integration (`OwnerPlayerAuctionHistory.tsx` in `LiveBid.tsx`): Mounted zero-layout-shift dark-gold pill inside `PlayerCard` displaying `🏆 TOP 5 STAR`, `PREV BEST: ₹XX`, `LAST: ₹XX (Team)` with zero interference with bid buttons or timers. 4. OBS V2 Broadcast Overlay Integration (`ObsPlayerHistoryChip` in `Scenes.tsx`): Added floating gold broadcast badge (`🏆 TOP 5 · BEST ₹XX` / `PREV BEST: ₹XX`) anchored at top-left of player avatar, strictly within 880–1040px lower-third and outside the 96–880px camera safe area. 5. Live LED Stage Screen Integration (`LedPlayerHistoryBanner` in `PlayerPortrait.tsx`): Added stadium-grade high-contrast banner (`PREVIOUS BEST: ₹XX 🏆 TOP 5 STAR | LAST SOLD: ₹XX · TEAM`) with 300ms fade transition and non-obstructive placement preserving the `#serialNo` badge. 6. Public Live Read Authorization: Allowed live bidders and broadcast displays tournament-scoped read access to public historical performance via `GET /tournaments/:tournamentId/players/:playerId/auction-history` without exposing private contact info. 7. Test Suites: Added 24 backend test cases (`player-auction-history.test.ts`) and 12 frontend component test cases (`player-auction-history-ui.test.ts`). | Empowers team owners, stream viewers, and in-person arena audiences with real-time player auction track record and elite Top 5 recognition during live bidding with zero impact on bidding engine latency. |
| **2026-11-15** | Antigravity AI Engineering | Player Auction Performance History & TOP 5 STAR Recognition: 1. Core Service Engine (`player-auction-history-service.ts`): Implemented cross-tournament historical auction aggregation retrieving up to 3 best SOLD auction records sorted strictly by final sold price descending (`ORDER BY sold_price DESC`). Excluded the currently active tournament, all UNSOLD records, and non-sold statuses. Excluded bid count and appearances from display. 2. TOP 5 Special Recognition: Implemented standard competition ranking (`computeTournamentSoldRanks` / SQL `RANK() <= 5`) calculating Top 5 highest sold prices across all sold players in each historical tournament. Awarded `🏆 TOP 5 STAR` badge to qualifying players, handling fifth-place ties consistently by including all tied players. 3. Identity Integrity & Cross-Linking Protection: Enforced identity resolution strictly through canonical `global_players` (`globalPlayerId`) and verified 10-digit Indian mobile numbers; prohibited cross-linking by player name alone to prevent collision between players with identical names. Handled archived tournaments, deleted players, auction resets, and re-auction rounds. 4. API Endpoints: Exposed authenticated organizer routes `/tournaments/:tournamentId/players/:playerId/auction-history` and `/tournaments/:tournamentId/player-auction-history` guarded by `requireTournamentOrganizer`. 5. Responsive UI Components: Created `player-auction-history.tsx` and integrated `PlayerAuctionHistorySection` into the Organizer Player Detail drawer (`PlayerDetailPanel`) and Add/Edit Player modal (`PlayerForm`), with prominent sold price display, buying team attribution, `🏆 TOP 5 STAR` badge, and neutral empty states. 6. Test Suite: Added 16 backend test cases (`player-auction-history.test.ts`) and 7 frontend component test cases (`player-auction-history-ui.test.ts`). | Empowers tournament organizers with immediate, reliable, and premium visibility into a player's true market value and elite auction track record without manual research or identity collisions. |
| **2026-11-15** | Antigravity AI Engineering | Player Registration UI & Data Flow Fixes (Role Specs, Batting Hand, Email Autofill): 1. Clean Blank Select Triggers: Removed placeholder text from select triggers across Role, Batting style, Bowling style, and dynamic role specifications (`SelectValue` with no placeholder) on public registration (`/register/:code`) and organizer player modals (`players.tsx`), rendering boxes cleanly blank until an option is selected and resolving user confusion. 2. Role Change Reset: Added automatic reset of `battingStyle`, `bowlingStyle`, `specialization`, and `specSelections` when `form.role` changes, preventing previous role choices from contaminating newly selected roles. 3. Batting Hand & Specification Submission Fix: Fixed `buildSpecificationsPayload` in `player-specifications.ts` to prioritize `extraSelections` (the user's chosen option from the dynamic spec dropdown) over `legacyForm`. Ensured dynamic spec change handlers in `player-register.tsx` synchronize both `specSelections` and `form` legacy fields, resolving the issue where selected Batting Hand was dropped and rejected by the server. 4. Specification Validation Dual-Fallback: Updated `validateRequiredRoleSpecifications` in `player-specification-service.ts` to merge input specifications with legacy specification fields, ensuring valid selections for required groups (like Batting Hand) are never falsely rejected. 5. Cross-Tournament Email Autofill: Added `p.email` to both CTE and outer SELECT in `/api/global-players/search`, updated private and mobile-lookup serializers to include `email`, and updated `tournamentMatch`, `fillFromProfile` (`players.tsx`), `handleRegisterLookup`, and `registration-autofill.ts` (`mergeTournamentProfile`, `mergeGlobalProfile`) to fully retrieve and prefill player email addresses upon entering a 10-digit mobile number. | Eliminates user confusion on blank form inputs, fixes Batting Hand submission and validation failures, and ensures email addresses are reliably retrieved and autofilled across tournament registrations. |
| **2026-11-14** | Antigravity AI Engineering | Organizer Authentication UI — Visual Refinement (P1): 1. Bounded Authentication Shell: Introduced a clearly defined centered authentication shell constrained strictly to 380px maximum desktop width (`max-w-[380px] w-full mx-auto`) with visible 1px border (`border-slate-200/90`), subtle natural elevation (`shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08)]`), 16px radius (`rounded-2xl`), and consistent 22-24px internal padding (`p-5 sm:p-6`), completely eliminating previous floating/unbounded appearance. 2. Background & Tonal Separation: Maintained light grey-blue background canvas (`bg-[#F4F6F9]`) with clean subtle tonal separation against pure white authentication card (`#FFFFFF`), removing excessive decorative blur glows. 3. Brand Header Whitespace Reduction: Compacted vertical spacing between Back to Home link, BidWar logo (`h-10 sm:h-11`), Organizer Portal subtitle, and authentication card. 4. Integrated Segmented Control Tabs: Consolidated Sign In and Create Account tabs inside the top of the card as a bounded segmented control (`bg-slate-100 p-1 border border-slate-200/80 rounded-xl`) with active amber-gold gradient (`bg-gradient-to-r from-amber-400 to-amber-500 font-bold text-slate-950`) and dark readable inactive text (`text-slate-600 font-semibold`). 5. Form & Button Geometry Standardization: Standardized all form inputs and primary action buttons to 44px height (`h-11`), high-contrast dark charcoal labels (`text-xs font-semibold text-slate-800`), compact informational notices, and subtle dividers across both Sign In and Create Account screens. 6. Preserved 100% of underlying authentication logic, OAuth, OTP verification, and routing without regression. | Delivers a clean, compact, professional, visually bounded authentication experience for organizers across desktop and mobile screens while strictly preserving all authentication behaviors. |
| **2026-11-14** | Antigravity AI Engineering | P0 Theme Regression Fix & Cross-Surface Isolation (`/organizer`, `/`, `/tournament/*`): 1. Root Cause Resolution — Auth Card Dark Navy Background: Identified that `OrganizerPortal` (`organizer-portal.tsx`) was wrapped in `<FullscreenLayout>`, which forcefully injected `className="lovable-theme ... dark"` and a dark blue radial gradient backdrop; additionally, `lovable-homepage.css` applied `:is(.lovable-home, .lovable-theme) .panel { background: linear-gradient(...) !important }`. Removed `<FullscreenLayout>` wrapper from `OrganizerPortal`, replaced with clean light container (`data-surface="organizer" className="bw-organizer-light min-h-screen bg-background text-foreground"`), and added `background-image: none !important;` for `.panel` and `[data-slot="card"]` under organizer light scopes. 2. Root Cause Resolution — Homepage Color Distortion: Discovered that `PlatformRouter` in `platform-app.tsx` mounted `bw-organizer-light` and `data-surface="organizer"` onto `<html>` and `<body>`. Navigating back to `/` unmounted `PlatformApp` without cleanup, leaving `bw-organizer-light` active on `<html>` and `<body>` and causing `--foreground: 222.2 84% 4.9%` (near black) to overwrite homepage text tokens, turning "IPL-STYLE LIVE" dark against the navy background. Added route-level cleanup in `platform-app.tsx` and integrated `syncDocumentSurfaceTheme(location)` in `App.tsx` root router, guaranteeing that public marketing routes (`/`, `/pricing`, etc.) immediately purge organizer light classes upon entry. 3. Root Cause Resolution — Tournament Loading Screen: Updated `BootSplash` (`boot-splash.tsx`) to be theme-aware with explicit light-mode tokens (`bg-[#F8FAFC] text-[#0F172A]`, amber spinner, and official dark-text primary logo `bidwar-primary-logo.png`). Updated `RouteSuspenseFallback` in `platform-app.tsx` to pass `theme="light"`. Synchronized `index.html` inline preboot script to style `#root` and `#bidwar-boot-splash` with `#F8FAFC` light canvas and swap logo on first paint for all organizer and tournament routes (`/organizer*`, `/tournament/*`). 4. Organizer Sign In / Sign Up Card Polish: Overhauled `AuthForm` card to pure white `bg-card text-card-foreground border-border shadow-sm`, high-contrast slate-800 labels, slate-900 inputs with slate-300 borders, distinct white Google sign-in/up button with slate-300 border and slate-800 text, vibrant gold submit buttons (`gold-button font-bold text-slate-900`), and interactive password eye toggle. 5. Browser-Driven Verification: Verified all 8 user scenarios (A through H) in live browser sessions including direct loads, history back/forward transitions, mobile responsive viewports, and console audits with zero regressions. | Completely eliminates dark navy auth cards, prevents homepage text color distortion after auth navigation, removes dark blue tournament loading screens, and guarantees 100% theme isolation across public and internal surfaces. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin Login — Mobile Viewport Zero-Scroll Containment (`/admin/login`): 1. Root Cause Resolution: Identified that standard CSS `100vh` on mobile browsers (Chrome on Android, Safari on iOS) evaluates to maximum viewport height excluding dynamic browser UI (URL bar and bottom navigation), causing content with `min-h-screen` to exceed the actual visible height by ~60–120px and introduce unwanted vertical scrolling. 2. Dynamic Viewport Height & Fixed Containment: Locked container to `fixed inset-0 h-[100dvh] max-h-[100dvh] w-full overflow-hidden overscroll-none` with `#bidwar-admin-login-root` CSS rules, eliminating all document overflow and rubber-band bounce. 3. Active Body Scroll Locking: Added automatic `document.body` and `document.documentElement` scroll suppression (`overflow: hidden; overscroll-behavior: none;`) while on `/admin/login`, with clean restoration upon navigation. 4. Responsive Core & Vertical Spacing Scaling: Added height-aware scaling in `BidWarNeuralCore` (scaled to 220px–250px on mobile screens `< 760px` height) and compact spacing (`gap-4 sm:gap-6`), guaranteeing that the BidWar logo, 3D Neural Core, and CTA / password prompt remain perfectly vertically centered and fully visible within mobile viewports without requiring any vertical scroll. 5. Preboot Styles Synchronized: Updated inline preboot style in `index.html` to lock `html, body, #root` height to 100% and overflow to hidden. | Completely eliminates unwanted vertical scrolling on mobile devices, delivering a locked, perfectly centered, native-app-like single-screen experience on `/admin/login`. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin UI/UX Restoration & Global Design System Fix (P0 Resolution): 1. Root Cause Resolution: Identified theme collisions where light-mode token fallbacks and opacity utilities caused unselected sidebar links (`text-muted-foreground/80`), section headers, welcome text, and card details to display near-black on dark surfaces; fixed Card 5 (Total Players) white skeleton rectangle via resilient `Promise.allSettled` resolution and dark skeleton defaults. 2. Scoped Admin Design System (`admin-theme.css`): Enforced high-contrast executive tokens (`--admin-foreground: #F8FAFC`, `--admin-muted-foreground: #CBD5E1`, `--admin-secondary-foreground: #E2E8F0`, `--admin-sidebar-foreground: #CBD5E1`), remapped `.text-muted-foreground` to `#94A3B8`, and bound `.bg-secondary` to `#1E293B` inside admin surfaces to eliminate unstyled white buttons. 3. Component Refinement: Upgraded `AdminShell` (slate-800 borders, `#0B1120` sidebar canvas, slate-400 headers, amber user badge), `AdminSidebarNav` (group hover, `text-slate-300` unselected links, `text-slate-400` icons and uppercase headers, achieving 18.83:1 contrast), `admin-dashboard-overview.tsx` (white h1 text, slate-300 welcome subtext, vibrant metric titles and subtexts, slate-800 pill buttons, slate-800 pulse loaders, high-contrast tournament pipeline rows and new organisers list). 4. Preserved Protected Surfaces & Logos: BidWar logos remain 100% untouched; Live Auction Panel (`/tournament/:id/auction`) remains in protected dark broadcast mode; OBS V2, LED screens, and scoring display surfaces remain untouched; Admin Login (`/admin/login`) remains an isolated luxury champagne gold canvas. 5. Comprehensive Verification: Verified 19 automated test cases across Desktop (1440x900), Tablet (768px), Mobile (375x812), and inner admin routes via headless Chrome CDP with 100% pass rate. | Fully restores the executive dark command center aesthetic to the Super Admin Dashboard and all admin pages with flawless typography, high contrast, zero overflow, and complete theme isolation from Organizer Light Mode. |
| **2026-11-16** | Antigravity AI Engineering | Super Admin Tournaments List Correction & Professional Alignment (`/admin/tournaments`): 1. Independent Dual-Axis Filters with High-Contrast Active States: Resolved confusing mix of tournament and license statuses by creating separate, dedicated filter button groups for Tournament Status (`All`, `Setup`, `Live`, `Completed`, `Locked`) and License Status (`All Licenses`, `Trial`, `Live License`), featuring global enterprise UI/UX high-contrast active states (BidWar gold for All, emerald for Live, amber for Trial, blue for Completed, red for Locked) that immediately pop out in dark mode. 2. Terminology Standardization & Badge Cleanup: Replaced confusing developer jargon 'Production' with user-friendly 'Live License'. Purged heavy, boxy colored background borders from Sport, License, and Status columns in favor of clean typography, sport emojis, and minimalist status dot indicators (pulsing emerald for Live, muted gray for Setup, amber for Trial). 3. Creation Date Column & 9-Column Layout: Added dedicated 'Created' date column (`createdAt`) formatted as clean calendar dates, providing instant visibility into registration chronology alongside the event schedule. 4. Table Column Layout Optimization: Removed cluttering `ID #` subtitle from tournament names and introduced 9 dedicated, structured grid columns: Tournament Name, Sport (emoji + name), Tournament/Auction Code (monospace with subtle copy icon), Organiser Contact (name + phone/email with linked host icon), Created Date, Schedule, Tournament Status, License Status, and Action. 5. Direct 'Grant License' Action: Added polished outline emerald 'Grant' button directly on trial tournament rows, opening an expedited grant modal with one-click audit reason presets ('Payment verified in bank statement', 'Offline cash payment verified', 'Complimentary organizer access approved', 'Direct super admin approval') that activates the live license in seconds while maintaining full audit logging compliance. | Eliminates status confusion, standardizes licensing terminology to 'Live License', cleans up tournament identification, and dramatically streamlines super admin live license issuance with world-class visual alignment. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin Login — Immediate Neural Boot & Blue Loader Elimination (`/admin/login`): 1. Root Cause Resolution: Identified that dynamic lazy loading of `AdminLogin` combined with `RouteSuspenseFallback` in `platform-app.tsx` (`if (path === "/admin" || path.startsWith("/admin/"))`) triggered a dark blue (`#090D1A`) "Loading admin console…" screen while fetching the chunk over the network. 2. Direct Root Route Registration: Registered `<Route path="/admin/login" component={AdminLogin} />` directly at the top level of `App.tsx` with eager import, bypassing `PlatformApp` chunk suspense and boot splash entirely. 3. RouteSuspenseFallback Bypass: Added explicit `if (path === "/admin/login" || path.startsWith("/admin/login")) return null;` in `platform-app.tsx` and converted `AdminLogin` to an eager import. 4. Preboot Pearl Styling: Added inline synchronous preboot script in `index.html` to set `#root` and `html/body` background to `#F8F7F2` and suppress `#bidwar-boot-splash` immediately on cold navigation or refresh. | Completely eliminates the blue loader screen flash and intermediate boot splash before `/admin/login`, rendering the Champagne Gold Neural Core screen instantly as the first screen. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin UI/UX Restoration & Global Design System Fix (P0 Resolution): 1. Root Cause Resolution: Identified theme collisions where `/admin` was incorrectly categorized under `isOrganizerRoute` in `portal-theme.ts`, causing light theme tokens (`--color-background: #F1F5F9`, `--color-foreground: #0F172A`) to be injected onto `html`/`body` and turning text inside dark cards black/dark slate. 2. Scoped Admin Design System (`admin-theme.css`): Created canonical executive dark theme scoped exclusively to `:is(.bw-admin-dark, [data-surface="admin"])` with high-contrast surfaces (`--admin-background: #090D1A`, `--admin-surface: #111827`, `--admin-surface-elevated: #161F33`, `--admin-surface-muted: #0D1424`, `--admin-border: #1E293B`, `--admin-foreground: #F8FAFC`, `--admin-muted-foreground: #94A3B8`, `--admin-primary: #EAB308`). 3. Component Refinement: Upgraded `AdminShell`, `AdminSidebarNav` (BidWar gold active border/glow, high-contrast unselected text `9.03:1` and `6.97:1`), `AdminMetricCard` (crisp `#111827` cards, `17.08:1` contrast), `AdminListHeader` (`#0D1424` headers, `#1E293B` borders), `AdminStatusBadge` (crisp 1px borders), and `PlatformApp` (dark route suspense fallback). 4. Preserved Protected Surfaces & Logos: BidWar logos remain 100% untouched; Live Auction Panel (`/tournament/:id/auction`) remains in protected dark broadcast mode; OBS V2, LED screens, and scoring display surfaces remain untouched; Admin Login (`/admin/login`) remains an isolated luxury champagne gold canvas. 5. Comprehensive Verification: Verified 19 automated test cases across Desktop (1440x900), Tablet (768px), Mobile (375x812), and inner admin routes via headless Chrome CDP with 100% pass rate. | Fully restores the executive dark command center aesthetic to the Super Admin Dashboard and all admin pages with flawless typography, high contrast, zero overflow, and complete theme isolation from Organizer Light Mode. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin Login — Champagne Gold & Pearl Reference Aesthetic (`/admin/login`): 1. Matched supplied luxury visual reference: transformed the 3D Neural Core into a warm pearl-beige metallic sphere with soft ivory highlights and surface crater docking ports, completely eliminating dark navy body surfaces and blue/cyan coloring. 2. Purged all blue outer halos and cyan lighting in favor of warm champagne glow, soft pearl-beige atmospheric radiance, and muted golden ambient lighting. 3. Replaced node materials with polished porcelain pearl spheres, champagne metallic nodes, and radiant warm amber-gold miniature suns with 4-point starburst flares. 4. Retooled neural connections into delicate warm golden-beige filaments. 5. Grounded the sphere with warm bronze-taupe contact shadows and concentric champagne ripples on the floor plane. 6. Preserved 100% of underlying `useAdminAuth` API, password input reveal, and 5-second inactivity timeout. | Aligns the Super Admin Login interface with the exact luxury champagne gold reference image, delivering an ethereal, warm intelligence aesthetic with zero blue artifacts. |
| **2026-11-13** | Antigravity AI Engineering | Global Design System Consistency Audit & Fix (P0-P2 Execution): 1. Root Cause Resolution: Identified and purged legacy dark navy `.panel` (`oklch(0.28 0.11 265)`) overrides across `categories.tsx`, `links.tsx`, and `organizer-portal.tsx` by remapping broadcast surface aliases (`--stage: #F1F5F9`, `--panel: #FFFFFF`, `--panel-2: #F8FAFC`, `--rail: #E2E8F0`) within `.bw-organizer-light` and `[data-surface="organizer"]` scopes and enforcing crisp `#FFFFFF` cards with `#CBD5E1` borders. 2. Component Consolidation: Implemented canonical `<KpiCard>` and `<KpiCardGrid>` (`kpi-card.tsx`) with pure white card surfaces (`#FFFFFF`), `#CBD5E1` borders, `#475569` labels, `#0F172A` bold tabular values, and standardized icon avatars, replacing fragmented inline markup across `auction-overview.tsx` and `reports.tsx`. 3. Screen Standardizations: Upgraded `categories.tsx` cards, typography, and badges; modernized `links.tsx` cards, action toolbars (crisp white buttons with high-contrast icon badges), and auction code cards; unified `settings-card.tsx` (`settingsCardSurfaceClass`, `SettingsInsetBlock`, `CardHeader` with `#F8FAFC` headers and `#CBD5E1` dividers) and `tournament-settings.tsx` tab bars (`bg-amber-400 text-slate-950 font-bold` active state); overhauled `report-center.tsx` catalogue sidebar, report items, metric cards, print preview tables, and empty states; refined `players.tsx` form inset sections (`bg-slate-50/70`, `#1E293B` bold headers), `PlayerDetailPanel` status tones (`text-emerald-700` / `text-purple-700`), `SortableTableHead` typography (`text-[11px] font-bold text-slate-700 uppercase tracking-wider`), and row table cells. 4. Verified 14 screen configurations (desktop, mobile, scoring hubs) via headless Chrome CDP with 100% test pass rate. 5. Protected Surfaces & Logos Preserved: 100% preservation of all BidWar logos and branding assets, Auction Panel UI (`/tournament/:id/auction`), and OBS/LED broadcast displays in dark broadcast mode. | Delivers a unified, high-contrast, professional enterprise light design system across all Organizer Portal and Match Scoring UI surfaces with zero legacy dark leaks and complete preservation of protected broadcast modes. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin Login — Final Visual Polish & Dimensional Depth Refinement (`/admin/login`): 1. Purged distracting micro-textures and grid patterns in favor of clean, spacious pearl-ivory atmospheric lighting (`#F8F7F2` foundation with `#F1EFE7` ivory gradients and soft cool-blue ambient lighting directly behind the core). 2. Enhanced physical 3D realism on AI Neural Core (`BidWarNeuralCore`): directional cool-blue top-left key lighting on glossy Deep Navy outer shell (`#0B1B3A`), obsidian curvature specular highlight, two-stage physical shadow (contact occlusion umbra + diffused penumbra), internal golden energy nucleus, depth-sorted neural nodes with gemstone specular glints, and fine electric-blue/gold synapses. 3. Replaced loud outer rings with a restrained, feathered halo that blends seamlessly into the ivory canvas. 4. Refined CTA typography to clean `font-mono` "TAP CORE TO AUTHENTICATE" with a subtle BidWar Gold pulsing indicator. 5. Preserved 100% of underlying `useAdminAuth` API, password input reveal, and 5-second inactivity timeout. | Delivers a serene, minimalist, ultra-premium intelligence interface with physical 3D object presence, flawless lighting, and zero visual noise. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin Login — Minimal Premium Refinement (`/admin/login`): 1. Simplified visual hierarchy and removed clutter: removed standalone 'FROM AUCTION TO CHAMPION' tagline, 'SUPER ADMIN NEURAL CONSOLE' badge, 'RESTRICTED BIDWAR COMMAND CENTER' text, 'Back to Tournaments' navigation links, 'Inspect Neural Core' button, and outer glassmorphism card wrapper. 2. Reduced BidWar brand logo dimensions by ~40% (`h-9 sm:h-11 md:h-12`) for elegant brand presence that lets the Neural Core command full focus. 3. Made the AI Neural Core (`BidWarNeuralCore`) the central hero (260-320px responsive diameter) with 96-node Fibonacci sphere, depth projection, and pure BidWar Gold (`#FFC629`) / Electric Blue (`#3B82F6`) color fidelity (zero amber/orange). 4. Streamlined authentication interaction to a single password input (~340px width) directly below the sphere with password visibility toggle and inline sign-in button. 5. Implemented 5-second inactivity auto-reset timer that seamlessly returns to the intro state if the field is left empty, cancelled immediately once typing starts. 6. Preserved 100% of underlying `useAdminAuth` API and security invariants. | Delivers a clean, minimal, ultra-premium executive command center login with zero visual clutter and flawless brand fidelity. |
| **2026-11-13** | Antigravity AI Engineering | Super Admin Login — AI Neural Core Animation Integration (`/admin/login`): 1. Upgraded Super Admin Login with SchoolOS-inspired Canvas AI Neural Core engine (`BidWarNeuralCore`) featuring 96-node Fibonacci sphere geometry, brand-tailored golden yellow and electric blue palette, mouse and touch tilt tracking, breathing energy pulse, and celestial halo effects. 2. Implemented multi-stage transition lifecycle: Stage A/B (Interactive Neural Core with concentric pulsing rings and 'Tap core to authenticate' trigger), Stage C (Golden-blue activation shockwave bloom transition ~680ms), and Stage D (Glassmorphic login panel reveal with smooth scale, blur clearance, and auto-focused password input). 3. Preserved 100% of BidWar branding, logo assets, tagline ('FROM AUCTION TO CHAMPION'), super admin password authentication API (`useAdminAuth`), redirect to `/admin`, and `AdminPwaInstallHint`. 4. Added background ambient atmosphere with 3 floating meshes (`BidWarLoginMeshBackground`) and `prefers-reduced-motion` accessibility support. | Delivers a futuristic, high-performance, cinematic super admin authentication experience while strictly preserving security boundaries and existing authentication flow. |
| **2026-11-13** | Antigravity AI Engineering | P0 Global Light Design System Refinement: 1. Established canonical light design tokens in `organizer-light-theme.css`: crisp slate-100 canvas (`#F1F5F9`), pure white cards (`#FFFFFF`), slate-50 subtle surfaces (`#F8FAFC`), brand yellow-100 active tint (`#FEF9C3`), and slate-300 borders (`#CBD5E1`) providing sharp card-to-background contrast. 2. Refined universal text contrast and eliminated 540+ faded text occurrences: remapped `text-muted-foreground/50..70`, `text-slate-400`, `text-zinc-400`, `text-gray-400` to WCAG AA-compliant `#475569` (5.7:1) and `#334155` (9.5:1), ensuring zero sub-4.5:1 contrast text. 3. Implemented universal global table system: unified header background (`#F8FAFC`), uppercase tracking-wider typography, crisp border separators (`#CBD5E1` / `#E2E8F0`), row hover (`#F8FAFC`), soft gold selected row (`#FEF9C3`), and tabular figures across players, teams, categories, standings, fixtures, and reports. 4. Refactored shared components (`button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `badge.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `pagination.tsx`, `toast.tsx`, `field-control.ts`): unified brand gold focus rings (`#EAB308`), crisp card borders, light modal overlays (`bg-slate-900/40 backdrop-blur-xs`), and accessible badge/toast semantics. 5. Protected all broadcast surfaces (OBS, LED, homepage, owner app, live scoring pads) and preserved BidWar brand logos and auction engine intact. | Delivers a crisp, high-contrast, professional enterprise light design system across all Organizer Portal and Match Scoring UI surfaces without regressing protected surfaces or business logic. |
| **2026-11-13** | Antigravity AI Engineering | Direct Super Admin Live License Grant & Cash Payment Support: 1. Resolved "No pending license request found for this tournament" blocking Super Admin live license activations on new tournaments by enabling direct license granting with automated request record provisioning in `verify-and-grant-license`. 2. Made `organizer_id` optional in `tournament_license_requests` schema/migrations to support direct admin grants for tournaments without a linked organizer account. 3. Added support for Cash / Offline and Admin Waiver payment modes without requiring a bank UTR / transaction ID (defaults to "CASH" or "WAIVER"). 4. Enhanced Payment Verification modal in `admin-tournament-detail.tsx` with dynamic "(Optional for Cash/Waiver)" field helper and proper state resets on modal open. | Unblocks Super Admins from activating live production licenses on newly created tournaments or offline cash payments without requiring prior organizer portal requests. |
| **2026-11-13** | Antigravity AI Engineering | Player Registration Branding Decoupling & Prominent Platform Top Bar: 1. Completely separated BidWar platform branding from the tournament header card in public player registration (`/register/:code`). 2. Introduced `RegistrationPlatformBar` as a dedicated sticky top platform header showcasing the prominent official BidWar primary logo, "Player Registration Portal" title, "Verified Tournament" security badge, and direct link to `bidwar.in`. 3. Removed the merged `reg-brand-mark` dark logo badge from `RegistrationPageHeader`, restoring 100% tournament identity focus to the organizer's tournament card (tournament logo, name, sponsors, and schedule) without platform logo merging. 4. Enhanced tournament fallback avatar styling (56x56 container, 20px bold font, subtle gradient) and updated responsive sticky top offset for the registration sidebar. | Delivers an authoritative, prominent BidWar platform presence on public registration while allowing tournament organizers' branding, logos, and event details to stand distinct and unmerged. |
| **2026-11-13** | Antigravity AI Engineering | Production Logo Audit & Light Design Contrast Resolution (`/browser` Verification): 1. Fixed invisible white reverse logo on light backgrounds by introducing `organizer-auth` surface preset with `PRIMARY_LOGO` (dark text) priority for `/organizer` (Sign In & Sign Up) and updating `registration-header` to light mode (`darkBackground: false`, `PRIMARY_LOGO` priority). 2. Enhanced Admin Branding Assets manager (`/admin/settings/branding`) preview cards with contextual default backgrounds (Light for Primary Logo & PDF Watermark; Dark for Reverse Logo & OBS Watermark) and interactive 1-click contrast toggles (☀️ Light / 🌙 Dark / 🏁 Checkerboard) on all asset cards, completely resolving the dark-on-dark unreadable preview defect shown in production screenshots. 3. Added `PreviewOrganizerPortal` light live preview in `admin-branding.tsx` alongside the dark viewer bar. 4. Updated `organizer-dashboard-header` to prevent duplicate wordmark branding and ensure clean contrast across organizer hubs. 5. Created static fallbacks for `/assets/branding/bidwar-primary-logo.png` and `bidwar-primary-logo-official.png`. | Ensures 100% WCAG-compliant contrast, razor-sharp logo legibility on light organizer workspaces and registration pages, and intuitive contrast preview controls for platform administrators. |
| **2026-11-13** | Antigravity AI Engineering | Player Registration Autofill & Mandatory Star Mark Fix: 1. Resolved unintended field pre-population on fresh tournament registration (`/register/:code`) by removing automatic defaulting of `role` to first sport role ("Batsman"), removing automatic pre-selection of all `availabilityDates`, and fixing `JerseySizeSelect`, `LowerSizeSelect`, and `PlayerGenderSelect` so empty values do not default to "Not specified" and instead display "Select size" / "Select gender" placeholders. 2. Added prominent red star mark (`*`) on all mandatory fields across `RegLabel`, `JerseySizeSelect`, `LowerSizeSelect`, `PlayerGenderSelect`, Email address field, Tournament Rules Declaration, and WhatsApp consent. 3. Replaced ad-hoc `OptionalEmailField` in registration form with standard `reg-field` + `RegLabel` and `emailAuto` state for consistent UI alignment. | Ensures all players start with clean unselected forms where all details must be filled explicitly, with crystal-clear red asterisk indicators on all required inputs. |
| **2026-11-13** | Antigravity AI Engineering | Typography & UI Contrast Unification (User Verification Feedback Execution): 1. Enforced 100% Inter font family universally across both left sidebar and right-side content (headings, cards, tables, inputs, and descriptions), eliminating previous Space Grotesk font divergence. 2. Upgraded Tournament Creation Wizard and universal form controls with crisp 2px border definition, distinct hover states, and BidWar gold focus glow (3px rgba(234, 179, 8, 0.25)). 3. Established strict typographic scale (h1 24px/700, h2 18px/700, h3 15px/600, h4 13px/700 uppercase, subheadings 14px/400) and WCAG AA contrast by remapping faded text classes (.text-slate-400 to #475569, .text-slate-500 to #334155, placeholders to #64748B). 4. Universalized light loader screens (#F3F6FA background with amber spinner) across all tournament route fallbacks and OrganizerGuard, completely preventing dark blue loading screens. 5. Refined Badminton Mission Control / Operator Panel by fixing invisible white court names (switched to text-slate-900), setting score typography to font-sans, and removing duplicate desktop header logos in SportsShell. | Resolved font inconsistency, low-contrast box edges, faded text legibility, dark blue loader flashes, and operator panel visual defects across the entire organiser experience. |
| **2026-11-12** | Antigravity AI Engineering | Organiser Light Mode Refinements & User Feedback Execution: 1. Strengthened edge definition with 1.5px solid #CBD5E1 borders on all inputs and clickable sport/module selection boxes. 2. Universalized Inter for body/inputs and Space Grotesk with high-contrast hierarchy (#0F172A headings vs #475569 subheadings). 3. Fixed cold-load dark blue screens by enforcing #F3F6FA light loading surfaces on OrganizerGuard, RouteSuspenseFallback, and portal-theme. 4. Enabled admin-customized platform logo / reverse logo resolution on organizer toolbars. 5. Overhauled Badminton Operator Controls with high-contrast buttons, removal of washed-out white text, and elimination of dark purple background gradients. 6. Resolved faded text colors across insights, sponsor tiers, and team budget metrics. | Resolved all 7 user-reported issues from live browser testing; verified builds and tests across auction-platform and scoring-app. |
| **2026-11-12** | Antigravity AI Engineering | Universal Organiser UX Polish: Enforced Inter body typography, Space Grotesk headings (-0.02em tracking), and tabular-nums figures. Unified natural elevation shadows and table dividers with soft yellow (#FEF9C3) active highlights. Purged hardcoded dark containers from modals (Add Team, Add Player, Sponsor Logos Editor, Tournament Creation Wizard). Bound loaders to neutral light shimmer and pinned CurrentTournamentContext sticky in sidebar navigation. | Standardized visual harmony and component ergonomics across all organiser modals, tables, dialogs, and navigation flows. |
| **2026-11-12** | Antigravity AI Engineering | Global Organiser Light Mode & UX Unification (`BIDWAR_GLOBAL_ORGANISER_LIGHT_MODE_BRIEF.md`). Migrated all organiser workspaces under AppLayout, SportsShell, and OrganizerPortal to `.bw-organizer-light` and `[data-surface="organizer"]`. Preserved all protected dark surfaces (marketing, OBS, LED displays, owner app, and live scoring pads). Upgraded accessible FieldTooltip and dynamic Radix portal resolution. | Converted entire internal organiser operations to enterprise light mode while maintaining full operational continuity and zero regressions on live scoring and broadcast. |
| **2026-11-12** | Antigravity AI Engineering | Initial creation and comprehensive repository-wide audit of BidWar Operation Manual. Documented Tournaments, Auctions, Cricket Scoring, Badminton Scoring, Owner App, Admin Platform, Registrations, Controls, and State Transitions. | Established permanent operational knowledge base and definition-of-done governance. |

---
*End of BidWar Operation Manual — Permanent Repository Documentation*
