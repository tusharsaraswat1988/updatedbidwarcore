import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { isTournamentLicensed } from "@workspace/platform-core/tournament-features";

// Mock Data Fixtures
let mockTournaments: Record<number, any> = {};
let mockTeams: Record<number, any[]> = {};
let mockPlayers: Record<number, any[]> = {};
let mockAuditLogs: any[] = [];
let mockCallerRole: "anonymous" | "organizer_10" | "admin" = "anonymous";
let mockPinHeader: string | undefined = undefined;

function resetFixtures() {
  mockTournaments = {
    // 101: Newly created tournament, default public, trial license, no opt-in
    101: {
      id: 101,
      name: "Automatic Discovery Cup",
      sport: "cricket",
      city: "Jaipur",
      venue: "SMS Stadium",
      organizerId: 10,
      organizerName: "Host 10",
      organizerMobile: "919876543210",
      organizerEmail: "host10@example.com",
      scoringPin: "5566",
      auctionEnabled: true,
      scoringEnabled: true,
      status: "setup",
      licenseStatus: "trial", // Unlicensed!
      adminLocked: false,
      featuresJson: {}, // defaults to public, no opt-in
      createdAt: new Date(),
    },
    // 102: Licensed tournament (Level 2)
    102: {
      id: 102,
      name: "Premier Champions League",
      sport: "cricket",
      city: "Mumbai",
      venue: "Wankhede",
      organizerId: 10,
      organizerName: "Host 10",
      organizerMobile: "919876543210",
      organizerEmail: "host10@example.com",
      scoringPin: "7788",
      auctionEnabled: true,
      scoringEnabled: true,
      status: "active",
      licenseStatus: "active", // Licensed!
      adminLocked: false,
      featuresJson: { visibility: "public" },
      createdAt: new Date(),
    },
    // 103: Private tournament (admin controlled)
    103: {
      id: 103,
      name: "Secret Invitational",
      sport: "badminton",
      city: "Bangalore",
      venue: "Club House",
      organizerId: 10,
      scoringPin: "9900",
      auctionEnabled: true,
      scoringEnabled: false,
      status: "setup",
      licenseStatus: "active",
      adminLocked: false,
      featuresJson: { visibility: "private" },
      createdAt: new Date(),
    },
    // 104: Completed tournament
    104: {
      id: 104,
      name: "Historic Winter Championship",
      sport: "cricket",
      city: "Delhi",
      organizerId: 10,
      auctionEnabled: true,
      scoringEnabled: true,
      status: "completed",
      licenseStatus: "completed",
      licenseGrantedAt: new Date(Date.now() - 86400000 * 30),
      adminLocked: false,
      featuresJson: { visibility: "public" },
      createdAt: new Date(Date.now() - 86400000 * 60),
    },
  };

  mockTeams = {
    101: [
      {
        id: 1,
        tournamentId: 101,
        name: "Warriors XI",
        shortCode: "WAR",
        purse: 10000000,
        purseUsed: 0,
        ownerName: "Secret Owner",
        ownerMobile: "919988776655",
        ownerEmail: "owner@warriors.com",
        accessCode: "SECRET_CODE_1",
        color: "#e11d48",
      },
      {
        id: 2,
        tournamentId: 101,
        name: "Royal Strikers",
        shortCode: "RS",
        purse: 10000000,
        purseUsed: 0,
        ownerName: "Secret Owner 2",
        ownerMobile: "919988776644",
        ownerEmail: "owner@strikers.com",
        accessCode: "SECRET_CODE_2",
        color: "#2563eb",
      },
    ],
    102: [
      {
        id: 3,
        tournamentId: 102,
        name: "Mumbai Titans",
        shortCode: "MT",
        purse: 10000000,
        purseUsed: 5000000,
        ownerName: "Titan Owner",
        accessCode: "TITAN_CODE",
        color: "#059669",
      },
    ],
  };

  mockPlayers = {
    101: [
      { id: 11, tournamentId: 101, teamId: 1, name: "Player Alpha", role: "batsman", mobileNumber: "919111111111", createdAt: new Date() },
      { id: 12, tournamentId: 101, teamId: 1, name: "Player Beta", role: "bowler", mobileNumber: "919222222222", createdAt: new Date() },
      { id: 13, tournamentId: 101, teamId: 2, name: "Player Gamma", role: "allrounder", mobileNumber: "919333333333", createdAt: new Date() },
    ],
    102: [
      { id: 21, tournamentId: 102, teamId: 3, name: "Pro Player One", role: "batsman", createdAt: new Date() },
    ],
  };

  mockAuditLogs = [];
  mockCallerRole = "anonymous";
  mockPinHeader = undefined;
}

function extractAllNumbers(node: any): number[] {
  const nums: number[] = [];
  function walk(n: any) {
    if (n === null || n === undefined) return;
    if (typeof n === "number" && !isNaN(n)) {
      nums.push(n);
      return;
    }
    if (typeof n.value === "number" && !isNaN(n.value)) {
      nums.push(n.value);
    }
    if (typeof n.right === "number" && !isNaN(n.right)) {
      nums.push(n.right);
    } else if (n.right && typeof n.right === "object") {
      walk(n.right);
    }
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
    }
    if (Array.isArray(n.queryChunks)) {
      for (const chunk of n.queryChunks) walk(chunk);
    }
    if (Array.isArray(n.params)) {
      for (const p of n.params) walk(p);
    }
  }
  walk(node);
  return nums;
}

function extractIdFromCondition(cond: any): number | undefined {
  const nums = extractAllNumbers(cond);
  return nums.length > 0 ? nums[0] : undefined;
}

function makeMockQueryArray<T>(items: T[]): T[] & {
  orderBy: () => any;
  limit: () => any;
  groupBy: () => any;
  then: (resolve: (data: T[]) => any) => Promise<any>;
} {
  const arr = [...items] as any;
  arr.orderBy = () => arr;
  arr.limit = () => arr;
  arr.groupBy = () => arr;
  arr.then = (resolve: any) => Promise.resolve(resolve(arr));
  return arr;
}

vi.mock("../lib/scoring-realtime-bus", () => ({
  ensureListenerConnected: vi.fn(),
  subscribeRealtimeBus: vi.fn(),
  broadcastEvent: vi.fn(),
}));

vi.mock("../lib/player-specification-service", () => ({
  playerSpecificationService: {
    getSpecificationsForPlayers: vi.fn().mockResolvedValue(new Map()),
    getPlayerSpecifications: vi.fn().mockResolvedValue([]),
  },
  legacyFieldsFromSpecifications: () => ({}),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createPgClient: () => ({ on: vi.fn(), query: vi.fn(), end: vi.fn() }),
    db: {
      select: (fields?: any) => {
        let fromTable: any = null;
        let whereCond: any = null;
        const chain: any = {
          from: (tbl: any) => {
            fromTable = tbl;
            return chain;
          },
          where: (cond: any) => {
            whereCond = cond;
            return chain;
          },
          orderBy: () => chain,
          groupBy: () => chain,
          limit: () => chain,
          then: (resolve: any) => {
            const numbers = extractAllNumbers(whereCond);
            const targetId = numbers.find((n) => n in mockTournaments) ?? (numbers.length > 0 ? numbers[0] : undefined);

            // Grouped count on playersTable (teamId, count)
            if (fields && typeof fields === "object" && "teamId" in fields && "count" in fields) {
              const tid = targetId;
              const groups: Record<number, number> = {};
              if (tid && mockPlayers[tid]) {
                for (const p of mockPlayers[tid]) {
                  if (p.teamId != null) {
                    groups[p.teamId] = (groups[p.teamId] || 0) + 1;
                  }
                }
              }
              return resolve(
                Object.entries(groups).map(([teamId, count]) => ({
                  teamId: Number(teamId),
                  count,
                })),
              );
            }

            // Single team count query on playersTable
            if (fields && typeof fields === "object" && "count" in fields) {
              const tid = targetId;
              const teamId = numbers[1];
              let count = 0;
              if (tid && mockPlayers[tid]) {
                if (teamId !== undefined) {
                  count = mockPlayers[tid].filter((p) => p.teamId === teamId).length;
                } else {
                  count = mockPlayers[tid].length;
                }
              }
              return resolve([{ count }]);
            }

            // Teams table query
            if (fromTable === actual.teamsTable) {
              if (numbers.length >= 2) {
                const tid = numbers[0];
                const teamId = numbers[1];
                const team = mockTeams[tid]?.find((t) => t.id === teamId);
                return resolve(team ? [team] : []);
              }
              const tid = targetId;
              return resolve(tid && mockTeams[tid] ? [...mockTeams[tid]] : []);
            }

            // Players table query
            if (fromTable === actual.playersTable) {
              const tid = targetId;
              if (numbers.length >= 2) {
                const playerId = numbers[1];
                const player = mockPlayers[tid]?.find((p) => p.id === playerId);
                return resolve(player ? [player] : []);
              }
              return resolve(tid && mockPlayers[tid] ? [...mockPlayers[tid]] : []);
            }

            // Tournaments table query
            if (fromTable === actual.tournamentsTable) {
              if (targetId && mockTournaments[targetId]) {
                return resolve([mockTournaments[targetId]]);
              }
              if (targetId) {
                return resolve([]);
              }
              return resolve(Object.values(mockTournaments));
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
            if (tbl === actual.tournamentsTable && tid !== undefined && mockTournaments[tid]) {
              Object.assign(mockTournaments[tid], updateValues);
            }
            return chain;
          },
          returning: () => {
            const tid = extractIdFromCondition(whereFilter);
            const res = tbl === actual.tournamentsTable && tid !== undefined && mockTournaments[tid]
              ? [mockTournaments[tid]]
              : [];
            return Promise.resolve(res);
          },
          then: (resolve: any) => {
            const tid = extractIdFromCondition(whereFilter);
            const res = tbl === actual.tournamentsTable && tid !== undefined && mockTournaments[tid]
              ? [mockTournaments[tid]]
              : [];
            return resolve(res);
          },
        };
        return chain;
      },
      delete: (tbl: any) => {
        let whereFilter: any = null;
        const chain: any = {
          where: (cond: any) => {
            whereFilter = cond;
            return chain;
          },
          returning: () => {
            const tid = extractIdFromCondition(whereFilter);
            if (tbl === actual.tournamentsTable && tid !== undefined && mockTournaments[tid]) {
              const deleted = mockTournaments[tid];
              delete mockTournaments[tid];
              return Promise.resolve([deleted]);
            }
            return Promise.resolve([]);
          },
          then: (resolve: any) => {
            const tid = extractIdFromCondition(whereFilter);
            if (tbl === actual.tournamentsTable && tid !== undefined && mockTournaments[tid]) {
              const deleted = mockTournaments[tid];
              delete mockTournaments[tid];
              return resolve([deleted]);
            }
            return resolve([]);
          },
        };
        return chain;
      },
    },
  };
});

vi.mock("../middleware/require-organizer", () => {
  return {
    isAccountOrAdmin: (req: any) => mockCallerRole === "admin" || mockCallerRole === "organizer_10",
    canAccessPrivateTournamentData: async (req: any, tournamentId: number) => {
      if (mockCallerRole === "admin") return true;
      if (mockCallerRole === "organizer_10" && tournamentId === 101) return true;
      if (mockCallerRole === "organizer_10" && tournamentId === 102) return true;
      return false;
    },
    requireTournamentOrganizer: async (req: any, res: any, tournamentId: number) => {
      if (mockCallerRole === "admin") return true;
      if (mockCallerRole === "organizer_10" && (tournamentId === 101 || tournamentId === 102)) return true;
      res.status(403).json({ error: "Access denied" });
      return false;
    },
  };
});

vi.mock("../middleware/require-admin.js", () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (mockCallerRole !== "admin") {
      res.status(401).json({ error: "Not authorised" });
      return;
    }
    next();
  },
  isAnyAdmin: (req: any) => mockCallerRole === "admin",
  isMasterAdmin: (req: any) => mockCallerRole === "admin",
}));

vi.mock("../lib/audit-service", () => ({
  auditLog: (req: any, event: any) => {
    mockAuditLogs.push(event);
  },
}));

vi.mock("../lib/admin-delete-tournament", () => ({
  adminDeleteTournamentCascade: async (tid: number) => {
    if (mockTournaments[tid]) {
      delete mockTournaments[tid];
      delete mockTeams[tid];
      delete mockPlayers[tid];
      return true;
    }
    return false;
  },
}));

describe("Fan Arena — Automatic Discovery, Licence Entitlements & Security", () => {
  let app: express.Express;

  beforeEach(async () => {
    resetFixtures();

    app = express();
    app.use(express.json());

    // Inject caller role & pin header middleware
    app.use((req: any, res, next) => {
      if (mockCallerRole === "admin") {
        req.jwtUser = { isAdmin: true, adminLevel: "master", id: 999 };
      } else if (mockCallerRole === "organizer_10") {
        req.jwtUser = { organizerAccountId: 10, organizer: { "101": true, "102": true } };
      }
      if (mockPinHeader) {
        req.headers["x-bidwar-pin"] = mockPinHeader;
      }
      next();
    });

    const fanDiscoveryRouter = (await import("../routes/fan-discovery")).default;
    const teamsRouter = (await import("../routes/teams")).default;
    const playersRouter = (await import("../routes/players")).default;
    const tournamentsRouter = (await import("../routes/tournaments")).default;
    const authRouter = (await import("../routes/auth")).default;
    const fanBroadcastRouter = (await import("../routes/fan-broadcast")).default;

    app.use("/api", fanDiscoveryRouter);
    app.use("/api", teamsRouter);
    app.use("/api", playersRouter);
    app.use("/api", tournamentsRouter);
    app.use("/api", authRouter);
    app.use("/api", fanBroadcastRouter);
  });

  describe("1. Automatic Tournament Discovery (No Opt-in, No License Requirement)", () => {
    it("automatically includes newly created unlicensed tournament without organizer opt-in", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=50");
      expect(res.status).toBe(200);
      const ids = res.body.items.map((t: any) => t.id);
      expect(ids).toContain(101); // Newly created unlicensed tournament is automatically discoverable!
      expect(ids).toContain(102); // Licensed tournament is discoverable!
    });

    it("excludes private tournaments from public discovery feed", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=50");
      expect(res.status).toBe(200);
      const ids = res.body.items.map((t: any) => t.id);
      expect(ids).not.toContain(103); // Private tournament is excluded
    });

    it("keeps completed tournaments permanently discoverable with status=completed", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=50");
      expect(res.status).toBe(200);
      const item104 = res.body.items.find((t: any) => t.id === 104);
      expect(item104).toBeDefined();
      expect(item104.status).toBe("completed");
    });
  });

  describe("2. Level 1 — Unlicensed Spectator Experience", () => {
    it("returns limited spectator tournament context with isLicensed: false", async () => {
      const res = await request(app).get("/api/tournaments/101/fan/context");
      expect(res.status).toBe(200);
      expect(res.body.isLicensed).toBe(false);
      expect(res.body.tournament.isLicensed).toBe(false);
      expect(res.body.tournament.name).toBe("Automatic Discovery Cup");
      expect(res.body.tournament.sport).toBe("cricket");
      expect(res.body.tournament.city).toBe("Jaipur");

      // Zero leakage of private fields
      expect(res.body.tournament.scoringPin).toBeUndefined();
      expect(res.body.tournament.organizerMobile).toBeUndefined();
      expect(res.body.tournament.organizerEmail).toBeUndefined();
      expect(res.body.tournament.broadcast).toBeNull();
    });

    it("presents team cards with team name and total player count only", async () => {
      const res = await request(app).get("/api/tournaments/101/teams");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const team1 = res.body[0];
      expect(team1.name).toBe("Warriors XI");
      expect(team1.shortCode).toBe("WAR");
      expect(team1.playerCount).toBe(2); // 2 players registered

      // Strictly NO purse, owner contact, access codes, or auction details
      expect(team1.purse).toBeUndefined();
      expect(team1.purseUsed).toBeUndefined();
      expect(team1.ownerName).toBeUndefined();
      expect(team1.ownerMobile).toBeUndefined();
      expect(team1.ownerEmail).toBeUndefined();
      expect(team1.accessCode).toBeUndefined();
    });

    it("blocks public spectator access to individual player profiles with HTTP 403 UNLICENSED_TOURNAMENT", async () => {
      const resList = await request(app).get("/api/tournaments/101/players");
      expect(resList.status).toBe(403);
      expect(resList.body.code).toBe("UNLICENSED_TOURNAMENT");

      const resSingle = await request(app).get("/api/tournaments/101/players/11");
      expect(resSingle.status).toBe(403);
      expect(resSingle.body.code).toBe("UNLICENSED_TOURNAMENT");
    });
  });

  describe("3. Level 2 — Licensed Spectator Experience", () => {
    it("returns full spectator tournament context with isLicensed: true", async () => {
      const res = await request(app).get("/api/tournaments/102/fan/context");
      expect(res.status).toBe(200);
      expect(res.body.isLicensed).toBe(true);
      expect(res.body.tournament.isLicensed).toBe(true);
      expect(res.body.tournament.name).toBe("Premier Champions League");
    });

    it("allows spectator access to player list for licensed tournament", async () => {
      const res = await request(app).get("/api/tournaments/102/players");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("4. Dynamic Licence Transition & Organiser Exemption", () => {
    it("immediately restricts spectator access when tournament license changes from active to trial", async () => {
      // 102 is currently active
      expect(isTournamentLicensed(mockTournaments[102])).toBe(true);

      // Simulate admin downgrading or suspending license
      mockTournaments[102].licenseStatus = "trial";
      expect(isTournamentLicensed(mockTournaments[102])).toBe(false);

      const res = await request(app).get("/api/tournaments/102/players");
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("UNLICENSED_TOURNAMENT");
    });

    it("allows authenticated tournament organizer to view their own player pool even if unlicensed", async () => {
      mockCallerRole = "organizer_10"; // Logged in as host of 101
      const res = await request(app).get("/api/tournaments/101/players");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);
    });
  });

  describe("5. Super Admin-Only Visibility Governance", () => {
    it("strictly blocks tournament organizer from altering visibility (HTTP 403 FORBIDDEN_VISIBILITY_CHANGE)", async () => {
      mockCallerRole = "organizer_10";
      const res = await request(app)
        .patch("/api/tournaments/101")
        .send({ visibility: "private" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN_VISIBILITY_CHANGE");
    });

    it("strictly blocks tournament organizer from toggling Fan Arena listing (HTTP 403 FORBIDDEN_FAN_ARENA_OPT_IN)", async () => {
      mockCallerRole = "organizer_10";
      const res = await request(app)
        .put("/api/tournaments/101/fan-arena")
        .send({ optIn: false });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN_FAN_ARENA_OPT_IN");
    });

    it("allows Super Admin to make a tournament private with mandatory audit reason", async () => {
      mockCallerRole = "admin";
      const res = await request(app)
        .post("/api/auth/admin/tournaments/101/visibility")
        .send({
          visibility: "private",
          reason: "Confidential corporate tournament requested by federation",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.visibility).toBe("private");
      expect(mockTournaments[101].featuresJson.visibility).toBe("private");

      // Verify audit trail
      const log = mockAuditLogs.find((l) => l.action === "tournament.visibility_changed");
      expect(log).toBeDefined();
      expect(log.tournamentId).toBe(101);
      expect(log.reason).toBe("Confidential corporate tournament requested by federation");

      // Now excluded from public discovery
      mockCallerRole = "anonymous";
      const discoveryRes = await request(app).get("/api/fan/tournaments?limit=50");
      const ids = discoveryRes.body.items.map((t: any) => t.id);
      expect(ids).not.toContain(101);
    });

    it("allows Super Admin to restore a private tournament to public", async () => {
      mockCallerRole = "admin";
      const res = await request(app)
        .post("/api/auth/admin/tournaments/103/visibility")
        .send({
          visibility: "public",
          reason: "Public spectator rights cleared by organizer",
        });

      expect(res.status).toBe(200);
      expect(res.body.visibility).toBe("public");
      expect(mockTournaments[103].featuresJson.visibility).toBe("public");

      // Now appears on /fan discovery
      mockCallerRole = "anonymous";
      const discoveryRes = await request(app).get("/api/fan/tournaments?limit=50");
      const ids = discoveryRes.body.items.map((t: any) => t.id);
      expect(ids).toContain(103);
    });

    it("allows Super Admin to permanently delete tournament via admin route and cascades out of Fan Arena", async () => {
      mockCallerRole = "admin";
      const res = await request(app).delete("/api/auth/admin/tournaments/101");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify discovery does not contain 101
      mockCallerRole = "anonymous";
      const discoveryRes = await request(app).get("/api/fan/tournaments?limit=50");
      const ids = discoveryRes.body.items.map((t: any) => t.id);
      expect(ids).not.toContain(101);

      // Detail context returns 404
      const contextRes = await request(app).get("/api/tournaments/101/fan/context");
      expect(contextRes.status).toBe(404);
    });

    it("enforces Super Admin-only deletion on DELETE /tournaments/:tournamentId (401 unauth, 403 organizer, 204 admin)", async () => {
      // 1. Unauthenticated caller -> HTTP 401
      mockCallerRole = "anonymous";
      const unauthRes = await request(app).delete("/api/tournaments/102");
      expect(unauthRes.status).toBe(401);

      // 2. Authenticated organizer -> HTTP 403
      mockCallerRole = "organizer_10";
      const orgRes = await request(app).delete("/api/tournaments/102");
      expect(orgRes.status).toBe(403);
      expect(orgRes.body.error).toContain("Only Super Admin can delete tournaments");

      // Verify tournament 102 still exists in discovery
      mockCallerRole = "anonymous";
      const discoveryBefore = await request(app).get("/api/fan/tournaments?limit=50");
      expect(discoveryBefore.body.items.map((t: any) => t.id)).toContain(102);

      // 3. Super Admin -> HTTP 204
      mockCallerRole = "admin";
      const adminRes = await request(app).delete("/api/tournaments/102");
      expect(adminRes.status).toBe(204);

      // 4. Verify tournament 102 disappeared from discovery, context and direct public APIs
      mockCallerRole = "anonymous";
      const discoveryAfter = await request(app).get("/api/fan/tournaments?limit=50");
      expect(discoveryAfter.body.items.map((t: any) => t.id)).not.toContain(102);

      const contextAfter = await request(app).get("/api/tournaments/102/fan/context");
      expect(contextAfter.status).toBe(404);

      const detailAfter = await request(app).get("/api/tournaments/102");
      expect(detailAfter.status).toBe(404);
    });

    it("verifies licence suspension and restoration transitions with discovery persistence and Level 1/2 switching", async () => {
      // 102 is active (licensed Level 2)
      mockCallerRole = "anonymous";
      const initialDiscovery = await request(app).get("/api/fan/tournaments?limit=50");
      expect(initialDiscovery.body.items.map((t: any) => t.id)).toContain(102);

      const initialContext = await request(app).get("/api/tournaments/102/fan/context");
      expect(initialContext.body.isLicensed).toBe(true);

      const initialPlayers = await request(app).get("/api/tournaments/102/players");
      expect(initialPlayers.status).toBe(200);

      // Suspend licence
      mockTournaments[102].licenseStatus = "suspended";

      // Discovery: remains discoverable!
      const suspendedDiscovery = await request(app).get("/api/fan/tournaments?limit=50");
      expect(suspendedDiscovery.body.items.map((t: any) => t.id)).toContain(102);

      // Context: downgrades to Level 1
      const suspendedContext = await request(app).get("/api/tournaments/102/fan/context");
      expect(suspendedContext.body.isLicensed).toBe(false);

      // Players: restricted with HTTP 403 UNLICENSED_TOURNAMENT
      const suspendedPlayers = await request(app).get("/api/tournaments/102/players");
      expect(suspendedPlayers.status).toBe(403);
      expect(suspendedPlayers.body.code).toBe("UNLICENSED_TOURNAMENT");

      // Restore licence
      mockTournaments[102].licenseStatus = "active";

      // Context: upgraded back to Level 2
      const restoredContext = await request(app).get("/api/tournaments/102/fan/context");
      expect(restoredContext.body.isLicensed).toBe(true);

      // Players: re-allowed
      const restoredPlayers = await request(app).get("/api/tournaments/102/players");
      expect(restoredPlayers.status).toBe(200);
    });
  });
});
