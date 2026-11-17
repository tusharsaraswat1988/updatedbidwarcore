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

vi.mock("../lib/player-auction-history-service", () => ({
  getPlayerAuctionPerformanceSummary: vi.fn().mockImplementation(async ({ playerId }: any) => {
    if (playerId === 6021) {
      return {
        records: [
          {
            tournamentId: 602,
            tournamentName: "Canary Licensed Championship",
            teamName: "Canary Titans",
            soldPrice: 500000,
            status: "sold",
          },
        ],
        totalSoldAppearances: 1,
        bestSoldRecord: null,
        lastSoldRecord: null,
        hasTop5Badge: false,
        isBestTop5: false,
      };
    }
    return null;
  }),
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
          const allPlayers = Object.values(mockPlayers).flat();
          if (numbers.length >= 2) {
            const p = allPlayers.find((player) => numbers.includes(player.id) && numbers.includes(player.tournamentId));
            return resolve(p ? [p] : []);
          }
          const tid = numbers.find((n) => n in mockTournaments) ?? targetId;
          return resolve(tid && mockPlayers[tid] ? [...mockPlayers[tid]] : []);
        }

        // Auction events or matches
        if (fromTable === actual.auctionEventsTable || fromTable === actual.matchesTable) {
          return resolve([]);
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
    const tournamentsRouter = (await import("../routes/tournaments")).default;
    const fanBroadcastRouter = (await import("../routes/fan-broadcast")).default;

    app.use("/api", fanDiscoveryRouter);
    app.use("/api", teamsRouter);
    app.use("/api", playersRouter);
    app.use("/api", tournamentsRouter);
    app.use("/api", fanBroadcastRouter);
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

    it("guarantees unlicensed player list error payload does not expose canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/601/players");
      expect(res.status).toBe(403);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/601/players (Unlicensed Error 403)");
    });

    it("guarantees unlicensed single player endpoint error does not expose canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/601/players/6011");
      expect(res.status).toBe(403);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/601/players/6011 (Unlicensed Error 403)");
    });

    it("guarantees licensed single player profile does not expose phone/email/UTR or canary secrets", async () => {
      const res = await request(app).get("/api/tournaments/602/players/6021");
      expect(res.status).toBe(200);
      assertZeroCanaryLeakage(res.body, "GET /api/tournaments/602/players/6021 (Licensed Profile)");
      expect(res.body.mobileNumber).toBeUndefined();
      expect(res.body.email).toBeUndefined();
      expect(res.body.utrNumber).toBeUndefined();
    });

    it("guarantees player auction-history endpoints do not expose canary secrets", async () => {
      const unlicRes = await request(app).get("/api/tournaments/601/players/6011/auction-history");
      expect(unlicRes.status).toBe(403);
      assertZeroCanaryLeakage(unlicRes.body, "GET /api/tournaments/601/players/6011/auction-history (Unlicensed)");

      const licRes = await request(app).get("/api/tournaments/602/players/6021/auction-history");
      expect(licRes.status).toBe(200);
      assertZeroCanaryLeakage(licRes.body, "GET /api/tournaments/602/players/6021/auction-history (Licensed)");
    });

    it("guarantees direct tournament details GET /tournaments/:id do not leak pins, passwords or canary secrets", async () => {
      const res601 = await request(app).get("/api/tournaments/601");
      expect(res601.status).toBe(200);
      assertZeroCanaryLeakage(res601.body, "GET /api/tournaments/601 (Direct Details Unlicensed)");
      expect(res601.body.scoringPin).toBeUndefined();
      expect(res601.body.organizerPassword).toBeUndefined();
      expect(res601.body.organizerMobile).toBeUndefined();

      const res602 = await request(app).get("/api/tournaments/602");
      expect(res602.status).toBe(200);
      assertZeroCanaryLeakage(res602.body, "GET /api/tournaments/602 (Direct Details Licensed)");
      expect(res602.body.scoringPin).toBeUndefined();
      expect(res602.body.organizerPassword).toBeUndefined();
      expect(res602.body.organizerMobile).toBeUndefined();
    });

    it("guarantees dedicated pure spectator teams endpoint /fan/teams has zero canary leakage", async () => {
      const res601 = await request(app).get("/api/tournaments/601/fan/teams");
      expect(res601.status).toBe(200);
      assertZeroCanaryLeakage(res601.body, "GET /api/tournaments/601/fan/teams (Unlicensed)");

      const res602 = await request(app).get("/api/tournaments/602/fan/teams");
      expect(res602.status).toBe(200);
      assertZeroCanaryLeakage(res602.body, "GET /api/tournaments/602/fan/teams (Licensed)");
    });

    it("guarantees spectator scope query ?scope=spectator has zero canary leakage", async () => {
      const res601 = await request(app).get("/api/tournaments/601/teams?scope=spectator");
      expect(res601.status).toBe(200);
      assertZeroCanaryLeakage(res601.body, "GET /api/tournaments/601/teams?scope=spectator (Unlicensed)");

      const res602 = await request(app).get("/api/tournaments/602/teams?scope=spectator");
      expect(res602.status).toBe(200);
      assertZeroCanaryLeakage(res602.body, "GET /api/tournaments/602/teams?scope=spectator (Licensed)");
    });

    it("guarantees organizer broadcast endpoint denies public spectators with HTTP 403 and zero canary leakage", async () => {
      const res601 = await request(app).get("/api/tournaments/601/broadcast");
      expect(res601.status).toBe(403);
      assertZeroCanaryLeakage(res601.body, "GET /api/tournaments/601/broadcast (Spectator Denial 403)");

      const res602 = await request(app).get("/api/tournaments/602/broadcast");
      expect(res602.status).toBe(403);
      assertZeroCanaryLeakage(res602.body, "GET /api/tournaments/602/broadcast (Spectator Denial 403)");
    });

    it("guarantees 404 and error responses across endpoints have zero canary leakage", async () => {
      const notFoundRes = await request(app).get("/api/tournaments/999999/fan/context");
      expect(notFoundRes.status).toBe(404);
      assertZeroCanaryLeakage(notFoundRes.body, "GET 404 Context Error Response");
    });

    it("guarantees HTML metadata strings and serialized OpenGraph data have zero canary leakage", async () => {
      // Simulate HTML metadata tags rendered from tournament context
      const contextRes = await request(app).get("/api/tournaments/601/fan/context");
      const tournament = contextRes.body.tournament;

      const htmlMeta = `
        <title>${tournament.name} | BidWar Fan Arena</title>
        <meta name="description" content="Follow ${tournament.name} live on BidWar Fan Arena. City: ${tournament.city}, Venue: ${tournament.venue}">
        <meta property="og:title" content="${tournament.name}">
        <meta property="og:description" content="${tournament.name} live updates on BidWar">
      `;
      assertZeroCanaryLeakage(htmlMeta, "HTML Metadata / OpenGraph Tags");
    });
  });
});
