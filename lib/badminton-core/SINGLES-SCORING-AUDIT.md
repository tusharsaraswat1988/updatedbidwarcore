# Singles Scoring Architecture Audit

**Date:** June 17, 2026  
**Scope:** `lib/badminton-core` singles engine, replay/undo, API refresh path  
**Method:** Static code review + automated simulation (452 sequences, 3559 rally checkpoints)  
**Related:** [SCORING-ARCHITECTURE-AUDIT.md](./SCORING-ARCHITECTURE-AUDIT.md), [GRADE-A-READINESS-REPORT.md](./GRADE-A-READINESS-REPORT.md)

---

## Executive Summary

Singles is **simpler than doubles** but **not fully rally-driven**. Live incremental state and full event replay **match 100%** across 3559 simulated rally checkpoints — however replay still **reads denormalized score fields from event payloads** and **requires boundary events** for game/match transitions.

| Area | Verdict |
|------|---------|
| Live vs replay consistency | ✅ **3559/3559 checkpoints match** |
| Undo reconstruction | ✅ Rally-correct (Phase B fix applies to singles) |
| Refresh recovery | ✅ Full event replay on GET match |
| Reconstruct from `MATCH_STARTED` + `POINT_WON` only | ❌ **NO** (partial within-game only) |
| Architecture grade | **C (Hybrid)** — not assumed correct because simpler |

---

## Simulation Results

**Harness:** `src/scoring/singles-rally-simulation.test.ts`  
**Report:** `test-reports/singles-rally-simulation-report.txt`

| Metric | Result |
|--------|--------|
| Sequences run | **452** |
| Sequences passed | **452** |
| Sequences failed | **0** |
| Total rally checkpoints (live vs replay) | **3559** |
| Mismatch checkpoints | **0** |

### Sequence coverage

| Category | Count | Notes |
|----------|------:|-------|
| 6-rally binary patterns | 64 | All `2^6` winner combinations |
| 7-rally binary patterns | 128 | All `2^7` |
| 8-rally binary patterns | 256 | All `2^8` |
| Deuce to 22–20 | 1 | 42 rallies |
| Best of 3 (2–1) | 1 | Full match + game transitions |
| Best of 3 (2–0) | 1 | Match completion |
| Best of 3 deciding game deuce | 1 | Game 3 deuce path |

At each checkpoint, compared: `leftScore`, `rightScore`, `servingSide`, `currentGame`, `gamesLeft`, `gamesRight`, `matchStatus`, `totalRallies`, `inInterval`, `winnerSide`, `games.length`, `activeTimeout`.

---

## 1. Replay Reconstruction

### Verdict: ✅ Consistent (with caveats)

**Evidence:** 3559/3559 live vs replay checkpoints identical.

### How replay works (singles)

```77:115:lib/badminton-core/src/reducer/reducer.ts
function applyPointWon(state, payload) {
  const newLeftScore = payload.winningSide === "left" ? payload.winnerScore : payload.loserScore;
  const newRightScore = payload.winningSide === "right" ? payload.winnerScore : payload.loserScore;
  const nextServingSide = payload.servingSide ?? payload.winningSide;
  // ...
  const enginePatch = engine.applyPointWon(state, payload);
  return { ...state, leftScore: newLeftScore, rightScore: newRightScore, servingSide: enginePatch.servingSide ?? nextServingSide, ... };
}
```

```77:83:lib/badminton-core/src/scoring/singles-engine.ts
  applyPointWon(state, payload) {
    return {
      servingSide: payload.servingSide ?? payload.winningSide,
    };
  }
```

### What replay trusts from payload (not derived)

| Field | Source on replay | Could derive from `winningSide`? |
|-------|------------------|----------------------------------|
| `leftScore` / `rightScore` | `payload.winnerScore` / `payload.loserScore` | **Yes** (count rallies) — **not implemented** |
| `servingSide` | `payload.servingSide ?? winningSide` | **Yes** (always = last winner) — **partially redundant** |
| `gameNumber` guard | `payload.gameNumber` vs `state.currentGame` | Needs `currentGame` from boundary events |

### Singles is NOT derive-on-replay for scores

Unlike doubles (Phase A migration), singles **still reads `winnerScore`/`loserScore` from the event**. Corrupted payload scores would replay incorrectly even if `winningSide` is correct.

---

## 2. Undo Reconstruction

### Verdict: ✅ Correct (after Phase B)

Singles uses the same undo infrastructure as doubles:

| Component | Path |
|-----------|------|
| `getUndoTargetSequences()` | `src/replay/undo-targets.ts` |
| Tombstones last `POINT_WON` + chained `GAME_ENDED` / `MATCH_ENDED` | `resolveUndoEvents` |
| Service layer | `badminton-service.ts` → `undoLastPoint` |

### Verified scenarios

| Scenario | Result | Evidence |
|----------|--------|----------|
| Normal rally undo | ✅ | `badminton-tenant-isolation.test.ts` |
| Game-winning rally undo | ✅ | `singles-rally-simulation.test.ts` — restores game 1 at 20–0 |
| Match-winning rally undo | ✅ Blocked | `cmdUndoLastPoint` rejects non-live match |
| Timeout after rally | ✅ | `grade-a-phase-b-undo.test.ts` (doubles engine, same undo path) |

### Game-winning undo test result

After 21 consecutive left points + undo:

| Field | Expected | Actual |
|-------|----------|--------|
| `currentGame` | 1 | ✅ 1 |
| `leftScore` | 20 | ✅ 20 |
| `gamesLeft` | 0 | ✅ 0 |
| `servingSide` | left (last winner before undone point) | ✅ left |

---

## 3. Refresh Recovery

### Verdict: ✅ Event replay (authoritative)

On browser refresh, client calls `GET /api/tournaments/:id/badminton/matches/:matchId`.

```805:812:artifacts/api-server/src/routes/badminton.ts
router.get("/matches/:matchId", async (req, res) => {
  const state = await replayMatch(matchId, tournamentId);
```

```203:211:artifacts/api-server/src/lib/badminton-service.ts
export async function replayMatch(matchId, tournamentId) {
  const events = await loadBadmintonEvents(matchId);
  return replayBadmintonEvents(meta, events);
}
```

**Refresh uses full event log replay**, not `state_snapshot_json`.

**Write path asymmetry:** `awardPoint` loads from snapshot cache first (`loadCurrentMatchState`). Refresh and undo always replay. Singles shares this hybrid read path with doubles.

---

## 4. Event Replay

### Event types required for complete singles match

| Event | Required? | Role |
|-------|:---------:|------|
| `MATCH_STARTED` | **Yes** | Setup: sides, format, `firstServer` |
| `POINT_WON` | **Yes** | Per-rally scoring |
| `GAME_ENDED` | **Yes** | Game counter, score reset, next game |
| `MATCH_ENDED` | **Yes** | Terminal status, `winnerSide` |
| `POINT_UNDONE` | Operational | Compensating undo |
| `TIMEOUT_*` / `INTERVAL_*` | Operational | Non-scoring state |

### `POINT_WON`-only replay experiment

**Test:** 21 `POINT_WON` events (no `GAME_ENDED`) after `MATCH_STARTED`.

| Field | Result |
|-------|--------|
| `leftScore` | 21 ✅ |
| `currentGame` | **Stuck at 1** ❌ |
| `gamesLeft` | **0** ❌ |
| `matchStatus` | **live** ❌ |

**Conclusion:** Boundary events are **required** for game/match structure even when all rally outcomes are recorded.

---

## 5. Best of 3 Simulation

Included in the 452-sequence harness:

| Scenario | Checkpoints | Mismatches |
|----------|------------:|----------:|
| Left wins 2–1 | 63+ rallies | 0 |
| Right wins 2–0 | 42+ rallies | 0 |
| Deciding game deuce (2–1) | 82+ rallies | 0 |

Verified at each checkpoint:

- Score parity live vs replay
- `servingSide === last rally winner` (BWF rally-point rule)
- Game transitions (`currentGame`, `gamesLeft`/`gamesRight`)
- Match completion (`matchStatus`, `winnerSide`)

---

## 6. Match Completion

### Normal completion path

`cmdAwardPoint` emits up to 3 events on a match-winning rally:

```112:154:lib/badminton-core/src/commands.ts
events = [POINT_WON];
if (gameOver) events.push(GAME_ENDED);
if (matchOver) events.push(MATCH_ENDED);
```

`applyMatchEnded` sets:

- `matchStatus: "completed"`
- `winnerSide`
- `gamesLeft` / `gamesRight`
- `resultReason: "normal"`

**Verified:** Best-of-3 sequences complete with `matchStatus === "completed"` and correct game counts in simulation.

### Non-rally completion

Walkover, retirement, DQ require explicit terminal events — **not reconstructible from rallies alone**.

---

## 7. Game Transitions

### Between games

`applyGameEnded` (shared reducer):

- Increments `gamesLeft` or `gamesRight`
- Marks completed game in `games[]`
- If match not over: resets scores to 0–0, increments `currentGame`, creates next game row
- Sets `servingSide` from `payload.nextServingSide ?? winningSide`

Singles `buildGameEndedExtras`:

```58:64:lib/badminton-core/src/scoring/singles-engine.ts
  buildGameEndedExtras(state, winningSide) {
    return { nextServingSide: winningSide };
  }
```

**Rule:** Game winner serves first in next game (stored in `GAME_ENDED`, applied on replay).

### Deciding game interval

Reducer sets `games[n].intervalReached` when deciding game score reaches 11 (`sideChangeScore`). Interval **start/end** still require `INTERVAL_STARTED` / `INTERVAL_ENDED` events.

---

## Final Question

> Can a singles match be reconstructed from `MATCH_STARTED` + `POINT_WON` events alone?

### Answer: **NO** (partial within-game only)

### Evidence matrix

| State | From `MATCH_STARTED` + `POINT_WON` only? | Notes |
|-------|:------------------------------------------:|-------|
| Within-game score | **Partial** | Works only if payloads include `winnerScore`/`loserScore`; not derived from `winningSide` alone today |
| `servingSide` | **Yes** | Always equals last `winningSide` (BWF rally point) |
| `currentGame` | **No** | Stuck without `GAME_ENDED` |
| `gamesLeft` / `gamesRight` | **No** | Stuck without `GAME_ENDED` |
| Next game server | **No** | From `GAME_ENDED.nextServingSide` |
| Match winner / status | **No** | Requires `MATCH_ENDED` |
| Deuce handling | **Partial** | Scores in payload; game end not detected without boundary |
| Undo | **No** | Requires `POINT_UNDONE` markers |

### Controlled test (code)

`singles-rally-simulation.test.ts` → `"POINT_WON-only log does NOT reconstruct game transitions"`:

After 21 left `POINT_WON` events:

```
leftScore=21, currentGame=1, gamesLeft=0, matchStatus=live
```

Expected for completed game 1: `currentGame=2`, `gamesLeft=1`.

### Minimum event set for full singles match reconstruction

```
MATCH_STARTED
+ POINT_WON × N
+ GAME_ENDED × (games completed)
+ MATCH_ENDED × 1 (if match completes normally)
+ operational events (undo, timeout, interval, retirement, walkover)
```

### Minimum payload for `POINT_WON` today (Zod enforced)

```ts
{
  winningSide,
  gameNumber,
  winnerScore,
  loserScore,
  isGamePoint,
  isMatchPoint,
  servingSide?,  // optional; defaults to winningSide
}
```

**Not** reducible to `{ winningSide }` alone without schema + reducer changes (Phase E scope).

---

## Live vs Replay Mismatch Report

| Metric | Value |
|--------|------:|
| Rally checkpoints compared | **3559** |
| Mismatches | **0** |

No score, server, game, or match field divergences between incremental `reduceBadminton` and `replayBadmintonEvents` were found across all simulated sequences.

---

## Architecture Grade (Singles)

| Grade | Applies? |
|-------|----------|
| **A** — Fully rally driven | ❌ Payload scores + boundary events required |
| **B+** — Replay derives geometry | ❌ Scores not derived on replay (unlike doubles Phase A) |
| **C** — Hybrid | ✅ **Current** |
| **D/F** | ❌ Event-sourced, not snapshot-driven |

Singles is **less complex than doubles** (no court positions, no partner rotation) but **architecturally similar**: event log is authoritative, payloads carry denormalized data, boundary events handle structure.

---

## Risks Identified

| Risk | Severity | Detail |
|------|----------|--------|
| Payload score corruption | **Medium** | Replay trusts `winnerScore`/`loserScore`; no derive + assert (doubles has Phase A) |
| `gameNumber` mismatch silently skips point | **Low** | `applyPointWon` returns unchanged state if `payload.gameNumber !== state.currentGame` |
| Snapshot-first write path | **Low** | Same as doubles; refresh replays |
| `POINT_WON`-only storage misconception | **Medium** | Game/match structure requires boundary events |

---

## Recommendations

1. **Apply Phase A pattern to singles:** derive scores from `state + winningSide` on replay; assert against payload scores (dual validation).
2. **Keep boundary events** until Phase E inline game/match detection is implemented.
3. **Do not assume singles is Grade A ready** — doubles reached B+ with derive-on-replay; singles has not.
4. **Existing tests are strong** — extend `singles-rally-simulation.test.ts` in CI alongside doubles simulation.

---

## Files Referenced

| File | Role |
|------|------|
| `src/scoring/singles-engine.ts` | Singles engine |
| `src/reducer/reducer.ts` | Shared replay reducer |
| `src/commands.ts` | Event emission |
| `src/replay/undo-targets.ts` | Undo targeting |
| `src/scoring/singles-rally-simulation.test.ts` | 3559-checkpoint harness |
| `test-reports/singles-rally-simulation-report.txt` | Generated report |
| `artifacts/api-server/src/lib/badminton-service.ts` | Persistence + undo |
| `artifacts/api-server/src/routes/badminton.ts` | GET refresh = replay |
