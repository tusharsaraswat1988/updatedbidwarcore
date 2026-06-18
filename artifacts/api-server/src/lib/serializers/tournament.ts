import { parseBidValueOptions } from "@workspace/api-base/bid-value";
import {
  resolveBroadcastAudioUrl,
  type PlatformAudioDefaults,
} from "@workspace/api-base/platform-audio";
import { resolveTournamentFeatures } from "@workspace/api-base/tournament-features";
import type { tournamentsTable } from "@workspace/db";

type TournamentRow = typeof tournamentsTable.$inferSelect;

type TournamentSerializerOptions = {
  includeScoringPin?: boolean;
  platformDefaults?: PlatformAudioDefaults;
};

/** Public routes: register, display, live, obs, side-display. */
export function publicTournamentSerializer(
  t: TournamentRow,
  options?: TournamentSerializerOptions,
) {
  const platform = options?.platformDefaults;
  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    sportId: t.sportId ?? null,
    auctionCode: t.auctionCode ?? null,
    venue: t.venue,
    auctionDate: t.auctionDate,
    auctionTime: t.auctionTime ?? null,
    organizerName: t.organizerName,
    logoUrl: t.logoUrl,
    sponsorLogos: t.sponsorLogos,
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
    status: t.status,
    licenseStatus: t.licenseStatus ?? "trial",
    registrationDeadline: t.registrationDeadline ?? null,
    registrationLimit: t.registrationLimit ?? null,
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
    scoringEnabled: t.scoringEnabled ?? false,
    scoringPhase: t.scoringPhase ?? "disabled",
    features: resolveTournamentFeatures(t.featuresJson),
    createdAt: t.createdAt.toISOString(),
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
