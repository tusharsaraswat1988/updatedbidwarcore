# Legacy Field Usage Report

**Sprint 4 — Remaining usage of cricket-shaped player and global fields**

Classification: **ACTIVE** = production path | **BRIDGE** = dual-write/compat | **DEAD** = demo/unused

---

## Player fields: `batting_style`, `bowling_style`, `specialization`

| Location | Class | R/W | Notes |
|----------|-------|-----|-------|
| `lib/db/src/schema/players.ts` | ACTIVE | W | DB columns retained (non-goal: no drop) |
| `artifacts/api-server/src/lib/serializers/player.ts` | BRIDGE | R | Deprecated; emits legacy fields on all player APIs |
| `artifacts/api-server/src/lib/player-spec-response.ts` | BRIDGE | R/W | Maps specs ↔ legacy when specs v2 ON |
| `artifacts/api-server/src/lib/player-specification-service.ts` | BRIDGE | R/W | Index 0/1/2 slot mapping |
| `artifacts/api-server/src/routes/players.ts` | ACTIVE | R/W | Accepts legacy + `specifications[]` on create/update/bulk |
| `artifacts/auction-platform/src/pages/players.tsx` | ACTIVE | R/W | Dynamic specs + cricket fallback inputs |
| `artifacts/auction-platform/src/pages/player-register.tsx` | ACTIVE | R/W | Dual-write on submit |
| `artifacts/auction-platform/src/lib/player-spec-display.ts` | BRIDGE | R | Legacy fallback when no specs |
| `artifacts/auction-platform/src/lib/csv-player-import.ts` | BRIDGE | R/W | Legacy header aliases + dynamic columns |
| `artifacts/auction-platform/src/lib/export-players-excel.ts` | ACTIVE | R | Legacy removed from export; specs only |
| `artifacts/bidwar-local/**` | DEAD | — | Local dev mirror |
| `lovableupdates/**` | DEAD | — | Demo prototypes |

---

## Global fields: `global_players.sport`, `default_role`, `handedness`, `auction_player_id`

| Location | Class | R/W | Notes |
|----------|-------|-----|-------|
| `lib/db/src/schema/global_players.ts` | ACTIVE | R/W | Marked `@deprecated` Sprint 2 |
| `artifacts/api-server/src/lib/master-sports/sync.ts` | BRIDGE | W | Legacy fields written only when sport profiles OFF |
| `artifacts/api-server/src/lib/serializers/global-player.ts` | ACTIVE | R | Still exposed on global player API |
| `artifacts/api-server/src/routes/global-players.ts` | ACTIVE | R/W | POST accepts sport/defaultRole |
| `scripts/backfill-player-sport-profiles.ts` | BRIDGE | R | Fallback from legacy columns if no tournament rows |
| `artifacts/api-server/src/lib/master-sports/migrate-badminton.ts` | ACTIVE | W | Badminton migration (historical) |
| `artifacts/api-server/src/lib/master-sports/badminton.ts` | ACTIVE | R/W | Uses `handedness` on badminton domain |

---

## Deprecation status

| Field | Stop read (Phase A) | Stop write (Phase B) | Drop column (Phase C) |
|-------|---------------------|----------------------|------------------------|
| `batting_style` etc. | After all UIs use specs | After API accepts specs only | Future migration |
| `global_players.sport` | After sportProfiles[] consumers | After profiles flag default ON | Future migration |
| `global_players.default_role` | Same | Same | Future migration |
| `global_players.handedness` | Same | Same | Future migration |
| `global_players.auction_player_id` | After profile JSON stores id | Same | Future migration |

---

## Hidden cricket dependencies (post Sprint 3)

| Area | Status |
|------|--------|
| LED BAT/BOWL/AR/WK | **Removed** |
| Export fixed columns | **Removed** |
| Roster sport=cricket hardcode | **Fixed** (parametric) |
| CSV template battingStyle | **Modernized** (dynamic + legacy aliases) |
| Global search without sport | **Fixed** |
| Cricket stats on badminton sale | **Fixed** |

---

## Recommended next code changes (post Sprint 4)

1. **P1:** Remove cricket fallback free-text block in `players.tsx` when sport has role spec groups
2. **P2:** Regenerate OpenAPI — remove legacy from request schema (keep response optional)
3. **P3:** Delete `lovableupdates/` cricket demo or align with production patterns
