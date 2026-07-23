# Badminton Scoring Engine — Architecture Hardening Review

**Role:** Principal Software Architect  
**Scope:** Pre-freeze audit (identify risks only — no performance work, no refactors)  
**Date:** 2026-07-22  
**Context:** After Phase-1 latency changes (pure-read `loadCurrentMatchState`, SSE before audit)

---

## Executive summary

The scoring **write path** (event log → full replay projection → snapshot) is sound enough for single-court operation and passed Phase-1 tournament validation. Before freezing the engine, three **Critical** architectural risks block confident multi-court / multi-instance production:

1. Cross-match SSE contamination (server fanout + client apply)
2. Non-atomic multi-event command persistence
3. Non-idempotent point writes compounded by SSE-before-audit ordering

Phase-1 did **not** invent most of these; it made some more visible and introduced the SSE/audit ordering hazard.

---

## Critical — must fix before production

### C1. Cross-match SSE fanout + unfiltered client apply
| | |
|--|--|
| **Dimensions** | SSE architecture, Event ordering |
| **Evidence** | `badminton-broadcast.ts` → `broadcastBadmintonMatchUpdate` delivers when `client.matchId === matchId \|\| client.tournamentId === tournamentId`. Match-scoped clients always have `tournamentId`, so they receive **all** tournament match updates. `use-badminton-match.ts` SSE handler applies `msg.data` with **no** `incoming.matchId === matchId` check; sequence guard alone can accept a foreign higher-seq state. |
| **Risk** | Multi-court tournament: Court B scoring can overwrite Court A LED/OBS/scorer UI. |
| **Phase-1** | Pre-existing; validation exposed it. |

### C2. Multi-event command batches are not transactional
| | |
|--|--|
| **Dimensions** | Transaction boundaries, Error recovery, Event sourcing |
| **Evidence** | `cmdAwardPoint` can emit `POINT_WON` + `GAME_ENDED` + `MATCH_ENDED`. `persistScoringEventBatch` inserts events **sequentially with no `db.transaction`**. Snapshot update runs after append, outside that unit. |
| **Risk** | Crash / unique conflict mid-batch leaves a torn game/match boundary in the event log. |
| **Phase-1** | Pre-existing. |

### C3. Point POST is not idempotent; SSE-before-audit worsens retries
| | |
|--|--|
| **Dimensions** | Idempotency, Error recovery |
| **Evidence** | `POST .../point` accepts `{ side }` only — no idempotency key / expected sequence. After Phase-1: persist → **SSE** → **await audit** → HTTP response. Audit failure after SSE can cause client retry → second point while LEDs already showed the first. Cricket path has `expectedSequence`; badminton batch path does not. |
| **Risk** | Double-tap / flaky network / audit error awards phantom points. |
| **Phase-1** | Lack of idempotency pre-existing; **SSE-before-audit ordering introduced** by Phase-1. |

---

## Medium — should fix before next major release

### M1. Organizer/admin scoring bypasses match locks
- **Dimensions:** Concurrency  
- **Evidence:** `canWriteScoring` allows tournament owner without `assertSessionOwnsMatchLock`.  
- **Risk:** Organizer Match Control + court scorer race; only backstop is `UNIQUE (match_id, sequence)` → 409.  
- **Phase-1:** Pre-existing (ops convenience).

### M2. In-memory SSE registry — multi-instance blind
- **Dimensions:** Multi-instance deployment, SSE  
- **Evidence:** Module-level `Set` in `badminton-broadcast.ts`; documented in streaming audit.  
- **Risk:** Second API instance never fans out to LEDs subscribed elsewhere; silent scoreboard stall.  
- **Phase-1:** Pre-existing.

### M3. Snapshot vs replay divergence for read models after Phase-1
- **Dimensions:** Snapshot lifecycle, CQRS, Read/write purity  
- **Evidence:** Command path always replays events (good). Snapshots only written on persist. List/dashboard/scorer-home still consume `stateSnapshotJson`. If snapshot write fails after events commit, SoT is correct but read models stale. Phase-1 removed heal-on-read snapshot writes.  
- **Risk:** Dashboard cards show wrong score while LED (replay/SSE) is correct.  
- **Phase-1:** **Exposed** (removed read-path heal).

### M4. `lastSequence` forced to persisted tail hides replay/score mismatch
- **Dimensions:** Replay determinism, Event ordering  
- **Evidence:** `replayMatch` / `loadCurrentMatchState` override `lastSequence` when effective replay tail ≠ DB max sequence (undo tombstones). Clients treat sequence as version.  
- **Risk:** Legitimate for undo; dangerous if real projection drift is papered over with a high sequence.  
- **Phase-1:** Pre-existing; more visible with always-replay load.

### M5. Sequence allocation TOCTOU
- **Dimensions:** Concurrency, Event ordering  
- **Evidence:** `getNextEventSequence` is SELECT MAX+1 without row lock; batch path re-reads sequence inside persist. Unique index catches duplicates as 409, not atomic command groups.  
- **Risk:** Widened race under concurrent writers (especially with M1).  
- **Phase-1:** Pre-existing.

### M6. Reducer wall-clock timestamps break full-state determinism
- **Dimensions:** Clock/time dependencies, Replay determinism  
- **Evidence:** `reducer.ts` uses `new Date().toISOString()` for `startedAt` / `endedAt` / `takenAt` on start/end/timeout; `occurredAt` on events largely unused for those fields.  
- **Risk:** Same event log → different timestamp fields on each replay (scores may still match). Breaks duration math, forensic rebuild, snapshot equality on time fields.  
- **Phase-1:** Pre-existing; amplified by frequent full replay.

### M7. Append-only contract violated by match delete
- **Dimensions:** Event sourcing boundaries  
- **Evidence:** Schema comments say INSERT-only; `deleteBadmintonMatch` deletes `scoring_events`.  
- **Risk:** Erases forensic history; analytics/compliance assumptions fail.  
- **Phase-1:** Pre-existing.

### M8. Public unauthenticated SSE
- **Dimensions:** SSE (security-adjacent)  
- **Evidence:** `GET .../stream` intentional public for LEDs.  
- **Risk:** Anyone with `tournamentId` can subscribe to live score traffic (side labels, ops signals). Acceptable for public boards if intentional; no stream-level authz/rate-limit design.  
- **Phase-1:** Pre-existing.

### M9. Lock acquire check-then-act
- **Dimensions:** Concurrency  
- **Evidence:** `acquireMatchLock` select-then-insert; PK on `match_id` mitigates but concurrent first-acquire may surface as opaque DB error vs `MATCH_LOCKED`.  
- **Risk:** Rare dual-login glitch.  
- **Phase-1:** Pre-existing.

---

## Low — can wait

### L1. Fire-and-forget master statistics after terminal
- Projection lifecycle / error recovery — silent stats lag after match complete.

### L2. No feature-flag kill-switch for Phase-1 latency ordering
- Cannot disable SSE-before-audit or force alternate projection behavior without deploy. `features_json.scoring` reserved but unused; real gates are `SCORING` env + `scoringEnabled`.

### L3. Cricket vs badminton CQRS asymmetry
- Cricket has session `expectedSequence`; badminton does not — harder multi-sport platform guarantees.

### L4. Double sequence assignment in batch path is dead/confusing
- Orchestrator pre-stamps sequences; persist re-allocates — future callers may assume wrong contract.

### L5. No FK from `scoring_events.match_id` → `scoring_matches`
- Integrity is application-enforced only.

### L6. O(n) full event reload every point (architectural growth bound)
- Intentional for correctness after snapshot poison; memory/CPU grow with match length. Not a correctness bug; freeze decision must accept this growth curve until a *safe* incremental design exists.

### L7. Tournament-wide dashboard streams increase fanout
- Couples to C1 when combined with OR broadcast predicate.

---

## Dimension coverage matrix

| Dimension | Primary findings |
|-----------|------------------|
| Event sourcing boundaries | C2, M7 |
| CQRS separation | M3, L3 |
| Read/write purity | M3 (Phase-1 improved command prior; snapshot consumers lag) |
| Snapshot lifecycle | M3, M4 |
| Projection lifecycle | M3, L1, L6 |
| SSE architecture | C1, M2, M8, L7 |
| Transaction boundaries | C2, M5 |
| Error recovery | C2, C3, L1 |
| Replay determinism | M4, M6 |
| Idempotency | C3 |
| Concurrency | M1, M5, M9 |
| Database indexes | Unique `(match_id, sequence)` present — good; does not make multi-event batches atomic |
| Memory growth | L6 |
| Event ordering | C1, M4, M5 |
| Clock/time | M6 |
| Feature flag readiness | L2 |
| Multi-instance | M2 |

---

## Freeze recommendation

| Question | Answer |
|----------|--------|
| Freeze engine for **single-court** production? | **Yes, with C3 awareness** (idempotency / audit-after-SSE retry). |
| Freeze for **multi-court tournament** production? | **No** until **C1** is resolved. |
| Freeze for **multi-instance** API deploy? | **No** until **M2** is resolved (or sticky sessions + documented single-writer instance). |
| Proceed to Phase-2 incremental projection? | **CONDITIONAL** — only after C1–C3 have an agreed design; shadow-compare incremental vs replay; do not treat Phase-1 latency validation alone as freeze gate. |

---

## What Phase-1 changed architecturally

| Change | Net effect |
|--------|------------|
| Pure-read `loadCurrentMatchState` | Improved command-prior purity; removed heal-on-read; snapshot consumers can lag on write failure |
| SSE before `writeScorerAudit` | Faster LED; introduced display-before-audit-durability + retry-double class risk |
| Full replay on persist (unchanged) | Still the correctness anchor — do not remove without shadow proof |

---

*End of audit. No code was modified for this review.*
