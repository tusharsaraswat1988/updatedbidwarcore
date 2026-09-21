import pg from "file:///d:/bidwar/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  // 1. Fetch match 55
  const matchRes = await client.query("SELECT * FROM scoring_matches WHERE id = 55");
  const match = matchRes.rows[0];
  console.log("Match 55 status:", match.status);
  console.log("Match 55 rules_json:", match.rules_json);

  // 2. Fetch events
  const eventsRes = await client.query("SELECT * FROM scoring_events WHERE match_id = 55 ORDER BY sequence ASC");
  console.log("Events count:", eventsRes.rows.length);

  // 3. Let's see what happens if someone wants to DELETE match 55
  // Remember deleteCricketMatch check:
  // if (match.status !== "scheduled" || match.startedAt !== null) -> throws MATCH_ALREADY_STARTED!
  console.log("Match started_at:", match.started_at);
  console.log("Match status:", match.status);

  // 4. In edit match (CricketMatchCenter or CricketFixtures):
  // Let's see why user said:
  // "edit ke option me aise koi data nahi aa raha hai is match ka ki isko hum edit kar sake. ya delete kar sake."

  await client.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
