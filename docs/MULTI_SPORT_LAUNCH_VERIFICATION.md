# Multi-Sport Launch Verification

**Production database audit — live query results**

| Field | Value |
|-------|-------|
| **Audited at** | 2026-06-24T18:34:48 UTC |
| **Database** | Neon production (`neondb`, ap-southeast-1) |
| **Script** | `node scripts/launch-verification.mjs` |

---

## Executive summary

| Verdict | Detail |
|---------|--------|
| **Repair scripts required before launch?** | **YES** |
| **Total repair items** | **19** |
| **Negligible (<5 items)?** | **No** |

Production has real but small-scale integrity gaps concentrated in **badminton tournament 5** (Vyapari Network Badminton League) and **missing sport profiles** for most linked global players. Repair is quick (minutes) and should run before enabling `PLAYER_SPECS_V2_ENABLED` and `PLAYER_SPORT_PROFILES_ENABLED`.

---

## 1. `player_statistics`

| Metric | Count |
|--------|------:|
| **Total rows** | 6 |
| **Rows needing repair** | 1 |
| **Wrong sport tag** | 1 |
| Badminton tournament tagged `cricket` | 1 |
| Duplicate `(player_id, sport, tournament_id)` groups | 0 |
| Orphan rows (no global player) | 0 |

### Breakdown by sport (after join to tournament)

| Sport (actual row tag) | Rows |
|------------------------|-----:|
| cricket | 5 |
| badminton | 1 |

### Wrong sport detail

| id | player_id | stored sport | tournament | expected sport |
|----|-----------|--------------|------------|----------------|
| 2 | `gp_mq6b2droprkj6` | cricket | Vyapari Network Badminton League (t5) | badminton |

**Root cause:** Pre–Sprint 3 sale hook created cricket baseline for a badminton tournament.

**Fix:**
```bash
pnpm exec tsx scripts/repair-player-statistics.ts --dry-run
pnpm exec tsx scripts/repair-player-statistics.ts --apply
```

---

## 2. `player_team_assignments`

| Metric | Count |
|--------|------:|
| **Total rows** | 13 |
| **Rows needing repair** | 3 |
| **Wrong sport tag** | 3 |
| Multiple active per (player, tournament, sport) | 0 |
| Orphan rows | 0 |

### Wrong sport detail

| id | player_id | stored sport | tournament | expected sport |
|----|-----------|--------------|------------|----------------|
| 1 | `gp_mq6b2droprkj6` | cricket | Vyapari Network Badminton League (t5) | badminton |
| 2 | `gp_mq6b2ogv2mwbj` | cricket | Vyapari Network Badminton League (t5) | badminton |
| 6 | `gp_mq6b2droprkj6` | cricket | Vyapari Network Badminton League (t5) | badminton |

All three are badminton franchise assignments incorrectly stored as `sport = cricket` (pre–Sprint 3 hardcode).

**Fix:**
```bash
pnpm exec tsx scripts/repair-team-assignments.ts --dry-run
pnpm exec tsx scripts/repair-team-assignments.ts --apply
```

---

## 3. `player_sport_profiles`

| Metric | Count |
|--------|------:|
| **Total rows** | 2 |
| **Rows needing repair** | 11 |
| **Missing profile links** | 11 |
| Duplicate profiles | 0 |
| Orphan profiles (no tournament player) | 0 |

### Context

| Metric | Count |
|--------|------:|
| Global players linked to tournament players | 12 |
| Expected `(global_player_id, sport)` profiles | 13 |
| Profiles present | 2 |
| **Gap** | **11 missing** |

Table exists and is populated for a subset of players (likely Sprint 2 backfill for Tushar / test data). Most production-linked global players have tournament appearances but no `player_sport_profiles` row yet.

**Fix:**
```bash
pnpm exec tsx scripts/repair-player-sport-profiles.ts --dry-run
pnpm exec tsx scripts/repair-player-sport-profiles.ts --apply
```

---

## 4. `player_spec_values`

| Metric | Count |
|--------|------:|
| **Total rows** | 4 |
| **Rows needing repair** | 4 players |
| **Missing spec values** | 4 players |
| Total tournament players | 108 |
| Spec coverage | **96%** of players have specs or no legacy data |

### Missing specs by tournament sport

| Sport | Players with legacy columns but no `player_spec_values` |
|-------|--------------------------------------------------------:|
| cricket | 3 |
| badminton | 1 |

Four players still rely on legacy `batting_style` / `bowling_style` / `specialization` columns only. Not blocking for launch if flags stay OFF, but required for full specs v2 behavior.

**Fix:**
```bash
pnpm exec tsx scripts/migrate-player-spec-values.ts --dry-run
pnpm exec tsx scripts/migrate-player-spec-values.ts --apply
```

---

## Cross-table summary

| Table | Total | Need repair | Wrong sport | Missing links / specs |
|-------|------:|------------:|------------:|----------------------:|
| player_statistics | 6 | 1 | 1 | — |
| player_team_assignments | 13 | 3 | 3 | — |
| player_sport_profiles | 2 | 11 | — | 11 missing profiles |
| player_spec_values | 4 | 4 players | — | 4 players |

---

## Launch decision

### Repair scripts NOT optional

Counts are **not zero** and **not negligible** (19 items). The issues are:

- **Small in volume** (single-digit wrong rows per table)
- **High in severity** (100% of badminton t5 assignments/stats mis-tagged as cricket)
- **Broad for profiles** (85% of expected sport profiles missing: 11/13)

### Recommended pre-launch sequence

```bash
# 1. Re-verify (read-only)
node scripts/launch-verification.mjs

# 2. Apply repairs (dry-run first)
pnpm exec tsx scripts/repair-player-statistics.ts --dry-run
pnpm exec tsx scripts/repair-player-statistics.ts --apply

pnpm exec tsx scripts/repair-team-assignments.ts --dry-run
pnpm exec tsx scripts/repair-team-assignments.ts --apply

pnpm exec tsx scripts/repair-player-sport-profiles.ts --dry-run
pnpm exec tsx scripts/repair-player-sport-profiles.ts --apply

pnpm exec tsx scripts/migrate-player-spec-values.ts --dry-run
pnpm exec tsx scripts/migrate-player-spec-values.ts --apply

# 3. Confirm clean
node scripts/launch-verification.mjs
pnpm exec tsx scripts/validate-multi-sport-e2e.ts --mobile 8707488250

# 4. Enable flags
# PLAYER_SPECS_V2_ENABLED=true
# PLAYER_SPORT_PROFILES_ENABLED=true
```

### Post-repair expected state

| Table | Expected total repair items |
|-------|----------------------------:|
| player_statistics | 0 wrong sport |
| player_team_assignments | 0 wrong sport |
| player_sport_profiles | 0 missing (13 rows) |
| player_spec_values | 0 missing backfill gaps |

---

## What does NOT need repair

| Check | Result |
|-------|--------|
| Duplicate statistics rows | 0 |
| Duplicate sport profiles | 0 |
| Orphan statistics / assignments | 0 |
| Multiple active assignments (same sport) | 0 |
| Scale of corruption | Isolated to tournament 5 + profile backfill gap |

---

## Re-run verification

Any time before or after launch:

```bash
node scripts/launch-verification.mjs
```

Exit criteria for go-live: all `needingRepair` counts = **0**.

---

## Related documents

- [`docs/PRODUCTION_MULTI_SPORT_READINESS_REPORT.md`](./PRODUCTION_MULTI_SPORT_READINESS_REPORT.md)
- [`docs/SPRINT_4_IMPLEMENTATION_REPORT.md`](./SPRINT_4_IMPLEMENTATION_REPORT.md)
- [`docs/MULTI_SPORT_E2E_VALIDATION.md`](./MULTI_SPORT_E2E_VALIDATION.md)
