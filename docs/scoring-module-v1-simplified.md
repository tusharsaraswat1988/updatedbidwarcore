# BidWar Scoring Module V1 — Simplification Proposal

**Version:** 1.0  
**Date:** 7 June 2026  
**Status:** Design only — not implemented  
**Supersedes (for V1 scope):** `scoring-module-v1-design.md` implementation plan  
**V1 sport:** Cricket only (Badminton deferred)

---

## Document purpose

This document reviews `scoring-module-v1-design.md` and proposes a simplified V1 that delivers the **fastest production-ready Cricket scoring** while preserving event sourcing, future badminton support, and future player statistics without schema redesign.

### Goals

| Goal | Approach |
|------|----------|
| Reduce implementation complexity | Fewer tables, APIs, auth types, event types |
| Mobile-first scorer UX | Phone-native ball pad, minimal navigation |
| Simplify fixture vs match | Single `scoring_matches` entity |
| Scorer accounts in V1? | **No** — organizer + optional PIN |
| Badminton team ties in V1? | **Deferred to V2** |
| Match Summary | **Added** — projection from events |
| Fastest Cricket V1 | ~14–17 person-days vs 23–30 |

### Unchanged constraints

- Scoring stays inside BidWar (same users, teams, players, tournaments)
- Event sourcing is mandatory
- No OBS, no public live viewer
- LED display required
- Future stats without schema redesign

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [What to cut vs keep](#2-what-to-cut-vs-keep)
3. [Fixture vs match simplification](#3-fixture-vs-match-simplification)
4. [Scorer accounts decision](#4-scorer-accounts-decision)
5. [Badminton deferral](#5-badminton-deferral)
6. [Mobile-first scorer UX](#6-mobile-first-scorer-ux)
7. [Match Summary module](#7-match-summary-module)
8. [Further complexity reductions](#8-further-complexity-reductions)
9. [Revised architecture](#9-revised-architecture)
10. [Revised schema](#10-revised-schema)
11. [Revised API](#11-revised-api)
12. [Revised implementation plan](#12-revised-implementation-plan)
13. [Decision log](#13-decision-log)
14. [Risks of simplification](#14-risks-of-simplification)

---

## 1. Executive summary

| Original V1 | Simplified V1 |
|-------------|---------------|
| Cricket + Badminton | **Cricket only** (ship) |
| `fixtures` + `matches` (2 entities) | **Single `matches` entity** |
| Dedicated scorer accounts + JWT | **Organizer scores; optional match PIN** |
| Badminton team ties in V1 | **Deferred to V2** |
| Standings with auto NRR | **Simple W/L/points table** |
| Desktop-style operator console | **Mobile-first scorer UI** |
| No match summary | **Match Summary module** (projection) |
| **23–30 person-days** | **~14–17 person-days** |

**Unchanged:** event sourcing (`scoring_events`), live projection (`scoring_sessions`), SSE + LED, same users/teams/players/tournaments, `player_match_stats` schema (empty until later).

---

## 2. What to cut vs keep

### Cut from V1 (defer without schema breakage)

| Item | Reason |
|------|--------|
| `scoring_fixtures` table | Cricket = one scheduled game = one match; ties only needed for badminton |
| `scoring_scorers` table + `bidwar_scorer` cookie | Organizer is the scorer at most local events; adds auth surface |
| Badminton reducer, UI, LED | Largest parallel workstream; cricket is the critical path |
| Badminton team ties / multi-rubber fixtures | Highest product + engineering complexity in original design |
| Auto NRR calculation | Edge cases (DLS, abandoned) multiply logic; manual entry or V1.1 |
| `scoring_match_lineups` table | Store XI in `cricket.match.started` / `cricket.lineup.set` events |
| Separate fixture CRUD API | One match CRUD surface |

### Keep in V1

| Item | Reason |
|------|--------|
| `scoring_events` append-only store | Mandatory constraint |
| `scoring_sessions` projection | LED + mobile UI need fast reads |
| `scoring_matches` (simplified) | Core entity |
| `player_match_stats` table | Future stats without redesign; populate later |
| `lib/scoring-core` cricket reducer | Testable domain logic |
| SSE `score_state` | Matches auction pattern |
| LED `ScoreDisplayShell` | Required constraint |
| `platform_audit_events` | Corrections and trust |
| **Match Summary** projection | High value, low risk; read-only derived data |

---

## 3. Fixture vs match simplification

### Problem in original design

Two levels exist mainly for **badminton team ties** (fixture = tie, match = rubber). For cricket, fixture and match are almost always 1:1 — organizers must think about two concepts for no benefit.

### Proposal: one table, `scoring_matches`

```sql
scoring_matches
  id, tournament_id, sport_slug          -- 'cricket' in V1
  home_team_id, away_team_id
  round_name          TEXT NULL          -- 'League', 'Semi Final'
  scheduled_at        TIMESTAMPTZ NULL
  venue               TEXT NULL
  status              TEXT               -- scheduled | live | completed | abandoned
  rules_json          JSONB              -- { overs: 20, maxWickets: 10 }
  winner_team_id      INT NULL
  result_summary      TEXT NULL          -- "Team A won by 12 runs"
  summary_json        JSONB NULL         -- Match Summary projection (§7)
  -- Future badminton (nullable in V1, never set for cricket)
  parent_match_id     INT NULL           -- groups rubbers under a tie later
  match_kind          TEXT DEFAULT 'team_match'  -- team_match | rubber | tie
  sequence_in_parent  INT NULL
  started_at, completed_at, created_at
```

**V1 cricket:** every row is `match_kind = 'team_match'`, `parent_match_id = NULL`.

**V1.5 badminton (singles/doubles):** still one row per contest — two players or two pairs, no parent.

**V2 badminton team ties:** parent “tie” rows (`match_kind = 'tie'`) or thin `scoring_ties` table; rubbers point to `parent_match_id`. Cricket rows unaffected.

### API simplification

| Original | Simplified |
|----------|------------|
| `/scoring/fixtures` + `/scoring/matches` | **`/scoring/matches` only** |
| Create fixture, then add rubbers | **Create match** (teams, date, overs) |
| `fixture_id` on events | **`match_id` only** (drop `fixture_id` denorm) |

### Organizer mental model

```
Tournament → Matches → Score live → Summary → Standings
```

One list: “Today’s matches.” Tap → score.

---

## 4. Scorer accounts decision

### Original design

New `scoring_scorers` table, token links, separate JWT cookie, match-scoped permissions.

### Assessment

BidWar already has workable patterns:

- **Organizer JWT** — `isOrganizerOrAdmin(req, tournamentId)` on all mutating routes
- **Team `accessCode`** — PIN gating without new identity types

At typical auction-league events, the **organizer scores on their own phone**. A separate scorer identity system is premature for V1.

### V1 recommendation

| Capability | Approach |
|------------|----------|
| Who can score? | Organizer + admin only (`isOrganizerOrAdmin`) |
| Delegate scoring without accounts? | Optional **`scoring_pin`** on tournament (4–6 digits) |
| PIN usage | `POST .../matches/:id/events` accepts `scorerPin` when PIN enabled |
| Audit | `actor_type: 'organizer'` or `'scorer_pin'`; no scorer user record |

PIN mirrors `teams.accessCode` — familiar to the codebase, zero new tables.

### When to add real scorer accounts (V2)

- Multiple simultaneous matches with different people scoring
- Restricting organizers from live scoring while delegating
- Scorer assignment per match in large festivals

**Schema hook:** `actor_id` on `scoring_events` stays text; later values can be `scorer:42` without migration.

---

## 5. Badminton deferral

### Recommendation: badminton out of V1 ship entirely

| Scope | Version |
|-------|---------|
| Cricket T20 / limited overs, ball-by-ball, LED, summary, simple standings | **V1** |
| Badminton singles/doubles (one match = one contest) | **V1.5** |
| Badminton team ties (multi-rubber) | **V2** |

### Why defer all badminton from V1

1. **Team ties** drove fixture/match split, rubber sequencing, tie standings — ~40% of original scope.
2. Even singles badminton adds a second reducer, UI pad, and LED layout.
3. Goal is **fastest production-ready cricket**; badminton events namespace can exist in docs/types without implementation.

### Future-proofing without building it

- `sport_slug` column on matches and events
- `event_type` namespaced (`cricket.*` now; `badminton.*` later)
- `parent_match_id` + `match_kind` nullable on matches
- `stats_json` shape documented for badminton in `player_match_stats`

No V1 code paths for badminton; schema accepts it later.

---

## 6. Mobile-first scorer UX

Original design implied a desktop `score-operator.tsx` similar to `auction-operator.tsx`. Scorers are on phones at the ground.

### Design principles

1. **One thumb zone** — primary actions in bottom 40% of screen
2. **Big touch targets** — min 48px; ball outcomes as tiles, not menus
3. **No deep navigation during live play** — lineup locked at start; undo always visible
4. **Offline-tolerant UI** — optimistic UI + `409` resync on sequence conflict
5. **Reuse owner-app patterns** — full viewport, minimal chrome, works in mobile browser

### Screen flow (3 screens)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Match list     │ ──► │  Pre-match      │ ──► │  Live score     │
│  (today/upcoming)│     │  Toss + XI      │     │  Ball pad       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  Match summary  │
                                                │  (read-only)    │
                                                └─────────────────┘
```

### Live score screen layout

```
┌──────────────────────────────────────┐
│  TEAM A  142/3  (17.4)    CRR 8.1    │  ← sticky header
│  vs TEAM B  ·  2nd inn  ·  Target 186│
├──────────────────────────────────────┤
│  Striker 38(24)  ·  Non-str 12(18)   │
│  Bowler 1/22 (3.4)                   │
│  This over:  1 · 4 · W · 2           │
├──────────────────────────────────────┤
│                                      │
│   [0] [1] [2] [3]                    │  ← ball pad
│   [4] [6] [WD][NB]                   │
│   [WKT]     [UNDO]                   │
│                                      │
├──────────────────────────────────────┤
│  End over · Innings break · End match│  ← secondary row
└──────────────────────────────────────┘
```

### Wicket flow

Tap **WKT** → bottom sheet: dismissal type + fielder (if caught/run out) → confirm. Two taps max.

### Routes

| Route | Purpose |
|-------|---------|
| `/tournament/:id/score` | Match list (mobile default) |
| `/tournament/:id/score/:matchId` | Live scoring deep link |
| `/tournament/:id/score-display` | LED (code-gated, read-only) |

`OrganizerGuard` only; no new auth stack.

### LED stays separate

Scorer phone does not need to mirror LED. Display uses `ScoreDisplayShell` + SSE, same pattern as auction `DisplayShell`.

---

## 7. Match Summary module

Post-match view for organizers: review, announce, LED result card. **Not** a public live viewer.

### What it contains (Cricket V1)

| Section | Source |
|---------|--------|
| Result card | `cricket.match.completed` + projection |
| Innings totals | projection `state_json` |
| Batting card | derived from `cricket.ball.recorded` events |
| Bowling figures | derived from ball events |
| Fall of wickets | derived (`wicket` payloads with score at dismissal) |
| Over log (collapsed) | optional expandable list |
| Player of the match | manual pick on complete (stored in summary event) |

### Storage

`summary_json` on `scoring_matches`, rebuilt by projector on `match.completed` and undo.

```json
{
  "version": 1,
  "result": {
    "winnerTeamId": 12,
    "margin": "12 runs",
    "text": "Team A won by 12 runs"
  },
  "innings": [
    {
      "teamId": 12,
      "runs": 174,
      "wickets": 6,
      "overs": "20.0",
      "batting": [
        { "playerId": 101, "runs": 62, "balls": 41, "fours": 5, "sixes": 2, "out": true }
      ],
      "bowling": [
        { "playerId": 205, "overs": "4.0", "runs": 28, "wickets": 2 }
      ],
      "fallOfWickets": [
        { "wicket": 1, "score": 23, "playerId": 102, "over": "4.2" }
      ]
    }
  ],
  "playerOfTheMatchId": 101
}
```

### API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/tournaments/:tid/scoring/matches/:mid/summary` | Full summary |
| `POST` | `/tournaments/:tid/scoring/matches/:mid/summary/player-of-match` | Optional manual MOTM |

Summary is **read-only** for clients except MOTM. Regenerated from events on undo/correct.

### UI surfaces

1. **Mobile** — post-complete screen + copyable text (WhatsApp paste, no public URL)
2. **LED** — `result` overlay reads `summary_json.result`
3. **Tournament hub** — “Recent results” from completed match summaries

### Stats compatibility

`summary_json` is a **display projection**. Canonical data remains in `scoring_events`. `player_match_stats` can be populated from the same projector pass when stats ship — no schema change.

---

## 8. Further complexity reductions

### Event types (cricket V1 minimal set)

| Keep | Defer |
|------|-------|
| `cricket.match.started` | `cricket.state.corrected` (use undo + re-enter) |
| `cricket.lineup.set` | `cricket.over.completed` (derive over from balls) |
| `cricket.ball.recorded` | |
| `cricket.innings.ended` | |
| `cricket.match.completed` | |
| `cricket.ball.undone` | |
| `cricket.match.abandoned` | |

**8 event types** instead of 10. Over boundaries computed in reducer from ball count.

### Standings V1

| Field | V1 |
|-------|-----|
| Played, won, lost, tied, points | Auto on match complete |
| NRR | **Manual** `extras_json.nrr` on standings row, or V1.1 |
| Rubbers | N/A until badminton |

### Lineup V1

- Pre-match: multi-select from squad (sold/retained players on team)
- Stored as one `cricket.lineup.set` event
- No `scoring_match_lineups` table

### Concurrency V1

- **One live match per tournament** enforced in API
- Removes multi-match SSE filtering and active-scorer lease complexity

### Display overlays V1

- `innings_break` and `result` only
- Triggered from scorer UI buttons — no separate overlay API

---

## 9. Revised architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     V1 Cricket                               │
│                                                              │
│  scoring_matches ──► scoring_events (append-only)            │
│        │                    │                                │
│        │                    ▼                                │
│        │            lib/scoring-core (cricket reducer)       │
│        │                    │                                │
│        ├──── scoring_sessions (live state_json)              │
│        ├──── summary_json (match summary)                    │
│        └──── scoring_standings (simple W/L/points)         │
│                                                              │
│  Clients:                                                    │
│    Mobile scorer UI ──POST events──► API                     │
│    Score LED display ◄──SSE score_state──┘                 │
│    Tournament hub ◄──GET summary──┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Projection pipeline (unchanged pattern)

```
Scorer → POST /matches/:id/events (expectedSequence)
       → INSERT scoring_events
       → Cricket reducer applies event
       → UPDATE scoring_sessions.state_json
       → UPDATE scoring_matches.summary_json (on complete / undo)
       → UPDATE scoring_standings (on complete)
       → SSE broadcast score_state
       → 201 { event, state }
```

---

## 10. Revised schema

### V1 tables

| Table | V1 |
|-------|-----|
| `tournaments` (+ `scoring_enabled`, `scoring_phase`, `scoring_pin`, `scoring_settings_json`) | ✓ |
| `scoring_matches` | ✓ |
| `scoring_sessions` | ✓ |
| `scoring_events` | ✓ |
| `scoring_standings` | ✓ (simplified) |
| `player_match_stats` | ✓ (schema only, not populated) |

### Removed from V1

| Table | Status |
|-------|--------|
| `scoring_fixtures` | Removed — merged into `scoring_matches` |
| `scoring_scorers` | Deferred to V2 |
| `scoring_match_lineups` | Removed — lineup in events |

### Tournament extensions

```sql
scoring_enabled       BOOLEAN NOT NULL DEFAULT false
scoring_phase         TEXT NOT NULL DEFAULT 'disabled'
                      -- 'disabled' | 'setup' | 'live' | 'completed'
scoring_pin           TEXT NULL              -- optional 4-6 digit delegate PIN
scoring_settings_json JSONB                  -- default overs, LED prefs
```

### scoring_events (simplified denorm)

Drop `fixture_id`. Keep:

- `match_id`, `tournament_id`, `sport_slug`, `event_type`, `event_version`
- `sequence` (per-match, UNIQUE with match_id)
- `occurred_at`, `recorded_at`, `actor_type`, `actor_id`
- `correlation_id`, `causation_id`, `payload_json`, `metadata_json`

---

## 11. Revised API

REST + OpenAPI + Orval. Tag: `scoring`.

### Tournament-level

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/tournaments/:tid/scoring` | Config + phase summary |
| `PATCH` | `/tournaments/:tid/scoring` | Enable scoring, set PIN, default overs |
| `GET` | `/tournaments/:tid/scoring/matches` | List matches |
| `POST` | `/tournaments/:tid/scoring/matches` | Create match |
| `PATCH` | `/tournaments/:tid/scoring/matches/:mid` | Edit (no events only) |
| `DELETE` | `/tournaments/:tid/scoring/matches/:mid` | Delete (no events only) |
| `GET` | `/tournaments/:tid/scoring/standings` | Points table |
| `POST` | `/tournaments/:tid/scoring/standings/rebuild` | Admin recovery |

### Match-level

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/tournaments/:tid/scoring/matches/:mid` | Current projection + metadata |
| `GET` | `/tournaments/:tid/scoring/matches/:mid/events` | Event history (paginated) |
| `POST` | `/tournaments/:tid/scoring/matches/:mid/events` | Append event |
| `POST` | `/tournaments/:tid/scoring/matches/:mid/undo` | Undo last event |
| `POST` | `/tournaments/:tid/scoring/matches/:mid/start` | Start match (toss + lineup) |
| `GET` | `/tournaments/:tid/scoring/matches/:mid/summary` | Match Summary |
| `POST` | `/tournaments/:tid/scoring/matches/:mid/summary/player-of-match` | Set MOTM |

### Real-time

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/tournaments/:tid/scoring/events` | Tournament code gate OR organizer JWT |
| `GET` | `/tournaments/:tid/scoring/live` | Code gate — active match bootstrap |

**SSE payloads:** `score_state`, `standings_updated`, `display_overlay`

**Client hook:** `useScoringSocket(tournamentId)`

---

## 12. Revised implementation plan

### V1 — Cricket production (~14–17 person-days)

| Phase | Scope | Days |
|-------|-------|------|
| **0 — Core** | Simplified schema, `scoring-core` cricket reducer, event API + sequence lock, unit tests | 4–5 |
| **1 — Mobile + LED** | Match CRUD, mobile scorer UI, SSE, cricket LED, Match Summary projector + UI | 7–8 |
| **2 — Ship** | Simple standings, undo, audit, hub links, optional PIN, integration tests | 3–4 |

**Exit criteria:** Organizer creates match on phone, scores ball-by-ball, LED updates, match summary shown, standings update.

### V1.5 — Badminton singles/doubles (+6–8 days)

- `badminton.*` reducer
- Rally pad UI
- Badminton LED
- Still **no team ties**

### V2 — Badminton ties + scorer accounts (+8–10 days)

- `parent_match_id` tie grouping
- `scoring_scorers` if needed
- Auto NRR
- `player_match_stats` population

### Savings vs original design

| | Original | Simplified |
|--|----------|------------|
| V1 scope | 23–30 days | **14–17 days** |
| Tables | 7 | **5** |
| Auth types | +1 (scorer JWT) | **0** |
| Sports in V1 | 2 | **1** |

### Dependency order

```
Phase 0 (Core) → Phase 1 (Mobile + LED) → Phase 2 (Ship)
                                              ↓
                                         V1.5 Badminton
                                              ↓
                                         V2 Ties + Stats
```

---

## 13. Decision log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Fixture vs match? | **Single `scoring_matches`** | Cricket 1:1; `parent_match_id` for future ties |
| Dedicated scorer accounts? | **No in V1** | Organizer + optional PIN sufficient |
| Badminton in V1? | **No** | Fastest cricket path |
| Badminton team ties? | **Defer to V2** | Drove most fixture complexity |
| Match Summary? | **Yes in V1** | High value, projection-only, feeds LED + hub |
| Mobile-first? | **Yes** | Primary scorer device is phone |
| Event sourcing? | **Yes** | Unchanged |
| Stats schema? | **Yes, empty** | `player_match_stats` + rich ball payloads |
| NRR auto-calc? | **Defer** | Reduces cricket edge-case work |
| One live match per tournament? | **Yes in V1** | Simplifies SSE and concurrency |

---

## 14. Risks of simplification

| Risk | Mitigation |
|------|------------|
| Re-introducing fixtures later | `parent_match_id` + `match_kind` on same table |
| Organizer-only scoring too limiting | PIN delegation without accounts |
| No badminton in V1 disappoints users | Clear V1.5 roadmap; schema ready |
| Summary drift from events | Rebuild summary in same projector as session; admin rebuild endpoint |
| Mobile UI insufficient for complex wickets | Bottom sheet in V1; expand dismissal types incrementally |
| Manual NRR error-prone | V1.1 auto-NRR from ball events when stable |

---

## Summary

The simplified V1 ships **Cricket-only** scoring in roughly **half the original effort** by:

1. Collapsing fixtures and matches into **`scoring_matches`**
2. Dropping **scorer accounts** (organizer + optional PIN)
3. **Deferring all badminton** to V1.5/V2
4. Building a **mobile-first ball pad** instead of a desktop operator console
5. Adding a **Match Summary** projection for post-match value and LED result cards
6. Keeping **event sourcing**, **SSE + LED**, and **stats-ready schema** intact

**Next step:** Implement Phase 0 — simplified schema + cricket reducer + event API.

---

## Related documents

- `docs/scoring-module-v1-design.md` — full original design (Cricket + Badminton)
- `lib/db/src/schema/auction_events.ts` — reference event-sourcing pattern
- `artifacts/auction-platform/src/components/display/display-shell.tsx` — reference LED pattern

---

*BidWar Scoring Module V1 Simplification Proposal — 7 June 2026*
