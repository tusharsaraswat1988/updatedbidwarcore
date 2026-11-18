# BIDWAR Fan Platform — Revised Schema Proposal

## 1. Schema DDL (With Constraints)
```sql
-- 1. Fan Sessions Table
CREATE TABLE IF NOT EXISTS fan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    absolute_expiry_at TIMESTAMPTZ NOT NULL,
    idle_expiry_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version >= 1),
    -- Constraint: token_version must only increment atomically
    CONSTRAINT positive_token_version CHECK (token_version > 0),
    -- Constraint: is_revoked/revoked_at consistency
    CONSTRAINT revokation_consistency CHECK ((is_revoked = TRUE AND revoked_at IS NOT NULL) OR (is_revoked = FALSE AND revoked_at IS NULL))
);
...
-- Revocation Rule: Revocation is irreversible. Once `is_revoked` is set to TRUE, it cannot be updated to FALSE.
-- Implementation: Application layer logic must enforce this; DB constraint could optionally be added via trigger if strictly required for audit integrity.

-- 2. Tournament Entitlements Table (Authoritative)
CREATE TABLE IF NOT EXISTS tournament_entitlements (
    tournament_id INTEGER PRIMARY KEY REFERENCES tournaments(id) ON DELETE RESTRICT,
    entitlement_type TEXT NOT NULL CHECK (entitlement_type IN ('TRIAL', 'LICENSED')),
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Constraint: ensure version is positive
    CONSTRAINT positive_entitlement_version CHECK (version > 0)
);

-- 3. Session-Tournament Entitlement Cache
CREATE TABLE IF NOT EXISTS session_tournament_access (
    session_id UUID NOT NULL REFERENCES fan_sessions(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    last_verified_version INTEGER NOT NULL CHECK (last_verified_version > 0),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, tournament_id)
);
```

## 2. Validation & Lifecycle Logic
- **Session Expiry Rule:** Access is granted if `NOW() < absolute_expiry_at` AND `NOW() < idle_expiry_at`. 
  - `absolute_expiry_at`: Fixed timestamp (e.g., session creation + 24h).
  - `idle_expiry_at`: Sliding window based on `last_activity_at + idle_timeout` (e.g., 30m).
- **Atomic Increments:** Entitlement versions and token versions increment atomically via `UPDATE ... SET version = version + 1`.
- **Session-Tournament Entitlement Cache Validation:**
  - Upon API request: `IF last_verified_version != TournamentEntitlements.version THEN REVALIDATE`.
  - Refresh Algorithm: Query `TournamentEntitlements`, update `session_tournament_access`, and refresh `last_verified_version` to match exactly. If query fails (DB down), return 403 (Fail-Closed).
- **WebSocket 5m Heartbeat Validation:** 
  - Every 5 minutes, WebSocket servers perform a database re-check:
    - Check session: `is_revoked = FALSE`, `NOW() < absolute_expiry_at`, `NOW() < idle_expiry_at`.
    - Check entitlements: `db.entitlement_version == connection.version`.
  - If any check fails, fail closed: terminate connection with `WS_CLOSE_CODE_AUTH_REVOKED`.

## 4. Redis and PostgreSQL Storage Strategy
- **Authoritative Storage (PostgreSQL):** PostgreSQL holds all persistent session data, revocation state, and entitlement versions.
- **Cache Storage (Redis):** Redis stores transient session state for high-performance WebSocket access.
- **Redis Key Pattern:** `fan_session:{sessionId}`. Holds serialized session object + entitlement version map.
- **Rollback / Invalidation:**
  - Upon migration rollback, trigger global Redis purge: `SCAN 0 MATCH fan_session:* | xargs del`.
  - This forces all active connections to re-authenticate against authoritative PostgreSQL source.
