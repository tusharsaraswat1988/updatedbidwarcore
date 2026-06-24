# LED Sport-Aware Fix Report

**Date:** 2026-06-24  
**Issue:** Badminton LED portrait showed `AGE | BATTING STYLE | BASE` with value `Right Hand` instead of sport-specific labels like `PLAYING HAND`.

---

## Executive summary

The LED portrait component (`PlayerPortrait.tsx`) was already wired to show **dynamic** spec labels via `currentPlayer.specs[0].label`. The bug was upstream: spec resolution fell back to **hardcoded cricket labels** (`"Batting Style"`) whenever the API did not return a `specifications[]` array — which is the common case when `PLAYER_SPECS_V2_ENABLED=false` and/or auction state omitted normalized specs.

**Fix:** Resolve legacy column values (`batting_style`, etc.) using **labels from `role_spec_groups`** (fetched per tournament sport + player role). Also include `specifications[]` in auction state when V2 is enabled.

---

## 1. Where `"BATTING STYLE"` came from

| Layer | File | Source |
|-------|------|--------|
| **Root cause** | `artifacts/auction-platform/src/lib/player-spec-display.ts` | `LEGACY_SPEC_SLOTS` mapped slot 0 → label `"Batting Style"` |
| **Display** | `artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx` | `primarySpec?.label` from `currentPlayer.specs[0]` (correct — label was wrong in data) |
| **Pipeline** | `artifacts/auction-platform/src/lib/led-view/use-led-view.ts` | `toLedPlayer()` → `resolvePlayerSpecifications(player)` with no sport context |

The portrait renders:

```tsx
<Stat label={primarySpec?.label ?? "—"} value={primarySpec?.value ?? "—"} />
```

So `"BATTING STYLE"` (uppercased by CSS) was **`primarySpec.label`**, not a hardcoded string in the portrait component.

---

## 2. Why badminton did not use `role_spec_groups` labels

Three gaps:

1. **Auction API** (`artifacts/api-server/src/routes/auction.ts`) serialized `currentPlayer` with `publicAuctionPlayerSerializer` only — **no `specifications[]`**, even when V2 is enabled and `player_spec_values` exist.

2. **List players API** does attach `specifications[]` when V2 is enabled, but LED prioritizes `state.currentPlayer` from auction state during live bidding — that object lacked specs.

3. **Client fallback** in `resolvePlayerSpecifications()` used cricket-shaped labels whenever `specifications` was absent, instead of calling `/api/sports/roles/{id}/specs` (via `useRoleSpecMap`).

For badminton tournament 5, players store hand data in legacy `batting_style = "Right Hand"` (dual-write slot 0). Without V2 read path or sport labels, the client labeled it `"Batting Style"`.

---

## 3. Legacy vs normalized data

| Data path | Used by LED? | Badminton example |
|-----------|--------------|-------------------|
| `player.specifications[]` (`player_spec_values` + `role_spec_groups.group_name`) | **Preferred** when present | `{ groupName: "Playing Hand", value: "Right Hand" }` |
| `player.battingStyle` (legacy column) | **Fallback** when specs absent | `"Right Hand"` stored in cricket-shaped column |
| Hardcoded `"Batting Style"` label | **Removed** | Was applied to legacy slot 0 |

**Runtime data source (before fix):**

```
GET /api/tournaments/{id}/auction/state
  → currentPlayer.battingStyle = "Right Hand"
  → currentPlayer.specifications = undefined  (V2 off or not serialized)

resolvePlayerSpecifications({ battingStyle: "Right Hand" })
  → [{ label: "Batting Style", value: "Right Hand" }]   ← bug

PlayerPortrait
  → AGE | BATTING STYLE | BASE
```

**Runtime data source (after fix):**

```
GET /api/tournaments/{id}  → sport = "badminton"
GET /api/sports/by-slug/badminton/roles + /api/sports/roles/{id}/specs
  → role_spec_groups: ["Playing Hand", "Playing Style", ...]

GET /api/tournaments/{id}/auction/state
  → currentPlayer.battingStyle = "Right Hand"
  → currentPlayer.specifications = [...]  (when PLAYER_SPECS_V2_ENABLED=true)

resolvePlayerSpecifications(
  { battingStyle: "Right Hand", specifications: [...] },
  { specGroupLabels: ["Playing Hand", "Playing Style"] }
)
  → [{ label: "Playing Hand", value: "Right Hand" }]

PlayerPortrait
  → AGE | PLAYING HAND | BASE
```

---

## 4. Changes made

### 4.1 `player-spec-display.ts`

- Removed hardcoded `LEGACY_SPEC_SLOTS` cricket labels.
- Added optional `specGroupLabels` (from `role_spec_groups`) for legacy fallback.
- Added `specGroupLabelsForRole()` helper.
- Legacy slots without labels use neutral `Spec 1`, `Spec 2` — **never** `"Batting Style"`.

### 4.2 `use-led-view.ts`

- Fetches sport role spec groups via `useRoleSpecMap(tournament.sport, players)`.
- Passes per-player labels into `resolvePlayerSpecifications()` when building `LedPlayer.specs`.
- Applies to **all** LED surfaces using `LedView`: main portrait, side panel spec grid, overlays.

### 4.3 `auction.ts` (API)

- `currentPlayer` now serialized with `serializePlayerWithSpecifications(p, "auction")` so live auction state includes `specifications[]` when `PLAYER_SPECS_V2_ENABLED=true`.

---

## 5. Expected labels by sport

| Sport | First spec label (from `role_spec_groups`) | Legacy column |
|-------|---------------------------------------------|---------------|
| Badminton | **Playing Hand** | `batting_style` slot 0 |
| Cricket | **Batting Hand** (or configured group name) | `batting_style` slot 0 |
| Future sports | First configured group name dynamically | slot 0 legacy column |

Labels are **never hardcoded in LED components** — they always come from `specifications[].groupName` or `role_spec_groups.group_name`.

---

## 6. Components audited (no remaining `"Batting Style"` in LED)

| Component | Status |
|-----------|--------|
| `PlayerPortrait.tsx` | Dynamic `primarySpec.label` |
| `SidePlayerProfilePanel.tsx` | Dynamic `player.specs.map(spec => spec.label)` |
| `BidCenter.tsx` | No spec labels (bid amount only) |
| `EffectsLayer.tsx` | Uses `roleRaw`, not batting labels |
| `use-led-view.ts` | Sport-aware spec resolution |

**Out of scope (non-LED):** `liveviewer.tsx` operator panel still lists raw `battingStyle` values in a chip array — separate from LED display route (`/display`).

---

## 7. Verification checklist

- [ ] Open badminton tournament LED (`/display?tournamentId=5`) during live player
- [ ] Confirm portrait stats: `AGE | PLAYING HAND | BASE` (or first configured spec)
- [ ] Confirm value matches player hand (e.g. `Right Hand`)
- [ ] Repeat on cricket tournament — first label should be `Batting Hand` (or configured name)
- [ ] With `PLAYER_SPECS_V2_ENABLED=true`, confirm `specifications[]` in auction state API response
- [ ] Run unit tests: `player-spec-display.test.ts`, `led-sport-aware.test.ts`

---

## 8. Related production data note

Production audit (2026-06-24) showed badminton rows still tagged with legacy `batting_style` and missing `player_spec_values` for most players. **This fix corrects LED labels immediately** via `role_spec_groups`. For full normalization, still run:

```bash
pnpm exec tsx scripts/repair-player-sport-profiles.ts --apply
pnpm exec tsx scripts/migrate-player-spec-values.ts --apply
```

Then enable `PLAYER_SPECS_V2_ENABLED=true` for authoritative `specifications[]` on all API paths.
