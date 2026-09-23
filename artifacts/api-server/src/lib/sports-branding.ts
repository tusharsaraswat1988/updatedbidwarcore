/**
 * Module-neutral sports branding service.
 * Operates on tournamentsTable and scoringSettingsJson without sport-specific or auction dependencies.
 */

import { eq } from "drizzle-orm";
import { db, tournamentsTable } from "@workspace/db";
import {
  commitBatchCloudinaryImageWrites,
  destroyRemovedCloudinaryImages,
} from "./cloudinary-media-service";
import {
  listRemovedSponsorLogos,
  parseSponsorLogosJson,
} from "./sponsor-logo-cleanup";
import {
  queueImageFieldChange,
  type ImageFieldChange,
} from "./cloudinary-image-fields";

export type SportsOverlayScene =
  | "auto"
  | "compact"
  | "full"
  | "intro"
  | "winner"
  | "sponsor"
  | "next"
  | "multi"
  | "results"
  | "leaderboards";

export type SportsVenueScene =
  | "auto"
  | "live_score"
  | "standby"
  | "multi"
  | "intro"
  | "winner"
  | "sponsor"
  | "banner"
  | "next"
  | "results"
  | "leaderboards";

export type SportsBannerFit = "cover" | "contain";

export const SPORTS_OVERLAY_SCENES: readonly SportsOverlayScene[] = [
  "auto",
  "compact",
  "full",
  "intro",
  "winner",
  "sponsor",
  "next",
  "multi",
  "results",
  "leaderboards",
] as const;

export const SPORTS_VENUE_SCENES: readonly SportsVenueScene[] = [
  "auto",
  "live_score",
  "standby",
  "multi",
  "intro",
  "winner",
  "sponsor",
  "banner",
  "next",
  "results",
  "leaderboards",
] as const;

export type ScoreBoardSponsor = {
  logoUrl: string | null;
  logoPublicId?: string | null;
  name: string | null;
  title: string | null;
};

export type SportsBranding = {
  displayName: string;
  logoUrl: string | null;
  sponsorLogos: string | null;
  venue: string | null;
  organizerName: string | null;
  primaryColor: string;
  accentColor: string;
  scoreBoardSponsor: ScoreBoardSponsor | null;
  /** Organizer-selected LIVE match for persistent Venue/OBS follow URLs. */
  primaryBroadcastMatchId: number | null;
  /** Operator-forced OBS overlay scene (Director). `auto` = follow live match + URL type. */
  overlayScene: SportsOverlayScene;
  /** Operator-forced Venue Scoreboard scene. `auto` = live board when match exists. */
  venueScene: SportsVenueScene;
  /** Operator-selected upcoming match for the Next moment (venue + OBS). */
  upNextMatchId: number | null;
  /** Operator-selected sponsor URL for the full-screen Sponsor moment. */
  spotlightSponsorUrl: string | null;
  /** Operator-pinned sponsor URL on live venue/OBS chrome until unpin. */
  pinnedSponsorUrl: string | null;
  /** Control Center: loop music On/Pause for venue LED. */
  venueMusicPlaying: boolean;
  /** Sport-specific loop track override (null = fall through to auction/platform). */
  venueMusicUrl: string | null;
  /** Original filename for the override track (display only). */
  venueMusicFileName: string | null;
  /** Loop music volume 0–100. */
  venueMusicVolume: number;
  /**
   * Effective loop URL for venue LED:
   * sport override → auction break music → platform default.
   */
  resolvedVenueMusicUrl: string | null;
  /** Sport-specific venue banner override (null = fall through to auction main banner). */
  venueBannerUrl: string | null;
  venueBannerPublicId: string | null;
  venueBannerFit: SportsBannerFit;
  /** Tournament auction main banner URL (for import UI). */
  auctionMainBannerUrl: string | null;
  /**
   * Effective banner for Venue Scoreboard Banner moment:
   * sport override → auction main banner.
   */
  resolvedVenueBannerUrl: string | null;
  resolvedVenueBannerFit: SportsBannerFit;
};

export type SportsBrandingInput = {
  displayName?: string;
  logoUrl?: string | null;
  logoPublicId?: string | null;
  sponsorLogos?: string | null;
  venue?: string | null;
  organizerName?: string | null;
  primaryColor?: string;
  accentColor?: string;
  scoreBoardSponsor?: ScoreBoardSponsor | null;
};

export type BroadcastPresentationInput = {
  overlayScene?: SportsOverlayScene;
  venueScene?: SportsVenueScene;
  upNextMatchId?: number | null;
  spotlightSponsorUrl?: string | null;
  pinnedSponsorUrl?: string | null;
  venueMusicPlaying?: boolean;
  venueMusicUrl?: string | null;
  venueMusicFileName?: string | null;
  venueMusicVolume?: number;
  importAuctionMusic?: boolean;
  venueBannerUrl?: string | null;
  venueBannerPublicId?: string | null;
  venueBannerFit?: "cover" | "contain";
  importAuctionBanner?: boolean;
};

function parseScoreBoardSponsor(raw: unknown): ScoreBoardSponsor | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const logoUrl =
    typeof o.logoUrl === "string" && o.logoUrl.trim() ? o.logoUrl.trim() : null;
  const logoPublicId =
    typeof o.logoPublicId === "string" && o.logoPublicId.trim()
      ? o.logoPublicId.trim()
      : null;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : null;
  if (!logoUrl && !name && !title) return null;
  return { logoUrl, logoPublicId, name, title };
}

export function resolveSportsSponsorLogos(
  brandingRaw: Record<string, unknown>,
  tournamentSponsorLogos: string | null | undefined,
): string | null {
  if ("sponsorLogos" in brandingRaw) {
    const value = brandingRaw.sponsorLogos;
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
  }
  return tournamentSponsorLogos ?? null;
}

function broadcastBlock(
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return (scoringSettingsJson?.broadcast ?? {}) as Record<string, unknown>;
}

function parsePrimaryBroadcastMatchId(
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): number | null {
  const broadcast = broadcastBlock(scoringSettingsJson);
  const raw = broadcast.primaryMatchId;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    return n > 0 ? n : null;
  }
  return null;
}

function parsePositiveId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    return n > 0 ? n : null;
  }
  return null;
}

export function parseUpNextMatchId(raw: unknown): number | null {
  return parsePositiveId(raw);
}

export function parseSponsorUrlKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function parseOverlayScene(raw: unknown): SportsOverlayScene {
  if (typeof raw === "string" && (SPORTS_OVERLAY_SCENES as readonly string[]).includes(raw)) {
    return raw as SportsOverlayScene;
  }
  return "auto";
}

export function parseVenueScene(raw: unknown): SportsVenueScene {
  if (typeof raw === "string" && (SPORTS_VENUE_SCENES as readonly string[]).includes(raw)) {
    return raw as SportsVenueScene;
  }
  return "auto";
}

export function parseVenueMusicPlaying(raw: unknown): boolean {
  return raw === true;
}

export function parseVenueMusicUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function parseVenueMusicFileName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 180) : null;
}

export function parseVenueMusicVolume(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return 80;
}

export function resolveVenueMusicUrl(
  sportOverride: string | null | undefined,
  auctionBreakUrl: string | null | undefined,
  platformDefaultUrl: string | null | undefined,
): string | null {
  const override = sportOverride?.trim();
  if (override) return override;
  const auction = auctionBreakUrl?.trim();
  if (auction) return auction;
  const platform = platformDefaultUrl?.trim();
  if (platform) return platform;
  return null;
}

export function parseVenueBannerUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function parseVenueBannerPublicId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

export function parseVenueBannerFit(raw: unknown): SportsBannerFit {
  return raw === "contain" ? "contain" : "cover";
}

export function resolveVenueBannerUrl(
  sportOverride: string | null | undefined,
  auctionMainBannerUrl: string | null | undefined,
): string | null {
  const override = sportOverride?.trim();
  if (override) return override;
  const auction = auctionMainBannerUrl?.trim();
  if (auction) return auction;
  return null;
}

export function resolveVenueBannerFit(
  broadcast: Record<string, unknown>,
  auctionFit: unknown,
): SportsBannerFit {
  if ("venueBannerFit" in broadcast) return parseVenueBannerFit(broadcast.venueBannerFit);
  return parseVenueBannerFit(auctionFit);
}

export function getSportsBranding(
  tournament: {
    name: string;
    logoUrl?: string | null;
    sponsorLogos?: string | null;
    venue?: string | null;
    organizerName?: string | null;
    breakEndMusicUrl?: string | null;
    mainBannerUrl?: string | null;
    mainBannerFit?: string | null;
  },
  scoringSettingsJson: Record<string, unknown> | null | undefined,
  platformBreakMusicUrl?: string | null,
): SportsBranding {
  const raw = (scoringSettingsJson?.branding ?? {}) as Record<string, unknown>;
  const broadcast = broadcastBlock(scoringSettingsJson);
  const venueMusicUrl = parseVenueMusicUrl(broadcast.venueMusicUrl);
  const venueBannerUrl = parseVenueBannerUrl(broadcast.venueBannerUrl);
  const auctionMainBannerUrl = tournament.mainBannerUrl?.trim() || null;
  return {
    displayName:
      typeof raw.displayName === "string" && raw.displayName.trim()
        ? raw.displayName.trim()
        : tournament.name,
    logoUrl: tournament.logoUrl ?? null,
    sponsorLogos: resolveSportsSponsorLogos(raw, tournament.sponsorLogos),
    venue: tournament.venue ?? null,
    organizerName: tournament.organizerName ?? null,
    primaryColor:
      typeof raw.primaryColor === "string" && raw.primaryColor.trim()
        ? raw.primaryColor.trim()
        : "#0070f3",
    accentColor:
      typeof raw.accentColor === "string" && raw.accentColor.trim()
        ? raw.accentColor.trim()
        : "#4fc3f7",
    scoreBoardSponsor: parseScoreBoardSponsor(raw.scoreBoardSponsor),
    primaryBroadcastMatchId: parsePrimaryBroadcastMatchId(scoringSettingsJson),
    overlayScene: parseOverlayScene(broadcast.overlayScene),
    venueScene: parseVenueScene(broadcast.venueScene),
    upNextMatchId: parseUpNextMatchId(broadcast.upNextMatchId),
    spotlightSponsorUrl: parseSponsorUrlKey(broadcast.spotlightSponsorUrl),
    pinnedSponsorUrl: parseSponsorUrlKey(broadcast.pinnedSponsorUrl),
    venueMusicPlaying: parseVenueMusicPlaying(broadcast.venueMusicPlaying),
    venueMusicUrl,
    venueMusicFileName: venueMusicUrl
      ? parseVenueMusicFileName(broadcast.venueMusicFileName)
      : null,
    venueMusicVolume: parseVenueMusicVolume(broadcast.venueMusicVolume),
    resolvedVenueMusicUrl: resolveVenueMusicUrl(
      venueMusicUrl,
      tournament.breakEndMusicUrl,
      platformBreakMusicUrl,
    ),
    venueBannerUrl,
    venueBannerPublicId: venueBannerUrl
      ? parseVenueBannerPublicId(broadcast.venueBannerPublicId)
      : null,
    venueBannerFit: parseVenueBannerFit(broadcast.venueBannerFit),
    auctionMainBannerUrl,
    resolvedVenueBannerUrl: resolveVenueBannerUrl(venueBannerUrl, auctionMainBannerUrl),
    resolvedVenueBannerFit: resolveVenueBannerFit(broadcast, tournament.mainBannerFit),
  };
}

export async function loadSportsBranding(
  tournamentId: number,
): Promise<SportsBranding | null> {
  const [tournament] = await db
    .select({
      name: tournamentsTable.name,
      logoUrl: tournamentsTable.logoUrl,
      sponsorLogos: tournamentsTable.sponsorLogos,
      venue: tournamentsTable.venue,
      organizerName: tournamentsTable.organizerName,
      breakEndMusicUrl: tournamentsTable.breakEndMusicUrl,
      mainBannerUrl: tournamentsTable.mainBannerUrl,
      mainBannerFit: tournamentsTable.mainBannerFit,
      scoringSettingsJson: tournamentsTable.scoringSettingsJson,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) return null;
  const { getPlatformDefaultAudioCached } = await import("./platform-audio-defaults");
  const platformAudio = await getPlatformDefaultAudioCached();
  return getSportsBranding(
    tournament,
    tournament.scoringSettingsJson as Record<string, unknown>,
    platformAudio.breakEndMusicUrl,
  );
}

export async function updateSportsBranding(
  tournamentId: number,
  input: SportsBrandingInput,
  logger?: { error?: (obj: unknown, msg?: string) => void; warn?: (obj: unknown, msg?: string) => void },
): Promise<SportsBranding> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) throw new Error("Tournament not found");

  const currentBranding = getSportsBranding(
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
    tournamentUpdates.sponsorLogos = input.sponsorLogos;
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
      context: { route: "sportsBranding.update", tournamentId },
    });
  } else {
    await persistBrandingUpdate();
  }

  if (removedSponsorLogos.length > 0) {
    await destroyRemovedCloudinaryImages(removedSponsorLogos, logger, {
      route: "sportsBranding.update.sponsorLogos",
      tournamentId,
    });
  }

  const loaded = await loadSportsBranding(tournamentId);
  if (!loaded) throw new Error("Tournament not found");
  return loaded;
}

export async function updateBroadcastSettings(
  tournamentId: number,
  patch: Record<string, unknown>,
): Promise<SportsBranding> {
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

  const loaded = await loadSportsBranding(tournamentId);
  if (!loaded) throw new Error("Tournament not found");
  return loaded;
}

export async function updateBroadcastPresentation(
  tournamentId: number,
  input: BroadcastPresentationInput,
): Promise<SportsBranding> {
  const patch: Record<string, unknown> = {
    ...(input.overlayScene !== undefined ? { overlayScene: input.overlayScene } : {}),
    ...(input.venueScene !== undefined ? { venueScene: input.venueScene } : {}),
    ...(input.upNextMatchId !== undefined
      ? {
          upNextMatchId:
            input.upNextMatchId && input.upNextMatchId > 0
              ? Math.floor(input.upNextMatchId)
              : null,
        }
      : {}),
    ...(input.spotlightSponsorUrl !== undefined
      ? {
          spotlightSponsorUrl: input.spotlightSponsorUrl?.trim() || null,
        }
      : {}),
    ...(input.pinnedSponsorUrl !== undefined
      ? {
          pinnedSponsorUrl: input.pinnedSponsorUrl?.trim() || null,
        }
      : {}),
    ...(input.venueMusicPlaying !== undefined
      ? { venueMusicPlaying: input.venueMusicPlaying }
      : {}),
    ...(input.venueMusicUrl !== undefined ? { venueMusicUrl: input.venueMusicUrl } : {}),
    ...(input.venueMusicFileName !== undefined
      ? { venueMusicFileName: input.venueMusicFileName }
      : {}),
    ...(input.venueMusicVolume !== undefined
      ? { venueMusicVolume: input.venueMusicVolume }
      : {}),
  };

  if (input.venueMusicUrl === null) {
    patch.venueMusicFileName = null;
  }

  if (input.importAuctionMusic) {
    const [tournament] = await db
      .select({ breakEndMusicUrl: tournamentsTable.breakEndMusicUrl })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);
    let url = tournament?.breakEndMusicUrl?.trim() || null;
    if (!url) {
      const { getPlatformDefaultAudioCached } = await import("./platform-audio-defaults");
      const platformAudio = await getPlatformDefaultAudioCached();
      url = platformAudio.breakEndMusicUrl?.trim() || null;
    }
    if (!url) throw new Error("No auction break music set for this tournament");
    patch.venueMusicUrl = url;
    patch.venueMusicFileName = "Auction break music";
  }

  if (input.importAuctionBanner) {
    const [tournament] = await db
      .select({
        mainBannerUrl: tournamentsTable.mainBannerUrl,
        mainBannerPublicId: tournamentsTable.mainBannerPublicId,
        mainBannerFit: tournamentsTable.mainBannerFit,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);
    const url = tournament?.mainBannerUrl?.trim() || null;
    if (!url) throw new Error("No auction banner set for this tournament");
    patch.venueBannerUrl = url;
    patch.venueBannerPublicId = tournament?.mainBannerPublicId?.trim() || null;
    patch.venueBannerFit =
      tournament?.mainBannerFit === "contain" ? "contain" : "cover";
  } else if (input.venueBannerUrl !== undefined) {
    const nextUrl = input.venueBannerUrl?.trim() || null;
    patch.venueBannerUrl = nextUrl;
    patch.venueBannerPublicId = nextUrl
      ? (input.venueBannerPublicId?.trim() || null)
      : null;
  } else if (input.venueBannerPublicId !== undefined) {
    patch.venueBannerPublicId = input.venueBannerPublicId;
  }

  if (input.venueBannerFit !== undefined) {
    patch.venueBannerFit = input.venueBannerFit;
  }

  return updateBroadcastSettings(tournamentId, patch);
}

export async function importBrandingFromTournament(
  targetTournamentId: number,
  sourceTournamentId: number,
): Promise<SportsBranding> {
  const [source] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, sourceTournamentId))
    .limit(1);

  if (!source) throw new Error("Source tournament not found");

  const sourceBranding = getSportsBranding(
    source,
    source.scoringSettingsJson as Record<string, unknown>,
  );

  return updateSportsBranding(targetTournamentId, {
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

export async function importTournamentBrandingToSports(
  tournamentId: number,
): Promise<SportsBranding> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament) throw new Error("Tournament not found");

  return updateSportsBranding(tournamentId, {
    displayName: tournament.name,
    logoUrl: tournament.logoUrl ?? null,
    logoPublicId: tournament.logoPublicId ?? null,
    sponsorLogos: tournament.sponsorLogos ?? null,
    venue: tournament.venue ?? null,
    organizerName: tournament.organizerName ?? null,
  });
}
