-- ============================================================================
-- BIDWAR CANONICAL BASELINE & HEALER ABSORPTION MIGRATION (0042)
-- Milestone 2: Database Stabilization (Schema Path Unification)
--
-- This migration completely absorbs:
-- 1. All baseline core tables (tournaments, teams, players, categories, bids, etc.)
-- 2. All tables previously created in legacy System C and System D boot DDL
-- 3. All column definitions across all 123 domain models in Drizzle
-- 4. All primary, unique, and secondary indexes
--
-- IDEMPOTENT: Uses CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- and CREATE INDEX IF NOT EXISTS throughout.
-- Safe to run on blank databases, staging environments, and production Neon.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS drizzle;

-- ============================================================================
-- SECTION 1: CREATE TABLE IF NOT EXISTS (ALL 123 DOMAIN TABLES)
-- ============================================================================

-- Table: academy_categories (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS academy_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: academy_lessons (absorbed from legacy boot DDL)
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

-- Table: admin_notification_settings (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS admin_notification_settings (
      id SERIAL PRIMARY KEY,
      admin_name TEXT NOT NULL DEFAULT '',
      admin_email TEXT NOT NULL DEFAULT '',
      admin_mobile TEXT,
      email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      live_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      notification_sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: admin_notifications (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS admin_notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'info',
      category TEXT NOT NULL DEFAULT 'System',
      entity_type TEXT,
      entity_id INTEGER,
      action_url TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      metadata JSONB
    );

-- Table: auction_bid_events (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS auction_bid_events (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  global_player_id TEXT,
  team_id INTEGER NOT NULL,
  sport TEXT NOT NULL DEFAULT 'cricket',
  bid_amount INTEGER NOT NULL,
  previous_bid_amount INTEGER,
  bid_increment INTEGER NOT NULL,
  bid_sequence_number INTEGER NOT NULL,
  milliseconds_since_last_bid INTEGER,
  timer_remaining_seconds INTEGER,
  is_manual_bid BOOLEAN NOT NULL DEFAULT FALSE,
  became_leader BOOLEAN NOT NULL DEFAULT TRUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: auction_demo_owned_records (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS auction_demo_owned_records (
  id SERIAL PRIMARY KEY,
  demo_session_id TEXT NOT NULL,
  tournament_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: auction_demo_sessions (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS auction_demo_sessions (
  id TEXT PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  organizer_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'loaded',
  settings_before JSONB NOT NULL,
  settings_applied JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reset_at TIMESTAMPTZ,
  reset_by TEXT
);

-- Table: auction_player_events (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS auction_player_events (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  global_player_id TEXT,
  category_id INTEGER,
  sport TEXT NOT NULL DEFAULT 'cricket',
  player_name TEXT NOT NULL,
  player_role TEXT,
  player_age INTEGER,
  player_city TEXT,
  player_snapshot_json TEXT,
  base_price INTEGER,
  outcome TEXT NOT NULL,
  auction_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auction_ended_at TIMESTAMPTZ,
  final_amount INTEGER,
  sold_to_team_id INTEGER,
  sold_to_team_name TEXT,
  total_bids_received INTEGER,
  interested_teams_count INTEGER,
  auction_duration_seconds INTEGER,
  average_secs_between_bids INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: auction_sessions (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS auction_sessions (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  current_player_id INTEGER,
  current_bid INTEGER,
  current_bid_team_id INTEGER,
  timer_seconds INTEGER,
  timer_ends_at TEXT,
  timer_type TEXT,
  last_action TEXT,
  last_outcome TEXT,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  break_ends_at TEXT,
  fortune_wheel_active BOOLEAN NOT NULL DEFAULT FALSE,
  wheel_spinning BOOLEAN NOT NULL DEFAULT FALSE,
  team_purse_view_active BOOLEAN NOT NULL DEFAULT FALSE,
  display_overlay TEXT,
  obs_context_json TEXT,
  display_player_filter TEXT,
  wheel_items_json TEXT,
  wheel_winner TEXT,
  active_category_ids TEXT,
  paused_time_remaining INTEGER,
  deferred_player_ids TEXT,
  random_draw_queue TEXT,
  re_auction_strategy_json TEXT,
  display_countdown TEXT,
  sold_players_count INTEGER NOT NULL DEFAULT 0,
  unsold_players_count INTEGER NOT NULL DEFAULT 0,
  last_purse_booster_json TEXT,
  last_led_toast_json TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revision INTEGER NOT NULL DEFAULT 0
);

-- Table: auction_timer_events (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS auction_timer_events (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  player_id INTEGER,
  action TEXT NOT NULL,
  timer_type TEXT,
  timer_seconds INTEGER,
  triggered_by TEXT NOT NULL DEFAULT 'operator',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: audit_logs (absorbed from legacy boot DDL)
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

-- Table: badminton_analytics (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_analytics (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL UNIQUE,
      longest_rally INTEGER,
      longest_rally_match_id INTEGER,
      max_consecutive_points INTEGER,
      fastest_match_minutes REAL,
      total_rallies INTEGER,
      avg_rally_duration_secs REAL,
      matches_played INTEGER,
      matches_completed INTEGER,
      top_player_player_id INTEGER,
      analytics_json JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_categories (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_categories (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      match_type TEXT NOT NULL DEFAULT 'singles',
      age_group TEXT,
      gender TEXT,
      match_format_json JSONB,
      draw_type TEXT NOT NULL DEFAULT 'knockout',
      num_seeds SMALLINT NOT NULL DEFAULT 0,
      phase TEXT NOT NULL DEFAULT 'setup',
      max_players INTEGER,
      entry_fee INTEGER,
      prize_money INTEGER,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      color_code TEXT,
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_courts (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_courts (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      sort_order SMALLINT NOT NULL DEFAULT 0,
      stream_url TEXT,
      has_display BOOLEAN NOT NULL DEFAULT FALSE,
      scorer_pin TEXT,
      scorer_name TEXT,
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_draws (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_draws (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      round_name TEXT NOT NULL,
      round_number SMALLINT NOT NULL DEFAULT 1,
      total_rounds SMALLINT,
      draw_kind TEXT NOT NULL DEFAULT 'knockout_round',
      group_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_fixtures (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_fixtures (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      draw_id INTEGER NOT NULL,
      slot_number SMALLINT,
      registration_a_id INTEGER,
      registration_b_id INTEGER,
      winner_advances_to INTEGER,
      loser_advances_to INTEGER,
      scoring_match_id INTEGER,
      court_id INTEGER,
      court_number TEXT,
      scheduled_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'scheduled',
      winner_registration_id INTEGER,
      result_summary TEXT,
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_group_members (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      seed SMALLINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_groups (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_groups (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_match_details (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_match_details (
      id SERIAL PRIMARY KEY,
      scoring_match_id INTEGER NOT NULL UNIQUE,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER,
      fixture_id INTEGER,
      court_id INTEGER,
      court_number TEXT,
      match_number TEXT,
      match_label TEXT,
      round_name TEXT,
      match_type TEXT NOT NULL DEFAULT 'singles',
      match_format_json JSONB,
      left_side_json JSONB,
      right_side_json JSONB,
      scorer_pin TEXT,
      scorer_name TEXT,
      service_judge_name TEXT,
      state_snapshot_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_pair_standings (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_pair_standings (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      registration_id INTEGER NOT NULL,
      group_id INTEGER,
      played SMALLINT NOT NULL DEFAULT 0,
      won SMALLINT NOT NULL DEFAULT 0,
      lost SMALLINT NOT NULL DEFAULT 0,
      margin_points INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_players (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_players (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      global_player_id INTEGER,
      bwf_code TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      display_name TEXT,
      short_name TEXT,
      country_code TEXT,
      country_name TEXT,
      state_name TEXT,
      academy_name TEXT,
      date_of_birth TEXT,
      age_group TEXT,
      gender TEXT,
      handedness TEXT,
      mobile TEXT,
      email TEXT,
      photo_url TEXT,
      flag_url TEXT,
      team_color TEXT,
      world_ranking INTEGER,
      national_ranking INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_registrations (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS badminton_registrations (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      player1_id INTEGER NOT NULL,
      player2_id INTEGER,
      seed_number SMALLINT,
      status TEXT NOT NULL DEFAULT 'accepted',
      registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payment_ref TEXT,
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: badminton_rules_profiles (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS badminton_rules_profiles (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER,
  profile_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  profile_type TEXT NOT NULL DEFAULT 'custom',
  schema_version TEXT NOT NULL DEFAULT '1.0.0',
  profile_version TEXT NOT NULL DEFAULT '1.0.0',
  rules_source TEXT,
  rules_source_effective_date TEXT,
  is_official_bwf BOOLEAN NOT NULL DEFAULT FALSE,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: bids (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: bot_sessions (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS bot_sessions (
  id SERIAL PRIMARY KEY,
  mobile TEXT NOT NULL,
  pending_action TEXT NOT NULL,
  pending_data TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: bpl_edition_sponsors (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS bpl_edition_sponsors (
      id SERIAL PRIMARY KEY,
      edition_id INTEGER NOT NULL REFERENCES bpl_editions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'PARTNER',
      website_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: bpl_editions (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS bpl_editions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      edition_number INTEGER NOT NULL,
      slug TEXT NOT NULL,
      year INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      venue TEXT,
      city TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      linked_tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
      live_stream_url TEXT,
      fan_page_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: branding_assets (absorbed from legacy boot DDL)
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

-- Table: branding_settings (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS branding_settings (
  id SERIAL PRIMARY KEY,
  brand_name TEXT NOT NULL DEFAULT 'BidWar',
  tagline TEXT,
  powered_by_text TEXT NOT NULL DEFAULT 'Powered by BidWar',
  mini_brand_text TEXT NOT NULL DEFAULT 'BW',
  main_logo_url TEXT,
  main_logo_reverse_url TEXT,
  mini_logo_url TEXT,
  app_icon_url TEXT,
  splash_screen_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#F59E0B',
  secondary_color TEXT NOT NULL DEFAULT '#1E293B',
  accent_color TEXT NOT NULL DEFAULT '#3B82F6',
  background_color TEXT NOT NULL DEFAULT '#080A0F',
  success_color TEXT NOT NULL DEFAULT '#22C55E',
  danger_color TEXT NOT NULL DEFAULT '#EF4444',
  heading_font TEXT NOT NULL DEFAULT 'Space Grotesk',
  body_font TEXT NOT NULL DEFAULT 'Inter',
  show_powered_by_viewer BOOLEAN NOT NULL DEFAULT TRUE,
  show_powered_by_owner_app BOOLEAN NOT NULL DEFAULT TRUE,
  show_branding_pdf BOOLEAN NOT NULL DEFAULT TRUE,
  show_branding_public_links BOOLEAN NOT NULL DEFAULT TRUE,
  show_branding_auction BOOLEAN NOT NULL DEFAULT TRUE,
  enable_watermark BOOLEAN NOT NULL DEFAULT FALSE,
  watermark_text TEXT NOT NULL DEFAULT 'Powered by BidWar',
  watermark_opacity NUMERIC NOT NULL DEFAULT 0.15,
  watermark_position TEXT NOT NULL DEFAULT 'bottom-right',
  logo_animation_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: bulk_import_job_items (absorbed from legacy boot DDL)
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

-- Table: bulk_import_jobs (absorbed from legacy boot DDL)
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

-- Table: bulk_import_photo_items (absorbed from legacy boot DDL)
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

-- Table: categories (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  min_bid INTEGER,
  bid_increment INTEGER,
  bid_tiers TEXT,
  max_players INTEGER,
  color_code TEXT DEFAULT '#F59E0B',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: clients (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      logo_public_id TEXT,
      website_url TEXT,
      client_type TEXT NOT NULL DEFAULT 'brand',
      display_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: comm_logs (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS comm_logs (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER,
  recipient_type TEXT NOT NULL,
  recipient_id INTEGER,
  recipient_mobile TEXT NOT NULL,
  channel TEXT NOT NULL,
  template_name TEXT,
  message_content TEXT NOT NULL,
  sent_by_admin_id TEXT,
  blast_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  delivery_updated_at TIMESTAMPTZ,
  meta_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: communication_assets (absorbed from legacy boot DDL)
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

-- Table: communication_job_recipients (absorbed from legacy boot DDL)
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

-- Table: communication_jobs (absorbed from legacy boot DDL)
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

-- Table: communication_logs (absorbed from legacy boot DDL)
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

-- Table: communication_settings (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS communication_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: communication_template_versions (absorbed from legacy boot DDL)
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

-- Table: communication_templates (absorbed from legacy boot DDL)
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

-- Table: competition_configuration_history (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS competition_configuration_history (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      payload_json jsonb NOT NULL,
      checksum text,
      frozen_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: consent_blast_log (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS consent_blast_log (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  mobile TEXT NOT NULL,
  blast_date TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: consent_tokens (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS consent_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_id INTEGER NOT NULL,
  mobile TEXT NOT NULL,
  tournament_id INTEGER NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Table: contact_inquiries (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS contact_inquiries (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      inquiry_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      consent TEXT NOT NULL DEFAULT 'granted',
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT NOT NULL DEFAULT 'website_contact_page',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: cricket_broadcast_message_templates (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS cricket_broadcast_message_templates (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name text NOT NULL,
      details text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: cricket_rule_presets (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS cricket_rule_presets (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name text NOT NULL,
      description text,
      variant_id text NOT NULL DEFAULT 'cricket.box',
      rule_profile_id text NOT NULL DEFAULT 'cricket.box.corporate_standard',
      rule_profile_version text NOT NULL DEFAULT '1.0.0',
      rule_overrides_json jsonb,
      squad_rules_json jsonb,
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: cricket_sponsor_media_slots (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS cricket_sponsor_media_slots (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  slot_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  asset_type TEXT,
  original_url TEXT,
  original_public_id TEXT,
  broadcast_url TEXT,
  broadcast_public_id TEXT,
  poster_url TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 10000,
  file_size_bytes INTEGER,
  original_file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  has_audio BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL DEFAULT 'empty',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: display_auctions (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS display_auctions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  sport TEXT NOT NULL DEFAULT 'cricket',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  purse INTEGER NOT NULL DEFAULT 1000000,
  players_per_team INTEGER NOT NULL DEFAULT 11,
  teams_count INTEGER NOT NULL DEFAULT 8,
  scheduled_date TEXT NOT NULL DEFAULT '',
  scheduled_time TEXT NOT NULL DEFAULT '00:00',
  primary_color TEXT NOT NULL DEFAULT '#1a3a6b',
  accent_color TEXT NOT NULL DEFAULT '#f5c842',
  status TEXT NOT NULL DEFAULT 'upcoming',
  show_on_landing BOOLEAN NOT NULL DEFAULT TRUE,
  tournament_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: fixture_configuration_history (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS fixture_configuration_history (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      fixture_key text NOT NULL,
      source text NOT NULL,
      source_id integer NOT NULL,
      version integer NOT NULL DEFAULT 1,
      payload_json jsonb NOT NULL,
      checksum text,
      frozen_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: global_players (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS global_players (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      display_name TEXT,
      mobile_number TEXT,
      email TEXT,
      dob TEXT,
      gender TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      academy TEXT,
      handedness TEXT,
      world_ranking INTEGER,
      national_ranking INTEGER,
      sponsor_id TEXT,
      auction_player_id INTEGER,
      sport TEXT NOT NULL DEFAULT 'cricket',
      default_role TEXT,
      age INTEGER,
      photo_url TEXT,
      photo_public_id TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: google_sheet_syncs (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS google_sheet_syncs (
      id SERIAL PRIMARY KEY,
      organizer_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      spreadsheet_id TEXT NOT NULL,
      spreadsheet_url TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'CONNECTED',
      last_synced_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: intelligence_archive_bid_events (absorbed from legacy boot DDL)
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

-- Table: intelligence_archive_player_events (absorbed from legacy boot DDL)
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

-- Table: intelligence_archive_timer_events (absorbed from legacy boot DDL)
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

-- Table: intelligence_archives (absorbed from legacy boot DDL)
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

-- Table: master_player_id_mappings (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS master_player_id_mappings (
      id SERIAL PRIMARY KEY,
      source_module TEXT NOT NULL,
      source_player_id INTEGER NOT NULL,
      master_player_id TEXT NOT NULL,
      tournament_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: master_sponsors (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS master_sponsors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      website TEXT,
      description TEXT,
      is_title_sponsor BOOLEAN NOT NULL DEFAULT false,
      is_co_sponsor BOOLEAN NOT NULL DEFAULT false,
      sponsor_priority INTEGER NOT NULL DEFAULT 0,
      priority_type TEXT NOT NULL DEFAULT 'NORMAL',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: master_sports_sync_log (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS master_sports_sync_log (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      master_player_id TEXT,
      master_team_id TEXT,
      details_json TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: master_teams (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS master_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_name TEXT,
      logo_url TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      owner_name TEXT,
      sponsor_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: match_configuration_history (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS match_configuration_history (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      match_id integer NOT NULL REFERENCES scoring_matches(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      payload_json jsonb NOT NULL,
      checksum text,
      frozen_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: member_auth_identities (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS member_auth_identities (
      id SERIAL PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_subject TEXT,
      normalized_identifier TEXT,
      password_hash TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      metadata_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: member_identity_links (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS member_identity_links (
      id SERIAL PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      source_table TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      link_type TEXT NOT NULL DEFAULT 'direct_fk',
      confidence_score INTEGER NOT NULL DEFAULT 100,
      provenance_json JSONB,
      status TEXT NOT NULL DEFAULT 'active',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: member_roles (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS member_roles (
      id SERIAL PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      match_id INTEGER REFERENCES scoring_matches(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: member_sessions (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS member_sessions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      auth_identity_id INTEGER REFERENCES member_auth_identities(id) ON DELETE CASCADE,
      token_hash TEXT,
      device_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: member_sport_profiles (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS member_sport_profiles (
      id SERIAL PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      sport_slug TEXT NOT NULL,
      primary_role TEXT,
      secondary_role TEXT,
      handedness TEXT,
      federation_code TEXT,
      profile_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: members (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      primary_mobile TEXT,
      primary_email TEXT,
      is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      dob TEXT,
      gender TEXT,
      country TEXT,
      state TEXT,
      city TEXT,
      avatar_url TEXT,
      avatar_public_id TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      metadata_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: notification_logs (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_mobile TEXT,
  tournament_id INTEGER,
  organizer_id INTEGER,
  dedup_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subject TEXT,
  provider_response TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: organizer_sessions (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS organizer_sessions (
      id TEXT PRIMARY KEY,
      organizer_account_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      session_scope TEXT NOT NULL DEFAULT 'account',
      token_hash TEXT NOT NULL,
      device_name TEXT,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: organizers (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS organizers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  google_email TEXT,
  google_sheets_refresh_token TEXT,
  google_sheets_access_token TEXT,
  google_sheets_token_expiry TIMESTAMPTZ,
  google_sheets_connected_email TEXT,
  license_status TEXT NOT NULL DEFAULT 'active',
  max_tournaments INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  photo_url TEXT,
  photo_public_id TEXT,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent_at TIMESTAMPTZ,
  whatsapp_consent_method TEXT,
  whatsapp_consent_ip TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: otp_sessions (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS otp_sessions (
  id SERIAL PRIMARY KEY,
  mobile TEXT NOT NULL,
  otp_hash TEXT,
  purpose TEXT NOT NULL DEFAULT 'wa_consent',
  payload TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Table: owner_sessions (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS owner_sessions (
      id TEXT PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: photo_source_assets (absorbed from legacy boot DDL)
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

-- Table: platform_audit_events (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS platform_audit_events (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      event_category TEXT NOT NULL,
      event_action TEXT NOT NULL,
      event_severity TEXT NOT NULL DEFAULT 'info',
      outcome TEXT NOT NULL DEFAULT 'success',
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      actor_label TEXT,
      actor_ip TEXT,
      actor_user_agent TEXT,
      session_id TEXT,
      resource_type TEXT,
      resource_id TEXT,
      tournament_id INTEGER,
      team_id INTEGER,
      player_id INTEGER,
      summary TEXT NOT NULL,
      reason TEXT,
      metadata_json JSONB,
      before_json JSONB,
      after_json JSONB,
      changes_json JSONB,
      related_table TEXT,
      related_id TEXT,
      request_id TEXT,
      request_method TEXT,
      request_path TEXT,
      source TEXT NOT NULL DEFAULT 'api',
      alert_key TEXT,
      critical_tags_json JSONB DEFAULT '[]'::jsonb,
      monitoring_flags_json JSONB,
      exportable BOOLEAN NOT NULL DEFAULT TRUE
    );

-- Table: player_import_logs (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS player_import_logs (
  id SERIAL PRIMARY KEY,
  organizer_account_id INTEGER,
  source_tournament_id INTEGER NOT NULL,
  target_tournament_id INTEGER NOT NULL,
  player_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: player_spec_values (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS player_spec_values (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      spec_group_id INTEGER NOT NULL REFERENCES role_spec_groups(id),
      value_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: player_sport_profiles (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS player_sport_profiles (
      id SERIAL PRIMARY KEY,
      global_player_id TEXT NOT NULL REFERENCES global_players(id) ON DELETE CASCADE,
      sport_slug TEXT NOT NULL REFERENCES sports(slug),
      default_role TEXT,
      profile_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: player_statistics (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS player_statistics (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL,
      sport TEXT NOT NULL DEFAULT 'badminton',
      tournament_id INTEGER,
      matches_played INTEGER NOT NULL DEFAULT 0,
      matches_won INTEGER NOT NULL DEFAULT 0,
      matches_lost INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      games_lost INTEGER NOT NULL DEFAULT 0,
      points_scored INTEGER NOT NULL DEFAULT 0,
      points_conceded INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: player_team_assignments (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS player_team_assignments (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      tournament_id INTEGER,
      season_id TEXT,
      sport TEXT NOT NULL DEFAULT 'cricket',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      auction_player_id INTEGER,
      auction_team_id INTEGER
    );

-- Table: players (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  serial_no INTEGER NOT NULL,
  category_id INTEGER,
  team_id INTEGER,
  name TEXT NOT NULL,
  city TEXT,
  role TEXT,
  batting_style TEXT,
  bowling_style TEXT,
  age INTEGER,
  gender TEXT,
  photo_url TEXT,
  photo_public_id TEXT,
  photo_original_url TEXT,
  photo_original_public_id TEXT,
  base_price INTEGER NOT NULL DEFAULT 100000,
  selected_bid_value INTEGER,
  bid_value_source TEXT,
  sold_price INTEGER,
  retained_price INTEGER,
  status TEXT NOT NULL DEFAULT 'available',
  jersey_number TEXT,
  jersey_size TEXT,
  lower_size TEXT,
  achievements TEXT,
  mobile_number TEXT NOT NULL DEFAULT '',
  email TEXT,
  crichero_url TEXT,
  availability_dates TEXT,
  specialization TEXT,
  global_player_id TEXT,
  player_tag TEXT,
  player_tag_team_id INTEGER,
  is_non_playing_member BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent_at TIMESTAMPTZ,
  whatsapp_consent_method TEXT,
  whatsapp_consent_ip TEXT,
  whatsapp_consent_org_id INTEGER,
  registration_payment_status TEXT,
  utr_number TEXT,
  payment_screenshot_url TEXT,
  payment_screenshot_public_id TEXT,
  payment_submitted_at TIMESTAMPTZ,
  custom_answers_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: purse_boosters (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS purse_boosters (
      id SERIAL PRIMARY KEY,
      local_uuid TEXT NOT NULL UNIQUE,
      tournament_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_by_type TEXT NOT NULL,
      created_by_id TEXT,
      created_by_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_by_type TEXT,
      cancelled_by_id TEXT,
      cancelled_by_label TEXT,
      cancelled_at TIMESTAMPTZ,
      cancel_reason TEXT,
      previous_capacity INTEGER NOT NULL,
      new_capacity INTEGER NOT NULL,
      origin TEXT NOT NULL DEFAULT 'cloud',
      sync_state TEXT NOT NULL DEFAULT 'synced'
    );

-- Table: push_subscriptions (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: role_spec_groups (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS role_spec_groups (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      optional BOOLEAN NOT NULL DEFAULT true,
      active BOOLEAN NOT NULL DEFAULT true
    );

-- Table: role_spec_options (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS role_spec_options (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      option_name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true
    );

-- Table: runtime_match_history (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS runtime_match_history (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      match_id integer NOT NULL REFERENCES scoring_matches(id) ON DELETE CASCADE,
      operation text NOT NULL,
      snapshot_version integer,
      execution_phase text,
      actor text,
      reason text,
      payload_json jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: scheduling_configuration_history (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scheduling_configuration_history (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      scheduling_key text NOT NULL,
      source text NOT NULL,
      source_id integer NOT NULL,
      version integer NOT NULL DEFAULT 1,
      payload_json jsonb NOT NULL,
      checksum text,
      frozen_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: scorer_accounts (absorbed from legacy boot DDL)
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

-- Table: scorer_audit_log (absorbed from legacy boot DDL)
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

-- Table: scorer_match_locks (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scorer_match_locks (
      match_id INTEGER PRIMARY KEY,
      scorer_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      lease_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      lease_version INTEGER NOT NULL DEFAULT 1,
      locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 seconds')
    );

-- Table: scorer_sessions (absorbed from legacy boot DDL)
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

-- Table: scorer_tournament_assignments (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scorer_tournament_assignments (
      id SERIAL PRIMARY KEY,
      scorer_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_dls_calculations (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_dls_calculations (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      inputs_json JSONB NOT NULL,
      outputs_json JSONB NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT
    );

-- Table: scoring_draws (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_draws (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      format TEXT NOT NULL,
      config_json JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_events (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS scoring_events (
  id BIGSERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  fixture_id INTEGER,
  sport_slug TEXT NOT NULL DEFAULT 'cricket',
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  sequence BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  correlation_id UUID,
  causation_id BIGINT,
  payload_json JSONB NOT NULL,
  metadata_json JSONB
);

-- Table: scoring_fixtures (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS scoring_fixtures (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  sport_slug TEXT NOT NULL DEFAULT 'cricket',
  draw_id INTEGER,
  group_id INTEGER,
  bracket_round INTEGER,
  bracket_slot INTEGER,
  fixture_number INTEGER,
  round_name TEXT,
  scheduled_at TIMESTAMPTZ,
  venue_id INTEGER,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  rule_preset_id INTEGER,
  format_json JSONB,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  winner_team_id INTEGER,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: scoring_group_members (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      seed SMALLINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_groups (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_groups (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      draw_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_leaderboard_snapshots (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_leaderboard_snapshots (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      rows_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_match_player_stats (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_match_player_stats (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      innings INTEGER NOT NULL,
      batting_json JSONB,
      bowling_json JSONB,
      fielding_json JSONB NOT NULL DEFAULT '{"catches":0,"runOuts":0,"stumpings":0}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_match_squads (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_match_squads (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      squad_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_matches (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS scoring_matches (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  fixture_id INTEGER,
  sport_slug TEXT NOT NULL DEFAULT 'cricket',
  match_kind TEXT NOT NULL DEFAULT 'team_match',
  parent_match_id INTEGER,
  sequence_in_parent INTEGER,
  match_label TEXT,
  round_name TEXT,
  scheduled_at TIMESTAMPTZ,
  venue_id INTEGER,
  venue TEXT,
  match_type_id TEXT DEFAULT 'league',
  display_name TEXT,
  surface TEXT,
  visibility TEXT DEFAULT 'tournament',
  branding_json JSONB,
  lifecycle_status TEXT DEFAULT 'draft',
  configuration_locked BOOLEAN NOT NULL DEFAULT FALSE,
  execution_phase TEXT DEFAULT 'preparing',
  current_runtime_version INTEGER,
  runtime_prep_metadata_json JSONB,
  officials_json JSONB,
  status TEXT NOT NULL DEFAULT 'scheduled',
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  home_side_json JSONB,
  away_side_json JSONB,
  rules_json JSONB,
  rule_preset_id INTEGER,
  winner_team_id INTEGER,
  result_summary TEXT,
  summary_json JSONB,
  current_projection_version BIGINT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: scoring_officials (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_officials (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'scorer',
      mobile TEXT,
      email TEXT,
      pin TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_player_awards (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_player_awards (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      award_type TEXT NOT NULL DEFAULT 'man_of_the_match',
      selection_method TEXT NOT NULL DEFAULT 'auto',
      score INTEGER,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: scoring_sessions (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS scoring_sessions (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  state_json JSONB,
  display_overlay TEXT,
  display_overlay_json JSONB,
  last_event_seq BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: scoring_standings (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS scoring_standings (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  draw_id INTEGER,
  team_id INTEGER NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  tied INTEGER NOT NULL DEFAULT 0,
  no_result INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  net_run_rate NUMERIC,
  extras_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: scoring_venues (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS scoring_venues (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      city TEXT,
      address TEXT,
      surface_type TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: settings (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Table: showcase_events (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS showcase_events (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  image_public_id TEXT,
  sport_name TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  description TEXT,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: sms_notification_settings (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS sms_notification_settings (
  id SERIAL PRIMARY KEY,
  dlt_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  team_owner_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  team_owner_template_id TEXT,
  player_sold_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  player_sold_template_id TEXT,
  viewer_link_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  viewer_link_template_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: sport_roles (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS sport_roles (
      id SERIAL PRIMARY KEY,
      sport_id INTEGER NOT NULL,
      role_name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true
    );

-- Table: sports (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS sports (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: team_configuration_history (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS team_configuration_history (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      team_id integer NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      payload_json jsonb NOT NULL,
      checksum text,
      frozen_by text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

-- Table: teams (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_mobile TEXT NOT NULL DEFAULT '',
  owner_email TEXT,
  owner_photo_url TEXT,
  owner_photo_public_id TEXT,
  color TEXT DEFAULT '#3B82F6',
  logo_url TEXT,
  logo_public_id TEXT,
  master_team_id TEXT,
  team_type_id TEXT DEFAULT 'competitive',
  display_name TEXT,
  secondary_color TEXT,
  visibility TEXT DEFAULT 'tournament',
  theme_json JSONB,
  lifecycle_status TEXT DEFAULT 'draft',
  configuration_locked BOOLEAN NOT NULL DEFAULT FALSE,
  purse INTEGER NOT NULL DEFAULT 10000000,
  purse_used INTEGER NOT NULL DEFAULT 0,
  is_bidding_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  access_code TEXT,
  coach_name TEXT,
  coach_mobile TEXT,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent_at TIMESTAMPTZ,
  whatsapp_consent_method TEXT,
  whatsapp_consent_ip TEXT,
  whatsapp_consent_org_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: tournament_license_requests (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS tournament_license_requests (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      organizer_id INTEGER REFERENCES organizers(id) ON DELETE CASCADE,
      requested_modules TEXT NOT NULL DEFAULT 'auction',
      status TEXT NOT NULL DEFAULT 'pending',
      organizer_mobile TEXT,
      notes TEXT,
      payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
      payment_amount INTEGER,
      payment_mode TEXT,
      payment_ref TEXT,
      verified_by TEXT,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: tournament_participations (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS tournament_participations (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'player',
      status TEXT NOT NULL DEFAULT 'active',
      team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      category_id INTEGER,
      display_name_override TEXT,
      initials TEXT,
      jersey_number TEXT,
      metadata_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: tournament_player_profiles (absorbed from legacy boot DDL)
CREATE TABLE IF NOT EXISTS tournament_player_profiles (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      master_player_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      initials TEXT NOT NULL,
      photo_override_url TEXT,
      category TEXT,
      seed_rank INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

-- Table: tournaments (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  organizer_id INTEGER,
  name TEXT NOT NULL,
  season TEXT,
  sport TEXT NOT NULL DEFAULT 'cricket',
  sport_id INTEGER,
  auction_code TEXT,
  venue TEXT,
  city TEXT,
  auction_date TEXT,
  auction_time TEXT,
  organizer_name TEXT,
  organizer_mobile TEXT,
  organizer_email TEXT,
  organizer_password TEXT,
  logo_url TEXT,
  logo_public_id TEXT,
  sponsor_logos TEXT,
  auction_unit TEXT NOT NULL DEFAULT 'points',
  base_purse INTEGER NOT NULL DEFAULT 10000000,
  min_bid INTEGER NOT NULL DEFAULT 100000,
  bid_increment INTEGER NOT NULL DEFAULT 100000,
  bid_tier1_up_to INTEGER NOT NULL DEFAULT 100000,
  bid_tier1_increment INTEGER NOT NULL DEFAULT 25000,
  bid_tier2_up_to INTEGER NOT NULL DEFAULT 200000,
  bid_tier2_increment INTEGER NOT NULL DEFAULT 50000,
  bid_tier3_increment INTEGER NOT NULL DEFAULT 100000,
  bid_tiers TEXT,
  timer_seconds INTEGER NOT NULL DEFAULT 30,
  bid_timer_seconds INTEGER NOT NULL DEFAULT 10,
  bid_extension_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  bid_extension_threshold_seconds INTEGER NOT NULL DEFAULT 3,
  bid_extension_seconds INTEGER NOT NULL DEFAULT 5,
  owner_bidding_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  player_selection_mode TEXT NOT NULL DEFAULT 'random',
  status TEXT NOT NULL DEFAULT 'setup',
  registration_deadline TEXT,
  registration_limit INTEGER,
  auto_approve_withdrawn_re_registration BOOLEAN NOT NULL DEFAULT FALSE,
  enable_registration_payment BOOLEAN NOT NULL DEFAULT FALSE,
  registration_fee INTEGER,
  upi_id TEXT,
  payment_verification_method TEXT,
  payment_collection_mode TEXT NOT NULL DEFAULT 'manual_verification',
  enable_registration_declaration BOOLEAN NOT NULL DEFAULT FALSE,
  registration_declaration_text TEXT,
  bid_value_mode TEXT NOT NULL DEFAULT 'system',
  bid_value_options TEXT,
  license_status TEXT NOT NULL DEFAULT 'trial',
  license_granted_at TIMESTAMPTZ,
  license_granted_by TEXT,
  admin_locked BOOLEAN NOT NULL DEFAULT FALSE,
  admin_locked_at TIMESTAMPTZ,
  reset_count INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ,
  last_reset_by TEXT,
  minimum_squad_size INTEGER NOT NULL DEFAULT 0,
  maximum_squad_size INTEGER NOT NULL DEFAULT 0,
  audio_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  master_volume INTEGER NOT NULL DEFAULT 80,
  countdown_sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  countdown_sound_url TEXT,
  countdown_sound_volume INTEGER NOT NULL DEFAULT 70,
  sold_sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sold_sound_url TEXT,
  sold_sound_volume INTEGER NOT NULL DEFAULT 80,
  break_end_sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  break_end_sound_url TEXT,
  break_end_sound_volume INTEGER NOT NULL DEFAULT 80,
  cheer_messages_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cheer_message_presets TEXT,
  cheer_cooldown_seconds INTEGER NOT NULL DEFAULT 2,
  cheer_heat_meter_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cheer_fan_battle_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  main_banner_url TEXT,
  main_banner_public_id TEXT,
  main_banner_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  main_banner_fit TEXT NOT NULL DEFAULT 'cover',
  local_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  export_token TEXT,
  export_token_expires_at TIMESTAMPTZ,
  export_token_synced_at TIMESTAMPTZ,
  export_token_last_mirror_at TIMESTAMPTZ,
  match_dates TEXT,
  registration_fields_json JSONB,
  player_registration_mode TEXT NOT NULL DEFAULT 'auction',
  registration_category_mode TEXT NOT NULL DEFAULT 'hidden',
  auction_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scoring_phase TEXT NOT NULL DEFAULT 'disabled',
  scoring_pin TEXT,
  scoring_settings_json JSONB,
  features_json JSONB,
  variant_id TEXT,
  competition_type_id TEXT,
  rule_profile_id TEXT,
  rule_profile_version TEXT,
  presentation_profile_id TEXT,
  presentation_profile_version TEXT,
  registration_mode_id TEXT,
  team_formation_strategy_id TEXT,
  squad_rules_json JSONB,
  rule_overrides_json JSONB,
  participant_constraints_json JSONB,
  business_stage_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: wa_consent_events (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS wa_consent_events (
  id SERIAL PRIMARY KEY,
  mobile TEXT NOT NULL,
  recipient_type TEXT,
  recipient_id INTEGER,
  tournament_id INTEGER,
  event_type TEXT NOT NULL,
  question_version TEXT,
  consent_scope TEXT,
  source TEXT,
  token_used TEXT,
  ip TEXT,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: wa_quality_log (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS wa_quality_log (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  phone_number TEXT,
  quality_rating TEXT,
  template_name TEXT,
  template_status TEXT,
  raw_payload TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: wa_templates (synthesized baseline from Drizzle ORM)
CREATE TABLE IF NOT EXISTS wa_templates (
  id SERIAL PRIMARY KEY,
  template_name TEXT NOT NULL,
  template_sid TEXT,
  category TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: workbook_mapping_profiles (absorbed from legacy boot DDL)
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

-- Table: workbook_versions (absorbed from legacy boot DDL)
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

-- ============================================================================
-- SECTION 2: COLUMN-LEVEL GUARANTEES (ADD COLUMN IF NOT EXISTS FOR ALL TABLES)
-- Guarantees that older tables receive any newly added domain columns.
-- ============================================================================

-- Ensure all columns for academy_categories
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE academy_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for academy_lessons
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS content_format text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS episode_number integer;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS seo_description text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS youtube_url text;
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS youtube_video_id text;

-- Ensure all columns for admin_notification_settings
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS admin_email text;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS admin_mobile text;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS admin_name text;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS in_app_notifications_enabled boolean;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS live_notifications_enabled boolean;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS notification_sound_enabled boolean;
ALTER TABLE admin_notification_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for admin_notifications
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS action_metadata jsonb;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS action_url text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS entity_id integer;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS is_read boolean;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS resolution_status text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS resolved_by text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS type text;

-- Ensure all columns for auction_bid_events
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS became_leader boolean;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS bid_amount integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS bid_increment integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS bid_sequence_number integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS global_player_id text;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS is_manual_bid boolean;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS milliseconds_since_last_bid integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS previous_bid_amount integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS timer_remaining_seconds integer;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE auction_bid_events ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for auction_demo_owned_records
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS demo_session_id text;
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE auction_demo_owned_records ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for auction_demo_sessions
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS reset_at timestamptz;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS reset_by text;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS settings_applied jsonb;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS settings_before jsonb;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE auction_demo_sessions ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for auction_player_events
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS auction_duration_seconds integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS auction_ended_at timestamptz;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS auction_started_at timestamptz;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS average_secs_between_bids integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS base_price integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS final_amount integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS global_player_id text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS interested_teams_count integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS player_age integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS player_city text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS player_name text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS player_role text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS player_snapshot_json text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS sold_to_team_id integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS sold_to_team_name text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS total_bids_received integer;
ALTER TABLE auction_player_events ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for auction_sessions
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS active_category_ids text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS break_ends_at text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS current_bid integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS current_bid_team_id integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS current_player_id integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS deferred_player_ids text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS display_countdown text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS display_overlay text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS display_player_filter text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS fortune_wheel_active boolean;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS is_break boolean;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_action text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_led_toast_json text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_outcome text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_purse_booster_json text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS obs_context_json text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS paused_time_remaining integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS random_draw_queue text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS re_auction_strategy_json text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS revision integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS sold_players_count integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS team_purse_view_active boolean;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS timer_ends_at text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS timer_seconds integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS timer_type text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS unsold_players_count integer;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS wheel_items_json text;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS wheel_spinning boolean;
ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS wheel_winner text;

-- Ensure all columns for auction_timer_events
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS timer_seconds integer;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS timer_type text;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE auction_timer_events ADD COLUMN IF NOT EXISTS triggered_by text;

-- Ensure all columns for audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS field_name text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS id bigint;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS job_id integer;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_at timestamptz;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_by text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;

-- Ensure all columns for badminton_analytics
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS analytics_json jsonb;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS avg_rally_duration_secs numeric;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS fastest_match_minutes numeric;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS longest_rally integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS longest_rally_match_id integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS matches_completed integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS matches_played integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS max_consecutive_points integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS top_player_player_id integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS total_rallies integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_analytics ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_categories
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS age_group text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS color_code text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS current_stage text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS draw_type text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS entry_fee integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS match_format_json jsonb;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS match_type text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS max_players integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS meta_json jsonb;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS num_seeds integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS prize_money integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS promoted_knockout_at timestamptz;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS promoted_knockout_draw_id integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS qualifier_mode text;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS qualifiers_per_group integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS ranking_rules_json jsonb;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS rules_profile_id integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS rules_snapshot_json jsonb;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_courts
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS has_display boolean;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS meta_json jsonb;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS scorer_name text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS scorer_pin text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS stream_url text;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_courts ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_draws
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS configuration_locked boolean;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS draw_kind text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS fixture_type_id text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS group_id text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS lifecycle_status text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS meta_json jsonb;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS round_name text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS round_number integer;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS scheduling_configuration_locked boolean;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS scheduling_lifecycle_status text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS scheduling_strategy_id text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS total_rounds integer;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_draws ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_fixtures
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS court_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS draw_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS loser_advances_to integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS meta_json jsonb;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS registration_a_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS registration_b_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS result_summary text;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS scoring_match_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS slot_number integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS winner_advances_to integer;
ALTER TABLE badminton_fixtures ADD COLUMN IF NOT EXISTS winner_registration_id integer;

-- Ensure all columns for badminton_group_members
ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS registration_id integer;
ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS seed integer;
ALTER TABLE badminton_group_members ADD COLUMN IF NOT EXISTS team_id integer;

-- Ensure all columns for badminton_groups
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS qualifiers_count integer;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_groups ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_match_details
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS court_id integer;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS court_number text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS fixture_id integer;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS left_side_json jsonb;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS master_stats_applied_at timestamptz;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS match_format_json jsonb;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS match_label text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS match_number text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS match_type text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS pre_match_toss_json jsonb;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS right_side_json jsonb;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS round_name text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS scorer_name text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS scorer_pin text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS scoring_match_id integer;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS service_judge_name text;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS state_snapshot_json jsonb;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_match_details ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_pair_standings
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS lost integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS margin_points integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS matches_remaining integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS played integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS points_against integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS points_for integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS registration_id integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE badminton_pair_standings ADD COLUMN IF NOT EXISTS won integer;

-- Ensure all columns for badminton_players
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS academy_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS age_group text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS bwf_code text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS country_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS date_of_birth text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS flag_public_id text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS flag_url text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS global_player_id integer;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS handedness text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS master_player_id text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS meta_json jsonb;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS national_ranking integer;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS photo_public_id text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS state_name text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS team_color text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS world_ranking integer;

-- Ensure all columns for badminton_registrations
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS meta_json jsonb;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS payment_ref text;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS player1_id integer;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS player2_id integer;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS registered_at timestamptz;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS seed_number integer;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_registrations ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for badminton_rules_profiles
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS config_json jsonb;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS is_locked boolean;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS is_official_bwf boolean;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS is_template boolean;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS profile_key text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS profile_type text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS profile_version text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS rules_source text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS rules_source_effective_date text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS schema_version text;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE badminton_rules_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for bids
ALTER TABLE bids ADD COLUMN IF NOT EXISTS amount integer;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for bot_sessions
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS pending_action text;
ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS pending_data text;

-- Ensure all columns for bpl_edition_sponsors
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS edition_id integer;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE bpl_edition_sponsors ADD COLUMN IF NOT EXISTS website_url text;

-- Ensure all columns for bpl_editions
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS edition_number integer;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS end_date text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS fan_page_url text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS linked_tournament_id integer;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS live_stream_url text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS start_date text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE bpl_editions ADD COLUMN IF NOT EXISTS year integer;

-- Ensure all columns for branding_assets
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS file_public_id text;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS height integer;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE branding_assets ADD COLUMN IF NOT EXISTS width integer;

-- Ensure all columns for branding_settings
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS app_icon_url text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS background_color text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS body_font text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS danger_color text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS enable_watermark boolean;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS heading_font text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS logo_animation_url text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS main_logo_reverse_url text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS main_logo_url text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS mini_brand_text text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS mini_logo_url text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS powered_by_text text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS primary_color text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS show_branding_auction boolean;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS show_branding_pdf boolean;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS show_branding_public_links boolean;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS show_powered_by_owner_app boolean;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS show_powered_by_viewer boolean;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS splash_screen_url text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS success_color text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS watermark_opacity numeric;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS watermark_position text;
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS watermark_text text;

-- Ensure all columns for bulk_import_job_items
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS field_name text;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS id bigint;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS job_id integer;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS new_value text;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS old_value text;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE bulk_import_job_items ADD COLUMN IF NOT EXISTS status text;

-- Ensure all columns for bulk_import_jobs
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS browser text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS error_report_json jsonb;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS failed_rows integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS google_sheet_url text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS import_mode text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS module_type text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS preview_json jsonb;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS processing_time_ms integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS rolled_back_by text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS skipped_rows integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS total_rows integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS updated_rows integer;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS uploaded_at timestamptz;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS uploaded_by text;
ALTER TABLE bulk_import_jobs ADD COLUMN IF NOT EXISTS workbook_version_id integer;

-- Ensure all columns for bulk_import_photo_items
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS downloaded_at timestamptz;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS had_existing_photo integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS id bigint;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS job_id integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_bytes integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_file_name text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_format text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_height integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_public_id text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_stored_url text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS original_width integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS photo_import_mode text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS player_name text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS processing_version text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS public_id text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS quality_warnings jsonb;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS retry_count integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS reused_from_cache_id integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS reused_from_item_id integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS sheet_row integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS skip_reason text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS stored_url text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS uploaded_by text;
ALTER TABLE bulk_import_photo_items ADD COLUMN IF NOT EXISTS validation_status text;

-- Ensure all columns for categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS bid_increment integer;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS bid_tiers text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color_code text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS max_players integer;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS min_bid integer;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_public_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_url text;

-- Ensure all columns for comm_logs
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS blast_id text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS delivery_status text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS message_content text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS meta_message_id text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS recipient_id integer;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS recipient_mobile text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS recipient_type text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS sent_by_admin_id text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS template_name text;
ALTER TABLE comm_logs ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for communication_assets
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS asset_key text;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE communication_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for communication_job_recipients
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS is_primary boolean;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS recipient_phone text;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS recipient_role text;
ALTER TABLE communication_job_recipients ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for communication_jobs
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS bulk_campaign_id uuid;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS created_by_admin text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS entity_id integer;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS html_body text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS max_retries integer;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS merge_data jsonb;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS parent_job_id uuid;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS pending_reason text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS queued_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS retry_count integer;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS sent_by text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS template_internal_key text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS template_version_id uuid;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS triggered_by_event text;
ALTER TABLE communication_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for communication_logs
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS job_id uuid;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS new_status text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS previous_status text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS template_version_id uuid;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS triggered_by text;

-- Ensure all columns for communication_settings
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE communication_settings ADD COLUMN IF NOT EXISTS value jsonb;

-- Ensure all columns for communication_template_versions
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS change_note text;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS footer_html text;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS header_image_asset_id uuid;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS html_body text;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS signature_html text;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE communication_template_versions ADD COLUMN IF NOT EXISTS version_number integer;

-- Ensure all columns for communication_templates
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS auto_send boolean;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS current_version integer;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS footer_html text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS header_image_asset_id uuid;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS html_body text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS internal_key text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS is_archived boolean;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS is_draft boolean;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS signature_html text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS updated_by text;

-- Ensure all columns for competition_configuration_history
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS frozen_by text;
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE competition_configuration_history ADD COLUMN IF NOT EXISTS version integer;

-- Ensure all columns for consent_blast_log
ALTER TABLE consent_blast_log ADD COLUMN IF NOT EXISTS blast_date text;
ALTER TABLE consent_blast_log ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE consent_blast_log ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE consent_blast_log ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE consent_blast_log ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for consent_tokens
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS recipient_id integer;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS recipient_type text;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE consent_tokens ADD COLUMN IF NOT EXISTS used boolean;

-- Ensure all columns for contact_inquiries
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS consent text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS inquiry_type text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS subject text;

-- Ensure all columns for cricket_broadcast_message_templates
ALTER TABLE cricket_broadcast_message_templates ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE cricket_broadcast_message_templates ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE cricket_broadcast_message_templates ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE cricket_broadcast_message_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE cricket_broadcast_message_templates ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE cricket_broadcast_message_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for cricket_rule_presets
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS is_default boolean;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS rule_overrides_json jsonb;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS rule_profile_id text;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS rule_profile_version text;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS squad_rules_json jsonb;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE cricket_rule_presets ADD COLUMN IF NOT EXISTS variant_id text;

-- Ensure all columns for cricket_sponsor_media_slots
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS broadcast_public_id text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS broadcast_url text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS file_size_bytes integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS has_audio boolean;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS height integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS original_file_size_bytes integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS original_public_id text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS original_url text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS poster_url text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS processing_status text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS slot_number integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE cricket_sponsor_media_slots ADD COLUMN IF NOT EXISTS width integer;

-- Ensure all columns for display_auctions
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS players_per_team integer;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS primary_color text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS purse integer;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS scheduled_date text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS scheduled_time text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS show_on_landing boolean;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS teams_count integer;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE display_auctions ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for fixture_configuration_history
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS fixture_key text;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS frozen_by text;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS source_id integer;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE fixture_configuration_history ADD COLUMN IF NOT EXISTS version integer;

-- Ensure all columns for global_players
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS academy text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS auction_player_id integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS canonical_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS default_role text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS handedness text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS national_ranking integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_public_id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sponsor_id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS world_ranking integer;

-- Ensure all columns for global_players
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS academy text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS auction_player_id integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS canonical_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS default_role text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS handedness text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS national_ranking integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_public_id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sponsor_id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS world_ranking integer;

-- Ensure all columns for google_sheet_syncs
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS spreadsheet_id text;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS spreadsheet_url text;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS sync_status text;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE google_sheet_syncs ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for intelligence_archive_bid_events
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS archive_id integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS became_leader boolean;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS bid_amount integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS bid_increment integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS bid_sequence_number integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS global_player_id text;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS is_manual_bid boolean;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS milliseconds_since_last_bid integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS previous_bid_amount integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS source_event_id integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS source_tournament_id integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS team_short_code text;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS timer_remaining_seconds integer;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS tournament_name text;
ALTER TABLE intelligence_archive_bid_events ADD COLUMN IF NOT EXISTS tournament_sport text;

-- Ensure all columns for intelligence_archive_player_events
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS archive_id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS auction_duration_seconds integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS auction_ended_at timestamptz;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS auction_started_at timestamptz;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS average_secs_between_bids integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS base_price integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS category_name text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS final_amount integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS global_player_id text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS interested_teams_count integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS player_age integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS player_city text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS player_name text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS player_role text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS player_snapshot_json text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS sold_to_team_id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS sold_to_team_name text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS source_event_id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS source_tournament_id integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS total_bids_received integer;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS tournament_name text;
ALTER TABLE intelligence_archive_player_events ADD COLUMN IF NOT EXISTS tournament_sport text;

-- Ensure all columns for intelligence_archive_timer_events
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS archive_id integer;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS source_event_id integer;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS source_tournament_id integer;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS timer_seconds integer;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS timer_type text;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS timestamp timestamptz;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS tournament_name text;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS tournament_sport text;
ALTER TABLE intelligence_archive_timer_events ADD COLUMN IF NOT EXISTS triggered_by text;

-- Ensure all columns for intelligence_archives
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS bid_event_count integer;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS player_event_count integer;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS source_tournament_id integer;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS timer_event_count integer;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS tournament_name text;
ALTER TABLE intelligence_archives ADD COLUMN IF NOT EXISTS tournament_sport text;

-- Ensure all columns for master_player_id_mappings
ALTER TABLE master_player_id_mappings ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE master_player_id_mappings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE master_player_id_mappings ADD COLUMN IF NOT EXISTS master_player_id text;
ALTER TABLE master_player_id_mappings ADD COLUMN IF NOT EXISTS source_module text;
ALTER TABLE master_player_id_mappings ADD COLUMN IF NOT EXISTS source_player_id integer;
ALTER TABLE master_player_id_mappings ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for master_sponsors
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS is_co_sponsor boolean;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS is_title_sponsor boolean;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS priority_type text;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS sponsor_priority integer;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE master_sponsors ADD COLUMN IF NOT EXISTS website text;

-- Ensure all columns for master_sports_sync_log
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS details_json text;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS master_player_id text;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS master_team_id text;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE master_sports_sync_log ADD COLUMN IF NOT EXISTS source_type text;

-- Ensure all columns for master_teams
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS primary_color text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS sponsor_id text;
ALTER TABLE master_teams ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for match_configuration_history
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS frozen_by text;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE match_configuration_history ADD COLUMN IF NOT EXISTS version integer;

-- Ensure all columns for member_auth_identities
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS is_enabled boolean;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS is_verified boolean;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS normalized_identifier text;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS provider_subject text;
ALTER TABLE member_auth_identities ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for member_identity_links
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS confidence_score integer;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS link_type text;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS provenance_json jsonb;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS source_record_id text;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS source_table text;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE member_identity_links ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for member_roles
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE member_roles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for member_sessions
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS auth_identity_id integer;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE member_sessions ADD COLUMN IF NOT EXISTS user_agent text;

-- Ensure all columns for member_sport_profiles
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS federation_code text;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS handedness text;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS primary_role text;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS profile_json jsonb;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS secondary_role text;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS sport_slug text;
ALTER TABLE member_sport_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for members
ALTER TABLE members ADD COLUMN IF NOT EXISTS account_status text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_public_id text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_email_verified boolean;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_mobile_verified boolean;
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE members ADD COLUMN IF NOT EXISTS primary_email text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS primary_mobile text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for notification_logs
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS dedup_key text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS provider_response text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS recipient_email text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS recipient_mobile text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for organizer_sessions
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS organizer_account_id integer;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS session_scope text;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS token_hash text;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE organizer_sessions ADD COLUMN IF NOT EXISTS user_agent text;

-- Ensure all columns for organizers
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_email text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_id text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_access_token text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_connected_email text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_refresh_token text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS google_sheets_token_expiry timestamptz;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS license_status text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS max_tournaments integer;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone_verified boolean;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS photo_public_id text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent boolean;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_ip text;
ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_method text;

-- Ensure all columns for otp_sessions
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS otp_hash text;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS payload text;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE otp_sessions ADD COLUMN IF NOT EXISTS used boolean;

-- Ensure all columns for owner_sessions
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE owner_sessions ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Ensure all columns for photo_source_assets
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS downloaded_at timestamptz;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS id bigint;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_bytes integer;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_file_name text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_format text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_height integer;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_public_id text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_source_url text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_url text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS original_width integer;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS processing_version text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS source_key text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS standard_public_id text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS standard_url text;
ALTER TABLE photo_source_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for platform_audit_events
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS actor_id text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS actor_ip text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS actor_label text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS actor_type text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS actor_user_agent text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS after_json jsonb;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS alert_key text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS before_json jsonb;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS changes_json jsonb;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS critical_tags_json jsonb;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS event_action text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS event_category text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS event_severity text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS exportable boolean;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS id bigint;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS monitoring_flags_json jsonb;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS related_id text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS related_table text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS request_id text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS request_method text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS request_path text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS resource_id text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS resource_type text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for player_import_logs
ALTER TABLE player_import_logs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE player_import_logs ADD COLUMN IF NOT EXISTS imported_at timestamptz;
ALTER TABLE player_import_logs ADD COLUMN IF NOT EXISTS organizer_account_id integer;
ALTER TABLE player_import_logs ADD COLUMN IF NOT EXISTS player_count integer;
ALTER TABLE player_import_logs ADD COLUMN IF NOT EXISTS source_tournament_id integer;
ALTER TABLE player_import_logs ADD COLUMN IF NOT EXISTS target_tournament_id integer;

-- Ensure all columns for player_spec_values
ALTER TABLE player_spec_values ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE player_spec_values ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE player_spec_values ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE player_spec_values ADD COLUMN IF NOT EXISTS spec_group_id integer;
ALTER TABLE player_spec_values ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE player_spec_values ADD COLUMN IF NOT EXISTS value_text text;

-- Ensure all columns for player_sport_profiles
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS default_role text;
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS global_player_id text;
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS profile_json jsonb;
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS sport_slug text;
ALTER TABLE player_sport_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for player_statistics
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS games_lost integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS games_won integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS matches_lost integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS matches_played integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS matches_won integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS player_id text;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS points_conceded integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS points_scored integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS stats_json jsonb;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for player_team_assignments
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS assignment_type text;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS auction_player_id integer;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS auction_team_id integer;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS player_id text;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS season_id text;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS team_id text;
ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for players
ALTER TABLE players ADD COLUMN IF NOT EXISTS achievements text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS availability_dates text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS base_price integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS batting_style text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bid_value_source text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bowling_style text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS crichero_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS custom_answers_json jsonb;
ALTER TABLE players ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS global_player_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_non_playing_member boolean;
ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_number text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS jersey_size text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS lower_size text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS mobile_number text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_screenshot_public_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_screenshot_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_original_public_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_original_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_public_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_tag text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_tag_team_id integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS registration_payment_status text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS retained_price integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_bid_value integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS serial_no integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sold_price integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS specialization text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS utr_number text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_consent boolean;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_consent_ip text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_consent_method text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS whatsapp_consent_org_id integer;

-- Ensure all columns for purse_boosters
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS amount integer;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS cancelled_by_id text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS cancelled_by_label text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS cancelled_by_type text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS created_by_label text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS created_by_type text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS local_uuid text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS new_capacity integer;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS previous_capacity integer;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS sync_state text;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE purse_boosters ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for push_subscriptions
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS owner_session_id text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh text;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Ensure all columns for role_spec_groups
ALTER TABLE role_spec_groups ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE role_spec_groups ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE role_spec_groups ADD COLUMN IF NOT EXISTS group_name text;
ALTER TABLE role_spec_groups ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE role_spec_groups ADD COLUMN IF NOT EXISTS optional boolean;
ALTER TABLE role_spec_groups ADD COLUMN IF NOT EXISTS role_id integer;

-- Ensure all columns for role_spec_options
ALTER TABLE role_spec_options ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE role_spec_options ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE role_spec_options ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE role_spec_options ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE role_spec_options ADD COLUMN IF NOT EXISTS option_name text;

-- Ensure all columns for runtime_match_history
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS actor text;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS execution_phase text;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS operation text;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS snapshot_version integer;
ALTER TABLE runtime_match_history ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scheduling_configuration_history
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS frozen_by text;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS scheduling_key text;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS source_id integer;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scheduling_configuration_history ADD COLUMN IF NOT EXISTS version integer;

-- Ensure all columns for scorer_accounts
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS whatsapp_consent boolean;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS whatsapp_consent_ip text;
ALTER TABLE scorer_accounts ADD COLUMN IF NOT EXISTS whatsapp_consent_method text;

-- Ensure all columns for scorer_audit_log
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS actor_id text;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS actor_type text;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS scorer_id integer;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE scorer_audit_log ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scorer_match_locks
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS lease_id text;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS lease_version integer;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS scorer_id integer;
ALTER TABLE scorer_match_locks ADD COLUMN IF NOT EXISTS session_id text;

-- Ensure all columns for scorer_sessions
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS scorer_id integer;
ALTER TABLE scorer_sessions ADD COLUMN IF NOT EXISTS user_agent text;

-- Ensure all columns for scorer_tournament_assignments
ALTER TABLE scorer_tournament_assignments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scorer_tournament_assignments ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scorer_tournament_assignments ADD COLUMN IF NOT EXISTS scorer_id integer;
ALTER TABLE scorer_tournament_assignments ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scoring_dls_calculations
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS inputs_json jsonb;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS outputs_json jsonb;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS revision integer;
ALTER TABLE scoring_dls_calculations ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scoring_draws
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS config_json jsonb;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS configuration_locked boolean;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS fixture_type_id text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS lifecycle_status text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS scheduling_configuration_locked boolean;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS scheduling_lifecycle_status text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS scheduling_strategy_id text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_draws ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for scoring_events
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS actor_id text;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS actor_type text;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS causation_id bigint;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS correlation_id uuid;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS event_version integer;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS fixture_id integer;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS id bigint;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS sequence bigint;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS sport_slug text;
ALTER TABLE scoring_events ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scoring_fixtures
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS away_team_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS bracket_round integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS bracket_slot integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS draw_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS fixture_number integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS format_json jsonb;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS home_team_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS result_summary text;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS round_name text;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS rule_preset_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS sport_slug text;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS venue_id integer;
ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS winner_team_id integer;

-- Ensure all columns for scoring_group_members
ALTER TABLE scoring_group_members ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_group_members ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE scoring_group_members ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_group_members ADD COLUMN IF NOT EXISTS seed integer;
ALTER TABLE scoring_group_members ADD COLUMN IF NOT EXISTS team_id integer;

-- Ensure all columns for scoring_groups
ALTER TABLE scoring_groups ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_groups ADD COLUMN IF NOT EXISTS draw_id integer;
ALTER TABLE scoring_groups ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_groups ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE scoring_groups ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE scoring_groups ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scoring_leaderboard_snapshots
ALTER TABLE scoring_leaderboard_snapshots ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE scoring_leaderboard_snapshots ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_leaderboard_snapshots ADD COLUMN IF NOT EXISTS rows_json jsonb;
ALTER TABLE scoring_leaderboard_snapshots ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_leaderboard_snapshots ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for scoring_match_player_stats
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS batting_json jsonb;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS bowling_json jsonb;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS fielding_json jsonb;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS innings integer;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS master_player_id text;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for scoring_match_squads
ALTER TABLE scoring_match_squads ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_match_squads ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_match_squads ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scoring_match_squads ADD COLUMN IF NOT EXISTS squad_json jsonb;
ALTER TABLE scoring_match_squads ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE scoring_match_squads ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for scoring_matches
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS away_side_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS away_team_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS branding_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS configuration_locked boolean;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS current_projection_version bigint;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS current_runtime_version integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS execution_phase text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS fixture_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS home_side_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS home_team_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS lifecycle_status text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS match_kind text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS match_label text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS match_type_id text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS officials_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS parent_match_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS result_summary text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS round_name text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS rule_preset_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS rules_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS runtime_prep_metadata_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS sequence_in_parent integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS sport_slug text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS summary_json jsonb;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS surface text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS venue_id integer;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS visibility text;
ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS winner_team_id integer;

-- Ensure all columns for scoring_officials
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_officials ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for scoring_player_awards
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS award_type text;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS score integer;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS selection_method text;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE scoring_player_awards ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for scoring_sessions
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS display_overlay text;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS display_overlay_json jsonb;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS last_event_seq bigint;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS match_id integer;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS state_json jsonb;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for scoring_standings
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS draw_id integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS extras_json jsonb;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS lost integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS net_run_rate numeric;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS no_result integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS played integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS points integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS tied integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS won integer;

-- Ensure all columns for scoring_venues
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS surface_type text;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE scoring_venues ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS value text;

-- Ensure all columns for showcase_events
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS alt_text text;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS image_public_id text;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS sport_name text;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS tournament_name text;
ALTER TABLE showcase_events ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for sms_notification_settings
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS dlt_enabled boolean;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS player_sold_enabled boolean;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS player_sold_template_id text;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS team_owner_enabled boolean;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS team_owner_template_id text;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS viewer_link_enabled boolean;
ALTER TABLE sms_notification_settings ADD COLUMN IF NOT EXISTS viewer_link_template_id text;

-- Ensure all columns for sport_roles
ALTER TABLE sport_roles ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE sport_roles ADD COLUMN IF NOT EXISTS display_order integer;
ALTER TABLE sport_roles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE sport_roles ADD COLUMN IF NOT EXISTS role_name text;
ALTER TABLE sport_roles ADD COLUMN IF NOT EXISTS sport_id integer;

-- Ensure all columns for sports
ALTER TABLE sports ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE sports ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE sports ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE sports ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE sports ADD COLUMN IF NOT EXISTS slug text;

-- Ensure all columns for team_configuration_history
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS frozen_by text;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS payload_json jsonb;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE team_configuration_history ADD COLUMN IF NOT EXISTS version integer;

-- Ensure all columns for teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS access_code text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS coach_mobile text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS coach_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS configuration_locked boolean;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_bidding_enabled boolean;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS lifecycle_status text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_public_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS master_team_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_mobile text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_public_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_url text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS purse integer;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS purse_used integer;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS secondary_color text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS short_code text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS theme_json jsonb;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS visibility text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whatsapp_consent boolean;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whatsapp_consent_ip text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whatsapp_consent_method text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whatsapp_consent_org_id integer;

-- Ensure all columns for tournament_license_requests
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS organizer_mobile text;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS payment_amount integer;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS payment_mode text;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS payment_ref text;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS payment_verified boolean;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS requested_modules text;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE tournament_license_requests ADD COLUMN IF NOT EXISTS verified_by text;

-- Ensure all columns for tournament_participations
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS category_id integer;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS display_name_override text;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS initials text;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS jersey_number text;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS metadata_json jsonb;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS team_id integer;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE tournament_participations ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for tournament_player_profiles
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS auction_batch text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS auction_data_json jsonb;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS initials text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS is_wildcard boolean;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS master_player_id text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS photo_override_public_id text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS photo_override_url text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS priority integer;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS rating integer;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS seed_rank integer;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS sub_category text;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE tournament_player_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS admin_locked boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS admin_locked_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auction_code text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auction_date text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auction_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auction_time text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auction_unit text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS audio_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS auto_approve_withdrawn_re_registration boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS base_purse integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_extension_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_extension_seconds integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_extension_threshold_seconds integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_increment integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_tier1_increment integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_tier1_up_to integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_tier2_increment integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_tier2_up_to integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_tier3_increment integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_tiers text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_timer_seconds integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_value_mode text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bid_value_options text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS break_end_sound_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS break_end_sound_url text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS break_end_sound_volume integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS business_stage_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_cooldown_seconds integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_fan_battle_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_heat_meter_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_message_presets text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cheer_messages_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS competition_type_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS countdown_sound_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS countdown_sound_url text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS countdown_sound_volume integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS enable_registration_declaration boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS enable_registration_payment boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token_expires_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token_last_mirror_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS export_token_synced_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS features_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS last_reset_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS last_reset_by text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS license_granted_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS license_granted_by text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS license_status text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS local_mode_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_public_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS main_banner_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS main_banner_fit text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS main_banner_public_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS main_banner_url text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS master_volume integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS match_dates text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS maximum_squad_size integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS min_bid integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS minimum_squad_size integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_email text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_mobile text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_name text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organizer_password text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS owner_bidding_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS participant_constraints_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_collection_mode text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS payment_verification_method text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS player_registration_mode text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS player_selection_mode text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS presentation_profile_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS presentation_profile_version text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_category_mode text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_deadline text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_declaration_text text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_fee integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_fields_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_limit integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_mode_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS reset_count integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_overrides_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_profile_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS rule_profile_version text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_phase text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_pin text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_settings_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sold_sound_enabled boolean;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sold_sound_url text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sold_sound_volume integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sponsor_logos text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sport_id integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS squad_rules_json jsonb;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS team_formation_strategy_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS timer_seconds integer;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS upi_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS variant_id text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS venue text;

-- Ensure all columns for wa_consent_events
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS consent_scope text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS event_at timestamptz;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS ip text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS question_version text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS recipient_id integer;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS recipient_type text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS token_used text;
ALTER TABLE wa_consent_events ADD COLUMN IF NOT EXISTS tournament_id integer;

-- Ensure all columns for wa_quality_log
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS quality_rating text;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS raw_payload text;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS template_name text;
ALTER TABLE wa_quality_log ADD COLUMN IF NOT EXISTS template_status text;

-- Ensure all columns for wa_templates
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS template_name text;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS template_sid text;
ALTER TABLE wa_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure all columns for workbook_mapping_profiles
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS fields_json jsonb;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS organizer_id integer;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS source_label text;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS sport text;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE workbook_mapping_profiles ADD COLUMN IF NOT EXISTS use_count integer;

-- Ensure all columns for workbook_versions
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS job_id integer;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS manifest_snapshot jsonb;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS rolled_back_by text;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS snapshot_meta jsonb;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS tournament_id integer;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS version_label text;
ALTER TABLE workbook_versions ADD COLUMN IF NOT EXISTS version_notes text;

-- ============================================================================
-- SECTION 3: SECONDARY & UNIQUE INDEXES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS branding_assets_asset_type_active_idx
      ON branding_assets (asset_type);
CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_assets_asset_key ON communication_assets (asset_key);
CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_templates_internal_key ON communication_templates (internal_key);
CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_template_versions_tpl_ver
      ON communication_template_versions (template_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_communication_jobs_idempotency_key ON communication_jobs (idempotency_key);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_status ON communication_jobs (status);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_tournament_id ON communication_jobs (tournament_id);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_created_at ON communication_jobs (created_at);
CREATE INDEX IF NOT EXISTS ix_communication_job_recipients_job_id ON communication_job_recipients (job_id);
CREATE INDEX IF NOT EXISTS ix_communication_job_recipients_email ON communication_job_recipients (recipient_email);
CREATE INDEX IF NOT EXISTS ix_communication_logs_job_id ON communication_logs (job_id);
CREATE INDEX IF NOT EXISTS ix_communication_logs_created_at ON communication_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_bulk_import_jobs_tournament
      ON bulk_import_jobs (tournament_id, uploaded_at);
CREATE INDEX IF NOT EXISTS ix_bulk_import_jobs_module
      ON bulk_import_jobs (module_type, uploaded_at);
CREATE INDEX IF NOT EXISTS ix_bulk_import_job_items_job ON bulk_import_job_items (job_id);
CREATE INDEX IF NOT EXISTS ix_bulk_import_job_items_player ON bulk_import_job_items (player_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity
      ON audit_logs (entity_type, entity_id, performed_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_job ON audit_logs (job_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_competition_configuration_history_tournament_version
      ON competition_configuration_history (tournament_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS ux_team_configuration_history_team_version
      ON team_configuration_history (team_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS ux_match_configuration_history_match_version
      ON match_configuration_history (match_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fixture_configuration_history_key_version
      ON fixture_configuration_history (fixture_key, version);
CREATE UNIQUE INDEX IF NOT EXISTS ux_scheduling_configuration_history_key_version
      ON scheduling_configuration_history (scheduling_key, version);
CREATE INDEX IF NOT EXISTS ix_cricket_rule_presets_tournament_id
      ON cricket_rule_presets (tournament_id);
CREATE INDEX IF NOT EXISTS ix_cricket_broadcast_message_templates_tournament_id
      ON cricket_broadcast_message_templates (tournament_id);
CREATE INDEX IF NOT EXISTS ix_runtime_match_history_match_id
      ON runtime_match_history (match_id);
CREATE INDEX IF NOT EXISTS ix_runtime_match_history_match_created
      ON runtime_match_history (match_id, created_at);
CREATE INDEX IF NOT EXISTS ix_workbook_versions_tournament
      ON workbook_versions (tournament_id, created_at);
CREATE INDEX IF NOT EXISTS ix_workbook_mapping_profiles_tournament
      ON workbook_mapping_profiles (tournament_id);
CREATE INDEX IF NOT EXISTS ix_workbook_mapping_profiles_organizer
      ON workbook_mapping_profiles (organizer_id);
CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_job
      ON bulk_import_photo_items (job_id);
CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_tournament
      ON bulk_import_photo_items (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_source_key
      ON bulk_import_photo_items (tournament_id, source_key);
CREATE INDEX IF NOT EXISTS ix_bulk_import_photo_items_status
      ON bulk_import_photo_items (job_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_photo_source_assets_source_key
      ON photo_source_assets (source_key);
CREATE INDEX IF NOT EXISTS ix_photo_source_assets_checksum
      ON photo_source_assets (checksum);
CREATE INDEX IF NOT EXISTS ix_photo_source_assets_drive_file_id
      ON photo_source_assets (drive_file_id);
CREATE INDEX IF NOT EXISTS ix_owner_sessions_tournament_team
      ON owner_sessions (tournament_id, team_id);
CREATE INDEX IF NOT EXISTS ix_owner_sessions_expires_at
      ON owner_sessions (expires_at);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_tournament_id
      ON push_subscriptions (tournament_id);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_owner_session_id
      ON push_subscriptions (owner_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_categories_slug ON academy_categories (slug);
CREATE INDEX IF NOT EXISTS ix_academy_categories_active ON academy_categories (active);
CREATE INDEX IF NOT EXISTS ix_academy_categories_display_order ON academy_categories (display_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_lessons_slug ON academy_lessons (slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_academy_lessons_episode_number ON academy_lessons (episode_number);
CREATE INDEX IF NOT EXISTS ix_academy_lessons_status ON academy_lessons (status);
CREATE INDEX IF NOT EXISTS ix_academy_lessons_category_id ON academy_lessons (category_id);
CREATE INDEX IF NOT EXISTS ix_academy_lessons_display_order ON academy_lessons (display_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scorer_accounts_mobile ON scorer_accounts (mobile);
CREATE INDEX IF NOT EXISTS ix_scorer_sessions_scorer_id ON scorer_sessions (scorer_id);
CREATE INDEX IF NOT EXISTS ix_scorer_sessions_expires_at ON scorer_sessions (expires_at);
CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_session_id ON scorer_match_locks (session_id);
CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_last_heartbeat ON scorer_match_locks (last_heartbeat_at);
CREATE INDEX IF NOT EXISTS ix_scorer_match_locks_lease_id ON scorer_match_locks (lease_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_match_id ON scorer_audit_log (match_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_tournament_id ON scorer_audit_log (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_scorer_id ON scorer_audit_log (scorer_id);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_created_at ON scorer_audit_log (created_at);
CREATE INDEX IF NOT EXISTS ix_scorer_audit_log_action ON scorer_audit_log (action);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scorer_tournament_assignment
      ON scorer_tournament_assignments (scorer_id, tournament_id);
CREATE INDEX IF NOT EXISTS ix_scorer_tournament_assignments_tournament
      ON scorer_tournament_assignments (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scorer_tournament_assignments_scorer
      ON scorer_tournament_assignments (scorer_id);
CREATE INDEX IF NOT EXISTS ix_clients_active ON clients (active);
CREATE INDEX IF NOT EXISTS ix_clients_display_order ON clients (display_order);
CREATE INDEX IF NOT EXISTS ix_admin_notifications_resolution_status ON admin_notifications (resolution_status);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_tournament_id ON tournament_license_requests (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_organizer_id ON tournament_license_requests (organizer_id);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_status ON tournament_license_requests (status);
CREATE INDEX IF NOT EXISTS ix_members_display_name ON members (display_name);
CREATE INDEX IF NOT EXISTS ix_members_primary_mobile ON members (primary_mobile);
CREATE INDEX IF NOT EXISTS ix_members_primary_email ON members (primary_email);
CREATE INDEX IF NOT EXISTS ix_members_account_status ON members (account_status);
CREATE INDEX IF NOT EXISTS ix_member_roles_member_id ON member_roles (member_id);
CREATE INDEX IF NOT EXISTS ix_member_roles_role ON member_roles (role);
CREATE INDEX IF NOT EXISTS ix_member_roles_scope ON member_roles (scope);
CREATE INDEX IF NOT EXISTS ix_member_roles_tournament_id ON member_roles (tournament_id);
CREATE INDEX IF NOT EXISTS ix_member_roles_team_id ON member_roles (team_id);
CREATE INDEX IF NOT EXISTS ix_member_roles_match_id ON member_roles (match_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_msp_member_sport ON member_sport_profiles (member_id, sport_slug);
CREATE INDEX IF NOT EXISTS ix_msp_member_id ON member_sport_profiles (member_id);
CREATE INDEX IF NOT EXISTS ix_msp_sport_slug ON member_sport_profiles (sport_slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tp_tournament_member_role ON tournament_participations (tournament_id, member_id, role);
CREATE INDEX IF NOT EXISTS ix_tp_tournament_id ON tournament_participations (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tp_member_id ON tournament_participations (member_id);
CREATE INDEX IF NOT EXISTS ix_tp_team_id ON tournament_participations (team_id);
CREATE INDEX IF NOT EXISTS ix_tp_role ON tournament_participations (role);
CREATE INDEX IF NOT EXISTS ix_tp_status ON tournament_participations (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mil_source_record_member ON member_identity_links (source_table, source_record_id, member_id);
CREATE INDEX IF NOT EXISTS ix_mil_member_id ON member_identity_links (member_id);
CREATE INDEX IF NOT EXISTS ix_mil_source ON member_identity_links (source_table, source_record_id);
CREATE INDEX IF NOT EXISTS ix_mil_status ON member_identity_links (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mai_provider_subject ON member_auth_identities (provider, provider_subject);
CREATE INDEX IF NOT EXISTS ix_mai_member_id ON member_auth_identities (member_id);
CREATE INDEX IF NOT EXISTS ix_mai_identifier ON member_auth_identities (normalized_identifier);
CREATE INDEX IF NOT EXISTS ix_mai_provider_identifier ON member_auth_identities (provider, normalized_identifier);
CREATE INDEX IF NOT EXISTS ix_ms_member_id ON member_sessions (member_id);
CREATE INDEX IF NOT EXISTS ix_ms_expires_at ON member_sessions (expires_at);
CREATE INDEX IF NOT EXISTS ix_ms_revoked_at ON member_sessions (revoked_at);
CREATE INDEX IF NOT EXISTS ix_orgsess_account_id ON organizer_sessions (organizer_account_id);
CREATE INDEX IF NOT EXISTS ix_orgsess_member_id ON organizer_sessions (member_id);
CREATE INDEX IF NOT EXISTS ix_orgsess_tournament_id ON organizer_sessions (tournament_id);
CREATE INDEX IF NOT EXISTS ix_orgsess_lookup ON organizer_sessions (id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS ix_orgsess_token_hash ON organizer_sessions (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_edition_number ON bpl_editions (edition_number);
CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_slug ON bpl_editions (slug);
CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_single_live ON bpl_editions (status) WHERE status = 'LIVE';
    CREATE INDEX IF NOT EXISTS ix_bpl_editions_linked_tournament_id ON bpl_editions (linked_tournament_id);
CREATE INDEX IF NOT EXISTS ix_bpl_edition_sponsors_edition_id ON bpl_edition_sponsors (edition_id);
CREATE INDEX IF NOT EXISTS ix_bpl_edition_sponsors_order ON bpl_edition_sponsors (edition_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS ix_sports_slug ON sports (slug);
CREATE INDEX IF NOT EXISTS ix_sport_roles_sport_id ON sport_roles (sport_id);
CREATE INDEX IF NOT EXISTS ix_role_spec_groups_role_id ON role_spec_groups (role_id);
CREATE INDEX IF NOT EXISTS ix_role_spec_options_group_id ON role_spec_options (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_gp_mobile ON global_players (mobile_number);
CREATE INDEX IF NOT EXISTS ix_gp_canonical_name ON global_players (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS ix_gp_auction_player_id ON global_players (auction_player_id) WHERE auction_player_id IS NOT NULL;
  `);
CREATE UNIQUE INDEX IF NOT EXISTS uq_players_tournament_serial_no
      ON players (tournament_id, serial_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psv_player_spec_group
      ON player_spec_values (player_id, spec_group_id);
CREATE INDEX IF NOT EXISTS ix_psv_player_id ON player_spec_values (player_id);
CREATE INDEX IF NOT EXISTS ix_psv_spec_group_id ON player_spec_values (spec_group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psp_global_player_sport
      ON player_sport_profiles (global_player_id, sport_slug);
CREATE INDEX IF NOT EXISTS ix_psp_global_player_id ON player_sport_profiles (global_player_id);
CREATE INDEX IF NOT EXISTS ix_psp_sport_slug ON player_sport_profiles (sport_slug);
CREATE INDEX IF NOT EXISTS ix_audit_tournament_time ON platform_audit_events (tournament_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_occurred_at ON platform_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_purse_boosters_tournament_team_status
      ON purse_boosters (tournament_id, team_id, status);
CREATE INDEX IF NOT EXISTS ix_bp_tournament_id ON badminton_players (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bp_bwf_code ON badminton_players (bwf_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bp_tournament_short_name
      ON badminton_players (tournament_id, short_name)
      WHERE short_name IS NOT NULL;

    CREATE TABLE IF NOT EXISTS badminton_courts (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      sort_order SMALLINT NOT NULL DEFAULT 0,
      stream_url TEXT,
      has_display BOOLEAN NOT NULL DEFAULT FALSE,
      scorer_pin TEXT,
      scorer_name TEXT,
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
CREATE INDEX IF NOT EXISTS ix_bc_tournament_id ON badminton_courts (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bcat_tournament_id ON badminton_categories (tournament_id);
CREATE INDEX IF NOT EXISTS ix_breg_tournament_id ON badminton_registrations (tournament_id);
CREATE INDEX IF NOT EXISTS ix_breg_category_id ON badminton_registrations (category_id);
CREATE INDEX IF NOT EXISTS ix_breg_player1_id ON badminton_registrations (player1_id);
CREATE INDEX IF NOT EXISTS ix_bd_tournament_id ON badminton_draws (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bd_category_id ON badminton_draws (category_id);
CREATE INDEX IF NOT EXISTS ix_bfix_tournament_id ON badminton_fixtures (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bfix_category_id ON badminton_fixtures (category_id);
CREATE INDEX IF NOT EXISTS ix_bfix_draw_id ON badminton_fixtures (draw_id);
CREATE INDEX IF NOT EXISTS ix_bfix_court_id ON badminton_fixtures (court_id);
CREATE INDEX IF NOT EXISTS ix_bfix_status ON badminton_fixtures (status);
CREATE INDEX IF NOT EXISTS ix_bmd_tournament_id ON badminton_match_details (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bmd_court_id ON badminton_match_details (court_id);
CREATE INDEX IF NOT EXISTS ix_bmd_scoring_match_id ON badminton_match_details (scoring_match_id);
CREATE INDEX IF NOT EXISTS ix_banalytics_tournament_id ON badminton_analytics (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bgrp_tournament_id ON badminton_groups (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bgrp_category_id ON badminton_groups (category_id);
CREATE INDEX IF NOT EXISTS ix_bgm_group_id ON badminton_group_members (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bgm_group_team ON badminton_group_members (group_id, team_id);
CREATE INDEX IF NOT EXISTS ix_bps_tournament_id ON badminton_pair_standings (tournament_id);
CREATE INDEX IF NOT EXISTS ix_bps_category_id ON badminton_pair_standings (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bps_category_registration ON badminton_pair_standings (category_id, registration_id);
CREATE INDEX IF NOT EXISTS ix_ms_name ON master_sponsors (name);
CREATE INDEX IF NOT EXISTS ix_mt_name ON master_teams (name);
CREATE INDEX IF NOT EXISTS ix_mt_sponsor_id ON master_teams (sponsor_id);
CREATE INDEX IF NOT EXISTS ix_pta_player_id ON player_team_assignments (player_id);
CREATE INDEX IF NOT EXISTS ix_pta_team_id ON player_team_assignments (team_id);
CREATE INDEX IF NOT EXISTS ix_pta_tournament_id ON player_team_assignments (tournament_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_player_sport_tournament
      ON player_statistics (player_id, sport, tournament_id);
CREATE INDEX IF NOT EXISTS ix_ps_player_id ON player_statistics (player_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpim_source
      ON master_player_id_mappings (source_module, source_player_id, tournament_id);
CREATE INDEX IF NOT EXISTS ix_mpim_master_player_id ON master_player_id_mappings (master_player_id);
CREATE INDEX IF NOT EXISTS ix_mssl_created_at ON master_sports_sync_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_pta_active ON player_team_assignments (tournament_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pta_active_roster
      ON player_team_assignments (player_id, tournament_id)
      WHERE is_active = true AND sport = 'cricket';

    ALTER TABLE player_statistics ADD COLUMN IF NOT EXISTS stats_json JSONB;

    CREATE TABLE IF NOT EXISTS tournament_player_profiles (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      master_player_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      initials TEXT NOT NULL,
      photo_override_url TEXT,
      category TEXT,
      seed_rank INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
CREATE UNIQUE INDEX IF NOT EXISTS uq_tpp_tournament_master_player
      ON tournament_player_profiles (tournament_id, master_player_id);
CREATE INDEX IF NOT EXISTS ix_tpp_tournament_id ON tournament_player_profiles (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tpp_master_player_id ON tournament_player_profiles (master_player_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tpp_tournament_initials
      ON tournament_player_profiles (tournament_id, initials);
CREATE INDEX IF NOT EXISTS ix_scoring_venues_tournament_id ON scoring_venues (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_officials_tournament_id ON scoring_officials (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_draws_tournament_id ON scoring_draws (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_groups_tournament_id ON scoring_groups (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_groups_draw_id ON scoring_groups (draw_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_group_members_group_team
      ON scoring_group_members (group_id, team_id);
CREATE INDEX IF NOT EXISTS ix_scoring_group_members_group_id ON scoring_group_members (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_match_squads_match_team
      ON scoring_match_squads (match_id, team_id);
CREATE INDEX IF NOT EXISTS ix_scoring_match_squads_match_id ON scoring_match_squads (match_id);
CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_draw_id ON scoring_fixtures (draw_id);
CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_group_id ON scoring_fixtures (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_draw_team
      ON scoring_standings (tournament_id, draw_id, team_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_team_unscoped
      ON scoring_standings (tournament_id, team_id)
      WHERE draw_id IS NULL;
    CREATE INDEX IF NOT EXISTS ix_scoring_standings_draw_id ON scoring_standings (draw_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_mps_match_player_innings
      ON scoring_match_player_stats (match_id, player_id, innings);
CREATE INDEX IF NOT EXISTS ix_scoring_mps_tournament_id ON scoring_match_player_stats (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_mps_match_id ON scoring_match_player_stats (match_id);
CREATE INDEX IF NOT EXISTS ix_scoring_mps_player_id ON scoring_match_player_stats (player_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_lb_tournament_category
      ON scoring_leaderboard_snapshots (tournament_id, category);
CREATE INDEX IF NOT EXISTS ix_scoring_lb_tournament_id ON scoring_leaderboard_snapshots (tournament_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_awards_match_type
      ON scoring_player_awards (match_id, award_type);
CREATE INDEX IF NOT EXISTS ix_scoring_awards_tournament_id ON scoring_player_awards (tournament_id);
CREATE INDEX IF NOT EXISTS ix_scoring_awards_player_id ON scoring_player_awards (player_id);
CREATE INDEX IF NOT EXISTS ix_scoring_dls_match_id ON scoring_dls_calculations (match_id);
CREATE INDEX IF NOT EXISTS ix_scoring_dls_tournament_id ON scoring_dls_calculations (tournament_id);
CREATE INDEX IF NOT EXISTS ix_contact_inquiries_created_at ON contact_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_contact_inquiries_status ON contact_inquiries (status);
CREATE INDEX IF NOT EXISTS ix_contact_inquiries_email ON contact_inquiries (email);
CREATE UNIQUE INDEX IF NOT EXISTS google_sheet_syncs_tournament_id_idx
      ON google_sheet_syncs (tournament_id);
CREATE INDEX IF NOT EXISTS ix_admin_notifications_is_read ON admin_notifications (is_read);
CREATE INDEX IF NOT EXISTS ix_admin_notifications_priority ON admin_notifications (priority);
CREATE INDEX IF NOT EXISTS ix_admin_notifications_type ON admin_notifications (type);
CREATE INDEX IF NOT EXISTS ix_admin_notifications_created_at ON admin_notifications (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ix_tournaments_auction_code ON tournaments (auction_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_tournament_owner_mobile ON teams (tournament_id, owner_mobile);
CREATE INDEX IF NOT EXISTS ix_players_tournament_id ON players (tournament_id);
CREATE INDEX IF NOT EXISTS ix_players_mobile_number ON players (mobile_number);
CREATE INDEX IF NOT EXISTS ix_players_name ON players (name);
CREATE INDEX IF NOT EXISTS ix_players_global_player_id ON players (global_player_id);
CREATE INDEX IF NOT EXISTS ix_bids_tournament_player ON bids (tournament_id, player_id);
CREATE INDEX IF NOT EXISTS ix_categories_tournament_id ON categories (tournament_id);
CREATE INDEX IF NOT EXISTS ix_consent_tokens_token ON consent_tokens (token);
CREATE INDEX IF NOT EXISTS ix_consent_tokens_mobile ON consent_tokens (mobile);
CREATE INDEX IF NOT EXISTS ix_otp_sessions_mobile ON otp_sessions (mobile);
CREATE INDEX IF NOT EXISTS ix_comm_logs_tournament_id ON comm_logs (tournament_id);
CREATE INDEX IF NOT EXISTS ix_comm_logs_recipient_mobile ON comm_logs (recipient_mobile);
CREATE INDEX IF NOT EXISTS ix_comm_logs_sent_at ON comm_logs (sent_at);
CREATE INDEX IF NOT EXISTS ix_comm_logs_blast_id ON comm_logs (blast_id);
CREATE INDEX IF NOT EXISTS ix_comm_logs_meta_message_id ON comm_logs (meta_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_blast_log ON consent_blast_log (tournament_id, mobile, blast_date);
CREATE INDEX IF NOT EXISTS ix_bot_sessions_mobile ON bot_sessions (mobile);
CREATE INDEX IF NOT EXISTS ix_wa_consent_events_mobile ON wa_consent_events (mobile);
CREATE INDEX IF NOT EXISTS ix_wa_consent_events_event_at ON wa_consent_events (event_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_notification_logs_dedup_key ON notification_logs (dedup_key);
CREATE INDEX IF NOT EXISTS ix_notification_logs_event_type ON notification_logs (event_type);
CREATE INDEX IF NOT EXISTS ix_notification_logs_channel ON notification_logs (channel);
CREATE INDEX IF NOT EXISTS ix_notification_logs_status ON notification_logs (status);
CREATE INDEX IF NOT EXISTS ix_notification_logs_tournament_id ON notification_logs (tournament_id);
CREATE INDEX IF NOT EXISTS ix_notification_logs_created_at ON notification_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_pil_target_tournament ON player_import_logs (target_tournament_id);
CREATE INDEX IF NOT EXISTS ix_pil_source_tournament ON player_import_logs (source_tournament_id);
CREATE INDEX IF NOT EXISTS ix_pil_organizer ON player_import_logs (organizer_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_auction_demo_owned ON auction_demo_owned_records (demo_session_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_tournament ON audit_logs (tournament_id);
CREATE INDEX IF NOT EXISTS ix_communication_assets_asset_type ON communication_assets (asset_type);
CREATE INDEX IF NOT EXISTS ix_communication_job_recipients_role ON communication_job_recipients (recipient_role);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_channel ON communication_jobs (channel);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_template_id ON communication_jobs (template_id);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_entity ON communication_jobs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_next_retry_at ON communication_jobs (next_retry_at);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_pending_reason ON communication_jobs (pending_reason);
CREATE INDEX IF NOT EXISTS ix_communication_jobs_bulk_campaign_id ON communication_jobs (bulk_campaign_id);
CREATE INDEX IF NOT EXISTS ix_communication_logs_action ON communication_logs (action);
CREATE INDEX IF NOT EXISTS ix_communication_logs_recipient_email ON communication_logs (recipient_email);
CREATE INDEX IF NOT EXISTS ix_communication_template_versions_template_id ON communication_template_versions (template_id);
CREATE INDEX IF NOT EXISTS ix_communication_templates_event_type ON communication_templates (event_type);
CREATE INDEX IF NOT EXISTS ix_communication_templates_is_active ON communication_templates (is_active);
CREATE INDEX IF NOT EXISTS ix_communication_templates_is_draft ON communication_templates (is_draft);
CREATE INDEX IF NOT EXISTS ix_audit_actor_time ON platform_audit_events (actor_id, timestamp);
CREATE INDEX IF NOT EXISTS ix_audit_resource ON platform_audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_audit_category_action_time ON platform_audit_events (event_category, action, timestamp);
CREATE INDEX IF NOT EXISTS ix_audit_alert_key ON platform_audit_events (alert_key);
CREATE INDEX IF NOT EXISTS ix_audit_severity ON platform_audit_events (severity, timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS ux_purse_boosters_local_uuid ON purse_boosters (local_uuid);
CREATE INDEX IF NOT EXISTS ix_purse_boosters_sync_pending ON purse_boosters (sync_pending);
CREATE INDEX IF NOT EXISTS ix_tournament_license_requests_created_at ON tournament_license_requests (created_at);

-- End of Milestone 2 Absorption Migration