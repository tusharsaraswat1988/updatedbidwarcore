/**
 * Badminton ↔ Master Sports integration — import, resolve, statistics.
 */

import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  globalPlayersTable,
  masterTeamsTable,
  masterSponsorsTable,
  badmintonPlayersTable,
  playersTable,
  teamsTable,
  playerTeamAssignmentsTable,
  playerStatisticsTable,
  masterPlayerIdMappingsTable,
  tournamentsTable,
  type BadmintonPlayer,
  type GlobalPlayer,
} from "@workspace/db";
import type { BadmintonMatchKind, BadmintonMatchState } from "@workspace/badminton-core";
import {
  STANDARD_FORMAT,
  parseBadmintonMatchFormat,
  formatBadmintonMatchLabel,
  normalizeBadmintonFormat,
  isBadmintonFormatPresetId,
} from "@workspace/badminton-core";
import {
  readTournamentRulesFromSettings,
  type TournamentRulesConfig,
} from "@workspace/api-base/tournament-rules";
import {
  ensureTournamentInitials,
  allocateTournamentInitials,
} from "./tournament-initials";
import {
  ensureTournamentProfile,
  getTournamentProfile,
  syncBadmintonShortNameFromProfile,
} from "./tournament-profile";
import {
  type BadmintonBranding,
  type ScoreBoardSponsor,
  getBadmintonBranding,
  resolveBadmintonSponsorLogos,
} from "./badminton-branding";
import {
  commitBatchCloudinaryImageWrites,
  destroyRemovedCloudinaryImages,
} from "../cloudinary-media-service";
import {
  listRemovedSponsorLogos,
  parseSponsorLogosJson,
} from "../sponsor-logo-cleanup";
import {
  queueImageFieldChange,
  type ImageFieldChange,
} from "../cloudinary-image-fields";

export type { BadmintonBranding, ScoreBoardSponsor };
export { getBadmintonBranding, resolveBadmintonSponsorLogos };

export type MasterPlayerListItem = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  /** Auction franchise — informational metadata only. */
  franchiseName: string | null;
  franchiseLogoUrl: string | null;
  alreadyImported: boolean;
  badmintonPlayerId: number | null;
  /** Tournament profile initials when imported. */
  tournamentInitials: string | null;
  /** Legacy / admin fields — not shown in match picker. */
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  /** @deprecated use franchiseName */
  teamName?: string | null;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string | null;
  sponsorName?: string | null;
  sponsorLogoUrl?: string | null;
  worldRanking?: number | null;
  nationalRanking?: number | null;
};

export const BADMINTON_TRIAL_IMPORT_PLAYER_LIMIT = 4;

export type BadmintonTournamentSettings = {
  autoSyncAuctionPlayers?: boolean;
  linkedAuctionTournamentId?: number;
};

export type BadmintonScoringFormatResponse = {
  sport: "badminton";
  presetId: string;
  format: {
    totalGames: number;
    pointsPerGame: number;
    deuceAt: number;
    maxPoints: number;
    midGameSideChange: boolean;
  };
  label: string;
  configured: boolean;
  options?: {
    suddenDeath?: boolean;
  };
};

export function isLicensedBadmintonTournament(
  licenseStatus: string | null | undefined,
): boolean {
  return licenseStatus === "active" || licenseStatus === "completed";
}

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

/** Read Scoring Format (tournamentRules) for badminton tournaments. */
export function getBadmintonScoringFormat(
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): BadmintonScoringFormatResponse {
  const rules = readTournamentRulesFromSettings(scoringSettingsJson);
  if (rules && rules.sport === "badminton") {
    const format = parseBadmintonMatchFormat(rules.format) ?? STANDARD_FORMAT;
    const presetId = isBadmintonFormatPresetId(rules.presetId)
      ? rules.presetId
      : "custom";
    return {
      sport: "badminton",
      presetId,
      format,
      label: formatBadmintonMatchLabel(format, presetId),
      configured: true,
      ...(rules.options ? { options: rules.options } : {}),
    };
  }

  return {
    sport: "badminton",
    presetId: "standard_bwf",
    format: STANDARD_FORMAT,
    label: formatBadmintonMatchLabel(STANDARD_FORMAT, "standard_bwf"),
    configured: false,
  };
}

/** Persist Scoring Format under scoring_settings_json.tournamentRules. */
export async function saveBadmintonScoringFormat(
  tournamentId: number,
  input: {
    presetId: string;
    format: {
      totalGames: number;
      pointsPerGame: number;
      deuceAt: number;
      maxPoints: number;
      midGameSideChange: boolean;
    };
    options?: { suddenDeath?: boolean };
  },
): Promise<Record<string, unknown>> {
  const format = normalizeBadmintonFormat(input.format);
  const presetId = isBadmintonFormatPresetId(input.presetId)
    ? input.presetId
    : "custom";

  const tournamentRules: TournamentRulesConfig = {
    sport: "badminton",
    presetId,
    format,
    ...(input.options ? { options: input.options } : {}),
  };

  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const current = (tournament?.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const updated = {
    ...current,
    tournamentRules,
  };

  await db
    .update(tournamentsTable)
    .set({ scoringSettingsJson: updated })
    .where(eq(tournamentsTable.id, tournamentId));

  return updated;
}

export async function loadBadmintonBranding(
  tournamentId: number,
): Promise<BadmintonBranding | null> {
  const [tournament] = await db
    .select({
      name: tournamentsTable.name,
      logoUrl: tournamentsTable.logoUrl,
      sponsorLogos: tournamentsTable.sponsorLogos,
      venue: tournamentsTable.venue,
      organizerName: tournamentsTable.organizerName,
      scoringSettingsJson: tournamentsTable.scoringSettingsJson,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) return null;
  return getBadmintonBranding(tournament, tournament.scoringSettingsJson as Record<string, unknown>);
}

export async function updateBadmintonBranding(
  tournamentId: number,
  input: {
    displayName?: string;
    logoUrl?: string | null;
    logoPublicId?: string | null;
    sponsorLogos?: string | null;
    venue?: string | null;
    organizerName?: string | null;
    primaryColor?: string;
    accentColor?: string;
    scoreBoardSponsor?: ScoreBoardSponsor | null;
  },
  logger?: { error?: (obj: unknown, msg?: string) => void; warn?: (obj: unknown, msg?: string) => void },
): Promise<BadmintonBranding> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) throw new Error("Tournament not found");

  const currentBranding = getBadmintonBranding(
    tournament,
    tournament.scoringSettingsJson as Record<string, unknown>,
  );
  const currentSettings = (tournament.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const currentBrandingRaw = (currentSettings.branding ?? {}) as Record<string, unknown>;

  const tournamentUpdates: Record<string, unknown> = {};
  const imageChanges: ImageFieldChange[] = [];
  let removedSponsorLogos: ReturnType<typeof listRemovedSponsorLogos> = [];

  if (input.venue !== undefined) tournamentUpdates.venue = input.venue;
  if (input.organizerName !== undefined) tournamentUpdates.organizerName = input.organizerName;

  queueImageFieldChange(imageChanges, tournamentUpdates, {
    label: "logoUrl",
    urlKey: "logoUrl",
    publicIdKey: "logoPublicId",
    existing: { url: tournament.logoUrl, publicId: tournament.logoPublicId },
    nextUrl: input.logoUrl,
    nextPublicId: input.logoPublicId,
  });

  if (input.sponsorLogos !== undefined) {
    removedSponsorLogos = listRemovedSponsorLogos(
      parseSponsorLogosJson(currentBranding.sponsorLogos),
      parseSponsorLogosJson(input.sponsorLogos),
    );
  }

  const nextBranding = { ...currentBrandingRaw };
  if (input.displayName !== undefined) nextBranding.displayName = input.displayName;
  if (input.sponsorLogos !== undefined) nextBranding.sponsorLogos = input.sponsorLogos;
  if (input.primaryColor !== undefined) nextBranding.primaryColor = input.primaryColor;
  if (input.accentColor !== undefined) nextBranding.accentColor = input.accentColor;

  if (input.scoreBoardSponsor !== undefined) {
    const previous = currentBranding.scoreBoardSponsor;
    const next = input.scoreBoardSponsor;
    imageChanges.push({
      label: "scoreBoardSponsor.logoUrl",
      previous: {
        url: previous?.logoUrl ?? null,
        publicId: previous?.logoPublicId ?? null,
      },
      next: {
        url: next?.logoUrl ?? null,
        publicId: next?.logoPublicId ?? null,
      },
    });
    nextBranding.scoreBoardSponsor = next;
  }

  const nextSettings = { ...currentSettings, branding: nextBranding };

  const persistBrandingUpdate = async () => {
    await db
      .update(tournamentsTable)
      .set({
        ...tournamentUpdates,
        scoringSettingsJson: nextSettings,
      })
      .where(eq(tournamentsTable.id, tournamentId));
  };

  if (imageChanges.length > 0) {
    await commitBatchCloudinaryImageWrites({
      changes: imageChanges,
      persist: persistBrandingUpdate,
      logger,
      context: { route: "badminton.updateBranding", tournamentId },
    });
  } else {
    await persistBrandingUpdate();
  }

  if (removedSponsorLogos.length > 0) {
    await destroyRemovedCloudinaryImages(removedSponsorLogos, logger, {
      route: "badminton.updateBranding.sponsorLogos",
      tournamentId,
    });
  }

  const [updated] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  return getBadmintonBranding(updated!, updated!.scoringSettingsJson as Record<string, unknown>);
}

/** Set which LIVE match persistent Venue/OBS URLs follow (multi-court Primary Broadcast). */
export async function updatePrimaryBroadcastMatchId(
  tournamentId: number,
  primaryMatchId: number | null,
): Promise<BadmintonBranding> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) throw new Error("Tournament not found");

  const currentSettings = (tournament.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const currentBroadcast = (currentSettings.broadcast ?? {}) as Record<string, unknown>;
  const nextBroadcast = {
    ...currentBroadcast,
    primaryMatchId: primaryMatchId && primaryMatchId > 0 ? primaryMatchId : null,
  };
  const nextSettings = { ...currentSettings, broadcast: nextBroadcast };

  await db
    .update(tournamentsTable)
    .set({ scoringSettingsJson: nextSettings })
    .where(eq(tournamentsTable.id, tournamentId));

  const [updated] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  return getBadmintonBranding(updated!, updated!.scoringSettingsJson as Record<string, unknown>);
}

export async function importBrandingFromTournament(
  targetTournamentId: number,
  sourceTournamentId: number,
): Promise<BadmintonBranding> {
  const [source] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, sourceTournamentId))
    .limit(1);

  if (!source) throw new Error("Source tournament not found");

  const sourceBranding = getBadmintonBranding(
    source,
    source.scoringSettingsJson as Record<string, unknown>,
  );

  return updateBadmintonBranding(targetTournamentId, {
    displayName: sourceBranding.displayName,
    logoUrl: sourceBranding.logoUrl,
    sponsorLogos: sourceBranding.sponsorLogos,
    venue: sourceBranding.venue,
    organizerName: sourceBranding.organizerName,
    primaryColor: sourceBranding.primaryColor,
    accentColor: sourceBranding.accentColor,
    scoreBoardSponsor: sourceBranding.scoreBoardSponsor,
  });
}

/** Copy this tournament's Auction Hub branding into badminton LED/OBS settings. */
export async function importAuctionBrandingToBadminton(
  tournamentId: number,
): Promise<BadmintonBranding> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) throw new Error("Tournament not found");

  return updateBadmintonBranding(tournamentId, {
    displayName: tournament.name,
    logoUrl: tournament.logoUrl ?? null,
    venue: tournament.venue ?? null,
    organizerName: tournament.organizerName ?? null,
    sponsorLogos: tournament.sponsorLogos ?? null,
  });
}

async function copyBadmintonPlayersFromTournament(
  targetTournamentId: number,
  sourceTournamentId: number,
): Promise<{ imported: number; skipped: number }> {
  const sourcePlayers = await db
    .select()
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, sourceTournamentId));

  let imported = 0;
  let skipped = 0;

  for (const sp of sourcePlayers) {
    if (sp.masterPlayerId) {
      const [existing] = await db
        .select({ id: badmintonPlayersTable.id })
        .from(badmintonPlayersTable)
        .where(
          and(
            eq(badmintonPlayersTable.tournamentId, targetTournamentId),
            eq(badmintonPlayersTable.masterPlayerId, sp.masterPlayerId),
          ),
        )
        .limit(1);
      if (existing) {
        skipped++;
        continue;
      }
    } else {
      const [existing] = await db
        .select({ id: badmintonPlayersTable.id })
        .from(badmintonPlayersTable)
        .where(
          and(
            eq(badmintonPlayersTable.tournamentId, targetTournamentId),
            eq(badmintonPlayersTable.firstName, sp.firstName),
            eq(badmintonPlayersTable.lastName, sp.lastName),
          ),
        )
        .limit(1);
      if (existing) {
        skipped++;
        continue;
      }
    }

    const shortName = await allocateTournamentInitials(targetTournamentId, {
      firstName: sp.firstName,
      lastName: sp.lastName,
      displayName: sp.displayName,
    });

    const [bp] = await db
      .insert(badmintonPlayersTable)
      .values({
        tournamentId: targetTournamentId,
        masterPlayerId: sp.masterPlayerId,
        globalPlayerId: sp.globalPlayerId,
        bwfCode: sp.bwfCode,
        firstName: sp.firstName,
        lastName: sp.lastName,
        displayName: sp.displayName,
        shortName,
        countryCode: sp.countryCode,
        countryName: sp.countryName,
        stateName: sp.stateName,
        academyName: sp.academyName,
        dateOfBirth: sp.dateOfBirth,
        ageGroup: sp.ageGroup,
        gender: sp.gender,
        handedness: sp.handedness,
        mobile: sp.mobile,
        email: sp.email,
        photoUrl: sp.photoUrl,
        flagUrl: sp.flagUrl,
        teamColor: sp.teamColor,
        worldRanking: sp.worldRanking,
        nationalRanking: sp.nationalRanking,
        status: sp.status,
      })
      .returning();

    if (sp.masterPlayerId) {
      await ensureTournamentProfile(targetTournamentId, sp.masterPlayerId, {
        displayName: sp.displayName ?? undefined,
        photoOverrideUrl: sp.photoUrl,
      });
      await db.insert(masterPlayerIdMappingsTable).values({
        sourceModule: "badminton",
        sourcePlayerId: bp.id,
        masterPlayerId: sp.masterPlayerId,
        tournamentId: targetTournamentId,
      });
    }

    imported++;
  }

  return { imported, skipped };
}

async function persistLinkedAuctionTournamentId(
  tournamentId: number,
  linkedAuctionTournamentId: number,
): Promise<void> {
  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const current = (tournament?.scoringSettingsJson ?? {}) as Record<string, unknown>;
  await db
    .update(tournamentsTable)
    .set({
      scoringSettingsJson: {
        ...current,
        linkedAuctionTournamentId,
      },
    })
    .where(eq(tournamentsTable.id, tournamentId));
}

/** Import players from another tournament (badminton roster or auction roster). */
export async function importPlayersFromTournament(
  targetTournamentId: number,
  sourceTournamentId: number,
): Promise<{ imported: number; skipped: number; mode: "badminton" | "auction" }> {
  const [sourceBadminton] = await db
    .select({ id: badmintonPlayersTable.id })
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, sourceTournamentId))
    .limit(1);

  if (sourceBadminton) {
    const result = await copyBadmintonPlayersFromTournament(
      targetTournamentId,
      sourceTournamentId,
    );
    return { ...result, mode: "badminton" };
  }

  const { syncAllAuctionPlayersToMaster } = await import("./sync");
  await syncAllAuctionPlayersToMaster(sourceTournamentId);

  const masterIds = await getAuctionRosterMasterPlayerIds(sourceTournamentId);
  const result = await importMasterPlayersToBadminton(targetTournamentId, masterIds);
  await persistLinkedAuctionTournamentId(targetTournamentId, sourceTournamentId);

  return { ...result, mode: "auction" };
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

const AUCTION_ROSTER_STATUSES = new Set(["sold", "retained"]);

/** Resolve franchise from live auction roster when master assignment row is missing. */
export async function resolveAuctionFranchiseForMasterPlayer(
  masterPlayer: GlobalPlayer,
  auctionTournamentId: number,
): Promise<{ franchiseName: string | null; franchiseLogoUrl: string | null }> {
  let auctionPlayer:
    | {
        teamId: number | null;
        status: string;
      }
    | undefined;

  if (masterPlayer.auctionPlayerId) {
    [auctionPlayer] = await db
      .select({ teamId: playersTable.teamId, status: playersTable.status })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.id, masterPlayer.auctionPlayerId),
          eq(playersTable.tournamentId, auctionTournamentId),
        ),
      )
      .limit(1);
  }

  if (!auctionPlayer) {
    [auctionPlayer] = await db
      .select({ teamId: playersTable.teamId, status: playersTable.status })
      .from(playersTable)
      .where(
        and(
          eq(playersTable.tournamentId, auctionTournamentId),
          eq(playersTable.globalPlayerId, masterPlayer.id),
        ),
      )
      .limit(1);
  }

  if (
    !auctionPlayer?.teamId ||
    !AUCTION_ROSTER_STATUSES.has(auctionPlayer.status)
  ) {
    return { franchiseName: null, franchiseLogoUrl: null };
  }

  const [team] = await db
    .select({ name: teamsTable.name, logoUrl: teamsTable.logoUrl })
    .from(teamsTable)
    .where(
      and(
        eq(teamsTable.id, auctionPlayer.teamId),
        eq(teamsTable.tournamentId, auctionTournamentId),
      ),
    )
    .limit(1);

  if (!team) {
    return { franchiseName: null, franchiseLogoUrl: null };
  }

  return {
    franchiseName: team.name,
    franchiseLogoUrl: team.logoUrl,
  };
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
        eq(playerTeamAssignmentsTable.isActive, true),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt))
    .limit(1);

  let franchiseName: string | null = null;
  let franchiseLogoUrl: string | null = null;
  let sponsorName: string | null = null;
  let sponsorLogoUrl: string | null = null;

  if (assignment) {
    const [team] = await db
      .select()
      .from(masterTeamsTable)
      .where(eq(masterTeamsTable.id, assignment.teamId))
      .limit(1);
    if (team) {
      franchiseName = team.name;
      franchiseLogoUrl = team.logoUrl;
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

  if (!franchiseName) {
    const auctionFranchise = await resolveAuctionFranchiseForMasterPlayer(
      masterPlayer,
      lookupTournamentId,
    );
    franchiseName = auctionFranchise.franchiseName;
    franchiseLogoUrl = auctionFranchise.franchiseLogoUrl;
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

  const profile = await getTournamentProfile(tournamentId, masterPlayer.id);
  const [badmintonPlayer] = await db
    .select({ shortName: badmintonPlayersTable.shortName })
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        eq(badmintonPlayersTable.masterPlayerId, masterPlayer.id),
      ),
    )
    .limit(1);

  const tournamentInitials =
    profile?.initials ?? badmintonPlayer?.shortName ?? null;

  return {
    id: masterPlayer.id,
    displayName:
      masterPlayer.displayName ??
      masterPlayer.canonicalName ??
      [masterPlayer.firstName, masterPlayer.lastName].filter(Boolean).join(" "),
    photoUrl: masterPlayer.photoUrl,
    franchiseName,
    franchiseLogoUrl,
    tournamentInitials,
    teamName: franchiseName,
    teamLogoUrl: franchiseLogoUrl,
    firstName: masterPlayer.firstName,
    lastName: masterPlayer.lastName,
    country: masterPlayer.country,
    sponsorName,
    sponsorLogoUrl,
    worldRanking: masterPlayer.worldRanking,
    nationalRanking: masterPlayer.nationalRanking,
  };
}

/** Master player IDs tied to the actual auction roster (players table), not orphan PTA rows. */
export async function getAuctionRosterMasterPlayerIds(
  auctionTournamentId: number,
  options?: { syncMissing?: boolean },
): Promise<string[]> {
  const auctionPlayers = await db
    .select({ id: playersTable.id, globalPlayerId: playersTable.globalPlayerId })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, auctionTournamentId))
    .orderBy(asc(playersTable.id));

  const masterIds: string[] = [];
  const seen = new Set<string>();

  for (const ap of auctionPlayers) {
    let masterId = ap.globalPlayerId;

    if (!masterId) {
      const [byAuction] = await db
        .select({ id: globalPlayersTable.id })
        .from(globalPlayersTable)
        .where(eq(globalPlayersTable.auctionPlayerId, ap.id))
        .limit(1);
      masterId = byAuction?.id ?? null;
    }

    if (!masterId && options?.syncMissing) {
      const { syncAuctionPlayerToMaster } = await import("./sync");
      const syncResult = await syncAuctionPlayerToMaster(ap.id, auctionTournamentId);
      masterId = syncResult?.masterPlayerId ?? null;
    }

    if (masterId && !seen.has(masterId)) {
      seen.add(masterId);
      masterIds.push(masterId);
    }
  }

  return masterIds;
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

  const auctionTournamentId = settings.linkedAuctionTournamentId ?? tournamentId;

  const [auctionSource] = await db
    .select({ sport: tournamentsTable.sport, licenseStatus: tournamentsTable.licenseStatus })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, auctionTournamentId))
    .limit(1);

  if (auctionSource?.sport !== "badminton") {
    return [];
  }

  const masterPlayerIds = await getAuctionRosterMasterPlayerIds(auctionTournamentId, {
    syncMissing: true,
  });

  let masterPlayers: GlobalPlayer[];
  if (masterPlayerIds.length === 0) {
    masterPlayers = [];
  } else {
    masterPlayers = await db
      .select()
      .from(globalPlayersTable)
      .where(inArray(globalPlayersTable.id, masterPlayerIds));

    const order = new Map(masterPlayerIds.map((id, index) => [id, index]));
    masterPlayers.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  const items: MasterPlayerListItem[] = [];
  for (const mp of masterPlayers) {
    const enriched = await enrichMasterPlayerForTournament(
      mp,
      tournamentId,
      auctionTournamentId,
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

export type MatchRosterPlayerItem = {
  badmintonPlayerId: number;
  masterPlayerId: string | null;
  displayName: string;
  photoUrl: string | null;
  franchiseName: string | null;
  franchiseLogoUrl: string | null;
};

/** Registered badminton roster only — for match creation (not global master catalog). */
export async function listBadmintonPlayersForMatchRoster(
  tournamentId: number,
): Promise<MatchRosterPlayerItem[]> {
  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    tournament?.scoringSettingsJson as Record<string, unknown> | null,
  );

  const rows = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        eq(badmintonPlayersTable.status, "active"),
      ),
    )
    .orderBy(asc(badmintonPlayersTable.lastName), asc(badmintonPlayersTable.firstName));

  const items: MatchRosterPlayerItem[] = [];

  for (const bp of rows) {
    let franchiseName: string | null = null;
    let franchiseLogoUrl: string | null = null;

    const masterPlayerId = await resolveMasterPlayerId(bp);
    if (masterPlayerId) {
      const [mp] = await db
        .select()
        .from(globalPlayersTable)
        .where(eq(globalPlayersTable.id, masterPlayerId))
        .limit(1);
      if (mp) {
        const enriched = await enrichMasterPlayerForTournament(
          mp,
          tournamentId,
          settings.linkedAuctionTournamentId,
        );
        franchiseName = enriched.franchiseName;
        franchiseLogoUrl = enriched.franchiseLogoUrl;
      }
    }

    items.push({
      badmintonPlayerId: bp.id,
      masterPlayerId,
      displayName: bp.displayName ?? `${bp.firstName} ${bp.lastName}`.trim(),
      photoUrl: bp.photoUrl ?? null,
      franchiseName,
      franchiseLogoUrl,
    });
  }

  return items;
}

export type BadmintonPlayerListItem = BadmintonPlayer & {
  franchiseName: string | null;
  franchiseLogoUrl: string | null;
};

/** Organizer players page — full rows plus auction franchise when sold. */
export async function listBadmintonPlayersForOrganizer(
  tournamentId: number,
): Promise<BadmintonPlayerListItem[]> {
  const [tournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    tournament?.scoringSettingsJson as Record<string, unknown> | null,
  );

  const rows = await db
    .select()
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, tournamentId))
    .orderBy(asc(badmintonPlayersTable.lastName), asc(badmintonPlayersTable.firstName));

  const items: BadmintonPlayerListItem[] = [];

  for (const bp of rows) {
    let franchiseName: string | null = null;
    let franchiseLogoUrl: string | null = null;

    const masterPlayerId = await resolveMasterPlayerId(bp);
    if (masterPlayerId) {
      const [mp] = await db
        .select()
        .from(globalPlayersTable)
        .where(eq(globalPlayersTable.id, masterPlayerId))
        .limit(1);
      if (mp) {
        const enriched = await enrichMasterPlayerForTournament(
          mp,
          tournamentId,
          settings.linkedAuctionTournamentId,
        );
        franchiseName = enriched.franchiseName;
        franchiseLogoUrl = enriched.franchiseLogoUrl;
      }
    }

    items.push({
      ...bp,
      franchiseName,
      franchiseLogoUrl,
    });
  }

  return items;
}

/** Build side JSON from a registered badminton player row. */
export async function buildSideJsonFromBadmintonPlayer(
  badmintonPlayerId: number,
  tournamentId: number,
): Promise<Record<string, unknown>> {
  const [bp] = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, badmintonPlayerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!bp) {
    throw new Error("Player not found");
  }

  const masterPlayerId = await resolveMasterPlayerId(bp);
  if (masterPlayerId) {
    return buildSideJsonFromMasterPlayer(masterPlayerId, tournamentId, badmintonPlayerId);
  }

  const initials = await ensureTournamentInitials(bp);
  const displayName = bp.displayName ?? `${bp.firstName} ${bp.lastName}`.trim();

  return {
    label: displayName,
    shortLabel: initials || bp.shortName || displayName.slice(0, 3).toUpperCase(),
    countryCode: bp.countryCode ?? undefined,
    countryName: bp.countryName ?? undefined,
    photoUrl: bp.photoUrl ?? undefined,
    flagUrl: bp.flagUrl ?? undefined,
    franchiseName: bp.academyName ?? undefined,
    teamName: bp.academyName ?? undefined,
    masterPlayerId: `bp:${bp.id}`,
    playerIds: [bp.id],
  };
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
    const profile = await ensureTournamentProfile(tournamentId, masterPlayerId, {
      displayName: existing.displayName ?? undefined,
      photoOverrideUrl: existing.photoUrl,
    });
    await syncBadmintonShortNameFromProfile(tournamentId, masterPlayerId, profile.initials);
    const initials = await ensureTournamentInitials({ ...existing, shortName: profile.initials });
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
  const profile = await ensureTournamentProfile(tournamentId, masterPlayerId, {
    displayName,
    photoOverrideUrl: mp.photoUrl,
  });
  const shortName = profile.initials;

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

async function countNewMasterImports(
  tournamentId: number,
  masterPlayerIds: string[],
): Promise<number> {
  let newImports = 0;
  for (const masterId of masterPlayerIds) {
    const [existing] = await db
      .select({ id: badmintonPlayersTable.id })
      .from(badmintonPlayersTable)
      .where(
        and(
          eq(badmintonPlayersTable.tournamentId, tournamentId),
          eq(badmintonPlayersTable.masterPlayerId, masterId),
        ),
      )
      .limit(1);
    if (!existing) newImports++;
  }
  return newImports;
}

async function assertBadmintonTrialImportLimit(
  targetTournamentId: number,
  auctionSourceTournamentId: number,
  masterPlayerIds: string[],
): Promise<void> {
  const [sourceTournament] = await db
    .select({ sport: tournamentsTable.sport, licenseStatus: tournamentsTable.licenseStatus })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, auctionSourceTournamentId))
    .limit(1);

  if (sourceTournament?.sport !== "badminton") {
    throw new Error("Auction source must be a badminton tournament");
  }

  if (isLicensedBadmintonTournament(sourceTournament.licenseStatus)) {
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, targetTournamentId));

  const existingCount = Number(count);
  const newImports = await countNewMasterImports(targetTournamentId, masterPlayerIds);

  if (existingCount + newImports > BADMINTON_TRIAL_IMPORT_PLAYER_LIMIT) {
    const remaining = Math.max(0, BADMINTON_TRIAL_IMPORT_PLAYER_LIMIT - existingCount);
    throw new Error(
      remaining > 0
        ? `Trial tournaments allow up to ${BADMINTON_TRIAL_IMPORT_PLAYER_LIMIT} badminton players (${remaining} slot${remaining === 1 ? "" : "s"} left). Upgrade license for full roster.`
        : `Trial limit reached (${BADMINTON_TRIAL_IMPORT_PLAYER_LIMIT} players). Upgrade license to import more.`,
    );
  }
}

/** Import selected master players into badminton_players. */
export async function importMasterPlayersToBadminton(
  tournamentId: number,
  masterPlayerIds: string[],
): Promise<{ imported: number; skipped: number }> {
  const [targetTournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    targetTournament?.scoringSettingsJson as Record<string, unknown> | null,
  );
  const auctionSourceTournamentId = settings.linkedAuctionTournamentId ?? tournamentId;

  await assertBadmintonTrialImportLimit(
    tournamentId,
    auctionSourceTournamentId,
    masterPlayerIds,
  );

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
    const profile = await ensureTournamentProfile(tournamentId, masterId, {
      displayName,
      photoOverrideUrl: mp.photoUrl,
    });
    const shortName = profile.initials;

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

  const profile = await ensureTournamentProfile(tournamentId, masterPlayerId, {
    displayName: bp.displayName ?? enriched.displayName,
    photoOverrideUrl: bp.photoUrl ?? mp.photoUrl,
  });

  const displayName = profile.displayName;
  const shortLabel = profile.initials;
  const franchiseName = enriched.franchiseName ?? undefined;
  const franchiseLogoUrl = enriched.franchiseLogoUrl ?? undefined;

  return {
    label: displayName,
    shortLabel,
    countryCode: bp.countryCode ?? mp.country?.slice(0, 3).toUpperCase(),
    countryName: bp.countryName ?? mp.country ?? undefined,
    photoUrl: profile.photoOverrideUrl ?? bp.photoUrl ?? mp.photoUrl ?? undefined,
    franchiseName,
    franchiseLogoUrl,
    teamName: franchiseName,
    teamLogoUrl: franchiseLogoUrl,
    flagUrl: franchiseLogoUrl ?? undefined,
    teamColor: undefined,
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
