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
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auto_approve_withdrawn_re_registration boolean NOT NULL DEFAULT false;
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS communication_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      asset_key TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      content TEXT NOT NULL,
      mime_type TEXT,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_assets_asset_key ON communication_assets (asset_key);

    CREATE TABLE IF NOT EXISTS communication_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      internal_key TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      header_image_asset_id UUID,
      footer_html TEXT,
      signature_html TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      auto_send BOOLEAN NOT NULL DEFAULT TRUE,
      is_draft BOOLEAN NOT NULL DEFAULT FALSE,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      current_version INTEGER NOT NULL DEFAULT 1,
      event_type TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_templates_internal_key ON communication_templates (internal_key);

    CREATE TABLE IF NOT EXISTS communication_template_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL,
      version_number INTEGER NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      header_image_asset_id UUID,
      footer_html TEXT,
      signature_html TEXT,
      change_note TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_template_versions_tpl_ver
      ON communication_template_versions (template_id, version_number);

    CREATE TABLE IF NOT EXISTS communication_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel TEXT NOT NULL DEFAULT 'email',
      template_id UUID,
      template_version_id UUID,
      template_internal_key TEXT,
      tournament_id INTEGER,
      triggered_by_event TEXT,
      entity_type TEXT,
      entity_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      pending_reason TEXT,
      subject TEXT,
      html_body TEXT,
      merge_data JSONB NOT NULL DEFAULT '{}',
      idempotency_key TEXT NOT NULL,
      parent_job_id UUID,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 5,
      next_retry_at TIMESTAMPTZ,
      sent_by TEXT NOT NULL DEFAULT 'system',
      created_by_admin TEXT,
      provider_message_id TEXT,
      error_message TEXT,
      bulk_campaign_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      queued_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_jobs_idempotency_key ON communication_jobs (idempotency_key);
    CREATE INDEX IF NOT EXISTS ix_communication_jobs_status ON communication_jobs (status);
    CREATE INDEX IF NOT EXISTS ix_communication_jobs_tournament_id ON communication_jobs (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_communication_jobs_created_at ON communication_jobs (created_at);

    CREATE TABLE IF NOT EXISTS communication_job_recipients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL,
      recipient_name TEXT,
      recipient_email TEXT,
      recipient_phone TEXT,
      recipient_role TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_communication_job_recipients_job_id ON communication_job_recipients (job_id);
    CREATE INDEX IF NOT EXISTS ix_communication_job_recipients_email ON communication_job_recipients (recipient_email);

    CREATE TABLE IF NOT EXISTS communication_logs (
      id SERIAL PRIMARY KEY,
      job_id UUID,
      template_id UUID,
      template_version_id UUID,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      channel TEXT NOT NULL DEFAULT 'email',
      recipient_name TEXT,
      recipient_email TEXT,
      created_by TEXT,
      triggered_by TEXT,
      ip_address TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_communication_logs_job_id ON communication_logs (job_id);
    CREATE INDEX IF NOT EXISTS ix_communication_logs_created_at ON communication_logs (created_at);

    CREATE TABLE IF NOT EXISTS communication_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_screenshot_public_id text;
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_public_id text;
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_public_id text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_public_id text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS main_banner_public_id text;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS flag_public_id text;
    ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS file_public_id text;
    ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS image_public_id text;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS photo_override_public_id text;
  `);
}
