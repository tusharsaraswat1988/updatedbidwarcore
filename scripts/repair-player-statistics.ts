#!/usr/bin/env npx tsx
/**
 * Repair player_statistics sport tags, duplicates, and report orphans.
 *
 * Usage:
 *   npx tsx scripts/repair-player-statistics.ts --dry-run
 *   npx tsx scripts/repair-player-statistics.ts --apply [tournamentId]
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { playerStatisticsTable } from "../lib/db/src/schema/master-sports";
import {
  createRepairStats,
  exitRepair,
  parseRepairArgs,
  printRepairSummary,
  type RepairStats,
} from "./lib/repair-cli";

async function repairWrongSport(
  apply: boolean,
  tournamentId: number | undefined,
  stats: RepairStats,
): Promise<void> {
  const filter = tournamentId
    ? sql`AND ps.tournament_id = ${tournamentId}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT ps.id, ps.sport AS current_sport, lower(t.sport) AS expected_sport
    FROM player_statistics ps
    INNER JOIN tournaments t ON t.id = ps.tournament_id
    WHERE ps.tournament_id IS NOT NULL
      AND lower(ps.sport) <> lower(t.sport)
      ${filter}
  `);

  for (const row of rows.rows as Array<{ id: number; expected_sport: string }>) {
    stats.scanned++;
    try {
      if (apply) {
        await db
          .update(playerStatisticsTable)
          .set({ sport: String(row.expected_sport) })
          .where(eq(playerStatisticsTable.id, row.id));
        console.log(`stats ${row.id}: sport → ${row.expected_sport}`);
      } else {
        console.log(`[dry-run] stats ${row.id}: sport → ${row.expected_sport}`);
      }
      stats.repaired++;
    } catch (err) {
      stats.errors.push({
        id: String(row.id),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function repairDuplicates(apply: boolean, stats: RepairStats): Promise<void> {
  const dupGroups = await db.execute(sql`
    SELECT player_id, sport, tournament_id, array_agg(id ORDER BY id) AS ids
    FROM player_statistics
    GROUP BY player_id, sport, tournament_id
    HAVING COUNT(*) > 1
  `);

  for (const group of dupGroups.rows as Array<{ ids: number[] }>) {
    const ids = group.ids ?? [];
    if (ids.length < 2) continue;
    const keepId = ids[0]!;
    const removeIds = ids.slice(1);
    for (const id of removeIds) {
      stats.scanned++;
      try {
        if (apply) {
          await db.delete(playerStatisticsTable).where(eq(playerStatisticsTable.id, id));
          console.log(`stats ${id}: deleted duplicate (kept ${keepId})`);
        } else {
          console.log(`[dry-run] stats ${id}: would delete duplicate (keep ${keepId})`);
        }
        stats.repaired++;
      } catch (err) {
        stats.errors.push({
          id: String(id),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

async function reportOrphans(stats: RepairStats): Promise<void> {
  const orphans = await db.execute(sql`
    SELECT ps.id, ps.player_id
    FROM player_statistics ps
    LEFT JOIN global_players gp ON gp.id = ps.player_id
    WHERE gp.id IS NULL
    LIMIT 1000
  `);

  for (const row of orphans.rows as Array<{ id: number; player_id: string }>) {
    stats.scanned++;
    stats.skipped++;
    console.warn(`[skip] orphan stats ${row.id} player_id=${row.player_id} — manual review required`);
  }
}

async function main() {
  const { dryRun, apply, tournamentId, json } = parseRepairArgs();
  const stats = createRepairStats();

  console.log(`Repair player_statistics${dryRun ? " (DRY RUN)" : " (APPLY)"}`);
  if (tournamentId) console.log(`Tournament filter: ${tournamentId}`);

  await repairWrongSport(apply, tournamentId, stats);
  await repairDuplicates(apply, stats);
  await reportOrphans(stats);

  printRepairSummary("player_statistics", stats, json);
  exitRepair(stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
