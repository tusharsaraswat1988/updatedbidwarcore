# Legacy Multi-Sport Data Remediation

**Status:** COMPLETE  
**Date:** 2026-06-26  
**Environment:** Connected dev DB (same target as local `.env`)  
**Classification:** Legacy data migration — no application code changes

---

## Background

Business Validation audit (`audit-multi-sport-data.ts`) reported P0 findings on badminton tournament 5:

| ID | Category | Pre-repair count |
|----|----------|------------------|
| BV-1 | Wrong sport on `player_statistics` | 1 row (`id=2`, tagged `cricket` on badminton tournament) |
| BV-2 | Wrong sport on `player_team_assignments` | 3 rows (`id=1`, `2`, `6`) |
| BV-3 | Missing `player_sport_profiles` | 11 global players |

Root Cause Verification (`verify:root-cause-rcv`) demonstrated fresh cricket (tournament 19) and badminton (tournament 20) workflows produced **zero** BV-1/BV-2/BV-3 findings. Failures classified as **legacy data**, not production code defects.

---

## Execution (approved 2026-06-26)

Order enforced:

| Step | Command | Result |
|------|---------|--------|
| 1 | `pnpm exec tsx --env-file=.env scripts/repair-player-statistics.ts --apply` | Scanned 1, repaired 1, errors 0 |
| 2 | `pnpm exec tsx --env-file=.env scripts/repair-team-assignments.ts --apply` | Scanned 3, repaired 3, errors 0 |
| 3 | `pnpm exec tsx --env-file=.env scripts/repair-player-sport-profiles.ts --apply` | Scanned 11, repaired 11, errors 0 |

### Rows touched

**player_statistics**

- `id=2` → sport `badminton` (tournament 5)

**player_team_assignments**

- `id=1`, `id=2`, `id=6` → sport `badminton` (tournament 5)

**player_sport_profiles** (created)

- `gp_mq6b2ogv2mwbj` — badminton + cricket profiles
- `gp_mq6e1z6rmna5c` — cricket
- `gp_mq6e2py0os6ci` — badminton + cricket
- `gp_mq7sfyt4l2isp` — cricket
- `gp_mqdpf8s2qift6` — cricket (All-Rounder)
- `gp_mqdq3vmo9xtph` — cricket
- `gp_mqdq58pbt96wm` — cricket
- `gp_mqdqijr3x1y6l` — cricket
- `gp_mqh14dmnijhpa` — badminton

---

## Post-repair audit

**Command:** `pnpm exec tsx --env-file=.env scripts/audit-multi-sport-data.ts --json`  
**Exit code:** 0  
**Audited at:** 2026-06-26T11:12:43.004Z

| Area | P0 count | P1 count | Notes |
|------|----------|----------|-------|
| Statistics | 0 | 0 | `totals.statisticsIssues: 0` |
| Team assignments | 0 | 0 | `totals.teamAssignmentIssues: 0` |
| Sport profiles | 0 | 0 | `totals.sportProfileIssues: 0` |

**P2 (non-blocking, pre-existing):** 3 players with legacy spec columns but no `player_spec_values` rows (`players_missing_spec_values`). Not part of BV-1/BV-2/BV-3 scope.

---

## Closure

| Item | Status |
|------|--------|
| BV-1 | **CLOSED** — legacy only; repaired |
| BV-2 | **CLOSED** — legacy only; repaired |
| BV-3 | **CLOSED** — legacy only; backfilled |
| Legacy multi-sport data migration | **COMPLETE** |

---

## Rollback (if required)

Repairs are targeted field updates and profile inserts. Manual rollback would require restoring pre-migration values from a DB backup taken before `--apply`. No automated rollback script exists.

---

## References

- Tracker: `docs/PRODUCTION_STABILIZATION_TRACKER.md`
- RCV script: `scripts/src/verify-root-cause-rcv.ts`
- Audit: `scripts/audit-multi-sport-data.ts`
