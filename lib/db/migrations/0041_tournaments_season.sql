-- P0: tournaments.season — optional season / edition / year metadata
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS season text;
