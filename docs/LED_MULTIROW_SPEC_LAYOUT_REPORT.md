# LED Multi-Row Spec Layout Report

**Date:** 2026-06-24  
**Replaces:** Option B single-row footer (`AGE | SPEC1 | SPEC2 | SPEC3`)  
**Goal:** Scalable, broadcast-readable specification panel showing **all** `LedPlayer.specs`

---

## Executive summary

The portrait card now uses a **split layout**: ~58% photo / ~42% info footer. Specifications render in a **wrapping two-column grid** with compact `LABEL: value` rows. There is **no spec count cap**, **no truncation**, and **no hidden fields** within `LedPlayer.specs`.

---

## Before vs after

### Before (Option B — single horizontal row)

```
┌────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← photo full bleed
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  DOUBLES PLAYER · Varanasi          #3    │
│  ANIMESH THAKUR                            │
│────────────────────────────────────────────│
│ AGE │ PLAYING HAND │ STYLE │ EXPERIENCE   │  ← cramped, truncated
└────────────────────────────────────────────┘
     Court Preference hidden (4th spec cap)
```

**Problems:**
- Long labels unreadable at broadcast distance
- Hard cap at 3 specs (+ Age in 4 columns)
- Court Preference and future fields dropped
- Does not scale to 5+ specifications

### After (multi-row broadcast footer)

```
┌────────────────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← photo ~58% height
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
├────────────────────────────────────────────┤
│ DOUBLES PLAYER · Varanasi                  │  ← footer ~42%
│ ANIMESH THAKUR                             │
│────────────────────────────────────────────│
│ AGE: 48              HAND: Right Hand      │
│ STYLE: Attacking     EXP: Intermediate     │
│ COURT: Back Court                          │
└────────────────────────────────────────────┘
```

---

## Mock layout (Animesh Thakur — 4 specs + age)

```
╔══════════════════════════════════╗
║  [Portrait photo — 58% height]   ║
║                          ┌────┐  ║
║                          │ #3 │  ║
║                          └────┘  ║
╠══════════════════════════════════╣
║ DOUBLES PLAYER · Varanasi        ║
║ ANIMESH THAKUR                   ║
║ ──────────────────────────────── ║
║ AGE: 48          HAND: Right Hand║
║ STYLE: Attacking EXP: Intermediate║
║ COURT: Singles Court             ║
╚══════════════════════════════════╝
```

Center stage (unchanged): **BID STARTS AT ₹10,000**

---

## Responsive behavior

| Concern | Implementation |
|---------|----------------|
| Portrait column width (~28% of stage) | Two-column spec grid from 3+ rows; single column for 1–2 rows |
| Font scaling | `clamp()` on player name; `sm:` breakpoints on spec text |
| Long values | `break-words` — full value visible, wraps within cell |
| Long labels | Compact `shortLabel` (HAND, STYLE, EXP); full label in `title` tooltip |
| Many specs (6+) | Grid grows vertically; footer `overflow-y-auto` if panel height exceeded |
| Photo scaling | `object-cover object-top` — face stays visible in shorter frame |
| Jersey badge | Slightly smaller on narrow (`size-12` → `size-14`) |

### Grid column rules

| Total info rows (Age + specs) | Grid |
|------------------------------:|------|
| 1–2 | 1 column |
| 3+ | 2 columns (natural row wrap) |

---

## Handling spec counts

### 1 specification (+ Age)

```
AGE: 30
HAND: Left Hand
```

Grid: **1 column** (2 rows stacked).

### 2 specifications (+ Age)

```
AGE: 25
BAT: Right Hand
BOWL: Off Spin
```

Grid: **1 column** (3 stacked rows).

### 4 specifications (+ Age) — badminton full set

```
AGE: 48          HAND: Right Hand
STYLE: Attacking EXP: Intermediate
COURT: Back Court
```

Grid: **2 columns**, 3 physical rows.

### 6+ specifications

Example cricket + extensions when `LedPlayer.specs` has 6 entries:

```
AGE: 28          BAT: Right Hand
BOWL: Medium     SPEC: All-Rounder
POS: Opener      FOOT: Right
ROLE: Captain
```

Grid: **2 columns**, 4+ rows; scrolls if footer max height reached.

**Data note:** Legacy DB columns still populate at most **3** spec values unless `player_spec_values` / `specifications[]` is backfilled. The **UI shows every entry in `LedPlayer.specs`** — no UI cap. Enabling V2 + migration unlocks 4+ normalized specs (e.g. Court Preference).

---

## Label strategy

| Full label (`role_spec_groups`) | Broadcast short |
|--------------------------------|-----------------|
| Age | AGE |
| Playing Hand | HAND |
| Playing Style | STYLE |
| Experience | EXP |
| Court Preference | COURT |
| Batting Hand | BAT |
| Bowling Style | BOWL |
| *(unknown multi-word)* | Acronym (e.g. Preferred Footwork → PF) |

No hardcoded cricket strings in JSX — abbreviations come from `broadcastSpecLabel()` with alias map + dynamic acronym fallback.

---

## Files modified

| File | Change |
|------|--------|
| `artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx` | Flex split layout (58/42); multi-row spec grid; no truncate |
| `artifacts/auction-platform/src/lib/led-view/portrait-footer-stats.ts` | Removed 3-spec cap; `buildPortraitInfoRows()`; `broadcastSpecLabel()` |
| `artifacts/auction-platform/src/lib/led-view/__tests__/portrait-footer-stats.test.ts` | Updated tests for all specs + grid rules |

### Unchanged

| File | Notes |
|------|-------|
| `use-led-view.ts` | Still builds full `LedPlayer.specs[]` |
| `BidCenter.tsx` | Base/current bid in center only |
| `DisplayShell.tsx` | Portrait column width unchanged (28%) |

---

## Runtime example — Animesh Thakur

**When 4 specs populated in `LedPlayer.specs`:**

```json
{
  "name": "Animesh Thakur",
  "age": 48,
  "specs": [
    { "label": "Playing Hand", "value": "Right Hand" },
    { "label": "Playing Style", "value": "Attacking" },
    { "label": "Experience", "value": "Intermediate" },
    { "label": "Court Preference", "value": "Back Court" }
  ]
}
```

**Rendered info rows:**

| Short | Value |
|-------|-------|
| AGE | 48 |
| HAND | Right Hand |
| STYLE | Attacking |
| EXP | Intermediate |
| COURT | Back Court |

**Current production (legacy 3 columns only):** Court Preference absent from `LedPlayer.specs` until backfilled — UI will show it automatically once data exists.

---

## Visual design notes (IPL-style)

- Dark footer gradient (`from-black/90 to-black`) separates info from photo
- Accent color on values; muted uppercase labels
- Bebas Neue player name; mono spec rows
- Accent corner bar retained on photo zone
- Role badge + city unchanged above name

---

## Verification checklist

- [ ] Badminton player with 3 specs: all visible, 2-column wrap
- [ ] Player with 1 spec: single column, no empty cells
- [ ] Long spec value wraps (no ellipsis)
- [ ] 6+ specs: scroll within footer if needed
- [ ] Base price **not** in portrait footer
- [ ] Photo visibly shorter vs previous full-bleed overlay

---

## Related docs

- `docs/LED_OPTION_B_IMPLEMENTATION_REPORT.md` — superseded footer design
- `docs/LED_SPEC_RENDER_AUDIT.md` — original single-spec analysis
- `docs/LED_SPORT_AWARE_FIX_REPORT.md` — sport-aware label resolution
