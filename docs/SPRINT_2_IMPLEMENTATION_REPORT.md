# Sprint 2 — Global Player Architecture Refactor

## Implementation Report

**Date:** 2026-06-24  
**Status:** Complete  
**Backward compatible:** Yes  
**Feature flag default:** OFF (`PLAYER_SPORT_PROFILES_ENABLED` unset)

---

## Summary

Sprint 2 introduces `player_sport_profiles` so global player identity is sport-neutral and per-sport roles coexist without last-sync-wins corruption. Legacy columns on `global_players` remain for backward compatibility but are marked deprecated and are not updated when the feature flag is ON.

---

## 1. Schema Changes

### New table: `player_sport_profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `global_player_id` | TEXT FK → `global_players.id` | ON DELETE CASCADE |
| `sport_slug` | TEXT FK → `sports.slug` | |
| `default_role` | TEXT | Role for this sport |
| `profile_json` | JSONB | e.g. `{ auctionPlayerId, handedness }` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Constraints:** `UNIQUE (global_player_id, sport_slug)`  
**Indexes:** `global_player_id`, `sport_slug`

### `global_players` — deprecated fields (not dropped)

| Field | Status |
|-------|--------|
| `sport` | @deprecated — use `player_sport_profiles.sport_slug` |
| `default_role` | @deprecated — use `player_sport_profiles.default_role` |
| `handedness` | @deprecated — use `profile_json` |
| `auction_player_id` | @deprecated — use `profile_json.auctionPlayerId` |

**Identity fields unchanged:** name, mobile, email, DOB, gender, city, photo, notes, etc.

### Files

| File | Purpose |
|------|---------|
| `lib/db/src/schema/player-sport-profiles.ts` | Drizzle schema |
| `lib/db/migrations/0003_player_sport_profiles.sql` | Forward migration |
| `lib/db/migrations/0003_player_sport_profiles_rollback.sql` | Rollback |
| `lib/db/src/index.ts` | Idempotent startup DDL |
| `lib/db/src/schema/global_players.ts` | Deprecation comments |

---

## 2. Migration Files

**Apply forward:**
```bash
psql $DATABASE_URL -f lib/db/migrations/0003_player_sport_profiles.sql
```

**Rollback:**
```bash
psql $DATABASE_URL -f lib/db/migrations/0003_player_sport_profiles_rollback.sql
```

Startup also runs idempotent `CREATE TABLE IF NOT EXISTS player_sport_profiles`.

---

## 3. Sync Rewrite

**File:** `artifacts/api-server/src/lib/master-sports/sync.ts`

### Feature flag OFF (default)
Existing behavior preserved — including legacy overwrite of `sport`, `default_role`, `auction_player_id` on every sync. Tournament sport is now used instead of hardcoded `"cricket"` when resolving sport slug.

### Feature flag ON

| Layer | Create | Update |
|-------|--------|--------|
| `global_players` | Identity + legacy columns set once | Identity fields only |
| `player_sport_profiles` | Upsert for tournament sport | Upsert for tournament sport |

**Never overwritten on update (flag ON):** `sport`, `default_role`, `handedness`, `auction_player_id`

**Example — Tushar Saraswat:**
```
global_players          → name, mobile, city (identity)
player_sport_profiles   → cricket / All Rounder
                        → badminton / Singles Player
```

### Service layer

| File | Role |
|------|------|
| `player-sport-profile-service.ts` | CRUD + upsert |
| `global-player-response.ts` | Adds `sportProfiles[]` to API responses |

---

## 4. Feature Flag

| Variable | Values | Default |
|----------|--------|---------|
| `PLAYER_SPORT_PROFILES_ENABLED` | `true`, `1`, `yes` | OFF |

**Location:** `lib/api-base/src/player-sport-profiles.ts`

---

## 5. API Updates

### Global player GET `/global-players/:gpid`

When flag ON, response includes:

```json
{
  "id": "gp_x",
  "canonicalName": "Tushar Saraswat",
  "sport": "cricket",
  "defaultRole": "Singles Player",
  "sportProfiles": [
    { "sport": "cricket", "defaultRole": "All Rounder" },
    { "sport": "badminton", "defaultRole": "Singles Player" }
  ]
}
```

Legacy `sport` / `defaultRole` remain for old clients.

### Search `/global-players/search`

When flag ON:
- Returns **identity-only** fields (no `battingStyle` / `bowlingStyle` / `specialization`)
- Optional `?sport=badminton` filters to that sport's tournament rows
- Prefers matching sport row when sport filter provided

When flag OFF: unchanged legacy search with cricket spec columns.

---

## 6. Backfill Script

**File:** `scripts/backfill-player-sport-profiles.ts`

```bash
npx tsx scripts/backfill-player-sport-profiles.ts --dry-run
npx tsx scripts/backfill-player-sport-profiles.ts
npx tsx scripts/backfill-player-sport-profiles.ts gp_abc123
```

**Logic:**
1. For each `global_players` row
2. Find linked tournament `players` grouped by `tournaments.sport`
3. Use most recent role per sport
4. Fallback to legacy `global_players.sport` / `default_role` if no links
5. Upsert `player_sport_profiles` (idempotent)

**Output:** global players scanned, profiles created/updated/skipped, errors

---

## 7. Multi-Sport Validation Script

**File:** `scripts/validate-multi-sport-profiles.ts`

```bash
npx tsx scripts/validate-multi-sport-profiles.ts gp_x
npx tsx scripts/validate-multi-sport-profiles.ts --mobile 9876543210
```

Compares tournament appearances vs `player_sport_profiles` and reports missing profiles.

---

## 8. Tests

**File:** `artifacts/api-server/src/__tests__/player-sport-profiles.test.ts`

| Area | Result |
|------|--------|
| Identity field separation | ✅ |
| Legacy sport field mapping | ✅ |
| Tournament sport (not hardcoded cricket) | ✅ |
| Feature flag default/enabled | ✅ |
| Multi-sport profile coexistence | ✅ |
| Idempotent upsert | ✅ |

```bash
pnpm --filter @workspace/api-server test -- src/__tests__/player-sport-profiles.test.ts
# 8 passed
```

---

## 9. Deployment Plan

1. Deploy code with **`PLAYER_SPORT_PROFILES_ENABLED=false`**
2. Apply migration `0003_player_sport_profiles.sql` (or rely on startup DDL)
3. Run backfill:
   ```bash
   npx tsx scripts/backfill-player-sport-profiles.ts --dry-run
   npx tsx scripts/backfill-player-sport-profiles.ts
   ```
4. Validate multi-sport players:
   ```bash
   npx tsx scripts/validate-multi-sport-profiles.ts --mobile <mobile>
   ```
5. Enable **`PLAYER_SPORT_PROFILES_ENABLED=true`**
6. Verify sync no longer overwrites cross-sport roles

**Coexist with Sprint 1:** `PLAYER_SPECS_V2_ENABLED` and `PLAYER_SPORT_PROFILES_ENABLED` are independent.

---

## 10. Rollback Plan

1. Set **`PLAYER_SPORT_PROFILES_ENABLED=false`** — immediate revert to legacy sync
2. Optional SQL: `0003_player_sport_profiles_rollback.sql`
3. Legacy `global_players` columns retain last-known values — no data loss from profile table removal

---

## 11. Non-Goals (unchanged)

- LED display
- Owner App
- Reports / exports
- Role labels
- Dropping legacy columns
- `player_spec_values` changes
- Badminton scoring UI

---

## 12. File Inventory

### New
- `lib/db/src/schema/player-sport-profiles.ts`
- `lib/db/migrations/0003_player_sport_profiles.sql`
- `lib/db/migrations/0003_player_sport_profiles_rollback.sql`
- `lib/api-base/src/player-sport-profiles.ts`
- `artifacts/api-server/src/lib/master-sports/player-sport-profile-service.ts`
- `artifacts/api-server/src/lib/master-sports/global-player-response.ts`
- `scripts/backfill-player-sport-profiles.ts`
- `scripts/validate-multi-sport-profiles.ts`
- `artifacts/api-server/src/__tests__/player-sport-profiles.test.ts`
- `docs/SPRINT_2_IMPLEMENTATION_REPORT.md`

### Modified
- `lib/db/src/schema/global_players.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/index.ts`
- `lib/api-base/src/index.ts`
- `lib/api-base/package.json`
- `artifacts/api-server/src/lib/master-sports/sync.ts`
- `artifacts/api-server/src/routes/global-players.ts`
- `artifacts/api-server/src/lib/serializers/global-player.ts`
- `lib/api-spec/openapi.yaml`
- `.env.example.example`

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Sport-neutral global identity when flag ON | ✅ |
| Multi-sport profiles coexist | ✅ |
| No last-sync-wins on sport/role (flag ON) | ✅ |
| Legacy columns preserved | ✅ |
| Backward compatible (flag OFF) | ✅ |
| Idempotent backfill | ✅ |
| Search sport-filter / identity-only (flag ON) | ✅ |
| Tests passing | ✅ (8/8) |
