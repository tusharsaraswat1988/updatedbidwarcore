# Badminton Product UX & Information Architecture Audit

**Status:** Product Architecture Spec — Phase 1 + Phase 2 + Phase 2.5 polish complete; Phases 3–4 pending review  
**Date:** 2026-07-23  
**Release target:** VNBL 3.0 (before 1 Aug)  
**Module runtime:** `artifacts/scoring-app` (`/scoring-app`)  
**UI source:** `artifacts/auction-platform/src/pages/badminton/*`  
**Nav source of truth:** `artifacts/auction-platform/src/lib/badminton-sport-nav.ts`

> **IA label update (release brief):** primary item #4 is **Tournament Structure** (audit originally said “Competition”). Same responsibility: events, draw, fixtures, format.

---

## Executive verdict

The badminton organizer experience is **backend-shaped**, not **tournament-shaped**.

Today organizers must understand BidWar’s internal pipeline:

> Branding → Players → Categories → Scoring Format → Courts → Scorers → Fixtures → Schedule → Matches → Match Control → Operator Panel → Broadcast → Results → Summary → Analytics

Real organizers think:

> Tournament → Players → Draw → Schedule → Play → Results

**Primary failure mode:** three screens teach the same mental model three times (`Fixtures` / `Match Schedule` / `Matches`), while live operations are split across `Matches`, `Match Control`, `Operator Panel`, and `Display & Broadcast`.

**Target IA (max 7 primary items):**

1. Dashboard  
2. Tournament Setup  
3. Participants  
4. Tournament Structure  
5. Schedule  
6. Live Control  
7. Results  

No features deleted. Capabilities reorganized. Backend APIs and schema unchanged unless a later phase proves otherwise.

---

## 1. Current Architecture

### 1.1 Where the product lives

| Layer | Path | Role |
|-------|------|------|
| Runtime app | `artifacts/scoring-app` | Serves organizer + runtime UIs under `/scoring-app` |
| Page source | `artifacts/auction-platform/src/pages/badminton/*` | All badminton screens |
| Sidebar | `getBadmintonSportNav()` in `badminton-sport-nav.ts` | Active SportsShell nav |
| Route catalog | `badminton-routes.ts` | Hub paths, mode layouts (partly unused) |
| Setup wizard | `badminton-setup-workflow.ts` | Sequential setup steps |
| Shell | `components/sports-shell/sports-shell.tsx` | Sidebar host |

Public base URL pattern:

- Organizer: `/scoring-app/tournament/:id/badminton…`
- Runtime (no sidebar): `/scoring-app/badminton/…`

### 1.2 Current primary sidebar (what organizers see)

**Dashboard**
- Tournament Dashboard → `/tournament/:id/badminton`

**Setup** (8 items)
- Tournament Information → `…/branding`
- Players → `…/players`
- Teams / Events → `…/categories`
- Scoring Format → `…/scoring-format`
- Venues & Courts → `…/courts`
- Scorers → `…/scorers`
- Fixtures → `…/fixtures`
- Match Schedule → `…/schedule`

**Operations** (4 items)
- Matches → `…/matches`
- Operator Panel → `…/control`
- Results → `…/results`
- Publish / Summary → `…/summary`

**Broadcast** (1 item)
- Display & Broadcast → `…/control?focus=broadcast`

**Reports** (1 item)
- Analytics → `…/analytics`

**Count:** 15 primary destinations across 5 sidebar sections — **more than 2× the 7-item maximum**.

### 1.3 Full screen inventory

#### A. Organizer hub screens (SportsShell)

| Current Screen | Route | File | Stated purpose (from code) |
|----------------|-------|------|----------------------------|
| Tournament Dashboard / Setup landing | `/tournament/:id/badminton` | `tournament-hub.tsx` | Setup checklist when incomplete; KPI + live matches when ready |
| Tournament Information (Branding) | `…/branding` | `branding.tsx` | Name, logo, venue, organizer, colors, sponsors, scoreboard sponsor |
| Players | `…/players` | `players.tsx` | Roster import / walk-in / photos |
| Teams / Events (Categories) | `…/categories` | `categories.tsx` | Event definitions + registrations/entries |
| Scoring Format | `…/scoring-format` | `scoring-format.tsx` | Tournament-wide scoring rules |
| Venues & Courts | `…/courts` | `courts.tsx` | Court CRUD + court/scorer PIN fields |
| Scorers | `…/scorers` | `scorers.tsx` | Scorer accounts (mobile + personal PIN) |
| Fixtures | `…/fixtures` | `fixtures.tsx` | Draw generation / manual / import stub |
| Match Schedule | `…/schedule` | `schedule.tsx` | Assign court + time to fixtures (setup only) |
| Matches | `…/matches` | `matches.tsx` | Create/list scoring matches; open Match Control / scorer links |
| Match Control | `…/matches/:matchId/control` | `match-control.tsx` | Director: toss/start → live Match Control Center |
| Operator Panel / Control Center | `…/control` | `control-center.tsx` | Court ops board + Broadcast Director + queues |
| Display & Broadcast | `…/control?focus=broadcast` | (same page) | Soft focus on Broadcast Director panel |
| Broadcast (redirect stub) | `…/broadcast` | `broadcast.tsx` | Redirects to control?focus=broadcast |
| Results | `…/results` | `results.tsx` | Champions, category status, brackets, recent finishes |
| Publish / Summary | `…/summary` | `summary.tsx` | Closing record: champions, courts, awards, share/PDF |
| Analytics | `…/analytics` | `analytics.tsx` | Overview stats + quick links |

#### B. Runtime / fullscreen screens (no SportsShell)

| Current Screen | Route | File | Purpose |
|----------------|-------|------|---------|
| Scorer Home | `/badminton/scorer?tid=` | `scorer-home.tsx` | Scorer login → pick court/matches |
| Scorer tablet | `/badminton/:matchId/score?tid=` | `scorer.tsx` | Live point entry |
| Venue display | `/badminton/:matchId/display?tid=` | `display.tsx` | LED/TV scoreboard (`live` auto-follow) |
| OBS overlay | `/badminton/:matchId/overlay?tid=&type=` | `overlay.tsx` | Transparent overlays |

These runtime surfaces are **correct as separate URLs** (shareable, kiosk, OBS). They should **not** appear as sidebar items. They belong under Live Control as links/actions.

#### C. Setup wizard order (today)

```
Tournament Information
→ Players
→ Teams / Events
→ Scoring Format
→ Venues & Courts
→ Fixtures
→ Match Schedule
→ Ready (hub)
→ (then) Matches → Match Control / Operator Panel
```

Wizard already tries to guide users, but the **sidebar still exposes the whole pipeline at once**, defeating progressive disclosure.

---

## 2. Problems

### 2.1 Principle violations

| Principle | Current violation |
|-----------|-------------------|
| One Goal = One Screen | Dashboard mixes setup checklist + ops KPIs; Branding mixes identity + sponsor asset studio; Control Center mixes court ops + broadcast; Matches mixes create/schedule/control/links |
| Workflow over Features | Sidebar groups by system modules (Broadcast, Scorers, Fixtures) not tournament flow |
| Guide Users / Next Step | Wizard has next steps; many ops pages end without a single clear Continue CTA |
| Progressive Disclosure | 15 always-visible destinations; advanced broadcast/OBS exposed in sidebar |
| Max 7 primary nav | 15 destinations |
| Hide Technical Complexity | “Fixtures”, “Scorers”, “Operator Panel”, “Display & Broadcast”, “OBS” language in nav |
| Never Duplicate Navigation | Display & Broadcast is a second nav item to the same Control page; Matches vs Schedule vs Fixtures overlap |

### 2.2 Mental-model leak (backend pipeline exposed)

Organizers are forced to learn BidWar’s object model:

| Backend concept | Why organizers do not care |
|-----------------|----------------------------|
| Fixture vs Match | Same idea: “who plays whom” |
| Schedule fixture vs create match | Feels like double entry |
| Court PIN vs Scorer PIN vs Match PIN | Three auth models for “who can score” |
| Operator Panel vs Match Control vs Live Scoring | All mean “run match day” |
| Categories vs Teams/Events vs Draw | Naming drift for one competition concept |

### 2.3 Cognitive load

- Sidebar length: **15** items.
- Setup alone: **8** items (already over the total product max of 7).
- Live mode alternate layout (`getBadmintonHubNavLayout`) even maps **Live Scoring** and **Operator Panel** to the **same `/control` URL** — proof of duplicate navigation debt.
- Empty states and helper copy repeatedly explain the Fixture → Schedule → Match chain because the product cannot make that chain disappear.

### 2.4 Naming drift (trust & discoverability)

| Nav / title | Also called in UI |
|-------------|-------------------|
| Teams / Events | Categories, Events |
| Fixtures | Tournament Draw, Draw & Fixtures |
| Match Schedule | Court Schedule |
| Operator Panel | Control Center |
| Display & Broadcast | Broadcast Director |
| Publish / Summary | Tournament Summary & Awards |
| Tournament Dashboard | Command Center / Tournament Setup / Tournament Summary |

---

## 3. Screen-by-screen audit

Legend for **Can Merge?**  
- **Yes** — fold into destination; remove as primary nav  
- **Partial** — keep deep route or section; remove as primary nav  
- **No** — keep as primary (or keep as intentional runtime URL)

### 3.1 Organizer screens

| Current Screen | Purpose | Problems | Duplicate Responsibilities | Can Merge? | Recommended Destination |
|----------------|---------|----------|----------------------------|------------|-------------------------|
| **Tournament Dashboard** | Understand status; unfinished setup checklist | Dual personality (setup wizard + ops dashboard); competes with Analytics/Results for “how are we doing?” | Analytics KPIs; Control Center live board; Summary post-event | **Partial** | **Dashboard** — health only. Setup checklist becomes first-run state or CTA into Tournament Setup, not a separate IA branch |
| **Tournament Information / Branding** | Tournament identity + look | Mixes identity (name/venue/organizer) with sponsor asset studio; venue text also lives conceptually with Courts | Courts (venue); Live display branding; Summary branding | **Yes (split)** | Identity → **Tournament Setup**. Sponsor/scoreboard assets → **Brand Assets section** inside Setup (see §4.2) |
| **Players** | Build roster | Good single purpose; “Teams” label elsewhere confuses | Categories entries pick players; Matches side pickers | **Yes** | **Participants** (Players tab) |
| **Teams / Events (Categories)** | Define events + entries | Two responsibilities: event structure + who entered; labeled “Teams/Events” while code says Categories | Fixtures (per-event draw); Scoring Format (per-event override) | **Yes (split)** | Event definitions → **Competition**. Entries/registrations → **Participants** (Entries) |
| **Scoring Format** | Rules for how matches are won | Correct purpose, wrong elevation (full sidebar item) | Per-event format on Categories; match format on Matches | **Yes** | **Tournament Setup** → Rules section |
| **Venues & Courts** | Court CRUD + PINs | Venue name already on Branding; PINs bleed into Live Control/Scorers | Branding.venue; Schedule court assignment; Operator court board; Scorer auth | **Yes** | Courts → **Tournament Setup**. Court-day PIN/status ops → **Live Control** |
| **Scorers** | Manage scorer accounts | Exposes implementation role as primary nav; overlaps court PIN model | Court PIN; Scorer Home; Operator “copy scorer link” | **Yes** | **Participants** → Officials/Scorers (human language), with day-of actions also in **Live Control** |
| **Fixtures** | Who plays whom (draw) | Correct goal; wrong name (“Fixtures”); separated from Schedule/Matches | Schedule; Matches create-from-fixture | **Yes** | **Competition** → Draw / Bracket |
| **Match Schedule** | Assign court + time | Explicitly “does not start scoring” — forces users into Matches next; not a visual board-first experience | Matches court/time; Operator upcoming list | **Yes** | **Schedule** (sole scheduling home) |
| **Matches** | Create/list scoring Match objects | **Highest IA smell.** Backend table as a screen. Mixes creation, scheduling fields, control entry, scorer links | Fixtures; Schedule; Operator; Match Control | **Yes** | Dissolve: structure from **Competition**; time/court/officials on **Schedule**; run from **Live Control**. Keep route temporarily as redirect/compat |
| **Match Control** | Start/control one match | Correct deep screen; buried under Matches | Operator Panel; Scorer tablet | **Partial** | Deep link under **Live Control** (per-match). Not a sidebar item |
| **Operator Panel** | “What is happening right now?” | Already close to Mission Control, but Broadcast is a sibling nav item; naming is internal | Matches; Match Control; Schedule upcoming; Broadcast focus | **Yes** | Becomes **Live Control** |
| **Display & Broadcast** | Director / venue / OBS / scorer links | Duplicate nav to Control; exposes OBS in sidebar | Operator Panel | **Yes** | Tab/section inside **Live Control** (advanced, collapsed by default) |
| **Broadcast redirect** | Compatibility stub | Dead-end naming | Control focus=broadcast | **Yes** | Redirect to **Live Control** broadcast section |
| **Results** | Champions / progress / recent finishes | Overlaps Summary and Analytics | Summary; Analytics; Dashboard completed KPIs | **Partial** | **Results** primary. Absorb Summary + light Analytics as tabs/sections |
| **Publish / Summary** | Closing record, share, PDF | Second “results-ish” page; “Publish” is jargon | Results; Analytics | **Yes** | **Results** → Summary / Share / Export section |
| **Analytics** | Stats + shortcuts | Largely a second dashboard | Dashboard; Results; Summary | **Yes** | **Dashboard** (live health) + **Results** (post-event insights). Remove as primary nav |

### 3.2 Runtime screens (keep URLs; hide from sidebar)

| Current Screen | Purpose | Problems | Duplicate Responsibilities | Can Merge? | Recommended Destination |
|----------------|---------|----------|----------------------------|------------|-------------------------|
| Scorer Home | Authenticated match picker | Discoverability only via copy/QR today | Scorers page; Operator links | **No (URL)** | Linked from **Live Control** → Scorers |
| Scorer tablet | Point entry | Correct specialized UI | Match Control (director) | **No (URL)** | Linked from **Live Control** |
| Venue display | LED/TV | Correct specialized UI | Overlay; Broadcast panel | **No (URL)** | Linked from **Live Control** → Displays |
| OBS overlay | Stream overlays | Correct specialized UI; “OBS” is technical | Venue display | **No (URL)** | Linked from **Live Control** → Displays (label: “Stream overlay”, not sidebar) |

---

## 4. New Architecture

### 4.1 Target primary navigation (exactly 7)

```
Dashboard
Tournament Setup
Participants
Competition
Schedule
Live Control
Results
```

Nothing else in the sidebar.

### 4.2 Page responsibilities (target)

#### Dashboard
**One question:** *Is my tournament healthy right now?*

Contains:
- Tournament status / readiness
- Live matches
- Upcoming matches
- Quick actions (context-aware)
- Progress (setup % or match-day completion)

Does **not** contain:
- Setup forms
- Broadcast settings
- Draw tools
- Sponsor editors

**Next Step:** context-aware Continue (e.g. “Continue setup” / “Go to Live Control” / “View Results”).

#### Tournament Setup
**One question:** *What is this tournament and where does it play?*

Merge into this page (sections / progressive disclosure):
- Tournament info (name, dates, organizer)
- Logo + basic colors
- Venue
- Courts (create/edit)
- Rules / scoring defaults
- Categories list (which events exist) — lightweight; full draw stays in Competition
- Basic branding

**Remove as separate screens:** Venues & Courts, Scoring Format, Tournament Information (as top-level nav).

**Next Step:** Continue to Participants.

#### Brand Assets — evaluation (required decision)

**Current weight of branding content:**
- Identity fields: display name, logo, venue, organizer, primary/accent colors
- Asset studio: multi-sponsor logo list + priority + uploads (`SponsorLogosEditor`)
- Scoreboard-specific sponsor (`ScoreBoardSponsorPanel`)

**Recommendation: do NOT add an 8th sidebar item.**

| Option | Decision |
|--------|----------|
| **A. Separate Brand Assets page in sidebar** | Rejected — breaks max-7 rule and elevates polish over workflow |
| **B. Section inside Tournament Setup (recommended)** | **Adopt.** Tournament Setup tabs/sections: **Basics** · **Courts** · **Rules** · **Brand Assets** |
| **C. Promote later** | If sponsor packages, certificate templates, and multi-venue LED kits grow, promote Brand Assets to a Setup sub-route only (`…/setup/brand`) still **not** a primary sidebar item |

Brand Assets stays discoverable for advanced organizers without polluting primary nav.

#### Participants
**One question:** *Who is involved?*

Merge:
- Players (import / walk-in / photos)
- Teams (franchise grouping as presentation, not a backend lecture)
- Event entries / player assignment
- Officials (scorers today; umpires when present)

Human language:
- Prefer “Officials” over “Scorers” in nav chrome
- Prefer “Entries” over “Registrations” where user-facing

**Next Step:** Generate Competition (Continue to Competition).

#### Competition
**One question:** *Who plays whom, and in what structure?*

Merge:
- Events (from Categories)
- Draw / bracket generation
- Tournament format choices tied to events
- Fixture planning (auto / manual / import)
- Event entries deep-work if not finished in Participants

Organizers think **Competition**, not **Fixtures**.

**Next Step:** Schedule Matches.

#### Schedule
**One question:** *When and where does each match happen?*

Only:
- Court
- Date / time
- Umpire / scorer assignment (when available)

Provide a **visual scheduling board** (courts × time).  
Do **not** expose internal Match vs Fixture vocabulary.

Auto-create or lazily materialize scoring matches behind the scenes when a slot is scheduled (implementation detail — user never “creates a Match object”).

**Next Step:** Go Live → Live Control.

#### Live Control (Mission Control)
**One question:** *What do I need to run right now?*

Merge:
- Operator Panel / Control Center
- Match Control entry points
- Court status board
- Match queue (ready / upcoming / delayed)
- Scorer links / QR
- Venue display links
- Broadcast Director / OBS links (advanced section)
- Day-of match start / toss / director actions

**Next Step:** View Results (when matches complete) or keep running.

#### Results
**One question:** *What are the outcomes and how do we close the event?*

Merge:
- Standings / champions
- Completed matches
- Bracket progress
- Publish / Summary (share, PDF, awards)
- Export / certificates (as they exist or arrive)
- Post-event analytics that are outcome-oriented

**Next Step:** Share / Export / Archive (end of flow).

### 4.3 Mapping: current → target

| Current primary item | Target home | Placement |
|----------------------|-------------|-----------|
| Tournament Dashboard | Dashboard | Primary |
| Tournament Information | Tournament Setup | Basics section |
| Branding sponsors / scoreboard sponsor | Tournament Setup | Brand Assets section |
| Players | Participants | Players |
| Teams / Events | Competition + Participants | Events + Entries |
| Scoring Format | Tournament Setup | Rules |
| Venues & Courts | Tournament Setup | Courts |
| Scorers | Participants (+ Live Control actions) | Officials |
| Fixtures | Competition | Draw |
| Match Schedule | Schedule | Board |
| Matches | Schedule + Live Control | Hidden object; redirects |
| Operator Panel | Live Control | Primary surface |
| Display & Broadcast | Live Control | Displays / Broadcast section |
| Results | Results | Primary |
| Publish / Summary | Results | Summary / Share tab |
| Analytics | Dashboard + Results | Split by intent |
| Match Control | Live Control | Deep route |
| Scorer / Display / Overlay URLs | Live Control links | Keep public URLs |

### 4.4 Guided Continue chain

```
Tournament Setup  →  Continue to Participants
Participants      →  Generate Competition
Competition       →  Schedule Matches
Schedule          →  Go Live
Live Control      →  View Results
Results           →  Share / Export
```

Dashboard always offers the **single most important next action** for current tournament state (setup / live / completed).

---

## 5. Migration Plan

**Constraint:** No feature removal. No API/schema breakage. No business-logic rewrite. Incremental. Approval required before route deletions.

### Phase 1 — Audit + Navigation shell
- [x] Inventory routes, nav, overlaps
- [x] Recommend target IA
- [x] Approval via VNBL release brief (Tournament Structure naming; Brand Assets inside Setup)
- [x] Replace `getBadmintonSportNav()` with flat 7-item lifecycle nav
- [x] Temporary hosts: Dashboard→hub, Setup→branding, Participants→players, Structure→fixtures, Schedule→schedule, Live→control, Results→results
- [x] Legacy routes stay reachable; active-state maps into parent nav item
- [x] Hide Broadcast / Analytics / Scorers / Courts / Matches / Summary / Scoring Format / Categories from sidebar
- [ ] Review gate before Phase 2 page consolidation

### Phase 2 — Page consolidation
- [x] Shared IA workflow chrome (progress strip + Continue CTA)
- [x] Tournament Setup host: Identity & Branding · Courts · Rules (`branding?section=`)
- [x] Participants host: Players · Officials (`players?section=`)
- [x] Tournament Structure host: Events · Draw (`fixtures?section=`)
- [x] Schedule: IA chrome + Go Live CTA
- [x] Live Control: Courts & Queue · Live Displays + Mission Control language
- [x] Results: Standings · Summary · Insights tabs (legacy URLs preserved)
- [ ] Review gate before Phase 3 (dynamic Dashboard)

### Phase 3 — Page composition (merge into hosts)
Order chosen to reduce risk:

1. **Tournament Setup host** — compose sections from branding + courts + scoring-format (+ brand assets section).  
2. **Participants host** — players + scorers + category entries.  
3. **Competition host** — categories (events) + fixtures.  
4. **Schedule host** — schedule board UX; absorb match court/time responsibilities from Matches.  
5. **Live Control host** — control-center as Mission Control; embed broadcast section; deep-link Match Control.  
6. **Results host** — results + summary (+ outcome analytics).  
7. **Dashboard cleanup** — remove setup forms / broadcast; keep health + Continue.

### Phase 4 — Compatibility & cleanup
1. Old paths redirect to new homes with hash/query section anchors where needed (`?section=courts`, `?focus=broadcast`).
2. Update setup wizard step IDs/labels to new IA language.
3. Retire unused hub-chip nav if still dead code.
4. Only after approval: remove obsolete page entry points from sidebar permanently (pages may remain as thin redirects).

### Phase 5 — Verification gates (after every phase)
- Typecheck / compile scoring-app + auction-platform aliases  
- Lint touched files  
- Existing badminton tests  
- Manual route matrix (old URL → new destination)  
- Setup wizard happy path  
- Live day path: schedule → go live → score → results  

---

## 6. Impact Analysis

### 6.1 User impact (intended)

| Audience | Impact |
|----------|--------|
| First-time organizer | Fewer choices; clear Continue path; can finish without understanding Fixtures vs Matches |
| Returning power user | Advanced tools still present inside pages; shortcuts via old URLs during transition |
| Court scorer | No sidebar change; same `/badminton/scorer` and `/score` URLs |
| Broadcast/LED operator | Tools under Live Control → Displays; public display/overlay URLs unchanged |

### 6.2 Engineering impact

| Area | Impact |
|------|--------|
| `badminton-sport-nav.ts` | Primary rewrite (labels + section structure) |
| `badminton-routes.ts` | Active-state helpers; redirects; optional path aliases |
| `badminton-setup-workflow.ts` | Step copy + hrefs realigned to new hosts |
| Page files | Composition / sectioning more than rewrites; reuse `page-chrome`, cards, tokens |
| API / DB | **No change** in Phase 2–3 |
| Runtime URLs | **Preserve** |

### 6.3 Product copy impact

Replace internal words in organizer chrome:

| Avoid in sidebar | Prefer |
|------------------|--------|
| Fixtures | Competition / Draw |
| Matches | (no sidebar item) |
| Operator Panel | Live Control |
| Display & Broadcast | (section inside Live Control) |
| Scorers | Officials (or keep “Scorers” only inside Participants) |
| Categories | Events |
| Publish / Summary | Results → Summary |

---

## 7. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| Power users bookmark `/matches`, `/courts`, etc. | Medium | Permanent redirects; do not delete handlers in early phases |
| Hiding Matches before Schedule auto-materializes playable matches | **High** | Do not remove Matches capabilities until Schedule/Live Control can create/start the same match records |
| Merging too many forms into one Setup page | Medium | Tabs/sections + progressive disclosure; do not one long scrolling form |
| Scorer dual-auth confusion remains after IA move | Medium | IA move alone won’t fix PIN model; track as follow-up UX inside Officials + Live Control |
| Brand Assets buried too deep | Low | Dedicated Setup section + Dashboard quick action if branding incomplete |
| Wizard and sidebar disagree during migration | Medium | Update wizard labels in same PR as nav shell |
| Accidental feature deletion during merge | **High** | Checklist per old screen → new section; QA route matrix; no business-logic rewrites |
| Live Control becomes a junk drawer | Medium | Hard rule: only operational controls; setup editing links out to Setup/Participants/Competition |

### 7.1 Explicit non-goals (this refactor)

- Visual redesign / new design system  
- Color/token changes  
- Database schema migration  
- Scoring engine changes  
- Removing LED/OBS/scorer runtime URLs  
- Rewriting APIs  

### 7.2 Approval gates before destructive steps

**Do not proceed without approval on:**
1. Target 7-item sidebar labels (confirm wording).  
2. Brand Assets as Setup section (not primary nav) — recommended.  
3. Dissolving **Matches** as a primary screen (capabilities preserved).  
4. Any hard deletion of routes (prefer redirects indefinitely).  

---

## 8. Duplicate responsibility matrix (remove from navigation)

| Responsibility | Appears today in | Keep once in |
|----------------|------------------|--------------|
| Tournament identity | Branding, Summary, Dashboard | Tournament Setup + Dashboard read-only |
| Venue name | Branding, Courts empty-state | Tournament Setup |
| Courts | Courts, Schedule, Operator | Setup (create) + Schedule (assign) + Live Control (status) |
| Who plays whom | Fixtures, Matches | Competition |
| Court + time | Schedule, Matches, Operator | Schedule |
| Run live match | Matches, Match Control, Operator | Live Control |
| Scorer access | Scorers, Courts PIN, Operator QR, Matches links | Participants (accounts) + Live Control (day-of links) |
| Broadcast / OBS / LED | Broadcast nav, Control focus, Match links | Live Control → Displays |
| Outcomes | Results, Summary, Analytics, Dashboard | Results (+ Dashboard live snapshot) |

---

## 9. Success criteria

A first-time organizer can:

1. Open a badminton tournament.  
2. Complete Setup without asking what a Fixture or Match is.  
3. Add people under Participants.  
4. Generate a draw under Competition.  
5. Place matches on a Schedule board.  
6. Run the day from Live Control.  
7. Close out under Results.

**Test:** if any primary screen answers more than one of those jobs, it fails the redesign and must be split or merged again.

---

## 10. Recommended decision checklist (for approval)

Please confirm before implementation:

1. **Adopt 7-item IA** as specified in §4.1.  
2. **Brand Assets** = section inside Tournament Setup (not sidebar).  
3. **Matches** exits primary nav; capabilities move to Schedule + Live Control (with redirects).  
4. **Analytics** and **Publish/Summary** exit primary nav into Dashboard/Results.  
5. **Runtime URLs** (scorer/display/overlay) stay public; not sidebar items.  
6. **No route hard-deletes** in first implementation pass — redirects only.  

---

## Appendix A — File index (organizer + runtime)

```
artifacts/auction-platform/src/pages/badminton/
  analytics.tsx
  branding.tsx
  broadcast.tsx
  categories.tsx
  control-center.tsx
  courts.tsx
  display.tsx
  fixtures.tsx
  match-control.tsx
  matches.tsx
  overlay.tsx
  players.tsx
  results.tsx
  schedule.tsx
  scorer-home.tsx
  scorer.tsx
  scorers.tsx
  scoring-format.tsx
  summary.tsx
  tournament-hub.tsx

artifacts/auction-platform/src/lib/
  badminton-sport-nav.ts      ← sidebar
  badminton-routes.ts         ← catalog / mode layouts
  badminton-setup-workflow.ts ← wizard

artifacts/scoring-app/src/App.tsx  ← route table
```

## Appendix B — Current vs target sitemap (compact)

**Current**

```
Dashboard
Setup: Information, Players, Teams/Events, Scoring Format, Venues & Courts, Scorers, Fixtures, Match Schedule
Operations: Matches, Operator Panel, Results, Publish/Summary
Broadcast: Display & Broadcast
Reports: Analytics
```

**Target**

```
Dashboard
Tournament Setup          (Basics · Courts · Rules · Brand Assets)
Participants              (Players · Entries · Officials)
Competition               (Events · Draw · Format)
Schedule                  (Board · Assignments)
Live Control              (Courts · Queue · Match Control · Displays)
Results                   (Standings · Completed · Summary · Export)
```

---

*Phase 1 navigation shell is implemented in `badminton-sport-nav.ts`. Awaiting review before Phase 2 page consolidation.*
