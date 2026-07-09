# Render Autoscaling — Production Readiness Audit

**Date:** 2026-07-09  
**Scope:** Horizontal autoscaling on Render (1 instance → 2+ under load)  
**Method:** Static analysis of the live API and realtime stack — no code was modified for this audit  
**Verdict:** ❌ **Not safe for multiple instances** (as currently deployed)  
**Score:** **58 / 100**

---

## TL;DR

Auction **database correctness** is largely multi-instance safe (optimistic `revision` CAS + transactions). Live **SSE sync is not**, unless Redis is provisioned and healthy.

| Condition | Safe to autoscale? |
|-----------|-------------------|
| Auction only + healthy `REDIS_URL` | Conditionally yes (after ops hardening) |
| Auction without Redis | **No** — viewers desync |
| Scoring / badminton / admin SSE on 2+ instances | **No** — no cross-instance pub/sub |
| Current Render docs / env templates | **No** — still say single-process; `REDIS_URL` undocumented |

**Final answer:** ❌ Not safe for multiple instances

---

## Scorecard

| # | Section | Result | Points |
|---|---------|--------|--------|
| 1 | Server State | **FAIL** | 2/10 |
| 2 | SSE | **FAIL** | 3/10 |
| 3 | WebSockets | **PASS** | 8/8 |
| 4 | Auction Engine | **PASS** | 9/10 |
| 5 | Session / Auth | **PASS** | 9/9 |
| 6 | Background Jobs | **PASS** | 7/8 |
| 7 | Database | **PASS** | 8/9 |
| 8 | File Storage | **PASS** | 7/8 |
| 9 | Cache | **FAIL** | 2/8 |
| 10 | Real-time Updates | **FAIL** | 3/10 |
| 11 | Load Balancer Compatibility | **FAIL** | 2/5 |
| 12 | Deployment | **FAIL** | 1/5 |
| | **Total** | | **58/100** |

---

## 1. Server State — FAIL

### Evidence

Runtime data is stored in process memory across many modules:

| Store | File |
|-------|------|
| Auction SSE clients | `artifacts/api-server/src/lib/broadcast.ts` |
| Scoring SSE clients | `artifacts/api-server/src/lib/scoring-broadcast.ts` |
| Badminton SSE clients | `artifacts/api-server/src/lib/badminton-broadcast.ts` |
| Admin notification SSE | `artifacts/api-server/src/lib/admin-notifications/admin-notification-broadcast.ts` |
| Operator lock fallback | `artifacts/api-server/src/lib/operator-lock.ts` (`memoryLocks`) |
| Event version / buffer fallback | `artifacts/api-server/src/lib/auction-events.ts` (`localVersions`, `localBuffers`) |
| Auction state cache (500ms TTL) | `artifacts/api-server/src/routes/auction.ts` (`_stateCache`) |
| Build cache | `artifacts/api-server/src/lib/auction-state-build-cache.ts` |
| Cheer / fan battle | `auction.ts` (`cheerRateLimiter`, `fanBattleCounters`, `recentCheerTimestamps`) |
| Fortune wheel timers | `auction.ts` (`wheelSpinStopTimers`) |
| Login / captcha / verify-access | `login-attempt-guard.ts`, `captcha-challenge.ts`, `verify-access-guard.ts` |
| Rate limiters | `rate-limiters.ts` (express-rate-limit default MemoryStore) |
| Google Sheets debounce | `google-sheets-sync-queue.ts` |

### Why it fails

Instance A’s Maps/Sets/timers are invisible to instance B. Redis fallbacks are per-process when `REDIS_URL` is unset or Redis is marked unavailable.

### Users experience

- Stale or split live UI across screens
- Weaker brute-force / captcha protection (limits × N instances)
- Cheer counters and heat levels wrong or reset
- Fortune wheel may not auto-stop if another instance handled the spin POST

### Exact fix

1. Treat Redis as **mandatory** for multi-instance production.
2. Fail startup or health checks when `REDIS_URL` is set but Redis is unreachable — do not silently fall back to memory behind a load balancer.
3. Move rate-limits, login guards, captcha challenges, and verify-access lockouts to Redis (or accept diluted security).

---

## 2. SSE — FAIL

### How SSE is implemented

- Long-lived HTTP `text/event-stream` connections
- Connected clients stored in a local `Set` per process
- Auction path can fan out cross-instance via Redis pub/sub
- Scoring, badminton, and admin notification paths have **no** Redis layer

### Evidence

Local client registry (auction):

```10:16:artifacts/api-server/src/lib/broadcast.ts
const clients: Set<SseClient> = new Set();

export function addSseClient(tournamentId: number, res: Response): SseClient {
  const client: SseClient = { tournamentId, write: (frame) => res.write(frame) };
  clients.add(client);
```

Auction Redis publish + local fallback:

```118:149:artifacts/api-server/src/lib/auction-events.ts
export async function publishAuctionEvent(...) {
  // ...
  const redis = getRedisCommandClient();
  if (redis) {
    try {
      await redis.publish(PUBSUB_CHANNEL(tournamentId), serialized);
      return envelope;
    } catch (err) {
      markRedisUnavailable(err, "publishAuctionEvent");
    }
  }
  writeSseToLocalClients(tournamentId, version, envelope);
  return envelope;
}
```

Scoring — local only:

```8:30:artifacts/api-server/src/lib/scoring-broadcast.ts
const clients: Set<ScoringSseClient> = new Set();
// ...
export function broadcastScoringState(tournamentId: number, payload: object) {
  // only local clients
}
```

Settings broadcast bypasses Redis entirely:

```40:43:artifacts/api-server/src/lib/broadcast.ts
export function broadcastToTournament(tournamentId: number, payload: object) {
  writeSseToLocalClients(tournamentId, 0, payload as AuctionEventEnvelope);
}
```

### Why it fails

A bid/mutation on instance A does not reach SSE clients connected to instance B unless Redis pub/sub delivers the event. Scoring/badminton/admin never cross instances. `settings_changed` never uses Redis.

### Users experience

- Bid lands, but LED / OBS / Public Viewer / Owner panel on another instance stay frozen
- Live cricket/badminton scoreboards desync
- Admin notification bell does not update on all admin sessions
- Tournament settings changes do not push to all auction viewers

### Exact fix

1. Require Redis for auction multi-instance deploys.
2. Add Redis pub/sub (same pattern as `auction-events.ts`) for `scoring-broadcast.ts`, `badminton-broadcast.ts`, and admin notification SSE.
3. Route `settings_changed` through `publishAuctionEvent` instead of `broadcastToTournament`.

---

## 3. WebSockets — PASS

No WebSocket / Socket.IO server was found in `api-server`. Realtime is SSE over HTTP. There is no WebSocket sticky-session requirement.

---

## 4. Auction Engine — PASS

### Evidence

Bidding is DB-backed with optimistic concurrency on `auction_sessions.revision`:

```1663:1688:artifacts/api-server/src/routes/auction.ts
  // Optimistic concurrency: only commit if no other bid has mutated the session
  const committed = await db
    .update(auctionSessionsTable)
    .set({
      currentBid: amount,
      // ...
      revision: sql`COALESCE(revision, 0) + 1`,
    })
    .where(and(
      eq(auctionSessionsTable.tournamentId, tid),
      sql`COALESCE(${auctionSessionsTable.revision}, 0) = ${currentRevision}`,
    ))
```

- Concurrent losing bid returns `409` with `hint: "stale_bid"`
- Sell uses `db.transaction()` and bumps `revision`
- Purse updates use atomic SQL (`purse_used + amount`)

### Why it passes

Two instances can process bids safely at the database layer. Bid corruption from multi-instance routing is not the primary risk; **event delivery** is.

### Soft risks (not section fails)

- Per-instance `_stateCache` (500ms TTL) can serve briefly stale snapshots
- Sell confirmation uses expected bid fields (best-effort), not `SELECT … FOR UPDATE`

---

## 5. Session / Auth — PASS

### Evidence

- Stateless JWT cookies (`bidwar_auth`) — `artifacts/api-server/src/lib/jwt.ts`, `app.ts`
- Shared `SESSION_SECRET` verifies on any instance
- Owner sessions persisted in Postgres (`owner-session.ts` / `ownerSessionsTable`)
- No `express-session` MemoryStore in the production API path

Any instance can authenticate the same cookie. Auth works across instances.

---

## 6. Background Jobs — PASS

| Job | Starts on every instance? | Multi-instance safe? |
|-----|---------------------------|----------------------|
| Communication email worker | Yes | Yes — `FOR UPDATE SKIP LOCKED` |
| Creative render worker | Yes (disabled by default in prod) | Yes when enabled — same pattern |
| Consent blast scheduler | Yes (hourly) | Yes — unique index `(tournamentId, mobile, blastDate)` |
| Google Sheets debounce queue | Per-instance | Soft risk — redundant syncs |
| Neon keep-alive / memory diagnostics | Every instance | Soft — extra load only |

### Evidence

```51:64:artifacts/api-server/src/lib/communication/worker.ts
    WHERE id = (
      SELECT id FROM communication_jobs
      WHERE status = 'queued'
      ...
      FOR UPDATE SKIP LOCKED
    )
```

Consent dedupe: `lib/db/src/schema/comm.ts` — `uniqueIndex("uq_consent_blast_log")`.

Duplicate email/SMS blasts are prevented by DB locking / unique constraints. Sheets may sync twice (soft).

---

## 7. Database — PASS

- Shared Neon/Postgres via `DATABASE_URL`
- Auction mutations use transactions + revision CAS
- Soft risk: `lib/db/src/index.ts` pool `max: 10` × instance count vs Neon connection limits

Concurrent requests from multiple servers do not corrupt auction core state when revision/transaction paths are used.

---

## 8. File Storage — PASS

### Evidence

Uploads land in `/tmp/bidwar-uploads` then go to Cloudinary (`multer-disk-storage.ts`). Temp disk is request-local and fine for multi-instance.

### Soft risk

If `CREATIVE_RENDER_STORAGE=local`, rendered PNGs stay on one instance’s disk and are not readable from another. Prefer Cloudinary in production.

---

## 9. Cache — FAIL

### Evidence

Redis **is implemented**:

- `artifacts/api-server/src/lib/redis.ts` — ioredis command + subscriber clients
- `auction-events.ts` — versioning, event buffer, pub/sub
- `operator-lock.ts` — distributed operator lock
- Optional caches: `intelligence-cache.ts`, `tournament-insights/cache.ts`

But Redis is **optional** and falls back to memory:

```84:90:artifacts/api-server/src/lib/redis.ts
export function markRedisUnavailable(err: unknown, context: string): void {
  redisUnavailable = true;
  // ...
  logger.warn({ err, context }, "Redis operation failed — falling back to in-memory locks and SSE on this instance");
}
```

Ops gap:

- `REDIS_URL` is **missing** from `RENDER_ENV_VARS.md` and `.env.production.example`
- `DEPLOY.md` still documents single-process-only SSE

### Why it fails

Without a healthy Redis, versions, event buffers, operator locks, and SSE fan-out are per-instance. Multi-instance auction realtime breaks.

### Users experience

Same as SSE failure: screens desync; two operator tabs can both hold the lock.

### Exact fix

1. Provision Render Redis or Upstash; set `REDIS_URL`.
2. Document `REDIS_URL` as required for multi-instance in `RENDER_ENV_VARS.md` / `.env.production.example`.
3. Hard-fail (or mark unhealthy) when multi-instance mode requires Redis and it is down.

---

## 10. Real-time Updates — FAIL

| Surface | Synchronized across instances? |
|---------|--------------------------------|
| Operator Panel / Team Owner / LED / OBS / Public Viewer (auction) | **Only with healthy Redis** |
| Settings change push | **No** — `broadcastToTournament` is local-only |
| Cricket scoring | **No** |
| Badminton | **No** |
| Admin notifications | **No** |
| Cheer / fan battle counters | Split / incorrect heat levels |

### Users experience

One screen updates while another stays stuck; operator lock can be held on two tabs without Redis; settings changes do not push to all viewers.

### Exact fix

Same as sections 2 and 9: mandatory Redis for auction; pub/sub for scoring/badminton/admin; fix settings broadcast path.

---

## 11. Load Balancer Compatibility — FAIL

| Scenario | Sticky sessions required? |
|----------|---------------------------|
| Auction + healthy Redis | No (for event correctness) |
| Auction without Redis | Effectively yes — and still fragile |
| Scoring / badminton / admin SSE | Yes for correctness, or broken UX |
| Captcha challenge issue/verify | Yes — challenge Map is per-instance |
| Rate limits / login lockouts | Diluted across instances without Redis store |

Requests routed to different instances work for JWT auth and DB mutations, but fail for in-memory realtime and security guards.

### Exact fix

Do not rely on sticky sessions as the primary fix. Use Redis for shared realtime and security state. Sticky sessions alone do not fix auction without Redis when POST and SSE land on different instances.

---

## 12. Deployment — FAIL

### Evidence

`DEPLOY.md` still says:

> The SSE client registry (`broadcast.ts`) is stored in Node.js process memory. **Do not enable round-robin load balancing across multiple Node instances.** … Run **one process** on one server.

Additional gaps:

- No `render.yaml` in repo
- Health check is shallow: `GET /api/healthz` returns `{ status: "ok" }` only — no DB/Redis probe (`routes/health.ts`)
- Redis outage → silent in-memory fallback while Render LB still routes to 2+ instances
- Phase 3 docs (`docs/performance-audit/PHASE3_*.md`) claim multi-instance readiness, but deploy docs were never updated

### Why it fails

Turning on Render Autoscaling with current ops defaults will put a multi-instance LB in front of an app that still documents (and often runs as) single-process SSE.

### Exact fix

1. Update `DEPLOY.md` — remove outdated single-process-only guidance for auction when Redis is required.
2. Document `REDIS_URL` in Render env guides.
3. Extend `/api/healthz` to probe DB + Redis when multi-instance is enabled.
4. Optionally add `render.yaml` with Redis service + autoscaling notes.

---

## Recommended topology (after fixes)

```text
Render Load Balancer
        │
   ┌────┴────┐
   │         │
 API #1    API #2
   │         │
   └──┬── Redis (required)
      └── Neon Postgres (shared)
```

### Minimum for auction-only autoscaling

1. Render Web Service with autoscaling (2+ instances)
2. Managed Redis with `REDIS_URL`
3. Shared Neon Postgres
4. Hard dependency on Redis (no silent memory fallback in multi-instance prod)
5. Updated deploy/env docs

### Before enabling scoring on a scaled deploy

Extend pub/sub to `scoring-broadcast.ts` and `badminton-broadcast.ts` (and admin notification SSE if used).

---

## Must-fix checklist

### Before auction-only Autoscaling

- [ ] Provision Redis; set `REDIS_URL` on Render
- [ ] Fail startup/health if Redis required but unreachable
- [ ] Update `DEPLOY.md` + `RENDER_ENV_VARS.md` + `.env.production.example`
- [ ] Route `settings_changed` through Redis pub/sub
- [ ] Move rate-limit / login / captcha / verify-access to Redis (or accept weaker security)

### For full-platform Autoscaling

- [ ] Redis pub/sub for scoring SSE
- [ ] Redis pub/sub for badminton SSE
- [ ] Redis pub/sub for admin notification SSE
- [ ] Deeper `/healthz` (DB + Redis)
- [ ] Cap Neon pool size for N instances

---

## Related docs

| Document | Relevance |
|----------|-----------|
| `docs/performance-audit/PHASE3_IMPLEMENTATION_REPORT.md` | Claims high readiness with 2 servers + Redis |
| `docs/performance-audit/PHASE3_REDIS_LOCK.md` | Redis required for multi-instance operator lock |
| `docs/performance-audit/PHASE3_PUBSUB.md` | Auction pub/sub architecture |
| `docs/BIDWAR_AUCTION_PRODUCTION_READINESS_AUDIT.md` | Auction correctness (orthogonal to scaling) |
| `docs/multi-sport-architecture-review/06-streaming-audit.md` | Scoring horizontal scale FAIL |
| `DEPLOY.md` | Outdated single-process SSE warning |

---

## Final answer

**❌ Not safe for multiple instances**

Auction DB correctness is solid. Live sync and ops defaults are not. Enabling Render Autoscaling **without Redis** will desync Operator Panel, Team Owner Panel, LED Screen, OBS Overlay, and Public Viewer under load.
