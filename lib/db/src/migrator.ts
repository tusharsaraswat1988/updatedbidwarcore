import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { findRepoRoot } from "./repo-root.js";

export type MigrationResult = {
  totalMigrations: number;
  appliedCount: number;
  alreadyAppliedCount: number;
  appliedFiles: string[];
};

const EMBEDDED_MIGRATIONS: Record<string, string> = {
  "0022_cricket_rule_presets.sql": `
    ALTER TABLE scoring_fixtures ADD COLUMN IF NOT EXISTS rule_preset_id integer;
    ALTER TABLE scoring_matches ADD COLUMN IF NOT EXISTS rule_preset_id integer;

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

    CREATE INDEX IF NOT EXISTS ix_cricket_rule_presets_tournament_id
      ON cricket_rule_presets (tournament_id);
  `,
  "0023_cricket_broadcast_message_templates.sql": `
    CREATE TABLE IF NOT EXISTS cricket_broadcast_message_templates (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name text NOT NULL,
      details text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ix_cricket_broadcast_message_templates_tournament_id
      ON cricket_broadcast_message_templates (tournament_id);
  `,
  "0025_bpl_editions.sql": `
    CREATE TABLE IF NOT EXISTS bpl_editions (
      id serial PRIMARY KEY,
      name text NOT NULL,
      edition_number integer NOT NULL,
      slug text NOT NULL,
      year integer NOT NULL,
      start_date text NOT NULL,
      end_date text NOT NULL,
      venue text,
      city text,
      description text,
      status text NOT NULL DEFAULT 'DRAFT',
      linked_tournament_id integer REFERENCES tournaments(id) ON DELETE SET NULL,
      live_stream_url text,
      fan_page_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_edition_number ON bpl_editions (edition_number);
    CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_slug ON bpl_editions (slug);
    CREATE UNIQUE INDEX IF NOT EXISTS ix_bpl_editions_single_live ON bpl_editions (status) WHERE status = 'LIVE';
    CREATE INDEX IF NOT EXISTS ix_bpl_editions_linked_tournament_id ON bpl_editions (linked_tournament_id);
  `,
  "0027_cricket_draw_standings.sql": `
    ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS draw_id integer;

    UPDATE scoring_standings AS s
    SET draw_id = sub.draw_id
    FROM (
      SELECT gm.team_id, g.tournament_id, MIN(g.draw_id) AS draw_id
      FROM scoring_group_members gm
      JOIN scoring_groups g ON g.id = gm.group_id
      GROUP BY gm.team_id, g.tournament_id
      HAVING COUNT(DISTINCT g.draw_id) = 1
    ) AS sub
    WHERE s.team_id = sub.team_id
      AND s.tournament_id = sub.tournament_id
      AND s.draw_id IS NULL;

    DROP INDEX IF EXISTS uq_scoring_standings_tournament_team;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_draw_team
      ON scoring_standings (tournament_id, draw_id, team_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_team_unscoped
      ON scoring_standings (tournament_id, team_id)
      WHERE draw_id IS NULL;

    CREATE INDEX IF NOT EXISTS ix_scoring_standings_draw_id
      ON scoring_standings (draw_id);
  `,
  "0026_bpl_edition_sponsors.sql": `
    CREATE TABLE IF NOT EXISTS bpl_edition_sponsors (
      id serial PRIMARY KEY,
      edition_id integer NOT NULL REFERENCES bpl_editions(id) ON DELETE CASCADE,
      name text NOT NULL,
      logo_url text NOT NULL,
      category text NOT NULL DEFAULT 'PARTNER',
      website_url text,
      display_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ix_bpl_edition_sponsors_edition_id ON bpl_edition_sponsors (edition_id);
    CREATE INDEX IF NOT EXISTS ix_bpl_edition_sponsors_order ON bpl_edition_sponsors (edition_id, display_order);
  `,
  "0032_auction_demo_sessions.sql": `
    CREATE TABLE IF NOT EXISTS auction_demo_sessions (
      id text PRIMARY KEY,
      tournament_id integer NOT NULL,
      organizer_id integer NOT NULL,
      status text NOT NULL DEFAULT 'loaded',
      settings_before jsonb NOT NULL DEFAULT '{}'::jsonb,
      settings_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      reset_at timestamptz,
      reset_by text,
      CONSTRAINT chk_auction_demo_sessions_status CHECK (status IN ('loaded', 'resetting', 'reset'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_auction_demo_sessions_one_loaded
      ON auction_demo_sessions (tournament_id)
      WHERE status = 'loaded';
    CREATE INDEX IF NOT EXISTS ix_auction_demo_sessions_tournament
      ON auction_demo_sessions (tournament_id);
    CREATE TABLE IF NOT EXISTS auction_demo_owned_records (
      id serial PRIMARY KEY,
      demo_session_id text NOT NULL REFERENCES auction_demo_sessions(id) ON DELETE CASCADE,
      tournament_id integer NOT NULL,
      entity_type text NOT NULL,
      entity_id text NOT NULL,
      media_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_auction_demo_owned UNIQUE (demo_session_id, entity_type, entity_id)
    );
    CREATE INDEX IF NOT EXISTS ix_auction_demo_owned_session
      ON auction_demo_owned_records (demo_session_id);
    CREATE INDEX IF NOT EXISTS ix_auction_demo_owned_tournament
      ON auction_demo_owned_records (tournament_id);
  `,
  "0033_ensure_global_players_and_master_sports.sql": `
-- BidWar Canonical Migration 0033: Ensure Global Players & Master Sports Core
--
-- Codifies master sports, global players, role specifications, and multi-sport
-- profile tables into versioned migrations.
-- Safe, additive, and fully idempotent across all environments.

-- 1. Sports master table
CREATE TABLE IF NOT EXISTS sports (
  id serial PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_sports_slug ON sports (slug);

-- 2. Sport roles (e.g. Batsman, Bowler, Raider, Setter)
CREATE TABLE IF NOT EXISTS sport_roles (
  id serial PRIMARY KEY,
  sport_id integer NOT NULL,
  role_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ix_sport_roles_sport_id ON sport_roles (sport_id);

-- 3. Role specification groups (e.g. Batting Hand, Bowling Style)
CREATE TABLE IF NOT EXISTS role_spec_groups (
  id serial PRIMARY KEY,
  role_id integer NOT NULL,
  group_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  optional boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ix_role_spec_groups_role_id ON role_spec_groups (role_id);

-- 4. Role specification options (e.g. Right Hand, Left Hand)
CREATE TABLE IF NOT EXISTS role_spec_options (
  id serial PRIMARY KEY,
  group_id integer NOT NULL,
  option_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS ix_role_spec_options_group_id ON role_spec_options (group_id);

-- 5. Global Players (canonical person identity across tournaments)
CREATE TABLE IF NOT EXISTS global_players (
  id text PRIMARY KEY,
  canonical_name text NOT NULL,
  first_name text,
  last_name text,
  display_name text,
  mobile_number text,
  email text,
  dob text,
  gender text,
  country text,
  state text,
  city text,
  academy text,
  handedness text,
  world_ranking integer,
  national_ranking integer,
  sponsor_id text,
  auction_player_id integer,
  sport text NOT NULL DEFAULT 'cricket',
  default_role text,
  age integer,
  photo_url text,
  photo_public_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_gp_mobile ON global_players (mobile_number);
CREATE INDEX IF NOT EXISTS ix_gp_canonical_name ON global_players (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS ix_gp_auction_player_id ON global_players (auction_player_id) WHERE auction_player_id IS NOT NULL;

-- Ensure all columns exist if table was partially created previously
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS academy text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS handedness text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS world_ranking integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS national_ranking integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS sponsor_id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS auction_player_id integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS default_role text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS photo_public_id text;
ALTER TABLE global_players ADD COLUMN IF NOT EXISTS notes text;

-- 6. Master Sponsors & Master Teams
CREATE TABLE IF NOT EXISTS master_sponsors (
  id text PRIMARY KEY,
  name text NOT NULL,
  logo_url text,
  website text,
  description text,
  is_title_sponsor boolean NOT NULL DEFAULT false,
  is_co_sponsor boolean NOT NULL DEFAULT false,
  sponsor_priority integer NOT NULL DEFAULT 0,
  priority_type text NOT NULL DEFAULT 'NORMAL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ms_name ON master_sponsors (name);

CREATE TABLE IF NOT EXISTS master_teams (
  id text PRIMARY KEY,
  name text NOT NULL,
  short_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  owner_name text,
  sponsor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mt_name ON master_teams (name);
CREATE INDEX IF NOT EXISTS ix_mt_sponsor_id ON master_teams (sponsor_id);

-- 7. Player Sport Profiles
CREATE TABLE IF NOT EXISTS player_sport_profiles (
  id serial PRIMARY KEY,
  global_player_id text NOT NULL REFERENCES global_players(id) ON DELETE CASCADE,
  sport_slug text NOT NULL REFERENCES sports(slug),
  default_role text,
  profile_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psp_global_player_sport ON player_sport_profiles (global_player_id, sport_slug);
CREATE INDEX IF NOT EXISTS ix_psp_global_player_id ON player_sport_profiles (global_player_id);
CREATE INDEX IF NOT EXISTS ix_psp_sport_slug ON player_sport_profiles (sport_slug);

-- 8. Player Spec Values
CREATE TABLE IF NOT EXISTS player_spec_values (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  spec_group_id integer NOT NULL REFERENCES role_spec_groups(id),
  value_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psv_player_spec_group ON player_spec_values (player_id, spec_group_id);
CREATE INDEX IF NOT EXISTS ix_psv_player_id ON player_spec_values (player_id);
CREATE INDEX IF NOT EXISTS ix_psv_spec_group_id ON player_spec_values (spec_group_id);

-- 9. Player Team Assignments
CREATE TABLE IF NOT EXISTS player_team_assignments (
  id serial PRIMARY KEY,
  player_id text NOT NULL,
  team_id text NOT NULL,
  tournament_id integer,
  season_id text,
  sport text NOT NULL DEFAULT 'cricket',
  assignment_type text NOT NULL DEFAULT 'auction_sale',
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  auction_player_id integer,
  auction_team_id integer
);
CREATE INDEX IF NOT EXISTS ix_pta_player_id ON player_team_assignments (player_id);
CREATE INDEX IF NOT EXISTS ix_pta_team_id ON player_team_assignments (team_id);
CREATE INDEX IF NOT EXISTS ix_pta_tournament_id ON player_team_assignments (tournament_id);
CREATE INDEX IF NOT EXISTS ix_pta_active ON player_team_assignments (tournament_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pta_active_roster
  ON player_team_assignments (player_id, tournament_id)
  WHERE is_active = true AND sport = 'cricket';

-- 10. Player Statistics
CREATE TABLE IF NOT EXISTS player_statistics (
  id serial PRIMARY KEY,
  player_id text NOT NULL,
  sport text NOT NULL DEFAULT 'badminton',
  tournament_id integer,
  matches_played integer NOT NULL DEFAULT 0,
  matches_won integer NOT NULL DEFAULT 0,
  matches_lost integer NOT NULL DEFAULT 0,
  games_won integer NOT NULL DEFAULT 0,
  games_lost integer NOT NULL DEFAULT 0,
  points_scored integer NOT NULL DEFAULT 0,
  points_conceded integer NOT NULL DEFAULT 0,
  stats_json jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_player_sport_tournament
  ON player_statistics (player_id, sport, tournament_id);
CREATE INDEX IF NOT EXISTS ix_ps_player_id ON player_statistics (player_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ps_cricket_career
  ON player_statistics (player_id)
  WHERE tournament_id IS NULL AND sport = 'cricket';

-- 11. Master Player ID Mappings & Sync Log
CREATE TABLE IF NOT EXISTS master_player_id_mappings (
  id serial PRIMARY KEY,
  source_module text NOT NULL,
  source_player_id integer NOT NULL,
  master_player_id text NOT NULL,
  tournament_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mpim_source
  ON master_player_id_mappings (source_module, source_player_id, tournament_id);
CREATE INDEX IF NOT EXISTS ix_mpim_master_player_id ON master_player_id_mappings (master_player_id);

CREATE TABLE IF NOT EXISTS master_sports_sync_log (
  id serial PRIMARY KEY,
  action text NOT NULL,
  source_type text NOT NULL,
  source_id text,
  master_player_id text,
  master_team_id text,
  details_json text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_mssl_created_at ON master_sports_sync_log (created_at DESC);

-- 12. Tournament Player Profiles
CREATE TABLE IF NOT EXISTS tournament_player_profiles (
  id serial PRIMARY KEY,
  tournament_id integer NOT NULL,
  master_player_id text NOT NULL,
  display_name text NOT NULL,
  initials text NOT NULL,
  photo_override_url text,
  photo_override_public_id text,
  category text,
  sub_category text,
  seed_rank integer,
  auction_batch text,
  rating integer,
  priority integer,
  remarks text,
  is_wildcard boolean NOT NULL DEFAULT false,
  auction_data_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tpp_tournament_master_player
  ON tournament_player_profiles (tournament_id, master_player_id);
CREATE INDEX IF NOT EXISTS ix_tpp_tournament_id ON tournament_player_profiles (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tpp_master_player_id ON tournament_player_profiles (master_player_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tpp_tournament_initials
  ON tournament_player_profiles (tournament_id, initials);

-- 13. Cross-module column additions
ALTER TABLE teams ADD COLUMN IF NOT EXISTS master_team_id text;
ALTER TABLE badminton_players ADD COLUMN IF NOT EXISTS master_player_id text;
CREATE INDEX IF NOT EXISTS ix_bp_master_player_id ON badminton_players (master_player_id);

ALTER TABLE scoring_match_player_stats ADD COLUMN IF NOT EXISTS master_player_id text;
CREATE INDEX IF NOT EXISTS ix_scoring_mps_master_player_id ON scoring_match_player_stats (master_player_id);

-- 14. Seed initial sports if empty
INSERT INTO sports (name, slug, active)
SELECT seed.name, seed.slug, true
FROM (
  VALUES
    ('Cricket', 'cricket'),
    ('Football', 'football'),
    ('Kabaddi', 'kabaddi'),
    ('Badminton', 'badminton'),
    ('Volleyball', 'volleyball'),
    ('E-Sports', 'esports'),
    ('Other', 'other')
) AS seed(name, slug)
WHERE NOT EXISTS (SELECT 1 FROM sports LIMIT 1);

  `,
};

function resolveMigrationsDirectory(explicit?: string): string | null {
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates: string[] = [
    path.resolve(process.cwd(), "lib/db/migrations"),
    "/app/lib/db/migrations",
    path.resolve(process.cwd(), "migrations"),
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = findRepoRoot(currentDir);
    candidates.unshift(path.resolve(repoRoot, "lib/db/migrations"));
  } catch {
    // ignore repoRoot walk error if run from single-bundle environment
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function runVersionedMigrations(
  client: pg.Client | pg.PoolClient,
  options: {
    log?: (msg: string) => void;
    migrationsDir?: string;
  } = {},
): Promise<MigrationResult> {
  const log = options.log ?? console.log;

  const migrationsDir = resolveMigrationsDirectory(options.migrationsDir);
  if (!migrationsDir) {
    log("[migrate] Migrations directory not found on disk — using embedded migrations.");
  } else {
    log(`[migrate] Using migrations directory at: ${migrationsDir}`);
  }

  // 1. Ensure migration ledger tables exist in both drizzle schema and public schema
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Fetch all applied migration hashes
  const drizzleRows = await client.query<{ hash: string }>(
    `SELECT hash FROM drizzle.__drizzle_migrations`,
  );
  const publicRows = await client.query<{ hash: string }>(
    `SELECT hash FROM __drizzle_migrations`,
  );

  const appliedSet = new Set<string>();
  for (const r of drizzleRows.rows) appliedSet.add(r.hash);
  for (const r of publicRows.rows) appliedSet.add(r.hash);

  // 3. Read and sort all versioned migration files or fall back to embedded migrations
  const migrationItems: { file: string; sql: string }[] = [];

  if (migrationsDir) {
    try {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        migrationItems.push({
          file,
          sql: fs.readFileSync(path.join(migrationsDir, file), "utf8"),
        });
      }
    } catch (readErr) {
      log(`[migrate] Warning reading migrations directory: ${readErr}`);
    }
  }

  // Ensure embedded migrations are always present as fallback
  for (const [file, sql] of Object.entries(EMBEDDED_MIGRATIONS)) {
    if (!migrationItems.some((item) => item.file === file)) {
      migrationItems.push({ file, sql });
    }
  }

  migrationItems.sort((a, b) => a.file.localeCompare(b.file));

  const appliedFiles: string[] = [];
  let alreadyAppliedCount = 0;

  for (const item of migrationItems) {
    const { file, sql } = item;
    const fileBase = file.replace(/\.sql$/, "");
    const isApplied = appliedSet.has(file) || appliedSet.has(fileBase);

    if (isApplied) {
      alreadyAppliedCount++;
      continue;
    }

    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING`,
        [file],
      );
      await client.query(
        `INSERT INTO __drizzle_migrations (hash) VALUES ($1) ON CONFLICT (hash) DO NOTHING`,
        [file],
      );
      await client.query("COMMIT");

      log(`[migrate] applied: ${file}`);
      appliedFiles.push(file);
      appliedSet.add(file);
      appliedSet.add(fileBase);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`[migrate] FAILED on ${file}:`, err);
      throw new Error(
        `Migration failed on ${file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  log(
    `[migrate] complete. Total: ${migrationItems.length}, Newly applied: ${appliedFiles.length}, Already up-to-date: ${alreadyAppliedCount}`,
  );

  return {
    totalMigrations: migrationItems.length,
    appliedCount: appliedFiles.length,
    alreadyAppliedCount,
    appliedFiles,
  };
}
