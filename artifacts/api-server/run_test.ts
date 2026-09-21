import { getScoringMatch } from "./src/lib/scoring-service";
import { getPublicMatchScorecard } from "./src/lib/scoring-stats-service";

async function main() {
  console.log("Testing getScoringMatch(25, 55)...");
  try {
    const res = await getScoringMatch(25, 55);
    console.log("getScoringMatch SUCCESS!");
    console.log("Match status:", res.match.status);
    console.log("State status:", res.state.matchStatus);
  } catch (e) {
    console.error("getScoringMatch FAILED:", e);
  }

  console.log("\nTesting getPublicMatchScorecard(25, 55)...");
  try {
    const sc = await getPublicMatchScorecard(25, 55);
    console.log("getPublicMatchScorecard SUCCESS!");
    console.log("Scorecard:", sc);
  } catch (e) {
    console.error("getPublicMatchScorecard FAILED:", e);
  }
}

main().catch(console.error);
