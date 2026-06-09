# Event Sourcing Audit

---

## Architecture Overview

Both sports use the same **storage contract**:

```
Command/UI action
  → Validate + append to scoring_events (INSERT only)
  → Replay events through sport-specific reducer
  → Update projection(s)
  → SSE broadcast
```

**Source of truth:** `scoring_events`  
**Not event sourced:** Auction live state (`auction_sessions` — mutable projection)

---

## Shared Infrastructure

### `replayEvents()` — **PASS**

Generic reducer replay in `lib/scoring-core/src/projector/replay.ts`:

```typescript
export function replayEvents<S>(initialState, events, reduce, options?)
```

- Sorts by sequence
- Validates contiguous sequences (optional)
- Pure fold — sport-agnostic

### `ScoringEventEnvelope` — **PASS**

`lib/scoring-core/src/types.ts` — generic envelope with `sportSlug`, `eventType`, `payload`, `sequence`.

### Sequence / concurrency — **PASS**

- UNIQUE `(match_id, sequence)` in DB
- Cricket: `assertExpectedSequence`, `expectedSequence` on POST
- Badminton: service computes next sequence before append

---

## Cricket Event Engine

### Event types — **PASS** (cricket-scoped)

| Event | Purpose |
|-------|---------|
| `cricket.match.started` | Toss, elected to, overs limit |
| `cricket.lineup.set` | Playing XI per team |
| `cricket.ball.recorded` | Ball-by-ball scoring unit |
| `cricket.innings.ended` | Innings closure |
| `cricket.match.completed` | Result |
| `cricket.ball.undone` | Compensating undo |
| `cricket.match.abandoned` | Abandoned match |

**Evidence:** `lib/scoring-core/src/events/cricket.ts`

### Reducer — **PASS** (cricket only)

- `lib/scoring-core/src/cricket/reducer.ts` — pure state machine
- State: `CricketScoreboardState` with innings[], overs, strike rotation
- Auto-creates 2nd innings on 1st innings end

### Undo resolution — **PASS** (cricket-specific)

`lib/scoring-core/src/projector/resolve-undo.ts`:
- Collects `cricket.ball.undone` payloads
- Filters undone `cricket.ball.recorded` sequences
- Cricket-only — not reusable for badminton

### Projections

| Projection | Updated by | Rating |
|------------|------------|--------|
| `scoring_sessions.state_json` | Every event | **PASS** |
| `scoring_matches.summary_json` | Match complete | **PASS** |
| `scoring_standings` | Match complete (NRR) | **WARNING** (cricket-specific) |

### Replay entry point

`replayCricketEvents(meta, events)` — wraps `resolveEventsForReplay` + `reduceCricket`

**MatchMeta cricket assumptions:** `oversLimit`, `maxWickets`, `homeTeamId`, `awayTeamId`

---

## Badminton Event Engine (branch)

### Event types — **PASS** (badminton-scoped)

| Event | Purpose |
|-------|---------|
| `badminton.match.started` | Sides, format, first server |
| `badminton.point.won` | Rally point |
| `badminton.point.undone` | Compensating undo |
| `badminton.game.ended` | Game completion |
| `badminton.match.ended` | Match result |
| `badminton.interval.started/ended` | Mid-game interval |
| `badminton.timeout.started/ended` | Timeouts |
| `badminton.side.changed` | Visual-only (no state change) |
| `badminton.retirement.declared` | Retirement |
| `badminton.walkover.declared` | Walkover |
| `badminton.disqualification.declared` | DQ |

**Evidence:** `lib/badminton-core/src/events/badminton.ts` (branch)

### Command layer — **PASS**

`lib/badminton-core/src/commands.ts`:
- `cmdAwardPoint`, `cmdUndoLastPoint`, `cmdStartMatch`, etc.
- Business rules (deuce, game point, match point) in commands, not client

Cricket lacks equivalent command layer — client/API sends raw events.

### Reducer — **PASS** (badminton only)

`lib/badminton-core/src/reducer/reducer.ts` — separate package, not in `scoring-core`.

### Undo resolution — **PASS** (badminton-specific)

`resolveUndoEvents()` in badminton-core — filters `badminton.point.undone` sequences. Parallel implementation to cricket.

### Projections

| Projection | Updated by | Rating |
|------------|------------|--------|
| `badminton_match_details.state_snapshot_json` | Every event | **WARNING** (parallel to scoring_sessions) |
| `scoring_matches.status/result` | Match end | **PASS** |
| `scoring_sessions` | **Not used** | **FAIL** |

---

## Can All Sports Replay Through a Single Event Engine?

### Storage layer — **PASS**

Yes. `scoring_events` already stores any `sport_slug` + `event_type` + `payload_json`.

### Replay dispatcher — **FAIL**

No unified:

```typescript
function replayMatch(sportSlug, meta, events): State
```

Today requires:
- `replayCricketEvents()` for cricket
- `replayBadmintonEvents()` for badminton

### Reducer registry — **FAIL**

No map of `sportSlug → { parsePayload, reduce, resolveUndo, initialState }`.

### Event schema registry — **FAIL**

Event types hardcoded per sport file. No `sport_event_types` table or shared versioned schema catalog.

### State reconstruction — **WARNING**

Both sports can reconstruct from events alone. Snapshots are performance caches, not required. But snapshot locations differ (cricket: `scoring_sessions`; badminton: `badminton_match_details`).

---

## Side-by-Side Comparison

| Capability | Cricket | Badminton | Single engine? |
|------------|---------|-----------|----------------|
| Append-only store | PASS | PASS | PASS |
| Monotonic sequence | PASS | PASS | PASS |
| Compensating undo | PASS | PASS | PASS (pattern shared, impl forked) |
| Pure reducer | PASS | PASS | PASS (separate reducers) |
| Command layer | FAIL (raw events) | PASS | WARNING |
| Generic replay | PASS (utility exists) | PASS | FAIL (no dispatcher) |
| Projection uniformity | PASS | FAIL | FAIL |
| Standings projection | PASS (cricket) | N/A | FAIL |
| Event versioning | `event_version` column | Same | PASS (unused) |

---

## Multi-Sport Readiness Ratings

| Component | Rating | Reason |
|-----------|--------|--------|
| `scoring_events` table | **PASS** | Truly append-only, sport-agnostic |
| `ScoringEventEnvelope` | **PASS** | Generic type |
| `replayEvents()` | **PASS** | Generic utility |
| Cricket reducer | **PASS** | Complete for cricket |
| Badminton reducer | **PASS** | Complete for badminton |
| Undo resolution | **WARNING** | Duplicated per sport |
| Sport dispatcher | **FAIL** | Does not exist |
| Projection layer | **WARNING** | Two snapshot targets |
| `MatchMeta` type | **FAIL** | Cricket overs/teams baked in |
| Event type catalog | **FAIL** | Hardcoded constants |
| Standings reducer | **FAIL** | Cricket NRR only |

**Overall event sourcing multi-sport readiness: WARNING**

The **pattern** is correct and proven twice. The **plumbing** to route replay by sport is missing.

---

## Minimum Dispatcher (design only)

Do not merge reducers. Add thin routing:

```typescript
// lib/scoring-core/src/projector/dispatch.ts (future)
const SPORT_HANDLERS = {
  cricket: { replay: replayCricketEvents, parse: parseCricketEventPayload },
  badminton: { replay: replayBadmintonEvents, parse: parseBadmintonEventPayload },
};
```

Badminton can stay in `@workspace/badminton-core` — only the dispatcher lives in shared package.

---

## Risks

1. **Undo logic drift** — Each sport copies resolve-undo pattern independently.
2. **Event schema breaking changes** — `event_version` exists but no migration strategy documented.
3. **Cross-sport event injection** — No DB constraint that `event_type` prefix matches `sport_slug`.
4. **Replay performance** — Long matches replay from scratch; snapshots inconsistent.

---

## Recommendations

| Priority | Action |
|----------|--------|
| P0 | Badminton writes `scoring_sessions.state_json` on replay |
| P0 | Add CHECK or app-level validation: `event_type` prefix matches `sport_slug` |
| P1 | Extract shared `resolveCompensatingUndos(undoType, targetType)` utility |
| P1 | Sport replay dispatcher (10–20 lines, not enterprise framework) |
| P1 | Add cricket command layer (optional — badminton pattern is better) |
| P2 | `sport_event_types` metadata table for documentation/codegen |
| Defer | Unified state union type across sports |
