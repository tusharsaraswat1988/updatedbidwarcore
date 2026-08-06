-- Platform EPIC-03…08 foundation (Competition / Team / Match / Fixture / Scheduling / Runtime).
-- Staging may already have these via ensure-schema auto-heal; production is validate-only
-- and refuses boot if they are missing (SCHEMA DRIFT REPORT).
--
-- Apply to Neon PRODUCTION (SQL Editor or psql) BEFORE redeploying Render.
-- Do NOT set SCHEMA_AUTO_HEAL=true on production.
--
-- Also re-asserts 0009/0011/0012 additives in case those files were never applied.

-- ─── EPIC-01 catalog bindings (0012) ─────────────────────────────────────────
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS variant_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS competition_type_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_profile_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_profile_version text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS presentation_profile_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS presentation_profile_version text;

-- ─── EPIC-03 Competition Working Configuration ───────────────────────────────
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_mode_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS team_formation_strategy_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS squad_rules_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS participant_constraints_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS business_stage_id text;

CREATE TABLE IF NOT EXISTS competition_configuration_history (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  payload_json jsonb NOT NULL,
  checksum text,
  frozen_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_competition_configuration_history_tournament_version
  ON competition_configuration_history (tournament_id, version);

-- ─── EPIC-04 Team ────────────────────────────────────────────────────────────
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type_id text DEFAULT 'competitive';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'tournament';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS theme_json jsonb;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'draft';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS configuration_locked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS team_configuration_history (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  payload_json jsonb NOT NULL,
  checksum text,
  frozen_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_team_configuration_history_team_version
  ON team_configuration_history (team_id, version);

-- ─── EPIC-05 Match ───────────────────────────────────────────────────────────
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS match_type_id text DEFAULT 'league';
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS surface text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'tournament';
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS branding_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'draft';
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS configuration_locked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS match_configuration_history (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id integer NOT NULL REFERENCES scoring_matches(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  payload_json jsonb NOT NULL,
  checksum text,
  frozen_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_configuration_history_match_version
  ON match_configuration_history (match_id, version);

-- ─── EPIC-06 Fixture ─────────────────────────────────────────────────────────
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS fixture_type_id text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'draft';
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS configuration_locked boolean NOT NULL DEFAULT false;

ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS fixture_type_id text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'draft';
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS configuration_locked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS fixture_configuration_history (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  fixture_key text NOT NULL,
  source text NOT NULL,
  source_id integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  payload_json jsonb NOT NULL,
  checksum text,
  frozen_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fixture_configuration_history_key_version
  ON fixture_configuration_history (fixture_key, version);

-- ─── EPIC-07 Scheduling ──────────────────────────────────────────────────────
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS scheduling_strategy_id text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS scheduling_lifecycle_status text DEFAULT 'draft';
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS scheduling_configuration_locked boolean NOT NULL DEFAULT false;

ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS scheduling_strategy_id text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS scheduling_lifecycle_status text DEFAULT 'draft';
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS scheduling_configuration_locked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS scheduling_configuration_history (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  scheduling_key text NOT NULL,
  source text NOT NULL,
  source_id integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  payload_json jsonb NOT NULL,
  checksum text,
  frozen_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_scheduling_configuration_history_key_version
  ON scheduling_configuration_history (scheduling_key, version);

-- ─── EPIC-08 Runtime Match ───────────────────────────────────────────────────
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS execution_phase text DEFAULT 'preparing';
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS current_runtime_version integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS runtime_prep_metadata_json jsonb;

CREATE TABLE IF NOT EXISTS runtime_match_history (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id integer NOT NULL REFERENCES scoring_matches(id) ON DELETE CASCADE,
  operation text NOT NULL,
  snapshot_version integer,
  execution_phase text,
  actor text,
  reason text,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_runtime_match_history_match_id
  ON runtime_match_history (match_id);
CREATE INDEX IF NOT EXISTS ix_runtime_match_history_match_created
  ON runtime_match_history (match_id, created_at);

-- ─── Badminton tournament engine (0009 / 0011) — re-assert ───────────────────
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS current_stage TEXT;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS ranking_rules_json JSONB;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS qualifiers_per_group SMALLINT;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS qualifier_mode TEXT;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS promoted_knockout_at TIMESTAMPTZ;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS promoted_knockout_draw_id INTEGER;

ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS qualifiers_count SMALLINT;

DO $$
BEGIN
  ALTER TABLE badminton_categories
    ADD CONSTRAINT badminton_categories_promoted_knockout_draw_id_fkey
    FOREIGN KEY (promoted_knockout_draw_id)
    REFERENCES badminton_draws(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Badminton standings enrichment (0010) — re-assert ───────────────────────
ALTER TABLE badminton_pair_standings
  ADD COLUMN IF NOT EXISTS points_for INTEGER NOT NULL DEFAULT 0;
ALTER TABLE badminton_pair_standings
  ADD COLUMN IF NOT EXISTS points_against INTEGER NOT NULL DEFAULT 0;
ALTER TABLE badminton_pair_standings
  ADD COLUMN IF NOT EXISTS matches_remaining SMALLINT NOT NULL DEFAULT 0;
