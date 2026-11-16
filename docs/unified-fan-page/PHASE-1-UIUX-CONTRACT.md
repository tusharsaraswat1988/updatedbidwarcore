# PHASE 1 — UI/UX DESIGN & PRESENTATION SPECIFICATION

> **Document 7 of 9:** Visual Design System, Layouts & Responsive Wireframes  
> **Repository:** BidWar Core Platform  
> **Status:** UI/UX Specification Contract — Approved for Documentation Only  
> **Canonical Target:** `docs/unified-fan-page/PHASE-1-UIUX-CONTRACT.md`  

---

## 1. VISUAL DESIGN PHILOSOPHY & TOKENS

The BidWar Unified Fan Page adopts the **Protected Operational Dark** spectator theme established by the Auction Live Viewer and Cricket Fan Experience. It delivers an electric, high-stakes sporting atmosphere inspired by premier broadcast graphics (IPL / BPL).

### Design Tokens
- **Canvas Background:** `#0B101B` (Deep midnight slate)
- **Panel / Card Background:** `#131B2E` / `#18181B` with subtle border `rgba(255, 255, 255, 0.08)`
- **Primary Brand Gold:** `#F59E0B` (Amber 500 — Live auction bids, hammer drops, trophies)
- **Live Action Emerald:** `#10B981` (Emerald 500 — Live match beacon, active ball-by-ball events)
- **Electric Blue:** `#0284C7` (Sky 600 — Stats, boundary fours, team details)
- **High-Contrast Text:** `#F8FAFC` (Slate 50 — Player names, bids, primary labels)
- **Muted Text:** `#94A3B8` (Slate 400 — Specs, secondary data, dates, cities)
- **Typography:**
  - Display / Numbers: Font Display (Bold / Extra Bold / Black) tabular numbers for bids and scorecards.
  - Body: Inter / Sans-serif for optimal readability across mobile viewports.

---

## 2. ADAPTIVE MODULE NAVIGATION PILLS

In multi-module tournaments (`productMode === 'both'`), the module switcher appears prominently directly beneath the tournament identity banner:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  [⚡ Live Auction (🔴 LIVE)]       [🏏 Matches & Scoring (LIVE)]        │
└────────────────────────────────────────────────────────────────────────┘
```

### Pill Styling & States:
- **Active State:** Solid gradient background (`from-amber-500 to-amber-600` for Auction; `from-emerald-500 to-emerald-600` for Scoring), white text, bold font, subtle luminous glow (`shadow-[0_0_15px_rgba(...)]`).
- **Inactive State:** Semi-transparent panel (`bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white`).
- **Live Status Badges:** Pulsing beacon dot inside pill indicates active live bidding or ongoing cricket/badminton match.
- **Single-Module Tournaments:** When `auction_only` or `scoring_only`, the pill container is completely suppressed to avoid visual noise.

---

## 3. RESPONSIVE BREAKPOINTS & CLEARANCE

| Breakpoint | Viewport Width | Layout Mode | Navigation Placement |
|---|---|---|---|
| **Mobile Compact** | `< 390px` | Single column stacked | Sticky top tabs, full-width pills |
| **Mobile Standard**| `390px - 767px` | Single column stacked | Sticky top tabs, full-width pills |
| **Tablet** | `768px - 1023px` | Two-column responsive grid | Centered pill switchers |
| **Desktop / TV** | `1024px+` | Two/Three-column cockpit | Centered pill switchers, side squad sheet |

### Sponsor Ribbon Clearance:
To prevent interactive buttons from being obscured by the bottom sticky sponsor ticker (`SponsorTicker`):
- All bottom interactive triggers (e.g. `Cheer Live` pill) must maintain a minimum clearance of **52px** above the sponsor ticker (`MOBILE_CHEER_BUTTON_CLEARANCE_PX`).

---

## 4. WIREFRAME SPECIFICATIONS

### A. Desktop Unified Fan Page (`/tournament/:id/fan`)

```text
+--------------------------------------------------------------------------------------------------------+
| [BIDWAR LOGO]   TOURNAMENT NAME · CITY · DATES                    [SHARE]  [MUTE]  [SQUADS (8)]        |
+--------------------------------------------------------------------------------------------------------+
|                                [⚡ LIVE AUCTION]      [🏏 MATCHES & SCORES]                             |
+--------------------------------------------------------------------------------------------------------+
|  LEFT COLUMN: PLAYER HERO & SPEC            |  CENTER: BIDDING / SCORECARD   |  RIGHT: PURSES & TEAMS  |
|  +---------------------------------------+  |  +---------------------------+ |  +--------------------+ |
|  | [PHOTO HERO]                          |  |  | CURRENT LEADING BID       | |  | TEAM PURSE mini    | |
|  | Virat Kohli · Batsman · Age 35        |  |  | ₹ 2,40,00,000             | |  | Royal Challengers  | |
|  | Base Price: ₹ 20,00,000               |  |  | Leading: Royal Challengers| |  | Rem: ₹ 14.5 Cr     | |
|  | Status: IN RING                       |  |  | Increment: + ₹ 10 Lakhs   | |  | Squad: 14/18       | |
|  | Past Auction High: ₹ 17.0 Cr          |  |  +---------------------------+ |  +--------------------+ |
|  +---------------------------------------+  |  | HAMMER TIMER: [ 00:08 ]   | |  | RECENT CHEERS      | |
|                                             |  +---------------------------+ |  | "🔥 BOOM!"           | |
|                                             |  | [CHEER FOR YOUR TEAM]     | |  | "Let's go RCB!"    | |
+--------------------------------------------------------------------------------------------------------+
| [STICKY SPONSOR RIBBON: Title Sponsor · Powered By Partner · Associate Sponsors]                      |
+--------------------------------------------------------------------------------------------------------+
```

### B. Mobile Unified Fan Page (`/tournament/:id/fan`)

```text
+-------------------------------------------+
| [BW LOGO]  TOURNAMENT NAME       [SHARE]  |
+-------------------------------------------+
|    [⚡ AUCTION (LIVE)]   [🏏 SCORING]     |
+-------------------------------------------+
|  [PHOTO HERO]                             |
|  Virat Kohli · Batsman                    |
|  Current Bid: ₹ 2.4 Cr · Royal Challengers|
|  Hammer Timer: [ 00:08 ]                  |
|  +-------------------------------------+  |
|  | Past Auction High: ₹ 17.0 Cr         |  |
|  +-------------------------------------+  |
+-------------------------------------------+
|  TEAMS & SQUADS [Tap to View Purses]       |
+-------------------------------------------+
|  [⚡ CHEER LIVE BUTTON - FIXED PILL]       |
+-------------------------------------------+
| [SPONSOR RIBBON]                          |
+-------------------------------------------+
```

### C. Desktop Universal Fan Home (`/fan`)

```text
+--------------------------------------------------------------------------------------------------------+
| [BIDWAR LOGO]  EXPLORE TOURNAMENTS     [SEARCH: Name, City, Organizer]   [FAVORITES]   [ORGANIZER LOGIN]|
+--------------------------------------------------------------------------------------------------------+
| SPORT FILTERS:  [ALL SPORTS]   [🏏 CRICKET]   [🏸 BADMINTON]   [⚽ FOOTBALL]   [⚡ LIVE ONLY]           |
+--------------------------------------------------------------------------------------------------------+
| 🔴 LIVE NOW (3 Events)                                                                                 |
| +-------------------------+ +-------------------------+ +-------------------------+                    |
| | IPL 2026 Mega Auction   | | BPL Season 5 Match 12   | | All-City Badminton Open |                    |
| | City: Mumbai · Cricket  | | Cricket · Bengaluru     | | Badminton · Pune        |                    |
| | ⚡ Live Bidding: Lot 14 | | 🔴 Royal XI 142/3 (16)  | | 🔴 Court 2 Men's Final  |                    |
| | [WATCH LIVE AUCTION]    | | [OPEN MATCH CENTER]     | | [VIEW SCORES]           |                    |
| +-------------------------+ +-------------------------+ +-------------------------+                    |
+--------------------------------------------------------------------------------------------------------+
| 🌟 FEATURED & UPCOMING LEAGUES                                                                         |
| +-------------------------+ +-------------------------+ +-------------------------+                    |
| | Premier Cricket Trophy  | | Smash Masters Badminton | | Champions Cup           |                    |
| | Starts Tomorrow         | | Starts in 3 Days        | | Nov 24 · Delhi          |                    |
| +-------------------------+ +-------------------------+ +-------------------------+                    |
+--------------------------------------------------------------------------------------------------------+
```

### D. Mobile Universal Fan Home (`/fan`)

```text
+-------------------------------------------+
| [BW] EXPLORE FAN HOME       [FAVORITES]   |
+-------------------------------------------+
| [🔍 Search tournaments, cities...]       |
+-------------------------------------------+
| [ALL]  [🏏 CRICKET]  [🏸 BADMINTON] [LIVE]|
+-------------------------------------------+
| 🔴 LIVE NOW                               |
| +---------------------------------------+ |
| | IPL 2026 MEGA AUCTION                 | |
| | Mumbai · Cricket                      | |
| | ⚡ Bidding: Virat Kohli ₹ 2.4 Cr      | |
| | [WATCH LIVE]                          | |
| +---------------------------------------+ |
+-------------------------------------------+
| 📅 UPCOMING TODAY                         |
| +---------------------------------------+ |
| | BPL Season 5 Match 14                 | |
| | Starts at 7:00 PM IST                 | |
| +---------------------------------------+ |
+-------------------------------------------+
```

---

## 5. ACCESSIBILITY & PERFORMANCE STANDARDS

- **Contrast Ratios:** Text on midnight backgrounds conforms to WCAG 2.1 AA standards (minimum 4.5:1 ratio).
- **Touch Target Sizing:** All interactive pills, share buttons, and sound toggles possess minimum touch areas of **44x44 CSS pixels**.
- **Animation Motion Safety:** Framer-motion floating reactions respect `prefers-reduced-motion` settings.

---

*End of UI/UX Design Contract (Document 7 of 9).*
