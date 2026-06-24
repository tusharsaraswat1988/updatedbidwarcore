# LED Spec Render Audit

**Date:** 2026-06-24  
**Scope:** Main LED portrait card (`PlayerPortrait.tsx`) — specification slot rendering  
**Example player:** Animesh Thakur (`players#116`, tournament 5, badminton)

---

## 1. How many specification slots are intentionally rendered?

**One (1) specification slot** on the main portrait card.

The footer uses a fixed **3-column grid**, but only **one column** is reserved for a player specification:

| Column | Field | Source |
|--------|-------|--------|
| 1 | Age | `currentPlayer.age` |
| 2 | **One spec** | `currentPlayer.specs[0]` only |
| 3 | Base | `basePriceLabel` |

So the portrait intentionally renders **1 spec slot**, not 3 spec slots. The grid has 3 columns total (Age + spec + Base), not Age + 3 specs.

---

## 2. Is only `specs[0]` displayed?

**Yes** on the main portrait card.

```17:17:artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx
  const primarySpec = currentPlayer?.specs[0];
```

```87:94:artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx
        <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-white/15">
          <Stat label="Age" value={String(currentPlayer.age)} />
          <Stat
            label={primarySpec?.label ?? "—"}
            value={primarySpec?.value ?? "—"}
          />
          <Stat label="Base" value={basePriceLabel} />
        </div>
```

There is **no** `.map()` over `specs` on the main portrait. Only index `0` is read.

**Contrast — side LED renders all specs:**

```133:135:artifacts/auction-platform/src/components/display/side/SidePlayerProfilePanel.tsx
          {player.specs.map((spec) => (
            <ProfileStat key={spec.label} label={spec.label} value={spec.value} />
          ))}
```

---

## 3. Are `specs[1]`, `specs[2]`, `specs[3]` available in runtime data?

**For Animesh Thakur — yes for indices 1 and 2; no for index 3 (no value).**

Live DB query (`scripts/audit-animesh-led.mjs`, production Neon, 2026-06-24):

| Index | Label | Value | In `LedPlayer.specs`? | Rendered on portrait? |
|------:|-------|-------|----------------------|------------------------|
| 0 | Playing Hand | Right Hand | Yes | **Yes** |
| 1 | Playing Style | Attacking | Yes | No |
| 2 | Experience | Intermediate | Yes | No |
| 3 | Court Preference | *(empty)* | No | No |

**Data layer capacity:**

| Source | Max specs |
|--------|-----------|
| Legacy columns (`batting_style`, `bowling_style`, `specialization`) | 3 slots |
| `player_spec_values` + `role_spec_groups` | Unlimited (per role config) |
| Badminton Doubles Player role config | **4 groups** configured |

Animesh has **3 populated legacy values** → `resolvePlayerSpecifications()` produces **3 entries** in `LedPlayer.specs`.  
`player_spec_values` rows for this player: **0** (V2 backfill not applied).  
`specifications[]` on API: **empty** until `PLAYER_SPECS_V2_ENABLED` + migration.

**Summary:** `specs[1]` and `specs[2]` exist at runtime and are discarded by the portrait UI. `specs[3]` does not exist because Court Preference has no stored value.

---

## 4. LedPlayer JSON — Animesh Thakur

Reconstructed from production DB using the same pipeline as `use-led-view.ts` → `toLedPlayer()` → `resolvePlayerSpecifications()` (with `role_spec_groups` labels):

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
  "basePrice": 10000,
  "city": "Varanasi",
  "age": 48,
  "serialNo": 3,
  "portrait": "https://res.cloudinary.com/dja0upxxe/image/upload/v1782320718/bidwar/zkg5ozkfncbn1wipwqs7.jpg",
  "gender": "M",
  "status": "available",
  "soldToTeamId": null,
  "soldPrice": null,
  "achievements": "Player of Tournament 2025 VNBL 2.0",
  "categoryName": null
}
```

**API inputs that produced this:**

```json
{
  "playerId": 116,
  "tournamentId": 5,
  "tournamentSport": "badminton",
  "battingStyle": "Right Hand",
  "bowlingStyle": "Attacking",
  "specialization": "Intermediate",
  "specifications": [],
  "roleSpecGroupLabels": [
    "Playing Hand",
    "Playing Style",
    "Experience",
    "Court Preference"
  ]
}
```

**What the portrait actually shows from this object:**

| Label (CSS uppercase) | Value |
|-----------------------|-------|
| AGE | 48 |
| PLAYING HAND | Right Hand |
| BASE | ₹10,000 (formatted) |

Playing Style and Experience are **present in `LedPlayer.specs` but not shown**.

---

## 5. Current render loop

### Main portrait (`PlayerPortrait.tsx`) — no spec loop

```
LedView.currentPlayer
  └─ specs[0]  →  primarySpec
       └─ <Stat label={primarySpec.label} value={primarySpec.value} />

specs[1..n]  →  not referenced
```

Full render path:

1. `useLedView(tournamentId)` fetches tournament, auction state, players, categories.
2. `useRoleSpecMap(tournament.sport, players)` loads `role_spec_groups` labels per role.
3. `toLedPlayer(p, …, specGroupLabels)` calls `resolvePlayerSpecifications(p, { specGroupLabels })`.
4. `LedPlayer.specs` = ordered array (0..n-1).
5. `PlayerPortrait` reads **only** `specs[0]` into `primarySpec`.
6. Footer renders **three fixed `<Stat>` components** (Age, primarySpec, Base) — not a loop.

### Side portrait (`SidePlayerProfilePanel.tsx`) — full spec loop

```
player.specs.map((spec) => (
  <ProfileStat key={spec.label} label={spec.label} value={spec.value} />
))
```

### Data resolution (`resolvePlayerSpecifications`)

```
if player.specifications[] present
  → map all normalized specs (all indices available)

else legacy fallback
  → battingStyle  → specs[0]  (label from role_spec_groups[0])
  → bowlingStyle  → specs[1]  (label from role_spec_groups[1])
  → specialization → specs[2] (label from role_spec_groups[2])
  → (no legacy slot for index 3+ even if role has more groups)
```

---

## 6. Classification

**Question:** If only the first specification is rendered, is this intentional design, unfinished migration, or a bug?

### Verdict: **Intentional design (legacy broadcast layout) — with unfinished migration relative to multi-sport**

| Evidence | Points to |
|----------|-----------|
| Fixed `grid-cols-3` with Age \| one field \| Base matches original cricket demo (`Bat` / `battingHand`) | **Intentional design** |
| Single `primarySpec = specs[0]` — explicit, not accidental omission | **Intentional design** |
| Architecture doc lists open decision: *"LED spec count on portrait: Fixed 3 vs. configurable per tournament"* | **Intentional, not yet product-resolved** |
| Data layer now produces full `specs[]` with sport-aware labels; side LED already maps all specs | **Unfinished migration** |
| Animesh has 3 specs in runtime data; portrait shows 1 — data/UI mismatch | **Unfinished migration** |
| Not a runtime error or wrong label for slot 0 (after recent fix) | **Not a bug** |

**Not classified as bug** because the component behaves as coded: one highlight stat in a tight broadcast footer. The “Playing Style” and “Experience” values are available but intentionally excluded from this layout.

**Not fully intentional for multi-sport** because:
- Badminton roles can define **4+ spec groups**.
- Legacy storage caps fallback at **3 slots**.
- Side panel already shows **all** specs — inconsistent UX across LED variants.

---

## 7. Surface comparison

| Surface | Spec slots rendered | Loop |
|---------|--------------------:|------|
| Main portrait (`PlayerPortrait`) | **1** (`specs[0]`) | No |
| Side profile (`SidePlayerProfilePanel`) | **All** `specs.length` | Yes — `.map()` |
| Demo/mock (`lovableupdates`) | **1** (`battingHand`) | No |

---

## 8. Recommendations (informational)

1. **Product decision:** Keep single highlight spec on main portrait vs. expand grid (e.g. 2×2 or scrollable row).
2. **If keeping one slot:** Document which spec wins (currently `displayOrder` first = Playing Hand).
3. **If showing more:** Replace fixed 3-column footer or add secondary chyron for specs[1..n].
4. **Data:** Run spec backfill so `specifications[]` is authoritative; Court Preference for Animesh is unrecoverable from legacy columns alone.

---

## 9. Reproduce

```bash
node scripts/audit-animesh-led.mjs
```

Outputs live `ledPlayer` JSON and `specsAvailableButNotRendered` for Animesh Thakur.
