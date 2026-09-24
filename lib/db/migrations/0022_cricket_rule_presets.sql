-- Cricket Rule Presets and Fixture/Match Presets Linkage (EPIC-Rule-Presets)
-- Safe, additive migration.

ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS rule_preset_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS rule_preset_id integer;

CREATE TABLE IF NOT EXISTS cricket_rule_presets (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  variant_id text NOT NULL DEFAULT 'cricket.box',
  rule_profile_id text NOT NULL DEFAULT 'cricket.box.corporate_standard',
  rule_profile_version text NOT NULL DEFAULT '1.0.0',
  rule_overrides_json jsonb,
  squad_rules_json jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_cricket_rule_presets_tournament_id
  ON cricket_rule_presets (tournament_id);
