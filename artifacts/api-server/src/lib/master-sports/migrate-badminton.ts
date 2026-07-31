/**
 * migrateBadmintonPlayersToMaster()
 *
 * Copies existing badminton_players → global_players (MasterPlayer).
 * Preserves ID mappings in master_player_id_mappings.
 * Logs all operations to master_sports_sync_log.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonPlayersTable,
  globalPlayersTable,
  masterPlayerIdMappingsTable,
  playerStatisticsTable,
  type BadmintonPlayer,
} from "@workspace/db";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { logSync } from "@workspace/player-registry/sync-helpers";

function generateGpId(): string {
  return `gp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export type MigrationResult = {
  total: number;
  migrated: number;
  skipped: number;
  errors: string[];
};

async function ensureMapping(
  bp: BadmintonPlayer,
  masterPlayerId: string,
): Promise<void> {
  const [mapping] = await db
    .select({ id: masterPlayerIdMappingsTable.id })
    .from(masterPlayerIdMappingsTable)
    .where(
      and(
        eq(masterPlayerIdMappingsTable.sourceModule, "badminton"),
        eq(masterPlayerIdMappingsTable.sourcePlayerId, bp.id),
        eq(masterPlayerIdMappingsTable.tournamentId, bp.tournamentId),
      ),
    )
    .limit(1);

  if (!mapping) {
    await db.insert(masterPlayerIdMappingsTable).values({
      sourceModule: "badminton",
      sourcePlayerId: bp.id,
      masterPlayerId,
      tournamentId: bp.tournamentId,
    });
  }
}

/**
 * Ensure a badminton player row is linked to Player Registry (global_players).
 * Walk-ins are created without masterPlayerId; team assignment and roster need the link.
 * Matches existing registry players by mobile when possible; otherwise creates one.
 */
export async function ensureBadmintonPlayerLinkedToMaster(
  bp: BadmintonPlayer,
): Promise<string> {
  if (bp.masterPlayerId) {
    await ensureMapping(bp, bp.masterPlayerId);
    return bp.masterPlayerId;
  }

  let masterPlayerId: string;
  const displayName = bp.displayName ?? `${bp.firstName} ${bp.lastName}`.trim();
  const mobileParsed = bp.mobile ? parseIndianMobile(bp.mobile) : null;
  const mobileNumber = mobileParsed?.ok ? mobileParsed.normalized : bp.mobile || null;

  if (mobileNumber) {
    const [byMobile] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.mobileNumber, mobileNumber))
      .limit(1);

    if (byMobile) {
      const [alreadyInTournament] = await db
        .select({ id: badmintonPlayersTable.id })
        .from(badmintonPlayersTable)
        .where(
          and(
            eq(badmintonPlayersTable.tournamentId, bp.tournamentId),
            eq(badmintonPlayersTable.masterPlayerId, byMobile.id),
            eq(badmintonPlayersTable.status, "active"),
          ),
        )
        .limit(1);

      if (alreadyInTournament && alreadyInTournament.id !== bp.id) {
        throw new Error(
          "A player with this mobile number is already in this tournament. Use Import from Player Registry or edit the existing player.",
        );
      }

      masterPlayerId = byMobile.id;
      await db
        .update(globalPlayersTable)
        .set({
          firstName: bp.firstName,
          lastName: bp.lastName,
          displayName,
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
        canonicalName: displayName,
        firstName: bp.firstName,
        lastName: bp.lastName,
        displayName: bp.displayName,
        mobileNumber,
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
      canonicalName: displayName,
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
    .set({ masterPlayerId, updatedAt: new Date() })
    .where(eq(badmintonPlayersTable.id, bp.id));

  await ensureMapping(bp, masterPlayerId);

  await logSync("badminton_walk_in_linked", "badminton_player", String(bp.id), masterPlayerId, null, {
    tournamentId: bp.tournamentId,
    name: displayName,
  });

  return masterPlayerId;
}

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
        await ensureMapping(bp, bp.masterPlayerId);
        result.skipped++;
        continue;
      }

      await ensureBadmintonPlayerLinkedToMaster(bp);
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
      .where(
        and(
          eq(playerStatisticsTable.playerId, bp.masterPlayerId),
          eq(playerStatisticsTable.sport, "badminton"),
          eq(playerStatisticsTable.tournamentId, tournamentId),
        ),
      )
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
