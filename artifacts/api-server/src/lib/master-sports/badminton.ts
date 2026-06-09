/**
 * Badminton ↔ Master Sports integration — import, resolve, statistics.
 */

import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  globalPlayersTable,
  masterTeamsTable,
  masterSponsorsTable,
  badmintonPlayersTable,
  playerTeamAssignmentsTable,
  playerStatisticsTable,
  masterPlayerIdMappingsTable,
  tournamentsTable,
  type BadmintonPlayer,
  type GlobalPlayer,
} from "@workspace/db";
import type { BadmintonMatchKind, BadmintonMatchState } from "@workspace/badminton-core";
import {
  allocateTournamentInitials,
  ensureTournamentInitials,
} from "./tournament-initials";

export type MasterPlayerListItem = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  country: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  sponsorName: string | null;
  sponsorLogoUrl: string | null;
  worldRanking: number | null;
  nationalRanking: number | null;
  alreadyImported: boolean;
  badmintonPlayerId: number | null;
};

export type BadmintonTournamentSettings = {
  autoSyncAuctionPlayers?: boolean;
  linkedAuctionTournamentId?: number;
};

export function getBadmintonSettings(
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): BadmintonTournamentSettings {
  const raw = scoringSettingsJson ?? {};
  return {
    autoSyncAuctionPlayers: raw.autoSyncAuctionPlayers === true,
    linkedAuctionTournamentId:
      typeof raw.linkedAuctionTournamentId === "number"
        ? raw.linkedAuctionTournamentId
        : undefined,
  };
}

/** Resolve master player id from badminton player (with legacy fallback). */
export async function resolveMasterPlayerId(
  badmintonPlayer: BadmintonPlayer,
): Promise<string | null> {
  if (badmintonPlayer.masterPlayerId) return badmintonPlayer.masterPlayerId;

  const [mapping] = await db
    .select()
    .from(masterPlayerIdMappingsTable)
    .where(
      and(
        eq(masterPlayerIdMappingsTable.sourceModule, "badminton"),
        eq(masterPlayerIdMappingsTable.sourcePlayerId, badmintonPlayer.id),
        eq(masterPlayerIdMappingsTable.tournamentId, badmintonPlayer.tournamentId),
      ),
    )
    .limit(1);

  return mapping?.masterPlayerId ?? null;
}

/** Build display profile from master player + team assignment. */
export async function enrichMasterPlayerForTournament(
  masterPlayer: GlobalPlayer,
  tournamentId: number,
  linkedAuctionTournamentId?: number,
): Promise<Omit<MasterPlayerListItem, "alreadyImported" | "badmintonPlayerId">> {
  const lookupTournamentId = linkedAuctionTournamentId ?? tournamentId;

  const [assignment] = await db
    .select()
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.playerId, masterPlayer.id),
        eq(playerTeamAssignmentsTable.tournamentId, lookupTournamentId),
      ),
    )
    .limit(1);

  let teamName: string | null = null;
  let teamLogoUrl: string | null = null;
  let sponsorName: string | null = null;
  let sponsorLogoUrl: string | null = null;

  if (assignment) {
    const [team] = await db
      .select()
      .from(masterTeamsTable)
      .where(eq(masterTeamsTable.id, assignment.teamId))
      .limit(1);
    if (team) {
      teamName = team.name;
      teamLogoUrl = team.logoUrl;
      if (team.sponsorId) {
        const [sponsor] = await db
          .select()
          .from(masterSponsorsTable)
          .where(eq(masterSponsorsTable.id, team.sponsorId))
          .limit(1);
        if (sponsor) {
          sponsorName = sponsor.name;
          sponsorLogoUrl = sponsor.logoUrl;
        }
      }
    }
  }

  if (masterPlayer.sponsorId) {
    const [sponsor] = await db
      .select()
      .from(masterSponsorsTable)
      .where(eq(masterSponsorsTable.id, masterPlayer.sponsorId))
      .limit(1);
    if (sponsor) {
      sponsorName = sponsor.name;
      sponsorLogoUrl = sponsor.logoUrl;
    }
  }

  return {
    id: masterPlayer.id,
    displayName:
      masterPlayer.displayName ??
      masterPlayer.canonicalName ??
      [masterPlayer.firstName, masterPlayer.lastName].filter(Boolean).join(" "),
    firstName: masterPlayer.firstName,
    lastName: masterPlayer.lastName,
    photoUrl: masterPlayer.photoUrl,
    country: masterPlayer.country,
    teamName,
    teamLogoUrl,
    sponsorName,
    sponsorLogoUrl,
    worldRanking: masterPlayer.worldRanking,
    nationalRanking: masterPlayer.nationalRanking,
  };
}

/** List master players available for import into a badminton tournament. */
export async function listMasterPlayersForBadminton(
  tournamentId: number,
): Promise<MasterPlayerListItem[]> {
  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    tournament?.scoringSettingsJson as Record<string, unknown> | null,
  );

  const imported = await db
    .select()
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, tournamentId));

  const importedByMasterId = new Map<string, number>();
  for (const bp of imported) {
    if (bp.masterPlayerId) importedByMasterId.set(bp.masterPlayerId, bp.id);
  }

  let masterPlayers: GlobalPlayer[];

  if (settings.autoSyncAuctionPlayers && settings.linkedAuctionTournamentId) {
    const assignments = await db
      .select({ playerId: playerTeamAssignmentsTable.playerId })
      .from(playerTeamAssignmentsTable)
      .where(eq(playerTeamAssignmentsTable.tournamentId, settings.linkedAuctionTournamentId));

    const playerIds = [...new Set(assignments.map((a) => a.playerId))];
    if (playerIds.length === 0) {
      masterPlayers = await db.select().from(globalPlayersTable).limit(200);
    } else {
      masterPlayers = await db
        .select()
        .from(globalPlayersTable)
        .where(inArray(globalPlayersTable.id, playerIds));
    }
  } else {
    masterPlayers = await db
      .select()
      .from(globalPlayersTable)
      .orderBy(asc(globalPlayersTable.canonicalName))
      .limit(500);
  }

  const items: MasterPlayerListItem[] = [];
  for (const mp of masterPlayers) {
    const enriched = await enrichMasterPlayerForTournament(
      mp,
      tournamentId,
      settings.linkedAuctionTournamentId,
    );
    const badmintonPlayerId = importedByMasterId.get(mp.id) ?? null;
    items.push({
      ...enriched,
      alreadyImported: badmintonPlayerId !== null,
      badmintonPlayerId,
    });
  }

  return items;
}

function masterPlayerNameFields(mp: GlobalPlayer) {
  const firstName = mp.firstName ?? mp.canonicalName.split(" ")[0] ?? "Player";
  const lastName = mp.lastName ?? mp.canonicalName.split(" ").slice(1).join(" ") ?? "";
  const displayName = mp.displayName ?? mp.canonicalName;
  return { firstName, lastName, displayName };
}

/** Ensure badminton_players row exists for master player; assign tournament initials. */
export async function ensureBadmintonPlayerFromMaster(
  tournamentId: number,
  masterPlayerId: string,
): Promise<BadmintonPlayer> {
  const [existing] = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        eq(badmintonPlayersTable.masterPlayerId, masterPlayerId),
      ),
    )
    .limit(1);

  if (existing) {
    const initials = await ensureTournamentInitials(existing);
    return initials !== existing.shortName ? { ...existing, shortName: initials } : existing;
  }

  const [mp] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, masterPlayerId))
    .limit(1);

  if (!mp) {
    throw new Error("Master player not found");
  }

  const { firstName, lastName, displayName } = masterPlayerNameFields(mp);
  const shortName = await allocateTournamentInitials(tournamentId, {
    firstName,
    lastName,
    displayName,
  });

  const [bp] = await db
    .insert(badmintonPlayersTable)
    .values({
      tournamentId,
      masterPlayerId: mp.id,
      firstName,
      lastName,
      displayName,
      shortName,
      countryCode: mp.country?.slice(0, 3).toUpperCase(),
      countryName: mp.country,
      stateName: mp.state,
      academyName: mp.academy,
      dateOfBirth: mp.dob,
      gender: mp.gender,
      handedness: mp.handedness,
      mobile: mp.mobileNumber,
      email: mp.email,
      photoUrl: mp.photoUrl,
      worldRanking: mp.worldRanking,
      nationalRanking: mp.nationalRanking,
      status: "active",
    })
    .returning();

  await db.insert(masterPlayerIdMappingsTable).values({
    sourceModule: "badminton",
    sourcePlayerId: bp.id,
    masterPlayerId: mp.id,
    tournamentId,
  });

  return bp;
}

/** Import selected master players into badminton_players. */
export async function importMasterPlayersToBadminton(
  tournamentId: number,
  masterPlayerIds: string[],
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  for (const masterId of masterPlayerIds) {
    const [existing] = await db
      .select()
      .from(badmintonPlayersTable)
      .where(
        and(
          eq(badmintonPlayersTable.tournamentId, tournamentId),
          eq(badmintonPlayersTable.masterPlayerId, masterId),
        ),
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    const [mp] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.id, masterId))
      .limit(1);

    if (!mp) {
      skipped++;
      continue;
    }

    const { firstName, lastName, displayName } = masterPlayerNameFields(mp);
    const shortName = await allocateTournamentInitials(tournamentId, {
      firstName,
      lastName,
      displayName,
    });

    const [bp] = await db
      .insert(badmintonPlayersTable)
      .values({
        tournamentId,
        masterPlayerId: mp.id,
        firstName,
        lastName,
        displayName,
        shortName,
        countryCode: mp.country?.slice(0, 3).toUpperCase(),
        countryName: mp.country,
        stateName: mp.state,
        academyName: mp.academy,
        dateOfBirth: mp.dob,
        gender: mp.gender,
        handedness: mp.handedness,
        mobile: mp.mobileNumber,
        email: mp.email,
        photoUrl: mp.photoUrl,
        worldRanking: mp.worldRanking,
        nationalRanking: mp.nationalRanking,
        status: "active",
      })
      .returning();

    await db.insert(masterPlayerIdMappingsTable).values({
      sourceModule: "badminton",
      sourcePlayerId: bp.id,
      masterPlayerId: mp.id,
      tournamentId,
    });

    imported++;
  }

  return { imported, skipped };
}

/** Build side JSON from master player for match creation. */
export async function buildSideJsonFromMasterPlayer(
  masterPlayerId: string,
  tournamentId: number,
  badmintonPlayerId?: number,
): Promise<Record<string, unknown>> {
  const bp = badmintonPlayerId
    ? await (async () => {
        const [row] = await db
          .select()
          .from(badmintonPlayersTable)
          .where(
            and(
              eq(badmintonPlayersTable.id, badmintonPlayerId),
              eq(badmintonPlayersTable.tournamentId, tournamentId),
            ),
          )
          .limit(1);
        if (row) {
          const initials = await ensureTournamentInitials(row);
          return initials !== row.shortName ? { ...row, shortName: initials } : row;
        }
        return ensureBadmintonPlayerFromMaster(tournamentId, masterPlayerId);
      })()
    : await ensureBadmintonPlayerFromMaster(tournamentId, masterPlayerId);

  const [mp] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, masterPlayerId))
    .limit(1);

  if (!mp) {
    throw new Error("Master player not found");
  }

  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    tournament?.scoringSettingsJson as Record<string, unknown> | null,
  );

  const enriched = await enrichMasterPlayerForTournament(
    mp,
    tournamentId,
    settings.linkedAuctionTournamentId,
  );

  const displayName = bp.displayName ?? enriched.displayName;
  const shortLabel = bp.shortName ?? "P";

  return {
    label: displayName,
    shortLabel,
    countryCode: bp.countryCode ?? mp.country?.slice(0, 3).toUpperCase(),
    countryName: bp.countryName ?? mp.country ?? undefined,
    photoUrl: bp.photoUrl ?? mp.photoUrl ?? undefined,
    flagUrl: enriched.teamLogoUrl ?? undefined,
    teamColor: undefined,
    teamName: enriched.teamName ?? undefined,
    teamLogoUrl: enriched.teamLogoUrl ?? undefined,
    sponsorName: enriched.sponsorName ?? undefined,
    sponsorLogoUrl: enriched.sponsorLogoUrl ?? undefined,
    masterPlayerId: mp.id,
    playerIds: [bp.id],
  };
}

type SideMatchStats = {
  masterIds: string[];
  won: boolean;
  pointsScored: number;
  pointsConceded: number;
  gamesWon: number;
  gamesLost: number;
};

/** Resolve master player IDs from cached side JSON (singles vs pair formats). */
export function extractMasterPlayerIdsFromSideJson(
  sideJson: Record<string, unknown>,
  matchKind: BadmintonMatchKind,
): string[] {
  if (matchKind === "singles") {
    const masterId =
      typeof sideJson.masterPlayerId === "string" ? sideJson.masterPlayerId : null;
    return masterId ? [masterId] : [];
  }

  const players = sideJson.players;
  if (!Array.isArray(players)) return [];

  const ids: string[] = [];
  for (const player of players) {
    if (!player || typeof player !== "object") continue;
    const masterId = (player as Record<string, unknown>).masterPlayerId;
    if (typeof masterId === "string" && masterId.length > 0) {
      ids.push(masterId);
    }
  }
  return ids;
}

async function applyPlayerMatchStatistics(
  tournamentId: number,
  masterId: string,
  stats: Omit<SideMatchStats, "masterIds">,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(playerStatisticsTable)
    .where(
      and(
        eq(playerStatisticsTable.playerId, masterId),
        eq(playerStatisticsTable.sport, "badminton"),
        eq(playerStatisticsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(playerStatisticsTable)
      .set({
        matchesPlayed: existing.matchesPlayed + 1,
        matchesWon: existing.matchesWon + (stats.won ? 1 : 0),
        matchesLost: existing.matchesLost + (stats.won ? 0 : 1),
        gamesWon: existing.gamesWon + stats.gamesWon,
        gamesLost: existing.gamesLost + stats.gamesLost,
        pointsScored: existing.pointsScored + stats.pointsScored,
        pointsConceded: existing.pointsConceded + stats.pointsConceded,
        updatedAt: new Date(),
      })
      .where(eq(playerStatisticsTable.id, existing.id));
  } else {
    await db.insert(playerStatisticsTable).values({
      playerId: masterId,
      sport: "badminton",
      tournamentId,
      matchesPlayed: 1,
      matchesWon: stats.won ? 1 : 0,
      matchesLost: stats.won ? 0 : 1,
      gamesWon: stats.gamesWon,
      gamesLost: stats.gamesLost,
      pointsScored: stats.pointsScored,
      pointsConceded: stats.pointsConceded,
    });
  }
}

/** Update player statistics after match completion using master player IDs. */
export async function updateBadmintonStatisticsFromMatch(
  state: BadmintonMatchState,
  tournamentId: number,
  leftSideJson: Record<string, unknown>,
  rightSideJson: Record<string, unknown>,
): Promise<void> {
  if (state.matchStatus !== "completed" && state.matchStatus !== "walkover" && state.matchStatus !== "retired") {
    return;
  }

  const winnerSide = state.winnerSide;
  const leftPointsScored = state.games.reduce((s, g) => s + g.leftScore, 0);
  const rightPointsScored = state.games.reduce((s, g) => s + g.rightScore, 0);

  const sides: SideMatchStats[] = [
    {
      masterIds: extractMasterPlayerIdsFromSideJson(leftSideJson, state.matchKind),
      won: winnerSide === "left",
      pointsScored: leftPointsScored,
      pointsConceded: rightPointsScored,
      gamesWon: state.gamesLeft,
      gamesLost: state.gamesRight,
    },
    {
      masterIds: extractMasterPlayerIdsFromSideJson(rightSideJson, state.matchKind),
      won: winnerSide === "right",
      pointsScored: rightPointsScored,
      pointsConceded: leftPointsScored,
      gamesWon: state.gamesRight,
      gamesLost: state.gamesLeft,
    },
  ];

  for (const side of sides) {
    const { masterIds, ...stats } = side;
    for (const masterId of masterIds) {
      await applyPlayerMatchStatistics(tournamentId, masterId, stats);
    }
  }
}
