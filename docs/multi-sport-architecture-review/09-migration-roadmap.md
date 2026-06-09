# Multi-Sport Migration Roadmap

**Scope:** Design only. No implementation, merge, or deployment.  
**Goal:** Support cricket + badminton in production with minimum architectural debt.

---

## Phase 0: Pre-Merge Validation (1 week)

| Task | Owner | Outcome |
|------|-------|---------|
| Checkout badminton branch in staging | DevOps | Isolated environment |
| Run full test suite (api-server + scoring-core + badminton) | QA | Confirm 100 tests pass |
| Manual smoke: cricket auction + scoring unchanged | QA | Regression sign-off |
| Manual smoke: badminton full flow (player → draw → match → display) | QA | Feature sign-off |
| Review P0 blockers with stakeholders | Architecture | Go/no-go for merge |

**Gate:** All cricket/auction flows identical to production.

---

## Phase 1: P0 Fixes on Badminton Branch (1 week)

Must complete **before** merging to `main`.

### 1.1 Eliminate fake team IDs

| Change | Detail |
|--------|--------|
| On match create | Populate `homeSideJson` / `awaySideJson` with player/pair info |
| Stop writing | `homeTeamId: 0, awayTeamId: 0` |
| Migration design | Document nullable `home_team_id` / `away_team_id` (implement in Phase 2) |

**Files affected (branch):** `badminton-service.ts` match creation

### 1.2 Unify live projection

| Change | Detail |
|--------|--------|
| On every badminton event | Upsert `scoring_sessions.state_json` |
| Keep | `badminton_match_details` for metadata (PIN, court, match type) |
| Deprecate | `state_snapshot_json` as primary read (keep as cache optional) |

### 1.3 Tournament hub sport routing

| Sport | Hub behavior |
|-------|--------------|
| `cricket` + `scoringEnabled` | Existing scoring links + standings |
| `badminton` | Link to `/tournament/:id/badminton` |
| Other | No scoring section |

**Files affected:** `tournament-hub.tsx` on `main` (coordinate with branch)

### 1.4 Port IDOR guards to cricket

| Change | Detail |
|--------|--------|
| Add | `getCricketMatchMeta(matchId, expectedTournamentId)` |
| Apply | All cricket scoring service mutations |

**Files affected:** `scoring-service.ts` on `main` (can land before or with merge)

### 1.5 Fix frontend dead links

| Option A | Register `/tournament/:id/badminton/courts` and `.../categories` routes |
| Option B | Remove links from tournament hub until pages exist |

**Recommendation:** Option A if pages are quick; Option B for faster merge.

---

## Phase 2: Merge Badminton to Main (3 days)

| Step | Action |
|------|--------|
| 1 | Merge `cursor/badminton-tournament-system-0183` → `main` after P0 |
| 2 | Run migrations (additive DDL in `lib/db/src/index.ts`) |
| 3 | Deploy to staging only (not production until Phase 3) |
| 4 | Verify tenant isolation tests pass |

**Accepted debt after merge:**

- 8 `badminton_*` tables
- Parallel API namespace
- Separate `@workspace/badminton-core`
- Triple SSE modules
- ~4–6 engineer-weeks to generalize before sport #3

---

## Phase 3: Production Enablement (1 week)

| Task | Detail |
|------|--------|
| Feature flag | `tournament.sport === 'badminton'` gates badminton hub (no flag needed if sport field suffices) |
| Documentation | Operator guide: two scoring systems, two display URLs |
| Monitoring | SSE client counts per channel |
| No cricket changes | Cricket tournaments unaffected |

**Gate:** First badminton production tournament completes successfully.

---

## Phase 4: P1 Consolidation (2 weeks, post-merge)

Non-blocking improvements.

### 4.1 Unified SSE registry

- Merge `scoring-broadcast.ts` + `badminton-broadcast.ts` → `stream-broadcast.ts`
- Support `{ tournamentId, matchId?, sportSlug? }` client keys
- Keep existing endpoint URLs

### 4.2 Sport replay dispatcher

```typescript
// lib/scoring-core/src/projector/dispatch.ts
export function replayBySport(slug, meta, events) { ... }
```

### 4.3 OpenAPI documentation

- Tag: `Scoring/Cricket` — existing `/scoring/*`
- Tag: `Scoring/Badminton` — `/badminton/*`
- Generate or hand-maintain clients consistently

### 4.4 Shared display shell

Extract from cricket `score-display-shell` and badminton `broadcast-display`:
- Tournament logo / sponsors
- Connection status banner
- Full-screen layout wrapper

### 4.5 Auth alignment decision

| Option | Description |
|--------|-------------|
| A | Standardize on tournament `scoringPin` for all sports |
| B | Keep per-match PIN for badminton; document difference |
| C | Support both via `scoring_settings_json` |

**Recommendation:** Option C — configure per tournament without code fork.

---

## Phase 5: Schema Evolution (2 weeks, before sport #3)

| Migration | Purpose |
|-----------|---------|
| Nullable team FKs on `scoring_matches` | Remove sentinel requirement |
| `sport_slug` on `scoring_standings` or rename table | Clarify cricket-only |
| `competition_participants` design | Replace per-sport player tables |
| Converge `scoring_fixtures` + `badminton_fixtures` | Single fixture model |

**Trigger:** When sport #3 (tennis) is approved.

---

## Phase 6: Sport #3 Readiness (3 weeks)

Only when business commits to third sport.

| Deliverable | Description |
|-------------|-------------|
| `competition_participants` table | Generic entrant with sport extension JSON |
| `competition_categories` table | Replaces `badminton_categories` pattern |
| Sport module interface | Formalize dispatcher contract |
| Tennis-core package | First sport using new patterns |
| Tennis UI | Using shared display shell |

---

## Document Deliverables (this review)

| Report | Status |
|--------|--------|
| Architecture Report | `01-executive-summary.md` ✅ |
| Database Report | `02-database-audit.md` ✅ |
| API Report | `03-api-audit.md` ✅ |
| Frontend Report | `04-frontend-audit.md` ✅ |
| Event Sourcing Report | `05-event-sourcing-audit.md` ✅ |
| Streaming Report | `06-streaming-audit.md` ✅ |
| Multi-Sport Migration Plan | `07-sport-generalization-plan.md` ✅ |
| Future Sport Simulation | `08-future-sport-simulation.md` ✅ |
| Migration Roadmap | This document ✅ |

---

## Timeline Summary

```
Week 1:  Phase 0 validation + Phase 1 P0 fixes
Week 2:  Phase 2 merge + Phase 3 staging/production enablement
Week 3-4: Phase 4 P1 consolidation (parallel with operations)
Week 5-6: Phase 5 schema evolution (only if sport #3 planned)
Week 7-9: Phase 6 sport #3 (tennis)
```

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| Merge breaks cricket | Regression audit + Phase 0 gate |
| Operators confused by dual URLs | Documentation + hub routing |
| `teamId: 0` corrupts analytics | P0 fix before merge |
| Sport #3 copies badminton sprawl | Phase 5 gate before sport #3 kickoff |
| SSE doesn't scale multi-instance | Phase 4 registry → Redis in Phase 7 (when needed) |

---

## Success Criteria

| Milestone | Criteria |
|-----------|----------|
| 2-sport coexistence | Cricket and badminton tournaments run simultaneously on same deployment |
| Zero cricket regression | All existing cricket + auction flows unchanged |
| Badminton production-ready | Draw → match → score → display works end-to-end |
| Debt bounded | P0 fixes complete; sport #3 blocked until Phase 5 if duplication would recur |
| No over-engineering | No DB rule engine, no frontend plugin framework, no WebSocket migration in Phases 1–4 |

---

## Final Merge Recommendation

| Question | Answer |
|----------|--------|
| Merge now without fixes? | **No** — accept 4–6 weeks debt + fake ID risk |
| Merge after Phase 1 P0? | **Yes** — bounded debt, production-safe |
| Wait for full generalization? | **No** — over-engineering; badminton is ready |
| Postpone until sport #3? | **No** — badminton is a complete product today |
