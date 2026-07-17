-- Scorer module (added 2026-07-14 with badminton live ops).
-- Staging auto-heal created these via ensure-schema System D; production is
-- validate-only and refuses boot if they are missing.
-- Apply to Neon PRODUCTION (SQL Editor or psql) BEFORE redeploying Render.
--
-- Also re-asserts 0003/0004 additives in case those files were never applied.

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS scorer_pin TEXT;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS scorer_name TEXT;

CREATE TABLE IF NOT EXISTS scorer_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scorer_accounts_mobile ON scorer_accounts (mobile);

CREATE TABLE IF NOT EXISTS scorer_sessions (
  id TEXT PRIMARY KEY,
  scorer_id INTEGER NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_scorer_sessions_scorer_id ON scorer_sessions (scorer_id);
CREATE INDEX IF NOT EXISTS ix_scorer_sessions_expires_at ON scorer_sessions (expires_at);

CREATE TABLE IF NOT EXISTS scorer_match_locks (
  match_id INTEGER PRIMARY KEY,
  scorer_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_session_id ON scorer_match_locks (session_id);
CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_last_heartbeat ON scorer_match_locks (last_heartbeat_at);

CREATE TABLE IF NOT EXISTS scorer_audit_log (
  id SERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  scorer_id INTEGER,
  session_id TEXT,
  tournament_id INTEGER,
  match_id INTEGER,
  sport TEXT,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_match_id ON scorer_audit_log (match_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_tournament_id ON scorer_audit_log (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_scorer_id ON scorer_audit_log (scorer_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_created_at ON scorer_audit_log (created_at);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_action ON scorer_audit_log (action);
