-- Organiser trial-demo ownership. Reset deletes these markers' targets only.
-- Idempotent. Does not change existing tournament, team, or player rows.

CREATE TABLE IF NOT EXISTS auction_demo_sessions (
  id text PRIMARY KEY,
  tournament_id integer NOT NULL,
  organizer_id integer NOT NULL,
  status text NOT NULL DEFAULT 'loaded',
  settings_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reset_at timestamptz,
  reset_by text,
  CONSTRAINT chk_auction_demo_sessions_status CHECK (status IN ('loaded', 'resetting', 'reset'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_auction_demo_sessions_one_loaded
  ON auction_demo_sessions (tournament_id)
  WHERE status = 'loaded';

CREATE INDEX IF NOT EXISTS ix_auction_demo_sessions_tournament
  ON auction_demo_sessions (tournament_id);

CREATE TABLE IF NOT EXISTS auction_demo_owned_records (
  id serial PRIMARY KEY,
  demo_session_id text NOT NULL REFERENCES auction_demo_sessions(id) ON DELETE CASCADE,
  tournament_id integer NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_auction_demo_owned UNIQUE (demo_session_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS ix_auction_demo_owned_session
  ON auction_demo_owned_records (demo_session_id);

CREATE INDEX IF NOT EXISTS ix_auction_demo_owned_tournament
  ON auction_demo_owned_records (tournament_id);
