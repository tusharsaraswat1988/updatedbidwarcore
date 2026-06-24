# Sport Profile Data Repair Report

**Sprint 4 — Historical data audit for `player_sport_profiles`**

**Audit script:** `scripts/audit-multi-sport-data.ts`  
**Repair script:** `scripts/repair-player-sport-profiles.ts`  
**Backfill (Sprint 2):** `scripts/backfill-player-sport-profiles.ts`

---

## How to run

```bash
pnpm exec tsx scripts/audit-multi-sport-data.ts --json
pnpm exec tsx scripts/repair-player-sport-profiles.ts --dry-run
pnpm exec tsx scripts/repair-player-sport-profiles.ts --apply
pnpm exec tsx scripts/repair-player-sport-profiles.ts --apply gp_mq6b2droprkj6
```

---

## Audit categories

### 1. missing_profile (P0)

**Description:** Global player has tournament player row(s) for a sport but no matching `player_sport_profiles` row.

**Detection SQL:**

```sql
SELECT DISTINCT p.global_player_id, lower(t.sport) AS sport_slug
FROM players p
INNER JOIN tournaments t ON t.id = p.tournament_id
WHERE p.global_player_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM player_sport_profiles psp
    WHERE psp.global_player_id = p.global_player_id
      AND lower(psp.sport_slug) = lower(t.sport)
  );
```

**Repair:** Upsert profile from latest tournament player row (role, auctionPlayerId, handedness from specs/legacy).

**Root cause:** Records created before Sprint 2 migration or before `PLAYER_SPORT_PROFILES_ENABLED` sync.

---

### 2. duplicate_profiles (P1)

**Description:** Duplicate `(global_player_id, sport_slug)` — should be blocked by unique index `uq_psp_global_player_sport`.

**Repair:** Manual merge — script logs only.

---

### 3. orphan_profiles (P2)

**Description:** Profile exists but no linked tournament player for that sport.

**Repair:** Review — may be stale after player deletion.

---

## Pre-flag-era data

Records created before `player_sport_profiles` existed relied on:

- `global_players.sport`
- `global_players.default_role`
- `global_players.auction_player_id`

These are **deprecated** but preserved. Repair script does not delete legacy columns.

---

## Validation

```bash
PLAYER_SPORT_PROFILES_ENABLED=true pnpm exec tsx scripts/validate-multi-sport-profiles.ts --mobile 8707488250
```

Expected: `missingProfiles: []`, `multiSport: true` for dual-sport players.

---

## Idempotency

`repair-player-sport-profiles.ts` uses `playerSportProfileService.upsertSportProfile` — safe to re-run.

---

## Rollback

Delete incorrectly created profiles:

```sql
DELETE FROM player_sport_profiles
WHERE global_player_id = 'gp_xxx' AND sport_slug = 'badminton';
```

Re-run dry-run before apply in production.
