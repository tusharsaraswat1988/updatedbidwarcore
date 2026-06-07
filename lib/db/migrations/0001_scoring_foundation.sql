-- BidWar Scoring Module PR-1: foundation schema
-- Apply via: pnpm --filter @workspace/db run push
-- Or run this SQL manually against PostgreSQL.

-- Tournament scoring fields
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_phase TEXT NOT NULL DEFAULT 'disabled';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_pin TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_settings_json JSONB;

-- Optional fixture container (Flow B)
CREATE TABLE IF NOT EXISTS scoring_fixtures (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  sport_slug TEXT NOT NULL DEFAULT 'cricket',
  fixture_number INTEGER,
  round_name TEXT,
  scheduled_at TIMESTAMPTZ,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  format_json JSONB,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  winner_team_id INTEGER,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_tournament_id ON scoring_fixtures (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_tournament_status ON scoring_fixtures (tournament_id, status);

-- Playable match unit (Flow A: fixture_id NULL; Flow B: fixture_id set)
CREATE TABLE IF NOT EXISTS scoring_matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  fixture_id INTEGER,
  sport_slug TEXT NOT NULL DEFAULT 'cricket',
  match_kind TEXT NOT NULL DEFAULT 'team_match',
  parent_match_id INTEGER,
  sequence_in_parent INTEGER,
  match_label TEXT,
  round_name TEXT,
  scheduled_at TIMESTAMPTZ,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  home_side_json JSONB,
  away_side_json JSONB,
  rules_json JSONB,
  winner_team_id INTEGER,
  result_summary TEXT,
  summary_json JSONB,
  current_projection_version BIGINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_scoring_matches_tournament_id ON scoring_matches (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_matches_fixture_id ON scoring_matches (fixture_id);
CREATE INDEX IF NOT EXISTS ix_scoring_matches_tournament_status ON scoring_matches (tournament_id, status);

-- Live projection (derived from scoring_events)
CREATE TABLE IF NOT EXISTS scoring_sessions (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  state_json JSONB,
  display_overlay TEXT,
  display_overlay_json JSONB,
  last_event_seq BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_sessions_match_id ON scoring_sessions (match_id);

-- Append-only event store (source of truth)
CREATE TABLE IF NOT EXISTS scoring_events (
  id BIGSERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  fixture_id INTEGER,
  sport_slug TEXT NOT NULL DEFAULT 'cricket',
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  sequence BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  correlation_id UUID,
  causation_id BIGINT,
  payload_json JSONB NOT NULL,
  metadata_json JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_events_match_sequence ON scoring_events (match_id, sequence);
CREATE INDEX IF NOT EXISTS ix_scoring_events_match_id ON scoring_events (match_id);
CREATE INDEX IF NOT EXISTS ix_scoring_events_tournament_id ON scoring_events (tournament_id);

-- Standings projection
CREATE TABLE IF NOT EXISTS scoring_standings (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  tied INTEGER NOT NULL DEFAULT 0,
  no_result INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  net_run_rate NUMERIC,
  extras_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_team ON scoring_standings (tournament_id, team_id);
CREATE INDEX IF NOT EXISTS ix_scoring_standings_tournament_id ON scoring_standings (tournament_id);
