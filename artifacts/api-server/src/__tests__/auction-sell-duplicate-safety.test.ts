import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";

const TOURNAMENT_ID = 1;
const ORGANIZER_ID = 5;

const mockTournament = {
  id: TOURNAMENT_ID,
  organizerId: ORGANIZER_ID,
  status: "active",
  licenseStatus: "active",
  name: "APL Season 1",
  sport: "cricket",
};

const mockSession = {
  id: 1,
  tournamentId: TOURNAMENT_ID,
  status: "active",
  currentPlayerId: 10,
  currentBid: 500_000,
  currentBidTeamId: 2,
  timerEndsAt: null,
  pausedTimeRemaining: null,
  revision: 5,
  lastAction: null,
  lastOutcome: null,
};

const mockTeam = {
  id: 2,
  tournamentId: TOURNAMENT_ID,
  name: "BLR Blazers",
  shortCode: "BLR",
  purse: 10_000_000,
  purseUsed: 1_000_000,
  isBiddingEnabled: true,
  color: "#3B82F6",
  logoUrl: null,
};

const mockPlayer = {
  id: 10,
  tournamentId: TOURNAMENT_ID,
  name: "Ravi Kumar",
  status: "available",
  teamId: null,
  soldPrice: null,
  basePrice: 100_000,
  mobileNumber: "9000000001",
  photoUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const {
  mockDbSelect,
  mockTransaction,
  mockBroadcast,
  tournamentsTableMock,
  playersTableMock,
  teamsTableMock,
  bidsTableMock,
  purseBoostersTableMock,
  auctionSessionsTableMock,
} = vi.hoisted(() => {
  const tournamentsTableMock = { id: "tournamentsTable", organizerId: {}, status: {}, licenseStatus: {}, name: {} };
  const playersTableMock = { id: "playersTable", tournamentId: {}, status: {}, teamId: {}, soldPrice: {} };
  const teamsTableMock = { id: "teamsTable", tournamentId: {}, purseUsed: {}, isBiddingEnabled: {} };
  const bidsTableMock = { id: "bidsTable", tournamentId: {}, playerId: {}, teamId: {}, amount: {} };
  const purseBoostersTableMock = { id: "purseBoostersTable", tournamentId: {}, status: {} };
  const auctionSessionsTableMock = { id: "auctionSessionsTable", tournamentId: {}, status: {}, currentPlayerId: {}, currentBid: {}, currentBidTeamId: {}, revision: {} };

  return {
    mockDbSelect: vi.fn(),
    mockTransaction: vi.fn(),
    mockBroadcast: vi.fn().mockResolvedValue({ status: "active" }),
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
      const chain: any = {
        from: (table: any) => {
          currentTable = table;
          return chain;
        },
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => void) => {
          if (currentTable === tournamentsTableMock) {
            return Promise.resolve([mockTournament]).then(resolve);
          }
          if (currentTable === teamsTableMock) {
            return Promise.resolve([mockTeam, { id: 1 }, { id: 2 }]).then(resolve);
          }
          if (currentTable === playersTableMock) {
            return Promise.resolve([mockPlayer]).then(resolve);
          }
          return Promise.resolve([mockSession]).then(resolve);
        },
      };
      return chain;
    },
    transaction: mockTransaction,
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([mockSession]) }) }),
    delete: () => ({ where: () => Promise.resolve([]) }),
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
  categoriesTable: { id: {} },
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
  auditLog: vi.fn(),
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

import auctionRouter from "../routes/auction";

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

describe("P0 Fix #1: SELL duplicate / concurrent / retry safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SELL fails with HTTP 409 already_sold if the guarded player update returns 0 rows", async () => {
    mockDbSelect.mockImplementation(() => {
      return Promise.resolve([mockSession]);
    });

    let purseUpdated = false;
    let bidInserted = false;
    let sessionUpdated = false;

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: vi.fn((table: any) => ({
          set: () => ({
            where: () => {
              if (table === teamsTableMock) {
                purseUpdated = true;
              }
              if (table === auctionSessionsTableMock) {
                sessionUpdated = true;
              }
              return {
                returning: () => Promise.resolve([]), // 0 rows updated
              };
            },
          }),
        })),
        select: vi.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        })),
        insert: vi.fn(() => {
          bidInserted = true;
          return { values: () => Promise.resolve() };
        }),
        delete: vi.fn(() => ({ where: () => Promise.resolve() })),
      };
      return callback(tx);
    });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/sell`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("already_sold");
    expect(res.body.error).toMatch(/already been sold/i);

    // Verify financial writes and ledger records did NOT execute
    expect(purseUpdated).toBe(false);
    expect(bidInserted).toBe(false);
    expect(sessionUpdated).toBe(false);
  });

  it("SELL succeeds with HTTP 200 when guarded player update transitions exactly 1 available player", async () => {
    mockDbSelect.mockImplementation(() => {
      return Promise.resolve([mockSession]);
    });

    const mockSoldPlayer = {
      ...mockPlayer,
      status: "sold",
      teamId: 2,
      soldPrice: 500_000,
    };

    let purseUpdated = false;
    let bidInserted = false;
    let sessionUpdated = false;

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: vi.fn((table: any) => ({
          set: () => ({
            where: () => {
              if (table === teamsTableMock) {
                purseUpdated = true;
              }
              if (table === auctionSessionsTableMock) {
                sessionUpdated = true;
              }
              return {
                returning: () => Promise.resolve([mockSoldPlayer]),
              };
            },
          }),
        })),
        select: vi.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([mockTeam]),
          }),
        })),
        insert: vi.fn(() => {
          bidInserted = true;
          return { values: () => Promise.resolve() };
        }),
        delete: vi.fn(() => ({ where: () => Promise.resolve() })),
      };
      return callback(tx);
    });

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/sell`)
      .send({});

    expect(res.status).toBe(200);
    expect(purseUpdated).toBe(true);
    expect(bidInserted).toBe(true);
    expect(sessionUpdated).toBe(true);
  });
});

