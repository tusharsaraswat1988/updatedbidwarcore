# Sprint 4 Implementation Report

**Production hardening, data repair & legacy deprecation planning**

---

## 1. Objectives completed

| Part | Deliverable | Status |
|------|-------------|--------|
| 1 | Historical data audit reports | Done |
| 2 | Automated repair scripts | Done |
| 3 | Feature flag removal audit | Done |
| 4 | Legacy field usage report | Done |
| 5 | CSV import modernization | Done |
| 6 | E2E validation suite | Done |
| 7 | Production readiness checklist | Done |
| 8 | Migration roadmap | Done (plan only) |

---

## 2. Scripts added

| Script | Purpose |
|--------|---------|
| `scripts/audit-multi-sport-data.ts` | Read-only audit; `--write-reports` refreshes repair docs |
| `scripts/repair-player-statistics.ts` | Fix sport tags, dedupe rows |
| `scripts/repair-team-assignments.ts` | Fix sport tags, deactivate duplicate actives |
| `scripts/repair-player-sport-profiles.ts` | Create missing sport profiles |
| `scripts/validate-multi-sport-e2e.ts` | Per-player cross-sport validation |
| `scripts/lib/repair-cli.ts` | Shared `--dry-run` / `--apply` CLI |

All repair scripts: **idempotent**, detailed logging, summary JSON with `--json`.

---

## 3. Code changes

| File | Change |
|------|--------|
| `artifacts/auction-platform/src/lib/csv-player-import.ts` | **New** — dynamic CSV template/parse with legacy aliases |
| `artifacts/auction-platform/src/pages/players.tsx` | Bulk upload uses sport-aware CSV |
| `artifacts/auction-platform/src/lib/__tests__/csv-player-import.test.ts` | **New** — unit tests |

---

## 4. Documentation deliverables

1. [`docs/STATISTICS_DATA_REPAIR_REPORT.md`](./STATISTICS_DATA_REPAIR_REPORT.md)
2. [`docs/TEAM_ASSIGNMENT_DATA_REPAIR_REPORT.md`](./TEAM_ASSIGNMENT_DATA_REPAIR_REPORT.md)
3. [`docs/SPORT_PROFILE_DATA_REPAIR_REPORT.md`](./SPORT_PROFILE_DATA_REPAIR_REPORT.md)
4. [`docs/FEATURE_FLAG_REMOVAL_AUDIT.md`](./FEATURE_FLAG_REMOVAL_AUDIT.md)
5. [`docs/LEGACY_FIELD_USAGE_REPORT.md`](./LEGACY_FIELD_USAGE_REPORT.md)
6. [`docs/MULTI_SPORT_E2E_VALIDATION.md`](./MULTI_SPORT_E2E_VALIDATION.md)
7. [`docs/PRODUCTION_MULTI_SPORT_READINESS_REPORT.md`](./PRODUCTION_MULTI_SPORT_READINESS_REPORT.md)

---

## 5. Migration roadmap (Phases A–C)

### Phase A — Stop reading legacy fields

**Prerequisites:**
- 100% `player_spec_values` backfill
- All UIs consume `specifications[]`
- LED/export/search validated with flags ON

**Actions:**
- Remove legacy fallback in `player-spec-display.ts`
- Remove cricket free-text inputs in `players.tsx`
- Global API: prefer `sportProfiles[]` over `global_players.sport`

**Risk:** Low if flags ON in staging 2+ weeks  
**Rollback:** Re-enable fallback branches via flag or revert deploy

---

### Phase B — Stop writing legacy fields

**Prerequisites:**
- Phase A complete
- No production client sends only `battingStyle`

**Actions:**
- `persistPlayerSpecificationsDualWrite` → specs only
- `sync.ts` stop `buildLegacySportFields` on global_players
- Bulk API ignore legacy trio on input

**Risk:** Medium — old mobile apps may break  
**Rollback:** Re-enable dual-write in `player-spec-response.ts`

---

### Phase C — Drop legacy columns

**Prerequisites:**
- Phase B stable 1+ release cycle
- DB backup + migration rollback SQL

**Actions:**
- Migration: drop `players.batting_style`, `bowling_style`, `specialization`
- Migration: drop `global_players.sport`, `default_role`, `handedness`, `auction_player_id`
- Remove feature flag checks

**Risk:** High — irreversible without backup  
**Rollback:** Restore columns from backup; redeploy previous app version

**Not in scope for Sprint 4** — planning only.

---

## 6. Production execution checklist

```bash
# 1. Audit
pnpm exec tsx scripts/audit-multi-sport-data.ts --json --write-reports

# 2. Backfill specs (if needed)
pnpm exec tsx scripts/migrate-player-spec-values.ts --dry-run
pnpm exec tsx scripts/migrate-player-spec-values.ts --apply

# 3. Repair
pnpm exec tsx scripts/repair-player-sport-profiles.ts --dry-run
pnpm exec tsx scripts/repair-player-sport-profiles.ts --apply
pnpm exec tsx scripts/repair-player-statistics.ts --dry-run
pnpm exec tsx scripts/repair-player-statistics.ts --apply
pnpm exec tsx scripts/repair-team-assignments.ts --dry-run
pnpm exec tsx scripts/repair-team-assignments.ts --apply

# 4. Validate
pnpm exec tsx scripts/validate-multi-sport-e2e.ts --mobile <test_mobile>

# 5. Enable flags
# PLAYER_SPECS_V2_ENABLED=true
# PLAYER_SPORT_PROFILES_ENABLED=true
```

---

## 7. Test results

| Suite | Location |
|-------|----------|
| CSV import | `artifacts/auction-platform/src/lib/__tests__/csv-player-import.test.ts` |
| Export columns | `artifacts/auction-platform/src/lib/__tests__/export-players-excel.test.ts` |
| LED specs | `artifacts/auction-platform/src/lib/led-view/__tests__/` |
| Roster sport | `artifacts/api-server/src/__tests__/cricket-roster.test.ts` |

Run: `pnpm exec vitest run` in respective packages.

**Note:** Live DB audit requires `tsx` + `DATABASE_URL`. Run on production/staging before go-live.

---

## 8. Success criteria mapping

| Criterion | Sprint 4 contribution |
|-----------|-------------------------|
| No cross-sport contamination | Audit + E2E script + search sport param (Sprint 3) |
| No incorrect statistics | Repair script + gated cricket baseline |
| No incorrect team assignments | Repair script + sport-scoped assign |
| No missing sport profiles | Repair script + backfill |
| No hidden cricket dependencies | Legacy usage report + CSV/LED fixes |
| True multi-sport platform | Readiness report + flag audit |

---

## 9. Non-goals (honored)

- Did not drop legacy DB columns
- Did not remove feature flags
- Did not remove backward compatibility
- Did not rewrite badminton scoring engine

---

## 10. Next steps for operator

1. Run audit against production database
2. Apply repairs in maintenance window
3. Enable both feature flags
4. Execute manual E2E checklist in [`MULTI_SPORT_E2E_VALIDATION.md`](./MULTI_SPORT_E2E_VALIDATION.md)
5. Schedule Phase A after 2 weeks stable production
