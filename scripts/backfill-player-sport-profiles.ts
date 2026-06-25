#!/usr/bin/env npx tsx
/**
 * Backfill player_sport_profiles from linked tournament players and legacy global_players columns.
 *
 * Usage:
 *   npx tsx scripts/backfill-player-sport-profiles.ts [--dry-run] [globalPlayerId]
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db/src/index";
import { globalPlayersTable } from "../lib/db/src/schema/global_players";
import { playerSportProfileService } from "../artifacts/api-server/src/lib/master-sports/player-sport-profile-service";

type Stats = {
  globalPlayersScanned: number;
  profilesCreated: number;
  profilesUpdated: number;
  profilesSkipped: number;
  errors: { globalPlayerId: string; message: string }[];
};

async function backfillGlobalPlayer(
  gp: typeof globalPlayersTable.$inferSelect,
  dryRun: boolean,
  stats: Stats,
): Promise<void> {
  stats.globalPlayersScanned++;

  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (lower(t.sport))
        lower(t.sport) AS sport_slug,
        p.role,
        p.id AS auction_player_id,
        p.batting_style,
        p.updated_at
      FROM players p
      INNER JOIN tournaments t ON t.id = p.tournament_id
      WHERE p.global_player_id = ${gp.id}
      ORDER BY lower(t.sport), p.updated_at DESC
    `);

    const sportMap = new Map<string, { role: string | null; profileJson: Record<string, unknown> }>();

    for (const row of rows.rows as Array<Record<string, unknown>>) {
      const sportSlug = String(row.sport_slug ?? "").trim().toLowerCase();
      if (!sportSlug) continue;
      sportMap.set(sportSlug, {
        role: row.role ? String(row.role) : null,
        profileJson: {
          auctionPlayerId: row.auction_player_id,
          ...(row.batting_style ? { handedness: row.batting_style } : {}),
        },
      });
    }

    if (sportMap.size === 0 && gp.sport) {
      sportMap.set(gp.sport.trim().toLowerCase(), {
        role: gp.defaultRole,
        profileJson: gp.auctionPlayerId ? { auctionPlayerId: gp.auctionPlayerId } : {},
      });
    }

    if (sportMap.size === 0) {
      stats.profilesSkipped++;
      return;
    }

    const existing = await playerSportProfileService.getSportProfiles(gp.id);
    const existingSports = new Set(existing.map((p) => p.sport));

    for (const [sportSlug, data] of sportMap) {
      if (dryRun) {
        console.log(
          `[dry-run] ${gp.id} (${gp.canonicalName}): ${existingSports.has(sportSlug) ? "update" : "create"} ${sportSlug} → ${data.role ?? "null"}`,
        );
        if (existingSports.has(sportSlug)) stats.profilesUpdated++;
        else stats.profilesCreated++;
        continue;
      }

      const before = existingSports.has(sportSlug);
      await playerSportProfileService.upsertSportProfile(gp.id, {
        sportSlug,
        defaultRole: data.role,
        profileJson: data.profileJson,
      });

      if (before) {
        stats.profilesUpdated++;
        console.log(`${gp.id}: updated ${sportSlug} profile`);
      } else {
        stats.profilesCreated++;
        console.log(`${gp.id}: created ${sportSlug} profile`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stats.errors.push({ globalPlayerId: gp.id, message });
    console.error(`${gp.id}: ERROR — ${message}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const gpArg = process.argv.find((a) => a.startsWith("gp_"));
  const profilesEnabledNote = process.env.PLAYER_SPORT_PROFILES_ENABLED ?? "(unset)";

  console.log(`Player sport profile backfill${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`PLAYER_SPORT_PROFILES_ENABLED=${profilesEnabledNote}`);

  const stats: Stats = {
    globalPlayersScanned: 0,
    profilesCreated: 0,
    profilesUpdated: 0,
    profilesSkipped: 0,
    errors: [],
  };

  const globalPlayers = gpArg
    ? await db.select().from(globalPlayersTable).where(eq(globalPlayersTable.id, gpArg))
    : await db.select().from(globalPlayersTable);

  console.log(`Scanning ${globalPlayers.length} global player(s)…\n`);

  for (const gp of globalPlayers) {
    await backfillGlobalPlayer(gp, dryRun, stats);
  }

  console.log("\n── Summary ──");
  console.log(JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
