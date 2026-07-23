# Live Control — Layout coexistence notes (Phase 2.5)

**Status:** Architecture only — no redesign in this pass.  
**Purpose:** Confirm Broadcast / Venue / OBS / Courts / Queue can share one Mission Control page before Phase 3.

## Current composition (`control-center.tsx`)

Top → bottom:

1. **IA chrome** — title, purpose, workflow strip, section tabs (`Courts & Queue` | `Live Displays`)
2. **Live Displays panel** (`BadmintonBroadcastDirectorPanel`, `#broadcast`) — venue scoreboard + OBS overlay + scorer home links
3. **Idle guidance** (when no live/ready) — soft banner, does not hide courts
4. **Status KPIs** — Live / Ready / Delayed / Empty / Finished
5. **Court cards** — status, current/next match, open scoring, scorer PIN/QR
6. **Waiting / Ready lists** — upcoming + ready
7. **Recently completed**

## Coexistence verdict

| Surface | Conflict risk | Notes |
|---------|---------------|-------|
| Courts board | Low | Primary vertical stack; remains when idle |
| Queue lists | Low | Below courts; empty copy points to Schedule |
| Live Displays | Medium | Always mounted today; tab `focus=broadcast` only highlights — does not hide courts |
| OBS / Venue URLs | None | External fullscreen routes; only links live here |
| Scorer QR dialogs | None | Modal overlay |

## Pre–Phase 3 recommendation (do not implement yet)

- Keep **one scrollable Mission Control** (not separate Broadcast page).
- Prefer **progressive disclosure**: collapse Live Displays unless tab/focus is active, so court ops stay above the fold on match day.
- Do not move court creation, player import, or draw tools into Live Control.

## Explicit non-goals for Phase 3 prep

- No new broadcast APIs
- No OBS protocol changes
- No court card redesign in Phase 2.5
