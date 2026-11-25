-- BidWar Migration 0045: Separate Auction Venue and Tournament Venue
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "auction_venue" text;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "tournament_venue" text;

-- Backfill tournament_venue from legacy venue for existing tournaments
UPDATE "tournaments"
SET "tournament_venue" = "venue"
WHERE "tournament_venue" IS NULL AND "venue" IS NOT NULL;
