import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request } from "express";
import {
  publicGlobalPlayerSerializer,
  privateGlobalPlayerSerializer,
  publicGlobalPlayerSearchSerializer,
} from "../lib/serializers/global-player";
import { publicPlayerSerializer, privatePlayerSerializer } from "../lib/serializers/player";
import { publicTeamSerializer, privateTeamSerializer } from "../lib/serializers/team";
import { publicTournamentSerializer, privateTournamentSerializer } from "../lib/serializers/tournament";
import { validateTeamBelongsToTournament } from "../lib/team-tournament-guard";
import {
  checkVerifyAccessAllowed,
  recordVerifyAccessFailure,
  VERIFY_ACCESS_FAILURE_THRESHOLD,
  _resetVerifyAccessGuardForTests,
} from "../lib/verify-access-guard";
import {
  isTournamentOrganizer,
  isOrganizerOrAdmin,
} from "../middleware/require-organizer";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  teamsTable: {},
  tournamentsTable: {},
}));

import { db } from "@workspace/db";

function mockReq(ip = "203.0.113.10", jwtUser?: Record<string, unknown>): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    jwtUser,
  } as Request;
}

const samplePlayer = {
  id: 1,
  tournamentId: 5,
  categoryId: null,
  teamId: null,
  name: "Test Player",
  city: "Mumbai",
  role: "Batsman",
  battingStyle: null,
  bowlingStyle: null,
  specialization: null,
  age: 25,
  gender: "M" as const,
  photoUrl: null,
  basePrice: 100000,
  selectedBidValue: null,
  bidValueSource: null,
  soldPrice: null,
  retainedPrice: null,
  status: "available",
  jerseyNumber: null,
  jerseySize: null,
  achievements: null,
  mobileNumber: "919876543210",
  email: "test@example.com",
  cricheroUrl: null,
  availabilityDates: null,
  playerTag: null,
  playerTagTeamId: null,
  isNonPlayingMember: false,
  registrationPaymentStatus: null,
  utrNumber: null,
  paymentScreenshotUrl: null,
  paymentSubmittedAt: null,
  createdAt: new Date("2024-01-01"),
};

const sampleTeam = {
  id: 10,
  tournamentId: 5,
  name: "Team A",
  shortCode: "TA",
  ownerName: "Owner",
  ownerMobile: "919999999999",
  ownerEmail: "owner@example.com",
  ownerPhotoUrl: null,
  color: "#fff",
  logoUrl: null,
  purse: 10000000,
  purseUsed: 0,
  isBiddingEnabled: true,
  accessCode: "ABC123",
  createdAt: new Date("2024-01-01"),
};

const sampleTournament = {
  id: 5,
  name: "Cup",
  sport: "cricket",
  sportId: 1,
  auctionCode: "CU1234",
  venue: null,
  auctionDate: null,
  auctionTime: null,
  organizerName: "Org",
  organizerMobile: "918888888888",
  organizerEmail: "org@example.com",
  organizerId: 42,
  logoUrl: null,
  sponsorLogos: null,
  basePurse: 10000000,
  minBid: 100000,
  bidIncrement: 100000,
  bidTier1UpTo: 100000,
  bidTier1Increment: 25000,
  bidTier2UpTo: 200000,
  bidTier2Increment: 50000,
  bidTier3Increment: 100000,
  bidTiers: null,
  timerSeconds: 30,
  bidTimerSeconds: 15,
  bidExtensionEnabled: false,
  bidExtensionThresholdSeconds: 3,
  bidExtensionSeconds: 5,
  playerSelectionMode: "sequential",
  status: "setup",
  registrationDeadline: null,
  registrationLimit: null,
  enableRegistrationPayment: false,
  registrationFee: null,
  upiId: "secret@upi",
  paymentVerificationMethod: null,
  paymentCollectionMode: "manual_verification",
  enableRegistrationDeclaration: false,
  registrationDeclarationText: null,
  bidValueMode: "system",
  bidValueOptions: null,
  resetCount: 0,
  lastResetAt: null,
  lastResetBy: null,
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
  mainBannerEnabled: false,
  mainBannerFit: "cover",
  localModeEnabled: false,
  licenseStatus: "trial",
  adminLocked: false,
  adminLockedAt: null,
  matchDates: null,
  scoringEnabled: false,
  scoringPhase: "disabled",
  scoringPin: "1234",
  organizerPassword: "secret",
  createdAt: new Date("2024-01-01"),
};

describe("security serializers", () => {
  it("public player serializer omits mobile and email", () => {
    const pub = publicPlayerSerializer(samplePlayer);
    expect(pub).not.toHaveProperty("mobileNumber");
    expect(pub).not.toHaveProperty("email");
    expect(pub.name).toBe("Test Player");
  });

  it("private player serializer includes mobile and email", () => {
    const priv = privatePlayerSerializer(samplePlayer);
    expect(priv.mobileNumber).toBe("919876543210");
    expect(priv.email).toBe("test@example.com");
  });

  it("public team serializer omits owner PII", () => {
    const pub = publicTeamSerializer(sampleTeam);
    expect(pub).not.toHaveProperty("ownerName");
    expect(pub).not.toHaveProperty("ownerMobile");
    expect(pub).not.toHaveProperty("ownerEmail");
    expect(pub).not.toHaveProperty("accessCode");
    expect(pub.requiresAccessCode).toBe(true);
  });

  it("public tournament serializer omits organiser contact and secrets", () => {
    const pub = publicTournamentSerializer(sampleTournament);
    expect(pub).not.toHaveProperty("organizerMobile");
    expect(pub).not.toHaveProperty("organizerEmail");
    expect(pub).not.toHaveProperty("organizerId");
    expect(pub).not.toHaveProperty("upiId");
    expect(pub).not.toHaveProperty("adminLocked");
    expect(pub).not.toHaveProperty("scoringPin");
    expect(pub.auctionCode).toBe("CU1234");
  });

  it("private tournament serializer includes organiser fields", () => {
    const priv = privateTournamentSerializer(sampleTournament, { includeScoringPin: true });
    expect(priv.organizerMobile).toBe("918888888888");
    expect(priv.upiId).toBe("secret@upi");
    expect(priv.scoringPin).toBe("1234");
  });

  it("global player public serializer omits mobile", () => {
    const gp = {
      id: "gp_1",
      canonicalName: "Player",
      mobileNumber: "919876543210",
      sport: "cricket",
      defaultRole: null,
      city: null,
      age: null,
      gender: null,
      photoUrl: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const pub = publicGlobalPlayerSerializer(gp);
    expect(pub).not.toHaveProperty("mobileNumber");
    expect(privateGlobalPlayerSerializer(gp).mobileNumber).toBe("919876543210");
  });

  it("global search public serializer omits mobile", () => {
    const row = {
      id: 1,
      name: "A",
      mobileNumber: "919876543210",
      city: null,
      age: null,
      gender: null,
      role: null,
      photoUrl: null,
      battingStyle: null,
      bowlingStyle: null,
      specialization: null,
      jerseyNumber: null,
      achievements: null,
      cricheroUrl: null,
      availabilityDates: null,
      globalPlayerId: null,
      basePrice: null,
      appearanceCount: 1,
    };
    expect(publicGlobalPlayerSearchSerializer(row)).not.toHaveProperty("mobileNumber");
  });
});

describe("tournament-scoped organizer authorization", () => {
  it("denies unrelated organizer account without tournament map", () => {
    const req = mockReq("1.1.1.1", { organizerAccountId: 99 });
    expect(isOrganizerOrAdmin(req, 5)).toBe(false);
    expect(isTournamentOrganizer(req, 5, 42)).toBe(false);
  });

  it("allows organizer account matching tournament.organizerId", () => {
    const req = mockReq("1.1.1.1", { organizerAccountId: 42 });
    expect(isTournamentOrganizer(req, 5, 42)).toBe(true);
  });

  it("allows per-tournament JWT organizer flag", () => {
    const req = mockReq("1.1.1.1", { organizer: { "5": true } });
    expect(isOrganizerOrAdmin(req, 5)).toBe(true);
  });

  it("allows admin regardless of tournament", () => {
    const req = mockReq("1.1.1.1", { isAdmin: true });
    expect(isOrganizerOrAdmin(req, 5)).toBe(true);
  });
});

describe("team tournament guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when team exists in another tournament", async () => {
    const selectMock = vi.fn()
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ id: 10 }]),
        }),
      });
    vi.mocked(db.select).mockImplementation(selectMock as never);

    const result = await validateTeamBelongsToTournament(5, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

describe("verify-access rate limiting", () => {
  beforeEach(() => {
    _resetVerifyAccessGuardForTests();
  });

  it("locks out after threshold failures", () => {
    const req = mockReq();
    for (let i = 0; i < VERIFY_ACCESS_FAILURE_THRESHOLD; i++) {
      recordVerifyAccessFailure(req, 5, 10);
    }
    const blocked = checkVerifyAccessAllowed(req, 5, 10);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.status).toBe(429);
      expect(blocked.lockoutRemainingSec).toBeGreaterThan(0);
    }
  });
});
