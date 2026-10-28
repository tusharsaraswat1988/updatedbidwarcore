import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// In-memory data store for integration assertions
type TournamentRecord = {
  id: number;
  name: string;
  sport: string;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  scoringPhase: string;
  status: string;
  licenseStatus: string;
  licenseGrantedAt: Date | null;
  licenseGrantedBy: string | null;
  adminLocked: boolean;
  adminLockedAt: Date | null;
  organizerId: number;
  featuresJson: string | null;
};

type AuctionSessionRecord = {
  id: number;
  tournamentId: number;
  status: string;
  phase: string;
  activePlayerId: number | null;
  lastAction: string | null;
  lastOutcome: string | null;
};

let tournaments: Map<number, TournamentRecord>;
let auctionSessions: Map<number, AuctionSessionRecord>;

function extractIdFromCondition(cond: any): number | undefined {
  if (typeof cond === "number") return cond;
  if (!cond) return undefined;
  if (typeof cond.right === "number") return cond.right;
  if (typeof cond.value === "number") return cond.value;
  if (Array.isArray(cond.queryChunks)) {
    const num = cond.queryChunks.find((x: any) => typeof x === "number");
    if (typeof num === "number") return num;
  }
  return undefined;
}

// Hoisted mocks for database
vi.mock("@workspace/db", () => {
  const tournamentsTable = {
    id: "tournaments.id",
    name: "tournaments.name",
    sport: "tournaments.sport",
    status: "tournaments.status",
    auctionEnabled: "tournaments.auctionEnabled",
    scoringEnabled: "tournaments.scoringEnabled",
    scoringPhase: "tournaments.scoringPhase",
    licenseStatus: "tournaments.licenseStatus",
    licenseGrantedAt: "tournaments.licenseGrantedAt",
    licenseGrantedBy: "tournaments.licenseGrantedBy",
    adminLocked: "tournaments.adminLocked",
    adminLockedAt: "tournaments.adminLockedAt",
    organizerId: "tournaments.organizerId",
    featuresJson: "tournaments.featuresJson",
    createdAt: "tournaments.createdAt",
  };

  const auctionSessionsTable = {
    id: "auctionSessions.id",
    tournamentId: "auctionSessions.tournamentId",
    status: "auctionSessions.status",
    phase: "auctionSessions.phase",
    activePlayerId: "auctionSessions.activePlayerId",
    lastAction: "auctionSessions.lastAction",
    lastOutcome: "auctionSessions.lastOutcome",
  };

  const dbMock = {
    select: (fields?: any) => {
      let targetTable: any = null;
      let whereFilter: any = null;
      const chain: any = {
        from: (tbl: any) => {
          targetTable = tbl;
          return chain;
        },
        where: (condition: any) => {
          whereFilter = condition;
          return chain;
        },
        orderBy: () => chain,
        groupBy: () => chain,
        having: () => chain,
        limit: () => chain,
        for: () => chain,
        then: (resolve: any) => {
          const tid = extractIdFromCondition(whereFilter);
          if (targetTable === tournamentsTable) {
            const list = Array.from(tournaments.values());
            const res = tid !== undefined ? list.filter((t) => t.id === tid) : list;
            return resolve(res);
          }
          if (targetTable === auctionSessionsTable) {
            const list = Array.from(auctionSessions.values());
            const res = tid !== undefined ? list.filter((s) => s.tournamentId === tid) : list;
            return resolve(res);
          }
          return resolve([]);
        },
      };
      return chain;
    },
    update: (tbl: any) => {
      let updateValues: any = {};
      let whereFilter: any = null;
      const chain: any = {
        set: (vals: any) => {
          updateValues = vals;
          return chain;
        },
        where: (cond: any) => {
          whereFilter = cond;
          const tid = extractIdFromCondition(cond);
          if (tbl === tournamentsTable && tid !== undefined && tournaments.has(tid)) {
            const existing = tournaments.get(tid)!;
            Object.assign(existing, updateValues);
          } else if (tbl === auctionSessionsTable && tid !== undefined && auctionSessions.has(tid)) {
            const existing = auctionSessions.get(tid)!;
            Object.assign(existing, updateValues);
          }
          return chain;
        },
        returning: () => {
          const tid = extractIdFromCondition(whereFilter);
          const res = tbl === tournamentsTable && tid !== undefined && tournaments.has(tid) ? [tournaments.get(tid)] : [];
          return Promise.resolve(res);
        },
        then: (resolve: any) => {
          const tid = extractIdFromCondition(whereFilter);
          const res = tbl === tournamentsTable && tid !== undefined && tournaments.has(tid) ? [tournaments.get(tid)] : [];
          return resolve(res);
        },
      };
      return chain;
    },
    transaction: async (cb: any) => {
      return cb(dbMock);
    },
  };

  return {
    db: dbMock,
    tournamentsTable,
    auctionSessionsTable,
    teamsTable: { id: "teams.id", tournamentId: "teams.tournamentId" },
    playersTable: { id: "players.id", tournamentId: "players.tournamentId" },
    bidsTable: { id: "bids.id", tournamentId: "bids.tournamentId" },
    categoriesTable: { id: "categories.id", tournamentId: "categories.tournamentId" },
    organizersTable: { id: "organizers.id" },
    purseBoostersTable: { id: "purseBoosters.id", tournamentId: "purseBoosters.tournamentId" },
    auctionBidEventsTable: { tournamentId: "auctionBidEvents.tournamentId" },
    auctionPlayerEventsTable: { tournamentId: "auctionPlayerEvents.tournamentId" },
    auctionTimerEventsTable: { tournamentId: "auctionTimerEvents.tournamentId" },
    scoringMatchesTable: { tournamentId: "scoringMatches.tournamentId" },
    tournamentLicenseRequestsTable: { tournamentId: "tournamentLicenseRequests.tournamentId" },
  };
});

// Mock helpers and side-effects
vi.mock("../lib/runtime-env", () => ({
  assertRuntimeEnv: () => ({ isProduction: false }),
  getRuntimeConfig: () => ({ isProduction: false }),
  getAdminPassword: () => "admin-secret",
  getPublicOrigin: () => "http://localhost",
  buildPublicUrl: (path: string) => `http://localhost${path}`,
}));

vi.mock("../lib/audit-service", () => ({
  auditLog: vi.fn(),
}));

vi.mock("../lib/broadcast", () => ({
  broadcastToTournament: vi.fn(),
  addSseClient: vi.fn(),
  removeSseClient: vi.fn(),
  getSseClientCount: vi.fn().mockReturnValue(0),
}));

vi.mock("../lib/master-sports/cricket-roster", () => ({
  handoffAuctionParticipantsToSports: vi.fn(),
  handoffAuctionParticipantsToSportsAsync: vi.fn(),
}));

vi.mock("../lib/auction-state-builder", () => ({
  buildAuctionState: vi.fn(async (tid: number) => ({
    state: { tournamentId: tid, status: "completed" },
    timings: { total: 1 },
  })),
  formatAuctionStateFlamegraph: vi.fn(() => ""),
}));

vi.mock("../lib/auction-broadcast", () => ({
  emitAuctionStateEvent: vi.fn(async (_tid: number, state: any) => state),
  emitBidEvent: vi.fn(),
  emitSoldEvent: vi.fn(),
}));

vi.mock("../middleware/require-organizer", () => ({
  requireTournamentOrganizer: vi.fn(async (req, res, tid) => {
    if (req.headers["x-unauthorized"] === "true") {
      res.status(403).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  }),
  isTournamentOrganizer: vi.fn(async () => true),
  canAccessPrivateTournamentData: vi.fn(async () => true),
}));

vi.mock("../lib/auction-license-activation", () => ({
  commitAdminLicenseTransition: vi.fn(async (req, input) => {
    const tid = input.tournamentId;
    if (tournaments.has(tid)) {
      const t = tournaments.get(tid)!;
      t.licenseStatus = input.nextStatus;
      if (input.recordGrant) {
        t.licenseGrantedAt = new Date();
        t.licenseGrantedBy = input.grantedBy;
      }
      return { ok: true, tournament: t, demoRemoved: false };
    }
    return { ok: false, status: 404, body: { error: "Tournament not found" } };
  }),
}));

import auctionRouter from "../routes/auction";
import authRouter from "../routes/auth";
import commRouter from "../routes/comm";

function createIntegrationApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const isAdmin = req.headers["x-is-admin"] === "true";
    (req as any).jwtUser = {
      isAdmin,
      adminLevel: isAdmin ? "master" : null,
      organizerAccountId: 10,
      organizer: { "1": true, "2": true, "3": true, "4": true },
    };
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });

  app.use(auctionRouter);
  app.use(authRouter);
  app.use(commRouter);

  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

describe("Tournament Lifecycle Integration Tests (Route Level)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    tournaments = new Map();
    auctionSessions = new Map();
    app = createIntegrationApp();

    // 1: Dual-module, scoring active
    tournaments.set(1, {
      id: 1,
      name: "Dual Module Live Tournament",
      sport: "cricket",
      auctionEnabled: true,
      scoringEnabled: true,
      scoringPhase: "active",
      status: "active",
      licenseStatus: "active",
      licenseGrantedAt: new Date("2026-01-01"),
      licenseGrantedBy: "master",
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
    });
    auctionSessions.set(1, {
      id: 101,
      tournamentId: 1,
      status: "active",
      phase: "in_progress",
      activePlayerId: 5,
      lastAction: "bidding",
      lastOutcome: null,
    });

    // 2: Dual-module, scoring in setup
    tournaments.set(2, {
      id: 2,
      name: "Dual Module Setup Tournament",
      sport: "badminton",
      auctionEnabled: true,
      scoringEnabled: true,
      scoringPhase: "setup",
      status: "draw_ready",
      licenseStatus: "active",
      licenseGrantedAt: new Date("2026-01-01"),
      licenseGrantedBy: "master",
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
    });
    auctionSessions.set(2, {
      id: 102,
      tournamentId: 2,
      status: "active",
      phase: "in_progress",
      activePlayerId: null,
      lastAction: "bidding",
      lastOutcome: null,
    });

    // 3: Auction-only tournament
    tournaments.set(3, {
      id: 3,
      name: "Auction Only Tournament",
      sport: "cricket",
      auctionEnabled: true,
      scoringEnabled: false,
      scoringPhase: "disabled",
      status: "active",
      licenseStatus: "active",
      licenseGrantedAt: new Date("2026-01-01"),
      licenseGrantedBy: "master",
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
    });
    auctionSessions.set(3, {
      id: 103,
      tournamentId: 3,
      status: "active",
      phase: "in_progress",
      activePlayerId: 12,
      lastAction: "bidding",
      lastOutcome: null,
    });

    // 4: Scoring-only tournament
    tournaments.set(4, {
      id: 4,
      name: "Scoring Only Tournament",
      sport: "cricket",
      auctionEnabled: false,
      scoringEnabled: true,
      scoringPhase: "active",
      status: "active",
      licenseStatus: "active",
      licenseGrantedAt: new Date("2026-01-01"),
      licenseGrantedBy: "master",
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
    });
  });

  describe("1. POST /tournaments/:tournamentId/auction/conclude", () => {
    it("dual-module: concluding auction preserves tournament status while scoring is active", async () => {
      const res = await request(app).post("/tournaments/1/auction/conclude");
      expect(res.status).toBe(200);

      // Auction session is marked completed
      const session = auctionSessions.get(1);
      expect(session?.status).toBe("completed");

      // Tournament itself remains active because scoring is active!
      const tournament = tournaments.get(1);
      expect(tournament?.status).toBe("active");
    });

    it("dual-module: concluding auction preserves tournament status while scoring is in setup", async () => {
      const res = await request(app).post("/tournaments/2/auction/conclude");
      expect(res.status).toBe(200);

      // Tournament remains in draw_ready
      const tournament = tournaments.get(2);
      expect(tournament?.status).toBe("draw_ready");
      const session = auctionSessions.get(2);
      expect(session?.status).toBe("completed");
    });

    it("auction-only: concluding auction completes both the auction session and tournament status", async () => {
      const res = await request(app).post("/tournaments/3/auction/conclude");
      expect(res.status).toBe(200);

      const session = auctionSessions.get(3);
      expect(session?.status).toBe("completed");

      const tournament = tournaments.get(3);
      expect(tournament?.status).toBe("completed");
    });

    it("scoring-only: rejects auction conclude with 403 AUCTION_DISABLED", async () => {
      const res = await request(app).post("/tournaments/4/auction/conclude");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Auction module is not enabled");

      // Status must remain active
      const tournament = tournaments.get(4);
      expect(tournament?.status).toBe("active");
    });
  });

  describe("2. POST /auth/admin/tournaments/:tournamentId/lock (Emergency Lock)", () => {
    it("dual-module: locks tournament without terminating tournament status when scoring is pending", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/lock")
        .set("x-is-admin", "true");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const tournament = tournaments.get(1);
      expect(tournament?.adminLocked).toBe(true);
      expect(tournament?.adminLockedAt).toBeInstanceOf(Date);
      // Status is preserved because scoring is active
      expect(tournament?.status).toBe("active");
    });

    it("auction-only: locks tournament and marks status completed", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/3/lock")
        .set("x-is-admin", "true");

      expect(res.status).toBe(200);

      const tournament = tournaments.get(3);
      expect(tournament?.adminLocked).toBe(true);
      expect(tournament?.status).toBe("completed");
    });

    it("rejects non-admin callers with 401", async () => {
      const res = await request(app).post("/auth/admin/tournaments/1/lock");
      expect(res.status).toBe(401);
    });
  });

  describe("3. POST /auth/admin/tournaments/:id/set-license-status", () => {
    it("setting license to completed marks auction session completed without corrupting scoring", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/set-license-status")
        .set("x-is-admin", "true")
        .send({ status: "completed", reason: "Auction wrapped up for tournament 1" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const session = auctionSessions.get(1);
      expect(session?.status).toBe("completed");

      const tournament = tournaments.get(1);
      expect(tournament?.licenseStatus).toBe("completed");
      expect(tournament?.scoringPhase).toBe("active");
      expect(tournament?.status).toBe("active");
    });
  });

  describe("4. Communication Centralized Entitlement Gating", () => {
    it("allows WhatsApp in dual-mode tournament when auction license is completed but scoring is active", async () => {
      // Simulate auction ended and marked license completed
      const t = tournaments.get(1)!;
      t.licenseStatus = "completed";
      t.licenseGrantedAt = new Date("2026-01-01");
      t.scoringEnabled = true;
      t.scoringPhase = "active";
      t.adminLocked = false;

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .set("x-is-admin", "true")
        .send({
          channel: "whatsapp",
          tournamentId: 1,
          recipientGroup: "manual",
          manualMobiles: ["9876543210"],
          messageContent: "Match #1 starts at 2:00 PM!",
        });

      // Does not return 403 license error
      expect(res.status).not.toBe(403);
    });

    it("strictly blocks WhatsApp with 403 when emergency lock is engaged", async () => {
      const t = tournaments.get(1)!;
      t.adminLocked = true;

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .set("x-is-admin", "true")
        .send({
          channel: "whatsapp",
          tournamentId: 1,
          recipientGroup: "manual",
          manualMobiles: ["9876543210"],
          messageContent: "Emergency announcement",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("WhatsApp messaging requires a live license and unlocked tournament");
    });

    it("blocks WhatsApp with 403 when tournament is an unlicensed trial", async () => {
      const t = tournaments.get(1)!;
      t.licenseStatus = "trial";
      t.licenseGrantedAt = null;

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .set("x-is-admin", "true")
        .send({
          channel: "whatsapp",
          tournamentId: 1,
          recipientGroup: "manual",
          manualMobiles: ["9876543210"],
          messageContent: "Trial test message",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("WhatsApp messaging requires a live license and unlocked tournament");
    });
  });
});
