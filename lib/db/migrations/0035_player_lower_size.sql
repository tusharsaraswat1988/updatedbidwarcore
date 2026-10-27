-- BidWar Migration 0035: Add lower_size to players table
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "lower_size" text;
