# Sprint 3 Implementation Report

**Multi-sport presentation & data integrity refactor**

---

## 1. Dependency audit

Full audit: [`docs/MULTI_SPORT_DEPENDENCY_AUDIT.md`](./MULTI_SPORT_DEPENDENCY_AUDIT.md)

Summary: Removed P0 cricket assumptions from LED, search, exports, roster assignments, and statistics hooks. Legacy API columns retained for backward compatibility.

---

## 2. Files changed

### Shared utilities
- `artifacts/auction-platform/src/lib/player-spec-display.ts` — **new** — resolve specs + export column headers
- `lib/api-client-react/src/generated/api.schemas.ts` — `Player.specifications[]`, search `sport` param

### LED / live display
- `artifacts/auction-platform/src/lib/led-view/types.ts`
- `artifacts/auction-platform/src/lib/led-view/use-led-view.ts`
- `artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx`
- `artifacts/auction-platform/src/components/display/side/SidePlayerProfilePanel.tsx`
- `artifacts/auction-platform/src/components/display/v1/EffectsLayer.tsx`

### Organizer / registration
- `artifacts/auction-platform/src/pages/players.tsx` — sport-scoped search, spec-aware prefill
- `artifacts/auction-platform/src/pages/player-register.tsx` — sport-scoped mobile lookup
- `artifacts/auction-platform/src/lib/export-players-excel.ts` — dynamic spec columns

### API / master sports
- `artifacts/api-server/src/routes/global-players.ts` — sport filter (legacy path), specs enrichment
- `artifacts/api-server/src/lib/master-sports/roster-assignments.ts` — sport-scoped assignments
- `artifacts/api-server/src/lib/master-sports/sync.ts` — sport-aware sale hook + profile handedness
- `artifacts/api-server/src/lib/master-sports/cricket-roster.ts` — explicit cricket sport param
- `artifacts/api-server/src/lib/master-sports/player-sport-profile-service.ts` — hand from specs
- `artifacts/api-server/src/lib/master-sports/migrate-badminton.ts` — stats sport filter
- `artifacts/api-server/src/lib/serializers/player.ts` — deprecation note

### Tests
- `artifacts/auction-platform/src/lib/led-view/__tests__/player-spec-display.test.ts`
- `artifacts/auction-platform/src/lib/led-view/__tests__/led-sport-aware.test.ts`
- `artifacts/auction-platform/src/lib/__tests__/export-players-excel.test.ts`
- `artifacts/api-server/src/__tests__/cricket-roster.test.ts` — updated for sport param

### Documentation
- `docs/MULTI_SPORT_DEPENDENCY_AUDIT.md`
- `docs/SPRINT_3_IMPLEMENTATION_REPORT.md`

---

## 3. Statistics fixes

| Issue | Fix |
|-------|-----|
| Cricket baseline created on every player sale | `ensureCricketStatisticsBaseline` only when tournament sport is `cricket` |
| Badminton migration could skip stats if any row existed for player | Existence check now includes `sport = badminton` AND `tournament_id` |
| Profile `handedness` copied from `battingStyle` for all sports | Uses first spec matching `/hand/i` when specs v2 enabled |

---

## 4. Team assignment fixes

| Issue | Fix |
|-------|-----|
| All assignments hardcoded `sport: cricket` | `assignPlayerToFranchiseRoster` / `endActiveRosterAssignment` take `sport` |
| Badminton sale could end cricket assignment | End/update scoped to `(player, tournament, sport)` |
| Sale hook ignored tournament sport | `createPlayerTeamAssignmentFromSale` resolves sport from tournament |

**Validation scenario:** Same global player sold to Team A (cricket) and Team B (badminton) → two active rows with different `sport` values; ending badminton assignment does not touch cricket row.

---

## 5. Search validation

| Case | Expected | Implementation |
|------|----------|----------------|
| Badminton registration mobile lookup | Playing Hand from badminton row | `?sport=badminton` on search + specs enrichment |
| Cricket registration | Batting Hand from cricket row | Same with `?sport=cricket` |
| Profiles OFF legacy path | No cross-sport row preference | Tournament join + sport priority in `ROW_NUMBER` |

Enable `PLAYER_SPORT_PROFILES_ENABLED` + pass `sport` query param for identity search. Enable `PLAYER_SPECS_V2_ENABLED` for `specifications[]` on search results.

---

## 6. LED validation

| Before | After |
|--------|-------|
| Age / **BAT** / Base | Age / **Playing Hand** (or sport label) / Base |
| Role badge "All-Rounder" from `mapRole` | Badge shows **Doubles Player** (`roleRaw`) |
| Side panel Batting/Bowling | Dynamic spec grid from `player_spec_values` |

Requires player list API to return `specifications[]` (`PLAYER_SPECS_V2_ENABLED`).

---

## 7. Export validation

- Removed fixed Batting/Bowling/Specialization columns
- Columns derived from union of all players' spec group names
- Badminton export example: Playing Hand, Playing Style, Experience, Court Preference
- Cricket export example: Batting Hand, Bowling Type, Role (per role_spec_groups config)

---

## 8. Test results

Run locally:

```bash
cd artifacts/auction-platform && pnpm exec vitest run src/lib/led-view/__tests__ src/lib/__tests__/export-players-excel.test.ts
cd artifacts/api-server && pnpm exec vitest run src/__tests__/cricket-roster.test.ts src/__tests__/player-specification-service.test.ts
```

| Suite | Cases |
|-------|-------|
| `player-spec-display.test.ts` | Spec labels, legacy fallback, v2 preference |
| `led-sport-aware.test.ts` | Badminton ≠ BAT, cricket Batting Hand |
| `export-players-excel.test.ts` | Dynamic columns, empty guard |
| `cricket-roster.test.ts` | Sport-scoped assign/end |

---

## 9. Rollback plan

1. **Revert application code** — git revert Sprint 3 commit(s); no DB migrations required.
2. **Feature flags** — disable `PLAYER_SPECS_V2_ENABLED` and `PLAYER_SPORT_PROFILES_ENABLED` to restore legacy read paths immediately.
3. **LED** — old behavior returns if revert includes `use-led-view.ts` (cricket BAT label).
4. **Roster** — pre-Sprint-3 assignments remain valid; new assignments after deploy use sport column correctly.
5. **Exports** — reverted code restores fixed cricket columns.

No columns dropped; backward compatible API fields unchanged.

---

## 10. Remaining technical debt

| Item | Priority |
|------|----------|
| CSV bulk import template still uses `battingStyle` headers | P2 |
| `players.tsx` cricket fallback free-text spec fields | P2 |
| OpenAPI regen for `specifications[]` / `sport` (manual patch applied) | P2 |
| `lovableupdates/` demo still cricket-shaped | P3 |
| Remove legacy trio from API after deprecation window | P3 |
| Owner app: optional spec chips on LiveBid screen | P3 |
| Data repair script for any historical `player_statistics` rows with wrong sport tag | P2 (run audit query in prod) |

### API deprecation roadmap

| Field | Action | Timeline |
|-------|--------|----------|
| `battingStyle`, `bowlingStyle`, `specialization` | Keep dual-write; document deprecated | Sprint 3 ✓ |
| `specifications[]` | Primary read path when flag ON | Sprint 1 ✓ |
| Legacy trio on **response** | Stop populating when all clients migrated | Sprint 4+ |
| Legacy trio on **request** | Accept but ignore when specs v2 ON | Sprint 4+ |
| Drop columns | Not before all tournaments migrated | Future |

---

## Success criteria checklist

- [x] Badminton LED can show "Playing Hand" without BAT/BOWL mapping
- [x] Search accepts sport filter on all registration/organizer paths
- [x] Statistics baseline scoped to cricket tournaments only
- [x] Team assignments scoped by sport
- [x] Exports use dynamic spec columns
- [x] Legacy DB columns and API fields preserved
- [ ] Full E2E with both feature flags ON in staging (manual QA recommended)
