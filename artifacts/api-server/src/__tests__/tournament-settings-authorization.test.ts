import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import tournamentsRouter, { AUCTION_SPECIFIC_UPDATE_FIELDS } from "../routes/tournaments";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";

// Mock dependencies
vi.mock("@workspace/db", () => {
  const mockTournament = {
    id: 1,
    name: "Original Tournament",
    sport: "cricket",
    city: "Delhi",
    venue: "Main Stadium",
    auctionEnabled: true,
    scoringEnabled: false,
    auctionCode: "OT120101",
    status: "setup",
    organizerId: 10,
    basePurse: 10000000,
    minBid: 100000,
    bidIncrement: 25000,
    bidTiers: JSON.stringify([{ increment: 25000 }]),
    timerSeconds: 30,
    bidTimerSeconds: 15,
    minimumSquadSize: 0,
    maximumSquadSize: 0,
    bidValueMode: "system",
    playerRegistrationMode: "auction",
    logoUrl: null,
    logoPublicId: null,
    sponsorLogos: null,
    matchDates: null,
    createdAt: new Date(),
  };

  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  return {
    db: mockDb,
    tournamentsTable: { id: "id", auctionCode: "auctionCode", createdAt: "createdAt" },
    teamsTable: { id: "id", tournamentId: "tournamentId" },
    playersTable: { id: "id", tournamentId: "tournamentId" },
    categoriesTable: {},
    bidsTable: {},
    organizersTable: {},
    purseBoostersTable: {},
    brandingSettingsTable: {},
    auctionSessionsTable: {},
    tournamentLicenseRequestsTable: {},
    adminNotificationsTable: {},
  };
});

vi.mock("../middleware/require-organizer", () => ({
  isAccountOrAdmin: vi.fn(() => true),
  requireTournamentOrganizer: vi.fn(async () => true),
  canAccessPrivateTournamentData: vi.fn(async () => true),
}));

vi.mock("../lib/platform-audio-defaults", () => ({
  getPlatformDefaultAudioCached: vi.fn(async () => ({})),
}));

vi.mock("../lib/rate-limiters", () => ({
  exportLimiter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("../lib/audit-service", () => ({
  auditLog: vi.fn(),
}));

vi.mock("../lib/audit-reason", () => ({
  parseAuditReason: vi.fn(() => ({ ok: true, reason: "Settings update" })),
  resolveAuditReasonWithDefault: vi.fn((_body: unknown, def: string) => ({ ok: true, reason: def })),
  defaultTournamentPatchReason: vi.fn(() => "Organizer dashboard: tournament settings updated"),
  tournamentConfigFieldsChanged: vi.fn(() => []),
}));

vi.mock("../lib/audit-snapshots", () => ({
  snapshotTournament: vi.fn(),
}));

vi.mock("../lib/notifications", () => ({
  notifyAsync: vi.fn(),
}));

vi.mock("../lib/admin-notifications/triggers.js", () => ({
  notifyAdminTournamentCreated: vi.fn(),
  notifyAdminLicenseRequested: vi.fn(),
}));

vi.mock("../lib/broadcast", () => ({
  broadcastToTournament: vi.fn(),
}));

vi.mock("../lib/auction-state-build-cache", () => ({
  invalidateAuctionBuildCache: vi.fn(),
}));

vi.mock("../routes/sports", () => ({
  isKnownActiveSportSlug: vi.fn(async () => true),
  resolveSportIdBySlug: vi.fn(async () => 1),
}));

describe("Phase 4E: Tournament Settings Backend Authorization", () => {
  let app: express.Express;
  let currentTournamentState: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { db } = await import("@workspace/db");

    const { playersTable, teamsTable } = await import("@workspace/db");

    currentTournamentState = {
      id: 1,
      name: "Championship 2026",
      sport: "cricket",
      city: "Mumbai",
      venue: "Wankhede",
      auctionEnabled: true,
      scoringEnabled: false,
      auctionCode: "OT120101",
      auctionUnit: "rupee",
      status: "setup",
      organizerId: 10,
      basePurse: 10000000,
      minBid: 100000,
      bidIncrement: 25000,
      bidTiers: JSON.stringify([{ increment: 25000 }]),
      timerSeconds: 30,
      bidTimerSeconds: 15,
      minimumSquadSize: 0,
      maximumSquadSize: 0,
      bidValueMode: "system",
      bidValueOptions: null,
      playerRegistrationMode: "auction",
      logoUrl: null,
      logoPublicId: null,
      sponsorLogos: null,
      matchDates: null,
      featuresJson: null,
      scoringSettingsJson: null,
      createdAt: new Date(),
    };

    // Setup db select mock
    (db.select as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === playersTable) return [{ count: 0 }];
          if (table === teamsTable) return [];
          return [currentTournamentState];
        },
        orderBy: () => [currentTournamentState],
      }),
    }));

    // Setup db update mock
    (db.update as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      set: (updates: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            currentTournamentState = { ...currentTournamentState, ...updates };
            return [currentTournamentState];
          },
        }),
      }),
    }));

    app = express();
    app.use(express.json());
    // Attach mock jwtUser
    app.use((req, _res, next) => {
      req.jwtUser = { id: 10, organizerAccountId: 10, isAdmin: false };
      next();
    });
    app.use("/api", tournamentsRouter);
  });

  describe("AUCTION_SPECIFIC_UPDATE_FIELDS Classification", () => {
    it("contains all auction economics, timers, sound, and banner fields", () => {
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("basePurse");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("minBid");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("bidIncrement");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("bidTiers");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("timerSeconds");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("bidTimerSeconds");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("bidExtensionEnabled");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("minimumSquadSize");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("maximumSquadSize");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("playerSelectionMode");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("bidValueMode");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("bidValueOptions");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("audioEnabled");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("countdownSoundEnabled");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("soldSoundEnabled");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("breakEndMusicEnabled");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("mainBannerUrl");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("auctionDate");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).toContain("auctionTime");
    });

    it("does NOT contain core tournament fields", () => {
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("name");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("sport");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("city");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("venue");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("logoUrl");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("sponsorLogos");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("matchDates");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("registrationDeadline");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("registrationLimit");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("enableRegistrationPayment");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("registrationFee");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("enableRegistrationDeclaration");
      expect(AUCTION_SPECIFIC_UPDATE_FIELDS).not.toContain("registrationDeclarationText");
    });
  });

  describe("Core Settings Mutations (Allowed across all product modes)", () => {
    it("ALLOWS core PATCH on scoring_only tournament (auctionEnabled: false, scoringEnabled: true)", async () => {
      currentTournamentState.auctionEnabled = false;
      currentTournamentState.scoringEnabled = true;

      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          name: "Updated Scoring Tournament",
          city: "Bengaluru",
          venue: "Chinnaswamy Stadium",
          matchDates: "2026-05-10,2026-05-11",
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Scoring Tournament");
      expect(res.body.city).toBe("Bengaluru");
      expect(res.body.venue).toBe("Chinnaswamy Stadium");
    });

    it("ALLOWS core PATCH on auction_only tournament (auctionEnabled: true, scoringEnabled: false)", async () => {
      currentTournamentState.auctionEnabled = true;
      currentTournamentState.scoringEnabled = false;

      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          name: "Updated Auction Tournament",
          city: "Kolkata",
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Auction Tournament");
      expect(res.body.city).toBe("Kolkata");
    });

    it("ALLOWS core PATCH on both tournament (auctionEnabled: true, scoringEnabled: true)", async () => {
      currentTournamentState.auctionEnabled = true;
      currentTournamentState.scoringEnabled = true;

      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          name: "Updated Hybrid Tournament",
          city: "Chennai",
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Hybrid Tournament");
      expect(res.body.city).toBe("Chennai");
    });

    it("ALLOWS saving registration settings without explicit audit reason", async () => {
      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          registrationDeadline: "2026-10-05",
          registrationLimit: 64,
          enableRegistrationDeclaration: true,
          registrationDeclarationText: "1. Follow match timings.\n2. Medical fitness.",
          playerRegistrationMode: "scoring",
        });

      expect(res.status).toBe(200);
      expect(res.body.registrationDeadline).toBe("2026-10-05");
      expect(res.body.registrationLimit).toBe(64);
    });
  });

  describe("Auction-Specific Mutations Authorization Boundary", () => {
    it("BLOCKS auction-specific field mutations on scoring_only tournament with 403 AUCTION_DISABLED", async () => {
      currentTournamentState.auctionEnabled = false;
      currentTournamentState.scoringEnabled = true;

      const testAuctionFields = [
        { basePurse: 50000000 },
        { minBid: 200000 },
        { timerSeconds: 45 },
        { bidTimerSeconds: 20 },
        { bidTiers: JSON.stringify([{ increment: 50000 }]) },
        { minimumSquadSize: 11 },
        { playerSelectionMode: "random" },
        { bidValueMode: "player" },
        { auctionDate: "2026-06-01" },
        { mainBannerUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg" },
        { countdownSoundEnabled: false },
      ];

      for (const fieldMutation of testAuctionFields) {
        const res = await request(app)
          .patch("/api/tournaments/1")
          .send({
            name: "Attempted Mutation",
            ...fieldMutation,
          });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe("AUCTION_DISABLED");
        expect(res.body.error).toBe("Auction module is not enabled for this tournament");
      }
    });

    it("ALLOWS auction-specific field mutations on auction_only tournament", async () => {
      currentTournamentState.auctionEnabled = true;
      currentTournamentState.scoringEnabled = false;

      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          basePurse: 20000000,
          minBid: 50000,
          timerSeconds: 40,
        });

      expect(res.status).toBe(200);
      expect(res.body.basePurse).toBe(20000000);
    });

    it("ALLOWS auction-specific field mutations on both tournament", async () => {
      currentTournamentState.auctionEnabled = true;
      currentTournamentState.scoringEnabled = true;

      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          basePurse: 15000000,
          minBid: 75000,
        });

      expect(res.status).toBe(200);
      expect(res.body.basePurse).toBe(15000000);
    });
  });

  describe("Invalid Module State Enforcement", () => {
    it("REJECTS admin update attempting to set false + false with 400 INVALID_MODULE_STATE", async () => {
      // Setup admin caller
      app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.jwtUser = { id: 1, organizerAccountId: 1, isAdmin: true };
        next();
      });
      app.use("/api", tournamentsRouter);

      currentTournamentState.auctionEnabled = true;
      currentTournamentState.scoringEnabled = false;

      const res = await request(app)
        .patch("/api/tournaments/1")
        .send({
          auctionEnabled: false,
          scoringEnabled: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_MODULE_STATE");
      expect(res.body.error).toContain("at least one enabled product module");
    });
  });
});
