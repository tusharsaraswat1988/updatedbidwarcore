# Platform Health Audit — Post EPIC-01 / EPIC-02 / EPIC-03

**Date:** 2026-08-05  
**Type:** Audit only — no implementation  
**Trigger:** Three foundational identity epics complete; clear debt before EPIC-04  
**Method:** Static analysis of schema, routes, services, UI, catalog boundaries

---

## Executive summary

| Area | Severity | Verdict |
|------|----------|---------|
| Duplicate Player models | **P1** | Real split-brain; mid-migration unfinished |
| Duplicate Team models | **P2** | Mostly intentional; one FK ambiguity |
| Duplicate Registration logic | **P1** | Two pipelines; asymmetric depth (gap risk) |
| Duplicate Competition logic | **P2** | EPIC-03 clean; naming collisions elsewhere |
| Unused services / routes / pages | **P2** | Small confirmed dead set — safe cleanup |
| Unused DB columns | **P1** | “Deprecated” columns still live (not abandoned) |
| Architecture / layer / dependency | **P2** | EPIC boundaries largely held; scoring-app alias coupling |

**No P0 (data corruption / broken platform contracts) found.**

Foundations are healthy enough to proceed to EPIC-04 after a **short cleanup sprint** targeting confirmed dead UI + unfinished player-profile migration debt — not a rewrite.

```
Platform Core
├── Tournament Identity ✅ (EPIC-01)
├── Rule Identity ✅ (EPIC-02)
├── Competition Identity ✅ (EPIC-03)
├── Presentation Identity ⏳
├── Broadcast Identity ⏳
├── Match Identity ⏳
└── Statistics Identity ⏳
```

---

## 1. Duplicate Player models

| Instance | Path | Role |
|----------|------|------|
| `playersTable` | `lib/db/src/schema/players.ts` | Auction/cricket tournament roster |
| `globalPlayersTable` / `masterPlayersTable` | `lib/db/src/schema/global_players.ts`, `master-sports.ts` | Cross-tournament person identity |
| `badmintonPlayersTable` | `lib/db/src/schema/badminton.ts` | Badminton tournament player (separate entity) |
| `tournamentPlayerProfilesTable` | `lib/db/src/schema/tournament-player-profiles.ts` | Tournament display overlay |
| `playerSportProfilesTable` | `lib/db/src/schema/player-sport-profiles.ts` | Per-(globalPlayer, sport) profile (Sprint 2 target) |
| `db-local` players | `lib/db-local/src/schema/players.ts` | Intentional offline mirror |
| `masterPlayerIdMappingsTable` | `lib/db/src/schema/master-sports.ts` | Legacy ID bridge |

**Already documented:** `docs/MULTI_SPORT_PLAYER_ARCHITECTURE_REPORT.md` (2026-06-24) — “split-brain player model.”

**Debt signal:** `@deprecated` on `global_players.handedness`, `auctionPlayerId`, `sport`, `defaultRole` — but serializers/sync/badminton paths **still read/write** several of them. Deprecated-in-name-only.

| Severity | Action |
|----------|--------|
| **P1** | **Converge** — finish migration to `player_sport_profiles`; stop writing deprecated `global_players` columns; keep `badminton_players` separate (different lifecycle) but require master-player linking; keep `db-local` as intentional mirror with drift checks |

---

## 2. Duplicate Team models

| Instance | Path | Role |
|----------|------|------|
| `teamsTable` | `lib/db/src/schema/teams.ts` | Tournament franchise (purse, owner) |
| `masterTeamsTable` | `lib/db/src/schema/master-sports.ts` | Canonical team identity |
| `badmintonGroups` / `groupMembers.teamId` | `lib/db/src/schema/badminton.ts` | League groupings; `teamId` loosely typed |
| `db-local` teams | `lib/db-local/src/schema/teams.ts` | Offline mirror |

`teams` → `master_teams` is **intentional layering**, not duplication.

| Severity | Action |
|----------|--------|
| **P2** | **Document** FK target of `badmintonGroupMembersTable.teamId`. No merge of team tables. |

---

## 3. Duplicate Registration logic

Two independent pipelines (not copy-paste duplicates):

| Pipeline | Surface | Depth |
|----------|---------|-------|
| Auction / cricket | `routes/players.ts`, `api-base/registration-*`, payment, declaration, fields | Full product |
| Badminton entries | `routes/badminton.ts`, `badminton-registration-validation.ts`, `badminton_registrations` | Entry validity only; bare `paymentRef` |

EPIC-03 Sport Bridges map both → **Participant** views without merging tables (correct).

| Severity | Action |
|----------|--------|
| **P1** | **Keep entities separate.** Converge **capabilities** (payment / declaration / field visibility) via shared `api-base` services when badminton needs them — do not reimplement in `badminton.ts`. Document that badminton eligibility rules stay sport-specific. |

---

## 4. Duplicate Competition logic

| Concept | Path | Notes |
|---------|------|-------|
| EPIC-03 Competition aggregate | `lib/platform-core/src/competition/*`, `competition-service.ts`, `routes/competition.ts`, history table | Clean Product Layer |
| Catalog Competition Type | `lib/platform-core/src/catalog/competition/` | EPIC-01 identity; consumed by EPIC-03 |
| Auction `categoriesTable` | Bid-pricing tiers | Name collision only |
| Badminton `badmintonCategoriesTable` | Event / draw categories | Name collision only |

EPIC-03 layering (platform-core → api-server glue → routes → UI) is sound. Watch: `loadParticipants` sport `if` in `competition-service.ts` — generalize via Sport Bridge registry when a third sport arrives.

| Severity | Action |
|----------|--------|
| **P2** | **Keep** EPIC-03. **Document** glossary: Competition Type vs Competition Plan vs Category (auction) vs Category (badminton). |

---

## 5. Unused services

| Item | Evidence | Action |
|------|----------|--------|
| `artifacts/api-server/src/lib/env-check.ts` | Deprecated re-export of `assertRuntimeEnv`; **zero importers** | **Delete** |

Other `api-server/src/lib` files sampled appear wired.

---

## 6. Unused routes

| Finding | Evidence |
|---------|----------|
| No unmounted routers | All routers under `routes/` mounted via `routes/index.ts` or `app.ts` (e.g. OG images) |
| EPIC-03 `competition.ts` | Correctly mounted |

---

## 7. Unused React pages (confirmed orphans)

| File | Evidence | Action |
|------|----------|--------|
| `pages/dashboard.tsx` | `/dashboard` redirects to `/organizer`; component unused | **Delete** |
| `pages/landing.tsx` | App uses `lovable-home`; orphaned | **Delete** |
| `pages/auction-data-manager.tsx` | Route redirects to workbook; component unused | **Delete** |
| `pages/obs-lab-overlay.tsx` + `obs-lab-overlay-preview.tsx` | Routes point at `obs-v2-overlay*`; orphans | **Delete** |

**Not dead (false positives):**
- `pages/badminton/*` — consumed by `scoring-app` via Vite `@` alias into `auction-platform/src`
- `local-mode.tsx` — actively routed

---

## 8. Unused DB columns

No high-confidence “zero read/write” abandoned columns found.

Instead: **deprecated-but-live** columns on `global_players` / `badminton_players.globalPlayerId` — migration incomplete. Treat as P1 migration debt (see §1), not delete candidates.

Existing docs already cover this: `TECHNICAL_DEBT_REPORT.md`, `LEGACY_FIELD_USAGE_REPORT.md`, `DATABASE_AUDIT.md`.

---

## 9. Architecture violations (EPIC-01/02/03)

| Check | Result |
|-------|--------|
| UI/routes import sport pack files directly | **Clean** — CatalogRegistry only |
| Public Competition APIs expose runtime tables | **Clean** — Participant / Configuration / Plan shapes |
| Sport business logic inside platform-core product layer | **Clean enough** — bridges map status strings only |
| Tournament State vs Business Stage vs Registration status | **Separated** in EPIC-03 design + service |
| platform-core → db | **None** |
| auction-platform → api-server internals | **None** |

---

## 10. Dependency / package boundary violations

| Finding | Severity | Notes |
|---------|----------|-------|
| `scoring-app` Vite `@` → `auction-platform/src` | **P2 Medium** | Silent coupling; badminton pages live in auction-platform but run from scoring-app. Prefer extract shared package later. |
| FEATURE_FLAG ghosts | Low | e.g. `PLAYER_SPORT_PROFILES_ENABLED` only in tests — consistent with feature-flag removal docs |
| LOCAL_MODE | Not dead | Documented parallel mode, still routed |

---

## 11. Recommended cleanup order (before EPIC-04)

### Sprint A — Safe deletes (½ day)

1. Delete `env-check.ts`
2. Delete orphaned pages: `dashboard.tsx`, `landing.tsx`, `auction-data-manager.tsx`, `obs-lab-overlay*.tsx`
3. Confirm redirects still work; smoke `/`, `/organizer`, obs v2, workbook

### Sprint B — Player migration finish (P1, multi-day)

1. Inventory remaining writes to deprecated `global_players` columns
2. Route all writes through `player_sport_profiles`
3. Stop serializing deprecated fields (or mark read-only compatibility)
4. Add drift check for `db-local` vs cloud player/team schemas

### Sprint C — Registration capability sharing (P1, when badminton needs payment)

1. Do **not** merge tables
2. Adopt `api-base` payment / declaration / fields from badminton routes when product requires them
3. Keep `badminton-registration-validation` sport-specific

### Sprint D — Glossary + bridge registry (P2, small)

1. Short `docs/` glossary: Category (×2) vs Competition Type vs Competition Plan
2. Document `badmintonGroupMembers.teamId` target
3. Plan Sport Bridge registry for `loadParticipants` before sport #3

**Do not** start EPIC-04 Presentation/Broadcast/Match identity until Sprint A is done. Sprint B can overlap EPIC-04 if scoped tightly.

---

## 12. What this audit is not

- Not a full dependency-graph / circular-import proof
- Not a DB production data volume analysis
- Not permission to rewrite registration or merge player tables
- Not dead-code deletion (this document only)

---

## Status

**AUDIT COMPLETE**

Implementation of cleanup requires explicit go-ahead (Sprint A recommended first).

Changes to frozen EPIC-01/02/03 architecture still require RFC.
```
