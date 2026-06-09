/**
 * migrateBadmintonPlayersToMaster()
 *
 * Copies existing badminton_players → global_players (MasterPlayer).
 * Preserves ID mappings in master_player_id_mappings.
 * Logs all operations to master_sports_sync_log.
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonPlayersTable,
  globalPlayersTable,
  masterPlayerIdMappingsTable,
  playerStatisticsTable,
} from "@workspace/db";
import { logSync } from "./sync-helpers";

function generateGpId(): string {
  return `gp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export type MigrationResult = {
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
};

export async function migrateBadmintonPlayersToMaster(
  tournamentId?: number,
): Promise<MigrationResult> {
  const result: MigrationResult = { total: 0, migrated: 0, skipped: 0, errors: [] };

  const players = tournamentId
    ? await db
        .select()
        .from(badmintonPlayersTable)
        .where(eq(badmintonPlayersTable.tournamentId, tournamentId))
    : await db.select().from(badmintonPlayersTable);

  result.total = players.length;

  for (const bp of players) {
    try {
      if (bp.masterPlayerId) {
        const [mapping] = await db
          .select()
          .from(masterPlayerIdMappingsTable)
          .where(eq(masterPlayerIdMappingsTable.sourcePlayerId, bp.id))
          .limit(1);

        if (!mapping) {
          await db.insert(masterPlayerIdMappingsTable).values({
            sourceModule: "badminton",
            sourcePlayerId: bp.id,
            masterPlayerId: bp.masterPlayerId,
            tournamentId: bp.tournamentId,
          });
        }
        result.skipped++;
        continue;
      }

      let masterPlayerId: string;

      if (bp.mobile) {
        const [byMobile] = await db
          .select()
          .from(globalPlayersTable)
          .where(eq(globalPlayersTable.mobileNumber, bp.mobile))
          .limit(1);
        if (byMobile) {
          masterPlayerId = byMobile.id;
          await db
            .update(globalPlayersTable)
            .set({
              firstName: bp.firstName,
              lastName: bp.lastName,
              displayName: bp.displayName ?? `${bp.firstName} ${bp.lastName}`.trim(),
              photoUrl: bp.photoUrl ?? byMobile.photoUrl,
              country: bp.countryName ?? byMobile.country,
              state: bp.stateName,
              academy: bp.academyName,
              handedness: bp.handedness,
              gender: bp.gender,
              dob: bp.dateOfBirth,
              email: bp.email ?? byMobile.email,
              worldRanking: bp.worldRanking,
              nationalRanking: bp.nationalRanking,
              updatedAt: new Date(),
            })
            .where(eq(globalPlayersTable.id, masterPlayerId));
        } else {
          masterPlayerId = generateGpId();
          await db.insert(globalPlayersTable).values({
            id: masterPlayerId,
            canonicalName: bp.displayName ?? `${bp.firstName} ${bp.lastName}`.trim(),
            firstName: bp.firstName,
            lastName: bp.lastName,
            displayName: bp.displayName,
            mobileNumber: bp.mobile,
            email: bp.email,
            dob: bp.dateOfBirth,
            gender: bp.gender,
            country: bp.countryName,
            state: bp.stateName,
            city: null,
            academy: bp.academyName,
            handedness: bp.handedness,
            worldRanking: bp.worldRanking,
            nationalRanking: bp.nationalRanking,
            photoUrl: bp.photoUrl,
            sport: "badminton",
          });
        }
      } else {
        masterPlayerId = generateGpId();
        await db.insert(globalPlayersTable).values({
          id: masterPlayerId,
          canonicalName: bp.displayName ?? `${bp.firstName} ${bp.lastName}`.trim(),
          firstName: bp.firstName,
          lastName: bp.lastName,
          displayName: bp.displayName,
          email: bp.email,
          dob: bp.dateOfBirth,
          gender: bp.gender,
          country: bp.countryName,
          state: bp.stateName,
          academy: bp.academyName,
          handedness: bp.handedness,
          worldRanking: bp.worldRanking,
          nationalRanking: bp.nationalRanking,
          photoUrl: bp.photoUrl,
          sport: "badminton",
        });
      }

      await db
        .update(badmintonPlayersTable)
        .set({ masterPlayerId })
        .where(eq(badmintonPlayersTable.id, bp.id));

      await db.insert(masterPlayerIdMappingsTable).values({
        sourceModule: "badminton",
        sourcePlayerId: bp.id,
        masterPlayerId,
        tournamentId: bp.tournamentId,
      });

      await logSync("badminton_migration", "badminton_player", String(bp.id), masterPlayerId, null, {
        tournamentId: bp.tournamentId,
        name: bp.displayName ?? `${bp.firstName} ${bp.lastName}`,
      });

      result.migrated++;
    } catch (err) {
      result.errors.push(
        `Player ${bp.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

/** Initialize statistics rows for migrated players (zero baseline). */
export async function ensureStatisticsForMigratedPlayers(tournamentId: number): Promise<number> {
  const players = await db
    .select()
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, tournamentId));

  let created = 0;
  for (const bp of players) {
    if (!bp.masterPlayerId) continue;

    const [existing] = await db
      .select()
      .from(playerStatisticsTable)
      .where(eq(playerStatisticsTable.playerId, bp.masterPlayerId))
      .limit(1);

    if (!existing) {
      await db.insert(playerStatisticsTable).values({
        playerId: bp.masterPlayerId,
        sport: "badminton",
        tournamentId,
      });
      created++;
    }
  }
  return created;
}
