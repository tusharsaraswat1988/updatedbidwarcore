# Production Stabilization Tracker

One module at a time. Code changes stop when a module reaches **Code Complete** and regressions pass. Business validation runs separately.

**Production Safe rule:** YES only after manual or business verification. Automated tests alone → **CONDITIONAL (Pending Validation)**.

## Frozen modules (do not modify unless regression, incident, or validated reproducible issue)

| Module | Code | Regression | Business validation | Notes |
|--------|------|------------|---------------------|-------|
| Auction | Complete | Complete | Pending | Fair queue, draw state sync, local parity |
| Cricket Scoring | Complete | Complete | Pending | `lastSequence` undo contract, live display abandoned |
| Badminton Scoring | Complete | Complete | Pending | `lastSequence` undo contract |
| Tournament Management | Complete | Complete | Pending | Cascade delete, lifecycle status, sport validation |
| **Public Scoreboards** | **Complete** | **Complete** | **Pending** | See sprint notes below |

## Active epic: Registration (multi-sprint — not frozen)

| Sprint | Status | Tests | Notes |
|--------|--------|-------|-------|
| Sprint 1 | **Complete** | 240 api-server | Delete guards, category validation, import sync |
| Sprint 2 | **Complete** | 245 api-server | Withdrawals, badminton reg validation, organizer UX |
| Sprint 3 | **Complete** | 253 api-server | Registration integrity validation (withdraw/reinstate hardening) |
| Business Validation | **In progress** | 253 automated + audit PASS | BV-1/BV-2/BV-3 closed; legacy migration complete; BV-4 manual E2E open |
| Sprint 4+ | Planned | — | Documents depth, search perf, payment UI polish |

**Epic complete when:** all registration workflows below are stabilized and no known production issues remain.

### Registration workflow checklist

| Workflow | Status | Notes |
|----------|--------|-------|
| Manual player create | Stabilized | Category validation (Sprint 1) |
| Bulk CSV import | Stabilized | Master sync + category validation (Sprint 1) |
| Tournament import | Stabilized | Master sync (Sprint 1); category mapping manual |
| Edit registration | Stabilized | Category validation on PATCH |
| Delete registration | Stabilized | Guards + cleanup + delete error toast (S1–2) |
| Public self-registration | Stabilized | Category validation; withdrawn mobile updates profile only unless auto-approve (S3) |
| Payment approve/reject | Partial | API exists; UI polish deferred (Sprint 4+) |
| Category assignment | Stabilized | Tournament-scoped validation |
| Duplicate detection | Stabilized | Name/mobile (cricket); category entry dup (badminton S2) |
| Auction eligibility | Stabilized | Withdrawn excluded from pool; sold/retained blocked |
| Badminton registration | Stabilized | Doubles atomic withdraw + reinstate validation (S3) |
| Withdrawals | Stabilized | Auction field preservation; limit integrity; public approval gate (S3) |
| Custom fields / specs | Partial | Dual-write on create/edit; no separate document store |
| Search/filter (organizer) | OK at current scale | No measurable perf issue — deferred |
| Public registration UX | Partial | Withdrawn filter + 409 delete messaging (S2); mobile polish later |

## Roadmap (after Registration epic)

1. Organizer Portal
2. Mobile/PWA

---

## Business Validation Sprint (2026-06-26)

**Objective:** End-to-end organizer workflow confidence. No new features, no refactors, no payment UI.

**Automated evidence run:**
- `artifacts/api-server` vitest: **253/253 PASS**
- `pnpm --filter @workspace/scripts run verify:local`: **PASS** (API + frontend proxy + CORS)
- `pnpm exec tsx --env-file=.env scripts/audit-multi-sport-data.ts --json`: **PASS** (exit 0; P0 totals zero after legacy migration 2026-06-26)

**Legend:** PASS = verified in this sprint | FAIL = blocking issue found | NOT VERIFIED = requires live organizer manual walkthrough

### Cricket organizer workflows

| # | Workflow | Status | Evidence / notes |
|---|----------|--------|------------------|
| 1 | Create tournament | NOT VERIFIED | API/UI path exists; no full create flow executed in this sprint |
| 2 | Configure tournament | NOT VERIFIED | PATCH + settings UI; audit reason on config changes implemented |
| 3 | Register players | NOT VERIFIED | Manual create + public register routes; category validation tested in Sprint 1 |
| 4 | Edit registrations | NOT VERIFIED | PATCH + spec dual-write unit tests; no live edit walkthrough |
| 5 | Withdraw and reinstate players | PASS | `registration-integrity.test.ts`; Sprint 3 public approval gate; organizer endpoints + UI (S2) |
| 6 | Bulk import players | NOT VERIFIED | CSV import unit tests in auction-platform; master sync in Sprint 1; no live bulk run |
| 7 | Run auction | NOT VERIFIED | `auction-bid`, `auction-player-selection`, `mirror.test` unit coverage; no live auction session |
| 8 | Complete auction | NOT VERIFIED | Lifecycle `completed` status supported; no full session walkthrough |
| 9 | Start scoring | NOT VERIFIED | `scoring-feature`, `p0-sport-isolation` tests; cricket golden replay PASS |
| 10 | Finish match | PASS | `cricket-platform-replay-golden.test.ts` — event replay to terminal state |
| 11 | Verify statistics | PASS | RCV clean; legacy migration complete; audit P0 zero |
| 12 | Verify public scoreboard | PASS | `public-scoreboards.test.ts`; live `GET /tournaments/4/scoring/leaderboards/runs` → 200 |
| 13 | Verify leaderboards | PASS | Live leaderboard API 200; `scoring-standings.test.ts`; public hub UI wired |

### Badminton organizer workflows

| # | Workflow | Status | Evidence / notes |
|---|----------|--------|------------------|
| 1 | Create tournament | NOT VERIFIED | Same as cricket create path with `sport=badminton` |
| 2 | Create categories | NOT VERIFIED | `GET /tournaments/5/badminton/categories` → 200 on local dev |
| 3 | Register singles | NOT VERIFIED | Validation layer + duplicate checks; no live singles entry |
| 4 | Register doubles | NOT VERIFIED | `badminton-registration-validation.test.ts` |
| 5 | Withdraw/reinstate pair | PASS | Atomic entry rule + PATCH reinstate validation (Sprint 3); UI withdraw (S2) |
| 6 | Draw generation | NOT VERIFIED | `POST .../generate-draw` exists; no live draw on dev data |
| 7 | Match scoring | PASS | `badminton-platform-replay-golden.test.ts`; `GET /tournaments/5/badminton/matches` → 200 |
| 8 | Public scoreboard | NOT VERIFIED | Badminton public display routes exist; no visual/OBS walkthrough |
| 9 | Statistics | PASS | Legacy repair applied; audit P0 zero (2026-06-26) |

### Registration integrity (cross-workflow)

| Concern | Status | Evidence / notes |
|---------|--------|------------------|
| Master Player linkage | PASS | Legacy profiles backfilled; RCV + audit confirm sync path clean |
| Tournament Profile (`serialNo`, identity) | PASS | Withdraw preserves `serialNo`; integrity tests |
| Auction eligibility | PASS | Withdrawn excluded from pool (`status=available` filter); no auto-reinstate without setting (S3) |
| Category | PASS | Preserved on withdraw; tournament-scoped validation (S1) |
| Bid values | PASS | Preserved on withdraw/reinstate (S3 integrity tests) |
| Specifications | PASS | `player-specification-service.test.ts` dual-write; audit P2: 3 legacy-only spec rows (non-blocking) |
| Team linkage | PASS | Legacy assignments repaired; new sales use `resolveTournamentSport` |
| Audit history | NOT VERIFIED | `auditLog` on withdraw/reinstate/delete; no live audit log UI review |

### P0 / P1 blockers before epic sign-off

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| BV-1 | P0 | Wrong sport on statistics for badminton tournament | **CLOSED** — legacy data; repaired 2026-06-26; audit P0 zero |
| BV-2 | P0 | Wrong sport on team assignments (badminton) | **CLOSED** — legacy data; repaired 2026-06-26; audit P0 zero |
| BV-3 | P0 | Missing sport profiles for global players | **CLOSED** — legacy backfill; audit P0 zero |
| BV-4 | P1 | Full organizer E2E not executed | Open — manual checklist walkthrough on staging (both sports) |

**Registration Epic status:** **NOT COMPLETE** — BV-1/BV-2/BV-3 closed. Legacy migration complete. Remaining gate: BV-4 manual walkthrough before Payment UI polish.

---

## Root Cause Verification (2026-06-26)

**Script:** `pnpm --filter @workspace/scripts run verify:root-cause-rcv`

Fresh end-to-end workflows via production code paths (not UI):

| Sport | Tournament ID | Workflow | BV-1 | BV-2 | BV-3 |
|-------|---------------|----------|------|------|------|
| Cricket | 19 (`RCV-MQUTWPC0`) | Register → auction sale → score match → stats | 0 | 0 | 0 |
| Badminton | 20 (`RCV-MQUTWPC0`) | Auction sale → reg → score match → stats | 0 | 0 | 0 |

`PLAYER_SPORT_PROFILES_ENABLED=true` during run.

**Conclusion:** Current production code does **not** create BV-1/BV-2/BV-3 corruption. Audit P0s on dev DB (tournament 5 badminton) are **legacy data**.

### Remediation dry-run (no `--apply`)

| Script | Would repair |
|--------|----------------|
| `repair-player-statistics.ts --dry-run` | 1 row → sport `badminton` (tournament 5) |
| `repair-team-assignments.ts --dry-run` | 3 rows → sport `badminton` (tournament 5) |
| `repair-player-sport-profiles.ts --dry-run` | 11 missing profiles (historical global players) |

### Legacy migration (COMPLETE — 2026-06-26)

Repairs applied in order; post-audit exit 0. Archived report: `docs/archive/LEGACY_MULTI_SPORT_DATA_REMEDIATION_2026-06-26.md`.

| Script | Applied | Result |
|--------|---------|--------|
| `repair-player-statistics.ts --apply` | 1 row | OK |
| `repair-team-assignments.ts --apply` | 3 rows | OK |
| `repair-player-sport-profiles.ts --apply` | 11 profiles | OK |
| `audit-multi-sport-data.ts --json` | — | Exit 0; `totals` all zero for P0 categories |

---

## Registration — Sprint 3 notes (2026-06-26)

**Registration Integrity Validation** — required before payment UI polish.

### Fixes shipped

| Issue | Category | Root cause | Files |
|-------|----------|------------|-------|
| Public re-register auto-reinstated withdrawn players | Business rule violation | Sprint 2 set `status: available` on mobile match | `routes/players.ts`, `lib/player-withdrawal.ts` |
| No tournament setting for auto-approve on withdraw re-register | Missing config | No flag | `schema/tournaments.ts`, `routes/tournaments.ts`, serializers |
| Withdraw cleared player tags / cosmetic flags | Auction compatibility | Over-broad `.set()` on withdraw | `lib/player-withdrawal.ts` |
| Reinstate cleared fields unnecessarily | Auction compatibility | Redundant null clears on reinstate | `lib/player-withdrawal.ts` |
| Badminton partner could register new entry while withdrawn doubles exists | Doubles integrity | Duplicate check ignored `withdrawn` | `routes/badminton.ts` |
| Badminton reinstate skipped category/limit validation | Validation gap | PATCH accepted without checks | `routes/badminton.ts`, `lib/badminton-registration-validation.ts` |

### Business rules enforced

1. **Withdraw → public re-registration:** Profile updates only; player stays `withdrawn` unless `autoApproveWithdrawnReRegistration` is enabled on the tournament. Response includes `requiresOrganizerApproval` when still withdrawn.
2. **Registration limit:** `reinstateTournamentPlayer` and auto-approve path fail with `REGISTRATION_LIMIT_REACHED` when active count ≥ limit (withdraw → new register → reinstate original fails gracefully).
3. **Auction compatibility:** Withdraw/reinstate preserve `categoryId`, bid values, `globalPlayerId`, `serialNo`, `playerTag`, specifications (dual-write unchanged); only roster fields cleared when present.
4. **Badminton doubles:** Entry-level withdraw is atomic (both partners out of draw); withdrawn entries block duplicate category registration until reinstated.

### Tests

- `registration-integrity.test.ts` (withdraw preservation, limit, public auto-approve)
- `badminton-registration-validation.test.ts` (reinstate conflicts)
- Full api-server suite: **253** tests passing (auction compatibility regression included)

### Manual verification (Sprint 3)

- Withdrawn player public re-register → profile updated, still withdrawn, `requiresOrganizerApproval: true`
- Enable `autoApproveWithdrawnReRegistration` → public re-register reinstates when limit allows
- Limit full → reinstate organizer endpoint returns 403 `REGISTRATION_LIMIT_REACHED`
- Withdraw available player → category/basePrice/serialNo/playerTag unchanged
- Badminton doubles withdraw → both players blocked from new entry until reinstate

### Rollback

Revert Sprint 3 changes in `player-withdrawal.ts`, `routes/players.ts`, `routes/badminton.ts`, `badminton-registration-validation.ts`, tournament schema/ensure-schema, and Sprint 3 tests.

---

## Registration — Sprint 2 notes (2026-06-26)

Priorities executed: P1 Withdrawals → P2 Badminton registration → P3 specs (verified, no new doc store) → P4 search (no measurable issue) → P5 partial UX → P6 payment UI deferred.

### Fixes shipped

| Issue | Category | Root cause | Files |
|-------|----------|------------|-------|
| No withdrawal lifecycle for auction players | Incomplete workflow | No `withdrawn` status or API | `lib/player-withdrawal.ts`, `lib/player-status.ts`, `routes/players.ts` |
| Withdrawn players still counted toward registration limit | Bug | `computeRegistrationStatus` counted all rows | `routes/players.ts`, `countActiveRegistrations` |
| Withdrawn player could stay on auction block / deferred queue | Bug | No session cleanup on withdraw | `lib/player-withdrawal.ts` |
| No organizer reinstate path | Incomplete workflow | No reinstate endpoint / limit check | `routes/players.ts` |
| Public re-register after withdraw blocked by limit | Bug | Withdrawn still counted; no auto-reinstate on mobile match | `routes/players.ts` |
| Badminton category entry without gender/doubles rules | Validation | POST accepted invalid pairs | `lib/badminton-registration-validation.ts`, `routes/badminton.ts` |
| Badminton duplicate category entries | Bug | No duplicate check per category | `routes/badminton.ts` |
| No badminton registration withdraw/reinstate API | Incomplete workflow | Only status on create | `routes/badminton.ts` PATCH |
| Organizer delete failures silent | UX | No toast on 409 | `pages/players.tsx` |
| No withdraw/reinstate in organizer UI | UX | Missing actions | `pages/players.tsx`, `lib/registration-api.ts` |

### Tests

- `registration-withdrawal.test.ts`, `badminton-registration-validation.test.ts`
- Full api-server suite: **245** tests passing

### Manual verification (Sprint 2)

- Withdraw available player before auction → excluded from next pick
- Withdraw player on auction block → block cleared
- Cannot withdraw sold/retained player → 409
- Reinstate withdrawn player → available; respects registration limit
- Withdrawn mobile re-registers via public form → reinstated
- Badminton mixed doubles rejects same-gender pair
- Badminton category withdraw/reinstate via UI
- Delete sold player → toast shows API error

### Rollback

Revert `player-withdrawal.ts`, `player-status.ts`, `badminton-registration-validation.ts`, `routes/players.ts` (withdraw/reinstate/limit), `routes/badminton.ts` (registration validation/PATCH), auction-platform `registration-api.ts`, `players.tsx`, `badminton/categories.tsx`, and Sprint 2 tests.

---

## Registration — Sprint 1 notes (2026-06-26)

### Fixes shipped

| Issue | Category | Root cause | Files |
|-------|----------|------------|-------|
| Delete sold/retained/unsold players | Bug / data integrity | Raw DELETE with no guards; FK/orphan risk | `lib/player-delete-guard.ts`, `routes/players.ts` |
| Delete available player left specs/bids | Incomplete cleanup | No cascade for spec values / bids | `lib/player-delete-guard.ts` |
| Invalid categoryId cross-tournament (IDOR) | Validation | categoryId accepted without tournament check | `lib/category-tournament-guard.ts`, `routes/players.ts` |
| Bulk CSV import skipped master sync | Cross-module | No `syncAuctionPlayerToMasterAsync` in bulk loop | `routes/players.ts` |
| Tournament player import skipped master sync | Cross-module | Same on import-from-tournament path | `routes/players.ts` |
| Purse drift after delete with team | Data consistency | Purse recalc not on delete | `lib/player-purse.ts`, delete path |

### Tests

- `registration-player-delete.test.ts` (delete guard contract)
- Full api-server suite: **240** tests passing

### Manual verification (Sprint 1)

- Delete available registered player → succeeds
- Delete sold player → 409 with clear message
- Delete player on auction block → 409
- Register with wrong tournament categoryId → 403/404
- Bulk import → player appears in cricket/badminton master paths

### Rollback

Revert `player-delete-guard.ts`, `category-tournament-guard.ts`, `player-purse.ts`, `routes/players.ts` (delete/category/bulk/import sections), `registration-player-delete.test.ts`.

---

## Public Scoreboards — sprint notes (2026-06-26)

### Scope covered

Live public scoreboard (cricket LED), match summary/scorecard pages, tournament standings & leaderboards, public player/team profiles, completed match history, SSE/live updates, refresh/reconnect fallback, empty/error states, cricket + badminton public views.

### Fixes shipped

| Issue | Category | Root cause | Files |
|-------|----------|------------|-------|
| Abandoned matches missing from public Results list | Bug | Hub filtered `status === "completed"` only | `pages/scoring-public.tsx`, `lib/scoring-api.ts` |
| Abandoned matches missing from public team recent results | Bug | Team profile query used `completed` only | `lib/scoring-public-service.ts`, `lib/scoring-match-terminal.ts` |
| Cricket LED polled every 15s while SSE connected | Performance / sync | `useScoringLive` ignored connection status | `hooks/use-scoring-match.ts`, `score-display-shell.tsx`, `lib/sse-polling.ts` |
| Public tournament hub stale during live play | Incomplete workflow | No schedule/standings/leaderboard refetch | `pages/scoring-public.tsx` |
| Public match scorecard stale for live matches | Incomplete workflow | Single fetch, no live polling | `pages/scoring-match-public.tsx` |
| Badminton public display no offline fallback | SSE reconnect | SSE-only sync; no poll when disconnected | `hooks/use-badminton-match.ts` |

### Tests

- `public-scoreboards.test.ts` (terminal match status contract)
- Full api-server suite: **234** tests passing

### Manual / business verification

Not done. Recommended checks:

- Abandoned cricket match appears in tournament Results and team profile recent results
- Cricket LED (`/score-display`) updates via SSE; polling resumes when SSE drops
- Public tournament hub refreshes live section without manual reload
- Live public scorecard page updates during an in-progress match
- Badminton broadcast display reconnects after network blip
- Empty tournament / scoring-not-enabled shows appropriate empty state
- Standings and leaderboards match organizer view after match completion

### Rollback

Revert `scoring-match-terminal.ts`, `scoring-public-service.ts` (team matches query), auction-platform changes in `scoring-public.tsx`, `scoring-match-public.tsx`, `use-scoring-match.ts`, `use-badminton-match.ts`, `score-display-shell.tsx`, `sse-polling.ts`, `scoring-api.ts`, and `public-scoreboards.test.ts`.

---

## Tournament Management — sprint notes (2026-06-26)

### Fixes shipped

| Issue | Category | Root cause | Files |
|-------|----------|------------|-------|
| Organizer `DELETE /tournaments/:id` FK failures | Bug / incomplete workflow | Raw row delete without cascade left tournament-scoped FK children | `routes/tournaments.ts` → `adminDeleteTournamentCascade` |
| Invalid lifecycle `status` on PATCH | Validation | `z.string()` accepted arbitrary values | `routes/tournaments.ts`, `routes/auth.ts`, `lib/tournament-lifecycle.ts` |
| Unknown sport on create/edit | Validation / cross-module | Any string accepted; badminton tournaments could be created with invalid slugs | `routes/sports.ts`, `routes/tournaments.ts`, `routes/auth.ts` |
| Scoring enabled on non-scoring sports | Cross-module consistency | Admin could toggle `scoringEnabled` on football etc. | `routes/tournaments.ts`, `routes/auth.ts` |
| Organizer-account create missing `sportId` | Cross-module consistency | `sport` set but `sport_id` null vs other create paths | `routes/auth.ts` |

### Tests

- `tournament-management.test.ts` (lifecycle constants, scoring sport guard, sport slug validation)
- Full api-server suite passing after changes

### Manual / business verification

Not done. Recommended checks:

- Create cricket and badminton tournaments; confirm sport select + save
- Organizer delete empty test tournament (no 500)
- Admin enable scoring only on cricket/badminton
- Lifecycle status transitions in hub (setup → active → completed)

### Rollback

Revert `tournament-lifecycle.ts`, `tournaments.ts`, `auth.ts` (sport/status/scoring/delete sections), `sports.ts` (`isKnownActiveSportSlug`), and `tournament-management.test.ts`.

---

## Change log

| Date | Module | Action |
|------|--------|--------|
| 2026-06-26 | Auction | Frozen — Pending Business Validation |
| 2026-06-26 | Cricket Scoring | Frozen — Pending Business Validation |
| 2026-06-26 | Badminton Scoring | Frozen — Pending Business Validation |
| 2026-06-26 | Tournament Management | Code Complete — Pending Business Validation |
| 2026-06-26 | Public Scoreboards | Code Complete — Pending Business Validation |
| 2026-06-26 | Registration | Sprint 1 complete — epic in progress |
| 2026-06-26 | Registration | Sprint 2 complete — epic in progress |
| 2026-06-26 | Registration | Sprint 3 complete — integrity validation; epic in progress |
| 2026-06-26 | Registration | Business Validation Sprint started — P0 audit findings on dev DB |
| 2026-06-26 | Registration | Root Cause Verification — fresh data clean; legacy repair dry-run only |
| 2026-06-26 | Registration | Legacy multi-sport data migration complete — BV-1/BV-2/BV-3 closed; audit exit 0 |
