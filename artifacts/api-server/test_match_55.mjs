import { getScoringMatch } from "./dist/lib/scoring-service.js";

async function test() {
  try {
    const res = await getScoringMatch(25, 55);
    console.log("Success! Match state:", JSON.stringify(res.state, null, 2));
  } catch (err) {
    console.error("Error in getScoringMatch(25, 55):", err);
  }
}

test();
