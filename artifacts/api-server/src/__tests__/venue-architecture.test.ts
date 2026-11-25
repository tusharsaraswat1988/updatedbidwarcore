import { describe, it, expect } from "vitest";
import { publicTournamentSerializer, privateTournamentSerializer } from "../lib/serializers/tournament";
import { buildAuctionRulesPdfDocumentModel } from "@workspace/auction/auction-rules-pdf";

describe("Venue Architecture: Auction Venue vs Tournament Venue", () => {
  const baseTournamentRow = {
    id: 999,
    organizerId: 42,
    name: "Kashi Premier League",
    sport: "cricket",
    sportId: 1,
    auctionCode: "KPL2026",
    season: "Season 1",
    venue: "Sigra Stadium, Varanasi",
    tournamentVenue: "Sigra Stadium, Varanasi",
    auctionVenue: "Hotel Taj Ganges, Banquet Hall A",
    city: "Varanasi",
    auctionDate: "2026-11-29",
    auctionTime: "18:00",
    organizerName: "Kashi Cricket Board",
    organizerMobile: "9876543210",
    organizerEmail: "board@kashi.com",
    organizerPassword: null,
    logoUrl: null,
    logoPublicId: null,
    sponsorLogos: null,
    auctionUnit: "points",
    basePurse: 14000000,
    minBid: 100000,
    bidIncrement: 50000,
    bidTier1UpTo: 100000,
    bidTier1Increment: 25000,
    bidTier2UpTo: 200000,
    bidTier2Increment: 50000,
    bidTier3Increment: 100000,
    bidTiers: null,
    timerSeconds: 30,
    bidTimerSeconds: 10,
    bidExtensionEnabled: false,
    bidExtensionThresholdSeconds: 3,
    bidExtensionSeconds: 5,
    ownerBiddingEnabled: true,
    playerSelectionMode: "random",
    status: "active",
    licenseStatus: "active",
    registrationDeadline: null,
    registrationLimit: null,
    autoApproveWithdrawnReRegistration: false,
    enableRegistrationPayment: false,
    registrationFee: null,
    enableRegistrationDeclaration: false,
    registrationDeclarationText: null,
    bidValueMode: "system",
    bidValueOptions: null,
    minimumSquadSize: 11,
    maximumSquadSize: 15,
    audioEnabled: true,
    masterVolume: 80,
    countdownSoundEnabled: true,
    countdownSoundUrl: null,
    countdownSoundVolume: 70,
    soldSoundEnabled: true,
    soldSoundUrl: null,
    soldSoundVolume: 80,
    breakEndMusicEnabled: false,
    breakEndMusicUrl: null,
    breakEndMusicVolume: 80,
    cheerMessagesEnabled: true,
    cheerMessagePresets: null,
    cheerCooldownSeconds: 2,
    cheerHeatMeterEnabled: false,
    cheerFanBattleEnabled: false,
    mainBannerUrl: null,
    mainBannerPublicId: null,
    mainBannerEnabled: false,
    mainBannerFit: "cover",
    matchDates: "2026-12-05,2026-12-06",
    registrationFieldsJson: null,
    playerRegistrationMode: "auction",
    registrationCategoryMode: "hidden",
    auctionEnabled: true,
    scoringEnabled: true,
    scoringPhase: "active",
    scoringPin: null,
    scoringSettingsJson: null,
    featuresJson: null,
    variantId: null,
    competitionTypeId: null,
    ruleProfileId: null,
    ruleProfileVersion: null,
    presentationProfileId: null,
    presentationProfileVersion: null,
    registrationModeId: null,
    teamFormationStrategyId: null,
    squadRulesJson: null,
    ruleOverridesJson: null,
    participantConstraintsJson: null,
    businessStageId: null,
    officialActivatedAt: null,
    licenseGrantedAt: null,
    licenseGrantedBy: null,
    adminLocked: false,
    adminLockedAt: null,
    resetCount: 0,
    lastResetAt: null,
    lastResetBy: null,
    localModeEnabled: false,
    exportToken: null,
    exportTokenExpiresAt: null,
    exportTokenSyncedAt: null,
    exportTokenLastMirrorAt: null,
    upiId: null,
    paymentVerificationMethod: null,
    paymentCollectionMode: "manual_verification",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-01T10:00:00Z"),
  } as any;

  it("serializes distinct auctionVenue and tournamentVenue without regression", () => {
    const res = publicTournamentSerializer(baseTournamentRow);
    expect(res.auctionVenue).toBe("Hotel Taj Ganges, Banquet Hall A");
    expect(res.tournamentVenue).toBe("Sigra Stadium, Varanasi");
    expect(res.venue).toBe("Sigra Stadium, Varanasi");
    expect(res.city).toBe("Varanasi");
  });

  it("handles legacy rows where only venue is populated", () => {
    const legacyRow = {
      ...baseTournamentRow,
      tournamentVenue: null,
      auctionVenue: null,
      venue: "Sigra Stadium, Varanasi",
      auctionEnabled: true,
      scoringEnabled: true,
    };
    const res = publicTournamentSerializer(legacyRow);
    expect(res.tournamentVenue).toBe("Sigra Stadium, Varanasi");
    expect(res.venue).toBe("Sigra Stadium, Varanasi");
    // For hybrid tournament where auctionVenue was not explicitly set, auctionVenue is null (fallback to ground or online)
    expect(res.auctionVenue).toBeNull();
  });

  it("handles legacy auction-only rows falling back to venue", () => {
    const auctionOnlyRow = {
      ...baseTournamentRow,
      tournamentVenue: null,
      auctionVenue: null,
      venue: "Taj Hotel Banquet",
      auctionEnabled: true,
      scoringEnabled: false,
    };
    const res = publicTournamentSerializer(auctionOnlyRow);
    expect(res.auctionVenue).toBe("Taj Hotel Banquet");
    expect(res.tournamentVenue).toBe("Taj Hotel Banquet");
    expect(res.venue).toBe("Taj Hotel Banquet");
  });

  it("builds Auction Rules PDF document model with separated venues", () => {
    const model = buildAuctionRulesPdfDocumentModel({
      name: "Kashi Premier League",
      sport: "cricket",
      organizerName: "Kashi Cricket Board",
      city: "Varanasi",
      venue: "Sigra Stadium, Varanasi",
      tournamentVenue: "Sigra Stadium, Varanasi",
      auctionVenue: "Hotel Taj Ganges, Banquet Hall A",
      auctionDate: "2026-11-29",
      auctionTime: "18:00",
      auctionUnit: "points",
      basePurse: 14000000,
      minBid: 100000,
      timerSeconds: 30,
      bidTimerSeconds: 10,
      minimumSquadSize: 11,
      categories: [],
      tournament: {
        bidTiers: null,
        bidTier1UpTo: 100000,
        bidTier1Increment: 25000,
        bidTier2UpTo: 200000,
        bidTier2Increment: 50000,
        bidTier3Increment: 100000,
      },
    });

    expect(model.auctionVenue).toBe("Hotel Taj Ganges, Banquet Hall A");
    expect(model.tournamentVenue).toBe("Sigra Stadium, Varanasi");
    expect(model.city).toBe("Varanasi");
  });
});
