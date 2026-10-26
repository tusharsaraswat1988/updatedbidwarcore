-- Tournament auction module enablement flag
-- Default true is strictly a backward-compatibility migration bridge for legacy rows.
-- New tournaments must explicitly persist selected modules.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS auction_enabled boolean NOT NULL DEFAULT true;
