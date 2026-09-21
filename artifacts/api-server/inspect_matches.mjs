import pg from "file:///d:/bidwar/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log("=== CHECK TOURNAMENT 25 ===");
  const tourney = await client.query("SELECT * FROM tournaments WHERE id = 25");
  console.log("Tournament 25:", tourney.rows[0]);

  console.log("=== CHECK TEAMS 54 & 55 ===");
  const teams = await client.query("SELECT * FROM teams WHERE id IN (54, 55)");
  console.log("Teams:", teams.rows);

  console.log("=== CHECK PLAYERS 369, 370, 371, 372 ===");
  const players = await client.query("SELECT id, name, team_id, tournament_id FROM players WHERE id IN (369, 370, 371, 372)");
  console.log("Players:", players.rows);

  console.log("=== CHECK ALL PLAYERS IN TOURNAMENT 25 ===");
  const allPlayers = await client.query("SELECT id, name, team_id, tournament_id FROM players WHERE tournament_id = 25");
  console.log("Total players in tournament 25:", allPlayers.rows.length);

  console.log("=== CHECK SCORING SQUADS FOR MATCH 55 ===");
  const squads = await client.query("SELECT * FROM scoring_match_squads WHERE match_id = 55");
  console.log("Squads:", squads.rows);

  console.log("=== CHECK SCORER MATCH LOCKS FOR MATCH 55 ===");
  const locks = await client.query("SELECT * FROM scorer_match_locks WHERE match_id = 55");
  console.log("Locks:", locks.rows);

  console.log("=== CHECK RUNTIME MATCH HISTORY FOR MATCH 55 ===");
  const history = await client.query("SELECT * FROM runtime_match_history WHERE match_id = 55");
  console.log("Runtime match history count:", history.rows.length);
  if (history.rows.length > 0) {
    console.log("Latest runtime match history:", history.rows[history.rows.length - 1]);
  }

  await client.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
