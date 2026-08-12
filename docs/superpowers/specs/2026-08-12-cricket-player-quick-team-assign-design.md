# Cricket Players — Quick Team Assign

**Date:** 2026-08-12  
**Status:** Approved for implementation

## Goal

On Cricket Sports Players cards (`/tournament/:id/score/players`), let organizers assign or re-assign a player’s team without opening the full Edit form.

## UI

- Placement: compact control stacked **below** the existing Edit button on each player card.
- Labels:
  - No teams in tournament → disabled grey: **no teams are defined**
  - Player has no team → **Assign team**
  - Player has a team → **Re-assign to different team**
- Click must `stopPropagation` so the card does not open Edit.
- Flow: button → small dialog with player name, selectable team list (current team pre-selected on re-assign), Cancel / Confirm.
- No “No team” / unassign option in this dialog (assign/re-assign only).

## Data

- Reuse existing `useUpdatePlayer` / `updatePlayer` with `teamId` and status (`sold` when assigned, same pattern as full form).
- Invalidate `listPlayers` after success; toast on success/failure.

## Scope

- Cricket players page only. No new API. No unassign in this control.
