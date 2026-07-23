# Mission Control — Phase 3

**Status:** Implemented as operational command center (not a dashboard).  
**Phase 2 IA:** Frozen — do not change sidebar, chapters, continue flow, or routing.

## Layout (`control-center.tsx` + `mission-control/*`)

```
TOP BAR     Tournament · clock · Live / Ready / Delayed / Completed · alerts · Start next
LEFT        Live Courts (court cards)
RIGHT       Quick Ops — Venue · OBS · Scorer Home · Announcements · Screens follow · Emergency
BOTTOM      Ready · Upcoming · Recently finished
ADVANCED    Collapsed developer diagnostics
```

## Court card (ops unit)

Court → Current match → Next match · status · scorer · Broadcast/LED/OBS following ·  
Open scoring · Pause · Resume · Finish · Reconnect scorer · Follow on screens · Assign next

## Constraints

- No KPI dashboard / graphs / analytics
- No new APIs — pause/resume/force-end, primary-broadcast, presentation scenes, match PATCH, force-unlock
- Setup / draw / import stay out of this page
