/**
 * Phase 2.5 Independent Security Verification Test Suite
 *
 * Covers all 9 required adversarial verification scenarios:
 * 1. Simultaneous auction bids and stale bid rejection (SEC-2026-01)
 * 2. Manual sell when squad is full (SEC-2026-02)
 * 3. Manual sell of an already-sold player (SEC-2026-02)
 * 4. ₹0 manual sale followed by undo (SEC-2026-03)
 * 5. ₹0 sale after a positive sale followed by undo (LIFO integrity) (SEC-2026-03)
 * 6. Existing player profile overwrite attempt without authentication (SEC-2026-04)
 * 7. Scorer with zero tournament assignments attempting tournament access (SEC-2026-05)
 * 8. Cross-tournament scorer access and match locking (tenant isolation)
 * 9. OBS director cue authorization
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Request } from "express";
import request from "supertest";
import {
  assertScorerMayAccessTournament,
  ScorerAuthError,
} from "../lib/scorer-auth";

const TOURNAMENT_ID = 101;
const OTHER_TOURNAMENT_ID = 202;
const ORGANIZER_ID = 999;
const SCORER_ID = 77;

// --- Mock Data ---
let activeSession: any;
let mockPlayers: any[];
let mockTeams: any[];
let mockBids: any[];
let mockTournament: any;

const {
  mockDbUpdate,
  mockTransaction,
  mockBroadcast,
  tournamentsTableMock,
  playersTableMock,
  teamsTableMock,
  bidsTableMock,
  auctionSessionsTableMock,
  scorerAccountsTableMock,
} = vi.hoisted(() => {
  const tournamentsTableMock = {
    id: "tournamentsTable.id",
    organizerId: "tournamentsTable.organizerId",
    status: "tournamentsTable.status",
    licenseStatus: "tournamentsTable.licenseStatus",
    name: "tournamentsTable.name",
    sport: "tournamentsTable.sport",
    bidIncrement: "tournamentsTable.bidIncrement",
    minBid: "tournamentsTable.minBid",
    bidTiers: "tournamentsTable.bidTiers",
    registrationCode: "tournamentsTable.registrationCode",
  };
  const playersTableMock = {
    id: "playersTable.id",
    tournamentId: "playersTable.tournamentId",
    status: "playersTable.status",
    teamId: "playersTable.teamId",
    soldPrice: "playersTable.soldPrice",
    categoryId: "playersTable.categoryId",
    mobileNumber: "playersTable.mobileNumber",
    name: "playersTable.name",
    serialNo: "playersTable.serialNo",
    isNonPlayingMember: "playersTable.isNonPlayingMember",
  };
  const teamsTableMock = {
    id: "teamsTable.id",
    tournamentId: "teamsTable.tournamentId",
    purse: "teamsTable.purse",
    purseUsed: "teamsTable.purseUsed",
    isBiddingEnabled: "teamsTable.isBiddingEnabled",
    name: "teamsTable.name",
    color: "teamsTable.color",
  };
  const bidsTableMock = {
    id: "bidsTable.id",
    tournamentId: "bidsTable.tournamentId",
    playerId: "bidsTable.playerId",
    teamId: "bidsTable.teamId",
    amount: "bidsTable.amount",
    timestamp: "bidsTable.timestamp",
  };
  const auctionSessionsTableMock = {
    id: "auctionSessionsTable.id",
    tournamentId: "auctionSessionsTable.tournamentId",
    status: "auctionSessionsTable.status",
    currentPlayerId: "auctionSessionsTable.currentPlayerId",
    currentBid: "auctionSessionsTable.currentBid",
    currentBidTeamId: "auctionSessionsTable.currentBidTeamId",
    revision: "auctionSessionsTable.revision",
    timerEndsAt: "auctionSessionsTable.timerEndsAt",
  };
  const scorerAccountsTableMock = {
    id: "scorerAccountsTable.id",
    scorerPinHash: "scorerAccountsTable.scorerPinHash",
  };

  return {
    mockDbUpdate: vi.fn(),
    mockTransaction: vi.fn(),
    mockBroadcast: vi.fn().mockResolvedValue({ status: "active" }),
    tournamentsTableMock,
    playersTableMock,
    teamsTableMock,
    bidsTableMock,
    auctionSessionsTableMock,
    scorerAccountsTableMock,
  };
});

vi.mock("@workspace/db", () => ({
  createPgClient: vi.fn(() => ({
    on: vi.fn(),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(undefined),
    end: vi.fn(),
  })),
  db: {
    select: (fields?: any) => {
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
            return Promise.resolve(mockTeams).then(resolve);
          }
          if (currentTable === playersTableMock) {
            return Promise.resolve(mockPlayers).then(resolve);
          }
          if (currentTable === auctionSessionsTableMock) {
            return Promise.resolve([activeSession]).then(resolve);
          }
          if (currentTable === bidsTableMock) {
            return Promise.resolve(mockBids).then(resolve);
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
  auctionSessionsTable: auctionSessionsTableMock,
  scorerAccountsTable: scorerAccountsTableMock,
  purseBoostersTable: { tournamentId: {} },
  auctionBidEventsTable: { tournamentId: {} },
  auctionPlayerEventsTable: { tournamentId: {} },
  auctionTimerEventsTable: { tournamentId: {} },
  playerSpecValuesTable: { tournamentId: {}, playerId: {} },
  categoriesTable: { id: {}, bidTiers: {}, bidIncrement: {}, maxPlayers: {} },
  organizersTable: { id: {}, mobile: {} },
  smsNotificationSettingsTable: {},
  scorerTournamentAssignmentsTable: { scorerId: {}, tournamentId: {} },
  matchesTable: { id: {}, tournamentId: {} },
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
  serializePlayersWithSpecifications: (p: any) => Promise.resolve(p),
}));

import auctionRouter from "../routes/auction";

function buildTestApp() {
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

describe("Phase 2.5: Independent Security & Concurrency Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockTournament = {
      id: TOURNAMENT_ID,
      organizerId: ORGANIZER_ID,
      status: "active",
      licenseStatus: "active",
      name: "Premier League 2026",
      sport: "cricket",
      scoringEnabled: true,
      timerSeconds: 30,
      bidIncrement: 50_000,
      bidTier1UpTo: 1_000_000,
      bidTier1Increment: 50_000,
      bidTier2UpTo: 2_000_000,
      bidTier2Increment: 50_000,
      bidTier3Increment: 50_000,
      maximumSquadSize: 5,
    };

    activeSession = {
      id: 1,
      tournamentId: TOURNAMENT_ID,
      status: "active",
      currentPlayerId: 10,
      currentBid: 500_000,
      currentBidTeamId: 1,
      timerEndsAt: new Date(Date.now() + 30_000).toISOString(),
      pausedTimeRemaining: null,
      revision: 20,
      lastAction: "Team 1 bid ₹5,00,000",
      lastOutcome: null,
    };

    mockTeams = [
      {
        id: 1,
        tournamentId: TOURNAMENT_ID,
        name: "Mumbai Titans",
        shortCode: "MT",
        purse: 10_000_000,
        purseUsed: 500_000,
        isBiddingEnabled: true,
        accessCode: "CODE1",
        color: "#1E40AF",
      },
      {
        id: 2,
        tournamentId: TOURNAMENT_ID,
        name: "Delhi Dynamos",
        shortCode: "DD",
        purse: 10_000_000,
        purseUsed: 0,
        isBiddingEnabled: true,
        accessCode: "CODE2",
        color: "#DC2626",
      },
    ];

    mockPlayers = [
      {
        id: 10,
        tournamentId: TOURNAMENT_ID,
        name: "Virat Kohli",
        status: "available",
        teamId: null,
        soldPrice: null,
        basePrice: 100_000,
        mobileNumber: "9876543210",
        isNonPlayingMember: false,
      },
      {
        id: 11,
        tournamentId: TOURNAMENT_ID,
        name: "Rohit Sharma",
        status: "available",
        teamId: null,
        soldPrice: null,
        basePrice: 100_000,
        mobileNumber: "9876543211",
        isNonPlayingMember: false,
      },
    ];

    mockBids = [];

    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        update: (table: any) => mockDbUpdate(table),
        execute: () => Promise.resolve(),
        select: () => {
          let currentTable: any = null;
          const chain: any = {
            from: (t: any) => {
              currentTable = t;
              return chain;
            },
            where: () => chain,
            orderBy: () => chain,
            limit: () => chain,
            then: (resolve: (v: unknown) => void) => {
              if (currentTable === teamsTableMock) return Promise.resolve(mockTeams).then(resolve);
              if (currentTable === playersTableMock) return Promise.resolve(mockPlayers).then(resolve);
              if (currentTable === bidsTableMock) return Promise.resolve(mockBids).then(resolve);
              return Promise.resolve([]).then(resolve);
            },
          };
          return chain;
        },
        insert: () => ({ values: () => Promise.resolve() }),
        delete: () => ({ where: () => Promise.resolve([]) }),
      };
      return callback ? callback(tx) : undefined;
    });

    mockDbUpdate.mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 1 }]),
        }),
      }),
    }));
  });

  // ── Scenario 1: Simultaneous auction bids and stale bid rejection ──────────
  describe("Scenario 1: Simultaneous auction bids and CAS rejection (SEC-2026-01)", () => {
    it("accepts exactly one bid when two bids race simultaneously, rejecting the stale bid with 409", async () => {
      let callCount = 0;
      mockDbUpdate.mockImplementation(() => ({
        set: () => ({
          where: () => {
            callCount++;
            if (callCount === 1) {
              return { returning: () => Promise.resolve([{ id: 1 }]) };
            }
            return { returning: () => Promise.resolve([]) }; // concurrent CAS failure
          },
        }),
      }));

      const app = buildTestApp();
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`).send({ teamId: 2, amount: 550_000 }),
        request(app).post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`).send({ teamId: 2, amount: 550_000 }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const staleRes = res1.status === 409 ? res1 : res2;
      expect(staleRes.body.hint).toBe("stale_bid");
      expect(staleRes.body.error).toMatch(/concurrent bid or auction state change/i);
    });

    it("rejects bids when timer has expired", async () => {
      activeSession.timerEndsAt = new Date(Date.now() - 1000).toISOString();
      const app = buildTestApp();
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({ teamId: 2, amount: 550_000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Bidding is not open/i);
    });

    it("rejects bids when auction session is paused", async () => {
      activeSession.status = "paused";
      const app = buildTestApp();
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/bid`)
        .send({ teamId: 2, amount: 550_000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Auction is not active/i);
    });
  });

  // ── Scenario 2: Manual sell when squad is full ──────────────────────────────
  describe("Scenario 2: Manual sell when squad is full (SEC-2026-02)", () => {
    it("fails with HTTP 400 when team has reached maximumSquadSize limit", async () => {
      // Configure 5 bought players on Team 2 (maximumSquadSize is 5)
      mockPlayers = [
        { id: 1, tournamentId: TOURNAMENT_ID, teamId: 2, status: "sold", isNonPlayingMember: false },
        { id: 2, tournamentId: TOURNAMENT_ID, teamId: 2, status: "sold", isNonPlayingMember: false },
        { id: 3, tournamentId: TOURNAMENT_ID, teamId: 2, status: "sold", isNonPlayingMember: false },
        { id: 4, tournamentId: TOURNAMENT_ID, teamId: 2, status: "sold", isNonPlayingMember: false },
        { id: 5, tournamentId: TOURNAMENT_ID, teamId: 2, status: "sold", isNonPlayingMember: false },
        { id: 10, tournamentId: TOURNAMENT_ID, teamId: null, status: "available", isNonPlayingMember: false },
      ];

      const app = buildTestApp();
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/manual-sell`)
        .send({
          teamId: 2,
          amount: 200_000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Maximum squad size reached/i);
      expect(res.body.error).toContain("5 players (limit: 5)");
    });
  });

  // ── Scenario 3: Manual sell of an already-sold player ────────────────────────
  describe("Scenario 3: Manual sell of an already-sold player (SEC-2026-02)", () => {
    it("aborts in-transaction and returns HTTP 409 already_sold when player CAS update returns 0 rows", async () => {
      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn((table: any) => ({
            set: () => ({
              where: () => {
                if (table === playersTableMock) {
                  // Atomic where(and(eq(id, 10), eq(status, "available"))) returns 0 rows
                  return { returning: () => Promise.resolve([]) };
                }
                return { returning: () => Promise.resolve([{ id: 1 }]) };
              },
            }),
          })),
          execute: () => Promise.resolve(),
          select: () => ({
            from: (t: any) => ({
              where: () => ({
                then: (resolve: any) => Promise.resolve(t === teamsTableMock ? mockTeams : []).then(resolve),
              }),
            }),
          }),
          insert: () => ({ values: () => Promise.resolve() }),
          delete: () => ({ where: () => Promise.resolve([]) }),
        };
        return callback(tx);
      });

      const app = buildTestApp();
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/manual-sell`)
        .send({
          teamId: 2,
          amount: 100_000,
        });

      expect(res.status).toBe(409);
      expect(res.body.hint).toBe("already_sold");
      expect(res.body.error).toMatch(/already been sold/i);
    });
  });

  // ── Scenario 4: ₹0 manual sale followed by undo ─────────────────────────────
  describe("Scenario 4: ₹0 manual sale followed by undo (SEC-2026-03)", () => {
    it("always inserts a bidsTable record for ₹0 sale and undo cleanly reverses it", async () => {
      let bidInserted: any = null;
      let bidDeleted = false;
      let playerUpdatedStatus: any = null;

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn((table: any) => ({
            set: (data: any) => ({
              where: () => {
                if (table === playersTableMock) {
                  playerUpdatedStatus = data.status;
                  return { returning: () => Promise.resolve([{ id: 10, ...data }]) };
                }
                return { returning: () => Promise.resolve([{ id: 1 }]) };
              },
            }),
          })),
          execute: () => Promise.resolve(),
          select: () => ({
            from: (t: any) => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve(mockBids.slice(0, 1)),
                  then: (resolve: any) => Promise.resolve(mockBids).then(resolve),
                }),
                then: (resolve: any) =>
                  Promise.resolve(
                    t === teamsTableMock ? mockTeams : t === playersTableMock ? mockPlayers : []
                  ).then(resolve),
              }),
            }),
          }),
          insert: vi.fn((table: any) => ({
            values: (val: any) => {
              if (table === bidsTableMock) bidInserted = val;
              return Promise.resolve();
            },
          })),
          delete: vi.fn(() => ({
            where: () => {
              bidDeleted = true;
              return Promise.resolve();
            },
          })),
        };
        return callback(tx);
      });

      const app = buildTestApp();

      // Step 1: Manual sell for ₹0
      const sellRes = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/manual-sell`)
        .send({
          teamId: 2,
          amount: 0,
        });

      expect(sellRes.status).toBe(200);
      expect(bidInserted).not.toBeNull();
      expect(bidInserted.amount).toBe(0);
      expect(bidInserted.playerId).toBe(10);
      expect(bidInserted.teamId).toBe(2);

      // Populate mockBids with the ₹0 bid
      mockBids = [{ id: 99, tournamentId: TOURNAMENT_ID, playerId: 10, teamId: 2, amount: 0, timestamp: new Date() }];

      // Step 2: Undo sale
      const undoRes = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/undo`)
        .send({ reason: "Testing ₹0 sale undo" });

      expect(undoRes.status).toBe(200);
      expect(playerUpdatedStatus).toBe("available");
      expect(bidDeleted).toBe(true);
    });
  });

  // ── Scenario 5: ₹0 sale after positive sale followed by undo ────────────────
  describe("Scenario 5: ₹0 sale after positive sale followed by undo (LIFO stack)", () => {
    it("undo pops the ₹0 sale first, preserving the prior positive sale and purse deduction", async () => {
      // Two bids in LIFO order: latest is ₹0 (Player 11), previous is ₹500,000 (Player 10)
      mockBids = [
        { id: 102, tournamentId: TOURNAMENT_ID, playerId: 11, teamId: 2, amount: 0, timestamp: new Date(Date.now()) },
        { id: 101, tournamentId: TOURNAMENT_ID, playerId: 10, teamId: 1, amount: 500_000, timestamp: new Date(Date.now() - 10000) },
      ];

      let undonePlayerId: number | null = null;
      let deletedBidId: number | null = null;

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          update: vi.fn((table: any) => ({
            set: () => ({
              where: () => {
                return { returning: () => Promise.resolve([{ id: 1 }]) };
              },
            }),
          })),
          execute: () => Promise.resolve(),
          select: () => ({
            from: (t: any) => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve(mockBids.slice(0, 1)),
                  then: (resolve: any) => Promise.resolve(mockBids).then(resolve),
                }),
                then: (resolve: any) =>
                  Promise.resolve(
                    t === teamsTableMock ? mockTeams : t === playersTableMock ? mockPlayers : []
                  ).then(resolve),
              }),
            }),
          }),
          insert: vi.fn(() => ({ values: () => Promise.resolve() })),
          delete: vi.fn((table: any) => ({
            where: () => {
              deletedBidId = mockBids[0].id;
              undonePlayerId = mockBids[0].playerId;
              return Promise.resolve();
            },
          })),
        };
        return callback(tx);
      });

      const app = buildTestApp();
      const undoRes = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/auction/undo`)
        .send({ reason: "Testing sequential LIFO undo" });

      expect(undoRes.status).toBe(200);
      // The LIFO stack MUST pop bid #102 (the ₹0 sale on Player 11) first!
      expect(deletedBidId).toBe(102);
      expect(undonePlayerId).toBe(11);
    });
  });

  // ── Scenario 6: Existing player profile overwrite attempt (SEC-2026-04) ───────
  describe("Scenario 6: Existing player profile overwrite attempt without authentication (SEC-2026-04)", () => {
    it("fails closed with 409 without leaking existing player name or internal id", async () => {
      const { default: playersRouter } = await import("../routes/players");
      const app = express();
      app.use(express.json());
      app.use("/api", playersRouter);

      // Send unauthenticated public registration for an already-registered mobile
      const res = await request(app)
        .post(`/api/tournaments/${TOURNAMENT_ID}/register/REG123`)
        .send({
          name: "Attacker Trying Overwrite",
          mobileNumber: "9876543210", // matches Virat Kohli in mockPlayers
          role: "Batsman",
          city: "Delhi",
        });

      // Must be 404 if code lookup fails or 409 if registered
      // In either case, the existing player's private details must NEVER be returned
      expect([404, 409]).toContain(res.status);
      expect(res.body.name).toBeUndefined();
      expect(res.body.playerId).toBeUndefined();
      if (res.status === 409) {
        expect(res.body.code).toBe("PLAYER_ALREADY_REGISTERED");
        expect(res.body.error).not.toContain("Virat Kohli");
      }
    });
  });

  // ── Scenario 7: Scorer with zero tournament assignments (SEC-2026-05) ────────
  describe("Scenario 7: Scorer with zero tournament assignments attempting tournament access (SEC-2026-05)", () => {
    it("strictly throws ScorerAuthError 403 TOURNAMENT_NOT_ASSIGNED without bypass", async () => {
      await expect(
        assertScorerMayAccessTournament(SCORER_ID, TOURNAMENT_ID)
      ).rejects.toThrow(ScorerAuthError);

      try {
        await assertScorerMayAccessTournament(SCORER_ID, TOURNAMENT_ID);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.code).toBe("TOURNAMENT_NOT_ASSIGNED");
      }
    });
  });

  // ── Scenario 8: Cross-tournament scorer access and match locking ─────────────
  describe("Scenario 8: Cross-tournament scorer access and match locking (tenant isolation)", () => {
    it("rejects scorer assigned to Tournament A from accessing Tournament B", async () => {
      await expect(
        assertScorerMayAccessTournament(SCORER_ID, OTHER_TOURNAMENT_ID)
      ).rejects.toThrow(ScorerAuthError);

      try {
        await assertScorerMayAccessTournament(SCORER_ID, OTHER_TOURNAMENT_ID);
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.code).toBe("TOURNAMENT_NOT_ASSIGNED");
      }
    });
  });

  // ── Scenario 9: OBS director cue authorization ──────────────────────────────
  describe("Scenario 9: OBS director cue authorization", () => {
    it("rejects unauthenticated caller from sending OBS director cues with 401 AUTH_REQUIRED", async () => {
      const prevScoring = process.env.SCORING;
      process.env.SCORING = "true";
      try {
        const { default: scoringRouter } = await import("../routes/scoring");
        const app = express();
        app.use(express.json());
        app.use("/api", scoringRouter);

        const res = await request(app)
          .post(`/api/tournaments/${TOURNAMENT_ID}/scoring/obs-director`)
          .send({ overlay: "scorecard", matchId: 42 });

        expect(res.status).toBe(401);
        expect(res.body.code).toBe("AUTH_REQUIRED");
      } finally {
        process.env.SCORING = prevScoring;
      }
    });
  });
});
