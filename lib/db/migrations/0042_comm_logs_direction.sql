-- BidWar Migration 0042: Add direction column to comm_logs for Inbound vs Outbound separation
-- Additive, backward-compatible migration. Preserves and backfills all historical records.

ALTER TABLE "comm_logs" ADD COLUMN IF NOT EXISTS "direction" text NOT NULL DEFAULT 'outbound';
CREATE INDEX IF NOT EXISTS "ix_comm_logs_direction" ON "comm_logs" ("direction");

-- Backfill historical inbound messages recorded by conversation-router
UPDATE "comm_logs" SET "direction" = 'inbound' WHERE "blast_id" LIKE 'inbound_%' OR "meta_message_id" LIKE 'inbound_%';


-- Backfill existing inbound records previously logged with inbound blast IDs
UPDATE "comm_logs" SET "direction" = 'inbound' WHERE "blast_id" LIKE 'inbound_%';

