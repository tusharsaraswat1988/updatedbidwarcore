import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

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
let licenseRequests: Map<number, LicenseRequestRecord>;
let auditLogsList: any[];

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
    select: () => {
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
          if (targetTable === tournamentLicenseRequestsTable) {
            const list = Array.from(licenseRequests.values());
            const res = tid !== undefined ? list.filter((r) => r.tournamentId === tid || r.id === tid) : list;
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
          } else if (tbl === tournamentLicenseRequestsTable && tid !== undefined && licenseRequests.has(tid)) {
            const existing = licenseRequests.get(tid)!;
            Object.assign(existing, updateValues);
          }
          return chain;
        },
        returning: () => {
          const tid = extractIdFromCondition(whereFilter);
          const res = tbl === tournamentsTable && tid !== undefined && tournaments.has(tid)
            ? [tournaments.get(tid)]
            : tbl === tournamentLicenseRequestsTable && tid !== undefined && licenseRequests.has(tid)
              ? [licenseRequests.get(tid)]
              : [];
          return Promise.resolve(res);
        },
        then: (resolve: any) => {
          const tid = extractIdFromCondition(whereFilter);
          const res = tbl === tournamentsTable && tid !== undefined && tournaments.has(tid)
            ? [tournaments.get(tid)]
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
    tournamentLicenseRequestsTable,
    adminNotificationsTable,
    organizersTable: { id: "organizers.id" },
    scoringMatchesTable: { tournamentId: "scoringMatches.tournamentId" },
    auctionSessionsTable: { tournamentId: "auctionSessions.tournamentId" },
    teamsTable: { id: "teams.id", tournamentId: "teams.tournamentId" },
    playersTable: { id: "players.id", tournamentId: "players.tournamentId" },
    bidsTable: { id: "bids.id", tournamentId: "bids.tournamentId" },
    categoriesTable: { id: "categories.id", tournamentId: "categories.tournamentId" },
    purseBoostersTable: { id: "purseBoosters.id", tournamentId: "purseBoosters.tournamentId" },
    auctionBidEventsTable: { tournamentId: "auctionBidEvents.tournamentId" },
    auctionPlayerEventsTable: { tournamentId: "auctionPlayerEvents.tournamentId" },
    auctionTimerEventsTable: { tournamentId: "auctionTimerEvents.tournamentId" },
  };
});

vi.mock("../lib/audit-service", () => ({
  auditLog: vi.fn((_req: any, entry: any) => {
    auditLogsList.push(entry);
  }),
}));

vi.mock("../lib/runtime-env", () => ({
  assertRuntimeEnv: () => ({ isProduction: false }),
  getRuntimeConfig: () => ({ isProduction: false }),
  getAdminPassword: () => "admin-secret",
  getPublicOrigin: () => "http://localhost",
  buildPublicUrl: (path: string) => `http://localhost${path}`,
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

import authRouter from "../routes/auth";
import tournamentsRouter from "../routes/tournaments";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
    (req as any).cookies = {};
    const isAdmin = req.headers["x-is-admin"] === "true";
    const isMaster = req.headers["x-is-master"] === "true";
    if (isAdmin || isMaster) {
      (req as any).cookies["bidwar_auth"] = "mock_auth_token";
    }
    (req as any).jwtUser = {
      isAdmin: isAdmin || isMaster,
      role: isAdmin || isMaster ? "admin" : "user",
      adminLevel: isMaster ? "master" : isAdmin ? "standard" : null,
      email: isMaster ? "superadmin@bidwar.com" : isAdmin ? "admin@bidwar.com" : "user@bidwar.com",
      organizerAccountId: 10,
    };
    next();
  });
  app.use(authRouter);
  app.use(tournamentsRouter);
  return app;
}

describe("Tournament Admin Scoring Phase & License Verification (P1)", () => {
  let app: express.Express;

  beforeEach(() => {
    tournaments = new Map();
    licenseRequests = new Map();
    auditLogsList = [];

    // Tournament 1: Dual-module (Auction + Scoring), currently active
    tournaments.set(1, {
      id: 1,
      name: "Dual Module Championship",
      sport: "cricket",
      auctionEnabled: true,
      scoringEnabled: true,
      scoringPhase: "active",
      status: "active",
      licenseStatus: "active",
      licenseGrantedAt: new Date(),
      licenseGrantedBy: "master",
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
      createdAt: new Date(),
    });

    // Tournament 2: Scoring-only
    tournaments.set(2, {
      id: 2,
      name: "Badminton Open",
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
      createdAt: new Date(),
    });

    // Tournament 3: Auction-only (scoring disabled)
    tournaments.set(3, {
      id: 3,
      name: "Auction Only Premier",
      sport: "cricket",
      auctionEnabled: true,
      scoringEnabled: false,
      scoringPhase: "disabled",
      status: "active",
      licenseStatus: "active",
      licenseGrantedAt: new Date(),
      licenseGrantedBy: "master",
      adminLocked: false,
      adminLockedAt: null,
      organizerId: 10,
      featuresJson: null,
      createdAt: new Date(),
    });

    // Pending License Request for Tournament 2
    licenseRequests.set(101, {
      id: 101,
      tournamentId: 2,
      requestedModules: "scoring",
      status: "pending",
      paymentVerified: false,
      paymentAmount: 4999,
      paymentMode: "upi",
      paymentRef: "UPI/TXN123456",
      verifiedBy: null,
      verifiedAt: null,
      notes: "Organiser paid via UPI",
    });

    app = createTestApp();
  });

  describe("POST /auth/admin/tournaments/:id/scoring/set-phase", () => {
    it("rejects non-master admin access with 403", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/1/scoring/set-phase")
        .set("x-is-admin", "true") // standard admin, not master
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
      expect(t.status).toBe("active"); // Decoupled: Auction is still active, so tournament status remains active!
    });

    it("dual-module: completing scoring when auction is already completed marks tournament status as completed", async () => {
      const t = tournaments.get(1)!;
      t.licenseStatus = "completed"; // Auction already finished

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
        .post("/auth/admin/tournaments/2/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "completed", reason: "All badminton matches concluded" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.scoringPhase).toBe("completed");
      expect(res.body.status).toBe("completed");

      const t = tournaments.get(2)!;
      expect(t.scoringPhase).toBe("completed");
      expect(t.status).toBe("completed");
    });

    it("reactivating scoring on a completed tournament restores status to active", async () => {
      const t = tournaments.get(2)!;
      t.scoringPhase = "completed";
      t.status = "completed";

      const res = await request(app)
        .post("/auth/admin/tournaments/2/scoring/set-phase")
        .set("x-is-master", "true")
        .send({ phase: "active", reason: "Re-opening badminton matches for finals playoff" });

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
        .send({ phase: "completed", reason: "Audit logging test for scoring phase change" });

      expect(res.status).toBe(200);
      expect(auditLogsList.length).toBe(1);
      const log = auditLogsList[0];
      expect(log.action).toBe("tournament.scoring_phase_changed");
      expect(log.category).toBe("tournament");
      expect(log.severity).toBe("critical");
      expect(log.before.scoringPhase).toBe("active");
      expect(log.after.scoringPhase).toBe("completed");
      expect(log.reason).toBe("Audit logging test for scoring phase change");
    });
  });

  describe("POST /auth/admin/tournaments/:id/verify-and-grant-license", () => {
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
        .post("/auth/admin/tournaments/2/verify-and-grant-license")
        .send({ requestId: 101, paymentAmount: 4999 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Not authorised");
    });

    it("verifies payment and grants live license for scoring-only tournament", async () => {
      const res = await request(app)
        .post("/auth/admin/tournaments/2/verify-and-grant-license")
        .set("x-is-master", "true")
        .send({
          requestId: 101,
          paymentAmount: 4999,
          paymentMode: "upi",
          paymentRef: "UPI/VERIFIED/7890",
          notes: "Payment verified via HDFC statement",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const t = tournaments.get(2)!;
      expect(t.licenseStatus).toBe("active");

      const reqRow = licenseRequests.get(101)!;
      expect(reqRow.status).toBe("granted");
      expect(reqRow.paymentVerified).toBe(true);
      expect(reqRow.paymentRef).toBe("UPI/VERIFIED/7890");
    });
  });
});
