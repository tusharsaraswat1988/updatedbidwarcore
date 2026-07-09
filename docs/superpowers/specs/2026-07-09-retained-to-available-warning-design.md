# Retained → Available mid-auction warning — design

**Date:** 2026-07-09  
**Status:** Approved (warn only, do not block)

## Goal

When an organizer changes a retained player to Available during a live auction, show a clear warning so they understand roster/purse/auction impact. Do not block the action.

## Behavior

- Trigger: editing a player whose saved status is `retained`, organizer selects `available`, and tournament status is `active` or `paused`.
- UI: AlertDialog explaining the player leaves the team, retained purse returns, and the player can be auctioned again.
- Cancel: keep status as `retained`.
- Confirm: apply `available` and allow save as today.
- Setup / completed: no dialog.

## Out of scope

- Server-side block
- Sold → available warning (separate case)
