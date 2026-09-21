import pg from "file:///d:/bidwar/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";
import { buildCricketScorecardFromEvents } from "file:///d:/bidwar/lib/scoring-core/dist/cricket/scorecard.js";

const { Client } = pg;
const connectionString = "postgresql://neondb_owner:npg_AWDr7xFbVzB2@ep-late-math-aohd4iep.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  const matchRes = await client.query("SELECT * FROM scoring_matches WHERE id = 55");
  const match = matchRes.rows[0];

  const eventsRes = await client.query("SELECT * FROM scoring_events WHERE match_id = 55 ORDER BY sequence ASC");
  const events = eventsRes.rows.map(r => ({
    id: r.id,
    matchId: r.match_id,
    tournamentId: r.tournament_id,
    fixtureId: r.fixture_id,
    sportSlug: r.sport_slug,
    eventType: r.event_type,
    eventVersion: r.event_version,
    sequence: parseInt(r.sequence, 10),
    occurredAt: r.occurred_at,
    actorType: r.actor_type,
    actorId: r.actor_id,
    correlationId: r.correlation_id,
    causationId: r.causation_id,
    payload: r.payload_json
  }));

  console.log("Building scorecard from events...");
  try {
    const sc = buildCricketScorecardFromEvents(55, events, {
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id
    });
    console.log("Scorecard built successfully:", sc);
  } catch (err) {
    console.error("Scorecard build FAILED:", err);
  }

  await client.end();
}

main().catch(console.error);
