-- P0.2 Standings enrichment — additive PF/PA/remaining (win% computed on read)

ALTER TABLE badminton_pair_standings
  ADD COLUMN IF NOT EXISTS points_for INTEGER NOT NULL DEFAULT 0;

ALTER TABLE badminton_pair_standings
  ADD COLUMN IF NOT EXISTS points_against INTEGER NOT NULL DEFAULT 0;

ALTER TABLE badminton_pair_standings
  ADD COLUMN IF NOT EXISTS matches_remaining SMALLINT NOT NULL DEFAULT 0;
