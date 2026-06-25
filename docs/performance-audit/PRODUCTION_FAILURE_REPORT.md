# BidWar Production Failure Scenarios Report

**Audit Date:** 2026-06-15  
**Method:** Architectural simulation of failure modes during live auction  
**Screens:** Operator, Main LED, Portrait ×2, OBS, Public Live (50 viewers)

---

## Scenario A: Operator Internet Drops for 10 Seconds

### Current behavior
1. Operator SSE `onerror` fires → `connectionStatus: "reconnecting"`
2. Reconnect attempts every 3s (3 attempts in 10s)
3. After 5s continuous retry → `connectionStatus: "disconnected"`
4. Operator UI still functional for **clicks** — mutations are HTTP POST (may succeed if drop is SSE-only)
5. If full network drop: mutations fail silently or show error; optimistic bid may flash wrong state
6. 5s polls on bids/purses continue (if HTTP works intermittently)
7. On reconnect: SSE re-establishes; initial state push arrives; `visibilitychange` may also trigger refetch

### Expected behavior
- Operator sees clear "DISCONNECTED" banner
- Mutations queue or block with retry
- No optimistic updates when offline
- Auto-resync on reconnect without duplicate actions

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| Operator unaware of disconnect | **High** | `connectionStatus` shown but mutations still attempt |
| Optimistic bid while offline | **High** | Shows bid locally; server never received it |
| LED/OBS/public unaffected | Low | They have independent SSE connections |
| Missed state during gap | Medium | 10s gap: other screens continue; operator resyncs on reconnect |

### Fixes
1. Block mutations when `connectionStatus !== "connected"` with toast
2. Disable optimistic updates when disconnected
3. On reconnect: force `invalidate()` once (not per-action)
4. Show prominent disconnect banner on operator panel

---

## Scenario B: LED Screen Refreshes Mid-Auction

### Current behavior
1. Full page reload → all queries refetch from scratch
2. `TournamentCodeGate` may require code re-entry (if session not cached)
3. `useAuctionSocket` connects → server sends immediate full `auction_state`
4. `useLedView` loads: tournament, state, purses, **full players**, categories, bids
5. `useSoldAnimation` / outcome: may show current state correctly via `lastOutcome` in state
6. `useBroadcastAudio` may replay sold sound if outcome detection triggers
7. 10s polling starts immediately alongside SSE

### Expected behavior
- LED shows current player/bid within 1s of refresh
- No replay of old sold animation
- No audio replay of past events

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| 2–5s blank screen during query load | **Medium** | Multiple serial queries before `useLedView` renders |
| Sold sound replay | **Medium** | `useBroadcastAudio` outcome detection on mount |
| Code gate delay | **Medium** | Venue operator must re-enter code |
| Full player list load | **High** | Slow on large tournaments |

### Fixes
1. SSE-first render: show state from first SSE message before other queries complete
2. Suppress audio on mount (first 3s grace period)
3. Cache gate code in sessionStorage
4. Slim LED mount queries

---

## Scenario C: OBS Refreshes

### Current behavior
1. Page reload → SSE connect + 3 queries (state, tournament, teams)
2. `initialOutcomeSeenRef` skips first outcome on mount — **prevents replay of current sold animation**
3. Current player/bid shown from SSE state immediately
4. `soldTimerRef` from previous instance destroyed (page reload) — no leak
5. OBS uses `listTeams` not `team-purses` — purse values from team record

### Expected behavior
- Stream overlay shows live bid within 1s
- No sold animation flash for previous sale

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| Purse value inconsistency | **Medium** | `listTeams.purseUsed` vs `team-purses.purseRemaining` may differ in display |
| 1–2s overlay blank | Low | Fewer queries than LED |
| Missed sold animation if refresh during sold | Low | By design (initialOutcomeSeenRef) |

### Fixes
1. Align OBS on `useGetTeamPurses`
2. SSE-first skeleton UI

---

## Scenario D: Socket (SSE) Disconnects and Reconnects

### Current behavior (all screens independently)
1. `onerror` → close → retry 3s
2. `connectionStatus: reconnecting` → after 5s → `disconnected`
3. HTTP polling continues as fallback (10s/30s/5s depending on screen)
4. On reconnect: server sends full state immediately
5. Tab visibility → additional reconnect + `invalidateQueries`

### Expected behavior
- Screens auto-recover within 3–5s
- Polling fills gap if SSE down
- No duplicate state or flicker

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| 55 simultaneous reconnects (server restart) | **Critical** | 55× `buildAuctionState` burst |
| Polling + SSE dual updates cause flicker | Medium | Two sources updating same cache |
| 3s fixed retry storm | **High** | No backoff |
| Visibility reconnect on all tabs simultaneously | **High** | Auctioneer alt-tabs → burst |

### Fixes
1. Exponential backoff with jitter
2. Connection-aware polling (already recommended)
3. `stateVersion` to ignore stale reconnect payloads
4. SSE singleton per screen type

---

## Scenario E: 50 Public Viewers Open Together

### Current behavior
1. 50× SSE connections opened within seconds
2. 50× `GET /auction` + `GET /team-purses` + `GET /players` (full roster) + `GET /tournament` + `GET /categories` (unused)
3. Each SSE connect triggers server `buildAuctionState` + immediate push
4. Server 500ms state cache helps only within half-second window
5. After mount: 50× 30s polling = 100 GETs/min steady state

### Expected behavior
- All viewers see live state within 2–3s
- Server remains stable
- No DB connection exhaustion

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| DB connection pool exhaustion | **Critical** | 50× parallel `buildAuctionState` + player list queries |
| Server OOM from 50 SSE buffers | **High** | Full state JSON × 50 |
| Slow page load (>5s) | **High** | Full player list × 50 |
| 100 polls/min ongoing | Medium | Redundant with SSE |

### Fixes
1. Lazy-load player list on public viewer
2. CDN/cache for static tournament data
3. Rate-limit SSE connects per IP (burst allowance)
4. Disable polls when SSE connected
5. Slim public viewer initial payload

---

## Scenario F: Auctioneer Clicks Sold Twice

### Current behavior
1. First click: `POST /auction/sell` → success → player sold, session cleared
2. Second click: `POST /auction/sell` → server likely returns error (no `currentPlayerId`)
3. No client-side `isPending` guard on `handleSell`
4. If error: operator `invalidate()` not called (only in success path for sell — actually `handleSell` always calls invalidate after await)

```typescript
async function handleSell() { await sellPlayer.mutateAsync({ tournamentId }); invalidate(); }
```

If second click throws, `invalidate()` is skipped (async throw) — OK.

### Expected behavior
- Second click ignored or shows "no player on block"
- No duplicate sale record
- Screens show sold once

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| Double sale record | **Low** | Server guards on currentPlayerId |
| UI confusion (button still clickable) | Medium | No loading state on sold button |
| Error toast missing | Medium | Uncaught mutation error may be silent |

### Fixes
1. `disabled={sellPlayer.isPending || !state?.currentPlayer}` on sold button
2. Explicit error toast on sell failure

---

## Scenario G: Two Tabs Open for Operator

### Current behavior
1. Each tab: independent SSE connection, independent React Query cache (separate JS contexts)
2. Both tabs can issue mutations simultaneously
3. Both receive SSE updates independently
4. Last mutation wins on server
5. Mount effect: both tabs call `POST /auction/fortune-wheel` reset on first load

### Expected behavior
- Only one operator control surface active
- Second tab shows read-only or warning

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| Conflicting mutations | **Critical** | Two operators bid/sell from different tabs |
| Double fortune wheel reset | Medium | Both tabs fire mount reset |
| 2× SSE + 2× polling | Low | Operator resource waste |

### Fixes
1. `BroadcastChannel` tab leadership election
2. Server-side operator session lock (one active controller per tournament)
3. Second tab: read-only mode with banner
4. Remove fortune wheel mount reset or gate it

---

## Scenario H: Slow 4G Network

### Current behavior
1. SSE may stay connected (long-lived, low bandwidth) but with latency
2. HTTP mutations (bid/sell) take 1–5s on slow network
3. Optimistic bid shows instantly on operator; server confirms seconds later
4. LED receives SSE when server processes (not when operator clicks) — **LED may actually be ahead of operator confirm**
5. Full state SSE payloads (15–80KB) slow on 4G
6. Public viewer 50× full player list: very slow initial load

### Expected behavior
- Graceful degradation
- Clear loading states
- No data loss

### Risks
| Risk | Severity | Detail |
|------|----------|--------|
| Operator thinks bid registered; server rejects | **High** | Optimistic without timeout/revert |
| SSE payload too large for 4G | **High** | Delayed LED updates |
| Mutation timeout | Medium | No explicit timeout handling |
| Public viewer unusable | **High** | Full player list on slow network |

### Fixes
1. Optimistic update with 5s timeout → revert + error toast
2. Slim SSE payload
3. Mutation loading indicators on all action buttons
4. Progressive loading on public viewer

---

## Failure Scenario Summary Matrix

| Scenario | Current resilience | Business impact | Fix effort |
|----------|-------------------|-----------------|------------|
| A: Operator 10s drop | Partial | High — missed bids | Low |
| B: LED refresh | Adequate | Medium — brief blank | Medium |
| C: OBS refresh | Good | Low | Low |
| D: SSE disconnect | Partial | High — all screens | Medium |
| E: 50 viewers burst | **Poor** | Critical — server crash risk | Medium |
| F: Double sold | Good (server) | Low | Low |
| G: Two operator tabs | **Poor** | Critical — wrong player sold | Medium |
| H: Slow 4G | Partial | High — LED lag | Medium |

---

## Recommended Production Safeguards

1. **Operator disconnect guard** — block actions when SSE disconnected
2. **Operator session lock** — one controlling tab per tournament
3. **SSE payload diet** — reduce 4G and broadcast latency
4. **Public viewer lazy load** — protect against viewer bursts
5. **Reconnect backoff** — protect server during outages
6. **Sold button debounce** — `isPending` guard
7. **Health dashboard** — expose `getSseClientCount()` and `buildAuctionState` p99 to operator
