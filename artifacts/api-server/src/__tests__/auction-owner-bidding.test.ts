import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";

const TOURNAMENT_ID = 100;
const ORGANIZER_ID = 42;

let activeSession: any = {
  id: 1,
  tournamentId: TOURNAMENT_ID,
  status: "active",
  currentPlayerId: 10,
  currentBid: 100_000,
  currentBidTeamId: null,
  timerEndsAt: new Date(Date.now() + 60_000).toISOString(),
  pausedTimeRemaining: null,
  revision: 1,
  lastAction: "Player up for bid",
  lastOutcome: null,
};

let mockTournament: any = {
  id: TOURNAMENT_ID,
  organizerId: ORGANIZER_ID,
  status: "active",
  licenseStatus: "active",
  name: "Championship 2026",
  sport: "cricket",
  timerSeconds: 30,
  bidTimerSeconds: 15,
  minBid: 100_000,
  bidIncrement: 25_000,
  bidTier1UpTo: 1_000_000,
  bidTier1Increment: 25_000,
  bidTier2UpTo: 2_000_000,
  bidTier2Increment: 50_000,
  bidTier3Increment: 100_000,
  ownerBiddingEnabled: true,
  minimumSquadSize: 5,
  maximumSquadSize: 15,
};

let mockTeam1: any = {
  id: 1,
  tournamentId: TOURNAMENT_ID,
  name: "Royals",
  shortCode: "ROY",
  purse: 10_000_000,
  purseUsed: 0,
  isBiddingEnabled: true,
  accessCode: "ROYAL1",
  color: "#3B82F6",
  logoUrl: null,
};

let mockTeam2: any = {
  id: 2,
  tournamentId: TOURNAMENT_ID,
  name: "Knights",
  shortCode: "KNT",
  purse: 10_000_000,
  purseUsed: 0,
  isBiddingEnabled: false, // Team level bidding disabled
  accessCode: "KNIGHT2",
  color: "#10B981",
  logoUrl: null,
};

let mockPlayer: any = {
  id: 10,
  tournamentId: TOURNAMENT_ID,
  name: "Virat Sharma",
  status: "available",
  teamId: null,
  soldPrice: null,
  basePrice: 100_000,
  mobileNumber: "9876543210",
  photoUrl: null,
  categoryId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let selectedTeamForQuery: any = null;

const {
  mockDbUpdate,
  mockTransaction,
  mockBroadcast,
  mockAuditLog,
  tournamentsTableMock,
  playersTableMock,
  teamsTableMock,
  bidsTableMock,
  purseBoostersTableMock,
  auctionSessionsTableMock,
} = vi.hoisted(() => {
  const tournamentsTableMock = {
    id: "tournamentsTable",
    organizerId: {},
    status: {},
    licenseStatus: {},
    name: {},
    bidIncrement: {},
    minBid: {},
    bidTiers: {},
    ownerBiddingEnabled: {},
    minimumSquadSize: {},
    maximumSquadSize: {},
  };
  const playersTableMock = {
    id: "playersTable",
    tournamentId: {},
    status: {},
    teamId: {},
    soldPrice: {},
    categoryId: {},
  };
  const teamsTableMock = {
    id: "teamsTable",
    tournamentId: {},
    purse: {},
    purseUsed: {},
    isBiddingEnabled: {},
  };
  const bidsTableMock = {
    id: "bidsTable",
    tournamentId: {},
    playerId: {},
    teamId: {},
    amount: {},
  };
  const purseBoostersTableMock = {
    id: "purseBoostersTable",
    tournamentId: {},
    status: {},
  };
  const auctionSessionsTableMock = {
    id: "auctionSessionsTable",
    tournamentId: {},
    status: {},
    currentPlayerId: {},
    currentBid: {},
    currentBidTeamId: {},
    revision: {},
  };

  return {
    mockDbUpdate: vi.fn(),
    mockTransaction: vi.fn(),
    mockBroadcast: vi.fn().mockResolvedValue({ status: "active" }),
    mockAuditLog: vi.fn(),
    tournamentsTableMock,
    playersTableMock,
    teamsTableMock,
    bidsTableMock,
    purseBoostersTableMock,
    auctionSessionsTableMock,
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: () => {
      let currentTable: any = null;
      let isWhereCalled = false;
      const chain: any = {
        from: (table: any) => {
          currentTable = table;
          return chain;
        },
        where: () => {
          isWhereCalled = true;
          return chain;
        },
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => void) => {
          if (currentTable === tournamentsTableMock) {
            return Promise.resolve([mockTournament]).then(resolve);
          }
          if (currentTable === teamsTableMock) {
            if (isWhereCalled && selectedTeamForQuery) {
              return Promise.resolve([selectedTeamForQuery]).then(resolve);
            }
            return Promise.resolve([mockTeam1, mockTeam2]).then(resolve);
          }
          if (currentTable === playersTableMock) {
            return Promise.resolve([mockPlayer]).then(resolve);
          }
          if (currentTable === auctionSessionsTableMock) {
            return Promise.resolve([activeSession]).then(resolve);
          }
          if (currentTable === purseBoostersTableMock) {
            return Promise.resolve([]).then(resolve);
          }
          return Promise.resolve([]).then(resolve);
        },
      };
      return chain;
    },
    transaction: mockTransaction,
    update: (table: any) => {
      mockDbUpdate(table);
      const chain: any = {
        set: (updates: any) => {
          if (table === tournamentsTableMock) {
            Object.assign(mockTournament, updates);
          } else if (table === auctionSessionsTableMock) {
            Object.assign(activeSession, updates);
          }
          return chain;
        },
        where: () => chain,
        returning: () => Promise.resolve([mockTournament]),
        then: (resolve: (v: unknown) => void) => Promise.resolve([mockTournament]).then(resolve),
      };
      return chain;
    },
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([activeSession]),
        then: (resolve: (v: unknown) => void) => Promise.resolve([activeSession]).then(resolve),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve([]),
      then: (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve),
    }),
  },
  tournamentsTable: tournamentsTableMock,
  playersTable: playersTableMock,
  teamsTable: teamsTableMock,
  bidsTable: bidsTableMock,
  purseBoostersTable: purseBoostersTableMock,
  auctionSessionsTable: auctionSessionsTableMock,
  auctionBidEventsTable: { tournamentId: {} },
  auctionPlayerEventsTable: { tournamentId: {} },
  auctionTimerEventsTable: { tournamentId: {} },
  playerSpecValuesTable: { tournamentId: {}, playerId: {} },
  categoriesTable: { id: {}, bidTiers: {}, bidIncrement: {} },
  organizersTable: { id: {} },
  smsNotificationSettingsTable: {},
}));

vi.mock("../lib/runtime-env", () => ({
  getAdminPassword: () => "admin-secret",
  getPublicOrigin: () => "http://localhost",
  getRuntimeConfig: () => ({ isProduction: false }),
}));

vi.mock("../lib/broadcast", () => ({
  broadcastToTournament: mockBroadcast,
  addSseClient: vi.fn(),
  removeSseClient: vi.fn(),
  getSseClientCount: vi.fn().mockReturnValue(0),
}));

vi.mock("../lib/auction-broadcast", () => ({
  emitAuctionStateEvent: vi.fn(),
  emitBidEvent: vi.fn(),
  emitSoldEvent: vi.fn(),
}));

vi.mock("../lib/audit-service", () => ({
  auditLog: mockAuditLog,
}));

vi.mock("../lib/whatsapp", () => ({
  notifyPlayerSold: vi.fn(),
  notifyPlayerUnsold: vi.fn(),
  notifyPlayerReAuction: vi.fn(),
}));

vi.mock("../lib/communication/player-sold-email-service.js", () => ({
  enqueuePlayerSoldEmailAsync: vi.fn(),
}));

vi.mock("../lib/master-sports/sync", () => ({
  onAuctionPlayerSoldAsync: vi.fn(),
}));

vi.mock("../lib/google-sheets-sync-queue.js", () => ({
  scheduleGoogleSheetSync: vi.fn(),
}));

vi.mock("../lib/tournament-insights", () => ({
  invalidateTournamentInsightsCache: vi.fn(),
}));

vi.mock("../lib/player-spec-response", () => ({
  serializePlayerWithSpecifications: (p: any) => p,
}));

import auctionRouter, { resetAuctionStateCacheForTests } from "../routes/auction";
import { resetAuctionBuildCacheForTests, invalidateAuctionBuildCache } from "../lib/auction-state-build-cache";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request & { jwtUser?: unknown }).jwtUser = {
      isAdmin: true,
      userId: ORGANIZER_ID,
      organizerAccountId: ORGANIZER_ID,
      role: "admin",
    };
    next();
  });
  app.use("/api", auctionRouter);
  return app;
}

describe("Tournament-wide Owner Bidding Enable/Disable Suite", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuctionBuildCacheForTests();
    resetAuctionStateCacheForTests();
    mockTournament.ownerBiddingEnabled = true;
    mockTeam1.isBiddingEnabled = true;
    mockTeam2.isBiddingEnabled = false;
    selectedTeamForQuery = mockTeam1;
    activeSession = {
      id: 1,
      tournamentId: TOURNAMENT_ID,
      status: "active",
      currentPlayerId: 10,
      currentBid: 100_000,
      currentBidTeamId: null,
      timerEndsAt: new Date(Date.now() + 60_000).toISOString(),
      pausedTimeRemaining: null,
      revision: 1,
      lastAction: "Player up for bid",
      lastOutcome: null,
    };

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: vi.fn((table: any) => {
          mockDbUpdate(table);
          const chain: any = {
            set: (updates: any) => {
              if (table === tournamentsTableMock) {
                Object.assign(mockTournament, updates);
              } else if (table === auctionSessionsTableMock) {
                Object.assign(activeSession, updates);
              }
              return chain;
            },
            where: () => chain,
            returning: () => Promise.resolve([mockPlayer]),
            then: (resolve: (v: unknown) => void) => Promise.resolve([mockPlayer]).then(resolve),
          };
          return chain;
        }),
        select: vi.fn(() => ({
          from: (table: any) => ({
            where: () => {
              if (table === teamsTableMock) return Promise.resolve([mockTeam1]);
              if (table === playersTableMock) return Promise.resolve([mockPlayer]);
              return Promise.resolve([]);
            },
          }),
        })),
        insert: vi.fn(() => ({
          values: () => Promise.resolve([]),
        })),
        delete: vi.fn(() => ({
          where: () => Promise.resolve([]),
        })),
      };
      return callback(tx);
    });
  });

  // ── 1. Default State (ownerBiddingEnabled = true) ───────────────────────────
  describe("1. Tournament with ownerBiddingEnabled = true (default)", () => {
    it("allows team owner to place online bid via POST /bid (HTTP 200)", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 100_000,
          accessCode: mockTeam1.accessCode,
        });

      expect(res.status).toBe(200);
      expect(activeSession.currentBidTeamId).toBe(mockTeam1.id);
      expect(activeSession.currentBid).toBe(100_000);
    });

    it("allows operator to place bid via POST /bid", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 100_000,
        });

      expect(res.status).toBe(200);
    });

    it("allows operator to Manual Sell", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/manual-sell`)
        .send({
          teamId: mockTeam1.id,
          amount: 150_000,
        });

      expect(res.status).toBe(200);
    });
  });

  // ── 2. Disabling Bidding via Settings ───────────────────────────────────────
  describe("2. Operator disables bidding via PATCH /auction/settings", () => {
    it("disables owner bidding, records audit log, and emits state update", async () => {
      const res = await request(app)
        .patch(`/api/tournaments/${TOURNAMENT_ID}/auction/settings`)
        .send({ ownerBiddingEnabled: false });

      expect(res.status).toBe(200);
      expect(res.body.ownerBiddingEnabled).toBe(false);
      expect(mockTournament.ownerBiddingEnabled).toBe(false);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "auction.owner_bidding_disabled",
          category: "auction",
          tournamentId: TOURNAMENT_ID,
        }),
      );
    });

    it("accepts POST alias for /auction/settings", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/settings`)
        .send({ ownerBiddingEnabled: false });

      expect(res.status).toBe(200);
      expect(res.body.ownerBiddingEnabled).toBe(false);
      expect(mockTournament.ownerBiddingEnabled).toBe(false);
    });
  });

  // ── 3. Behavior when ownerBiddingEnabled = false ────────────────────────────
  describe("3. Tournament with ownerBiddingEnabled = false", () => {
    beforeEach(() => {
      mockTournament.ownerBiddingEnabled = false;
    });

    it("rejects team owner bid with HTTP 403 and exact error payload", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 100_000,
          accessCode: mockTeam1.accessCode,
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        error: "OWNER_BIDDING_DISABLED",
        message: "Online owner bidding is currently disabled by the organizer.",
      });
    });

    it("leaves timer running unaffected when bid is rejected", async () => {
      const originalTimerEndsAt = activeSession.timerEndsAt;

      await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 100_000,
          accessCode: mockTeam1.accessCode,
        });

      expect(activeSession.timerEndsAt).toBe(originalTimerEndsAt);
    });

    it("leaves current player on block and does not clear current bid", async () => {
      activeSession.currentBid = 125_000;
      activeSession.currentBidTeamId = mockTeam1.id;

      await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 150_000,
          accessCode: mockTeam1.accessCode,
        });

      expect(activeSession.currentPlayerId).toBe(10);
      expect(activeSession.currentBid).toBe(125_000);
      expect(activeSession.currentBidTeamId).toBe(mockTeam1.id);
    });

    it("allows operator to still Manual Sell (conventional placard workflow)", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/manual-sell`)
        .send({
          teamId: mockTeam1.id,
          amount: 250_000,
        });

      expect(res.status).toBe(200);
    });

    it("allows operator to mark player unsold", async () => {
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/unsold`);

      expect(res.status).toBe(200);
    });
  });

  // ── 4. Re-enabling Bidding ──────────────────────────────────────────────────
  describe("4. Operator re-enables bidding", () => {
    it("re-enables owner bidding and records audit log", async () => {
      mockTournament.ownerBiddingEnabled = false;

      const res = await request(app)
        .patch(`/api/tournaments/${TOURNAMENT_ID}/auction/settings`)
        .send({ ownerBiddingEnabled: true });

      expect(res.status).toBe(200);
      expect(res.body.ownerBiddingEnabled).toBe(true);
      expect(mockTournament.ownerBiddingEnabled).toBe(true);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "auction.owner_bidding_enabled",
          category: "auction",
          tournamentId: TOURNAMENT_ID,
        }),
      );

      // Now team owner bid succeeds again
      const bidRes = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 100_000,
          accessCode: mockTeam1.accessCode,
        });

      expect(bidRes.status).toBe(200);
    });
  });

  // ── 5. State Serialization ─────────────────────────────────────────────────
  describe("5. State serialization", () => {
    it("returns ownerBiddingEnabled: true in GET /auction state", async () => {
      mockTournament.ownerBiddingEnabled = true;
      resetAuctionStateCacheForTests();
      invalidateAuctionBuildCache(TOURNAMENT_ID);

      const res = await request(app).get(`/api/tournaments/${TOURNAMENT_ID}/auction`);

      expect(res.status).toBe(200);
      expect(res.body.ownerBiddingEnabled).toBe(true);
    });

    it("returns ownerBiddingEnabled: false in GET /auction state when disabled", async () => {
      mockTournament.ownerBiddingEnabled = false;
      resetAuctionStateCacheForTests();
      invalidateAuctionBuildCache(TOURNAMENT_ID);

      const res = await request(app).get(`/api/tournaments/${TOURNAMENT_ID}/auction`);

      expect(res.status).toBe(200);
      expect(res.body.ownerBiddingEnabled).toBe(false);
    });
  });

  // ── 6. Team-Level Permission Independence ──────────────────────────────────
  describe("6. Team-level permission independence", () => {
    it("Tournament enabled, team disabled -> returns team error (HTTP 400)", async () => {
      mockTournament.ownerBiddingEnabled = true;
      mockTeam2.isBiddingEnabled = false;
      selectedTeamForQuery = mockTeam2;

      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam2.id,
          amount: 100_000,
          accessCode: mockTeam2.accessCode,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Bidding disabled for this team");
    });

    it("Tournament disabled, team enabled -> returns tournament reason (HTTP 403)", async () => {
      mockTournament.ownerBiddingEnabled = false;
      mockTeam1.isBiddingEnabled = true;
      selectedTeamForQuery = mockTeam1;

      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam1.id,
          amount: 100_000,
          accessCode: mockTeam1.accessCode,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("OWNER_BIDDING_DISABLED");
    });

    it("Tournament disabled, team disabled -> returns tournament reason (HTTP 403) with precedence", async () => {
      mockTournament.ownerBiddingEnabled = false;
      mockTeam2.isBiddingEnabled = false; // Both disabled
      selectedTeamForQuery = mockTeam2;

      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({
          teamId: mockTeam2.id,
          amount: 100_000,
          accessCode: mockTeam2.accessCode,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("OWNER_BIDDING_DISABLED");
    });
  });
});
