# Comprehensive Audit & Engineering Report: Tournament Licensing & Dual Lifecycle Architecture

> **Context:** Audit of the Super Admin Tournament Detail Page (`/admin/tournaments/:id`) for **BIDWAR PREMIER LEAGUE - KIDS EDITION** (Tournament #40) and platform-wide licensing/lifecycle architecture.
> **Engineering Contract:** Evaluated against [Permanent Architecture Skill](file:///c:/Users/win%2010/updatedbidwarcore/.agents/skills/bidwar_architecture_skill/SKILL.md) (§1, §2, §7, §8, §12, §13, §14, §16, §22, §28, §38).

---

## 1. Executive Summary & Problem Formulation

### The User Dilemma
In BidWar's early days, the platform was solely built for **Live Player Auctions**. Consequently, the database schema, licensing rules, admin controls, reset buttons, and lifecycle transitions were 100% auction-centric:
- "Trial License" meant auction trial limits (e.g. 20 players, 2 teams).
- "Live License" meant full auction bidding access.
- "Completed" meant the auction gavel had fallen.
- "Reset" meant clearing bids and restoring player purse balances.

Later, BidWar introduced **Sports Scoring** (live cricket ball-by-ball scoring and badminton tournament brackets/matches). While tournament creation was updated to allow organizers to select product modules (`auction_only`, `scoring_only`, `both`), **the Super Admin Tournament Detail page (`/admin/tournaments/:id`) was never properly refactored to support this dual architecture**.

```
                           CURRENT MISALIGNMENT
┌────────────────────────────────────────────────────────────────────────┐
│ Super Admin Console (/admin/tournaments/40)                           │
│                                                                        │
│ ❌ Assumes EVERY tournament is an Auction tournament                   │
│ ❌ Shows "Auction Licence & Lifecycle" even if Scoring Only           │
│ ❌ Shows Base Purse (₹1 Cr), Bid Events (0), Bid Log Tab               │
│ ❌ No Sports Scoring License state (Trial vs Live)                    │
│ ❌ No Sports Scoring Lifecycle controls (Mark Scoring Live/Completed)  │
│ ❌ Match scoring is reduced to an off-hand toggle under "Runtime Modes"│
│ ❌ Clicking "End Auction" marks the ENTIRE TOURNAMENT as "completed",  │
│    locking the tournament and breaking live match scoring on Day 2/3!  │
└────────────────────────────────────────────────────────────────────────┘
```

![Admin Tournament 40 Current Screenshot](file:///C:/Users/win%2010/.gemini/antigravity/brain/97ef572b-334a-4835-a2a5-5b96cc640a38/.user_uploaded/media_1793173676922_81211c8d.png)

---

## 2. Historical Context & How the Debt Accumulated

### Phase 1: Pure Auction Engine (The Heritage)
- **Model:** `tournaments.status` (`setup`, `active`, `paused`, `completed`), `tournaments.licenseStatus` (`trial`, `active`, `completed`), `tournaments.adminLocked` (`boolean`).
- **Control Center:** An admin locked or unlocked auctions, wiped demo records via `commitAdminLicenseTransition`, and triggered emergency resets via `/tournaments/:id/auction/reset-trial`.

### Phase 2: Sports Scoring Module Added
- Schema expanded in [`lib/db/src/schema/tournaments.ts`](file:///c:/Users/win%2010/updatedbidwarcore/lib/db/src/schema/tournaments.ts#L135-L148):
  - `auctionEnabled: boolean` (default true)
  - `scoringEnabled: boolean` (default false)
  - `scoringPhase: text` (`disabled`, `active`, `completed`)
- Organizer creation wizard added in [`tournament-creation-wizard.tsx`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/auction-platform/src/components/tournament-creation/tournament-creation-wizard.tsx#L130-L145):
  - Module choices: `auction_only`, `scoring_only`, `both`.
- Organizer license request modal added in [`request-tournament-license-modal.tsx`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/auction-platform/src/components/request-tournament-license-modal.tsx#L147-L200):
  - Organizer can request: `both` (Auction + Scoring), `auction` (Auction Only), or `scoring` (Scoring Only).
- Schema table added in [`tournament_license_requests.ts`](file:///c:/Users/win%2010/updatedbidwarcore/lib/db/src/schema/tournament_license_requests.ts#L17-L28):
  - `requestedModules: 'auction' | 'scoring' | 'both'`

### The Architectural Gap
Despite Phase 2's backend schema additions:
1. The **Admin Console detail page** ([`admin-tournament-detail.tsx`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/auction-platform/src/pages/admin-tournament-detail.tsx)) was built assuming `auction` is the only product.
2. The **Admin Detail API** ([`artifacts/api-server/src/routes/auth.ts#L782`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L782)) omitted `auctionEnabled`, `scoringPhase`, `productMode`, and `requestedModules`.
3. The **Admin Mutation Endpoints** ([`set-license-status`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L2546) and [`lock`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L734)) still execute auction-only business logic:
   - When granting a license, it triggers auction demo data cleanup.
   - When locking or ending an auction, it forces `tournaments.status = 'completed'` and `tournaments.adminLocked = true`.

---

## 3. Detailed Audit of the Current Page (`/admin/tournaments/:id`)

### 3.1 Header & Identity Strip
| Current Element | Current Behavior | The Issue / Architectural Flaw |
| :--- | :--- | :--- |
| **Sport Badge** (`CRICKET`) | Shows sport name. | Sport is correct, but doesn't indicate which modules are enabled for this sport. |
| **Status Badge** (`draw_ready`) | Shows `t.status`. | `draw_ready` is a competition progression stage, but the user doesn't know whether this applies to auction, fixtures, or matches. |
| **License Badge** (`Live License`) | Reads `t.licenseStatus === "active"`. | Ambiguous: Is this an **Auction Live License**, a **Scoring Live License**, or **Both**? |
| **KPI Metrics** | `Players (136)`, `Teams (17)`, `Base Purse (₹1 Cr)`, `Bid Events (0)`. | Strictly auction financial metrics. For a `scoring_only` tournament, Base Purse and Bid Events are meaningless. For a `both` tournament, match counts and fixture readiness are completely missing. |

### 3.2 Navigation Bar
| Tab | Current Behavior | The Issue |
| :--- | :--- | :--- |
| **Overview & Controls** | Shows 3-card control center. | Hardcoded to auction; sports scoring is buried. |
| **Players (136)** | Shows player list with sold/unsold status. | Auction-centric columns (base price, sold price, auction category). Doesn't show player match availability or sport profile. |
| **Teams (17)** | Shows team purse and purse used. | Auction-centric. For sports scoring, matches played, points table, and fixtures are missing. |
| **Bid Log (0)** | Shows auction bid history. | Irrelevant if `auctionEnabled === false`. |
| **Live Auction Monitor** | Dedicated button in nav bar. | Completely missing a **Live Match / Scoring Monitor** for cricket or badminton! |
| **Connected Endpoints** | Shows viewer / LED display connections. | Only covers auction screens (LED, Owner app, Auction viewer). Missing Scorer Console, Public Match Scorecard, OBS Cricket overlay. |

### 3.3 The Mission Control Cards (Core of the Bug)

```
CURRENT 3-CARD ADMIN LAYOUT:
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│ Card 1: AUCTION LICENCE │  │ Card 2: RUNTIME MODES   │  │ Card 3: EMERGENCY ZONE  │
│ & LIFECYCLE             │  │ & ENGINES               │  │                         │
│ Mode: Trial / Live /    │  │ • Operator: Cloud/Local │  │ • Reset Auction Data    │
│       Completed         │  │ • Match Scoring:        │  │ • Delete Tournament     │
│ [Switch to Trial]       │  │   [Enabled/Disabled]    │  │                         │
│ [End auction]           │  │                         │  │                         │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

#### Card 1: AUCTION LICENCE & LIFECYCLE
- **Strictly Auction:** Card header is literally `"Auction Licence & Lifecycle"`.
- **Destructive Coupling:** Clicking **"End auction"** calls `setTournamentLicenseStatus(id, "completed")` and locks the tournament (`adminLocked = true`, `status = "completed"`).
- **The Bug in Practice:** If an organizer runs a 3-day event (Day 1: Auction, Day 2-3: Cricket Matches), ending the auction on Day 1 marks the tournament `completed` and locks it! Scorers can no longer score, notifications are suppressed by [`comm.ts`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/comm.ts#L329), and the tournament appears as "Finished" in lists.

#### Card 2: RUNTIME MODES & ENGINES
- **Scoring Engine as an Afterthought:** Sports scoring is just a secondary toggle inside "Runtime Modes & Engines" next to "Cloud vs Local Venue Mode".
- **Zero Lifecycle for Scoring:** There is no status for Scoring:
  - Can scoring be in **Draft / Setup**?
  - Can scoring be in **Trial Mode** (e.g. 1 match test)?
  - Can scoring be in **Live Mode**?
  - Can scoring be marked **Completed** when the final match ends?
  - Currently, clicking `[Disable Match Scoring]` / `[Enable Match Scoring]` only flips `scoringEnabled: boolean`. It provides no visibility into live matches or scoring state.

#### Card 3: EMERGENCY & SAFETY ZONE
- Only provides **"Reset Auction Data"** (clears bids, team purses, restores players).
- If cricket or badminton match data is corrupted, there is **no match reset, fixture rebuild, or scoring repair action** available here.

### 3.4 Quick Room & Display Launchers
The 6 quick-launch buttons at the bottom of the page:
1. `Live Viewer` (`/tournament/:id/live`) — Auction LED viewer
2. `OBS Overlay` (`/tournament/:id/obs`) — Auction OBS overlay
3. `Break Timer` (`/tournament/:id/break-timer`) — Auction break countdown
4. `Sponsor LED` (`/tournament/:id/side/sponsors`) — Auction sponsor loop
5. `Player Profile` (`/tournament/:id/side/player`) — Auction player profile LED
6. `Operator Console` (`/tournament/:id/auction`) — Auction bidding console

**Missing entirely for sports scoring:**
- Scorer Console (`/scoring/:id` or `/tournament/:id/scoring/cricket`)
- Public Match Center / Fan Scorecard (`/tournament/:id/cricket/match-center` or `/tournament/:id/scoring`)
- OBS Cricket / Badminton Scoreboard Overlay
- Tournament Fixtures & Schedule Launcher

---

## 4. API & Data Logic Audit

### 4.1 `GET /auth/admin/tournaments/:tournamentId/detail`
In [`artifacts/api-server/src/routes/auth.ts`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L816-L850):
```typescript
// Current response snippet:
tournament: {
  id: tournament.id,
  name: tournament.name,
  sport: tournament.sport,
  status: tournament.status,
  licenseStatus: tournament.licenseStatus,
  adminLocked: tournament.adminLocked,
  scoringEnabled: tournament.scoringEnabled ?? false,
  // ❌ Missing: auctionEnabled (client cannot know if auction is disabled!)
  // ❌ Missing: scoringPhase (client cannot display scoring lifecycle!)
  // ❌ Missing: productMode (client cannot know organizer's intent!)
  // ❌ Missing: licenseRequest (client cannot see pending/granted packages!)
  // ❌ Missing: matchCounts / scoring summary
}
```

### 4.2 `PATCH /auth/admin/tournaments/:tournamentId`
In [`artifacts/api-server/src/routes/auth.ts`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L893-L925):
- Schema includes `auctionEnabled: z.boolean().optional()` and `scoringEnabled: z.boolean().optional()`.
- **Missing:** `scoringPhase` is not in the schema!
- Line 996 forces: `updates.scoringPhase = d.scoringEnabled ? "active" : "disabled";`
- As a result, an admin **cannot manually mark scoring as `completed` or `setup`** through the admin API.

### 4.3 `POST /auth/admin/tournaments/:id/set-license-status`
In [`artifacts/api-server/src/routes/auth.ts`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L2546-L2579):
- Accepts `status: "trial" | "active" | "completed"`.
- Directly executes `commitAdminLicenseTransition`, which is hardcoded to [`auction-demo-reset.ts`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/lib/auction-demo-reset.ts).
- There is no separate endpoint or parameter to transition **Scoring License** or **Scoring Phase**.

---

## 5. What Is Done vs What Is Needed

| Capability / Area | What Is Done Today | What Is Needed |
| :--- | :--- | :--- |
| **Product Mode Selection** | Organizer selects `auction_only`, `scoring_only`, or `both` at creation. | Admin Detail Page must **respect** and prominently display this choice (`productMode`). |
| **Admin Detail Page Presentation** | Always renders Auction Layout regardless of product choice. | UI must **dynamically adapt**: If `scoring_only`, hide purse/bids/auction controls. If `both`, give equal, clear separation to Auction and Scoring. |
| **Auction Lifecycle** | Has `Trial`, `Live`, `Completed` controls via `LicenseModeControl`. | Keep for Auction, but rename clearly to **"Auction Lifecycle"** and decouple from global tournament status. |
| **Scoring Lifecycle** | Only a boolean toggle (`Disable / Enable Match Scoring`). | Dedicated **"Sports Scoring Lifecycle"** control: `Setup/Draft` → `Live Scoring Active` → `Scoring Completed`. |
| **Licensing Model** | Single `licenseStatus` column on `tournamentsTable` inherited from legacy auction. | Clear dual-licensing visibility: Display whether the tournament has **Auction License (Live/Trial)** and/or **Scoring License (Live/Trial)**. |
| **Tournament Completion Coupling** | Clicking "End Auction" sets `status = "completed"` and locks the tournament. | **Decouple:** "End Auction" only ends the auction module. Tournament `status` stays `active` while scoring/matches continue. Global tournament only completes when all enabled modules are finished. |
| **License Request Visibility** | Organizer requests license via modal, but request sits in DB table. | Show **"Pending License Request" banner** directly on Admin Detail Page with module requested (`auction`, `scoring`, `both`), payment verification, and 1-click grant. |
| **Admin Navigation & Tabs** | Has `Overview`, `Players`, `Teams`, `Bid Log`, `Live Auction Monitor`. | Dynamic tabs: If scoring is enabled, add **`Matches & Fixtures`** and **`Live Scoring Monitor`**. If auction is disabled, hide `Bid Log` and `Live Auction Monitor`. |
| **Quick Launchers** | 6 Auction room/display links only. | Contextual launchers: Add **Scorer Console**, **Public Scorecard / Fan View**, **OBS Scoring Overlay**. |
| **Emergency Safety Zone** | Only "Reset Auction Data" (bids/purses). | Add **"Reset / Repair Scoring Data"** (recalculates overs/brackets, resets match events if needed). |

---

## 6. Target Architecture & Engineering Blueprint

### 6.1 Architectural Domain Model
Following [`bidwar_architecture_skill`](file:///c:/Users/win%2010/updatedbidwarcore/.agents/skills/bidwar_architecture_skill/SKILL.md) (§7, §8, §13, §14):

```
                                  TOURNAMENT
                    (Status: Draft → Setup → Active → Completed)
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
     AUCTION MODULE                                  SCORING MODULE
     • auctionEnabled: boolean                       • scoringEnabled: boolean
     • auctionLicenseStatus: trial | active          • scoringLicenseStatus: trial | active
     • auctionPhase: setup | live | completed        • scoringPhase: setup | live | completed
     • auctionLocked: boolean                        • sport: cricket | badminton
     • Bids, Purses, Lots                            • Matches, Innings, Brackets
```

### 6.2 Proposed Admin Tournament Detail Page Layout

Depending on `resolveTournamentProductMode(tournament)`:

#### Scenario A: Tournament has `BOTH` (like Kids Edition #40)
The Mission Control section renders **Two Co-Equal Operational Cards** plus Safety Zone:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOURNAMENT OPERATIONS & MISSION CONTROL                                                 │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ CARD 1: AUCTION MODULE   │ CARD 2: SCORING MODULE   │ CARD 3: EMERGENCY & SAFETY ZONE │
│ ──────────────────────── │ ──────────────────────── │ ──────────────────────────────── │
│ License: LIVE LICENSE    │ License: LIVE LICENSE    │ ⚠️ Emergency Operations          │
│ Phase: LIVE AUCTION      │ Phase: MATCHES IN PROG.  │                                  │
│                          │                          │ • [Reset Auction Data]           │
│ Current: Live Bidding    │ Matches: 12 Total        │   (Clears bids & player prices)  │
│ [Switch to Trial]        │ (2 Live, 4 Done, 6 Sched)│                                  │
│ [Conclude Auction]       │                          │ • [Reset Match / Scoring Data]   │
│                          │ Controls:                │   (Recalculates match state)     │
│ ℹ️ Ending auction leaves │ [Mark Scoring Live]      │                                  │
│ sports scoring active!   │ [Conclude Scoring]       │ • [Delete Tournament]            │
└──────────────────────────┴──────────────────────────┴──────────────────────────────────┘
```

#### Scenario B: Tournament has `SCORING ONLY` (e.g. Badminton or Non-Auction Cricket)
- Card 1 becomes **SPORTS SCORING LIFECYCLE & LICENSING**:
  - Shows Scoring License (Trial vs Live).
  - Shows Matches / Fixtures count.
  - Buttons: `Grant Live License`, `Start Live Scoring`, `Complete Scoring`.
- Card 2 becomes **TOURNAMENT CONFIGURATION & VENUE**:
  - Venue, Court/Pitch allocation, Scorer PIN delegation, Local Wi-Fi Mode.
- Card 3 has **Scoring Data Reset** (no auction reset shown!).
- Top KPI Stats show: `Players`, `Teams`, `Total Matches`, `Live Matches`, `Completed Matches` (no Base Purse or Bids!).
- Navigation tabs show: `Overview`, `Players`, `Teams`, `Matches (12)`, `Live Match Monitor`.

#### Scenario C: Tournament has `AUCTION ONLY`
- Card 1: Auction Lifecycle & Licensing.
- Card 2: Auction Infrastructure & Feature Engines (Local mode, Cheer meter, Audio).
- Card 3: Auction Reset.
- Scoring is completely hidden or has a single prompt: *"Enable Sports Scoring for this tournament"*.

---

## 7. Concrete Implementation Steps

### Phase 1: API & Data Layer Updates
1. **Extend `GET /auth/admin/tournaments/:id/detail`**:
   - Include `auctionEnabled: boolean`.
   - Include `scoringPhase: "disabled" | "active" | "completed"`.
   - Include derived `productMode: "auction_only" | "scoring_only" | "both"`.
   - Include active/pending `licenseRequest` from `tournamentLicenseRequestsTable`.
   - Include match summary counts (`totalMatches`, `liveMatches`, `completedMatches`).

2. **Extend `PATCH /auth/admin/tournaments/:id`**:
   - Add `scoringPhase: z.enum(["disabled", "active", "completed"]).optional()` to validation schema.
   - Decouple `scoringEnabled` toggling from forcing `scoringPhase = "active"`.

3. **Decouple Auction End from Tournament Status**:
   - In [`artifacts/api-server/src/routes/auth.ts`](file:///c:/Users/win%2010/updatedbidwarcore/artifacts/api-server/src/routes/auth.ts#L740), when concluding an auction:
     ```typescript
     // If scoring is enabled, do NOT set status = "completed"
     const nextTournamentStatus = tournament.scoringEnabled ? tournament.status : "completed";
     await db.update(tournamentsTable)
       .set({
         licenseStatus: "completed",
         status: nextTournamentStatus,
         // Keep adminLocked scoped to auction or mark auctionSession as completed
       })
     ```

4. **Add Dedicated Scoring Lifecycle Admin Route**:
   - `POST /auth/admin/tournaments/:id/scoring/set-phase`:
     - Allows admin to set `scoringPhase: "active" | "completed" | "setup"`.
     - Logs critical audit event `tournament.scoring_phase_changed`.

### Phase 2: UI / UX Modernization (`admin-tournament-detail.tsx`)
1. **Top Identity Strip**:
   - Display product mode badge: `AUCTION ONLY`, `SCORING ONLY`, or `AUCTION + SCORING`.
   - Show distinct license chips: e.g. `Auction: Live` and `Scoring: Live`.

2. **Dynamic KPI Metrics Strip**:
   - If `auctionEnabled`: show `Purse` and `Bids`.
   - If `scoringEnabled`: show `Total Matches` and `Active Fixtures`.

3. **Modular Control Center**:
   - Replace the single hardcoded "AUCTION LICENCE" card with module-aware cards:
     - Render `AuctionModuleCard` if `auctionEnabled`.
     - Render `ScoringModuleCard` if `scoringEnabled`.
   - Provide clear, unambiguous buttons for both lifecycles.

4. **Quick Launchers Section**:
   - For Cricket/Badminton scoring tournaments, add 1-click links to:
     - Scorer Console (`/scoring/:id` / `/tournament/:id/scoring/cricket`)
     - Match Center (`/tournament/:id/cricket/match-center`)
     - OBS Match Scoreboard Overlay (`/tournament/:id/scoring/obs`)

5. **Safety Zone**:
   - Add clear separation: "Reset Auction Bids & Purses" vs "Reset Match Scoring Data".

---

## 8. Verification & Test Plan

1. **Unit & Purity Tests**:
   - Verify `resolveTournamentProductMode` correctly outputs `scoring_only`, `auction_only`, and `both`.
   - Verify that concluding an auction on a `both` tournament keeps `tournaments.status !== "completed"` if matches remain.
2. **Admin API Tests**:
   - Verify `GET /auth/admin/tournaments/:id/detail` returns `auctionEnabled`, `scoringPhase`, `productMode`, and match counts.
   - Verify `PATCH /auth/admin/tournaments/:id` successfully updates `scoringPhase` without side effects on auction.
3. **UI Verification**:
   - Verify Tournament #40 displays both Auction and Scoring controls without confusion.
   - Verify a pure Badminton/Cricket scoring tournament hides auction purse, bid logs, and auction monitor.
