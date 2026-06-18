import { loadAppEnv } from "@workspace/db/load-app-env";
import pg from "pg";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const env = loadAppEnv();
if (!env.loaded) {
  console.error(
    `[migrate] Missing ${env.file} at ${env.path} (NODE_ENV=${env.nodeEnv}).`,
  );
  process.exit(1);
}
console.log(`[migrate] using ${env.file} (${env.nodeEnv})`);

const { Client } = pg;

const client = new Client({
  connectionString: resolveDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const migrations: Array<{ label: string; sql: string }> = [
  {
    label: "organizers_google_id_unique",
    sql: `ALTER TABLE organizers ADD CONSTRAINT organizers_google_id_unique UNIQUE (google_id)`,
  },
  {
    label: "teams_tournament_owner_mobile_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_tournament_owner_mobile ON teams (tournament_id, owner_mobile)`,
  },
  {
    label: "teams_owner_photo_url",
    sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_photo_url text`,
  },
  {
    label: "players_email",
    sql: `ALTER TABLE players ADD COLUMN IF NOT EXISTS email text`,
  },
  {
    label: "teams_owner_email",
    sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_email text`,
  },
  {
    label: "create_platform_audit_events",
    sql: `
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
        exportable BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE INDEX IF NOT EXISTS ix_audit_tournament_time ON platform_audit_events (tournament_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS ix_audit_actor_time ON platform_audit_events (actor_type, actor_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS ix_audit_resource ON platform_audit_events (resource_type, resource_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS ix_audit_category_action_time ON platform_audit_events (event_category, event_action, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS ix_audit_occurred_at ON platform_audit_events (occurred_at DESC);
      CREATE INDEX IF NOT EXISTS ix_audit_alert_key ON platform_audit_events (alert_key, occurred_at DESC) WHERE alert_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS ix_audit_severity ON platform_audit_events (event_severity, occurred_at DESC);
    `,
  },
  {
    label: "platform_audit_monitoring_columns",
    sql: `
      ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS critical_tags_json JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE platform_audit_events ADD COLUMN IF NOT EXISTS monitoring_flags_json JSONB;
    `,
  },
  {
    label: "create_sessions_table",
    sql: `
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid"    varchar      NOT NULL COLLATE "default",
        "sess"   json         NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON "sessions" ("expire");
    `,
  },
  {
    label: "tournaments_scoring_columns",
    sql: `
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_phase text NOT NULL DEFAULT 'disabled';
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_pin text;
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS scoring_settings_json jsonb;
    `,
  },
  {
    label: "create_scoring_fixtures",
    sql: `
      CREATE TABLE IF NOT EXISTS scoring_fixtures (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL,
        sport_slug TEXT NOT NULL DEFAULT 'cricket',
        fixture_number INTEGER,
        round_name TEXT,
        scheduled_at TIMESTAMPTZ,
        venue TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        format_json JSONB,
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        winner_team_id INTEGER,
        result_summary TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_tournament_id ON scoring_fixtures (tournament_id);
      CREATE INDEX IF NOT EXISTS ix_scoring_fixtures_tournament_status ON scoring_fixtures (tournament_id, status);
    `,
  },
  {
    label: "create_scoring_matches",
    sql: `
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
        venue TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        home_team_id INTEGER NOT NULL,
        away_team_id INTEGER NOT NULL,
        home_side_json JSONB,
        away_side_json JSONB,
        rules_json JSONB,
        winner_team_id INTEGER,
        result_summary TEXT,
        summary_json JSONB,
        current_projection_version BIGINT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ix_scoring_matches_tournament_id ON scoring_matches (tournament_id);
      CREATE INDEX IF NOT EXISTS ix_scoring_matches_fixture_id ON scoring_matches (fixture_id);
      CREATE INDEX IF NOT EXISTS ix_scoring_matches_tournament_status ON scoring_matches (tournament_id, status);
    `,
  },
  {
    label: "create_scoring_sessions",
    sql: `
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
      CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_sessions_match_id ON scoring_sessions (match_id);
    `,
  },
  {
    label: "create_scoring_events",
    sql: `
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
      CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_events_match_sequence ON scoring_events (match_id, sequence);
      CREATE INDEX IF NOT EXISTS ix_scoring_events_match_id ON scoring_events (match_id);
      CREATE INDEX IF NOT EXISTS ix_scoring_events_tournament_id ON scoring_events (tournament_id);
    `,
  },
  {
    label: "create_scoring_standings",
    sql: `
      CREATE TABLE IF NOT EXISTS scoring_standings (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL,
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
      CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_team ON scoring_standings (tournament_id, team_id);
      CREATE INDEX IF NOT EXISTS ix_scoring_standings_tournament_id ON scoring_standings (tournament_id);
    `,
  },
  {
    label: "create_purse_boosters",
    sql: `
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
    `,
  },
  {
    label: "auction_sessions_random_draw_queue",
    sql: `
      ALTER TABLE auction_sessions ADD COLUMN IF NOT EXISTS random_draw_queue TEXT;
    `,
  },
  {
    label: "tournaments_features_json",
    sql: `
      ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS features_json jsonb;
    `,
  },
  {
    label: "tournaments_and_organizers_core_v2",
    sql: `
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

      ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent boolean NOT NULL DEFAULT false;
      ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamptz;
      ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_method text;
      ALTER TABLE organizers ADD COLUMN IF NOT EXISTS whatsapp_consent_ip text;
      ALTER TABLE organizers ADD COLUMN IF NOT EXISTS photo_url text;
    `,
  },
];

for (const m of migrations) {
  try {
    await client.query(m.sql);
    console.log(`[migrate] applied: ${m.label}`);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "42710" || code === "42P07") {
      console.log(`[migrate] already exists, skipping: ${m.label}`);
    } else {
      await client.end();
      throw e;
    }
  }
}

await client.end();
process.exit(0);
