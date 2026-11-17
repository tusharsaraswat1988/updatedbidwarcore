import { parseBidValueOptions } from "@workspace/api-base/bid-value";
import { normalizeAuctionUnit } from "@workspace/api-base/auction-unit";
import { parseRegistrationFieldsConfig } from "@workspace/api-base/registration-fields";
import {
  parsePlayerRegistrationMode,
  parseRegistrationCategoryMode,
} from "@workspace/api-base/player-registration-mode";
import {
  resolveBroadcastAudioUrl,
  type PlatformAudioDefaults,
} from "@workspace/api-base/platform-audio";
import { resolveTournamentFeatures } from "@workspace/api-base/tournament-features";
import { resolveBadmintonSponsorLogos } from "@workspace/sports-badminton";
import type { tournamentsTable } from "@workspace/db";
import {
  isAuctionEnabled,
  isScoringEnabled,
  tryResolveTournamentProductMode,
  resolvePublicBroadcasts,
} from "@workspace/platform-core";
import { catalogBindingSerializerFields } from "../tournament-catalog-bindings";

type TournamentRow = typeof tournamentsTable.$inferSelect;

type TournamentSerializerOptions = {
  includeScoringPin?: boolean;
  platformDefaults?: PlatformAudioDefaults;
};

/** Spectator-safe DTO: Strictly public metadata for fan screens, matches & spectator views. */
export function spectatorTournamentSerializer(
  t: TournamentRow,
  options?: TournamentSerializerOptions,
) {
  const scoringSettings = (t.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const brandingRaw = (scoringSettings.branding ?? {}) as Record<string, unknown>;
  const resolvedSponsorLogos = resolveBadmintonSponsorLogos(brandingRaw, t.sponsorLogos);
  const auctionOn = isAuctionEnabled(t);
  const scoringOn = isScoringEnabled(t);

  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    sportId: t.sportId ?? null,
    auctionCode: t.auctionCode ?? null,
    venue: t.venue,
    city: t.city ?? null,
    auctionDate: t.auctionDate,
    auctionTime: t.auctionTime ?? null,
    matchDates: t.matchDates ?? null,
    organizerName: t.organizerName,
    logoUrl: t.logoUrl,
    sponsorLogos: resolvedSponsorLogos,
    mainBannerUrl: t.mainBannerUrl ?? null,
    mainBannerEnabled: t.mainBannerEnabled ?? false,
    mainBannerFit: t.mainBannerFit ?? "cover",
    status: t.status,
    auctionEnabled: auctionOn,
    scoringEnabled: scoringOn,
    productMode: tryResolveTournamentProductMode(t) ?? "auction_only",
    scoringPhase: t.scoringPhase ?? "disabled",
    features: resolveTournamentFeatures(t.featuresJson),
    cheerMessagesEnabled: t.cheerMessagesEnabled ?? true,
    cheerMessagePresets: t.cheerMessagePresets ?? null,
    broadcast: resolvePublicBroadcasts(t.featuresJson) ?? null,
    ...(auctionOn ? { auctionUnit: normalizeAuctionUnit(t.auctionUnit) } : {}),
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.createdAt ? String(t.createdAt) : new Date().toISOString()),
  };
}

/** Public routes: register, display, live, obs, side-display. */
export function publicTournamentSerializer(
  t: TournamentRow,
  options?: TournamentSerializerOptions,
) {
  const platform = options?.platformDefaults;
  const scoringSettings = (t.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const brandingRaw = (scoringSettings.branding ?? {}) as Record<string, unknown>;
  const resolvedSponsorLogos = resolveBadmintonSponsorLogos(brandingRaw, t.sponsorLogos);
  const auctionOn = isAuctionEnabled(t);

  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    sportId: t.sportId ?? null,
    auctionCode: t.auctionCode ?? null,
    venue: t.venue,
    city: t.city ?? null,
    auctionDate: t.auctionDate,
    auctionTime: t.auctionTime ?? null,
    organizerName: t.organizerName,
    logoUrl: t.logoUrl,
    sponsorLogos: resolvedSponsorLogos,
    auctionUnit: auctionOn ? normalizeAuctionUnit(t.auctionUnit) : undefined,
    basePurse: auctionOn ? t.basePurse : undefined,
    minBid: auctionOn ? t.minBid : undefined,
    bidIncrement: auctionOn ? t.bidIncrement : undefined,
    bidTier1UpTo: auctionOn ? t.bidTier1UpTo : undefined,
    bidTier1Increment: auctionOn ? t.bidTier1Increment : undefined,
    bidTier2UpTo: auctionOn ? t.bidTier2UpTo : undefined,
    bidTier2Increment: auctionOn ? t.bidTier2Increment : undefined,
    bidTier3Increment: auctionOn ? t.bidTier3Increment : undefined,
    bidTiers: auctionOn ? t.bidTiers : undefined,
    timerSeconds: auctionOn ? t.timerSeconds : undefined,
    bidTimerSeconds: auctionOn ? t.bidTimerSeconds : undefined,
    bidExtensionEnabled: auctionOn ? (t.bidExtensionEnabled ?? false) : undefined,
    bidExtensionThresholdSeconds: auctionOn ? (t.bidExtensionThresholdSeconds ?? 3) : undefined,
    bidExtensionSeconds: auctionOn ? (t.bidExtensionSeconds ?? 5) : undefined,
    playerSelectionMode: auctionOn ? t.playerSelectionMode : undefined,
    status: t.status,
    licenseStatus: t.licenseStatus ?? "trial",
    registrationDeadline: t.registrationDeadline ?? null,
    registrationLimit: t.registrationLimit ?? null,
    autoApproveWithdrawnReRegistration: t.autoApproveWithdrawnReRegistration ?? false,
    enableRegistrationPayment: t.enableRegistrationPayment ?? false,
    registrationFee: t.registrationFee ?? null,
    enableRegistrationDeclaration: t.enableRegistrationDeclaration ?? false,
    registrationDeclarationText: t.registrationDeclarationText ?? null,
    bidValueMode: t.bidValueMode ?? "system",
    bidValueOptions: parseBidValueOptions(t.bidValueOptions),
    minimumSquadSize: t.minimumSquadSize ?? 0,
    maximumSquadSize: t.maximumSquadSize ?? 0,
    audioEnabled: t.audioEnabled ?? true,
    masterVolume: t.masterVolume ?? 80,
    countdownSoundEnabled: t.countdownSoundEnabled ?? true,
    countdownSoundUrl: t.countdownSoundUrl ?? null,
    countdownSoundVolume: t.countdownSoundVolume ?? 70,
    soldSoundEnabled: t.soldSoundEnabled ?? true,
    soldSoundUrl: t.soldSoundUrl ?? null,
    soldSoundVolume: t.soldSoundVolume ?? 80,
    cheerMessagesEnabled: t.cheerMessagesEnabled ?? true,
    cheerMessagePresets: t.cheerMessagePresets ?? null,
    breakEndMusicEnabled: t.breakEndMusicEnabled ?? false,
    breakEndMusicUrl: t.breakEndMusicUrl ?? null,
    breakEndMusicVolume: t.breakEndMusicVolume ?? 80,
    mainBannerUrl: t.mainBannerUrl ?? null,
    mainBannerEnabled: t.mainBannerEnabled ?? false,
    mainBannerFit: t.mainBannerFit ?? "cover",
    matchDates: t.matchDates ?? null,
    registrationFields: parseRegistrationFieldsConfig(t.registrationFieldsJson),
    playerRegistrationMode: parsePlayerRegistrationMode(t.playerRegistrationMode),
    registrationCategoryMode: parseRegistrationCategoryMode(t.registrationCategoryMode),
    auctionEnabled: auctionOn,
    scoringEnabled: isScoringEnabled(t),
    productMode: tryResolveTournamentProductMode(t) ?? "auction_only",
    scoringPhase: t.scoringPhase ?? "disabled",
    features: resolveTournamentFeatures(t.featuresJson),
    ...catalogBindingSerializerFields(t),
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : (t.createdAt ? String(t.createdAt) : new Date().toISOString()),
    ...(platform
      ? {
          platformAudioDefaults: platform,
          resolvedCountdownSoundUrl: resolveBroadcastAudioUrl(t.countdownSoundUrl, platform.countdownSoundUrl),
          resolvedSoldSoundUrl: resolveBroadcastAudioUrl(t.soldSoundUrl, platform.soldSoundUrl),
          resolvedBreakEndMusicUrl: resolveBroadcastAudioUrl(t.breakEndMusicUrl, platform.breakEndMusicUrl),
        }
      : {}),
  };
}

/** Organizer/admin — full tournament configuration including internal fields. */
export function privateTournamentSerializer(
  t: TournamentRow,
  options?: TournamentSerializerOptions,
) {
  const platform = options?.platformDefaults;
  return {
    ...publicTournamentSerializer(t, options),
    // For organizers/admins, always preserve full auction config regardless of active module flags
    basePurse: t.basePurse,
    minBid: t.minBid,
    bidIncrement: t.bidIncrement,
    bidTier1UpTo: t.bidTier1UpTo,
    bidTier1Increment: t.bidTier1Increment,
    bidTier2UpTo: t.bidTier2UpTo,
    bidTier2Increment: t.bidTier2Increment,
    bidTier3Increment: t.bidTier3Increment,
    bidTiers: t.bidTiers,
    timerSeconds: t.timerSeconds,
    bidTimerSeconds: t.bidTimerSeconds,
    bidExtensionEnabled: t.bidExtensionEnabled ?? false,
    bidExtensionThresholdSeconds: t.bidExtensionThresholdSeconds ?? 3,
    bidExtensionSeconds: t.bidExtensionSeconds ?? 5,
    playerSelectionMode: t.playerSelectionMode,
    auctionUnit: normalizeAuctionUnit(t.auctionUnit),
    organizerMobile: t.organizerMobile,
    organizerEmail: t.organizerEmail,
    organizerId: t.organizerId ?? null,
    upiId: t.upiId ?? null,
    paymentVerificationMethod: t.paymentVerificationMethod ?? null,
    paymentCollectionMode: t.paymentCollectionMode ?? "manual_verification",
    resetCount: t.resetCount ?? 0,
    lastResetAt: t.lastResetAt ? t.lastResetAt.toISOString() : null,
    lastResetBy: t.lastResetBy ?? null,
    localModeEnabled: t.localModeEnabled ?? false,
    licenseStatus: t.licenseStatus ?? "trial",
    adminLocked: t.adminLocked ?? false,
    hasScoringPin: !!t.scoringPin,
    scoringPin: options?.includeScoringPin ? (t.scoringPin ?? null) : undefined,
    ...(platform ? {} : {}),
  };
}
