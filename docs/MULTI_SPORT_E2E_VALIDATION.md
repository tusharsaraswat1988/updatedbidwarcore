# Multi-Sport E2E Validation

**Sprint 4 — Automated cross-sport isolation validation**

---

## Automated script

```bash
pnpm exec tsx scripts/validate-multi-sport-e2e.ts --mobile 8707488250
pnpm exec tsx scripts/validate-multi-sport-e2e.ts gp_mq6b2droprkj6
```

Exit code **0** = all checks passed.

### Checks performed

| Check | Description |
|-------|-------------|
| `multi_sport_participation` | Player appears in at least one tournament sport |
| `sport_profiles_complete` | Every sport with tournament row has `player_sport_profiles` entry |
| `specs_{sport}_player_{id}` | Badminton players do not use cricket spec labels |
| `statistics_sport_{sport}_t{id}` | Stats rows match tournament sport |
| `assignment_sport_{sport}_t{id}` | Assignment rows match tournament sport |
| `no_cross_sport_spec_labels` | Hand/spec labels differ between cricket and badminton |

---

## Manual E2E scenario

**Actor:** One global player in both cricket and badminton tournaments.

### Prerequisites

```env
PLAYER_SPECS_V2_ENABLED=true
PLAYER_SPORT_PROFILES_ENABLED=true
```

Run repair scripts dry-run → apply before validation.

---

### 1. Search

| Step | Action | Expected |
|------|--------|----------|
| 1a | Badminton registration mobile lookup with `?sport=badminton` | Prefill shows **Playing Hand** (not Batting Style) |
| 1b | Cricket organizer search with `?sport=cricket` | Prefill shows **Batting Hand** / cricket specs |
| 1c | Same mobile in both | Different spec values per sport |

**Automated:** `audit-multi-sport-data.ts` + search API sport param (Sprint 3).

---

### 2. Registration

| Step | Action | Expected |
|------|--------|----------|
| 2a | Register in badminton tourn | Spec groups from role_spec_groups |
| 2b | Verify DB | Rows in `player_spec_values` for badminton groups |
| 2c | Register same person in cricket tourn | Independent spec values |

---

### 3. Edit player

| Step | Action | Expected |
|------|--------|----------|
| 3a | Edit badminton player specs | Updates `player_spec_values` only |
| 3b | Edit cricket player | Cricket specs unchanged on badminton side |

---

### 4. Auction & sale

| Step | Action | Expected |
|------|--------|----------|
| 4a | Sell in badminton auction | `player_team_assignments.sport = badminton` |
| 4b | Sell in cricket auction | Separate row `sport = cricket` |
| 4c | Statistics baseline | Cricket stats only for cricket sale |

---

### 5. Roster assignment

| Step | Action | Expected |
|------|--------|----------|
| 5a | Query assignments for global id | Two rows, different sports |
| 5b | End badminton assignment | Cricket assignment still active |

**Script:** `repair-team-assignments.ts --dry-run` should report 0 wrong_sport after fix.

---

### 6. Statistics

| Step | Action | Expected |
|------|--------|----------|
| 6a | Badminton match scoring | Updates `sport=badminton` stats row |
| 6b | Cricket baseline | `sport=cricket` row only |

**Script:** `validate-multi-sport-e2e.ts` statistics checks.

---

### 7. Export

| Step | Action | Expected |
|------|--------|----------|
| 7a | Export badminton tournament players | Columns: Playing Hand, Playing Style, … |
| 7b | Export cricket tournament | Columns: Batting Hand, Bowling Type, … |
| 7c | No fixed Batting Style column unless in spec groups | |

**Unit test:** `csv-player-import.test.ts`, `export-players-excel.test.ts`

---

### 8. LED

| Step | Action | Expected |
|------|--------|----------|
| 8a | Live viewer badminton player on block | Role badge = sport role name |
| 8b | Stat column | Dynamic label (e.g. Playing Hand) |
| 8c | No BAT / BOWL / AR / WK codes | |

**Unit test:** `led-sport-aware.test.ts`

---

## CI integration (recommended)

```yaml
- run: pnpm exec vitest run artifacts/auction-platform/src/lib/__tests__/csv-player-import.test.ts
- run: pnpm exec vitest run artifacts/auction-platform/src/lib/led-view/__tests__
- run: pnpm exec tsx scripts/audit-multi-sport-data.ts --json
  env:
    DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
```

Fail build on audit exit code 1 (P0 findings).

---

## Test matrix summary

| Layer | Automated | Manual |
|-------|-----------|--------|
| Search | API sport param | Registration UI |
| Specs | Unit tests | DB query |
| Stats | E2E script + audit | Match scoring |
| Assignments | E2E script + audit | Franchise view |
| Export | Unit tests | Download xlsx |
| LED | Unit tests | Live viewer |
