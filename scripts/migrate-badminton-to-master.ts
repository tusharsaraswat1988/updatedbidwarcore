#!/usr/bin/env npx tsx
/**
 * CLI: migrate badminton players to MasterPlayer (global_players).
 *
 * Usage:
 *   npx tsx scripts/migrate-badminton-to-master.ts [tournamentId]
 *
 * Omit tournamentId to migrate all badminton tournaments.
 */

import { migrateBadmintonPlayersToMaster, ensureStatisticsForMigratedPlayers } from "../artifacts/api-server/src/lib/master-sports/migrate-badminton";
import { db } from "../lib/db/src/index";
import { tournamentsTable } from "../lib/db/src/schema/tournaments";
import { eq } from "drizzle-orm";

async function main() {
  const arg = process.argv[2];
  const tournamentId = arg ? parseInt(arg, 10) : undefined;

  if (arg && Number.isNaN(tournamentId)) {
    console.error("Invalid tournament id:", arg);
    process.exit(1);
  }

  let tournamentIds: number[];

  if (tournamentId) {
    tournamentIds = [tournamentId];
  } else {
    const rows = await db
      .select({ id: tournamentsTable.id })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.sport, "badminton"));
    tournamentIds = rows.map((r) => r.id);
  }

  console.log(`Migrating ${tournamentIds.length} tournament(s)…`);

  for (const tid of tournamentIds) {
    console.log(`\n── Tournament ${tid} ──`);
    const result = await migrateBadmintonPlayersToMaster(tid);
    const stats = await ensureStatisticsForMigratedPlayers(tid);
    console.log(JSON.stringify({ ...result, statisticsRowsCreated: stats }, null, 2));
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
