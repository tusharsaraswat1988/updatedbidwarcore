import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  secureComparePins,
  checkPinRateLimit,
  recordPinAttempt,
  resetPinRateLimit,
} from "../lib/pin-security";

// Mock data fixtures
const mockTournaments: Record<number, any> = {
  101: {
    id: 101,
    name: "Public BidWar Championship",
    sport: "cricket",
    city: "Mumbai",
    venue: "Wankhede Stadium",
    organizerName: "Admin User",
    organizerMobile: "919999999999",
    organizerEmail: "admin@bidwar.com",
    scoringPin: "1111",
    exportToken: "exp_pub_secret",
    upiId: "pub@upi",
    auctionEnabled: true,
    scoringEnabled: true,
    status: "active",
    adminLocked: false,
    featuresJson: { visibility: "public" },
    createdAt: new Date(),
  },
  202: {
    id: 202,
    name: "Confidential Corporate Cup",
    sport: "badminton",
    city: "Bangalore",
    venue: "Indiranagar Club",
    organizerName: "Org Secret",
    organizerMobile: "918888888888",
    organizerEmail: "secret@corp.com",
    scoringPin: "7788",
    exportToken: "exp_priv_secret",
    upiId: "secret@upi",
    auctionEnabled: true,
    scoringEnabled: false,
    status: "setup",
    adminLocked: false,
    featuresJson: { visibility: "private" },
    createdAt: new Date(),
  },
  203: {
    id: 203,
    name: "VIP Invitational",
    sport: "cricket",
    city: "Delhi",
    venue: "Private Grounds",
    organizerName: "VIP Host",
    organizerMobile: "917777777777",
    organizerEmail: "vip@host.com",
    scoringPin: "9999",
    exportToken: "exp_vip_secret",
    upiId: "vip@upi",
    auctionEnabled: false,
    scoringEnabled: true,
    status: "setup",
    adminLocked: false,
    featuresJson: { visibility: "private" },
    createdAt: new Date(),
  },
  303: {
    id: 303,
    name: "Unlisted Practice Matches",
    sport: "football",
    city: "Goa",
    venue: "Fatorda",
    organizerName: "Coach Dave",
    organizerMobile: "916666666666",
    organizerEmail: "dave@goa.com",
    scoringPin: "3333",
    exportToken: "exp_unlist_secret",
    upiId: "dave@upi",
    auctionEnabled: true,
    scoringEnabled: false,
    status: "setup",
    adminLocked: false,
    featuresJson: { visibility: "unlisted" },
    createdAt: new Date(),
  },
};

function makeMockQueryArray<T>(items: T[]): T[] & {
  orderBy: () => any;
  limit: () => any;
  groupBy: () => any;
} {
  const arr = [...items] as any;
  arr.orderBy = () => arr;
  arr.limit = () => arr;
  arr.groupBy = () => arr;
  return arr;
}

// Mock Database and Organizer Middleware
vi.mock("@workspace/db", () => {
  return {
    db: {
      select: () => ({
        from: (table: any) => {
          return {
            where: (expr: any) => {
              // Extract tournament ID if querying a single tournament
              const targetId = expr?.queryChunks?.find((chunk: any) => typeof chunk === "number");
              if (targetId && mockTournaments[targetId]) {
                const row = mockTournaments[targetId];
                return makeMockQueryArray([row]);
              } else if (targetId) {
                return makeMockQueryArray([]);
              }
              // List query for tournaments: return public tournament
              return makeMockQueryArray([mockTournaments[101]]);
            },
            groupBy: () => makeMockQueryArray([]),
            orderBy: () => makeMockQueryArray([mockTournaments[101]]),
          };
        },
      }),
    },
    tournamentsTable: {
      id: "id",
      name: "name",
      sport: "sport",
      city: "city",
      venue: "venue",
      organizerName: "organizerName",
      adminLocked: "adminLocked",
      auctionEnabled: "auctionEnabled",
      scoringEnabled: "scoringEnabled",
      featuresJson: "featuresJson",
      createdAt: "createdAt",
    },
    teamsTable: {
      tournamentId: "tournamentId",
    },
    scoringMatchesTable: {
      id: "id",
      tournamentId: "tournamentId",
      status: "status",
      homeTeamId: "homeTeamId",
      awayTeamId: "awayTeamId",
      roundName: "roundName",
    },
  };
});

vi.mock("../middleware/require-organizer", () => ({
  // Spectator Fan requests are unauthenticated
  canAccessPrivateTournamentData: vi.fn(async () => false),
}));

import fanDiscoveryRouter from "../routes/fan-discovery";

describe("Phase 4 Security Hardening & Privacy Specification", () => {
  let app: express.Express;

  beforeEach(() => {
    resetPinRateLimit();
    app = express();
    app.use(express.json());
    app.use("/api", fanDiscoveryRouter);
  });

  describe("1. Constant-Time PIN Validation & Timing-Attack Prevention", () => {
    it("safely and correctly validates matching PINs", () => {
      expect(secureComparePins("1234", "1234")).toBe(true);
      expect(secureComparePins(" 9876 ", "9876")).toBe(true);
      expect(secureComparePins("0000", "0000")).toBe(true);
    });

    it("rejects non-matching PINs", () => {
      expect(secureComparePins("1234", "4321")).toBe(false);
      expect(secureComparePins("1235", "1234")).toBe(false);
      expect(secureComparePins("123", "1234")).toBe(false);
    });

    it("handles null, undefined, or empty inputs safely without throwing", () => {
      expect(secureComparePins(null, "1234")).toBe(false);
      expect(secureComparePins("1234", null)).toBe(false);
      expect(secureComparePins(undefined, "1234")).toBe(false);
      expect(secureComparePins("", "")).toBe(false);
      expect(secureComparePins("  ", "1234")).toBe(false);
    });
  });

  describe("2. PIN Brute-Force Rate Limiting & Lockout Defense", () => {
    const testIp = "192.168.1.100";
    const testTournamentId = 9999;

    it("allows up to 4 failed PIN attempts without lockout", () => {
      for (let i = 1; i <= 4; i++) {
        expect(checkPinRateLimit(testIp, testTournamentId).allowed).toBe(true);
        const result = recordPinAttempt(testIp, testTournamentId, false);
        expect(result.lockedOut).toBe(false);
      }
    });

    it("triggers a 10-minute lockout on the 5th consecutive failure", () => {
      for (let i = 1; i <= 4; i++) {
        recordPinAttempt(testIp, testTournamentId, false);
      }

      // 5th failure triggers lockout
      const fifthAttempt = recordPinAttempt(testIp, testTournamentId, false);
      expect(fifthAttempt.lockedOut).toBe(true);
      expect(fifthAttempt.retryAfterSeconds).toBeGreaterThan(500);

      // Subsequent checks blocked
      const rateCheck = checkPinRateLimit(testIp, testTournamentId);
      expect(rateCheck.allowed).toBe(false);
      expect(rateCheck.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("clears failed attempts upon a successful PIN attempt", () => {
      for (let i = 1; i <= 3; i++) {
        recordPinAttempt(testIp, testTournamentId, false);
      }

      const successResult = recordPinAttempt(testIp, testTournamentId, true);
      expect(successResult.lockedOut).toBe(false);

      const rateCheck = checkPinRateLimit(testIp, testTournamentId);
      expect(rateCheck.allowed).toBe(true);
    });

    it("enforces rate limits per (IP + tournamentId) independently", () => {
      const otherTournamentId = 8888;
      for (let i = 1; i <= 5; i++) {
        recordPinAttempt(testIp, testTournamentId, false);
      }

      expect(checkPinRateLimit(testIp, testTournamentId).allowed).toBe(false);
      expect(checkPinRateLimit(testIp, otherTournamentId).allowed).toBe(true);
    });
  });

  describe("3. Private Tournament Context Access & Cross-Tournament Misuse", () => {
    const targetTournamentId = 202; // Private tournament with PIN "7788"

    it("denies unauthenticated direct access to private tournament with 403 Forbidden", async () => {
      const res = await request(app).get(`/api/tournaments/${targetTournamentId}/fan/context`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRIVATE_TOURNAMENT");
    });

    it("denies access with invalid PIN with 403 Forbidden", async () => {
      const res = await request(app)
        .get(`/api/tournaments/${targetTournamentId}/fan/context`)
        .set("x-bidwar-pin", "0000");
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRIVATE_TOURNAMENT");
    });

    it("prevents cross-tournament PIN misuse (valid PIN for Tourn 203 cannot open Tourn 202)", async () => {
      const res = await request(app)
        .get(`/api/tournaments/${targetTournamentId}/fan/context`)
        .set("x-bidwar-pin", "9999"); // 9999 belongs to tournament 203, not 202
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PRIVATE_TOURNAMENT");
    });

    it("unlocks private tournament context with valid PIN via x-bidwar-pin header", async () => {
      const res = await request(app)
        .get(`/api/tournaments/${targetTournamentId}/fan/context`)
        .set("x-bidwar-pin", "7788");
      expect(res.status).toBe(200);
      expect(res.body.tournament.id).toBe(targetTournamentId);

      // Sensitive fields must never be exposed even after unlocking
      expect(res.body.tournament).not.toHaveProperty("organizerMobile");
      expect(res.body.tournament).not.toHaveProperty("organizerEmail");
      expect(res.body.tournament).not.toHaveProperty("scoringPin");
      expect(res.body.tournament).not.toHaveProperty("exportToken");
      expect(res.body.tournament).not.toHaveProperty("upiId");
    });

    it("sets private, no-store Cache-Control headers on private tournament responses", async () => {
      const res = await request(app)
        .get(`/api/tournaments/${targetTournamentId}/fan/context`)
        .set("x-bidwar-pin", "7788");
      expect(res.status).toBe(200);
      const cacheControl = res.headers["cache-control"];
      expect(cacheControl).toContain("private");
      expect(cacheControl).toContain("no-store");
      expect(res.headers["pragma"]).toBe("no-cache");
    });

    it("sets private, no-store Cache-Control headers on unlisted tournament responses", async () => {
      const res = await request(app).get(`/api/tournaments/303/fan/context`);
      expect(res.status).toBe(200);
      const cacheControl = res.headers["cache-control"];
      expect(cacheControl).toContain("private");
      expect(cacheControl).toContain("no-store");
    });

    it("sets public Cache-Control headers on public tournament responses", async () => {
      const res = await request(app).get(`/api/tournaments/101/fan/context`);
      expect(res.status).toBe(200);
      const cacheControl = res.headers["cache-control"];
      expect(cacheControl).toContain("public");
    });

    it("enforces HTTP 429 when brute-forcing PINs on the endpoint", async () => {
      // 5 invalid attempts
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .get(`/api/tournaments/${targetTournamentId}/fan/context`)
          .set("x-bidwar-pin", `111${i}`);
      }

      // The 6th attempt must be rejected with 429 Too Many Requests
      const blockedRes = await request(app)
        .get(`/api/tournaments/${targetTournamentId}/fan/context`)
        .set("x-bidwar-pin", "7788"); // Even correct PIN is locked out
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(blockedRes.headers).toHaveProperty("retry-after");
    });

    it("guarantees rate-limit lockout does not block a different tournament", async () => {
      // Lock out tournament 202
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .get(`/api/tournaments/${targetTournamentId}/fan/context`)
          .set("x-bidwar-pin", `111${i}`);
      }

      // Tournament 202 is locked out
      const res202 = await request(app)
        .get(`/api/tournaments/${targetTournamentId}/fan/context`)
        .set("x-bidwar-pin", "7788");
      expect(res202.status).toBe(429);

      // Tournament 203 remains accessible with its own PIN
      const res203 = await request(app)
        .get(`/api/tournaments/203/fan/context`)
        .set("x-bidwar-pin", "9999");
      expect(res203.status).toBe(200);
      expect(res203.body.tournament.id).toBe(203);
    });

    it("returns 404 for guessed tournament IDs that do not exist", async () => {
      const res = await request(app).get("/api/tournaments/9999999/fan/context");
      expect(res.status).toBe(404);
    });
  });

  describe("4. Discovery API Privacy & Leakage Audits", () => {
    it("guarantees discovery response returns public tournament without leaking PII or credentials", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=10");
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();

      for (const item of res.body.items) {
        expect(item).not.toHaveProperty("organizerMobile");
        expect(item).not.toHaveProperty("organizerEmail");
        expect(item).not.toHaveProperty("scoringPin");
        expect(item).not.toHaveProperty("exportToken");
        expect(item).not.toHaveProperty("upiId");
      }
    });
  });
});
