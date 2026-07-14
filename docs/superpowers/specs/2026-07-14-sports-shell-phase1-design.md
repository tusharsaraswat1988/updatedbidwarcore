# Sports Shell Phase 1 — Config-Driven Shell for Badminton

**Date:** 2026-07-14  
**Status:** Approved  
**Scope:** Shared Sports Shell + Auction-style sidebar + Badminton organizer migration

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Phase focus | Foundation first (shell + sidebar + re-home existing pages) |
| Shell location | Inside `auction-platform`, reused by `scoring-app` via `@` alias |
| Badminton URLs | Keep `/tournament/:id/badminton/...` |
| Auction layout | Leave `AppLayout` untouched |
| Approach | Config-driven `SportsShell` mirroring Auction chrome |

## Goals

- Auction and Badminton organizer surfaces share the same shell philosophy: left sidebar, content area, brand header, account footer.
- Badminton organizer pages stop using horizontal `BadmintonHubNav` / `BadmintonOrganizerShell`.
- Future sports plug in via a nav config — no duplicate layout.
- Do not break auth, APIs, scoring logic, public/PIN/display routes, or Auction.

## Non-goals (later phases)

- Rebuild Operator Panel widgets / quick actions
- New umpire link management UX
- LED / OBS / public scoreboard management redesign
- Sport-agnostic URL cutover (`/tournament/:id/operator`)
- Merging `scoring-app` into `auction-platform`
- Migrating Auction onto `SportsShell`
- Cricket shell migration

## Architecture

```
SportsShell(nav: SportNavConfig)
  ├── SportSidebar (collapsible, sectioned)
  ├── Main content (padded or noPadding)
  └── Account footer (cloud only)

badmintonSportNav → SportNavConfig
HubPageShell → SportsShell + badmintonSportNav
```

### Types (`lib/sports-shell-types.ts`)

- `SportNavItem` — id, label, href builder, isActive, optional icon, optional external/open-in-new-tab
- `SportNavSection` — id, label, items[]
- `SportNavConfig` — sportId, sections[], optional homeHref for “All Tournaments”

### Shell (`components/sports-shell/sports-shell.tsx`)

Visual/behavioral parity with `AppLayout`:

- Collapsible sidebar (56 / 256), `localStorage` key `sports-shell-collapsed`
- Auto-collapse below 1024px
- Brand logo via existing branding hooks
- Tournament name band when `tournamentId` set
- Radial gradient content background
- `noPadding` for fullscreen child pages

Scoring-app awareness:

- “All Tournaments” and post-logout navigation use `window.location.href = "/organizer"` when pathname starts with `/scoring-app` (cross-app). In-app wouter navigation otherwise.

### Badminton nav (`lib/badminton-sport-nav.ts`)

Map existing hub destinations into sidebar sections:

1. **Main** — All Tournaments (cloud)
2. **Dashboard** — Command Center
3. **Setup** — Tournament Details, Players, Events, Scoring Rules, Courts, Tournament Draw, Court Schedule
4. **Operations** — Matches, Control Center (Operator), Results, Summary
5. **Broadcast** — Broadcast Console
6. **Insights** — Analytics

Routes unchanged. Public surfaces (scorer, LED, OBS) do not use `SportsShell`.

### Migration

Change `HubPageShell` to render `SportsShell` with `getBadmintonSportNav()`. All organizer badminton pages migrate without per-page edits.

`BadmintonHubNav` and `BadmintonOrganizerShell` remain in the repo for reference / gradual cleanup; organizer pages no longer mount them.

## Out of scope files

- `AppLayout` / auction pages
- Scorer, display, overlay pages
- API / DB / badminton-core

## Success criteria

1. Opening any `/scoring-app/tournament/:id/badminton/*` organizer page shows Auction-like left sidebar.
2. All previous hub destinations remain reachable.
3. Public scorer / LED / OBS unchanged.
4. Auction `AppLayout` unchanged.
5. Auth / logout still works from scoring-app (returns to `/organizer`).
