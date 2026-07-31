-- Sprint 1 / C3: tournament-scoped scorer assignments.
-- When a tournament has ≥1 row, only assigned scorers may lock/score that tournament.
-- Zero rows = legacy open access (compat until organizers assign scorers).

CREATE TABLE IF NOT EXISTS scorer_tournament_assignments (
  id SERIAL PRIMARY KEY,
  scorer_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scorer_tournament_assignment
  ON scorer_tournament_assignments (scorer_id, tournament_id);
CREATE INDEX IF NOT EXISTS ix_scorer_tournament_assignments_tournament
  ON scorer_tournament_assignments (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scorer_tournament_assignments_scorer
  ON scorer_tournament_assignments (scorer_id);

-- Toss recorded at match create/edit (schema drift fix — also Sprint 1 adjacent).
ALTER TABLE badminton_match_details
  ADD COLUMN IF NOT EXISTS pre_match_toss_json JSONB;
