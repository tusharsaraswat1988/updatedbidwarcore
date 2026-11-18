# BIDWAR Fan Platform — System Architecture

## Entitlement Authority
- **Source of Truth:** PostgreSQL database is the only authoritative source. Redis is a cache.
- **Cache-Miss / Redis-Outage:** If Redis is down/miss, Fan API queries the PostgreSQL database directly, then repopulates Redis.
- **WebSocket Revalidation:**
  - Every 5 minutes, WebSocket servers perform a database re-check of active session entitlements. 
  - If authoritative validation fails, fail closed: terminate connection with `WS_CLOSE_CODE_AUTH_REVOKED`.
- **Immediate Revocation:**
  - Upon licence change, the Entitlement Service updates the DB, issues an `auth_invalidation` command to Redis (Pub/Sub), and sets an expiration flag in Redis for that `sessionId`. 
  - All nodes receiving the invalidation flag immediately terminate the corresponding WebSocket connection.
- **Migration Rollback Prerequisites:**
  - Before applying any rollback:
    1. Disable Fan API traffic (e.g., via Reverse Proxy/Load Balancer).
    2. Close all active WebSocket connections.
    3. Perform hard session invalidation in Redis.
- **Deployment Routing (`/fan/*`):**
  - Edge Router routes `/fan/*` to `fan.bidwar.in`.
  - Frontend assets at `fan.bidwar.in/_next/...` (Static/CDN).
  - API at `fan.bidwar.in/api/fan/...` (Reverse Proxy).
