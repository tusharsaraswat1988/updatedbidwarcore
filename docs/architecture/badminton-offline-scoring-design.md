# Badminton offline scoring (S4-08)

**Status:** MVP shipped (durable point queue)  
**Scope:** Scorer / umpire console point awards only — not full offline match lifecycle  
**Primary code:** `artifacts/auction-platform/src/hooks/use-badminton-match.ts` (`useBadmintonScorer`)

---

## Goal

Venue Wi‑Fi drops are common. Court officials must keep tapping points without waiting on the network. Optimistic UI already advances local match state; this design makes the **outbound point queue durable** across reloads and auto-drains when connectivity returns.

---

## Sync protocol (MVP)

1. **Award point (local)**  
   - Apply `cmdAwardPoint` optimistically in the React Query cache.  
   - Append `{ side, idempotencyKey }` to an in-memory FIFO queue.  
   - Persist the full queue to `localStorage` under  
     `badmintonPointQueue:v1:{tournamentId}:{matchId}`.  
   - Clear the key when the queue is empty.

2. **Drain (network)**  
   - Process the queue head-first with `POST …/matches/:id/point` including `idempotencyKey`.  
   - On success: dequeue, re-persist (or remove key if empty).  
   - On failure: leave remaining items in place; surface a Retry banner when online.  
   - While `navigator.onLine === false`, skip drain attempts (queue keeps accepting points).

3. **Reconnect**  
   - Listen for `window` `online` / `offline`.  
   - Offline → amber banner; continue enqueue + optimistic UI.  
   - Online → auto-call the existing drain/retry path.

4. **Restore**  
   - On hook mount for a match, reload any saved queue and drain if online.

```
  [tap] → optimistic state → enqueue + localStorage
                                  │
                                  ▼
                         drain when online ──POST point──► server event log
                                  │                         (idempotent)
                                  └─ persist after each step
```

---

## Conflict rules

| Situation | Rule |
|-----------|------|
| Duplicate POST of same `idempotencyKey` | Server treats as idempotent — same logical rally, no double score. |
| Client reload mid-queue | Restored queue retries with the **same** keys; safe to re-send. |
| SSE snapshot while points pending | Optimistic rally floor still prevents UI regression; after drain failure the floor is cleared so SSE can catch up. |
| Two devices scoring one match | Unchanged: match lock remains the authority. Offline queue does **not** bypass the lock. |

Idempotency keys are client-generated UUIDs (or timestamp fallback). They are the only conflict primitive in this MVP — no vector clocks or last-write-wins on full match state.

---

## Explicit non-goals (MVP)

- Offline **match start**, toss, interval/timeout/court-change commands  
- Offline undo / director actions (pause, retirement, amend)  
- Cross-device queue merge or conflict resolution UI  
- IndexedDB (cricket scoring uses IDB; badminton MVP uses versioned `localStorage` for a tiny FIFO)

---

## Future work

1. **Full offline match start** — queue `start` + pre-match payload; block LED until first successful sync.  
2. **Conflict UI** — when drain returns a non-idempotent conflict (e.g. lock stolen, terminal status), show “Server ahead / discard local queue / force unlock” choices.  
3. **Broader command queue** — timeouts, intervals, undo with the same durable pattern.  
4. **Optional IndexedDB** — if queue size or multi-tab needs grow beyond `localStorage` limits.

---

## Operator notes

- Banner copy: “Offline — points stay on this device … and sync when you reconnect.”  
- Same JWT scorer session is required after reload; expired session blocks drain until re-login.  
- Design companion to S4-05 umpire chrome: officials use the same queue whether labeled Scorer or Umpire Console.
