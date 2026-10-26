-- BidWar Migration 0034: Add custom_answers_json to players table
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "custom_answers_json" jsonb;
