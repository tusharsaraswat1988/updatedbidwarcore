import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
});
import pg from "pg";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

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
