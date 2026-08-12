# Cricket Sports Teams & Players — Design

**Date:** 2026-08-10  
**Status:** Approved for implementation  
**Surface:** Cricket SportsShell (`/scoring-app/tournament/:id/score/teams`, `/players`)

## Decisions

1. Empty-first roster UX: **Import from Auction** + manual add (option A).
2. Teams: import Auction franchises **and** create teams in Sports (option C).
3. Separate sidebar entries: **Teams** and **Players** (option B).
4. Approach: thin Sports UI over existing Auction team/player APIs + `handoff-to-sports` for Sports roster readiness (badminton IA, cricket data model).

## Behavior

| Page | Empty state | Actions |
|------|-------------|---------|
| Teams | Copy + CTAs | Import from Auction (handoff/sync), Add Team |
| Players | Copy + CTAs | Import from Auction (handoff/sync), Add Player |

- List/create use `/api/tournaments/:id/teams` and `/players` (same rows Auction uses).
- Import runs `POST …/auction/handoff-to-sports` then refreshes lists (makes squads Sports-ready).
- Officials remain a separate nav item.

## Out of scope

- New `cricket_players` tables
- Badminton changes
- Auction Players page redesign
