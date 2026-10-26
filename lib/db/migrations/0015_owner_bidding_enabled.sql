-- Tournament-wide owner bidding enable/disable control
-- Defaults to true for all existing and new tournaments.
-- Allows organizers to disable online owner bidding for paddle/placard auctions.

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS owner_bidding_enabled boolean NOT NULL DEFAULT true;
