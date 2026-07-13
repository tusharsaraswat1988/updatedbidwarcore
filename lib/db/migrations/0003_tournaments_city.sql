-- P0: tournaments.city — required by Drizzle schema (commit 691c181)
-- Missing column caused SELECT * FROM tournaments to 500 and Google OAuth to redirect google_failed.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
