# BidWar Audit Reclassification — Business Rules (2026-09-07)

**Code unchanged.** This supersedes C1, C2, C3, C4, H1, H2, H3 in `docs/BIDWAR_LIVE_TOURNAMENT_ADVERSARIAL_AUDIT_2026-09-07.md` where they conflict with the product rules below.

Audited revision still `617ecc6b`. Operator UI: `artifacts/auction-platform/src/pages/auction-operator.tsx`. Engine: `artifacts/api-server/src/routes/auction.ts`.

## Product rules (do not “fix” these away)

1. **SOLD is closed while the timer is running.** Normal path: timer hits 0 → SOLD enables. Do not design as if the operator sells during live bidding.
2. **RE-AUCTION of a sold player is required recovery.** Later MANUAL SELL to a different team/amount is allowed.
3. **MANUAL SELL is an override** of the highest-bid result (different team and/or amount). Purse/squad/player state must stay mathematically consistent. A previous sale must be reversed before a new allocation.
4. **UNDO window:** last concluded outcome is undoable **until Next Player** puts someone on the block. After Next Player, undoing the previous lot is forbidden.
5. **UNDO target** is that last concluded outcome — **not** “latest row in `bids`”.
6. Preserve existing UX unless there is a real integrity/concurrency hole.

## Classification key

- **REAL BUG** — current behaviour violates a stated rule or can corrupt state in the intended UX.
- **INTENDED BEHAVIOUR** — do not change.
- **REAL CONCURRENCY/INTEGRITY RISK** — intended UX, but a race or missing server gate can still corrupt money/state.
- **NEEDS CLARIFICATION** — not enough to implement without a product call.

---

## C1 — Sell vs in-flight bid at timer zero

**Reclassification: REAL CONCURRENCY/INTEGRITY RISK** (not “operator sells during bidding”)

The original C1 reproduction (Sold while the timer is still running) is **not** the operator product path. The UI disables SOLD while `timerActive` (`auction-operator.tsx` ~1410).

**What is real:** the owner bid is already in flight as the clock hits 0 and the operator clicks SOLD.

Current server behaviour (confirmed):

- Bid checks `timerEndsAt > now()` only **before** purse/squad I/O (`auction.ts` ~1568–1570), **not** in the revision CAS (`1699–1716`).
- A successful bid always writes a **new** `timerEndsAt` (`1707`). If the clock has already expired, `computeBidTimerDuration` sees `remaining <= 0` and returns a **full** bid timer (`243–261`), i.e. the window can reopen after it had logically closed.
- Sell does **not** require an expired timer. It only rejects paused sessions and missing leader (`1771–1775`). Timer-closed SOLD is **UI-only**.
- Sell’s `expectedBid*` check is against a snapshot **before** the transaction. The session `UPDATE` does not `WHERE revision = :R` (`1828–1853`).
- If sell **commits first**, bid CAS fails (sell **does** bump revision). Last-second bid is dropped — acceptable at a hard close.
- If sell **reads** the old leader, then the in-flight bid CAS-wins, then sell **writes** the captured leader → **wrong team / wrong amount**. This does **not** require selling during a live timer.

**Expected:** After T=0, either the late bid is rejected (window closed) **or** it becomes the leader and SOLD 409s / waits for the new timer. Never award the previous leader after a later bid has committed.

**Minimal fix (do not enable SOLD during a live timer):**

1. Server: reject SOLD while `timerEndsAt > now()` (same rule as the UI).
2. Bid CAS `WHERE` also requires `status = 'active'`, `current_player_id = :pid`, and `timer_ends_at > now()`.
3. Sell transaction: `UPDATE auction_sessions … WHERE tournament_id AND revision = :R AND current_player_id = :pid AND current_bid_team_id = :leader AND current_bid = :amt AND (timer_ends_at IS NULL OR timer_ends_at <= now())`. 0 rows → 409 `sell_race` (refresh; do not sell).

Do **not** treat last-second bidding as a reason to let the operator sell while `timerEndsAt` is still in the future.

---

## C2 — Concurrent double-sell / double purse increment

**Reclassification: REAL CONCURRENCY/INTEGRITY RISK**

Unchanged as a race. **Not** the re-auction → later manual-sell workflow.

Sequential **SOLD → RE-AUCTION → MANUAL SELL (other team/amount)** is **INTENDED**. Re-auction already reverses `purseUsed`, deletes that player’s `bids`, and sets `status = available` in one transaction (`2227–2258`).

Concurrent two `/sell` (or `/sell` + `/manual-sell`) on the same on-block player can still increment `purseUsed` twice: player `UPDATE` is `WHERE id = :id` only; `bids` has no uniqueness.

**Minimal fix:** `UPDATE players SET status='sold', … WHERE id=:id AND status='available'` (0 rows → 409). Keep re-auction’s reset to `available` so a later manual sell still works. Do **not** block re-auction or a later different-team manual sell.

---

## C3 — Bid CAS vs pause / stop-timer / unsold / manual-sell

**Reclassification: split**

| Piece | Class | Notes |
|---|---|---|
| “Operator concludes the lot while the timer is still running” | **INTENDED BEHAVIOUR (UI forbids it)** | SOLD / UNSOLD / MANUAL / DEFER are all `disabled` while `timerActive` (~1410–1440). Do not “fix” by making conclude-during-timer the design centre. |
| In-flight bid **after the window has closed** (T=0, or stop-timer cleared `timerEndsAt`) | **REAL CONCURRENCY/INTEGRITY RISK** | Same hole as C1: CAS does not require a live timer or a current player. Bid can commit and reopen a full bid timer, or leave a ghost leader if unsold/manual-sell already cleared `currentPlayerId` (those routes do **not** bump `revision`). |
| Bid vs **pause** | **REAL CONCURRENCY/INTEGRITY RISK** | Pause clears `timerEndsAt` and does not bump `revision`. SOLD stays blocked (`isPaused`). In-flight bid can still CAS and write a new timer while `status` remains `paused`. |
| Stop-timer as an alternate close | **INTENDED UX, same race as T=0** | Stop-timer enables SOLD (`timerEndsAt = null` → not `timerActive`). Do not remove it. Apply the same CAS gates as C1. |

**Can a bid commit after the window has logically closed?** **Yes.** Pre-check can pass at T−ε; CAS runs at T+δ with no timer predicate; commit writes a new `timerEndsAt`.

**Minimal fix:** Extend the bid `WHERE` as in C1 (`timer_ends_at > now()`, `status='active'`, `current_player_id` still the nominated player). Unsold / manual-sell / defer / stop-timer: bump `revision` **or** rely on `current_player_id` / timer predicates so a late bid cannot attach to a cleared lot. Server-reject conclude actions while `timerEndsAt > now()`. Do **not** add a “sell during live timer” path.

---

## C4 — Concurrent undo double-decrements purse

**Reclassification: REAL CONCURRENCY/INTEGRITY RISK** (keep undo; change the **target**)

Two overlapping `POST /undo` calls can still subtract purse twice for one sale (read last `bids` row outside the tx; second delete is a no-op).

**Conceptual model (do not use “latest bids row”):**

```
conclude lot → lastOutcome set → UNDO WINDOW OPEN
Next Player → lastOutcome cleared (already nulls it at ~1517) → UNDO WINDOW CLOSED
```

**Minimal fix:** Undo inside a transaction against `auction_sessions.lastOutcome` (player id, type, team, amount), not `ORDER BY bids.timestamp LIMIT 1`. `SELECT … FOR UPDATE` the session. If `currentPlayerId` is set or `lastOutcome` is null → 409. If type is `sold`, reverse that player/amount only if `players.status='sold'`; 0 rows / missing bid → no-op 409. Bump `revision`.

---

## H1 — Undo after Next Player / wrong lot

**Reclassification: REAL BUG** vs rules 4–5

Current `/undo` always reverses the latest `bids` row and does **not** look at `lastOutcome` or `currentPlayerId`.

That violates:

- After SOLD A → Next Player B on block → undo still reverses A.
- After SOLD A → Next Player B → UNSOLD B → undo still reverses **A**, not B’s unsold outcome.

Operator panel **does not call** `/undo` today. Z is **Reauction Last Player** (`handleInstantReauction`, gated with `!hasPlayer`). The API remains callable. The stated product still wants Undo with the window above.

**Minimal fix:** Same as C4 (lastOutcome + block while a player is on the block). Do **not** remove re-auction. Do **not** make Z-reauction the only recovery. Unsold-in-window: see N1.

---

## H2 — Sell / manual-sell skip award-time purse/squad/category checks

**Reclassification: split**

| Piece | Class |
|---|---|
| Manual sell to a **different team / amount** than the live leader | **INTENDED BEHAVIOUR** — do not force equality with the highest bid. |
| Normal SOLD not re-checking `maxAllowedBid` / max squad / category at commit | **REAL CONCURRENCY/INTEGRITY RISK** — e.g. booster cancel between last bid and T=0 SOLD. |
| Manual sell skipping max squad / category (purse checked only if `amount > 0`) | **REAL CONCURRENCY/INTEGRITY RISK** — override of winner must not silently overflow squad or purse. ₹0 skip of `bids` insert also breaks undo/re-auction reversal of that allocation. |

**Minimal fix:** Keep manual team/amount as operator input. Inside both sell transactions, re-run `maxAllowedBid` + max squad + category `maxPlayers` (same formulas as bid). If illegal → 400, no write. For ₹0 manual sell, still write a ledger row (amount 0) so reversal/undo has a target. Do **not** require `teamId === currentBidTeamId` or `amount === currentBid`.

---

## H3 — Re-auction

**Reclassification: split**

| Piece | Class |
|---|---|
| Re-auction a **sold** player, then manual-sell to another team/amount | **INTENDED BEHAVIOUR** — keep. Current sold path reverses purse and deletes `bids` before reset. |
| Re-auction **retained** via API (no retained-spend reverse) | **REAL BUG** on the API only. UI already limits re-auction to sold/unsold (~2232). Do not use this as a reason to disable sold re-auction. |

**Minimal fix:** `400` if `status === 'retained'` (or reverse retained spend + recalc). Leave sold/unsold re-auction as-is aside from C2’s `status='available'` guard on the **later** sell.

---

## Needs clarification

**N1. Does Undo reverse UNSOLD (and DEFER) in the same window?**  
Rule text says “concluded **outcome**.” `lastOutcome` is written for sold and unsold. `/undo` today cannot reverse unsold (no `bids` row). Implement sold-in-window for sure; confirm unsold/defer before coding those branches.

**N2. Last-second anti-snipe vs hard close.**  
If a bid is in flight at T=0, the C1 CAS (`timer_ends_at > now()`) **drops** that bid. If APL wants those bids to count, do **not** drop them; keep sell CAS + server “no SOLD while timer in the future” so a late commit reopens the timer and SOLD 409s. Default recommendation: **hard close** (bid CAS requires live timer) unless product says otherwise.

**N3. Stop-timer vs wait-for-zero.**  
Stop-timer still exists and enables SOLD. Treat it as the same closed window as T=0, not as “sell during bidding.”

---

## Unchanged (out of C1–H3 scope, still valid)

**C5 two operators** remains a **REAL CONCURRENCY/INTEGRITY RISK** and is what makes C2 likely on site. Not re-opened here.

Do not implement pause/stop/unsold “fixes” that assume SOLD is a live-timer action.

---

## Implementation order (when allowed)

1. Bid CAS: live timer + active + current player (C1/C3).  
2. Server: no SOLD/UNSOLD/MANUAL/DEFER while `timerEndsAt > now()`.  
3. Sell CAS on revision + leader + expired/cleared timer (C1); player `status='available'` (C2).  
4. Award-time purse/squad/category on sell and manual-sell; keep manual override of team/amount (H2).  
5. Undo = `lastOutcome` + no `currentPlayerId` (C4/H1).  
6. Reject retained re-auction only (H3). Never remove sold re-auction.
