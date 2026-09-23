import { describe, expect, it } from "vitest";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
  tryResolveTournamentProductMode,
  InvalidTournamentModuleStateError,
} from "@workspace/platform-core";
import {
  publicTournamentSerializer,
  privateTournamentSerializer,
} from "../lib/serializers/tournament";
import { isScoringSupportedSport } from "../lib/tournament-lifecycle";

function makeMinimalTournamentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Test Tournament",
    sport: "badminton",
    sportId: 2,
    auctionCode: "TT123456",
    venue: "Test Arena",
    city: "Test City",
    auctionDate: "2026-10-01",
    auctionTime: "10:00",
    organizerName: "Test Org",
    organizerMobile: "9876543210",
    organizerEmail: "org@test.com",
    organizerId: 1,
    logoUrl: null,
    logoPublicId: null,
    sponsorLogos: null,
    auctionUnit: "rupee",
    basePurse: 10000000,
    minBid: 100000,
    bidIncrement: 100000,
    bidTier1UpTo: null,
    bidTier1Increment: null,
    bidTier2UpTo: null,
    bidTier2Increment: null,
    bidTier3Increment: null,
    bidTiers: null,
    timerSeconds: 30,
    bidTimerSeconds: 15,
    bidExtensionEnabled: false,
    bidExtensionThresholdSeconds: 3,
    bidExtensionSeconds: 5,
    playerSelectionMode: "sequential",
    status: "setup",
    licenseStatus: "trial",
    adminLocked: false,
    registrationDeadline: null,
    registrationLimit: null,
    autoApproveWithdrawnReRegistration: false,
    enableRegistrationPayment: false,
    registrationFee: null,
    enableRegistrationDeclaration: false,
    registrationDeclarationText: null,
    bidValueMode: "system",
    bidValueOptions: null,
    minimumSquadSize: 0,
    maximumSquadSize: 0,
    audioEnabled: true,
    masterVolume: 80,
    countdownSoundEnabled: true,
    countdownSoundUrl: null,
    countdownSoundVolume: 70,
    soldSoundEnabled: true,
    soldSoundUrl: null,
    soldSoundVolume: 80,
    cheerMessagesEnabled: true,
    cheerMessagePresets: null,
    breakEndMusicEnabled: false,
    breakEndMusicUrl: null,
    breakEndMusicVolume: 80,
    mainBannerUrl: null,
    mainBannerPublicId: null,
    mainBannerEnabled: false,
    mainBannerFit: "cover",
    matchDates: null,
    registrationFieldsJson: null,
    playerRegistrationMode: "auction",
    registrationCategoryMode: null,
    auctionEnabled: true,
    scoringEnabled: false,
    scoringPhase: "disabled",
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
    businessStageId: "registration_planning",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as any;
}

describe("Tournament Serializer - Module Fields & Product Mode", () => {
  it("serializes auction_only tournament correctly in both public and private serializers", () => {
    const row = makeMinimalTournamentRow({
      auctionEnabled: true,
      scoringEnabled: false,
    });

    const pub = publicTournamentSerializer(row);
    expect(pub.auctionEnabled).toBe(true);
    expect(pub.scoringEnabled).toBe(false);
    expect(pub.productMode).toBe("auction_only");

    const priv = privateTournamentSerializer(row);
    expect(priv.auctionEnabled).toBe(true);
    expect(priv.scoringEnabled).toBe(false);
    expect(priv.productMode).toBe("auction_only");
  });

  it("serializes scoring_only tournament correctly with explicit false for auctionEnabled", () => {
    const row = makeMinimalTournamentRow({
      auctionEnabled: false,
      scoringEnabled: true,
      scoringPhase: "active",
      playerRegistrationMode: "scoring",
    });

    const pub = publicTournamentSerializer(row);
    expect(pub.auctionEnabled).toBe(false);
    expect(pub.scoringEnabled).toBe(true);
    expect(pub.productMode).toBe("scoring_only");

    const priv = privateTournamentSerializer(row);
    expect(priv.auctionEnabled).toBe(false);
    expect(priv.scoringEnabled).toBe(true);
    expect(priv.productMode).toBe("scoring_only");
  });

  it("serializes both (hybrid) tournament correctly", () => {
    const row = makeMinimalTournamentRow({
      auctionEnabled: true,
      scoringEnabled: true,
      scoringPhase: "active",
    });

    const pub = publicTournamentSerializer(row);
    expect(pub.auctionEnabled).toBe(true);
    expect(pub.scoringEnabled).toBe(true);
    expect(pub.productMode).toBe("both");

    const priv = privateTournamentSerializer(row);
    expect(priv.auctionEnabled).toBe(true);
    expect(priv.scoringEnabled).toBe(true);
    expect(priv.productMode).toBe("both");
  });

  it("defaults legacy rows where auctionEnabled is null/undefined to auctionEnabled=true", () => {
    const row = makeMinimalTournamentRow({
      auctionEnabled: undefined,
      scoringEnabled: false,
    });

    const pub = publicTournamentSerializer(row);
    expect(pub.auctionEnabled).toBe(true);
    expect(pub.scoringEnabled).toBe(false);
    expect(pub.productMode).toBe("auction_only");
  });
});

describe("Tournament Module Validation Rules (Endpoint Contracts)", () => {
  it("rejects invalid state where auctionEnabled=false and scoringEnabled=false", () => {
    const validateTournamentModules = (auctionEnabled?: boolean, scoringEnabled?: boolean) => {
      const resolvedAuction = auctionEnabled !== undefined ? auctionEnabled : true;
      const resolvedScoring = scoringEnabled !== undefined ? scoringEnabled : false;
      if (!resolvedAuction && !resolvedScoring) {
        return {
          valid: false,
          error: "A tournament must have at least one enabled product module (auction or scoring).",
        };
      }
      return {
        valid: true,
        mode: resolveTournamentProductMode({ auctionEnabled: resolvedAuction, scoringEnabled: resolvedScoring }),
      };
    };

    // Explicit false for both
    const resultInvalid = validateTournamentModules(false, false);
    expect(resultInvalid.valid).toBe(false);
    expect(resultInvalid.error).toBe(
      "A tournament must have at least one enabled product module (auction or scoring).",
    );

    // Verify resolveTournamentProductMode throws InvalidTournamentModuleStateError on invalid state
    expect(() =>
      resolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: false }),
    ).toThrow(InvalidTournamentModuleStateError);

    // Verify tryResolveTournamentProductMode returns null
    expect(
      tryResolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: false }),
    ).toBeNull();
  });

  it("accepts valid module combinations", () => {
    expect(
      resolveTournamentProductMode({ auctionEnabled: true, scoringEnabled: false }),
    ).toBe("auction_only");

    expect(
      resolveTournamentProductMode({ auctionEnabled: false, scoringEnabled: true }),
    ).toBe("scoring_only");

    expect(
      resolveTournamentProductMode({ auctionEnabled: true, scoringEnabled: true }),
    ).toBe("both");
  });

  it("enforces sport scoring compatibility", () => {
    expect(isScoringSupportedSport("cricket")).toBe(true);
    expect(isScoringSupportedSport("badminton")).toBe(true);
    expect(isScoringSupportedSport("Cricket")).toBe(true);
    expect(isScoringSupportedSport("Badminton")).toBe(true);
    expect(isScoringSupportedSport("football")).toBe(false);
    expect(isScoringSupportedSport("kabaddi")).toBe(false);
    expect(isScoringSupportedSport("volleyball")).toBe(false);
  });
});
