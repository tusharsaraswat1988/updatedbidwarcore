-- Cricket Broadcast Message Templates
-- Safe, additive migration.

CREATE TABLE IF NOT EXISTS cricket_broadcast_message_templates (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_cricket_broadcast_message_templates_tournament_id
  ON cricket_broadcast_message_templates (tournament_id);
