import pg from "file:///d:/bidwar/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log("=== CHECK ALL PLAYERS FOR TOURNAMENT 25 ===");
  const p = await client.query("SELECT * FROM players WHERE tournament_id = 25");
  console.log(JSON.stringify(p.rows, null, 2));

  console.log("=== CHECK PLAYER_TEAM_ASSIGNMENTS ===");
  const pta = await client.query("SELECT * FROM player_team_assignments WHERE tournament_id = 25");
  console.log(JSON.stringify(pta.rows, null, 2));

  console.log("=== CHECK TOURNAMENT_PLAYER_PROFILES ===");
  const tpp = await client.query("SELECT * FROM tournament_player_profiles WHERE tournament_id = 25");
  console.log(JSON.stringify(tpp.rows, null, 2));

  await client.end();
}

main().catch(console.error);
