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
  createdAt: Date;
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

type LicenseRequestRecord = {
  id: number;
  tournamentId: number;
  requestedModules: string;
  status: string;
  paymentVerified: boolean;
  paymentAmount: number | null;
  paymentMode: string | null;
  paymentRef: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  notes: string | null;
};

let tournaments: Map<number, TournamentRecord>;
let auctionSessions: Map<number, AuctionSessionRecord>;
let licenseRequests: Map<number, LicenseRequestRecord>;
let auditLogsList: any[];

function extractAllFromCondition(cond: any): { numbers: number[]; strings: string[] } {
  const numbers: number[] = [];
  const strings: string[] = [];
  function walk(node: any) {
    if (node === null || node === undefined) return;
    if (typeof node === "number") {
      numbers.push(node);
      return;
    }
    if (typeof node === "string") {
      strings.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      if (typeof node.value === "number") numbers.push(node.value);
      if (typeof node.value === "string") strings.push(node.value);
      if (typeof node.right === "number") numbers.push(node.right);
      if (typeof node.right === "string") strings.push(node.right);
      if (Array.isArray(node.queryChunks)) {
        for (const chunk of node.queryChunks) walk(chunk);
      }
    }
  }
  walk(cond);
  return { numbers, strings };
}

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

  const tournamentLicenseRequestsTable = {
    id: "tournamentLicenseRequests.id",
    tournamentId: "tournamentLicenseRequests.tournamentId",
    requestedModules: "tournamentLicenseRequests.requestedModules",
    status: "tournamentLicenseRequests.status",
    paymentVerified: "tournamentLicenseRequests.paymentVerified",
    paymentAmount: "tournamentLicenseRequests.paymentAmount",
    paymentMode: "tournamentLicenseRequests.paymentMode",
    paymentRef: "tournamentLicenseRequests.paymentRef",
    verifiedBy: "tournamentLicenseRequests.verifiedBy",
    verifiedAt: "tournamentLicenseRequests.verifiedAt",
    notes: "tournamentLicenseRequests.notes",
    createdAt: "tournamentLicenseRequests.createdAt",
  };

  const adminNotificationsTable = {
    id: "adminNotifications.id",
    type: "adminNotifications.type",
    entityId: "adminNotifications.entityId",
    resolutionStatus: "adminNotifications.resolutionStatus",
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
          if (targetTable === tournamentLicenseRequestsTable) {
            const { numbers, strings } = extractAllFromCondition(whereFilter);
            let list = Array.from(licenseRequests.values());
            if (strings.includes("pending")) {
              list = list.filter((r) => r.status === "pending");
            }
            if (numbers.length === 1) {
              const num = numbers[0];
              list = list.filter((r) => r.id === num || r.tournamentId === num);
            } else if (numbers.length >= 2) {
              list = list.filter((r) => numbers.includes(r.id) && numbers.includes(r.tournamentId));
            }
            return resolve(list);
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
          } else if (tbl === tournamentLicenseRequestsTable) {
            const { numbers } = extractAllFromCondition(cond);
            const targetId = numbers.find((n) => licenseRequests.has(n));
            if (targetId !== undefined) {
              const existing = licenseRequests.get(targetId)!;
              Object.assign(existing, updateValues);
            }
          }
          return chain;
        },
        returning: () => {
          const tid = extractIdFromCondition(whereFilter);
          const res = tbl === tournamentsTable && tid !== undefined && tournaments.has(tid)
            ? [tournaments.get(tid)]
            : tbl === auctionSessionsTable && tid !== undefined && auctionSessions.has(tid)
              ? [auctionSessions.get(tid)]
              : tbl === tournamentLicenseRequestsTable && tid !== undefined && licenseRequests.has(tid)
                ? [licenseRequests.get(tid)]
                : [];
          return Promise.resolve(res);
        },
        then: (resolve: any) => {
          const tid = extractIdFromCondition(whereFilter);
          const res = tbl === tournamentsTable && tid !== undefined && tournaments.has(tid)
            ? [tournaments.get(tid)]
            : tbl === auctionSessionsTable && tid !== undefined && auctionSessions.has(tid)
              ? [auctionSessions.get(tid)]
              : tbl === tournamentLicenseRequestsTable && tid !== undefined && licenseRequests.has(tid)
                ? [licenseRequests.get(tid)]
                : [];
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
    tournamentLicenseRequestsTable,
    adminNotificationsTable,
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
  auditLog: vi.fn((_req: any, entry: any) => {
    auditLogsList.push(entry);
  }),
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
      if (input.afterWrite) {
        const { db } = await import("@workspace/db");
        await input.afterWrite(db as any);
      }
      return { ok: true, tournament: t, demoRemoved: false };
    }
    return { ok: false, status: 404, body: { error: "Tournament not found" } };
  }),
}));

import auctionRouter from "../routes/auction";
import authRouter from "../routes/auth";
import commRouter from "../routes/comm";
import tournamentsRouter from "../routes/tournaments";

function createIntegrationApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    (req as any).cookies = {};
    const isStandard = req.headers["x-is-standard"] === "true";
    const isAdmin = req.headers["x-is-admin"] === "true" || req.headers["x-is-master"] === "true";
    const isMaster = !isStandard && (req.headers["x-is-master"] === "true" || isAdmin);
    if (isAdmin || isMaster) {
      (req as any).cookies["bidwar_auth"] = "mock_auth_token";
    }
    (req as any).jwtUser = {
      isAdmin,
      role: isAdmin ? "admin" : "user",
      adminLevel: isMaster ? "master" : isStandard ? "standard" : null,
      email: isMaster ? "superadmin@bidwar.com" : isAdmin ? "admin@bidwar.com" : "user@bidwar.com",
      organizerAccountId: 10,
      organizer: { "1": true, "2": true, "3": true, "4": true, "5": true },
    };
    next();
  });

  app.use(auctionRouter);
  app.use(authRouter);
  app.use(commRouter);
  app.use(tournamentsRouter);

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
    licenseRequests = new Map();
    auditLogsList = [];
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
      createdAt: new Date("2026-01-01"),
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
      createdAt: new Date("2026-01-01"),
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
      createdAt: new Date("2026-01-01"),
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
      createdAt: new Date("2026-01-01"),
    });

    // 5: Unlicensed trial scoring-only tournament with pending license request
    tournaments.set(5, {
      id: 5,
      name: "Trial Badminton Championship",
      sport: "badminton",
      auctionEnabled: false,
      scoringEnabled: true,
      scoringPhase: "setup",
      status: "active",
      licenseStatus: "trial",
      licenseGrantedAt: null,
      licenseGrantedBy: null,
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
      createdAt: new Date("2026-01-01"),
    });

    licenseRequests.set(501, {
      id: 501,
      tournamentId: 5,
      requestedModules: "scoring",
      status: "pending",
      paymentVerified: false,
      paymentAmount: 4999,
      paymentMode: "upi",
      paymentRef: "UPI/ORDER501",
      verifiedBy: null,
      verifiedAt: null,
      notes: "Organiser submitted payment receipt",
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
        .set("x-is-master", "true")
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

  describe("5. PATCH /auth/admin/tournaments/:tournamentId (Safe scoringPhase Updates & Preservation)", () => {
    it("updates scoringPhase explicitly through real route handler", async () => {
      const res = await request(app)
        .patch("/auth/admin/tournaments/1")
        .set("x-is-admin", "true")
        .send({ scoringPhase: "completed", reason: "Scoring season wrapped up" });

      expect(res.status).toBe(200);
      const t = tournaments.get(1)!;
      expect(t.scoringPhase).toBe("completed");
    });

    it("enabling scoring preserves an existing setup phase without blind overwrite", async () => {
      const t = tournaments.get(2)!;
      expect(t.scoringPhase).toBe("setup");

      const res = await request(app)
        .patch("/auth/admin/tournaments/2")
        .set("x-is-admin", "true")
        .send({ scoringEnabled: true, reason: "Re-confirming scoring enabled" });

      expect(res.status).toBe(200);
      expect(t.scoringPhase).toBe("setup"); // Preserved!
    });

    it("enabling scoring on a tournament with disabled phase initializes scoringPhase to active", async () => {
      const t = tournaments.get(3)!;
      expect(t.scoringPhase).toBe("disabled");

      const res = await request(app)
        .patch("/auth/admin/tournaments/3")
        .set("x-is-admin", "true")
        .send({ scoringEnabled: true, reason: "Enabling cricket scoring for first time" });

      expect(res.status).toBe(200);
      expect(t.scoringPhase).toBe("active");
    });

    it("disabling scoring sets scoringPhase to disabled", async () => {
      const res = await request(app)
        .patch("/auth/admin/tournaments/1")
        .set("x-is-admin", "true")
        .send({ scoringEnabled: false, reason: "Disabling match scoring engine" });

      expect(res.status).toBe(200);
      const t = tournaments.get(1)!;
      expect(t.scoringPhase).toBe("disabled");
    });

    it("rejects non-master admin updating scoringPhase with 403", async () => {
      const res = await request(app)
        .patch("/auth/admin/tournaments/1")
        .set("x-is-admin", "true")
        .set("x-is-standard", "true")
        .send({ scoringPhase: "completed", reason: "Attempted unauthorized scoring phase change" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only master admin can change tournament lifecycle status");
    });

    it("rejects non-master admin updating tournament status with 403", async () => {
      const res = await request(app)
        .patch("/auth/admin/tournaments/1")
        .set("x-is-admin", "true")
        .set("x-is-standard", "true")
        .send({ status: "completed", reason: "Attempted unauthorized status change" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only master admin can change tournament lifecycle status");
    });

    it("rejects master admin updating scoringPhase without valid audit reason with 400", async () => {
      const res = await request(app)
        .patch("/auth/admin/tournaments/1")
        .set("x-is-master", "true")
        .send({ scoringPhase: "completed" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Reason is required");
    });
  });

  describe("6. POST /auth/admin/tournaments/:id/scoring/set-phase (Authoritative Scoring Lifecycle Phase)", () => {
    it("rejects non-master admin access with 403", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-admin", "true")
        .set("x-is-standard", "true") // standard admin, not master
        .send({ phase: "completed", reason: "Tournament wrap-up" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Super admin access required");
    });

    it("rejects invalid scoring phase with 400", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "invalid_phase", reason: "Audit testing" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Phase must be setup, active, or completed");
    });

    it("rejects missing audit reason with 400", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 404 for non-existent tournament", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/999/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "Audit reason testing non-existent" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Tournament not found");
    });

    it("returns 400 if tournament does not have scoring enabled", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/3/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "Audit reason testing disabled scoring" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Sports scoring is not enabled for this tournament");
    });

    it("dual-module: completing scoring while auction is active preserves tournament status as active", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "Scoring matches finished, auction still open" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scoringPhase).toBe("completed");
      expect(res.body.status).toBe("active");

      const t = tournaments.get(1)!;
      expect(t.scoringPhase).toBe("completed");
      expect(t.status).toBe("active"); // Decoupled!
    });

    it("dual-module: completing scoring when auction is already completed marks tournament status as completed", async () => {
      const t = tournaments.get(1)!;
      t.licenseStatus = "completed"; // Auction finished

      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "Both auction and scoring are now concluded" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scoringPhase).toBe("completed");
      expect(res.body.status).toBe("completed");

      expect(t.status).toBe("completed");
    });

    it("scoring-only: completing scoring marks tournament status as completed", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/4/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "All cricket matches concluded" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scoringPhase).toBe("completed");
      expect(res.body.status).toBe("completed");

      const t = tournaments.get(4)!;
      expect(t.scoringPhase).toBe("completed");
      expect(t.status).toBe("completed");
    });

    it("reactivating scoring on a completed tournament restores status to active", async () => {
      const t = tournaments.get(4)!;
      t.scoringPhase = "completed";
      t.status = "completed";

      const res = await request(app)
        .post("/auth/admin/tournaments/4/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "active", reason: "Re-opening cricket matches for playoff finals" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scoringPhase).toBe("active");
      expect(res.body.status).toBe("active");

      expect(t.status).toBe("active");
    });

    it("records a critical audit log entry on phase change", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "Audit logging verification for scoring phase" });

      expect(res.status).toBe(200);
      const log = auditLogsList.find((l) => l.action === "tournament.scoring_phase_changed");
      expect(log).toBeDefined();
      expect(log.category).toBe("tournament");
      expect(log.severity).toBe("critical");
      expect(log.before.scoringPhase).toBe("active");
      expect(log.after.scoringPhase).toBe("completed");
      expect(log.reason).toBe("Audit logging verification for scoring phase");
    });

    it("emergency lock preservation: reactivating scoring does NOT restore status to active if adminLocked is true", async () => {
      const t = tournaments.get(4)!;
      t.scoringPhase = "completed";
      t.status = "completed";
      t.adminLocked = true;

      const res = await request(app)
        .post("/auth/admin/tournaments/4/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "active", reason: "Re-opening cricket matches under emergency supervision" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scoringPhase).toBe("active");
      expect(res.body.status).toBe("completed");

      expect(t.scoringPhase).toBe("active");
      expect(t.status).toBe("completed");
      expect(t.adminLocked).toBe(true);
    });
  });

  describe("7. POST /auth/admin/tournaments/:id/verify-and-grant-license (Payment Verification & License Grant)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use((req, _res, next) => {
        (req as any).log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
        (req as any).cookies = {};
        (req as any).jwtUser = {};
        next();
      });
      unauthApp.use(tournamentsRouter);

      const res = await request(unauthApp)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .send({ requestId: 501, paymentAmount: 4999 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Not authorised");
    });

    it("rejects non-master admin access with 403", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .set("x-is-admin", "true")
        .set("x-is-standard", "true")
        .send({
          requestId: 501,
          paymentAmount: 4999,
          paymentRef: "UPI/VERIFIED/9999",
          reason: "Testing unauthorized grant",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only the master admin can verify payments and grant licenses");
    });

    it("rejects request missing a valid audit reason with 400", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 501,
          paymentAmount: 4999,
          paymentRef: "UPI/VERIFIED/9999",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Reason is required");
    });

    it("returns 404 if tournament does not exist", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/999/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 501,
          paymentAmount: 4999,
          paymentRef: "UPI/VERIFIED/9999",
          reason: "Payment verified in HDFC account statement",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Tournament not found");
    });

    it("returns 404 if license request does not exist or belongs to another tournament", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 999,
          paymentAmount: 4999,
          paymentRef: "UPI/VERIFIED/9999",
          reason: "Payment verified in HDFC account statement",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("License request not found for this tournament");
    });

    it("returns 400 if tournament has no pending license request", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          paymentAmount: 4999,
          paymentRef: "UPI/VERIFIED/9999",
          reason: "Payment verified in HDFC account statement",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("No pending license request found for this tournament");
    });

    it("rejects license grant when payment reference is missing for non-waiver with 400", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 501,
          paymentAmount: 4999,
          paymentMode: "upi",
          paymentRef: "",
          reason: "Payment verified in HDFC account statement",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Payment reference / UTR is required for verification");
    });

    it("rejects request if license request is already granted", async () => {
      const reqRow = licenseRequests.get(501)!;
      reqRow.status = "granted";

      const res = await request(app)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 501,
          paymentAmount: 4999,
          paymentRef: "UPI/VERIFIED/9999",
          reason: "Attempting duplicate payment verification",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("License request has already been granted");
    });

    it("verifies payment and grants live license for scoring-only tournament", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/5/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 501,
          paymentAmount: 4999,
          paymentMode: "upi",
          paymentRef: "UPI/VERIFIED/9999",
          notes: "Payment verified via bank statement",
          reason: "Payment verified in HDFC bank account statement",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const t = tournaments.get(5)!;
      expect(t.licenseStatus).toBe("active");

      const reqRow = licenseRequests.get(501)!;
      expect(reqRow.status).toBe("granted");
      expect(reqRow.paymentVerified).toBe(true);
      expect(reqRow.paymentRef).toBe("UPI/VERIFIED/9999");
      expect(reqRow.verifiedBy).toBe("superadmin@bidwar.com");
      expect(reqRow.verifiedAt).toBeInstanceOf(Date);
    });
  });
});
