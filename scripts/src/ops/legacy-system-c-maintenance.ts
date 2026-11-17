/**
 * ============================================================================
 * BIDWAR HISTORICAL SYSTEM C MAINTENANCE & BACKFILL SCRIPT
 * ============================================================================
 * Relocated from lib/db/src/index.ts as part of Milestone 2 Database Stabilization.
 *
 * This script contains one-time DML backfills and cleanup routines that previously
 * executed asynchronously on module import. These operations perform table-level
 * writes and must NEVER execute during web server boot or hot request paths.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/ops/legacy-system-c-maintenance.ts
 * ============================================================================
 */

import { loadAppEnv } from "@workspace/db/load-app-env";
import { resolveDirectDatabaseUrl } from "@workspace/db/database-url";
import pg from "pg";

loadAppEnv();

const { Client } = pg;
const client = new Client({
  connectionString: resolveDirectDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});

async function runMaintenance(): Promise<void> {
  console.log("[maintenance] Connecting to database...");
  await client.connect();

  try {
    // 1. Backfill player serial numbers
    console.log("[maintenance] 1/5 Backfilling player serial_no...");
    await client.query("BEGIN");
    await client.query(`
      UPDATE players p
      SET serial_no = sub.row_num
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY tournament_id ORDER BY id ASC) as row_num
        FROM players
      ) sub
      WHERE p.id = sub.id AND p.serial_no IS NULL;

      UPDATE players SET serial_no = id WHERE serial_no IS NULL;
    `);
    await client.query("COMMIT");
    console.log("[maintenance] Player serial numbers backfilled.");

    // 2. Backfill team access codes
    console.log("[maintenance] 2/5 Backfilling team access codes...");
    await client.query("BEGIN");
    await client.query(`
      UPDATE teams
      SET access_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
      WHERE access_code IS NULL;
    `);
    await client.query("COMMIT");
    console.log("[maintenance] Team access codes backfilled.");

    // 3. Backfill badminton match details and scoring officials
    console.log("[maintenance] 3/5 Backfilling badminton scorer pins...");
    await client.query("BEGIN");
    await client.query(`
      UPDATE badminton_match_details
      SET scorer_pin = LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0')
      WHERE scorer_pin IS NULL;
    `);
    await client.query("COMMIT");
    console.log("[maintenance] Badminton scorer pins backfilled.");

    // 4. Clean duplicate player team assignments
    console.log("[maintenance] 4/5 De-duplicating player team assignments...");
    await client.query("BEGIN");
    await client.query(`
      DELETE FROM player_team_assignments a
      USING (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY tournament_id, player_id ORDER BY joined_at DESC, id DESC) as rnk
        FROM player_team_assignments
        WHERE is_active = true
      ) ranked
      WHERE a.id = ranked.id AND ranked.rnk > 1;
    `);
    await client.query("COMMIT");
    console.log("[maintenance] Duplicate player team assignments cleaned.");

    // 5. Backfill tournament player profiles from badminton players
    console.log("[maintenance] 5/5 Backfilling tournament player profiles...");
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO tournament_player_profiles (
        tournament_id, player_id, global_player_id, display_name, role_name,
        sport, registration_status, created_at, updated_at
      )
      SELECT
        bp.tournament_id, bp.id, bp.global_player_id, bp.name, 'Player',
        'badminton', 'active', NOW(), NOW()
      FROM badminton_players bp
      WHERE NOT EXISTS (
        SELECT 1 FROM tournament_player_profiles tpp
        WHERE tpp.tournament_id = bp.tournament_id AND tpp.player_id = bp.id
      )
      ON CONFLICT DO NOTHING;
    `);
    await client.query("COMMIT");
    console.log("[maintenance] Tournament player profiles backfilled.");

    console.log("[maintenance] All maintenance operations completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[maintenance] Failed during maintenance operations:", err);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

runMaintenance()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
