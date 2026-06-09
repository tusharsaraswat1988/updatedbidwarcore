# Database Audit

**Production source of truth:** `main`  
**Badminton reference:** `origin/cursor/badminton-tournament-system-0183`  
**ORM:** Drizzle (`lib/db/src/schema/`)

---

## Schema Design Summary

| Layer | Cricket | Badminton | Verdict |
|-------|---------|-----------|---------|
| Event store | `scoring_events` | Same table, `sport_slug='badminton'` | **PASS** |
| Match entity | `scoring_matches` (team IDs required) | Same table + `badminton_match_details` | **WARNING** |
| Live projection | `scoring_sessions` | `badminton_match_details.state_snapshot_json` | **FAIL** |
| Standings | `scoring_standings` (NRR) | None | **FAIL** |
| Fixtures | `scoring_fixtures` (unused API) | `badminton_fixtures` + `badminton_draws` | **FAIL** |
| Players | `players` (auction roster) | `badminton_players` (separate) | **WARNING** |
| Tournament ops | Auction-centric (`teams`, `categories`) | `badminton_categories`, `badminton_registrations` | **FAIL** |

**Evidence:** `scoring_matches.ts` defines `homeSideJson`/`awaySideJson` "for future badminton" but badminton branch sets `homeTeamId: 0, awayTeamId: 0` instead.

---

## Generic Scoring Tables (Shared)

### `scoring_events` — **PASS**

| Aspect | Assessment |
|--------|------------|
| Purpose | Append-only event store, source of truth |
| Sport agnostic | Yes — `sport_slug`, `event_type`, `payload_json` |
| Cricket assumptions | Default `sport_slug='cricket'` only |
| Badminton usage | `sport_slug='badminton'`, `badminton.*` event types |
| Blockers | None for multi-sport |

**Evidence:** `lib/db/src/schema/scoring_events.ts` — UNIQUE `(match_id, sequence)`, INSERT-only contract.

---

### `scoring_matches` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Purpose | Playable match unit across sports |
| Generic columns | `sport_slug`, `match_kind`, `home_side_json`, `away_side_json`, `parent_match_id` |
| Cricket assumptions | `home_team_id`/`away_team_id` NOT NULL; `rules_json` typed as `{ overs?, maxWickets? }`; default `sport_slug='cricket'` |
| Badminton divergence | `homeTeamId: 0, awayTeamId: 0` sentinel; `winnerTeamId: null`; sides in events only |
| Sport leakage | `rulesJson` overs/maxWickets are cricket-specific |
| Fake IDs | **Yes** — `teamId: 0` violates semantic integrity |

**Recommendation:** Make `home_team_id`/`away_team_id` nullable; require `home_side_json`/`away_side_json` for non-team sports.

---

### `scoring_sessions` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Purpose | Live scoreboard projection (mirrors `auction_sessions`) |
| Cricket usage | Updated on every cricket event append |
| Badminton usage | **Not used** — snapshot stored in `badminton_match_details` instead |
| Blocker | Dual projection paths prevent unified live display API |

---

### `scoring_standings` — **FAIL** (for multi-sport)

| Aspect | Assessment |
|--------|------------|
| Purpose | Materialized points table |
| Cricket-specific | `net_run_rate` column; team-based W/L/T/NR/points |
| Badminton | No standings table; knockout draw doesn't use this |
| Sport leakage | Table name is generic; schema is cricket league |

**Evidence:** `lib/db/src/schema/scoring_standings.ts` — `netRunRate: numeric("net_run_rate")`.

---

### `scoring_fixtures` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Purpose | Scheduling container for matches |
| Generic intent | `sport_slug`, `format_json`, round/venue |
| Cricket assumptions | `home_team_id`/`away_team_id` NOT NULL |
| Usage | Schema exists; **no API routes on main** |
| Badminton | Built parallel `badminton_fixtures` instead |

---

## Auction / Platform Tables (Production)

### `tournaments` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Generic | `sport`, `sport_id`, `scoring_enabled`, `scoring_phase`, `scoring_pin` |
| Cricket defaults | `sport` default `'cricket'` |
| Auction coupling | Heavy auction-specific columns (bid tiers, timer, purse) — correct for optional auction |
| Badminton gap | No `badminton_enabled` flag; badminton ignores `scoring_enabled` |

---

### `teams` — **PASS** (auction domain)

Auction teams. Not used by badminton. Correctly scoped to auction+cricket journey.

---

### `categories` — **PASS** (auction domain)

Auction player categories (bid rules). Distinct from `badminton_categories`. Naming collision risk only.

---

### `players` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Purpose | Auction tournament roster |
| Cricket-specific columns | `batting_style`, `bowling_style`, `crichero_url`, `role` (Batsman/Bowler) |
| Badminton | Uses separate `badminton_players` |
| Duplication | Two player tables per tournament |

---

### `bids` — **PASS**

Auction operational table. Sport-agnostic.

---

### `auction_sessions` — **PASS**

Live auction projection. Independent product module.

---

### `auction_bid_events` / `auction_player_events` / `auction_timer_events` — **PASS**

Append-only auction intelligence. Sport-agnostic.

---

### `organizers` — **PASS**

Platform auth. Sport-agnostic.

---

### `global_players` — **PASS**

Cross-tournament identity. Sport-agnostic; badminton links via `global_player_id`.

---

### `player_import_logs` — **PASS**

Audit trail. Sport-agnostic.

---

### `purse_boosters` — **PASS**

Auction purse adjustments. Sport-agnostic.

---

### `sports` — **PASS**

Master sports list with slug. Seeded with cricket, badminton, etc.

**Gap:** Code still checks `tournaments.sport` text, not `sport_id` FK consistently.

---

### `sport_roles` / `role_spec_groups` / `role_spec_options` — **PASS**

Configurable player specs per sport. Good foundation for multi-sport registration.

**Gap:** Cricket `players.batting_style`/`bowling_style` bypass this normalized model.

---

### `branding_settings` — **PASS**

Platform branding. Sport-agnostic.

---

### `settings` / `sms_notification_settings` — **PASS**

Platform config. Sport-agnostic.

---

### `display_auctions` — **PASS**

Marketing landing. Sport-agnostic.

---

### `showcase_events` — **PASS**

Marketing. Sport-agnostic.

---

### `notification_logs` — **PASS**

Notification audit. Sport-agnostic.

---

### `platform_audit_events` — **PASS**

Platform audit. Sport-agnostic.

---

### `push_subscriptions` — **PASS**

Web push. Sport-agnostic.

---

### Communication tables (`comm.ts`) — **PASS**

`consent_tokens`, `otp_sessions`, `comm_logs`, `consent_blast_log`, `wa_quality_log`, `wa_templates`, `bot_sessions`, `wa_consent_events` — all sport-agnostic.

---

## Badminton-Specific Tables (Branch Only)

### `badminton_players` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Purpose | Extended player profiles for badminton tournaments |
| Duplication | Overlaps `global_players` + could be `competition_participants` |
| Justified for now | Rich badminton-specific fields (BWF code, rankings, handedness) |
| Future blocker | Sport #3 will want `tennis_players` unless generalized |

---

### `badminton_courts` — **WARNING**

Venue infrastructure. Tennis/football would need `tennis_courts` / `football_pitches` under current pattern. Could be generic `venues` or `competition_venues`.

---

### `badminton_categories` — **WARNING**

Draw categories (MS, MD, XD). Duplicates concept of `scoring_fixtures` grouping + registration. Appropriate for badminton ops but not reusable.

---

### `badminton_registrations` — **WARNING**

Category entries with seeds. Generic registration engine would absorb this.

---

### `badminton_draws` — **WARNING**

Bracket structure. Sport-specific draw logic; acceptable for badminton module.

---

### `badminton_fixtures` — **FAIL** (duplication)

| Aspect | Assessment |
|--------|------------|
| Duplicates | `scoring_fixtures` |
| Links | References `scoring_matches` via FK |
| Debt | Two fixture models in one platform |

---

### `badminton_match_details` — **WARNING**

| Aspect | Assessment |
|--------|------------|
| Purpose | Extended match metadata + `state_snapshot_json` |
| Duplicates | `scoring_sessions` projection role |
| Justified fields | `scorer_pin`, `match_type`, court reference |
| Fix | Keep extension table; move snapshot to `scoring_sessions` |

---

### `badminton_analytics` — **WARNING**

Tournament-level badminton stats (longest rally, etc.). No generic `competition_analytics`. Acceptable as sport extension table.

---

## Violations of Target SPORT CORE Model

| Target entity | Current state | Violation |
|---------------|---------------|-----------|
| `sports` | Exists | **PASS** |
| `sport_rules` | Embedded in `rules_json`, `match_format_json` | **FAIL** — no central rules table |
| `sport_event_types` | Hardcoded in `cricket.ts`, `badminton.ts` | **FAIL** |
| `sport_stat_types` | NRR hardcoded in standings | **FAIL** |
| `tournaments` | Exists | **PASS** |
| `teams` | Auction-only | **WARNING** — not universal "side" |
| `players` | Split across 2+ tables | **FAIL** |
| `squads` | Cricket lineup in events only | **WARNING** |
| `fixtures` | Duplicated | **FAIL** |
| `matches` | `scoring_matches` | **WARNING** |
| `standings` | Cricket-only | **FAIL** |
| `events` | `scoring_events` | **PASS** |
| `broadcasts` | In-memory SSE, no table | **WARNING** |
| Sport extensions | `badminton_*`, cricket in reducer | **WARNING** — correct direction, premature prefixing |

---

## Nullable / Fake ID / Hardcoded Issues

| Issue | Location | Severity |
|-------|----------|----------|
| `homeTeamId: 0` sentinel | Badminton match create | **FAIL** |
| `home_team_id` NOT NULL | `scoring_matches`, `scoring_fixtures` | **WARNING** |
| Default `sport_slug='cricket'` | Multiple tables | **WARNING** |
| `tournaments.sport` default `'cricket'` | `tournaments.ts` | **WARNING** |
| `net_run_rate` on generic standings | `scoring_standings` | **FAIL** |
| `rulesJson.overs` | `scoring_matches` | **WARNING** |
| `scoring_enabled` ignored by badminton | Service layer | **WARNING** |

---

## Recommendations

### P0 (before merge)

1. Use `homeSideJson`/`awaySideJson` for badminton; design nullable team FK migration.
2. Badminton writes to `scoring_sessions` for live state.
3. Document `badminton_fixtures` as temporary; plan convergence with `scoring_fixtures`.

### P1 (before sport #3)

4. Introduce `competition_participants` or extend `global_players` + sport extension JSON.
5. Rename or split `scoring_standings` → `cricket_standings` or add `standings_json` generic column.
6. Migrate `players.batting_style`/`bowling_style` to `sport_roles` spec system.

### P2 (sport #3)

7. `sport_rules` table for format configuration.
8. Generic `competition_categories` replacing per-sport category tables.

---

## Summary Table

| Table | Rating | Category |
|-------|--------|----------|
| `scoring_events` | PASS | Generic |
| `scoring_matches` | WARNING | Generic (leaky) |
| `scoring_sessions` | WARNING | Generic (underused) |
| `scoring_standings` | FAIL | Cricket-specific |
| `scoring_fixtures` | WARNING | Generic (unused) |
| `tournaments` | WARNING | Generic (auction-heavy) |
| `teams` | PASS | Auction |
| `categories` | PASS | Auction |
| `players` | WARNING | Cricket-leaky |
| `sports` + role specs | PASS | Generic |
| `badminton_*` (×8) | WARNING | Sport extension (duplicated pattern) |
| All auction/comm tables | PASS | Independent modules |
