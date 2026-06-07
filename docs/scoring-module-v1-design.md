# BidWar Scoring Module V1 — Design Document

**Version:** 1.0  
**Date:** 7 June 2026  
**Status:** Design only — not implemented  
**Sports:** Cricket and Badminton (V1 only)

---

## Document purpose

This document defines the architecture, database schema, event sourcing model, API, permissions, auction integration, LED display, future stats compatibility, risks, and phased implementation plan for Scoring Module V1 inside the BidWar ecosystem.

### Constraints

| Constraint | Decision |
|------------|----------|
| Ecosystem | Scoring stays inside BidWar — same users, teams, players, tournaments |
| Event sourcing | Mandatory — append-only event store |
| Sports (V1) | Cricket and Badminton only |
| OBS | Not in scope |
| Public live viewer | Not in scope |
| LED display | Required |
| Future stats | Must be supported without schema redesign |

---

## Table of contents

1. [Current tournament architecture](#1-current-tournament-architecture)
2. [Database schema proposal](#2-database-schema-proposal)
3. [Event sourcing design](#3-event-sourcing-design)
4. [API design](#4-api-design)
5. [Permission model](#5-permission-model)
6. [Auction integration](#6-auction-integration)
7. [LED display architecture](#7-led-display-architecture)
8. [Future stats compatibility](#8-future-stats-compatibility)
9. [Risks and migration](#9-risks-and-migration)
10. [Phased implementation plan](#10-phased-implementation-plan)

---

## 1. Current tournament architecture

### 1.1 Platform shape

BidWar is a **pnpm monorepo** centered on live player auctions, not match operations.

| Layer | Path | Role |
|-------|------|------|
| API | `artifacts/api-server/` | Express 5 REST, SSE broadcast |
| Organizer UI | `artifacts/auction-platform/` | Auction operator, admin, LED display |
| Owner PWA | `artifacts/owner-app/` | Mobile bidding |
| Offline | `artifacts/bidwar-local/` | Electron + SQLite mirror |
| Shared DB | `lib/db/` | Drizzle + PostgreSQL |
| API contract | `lib/api-spec/openapi.yaml` → Orval clients | Single source of truth |

Production runs as one Node process serving API + static frontends.

### 1.2 Domain model today

**Central entity:** `tournaments` (`lib/db/src/schema/tournaments.ts`)

- Lifecycle: `setup` → `active` → `completed` (auction-centric)
- `sport` / `sportId` link to `sports` table (Cricket and Badminton already seeded)
- `matchDates` is a comma-separated availability string for player registration — **not** fixtures or scores

**Squads:** `players.teamId` + `status ∈ {sold, retained}` after auction.

**Identity:** No general `users` table. Actors are organizers (JWT), admins, team owners (mobile + optional `accessCode`), and public viewers (auction code gate).

### 1.3 Key relationships

```
organizers → tournaments → teams
                        → players (→ global_players)
                        → categories
                        → auction_sessions (1:1 live state)
```

### 1.4 Auction subsystem (reference pattern)

The auction module is the closest pattern to copy for scoring:

| Concern | Auction pattern | Key file |
|---------|-----------------|----------|
| Live read model | `auction_sessions` (mutable snapshot) | `lib/db/src/schema/auction_sessions.ts` |
| Event log | Append-only `auction_*_events` | `lib/db/src/schema/auction_events.ts` |
| Real-time | SSE `GET /tournaments/:id/auction/events` | `artifacts/api-server/src/lib/broadcast.ts` |
| Client | `useAuctionSocket` → React Query | `artifacts/auction-platform/src/hooks/use-auction-socket.ts` |
| LED | `DisplayShell` — one SSE owner | `artifacts/auction-platform/src/components/display/display-shell.tsx` |
| Auth | `isOrganizerOrAdmin(req, tournamentId)` | `artifacts/api-server/src/middleware/require-organizer.ts` |
| Audit | `platform_audit_events` | `lib/db/src/schema/platform_audit.ts` |

**Engineering contract from auction events:** writes are fire-and-forget on hot path; logging failures must not block live operations.

### 1.5 What does not exist today

- Fixtures, matches, innings, rallies, ball-by-ball, points tables
- Scorer role or permissions beyond organizer/admin
- Scoreboard UI or score-specific SSE
- Stats aggregation beyond auction analytics

### 1.6 Scoring module placement

Scoring is a **new vertical** on existing entities:

```
Tournament (same row)
├── Auction phase     → existing (status: setup/active/completed)
└── Competition phase → NEW
    ├── Fixtures
    ├── Event-sourced matches
    ├── Standings
    └── LED score display
```

**Reuse:** tournaments, teams, players, sports, global_players, JWT middleware, SSE infra, OpenAPI/Orval pipeline, DisplayShell patterns, platform_audit_events.

**Build fresh:** Match lifecycle, event store, projections, scorer UX, sport rule engines, standings logic.

---

## 2. Database schema proposal

**Design principle:** One event store + sport-agnostic projections + JSON payloads for sport-specific detail. Stats are always **derived**, never the source of truth.

### 2.1 Tournament extensions

Add columns to `tournaments` (minimal, backward-compatible):

```sql
scoring_enabled          BOOLEAN NOT NULL DEFAULT false
scoring_phase            TEXT NOT NULL DEFAULT 'disabled'
                         -- 'disabled' | 'setup' | 'live' | 'completed'
scoring_format_json      JSONB   -- sport-specific tournament format
scoring_settings_json    JSONB   -- LED theme, default overs, tie-break rules
```

Do **not** overload `tournaments.status` — auction and scoring have independent lifecycles.

### 2.2 `scoring_fixtures` — scheduled matches

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| tournament_id | int FK | indexed |
| sport_slug | text | denormalized |
| fixture_number | int | display order |
| round_name | text | "League", "SF", "Final" |
| scheduled_at | timestamptz | nullable |
| venue | text | nullable |
| status | text | scheduled \| live \| completed \| abandoned \| cancelled |
| format_json | jsonb | per-fixture overrides |
| home_team_id | int FK → teams | |
| away_team_id | int FK → teams | |
| winner_team_id | int FK | nullable |
| result_summary | text | "Team A won by 5 runs" |

**Badminton:** A fixture is a **team tie** (e.g. 5 rubbers). Individual rubbers are `scoring_matches` children.

### 2.3 `scoring_matches` — playable unit

One cricket match = one row. One badminton rubber = one row.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| fixture_id | int FK | |
| tournament_id | int | denormalized |
| match_type | text | cricket \| badminton |
| match_label | text | "Match 1", "Men's Singles 1" |
| sequence | int | order within fixture |
| status | text | not_started \| live \| completed \| abandoned |
| home_side_json | jsonb | team and/or player refs |
| away_side_json | jsonb | |
| rules_json | jsonb | overs, best-of, etc. |
| current_projection_version | bigint | last applied event seq |
| started_at / completed_at | timestamptz | |

**Side descriptor example:**

```json
{
  "teamId": 12,
  "playerIds": [101, 102],
  "displayName": "Team A"
}
```

### 2.4 `scoring_sessions` — live operator state

One row per live match (mirrors `auction_sessions`).

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| match_id | int FK UNIQUE | |
| tournament_id | int | |
| status | text | idle \| live \| paused \| break |
| state_json | jsonb | full scoreboard snapshot |
| display_overlay | text | none \| innings_break \| result \| custom_banner |
| display_overlay_json | jsonb | |
| active_scorer_id | text | |
| last_event_seq | bigint | |
| updated_at | timestamptz | |

### 2.5 `scoring_events` — mandatory event store (append-only)

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | global monotonic |
| match_id | int FK | |
| tournament_id | int | denormalized |
| fixture_id | int | denormalized |
| sport_slug | text | cricket \| badminton |
| event_type | text | namespaced |
| event_version | int | payload schema version |
| sequence | bigint | per-match monotonic |
| occurred_at | timestamptz | logical time |
| recorded_at | timestamptz | server insert time |
| actor_type | text | organizer \| scorer \| system |
| actor_id | text | |
| correlation_id | uuid | undo/redo chains |
| causation_id | bigint | prior event |
| payload_json | jsonb | sport-specific body |
| metadata_json | jsonb | client version, device, IP |

**Constraints:**

- `UNIQUE (match_id, sequence)`
- INSERT ONLY — no UPDATE/DELETE from app code
- Corrections via compensating events (`*.undone`, `*.corrected`)

### 2.6 `scoring_standings` — materialized points table

| Column | Type | Notes |
|--------|------|-------|
| tournament_id, team_id | | |
| played, won, lost, tied, no_result, points | int | |
| net_run_rate | numeric | cricket only |
| rubbers_won, rubbers_lost | int | badminton ties |
| extras_json | jsonb | tie-breakers |

### 2.7 `scoring_match_lineups` — optional

For XI / rubber player assignments: `match_id`, `team_id`, `player_id`, `role`, `batting_order`, `is_playing`.

### 2.8 Future stats: `player_match_stats` (schema now, populate later)

| Column | Type | Notes |
|--------|------|-------|
| match_id, player_id, global_player_id, team_id, sport_slug | | |
| stats_json | jsonb | sport-keyed aggregates |
| projection_version | bigint | |

**Cricket stats_json example:**

```json
{
  "runs": 42, "balls": 31, "fours": 4, "sixes": 1,
  "oversBowled": "3.2", "runsConceded": 28, "wicketsTaken": 2
}
```

**Badminton stats_json example:**

```json
{ "pointsWon": 18, "pointsLost": 12, "gamesWon": 2, "gamesLost": 0 }
```

### 2.9 `matchDates` vs fixtures

| Today | Scoring V1 |
|-------|------------|
| `matchDates` → player availability | Keep unchanged |
| No fixture entity | `scoring_fixtures.scheduled_at` is authoritative |
| — | UI may suggest dates from `matchDates` when creating fixtures |

---

## 3. Event sourcing design

### 3.1 Principles

1. Events are the source of truth. Sessions and standings are projections.
2. Per-match sequence guarantees ordering and optimistic concurrency.
3. Sport logic in pure functions: `(state, event) → state` in `lib/scoring-core/`.
4. Corrections are new events, never mutations.
5. Idempotent commands via `correlation_id` + server dedup.

### 3.2 Cricket event types (V1)

| Event type | Purpose |
|------------|---------|
| `cricket.match.started` | Toss, elected to bat/bowl, overs limit |
| `cricket.innings.started` | Innings number, batting team |
| `cricket.lineup.set` | Playing XI, batting order |
| `cricket.ball.recorded` | Over.ball, runs, extras, wicket, players |
| `cricket.over.completed` | Over number, bowler change |
| `cricket.innings.ended` | All out / overs complete |
| `cricket.match.completed` | Winner, margin |
| `cricket.match.abandoned` | Reason |
| `cricket.ball.undone` | References `undoesEventId` |
| `cricket.state.corrected` | Admin correction with reason |

**V1 cricket scope:**

- T20 and custom limited overs
- Ball outcomes: 0–6, wide, no-ball, bye, leg-bye, wickets (bowled, caught, run out, stumped, LBW)
- **Out of V1:** DRS, super over, Duckworth-Lewis

### 3.3 Badminton event types (V1)

| Event type | Purpose |
|------------|---------|
| `badminton.match.started` | bestOf, pointsPerGame |
| `badminton.game.started` | Game number |
| `badminton.rally.won` | Scoring side, new score, server |
| `badminton.game.completed` | Winner, final score |
| `badminton.match.completed` | Rubber winner |
| `badminton.rally.undone` | Undo last rally |
| `badminton.fixture.tie.completed` | Aggregate rubber score |

**V1 badminton scope:**

- Rally scoring to 21, win by 2, cap at 30
- Best of 3 games per rubber
- Singles and doubles
- Team ties with multiple rubbers per fixture

### 3.4 Projection pipeline

```
Scorer → POST /matches/:id/events
       → Validate vs current projection
       → INSERT scoring_events (seq = last+1)
       → Projector applies event → UPDATE scoring_sessions
       → Update standings (if match completed)
       → SSE broadcast score_state
       → 201 { event, state }
```

**Concurrency:** POST includes `expectedSequence`. Mismatch → `409 Conflict` with current state.

**Replay:** Rebuild session from events on deploy or recovery.

### 3.5 Proposed package structure

```
lib/scoring-core/
  src/
    types.ts
    projector.ts
    cricket/   reducer.ts, validators.ts, events.ts
    badminton/ reducer.ts, validators.ts, events.ts
    standings/ cricket-league.ts, badminton-tie.ts
```

---

## 4. API design

REST + OpenAPI + Orval. New tag: `scoring`.

### 4.1 Tournament-level

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/tournaments/:tid/scoring` | Config + phase summary |
| PATCH | `/tournaments/:tid/scoring` | Enable scoring, set format |
| GET/POST | `/tournaments/:tid/scoring/fixtures` | List / create fixtures |
| PATCH/DELETE | `/tournaments/:tid/scoring/fixtures/:fid` | Edit / delete (no events only) |
| GET | `/tournaments/:tid/scoring/standings` | Points table |
| POST | `/tournaments/:tid/scoring/standings/rebuild` | Admin recovery |

### 4.2 Match-level

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/tournaments/:tid/scoring/matches` | List / create rubbers |
| GET | `/tournaments/:tid/scoring/matches/:mid` | Current projection |
| GET | `/tournaments/:tid/scoring/matches/:mid/events` | Event history |
| POST | `/tournaments/:tid/scoring/matches/:mid/events` | Append event |
| POST | `/tournaments/:tid/scoring/matches/:mid/undo` | Undo last event |
| PATCH | `/tournaments/:tid/scoring/matches/:mid/lineup` | Set XI / players |
| POST | `/tournaments/:tid/scoring/matches/:mid/start` | Start match |
| POST | `/tournaments/:tid/scoring/matches/:mid/display-overlay` | LED control |

### 4.3 Real-time (SSE)

| Method | Path | Auth |
|--------|------|------|
| GET | `/tournaments/:tid/scoring/events` | Tournament code gate OR organizer JWT |

**SSE payload types:**

- `score_state` — matchId, state, lastSequence
- `fixture_updated` — fixtureId
- `standings_updated` — tournamentId
- `display_overlay` — matchId, overlay

**Separate channel from auction SSE.** Client hook: `useScoringSocket(tournamentId, matchId?)`.

### 4.4 LED bootstrap

| Method | Path | Auth |
|--------|------|------|
| GET | `/tournaments/:tid/scoring/live` | Code gate |

### 4.5 Excluded (per constraints)

- No public anonymous score viewer (beyond code-gated LED)
- No OBS browser-source routes
- No WebSocket — SSE only

---

## 5. Permission model

### 5.1 Actor capabilities

| Actor | Mechanism | Scoring |
|-------|-----------|---------|
| Master admin | JWT `isAdmin` | Full |
| Data entry admin | JWT `adminLevel: data_entry` | Full |
| Organizer account | JWT + tournament ownership | Full |
| Tournament password organizer | JWT `organizer[tournamentId]` | Full |
| **Scorer** (new) | Scorer session token | Match-scoped write |
| LED display | TournamentCodeGate (auction code) | Read-only SSE + GET |
| Team owner | Mobile + access code | None in V1 |
| Public | — | None |

### 5.2 Scorer role

New table `scoring_scorers`: tournament_id, name, pin_hash, access_token, assigned_match_ids, active.

**Flow:**

1. Organizer generates link: `/tournament/:id/score?token=...`
2. `POST /tournaments/:tid/scoring/scorer/session` → short-lived JWT in `bidwar_scorer` cookie
3. Scorer can only write to assigned matches

### 5.3 LED access

Route: `/tournament/:id/score-display`  
Reuse `TournamentCodeGate` (same auction code verification). Read-only.

### 5.4 Audit

All mutations log to `platform_audit_events` with `event_category: "scoring"`.

---

## 6. Auction integration

### 6.1 Lifecycle

```
Auction: setup → active → completed
Scoring:  disabled → setup → live → completed
```

**Enable scoring when:**

1. Auction completed (or organizer override for practice)
2. At least 2 teams with sold/retained players
3. Sport is cricket or badminton

### 6.2 Squad → lineups

- Cricket XI: `players` where `teamId` matches and `isNonPlayingMember = false`
- Badminton: filter by `sport_roles` (Singles, Doubles)
- `playerTag` available for LED badges (cosmetic)

### 6.3 Tournament Hub

Post-auction cards:

- Set up fixtures → `/tournament/:id/scoring/fixtures`
- Open scorer → `/tournament/:id/score`
- Open score display → `/tournament/:id/score-display`

### 6.4 LED coexistence

| Day | Route | Shell |
|-----|-------|-------|
| Auction | `/tournament/:id/display` | DisplayShell (auction) |
| Match | `/tournament/:id/score-display` | ScoreDisplayShell |

V1: warn if auction `active` and scoring `live` simultaneously.

### 6.5 BidWar Local

V1 is **cloud-only**. Local SQLite sync deferred to Phase 5.

### 6.6 global_players

Denormalize `global_player_id` into events and `player_match_stats` for future cross-tournament stats.

---

## 7. LED display architecture

### 7.1 Goals

- Full-screen, 1080p-safe layout
- Single SSE subscription per tab
- Memoized children (mirror DisplayShell pattern)
- Code-gated — no public viewer

### 7.2 Component structure

```
pages/score-display.tsx          # route + TournamentCodeGate
pages/score-operator.tsx         # scorer panel
components/score-display/
  score-display-shell.tsx
  cricket-scoreboard.tsx
  badminton-scoreboard.tsx
  score-header.tsx
  score-ticker.tsx
  innings-break-overlay.tsx
  result-overlay.tsx
hooks/use-scoring-socket.ts
```

### 7.3 ScoreDisplayShell

1. One `useScoringSocket(tournamentId)` subscription
2. Bootstrap via GET + React Query
3. Route by sportSlug to cricket or badminton board
4. Overlay manager (innings break, result, banner)
5. 10s polling fallback if SSE missed
6. BroadcastChannel for theme switching

### 7.4 Cricket LED layout

```
┌─────────────────────────────────────────────────────┐
│  [Logo]  FINAL  │  Team A  156/4 (18.2)             │
│                 │  Team B  yet to bat               │
├─────────────────────────────────────────────────────┤
│  Striker: 42*(31)   Non-striker: 18(22)             │
│  Bowler: 2/28 (3.2)                                 │
│  THIS OVER:  1  4  ·  W  2  1                       │
├─────────────────────────────────────────────────────┤
│  CRR 8.42  │  Target 187  │  RRR 9.10               │
└─────────────────────────────────────────────────────┘
```

### 7.5 Badminton LED layout

```
┌─────────────────────────────────────────────────────┐
│  Team A  2  vs  1  Team B     │  Men's Singles 2   │
├─────────────────────────────────────────────────────┤
│        18  ────────●────────  15                    │
│              Game 3                                 │
└─────────────────────────────────────────────────────┘
```

---

## 8. Future stats compatibility

### 8.1 Guarantees

| Requirement | Approach |
|-------------|----------|
| No schema redesign | `stats_json` JSONB on `player_match_stats` |
| Cross-tournament stats | `global_player_id` on events + stats |
| New sports | New event_type namespace + reducer |
| Advanced metrics | Derived in projection from ball/rally events |
| Career leaderboards | Aggregate `player_match_stats` by global_player_id |

### 8.2 V1 event payloads (stats-ready)

**Cricket ball minimum:**

```json
{
  "innings": 1, "over": 14, "ball": 3,
  "strikerId": 101, "nonStrikerId": 102, "bowlerId": 205,
  "runsOffBat": 4, "extras": { "type": null, "runs": 0 },
  "wicket": null, "isLegalDelivery": true
}
```

**Badminton rally minimum:**

```json
{
  "game": 2, "winnerSide": "home",
  "homePoints": 19, "awayPoints": 17, "serverSide": "away",
  "homePlayerIds": [101], "awayPlayerIds": [201]
}
```

### 8.3 Deferred (schema supports)

- `global_player_career_stats` population
- Stats UI / leaderboards
- External exports (CricHeroes, etc.)

---

## 9. Risks and migration

### 9.1 Technical risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SSE scalability | Medium | Scope by matchId; one active match per tournament V1 |
| Projection drift | High | expectedSequence locking; rebuild endpoint |
| Concurrent scorers | Medium | Single active scorer lease per match |
| Large event replay | Low | Index (match_id, sequence) |
| Cricket edge cases | Medium | Document supported types; admin correction events |
| Badminton team ties | Medium | Fixture wizard templates |

### 9.2 Product risks

| Risk | Mitigation |
|------|------------|
| Status confusion | Separate `scoring_phase`; clear hub labels |
| matchDates vs fixtures | Keep both; import helper only |
| No live viewer expectation | Document V1 scope |
| Auction vs score LED confusion | Distinct routes and naming |
| BidWar Local gap | Document cloud-only V1 |

### 9.3 Migration

1. Add nullable columns to tournaments (non-breaking)
2. Create new scoring tables
3. Drizzle schema + drizzle-kit push
4. No backfill — greenfield for existing tournaments
5. Scoring disabled by default

---

## 10. Phased implementation plan

Effort in **person-days** for one developer familiar with BidWar.

### Phase 0 — Foundation (5–7 days)

| Task | Effort |
|------|--------|
| Drizzle schemas | 1d |
| lib/scoring-core types | 1d |
| Event append API + sequence locking | 2d |
| Cricket reducer | 2d |
| Unit tests | 1d |

**Exit:** POST ball events; GET returns projected state.

### Phase 1 — Cricket E2E (8–10 days)

| Task | Effort |
|------|--------|
| Fixture CRUD + OpenAPI | 1.5d |
| Lineup API | 1d |
| Scoring SSE + broadcast | 1d |
| useScoringSocket hook | 0.5d |
| Score operator page (cricket) | 3d |
| ScoreDisplayShell + cricket LED | 2d |
| Tournament hub integration | 0.5d |
| Standings (W/L/points/NRR) | 1.5d |
| Scorer permissions | 1d |
| Audit logging | 0.5d |

**Exit:** Full cricket match scored live; LED updates; standings refresh.

### Phase 2 — Badminton (6–8 days)

| Task | Effort |
|------|--------|
| Badminton reducer | 2d |
| Multi-rubber fixtures | 1d |
| Badminton operator UI | 2d |
| Badminton LED | 1d |
| Team tie standings | 1d |
| Tests | 1d |

**Exit:** Badminton team tie scored end-to-end.

### Phase 3 — Hardening (4–5 days)

| Task | Effort |
|------|--------|
| Undo/correct + UI | 1.5d |
| Projection rebuild tool | 1d |
| Display overlays | 1d |
| Error handling, 409 conflicts | 0.5d |
| Integration tests | 1d |
| Operator documentation | 0.5d |

### Phase 4 — Stats (deferred, 3–4 days)

| Task | Effort |
|------|--------|
| player_match_stats projector | 1.5d |
| Stats rebuild job | 1d |
| Basic stats API | 1d |
| global_player_id backfill | 0.5d |

### Phase 5 — BidWar Local (future, 8+ days)

SQLite mirror, offline queue, conflict resolution.

### Totals

| Phase | Days |
|-------|------|
| 0 Foundation | 5–7 |
| 1 Cricket E2E | 8–10 |
| 2 Badminton | 6–8 |
| 3 Hardening | 4–5 |
| **V1 total (0–3)** | **23–30 person-days** |

Phases 1 and 2 can partially overlap after Phase 0.

### Dependency order

```
Phase 0 → Phase 1 → Phase 3
       ↘ Phase 2 ↗
Phase 3 → Phase 4 (stats)
Phase 3 → Phase 5 (local)
```

---

## Summary

BidWar today is a mature **auction operations** platform. Scoring V1 adds a **competition phase** on the same tournaments, teams, and players using:

- Append-only `scoring_events` (event sourcing)
- Live projections in `scoring_sessions`
- REST + SSE (no WebSocket, OBS, or public viewer)
- Code-gated LED at `/tournament/:id/score-display`
- JSONB stats projections for future analytics
- Cricket and Badminton only in V1

**Next step when ready to implement:** Phase 0 — schema files and cricket event reducer with tests.

---

*BidWar Scoring Module V1 Design Document — generated 7 June 2026*
