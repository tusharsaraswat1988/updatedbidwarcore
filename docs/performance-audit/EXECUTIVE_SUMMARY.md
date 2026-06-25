# BidWar Performance Audit — Executive Summary

**Audit Date:** 2026-06-15  
**System:** BidWar Live Auction Platform  
**Scope:** 6 simultaneous screens + 50 public viewers  
**Auditor role:** System Architect, Performance Engineer, Realtime Systems Engineer, Production Reliability Engineer  
**Codebase:** `updatedbidwarcore/artifacts/auction-platform` + `api-server`

---

## Bottom Line

BidWar has a **sound architectural foundation** (SSE + React Query `setQueryData` as shared state bus), but is **not ready for high-stakes production live auctions** without fixes. The LED and Portrait screens can lag the operator by **250–550ms on bids** and **400–800ms on sold/purse updates** — enough to cause audience confusion and bid disputes.

**Overall Readiness Score: 54/100**

---

## Transport Clarification

Despite `useAuctionSocket` naming, auction realtime uses **Server-Sent Events (SSE)**, not WebSockets. The audit covered the actual transport layer. All recommendations apply to SSE.

---

## Top 20 Risks Ranked by Business Impact

| Rank | Issue | Severity | Probability | Impact | Category |
|------|-------|----------|-------------|--------|----------|
| 1 | **LED/Portrait 250–550ms behind operator on bids** — `useLedView` rebuilds entire view on 250ms tick | Critical | **Certain** | Audience sees wrong bid amount during hammer; disputes, trust loss | Sync |
| 2 | **Two operator tabs can issue conflicting mutations** — no session lock | Critical | Medium | Wrong player sold to wrong team; irreversible | Correctness |
| 3 | **50 public viewers opening together can overwhelm DB** — 50× full player list + 50× `buildAuctionState` | Critical | High | Server crash mid-auction | Availability |
| 4 | **Optimistic bid with no offline revert** — operator shows bid that server rejected | Critical | Medium | Auctioneer thinks bid registered; team disputes | Correctness |
| 5 | **Purse values stale 400–800ms after sold** — requires separate HTTP refetch | High | **Certain** | LED shows old purse during celebration | Sync |
| 6 | **`buildAuctionState` loads ALL players on every bid** — 100–500ms server latency | High | **Certain** | Cascading delay to all 55 SSE clients | Performance |
| 7 | **Operator `invalidate()` fires 4 GETs per action while SSE connected** — server load amplifier | High | **Certain** | Bid storms degrade all screens | Performance |
| 8 | **Redundant HTTP polling on all screens during SSE** — 248+ extra GETs/min | High | **Certain** | Wasted capacity; poll/SSE race flicker | Performance |
| 9 | **55 independent SSE connections per tournament** — no singleton | High | **Certain** | Server memory + reconnect storm risk | Scalability |
| 10 | **SSE reconnect: fixed 3s retry, no backoff** — 55 clients reconnect simultaneously | High | Medium | 5–15s recovery gap; state desync | Reliability |
| 11 | **Full JSON state snapshot per bid** — 15–80KB × 55 clients | High | **Certain** | 4G public viewers lag 0.5–1.5s | Sync |
| 12 | **UI "Undo" calls re-auction API, not undo API** — semantic mismatch | High | Medium | Operator expects bid rollback; gets re-auction | Correctness |
| 13 | **No mutation guard on sold/unsold buttons** — double-click possible | Medium | Medium | Confusion; error during live moment | UX |
| 14 | **OBS uses `listTeams` vs `team-purses`** — purse math may diverge from LED | Medium | Medium | Broadcast shows different purse than venue LED | Sync |
| 15 | **Break timer screen has no SSE** — 2s HTTP poll only | Medium | Low | Break countdown desync from main displays | Sync |
| 16 | **Fortune wheel reset POST on every operator page open** | Medium | **Certain** | Unexpected state mutation at auction start | Correctness |
| 17 | **Public viewer fetches unused `listCategories` + full player roster** | Medium | **Certain** | Slow load; wasted bandwidth at scale | Performance |
| 18 | **Operator keyboard shortcuts have stale closure risk** | Medium | Medium | Hotkey fails during rapid bidding | Reliability |
| 19 | **OBS sold timer no unmount cleanup** | Low | Low | Minor leak on OBS browser source refresh | Stability |
| 20 | **No `stateVersion` on SSE events** — theoretical stale overwrite on reconnect | Low | Low | Brief wrong state after network recovery | Sync |

---

## Risk Classification Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Sync | 1 | 4 | 2 | 1 |
| Correctness | 3 | 1 | 1 | 0 |
| Performance | 0 | 4 | 2 | 0 |
| Availability | 1 | 0 | 0 | 0 |
| Reliability | 0 | 1 | 1 | 1 |
| Scalability | 0 | 1 | 0 | 0 |
| UX | 0 | 0 | 1 | 0 |
| Stability | 0 | 0 | 0 | 1 |

---

## What's Working Well

1. **SSE → React Query `setQueryData`** — correct pattern for shared state across screens
2. **Server-side `buildAuctionState` with 500ms cache** — reduces DB hammering on reconnect bursts
3. **Bid debounce (150ms per team)** — prevents accidental double-bid POSTs
4. **Timer via `timerEndsAt` (client-derived)** — avoids per-second SSE flood
5. **`useAuctionSocket` cleanup** — proper EventSource teardown on unmount
6. **Structured `lastOutcome` in state** — authoritative sold/unsold between player transitions
7. **Cheer cooldown** — client + server protection on public viewer

---

## Critical Path to Production (Minimum Viable)

### Phase 1 — Before next live auction (1–2 days)

| # | Action | Fixes risk # |
|---|--------|-------------|
| 1 | Decouple 250ms countdown tick from `useLedView` full rebuild | 1 |
| 2 | Disable all `refetchInterval` when `connectionStatus === "connected"` | 7, 8 |
| 3 | Remove `invalidate()` after successful mutations when SSE connected | 7 |
| 4 | Block operator mutations when SSE disconnected | 4 |
| 5 | Add `isPending` guard on sold/unsold buttons | 13 |
| 6 | Add unmount cleanup for OBS sold timer | 19 |

**Predicted improvement:** Readiness 54 → **72**. LED bid lag: 550ms → **~200ms**.

### Phase 2 — Before high-viewer auction (3–5 days)

| # | Action | Fixes risk # |
|---|--------|-------------|
| 7 | Embed team purses in `auction_state` SSE payload | 5 |
| 8 | Operator tab session lock (one controlling tab) | 2 |
| 9 | Lazy-load public viewer player list | 3, 17 |
| 10 | Align OBS on `team-purses` endpoint | 14 |
| 11 | Exponential backoff on SSE reconnect | 10 |

**Predicted improvement:** Readiness 72 → **80**.

### Phase 3 — Scale hardening (1–2 weeks)

| # | Action | Fixes risk # |
|---|--------|-------------|
| 12 | Slim `buildAuctionState` hot path (no full player load on bid) | 6, 11 |
| 13 | SSE singleton per tournamentId | 9 |
| 14 | Delta `bid_placed` SSE event | 11 |
| 15 | Add `stateVersion` to SSE payloads | 20 |
| 16 | Wire true undo or rename UI to "Re-auction" | 12 |

**Predicted improvement:** Readiness 80 → **88**.

---

## Sync Latency vs Targets

| Event | Target | Current (LED worst) | Status |
|-------|--------|---------------------|--------|
| Bid | <200ms | 550ms | **FAIL** |
| Sold | <300ms | 700ms | **FAIL** |
| Player Load | <500ms | 600ms | Borderline |
| Screen gap | <100ms | 520ms | **FAIL** |

---

## Multi-Screen Load at a Glance

| Resource | Steady state (1 bid/sec, 55 clients) |
|----------|--------------------------------------|
| SSE writes | 55/sec |
| HTTP requests | ~9.5/sec (568/min) |
| `buildAuctionState` | 1/sec (+ cache hits) |
| LED `useLedView` rebuilds | 12/sec (3 LED screens × 4/sec) |

---

## Report Index

| Report | Path |
|--------|------|
| API Audit | `docs/performance-audit/API_AUDIT_REPORT.md` |
| WebSocket/SSE Audit | `docs/performance-audit/WEBSOCKET_AUDIT_REPORT.md` |
| Multi-Screen Load | `docs/performance-audit/MULTISCREEN_LOAD_REPORT.md` |
| React Performance | `docs/performance-audit/REACT_PERFORMANCE_REPORT.md` |
| Memory Leaks | `docs/performance-audit/MEMORY_LEAK_REPORT.md` |
| Auction Flow Stress | `docs/performance-audit/AUCTION_FLOW_STRESS_REPORT.md` |
| Production Failures | `docs/performance-audit/PRODUCTION_FAILURE_REPORT.md` |
| Real-Time Sync | `docs/performance-audit/REALTIME_SYNC_REPORT.md` |

---

## Final Recommendation

**Do not run a high-pressure live auction with real money/reputation at stake until Phase 1 is complete.** The operator panel is responsive enough; the audience-facing LED, Portrait, and purse displays are the liability. A 1–2 second visible delay on a ₹50L bid is not a cosmetic issue — it is a **business-critical synchronization defect** with a known root cause (`useLedView` 250ms tick + server state build + secondary purse refetch) and known fixes.

Prioritize synchronization speed and consistency above all cosmetic improvements.
