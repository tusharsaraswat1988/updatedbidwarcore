# LED Option B Implementation Report

**Date:** 2026-06-24  
**Feature:** Portrait footer layout Option B — Age + dynamic sport specifications (no base price duplicate)

---

## Summary

Replaced the fixed main LED portrait footer:

**Before:** `AGE | PRIMARY SPEC | BASE`  
**After:** `AGE | SPEC1 | SPEC2 | SPEC3` (1–3 specs depending on `LedPlayer.specs`)

Base price remains only in **BidCenter** (center card: “Bid Starts At” / “Current Bid”). It is no longer shown in the portrait footer.

---

## Before layout reference

From `LED_SPEC_RENDER_AUDIT.md` / production badminton (Animesh Thakur):

```
┌─────────────────────────────────────┐
│  [Photo]                    #3      │
│                                     │
│  DOUBLES PLAYER · Varanasi          │
│  ANIMESH THAKUR                     │
│─────────────────────────────────────│
│  AGE      │ PLAYING HAND │ BASE     │
│  48       │ Right Hand   │ ₹10,000  │
└─────────────────────────────────────┘
         │                             
         └── Playing Style, Experience 
             present in LedPlayer.specs
             but NOT shown
```

**Problems addressed:**
- Base duplicated (center bid card + footer)
- Only `specs[0]` rendered
- Badminton players lost Playing Style and Experience on main portrait

---

## After layout structure

```
┌──────────────────────────────────────────────────────────┐
│  [Photo]                                          #3     │
│                                                          │
│  DOUBLES PLAYER · Varanasi                               │
│  ANIMESH THAKUR                                          │
│──────────────────────────────────────────────────────────│
│  AGE │ PLAYING HAND │ PLAYING STYLE │ EXPERIENCE         │
│  48  │ Right Hand   │ Attacking      │ Intermediate       │
└──────────────────────────────────────────────────────────┘

Center stage (unchanged):
┌─────────────────────┐
│   BID STARTS AT     │
│      ₹10,000        │  ← basePriceLabel / currentBidLabel
└─────────────────────┘
```

### Column rules

| `LedPlayer.specs` count | Footer columns |
|------------------------:|----------------|
| 0 | Age only (1 column) |
| 1 | Age \| Spec1 (2 columns) |
| 2 | Age \| Spec1 \| Spec2 (3 columns) |
| 3+ | Age \| Spec1 \| Spec2 \| Spec3 (4 columns; extras truncated) |

Specs are taken from `LedPlayer.specs` in **display order** (already sorted when built in `resolvePlayerSpecifications` / API `specifications[]`).

Labels come from `role_spec_groups.group_name` (e.g. Playing Hand, Playing Style, Experience) — no cricket-specific strings in the portrait component.

---

## Files modified

| File | Change |
|------|--------|
| `artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx` | Option B footer: dynamic grid, removed Base stat, responsive compact mode for 4 columns |
| `artifacts/auction-platform/src/lib/led-view/portrait-footer-stats.ts` | **New** — `buildPortraitFooterStats()`, `portraitFooterGridClass()` |
| `artifacts/auction-platform/src/lib/led-view/__tests__/portrait-footer-stats.test.ts` | **New** — unit tests for footer builder |

### Unchanged (already correct)

| File | Role |
|------|------|
| `use-led-view.ts` | Builds full `LedPlayer.specs[]` with sport-aware labels |
| `player-spec-display.ts` | Resolves specs from `specifications[]` or legacy + `role_spec_groups` |
| `BidCenter.tsx` | Shows base/opening bid in center — no change |

---

## Implementation details

### Footer builder

```typescript
buildPortraitFooterStats(age, specs)
// → [{ label: "Age", value: "48" }, ...specs.slice(0, 3)]
```

### Responsive LED styling

- Grid: `grid-cols-2` | `grid-cols-3` | `grid-cols-4` based on stat count
- Four-column mode: smaller label tracking, `clamp()` value font, `truncate` + `title` tooltip for long text
- `min-w-0` on cells to prevent overflow on narrow portrait panel

### Render loop (after)

```tsx
footerStats.map((stat) => (
  <Stat key={stat.label} label={stat.label} value={stat.value} compact={footerStats.length >= 4} />
))
```

---

## Runtime data example — Animesh Thakur

**Source:** Production DB, tournament 5 (badminton), `node scripts/audit-animesh-led.mjs`

### LedPlayer (input to portrait)

```json
{
  "id": "116",
  "name": "Animesh Thakur",
  "roleRaw": "Doubles Player",
  "specs": [
    { "label": "Playing Hand", "value": "Right Hand" },
    { "label": "Playing Style", "value": "Attacking" },
    { "label": "Experience", "value": "Intermediate" }
  ],
  "age": 48,
  "basePrice": 10000
}
```

### Footer stats rendered (Option B)

```json
[
  { "label": "Age", "value": "48" },
  { "label": "Playing Hand", "value": "Right Hand" },
  { "label": "Playing Style", "value": "Attacking" },
  { "label": "Experience", "value": "Intermediate" }
]
```

### On-screen result (labels uppercased via CSS)

| Age | Playing Hand | Playing Style | Experience |
|-----|--------------|---------------|------------|
| 48  | Right Hand   | Attacking     | Intermediate |

Base **₹10,000** appears only in BidCenter, not in footer.

---

## Verification checklist

- [ ] Open `/display?tournamentId=5` with Animesh Thakur on block
- [ ] Footer shows 4 columns (Age + 3 specs)
- [ ] No “Base” column in portrait footer
- [ ] Center card still shows opening/current bid
- [ ] Cricket tournament: labels reflect configured groups (e.g. Batting Hand), not hardcoded “Batting Style”
- [ ] Player with 1 spec: 2-column footer
- [ ] Run unit tests: `portrait-footer-stats.test.ts` (when vitest available in package)

---

## Related docs

- `docs/LED_SPEC_RENDER_AUDIT.md` — pre-change single-spec analysis
- `docs/LED_SPORT_AWARE_FIX_REPORT.md` — sport-aware label resolution
