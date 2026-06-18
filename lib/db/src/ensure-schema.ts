import type pg from "pg";

/**
 * Idempotent column/table ensures for production DBs that predate newer schema fields.
 * Drizzle SELECT * fails when a mapped column is missing — this runs before the API listens.
 */
export async function ensureCoreSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS enable_registration_payment boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_fee integer;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS upi_id text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_verification_method text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_collection_mode text NOT NULL DEFAULT 'manual_verification';
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS enable_registration_declaration boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_declaration_text text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_value_mode text NOT NULL DEFAULT 'system';
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_value_options text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_extension_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_extension_threshold_seconds integer NOT NULL DEFAULT 3;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_extension_seconds integer NOT NULL DEFAULT 5;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_heat_meter_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_fan_battle_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS local_mode_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token_expires_at timestamptz;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token_synced_at timestamptz;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token_last_mirror_at timestamptz;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS features_json jsonb;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_enabled boolean NOT NULL DEFAULT false;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_phase text NOT NULL DEFAULT 'disabled';
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_pin text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_settings_json jsonb;

    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent boolean NOT NULL DEFAULT false;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_method text;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_ip text;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS photo_url text;
  `);
}
