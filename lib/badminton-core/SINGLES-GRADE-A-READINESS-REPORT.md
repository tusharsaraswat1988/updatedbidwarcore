# Singles Grade A Readiness Report

**Date:** June 17, 2026  
**Scope:** Singles derive-on-replay (Phase A parity with doubles)  
**Prerequisites:** [SINGLES-SCORING-AUDIT.md](./SINGLES-SCORING-AUDIT.md), [GRADE-A-READINESS-REPORT.md](./GRADE-A-READINESS-REPORT.md) (doubles)

---

## Executive Summary

Singles now follows the same **derive-on-replay + dual validation** architecture as doubles Phase A. Replay derives scores and serving side from **previous state + `winningSide`**; legacy `winnerScore` / `loserScore` / `servingSide` are validated but not trusted.

| Metric | Before | After Phase A (singles) |
|--------|--------|-------------------------|
| Architecture grade | **C (Hybrid)** | **B+ (Grade A Ready)** |
| Replay derives scores | No | **Yes** |
| Replay derives servingSide | Partial (`payload ?? winner`) | **Yes** (winner serves) |
| Legacy payload dual-validation | No | **Yes** (warn on drift) |
| Undo (shared Phase B) | Yes | **Yes** |
| 500+ rally live vs replay | ✅ 0 mismatches | ✅ 0 mismatches |

**Grade: B+ (Grade A Ready)** — parity with doubles for within-game replay derivation.

---

## Phase A — Derive on Replay ✅

### Implemented

| Change | File |
|--------|------|
| `deriveSinglesScoresAfterPointWon()` | `src/scoring/singles-replay-derive.ts` |
| `validateSinglesScoresAgainstPayload()` | `singles-replay-derive.ts` |
| `deriveSinglesServingSideAfterPointWon()` | `singles-replay-derive.ts` |
| `validateSinglesServingSideAgainstPayload()` | `singles-replay-derive.ts` |
| Reducer derives scores for `matchKind === "singles"` | `src/reducer/reducer.ts` |
| Engine applies derived servingSide | `src/scoring/singles-engine.ts` |
| Drift warning hook `setSinglesScoreDriftWarningHandler()` | `singles-replay-derive.ts` |

### Behavior

1. **Replay always applies derived scores:**
   - `newLeftScore = state.leftScore + (winningSide === "left" ? 1 : 0)`
   - `newRightScore = state.rightScore + (winningSide === "right" ? 1 : 0)`

2. **Replay does not trust payload scores.** If `winnerScore` / `loserScore` disagree with derived values, logs:
   - `[badminton-core] singles score drift: derived X-Y vs payload A-B (winner=...)`
   - Production does **not** fail on drift.

3. **Serving side:** Under BWF rally-point singles, server = rally winner. Derived from `winningSide`; legacy `servingSide` validated with warn-on-mismatch.

4. **Command path unchanged:** New events still write full legacy payloads (`winnerScore`, `loserScore`, `servingSide`) for backward compatibility.

### Tests (`grade-a-singles-phase-a.test.ts`)

| Test | Result |
|------|--------|
| 20 simulation sequences — derived vs payload scores | ✅ 100% match |
| Full replay vs incremental reduce | ✅ |
| Slim payload without `servingSide` | ✅ |
| Corrupted payload scores — warns, applies derived | ✅ |

---

## Parity with Doubles (B+ Checklist)

| Capability | Doubles | Singles |
|------------|:-------:|:-------:|
| Derive on replay (within game) | ✅ serve/court | ✅ scores + serve |
| Dual validation vs legacy payload | ✅ | ✅ |
| Warn on drift, do not fail | ✅ | ✅ |
| Custom drift handler hook | ✅ | ✅ |
| Legacy payloads still written | ✅ | ✅ |
| Undo targets last rally (Phase B) | ✅ | ✅ (shared) |
| Multi-game simulation report | ✅ | ✅ (`singles-rally-simulation-report.txt`) |
| Derive GAME_ENDED inline | ❌ Phase E | ❌ Phase E |
| Derive MATCH_ENDED inline | ❌ Phase E | ❌ Phase E |
| Slim `{ winningSide }` only payloads | ❌ Phase E | ❌ Phase E |

---

## Readiness Questions (Singles)

### 1. Can replay derive everything within a game?

| Field | Derived on replay? | Evidence |
|-------|:------------------:|----------|
| Left / right score | **Yes** | `deriveSinglesScoresAfterPointWon` in reducer |
| Serving side | **Yes** | `deriveSinglesServingSideAfterPointWon` in engine |
| Game number | **Yes** | Unchanged until `GAME_ENDED` |
| Games won | **No** | Still from `GAME_ENDED` events |
| Match status / winner | **No** | Still from `MATCH_ENDED` / terminal events |

**Within-game singles state: fully derived from rallies + `MATCH_STARTED`.**

### 2. Are payload score fields still needed?

| Payload field | Needed for correctness? | Status |
|---------------|:------------------------:|--------|
| `winnerScore` / `loserScore` | **No** on replay | Still **written**; dual-validated only |
| `servingSide` | **No** on replay | Still **written**; dual-validated only |
| `isGamePoint` / `isMatchPoint` | **No** | Informational |

**Verdict:** Informational only for replay after this change. Safe to remove in Phase E.

### 3. Are boundary events still needed?

**Yes (same as doubles).**

- `GAME_ENDED` — game counter, score reset, next-game server
- `MATCH_ENDED` — match completion
- Walkover / retirement / DQ — explicit terminal events

Singles audit confirmed: `POINT_WON`-only log does **not** reconstruct game transitions.

### 4. Is undo fully safe?

Uses shared Phase B undo targets (`getUndoTargetSequences`). Singles-specific tests in `singles-rally-simulation.test.ts`:

| Scenario | Safe? |
|----------|:-----:|
| Normal rally | ✅ |
| Game-winning rally undo | ✅ |
| servingSide = last rally winner after replay | ✅ |

---

## Simulation Evidence

| Report | Location | Latest |
|--------|----------|--------|
| Singles live vs replay | `test-reports/singles-rally-simulation-report.txt` | 452 sequences, 3559 checkpoints, 0 mismatches |
| Grade A Phase A unit tests | `grade-a-singles-phase-a.test.ts` | 4/4 |

---

## Files Changed

| File | Change |
|------|--------|
| `src/scoring/singles-replay-derive.ts` | **New** — derive + dual validation |
| `src/scoring/singles-engine.ts` | Derive servingSide on replay |
| `src/reducer/reducer.ts` | Derive singles scores on replay |
| `src/scoring/index.ts` | Export singles-replay-derive |
| `src/scoring/grade-a-singles-phase-a.test.ts` | **New** — Phase A tests |
| `SINGLES-GRADE-A-READINESS-REPORT.md` | **New** — this document |

---

## Remaining Gaps (Phase E)

1. Remove `winnerScore` / `loserScore` / `servingSide` from new `POINT_WON` payloads
2. Derive `GAME_ENDED` / `MATCH_ENDED` inline when game/match ends on a rally
3. Slim event to `{ winningSide, rallyLength? }`
4. Optional: singles best-of-3 multi-game report mirroring doubles Phase C naming

---

## Recommendation

**Singles Phase A can ship safely** alongside doubles Phase A–C. Replay is authoritative for within-game scores and serve; legacy payloads remain compatible with drift monitoring. Proceed to **Phase E** only when approved to stop writing redundant fields and derive boundary transitions inline.
