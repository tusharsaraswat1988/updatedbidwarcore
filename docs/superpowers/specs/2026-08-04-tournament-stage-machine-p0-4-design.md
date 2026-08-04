# P0.4 — Tournament Stage Machine Design

**Date:** 2026-08-04  
**Status:** Approved  
**Scope:** Automatic tournament lifecycle progression (knockout stage advancement)  
**Depends on:** P0.3 Tournament Stage Propagation  
**Non-goals:** Scheduling, multi-day, OBS/broadcast, notifications, analytics implementations, new stage vocabulary (`round_of_16`, etc.)

---

## 1. Problem

After P0.3, Tournament Stage is the SSoT, but it only changes on promotion (historically always `quarter_final`). There is no automatic:

```
quarter_final → semi_final → final → completed
```

Operators / Dashboard / OBS can show a stage that does not match the earliest unfinished knockout phase (especially 4-team brackets that start at Semi-Finals).

---

## 2. Goals

1. Implement `advanceStage()` inside Tournament Stage Helper
2. Dynamic initial knockout stage from first real KO round (Option D)
3. Gate advancement on full terminal fixture set for the round represented by persisted stage (Option C for Ro16+)
4. Trigger only on terminal KO completion and bye advancement
5. Idempotent settle loop with lifecycle hook stubs
6. No schema/migration; persisted vocabulary unchanged

---

## 3. Invariants

- Sole public stage API remains `artifacts/api-server/src/lib/tournament-stage.ts`
- All stage writes via `writeCategoryStage()`
- Stage ≠ round name (roundName selects gate fixtures only)
- Never invent missing rounds
- Prefer not exposing `advanceStage` as a public HTTP API in P0.4 — internal engine hook only
- One terminal-status helper — no duplicated status lists

---

## 4. Promote — initial stage

Replace always-`quarter_final` with `initialKnockoutStageFromRounds(rounds)`:

| First KO `roundName` | Persisted stage |
|---|---|
| Quarter-Finals | `quarter_final` |
| Semi-Finals | `semi_final` |
| Final | `final` |
| Round of 16 / 32 / 64 | `quarter_final` (temporary coarse mapping) |

Promote transaction sequence:

```
Create bracket → Wire progression → Advance byes
→ Determine initial stage → writeCategoryStage
→ advanceStage() settle → Promotion markers → Commit
```

---

## 5. Gate resolution

Ask: **Has the round represented by the current persisted stage completed?**

| Persisted stage | Gate |
|---|---|
| `quarter_final` | Collection `Quarter-Finals` if present; else first real KO round that justified this stage (e.g. Semi-Finals in 4-team — but then promote should have set `semi_final`. For Ro16+: gate remains **Quarter-Finals**; Ro16 completion alone does not advance) |
| `semi_final` | `Semi-Finals` |
| `final` | `Final` |
| `league` / `completed` / null | No gate — no-op |

**16-team (Option C):** Stay on `quarter_final` through Round of 16; advance to `semi_final` only when Quarter-Finals collection is fully terminal.

---

## 6. Terminality

Full set (match will not continue):

`completed` | `walkover` | `retired` | `disqualified` | `abandoned` | `cancelled`

Non-terminal (blocks): scheduled, ready, live, pending, delayed, interrupted, etc.

Reuse/extend shared `isTerminalMatchStatus` (or badminton-core equivalent + cancelled). No local copies in stage machine.

---

## 7. `advanceStage()`

```ts
type AdvanceStageResult = {
  changed: boolean;
  previousStage: PersistedTournamentStage | null;
  currentStage: PersistedTournamentStage | null;
  lifecycleStage: LifecycleStage | null;
  completed: boolean;
  transitionCount: number;
  reason: AdvanceStageReason;
};

type AdvanceStageReason =
  | "ADVANCED"
  | "GATE_INCOMPLETE"
  | "ALREADY_SETTLED"
  | "TOURNAMENT_COMPLETED"
  | "NO_KNOCKOUT"
  | "HAS_PENDING_MATCHES"
  | "NOT_IN_ELIMINATION"
  | "MAX_TRANSITIONS";
```

Algorithm:

1. Resolve current stage DTO  
2. If completed → `{ changed: false, reason: "TOURNAMENT_COMPLETED", transitionCount: 0 }`  
3. If league / null → appropriate no-op reason  
4. While `transitionCount < MAX_STAGE_TRANSITIONS` (5):  
   - Resolve gate collection + fixtures  
   - If any non-terminal → break with `GATE_INCOMPLETE` / `HAS_PENDING_MATCHES`  
   - Else compute next stage; `writeCategoryStage`; fire hook; increment count  
5. Return aggregated result (`changed` if count > 0; `reason: ADVANCED` or settle reason)

`completeTournament()` → `writeCategoryStage(..., "completed")` + `onTournamentCompleted` stub.

---

## 8. Hooks (stubs only)

```ts
onStageAdvanced({ tournamentId, categoryId, previousStage, currentStage })
onTournamentCompleted({ tournamentId, categoryId })
```

No notifications / analytics / broadcast side effects in P0.4.

---

## 9. Triggers

| When | Where |
|---|---|
| KO match terminal | After `advanceKnockoutWinner` in match completion path |
| Bye advance | After `advanceRound1Byes` (promote TX + any generate-draw bye path) |

Not during live scoring updates, timeouts, or lifecycle phase refresh.

**Match completion TX:** Best-effort after existing persist/advance-winner (no new mega-transaction).  
**Promote TX:** Atomic including stage settle.

---

## 10. Tests

- 8Q: QF done → SF; SF done → Final; Final done → completed  
- 4Q: promote → `semi_final`; SF done → final → completed  
- 16Q: Ro16 done → stay `quarter_final`; QF done → `semi_final`  
- Incomplete / live / scheduled → no advance  
- walkover, cancelled, retired, DQ, abandoned → allow  
- Idempotent repeat → `transitionCount: 0`, `ALREADY_SETTLED` or `TOURNAMENT_COMPLETED`  
- Bye cascade → `transitionCount` > 1 possible  
- Already completed → no-op, `TOURNAMENT_COMPLETED`  
- Legacy / promotion compatibility  

---

## 11. Implementation order

1. Hook infrastructure + terminal helper reuse  
2. `advanceStage` / `completeTournament` / `initialKnockoutStageFromRounds`  
3. Promotion integration  
4. Match completion (+ generate-draw bye) integration  
5. Tests  

---

## 12. Definition of done

- [ ] Promote sets stage from first real KO round  
- [ ] QF/SF/Final → next / completed when gate terminal  
- [ ] Ro16+ stays on `quarter_final` until QF gate complete  
- [ ] Idempotent; MAX_STAGE_TRANSITIONS  
- [ ] Hooks stubbed  
- [ ] No schema/migration; no OBS/scheduling changes  
- [ ] Tests green  

---

## 13. Related

- `docs/superpowers/specs/2026-08-04-tournament-stage-propagation-p0-3-design.md`
