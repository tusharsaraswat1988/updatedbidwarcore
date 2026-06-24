# Team Assignment Data Repair Report

**Sprint 4 — Historical data audit for `player_team_assignments`**

**Audit script:** `scripts/audit-multi-sport-data.ts`  
**Repair script:** `scripts/repair-team-assignments.ts`

---

## How to run

```bash
pnpm exec tsx scripts/audit-multi-sport-data.ts --json
pnpm exec tsx scripts/repair-team-assignments.ts --dry-run
pnpm exec tsx scripts/repair-team-assignments.ts --apply
```

---

## Audit categories

### 1. wrong_sport_tag (P0)

**Description:** Assignment `sport` column does not match tournament sport.

**Detection SQL:**

```sql
SELECT pta.id, pta.player_id, pta.sport, pta.tournament_id, lower(t.sport) AS expected_sport
FROM player_team_assignments pta
INNER JOIN tournaments t ON t.id = pta.tournament_id
WHERE pta.tournament_id IS NOT NULL
  AND lower(pta.sport) <> lower(t.sport);
```

**Repair:** UPDATE sport to tournament sport.

**Root cause:** Pre–Sprint 3 `assignPlayerToFranchiseRoster` hardcoded `sport: "cricket"` for all auction sales.

---

### 2. multiple_active_same_sport (P1)

**Description:** More than one `is_active = true` row for same `(player_id, tournament_id, sport)`.

**Detection SQL:**

```sql
SELECT player_id, tournament_id, sport, COUNT(*) AS active_count
FROM player_team_assignments
WHERE is_active = true AND tournament_id IS NOT NULL
GROUP BY player_id, tournament_id, sport
HAVING COUNT(*) > 1;
```

**Repair:** Keep most recent `assigned_at`, deactivate others.

---

### 3. multi_sport_active_same_tournament (P2)

**Description:** Active assignments for multiple sports in one tournament.

**Note:** Valid for multi-sport events; review manually. Not auto-repaired.

---

### 4. orphan_player_id (P1)

**Description:** `player_id` not in `global_players`.

**Repair:** Logged and skipped — requires manual merge or delete.

---

## Expected post-Sprint 3 behavior

Same global player:

| Sport | Tournament | Team | Coexists |
|-------|------------|------|----------|
| cricket | T1 | Team A | Yes |
| badminton | T2 | Team B | Yes |

Ending cricket assignment must not affect badminton row (sport-scoped `endActiveRosterAssignment`).

---

## Validation

```bash
pnpm exec tsx scripts/validate-multi-sport-e2e.ts gp_<id>
```

Checks assignment sport tags per tournament appearance.

---

## Rollback

Backup active assignments before apply:

```sql
COPY (
  SELECT * FROM player_team_assignments WHERE tournament_id = ?
) TO '/tmp/pta_backup.csv' CSV HEADER;
```
