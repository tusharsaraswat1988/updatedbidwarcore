-- Migration 0037: Universal Rules-Driven Tournament Engine for Badminton

CREATE TABLE IF NOT EXISTS badminton_rules_profiles (
  id serial PRIMARY KEY,
  tournament_id integer REFERENCES tournaments(id) ON DELETE CASCADE,
  profile_key text NOT NULL,
  name text NOT NULL,
  description text,
  profile_type text NOT NULL DEFAULT 'custom',
  schema_version text NOT NULL DEFAULT '1.0.0',
  profile_version text NOT NULL DEFAULT '1.0.0',
  rules_source text,
  rules_source_effective_date text,
  is_official_bwf boolean NOT NULL DEFAULT false,
  is_template boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_brp_tournament_id ON badminton_rules_profiles (tournament_id);
CREATE INDEX IF NOT EXISTS ix_brp_profile_key ON badminton_rules_profiles (profile_key);

ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS rules_profile_id integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS rules_snapshot_json jsonb;
CREATE INDEX IF NOT EXISTS ix_bcat_rules_profile_id ON badminton_categories (rules_profile_id);
