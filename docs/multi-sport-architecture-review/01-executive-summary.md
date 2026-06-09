# Multi-Sport Architecture Review — Executive Summary

**Date:** 2026-06-09  
**Scope:** Production cricket platform (`main`) vs. badminton cloud branch (`origin/cursor/badminton-tournament-system-0183`)  
**Constraint:** Review and design only — no code changes, merges, or deployments.

---

## Context

BidWar is evolving from a cricket-centric auction + scoring product into a modular sports platform. Two implementations exist:

| System | Branch | Status |
|--------|--------|--------|
| Cricket scoring + auction | `main` (production source of truth) | Live on Render |
| Badminton tournament ops + scoring + broadcast | `cursor/badminton-tournament-system-0183` | Functional, tested, tenant-isolated |

The badminton branch is **additive** (+8,314 lines, 33 files) and reports **0 regressions** on cricket/auction (see `docs/REGRESSION_AUDIT.md` on that branch).

---

## Overall Verdict

| Dimension | Rating | Summary |
|-----------|--------|---------|
| Shared event store | **PASS** | `scoring_events` is genuinely sport-agnostic |
| Shared match entity | **WARNING** | `scoring_matches` has forward-looking columns but cricket/badminton use it differently |
| Scoring engine | **WARNING** | Two parallel packages (`scoring-core`, `badminton-core`), no dispatcher |
| API layer | **WARNING** | `/scoring/*` (cricket) vs `/badminton/*` (sport-prefixed parallel API) |
| Database | **WARNING** | 8 new `badminton_*` tables; generic tables carry cricket defaults |
| Frontend | **FAIL** | No plugin model; cricket UI and badminton UI are separate trees |
| Event sourcing | **WARNING** | Same store, different reducers/replay/undo — not a single engine |
| Streaming | **WARNING** | Three independent in-memory SSE pools |
| Multi-sport readiness (sport #3) | **FAIL** | Adding tennis/football today would duplicate badminton's pattern |

**Platform multi-sport maturity: WARNING** — foundations exist, but sport #2 was bolted on in parallel, not integrated.

---

## Side-by-Side Subsystem Ratings

| Subsystem | Cricket (main) | Badminton (branch) | Alignment |
|-----------|----------------|-------------------|-----------|
| Database schema | WARNING | WARNING | Partial — shared `scoring_events`, divergent entity models |
| API layer | PASS (cricket) | PASS (badminton) | FAIL — incompatible surfaces |
| Routing | PASS | WARNING | Different URL conventions |
| Scoring engine | PASS (cricket) | PASS (badminton) | FAIL — no shared abstraction |
| Event sourcing | PASS | PASS | WARNING — shared store, forked replay |
| Standings | PASS (cricket NRR) | FAIL (none) | FAIL — no generic standings |
| Analytics | WARNING | WARNING | Sport-specific, no shared layer |
| Tournament structure | WARNING | PASS | FAIL — auction teams vs draw categories |
| Player structure | WARNING | PASS | FAIL — `players` vs `badminton_players` |
| Registration flows | PASS (auction) | PASS (category entry) | FAIL — unrelated models |
| Live display | PASS | PASS | WARNING — separate components |
| Broadcast layer | PASS | PASS | WARNING — duplicate SSE infrastructure |
| Realtime (SSE) | PASS | PASS | WARNING — not unified |
| WebSocket | N/A | N/A | Neither uses WebSocket |

---

## Key Findings

### Where badminton aligns with production

1. **Append-only event store** — Both sports write to `scoring_events` with monotonic per-match `sequence` and compensating undo events.
2. **Projection pattern** — State is derived from replay, not mutated as source of truth.
3. **Optimistic concurrency** — Sequence checks before append (cricket explicit; badminton implicit via service).
4. **Tournament-scoped tenancy** — All data keyed by `tournament_id`; badminton adds stricter IDOR guards.
5. **SSE for live updates** — Same transport, same single-process fan-out model.
6. **Additive integration** — Badminton branch does not modify cricket reducer, routes, or auction code.

### Where badminton diverges (critically)

1. **Separate core package** — `@workspace/badminton-core` instead of extending `@workspace/scoring-core`.
2. **Fake team IDs** — Badminton sets `homeTeamId: 0, awayTeamId: 0` on `scoring_matches` because sides are players/pairs, not auction teams.
3. **Parallel API namespace** — `/tournaments/:id/badminton/*` with semantic endpoints (`/point`, `/undo`) vs cricket's generic `/events` POST.
4. **8 sport-prefixed tables** — Full tournament ops duplicated outside generic schema.
5. **Different projection table** — Badminton uses `badminton_match_details.state_snapshot_json`; cricket uses `scoring_sessions.state_json`.
6. **Different auth model** — Per-match scorer PIN vs tournament-level `scoringPin`.
7. **No `scoring_enabled` gate** — Badminton operates independently of `tournaments.scoringEnabled` / `scoringPhase`.
8. **Frontend route split** — `/tournament/:id/score/*` (cricket) vs `/badminton/:matchId/*` and `/tournament/:id/badminton/*`.

### Where production should evolve

1. **`scoring_matches` side model** — `homeSideJson` / `awaySideJson` exist but are unused; should become the canonical side reference.
2. **`scoring_fixtures`** — Schema exists but no API; badminton built `badminton_fixtures` instead.
3. **`sports` master table** — Seeded but tournament flows still use `tournaments.sport` text column.
4. **Tenant isolation** — Badminton's `isTournamentOwner` + service-layer IDOR checks are stricter than cricket's `isOrganizerOrAdmin`.
5. **SSE granularity** — Badminton's match-scoped subscriptions are better for venue displays; cricket is tournament-only.

### Where badminton should adapt

1. **Respect production auth conventions** — Align scorer PIN scope with platform decision (tournament vs match).
2. **Use `homeSideJson`/`awaySideJson`** — Eliminate `homeTeamId: 0` sentinel hack.
3. **Consolidate snapshot projection** — Use `scoring_sessions` or a generic `match_projections` table, not `badminton_match_details.state_snapshot_json` alone.
4. **Complete frontend** — Hub links to courts/categories pages that are not routed in `App.tsx`.
5. **Integrate with `tournaments.scoringEnabled`** — Or explicitly document badminton as independent product module.

---

## Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Schema duplication per sport | **High** | Sport #3 will copy badminton's 8-table pattern |
| Fake ID sentinels | **High** | `teamId: 0` breaks FK assumptions, analytics joins, standings |
| SSE pool fragmentation | **Medium** | N sports = N broadcast modules; no Redis = no horizontal scale |
| Auth inconsistency | **Medium** | Operators learn two PIN models |
| Frontend fork | **High** | No shared scoreboard shell; OBS overlays duplicated |
| Cricket leakage in generic tables | **Medium** | `scoring_standings.net_run_rate`, `rulesJson.overs` block reuse |

---

## Minimum Architecture Changes (Cricket + Badminton Today)

Do **not** build enterprise sport abstractions. Fix only what blocks a clean two-sport coexistence:

### Must-fix before merge (P0)

1. **Eliminate `homeTeamId: 0` sentinel** — Populate `homeSideJson`/`awaySideJson` on badminton match create; make `homeTeamId`/`awayTeamId` nullable in a follow-up migration design.
2. **Unify live projection** — Badminton should write `scoring_sessions.state_json` (or one generic projection row) in addition to or instead of `badminton_match_details.state_snapshot_json`.
3. **Document product boundary** — Badminton tournament ops are a separate module from auction-scoring cricket; tournament hub must route by `tournament.sport`.
4. **Align tenant isolation** — Port badminton's `getMatchMeta(tournamentId)` guard pattern to cricket scoring service.

### Should-fix soon (P1)

5. **Single SSE module** — One broadcast registry with `{ tournamentId, matchId?, channel }` instead of three files.
6. **Sport router dispatch** — Thin dispatcher: `sportSlug → reducer + command handler` without merging reducer logic.
7. **OpenAPI coverage** — Add scoring + badminton routes to `lib/api-spec/openapi.yaml`.

### Defer until sport #3 (P2)

- Generic `sport_rules` / `sport_event_types` tables
- Plugin-based frontend
- Unified standings engine
- Redis pub/sub for SSE

---

## Final Answer

### Can the badminton system be merged without creating long-term architectural debt?

**No — not as-is.**

The branch is **safe to merge from a regression standpoint** (0 cricket/auction regressions, 100 tests pass). It is **not safe from an architecture standpoint** without accepting deliberate, quantifiable debt.

#### Debt quantification

| Debt item | Estimated remediation cost |
|-----------|---------------------------|
| 8 `badminton_*` tables (sport-prefixed duplication) | 2–3 weeks to generalize when sport #3 arrives |
| Parallel `@workspace/badminton-core` package | 1 week to add sport dispatcher; full merge into `scoring-core` not required |
| Fake `teamId: 0` on `scoring_matches` | 2–3 days schema + service fix |
| Dual projection (`scoring_sessions` vs `badminton_match_details`) | 3–5 days |
| Triple SSE broadcast modules | 2–3 days |
| Parallel API namespaces | Acceptable for 2 sports; refactor at sport #3 (~1 week) |
| Frontend route/component fork | 1–2 weeks for shared shell at sport #3 |

**Total deferred debt if merged as-is: ~4–6 engineer-weeks** before sport #3 can be added without major duplication.

#### Minimum fixes required before merge

1. Stop using `homeTeamId: 0` — use `homeSideJson`/`awaySideJson`.
2. Write badminton live state to `scoring_sessions` (unify projection).
3. Add tournament hub sport routing (`cricket` → scoring, `badminton` → badminton hub).
4. Port IDOR guards from badminton service to cricket service.
5. Fix missing frontend routes (courts/categories) or remove dead links.

#### If merged with only P0 fixes

Accept **~2–3 weeks** of known debt. Sport #3 (tennis) would require either copying badminton's pattern again (**FAIL**) or doing the P1 dispatcher work first.

#### What to postpone until sport #3

- Generic `sport_rules` / `sport_stat_types` tables
- Unified standings across sports
- Frontend plugin registry
- WebSocket upgrade
- Cross-sport analytics warehouse

---

## Report Index

| Document | Contents |
|----------|----------|
| [02-database-audit.md](./02-database-audit.md) | Per-table PASS/WARNING/FAIL |
| [03-api-audit.md](./03-api-audit.md) | REST + SSE API comparison |
| [04-frontend-audit.md](./04-frontend-audit.md) | Routes, components, cricket assumptions |
| [05-event-sourcing-audit.md](./05-event-sourcing-audit.md) | Reducers, replay, multi-sport readiness |
| [06-streaming-audit.md](./06-streaming-audit.md) | SSE, overlays, displays |
| [07-sport-generalization-plan.md](./07-sport-generalization-plan.md) | Target SPORT CORE model |
| [08-future-sport-simulation.md](./08-future-sport-simulation.md) | Tennis + football simulation |
| [09-migration-roadmap.md](./09-migration-roadmap.md) | Phased migration plan |
