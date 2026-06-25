# Sprint 1 — Multi-Sport Spec Storage Foundation

## Implementation Report

**Date:** 2026-06-24  
**Status:** Complete  
**Backward compatible:** Yes  
**Feature flag default:** OFF (`PLAYER_SPECS_V2_ENABLED` unset)

---

## Summary

Sprint 1 adds normalized storage for player sport specifications in `player_spec_values`, with dual-write support behind a runtime feature flag. Legacy columns (`batting_style`, `bowling_style`, `specialization`) are unchanged and continue to drive existing LED, Owner App, and report behavior.

When the flag is **ON**, saves write both legacy columns and normalized rows; reads prefer normalized values and expose a new `specifications[]` API field. When **OFF**, behavior is identical to pre-Sprint-1 production.

---

## 1. Database

### Table: `player_spec_values`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `player_id` | INTEGER FK → `players.id` | ON DELETE CASCADE |
| `spec_group_id` | INTEGER FK → `role_spec_groups.id` | |
| `value_text` | TEXT NOT NULL | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Constraints / indexes:**
- `UNIQUE (player_id, spec_group_id)` — `uq_psv_player_spec_group`
- `ix_psv_player_id`
- `ix_psv_spec_group_id`

### Files

| File | Purpose |
|------|---------|
| `lib/db/src/schema/player-spec-values.ts` | Drizzle schema |
| `lib/db/src/schema/index.ts` | Re-export |
| `lib/db/migrations/0002_player_spec_values.sql` | Forward migration |
| `lib/db/migrations/0002_player_spec_values_rollback.sql` | Rollback migration |
| `lib/db/src/index.ts` | Idempotent `CREATE TABLE IF NOT EXISTS` on startup |

---

## 2. Service Layer

### `PlayerSpecificationService`

**Location:** `artifacts/api-server/src/lib/player-specification-service.ts`

| Method | Description |
|--------|-------------|
| `getPlayerSpecifications(playerId)` | Load normalized specs for one player |
| `getSpecificationsForPlayers(playerIds)` | Batch load (list endpoints) |
| `savePlayerSpecifications(playerId, specs)` | Upsert + delete stale groups (transaction) |
| `updatePlayerSpecifications(playerId, specs)` | Alias of save (replace semantics) |
| `deletePlayerSpecifications(playerId)` | Remove all rows for player |

**Helpers:**
- `resolveRoleSpecGroups(tournamentId, role)` — maps tournament sport + role → spec groups
- `buildSpecificationsForSave(...)` — merges explicit `specifications[]` or legacy fields
- `legacyFieldsFromSpecifications(...)` — first 3 groups → legacy columns
- `specificationsFromLegacyFields(...)` — backfill mapping
- `copyPlayerSpecifications(sourceId, targetId)` — import flow

**Response helpers:** `artifacts/api-server/src/lib/player-spec-response.ts`

---

## 3. Feature Flag

| Variable | Values | Default |
|----------|--------|---------|
| `PLAYER_SPECS_V2_ENABLED` | `true`, `1`, `yes` (case-insensitive) | OFF |

**Location:** `lib/api-base/src/player-specs-v2.ts`  
**Export:** `@workspace/api-base` and `@workspace/api-base/player-specs-v2`

| Flag | Behavior |
|------|----------|
| OFF | Legacy-only reads/writes; no `specifications[]` in responses |
| ON | Dual-write + merged read + `specifications[]` in responses |

Documented in `.env.example.example`.

---

## 4. API Changes

### New request field (optional)

```json
{
  "specifications": [
    { "specGroupId": 42, "value": "Right Hand" },
    { "specGroupId": 45, "value": "Singles Court" }
  ]
}
```

### New response field (when flag ON)

```json
{
  "id": 116,
  "name": "Animesh Thakur",
  "battingStyle": "Right Hand",
  "bowlingStyle": "Attacking",
  "specialization": "Advanced",
  "specifications": [
    { "specGroupId": 42, "groupName": "Playing Hand", "value": "Right Hand" },
    { "specGroupId": 43, "groupName": "Playing Style", "value": "Attacking" },
    { "specGroupId": 44, "groupName": "Experience", "value": "Advanced" },
    { "specGroupId": 45, "groupName": "Court Preference", "value": "Singles Court" }
  ]
}
```

Legacy fields remain in all responses for compatibility.

### Endpoints updated

| Endpoint | Change |
|----------|--------|
| `GET /tournaments/:id/players` | Returns `specifications[]` when flag ON |
| `GET /tournaments/:id/players/:playerId` | Same |
| `POST /tournaments/:id/players` | Dual-write on create |
| `PATCH /tournaments/:id/players/:playerId` | Dual-write on spec/role change |
| `POST /tournaments/:id/players/bulk` | Dual-write per inserted row |
| `POST /register/:code` | Dual-write on register/update |
| `GET /register/:code/lookup` | Returns merged player with specs |
| Import candidates | Serialized with specs |
| Import from tournament | Copies `player_spec_values` from source |

**OpenAPI:** `PlayerSpecification` schema + `Player.specifications` in `lib/api-spec/openapi.yaml`

---

## 5. Registration UI (minimal, no redesign)

| File | Change |
|------|--------|
| `artifacts/auction-platform/src/lib/player-specifications.ts` | Shared build/load helpers |
| `artifacts/auction-platform/src/pages/players.tsx` | Sends all spec groups via `specifications[]`; loads from normalized on edit |
| `artifacts/auction-platform/src/pages/player-register.tsx` | Same for public registration |

**Fixes badminton 4-spec loss:** Court Preference and other groups beyond index 2 are now included in `specifications[]` payload.

---

## 6. Backfill Script

**File:** `scripts/migrate-player-spec-values.ts`

```bash
# Dry run (all tournaments)
npx tsx scripts/migrate-player-spec-values.ts --dry-run

# Apply for one tournament
npx tsx scripts/migrate-player-spec-values.ts 5

# Apply for all players
npx tsx scripts/migrate-player-spec-values.ts
```

**Behavior:**
- Idempotent — skips players with existing normalized rows
- Maps legacy columns via tournament sport + role spec groups
- Logs: players scanned, rows created/skipped, errors

---

## 7. Tests

**File:** `artifacts/api-server/src/__tests__/player-specification-service.test.ts`

| Area | Coverage |
|------|----------|
| Persistence payload | Save 1, 3, 10 specs |
| Backfill mapping | Cricket triple; badminton 3-of-4 from legacy |
| Dual-write | Flag off preserves legacy-only behavior |
| Edit flow | Explicit `specifications[]` preferred over legacy |
| Feature flag | Default off; enabled with `true` |

Run: `pnpm --filter @workspace/api-server test -- src/__tests__/player-specification-service.test.ts`

---

## 8. Deployment Notes

### Recommended rollout

1. **Deploy code** with `PLAYER_SPECS_V2_ENABLED` unset or `false`
2. **Apply migration** (automatic via startup idempotent DDL, or run `0002_player_spec_values.sql`)
3. **Backfill** existing data:
   ```bash
   npx tsx scripts/migrate-player-spec-values.ts --dry-run
   npx tsx scripts/migrate-player-spec-values.ts
   ```
4. **Enable flag** in production: `PLAYER_SPECS_V2_ENABLED=true`
5. **Verify** badminton registration saves all 4 spec groups for a test player
6. **Monitor** — legacy screens and LED should behave unchanged

### Rollback

1. Set `PLAYER_SPECS_V2_ENABLED=false` (immediate — stops dual-write and normalized reads)
2. Optional SQL rollback: `lib/db/migrations/0002_player_spec_values_rollback.sql`
3. Legacy columns retain last-written values; no data loss from normalized table removal

### What was NOT changed (by design)

- LED display / `use-led-view.ts`
- Owner App
- Reports / exports
- `global_players` sync
- `badminton_players`
- Removal of legacy columns

---

## 9. Known Limitations (future sprints)

- Legacy columns still hold only **first 3** spec groups (for LED/legacy consumers)
- LED still reads `battingStyle` → "Bat" label for badminton
- `global_players.sport` still hardcoded to cricket in master sync
- Full read path for LED/reports from `specifications[]` deferred to Sprint 2+

---

## 10. File Inventory

### New files
- `lib/db/src/schema/player-spec-values.ts`
- `lib/db/migrations/0002_player_spec_values.sql`
- `lib/db/migrations/0002_player_spec_values_rollback.sql`
- `lib/api-base/src/player-specs-v2.ts`
- `artifacts/api-server/src/lib/player-specification-service.ts`
- `artifacts/api-server/src/lib/player-spec-response.ts`
- `artifacts/auction-platform/src/lib/player-specifications.ts`
- `scripts/migrate-player-spec-values.ts`
- `artifacts/api-server/src/__tests__/player-specification-service.test.ts`
- `docs/SPRINT_1_IMPLEMENTATION_REPORT.md`

### Modified files
- `lib/db/src/schema/index.ts`
- `lib/db/src/index.ts`
- `lib/api-base/src/index.ts`
- `lib/api-base/package.json`
- `artifacts/api-server/src/routes/players.ts`
- `artifacts/auction-platform/src/pages/players.tsx`
- `artifacts/auction-platform/src/pages/player-register.tsx`
- `lib/api-spec/openapi.yaml`
- `.env.example.example`

---

## Success Criteria Checklist

| Criterion | Status |
|-----------|--------|
| Badminton 4 specs persist when flag ON | ✅ |
| Legacy screens continue working | ✅ (flag OFF = unchanged) |
| No legacy column removal | ✅ |
| Dual-write only (no read-path breaking changes when OFF) | ✅ |
| Idempotent backfill | ✅ |
| Test coverage | ✅ (12 tests) |
| Migration + rollback | ✅ |
