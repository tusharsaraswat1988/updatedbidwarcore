import pg from "file:///d:/bidwar/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log("=== PRE-CLEANUP: Check Match #55 status ===");
  const pre = await client.query("SELECT id, status, started_at FROM scoring_matches WHERE id = 55");
  console.log("Match #55:", pre.rows[0]);

  const events = await client.query("SELECT COUNT(*) FROM scoring_events WHERE match_id = 55");
  console.log("Events for match 55:", events.rows[0].count);

  const sessions = await client.query("SELECT COUNT(*) FROM scoring_sessions WHERE match_id = 55");
  console.log("Sessions for match 55:", sessions.rows[0].count);

  console.log("\n=== RUNNING CLEANUP ===");
  await client.query("BEGIN");
  try {
    // Delete dependent rows first
    const r1 = await client.query("DELETE FROM scoring_events WHERE match_id = 55");
    console.log("Deleted scoring_events:", r1.rowCount);

    const r2 = await client.query("DELETE FROM scoring_sessions WHERE match_id = 55");
    console.log("Deleted scoring_sessions:", r2.rowCount);

    const r3 = await client.query("DELETE FROM scoring_match_squads WHERE match_id = 55");
    console.log("Deleted scoring_match_squads:", r3.rowCount);

    const r4 = await client.query("DELETE FROM scoring_match_player_stats WHERE match_id = 55");
    console.log("Deleted scoring_match_player_stats:", r4.rowCount);

    const r5 = await client.query("DELETE FROM scoring_player_awards WHERE match_id = 55");
    console.log("Deleted scoring_player_awards:", r5.rowCount);

    // Check if these tables exist before trying to delete
    try {
      const r6 = await client.query("DELETE FROM scoring_dls_calculations WHERE match_id = 55");
      console.log("Deleted scoring_dls_calculations:", r6.rowCount);
    } catch (e) { console.log("scoring_dls_calculations: table not found or no rows"); }

    try {
      const r7 = await client.query("DELETE FROM match_configuration_history WHERE match_id = 55");
      console.log("Deleted match_configuration_history:", r7.rowCount);
    } catch (e) { console.log("match_configuration_history: table not found or no rows"); }

    const r8 = await client.query("DELETE FROM runtime_match_history WHERE match_id = 55");
    console.log("Deleted runtime_match_history:", r8.rowCount);

    const r9 = await client.query("DELETE FROM scorer_match_locks WHERE match_id = 55");
    console.log("Deleted scorer_match_locks:", r9.rowCount);

    // Finally delete the match itself
    const r10 = await client.query("DELETE FROM scoring_matches WHERE id = 55 AND tournament_id = 25");
    console.log("Deleted scoring_matches:", r10.rowCount);

    await client.query("COMMIT");
    console.log("\n✅ COMMIT successful. Match #55 deleted.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ ROLLBACK. Error:", err.message);
    throw err;
  }

  console.log("\n=== POST-CLEANUP: Verify Match #55 is gone ===");
  const post = await client.query("SELECT id, status FROM scoring_matches WHERE id = 55");
  console.log("Match #55 rows:", post.rows.length, "(should be 0)");

  console.log("\n=== Remaining matches in tournament 25 ===");
  const remaining = await client.query("SELECT id, status, scheduled_at, started_at FROM scoring_matches WHERE tournament_id = 25 ORDER BY id");
  console.log("Matches:", remaining.rows);

  await client.end();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
