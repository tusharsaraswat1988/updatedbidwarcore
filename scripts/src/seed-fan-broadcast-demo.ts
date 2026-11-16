import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db, tournamentsTable, scoringMatchesTable } from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

async function main() {
  console.log("Seeding Tournament 10 with Fan Arena curation & broadcast settings...");

  const featuresJson = {
    visibility: "public",
    fanArenaOptIn: true,
    broadcast: {
      scoring: {
        enabled: true,
        url: "https://www.youtube.com/watch?v=live123",
        status: "live",
        title: "BidWar Champions Trophy LIVE Broadcast",
      },
      auction: {
        enabled: true,
        url: "https://www.youtube.com/watch?v=auction456",
        status: "upcoming",
        title: "Player Auction Stream",
      },
    },
    matchBroadcasts: {
      "39": {
        enabled: true,
        url: "https://www.youtube.com/watch?v=match39live",
        status: "live",
        title: "Match #5 Court Live Feed",
      },
    },
  };

  await db
    .update(tournamentsTable)
    .set({
      featuresJson,
      licenseStatus: "active",
      status: "active",
      auctionEnabled: true,
      scoringEnabled: true,
    })
    .where(eq(tournamentsTable.id, 10));

  await db
    .update(scoringMatchesTable)
    .set({
      brandingJson: {
        broadcast: {
          enabled: true,
          url: "https://www.youtube.com/watch?v=match39live",
          status: "live",
          title: "Match #5 Court Live Feed",
        },
      },
    })
    .where(eq(scoringMatchesTable.id, 39));

  console.log("Successfully seeded Tournament 10 and Match 39!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
