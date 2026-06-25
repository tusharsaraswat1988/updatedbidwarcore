# Feature Flag Removal Audit

**Sprint 4 — Prepare removal of `PLAYER_SPECS_V2_ENABLED` and `PLAYER_SPORT_PROFILES_ENABLED`**

Both flags default **OFF**. Goal: document every behavioral fork before flags can be removed.

---

## PLAYER_SPECS_V2_ENABLED

**Env:** `PLAYER_SPECS_V2_ENABLED=true|false`  
**Helper:** `isPlayerSpecsV2Enabled()` in `lib/api-base/src/player-specs-v2.ts`

| File | Behavior when OFF | Behavior when ON | Risk if removed | Migration requirement |
|------|-------------------|------------------|-----------------|----------------------|
| `artifacts/api-server/src/lib/player-spec-response.ts` | Serializers return legacy columns only | Adds `specifications[]`, dual-write on save | **P0** — LED/export/search break without ON path | All clients must read `specifications[]` |
| `artifacts/api-server/src/lib/player-specification-service.ts` | No DB writes to `player_spec_values` | Normalized read/write | **P0** | Run `migrate-player-spec-values.ts --apply` on all envs |
| `artifacts/api-server/src/routes/global-players.ts` | Search returns legacy batting/bowling fields | Enriches search with `specifications[]` | **P1** | Registration prefill depends on specs |
| `artifacts/api-server/src/lib/master-sports/player-sport-profile-service.ts` | `handedness` from `battingStyle` (cricket only) | Hand from spec group matching `/hand/i` | **P1** | Badminton profiles need spec rows |
| `artifacts/auction-platform/src/lib/player-spec-display.ts` | Falls back to legacy trio labels | Uses `specifications[]` | **P1** | LED shows wrong labels without v2 |
| `artifacts/auction-platform/src/pages/players.tsx` | Legacy form fields | Dynamic specs + bridge | **P1** | UI already dual-mode |
| `artifacts/auction-platform/src/pages/player-register.tsx` | Legacy trio | Dynamic specs | **P1** | Public registration |
| `lib/api-client-react/.../api.schemas.ts` | No `specifications` on Player type | Optional `specifications[]` | **P2** | Regenerate OpenAPI |

**Removal prerequisite:** 100% of production players have `player_spec_values` OR acceptable legacy fallback documented.

---

## PLAYER_SPORT_PROFILES_ENABLED

**Env:** `PLAYER_SPORT_PROFILES_ENABLED=true|false`  
**Helper:** `isPlayerSportProfilesEnabled()` in `lib/api-base/src/player-sport-profiles.ts`

| File | Behavior when OFF | Behavior when ON | Risk if removed | Migration requirement |
|------|-------------------|------------------|-----------------|----------------------|
| `artifacts/api-server/src/lib/master-sports/sync.ts` | Legacy global_players sport/role overwrite on sync | Identity-only global update + `player_sport_profiles` upsert | **P0** — last-sync-wins returns | Backfill all profiles |
| `artifacts/api-server/src/routes/global-players.ts` | Legacy search (all sports, legacy spec columns) | Sport-filtered identity search | **P0** — cross-sport search bleed | Pass `?sport=` everywhere (done Sprint 3) |
| `artifacts/api-server/src/lib/master-sports/global-player-response.ts` | No `sportProfiles[]` on API | Adds `sportProfiles[]` | **P1** | Clients use sportProfiles |
| `artifacts/api-server/src/routes/global-players.ts` (POST) | Writes legacy global sport/role | Upserts per-sport profile | **P1** | API consumers updated |
| `lib/db/src/schema/global_players.ts` | Columns actively written | Deprecated, not updated on sync | **P2** | Phase B stop writes |

**Removal prerequisite:** `repair-player-sport-profiles.ts --apply` clean audit; no missing profiles.

---

## Combined flag matrix

| Scenario | Specs v2 | Sport profiles | Result |
|----------|----------|----------------|--------|
| Legacy production | OFF | OFF | Cricket-shaped; cross-sport risk on search |
| Partial (unsafe) | ON | OFF | Specs OK; global sync may overwrite sport |
| Partial (unsafe) | OFF | ON | Profiles OK; LED/export lack specs |
| **Target** | ON | ON | Full multi-sport |

**Recommendation:** Enable both flags together in staging, then production after repair scripts pass.

---

## Flag removal sequence (future)

1. Default both flags to `true` in code (ignore env)
2. Monitor 2 weeks — no legacy-only code paths exercised
3. Delete `if (!isPlayerSpecsV2Enabled())` branches
4. Delete `if (!isPlayerSportProfilesEnabled())` branches
5. Remove env vars from `.env.example`

---

## Tests covering flags

| Test file | Coverage |
|-----------|----------|
| `player-specification-service.test.ts` | Specs v2 flag |
| `player-sport-profiles.test.ts` | Sport profiles flag + isolation |

Add integration test: flags ON + E2E script exit 0.
