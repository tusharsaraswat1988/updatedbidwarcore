-- Migration: 0039_organizer_sessions.sql
-- Server-side session storage and revocation bridge for Organizer authentication.

CREATE TABLE IF NOT EXISTS organizer_sessions (
  id TEXT PRIMARY KEY,
  organizer_account_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
  session_scope TEXT NOT NULL DEFAULT 'account',
  token_hash TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_orgsess_account_id ON organizer_sessions (organizer_account_id);
CREATE INDEX IF NOT EXISTS ix_orgsess_member_id ON organizer_sessions (member_id);
CREATE INDEX IF NOT EXISTS ix_orgsess_tournament_id ON organizer_sessions (tournament_id);
CREATE INDEX IF NOT EXISTS ix_orgsess_lookup ON organizer_sessions (id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS ix_orgsess_token_hash ON organizer_sessions (token_hash);
