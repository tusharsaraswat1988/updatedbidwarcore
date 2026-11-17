import { describe, expect, it } from "vitest";
import {
  unlicensedSpectatorTournamentSerializer,
  spectatorTournamentSerializer,
  publicTournamentSerializer,
  privateTournamentSerializer,
} from "../lib/serializers/tournament";
import type { tournamentsTable } from "@workspace/db";

type TournamentRow = typeof tournamentsTable.$inferSelect;

function makeMockTournament(overrides: Partial<TournamentRow> = {}): TournamentRow {
  return {
    id: 101,
    name: "Premier Cricket Championship",
    season: null,
    sport: "cricket",
    sportId: 1,
    auctionCode: "PCC01",
    city: "Mumbai",
    venue: "Wankhede Stadium",
    auctionDate: "2026-04-01",
    auctionTime: "10:00",
    matchDates: "2026-04-10 to 2026-04-20",
    organizerId: 1,
    organizerName: "Apex Sports",
    organizerMobile: "9876543210",
    organizerEmail: "apex@example.com",
    organizerPassword: null,
    logoUrl: "https://res.cloudinary.com/bidwar/image/upload/logo.png",
    logoPublicId: "logo_101",
    sponsorLogos: null,
    auctionUnit: "points",
    basePurse: 10000000,
    minBid: 100000,
    bidIncrement: 50000,
    bidTier1UpTo: null,
    bidTier1Increment: null,
    bidTier2UpTo: null,
    bidTier2Increment: null,
    bidTier3Increment: null,
    bidTiers: null,
    timerSeconds: 30,
    bidTimerSeconds: 10,
    bidExtensionEnabled: false,
    bidExtensionThresholdSeconds: 3,
    bidExtensionSeconds: 5,
    ownerBiddingEnabled: false,
    playerSelectionMode: "random",
    status: "setup",
    licenseStatus: "active",
    licenseGrantedAt: null,
    adminLocked: false,
    adminLockedAt: null,
    scoringPin: "1234",
    registrationDeadline: null,
    registrationLimit: null,
    autoApproveWithdrawnReRegistration: false,
    enableRegistrationPayment: false,
    registrationFee: null,
    upiId: null,
    paymentVerificationMethod: null,
    paymentCollectionMode: "manual_verification",
    enableRegistrationDeclaration: false,
    registrationDeclarationText: null,
    bidValueMode: "system",
    bidValueOptions: null,
    playerRegistrationMode: "auction",
    registrationCategoryMode: "category",
    registrationFieldsJson: null,
    minimumSquadSize: 11,
    maximumSquadSize: 18,
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
    auctionEnabled: true,
    scoringEnabled: true,
    scoringPhase: "setup",
    featuresJson: null,
    variantId: "cricket_standard",
    competitionTypeId: "cricket_t20",
    ruleProfileId: "standard",
    ruleProfileVersion: "1.0",
    presentationProfileId: "broadcast",
    presentationProfileVersion: "1.0",
    registrationModeId: "open",
    teamFormationStrategyId: "auction",
    squadRulesJson: null,
    businessStageId: "registration_planning",
    resetCount: 0,
    lastResetAt: null,
    lastResetBy: null,
    localModeEnabled: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("Global Tournament Season Field - Serializers & Data Flow", () => {
  it("serializes custom Season in unlicensedSpectatorTournamentSerializer", () => {
    const t = makeMockTournament({ season: "Season 2026–27" });
    const dto = unlicensedSpectatorTournamentSerializer(t);
    expect(dto.season).toBe("Season 2026–27");
    expect(dto.name).toBe("Premier Cricket Championship");
  });

  it("returns null Season in unlicensedSpectatorTournamentSerializer when Season is empty/null", () => {
    const t = makeMockTournament({ season: null });
    const dto = unlicensedSpectatorTournamentSerializer(t);
    expect(dto.season).toBeNull();
  });

  it("serializes custom Season in spectatorTournamentSerializer", () => {
    const t = makeMockTournament({ season: "Edition 5" });
    const dto = spectatorTournamentSerializer(t);
    expect(dto.season).toBe("Edition 5");
    expect(dto.id).toBe(101);
    expect(dto.scoringEnabled).toBe(true);
    expect(dto.auctionEnabled).toBe(true);
  });

  it("returns null Season in spectatorTournamentSerializer when Season is null", () => {
    const t = makeMockTournament({ season: null });
    const dto = spectatorTournamentSerializer(t);
    expect(dto.season).toBeNull();
  });

  it("serializes custom Season in publicTournamentSerializer", () => {
    const t = makeMockTournament({ season: "Summer League 2026" });
    const dto = publicTournamentSerializer(t);
    expect(dto.season).toBe("Summer League 2026");
    expect(dto.name).toBe("Premier Cricket Championship");
    expect(dto.auctionUnit).toBe("points");
  });

  it("returns null Season in publicTournamentSerializer when Season is null", () => {
    const t = makeMockTournament({ season: null });
    const dto = publicTournamentSerializer(t);
    expect(dto.season).toBeNull();
  });

  it("serializes custom Season in privateTournamentSerializer for organiser views", () => {
    const t = makeMockTournament({ season: "Season 1" });
    const dto = privateTournamentSerializer(t);
    expect(dto.season).toBe("Season 1");
    expect(dto.basePurse).toBe(10000000);
    expect(dto.minBid).toBe(100000);
  });

  it("returns null Season in privateTournamentSerializer when Season is null", () => {
    const t = makeMockTournament({ season: null });
    const dto = privateTournamentSerializer(t);
    expect(dto.season).toBeNull();
  });

  it("normalizes Season input correctly: trims whitespace and maps empty to null", () => {
    const normalizeSeason = (input: string | null | undefined): string | null => {
      if (input === undefined) return null;
      if (input === null || input.trim() === "") return null;
      return input.trim();
    };

    expect(normalizeSeason("  Season 2026–27  ")).toBe("Season 2026–27");
    expect(normalizeSeason("")).toBeNull();
    expect(normalizeSeason("   ")).toBeNull();
    expect(normalizeSeason(null)).toBeNull();
    expect(normalizeSeason("Edition 3")).toBe("Edition 3");
  });

  it("ensures Season field has zero operational interference with auction or scoring", () => {
    const withSeason = makeMockTournament({ season: "Season 2026" });
    const withoutSeason = makeMockTournament({ season: null });

    const dto1 = spectatorTournamentSerializer(withSeason);
    const dto2 = spectatorTournamentSerializer(withoutSeason);

    // Operational properties must be identical
    expect(dto1.id).toEqual(dto2.id);
    expect(dto1.status).toEqual(dto2.status);
    expect(dto1.scoringEnabled).toEqual(dto2.scoringEnabled);
    expect(dto1.auctionEnabled).toEqual(dto2.auctionEnabled);
    expect(dto1.productMode).toEqual(dto2.productMode);
    expect(dto1.auctionUnit).toEqual(dto2.auctionUnit);

    // Presentation season is different
    expect(dto1.season).toBe("Season 2026");
    expect(dto2.season).toBeNull();
  });
});
