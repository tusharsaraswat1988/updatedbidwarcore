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
  type BadmintonOverlayScene,
  type BadmintonVenueScene,
  type ScoreBoardSponsor,
  getBadmintonBranding,
  resolveBadmintonSponsorLogos,
} from "@workspace/sports-badminton/branding";
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

export type {
  BadmintonBranding,
  BadmintonOverlayScene,
  BadmintonVenueScene,
  ScoreBoardSponsor,
};
export { getBadmintonBranding, resolveBadmintonSponsorLogos };

export type MasterPlayerListItem = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  /** Team / franchise from Player Registry — informational metadata only. */
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
  /** Player Registry source tournament for imports. */
  linkedPlayerRegistryTournamentId?: number;
  autoSyncRegistryPlayers?: boolean;
  /**
   * @deprecated Dual-read alias for linkedPlayerRegistryTournamentId (legacy clients).
   */
  linkedAuctionTournamentId?: number;
  /**
   * @deprecated Dual-read alias for autoSyncRegistryPlayers (legacy clients).
   */
  autoSyncAuctionPlayers?: boolean;
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

function parseLinkedRegistryTournamentId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return undefined;
}

export function getBadmintonSettings(
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): BadmintonTournamentSettings {
  const raw = scoringSettingsJson ?? {};
  const linked =
    parseLinkedRegistryTournamentId(raw.linkedPlayerRegistryTournamentId) ??
    parseLinkedRegistryTournamentId(raw.linkedAuctionTournamentId);
  const autoSync =
    raw.autoSyncRegistryPlayers === true || raw.autoSyncAuctionPlayers === true;
  return {
    linkedPlayerRegistryTournamentId: linked,
    autoSyncRegistryPlayers: autoSync,
    // Dual-read aliases for legacy clients / UI still using auction names.
    linkedAuctionTournamentId: linked,
    autoSyncAuctionPlayers: autoSync,
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
  return updateBroadcastSettings(tournamentId, {
    primaryMatchId: primaryMatchId && primaryMatchId > 0 ? primaryMatchId : null,
  });
}

/** Operator Broadcast Director — overlay/venue scene overrides for persistent screens. */
export async function updateBroadcastPresentation(
  tournamentId: number,
  input: {
    overlayScene?: BadmintonOverlayScene;
    venueScene?: BadmintonVenueScene;
  },
): Promise<BadmintonBranding> {
  return updateBroadcastSettings(tournamentId, {
    ...(input.overlayScene !== undefined ? { overlayScene: input.overlayScene } : {}),
    ...(input.venueScene !== undefined ? { venueScene: input.venueScene } : {}),
  });
}

async function updateBroadcastSettings(
  tournamentId: number,
  patch: Record<string, unknown>,
): Promise<BadmintonBranding> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) throw new Error("Tournament not found");

  const currentSettings = (tournament.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const currentBroadcast = (currentSettings.broadcast ?? {}) as Record<string, unknown>;
  const nextBroadcast = { ...currentBroadcast, ...patch };
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

/** Copy this tournament's platform branding into badminton LED/OBS settings. */
export async function importTournamentBrandingToBadminton(
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

/** @deprecated Prefer importTournamentBrandingToBadminton */
export const importAuctionBrandingToBadminton = importTournamentBrandingToBadminton;

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

/** Persist the linked Player Registry source tournament (dual-writes legacy alias key). */
async function persistLinkedPlayerRegistryTournamentId(
  tournamentId: number,
  linkedPlayerRegistryTournamentId: number,
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
        linkedPlayerRegistryTournamentId,
        // Legacy alias for older clients still reading linkedAuctionTournamentId.
        linkedAuctionTournamentId: linkedPlayerRegistryTournamentId,
      },
    })
    .where(eq(tournamentsTable.id, tournamentId));
}

/** @deprecated Prefer persistLinkedPlayerRegistryTournamentId */
export const persistLinkedAuctionTournamentId = persistLinkedPlayerRegistryTournamentId;

/** Import players from another tournament (badminton roster or Player Registry). */
export async function importPlayersFromTournament(
  targetTournamentId: number,
  sourceTournamentId: number,
): Promise<{ imported: number; skipped: number; mode: "badminton" | "registry" }> {
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
    await persistLinkedPlayerRegistryTournamentId(targetTournamentId, sourceTournamentId);
    return { ...result, mode: "badminton" };
  }

  const masterIds = await resolveImportSourceMasterPlayerIds(sourceTournamentId);
  const result = await importMasterPlayersToBadminton(targetTournamentId, masterIds);
  await persistLinkedPlayerRegistryTournamentId(targetTournamentId, sourceTournamentId);

  return { ...result, mode: "registry" };
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
  linkedRegistryTournamentId?: number,
): Promise<Omit<MasterPlayerListItem, "alreadyImported" | "badmintonPlayerId">> {
  const lookupTournamentId = linkedRegistryTournamentId ?? tournamentId;

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

/** Master player IDs tied to Player Registry team assignments for a source tournament. */
export async function getPlayerRegistryMasterPlayerIds(
  sourceTournamentId: number,
): Promise<string[]> {
  const rows = await db
    .select({ playerId: playerTeamAssignmentsTable.playerId })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, sourceTournamentId),
        eq(playerTeamAssignmentsTable.isActive, true),
      ),
    )
    .orderBy(desc(playerTeamAssignmentsTable.assignedAt));

  const masterIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.playerId && !seen.has(row.playerId)) {
      seen.add(row.playerId);
      masterIds.push(row.playerId);
    }
  }
  return masterIds;
}

/** Master player IDs from a badminton scoring roster (including withdrawn — for re-import). */
export async function getBadmintonRosterMasterPlayerIds(
  sourceTournamentId: number,
): Promise<string[]> {
  const rows = await db
    .select({ masterPlayerId: badmintonPlayersTable.masterPlayerId })
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, sourceTournamentId))
    .orderBy(asc(badmintonPlayersTable.id));

  const masterIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.masterPlayerId && !seen.has(row.masterPlayerId)) {
      seen.add(row.masterPlayerId);
      masterIds.push(row.masterPlayerId);
    }
  }
  return masterIds;
}

/**
 * Resolve importable master IDs for a source tournament.
 * Prefer the badminton roster; fall back to Player Registry team assignments.
 * Never touches the auction players table.
 */
export async function resolveImportSourceMasterPlayerIds(
  sourceTournamentId: number,
): Promise<string[]> {
  const fromBadminton = await getBadmintonRosterMasterPlayerIds(sourceTournamentId);
  if (fromBadminton.length > 0) return fromBadminton;
  return getPlayerRegistryMasterPlayerIds(sourceTournamentId);
}

/** List master players available for import into a badminton tournament. */
export async function listMasterPlayersForBadminton(
  tournamentId: number,
  sourceTournamentIdOverride?: number,
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
    .select({
      id: badmintonPlayersTable.id,
      masterPlayerId: badmintonPlayersTable.masterPlayerId,
    })
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        // Soft-inactive / withdrawn players should be re-importable.
        eq(badmintonPlayersTable.status, "active"),
      ),
    );

  const importedByMasterId = new Map<string, number>();
  for (const bp of imported) {
    if (bp.masterPlayerId) importedByMasterId.set(bp.masterPlayerId, bp.id);
  }

  const registrySourceTournamentId =
    sourceTournamentIdOverride ??
    settings.linkedPlayerRegistryTournamentId ??
    settings.linkedAuctionTournamentId ??
    tournamentId;

  const [registrySource] = await db
    .select({ sport: tournamentsTable.sport, licenseStatus: tournamentsTable.licenseStatus })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, registrySourceTournamentId))
    .limit(1);

  if (registrySource?.sport !== "badminton") {
    return [];
  }

  const masterPlayerIds = await resolveImportSourceMasterPlayerIds(registrySourceTournamentId);

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
      registrySourceTournamentId,
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
          settings.linkedPlayerRegistryTournamentId ?? settings.linkedAuctionTournamentId,
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

/** Organizer players page — full rows plus Player Registry franchise when assigned. */
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
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, tournamentId),
        eq(badmintonPlayersTable.status, "active"),
      ),
    )
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
          settings.linkedPlayerRegistryTournamentId ?? settings.linkedAuctionTournamentId,
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
      .select({ id: badmintonPlayersTable.id, status: badmintonPlayersTable.status })
      .from(badmintonPlayersTable)
      .where(
        and(
          eq(badmintonPlayersTable.tournamentId, tournamentId),
          eq(badmintonPlayersTable.masterPlayerId, masterId),
        ),
      )
      .limit(1);
    // Withdrawn rows are reinstateable and still consume a trial slot once active again.
    if (!existing || existing.status !== "active") newImports++;
  }
  return newImports;
}

async function assertBadmintonTrialImportLimit(
  targetTournamentId: number,
  registrySourceTournamentId: number,
  masterPlayerIds: string[],
): Promise<void> {
  const [sourceTournament] = await db
    .select({ sport: tournamentsTable.sport, licenseStatus: tournamentsTable.licenseStatus })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, registrySourceTournamentId))
    .limit(1);

  if (sourceTournament?.sport !== "badminton") {
    throw new Error("Linked registry source must be a badminton tournament");
  }

  if (isLicensedBadmintonTournament(sourceTournament.licenseStatus)) {
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.tournamentId, targetTournamentId),
        eq(badmintonPlayersTable.status, "active"),
      ),
    );

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
  sourceTournamentIdOverride?: number,
): Promise<{ imported: number; skipped: number }> {
  const [targetTournament] = await db
    .select({ scoringSettingsJson: tournamentsTable.scoringSettingsJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  const settings = getBadmintonSettings(
    targetTournament?.scoringSettingsJson as Record<string, unknown> | null,
  );
  const registrySourceTournamentId =
    sourceTournamentIdOverride ??
    settings.linkedPlayerRegistryTournamentId ??
    settings.linkedAuctionTournamentId ??
    tournamentId;

  if (
    sourceTournamentIdOverride != null &&
    sourceTournamentIdOverride !== registrySourceTournamentId
  ) {
    await persistLinkedPlayerRegistryTournamentId(tournamentId, sourceTournamentIdOverride);
  }

  await assertBadmintonTrialImportLimit(
    tournamentId,
    registrySourceTournamentId,
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
      if (existing.status !== "active") {
        await db
          .update(badmintonPlayersTable)
          .set({ status: "active" })
          .where(eq(badmintonPlayersTable.id, existing.id));
        imported++;
      } else {
        skipped++;
      }
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
    settings.linkedPlayerRegistryTournamentId ?? settings.linkedAuctionTournamentId,
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
