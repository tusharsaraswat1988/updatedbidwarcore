import { describe, expect, it } from "vitest";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
} from "@workspace/platform-core";
import {
  publicTournamentSerializer,
  privateTournamentSerializer,
} from "../lib/serializers/tournament";

function makeMinimalTournamentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    name: "Home Neutral Tournament",
    sport: "badminton",
    sportId: 2,
    auctionCode: "HNT12345",
    venue: "Neutral Stadium",
    city: "Neutral City",
    auctionDate: "2026-10-01",
    auctionTime: "10:00",
    organizerName: "Neutral Org",
    organizerMobile: "9876543210",
    organizerEmail: "neutral@org.com",
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
    cricketScoringFormat: null,
    badmintonMatchFormat: null,
    scoringConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Phase 3: Backend support for Generic Tournament Home", () => {
  it("serializes auctionEnabled and scoringEnabled accurately in public tournament response", () => {
    const row = makeMinimalTournamentRow({
      auctionEnabled: false,
      scoringEnabled: true,
    });
    const serialized = publicTournamentSerializer(row);
    expect(serialized.auctionEnabled).toBe(false);
    expect(serialized.scoringEnabled).toBe(true);
    expect(isAuctionEnabled(serialized)).toBe(false);
    expect(isScoringEnabled(serialized)).toBe(true);
    expect(resolveTournamentProductMode(serialized)).toBe("scoring_only");
  });

  it("serializes auctionEnabled and scoringEnabled accurately in private organizer response", () => {
    const row = makeMinimalTournamentRow({
      auctionEnabled: true,
      scoringEnabled: true,
    });
    const serialized = privateTournamentSerializer(row);
    expect(serialized.auctionEnabled).toBe(true);
    expect(serialized.scoringEnabled).toBe(true);
    expect(isAuctionEnabled(serialized)).toBe(true);
    expect(isScoringEnabled(serialized)).toBe(true);
    expect(resolveTournamentProductMode(serialized)).toBe("both");
  });

  it("tournament status values are module-neutral across setup, active, and completed", () => {
    const setupRow = makeMinimalTournamentRow({ status: "setup" });
    const activeRow = makeMinimalTournamentRow({ status: "active" });
    const completedRow = makeMinimalTournamentRow({ status: "completed" });

    expect(publicTournamentSerializer(setupRow).status).toBe("setup");
    expect(publicTournamentSerializer(activeRow).status).toBe("active");
    expect(publicTournamentSerializer(completedRow).status).toBe("completed");
  });
});
