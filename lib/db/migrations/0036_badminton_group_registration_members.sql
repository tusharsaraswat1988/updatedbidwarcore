-- Migration 0036: Add registration_id to badminton_group_members and allow nullable team_id for sports-only tournaments

ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS registration_id INTEGER;

ALTER TABLE badminton_group_members ALTER COLUMN team_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_bgm_registration_id ON badminton_group_members (registration_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bgm_group_registration ON badminton_group_members (group_id, registration_id) WHERE registration_id IS NOT NULL;
