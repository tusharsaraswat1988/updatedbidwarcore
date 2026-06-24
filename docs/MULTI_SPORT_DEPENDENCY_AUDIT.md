# Multi-Sport Dependency Audit

**Sprint 3 — generated audit of remaining cricket-shaped dependencies**

Architecture source of truth: `global_players` → `player_sport_profiles` → `players` → `player_spec_values` (+ `role_spec_groups` for labels).

Legend: **Severity** P0 = user-visible wrong sport data, P1 = data integrity risk, P2 = compatibility/debt, P3 = dead/demo code.

---

## Display / LED

| File | Component / symbol | R/W | Path | Severity | Status / fix |
|------|---------------------|-----|------|----------|--------------|
| `artifacts/auction-platform/src/lib/led-view/use-led-view.ts` | `mapRole`, `mapHand`, `ROLE_LABEL`, `LedRoleCode` | Read | Live viewer, operator overlay | P0 | **Fixed** — uses `resolvePlayerSpecifications`, `roleRaw` |
| `artifacts/auction-platform/src/lib/led-view/types.ts` | `LedRoleCode`, `battingHand` | Type | LED pipeline | P0 | **Fixed** — `LedPlayerSpec[]`, `roleRaw` |
| `artifacts/auction-platform/src/components/display/v1/PlayerPortrait.tsx` | `"Bat"` label | Read | LED portrait | P0 | **Fixed** — dynamic first spec label |
| `artifacts/auction-platform/src/components/display/side/SidePlayerProfilePanel.tsx` | Batting/Bowling/Specialization | Read | Side LED | P0 | **Fixed** — dynamic spec grid |
| `artifacts/auction-platform/src/components/display/v1/EffectsLayer.tsx` | `p.role` (BAT codes) | Read | Squad/top-sold overlays | P0 | **Fixed** — `roleRaw` |
| `lovableupdates/**` | Demo LED, `mapRole`, `battingHand` | Read | Demo only | P3 | Dead/demo — out of production path |

---

## Owner app

| File | Component | R/W | Path | Severity | Status / fix |
|------|-----------|-----|------|----------|--------------|
| `artifacts/owner-app/src/screens/LiveBid.tsx` | `battingStyle`, `bowlingStyle` on type | Read | Owner live bid | P2 | Types only — auction state uses `role`; no cricket labels rendered |

---

## Registration / organizer players UI

| File | Component | R/W | Path | Severity | Status / fix |
|------|-----------|-----|------|----------|--------------|
| `artifacts/auction-platform/src/pages/players.tsx` | Dynamic specs + legacy fallback fields | R/W | Organizer CRUD | P1 | **Partial** — dynamic specs primary; legacy inputs remain for cricket fallback |
| `artifacts/auction-platform/src/pages/players.tsx` | CSV import `battingStyle` headers | W | Bulk import | P2 | Debt — migrate template to dynamic spec columns |
| `artifacts/auction-platform/src/pages/player-register.tsx` | Legacy trio + dynamic specs | R/W | Public registration | P1 | **Partial** — dynamic specs; dual-write legacy slots for API compat |
| `artifacts/auction-platform/src/lib/player-specifications.ts` | Legacy slot bridge | R/W | All forms | P1 | Required until legacy columns deprecated |

---

## Search / autocomplete

| File | Component | R/W | Path | Severity | Status / fix |
|------|-----------|-----|------|----------|--------------|
| `artifacts/api-server/src/routes/global-players.ts` | Legacy search without sport filter | Read | Global search (profiles OFF) | P0 | **Fixed** — `?sport=` + tournament join |
| `artifacts/api-server/src/routes/global-players.ts` | Profiles search omitting specs | Read | Prefill | P1 | **Fixed** — attaches `specifications[]` when specs v2 ON |
| `artifacts/auction-platform/src/pages/players.tsx` | `GlobalPlayerSearch` | Read | Name autocomplete | P0 | **Fixed** — passes `sport` |
| `artifacts/auction-platform/src/pages/player-register.tsx` | Mobile lookup fetch | Read | Registration | P0 | **Fixed** — passes tournament sport |

---

## Statistics

| File | Component | R/W | Path | Severity | Status / fix |
|------|-----------|-----|------|----------|--------------|
| `artifacts/api-server/src/lib/master-sports/cricket-stats.ts` | `ensureCricketStatisticsBaseline` | W | Player sold hook | P1 | **Fixed** — only called when tournament sport is cricket |
| `artifacts/api-server/src/lib/master-sports/migrate-badminton.ts` | Stats existence check | R/W | Migration | P1 | **Fixed** — filters by `sport = badminton` |
| `artifacts/api-server/src/lib/master-sports/badminton.ts` | Badminton stats upsert | R/W | Badminton scoring | P1 | Already sport-scoped (`sport: badminton`) |

---

## Team assignments

| File | Component | R/W | Path | Severity | Status / fix |
|------|-----------|-----|------|----------|--------------|
| `artifacts/api-server/src/lib/master-sports/roster-assignments.ts` | Hardcoded `sport: cricket` | W | All franchise sales | P0 | **Fixed** — `sport` parameter on assign/end |
| `artifacts/api-server/src/lib/master-sports/sync.ts` | `createPlayerTeamAssignmentFromSale` | W | Auction sold hook | P0 | **Fixed** — resolves tournament sport |
| `artifacts/api-server/src/lib/master-sports/cricket-roster.ts` | Cricket-only roster sync | W | Cricket admin | P2 | Explicit `sport: cricket` — correct for module scope |

---

## Exports / reports

| File | Component | R/W | Path | Severity | Status / fix |
|------|-----------|-----|------|----------|--------------|
| `artifacts/auction-platform/src/lib/export-players-excel.ts` | Batting/Bowling/Specialization columns | W | Player export | P0 | **Fixed** — dynamic columns from specs |
| `artifacts/api-server/src/routes/admin-reports.ts` | PDF uses `tournamentSport` | Read | Admin PDF | P2 | Already sport-aware label |

---

## API / serializers

| File | Fields | R/W | Path | Severity | Deprecation |
|------|--------|-----|------|----------|-------------|
| `artifacts/api-server/src/lib/serializers/player.ts` | `battingStyle`, `bowlingStyle`, `specialization` | R/W | All player APIs | P1 | **Compat required** — marked deprecated; use `specifications[]` |
| `artifacts/api-server/src/lib/player-spec-response.ts` | Dual-write/read bridge | R/W | Player GET/POST | P1 | Active when `PLAYER_SPECS_V2_ENABLED` |
| `lib/api-client-react/.../api.schemas.ts` | Player types | R | Frontend | P1 | **Extended** — optional `specifications[]`, search `sport` param |
| `artifacts/api-server/src/lib/master-sports/player-sport-profile-service.ts` | `handedness` from `battingStyle` | W | Profile sync | P1 | **Fixed** — reads hand spec when specs v2 ON |

### Legacy global columns (Sprint 2)

| Column | Severity | Status |
|--------|----------|--------|
| `global_players.sport` | P2 | Deprecated — identity-only sync when profiles flag ON |
| `global_players.default_role` | P2 | Deprecated — use `player_sport_profiles` |
| `global_players.handedness` | P2 | Deprecated — use sport profile JSON / specs |
| `global_players.auction_player_id` | P2 | Deprecated — use mappings table |

---

## Cricket terminology grep (production `artifacts/`)

| Term | Remaining usage | Severity |
|------|-----------------|----------|
| BAT/BOWL/AR/WK codes | Removed from LED | — |
| `mapRole` / `mapHand` | Removed from LED | — |
| Batting Style / Bowling Style labels | Legacy fallback in `player-spec-display.ts`, cricket seed data | P2 |
| Batsman/Bowler/WK strings | Sport master seed / cricket roles only | P2 |

---

## Feature flags (unchanged)

| Flag | Env | Effect |
|------|-----|--------|
| `PLAYER_SPECS_V2_ENABLED` | `.env` | Normalized specs read/write |
| `PLAYER_SPORT_PROFILES_ENABLED` | `.env` | Sport profiles + identity-only global sync |

Both default **OFF** — enable together in staging/production for full multi-sport behavior.
