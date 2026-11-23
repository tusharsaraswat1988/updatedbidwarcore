-- BidWar Migration 0043: P0 Ingestion Integrity - auction duration tracking & superseded lifecycle safety
ALTER TABLE "auction_sessions" ADD COLUMN IF NOT EXISTS "current_player_started_at" timestamptz;
ALTER TABLE "auction_player_events" ADD COLUMN IF NOT EXISTS "is_superseded" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "ix_auction_player_events_superseded" ON "auction_player_events" ("tournament_id", "player_id", "is_superseded");
