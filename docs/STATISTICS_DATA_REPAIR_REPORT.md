# Statistics Data Repair Report

**Sprint 4 — Historical data audit for `player_statistics`**

**Audit script:** `scripts/audit-multi-sport-data.ts`  
**Repair script:** `scripts/repair-player-statistics.ts`

---

## How to run

```bash
# Read-only audit
pnpm exec tsx scripts/audit-multi-sport-data.ts --json

# Preview repairs
pnpm exec tsx scripts/repair-player-statistics.ts --dry-run

# Apply repairs
pnpm exec tsx scripts/repair-player-statistics.ts --apply

# Scoped to one tournament
pnpm exec tsx scripts/repair-player-statistics.ts --dry-run 12
```

---

## Audit categories

### 1. wrong_sport_tag (P0)

**Description:** `player_statistics.sport` does not match `tournaments.sport` for the linked tournament.

**Detection SQL:**

```sql
SELECT ps.id, ps.player_id, ps.sport, ps.tournament_id, lower(t.sport) AS expected_sport
FROM player_statistics ps
INNER JOIN tournaments t ON t.id = ps.tournament_id
WHERE ps.tournament_id IS NOT NULL
  AND lower(ps.sport) <> lower(t.sport);
```

**Repair:** Update `sport` to `lower(t.sport)`.

**Root cause:** Pre–Sprint 3 sale hooks called `ensureCricketStatisticsBaseline` for all tournaments; badminton migration checked existence without sport filter.

---

### 2. badminton_tournament_cricket_sport (P0)

**Description:** Badminton tournaments with statistics rows tagged `sport = cricket`.

**Detection SQL:**

```sql
SELECT ps.id, ps.player_id, ps.sport, ps.tournament_id, t.name
FROM player_statistics ps
INNER JOIN tournaments t ON t.id = ps.tournament_id
WHERE lower(t.sport) = 'badminton' AND lower(ps.sport) = 'cricket';
```

**Repair:** Same as wrong_sport_tag — set sport from tournament.

---

### 3. duplicate_rows (P1)

**Description:** More than one row per `(player_id, sport, tournament_id)` — violates unique index intent.

**Detection SQL:**

```sql
SELECT player_id, sport, tournament_id, COUNT(*) AS cnt
FROM player_statistics
GROUP BY player_id, sport, tournament_id
HAVING COUNT(*) > 1;
```

**Repair:** Keep lowest `id`, delete duplicates.

---

### 4. orphan_player_id (P1)

**Description:** `player_id` not found in `global_players`.

**Repair:** Manual review only — script logs and skips. May indicate deleted global identity or bad migration mapping.

---

### 5. players_missing_spec_values (P2)

**Description:** Players with legacy `batting_style` / `bowling_style` / `specialization` but no `player_spec_values` rows (pre–Sprint 1 data).

**Repair:** Run `scripts/migrate-player-spec-values.ts --apply` (Sprint 1 backfill).

---

## Repair script behavior

| Action | Idempotent | Notes |
|--------|------------|-------|
| Fix sport tag | Yes | Safe to re-run |
| Remove duplicates | Yes | Keeps first id |
| Orphan report | N/A | No auto-delete |

---

## Post-repair validation

```bash
pnpm exec tsx scripts/validate-multi-sport-e2e.ts --mobile <mobile>
pnpm exec tsx scripts/audit-multi-sport-data.ts --json
```

Exit code 0 = no P0 findings.

---

## Rollback

Repairs are in-place updates. Before `--apply`:

1. Export affected rows: `SELECT * FROM player_statistics WHERE …`
2. Store backup table or CSV
3. Restore via manual UPDATE if needed

No schema migrations in this sprint.
