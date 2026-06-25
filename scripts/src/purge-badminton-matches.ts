/**
 * Deletes all badminton scoring matches and related rows.
 * Usage: pnpm --filter @workspace/scripts run purge:badminton-matches
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  pool,
  badmintonAnalyticsTable,
  badmintonFixturesTable,
  badmintonMatchDetailsTable,
  scoringEventsTable,
  scoringMatchesTable,
  scoringSessionsTable,
} from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

async function main() {
  const tournamentFilter = process.argv[2]?.trim();
  const tournamentId = tournamentFilter ? Number.parseInt(tournamentFilter, 10) : null;
  if (tournamentFilter && (!Number.isFinite(tournamentId) || tournamentId! <= 0)) {
    console.error("Usage: purge-badminton-matches.ts [tournamentId]");
    process.exit(1);
  }

  const matchQuery = db
    .select({ id: scoringMatchesTable.id, tournamentId: scoringMatchesTable.tournamentId, status: scoringMatchesTable.status })
    .from(scoringMatchesTable)
    .where(
      tournamentId
        ? sql`${scoringMatchesTable.sportSlug} = 'badminton' AND ${scoringMatchesTable.tournamentId} = ${tournamentId}`
        : sql`${scoringMatchesTable.sportSlug} = 'badminton'`,
    );

  const matches = await matchQuery;
  if (matches.length === 0) {
    console.log(
      tournamentId
        ? `No badminton matches found for tournament ${tournamentId}.`
        : "No badminton matches found.",
    );
    await pool.end();
    return;
  }

  const matchIds = matches.map((m) => m.id);
  const liveCount = matches.filter((m) => m.status === "live").length;

  console.log(
    `Purging ${matchIds.length} badminton match(es)${tournamentId ? ` in tournament ${tournamentId}` : ""}` +
      (liveCount > 0 ? ` (${liveCount} live — forced delete)` : "") +
      "...",
  );

  await db.transaction(async (tx) => {
    await tx
      .update(badmintonFixturesTable)
      .set({ scoringMatchId: null, updatedAt: new Date() })
      .where(inArray(badmintonFixturesTable.scoringMatchId, matchIds));

    await tx
      .update(badmintonAnalyticsTable)
      .set({ longestRallyMatchId: null, updatedAt: new Date() })
      .where(inArray(badmintonAnalyticsTable.longestRallyMatchId, matchIds));

    await tx.delete(scoringSessionsTable).where(inArray(scoringSessionsTable.matchId, matchIds));
    await tx.delete(scoringEventsTable).where(inArray(scoringEventsTable.matchId, matchIds));
    await tx.delete(badmintonMatchDetailsTable).where(inArray(badmintonMatchDetailsTable.scoringMatchId, matchIds));
    await tx.delete(scoringMatchesTable).where(inArray(scoringMatchesTable.id, matchIds));
  });

  console.log(`Done. Deleted ${matchIds.length} match(es): ${matchIds.join(", ")}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Purge failed:", err instanceof Error ? err.message : err);
  void pool.end();
  process.exit(1);
});
