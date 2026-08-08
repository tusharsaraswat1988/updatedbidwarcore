# Sport Boundary Restoration — Phase 2 Design

**Date:** 2026-08-08  
**Status:** Approved design (awaiting implementation plan)  
**Depends on:** [`2026-08-07-product-boundary-restoration-phase1-design.md`](./2026-08-07-product-boundary-restoration-phase1-design.md)

Phase 1 restored **product** ownership (Auction vs Sports).  
Phase 2 restores **sport** ownership inside Sports: the shared Sports platform must be sport-agnostic.

### Baseline (already on branch)

Partial UI-side `SportCapabilities` already exists under `artifacts/auction-platform` (Live Ops gating, some player-tag / wizard filters, capability tests). That is **not** complete Phase 2.

Still required by this design:
- Move flag/label registry into `@workspace/platform-core` (source of truth)
- Sport-scope team-role catalog + `validateTeam` (root cause of Badminton “Captain is required”)
- Gate remaining shared forms / workbook / registration / export / CSV / Links copy
- Stop defaulting missing sport to cricket in shared paths

---

## Constitutional model

```
Sports Platform
      ↓ asks
SportCapabilities (platform-core)
      ↓ renders / validates
modules, forms, catalogs, Mission Control
```

**Law:** Shared Sports code never contains hidden cricket assumptions.  
It never branches with `if (sport === "cricket")` for UI/validation ownership.  
It branches only on capabilities.

Sports Platform owns Mission Control, Competition, Fixtures, Scheduling, Runtime chrome, Live Operations, Dashboard shells, Standings shells, Statistics shells, Reports shells, Public shells, Closeout.

Sports Platform does **not** own Captain, Overs, Playing XI, LBW, Retire-at-runs, Court Assignment, Sets, Overs Limit, Powerplay, etc. Those belong to the sport that declares them via capabilities.

---

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Depth | **B** — Shared Sports UI **and** platform catalogs / validation |
| Unsupported concepts | **Hide completely** (not optional, not Mission-Control-only) |
| Capability source of truth | **`@workspace/platform-core` registry** |
| Implementation shape | **Split:** core flags/labels in platform-core; Live Ops links/peek in Sports UI |
| Naming | Keep existing `has*` flags (equivalent to constitution `supports*`) |
| New features / redesign / engines | **Out of scope** |

---

## Architecture

### Approach: core flags vs UI chrome

```
lib/platform-core
  sport-capabilities.ts   ← flags + labels + getSportCapabilities(sportId)
        ↑
artifacts/auction-platform (Sports UI host)
  sport-capabilities.ts   ← re-export core + attach liveOpsLinks / peek lines
        ↑
Shared UI, Mission Control, forms, workbook, registration, team validation
```

**platform-core owns**
- `SportCapabilities` flag/label contract (no route builders)
- `getSportCapabilities(sportId)` for `cricket`, `badminton`, and unknown (all sport-specific concepts false)
- Catalog/list helpers that filter by capabilities when a `sportId` is provided
- Team validation that consults capabilities

**Sports UI owns**
- `liveOpsLinks` / `liveOpsPeekLines` composed from core flags + sport route helpers
- Thin re-exports so existing UI imports keep working

**Unknown / missing sport**
- Do **not** default to cricket
- Use unknown capabilities (Captain, Playing XI, Overs, CricHero, legacy specs = false)

---

## Capability contract

Retain and centralize the existing flag set (move from auction-platform into platform-core). Core subset:

| Flag / label | Cricket | Badminton | Unknown |
|--------------|---------|-----------|---------|
| `hasCaptain` | true | false | false |
| `hasPlayingXi` | true | false | false |
| `hasBench` | true | false | false |
| `hasOvers` | true | false | false |
| `hasCourts` | false | true | false |
| `hasSets` | false | true | false |
| `hasServiceSide` | false | true | false |
| `hasPowerplay` / `hasLBW` / `hasRetire` / `hasSuperOver` / `hasBoundaries` / `hasCoinToss` | true | false | false |
| `hasLegacyCricketSpecs` | true | false | false |
| `playingSquadLabel` | `"Playing XI"` | `"Lineup"` | `"Lineup"` |
| `benchLabel` | `"Bench"` | `"Reserves"` | `"Reserves"` |

**Captain rule:** `hasCaptain: false` hides **Captain and Vice Captain** everywhere (roles, tags, workbook, validation, formation strategies that require captains).

**Hide-completely rule** applies equally to Playing XI, Bench, Overs, CricHero, and legacy batting/bowling style fields when their flags are false.

Optional Phase-2 additions only if a gated shared surface already needs them (no speculative flags):
- Treat CricHero as gated by `hasLegacyCricketSpecs` (or a dedicated `hasCrichero` alias if clearer at call sites — prefer reusing `hasLegacyCricketSpecs` to avoid flag sprawl).

---

## Catalogs & validation

### Team roles

Today `TEAM_ROLE_CATALOG` marks `captain` as `required: true` for all sports. That produces Mission Control blockers: **"Captain is required."** on Badminton.

**Fix**
- Keep Captain / Vice Captain entries in the catalog (platform vocabulary).
- When listing or enforcing roles for a sport, skip roles the sport does not support.
- Captain is required **only** when `hasCaptain` is true.
- `CatalogRegistry.listTeamRoles` (or a sport-aware wrapper used by validation/UI) accepts `sportId` / capabilities and filters.

### `validateTeam`

- Accept `sportId` (preferred) or resolved capabilities in options.
- Enforce required roles only for roles active for that sport.
- Remove / skip the hard-coded INFO that team registration “usually expects a captain” when `!hasCaptain`.
- Playing-member set includes `captain` / `vice_captain` only when `hasCaptain`; otherwise count `player` (and other non-captain playing roles).

### Team formation

- Continue filtering `captain_pick` when `!hasCaptain` (already started in tournament creation wizard).
- Ensure any shared catalog listing of formation strategies applies the same filter.

### Workbook / registration / export / CSV

| Surface | Gate |
|---------|------|
| Workbook Captain / Vice Captain columns | `hasCaptain` |
| `cricheroUrl` registration field | `hasLegacyCricketSpecs` |
| Export “CricHero URL” column | `hasLegacyCricketSpecs` |
| CSV CricHero + legacy cricket headers | `hasLegacyCricketSpecs` |
| CSV default sport | never default missing slug to cricket |

### Tests

- Cricket: Captain still required; cricket concepts still present where already owned.
- Badminton: Captain absent from role lists and validation; no Captain blockers.
- Move/extend capability unit tests alongside the platform-core registry.

---

## Shared UI gating (no redesign)

| Surface | Change |
|---------|--------|
| Mission Control Teams readiness | No Captain blockers when `!hasCaptain` (via validation/catalog fix) |
| `players.tsx` / `player-register.tsx` | No cricket role fallback (`Batsman`…); filter Captain tags; legacy specs only if `hasLegacyCricketSpecs` |
| `csv-player-import.ts` | No cricket default; capability-gated headers |
| `registration-fields.ts` / `export-players-rows.ts` | Gate CricHero |
| `tournament-workbook/sheet-definitions.ts` | Gate Captain columns |
| Tournament creation draft | Do not hard-default unset sport to cricket |
| `links.tsx` | Copy from `sportLabel` / `publicTournamentDescription`, not hard-coded “Cricket” |
| Player tag option lists | `filterPlayerTagOptions` (or platform equivalent) everywhere a sport is known |

**Usage rule for shared code:** branch on capabilities / labels only.

---

## Explicit non-goals

Do **not**:
- Redesign screens
- Rename products or move routes
- Change Rule Engine, Presentation Engine, Runtime, reducers, or Match Center scoring behaviour
- Extract Sports into a new package (Phase 1 follow-up remains separate)
- Rename cricket-owned generic `scoring-*` filenames (filename debt later)
- Add Volleyball / Football / etc. beyond the capability contract
- Change Auction marketing / Buzz Studio franchise “Captain” flair unless it shares Sports team-role validation paths

---

## Success criteria

1. Badminton never displays Cricket concepts (Captain, Playing XI, Bench, Overs, CricHero, cricket role defaults) in shared Sports surfaces.
2. Cricket never displays Badminton-only concepts (Courts, Sets, Service Side) in shared Sports surfaces that are capability-gated.
3. Shared Sports UI knows nothing about Cricket as a special case — only capabilities.
4. Adding a future sport requires declaring capabilities in platform-core, not editing shared Mission Control screens.
5. No behavioural change to cricket or badminton scoring engines.

---

## Verification plan

- Unit: platform-core capability registry (cricket / badminton / unknown)
- Unit: team validation — cricket requires Captain; badminton does not list or require Captain
- Unit: tag/workbook/registration gating helpers
- Manual: Badminton tournament Mission Control → Teams attention list has no “Captain is required”
- Manual: Cricket tournament still surfaces Captain where expected

---

## Implementation order (for the plan)

1. Move capability flags/labels + `getSportCapabilities` into `platform-core`; re-export from Sports UI; keep Live Ops chrome in UI.
2. Sport-scope team role listing + `validateTeam`; fix foundation tests.
3. Gate workbook, registration, export, CSV, player forms, tags, Links copy, creation defaults.
4. Regression pass on cricket + badminton Mission Control.

---

## Audit appendix (classification)

Highest-priority shared leaks addressed by this phase:

| Class | Examples |
|-------|----------|
| 2 Generic validation | `TEAM_ROLE_CATALOG` captain required; `validateTeam` captain INFO |
| 3 Generic forms | players/player-register cricket role fallback; legacy specs; CSV cricket default |
| 1 Generic UI | Links “Cricket public” hard-coding; unfiltered Captain tags |
| 7 Generic reports/export | CricHero export column always present |
| 10 Capability missing placement | Registry lived only in UI — move to platform-core |

Cricket-owned Match Center / live pad / rule packs / presentation packs remain cricket modules and are **not** rewritten in Phase 2.
