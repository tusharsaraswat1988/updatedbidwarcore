import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { resolveDatabaseUrl } from "./database-url";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });
export const db = drizzle(pool, { schema });

/** Idempotent column adds so new fields persist without a manual migrate step. */
void pool
  .query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_url text`)
  .catch((err) => {
    console.error("[db] failed to ensure teams.owner_photo_url column:", err);
  });

void pool
  .query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS email text`)
  .catch((err) => {
    console.error("[db] failed to ensure players.email column:", err);
  });

void pool
  .query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email text`)
  .catch((err) => {
    console.error("[db] failed to ensure teams.owner_email column:", err);
  });

/** Ensure platform audit table exists (append-only investigation trail). */
void pool
  .query(`
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
    CREATE INDEX IF NOT EXISTS ix_audit_tournament_time ON platform_audit_events (tournament_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS ix_audit_occurred_at ON platform_audit_events (occurred_at DESC);
    ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS critical_tags_json JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS monitoring_flags_json JSONB;
  `)
  .catch((err) => {
    console.error("[db] failed to ensure platform_audit_events table:", err);
  });

void pool
  .query(`
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
    CREATE INDEX IF NOT EXISTS ix_purse_boosters_tournament_team_status
      ON purse_boosters (tournament_id, team_id, status);
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_purse_booster_json TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS last_led_toast_json TEXT;
    ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS random_draw_queue TEXT;
  `)
  .catch((err) => {
    console.error("[db] failed to ensure purse_boosters table:", err);
  });

/** Badminton tournament management tables */
void pool
  .query(`
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
      meta_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_bc_tournament_id ON badminton_courts (tournament_id);

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
    CREATE INDEX IF NOT EXISTS ix_bcat_tournament_id ON badminton_categories (tournament_id);

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
    CREATE INDEX IF NOT EXISTS ix_breg_tournament_id ON badminton_registrations (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_breg_category_id ON badminton_registrations (category_id);
    CREATE INDEX IF NOT EXISTS ix_breg_player1_id ON badminton_registrations (player1_id);

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
    CREATE INDEX IF NOT EXISTS ix_bd_tournament_id ON badminton_draws (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_bd_category_id ON badminton_draws (category_id);

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
    CREATE INDEX IF NOT EXISTS ix_bfix_tournament_id ON badminton_fixtures (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_bfix_category_id ON badminton_fixtures (category_id);
    CREATE INDEX IF NOT EXISTS ix_bfix_draw_id ON badminton_fixtures (draw_id);
    CREATE INDEX IF NOT EXISTS ix_bfix_court_id ON badminton_fixtures (court_id);
    CREATE INDEX IF NOT EXISTS ix_bfix_status ON badminton_fixtures (status);

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
      referee_name TEXT,
      umpire_name TEXT,
      service_judge_name TEXT,
      state_snapshot_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_bmd_tournament_id ON badminton_match_details (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_bmd_court_id ON badminton_match_details (court_id);
    CREATE INDEX IF NOT EXISTS ix_bmd_scoring_match_id ON badminton_match_details (scoring_match_id);

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
    CREATE INDEX IF NOT EXISTS ix_banalytics_tournament_id ON badminton_analytics (tournament_id);
  `)
  .catch((err) => {
    console.error("[db] failed to ensure badminton tables:", err);
  });

/** Master Sports Core — shared player/team/sponsor identity */
void pool
  .query(`
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS dob TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS academy TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS handedness TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS world_ranking INTEGER;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS national_ranking INTEGER;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sponsor_id TEXT;
    ALTER TABLE global_players ADD COLUMN IF NOT EXISTS auction_player_id INTEGER;
    CREATE UNIQUE INDEX IF NOT EXISTS ix_gp_auction_player_id ON global_players (auction_player_id) WHERE auction_player_id IS NOT NULL;

    ALTER TABLE teams ADD COLUMN IF NOT EXISTS master_team_id TEXT;

    ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS master_player_id TEXT;
    CREATE INDEX IF NOT EXISTS ix_bp_master_player_id ON badminton_players (master_player_id);

    CREATE TABLE IF NOT EXISTS master_sponsors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      website TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_ms_name ON master_sponsors (name);

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
    CREATE INDEX IF NOT EXISTS ix_mt_name ON master_teams (name);
    CREATE INDEX IF NOT EXISTS ix_mt_sponsor_id ON master_teams (sponsor_id);

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
    CREATE INDEX IF NOT EXISTS ix_pta_player_id ON player_team_assignments (player_id);
    CREATE INDEX IF NOT EXISTS ix_pta_team_id ON player_team_assignments (team_id);
    CREATE INDEX IF NOT EXISTS ix_pta_tournament_id ON player_team_assignments (tournament_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_pta_player_team_tournament
      ON player_team_assignments (player_id, team_id, tournament_id);

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
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_player_sport_tournament
      ON player_statistics (player_id, sport, tournament_id);
    CREATE INDEX IF NOT EXISTS ix_ps_player_id ON player_statistics (player_id);

    CREATE TABLE IF NOT EXISTS master_player_id_mappings (
      id SERIAL PRIMARY KEY,
      source_module TEXT NOT NULL,
      source_player_id INTEGER NOT NULL,
      master_player_id TEXT NOT NULL,
      tournament_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_mpim_source
      ON master_player_id_mappings (source_module, source_player_id, tournament_id);
    CREATE INDEX IF NOT EXISTS ix_mpim_master_player_id ON master_player_id_mappings (master_player_id);

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
    CREATE INDEX IF NOT EXISTS ix_mssl_created_at ON master_sports_sync_log (created_at DESC);

    ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'auction_sale';
    ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE player_team_assignments ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS ix_pta_active ON player_team_assignments (tournament_id, is_active);
    DROP INDEX IF EXISTS uq_pta_player_team_tournament;
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

    INSERT INTO tournament_player_profiles (
      tournament_id, master_player_id, display_name, initials, photo_override_url
    )
    SELECT
      bp.tournament_id,
      bp.master_player_id,
      COALESCE(bp.display_name, bp.first_name || ' ' || bp.last_name, 'Player'),
      COALESCE(NULLIF(TRIM(bp.short_name), ''), 'P'),
      bp.photo_url
    FROM badminton_players bp
    WHERE bp.master_player_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM tournament_player_profiles tpp
        WHERE tpp.tournament_id = bp.tournament_id
          AND tpp.master_player_id = bp.master_player_id
      );
  `)
  .catch((err) => {
    console.error("[db] failed to ensure master sports tables:", err);
  });

/** Cricket scoring Phase 1 — venues, officials, draws, groups, match squads */
void pool
  .query(`
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
    CREATE INDEX IF NOT EXISTS ix_scoring_venues_tournament_id ON scoring_venues (tournament_id);

    CREATE TABLE IF NOT EXISTS scoring_officials (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'umpire',
      mobile TEXT,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_scoring_officials_tournament_id ON scoring_officials (tournament_id);

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
    CREATE INDEX IF NOT EXISTS ix_scoring_draws_tournament_id ON scoring_draws (tournament_id);

    CREATE TABLE IF NOT EXISTS scoring_groups (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL,
      draw_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_scoring_groups_tournament_id ON scoring_groups (tournament_id);
    CREATE INDEX IF NOT EXISTS ix_scoring_groups_draw_id ON scoring_groups (draw_id);

    CREATE TABLE IF NOT EXISTS scoring_group_members (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      seed SMALLINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_group_members_group_team
      ON scoring_group_members (group_id, team_id);
    CREATE INDEX IF NOT EXISTS ix_scoring_group_members_group_id ON scoring_group_members (group_id);

    CREATE TABLE IF NOT EXISTS scoring_match_squads (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      squad_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_match_squads_match_team
      ON scoring_match_squads (match_id, team_id);
    CREATE INDEX IF NOT EXISTS ix_scoring_match_squads_match_id ON scoring_match_squads (match_id);

    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS draw_id INTEGER;
    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS group_id INTEGER;
    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS bracket_round INTEGER;
    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS bracket_slot INTEGER;
    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS venue_id INTEGER;
    CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_draw_id ON scoring_fixtures (draw_id);
    CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_group_id ON scoring_fixtures (group_id);

    ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS venue_id INTEGER;
    ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS officials_json JSONB;
  `)
  .catch((err) => {
    console.error("[db] failed to ensure cricket scoring phase 1 tables:", err);
  });

export * from "./schema";
