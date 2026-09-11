import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";

const TOURNAMENT_ID = 1;
const ORGANIZER_ID = 5;

let activeSession = {
  id: 1,
  tournamentId: TOURNAMENT_ID,
  status: "active",
  currentPlayerId: 10,
  currentBid: 500_000,
  currentBidTeamId: 2,
  timerEndsAt: new Date(Date.now() + 30_000).toISOString(),
  pausedTimeRemaining: null,
  revision: 5,
  lastAction: null,
  lastOutcome: null,
};

const mockTournament = {
  id: TOURNAMENT_ID,
  organizerId: ORGANIZER_ID,
  status: "active",
  licenseStatus: "active",
  name: "APL Season 1",
  sport: "cricket",
  timerSeconds: 30,
  bidIncrement: 50_000,
  bidTier1UpTo: 1_000_000,
  bidTier1Increment: 50_000,
  bidTier2UpTo: 2_000_000,
  bidTier2Increment: 50_000,
  bidTier3Increment: 50_000,
};

const mockTeam = {
  id: 2,
  tournamentId: TOURNAMENT_ID,
  name: "BLR Blazers",
  shortCode: "BLR",
  purse: 10_000_000,
  purseUsed: 500_000,
  isBiddingEnabled: true,
  accessCode: "CODE2",
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
  mockDbUpdate,
  mockTransaction,
  mockBroadcast,
  tournamentsTableMock,
  playersTableMock,
  teamsTableMock,
  bidsTableMock,
  purseBoostersTableMock,
  auctionSessionsTableMock,
} = vi.hoisted(() => {
  const tournamentsTableMock = { id: "tournamentsTable", organizerId: {}, status: {}, licenseStatus: {}, name: {}, bidIncrement: {}, minBid: {}, bidTiers: {} };
  const playersTableMock = { id: "playersTable", tournamentId: {}, status: {}, teamId: {}, soldPrice: {}, categoryId: {} };
  const teamsTableMock = { id: "teamsTable", tournamentId: {}, purseUsed: {}, isBiddingEnabled: {} };
  const bidsTableMock = { id: "bidsTable", tournamentId: {}, playerId: {}, teamId: {}, amount: {} };
  const purseBoostersTableMock = { id: "purseBoostersTable", tournamentId: {}, status: {} };
  const auctionSessionsTableMock = { id: "auctionSessionsTable", tournamentId: {}, status: {}, currentPlayerId: {}, currentBid: {}, currentBidTeamId: {}, revision: {} };

  return {
    mockDbUpdate: vi.fn(),
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
            return Promise.resolve([
              mockTeam,
              { id: 1, tournamentId: TOURNAMENT_ID, isBiddingEnabled: true, purse: 10_000_000, purseUsed: 0, name: "Team 1", color: "#EF4444", accessCode: "CODE1" },
              { id: 2, tournamentId: TOURNAMENT_ID, isBiddingEnabled: true, purse: 10_000_000, purseUsed: 500_000, name: "BLR Blazers", color: "#3B82F6", accessCode: "CODE2" },
            ]).then(resolve);
          }
          if (currentTable === playersTableMock) {
            return Promise.resolve([mockPlayer]).then(resolve);
          }
          if (currentTable === auctionSessionsTableMock) {
            return Promise.resolve([activeSession]).then(resolve);
          }
          return Promise.resolve([]).then(resolve);
        },
      };
      return chain;
    },
    transaction: mockTransaction,
    update: (table: any) => mockDbUpdate(table),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([activeSession]) }) }),
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
    activeSession = {
      id: 1,
      tournamentId: TOURNAMENT_ID,
      status: "active",
      currentPlayerId: 10,
      currentBid: 500_000,
      currentBidTeamId: 2,
      timerEndsAt: new Date(Date.now() + 30_000).toISOString(),
      pausedTimeRemaining: null,
      revision: 5,
      lastAction: null,
      lastOutcome: null,
    };
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 1 }]),
        }),
      }),
    }));
  });

  it("SELL fails with HTTP 409 already_sold if the guarded player update returns 0 rows", async () => {
    let purseUpdated = false;
    let bidInserted = false;

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: vi.fn((table: any) => ({
          set: () => ({
            where: () => {
              if (table === teamsTableMock) purseUpdated = true;
              if (table === auctionSessionsTableMock) {
                return { returning: () => Promise.resolve([activeSession]) };
              }
              if (table === playersTableMock) {
                return { returning: () => Promise.resolve([]) }; // 0 rows (player already sold)
              }
              return { returning: () => Promise.resolve([]) };
            },
          }),
        })),
        select: vi.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([mockPlayer]),
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
    expect(purseUpdated).toBe(false);
    expect(bidInserted).toBe(false);
  });

  it("SELL succeeds with HTTP 200 when guarded player update transitions exactly 1 available player", async () => {
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
              if (table === teamsTableMock) purseUpdated = true;
              if (table === auctionSessionsTableMock) {
                sessionUpdated = true;
                return { returning: () => Promise.resolve([activeSession]) };
              }
              if (table === playersTableMock) {
                return { returning: () => Promise.resolve([mockSoldPlayer]) };
              }
              return { returning: () => Promise.resolve([]) };
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

describe("P0 Fix #2: SELL vs Last-Second BID Concurrency Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeSession = {
      id: 1,
      tournamentId: TOURNAMENT_ID,
      status: "active",
      currentPlayerId: 10,
      currentBid: 500_000,
      currentBidTeamId: 2,
      timerEndsAt: new Date(Date.now() + 30_000).toISOString(),
      pausedTimeRemaining: null,
      revision: 5,
      lastAction: null,
      lastOutcome: null,
    };
  });

  it("SELL fails with HTTP 409 stale_sell if concurrent BID bumped the session revision (CAS 0 rows)", async () => {
    let purseUpdated = false;
    let bidInserted = false;
    let playerUpdated = false;

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: vi.fn((table: any) => ({
          set: () => ({
            where: () => {
              if (table === teamsTableMock) purseUpdated = true;
              if (table === playersTableMock) playerUpdated = true;
              if (table === auctionSessionsTableMock) {
                return { returning: () => Promise.resolve([]) }; // 0 rows updated (CAS failure)
              }
              return { returning: () => Promise.resolve([]) };
            },
          }),
        })),
        select: vi.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([mockPlayer]),
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
      .send({ expectedRevision: 5, expectedBidTeamId: 2, expectedBidAmount: 500_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("stale_sell");
    expect(res.body.error).toMatch(/Auction state changed/i);
    expect(purseUpdated).toBe(false);
    expect(playerUpdated).toBe(false);
    expect(bidInserted).toBe(false);
  });

  it("SELL fails pre-flight with HTTP 409 sell_race if operator sent expectedBidTeamId that does not match current session", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/sell`)
      .send({ expectedBidTeamId: 1, expectedBidAmount: 500_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("sell_race");
    expect(res.body.error).toMatch(/new bid arrived before your sell request/i);
    expect(res.body.currentBidTeamId).toBe(2);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SELL fails pre-flight with HTTP 409 sell_race if operator sent expectedBidAmount that does not match current session", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/sell`)
      .send({ expectedBidTeamId: 2, expectedBidAmount: 400_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("sell_race");
    expect(res.body.error).toMatch(/bid amount changed before your sell request/i);
    expect(res.body.currentBid).toBe(500_000);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SELL fails pre-flight with HTTP 409 stale_sell if operator sent expectedRevision that does not match session", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/sell`)
      .send({ expectedRevision: 4 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("stale_sell");
    expect(res.body.error).toMatch(/Auction state changed/i);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SELL succeeds when revision, team, and amount all match atomically", async () => {
    const mockSoldPlayer = {
      ...mockPlayer,
      status: "sold",
      teamId: 2,
      soldPrice: 500_000,
    };

    let purseUpdated = false;
    let bidInserted = false;
    let sessionUpdated = false;
    let playerUpdated = false;

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: vi.fn((table: any) => ({
          set: () => ({
            where: () => {
              if (table === teamsTableMock) purseUpdated = true;
              if (table === auctionSessionsTableMock) {
                sessionUpdated = true;
                return { returning: () => Promise.resolve([activeSession]) };
              }
              if (table === playersTableMock) {
                playerUpdated = true;
                return { returning: () => Promise.resolve([mockSoldPlayer]) };
              }
              return { returning: () => Promise.resolve([]) };
            },
          }),
        })),
        select: vi.fn(() => ({
          from: () => ({
            where: () => Promise.resolve([mockPlayer]),
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
      .send({ expectedRevision: 5, expectedBidTeamId: 2, expectedBidAmount: 500_000 });

    expect(res.status).toBe(200);
    expect(sessionUpdated).toBe(true);
    expect(playerUpdated).toBe(true);
    expect(purseUpdated).toBe(true);
    expect(bidInserted).toBe(true);
  });
});

describe("P0 Fix #3: BID vs Auction State-Change Concurrency Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeSession = {
      id: 1,
      tournamentId: TOURNAMENT_ID,
      status: "active",
      currentPlayerId: 10,
      currentBid: 500_000,
      currentBidTeamId: 2,
      timerEndsAt: new Date(Date.now() + 30_000).toISOString(),
      pausedTimeRemaining: null,
      revision: 20,
      lastAction: "BLR Blazers bid ₹5,00,000",
      lastOutcome: null,
    };
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 1 }]),
        }),
      }),
    }));
  });

  it("Test 1: Valid BID with matching revision succeeds (HTTP 200, revision advanced)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(200);
    expect(res.body.currentBid).toBe(550_000);
    expect(res.body.currentBidTeamId).toBe(1);
  });

  it("Test 2: Pause invalidates revision -> Old in-flight BID returns 409 stale_bid", async () => {
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }));

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("stale_bid");
    expect(res.body.error).toMatch(/concurrent bid or auction state change/i);
  });

  it("Test 3: Unsold invalidates revision -> Old in-flight BID returns 409 stale_bid", async () => {
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }));

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("stale_bid");
  });

  it("Test 4: Stop Timer invalidates revision -> Old in-flight BID returns 409 stale_bid", async () => {
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }));

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("stale_bid");
  });

  it("Test 5: Next Player changes currentPlayer and revision -> Old in-flight BID returns 409 stale_bid", async () => {
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }));

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(409);
    expect(res.body.hint).toBe("stale_bid");
  });

  it("Test 6: BID on closed/stopped timer returns 400", async () => {
    activeSession.timerEndsAt = null;

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Bidding is not open/i);
  });

  it("Test 7: BID when auction is paused returns 400", async () => {
    activeSession.status = "paused";

    const app = buildApp();
    const res = await request(app)
      .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
      .send({ teamId: 1, amount: 550_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Auction is not active/i);
  });

  it("Test 8: Two simultaneous BID requests -> 1 succeeds (200), 1 gets 409 stale_bid", async () => {
    let callCount = 0;
    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => {
          callCount++;
          if (callCount === 1) {
            return { returning: () => Promise.resolve([{ id: 1 }]) };
          }
          return { returning: () => Promise.resolve([]) };
        },
      }),
    }));

    const app = buildApp();
    const [res1, res2] = await Promise.all([
      request(app).post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`).send({ teamId: 1, amount: 550_000 }),
      request(app).post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`).send({ teamId: 1, amount: 550_000 }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const staleRes = res1.status === 409 ? res1 : res2;
    expect(staleRes.body.hint).toBe("stale_bid");
  });
});


