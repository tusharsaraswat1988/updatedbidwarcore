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

export * from "./schema";
