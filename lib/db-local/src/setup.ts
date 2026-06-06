import type { Client } from "@libsql/client";

export async function setupTables(client: Client): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sport TEXT NOT NULL DEFAULT 'cricket',
      venue TEXT,
      auction_date TEXT,
      organizer_name TEXT,
      organizer_mobile TEXT,
      organizer_email TEXT,
      logo_url TEXT,
      sponsor_logos TEXT,
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
      bid_timer_seconds INTEGER NOT NULL DEFAULT 15,
      player_selection_mode TEXT NOT NULL DEFAULT 'sequential',
      status TEXT NOT NULL DEFAULT 'setup',
      cloud_id INTEGER,
      cloud_base_url TEXT,
      export_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      short_code TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_mobile TEXT,
      color TEXT DEFAULT '#3B82F6',
      logo_url TEXT,
      purse INTEGER NOT NULL DEFAULT 10000000,
      purse_used INTEGER NOT NULL DEFAULT 0,
      is_bidding_enabled INTEGER NOT NULL DEFAULT 1,
      access_code TEXT,
      cloud_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      category_id INTEGER,
      team_id INTEGER,
      name TEXT NOT NULL,
      city TEXT,
      role TEXT,
      batting_style TEXT,
      bowling_style TEXT,
      age INTEGER,
      photo_url TEXT,
      base_price INTEGER NOT NULL DEFAULT 100000,
      sold_price INTEGER,
      retained_price INTEGER,
      status TEXT NOT NULL DEFAULT 'available',
      jersey_number TEXT,
      achievements TEXT,
      mobile_number TEXT,
      crichero_url TEXT,
      availability_dates TEXT,
      specialization TEXT,
      cloud_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      min_bid INTEGER NOT NULL DEFAULT 100000,
      bid_increment INTEGER,
      max_players INTEGER,
      color_code TEXT DEFAULT '#F59E0B',
      sort_order INTEGER NOT NULL DEFAULT 0,
      cloud_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auction_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'idle',
      current_player_id INTEGER,
      current_bid INTEGER,
      current_bid_team_id INTEGER,
      timer_seconds INTEGER,
      timer_ends_at TEXT,
      last_action TEXT,
      is_break INTEGER NOT NULL DEFAULT 0,
      break_ends_at TEXT,
      fortune_wheel_active INTEGER NOT NULL DEFAULT 0,
      wheel_spinning INTEGER NOT NULL DEFAULT 0,
      team_purse_view_active INTEGER NOT NULL DEFAULT 0,
      display_overlay TEXT,
      wheel_items_json TEXT,
      wheel_winner TEXT,
      active_category_ids TEXT,
      paused_time_remaining INTEGER,
      display_countdown TEXT,
      sold_players_count INTEGER NOT NULL DEFAULT 0,
      unsold_players_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT,
      failed INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
  `);

  // Run schema migrations for existing databases (ALTER TABLE ADD COLUMN is idempotent via try-catch)
  const migrations = [
    "ALTER TABLE tournaments ADD COLUMN cloud_base_url TEXT",
    "ALTER TABLE tournaments ADD COLUMN export_token TEXT",
    "ALTER TABLE tournaments ADD COLUMN local_mode_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE tournaments ADD COLUMN operator_pin TEXT",
    "ALTER TABLE auction_sessions ADD COLUMN wheel_spinning INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE auction_sessions ADD COLUMN display_overlay TEXT",
    "ALTER TABLE auction_sessions ADD COLUMN display_countdown TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_tournament_owner_mobile ON teams (tournament_id, owner_mobile)",
  ];
  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists — expected for existing databases
    }
  }
}
