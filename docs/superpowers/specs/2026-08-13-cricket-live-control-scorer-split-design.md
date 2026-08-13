# Cricket Live Control vs Scorer — phased split

**Date:** 2026-08-13  
**Status:** Implementing C1 + C2 (C3 next)  
**Approved:** Full badminton-style split (option C), phased

## Problem

The ball pad at `/tournament/:id/score/:matchId/live` is labelled **Live Control**. In badminton, Live Control is organizer ops (scoreboard / OBS / queues). Scoring belongs to **Scorer** (umpire or assigned scorer).

## Names

| Name | Role | Path |
|---|---|---|
| **Scorer** | Ball-by-ball pad | `/tournament/:id/score/:matchId/live` (URL kept for bookmarks) |
| **Live Control** | Organizer: queues, LED, OBS, open Scorer | `/tournament/:id/score/live-control` |
| **Match Center** | One-match ops / scorecard | `/tournament/:id/score/:matchId` |
| **Scorer Home** (C3) | PIN login + pick match | TBD — not this drop |

## Phases

### C1 — Rename (this drop)

- Pad titles/eyebrows: **Scorer**, not Live Control.
- Match Center CTA: **Open Scorer**.
- Helper: `cricketScorerPath`. `cricketLiveControlPath` becomes tournament Live Control.

### C2 — Organizer Live Control (this drop)

- Sidebar **Live Control** (after Matches & Scoring).
- Page: live / upcoming / recent matches; LED + OBS; Open Scorer; copy scorer link; Match Center.
- Tournament Dashboard Live Ops: Live Control first; peek lines mention Live Control.

### C3 — Scorer accounts (next)

- Officials scorers get personal PIN like badminton.
- Scorer Home + pad on scorer JWT (outside SportsShell).
- Organizer can still open Scorer for backup.

## Out of scope now

- Cloning badminton court board / Mission Control internals.
- Changing the pad URL (`/live` stays).
- Full scorer lock/heartbeat.
