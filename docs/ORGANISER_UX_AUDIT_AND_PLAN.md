# BIDWAR ORGANISER & ORGANISER SCORING PANELS UI/UX AUDIT & MODERNISATION PLAN
## Master Architectural Audit, Evaluation Matrix, and Implementation Roadmap for Requirements R3 & R4

- **Document Version:** 1.0.0 (Production Release)
- **Author:** Worker 2 (Teamwork Implementer, QA & Domain Specialist)
- **Authority:** BidWar Architecture Contract (`.agents/skills/bidwar_architecture_skill/SKILL.md`) & Universal Design System (`.agents/skills/universal-design-system/SKILL.md`)
- **Status:** APPROVED FOR IMPLEMENTATION (Milestones 3 & 4)
- **Target Workspaces:** `artifacts/auction-platform`, `artifacts/scoring-app`, `lib/shared-ui`
- **Protected Surface Exclusions:** Live Scorer Pads, OBS Broadcast Overlays, LED Arena Displays, Team Owner App, Public Marketing & Fan Pages, Live Auction Operator Room

---

## 1. Executive Summary

### 1.1 Mission & Context
BidWar is a multi-sport tournament and auction platform providing enterprise-grade event management, real-time auction bidding, and professional ball-by-ball and point-by-point sports scoring (Cricket, Badminton, and future sports). To deliver an enterprise SaaS experience matching the high operational pressure of live sports events, this master audit establishes the formal modernization blueprint for all **Organiser Panels (Requirement R3)** and **Organiser Scoring Management Panels (Requirement R4)**.

This audit builds upon the integration of the **Universal Design System (UDS)** (Milestone 1) and synthesizes findings from comprehensive codebase inspection across the frontend web applications (`artifacts/auction-platform` and `artifacts/scoring-app`), shared libraries (`lib/scoring-core`, `lib/badminton-core`, `lib/platform-core`), and network routing gateways (`artifacts/gateway`).

### 1.2 Invariant Mandates & Architectural Guardrails
Every finding, specification, and roadmap phase in this document is bound by five inviolable platform invariants:
1. **Module Independence:** Auction and Sports Scoring are sibling modules governed by explicit flags (`auction_enabled`, `scoring_enabled`). A tournament may be Auction-only, Scoring-only, or Both. No organiser panel or scoring management panel may create a hard dependency on the other module.
2. **Scoring Logic & Data Invariant:** Pure calculation engines (`lib/scoring-core`, `lib/badminton-core`), mathematical reducers (Cricket DLS, scorecard generation, NRR calculation; Badminton BWF doubles rally sequence engines), database schemas, REST APIs, and WebSocket state protocols are strictly immutable. UI modernization is 100% presentation-layer and interaction-layer refinement.
3. **Protected Surface Isolation:** Operational live surfaces—specifically the live touch scorer pads (`/cricket/:matchId/score`, `/badminton/:matchId/score`, `/cricket/scorer`, `/badminton/scorer`), OBS broadcast scenes (`/obs/*`), LED arena displays (`/display*`), Team Owner bidding console (`artifacts/owner-app`), public fan hubs (`/fan*`), and the Live Auction Operator room (`/tournament/:id/auction`)—must remain **100% untouched**.
4. **Light Enterprise Organiser Workspace:** All organiser management surfaces operate under the crisp light enterprise theme scoped under `:is(.bw-organizer-light, [data-surface="organizer"])`.
5. **Universal Design System Compliance:** All UI improvements must adhere to WCAG 2.2 Level AA accessibility standards (4.5:1 text contrast, 3:1 non-text contrast, 44x44px minimum touch targets, visible focus indicators, screen reader accessibility) and leverage unified Radix UI / Tailwind CSS primitives.

### 1.3 Core Audit Diagnosis
The audit revealed three primary systemic fractures across the existing organiser codebase:
1. **Dual Shell Divergence:** Two competing layout shells exist simultaneously: `AppLayout` (`artifacts/auction-platform/src/components/layout.tsx`) for auction/tournament management and `SportsShell` (`artifacts/auction-platform/src/components/sports-shell/sports-shell.tsx`) for sports scoring management. They maintain conflicting `localStorage` state keys (`sidebar-collapsed` vs `sports-shell-collapsed`), differing collapsed sidebar widths (56px vs 64px), different mobile drawer architectures (raw DOM portal vs Radix `Sheet`), and incompatible header bars.
2. **Styling Specificity Warfare:** The current light theme relies on 914 lines of CSS in `organizer-light-theme.css` saturated with heavy `!important` declarations to overpower legacy broadcast styles, while `organizer-dashboard-premium.css` introduces competing custom classes (`.od-stat-card`, `.od-btn-gold`). This creates styling rigidity, breaks component encapsulation, and causes visual glitches during state transitions.
3. **Component Fragmentation & Monolithic Files:** Several core management pages have grown into massive monolithic files (e.g., `organizer-portal.tsx` at 2,719 lines; `tournament-settings.tsx` at 2,660 lines; `cricket/match-center.tsx` at 842 lines). Concurrently, `sports-page-chrome.tsx` re-implemented custom ad-hoc primitives (`FormModal`, `DarkSelect`, `BtnPrimary`, `BtnSecondary`) rather than reusing standard Radix UI primitives, resulting in inconsistent focus management, modal behavior, and visual hierarchy.

---

## 2. Comprehensive Inventory of Organiser Surfaces

The following inventory identifies every organiser-facing route, physical component file, operational purpose, primary workflows, and governance constraints across the platform.

### 2.1 Organiser Tournament Management Panels (Requirement R3)
All routes are hosted within `artifacts/auction-platform/src/pages/` and wrapped by `OrganizerAppLayout` / `AppLayout` under `:is(.bw-organizer-light, [data-surface="organizer"])`.

| Route | Page Component | Physical File Path | File Size / Lines | Operational Purpose | Key Workflows & Features | Guards / Entitlements |
|---|---|---|---|---|---|---|
| `/organizer` | `OrganizerPortal` | `artifacts/auction-platform/src/pages/organizer-portal.tsx` | 108 KB / 2,719 lines | Organiser landing dashboard & tournament portal | Tournament search, sport filters, status toggles, auth login/OTP, tournament creation wizard trigger, license upgrade modal | `useOrganizerAccountAuth` |
| `/organizer/profile` | `OrganizerProfile` | `artifacts/auction-platform/src/pages/organizer-profile.tsx` | 24 KB / 620 lines | Organiser profile & credentials management | Profile photo upload, contact details update, password set/reset, notification preferences | `useOrganizerAccountAuth` |
| `/tournament/new` | `NewTournament` | `artifacts/auction-platform/src/pages/tournament-new.tsx` | 18 KB / 440 lines | Tournament creation standalone page | Multi-step tournament initialization: sport selection, module toggling (Auction, Scoring, Both), venue, dates | `useOrganizerAccountAuth` |
| `/tournament/:id` | `TournamentHome` | `artifacts/auction-platform/src/pages/tournament-home.tsx` | 8 KB / 210 lines | Dynamic module landing router | Dispatches to module landing path (`resolveTournamentOrganizerLandingPath`): Auction Overview or Sports Mission Control | `OrganizerGuard` |
| `/tournament/:id/auction-overview` & `/overview` | `AuctionOverview` | `artifacts/auction-platform/src/pages/auction-overview.tsx` | 32 KB / 780 lines | Auction management command summary | KPI dashboard (Total purse, squads filled, unsold players, team balances), quick links to live auction operator console | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/teams` | `Teams` | `artifacts/auction-platform/src/pages/teams.tsx` | 42 KB / 1,020 lines | Franchise team management | Team registration, logo uploads, purse allocation, squad limits, owner PIN generation, WhatsApp credential dispatches | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/categories` | `Categories` | `artifacts/auction-platform/src/pages/categories.tsx` | 28 KB / 680 lines | Player auction categories | Category hierarchy definition, base prices, bid increment ladders, category ordering, player allocation caps | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/players` | `Players` | `artifacts/auction-platform/src/pages/players.tsx` | 64 KB / 1,540 lines | Player registry & auction pool | Excel/CSV bulk import, player search/filter, payment status tracking, photo cropping dialog, manual player entry, export | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/settings` | `TournamentSettings` | `artifacts/auction-platform/src/pages/tournament-settings.tsx` | 112 KB / 2,660 lines | Comprehensive tournament configuration | 5-tab configuration: Basics, Auction Rules (timer, increments, sound effects), Registration, Media/Branding, Danger Zone | `OrganizerGuard` |
| `/tournament/:id/reports` | `Reports` | `artifacts/auction-platform/src/pages/reports.tsx` | 26 KB / 640 lines | Export & audit documentation | PDF/Excel exports of team rosters, auction ledger sheets, player statistics, purse spend summaries | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/links` | `LinksPage` | `artifacts/auction-platform/src/pages/links.tsx` | 20 KB / 490 lines | Central operational links hub | Shareable URLs and QR codes for Owner App, LED Hall Displays, Fan Pages, OBS Overlays, Scorer Consoles | `OrganizerGuard` |
| `/tournament/:id/fortune-wheel` | `FortuneWheel` | `artifacts/auction-platform/src/pages/fortune-wheel.tsx` | 16 KB / 390 lines | Interactive random player selection tool | Wheel of fortune spinner for random player selection during live auction hall proceedings | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/break-timer` | `BreakTimerPage` | `artifacts/auction-platform/src/pages/break-timer.tsx` | 14 KB / 330 lines | Arena break timer display control | Strategy break / lunch countdown timer controller with arena display sync | `OrganizerGuard`, `isAuctionEnabled` |
| `/tournament/:id/local-mode` | `LocalModePage` | `artifacts/auction-platform/src/pages/local-mode.tsx` | 34 KB / 820 lines | Offline venue synchronization management | Local server sync status, roster export to local SQLite, peer discovery, offline-to-cloud reconciliation | `OrganizerGuard` |
| `/tournament/:id/reset` | `AuctionReset` | `artifacts/auction-platform/src/pages/auction-reset.tsx` | 15 KB / 360 lines | Auction trial data reset utility | Danger zone reset: wipe mock auction bids, reset team purse balances, restore players to auction pool | `OrganizerGuard`, `isAuctionEnabled` |

#### Super Admin Internal Management Routes
While primary organizer workflows target tournament-specific operations, Super Admin surfaces share the light enterprise design system for platform governance:
- `/admin` (`AdminDashboardOverview`, `pages/admin-dashboard-overview.tsx`): Platform-wide metrics, active tournaments, system health.
- `/admin/tournaments` & `/:id` (`AdminTournamentsList`, `AdminTournamentDetail`): Master tournament control, license overrides, module toggles.
- `/admin/tournaments/:id/workbook` (`TournamentMasterWorkbook`): Tabular bulk data editor for tournaments, teams, and players.
- `/admin/organisers` & `/:id` (`AdminOrganisersList`, `AdminOrganiserDetail`): Organizer verification, account locks, multi-tenant rights.
- `/admin/members` (`AdminMembersList`): Global member registry, capability tags, profile moderation.
- `/admin/sports` (`AdminSportsPage`): Sport module registry, rulesets, capabilities activation.
- `/admin/live` (`AdminLiveOperations`): Multi-tournament concurrent live monitoring, WebSocket broker telemetry.
- `/admin/settings/system/*` (`AdminSystemPage`): Cloudinary media, cache busting, audit logs.

---

### 2.2 Organiser Scoring Panels (Requirement R4)
All organiser scoring panels are served via the canonical `/scoring-app/` gateway proxy (routing to `artifacts/scoring-app`, with physical source aliased to `artifacts/auction-platform/src/pages/`). Scoring panels are wrapped by `SportsShell` or sport-specific page chrome under `:is(.bw-organizer-light, [data-surface="organizer"])`.

#### A. Central Sports Product Home
| Route (under `/scoring-app/`) | Page Component | Physical File Path | File Size / Lines | Operational Purpose | Key Workflows & Features |
|---|---|---|---|---|---|
| `/tournament/:id/mission-control` | `SportsMissionControlPage` | `artifacts/auction-platform/src/pages/sports/mission-control.tsx` | 14 KB / 348 lines | Sports product home & readiness center | Tournament readiness checklist, module health, quick jump to fixtures/live ops, sport status cards |

#### B. Cricket Organiser Scoring Management Surfaces
| Route (under `/scoring-app/`) | Page Component | Physical File Path | File Size / Lines | Operational Purpose | Key Workflows & Features |
|---|---|---|---|---|---|
| `/tournament/:id/score/dashboard` | `CricketDashboard` | `artifacts/auction-platform/src/pages/cricket/dashboard.tsx` | 16 KB / 388 lines | Match-day operations dashboard | Active matches strip, match status filters, tournament standings preview, quick match creation |
| `/tournament/:id/score/fixtures` & `/score` | `CricketFixtures` | `artifacts/auction-platform/src/pages/cricket/fixtures.tsx` | 38 KB / 920 lines | Match fixture generator & scheduler | Round-robin/knockout draw generation, match rescheduling, team pairing, venue & ground assignment |
| `/tournament/:id/score/:matchId` | `CricketMatchCenter` | `artifacts/auction-platform/src/pages/cricket/match-center.tsx` | 36 KB / 842 lines | Single match corporate command center | Ball-by-ball timeline review, official scorecard inspection, squads/playing XI, toss entry, scorecard PDF/print |
| `/tournament/:id/score/live-control` | `CricketLiveControl` | `artifacts/auction-platform/src/pages/cricket/live-control.tsx` | 24 KB / 590 lines | Broadcast & arena live ops controller | Live match queue selection, OBS lower-third trigger, scorebug layout selector, LED display switch |
| `/tournament/:id/score/teams` | `CricketTeams` | `artifacts/auction-platform/src/pages/cricket/teams.tsx` | 22 KB / 540 lines | Cricket tournament teams & squads | Team rosters, franchise association, captain/wicketkeeper designations |
| `/tournament/:id/score/players` | `CricketPlayers` | `artifacts/auction-platform/src/pages/cricket/players.tsx` | 26 KB / 630 lines | Tournament player pool & roles | Batting styles, bowling styles, squad assignments, player statistics |
| `/tournament/:id/score/standings` | `CricketStandings` | `artifacts/auction-platform/src/pages/cricket/standings.tsx` | 18 KB / 440 lines | Points tables & NRR calculator | Group/pool standings, Net Run Rate calculation review, manual points adjustments, tie-breakers |
| `/tournament/:id/score/stats` | `CricketStats` | `artifacts/auction-platform/src/pages/cricket/stats.tsx` | 20 KB / 490 lines | Leaderboards & player awards | Highest run scorers, top wicket takers, strike rates, economy rates, boundary counts |
| `/tournament/:id/score/officials` | `CricketOfficials` | `artifacts/auction-platform/src/pages/cricket/officials.tsx` | 16 KB / 390 lines | Match officials registry & assignments | On-field umpires, third umpires, match referees, official scorer credential assignment |
| `/tournament/:id/score/awards` | `CricketAwards` | `artifacts/auction-platform/src/pages/cricket/awards.tsx` | 14 KB / 340 lines | Post-match & tournament honors | Player of the Match, Batter of the Tournament, Bowler of the Tournament, presentation ceremony printouts |
| `/tournament/:id/score/reports` | `CricketReports` | `artifacts/auction-platform/src/pages/cricket/reports.tsx` | 18 KB / 440 lines | Formal audit reports & score sheets | Official match scorecards, signed referee match reports, tournament statistics ledger |
| `/tournament/:id/score/rules` | `CricketRules` | `artifacts/auction-platform/src/pages/cricket/rules.tsx` | 16 KB / 390 lines | Match rules & competition regulations | Overs per match, powerplay restrictions, bowler over limits, DLS regulations, super over rules |
| `/tournament/:id/score/settings` | `CricketSettings` | `artifacts/auction-platform/src/pages/cricket/settings.tsx` | 18 KB / 440 lines | Cricket operations settings | Audio/DJ music cues, boundary sound triggers, sponsor banner rotations for broadcast |
| `/tournament/:id/score/links` | `CricketLinks` | `artifacts/auction-platform/src/pages/cricket/links.tsx` | 14 KB / 330 lines | Cricket link dispatches | Links and QR codes for scorer pads, public fan match centers, OBS broadcast browser sources |
| `/tournament/:id/score/schedule` | `ScoringSchedule` | `artifacts/auction-platform/src/pages/scoring-schedule.tsx` | 22 KB / 530 lines | Master venue & ground timeline | Multi-ground timetable grid, match clash detector, umpire scheduling |

#### C. Badminton Organiser Scoring Management Surfaces
| Route (under `/scoring-app/`) | Page Component | Physical File Path | File Size / Lines | Operational Purpose | Key Workflows & Features |
|---|---|---|---|---|---|
| `/tournament/:id/badminton` | `BadmintonTournamentHub` | `artifacts/auction-platform/src/pages/badminton/tournament-hub.tsx` | 12 KB / 298 lines | Badminton operations hub | Court status summary, event category cards, quick links to court control and draws |
| `/tournament/:id/badminton/branding` | `BadmintonBrandingPage` | `artifacts/auction-platform/src/pages/badminton/branding.tsx` | 14 KB / 340 lines | Tournament visual identity & sponsors | Venue branding, court signage logos, broadcast sponsor bugs |
| `/tournament/:id/badminton/players` | `BadmintonPlayersPage` | `artifacts/auction-platform/src/pages/badminton/players.tsx` | 26 KB / 640 lines | Player registry & seeding | Player registration, national/state ranking seeds, doubles partner pairing |
| `/tournament/:id/badminton/categories` | `BadmintonCategoriesPage` | `artifacts/auction-platform/src/pages/badminton/categories.tsx` | 18 KB / 440 lines | Event categories & formats | Category setup (MS, WS, MD, WD, XD, Veterans), age brackets, draw sizes |
| `/tournament/:id/badminton/scoring-format` | `BadmintonScoringFormatPage` | `artifacts/auction-platform/src/pages/badminton/scoring-format.tsx` | 16 KB / 390 lines | BWF & custom scoring rules | Points per game (21 standard, 15/11 short), max points (30 deuce cap), number of games (best of 3/5) |
| `/tournament/:id/badminton/courts` | `BadmintonCourtsPage` | `artifacts/auction-platform/src/pages/badminton/courts.tsx` | 16 KB / 390 lines | Arena court management | Court creation, court names/numbers, court live streaming camera URLs, court active/inactive toggles |
| `/tournament/:id/badminton/scorers` | `BadmintonScorersPage` | `artifacts/auction-platform/src/pages/badminton/scorers.tsx` | 14 KB / 340 lines | Court scorer credentials & PINs | Scorer assignment per court, 4-digit PIN generation, active scorer device connection monitor |
| `/tournament/:id/badminton/fixtures` | `BadmintonFixturesPage` | `artifacts/auction-platform/src/pages/badminton/fixtures.tsx` | 32 KB / 780 lines | Tournament draw & bracket engine | Knockout draw trees (Single Elimination, Consolation), Round Robin groups, seeding placement |
| `/tournament/:id/badminton/schedule` | `BadmintonSchedulePage` | `artifacts/auction-platform/src/pages/badminton/schedule.tsx` | 24 KB / 580 lines | Multi-court match order of play | Court schedule timeline, "Next on Court" queue, estimated match duration sequencing |
| `/tournament/:id/badminton/matches` | `BadmintonMatchesPage` | `artifacts/auction-platform/src/pages/badminton/matches.tsx` | 28 KB / 690 lines | Master match register | Master match list, filtering by court/status/category, match rescheduling, walkover declaration |
| `/tournament/:id/badminton/matches/:matchId/control` | `BadmintonMatchControlPage` | `artifacts/auction-platform/src/pages/badminton/match-control.tsx` | 10 KB / 251 lines | Pre-match & match director console | Pre-match toss entry (server/receiver, court ends), warm-up clock, match unlock, live director override |
| `/tournament/:id/badminton/control` | `BadmintonControlCenterPage` | `artifacts/auction-platform/src/pages/badminton/control-center.tsx` | 32 KB / 761 lines | Live court supervisor command room | Real-time multi-court live monitor, active match cards, score alerts, quick scorer force-unlock |
| `/tournament/:id/badminton/results` | `BadmintonResultsPage` | `artifacts/auction-platform/src/pages/badminton/results.tsx` | 20 KB / 490 lines | Completed match score verification | Official game scores confirmation, match sign-off, disputed score reconciliation |
| `/tournament/:id/badminton/summary` | `BadmintonSummaryPage` | `artifacts/auction-platform/src/pages/badminton/summary.tsx` | 14 KB / 340 lines | Tournament closing report & podium | Gold/Silver/Bronze podium standings, medal tallies, tournament summary document generator |
| `/tournament/:id/badminton/analytics` | `BadmintonAnalyticsPage` | `artifacts/auction-platform/src/pages/badminton/analytics.tsx` | 18 KB / 440 lines | Match performance analytics | Rally length distributions, court turnaround times, game point conversions, unforced error charts |
| `/tournament/:id/badminton/broadcast` | `BadmintonBroadcastPage` | `artifacts/auction-platform/src/pages/badminton/broadcast.tsx` | 16 KB / 390 lines | Stream & overlay configuration | OBS lower thirds per court, live stream URL links, court scoreboard overlay layout controls |

---

## 3. Rigorous Evaluation Across the 8 Core UI/UX Dimensions

Evaluating the existing organiser experience across all 8 dimensions defined by the Universal Design System reveals specific strengths alongside critical structural friction points.

### 3.1 Visual Hierarchy
- **Typography Foundations:** Both applications define Inter as the primary sans font. However, `organizer-light-theme.css` uses heavy `!important` rules on `h1` (24px/700), `h2` (18px/700), `h3` (15px/600), and `h4` (13px/700 uppercase) that clash with Tailwind utility classes in component code (`text-2xl`, `text-3xl`).
- **Accent Color Saturation:** The platform uses BidWar brand gold (`#EAB308` / yellow-500). While excellent for broadcast branding, overusing bright yellow in data-heavy enterprise screens causes visual fatigue. In `organizer-portal.tsx`, tournament cards feature `.od-btn-gold` with bright gradients that compete with urgent status alerts.
- **Header Prominence & Scannability:** Tournament headers in `AppLayout` and `SportsShell` lack consistent metadata prioritization. Breadcrumbs are often omitted or styled too weakly, making deep navigation (e.g., jumping between Cricket Match Center and Mission Control) disorienting.

### 3.2 Layout & Spatial Rhythm
- **Dual Shell Fragmentation:**
  - `AppLayout` (`layout.tsx`): 56px collapsed width (icon-only), 256px expanded width. Uses a custom mobile drawer backdrop (`div` with `onClick`).
  - `SportsShell` (`sports-shell.tsx`): 64px collapsed width, 280px expanded width. Uses Radix `Sheet` for mobile navigation.
  - Toggling between auction and scoring causes noticeable layout shifts and resets sidebar state.
- **Spatial Alignment:** While internal elements generally respect 4px/8px multiples, outer page containers oscillate between unconstrained padding (`p-6`), `max-w-7xl mx-auto`, and `max-w-[1600px] mx-auto` (used in `control-center.tsx`), preventing consistent alignment of tables and cards across routes.

### 3.3 Information Density & Scannability
- **Monolithic Page Congestion:** In `organizer-portal.tsx` (2,719 lines), a single tournament card presents up to 8 distinct badges, two CTAs, venue details, auction dates, rule PDF status, and a kebab menu in a cramped space. The cognitive load on organizers scanning 20+ tournaments is excessive.
- **Table Row Ergonomics:** In `players.tsx` and `teams.tsx`, data tables lack standard compact/comfortable density toggles. Row padding varies between 12px and 20px, and lack of sticky headers on tall player lists causes organizers to lose column context during scrolling.
- **Data-to-Ink Ratio:** KPI summary cards (e.g., in `CricketDashboard` and `AuctionOverview`) include redundant decorative borders and gradients that reduce immediate numeric legibility.

### 3.4 Action Architecture & Intent
- **Destructive Action Friction:** In `CricketMatchCenter` (`match-center.tsx`), the "Delete Match" button (`Trash2`) was positioned directly adjacent to operational action buttons, creating high accidental-click risk during live match days. While protected by an `AlertDialog`, destructive triggers should be segregated into an explicit "Danger Zone" or overflow menu.
- **CTA Hierarchy Ambiguity:** On tournament cards in `organizer-portal.tsx`, the primary CTA frequently changes between "Auction Hub", "Mission Control", "Manage Tournament", and "Request License", with inconsistent button variants (primary vs outline vs gold gradient), obscuring the most common user path.
- **Form Submission Buttons:** Across forms in `tournament-settings.tsx`, the save bar uses debounced auto-save for some fields, while other sections require manual "Save Changes" clicks, causing user anxiety about whether updates were actually committed.

### 3.5 Navigation Architecture & Wayfinding
- **Collapsible Sidebar Inconsistency:**
  - `AppLayout` stores state in `localStorage.getItem("sidebar-collapsed")`.
  - `SportsShell` stores state in `localStorage.getItem("sports-shell-collapsed")`.
  - An organizer collapsing the sidebar in tournament settings finds it expanded again when opening Mission Control.
- **Deep-Link Breadcrumb Gaps:** Navigating to `/tournament/:id/score/:matchId` displays a minimal back arrow rather than an accessible breadcrumb trail (`Tournaments > [Tournament Name] > Cricket > Fixtures > Match #4`), hindering rapid context switching.

### 3.6 Feedback & System State Indicators
- **Notification Stack Divergence:** The codebase features mixed usage of `@/hooks/use-toast` (custom Radix toast hook), legacy alert banners, and inline DOM error spans. Certain errors (e.g., API mutation failures in `badminton-api.ts`) display raw error strings rather than user-friendly diagnostic guidance.
- **Loading State Discrepancy:** Certain tables display full-screen `Loader2` spinners that unmount table headers, causing layout jumping, whereas other panels use smooth `Skeleton` placeholders.
- **Empty States:** Empty states vary widely—some screens use rich illustrations with clear call-to-action buttons (`EmptyState` from `sports-page-chrome.tsx`), while others present raw text strings ("No teams found").

### 3.7 Responsiveness & Multi-Device Adaptation
- **Mobile Drawer Usability:** On mobile devices (<768px), `AppLayout` uses an ad-hoc backdrop `div` that occasionally traps touch events or fails to close on route navigation. `SportsShell` properly uses Radix `Sheet`. Standardizing on the Radix `Sheet` pattern across both shells resolves mobile wayfinding.
- **Data Table Overflow:** Large tables (e.g., 20-column player auction registries) lack horizontal scroll hints or pinned first columns on tablet viewports, making row inspection difficult on iPad and Android tablets.
- **Touch Target Padding:** Certain icon buttons in table action cells are sized at 32x32px, falling below the WCAG 2.2 Level AA requirement of 44x44px for reliable touch activation.

### 3.8 Accessibility & WCAG 2.2 Level AA Compliance
- **Text & Non-Text Contrast:**
  - `organizer-light-theme.css` successfully maps `--org-foreground: #0F172A` (15:1 contrast on white canvas) and `--org-muted-foreground: #475569` (5.7:1 contrast on white, exceeding the 4.5:1 AA requirement).
  - However, placeholder text using `#64748B` (Slate-500) achieves 4.5:1 on pure white, but drops below 3.5:1 when rendered inside light gray input backgrounds (`#F1F5F9`).
- **Focus Rings & Keyboard Navigation:** In `sports-page-chrome.tsx`, custom primitives (`DarkSelect`, `FormModal`) do not consistently apply visible 2px focus rings (`--org-focus-ring: 0 0 0 2px #FFFFFF, 0 0 0 4px #EAB308`), impeding keyboard-only navigation.
- **Modal Dialog Semantics:** The custom `FormModal` in `sports-page-chrome.tsx` implements raw DOM portals with manual `aria-modal="true"`, but lacks proper WAI-ARIA focus trapping (Tab key cycles into background content) and proper screen-reader announcements upon open/close.

---

## 4. Prioritized Improvement Matrix (P0, P1, P2)

Findings are prioritized based on operational impact during live tournaments, user workflow efficiency, and architectural integrity.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRIORITIZATION FRAMEWORK                        │
├──────────┬─────────────────────────────────────────────────────────────┤
│ P0 (Top) │ Critical Usability Blockers, Surface Isolation, Key Collisions│
│ P1 (Mid) │ Major Workflow Enhancements, Monolithic File Deconstruction │
│ P2 (Low) │ Refinement, Polish, Spacing Rhythm, Micro-interactions      │
└──────────┴─────────────────────────────────────────────────────────────┘
```

| Issue ID | Priority | Category | Affected Surfaces & Files | Root Cause / Diagnosis | Universal Design System Remedy | Acceptance Criteria |
|---|---|---|---|---|---|---|
| **AUD-P0-01** | **P0** | **Surface Isolation** | `cricket/scorer.tsx`<br>`badminton/scorer.tsx`<br>`cricket/scorer-home.tsx`<br>`badminton/scorer-home.tsx` | Risk of accidental CSS leakage or component sharing altering zero-scroll, high-contrast touch layouts on live scorer pads. | Enforce strict file quarantining: 0 modifications to scorer pad files. Maintain `!isOrganizerRoute` check in `portal-theme.ts`. | Live scorer pad routes render dark broadcast canvas; zero regression in ball-by-ball / rally scoring. |
| **AUD-P0-02** | **P0** | **Navigation Shell** | `artifacts/auction-platform/src/components/layout.tsx`<br>`artifacts/auction-platform/src/components/sports-shell/sports-shell.tsx` | Divergent navigation shells: mismatched collapsed widths (56px vs 64px), storage key collision (`sidebar-collapsed` vs `sports-shell-collapsed`), raw DOM drawer vs Radix Sheet. | Unify into a single cohesive Organiser Navigation Shell architecture. Standardize sidebar widths (64px collapsed, 256px expanded), unified storage key (`bw-organizer-sidebar-collapsed`), and Radix `Sheet` for mobile. | Seamless transition between Auction and Scoring workspaces with zero layout shift; persistent sidebar collapse state. |
| **AUD-P0-03** | **P0** | **Token Architecture** | `artifacts/auction-platform/src/styles/organizer-light-theme.css`<br>`artifacts/auction-platform/src/styles/organizer-dashboard-premium.css` | 914 lines of CSS using brute-force `!important` to override dark broadcast tokens. Breeds specificity wars and prevents component-level customization. | Refactor token architecture into clean CSS variables under `:is(.bw-organizer-light, [data-surface="organizer"])`. Replace `!important` declarations with CSS cascade layers and standard Tailwind v4 theme bindings. | All organiser panels inherit light enterprise tokens cleanly without `!important` bloat; zero style leakage to protected surfaces. |
| **AUD-P0-04** | **P0** | **Accessibility / Modals** | `artifacts/auction-platform/src/components/sports-ui/sports-page-chrome.tsx` (`FormModal`) | `FormModal` uses raw React portals with manual DOM manipulation, lacking focus-trap management and accessible dialog descriptions. | Replace `FormModal` with standard Radix `Dialog` (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`) styled with UDS enterprise tokens. | Full WAI-ARIA dialog compliance: keyboard focus trapping, Esc key dismissal, accessible naming, screen reader announcements. |
| **AUD-P1-01** | **P1** | **Monolithic Page** | `artifacts/auction-platform/src/pages/organizer-portal.tsx` (2,719 lines) | Monolithic file mixing auth, OTP modals, tournament creation wizards, license requests, and tournament list rendering. | Decompose into modular components: `OrganizerTournamentCard`, `OrganizerAuthCard`, `OrganizerFilterBar`, `OrganizerLicenseModal`. | Main page file reduced below 500 lines; improved maintainability, scannability, and component testability. |
| **AUD-P1-02** | **P1** | **Monolithic Settings** | `artifacts/auction-platform/src/pages/tournament-settings.tsx` (2,660 lines) | Massive single file housing 5 distinct configuration domains with divergent auto-save vs manual save paradigms. | Extract tab panels into self-contained sub-modules (`SettingsBasicsTab`, `SettingsAuctionTab`, `SettingsRegistrationTab`, `SettingsMediaTab`, `SettingsDangerZoneTab`). Standardize save feedback. | Clean tab separation with isolated validation, explicit save feedback bar, and consistent form state management. |
| **AUD-P1-03** | **P1** | **Operational Workflow** | `artifacts/auction-platform/src/pages/cricket/match-center.tsx` (842 lines) | Destructive action ("Delete Match") placed beside operational actions. Mixed action hierarchy (Toss, Live Control, Scorecard, Share). | Reorganize Match Center into three distinct operational zones: 1. Pre-Match Setup (Toss, Squads); 2. Live Supervision (Scorer link, Live Control); 3. Post-Match Finalisation & Reports. | Clear operational visual hierarchy; destructive actions isolated in danger zone with confirmation friction. |
| **AUD-P1-04** | **P1** | **Court Operations** | `artifacts/auction-platform/src/pages/badminton/match-control.tsx`<br>`artifacts/auction-platform/src/pages/badminton/control-center.tsx` | Dense information display lacks clear court prioritization during active tournament sessions; action buttons lack prominent status indicators. | Implement structured Court Operations Cards with clear status badges (Warm-up, Live, On-Hold, Completed), high-contrast court numbers, and prominent supervisor action buttons. | Court supervisor can scan 8+ courts simultaneously and trigger pre-match toss or force-unlock in under 2 clicks. |
| **AUD-P1-05** | **P1** | **Component Duplication** | `artifacts/auction-platform/src/components/sports-ui/sports-page-chrome.tsx` | Duplicate UI primitives (`DarkSelect`, `BtnPrimary`, `BtnSecondary`, `inputClass`) built separately from Radix shadcn primitives. | Retire duplicate primitives in favor of standard Radix `Select`, `Button` (with variants: `default`, `outline`, `destructive`, `ghost`), and `Input`. | Unified component library across all organiser panels, reducing bundle size and ensuring consistent interaction states. |
| **AUD-P1-06** | **P1** | **Card Clutter** | `artifacts/auction-platform/src/pages/organizer-portal.tsx` | Tournament cards overloaded with up to 8 competing badges and ad-hoc CSS classes (`.od-stat-card`, `.od-btn-gold`). | Modernize tournament cards using UDS card pattern: crisp surface elevation, single primary action ("Manage Tournament" or "Enter Hub"), secondary kebab menu for sub-routes, clear metadata badges. | Clean visual hierarchy; tournament cards scan effortlessly with unambiguous primary interaction target. |
| **AUD-P1-07** | **P1** | **Feedback States** | Across all organiser panels (`teams.tsx`, `players.tsx`, `fixtures.tsx`) | Inconsistent loading and empty states: raw spinners unmount table headers; empty states lack actionable triggers. | Standardize on Radix `Skeleton` loaders matching table geometry; deploy unified `EmptyState` component with clear guidance and primary CTA. | Zero layout jumping during data fetches; empty tables guide organizers to immediate next action (e.g., "Add First Team"). |
| **AUD-P2-01** | **P2** | **Data Tables** | `artifacts/auction-platform/src/pages/players.tsx`<br>`artifacts/auction-platform/src/pages/teams.tsx` | Inconsistent table row padding, lack of sticky headers on tall lists, lack of numeric alignment (`tabular-nums`). | Standardize table architecture using Radix `Table` primitives with sticky headers, 48px comfortable row heights, and right-aligned numeric data. | Financial and statistical data easily scannable; sticky headers maintain context during multi-page scrolling. |
| **AUD-P2-02** | **P2** | **Form Controls** | `artifacts/auction-platform/src/pages/tournament-settings.tsx`<br>`artifacts/auction-platform/src/pages/cricket/rules.tsx` | Varying form input heights (38px to 44px), inconsistent border focus rings, ambiguous required field markers. | Standardize form inputs to 44px touch-accessible height, crisp `--org-border` (`#CBD5E1`), 2px brand focus rings, and explicit accessible labels (`<Label>`). | Form inputs adhere to 44px touch targets; consistent focus indication; full keyboard tab accessibility. |
| **AUD-P2-03** | **P2** | **Toast Notifications** | Across all organiser and scoring pages | Fragmentation between `@/hooks/use-toast`, inline alert boxes, and raw console errors. | Unify toast dispatches under a single accessible toast system with distinct semantic variants (`default`, `success`, `destructive`, `warning`). | Consistent toast notifications with accessible ARIA live-region announcements. |
| **AUD-P2-04** | **P2** | **Micro-interactions** | Across all buttons and interactive controls | Inconsistent button loading states (some disable silently, others show spinners without disabling clicks). | Implement unified button loading state pattern: disable pointer events, show integrated `Loader2` spinner, maintain button dimensions to prevent layout shifts. | Organizers receive immediate visual feedback on async operations with zero double-submission errors. |
| **AUD-P2-05** | **P2** | **Typography Scale** | Across dashboard cards and table metrics | Numeric values vary between standard serif, sans, and display fonts without monospace alignment. | Apply `font-mono tabular-nums` to all scores, financial purses, timers, and statistics to ensure clean vertical alignment. | Numeric data columns align perfectly; timers and live scores update without horizontal text jitter. |

---

## 5. Strict Boundary Specification (Protected Surfaces Quarantine)

To safeguard production integrity, live tournament operations, and broadcast deliverables, the following surfaces are explicitly classified as **PROTECTED SURFACES** and are strictly quarantined from all UI/UX modifications.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PROTECTED SURFACES QUARANTINE                     │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 1. Live Scorer Pads              │ /cricket/:matchId/score             │
│                                  │ /badminton/:matchId/score           │
│                                  │ /cricket/scorer, /badminton/scorer  │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 2. Broadcast OBS Overlays        │ /obs/*, /tournament/:id/obs/*       │
│                                  │ /badminton/:matchId/overlay         │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 3. LED Arena & Hall Displays     │ /tournament/:id/display             │
│                                  │ /side-display, /score-display       │
│                                  │ /badminton/:matchId/display         │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 4. Team Owner Bidding App        │ artifacts/owner-app/ (/owner-app/*) │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 5. Public Marketing & Fan Pages  │ /, /fan/*, /fanpage/*, /bpl/*       │
│                                  │ /pricing, /contact, /legal/*        │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 6. Live Auction Operator Room    │ /tournament/:id/auction             │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### 5.1 Quarantined Surfaces & Technical Rationale

#### 1. Live Scorer Pads
- **Target Files:**
  - `artifacts/auction-platform/src/pages/cricket/scorer.tsx` (51,243 bytes)
  - `artifacts/auction-platform/src/pages/badminton/scorer.tsx` (33,143 bytes)
  - `artifacts/auction-platform/src/pages/cricket/scorer-home.tsx`
  - `artifacts/auction-platform/src/pages/badminton/scorer-home.tsx`
- **Technical Rationale:** Live scorer pads are mission-critical, zero-scroll touch consoles operated under high cognitive pressure in intense stadium environments. They feature specialized high-contrast dark canvases, canvas-based wagon-wheel coordinates, custom virtual number pads, immediate single-tap action dispatchers, undo stacks, and direct WebSocket connections to calculation engines. Modifying styles, margins, or components in these files risks introducing scrolling, layout shifts, or touch mis-clicks during live matches.

#### 2. Broadcast OBS Scenes & Overlays
- **Target Files:**
  - `artifacts/auction-platform/src/pages/obs/*`
  - `artifacts/auction-platform/src/pages/badminton/overlay.tsx`
  - All broadcast lower-third, scorebug, and wedding auction overlay templates.
- **Technical Rationale:** Broadcast overlays are consumed as transparent browser sources inside OBS Studio, vMix, and hardware vision mixers at fixed 1920x1080 or 3840x2160 resolutions. They require chroma-key alpha channels, hardware-accelerated animations, zero DOM borders, and strict broadcast safe-zone compliance (EBU R95). Light theme tokens or responsive modifications would render broadcast feeds opaque and destroy live streaming productions.

#### 3. LED Arena & Hall Displays
- **Target Files:**
  - `artifacts/auction-platform/src/pages/display.tsx`
  - `artifacts/auction-platform/src/pages/side-display.tsx`
  - `artifacts/auction-platform/src/pages/score-display.tsx`
  - `artifacts/auction-platform/src/pages/badminton/display.tsx`
- **Target Rationale:** Arena displays are projected onto physical LED video walls and high-pitch indoor panels (P2.5/P3.91). They depend on absolute contrast ratios, ultra-dense high-legibility typography visible from 50+ meters, and dark background energy conservation to prevent panel overheating. They must never receive light-theme styling.

#### 4. Team Owner Bidding App
- **Target Files:**
  - `artifacts/owner-app/` (`/owner-app/*`)
- **Technical Rationale:** The Owner App is an isolated mobile web application designed exclusively for team owners sitting in the auction hall. It has an independent Vite configuration, port (`:5174`), real-time socket bid submission engine, purse validation, and haptic feedback loops. It is outside the organiser panel scope.

#### 5. Public Marketing & Fan Pages
- **Target Files:**
  - Public home (`artifacts/auction-platform/src/pages/lovable-home.tsx`), `/pricing`, `/contact`, `/legal/*`, `/bpl/*`, SEO sport landing pages.
  - Public fan pages (`artifacts/auction-platform/src/pages/unified-fan-page.tsx`, `artifacts/fan-platform/`).
- **Technical Rationale:** Public and fan surfaces feature dynamic marketing animations, public sponsor showcases, and fan engagement widgets governed by brand marketing requirements. Organiser workspace redesigns must not touch public-facing conversion funnels.

#### 6. Live Auction Operator Room
- **Target Files:**
  - `artifacts/auction-platform/src/pages/auction-operator.tsx` (`/tournament/:id/auction`)
- **Technical Rationale:** While operated by organisers, the Auction Operator Console is the real-time live bidding hall cockpit featuring audio SFX synthesis (`AuctionAudioManager`), full-screen projector sync, rapid keyboard hotkeys (Space for bid, Enter for sold), and dark stage visibility. It is explicitly quarantined as a broadcast-grade operational tool.

### 5.2 Technical Quarantine Enforcement Mechanisms
Isolation is enforced across three architectural layers:
1. **Dynamic Theme Routing Guard:** `artifacts/auction-platform/src/lib/portal-theme.ts` evaluates every navigation event via `isOrganizerRoute(pathname)`. Any route matching protected patterns returns `false`, guaranteeing that `.bw-organizer-light` and `[data-surface="organizer"]` are never attached to document or portal roots.
2. **CSS Token Scoping:** All light enterprise variables and rules are scoped strictly under `:is(.bw-organizer-light, [data-surface="organizer"])`. Unscoped global tags are forbidden.
3. **Automated Domain Boundary Enforcement:** The CI validation script `node scripts/check-domain-boundaries.mjs` verifies that auction and scoring packages maintain modular isolation with zero unauthorized cross-boundary dependencies.

---

## 6. Implementation Architecture & Roadmap for Milestones 3 & 4

The modernization will be executed across two dedicated engineering milestones: **Milestone 3 (Organiser Panels Modernisation)** and **Milestone 4 (Organiser Scoring Panels Modernisation)**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION ROADMAP                         │
├────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 3: ORGANISER PANELS (Requirement R3)                        │
│ ├─ Phase 3.1: Unified Navigation Shell & Layout Consolidation          │
│ ├─ Phase 3.2: Organiser Portal & Tournament Cards Modernisation       │
│ └─ Phase 3.3: Tournament Management & Configuration Surfaces           │
├────────────────────────────────────────────────────────────────────────┤
│ MILESTONE 4: ORGANISER SCORING PANELS (Requirement R4)                 │
│ ├─ Phase 4.1: Sports Mission Control & Operational Dashboards         │
│ ├─ Phase 4.2: Fixtures, Schedule & Match Center Modernisation         │
│ ├─ Phase 4.3: Match Control, Director Panels & Result Finalisation     │
│ └─ Phase 4.4: Decommissioning of Duplicate Chrome Primitives           │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Milestone 3: Organiser Panels Modernisation (Requirement R3)

#### Phase 3.1: Unified Navigation Shell & Layout Consolidation
- **Objective:** Eliminate dual-shell divergence between `AppLayout` and `SportsShell`.
- **Implementation Tasks:**
  1. Standardize sidebar metrics: 64px width collapsed (icon-only with tooltip), 256px width expanded.
  2. Unify persistence state under a single `localStorage` key: `bw-organizer-sidebar-collapsed`.
  3. Replace the raw DOM mobile drawer in `AppLayout` with the accessible Radix `Sheet` component from `@/components/ui/sheet`.
  4. Build a unified `OrganizerHeaderBar` incorporating tournament breadcrumbs, module status indicators (Auction / Scoring badges), trial license status, and accessible user profile dropdown.
  5. Refactor `organizer-light-theme.css` to eliminate unnecessary `!important` declarations, establishing clean CSS variable mappings for `--background`, `--card`, `--border`, `--foreground`, `--primary`.

#### Phase 3.2: Organiser Portal & Tournament Cards Modernisation
- **Objective:** Deconstruct `organizer-portal.tsx` (2,719 lines) into modular, accessible components.
- **Implementation Tasks:**
  1. Extract `OrganizerTournamentCard` into a dedicated component with clear visual hierarchy:
     - Top row: Sport icon/emoji, tournament name, location badge, status badge.
     - Middle row: Key event dates (auction dates, match dates), team counts, license tier.
     - Bottom row: Primary CTA ("Manage Tournament" or "Enter Hub") + secondary dropdown menu for direct sub-route jumps.
  2. Extract `OrganizerFilterBar` with responsive search, sport category chips, and status filters.
  3. Modularize auth and license modals (`OrganizerAuthDialog`, `LicenseUpgradeDialog`).

#### Phase 3.3: Tournament Management & Configuration Surfaces
- **Objective:** Modernize tournament configuration, team franchises, players, and categories.
- **Implementation Tasks:**
  1. Deconstruct `tournament-settings.tsx` (2,660 lines) into tabbed sub-modules:
     - `SettingsBasicsTab`: Name, dates, sport, venue autocomplete, contact.
     - `SettingsAuctionTab`: Base purse, bid increments, timer settings, sound cues.
     - `SettingsRegistrationTab`: Public registration toggles, form fields, declarations.
     - `SettingsMediaTab`: Logos, sponsor banners, media normalization.
     - `SettingsDangerZoneTab`: Reset trial data, archive tournament, delete.
  2. Standardize `Teams` (`teams.tsx`) and `Players` (`players.tsx`) tables with Radix `Table`, sticky headers, 48px comfortable row heights, and accessible bulk action bars.
  3. Standardize all form inputs to 44px touch-accessible height with unified focus rings (`--org-focus-ring`).

---

### 6.2 Milestone 4: Organiser Scoring Panels Modernisation (Requirement R4)

#### Phase 4.1: Sports Mission Control & Operational Dashboards
- **Objective:** Modernize tournament-day landing hubs for Cricket and Badminton.
- **Implementation Tasks:**
  1. Refactor `SportsMissionControlPage` (`sports/mission-control.tsx`) into a high-clarity command center:
     - Module health strip showing setup readiness and live match counts.
     - Clear navigation cards directing organizers to Fixtures, Live Control, and Officials.
  2. Modernize `CricketDashboard` (`cricket/dashboard.tsx`):
     - Active matches carousel with live score summaries and direct links to Match Center.
     - Points table widget with draw/pool tabs.
  3. Modernize `BadmintonTournamentHub` (`badminton/tournament-hub.tsx`):
     - Court status grid showing active games, players on court, and match durations.

#### Phase 4.2: Fixtures, Schedule & Match Center Restructuring
- **Objective:** Modernize match organization, timetable allocation, and match oversight.
- **Implementation Tasks:**
  1. Modernize `CricketFixtures` (`cricket/fixtures.tsx`) and `BadmintonFixturesPage` (`badminton/fixtures.tsx`):
     - Drag-and-drop or streamlined dropdown match rescheduling.
     - Accessible draw bracket visualization with responsive overflow handling.
  2. Restructure `CricketMatchCenter` (`cricket/match-center.tsx`, 842 lines) into three structured operational zones:
     - **Zone 1: Pre-Match Setup:** Toss winner, decision (bat/bowl), team playing XI, assigned umpires.
     - **Zone 2: Live Supervision:** Direct link to Live Scorer Console (with copyable PIN), live ball-by-ball timeline stream, live scorecard preview, broadcast OBS scorebug triggers.
     - **Zone 3: Post-Match Finalisation & Reports:** Result verification, Player of the Match designation, match sign-off, official PDF scorecard printout.
     - Move "Delete Match" to a dedicated confirmation modal inside an isolated overflow menu.

#### Phase 4.3: Match Control, Director Panels & Result Finalisation
- **Objective:** Enhance live tournament supervision without touching live scorer pads.
- **Implementation Tasks:**
  1. Modernize `BadmintonMatchControlPage` (`badminton/match-control.tsx`):
     - Pre-match toss console (serve/receive, court ends) with prominent visual confirmation.
     - Scorer connection status indicator with one-click "Unlock Scorer" emergency override.
  2. Modernize `BadmintonControlCenterPage` (`badminton/control-center.tsx`, 761 lines):
     - High-density multi-court grid displaying live rally scores and court turnaround clocks.
     - Ops rail prioritizing courts requiring director attention (e.g., disputed scores, walkover requests).
  3. Modernize `BadmintonResultsPage` and `CricketReports`:
     - Clean tabular verification of completed scores with digital sign-off and export options.

#### Phase 4.4: Decommissioning of Duplicate Chrome Primitives
- **Objective:** Retire redundant primitives in `sports-page-chrome.tsx` and consolidate on Radix / UDS.
- **Implementation Tasks:**
  1. Replace `FormModal` with standard Radix `Dialog` across all scoring pages.
  2. Replace `DarkSelect` with standard Radix `Select`.
  3. Replace `BtnPrimary` and `BtnSecondary` with standard UDS `Button` component variants.
  4. Migrate `hubCardClass` and `hubPanelClass` to standard Tailwind enterprise utility classes (`bg-card border border-border shadow-sm rounded-xl`).

---

### 6.3 Token Architecture & CSS Refactoring Specification

To resolve the 914-line `!important` specificity warfare in `organizer-light-theme.css`, the token architecture will be restructured as follows:

```css
/* Canonical UDS Token Cascade for BidWar Organiser Surfaces */
:is(.bw-organizer-light, [data-surface="organizer"]) {
  color-scheme: light;

  /* Canvas & Surfaces */
  --background: 210 40% 96.1%;         /* #F1F5F9 Slate-100 canvas */
  --foreground: 222.2 84% 4.9%;        /* #0F172A Slate-900 high contrast */
  --card: 0 0% 100%;                   /* #FFFFFF Pure white cards */
  --card-foreground: 222.2 84% 4.9%;   /* #0F172A */
  --popover: 0 0% 100%;                /* #FFFFFF Menus & dialogs */
  --popover-foreground: 222.2 84% 4.9%;/* #0F172A */

  /* Brand Primary & Accents */
  --primary: 45 93% 47%;               /* #EAB308 Brand Yellow-500 */
  --primary-foreground: 222.2 84% 4.9%;/* #0F172A AAA contrast on gold */
  --secondary: 210 40% 96.1%;          /* #F1F5F9 Slate-100 */
  --secondary-foreground: 215.4 16.3% 46.9%; /* #334155 Slate-700 */

  /* Neutral Typography & Borders */
  --muted: 210 40% 96.1%;              /* #F1F5F9 */
  --muted-foreground: 215.4 16.3% 36%; /* #475569 Slate-600 (5.7:1 WCAG AA) */
  --border: 214.3 31.8% 80%;           /* #CBD5E1 Slate-300 crisp borders */
  --input: 214.3 31.8% 80%;            /* #CBD5E1 */
  --ring: 45 93% 47%;                  /* #EAB308 Brand Focus Ring */

  /* Semantic Feedback Tokens */
  --success: 158 84% 31%;              /* #059669 Emerald-600 */
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;               /* #D97706 Amber-600 */
  --warning-foreground: 0 0% 100%;
  --destructive: 0 84.2% 60.2%;        /* #DC2626 Red-600 */
  --destructive-foreground: 0 0% 100%;

  /* Navigation Sidebar Tokens */
  --sidebar: 0 0% 100%;
  --sidebar-foreground: 222.2 84% 4.9%;
  --sidebar-border: 214.3 31.8% 80%;
  --sidebar-active: 48 96% 89%;        /* #FEF3C7 Brand Amber-100 */
  --sidebar-active-text: 28 80% 32%;   /* #92400E Amber-900 */
}
```

---

## 7. Quality Assurance, Verification Protocol & Invalidation Conditions

Every phase of implementation under Milestones 3 & 4 must undergo rigorous verification before being marked complete.

### 7.1 Automated Verification Commands
```powershell
# 1. Verify Modular Domain Boundaries
node scripts/check-domain-boundaries.mjs
# Expected Output: Domain boundaries OK.

# 2. Verify TypeScript Compilation across all 22 Monorepo Libraries
pnpm run typecheck:libs
# Expected Output: Exits 0 with 0 errors across lib/* packages.

# 3. Verify Scoring Calculation Core Engines
pnpm --filter @workspace/scoring-core test
pnpm --filter @workspace/badminton-core test
pnpm --filter @workspace/platform-core test
# Expected Output: All tests pass (including 205 BWF sequences and DLS/scorecard projections).

# 4. Verify Auction Platform Vitest Suite
pnpm --filter @workspace/auction-platform test
# Expected Output: 96+ test files pass, verifying tournament routes and organizer guards.
```

### 7.2 Manual & Accessibility Quality Gates
1. **Protected Surface Visual Spot-Check:** Verify `/cricket/:matchId/score` and `/badminton/:matchId/score` render with high-contrast dark broadcast styling, zero scroll bars, and intact touch keypad responsiveness.
2. **WCAG 2.2 Level AA Contrast Audit:** Verify all text elements meet 4.5:1 contrast against their rendered background; all borders and focus indicators meet 3:1 contrast.
3. **Keyboard Wayfinding Audit:** Verify that all modal dialogs trap focus, all table actions can be triggered via keyboard (Tab, Enter, Space), and pressing `Escape` dismisses open dialogs and sheets.
4. **Touch Target Sizing:** Verify all interactive buttons, tabs, and form controls have a minimum bounding box of 44x44px.

### 7.3 Invalidation Conditions
An implementation pull request or milestone deliverable will be immediately rejected if:
- Any file in `cricket/scorer.tsx`, `badminton/scorer.tsx`, `cricket/scorer-home.tsx`, or `badminton/scorer-home.tsx` is modified.
- Any calculation logic in `lib/scoring-core` or `lib/badminton-core` is altered.
- `node scripts/check-domain-boundaries.mjs` fails due to unauthorized cross-module imports.
- `pnpm run typecheck:libs` reports TypeScript compilation errors.
- Any protected surface (OBS, LED, Fan, Owner App) displays light theme styles or layout regressions.

---

## 8. Summary & Next Steps

This master audit and modernization plan establishes the comprehensive technical and design roadmap for upgrading BidWar's Organiser and Organiser Scoring management panels to professional enterprise quality.

By unifying the navigation shell, eliminating brute-force CSS overrides, deconstructing monolithic pages into modular components, retiring redundant primitives, and strictly quarantining live operational surfaces, Milestones 3 & 4 will deliver an accessible, cohesive, high-performance management workspace that empowers tournament organisers under live event conditions.
