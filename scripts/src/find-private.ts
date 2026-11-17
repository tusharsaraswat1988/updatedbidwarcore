import { db, tournamentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const privateT = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        featuresJson: tournamentsTable.featuresJson,
      })
      .from(tournamentsTable)
      .where(sql`${tournamentsTable.featuresJson}->>'visibility' = 'private'`)
      .limit(5);

    console.log("Private tournaments found:", JSON.stringify(privateT, null, 2));
  } catch (err) {
    console.error("Error querying tournaments:", err);
  }
}

run();
