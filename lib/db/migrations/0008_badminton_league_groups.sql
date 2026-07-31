-- Badminton league groups + pair standings

CREATE TABLE IF NOT EXISTS badminton_groups (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bgrp_tournament_id ON badminton_groups (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bgrp_category_id ON badminton_groups (category_id);

CREATE TABLE IF NOT EXISTS badminton_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  seed SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bgm_group_id ON badminton_group_members (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bgm_group_team ON badminton_group_members (group_id, team_id);

CREATE TABLE IF NOT EXISTS badminton_pair_standings (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  registration_id INTEGER NOT NULL,
  group_id INTEGER,
  played SMALLINT NOT NULL DEFAULT 0,
  won SMALLINT NOT NULL DEFAULT 0,
  lost SMALLINT NOT NULL DEFAULT 0,
  margin_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bps_tournament_id ON badminton_pair_standings (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bps_category_id ON badminton_pair_standings (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bps_category_registration ON badminton_pair_standings (category_id, registration_id);
