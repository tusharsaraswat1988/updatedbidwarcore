# Public Tournament Experience — Phase 1

**Date:** 2026-08-07  
**Status:** Complete  
**Canonical URL:** `/scoring-app/tournament/:id/cricket`

---

## 1. Features completed

- Single public tournament home with hero (banner/logo), status, venue, dates, sponsors, current stage, live match CTA, and quick links
- Fan navigation: Tournament → Matches → Standings → Teams → Players → Statistics → Sponsors
- Live match highlighted in sticky nav strip and on home/match browser (no searching required)
- Today’s matches + Live / Upcoming / Completed counts
- Standings with Top 4 qualification band + NRR (reuses `StandingsTable`)
- Top players / statistics tabs: Runs, Wickets, SR, Economy, Sixes, Fours (reuses leaderboard APIs)
- Recent results, awards-driven announcements board, sponsors strip + sponsors page
- Match browser with Live / Today / Completed / Upcoming filters + search
- Match page: read-only Match Center scorecard (no organizer controls)
- Teams index + enriched team profile (logo, captain when role present, P/W/L/NRR, squad, results)
- Players index + enriched player profile (photo, team, batting/bowling, awards)
- Auction-platform redirects for all new public leaves

## 2. Files changed

### API (minimal enrichment of existing public schedule)
- `artifacts/api-server/src/lib/scoring-foundation-service.ts`

### Shared libs / types / utils
- `artifacts/auction-platform/src/lib/tournament-navigation.ts`
- `artifacts/auction-platform/src/lib/public-tournament-types.ts` *(new)*
- `artifacts/auction-platform/src/lib/public-tournament-utils.ts` *(new)*

### Components
- `artifacts/auction-platform/src/components/scoring/public-tournament-shell.tsx` *(new)*
- `artifacts/auction-platform/src/components/scoring/public-match-card.tsx` *(new)*
- `artifacts/auction-platform/src/components/scoring/public-sponsors-strip.tsx` *(new)*
- `artifacts/auction-platform/src/components/scoring/standings-table.tsx`
- `artifacts/auction-platform/src/components/scoring/leaderboard-table.tsx`

### Pages
- `artifacts/auction-platform/src/pages/scoring-public.tsx` *(hub rewrite)*
- `artifacts/auction-platform/src/pages/scoring-public-matches.tsx` *(new)*
- `artifacts/auction-platform/src/pages/scoring-public-standings.tsx` *(new)*
- `artifacts/auction-platform/src/pages/scoring-public-teams.tsx` *(new)*
- `artifacts/auction-platform/src/pages/scoring-public-players.tsx` *(new)*
- `artifacts/auction-platform/src/pages/scoring-public-statistics.tsx` *(new)*
- `artifacts/auction-platform/src/pages/scoring-public-sponsors.tsx` *(new)*
- `artifacts/auction-platform/src/pages/scoring-match-public.tsx`
- `artifacts/auction-platform/src/pages/scoring-team-public.tsx`
- `artifacts/auction-platform/src/pages/scoring-player-public.tsx`

### Routing
- `artifacts/scoring-app/src/App.tsx`
- `artifacts/auction-platform/src/platform-app.tsx`

## 3. Existing modules reused

- `CricketPublicShell` / cricket page chrome (not SportsShell — organizer-only)
- `ScorecardView` (Match Center read-only)
- `StandingsTable`, `LeaderboardTable`, `ShareButtons`
- Public APIs: `public/schedule`, standings, leaderboards, scorecard, team/player profiles, awards, live display
- Sponsor priority parsers (`parseSponsorLogos` / `getSponsorsByPriority`)
- Franchise team registry logos / squad data via existing public team profile

## 4. New APIs (minimal)

**None.** Existing `GET …/scoring/public/schedule` was enriched with public-safe branding fields only:

- `status`, `scoringPhase`, `venue`, `city`, `logoUrl`, `matchDates`
- `sponsorLogos`, `mainBannerUrl`, `mainBannerEnabled`
- `variantId`, `presentationProfileId`
- Team `logoUrl`, `squadCount`

No duplicate scoring, standings, or statistics endpoints.

## 5. Remaining public experience gaps (Phase 2+)

- Organizer-authored announcements / news CMS (Phase 1 derives announcements from live match + stage + MoM awards)
- Explicit captain field on franchise team identity (today inferred from squad role containing “captain”)
- Presentation-profile-driven layout variants (`corporate_box` theme tokens on public chrome)
- SSE on hub (still polling; live scoreboard SSE already exists for LED)
- Dedicated SEO/Open Graph share cards beyond current `ShareButtons`
- Public fixtures/knockout bracket visualization
- Badminton public tournament tree parity

## 6. Demo impact

Share one link: `/scoring-app/tournament/{id}/cricket`

A spectator can follow the full Corporate Box tournament without login:

1. Land on branded hub → see live match immediately if in progress  
2. Browse matches with filters  
3. Open any scorecard (read-only Match Center)  
4. Check Top 4 standings / NRR  
5. Open teams and players  
6. Scan statistics + awards  
7. View sponsors  

Organizer Mission Control, Runtime, Rule Engine, Presentation Engine, Reducer, Auction, and Badminton were not modified.
