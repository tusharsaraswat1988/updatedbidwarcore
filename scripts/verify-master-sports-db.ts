#!/usr/bin/env npx tsx
/** Apply master sports bootstrap SQL and verify tables/columns exist. */

import pg from "pg";
import { resolveDatabaseUrl } from "../lib/db/src/database-url";

const BOOTSTRAP_SQL = `
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
`;

const REQUIRED_TABLES = [
  "master_sponsors",
  "master_teams",
  "player_team_assignments",
  "player_statistics",
  "master_player_id_mappings",
  "master_sports_sync_log",
];

const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "global_players", column: "first_name" },
  { table: "global_players", column: "auction_player_id" },
  { table: "teams", column: "master_team_id" },
  { table: "badminton_players", column: "master_player_id" },
];

async function main() {
  const pool = new pg.Pool({ connectionString: resolveDatabaseUrl() });

  try {
    console.log("Applying master sports bootstrap SQL…");
    await pool.query(BOOTSTRAP_SQL);
    console.log("Bootstrap applied.");

    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );
    const found = new Set(tables.rows.map((r) => r.tablename));
    const missingTables = REQUIRED_TABLES.filter((t) => !found.has(t));

    const colChecks: string[] = [];
    for (const { table, column } of REQUIRED_COLUMNS) {
      const r = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        ) AS exists`,
        [table, column],
      );
      if (!r.rows[0]?.exists) colChecks.push(`${table}.${column}`);
    }

    if (missingTables.length || colChecks.length) {
      console.error("VERIFICATION FAILED");
      if (missingTables.length) console.error("Missing tables:", missingTables.join(", "));
      if (colChecks.length) console.error("Missing columns:", colChecks.join(", "));
      process.exit(1);
    }

    console.log("VERIFICATION OK — all master sports tables and key columns present.");
    process.exit(0);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
