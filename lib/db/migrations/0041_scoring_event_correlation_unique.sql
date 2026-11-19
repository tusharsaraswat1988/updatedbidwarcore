-- One correlation id can identify at most one event per match.
-- Null correlation ids (historical rows) stay allowed.

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_events_match_correlation
  ON scoring_events (match_id, correlation_id)
  WHERE correlation_id IS NOT NULL;
