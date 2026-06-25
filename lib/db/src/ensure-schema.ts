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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS branding_assets (
      id SERIAL PRIMARY KEY,
      asset_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS branding_assets_asset_type_active_idx
      ON branding_assets (asset_type);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS intelligence_archives (
      id SERIAL PRIMARY KEY,
      source_tournament_id INTEGER NOT NULL,
      tournament_name TEXT NOT NULL,
      tournament_sport TEXT NOT NULL DEFAULT 'cricket',
      organizer_id INTEGER,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      bid_event_count INTEGER NOT NULL DEFAULT 0,
      player_event_count INTEGER NOT NULL DEFAULT 0,
      timer_event_count INTEGER NOT NULL DEFAULT 0,
      metadata_json JSONB
    );
    CREATE TABLE IF NOT EXISTS intelligence_archive_bid_events (
      id SERIAL PRIMARY KEY,
      archive_id INTEGER NOT NULL REFERENCES intelligence_archives(id) ON DELETE CASCADE,
      source_tournament_id INTEGER NOT NULL,
      source_event_id INTEGER,
      tournament_name TEXT NOT NULL,
      tournament_sport TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      global_player_id TEXT,
      team_id INTEGER NOT NULL,
      team_name TEXT,
      team_short_code TEXT,
      sport TEXT NOT NULL,
      bid_amount INTEGER NOT NULL,
      previous_bid_amount INTEGER,
      bid_increment INTEGER NOT NULL,
      bid_sequence_number INTEGER NOT NULL,
      milliseconds_since_last_bid INTEGER,
      timer_remaining_seconds INTEGER,
      is_manual_bid BOOLEAN NOT NULL DEFAULT false,
      became_leader BOOLEAN NOT NULL DEFAULT true,
      timestamp TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS intelligence_archive_player_events (
      id SERIAL PRIMARY KEY,
      archive_id INTEGER NOT NULL REFERENCES intelligence_archives(id) ON DELETE CASCADE,
      source_tournament_id INTEGER NOT NULL,
      source_event_id INTEGER,
      tournament_name TEXT NOT NULL,
      tournament_sport TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      global_player_id TEXT,
      category_id INTEGER,
      category_name TEXT,
      sport TEXT NOT NULL,
      player_name TEXT NOT NULL,
      player_role TEXT,
      player_age INTEGER,
      player_city TEXT,
      player_snapshot_json TEXT,
      base_price INTEGER,
      outcome TEXT NOT NULL,
      auction_started_at TIMESTAMPTZ,
      auction_ended_at TIMESTAMPTZ,
      final_amount INTEGER,
      sold_to_team_id INTEGER,
      sold_to_team_name TEXT,
      total_bids_received INTEGER,
      interested_teams_count INTEGER,
      auction_duration_seconds INTEGER,
      average_secs_between_bids INTEGER,
      timestamp TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS intelligence_archive_timer_events (
      id SERIAL PRIMARY KEY,
      archive_id INTEGER NOT NULL REFERENCES intelligence_archives(id) ON DELETE CASCADE,
      source_tournament_id INTEGER NOT NULL,
      source_event_id INTEGER,
      tournament_name TEXT NOT NULL,
      tournament_sport TEXT NOT NULL,
      player_id INTEGER,
      action TEXT NOT NULL,
      timer_type TEXT,
      timer_seconds INTEGER,
      triggered_by TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL
    );
  `);
}
