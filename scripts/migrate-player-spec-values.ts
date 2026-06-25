#!/usr/bin/env npx tsx
/**
 * Backfill player_spec_values from legacy players columns.
 *
 * Usage:
 *   npx tsx scripts/migrate-player-spec-values.ts [--dry-run] [tournamentId]
 *
 * Idempotent: skips players that already have normalized rows.
 */

import { eq } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { playersTable } from "../lib/db/src/schema/players";
import {
  playerSpecificationService,
  resolveRoleSpecGroups,
  specificationsFromLegacyFields,
} from "../artifacts/api-server/src/lib/player-specification-service";

type Stats = {
  playersScanned: number;
  rowsCreated: number;
  rowsSkipped: number;
  playersSkippedExisting: number;
  playersSkippedNoLegacy: number;
  playersSkippedNoGroups: number;
  errors: { playerId: number; message: string }[];
};

async function migratePlayer(
  player: typeof playersTable.$inferSelect,
  dryRun: boolean,
  stats: Stats,
): Promise<void> {
  stats.playersScanned++;

  try {
    const existing = await playerSpecificationService.getPlayerSpecifications(player.id);
    if (existing.length > 0) {
      stats.playersSkippedExisting++;
      stats.rowsSkipped += existing.length;
      return;
    }

    const groups = await resolveRoleSpecGroups(player.tournamentId, player.role);
    if (groups.length === 0) {
      stats.playersSkippedNoGroups++;
      return;
    }

    const specs = specificationsFromLegacyFields(groups, {
      battingStyle: player.battingStyle,
      bowlingStyle: player.bowlingStyle,
      specialization: player.specialization,
    });

    if (specs.length === 0) {
      stats.playersSkippedNoLegacy++;
      return;
    }

    if (dryRun) {
      console.log(
        `[dry-run] player ${player.id} (${player.name}): would create ${specs.length} row(s)`,
        specs,
      );
      stats.rowsCreated += specs.length;
      return;
    }

    await playerSpecificationService.savePlayerSpecifications(player.id, specs);
    stats.rowsCreated += specs.length;
    console.log(`player ${player.id} (${player.name}): created ${specs.length} row(s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stats.errors.push({ playerId: player.id, message });
    console.error(`player ${player.id}: ERROR — ${message}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const tournamentArg = process.argv.find((a) => /^\d+$/.test(a));
  const tournamentId = tournamentArg ? parseInt(tournamentArg, 10) : undefined;

  if (tournamentArg && Number.isNaN(tournamentId)) {
    console.error("Invalid tournament id:", tournamentArg);
    process.exit(1);
  }

  console.log(`Player spec backfill${dryRun ? " (DRY RUN)" : ""}`);
  if (tournamentId) console.log(`Tournament filter: ${tournamentId}`);

  const stats: Stats = {
    playersScanned: 0,
    rowsCreated: 0,
    rowsSkipped: 0,
    playersSkippedExisting: 0,
    playersSkippedNoLegacy: 0,
    playersSkippedNoGroups: 0,
    errors: [],
  };

  const players = tournamentId
    ? await db.select().from(playersTable).where(eq(playersTable.tournamentId, tournamentId))
    : await db.select().from(playersTable);

  console.log(`Scanning ${players.length} player(s)…\n`);

  for (const player of players) {
    await migratePlayer(player, dryRun, stats);
  }

  console.log("\n── Summary ──");
  console.log(JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
