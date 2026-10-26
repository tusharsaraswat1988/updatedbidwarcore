-- Scoring-only public player registration + team coach/mentor.
-- Additive and backward compatible: existing tournaments stay on auction registration.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS player_registration_mode text NOT NULL DEFAULT 'auction';

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS registration_category_mode text NOT NULL DEFAULT 'hidden';

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS coach_name text;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS coach_mobile text;
