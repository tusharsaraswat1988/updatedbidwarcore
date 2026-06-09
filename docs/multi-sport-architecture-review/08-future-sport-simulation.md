# Future Sport Simulation

Simulates adding **Tennis** and **Football** to the current architecture (post-badminton branch merge, no additional generalization).

---

## Simulation Methodology

Estimate work if each sport copies the **badminton branch pattern** (separate core package, prefixed tables, dedicated API router, dedicated UI, dedicated SSE module).

| Outcome | Criteria |
|---------|----------|
| **PASS** | Mostly configuration + one sport module; < 2 weeks |
| **WARNING** | New module + moderate UI; 2–4 weeks |
| **FAIL** | Major duplication across all layers; > 4 weeks per sport |

---

## Simulation 1: Tennis

### Domain fit

Tennis resembles badminton structurally:
- Points → games → sets (vs badminton's points → games → match)
- Singles/doubles sides (players, not teams)
- Rally-based scoring with deuce/advantage (different rules, similar event granularity)
- Per-match scoring with optional tournament draw

### Tables required (copying badminton pattern)

| Table | Needed? | Notes |
|-------|---------|-------|
| `tennis_players` | Yes | Copy of `badminton_players` |
| `tennis_courts` | Yes | Or reuse `badminton_courts` renamed — won't happen without refactor |
| `tennis_categories` | Yes | MS, WS, MD, WD, Mixed |
| `tennis_registrations` | Yes | |
| `tennis_draws` | Yes | |
| `tennis_fixtures` | Yes | |
| `tennis_match_details` | Yes | |
| `tennis_analytics` | Optional | |
| `scoring_matches` | Reuse | Would use `teamId: 0` hack again |
| `scoring_events` | Reuse | `tennis.*` event types |

**Count: 7–8 new tables** (FAIL pattern)

### APIs required

| Router | Endpoints | Estimate |
|--------|-----------|----------|
| `/tournaments/:id/tennis/*` | ~25 (copy badminton.ts) | 1,100 lines |
| Semantic endpoints | `/point`, `/undo`, `/tiebreak`, etc. | Modified rules |

### Routes required

| Frontend | Count |
|----------|-------|
| Organizer pages | 5–6 |
| Public scorer/display/overlay | 3 |
| Hub section | 1 |

### UI required

| Component | Effort |
|-----------|--------|
| Scorer pad | Medium (advantage games, tiebreaks) |
| LED display | Medium |
| OBS overlays | Medium (copy badminton pattern) |

### Reducers required

| Package | Contents |
|---------|----------|
| `@workspace/tennis-core` | events, reducer, commands, ~800 lines |

### Analytics required

Set-level stats, ace counts — new `tennis_analytics` table.

### Tennis simulation verdict: **FAIL**

| Metric | Value |
|--------|-------|
| New tables | 7–8 |
| New API lines | ~1,100 |
| New frontend lines | ~2,500 |
| New core package | ~800 lines |
| Calendar time (1 engineer) | **4–5 weeks** |
| Duplication factor | ~85% copy of badminton |

**With P1 dispatcher + shared projection:** Still **WARNING** (~3 weeks) due to UI and sport-specific rules.

---

## Simulation 2: Football

### Domain fit

Football differs fundamentally:
- Clock-based (continuous time, not discrete rally points)
- Periods (halves) with stoppage time
- Goals, cards, substitutions — different event types
- Team-based (11-a-side) — fits `homeTeamId`/`awayTeamId` better than badminton
- League standings (points, GD) — closer to cricket standings than badminton draws

### Tables required (copying badminton pattern)

| Table | Needed? | Notes |
|-------|---------|-------|
| `football_players` | Yes | Squad lists |
| `football_pitches` | Yes | Venues |
| `football_competitions` | Yes | League/cup formats |
| `football_registrations` | Yes | Squad registration |
| `football_fixtures` | Yes | Matchweek fixtures |
| `football_match_details` | Yes | Clock, period, stoppage |
| `football_analytics` | Yes | xG, possession, etc. |
| `scoring_standings` | Extend or `football_standings` | GD, points — cricket table unusable |
| `scoring_matches` | Reuse | Team IDs work natively |

**Count: 7–8 new tables + standings rework** (FAIL)

### APIs required

| Endpoint style | Notes |
|----------------|-------|
| `/tournaments/:id/football/*` | Full router |
| Clock commands | `/kickoff`, `/halftime`, `/goal`, `/card`, `/sub` — more complex than badminton |
| Stoppage time | Server-side clock authority or client sync issues |

### Routes required

6+ organizer pages, 3 public display routes, clock overlay routes.

### UI required

| Component | Complexity |
|-----------|------------|
| Scorer pad | **High** — clock, period, stoppage, VAR states |
| LED display | **High** — clock is central |
| OBS overlays | **High** — clock sync critical |

### Reducers required

`@workspace/football-core` with clock state machine — significantly more complex than badminton.

### Streaming requirements

- Sub-second clock broadcasts (SSE may strain; need throttling strategy)
- Period transition events
- **Current SSE architecture insufficient without clock channel design**

### Football simulation verdict: **FAIL**

| Metric | Value |
|--------|-------|
| New tables | 7–8 + standings |
| New API lines | ~1,500 |
| New frontend lines | ~3,500 |
| New core package | ~1,200 lines |
| Streaming rework | Clock channel required |
| Calendar time (1 engineer) | **6–8 weeks** |

---

## Comparative Summary

| Sport | Tables | APIs | UI | Reducer | Streaming | Verdict |
|-------|--------|------|-----|---------|-----------|---------|
| Badminton (done) | 8 | 25+ | 6 pages | 800 LOC | Match SSE | Baseline |
| Tennis | 7–8 | 25+ | 6 pages | 800 LOC | Match SSE | **FAIL** (dup) |
| Football | 8+ | 30+ | 8+ pages | 1200 LOC | Clock SSE | **FAIL** |

---

## What Would Make Sport #3 Mostly Configuration?

Required before tennis/football without FAIL duplication:

| Prerequisite | Effort | Impact |
|--------------|--------|--------|
| Sport replay dispatcher | 2 days | Shared replay plumbing |
| Unified `scoring_sessions` projection | 3 days | One live read path |
| Generic `competition_participants` | 1 week | Eliminate `*_players` tables |
| Generic `competition_fixtures` | 1 week | Eliminate `*_fixtures` tables |
| Shared display shell | 3 days | Overlay framework |
| Unified SSE registry | 2 days | One broadcast module |
| Sport module interface | 2 days | Plug in tennis-core without new router boilerplate |

**Total: ~3 weeks infrastructure** → then tennis drops to **WARNING** (~2 weeks sport-specific).

Without this investment, sport #3 = **FAIL**.

---

## Architecture Score

| Question | Answer |
|----------|--------|
| Can tennis be added without redesign? | **No** — needs at minimum shared participant/fixture model |
| Can football be added without redesign? | **No** — needs clock streaming + team standings model |
| Is current architecture FAIL for sport #3? | **Yes** — if badminton pattern is copied |
| Is current architecture PASS for 2 sports? | **Yes** — with P0 fixes from executive summary |

---

## Recommendation

1. **Merge badminton with P0 fixes** — acceptable 2-sport platform.
2. **Invest ~3 weeks in shared infrastructure** before committing to sport #3.
3. **Tennis should be sport #3** — closest to badminton; validates generalization.
4. **Football should wait** — requires clock architecture decision (SSE throttle vs WebSocket).
