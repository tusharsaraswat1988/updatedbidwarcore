# Streaming & Broadcast Audit

**Transport:** Server-Sent Events (SSE) only — no WebSocket in either implementation  
**Deployment:** Single Express process, in-memory client registries

---

## SSE Architecture Inventory

| Module | File | Scope | Endpoint |
|--------|------|-------|----------|
| Auction | `lib/broadcast.ts` | Tournament | `GET /api/tournaments/:tid/auction/events` |
| Cricket scoring | `lib/scoring-broadcast.ts` | Tournament | `GET /api/tournaments/:tid/scoring/events` |
| Badminton | `lib/badminton-broadcast.ts` (branch) | Tournament + Match | `GET /api/tournaments/:tid/badminton/stream?matchId=` |

### Common mechanics — **PASS**

- `Set` of `{ res, tournamentId [, matchId] }` clients
- `res.write('data: {...}\n\n')`
- Heartbeat comments (`: heartbeat`) on cricket/auction streams
- Compression disabled for `text/event-stream` in `app.ts`
- Client hooks auto-reconnect (~3s backoff)

### Divergence — **WARNING**

| Aspect | Auction | Cricket | Badminton |
|--------|---------|---------|-----------|
| Client key | `tournamentId` | `tournamentId` | `tournamentId` OR `matchId` |
| Payload envelope | Raw auction state | Scoring state object | `{ type, data }` wrapper |
| Match-level filter | No | No | **Yes** |
| Tournament-wide fanout | Yes | Yes | Yes |

**Evidence:** Badminton `broadcastBadmintonMatchUpdate` fans out to clients where `client.matchId === matchId || client.tournamentId === tournamentId`.

---

## Client Hooks

| Hook | Sport | Pattern | Rating |
|------|-------|---------|--------|
| `use-auction-socket.ts` | Auction | EventSource + React Query invalidation | **PASS** |
| `use-scoring-socket.ts` | Cricket | EventSource + cache invalidation | **PASS** |
| `use-badminton-match.ts` | Badminton | EventSource embedded in hook | **PASS** |

Badminton combines REST polling (React Query) + SSE in one hook — reasonable pattern.

---

## Live Display Screens

### Cricket — `pages/score-display.tsx` + `score-display-shell.tsx`

| Feature | Rating |
|---------|--------|
| Full-screen LED scoreboard | **PASS** |
| Innings, overs, wickets, run rate | **FAIL** (cricket-only) |
| SSE via `use-scoring-socket` | **PASS** |
| `BroadcastChannel` theme sync | **PASS** |
| Sponsor/logo slots | **PASS** |

### Badminton — `broadcast-display.tsx` (branch)

| Feature | Rating |
|---------|--------|
| Game scores, serving indicator | **PASS** |
| Multi-game display | **PASS** |
| Match-scoped SSE | **PASS** (better granularity) |
| Court/venue labels | **PASS** |

### Auction — `pages/display.tsx`

Independent broadcast system for auction state. Rich overlay system (banners, player cards, fortune wheel). **PASS** as auction module.

---

## OBS / Overlay Layer

| Overlay | Sport | Variants | Rating |
|---------|-------|----------|--------|
| `obs-overlay.tsx` | Auction | Single overlay | **PASS** (auction) |
| `obs-overlays.tsx` | Badminton | compact, full, intro, winner, sponsor | **PASS** (badminton) |
| Cricket OBS scoring | None dedicated | Uses `score-display` | **WARNING** |

**Gap:** No shared overlay framework. Each sport builds OBS layouts independently.

---

## Public Scoreboards & Score Feeds

| Consumer | Cricket | Badminton | Rating |
|----------|---------|-----------|--------|
| Public LED | `/tournament/:id/score-display` | `/badminton/:matchId/display` | **WARNING** (different URL shapes) |
| Public API | `GET /scoring/live` | `GET /badminton/matches/:id` | **WARNING** |
| JSON score feed | Embedded in SSE | SSE `match_state` | **PASS** |
| Third-party integration | No dedicated webhook | No webhook | **WARNING** |

---

## Multi-Sport Support Without Redesign?

### Cricket — **PASS**

Current architecture supports cricket today.

### Badminton — **PASS**

Branch proves SSE + displays work for badminton without changing auction or cricket streams.

### Tennis — **WARNING**

Could reuse badminton pattern (point/game based, match-scoped SSE) with new components. Would add **4th SSE pool** without consolidation.

### Football — **FAIL**

Clock-based state, period/half transitions, variable stoppage time — cricket/badminton SSE payloads and display components insufficient. Needs:
- Clock sync broadcasts
- Period state in overlay
- Potentially higher-frequency updates

### Volleyball — **WARNING**

Similar to badminton (rally points, sets). Could fork badminton display with configuration.

---

## Bottlenecks & Future Limitations

| Bottleneck | Severity | Description |
|------------|----------|-------------|
| In-memory SSE registries | **High** | No horizontal scaling; multi-instance Render deploys won't fan-out |
| No Redis/pub-sub | **High** | Required before multi-node production |
| Per-sport broadcast files | **Medium** | N sports = N nearly identical modules |
| Tournament-only cricket SSE | **Medium** | Venue with 4 cricket matches gets all updates |
| No WebSocket | **Low** | SSE adequate for scoreboards; bidirectional not needed yet |
| Payload format inconsistency | **Medium** | Badminton wraps `{type,data}`; cricket sends raw state |
| No overlay priority/channel | **Low** | Multiple overlay types managed in sport-specific code |

---

## Ratings by Area

| Area | Rating | Notes |
|------|--------|-------|
| SSE transport choice | **PASS** | Appropriate for scoreboards |
| Auction broadcast | **PASS** | Mature |
| Cricket broadcast | **PASS** | Works; tournament-granularity limit |
| Badminton broadcast | **PASS** | Match granularity is improvement |
| Unified broadcast layer | **FAIL** | Three separate pools |
| OBS overlays | **WARNING** | Duplicated per sport |
| Public displays | **WARNING** | Inconsistent URL conventions |
| Horizontal scale | **FAIL** | Single-process assumption |
| Football readiness | **FAIL** | Needs clock/period model |
| Tennis readiness | **WARNING** | Mostly config + new UI |
| Volleyball readiness | **WARNING** | Badminton-like |

---

## Minimum Consolidation (P1, not P0)

Single broadcast module:

```typescript
// Conceptual design
type StreamChannel = 'auction' | 'scoring';
type StreamClient = { tournamentId, matchId?, sportSlug?, res };

function broadcast(opts: { tournamentId, matchId?, sportSlug?, payload })
```

Keep separate endpoints for backward compatibility; share client registry internally.

---

## Recommendations

| Priority | Action |
|----------|--------|
| P0 | Standardize SSE payload envelope: `{ type, sport, matchId, data }` |
| P1 | Merge broadcast registries into one module |
| P1 | Add match-scoped cricket SSE (copy badminton pattern) |
| P2 | Redis pub/sub before scaling Render instances |
| P2 | Shared `OverlayShell` component (sponsors, logos, connection status) |
| Defer | WebSocket migration |
| Defer | Webhook score feeds for broadcast partners |
