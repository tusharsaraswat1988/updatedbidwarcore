import type pg from "pg";
import { recordSystemDMetrics } from "./boot-metrics";
import { resolveDatabaseUrl } from "./database-url";
import {
  resolveEffectiveAutoHeal,
  resolveEnvironment,
  runSchemaGovernance,
} from "./schema-governance/index.js";
import {
  assertEnvironmentDatabaseIsolation,
  classifyDatabaseRole,
  gateAutoHealForDatabase,
} from "./schema-governance/database-identity.js";
import {
  resolveSchemaBootTimeoutMs,
  withTimeout,
  type DbQueryable,
} from "./schema-governance/timeouts.js";

/**
 * Boot schema orchestration.
 *
 * Order: validate/heal schema → then callers may start the HTTP server.
 * Never bind PORT before this completes successfully.
 *
 * Environment selection (simple, required):
 * 1. BIDWAR_ENV=local|staging|production (required — fail if missing)
 * 2. DATABASE_URL from Render / .env
 * 3. Optional NEON_*_HOST_ALLOWLIST safety guard
 *
 * - local / staging: auto-heal
 * - production: validate-only
 *
 * Hang guardrails: SCHEMA_BOOT_TIMEOUT_MS + per-session lock/statement timeouts.
 */
export async function ensureCoreSchema(pool: pg.Pool): Promise<void> {
  const timeoutMs = resolveSchemaBootTimeoutMs();
  const startedAt = Date.now();

  await withTimeout(
    runEnsureCoreSchemaWithClient(pool),
    timeoutMs,
    `[schema] bootstrap timed out after ${timeoutMs}ms. ` +
      `Check DATABASE_URL / Neon wake, lock contention, and SCHEMA_BOOT_TIMEOUT_MS. ` +
      `Refusing to start HTTP server.`,
  );

  console.info(`[schema] bootstrap finished in ${Date.now() - startedAt}ms`);
}

async function runEnsureCoreSchemaWithClient(pool: pg.Pool): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  const environment = resolveEnvironment();
  assertEnvironmentDatabaseIsolation(environment, databaseUrl);

  const desiredHeal = resolveEffectiveAutoHeal(undefined, databaseUrl);
  // Belt-and-suspenders: never run legacy DDL against production Neon.
  const autoHeal = gateAutoHealForDatabase(desiredHeal, databaseUrl);

  console.info("[schema] boot policy", {
    environment,
    databaseRole: classifyDatabaseRole(databaseUrl),
    autoHealEnabled: autoHeal,
  });

  const connectTimeoutMs = pool.options.connectionTimeoutMillis || 20_000;
  const client = await withTimeout(
    pool.connect(),
    connectTimeoutMs + 1_000,
    `[schema] timed out acquiring a DB connection after ${connectTimeoutMs}ms. Refusing to start HTTP server.`,
  );

  try {
    await client.query(`SET lock_timeout = '15s'`);
    await client.query(`SET statement_timeout = '30s'`);

    if (autoHeal) {
      await runLegacyBootstrapDdl(client);
    } else {
      console.info(
        "[schema] validate-only mode — skipping boot DDL mutations; validating against Drizzle",
      );
    }

    await runSchemaGovernance(client, {
      autoHeal,
      environment,
      databaseUrl,
      log: (msg, extra) => {
        if (extra) console.info(msg, extra);
        else console.info(msg);
      },
    });
  } finally {
    try {
      await client.query("RESET lock_timeout");
      await client.query("RESET statement_timeout");
    } catch {
      // ignore — connection may already be broken
    }
    client.release();
  }
}

/**
 * Legacy System D bootstrap (idempotent CREATE/ALTER IF NOT EXISTS).
 * Used only when auto-heal is enabled (empty DB / local / staging).
 * Do not call this on production boot — production uses versioned migrations.
 */
async function runLegacyBootstrapDdl(db: DbQueryable): Promise<void> {
  const startedAt = Date.now();
  let queryCount = 0;
  let success = false;
  let errorMessage: string | undefined;

  /** Metrics wrapper — identical SQL passed through to db.query. */
  const q = (sql: string) => {
    queryCount += 1;
    return db.query(sql);
  };

  try {
    await q(`
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
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
  `);

  await q(`
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS random_draw_queue TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS obs_context_json TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS re_auction_strategy_json TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS display_countdown TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_purse_booster_json TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_led_toast_json TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_outcome TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
  `);

  await q(`
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

  await q(`
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

  await q(`
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

  await q(`
    ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_screenshot_public_id text;
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_public_id text;
    ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_public_id text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_public_id text;
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS main_banner_public_id text;
    -- P0 2026-07-13: Drizzle maps tournaments.city; missing column breaks SELECT * / Google login.
    ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE organizers ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS photo_public_id text;
    ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS flag_public_id text;
    ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS file_public_id text;
    ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS metadata_json jsonb;
    ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS image_public_id text;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS photo_override_public_id text;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS sub_category text;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS auction_batch text;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS rating integer;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS priority integer;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS remarks text;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS is_wildcard boolean NOT NULL DEFAULT false;
    ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS auction_data_json jsonb;
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS bulk_import_jobs (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      module_type TEXT NOT NULL DEFAULT 'auction_data',
      uploaded_by TEXT NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      file_name TEXT,
      ip_address TEXT,
      browser TEXT,
      processing_time_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      total_rows INTEGER NOT NULL DEFAULT 0,
      updated_rows INTEGER NOT NULL DEFAULT 0,
      failed_rows INTEGER NOT NULL DEFAULT 0,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      preview_json JSONB,
      error_report_json JSONB,
      rolled_back_at TIMESTAMPTZ,
      rolled_back_by TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_bulk_import_jobs_tournament
      ON bulk_import_jobs (tournament_id, uploaded_at);
    CREATE INDEX IF NOT EXISTS ix_bulk_import_jobs_module
      ON bulk_import_jobs (module_type, uploaded_at);

    CREATE TABLE IF NOT EXISTS bulk_import_job_items (
      id BIGSERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      player_id INTEGER,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_bulk_import_job_items_job ON bulk_import_job_items (job_id);
    CREATE INDEX IF NOT EXISTS ix_bulk_import_job_items_player ON bulk_import_job_items (player_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      action TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT,
      job_id INTEGER,
      tournament_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS ix_audit_logs_entity
      ON audit_logs (entity_type, entity_id, performed_at);
    CREATE INDEX IF NOT EXISTS ix_audit_logs_job ON audit_logs (job_id);
    ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS import_mode text;
    ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'excel';
    ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS google_sheet_url text;
    ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS workbook_version_id integer;

    CREATE TABLE IF NOT EXISTS workbook_versions (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      job_id INTEGER,
      version_label TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      snapshot_meta JSONB,
      rolled_back_at TIMESTAMPTZ,
      rolled_back_by TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_workbook_versions_tournament
      ON workbook_versions (tournament_id, created_at);

    ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS version_notes text;
    ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS manifest_snapshot jsonb;

    CREATE TABLE IF NOT EXISTS workbook_mapping_profiles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      organizer_id INTEGER,
      tournament_id INTEGER,
      source_label TEXT,
      sport TEXT,
      fields_json JSONB NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      use_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ix_workbook_mapping_profiles_tournament
      ON workbook_mapping_profiles (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_workbook_mapping_profiles_organizer
      ON workbook_mapping_profiles (organizer_id);

    CREATE TABLE IF NOT EXISTS bulk_import_photo_items (
      id BIGSERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      player_id INTEGER,
      player_name TEXT,
      sheet_row INTEGER,
      source_url TEXT NOT NULL,
      source_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      validation_status TEXT,
      stored_url TEXT,
      public_id TEXT,
      failure_reason TEXT,
      reused_from_item_id INTEGER,
      uploaded_by TEXT NOT NULL,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_job
      ON bulk_import_photo_items (job_id);
    CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_tournament
      ON bulk_import_photo_items (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_source_key
      ON bulk_import_photo_items (tournament_id, source_key);
    CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_status
      ON bulk_import_photo_items (job_id, status);

    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS source_type TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_file_name TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_stored_url TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_public_id TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_width INTEGER;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_height INTEGER;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_bytes INTEGER;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_format TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS quality_warnings JSONB;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS skip_reason TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS reused_from_cache_id INTEGER;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS had_existing_photo INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS photo_import_mode TEXT;
    ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS processing_version TEXT;

    ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_original_url TEXT;
    ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_original_public_id TEXT;

    CREATE TABLE IF NOT EXISTS photo_source_assets (
      id BIGSERIAL PRIMARY KEY,
      source_key TEXT NOT NULL,
      source_type TEXT NOT NULL,
      drive_file_id TEXT,
      checksum TEXT NOT NULL,
      original_source_url TEXT NOT NULL,
      original_file_name TEXT,
      original_url TEXT NOT NULL,
      original_public_id TEXT NOT NULL,
      original_width INTEGER,
      original_height INTEGER,
      original_bytes INTEGER,
      original_format TEXT,
      standard_url TEXT NOT NULL,
      standard_public_id TEXT NOT NULL,
      downloaded_at TIMESTAMPTZ NOT NULL,
      processing_version TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_photo_source_assets_source_key
      ON photo_source_assets (source_key);
    CREATE INDEX IF NOT EXISTS ix_photo_source_assets_checksum
      ON photo_source_assets (checksum);
    CREATE INDEX IF NOT EXISTS ix_photo_source_assets_drive_file_id
      ON photo_source_assets (drive_file_id);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS owner_sessions (
      id TEXT PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_owner_sessions_tournament_team
      ON owner_sessions (tournament_id, team_id);
    CREATE INDEX IF NOT EXISTS ix_owner_sessions_expires_at
      ON owner_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
    ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS owner_session_id TEXT;
    ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS ix_push_subscriptions_tournament_id
      ON push_subscriptions (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_push_subscriptions_owner_session_id
      ON push_subscriptions (owner_session_id);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS academy_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_categories_slug ON academy_categories (slug);
    CREATE INDEX IF NOT EXISTS ix_academy_categories_active ON academy_categories (active);
    CREATE INDEX IF NOT EXISTS ix_academy_categories_display_order ON academy_categories (display_order);

    CREATE TABLE IF NOT EXISTS academy_lessons (
      id SERIAL PRIMARY KEY,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      short_description TEXT,
      content TEXT,
      content_format TEXT NOT NULL DEFAULT 'plain',
      youtube_url TEXT,
      youtube_video_id TEXT,
      category_id INTEGER REFERENCES academy_categories(id),
      seo_title TEXT,
      seo_description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_lessons_slug ON academy_lessons (slug);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_lessons_episode_number ON academy_lessons (episode_number);
    CREATE INDEX IF NOT EXISTS ix_academy_lessons_status ON academy_lessons (status);
    CREATE INDEX IF NOT EXISTS ix_academy_lessons_category_id ON academy_lessons (category_id);
    CREATE INDEX IF NOT EXISTS ix_academy_lessons_display_order ON academy_lessons (display_order);
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS scorer_accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_scorer_accounts_mobile ON scorer_accounts (mobile);

    CREATE TABLE IF NOT EXISTS scorer_sessions (
      id TEXT PRIMARY KEY,
      scorer_id INTEGER NOT NULL,
      device_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS ix_scorer_sessions_scorer_id ON scorer_sessions (scorer_id);
    CREATE INDEX IF NOT EXISTS ix_scorer_sessions_expires_at ON scorer_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS scorer_match_locks (
      match_id INTEGER PRIMARY KEY,
      scorer_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_session_id ON scorer_match_locks (session_id);
    CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_last_heartbeat ON scorer_match_locks (last_heartbeat_at);

    CREATE TABLE IF NOT EXISTS scorer_audit_log (
      id SERIAL PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      scorer_id INTEGER,
      session_id TEXT,
      tournament_id INTEGER,
      match_id INTEGER,
      sport TEXT,
      action TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_match_id ON scorer_audit_log (match_id);
    CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_tournament_id ON scorer_audit_log (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_scorer_id ON scorer_audit_log (scorer_id);
    CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_created_at ON scorer_audit_log (created_at);
    CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_action ON scorer_audit_log (action);
  `);
    success = true;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    // Non-blocking: summary prints once when System C has also settled.
    recordSystemDMetrics({
      executionTimeMs: Date.now() - startedAt,
      queryCount,
      success,
      failure: !success,
      errorMessage,
    });
  }
}
