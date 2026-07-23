# BidWar Sports Shell Architecture

**Date:** 2026-07-14  
**Status:** Phase 1 implemented

## Principle

Auction and scoring sports must feel like one product. Only sport-specific screens change; the application shell stays the same.

## Shells today

| Surface | Shell | Location |
|---------|--------|----------|
| Auction organizer setup | `AppLayout` | `components/layout.tsx` |
| Auction live operator | `OperatorLayout` | `components/operator-layout.tsx` |
| Scoring sports organizer | **`SportsShell`** | `components/sports-shell/` |
| Public / PIN / LED / OBS | Chrome-free pages | Per sport |

Auction remains on `AppLayout` until a later unify pass. Badminton organizer pages use `SportsShell` via `HubPageShell`.

## How a sport plugs in

1. Define destinations (path helpers + `isActive`) — e.g. `lib/badminton-routes.ts`.
2. Map them into sidebar sections — e.g. `lib/badminton-sport-nav.ts` → `SportNavConfig`.
3. Wrap organizer pages with `SportsShell` (Badminton: `HubPageShell`).

```tsx
<SportsShell tournamentId={id} nav={getBadmintonSportNav()}>
  {children}
</SportsShell>
```

## Key files

| File | Role |
|------|------|
| `lib/sports-shell-types.ts` | `SportNavItem` / `SportNavSection` / `SportNavConfig` |
| `components/sports-shell/sports-shell.tsx` | Shared sidebar + content chrome |
| `lib/badminton-sport-nav.ts` | Badminton sidebar config |
| `components/badminton/form-ui.tsx` → `HubPageShell` | Migration seam |
| `docs/superpowers/specs/2026-07-14-sports-shell-phase1-design.md` | Phase 1 design |

## Routing (Phase 1)

Badminton organizer URLs stay under `/tournament/:id/badminton/...` (served from `/scoring-app`).

Public surfaces stay match-scoped (`/badminton/:matchId/score|display|overlay`).

Sport-agnostic paths (`/tournament/:id/operator`, etc.) are a later phase.

## Future sports

Add `getCricketSportNav()`, `getFootballSportNav()`, etc. Reuse `SportsShell`. Do not fork a second sidebar.

## Later phases (not done)

- Operator Panel widget rebuild
- Umpire / LED / OBS / public link management cards
- Role-based nav filtering in the shell
- Extract sports UI out of `auction-platform` into scoring-app / sports packages (see `docs/architecture/platform-architecture-audit.md`)
- Migrate Auction onto `SportsShell` only if product wants one shell (Auction may stay on `AppLayout`)
- Sport-agnostic URL cutover (`/api/badminton/*`, etc.)
