# Organizer Dashboard Module Chooser — Design

**Date:** 2026-08-10  
**Status:** Superseded UX — module actions live on the tournament card (no dialog chooser)  
**Surface:** Organizer Dashboard tournament cards (`OrganizerDashboard` in `organizer-portal.tsx`)

## Problem

Tournament cards currently navigate straight into Auction (`/tournament/:id`). Organizers need an explicit choice between **Auction** and **Scoring** before entering a product. Scoring exists for cricket and badminton only, is incomplete, and is gated by admin + platform flags. Other sports should show **Coming Soon**.

## Decisions (approved)

1. **Chooser first** — card click opens a small dialog; it does not navigate immediately.
2. **Cricket/Badminton without admin scoring** — Scoring option visible but **disabled**, with helper text: “Ask admin to enable scoring”.
3. **Other sports** — Scoring option **disabled** + label **Coming Soon**.
4. **UI pattern** — compact dialog chooser (not inline expand / popover).

## Scoring availability matrix

| Condition | Scoring control |
|-----------|-----------------|
| Sport ∈ {cricket, badminton} AND `scoringEnabled === true` AND platform sport gate ON (`useTournamentScoringActive`) | Enabled → open Sports Mission Control |
| Sport ∈ {cricket, badminton} but scoring not active (admin off and/or platform gate off) | Disabled + “Ask admin to enable scoring” |
| Any other sport | Disabled + “Coming Soon” |

**Auction** is always available when the organizer account is not locked → `/tournament/:id`.

## Destinations

| Action | Destination |
|--------|-------------|
| Open Auction | Same-tab navigate to `/tournament/:id` (existing Auction Overview) |
| Open Scoring (when active) | Same-tab navigate to `scoringAppHomePath(tournamentId, sport)` → `/scoring-app/tournament/:id/mission-control` |

Locked organizer account: card remains non-interactive (current behavior); chooser does not open.

## Card chrome (unchanged except click)

- Sport badge, license badge, name, status, city/venue/date stay as today.
- Footer actions stay on the card and **must** `stopPropagation`:
  - Download auction rules
  - Record in-person consent
- External-link affordance may remain as visual cue that the card opens a destination flow (chooser).

## Dialog UX

- Title: tournament name (or “Open tournament”).
- Two primary actions stacked (or side-by-side on `sm+`):
  1. **Open Auction** — always enabled (unless account locked; dialog won’t open then).
  2. **Open Scoring** — state per matrix above; when disabled, show muted style + helper line under the button.
- Dismiss: Escape / overlay / Cancel closes without navigation.
- Focus: trap in dialog; first focus on Open Auction.

## Data requirements

Organizer tournament list today **does not** expose `scoringEnabled`.

1. Extend `toOrganizerTournamentListItem` to include `scoringEnabled: boolean`.
2. Extend client types:
   - `OrganizerAccountTournament`
   - local `Tournament` in `organizer-portal.tsx` (if still duplicated)
3. Chooser uses `usePlatformFeatures` / `useTournamentScoringActive(sport, scoringEnabled)` — same gates as Mission Control and SportsShell.

No new APIs beyond list-item field.

## Implementation touchpoints

| Area | Change |
|------|--------|
| `artifacts/api-server/src/lib/organizer-tournament-list-item.ts` | Add `scoringEnabled` |
| `artifacts/auction-platform/src/lib/organizer-account-auth-cache.ts` | Type field |
| `artifacts/auction-platform/src/pages/organizer-portal.tsx` | Chooser dialog; card `onClick` opens dialog; wire destinations |
| Optional small helper | Pure function mapping sport + flags → scoring CTA state (`active` \| `needs-admin` \| `coming-soon`) for unit test |

## Out of scope

- Building scoring for sports other than cricket/badminton
- Changing Auction Overview or Sports Mission Control internals
- Deep-linking into a specific cricket/badminton sub-page (home remains Mission Control)
- Changing admin enable UI (already exists)

## Testing

- Unit: scoring CTA state helper (cricket on/off, badminton on/off, football → coming soon, platform gate off → needs-admin).
- Manual: locked account; rules/consent still work without chooser; Auction path; Scoring path when enabled; disabled copy when not.

## Success criteria

- Card never jumps straight into Auction without the chooser.
- Organizers can enter Auction or Scoring from one place.
- Scoring never appears “live” unless admin + platform gates allow it for cricket/badminton.
- Non-scoring sports show Coming Soon, not a broken link.
