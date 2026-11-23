-- BidWar Migration 0044: Official Activation Timestamp for Tournaments
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "official_activated_at" timestamptz;
CREATE INDEX IF NOT EXISTS "ix_tournaments_official_activated_at" ON "tournaments" ("official_activated_at") WHERE "official_activated_at" IS NOT NULL;
