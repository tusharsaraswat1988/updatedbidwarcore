# Moments Results Scores + Match Points Summary — Design Spec

**Date:** 2026-08-01  
**Status:** Approved for implementation (Approach 1)  
**Surfaces:** Results moment (venue + OBS), Boards carousel timing, Results page, Scorer home, public standings

## Goal

1. **No fake scores** — Results moment must not show `0–0` / `—` for matches that were not actually scored.
2. **15s carousel** — Results / Boards page rotation = 15 seconds.
3. **Match points summary everywhere** — Points table (P/W/L/Diff) first, then recent completed results. Owners can see the same summary on Results page, Scorer Points tab, Results moment, and a public share link.

## Rules

### Broadcastable result
Include a match only when:
- Terminal status + `winnerSide`, **and**
- At least one completed game score, **or**
- Non-scored outcome (walkover / retired / DQ / abandoned)

For walkovers: show winner + outcome label + Diff (if assigned); **never** show games `0–0`.

### Carousel
`BROADCAST_CAROUSEL_PAGE_MS = 15_000` for venue + OBS Results/Boards.

### Summary order
1. Points table pages (by category/group)  
2. Recent results pages  

### Surfaces
| Surface | Behavior |
|---------|----------|
| Results page | Summary block first; keep champions/brackets below |
| Scorer home | Tabs: Matches \| Points |
| Results moment + OBS | Standings slides then result slides |
| Public `/badminton/standings?tid=` | Read-only summary |

## Non-goals
- Boards moment content change (timing only)
- New standings ranking math
- Live scoreboard / Next moment changes
