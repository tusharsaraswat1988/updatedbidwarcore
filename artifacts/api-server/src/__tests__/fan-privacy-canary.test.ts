import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const CANARY_MARKERS = [
  "TEST_SECRET_PIN_123",
  "PRIVATE_EMAIL_TEST",
  "PRIVATE_MOBILE_TEST",
  "PRIVATE_UPI_TEST",
  "CANARY_PASSWORD_HASH_999",
  "CANARY_ACCESS_CODE_XYZ",
  "CANARY_PLAYER_MOBILE_5544",
  "CANARY_PLAYER_EMAIL",
  "CANARY_UTR_SECRET",
];

function assertZeroCanaryLeakage(payload: unknown, context: string) {
  const jsonStr = JSON.stringify(payload);
  for (const marker of CANARY_MARKERS) {
    if (jsonStr.includes(marker)) {
      throw new Error(
        `CRITICAL PRIVACY VIOLATION: Canary secret "${marker}" leaked in ${context}!\nPayload: ${jsonStr}`,
      );
    }
  }
}

// Mock Data Fixtures
let mockTournaments: Record<number, any> = {};
let mockTeams: Record<number, any[]> = {};
let mockPlayers: Record<number, any[]> = {};

function resetFixtures() {
  mockTournaments = {
    // 601: Unlicensed tournament with injected canary secrets
    601: {
      id: 601,
      name: "Canary Unlicensed Cup",
      sport: "cricket",
      city: "Jaipur",
      venue: "SMS Stadium",
      organizerName: "Canary Host",
      organizerMobile: "PRIVATE_MOBILE_TEST_9988776655",
      organizerEmail: "PRIVATE_EMAIL_TEST@bidwar.internal",
      organizerPassword: "CANARY_PASSWORD_HASH_999",
      scoringPin: "TEST_SECRET_PIN_123",
      upiId: "PRIVATE_UPI_TEST@okaxis",
      auctionEnabled: true,
      scoringEnabled: true,
      status: "setup",
      licenseStatus: "trial",
      adminLocked: false,
      featuresJson: { visibility: "public" },
      createdAt: new Date(),
    },
    // 602: Licensed tournament with injected canary secrets
    602: {
      id: 602,
      name: "Canary Licensed Championship",
      sport: "cricket",
      city: "Mumbai",
      venue: "Wankhede",
      organizerName: "Canary Host",
      organizerMobile: "PRIVATE_MOBILE_TEST_9988776655",
      organizerEmail: "PRIVATE_EMAIL_TEST@bidwar.internal",
      organizerPassword: "CANARY_PASSWORD_HASH_999",
      scoringPin: "TEST_SECRET_PIN_123",
      upiId: "PRIVATE_UPI_TEST@okaxis",
      auctionEnabled: true,
      scoringEnabled: true,
      status: "active",
      licenseStatus: "active",
      adminLocked: false,
      featuresJson: { visibility: "public" },
      createdAt: new Date(),
    },
  };

  mockTeams = {
    601: [
      {
        id: 61,
        tournamentId: 601,
        name: "Canary Warriors XI",
        shortCode: "CW",
        purse: 10000000,
        purseUsed: 0,
        ownerName: "Private Owner",
        ownerMobile: "PRIVATE_MOBILE_TEST_9988776655",
        ownerEmail: "PRIVATE_EMAIL_TEST@bidwar.internal",
        accessCode: "CANARY_ACCESS_CODE_XYZ",
        color: "#e11d48",
        createdAt: new Date(),
      },
    ],
    602: [
      {
        id: 62,
        tournamentId: 602,
        name: "Canary Titans",
        shortCode: "CT",
        purse: 10000000,
        purseUsed: 2000000,
        ownerName: "Private Owner",
        ownerMobile: "PRIVATE_MOBILE_TEST_9988776655",
        ownerEmail: "PRIVATE_EMAIL_TEST@bidwar.internal",
        accessCode: "CANARY_ACCESS_CODE_XYZ",
        color: "#059669",
        createdAt: new Date(),
      },
    ],
  };

  mockPlayers = {
    601: [
      {
        id: 6011,
        tournamentId: 601,
        teamId: 61,
        name: "Canary Player Alpha",
        role: "batsman",
        mobileNumber: "CANARY_PLAYER_MOBILE_5544",
        email: "CANARY_PLAYER_EMAIL@private.com",
        utrNumber: "CANARY_UTR_SECRET",
        createdAt: new Date(),
      },
    ],
    602: [
      {
        id: 6021,
        tournamentId: 602,
        teamId: 62,
        name: "Canary Player Beta",
        role: "allrounder",
        mobileNumber: "CANARY_PLAYER_MOBILE_5544",
        email: "CANARY_PLAYER_EMAIL@private.com",
        utrNumber: "CANARY_UTR_SECRET",
        createdAt: new Date(),
      },
    ],
  };
}

function extractAllNumbers(node: any): number[] {
  const nums: number[] = [];
  function walk(n: any) {
    if (n === null || n === undefined) return;
    if (typeof n === "number") {
      nums.push(n);
      return;
    }
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (typeof n === "object") {
      if (typeof n.value === "number") nums.push(n.value);
      if (typeof n.right === "number") nums.push(n.right);
      if (Array.isArray(n.queryChunks)) {
        for (const chunk of n.queryChunks) walk(chunk);
      }
    }
  }
  walk(node);
  return nums;
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

  const createSelectChain = (fields?: any) => {
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
        const targetId = numbers.length > 0 ? numbers[0] : undefined;

        // Distinct cities query for /fan/cities
        if (fields && typeof fields === "object" && "city" in fields) {
          const cities = Object.values(mockTournaments)
            .map((t) => ({ city: t.city }))
            .filter((c) => Boolean(c.city));
          return resolve(cities);
        }

        // Grouped count on playersTable
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
          const count = tid && mockPlayers[tid] ? mockPlayers[tid].length : 0;
          return resolve([{ count }]);
        }

        // Teams table query
        if (fromTable === actual.teamsTable) {
          if (numbers.length >= 2) {
            const allTeams = Object.values(mockTeams).flat();
            const team = allTeams.find((t) => numbers.includes(t.id) && numbers.includes(t.tournamentId));
            return resolve(team ? [team] : []);
          }
          const tid = targetId;
          return resolve(tid && mockTeams[tid] ? [...mockTeams[tid]] : []);
        }

        // Players table query
        if (fromTable === actual.playersTable) {
          const tid = targetId;
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
  };

  return {
    ...actual,
    createPgClient: () => ({ on: vi.fn(), query: vi.fn(), end: vi.fn() }),
    db: {
      select: createSelectChain,
      selectDistinct: createSelectChain,
    },
  };
});

vi.mock("../middleware/require-organizer", () => {
  return {
    isAccountOrAdmin: () => false,
    canAccessPrivateTournamentData: async () => false,
    requireTournamentOrganizer: async (req: any, res: any) => {
      res.status(403).json({ error: "Access denied" });
      return false;
    },
  };
});

vi.mock("../middleware/require-admin.js", () => ({
  requireAdmin: (req: any, res: any) => {
    res.status(401).json({ error: "Not authorised" });
  },
  isAnyAdmin: () => false,
  isMasterAdmin: () => false,
}));

describe("Fan Arena — Automated P0 Privacy Regression & Canary Secrets Test", () => {
  let app: express.Express;

  beforeEach(async () => {
    resetFixtures();

    app = express();
    app.use(express.json());

    const fanDiscoveryRouter = (await import("../routes/fan-discovery")).default;
    const teamsRouter = (await import("../routes/teams")).default;
    const playersRouter = (await import("../routes/players")).default;

    app.use("/api", fanDiscoveryRouter);
    app.use("/api", teamsRouter);
    app.use("/api", playersRouter);
  });

  describe("Zero Canary Leakage Across All Public Surfaces", () => {
    it("guarantees discovery feed does not expose any canary secret", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=50");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/fan/tournaments");
    });

    it("guarantees cities list does not expose any canary secret", async () => {
      const res = await request(app).get("/api/fan/cities");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/fan/cities");
    });

    it("guarantees unlicensed tournament context does not expose any canary secret", async () => {
      const res = await request(app).get("/api/tournaments/601/fan/context");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/601/fan/context (Unlicensed)");
    });

    it("guarantees licensed tournament context does not expose any canary secret", async () => {
      const res = await request(app).get("/api/tournaments/602/fan/context");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/602/fan/context (Licensed)");
    });

    it("guarantees unlicensed team list does not expose owner PII or canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/601/teams");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/601/teams (Unlicensed)");
    });

    it("guarantees unlicensed single team endpoint does not expose canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/601/teams/61");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/601/teams/61 (Unlicensed)");
    });

    it("guarantees licensed team list does not expose owner PII or canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/602/teams");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/602/teams (Licensed)");
    });

    it("guarantees licensed single team endpoint does not expose canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/602/teams/62");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/602/teams/62 (Licensed)");
    });

    it("guarantees licensed player list does not expose phone/email or canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/602/players");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/602/players (Licensed)");
    });
  });
});
