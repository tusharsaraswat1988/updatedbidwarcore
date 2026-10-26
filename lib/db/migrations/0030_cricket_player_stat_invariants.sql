-- Cricket career statistics are projections of completed match scorecards.
-- This migration only adds constraints and a nullable attribution hint.
-- It does not recompute totals. After deploy, an organizer reconcile (or
-- rebuildCricketPlayerStatistics) rewrites cricket aggregates from the ledger.
-- Safe to retry: every statement is idempotent.

ALTER TABLE scoring_match_player_stats
  ADD COLUMN IF NOT EXISTS master_player_id text;

CREATE INDEX IF NOT EXISTS ix_scoring_mps_master_player_id
  ON scoring_match_player_stats (master_player_id);

-- Collapse duplicate cricket rows so the career unique index can be created.
-- The kept row is not a correct total when the duplicates were additive.
-- Reconciliation replaces it from the match ledger.
DELETE FROM player_statistics AS older
USING player_statistics AS newer
WHERE older.sport = 'cricket'
  AND newer.sport = 'cricket'
  AND older.player_id = newer.player_id
  AND older.tournament_id IS NOT DISTINCT FROM newer.tournament_id
  AND older.id < newer.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_cricket_career
  ON player_statistics (player_id)
  WHERE tournament_id IS NULL AND sport = 'cricket';
