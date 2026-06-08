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

export * from "./schema";
