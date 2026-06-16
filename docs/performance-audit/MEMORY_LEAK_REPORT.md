# BidWar Memory Leak Audit Report

**Audit Date:** 2026-06-15  
**Scope:** All six auction screens + shared hooks  
**Method:** Static analysis of `setInterval`, `setTimeout`, `requestAnimationFrame`, `addEventListener`, `EventSource`, and React effect cleanups

---

## Summary

| Verdict | Count |
|---------|-------|
| Properly cleaned | 12 |
| Partial / risk | 4 |
| Confirmed leak risk | 2 |
| Server-side (process lifetime) | 2 |

The primary auction realtime hook (`useAuctionSocket`) has **exemplary cleanup**. Risks concentrate in OBS sold animation timer and scattered `setTimeout` calls in `liveviewer.tsx`.

---

## Audit Matrix

### EventSource (SSE)

| Location | Resource | Created | Cleanup | Verdict |
|----------|----------|---------|---------|---------|
| `use-auction-socket.ts:68–149` | `EventSource` | Per hook instance | `destroyed=true`, `current.close()`, timers cleared, `visibilitychange` removed | **OK** |
| `use-scoring-socket.ts` | `EventSource` | Per hook | Same pattern | **OK** |
| `use-badminton-match.ts` | `EventSource` | Per match | `es.close()` on unmount only | **Partial** — no `destroyed` guard; stale handler possible during fast remount |

---

### setInterval

| Location | Interval | Purpose | Cleanup | Verdict |
|----------|----------|---------|---------|---------|
| `use-led-view.ts:237` | 250ms | Countdown `now` state | `clearInterval` in effect return | **OK** — but causes perf issue (see React audit) |
| `server-countdown.tsx` | 250ms | Display countdown | `clearInterval` | **OK** |
| `auction-operator.tsx` CountdownClock | 500ms | Operator timer display | `clearInterval` | **OK** |
| `auction-operator.tsx` CircularTimer | 250ms | Circular timer | `clearInterval` | **OK** |
| `use-broadcast-audio.ts` | 100ms | Audio tick polling | Cleared in effect cleanup + `mgr.dispose()` | **OK** |
| `display` sponsor carousel | animation | UI rotation | Component-level cleanup | **OK** |
| `auction.ts:705` (server) | 5 min | Cache metrics logging | **Never cleared** | **Server process lifetime** — acceptable |

---

### setTimeout

| Location | Purpose | Cleanup on Unmount | Verdict |
|----------|---------|-------------------|---------|
| `use-auction-socket.ts:58,123` | Disconnected escalation, reconnect retry | `clearTimeout` in cleanup | **OK** |
| `use-sold-animation.ts` | Sold overlay duration | `clearTimeout` L164–167 | **OK** |
| `use-timer-expired.ts` | Timer expiry callback | `clearTimeout` | **OK** |
| `obs-overlay.tsx:272` | 7s sold snap hide | **NO unmount cleanup** | **LEAK RISK** |
| `liveviewer.tsx` (multiple) | Cheer fade, sound delays, UI transitions | Partial — not all paths cleaned | **Low risk** |
| `auction.ts:50–79` (server) | Fortune wheel auto-stop | Rescheduled per tournament | **OK** for normal ops |

---

### requestAnimationFrame

| Location | Purpose | Cleanup | Verdict |
|----------|---------|---------|---------|
| `EffectsLayer.tsx:843–861` | Visual effects animation | `cancelAnimationFrame` in effect cleanup | **OK** |

---

### addEventListener

| Location | Event | Cleanup | Verdict |
|----------|-------|---------|---------|
| `use-auction-socket.ts:140` | `visibilitychange` | `removeEventListener` in cleanup | **OK** |
| `use-broadcast-audio.ts` | `click`, `keydown` (audio unlock) | Removed on unmount | **OK** |
| `auction-operator.tsx:255` | `mousedown` (filter dropdown) | Removed in cleanup | **OK** |
| `auction-operator.tsx:617+` | `keydown` (hotkeys) | `removeEventListener` in cleanup | **OK** |
| `display.tsx` | `BroadcastChannel` message | `removeEventListener` + `ch.close()` | **OK** |
| `liveviewer.tsx` `useSoundEngine` | Audio context events | Cleaned L127–136 | **OK** |

---

### BroadcastChannel

| Location | Channel | Cleanup | Verdict |
|----------|---------|---------|---------|
| `display.tsx` | `bidwar_display_theme` | `removeEventListener` + `close()` | **OK** |

---

## Confirmed Leak Risks

### ML-1 — OBS Sold Timer (Medium)

**File:** `src/pages/obs-overlay.tsx:220, 270–273`

```typescript
const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
// ...
soldTimerRef.current = setTimeout(() => setShowSold(false), 7000);
```

- Timer cleared when **new** outcome arrives
- **Not cleared on component unmount**
- If OBS browser source refreshes mid-animation, old timer may fire on unmounted state (React 18 strict mode may warn)

**Fix:**
```typescript
useEffect(() => () => {
  if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
}, []);
```

---

### ML-2 — Live Viewer Scattered Timeouts (Low)

**File:** `src/pages/liveviewer.tsx`

Multiple `setTimeout` calls for cheer animations, sound sequencing, and UI state without centralized cleanup ref.

**Risk:** Low in practice (short durations, page typically stays open). Under OBS-style refresh, minor stale closure updates possible.

**Fix:** Track timeout IDs in a ref array; clear all on unmount.

---

## SSE Connection Leak Analysis

### Per-screen connections (not leaks — by design)

Each mounted screen opens one `EventSource`. On unmount, cleanup runs. **No leak** if navigation/unmount works correctly.

### Failure mode: SPA soft navigation

If routes unmount correctly (wouter `Route` unmount), cleanup fires. **Verified:** effect return in `use-auction-socket.ts` handles this.

### Failure mode: Browser tab crash / force-close

Server-side: `req.on("close")` removes client from `clients` Set. **OK.**

### Failure mode: Zombie SSE on server

`broadcast.ts:26–28` removes client on `res.write` failure. **OK.**

---

## React Query Cache Growth

| Query | Growth Pattern | Risk |
|-------|----------------|------|
| `listPlayers` | Stable size per tournament | Low |
| `listBids` | Grows with each sold player | Low–medium over 3hr auction |
| `getAuctionState` | Single object, overwritten | None |
| Cheer messages (local state) | Sliced to 10 in liveviewer | **OK** |

No unbounded in-memory cache leak detected. React Query `gcTime` defaults will evict unused queries.

---

## Map/Ref Accumulation

| Location | Structure | Growth | Verdict |
|----------|-----------|--------|---------|
| `auction-operator.tsx` `bidDebounce` | `Map<teamId, timestamp>` | Bounded by team count | **OK** |
| Server `clients` Set | SSE clients | Bounded by active connections | **OK** |
| Server `_stateCache` Map | Per tournamentId | One entry per active tournament | **OK** |
| Server `wheelSpinStopTimers` Map | Per tournamentId | Cleared on reschedule | **OK** |

---

## Multi-Screen Simultaneous Open

With 6 screens open, each maintains:
- 1 EventSource (cleaned on tab close)
- 1–3 setInterval (LED view, countdown, audio)
- 0–N setTimeout (transient)

**Total intervals across 6 screens:** ~8–12 concurrent — **acceptable**.

**Total SSE connections:** 6 — each independently cleaned. Not a memory leak; a **resource multiplication** issue (see WebSocket audit).

---

## Recommendations

| Priority | Fix | File |
|----------|-----|------|
| P1 | Add unmount cleanup for `soldTimerRef` | `obs-overlay.tsx` |
| P2 | Centralize liveviewer timeout cleanup | `liveviewer.tsx` |
| P3 | Add `destroyed` guard to badminton SSE hook | `use-badminton-match.ts` |
| P4 | SSE singleton reduces connection count (not leak, but resource) | `use-auction-socket.ts` |

---

## Verification Steps

1. Open OBS overlay → trigger sold → immediately navigate away → check console for React state-on-unmounted warnings
2. Chrome DevTools Memory → heap snapshot before/after 1hr auction with 6 tabs — compare `EventSource`, `Timer` counts
3. Server: monitor `getTotalSseClientCount()` during connect/disconnect cycles — should return to 0 when all clients close
