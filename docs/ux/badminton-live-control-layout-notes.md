# Mission Control — Phase 3 / 3.1

**Status:** Operational command center + Phase 3.1 polish.  
**Phase 2 IA:** Frozen.

## Layout

```
TOP BAR     Status · Global primary action · Emergency pause / Resume screens
HEALTH      Internet · Realtime · Broadcast · Venue · OBS · Scorers
ATTENTION   Needs Attention (problem · court · reason · action · dismiss)
SUGGESTIONS Optional smart moves (never auto-applied)
LEFT        Live Courts (sorted LIVE → DELAYED → READY → WAITING → EMPTY → FINISHED)
RIGHT       Quick Ops + Live activity feed
BOTTOM      Ready · Upcoming · Recently finished
ADVANCED    Collapsed developer diagnostics
```

## Phase 3.1 ops (client-only)

- Attention from board state (delayed, waiting, assign next, missing PIN, broadcast focus, venue standby)
- Primary action label adapts to tournament state
- Start blockers explain why (never silent disable)
- Focus court → existing primary-broadcast API
- Emergency → venue standby + sponsor overlay (existing presentation API)
- Activity feed from local board transitions

## Constraints

No new APIs · No IA changes · No design-system rewrite
