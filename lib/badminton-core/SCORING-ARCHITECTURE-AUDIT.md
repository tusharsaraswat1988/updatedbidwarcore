# Badminton Scoring Architecture Audit Report

**Date:** June 17, 2026  
**Scope:** `lib/badminton-core`, `artifacts/api-server/src/lib/badminton-service.ts`, client hooks, DB schema, simulation tests  
**Method:** Static code review (no code changes)

---

## Executive Summary

The system is **event-sourced**, not snapshot-driven. The append-only `scoring_events` table is documented and implemented as the authoritative store. `BadmintonMatchState` is always **derived** by folding events through `replayBadmintonEvents`.

However, it does **not** fully satisfy a strict **“Rally = Source of Truth”** model. Rally events (`badminton.point.won`) carry **pre-computed doubles serve/court snapshots** in their payloads, and replay **reads those snapshots** rather than re-deriving them from rally winners alone. Additional non-rally events (`GAME_ENDED`, `MATCH_ENDED`, timeouts, etc.) are also required for complete reconstruction.

**Architecture grade: C (Hybrid)**

---

## Phase 1 — Source of Truth Analysis

### Verdict: **D) Hybrid**

The system uses a **full event log** as source of truth, with rally events as the primary scoring events but **not** the sole source of derivable state.

### Evidence

#### 1. Event log is declared source of truth

`lib/db/src/schema/scoring_events.ts`:

```ts
/**
 * Append-only event store — source of truth for all scoring state.
 *
 * Engineering contract:
 * - INSERT only from application code (no UPDATE / DELETE)
 * - Corrections via compensating events (e.g. cricket.ball.undone)
 * - Per-match sequence is monotonic; UNIQUE (match_id, sequence)
 */
```

#### 2. Match state is explicitly reconstructed by replay

`lib/badminton-core/src/types.ts`:

```ts
/** Full match state reconstructed by replaying events. */
export type BadmintonMatchState = { ... }
```

#### 3. Replay is the canonical derivation path

`lib/badminton-core/src/reducer/reducer.ts`:

```ts
export function replayBadmintonEvents(
  meta: BadmintonMatchMeta,
  events: BadmintonEventEnvelope[],
): BadmintonMatchState {
  const effective = resolveUndoEvents(events);
  const initial = createInitialBadmintonState(meta);
  return effective.reduce((state, event) => reduceBadminton(state, event), initial);
}
```

#### 4. Snapshot is a cache, not authority

`lib/db/src/schema/badminton.ts`:

```ts
/** Replay of current match state (computed after each event). */
stateSnapshotJson: jsonb("state_snapshot_json")
```

#### 5. Doubles replay trusts event-carried state (not pure re-derivation)

On `POINT_WON`, the doubles engine **copies serve/court data from the event payload** instead of calling `advanceDoublesServeAfterPoint` during replay (`lib/badminton-core/src/scoring/doubles-engine.ts`, `applyPointWon`).

At **write time**, the engine computes rotation via `advanceDoublesServeAfterPoint` and embeds the result in the event. At **replay time**, it trusts the stored snapshot.

### What is *not* the source of truth

| Store | Role |
|-------|------|
| `state_snapshot_json` | Derived cache |
| React Query client cache | UI cache |
| In-memory `BadmintonMatchState` during reduce | Ephemeral derived state |

### Source-of-truth options considered

| Option | Applies? |
|--------|----------|
| A) Rally events | Partial — primary scoring events, but carry embedded doubles snapshots |
| B) State snapshots | No — explicitly a cache |
| C) Current match state | No — always derived |
| **D) Hybrid** | **Yes** — full event log + event-carried doubles state + snapshot cache |

---

## Phase 2 — Reconstruction Test

**Scenario:** All live/mutable state deleted. Keep only **match metadata** + **rally history**.

Two interpretations of “rally history” are tested below.

### Interpretation A — Strict: rally winners only (`winningSide` per rally)

Requires `MATCH_STARTED` metadata (format, sides, doubles setup).

| Field | Reconstruct? | Code path / rationale |
|-------|:------------:|----------------------|
| **Score** | **YES** | Count winners per game using format rules (`isGameOver` in `state.ts`) |
| **Current Server** | **YES** (singles) / **NO** (doubles via replay) | Singles: `servingSide = winningSide`. Doubles: replay reads `payload.doublesServe`, does not recompute |
| **Current Receiver** | **NO** (doubles) | Only in `doublesServe.receivingPlayerIndex`; not re-derived on replay |
| **Court Positions** | **NO** (doubles) | Only in `payload.doublesServe.courtPositions`; replay copies payload |
| **Service Rotation** | **NO** (doubles via replay) | `advanceDoublesServeAfterPoint` exists but is **not invoked during replay** |
| **Current Game** | **PARTIAL** | Detectable from scores + format, but reducer advances games only via `GAME_ENDED` events |
| **Match Winner** | **PARTIAL** | Derivable from game wins if game boundaries are correct; `MATCH_ENDED` carries terminal status |

### Interpretation B — Stored rally events: full `POINT_WON` payloads

| Field | Reconstruct? | Code path |
|-------|:------------:|-----------|
| Score | **YES** | `applyPointWon` → `leftScore`/`rightScore` from payload |
| Current Server | **YES** | `payload.doublesServe.servingPlayerIndex` or `payload.servingSide` |
| Current Receiver | **YES** | `payload.doublesServe.receivingPlayerIndex` |
| Court Positions | **YES** | `payload.doublesServe.courtPositions` |
| Service Rotation | **YES** | Embedded in each `POINT_WON` payload |
| Current Game | **PARTIAL** | Needs `GAME_ENDED` for multi-game transitions |
| Match Winner | **PARTIAL** | Needs `MATCH_ENDED` or derived game-win count |

### Interpretation C — Full event log (what production actually uses)

| Field | Reconstruct? | Code path |
|-------|:------------:|-----------|
| All fields | **YES** | `replayBadmintonEvents` → `reduceBadminton` for all event types |

### Critical gap: multi-game doubles

A game-winning rally emits **three events** in one command (`lib/badminton-core/src/commands.ts`):

1. `POINT_WON`
2. `GAME_ENDED` (if game over)
3. `MATCH_ENDED` (if match over)

Without `GAME_ENDED`, `applyGameEnded` never runs and the match stays stuck in the completed game’s scoreline.

---

## Phase 3 — Mutable State Detection

All fields below live in `BadmintonMatchState` (`types.ts`). During normal operation they are **derived** by replay. The snapshot column is a **cache**.

### Score-related

| Field | Classification | Notes |
|-------|----------------|-------|
| `leftScore`, `rightScore` | **DERIVED STATE** | Updated in `applyPointWon` from event payload |
| `gamesLeft`, `gamesRight` | **DERIVED STATE** | Updated in `applyGameEnded` |
| `games[].leftScore`, `games[].rightScore` | **DERIVED STATE** | Per-game history |
| `totalRallies` | **DERIVED STATE** | Incremented per `POINT_WON` |

### Server / receiver / court

| Field | Classification | Notes |
|-------|----------------|-------|
| `servingSide` | **DERIVED STATE** | Top-level convenience |
| `doublesServe.servingSide` | **DERIVED STATE** (event-carried) | Copied from `POINT_WON` payload on replay |
| `doublesServe.servingPlayerIndex` | **DERIVED STATE** (event-carried) | Same |
| `doublesServe.receivingSide` | **DERIVED STATE** (event-carried) | Same |
| `doublesServe.receivingPlayerIndex` | **DERIVED STATE** (event-carried) | Same |
| `doublesServe.courtPositions` | **DERIVED STATE** (event-carried) | Same |
| `doublesServe.setup` | **PRIMARY TRUTH** (setup) | From `MATCH_STARTED.doublesSetup`; preserved across rallies |
| `doublesServe.lastGameEnd` | **DERIVED STATE** | From `GAME_ENDED.doublesServe` payload |

### Game / match state

| Field | Classification | Notes |
|-------|----------------|-------|
| `currentGame` | **DERIVED STATE** | Advanced by `GAME_ENDED` |
| `games[]` | **DERIVED STATE** | Built incrementally |
| `matchStatus` | **DERIVED STATE** | Set by lifecycle events |
| `winnerSide`, `resultReason` | **DERIVED STATE** | Terminal events |
| `inInterval`, `activeTimeout` | **DERIVED STATE** | Non-rally events |

### Persistence caches (hidden mutable stores)

| Field | Location | Classification | Risk |
|-------|----------|----------------|------|
| `state_snapshot_json` | `badminton_match_details` | **CACHE** | Used as fast read path for `awardPoint`; not validated against replay on read |
| React Query cache | Client | **CACHE** | Optimistic updates via `reduceBadminton` |
| `scoring_matches.status` | DB | **DERIVED / denormalized** | Updated from replayed state in `updateSnapshot` |

### Concurrency note

The reducer is pure: `(state, event) → state`. No shared mutable match variables were found at module scope — good for concurrent request handling.

---

## Phase 4 — Event Replay Validation

### Test harness

`lib/badminton-core/src/scoring/doubles-rally-simulation.test.ts` runs **205 sequences**, **1429 rallies**, **1634 checkpoints**.

Per rally it:

1. Calls `cmdAwardPoint(state, winner)` (live path)
2. Appends emitted events to `eventLog`
3. Calls `replayBadmintonEvents(META, eventLog)` (full replay)
4. Compares engine snapshot vs independent BWF oracle (`bwfReferenceAfterRally`)

### Report results

From `lib/badminton-core/test-reports/doubles-rally-simulation-report.txt`:

| Metric | Result |
|--------|--------|
| Sequences run | 205 |
| Sequences passed | **205** |
| Sequences failed | **0** |
| Total rallies | 1429 |
| Total checkpoints | 1634 |
| Mismatches (score, server, receiver, court, transfer) | **0** |

### What is compared after every rally

- Score increment (BWF Law 10.3.1)
- Server in correct service court for score parity (Law 10.5)
- Receiver diagonal to server (Law 10.6)
- Service retention on serving-side win (Law 10.3.3)
- Service transfer + partner swap on receiving-side win (Law 10.3.4)
- Engine state vs independent oracle (`snapshotsEqual`)

### Replay vs live

In this test, state is always produced by `replayBadmintonEvents`. The meaningful comparison is **engine replay vs BWF oracle derived from rally winner alone**. That comparison passes 100% within single-game sequences (sim stops at game end).

**Mismatches found: none** in automated simulation.

---

## Phase 5 — Undo Architecture Audit

### Approach used: **A) Compensating event + replay**

Undo does **not** mutate stored events or snapshot in place. It appends a tombstone and re-replays.

`resolveUndoEvents` filters out the undone sequence and the undo marker itself. `POINT_UNDONE` is never reduced directly — it throws if reached before filtering.

Service flow (`badminton-service.ts`, `undoLastPoint`):

1. Load events → full replay
2. Append `POINT_UNDONE` referencing `lastSeq`
3. Load events again → full replay
4. Update snapshot

Verified in `badminton-tenant-isolation.test.ts`: undo of sequence 2 restores 0-0 and `totalRallies = 0`.

### Risks flagged

| Risk | Severity | Detail |
|------|----------|--------|
| **Wrong sequence targeted** | **HIGH** | `getLastBadmintonSequence` returns the last event in the log, not the last `POINT_WON`. A timeout/interval after the last point causes undo to tombstone the wrong event |
| **Multi-event game point** | **HIGH** | Game-winning rally emits `POINT_WON` + `GAME_ENDED` (+ possibly `MATCH_ENDED`). Undo tombstones only **one** sequence (typically `GAME_ENDED` if last), leaving inconsistent state |
| **No batch undo** | MEDIUM | Cannot atomically undo a 3-event game-winning command |
| **Snapshot vs replay asymmetry** | MEDIUM | `awardPoint` loads from snapshot; `undoLastPoint` always full-replays. Snapshot corruption would affect writes but not undo |
| **Completed match lock** | LOW (guard) | `cmdUndoLastPoint` rejects non-live matches |

---

## Phase 6 — Resume After Refresh

### Browser refresh path: **A) Event history replay**

On page reload, `useBadmintonMatch` refetches `GET /api/tournaments/:id/badminton/matches/:matchId`.

The GET handler **always replays events**, not the snapshot:

```ts
const state = await replayMatch(matchId, tournamentId);
// → loadBadmintonEvents + replayBadmintonEvents
```

### Exception: list/dashboard views use snapshot

Dashboard and `GET /matches` return `detail.stateSnapshotJson` directly — **not** replayed. Single-match scorer/display pages use replay on refresh.

### Write path uses snapshot (performance shortcut)

`loadCurrentMatchState` prefers `state_snapshot_json` when present; falls back to full replay. Used by `awardPoint` for the base state before appending new events.

---

## Phase 7 — Doubles Engine Audit

### Components reviewed

| Component | File | Role |
|-----------|------|------|
| `DoublesScoringEngine` | `doubles-engine.ts` | Production engine — computes at write, reads payload at replay |
| `MixedDoublesScoringEngine` | `doubles-engine.ts` | Extends doubles; **identical logic**, only `matchKind` differs |
| BWF Oracle | `bwf-doubles-oracle.ts` | Independent reference; derives from rally winner + prior snapshot |
| Simulation | `doubles-rally-simulation.test.ts` | 205 sequences, oracle cross-check |

### Can every server/receiver decision be derived from rally history alone?

| Lens | Answer |
|------|--------|
| **Algorithmically** | **YES** — `bwfReferenceAfterRally` and `advanceDoublesServeAfterPoint` prove derivation from rally winner + prior state |
| **Production replay path** | **NO** — `applyPointWon` copies `payload.doublesServe`; corrupted payloads would replay incorrectly |

**Cross-game transitions** also rely on stored `GAME_ENDED.doublesServe`, not re-computation from rally history alone.

### Simulation confidence

- 205/205 sequences pass
- 1429/1429 rallies match oracle at write time
- `MixedDoublesScoringEngine` inherits all doubles behavior — no separate mixed rules

---

## Phase 8 — Final Scorecard

### Architecture Grade: **C — Hybrid**

| Criterion | Assessment |
|-----------|------------|
| Append-only event log as authority | ✅ Strong |
| Pure rally-winner replay | ❌ Doubles uses event-carried snapshots |
| Snapshot as cache only | ⚠️ Snapshot preferred on write path; GET single-match replays |
| Undo via compensating events | ✅ Correct pattern, ⚠️ implementation gaps |
| Independent BWF validation | ✅ Oracle + 205 simulation sequences |
| Hidden mutable authoritative state | ❌ None in reducer; ⚠️ snapshot cache trusted on writes |

### Grade definitions

| Grade | Meaning | This system |
|-------|---------|-------------|
| **A** | Fully Rally Driven | ❌ |
| **B** | Mostly Rally Driven | ❌ |
| **C** | Hybrid | ✅ |
| **D** | State Driven | ❌ |
| **F** | Snapshot Driven | ❌ |

**Why not A:** Replay reads embedded `doublesServe` from events; multi-game needs `GAME_ENDED`; undo is compensating-event based.

**Why not D/F:** State is not mutated in place; snapshot is documented as replay output, not authority.

---

## Final Question

> If all current match state vanished and only rally events remained, could the badminton scoring system rebuild the exact match state at any rally?

### Answer: **PARTIALLY**

| Scenario | Can rebuild exactly? |
|----------|---------------------|
| **Full event log** (`MATCH_STARTED` + all events + undo markers) | **YES** |
| **Stored `POINT_WON` events** (full payloads) + `MATCH_STARTED` + boundary events | **YES** |
| **Rally winners only** + match metadata | **PARTIAL** |

### Supporting evidence

**YES cases:**

- Singles: server = last rally winner; score = win counts; game boundaries from format rules
- Doubles at write time: engine + oracle agree on all 1429 simulated rallies

**PARTIAL / NO cases:**

1. Doubles replay trusts payloads — without `doublesServe` in each `POINT_WON`, existing reducer code cannot reconstruct server/receiver/court positions (even though `advanceDoublesServeAfterPoint` could).
2. Multi-game doubles requires `GAME_ENDED` events for next-game serve rotation.
3. Non-rally state (timeouts, intervals, retirement) requires respective events.
4. Undo requires `POINT_UNDONE` compensating events.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  SOURCE OF TRUTH: scoring_events (append-only)          │
│  ├── MATCH_STARTED (setup truth)                        │
│  ├── POINT_WON (rally outcome + embedded doubles snap)  │
│  ├── GAME_ENDED / MATCH_ENDED (boundary transitions)    │
│  └── POINT_UNDONE (compensating tombstones)             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ replayBadmintonEvents()
┌─────────────────────────────────────────────────────────┐
│  DERIVED: BadmintonMatchState                           │
│  CACHE:   state_snapshot_json (write-path shortcut)     │
└─────────────────────────────────────────────────────────┘
```

---

## Key File Reference

| Path | Role |
|------|------|
| `lib/db/src/schema/scoring_events.ts` | Append-only event store |
| `lib/db/src/schema/badminton.ts` | `state_snapshot_json` cache |
| `lib/badminton-core/src/types.ts` | `BadmintonMatchState`, event envelopes |
| `lib/badminton-core/src/commands.ts` | Command layer → event payloads |
| `lib/badminton-core/src/reducer/reducer.ts` | `reduceBadminton`, `replayBadmintonEvents`, undo resolution |
| `lib/badminton-core/src/scoring/doubles-engine.ts` | Doubles / mixed doubles engine |
| `lib/badminton-core/src/scoring/doubles-court.ts` | BWF court rotation (write path) |
| `lib/badminton-core/src/scoring/bwf-doubles-oracle.ts` | Independent validation oracle |
| `lib/badminton-core/src/scoring/doubles-rally-simulation.test.ts` | 205-sequence simulation harness |
| `artifacts/api-server/src/lib/badminton-service.ts` | Persistence, snapshot, undo |
| `artifacts/api-server/src/routes/badminton.ts` | HTTP routes (GET replays, list uses snapshot) |
| `artifacts/auction-platform/src/hooks/use-badminton-match.ts` | Client fetch + SSE + optimistic updates |

---

## Recommended Follow-ups (informational only — not implemented)

1. Change `DoublesScoringEngine.applyPointWon` to call `advanceDoublesServeAfterPoint` during replay and validate against payload (detect drift).
2. Fix undo to target the last `POINT_WON` sequence and tombstone associated `GAME_ENDED` / `MATCH_ENDED` in the same command batch.
3. Validate snapshot against replay on read, or remove snapshot-first path for writes.
4. Add multi-game doubles simulation sequences that cross `GAME_ENDED` boundaries.
