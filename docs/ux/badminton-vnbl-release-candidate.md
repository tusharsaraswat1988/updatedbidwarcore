# BidWar VNBL — Release Candidate Freeze

**Status:** RELEASE CANDIDATE  
**Date:** 2026-07-23  
**Module:** Badminton / Mission Control

## Approved phases (frozen)

| Phase | Status |
|-------|--------|
| Phase 1 — Navigation IA | Approved · Frozen |
| Phase 2 — Page consolidation | Approved · Frozen |
| Phase 2.5 — IA polish | Approved · Frozen |
| Phase 3 — Mission Control | Approved · Frozen |
| Phase 3.1 — Operational excellence | Approved · Frozen |

Git baseline tags:

- `badminton-phase2-complete` — end of Phase 2 / 2.5
- `badminton-vnbl-rc1` — Mission Control Release Candidate (this freeze)

## Allowed work only

1. Bug fixes  
2. Performance improvements  
3. Stability improvements  
4. Accessibility improvements  
5. Micro UX — only if it removes operator confusion  

## Not allowed

- New features or pages  
- Navigation / Information Architecture changes  
- Backend / API / database changes  
- Scoring or scheduling engine changes  
- Broadcast protocol changes  
- Visual redesign  

## Release validation — simulation checklist

Verify every step can be completed from **Mission Control** where operational:

- [ ] Create tournament  
- [ ] Import players  
- [ ] Generate draw  
- [ ] Assign courts  
- [ ] Assign scorers  
- [ ] Schedule matches  
- [ ] Run four simultaneous courts  
- [ ] Reconnect scorer  
- [ ] Pause court  
- [ ] Resume court  
- [ ] Delay match  
- [ ] Move match  
- [ ] Start next match  
- [ ] Broadcast switch  
- [ ] Venue Display switch  
- [ ] OBS follow  
- [ ] Sponsor scene  
- [ ] Emergency announcement  
- [ ] Emergency pause  
- [ ] Resume tournament  
- [ ] Finish finals  
- [ ] Publish results  

## Performance to measure

- First load  
- Mission Control rendering  
- Court updates  
- Realtime latency  
- Presentation switching  
- Memory usage  
- Long-running session  
- Browser stability  

## Reliability target

- Continuous Mission Control session ≥ **8 hours**  
- No refreshes, memory leaks, stale state, or broken realtime  

## Operator testing

- Untrained operator, no explanation  
- Record every “Where is this?” / “What should I do?”  
- Fix only real usability issues (within allowed work)  

## Release goal

Tournament director opens Mission Control at the start of the day and does not need another operational page.
