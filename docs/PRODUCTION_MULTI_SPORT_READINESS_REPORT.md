# Production Multi-Sport Readiness Report

**Sprint 4 — Go/no-go checklist**

**Date:** Generated at sprint completion  
**Run live audit:** `pnpm exec tsx scripts/audit-multi-sport-data.ts --json`

---

## Summary

| Domain | Status | Blocker |
|--------|--------|---------|
| Data Model | **PASS*** | *After repair scripts applied |
| Search | **PASS** | Requires both flags ON |
| Statistics | **PASS*** | *Repair wrong sport tags |
| Team Assignments | **PASS*** | *Repair pre-Sprint 3 rows |
| Exports | **PASS** | Dynamic columns shipped Sprint 3 |
| LED | **PASS** | Requires specs v2 for labels |
| Global Players | **PASS*** | *Backfill sport profiles |

\*Conditional on running Sprint 4 repair scripts in production.

---

## Data Model — PASS*

| Criterion | Status |
|-----------|--------|
| `player_spec_values` table deployed | Required (Sprint 1 migration 0002) |
| `player_sport_profiles` table deployed | Required (Sprint 2 migration 0003) |
| Unique indexes enforced | Yes |
| Legacy columns preserved | Yes (backward compat) |

**Action:** Confirm migrations applied: `0002_player_spec_values.sql`, `0003_player_sport_profiles.sql`

---

## Search — PASS

| Criterion | Status |
|-----------|--------|
| `?sport=` on global search | Implemented |
| Legacy path tournament join | Implemented |
| Specs enrichment when v2 ON | Implemented |
| Registration + organizer pass sport | Implemented |

**Flags:** `PLAYER_SPORT_PROFILES_ENABLED=true` for identity search path.

---

## Statistics — PASS*

| Criterion | Status |
|-----------|--------|
| Sport-scoped unique key | Yes |
| Cricket baseline gated by sport | Sprint 3 fix |
| Badminton migration sport filter | Sprint 4 fix |
| Repair script available | `repair-player-statistics.ts` |

**Pre-go-live:** `--dry-run` then `--apply` on production.

---

## Team Assignments — PASS*

| Criterion | Status |
|-----------|--------|
| Sport param on assign/end | Sprint 3 |
| Historical cricket hardcode | Repaired by script |
| Multi-sport coexistence | Supported |

---

## Exports — PASS

| Criterion | Status |
|-----------|--------|
| Dynamic spec columns | Yes |
| CSV bulk import dynamic headers | Sprint 4 |
| Legacy CSV headers accepted | Yes (aliases) |

---

## LED — PASS

| Criterion | Status |
|-----------|--------|
| No BAT/BOWL/AR/WK | Removed Sprint 3 |
| Dynamic spec labels | Yes |
| Role from tournament | `roleRaw` |

---

## Global Players — PASS*

| Criterion | Status |
|-----------|--------|
| Identity-only sync when profiles ON | Sprint 2 |
| `sportProfiles[]` on API | When flag ON |
| Missing profile repair | `repair-player-sport-profiles.ts` |

---

## Remaining technical debt

| Priority | Item |
|----------|------|
| **P0** | Run repair scripts on production before enabling flags |
| **P0** | Enable `PLAYER_SPECS_V2_ENABLED` + `PLAYER_SPORT_PROFILES_ENABLED` together |
| **P1** | Backfill `player_spec_values` for all historical players |
| **P1** | Install `tsx` in CI for audit/repair scripts |
| **P2** | OpenAPI regen for `specifications[]` |
| **P2** | Remove cricket free-text fallback in organizer form |
| **P3** | Phase A/B/C legacy column deprecation (see Sprint 4 roadmap) |
| **P3** | `lovableupdates/` demo cleanup |

---

## Go-live sequence

1. Apply DB migrations (if not already)
2. `migrate-player-spec-values.ts --apply`
3. `backfill-player-sport-profiles.ts` or `repair-player-sport-profiles.ts --apply`
4. `repair-player-statistics.ts --apply`
5. `repair-team-assignments.ts --apply`
6. `audit-multi-sport-data.ts --json` → exit 0
7. Enable both feature flags in staging → run E2E script
8. Enable flags in production
9. Monitor `master_sports_sync_log` for 48h

---

## Rollback

1. Set both flags to `false`
2. System reverts to legacy read paths (no code deploy needed)
3. Data repairs are not auto-reverted — restore from backup if required
