#!/usr/bin/env npx tsx
/**
 * Repair player_team_assignments sport tags and duplicate active rows.
 *
 * Usage:
 *   npx tsx scripts/repair-team-assignments.ts --dry-run
 *   npx tsx scripts/repair-team-assignments.ts --apply [tournamentId]
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { playerTeamAssignmentsTable } from "../lib/db/src/schema/master-sports";
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
    ? sql`AND pta.tournament_id = ${tournamentId}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT pta.id, pta.sport AS current_sport, lower(t.sport) AS expected_sport
    FROM player_team_assignments pta
    INNER JOIN tournaments t ON t.id = pta.tournament_id
    WHERE pta.tournament_id IS NOT NULL
      AND lower(pta.sport) <> lower(t.sport)
      ${filter}
  `);

  for (const row of rows.rows as Array<{ id: number; expected_sport: string }>) {
    stats.scanned++;
    try {
      if (apply) {
        await db
          .update(playerTeamAssignmentsTable)
          .set({ sport: String(row.expected_sport) })
          .where(eq(playerTeamAssignmentsTable.id, row.id));
        console.log(`assignment ${row.id}: sport → ${row.expected_sport}`);
      } else {
        console.log(`[dry-run] assignment ${row.id}: sport → ${row.expected_sport}`);
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

async function repairMultipleActive(apply: boolean, stats: RepairStats): Promise<void> {
  const groups = await db.execute(sql`
    SELECT player_id, tournament_id, sport, array_agg(id ORDER BY assigned_at DESC) AS ids
    FROM player_team_assignments
    WHERE is_active = true AND tournament_id IS NOT NULL
    GROUP BY player_id, tournament_id, sport
    HAVING COUNT(*) > 1
  `);

  for (const group of groups.rows as Array<{ ids: number[] }>) {
    const ids = group.ids ?? [];
    const [keepId, ...deactivateIds] = ids;
    if (!keepId || deactivateIds.length === 0) continue;

    for (const id of deactivateIds) {
      stats.scanned++;
      try {
        if (apply) {
          await db
            .update(playerTeamAssignmentsTable)
            .set({ isActive: false, endedAt: new Date() })
            .where(eq(playerTeamAssignmentsTable.id, id));
          console.log(`assignment ${id}: deactivated (kept active ${keepId})`);
        } else {
          console.log(`[dry-run] assignment ${id}: would deactivate (keep ${keepId})`);
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
    SELECT pta.id, pta.player_id
    FROM player_team_assignments pta
    LEFT JOIN global_players gp ON gp.id = pta.player_id
    WHERE gp.id IS NULL
    LIMIT 1000
  `);

  for (const row of orphans.rows as Array<{ id: number; player_id: string }>) {
    stats.scanned++;
    stats.skipped++;
    console.warn(`[skip] orphan assignment ${row.id} player_id=${row.player_id}`);
  }
}

async function main() {
  const { dryRun, apply, tournamentId, json } = parseRepairArgs();
  const stats = createRepairStats();

  console.log(`Repair player_team_assignments${dryRun ? " (DRY RUN)" : " (APPLY)"}`);
  if (tournamentId) console.log(`Tournament filter: ${tournamentId}`);

  await repairWrongSport(apply, tournamentId, stats);
  await repairMultipleActive(apply, stats);
  await reportOrphans(stats);

  printRepairSummary("player_team_assignments", stats, json);
  exitRepair(stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
