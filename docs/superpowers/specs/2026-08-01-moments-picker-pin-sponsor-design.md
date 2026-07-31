# Moments Picker + Pin Sponsor — Design Spec

**Date:** 2026-08-01  
**Status:** Approved for implementation (Approach 1)  
**Surface:** Mission Control ops rail → Venue LED + OBS

## Goal

1. **Next match** — operator picks which upcoming match to show (venue + OBS).
2. **Sponsor moment** — operator picks which sponsor fills the full-screen moment (venue + OBS).
3. **Pin sponsor** — separate control pins one sponsor on live scoreboard/OBS chrome until unpin.

## Operator flows

### Next
Tap **Next** → compact sheet of upcoming matches → tap row → push `venueScene` + `overlayScene` = `next` with `upNextMatchId`. Stays until Clear / another moment.

### Sponsor (full-screen)
Tap **Sponsor** → sponsor sheet → tap row → push sponsor scenes with `spotlightSponsorUrl`. Stays until Clear / another moment. Showcase shows that sponsor only.

### Pin sponsor
Tap **Pin sponsor** → same sponsor list → sets `pinnedSponsorUrl` (no scene change). Live chrome shows that sponsor in the scoreboard-sponsor slot (and chyron freezes to it). **Unpin** clears the pin. Independent of Moments Clear.

## Data (broadcast block in scoring settings)

| Field | Type | Meaning |
|-------|------|---------|
| `upNextMatchId` | `number \| null` | Selected match for Next moment |
| `spotlightSponsorUrl` | `string \| null` | Selected sponsor for full-screen Sponsor moment |
| `pinnedSponsorUrl` | `string \| null` | Live-board pin until unpin |

Patched via existing `PATCH …/broadcast-presentation`.

## Display rules

- **Next:** resolve `upNextMatchId` among upcoming candidates; if invalid/missing → empty “No upcoming match”.
- **Sponsor moment:** if spotlight URL set and found → single-sponsor showcase; else rotate all (legacy).
- **Pin:** if pinned URL found → override `scoreBoardSponsor` crest + chyron/carousel to that logo only while live scenes show.

## Explicit non-goals

- Auto-picking Next without confirmation
- Pin as a full-screen moment
- Changing branding editor sponsor list CRUD
