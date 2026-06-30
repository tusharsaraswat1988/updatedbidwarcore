-- Verified push subscriptions + owner sessions
-- Apply via: pnpm --filter @workspace/db run push
-- Or run this SQL manually against PostgreSQL.

-- One-time legacy cleanup: remove all pre-verification push subscriptions.
DELETE FROM push_subscriptions;

CREATE TABLE IF NOT EXISTS owner_sessions (
  id TEXT PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_owner_sessions_tournament_team
  ON owner_sessions (tournament_id, team_id);
CREATE INDEX IF NOT EXISTS ix_owner_sessions_expires_at
  ON owner_sessions (expires_at);

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS owner_session_id TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_push_subscriptions_tournament_id
  ON push_subscriptions (tournament_id);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_owner_session_id
  ON push_subscriptions (owner_session_id);
