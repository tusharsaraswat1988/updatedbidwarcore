-- BidWar Migration 0038: Phase 2 WhatsApp Consent lifecycle, notice versioning, and scorer consent
-- Additive, backward-compatible migration. Preserves all historical records.

ALTER TABLE "wa_consent_events" ADD COLUMN IF NOT EXISTS "consent_scope" text;
ALTER TABLE "wa_consent_events" ADD COLUMN IF NOT EXISTS "source" text;

ALTER TABLE "scorer_accounts" ADD COLUMN IF NOT EXISTS "whatsapp_consent" boolean NOT NULL DEFAULT false;
ALTER TABLE "scorer_accounts" ADD COLUMN IF NOT EXISTS "whatsapp_consent_at" timestamp with time zone;
ALTER TABLE "scorer_accounts" ADD COLUMN IF NOT EXISTS "whatsapp_consent_method" text;
ALTER TABLE "scorer_accounts" ADD COLUMN IF NOT EXISTS "whatsapp_consent_ip" text;
