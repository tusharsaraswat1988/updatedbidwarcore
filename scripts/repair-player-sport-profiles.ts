#!/usr/bin/env npx tsx
/**
 * Repair missing player_sport_profiles from linked tournament players.
 * Idempotent — uses upsert via playerSportProfileService.
 *
 * Usage:
 *   npx tsx scripts/repair-player-sport-profiles.ts --dry-run
 *   npx tsx scripts/repair-player-sport-profiles.ts --apply [globalPlayerId]
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { globalPlayersTable } from "../lib/db/src/schema/global_players";
import { playerSportProfileService } from "../artifacts/api-server/src/lib/master-sports/player-sport-profile-service";
import {
  createRepairStats,
  exitRepair,
  parseRepairArgs,
  printRepairSummary,
  type RepairStats,
} from "./lib/repair-cli";

async function repairMissingProfiles(
  apply: boolean,
  globalPlayerId: string | undefined,
  stats: RepairStats,
): Promise<void> {
  const filter = globalPlayerId
    ? sql`AND p.global_player_id = ${globalPlayerId}`
    : sql``;

  const missing = await db.execute(sql`
    SELECT DISTINCT ON (p.global_player_id, lower(t.sport))
      p.global_player_id,
      lower(t.sport) AS sport_slug,
      p.role,
      p.id AS auction_player_id,
      p.batting_style,
      p.updated_at
    FROM players p
    INNER JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.global_player_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM player_sport_profiles psp
        WHERE psp.global_player_id = p.global_player_id
          AND lower(psp.sport_slug) = lower(t.sport)
      )
      ${filter}
    ORDER BY p.global_player_id, lower(t.sport), p.updated_at DESC
  `);

  for (const row of missing.rows as Array<Record<string, unknown>>) {
    stats.scanned++;
    const gpId = String(row.global_player_id);
    const sportSlug = String(row.sport_slug);
    const role = row.role ? String(row.role) : null;
    const profileJson: Record<string, unknown> = {
      auctionPlayerId: row.auction_player_id,
    };
    if (row.batting_style) profileJson.handedness = row.batting_style;

    try {
      if (apply) {
        await playerSportProfileService.upsertSportProfile(gpId, {
          sportSlug,
          defaultRole: role,
          profileJson,
        });
        console.log(`${gpId}: created ${sportSlug} profile → ${role ?? "null"}`);
      } else {
        console.log(`[dry-run] ${gpId}: would create ${sportSlug} profile → ${role ?? "null"}`);
      }
      stats.repaired++;
    } catch (err) {
      stats.errors.push({
        id: `${gpId}:${sportSlug}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function reportDuplicates(stats: RepairStats): Promise<void> {
  const dups = await db.execute(sql`
    SELECT global_player_id, sport_slug, COUNT(*)::int AS cnt
    FROM player_sport_profiles
    GROUP BY global_player_id, sport_slug
    HAVING COUNT(*) > 1
  `);

  for (const row of dups.rows as Array<{ global_player_id: string; sport_slug: string; cnt: number }>) {
    stats.scanned++;
    stats.skipped++;
    console.warn(
      `[skip] duplicate profiles ${row.global_player_id}/${row.sport_slug} (${row.cnt}) — requires manual merge`,
    );
  }
}

async function main() {
  const { dryRun, apply, globalPlayerId, json } = parseRepairArgs();
  const stats = createRepairStats();

  console.log(`Repair player_sport_profiles${dryRun ? " (DRY RUN)" : " (APPLY)"}`);
  if (globalPlayerId) {
    const [gp] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.id, globalPlayerId))
      .limit(1);
    if (!gp) {
      console.error("Global player not found:", globalPlayerId);
      process.exit(1);
    }
  }

  await repairMissingProfiles(apply, globalPlayerId, stats);
  await reportDuplicates(stats);

  printRepairSummary("player_sport_profiles", stats, json);
  exitRepair(stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
