# Phase 2 Audit: Can Badminton Become Grade A (Fully Rally Driven)?

**Date:** June 17, 2026  
**Scope:** Feasibility analysis only — no code changes  
**Prerequisite:** [SCORING-ARCHITECTURE-AUDIT.md](./SCORING-ARCHITECTURE-AUDIT.md)

---

## Executive Summary

**Yes, BidWar can reach Grade A for scoring geometry** (score, server, receiver, court positions, service rotation) **without new domain logic.** The pure derivation functions already exist (`advanceDoublesServeAfterPoint`, `nextGameServerAfterGameEnd`, `isGameOver`) and are validated by 205 simulation sequences against an independent BWF oracle.

The gap is **architectural, not algorithmic**: replay currently **reads** embedded snapshots instead of **calling** those functions.

| Question | Answer |
|----------|--------|
| Can replay derive server/receiver/court from rally winners? | **Yes** — with targeted changes to `applyPointWon` |
| Can `doublesServe` be removed from `POINT_WON` payloads? | **Yes** — after replay derives; legacy events need a compat path |
| Can `GAME_ENDED` / `MATCH_ENDED` be derived from rally history? | **Yes** for normal play; **No** for walkover/retirement/DQ |
| Performance impact | **Negligible** (~O(1) per rally, already full replay) |
| Migration risk | **Medium** (existing event rows + undo + schema) |
| Complexity | **Medium** (core change small; migration + tests larger) |
| Recommendation | **Move to Grade A before wide production use** — or adopt a low-risk **derive-on-replay** phase first while keeping Hybrid write path temporarily |

---

## Grade A Definition (for this audit)

**Grade A (Fully Rally Driven)** means:

1. **Stored rally record** = `winningSide` (+ optional `rallyLength`) per rally, plus `MATCH_STARTED` setup metadata.
2. **Replay** recomputes all scoring geometry from rally winners + setup + format rules.
3. **No denormalized serve/court snapshots** required in event payloads for correctness.
4. **Game/match boundaries** for normal completion are detected during replay, not stored as separate authoritative events.

**Out of scope for pure rally derivation** (still need explicit events):

- Timeouts, intervals, side-change markers
- Walkover, retirement, disqualification
- Undo compensating events (`POINT_UNDONE`)

These do not block Grade A for **live scoring state**; they are operational/terminal events.

---

## 1. Exact Code Changes Required

### 1.1 Core change: derive on replay in `DoublesScoringEngine.applyPointWon`

**File:** `lib/badminton-core/src/scoring/doubles-engine.ts`

**Current behavior** (lines 208–229): copies `payload.doublesServe` into state.

**Required behavior:** call `advanceDoublesServeAfterPoint` using **pre-rally** state from `state.doublesServe` and **post-rally** scores derived from `payload.winningSide`:

```ts
applyPointWon(state, payload) {
  const ds = state.doublesServe;
  if (!ds) return { servingSide: payload.winningSide };

  // Capture pre-rally serving side (who served the rally that just ended)
  const servingSideBeforeRally = ds.servingSide;

  const newLeftScore =
    payload.winningSide === "left" ? state.leftScore + 1 : state.leftScore;
  const newRightScore =
    payload.winningSide === "right" ? state.rightScore + 1 : state.rightScore;

  const next = advanceDoublesServeAfterPoint(
    payload.winningSide,
    servingSideBeforeRally,
    newLeftScore,
    newRightScore,
    ds.courtPositions,
  );

  return {
    servingSide: next.servingSide,
    doublesServe: {
      setup: ds.setup,
      lastGameEnd: ds.lastGameEnd,
      servingSide: next.servingSide,
      servingPlayerIndex: next.servingPlayerIndex,
      receivingSide: next.receivingSide,
      receivingPlayerIndex: next.receivingPlayerIndex,
      courtPositions: next.courtPositions,
    },
  };
}
```

**Evidence the function is sufficient:** `doubles-court.ts:79–125` implements BWF Laws 10.3.3–10.3.4, 10.5, 10.6. The oracle in `bwf-doubles-oracle.ts:129–165` mirrors the same logic and matches in 1429/1429 simulated rallies.

---

### 1.2 Reducer: derive scores from state + winner (not payload scores)

**File:** `lib/badminton-core/src/reducer/reducer.ts` — `applyPointWon` (lines 77–115)

**Current:** reads `payload.winnerScore` / `payload.loserScore`.

**Required:**

```ts
const newLeftScore =
  payload.winningSide === "left" ? state.leftScore + 1 : state.leftScore;
const newRightScore =
  payload.winningSide === "right" ? state.rightScore + 1 : state.rightScore;
```

Optionally keep payload scores as **audit hints** during migration, but reject replay if they disagree with derived values.

**Singles:** already effectively rally-driven (`singles-engine.ts:77–83`); same score derivation change applies.

---

### 1.3 Slim `buildPointWonPayload` (write path)

**File:** `lib/badminton-core/src/scoring/doubles-engine.ts` — `buildPointWonPayload` (lines 85–127)

**Remove from emitted payload:**

- `doublesServe` block (lines 120–126)
- `servingSide` (redundant with derivation)
- Optionally `winnerScore`, `loserScore`, `isGamePoint`, `isMatchPoint` (all derivable)

**Minimum Grade A payload:**

```ts
{
  winningSide: BadmintonSide;
  rallyLength?: number;
}
```

**Keep during transition:** `gameNumber` helps detect corrupted event order; can remain or be derived from `state.currentGame` at write time only.

---

### 1.4 Derive game/match boundaries inside `applyPointWon` (eliminate stored `GAME_ENDED` / `MATCH_ENDED` for normal play)

**Files:**

- `lib/badminton-core/src/reducer/reducer.ts` — extend `applyPointWon`
- `lib/badminton-core/src/commands.ts` — stop emitting `GAME_ENDED` / `MATCH_ENDED` for normal points
- `lib/badminton-core/src/scoring/doubles-engine.ts` — reuse `buildGameEndedExtras` logic inside reducer path

**After score increment and serve advance**, call existing helpers:

```ts
const gameOver = isGameOver(newLeftScore, newRightScore, format...);
if (gameOver) {
  // Capture pre-rally doubles serve for next-game rotation (game-winning rally)
  const lastServingSide = servingSideBeforeRally;
  const lastServerPlayerIndex = ds.servingPlayerIndex; // pre-rally
  const lastRallyWinningSide = payload.winningSide;

  // Inline logic currently in applyGameEnded + buildGameEndedExtras:
  // - increment gamesLeft/gamesRight
  // - mark game completed in games[]
  // - if match over → set matchStatus, winnerSide
  // - else → nextGame via nextGameServerAfterGameEnd + buildNextGameCourtPositions
}
```

**Existing derivation functions** (`doubles-court.ts:127–167`, `doubles-engine.ts:130–177`) already encode next-game server selection. No new BWF rules needed.

---

### 1.5 Schema and types

**Files:**

- `lib/badminton-core/src/events/badminton.ts` — Zod `pointWonSchema` (lines 236–246): make `winnerScore`, `loserScore`, `isGamePoint`, `isMatchPoint`, `doublesServe` optional or remove
- `lib/badminton-core/src/scoring/types.ts` — update `DoublesPointWonPayload` comment/docs
- `lib/badminton-core/src/commands.ts` — slim `cmdAwardPoint` event batch

---

### 1.6 Legacy replay compatibility layer

**File:** `lib/badminton-core/src/scoring/doubles-engine.ts` (or dedicated `replay-compat.ts`)

During migration, `applyPointWon` should:

1. **Always derive** post-rally state from `winningSide`.
2. If legacy `payload.doublesServe` exists, **assert equality** (dev/test) or log drift (prod).
3. Never prefer legacy snapshot over derivation once Grade A is active.

This allows old events to replay correctly without rewriting history.

---

### 1.7 Undo improvement (should ship with Grade A)

**File:** `artifacts/api-server/src/lib/badminton-service.ts` — `undoLastPoint`

**Current bug:** `getLastBadmintonSequence` targets last event in log, not last rally.

**Grade A fix:**

- Find last `POINT_WON` sequence (not last event of any type).
- With derived game boundaries, undoing one rally automatically reverts game/match transitions — **eliminates multi-event tombstone bug**.

---

### 1.8 Tests to add/update

| Test | Purpose |
|------|---------|
| Multi-game doubles replay from `{ winningSide }` only | Currently missing — sim stops at first game end |
| Legacy event replay with `doublesServe` in payload | Migration compat |
| Derived vs legacy payload assertion | Drift detection |
| Undo after game-winning rally | Validates single-rally undo |
| Full best-of-3 doubles match replay | Cross-game server rotation |

---

## 2. Can `doublesServe` Snapshots Be Removed from `POINT_WON` Payloads?

### Answer: **Yes**

| Requirement | Available without snapshot? |
|-------------|----------------------------|
| Pre-rally serving side | `state.doublesServe.servingSide` at start of `applyPointWon` |
| Pre-rally court layout | `state.doublesServe.courtPositions` |
| Rally winner | `payload.winningSide` |
| Post-rally score | `state.leftScore/rightScore + 1` |
| Post-rally server/receiver/court | `advanceDoublesServeAfterPoint(...)` |

**Evidence:** Simulation test derives oracle state from `(beforeSnapshot, rallyWinner, servingSideBeforeRally)` only — no stored post-rally snapshot (`doubles-rally-simulation.test.ts:254`).

**Caveat:** `doublesServe.setup` must remain in **state** (from `MATCH_STARTED`), not in each rally event. That is setup truth, not per-rally truth — acceptable for Grade A.

**Payload size savings (estimate):**

| Field | ~Bytes per event |
|-------|------------------|
| `doublesServe` snapshot | ~150–250 |
| `winnerScore`, `loserScore`, flags | ~40 |
| **Per match (~90 rallies)** | **~17–26 KB** saved in `payload_json` |

---

## 3. Can `GAME_ENDED` and `MATCH_ENDED` Be Derived from Rally History?

### Normal completion: **Yes**

| Field in `GAME_ENDED` | Derivation |
|-----------------------|------------|
| `gameNumber` | `state.currentGame` |
| `winningSide` | `payload.winningSide` on game-ending rally |
| `leftScore`, `rightScore` | Derived scores at game end |
| `nextServingSide` | Game winner serves first in next game (BWF) |
| `doublesServe.*` (next server, court) | `nextGameServerAfterGameEnd` + `buildNextGameCourtPositions` using pre-rally server at game-winning point |

| Field in `MATCH_ENDED` | Derivation |
|--------------------------|------------|
| `winningSide` | Side reaching `gamesNeededToWin` |
| `gamesLeft`, `gamesRight` | Count of completed games |
| `reason: "normal"` | Implicit when derived from rallies |
| `resultSummary` | `buildResultSummary(...)` (already in `commands.ts:322–347`) |

**Evidence:** Tenant isolation tests manually construct `GAME_ENDED` after 21 `POINT_WON` events (`badminton-tenant-isolation.test.ts:127–163`). Those boundary events are **convenience denormalization** today, not information that rallies lack.

### Cannot be derived from rallies alone: **No**

| Scenario | Why |
|----------|-----|
| Walkover | No rallies played |
| Retirement | Match ends mid-game without game-winning rally |
| Disqualification | External decision |
| Abandoned | External decision |

**Grade A interpretation:** Scoring state is rally-driven; **terminal non-rally events remain** for exceptional match endings. This is standard for event-sourced sports systems and still qualifies as Grade A for live scoreboard geometry.

### Undo interaction (important benefit)

Today, game-winning rally = 2–3 stored events. Undo tombstones one sequence → corruption.

**Grade A with derived boundaries:** one `POINT_WON` per rally; undo removes one rally → game/match state recalculates automatically.

---

## 4. Performance Impact of Full Derivation

### Replay cost

| Operation | Complexity | Per match (typical) |
|-----------|------------|---------------------|
| Current replay | O(events) | ~60–120 events (best of 3) |
| Grade A replay | O(rallies) | ~60–90 `POINT_WON` + setup |
| Added work per rally | O(1) object ops | `advanceDoublesServeAfterPoint` ~15 field updates |
| Game boundary check | O(1) | `isGameOver` arithmetic |

**Estimate:** +50–100 µs per rally in Node.js (negligible). Full match replay remains **< 5 ms**.

### Comparison: derive vs copy snapshot

| | Copy snapshot (Hybrid) | Derive (Grade A) |
|--|------------------------|------------------|
| CPU per rally | Lower (JSON field copy) | Slightly higher (pure function) |
| DB storage | Larger payloads | Smaller payloads |
| Network (SSE/GET) | State object same size | State object same size |
| Refresh replay | Already full replay | Same path, +derivation |

### Hot paths

| Path | Today | Grade A impact |
|------|-------|----------------|
| `GET /matches/:matchId` (refresh) | Full replay | +derivation overhead — still negligible |
| `awardPoint` write | Snapshot load + incremental reduce | Can derive on reduce — same order |
| Dashboard list | Snapshot read | Unchanged |
| SSE broadcast | Pushes computed state | Unchanged |

### Conclusion

**Performance is not a blocker.** Badminton matches have low event volume compared to cricket ball-by-ball. Derivation adds constant-factor CPU; slimmer payloads may slightly **improve** DB I/O.

---

## 5. Migration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Existing events with embedded `doublesServe`** | **HIGH** if prod data exists | Legacy compat: derive + assert against stored snapshot; optional one-time backfill |
| **Schema strictness** | MEDIUM | Zod: optional legacy fields; new events use slim schema |
| **Replay divergence** | MEDIUM | Run dual-path replay in tests; compare to oracle for all stored matches |
| **Multi-game doubles untested** | **HIGH** | Sim currently stops at game end (`doubles-rally-simulation.test.ts:283–284`); must add cross-game tests before migration |
| **Snapshot cache drift** | MEDIUM | After migration, invalidate all `state_snapshot_json` or re-replay all matches |
| **Undo semantics** | HIGH (pre-existing) | Fix `getLastBadmintonSequence`; Grade A makes undo simpler |
| **External consumers of raw events** | LOW | No GET rally-history API today; payloads are internal |
| **Mixed doubles** | LOW | Same engine as doubles — no separate migration |

### Pre-production window

Git status shows badminton scoring as **recently added / untracked**. If no production matches are stored yet, migration risk drops from **Medium–High** to **Low** — ideal time to adopt Grade A before data accumulates.

---

## 6. Complexity Estimate

### Overall: **Medium**

| Workstream | Effort | Notes |
|------------|--------|-------|
| `applyPointWon` derivation (doubles + singles scores) | **Low** | ~40 lines changed |
| Inline game/match boundary in reducer | **Medium** | Refactor `applyGameEnded` logic into shared helper |
| Slim payloads + Zod schema | **Low** | |
| Legacy compat + drift assertion | **Medium** | Required for safe rollout |
| Undo fix | **Low–Medium** | Independent but should ship together |
| Multi-game doubles tests | **Medium** | Biggest test gap today |
| Re-snapshot all matches | **Low** | One-time script |
| API / client changes | **Low** | Client uses `BadmintonMatchState`, not raw payloads |

**Not High because:** domain logic exists and is oracle-validated; no new BWF rules research needed.

**Not Low because:** game-boundary inline derivation, migration compat, undo fix, and multi-game test coverage are non-trivial.

---

## 7. Recommendation: Stay Hybrid or Move to Grade A?

### Recommendation: **Move to Grade A — phased, before broad production deployment**

### Evidence summary

| Factor | Hybrid (Grade C) | Grade A |
|--------|------------------|---------|
| Correctness today | ✅ 205/205 sim sequences | ✅ Same logic, stronger replay guarantee |
| Corrupt payload resilience | ❌ Replay trusts stored snapshots | ✅ Recompute from winners |
| Undo correctness | ❌ Multi-event tombstone bugs | ✅ One rally = one event |
| Event log size | Larger | Smaller |
| Implementation cost | $0 now | Medium one-time |
| Multi-game test coverage | ⚠️ Gap exists either way | Must add regardless |
| Non-rally terminals | Required | Still required |

### Recommended rollout (three phases)

#### Phase A — Derive on replay, keep writing snapshots (low risk)

- Change `applyPointWon` to derive; assert `payload.doublesServe === derived` when present.
- **No migration needed**; immediately catches drift.
- Still Grade C for storage, but proves derivation correctness.

#### Phase B — Slim new event payloads

- Stop writing `doublesServe` to new `POINT_WON` events.
- Stop emitting separate `GAME_ENDED` / `MATCH_ENDED` for normal points (derive inline).
- Legacy events still replay via compat layer.

#### Phase C — Fix undo + re-snapshot + remove snapshot-first write path

- Target last `POINT_WON` for undo.
- Prefer full replay over `state_snapshot_json` for write-path load (consistency).

### When to stay Hybrid

Stay Grade C **only if**:

- You need to ship scoring this week with zero test investment, **and**
- Production matches with legacy payloads already exist, **and**
- You accept undo bugs on game-winning rallies until a follow-up fix.

Even then, **Phase A (derive + assert)** costs little and is strongly recommended.

### BidWar-specific call

Given:

1. Derivation logic **already exists and is oracle-proven**
2. Hybrid replay **does not use** that logic (architectural debt)
3. Undo is **broken** on multi-event game points
4. Badminton module appears **pre-production**

**BidWar should plan Grade A now**, starting with Phase A derive-on-replay, rather than entrenching Hybrid payloads in long-lived production data.

---

## Architecture Target (Grade A)

```
MATCH_STARTED
  └── setup: format, sides, doublesSetup (first server/receiver)

POINT_WON × N
  └── { winningSide, rallyLength? }     ← only rally truth stored

POINT_UNDONE × M                        ← compensating (operational)

RETIREMENT / WALKOVER / TIMEOUT …       ← non-rally terminals (operational)

                    │
                    ▼
         replayBadmintonEvents()
                    │
    ┌───────────────┴────────────────┐
    │  For each POINT_WON:           │
    │  1. Increment score            │
    │  2. advanceDoublesServeAfterPoint│
    │  3. if isGameOver → next game   │
    │  4. if matchOver → terminal     │
    └───────────────┬────────────────┘
                    ▼
           BadmintonMatchState
         (no snapshot in payloads)
```

---

## File Change Checklist

| File | Change |
|------|--------|
| `lib/badminton-core/src/scoring/doubles-engine.ts` | Derive in `applyPointWon`; slim `buildPointWonPayload` |
| `lib/badminton-core/src/scoring/singles-engine.ts` | Derive scores in `applyPointWon` |
| `lib/badminton-core/src/reducer/reducer.ts` | Derive scores; inline game/match transition |
| `lib/badminton-core/src/commands.ts` | Emit slim `POINT_WON` only for normal play |
| `lib/badminton-core/src/events/badminton.ts` | Slim Zod schemas; legacy optional fields |
| `lib/badminton-core/src/scoring/doubles-court.ts` | No change (already complete) |
| `lib/badminton-core/src/scoring/bwf-doubles-oracle.ts` | Extend tests for multi-game |
| `lib/badminton-core/src/scoring/doubles-rally-simulation.test.ts` | Cross-game sequences |
| `artifacts/api-server/src/lib/badminton-service.ts` | Undo targets last `POINT_WON`; optional drop snapshot-first load |
| `artifacts/api-server/src/__tests__/badminton-tenant-isolation.test.ts` | Slim-payload replay tests |

---

## Final Verdict

| Question | Answer |
|----------|--------|
| Can BidWar become Grade A? | **Yes** |
| Is new domain logic required? | **No** — wire existing functions into replay |
| Biggest blocker | Migration compat + multi-game test coverage + undo fix |
| Should BidWar stay Hybrid? | **No** — adopt Grade A phased; at minimum implement derive-on-replay with assertion now |
