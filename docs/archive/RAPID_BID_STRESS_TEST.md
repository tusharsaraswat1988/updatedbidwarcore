# Rapid Bid Stress Test (VNBL Hang Class)

**Date:** 2026-07-11  
**Goal:** Deterministically stress BidWar bid-button unlock under VNBL-like war conditions, using **real production sync/lifecycle logic** with mocked infrastructure only.  
**Production code:** not modified.

Related evidence:

- `RAPID_BID_INVESTIGATION.md` — static map of the hang class
- `docs/BID_BUTTON_STUCK_RCA.md` — stale HTTP ACK after newer SSE
- Commit `3702aa2` — never-stuck bid button mitigations

---

## What this proves

| Mode | Expectation | Confidence |
|------|-------------|------------|
| **Production gate ON** | 8–12 teams × 1000 rapid bids → **no permanent lock**; client leader == server leader | If this passes, the production monotonic gate + unlock paths hold under out-of-order ACK/SSE, 409s, and 50–500 ms latency |
| **REPRO gate OFF** | Classic stale HTTP after SSE → **permanent wrong `isLeading`** past `BID_ACK_TIMEOUT_MS` | Proves the harness detects the VNBL hang class when the gate is disabled |
| **Gate unit check** | `decideBidMutationApply(2, { eventVersion: 1 })` → `reject_stale` | Same race the REPRO uses is rejected by production |

---

## How to run

From repo root:

```bash
cd artifacts/api-server
pnpm exec vitest run src/__tests__/rapid-bid-stress.test.ts
```

Or:

```bash
pnpm --filter @workspace/api-server exec vitest run src/__tests__/rapid-bid-stress.test.ts
```

**Determinism:** seed `STRESS_SEED = 0x564e424c` (`"VNBL"`). Same seed → same team count, latencies, and tap schedule.

**Artifacts** (written each run):

| File | Contents |
|------|----------|
| `artifacts/rapid-bid-stress-timeline.json` | Summary + window around first permanent lock |
| `artifacts/rapid-bid-stress-timeline.md` | Markdown timeline table |

On failure, open the markdown artifact and jump to **Window around first permanent lock**.

---

## Architecture (production vs mock)

```
┌─────────────────────────────────────────────────────────────┐
│  REAL (imported from production)                            │
│  @workspace/api-base/auction-bid-sync                       │
│    decideBidMutationApply / shouldAcceptMonotonicVersion    │
│    mergeBidFields / shouldApplyBidDelta                     │
│    reduceBidUiPhase / isBidUiBusy                           │
│    BID_ACK_TIMEOUT_MS (8000) / BID_WATCHDOG_MS (10000)      │
│    logBidLifecycle                                          │
│  @workspace/api-base computeNextBidAmount                   │
│  Owner lifecycle control flow ≡ useBidLifecycle             │
│  Operator bidGateLocked control flow ≡ auction-operator     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  MOCKED                                                     │
│  Virtual clock + scheduled timers (deterministic)            │
│  Network latency 50–500 ms (seeded)                         │
│  SSE transport (independent delivery delay)                   │
│  DB revision CAS → HTTP 409 stale_bid                       │
└─────────────────────────────────────────────────────────────┘
```

Harness location (test-only):

```
lib/api-base/src/__tests__/rapid-bid-stress/
  prng.ts              Fixed-seed mulberry32
  timeline.ts          Event recorder + first permanent lock
  client-cache.ts      applyMutationAuctionState / SSE bid path
  owner-lifecycle.ts   useBidLifecycle state machine + unlocks
  operator-gate.ts     bidGateLocked + finally / timeout unlock
  harness.ts           1000-bid war orchestrator
  vnbl-repro.ts        Minimal stale-HTTP-after-SSE hang

lib/api-base/src/__tests__/rapid-bid-stress.test.ts
artifacts/api-server/src/__tests__/rapid-bid-stress.test.ts   # vitest entry
```

---

## Scenario parameters

| Parameter | Value |
|-----------|--------|
| Teams | 8–12 (seeded) |
| Bid attempts | 1000 |
| HTTP / SSE latency | 50–500 ms independent |
| Out-of-order HTTP after SSE | ~45% of commits (forced) |
| Revision conflicts | Natural CAS → HTTP **409** |
| Operator debounce | Production gate lock (global `bidGateLocked`) |
| Owner path | Production phase machine + ACK timeout + watchdog |
| Unlock reasons recorded | `finally`, `timeout`, `success`, `watchdog` |

---

## Recorded transitions

Every run records a timeline of:

- `bidGateLocked` true/false (+ unlock reason)
- `canBid` true/false per team
- `isLeading` true/false per team
- `http_ack` / `http_409` with timestamps and `eventVersion`
- `sse_bid` with timestamps and `eventVersion`
- `stale_http_rejected` (production gate)
- `owner_phase` (`idle` → `submitting` → …)
- `unlock` (`finally` \| `timeout` \| `success` \| `watchdog`)
- `permanent_lock` — **first** occurrence is the failure anchor

### Failure rules (automatic)

The stress run **fails** if any of:

1. Operator `bidGateLocked` held longer than `BID_ACK_TIMEOUT_MS` (8000)
2. Owner phase stays `submitting` (`isBidUiBusy`) longer than `BID_ACK_TIMEOUT_MS`
3. Wrong `isLeading` (client leader ≠ server leader) held longer than `BID_ACK_TIMEOUT_MS`
4. After drain: client leader ≠ server leader, or any gate/owner still busy

The timeline’s first `permanent_lock` event is exactly where the durable hang begins.

---

## REPRO: VNBL stale HTTP after SSE

`reproduceVnblStaleHttpAfterSse()` (gate **off**):

1. SSE v1 → team A leading  
2. SSE v2 → team B leading (correct)  
3. Late HTTP ACK v1 → blind overwrite → team A leading again  
4. Advance past `BID_ACK_TIMEOUT_MS` with no corrective event  
5. **Fail** with `permanent_lock` and timeline window  

With production `decideBidMutationApply`, step 3 is `reject_stale` — covered by the third vitest case.

---

## Interpreting results

**Pass (gate on):** production unlock + monotonic version gate survive a VNBL-scale war under mocked latency/ordering/409s. Safe to treat as regression gate for this hang class.

**Fail (gate on):** inspect `artifacts/rapid-bid-stress-timeline.md` → section *Window around first permanent lock*. Note `t`, team id, `eventVersion`, and whether the lock was `bidGateLocked`, owner `submitting`, or wrong `isLeading`.

**REPRO fail (gate off):** expected — documents the historical hang; do not “fix” by weakening assertions.

---

## Not in scope

- Live Render/network or real Postgres  
- Modifying `use-bid-lifecycle.ts`, `auction-operator.tsx`, or `auction-bid-sync.ts`  
- UI pixel / React Testing Library mount of full LiveBid page  

The owner/operator drivers are **control-flow faithful** to production (same reducers, timeouts, unlock reasons, and `logBidLifecycle` events) with injectable timers for determinism.
