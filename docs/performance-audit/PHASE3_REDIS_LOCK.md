# Phase 3 — Redis Operator Lock

## Problem

Phase 1 operator lock used an in-memory `Map`. With multiple app servers, Server A and Server B could each grant controller status — lock bypass.

## Solution

Distributed lock in Redis key `auction:lock:{tournamentId}`.

### Stored value (JSON)

```json
{
  "sessionId": "<tabId from client>",
  "ownerId": "org:42 | admin | organizer",
  "timestamp": 1718450000000
}
```

### TTL

- **8 seconds** — refreshed on every heartbeat (client sends every 2s)
- Auto-expires if tab crashes or network drops

## Implementation

| File | Role |
|------|------|
| `api-server/src/lib/redis.ts` | ioredis clients (command + subscriber) |
| `api-server/src/lib/operator-lock.ts` | acquire / heartbeat / release / getHolder |
| `api-server/src/routes/auction.ts` | Routes pass `ownerId` from JWT |

### Redis operations

| Action | Logic |
|--------|-------|
| **Acquire** | `SET key payload NX EX 8` — or reclaim if expired |
| **Renew** | `SET key payload EX 8` if sessionId matches |
| **Release** | `DEL key` if sessionId matches |
| **Recovery** | TTL expiry → any tab can acquire |

### Fallback

When `REDIS_URL` is unset (local dev), in-memory Map behavior is preserved.

## Survives

| Event | Behavior |
|-------|----------|
| Process restart | Lock expires in ≤8s; heartbeat re-acquires |
| Deployment rolling | Same — TTL-based recovery |
| Failover | Redis persistence/replication dependent on Redis deployment |

## Configuration

```env
REDIS_URL=redis://user:pass@host:6379
```

Optional in development; **required for multi-instance production**.
