import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveFanPageCapabilities,
  isTournamentLicensed,
  isTournamentTrial,
} from "@workspace/platform-core";
import express from "express";
import request from "supertest";

let mockTournaments: any[] = [];
let mockScoringMatches: any[] = [];
let mockAuctionSessions: any[] = [];
let mockTeams: any[] = [];
let mockPlayers: any[] = [];

// Helper to inspect drizzle conditions
function filterMockTournaments(cond: any, data: any[]): any[] {
  if (!cond) return data;
  const str = JSON.stringify(cond);

  // If filtering for trial license:
  if (str.includes('"trial"')) {
    let result = data.filter((t) => t.licenseStatus === "trial" && t.status !== "archived");
    // Check if organizerId is in condition
    const orgMatch = str.match(/organizerId.*?(\d+)/);
    if (orgMatch) {
      const orgId = parseInt(orgMatch[1], 10);
      result = result.filter((t) => t.organizerId === orgId);
    }
    return result;
  }

  // If filtering for active license:
  if (str.includes('"active"')) {
    return data.filter(
      (t) =>
        t.licenseStatus === "active" &&
        !t.adminLocked &&
        t.status !== "archived" &&
        !/\[test\]|\[dev\]|\[demo\]/i.test(t.name)
    );
  }

  return data;
}

function filterMockAuctions(cond: any, data: any[]): any[] {
  if (!cond) return data;
  const str = JSON.stringify(cond);
  return data.filter((a) => new RegExp(`\\b${a.tournamentId}\\b`).test(str));
}

function filterMockScoringMatches(cond: any, data: any[]): any[] {
  if (!cond) return data;
  const str = JSON.stringify(cond);
  return data.filter((m) => {
    if (str.includes('"completed"') && m.status !== "completed") return false;
    if ((str.includes('"live"') || str.includes('"in_progress"')) && !["live", "in_progress"].includes(m.status)) return false;
    return new RegExp(`\\b${m.tournamentId}\\b`).test(str);
  });
}

const createTableMock = (name: string) => {
  return new Proxy(
    { _tableName: name },
    {
      get: (target, prop) => {
        if (prop in target) return (target as any)[prop];
        if (typeof prop === "string") {
          return { name: prop, table: name };
        }
        return prop;
      },
    }
  );
};

const tournamentsTableMock = createTableMock("tournamentsTable");
const scoringMatchesTableMock = createTableMock("scoringMatchesTable");
const auctionSessionsTableMock = createTableMock("auctionSessionsTable");
const teamsTableMock = createTableMock("teamsTable");
const playersTableMock = createTableMock("playersTable");

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => {
          const tableName = typeof table === "string" ? table : table?._tableName;
          const makeChain = (filteredData: any[]) => ({
            where: vi.fn((cond: any) => {
              if (tableName === "tournamentsTable") {
                return makeChain(filterMockTournaments(cond, filteredData));
              }
              if (tableName === "auctionSessionsTable") {
                return makeChain(filterMockAuctions(cond, filteredData));
              }
              if (tableName === "scoringMatchesTable") {
                return makeChain(filterMockScoringMatches(cond, filteredData));
              }
              return makeChain(filteredData);
            }),
            orderBy: vi.fn((_order: any) => makeChain(filteredData)),
            limit: vi.fn((lim: number) => Promise.resolve(filteredData.slice(0, lim))),
            then: (resolve: any) => resolve(filteredData),
          });

          if (tableName === "tournamentsTable") return makeChain(mockTournaments);
          if (tableName === "scoringMatchesTable") return makeChain(mockScoringMatches);
          if (tableName === "auctionSessionsTable") return makeChain(mockAuctionSessions);
          if (tableName === "teamsTable") return makeChain(mockTeams);
          if (tableName === "playersTable") return makeChain(mockPlayers);
          return makeChain([]);
        }),
      })),
    },
    tournamentsTable: tournamentsTableMock,
    scoringMatchesTable: scoringMatchesTableMock,
    auctionSessionsTable: auctionSessionsTableMock,
    teamsTable: teamsTableMock,
    playersTable: playersTableMock,
  };
});

describe("Phase 1 — Tournament Eligibility & Data Separation", () => {
  describe("1. Canonical Public Capability & Eligibility (resolveFanPageCapabilities)", () => {
    it("identifies actively licensed tournaments correctly", () => {
      expect(isTournamentLicensed({ licenseStatus: "active" })).toBe(true);
      expect(isTournamentLicensed({ licenseStatus: "trial" })).toBe(false);
      expect(isTournamentLicensed({ licenseStatus: "expired" })).toBe(false);
      expect(isTournamentLicensed({ licenseStatus: "suspended" })).toBe(false);
      expect(isTournamentLicensed({ licenseStatus: null })).toBe(false);
      expect(isTournamentLicensed(undefined)).toBe(false);
      expect(isTournamentLicensed({ licenseStatus: "unknown" })).toBe(false);
    });

    it("identifies trial tournaments strictly via isTournamentTrial", () => {
      expect(isTournamentTrial({ licenseStatus: "trial" })).toBe(true);
      expect(isTournamentTrial({ licenseStatus: "active" })).toBe(false);
      expect(isTournamentTrial({ licenseStatus: "expired" })).toBe(false);
      expect(isTournamentTrial({ licenseStatus: "suspended" })).toBe(false);
      expect(isTournamentTrial({ licenseStatus: null })).toBe(false);
      expect(isTournamentTrial(undefined)).toBe(false);
      expect(isTournamentTrial({ licenseStatus: "unknown" })).toBe(false);
    });

    it("GRANTS public visibility ONLY when licenseStatus is 'active'", async () => {
      const activeTournament = {
        id: 1,
        name: "Premier Cricket Cup",
        licenseStatus: "active",
        adminLocked: false,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: false,
        featuresJson: { visibility: "public" },
      };
      const res = await resolveFanPageCapabilities(activeTournament);
      expect(res.isLicensed).toBe(true);
      expect(res.isTrial).toBe(false);
      expect(res.isPubliclyVisible).toBe(true);
    });

    it("DENIES public visibility to trial tournaments even if modules are enabled", async () => {
      const trialTournament = {
        id: 2,
        name: "Sandbox Cricket Cup",
        licenseStatus: "trial",
        adminLocked: false,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: true,
        featuresJson: { visibility: "public" },
      };
      const res = await resolveFanPageCapabilities(trialTournament);
      expect(res.isLicensed).toBe(false);
      expect(res.isTrial).toBe(true);
      expect(res.isPubliclyVisible).toBe(false);
    });

    it("DENIES public visibility to expired and suspended tournaments without misclassifying them as trial", async () => {
      const expiredTournament = {
        id: 3,
        name: "Expired League",
        licenseStatus: "expired",
        adminLocked: false,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: true,
        featuresJson: { visibility: "public" },
      };
      const expRes = await resolveFanPageCapabilities(expiredTournament);
      expect(expRes.isLicensed).toBe(false);
      expect(expRes.isTrial).toBe(false);
      expect(expRes.isPubliclyVisible).toBe(false);

      const suspendedTournament = {
        id: 4,
        name: "Suspended League",
        licenseStatus: "suspended",
        adminLocked: false,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: true,
        featuresJson: { visibility: "public" },
      };
      const susRes = await resolveFanPageCapabilities(suspendedTournament);
      expect(susRes.isLicensed).toBe(false);
      expect(susRes.isTrial).toBe(false);
      expect(susRes.isPubliclyVisible).toBe(false);
    });

    it("DENIES public visibility when adminLocked is true", async () => {
      const lockedTournament = {
        id: 3,
        name: "Locked League",
        licenseStatus: "active",
        adminLocked: true,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: false,
        featuresJson: { visibility: "public" },
      };
      const res = await resolveFanPageCapabilities(lockedTournament);
      expect(res.isPubliclyVisible).toBe(false);
    });

    it("DENIES public visibility when status is archived", async () => {
      const archivedTournament = {
        id: 4,
        name: "Old Tournament",
        licenseStatus: "active",
        adminLocked: false,
        status: "archived",
        auctionEnabled: true,
        scoringEnabled: false,
        featuresJson: { visibility: "public" },
      };
      const res = await resolveFanPageCapabilities(archivedTournament);
      expect(res.isPubliclyVisible).toBe(false);
    });

    it("DENIES public visibility when visibility is private in featuresJson", async () => {
      const privateTournament = {
        id: 5,
        name: "Internal Corporate Tournament",
        licenseStatus: "active",
        adminLocked: false,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: false,
        featuresJson: { visibility: "private" },
      };
      const res = await resolveFanPageCapabilities(privateTournament);
      expect(res.isPubliclyVisible).toBe(false);
    });

    it("DENIES public visibility when neither auction nor scoring is enabled", async () => {
      const emptyTournament = {
        id: 6,
        name: "No Module Tournament",
        licenseStatus: "active",
        adminLocked: false,
        status: "active",
        auctionEnabled: false,
        scoringEnabled: false,
        featuresJson: { visibility: "public" },
      };
      const res = await resolveFanPageCapabilities(emptyTournament);
      expect(res.isPubliclyVisible).toBe(false);
    });

    it("DENIES featured status for trial tournaments even when featuredEnabled is true", async () => {
      const trialHero = {
        id: 7,
        name: "Trial Hero Attempt",
        licenseStatus: "trial",
        adminLocked: false,
        status: "active",
        auctionEnabled: true,
        scoringEnabled: false,
        featuresJson: { featuredEnabled: true, featuredPriority: 10, visibility: "public" },
      };
      const res = await resolveFanPageCapabilities(trialHero);
      expect(res.isPubliclyVisible).toBe(false);
      expect(res.featured.isFeatured).toBe(false);
    });
  });

  describe("2. Module Entitlement Derivation", () => {
    it("correctly identifies auction_only, scoring_only, and both capabilities", async () => {
      const auctionOnly = await resolveFanPageCapabilities({
        id: 11,
        name: "Auction Only",
        licenseStatus: "active",
        status: "active",
        auctionEnabled: true,
        scoringEnabled: false,
      });
      expect(auctionOnly.activeModules).toEqual(["auction"]);
      expect(auctionOnly.capabilities).toEqual(["auction"]);

      const scoringOnly = await resolveFanPageCapabilities({
        id: 12,
        name: "Scoring Only",
        licenseStatus: "active",
        status: "active",
        auctionEnabled: false,
        scoringEnabled: true,
      });
      expect(scoringOnly.activeModules).toEqual(["scoring"]);
      expect(scoringOnly.capabilities).toContain("scoring");
      expect(scoringOnly.capabilities).toContain("fixtures");

      const bothModules = await resolveFanPageCapabilities({
        id: 13,
        name: "Both Modules",
        licenseStatus: "active",
        status: "active",
        auctionEnabled: true,
        scoringEnabled: true,
      });
      expect(bothModules.activeModules).toEqual(["auction", "scoring"]);
      expect(bothModules.capabilities).toContain("auction");
      expect(bothModules.capabilities).toContain("scoring");
    });
  });

  describe("3. Fan Discovery HTTP Routing, Module Filtering & Isolation", () => {
    let app: express.Express;

    beforeEach(async () => {
      app = express();
      app.use(express.json());

      // Setup clean mock database rows
      mockTournaments = [
        // 1. Licensed active auction tournament
        {
          id: 101,
          name: "Licensed Auction Trophy",
          sport: "cricket",
          status: "active",
          licenseStatus: "active",
          adminLocked: false,
          auctionEnabled: true,
          scoringEnabled: false,
          auctionCode: "LAT101",
          city: "Mumbai",
          venue: "Wankhede",
          organizerId: 10,
          featuresJson: { visibility: "public" },
        },
        // 2. Licensed active scoring tournament
        {
          id: 102,
          name: "Licensed Scoring Open",
          sport: "badminton",
          status: "active",
          licenseStatus: "active",
          adminLocked: false,
          auctionEnabled: false,
          scoringEnabled: true,
          auctionCode: "LSO102",
          city: "Delhi",
          venue: "KD Jadhav",
          organizerId: 20,
          featuresJson: { visibility: "public" },
        },
        // 3. Licensed active tournament with BOTH modules
        {
          id: 103,
          name: "Licensed Super League (Both)",
          sport: "cricket",
          status: "active",
          licenseStatus: "active",
          adminLocked: false,
          auctionEnabled: true,
          scoringEnabled: true,
          auctionCode: "LSL103",
          city: "Bangalore",
          venue: "Chinnaswamy",
          organizerId: 10,
          featuresJson: { visibility: "public", featuredEnabled: true, featuredPriority: 10 },
        },
        // 4. TRIAL tournament (organizerId: 10)
        {
          id: 201,
          name: "Organizer 10 Trial Tournament",
          sport: "cricket",
          status: "setup",
          licenseStatus: "trial",
          adminLocked: false,
          auctionEnabled: true,
          scoringEnabled: false,
          auctionCode: "OTT201",
          city: "Pune",
          venue: "MCA Stadium",
          organizerId: 10,
          featuresJson: { visibility: "public", featuredEnabled: true }, // should NOT be public or featured
        },
        // 5. TRIAL tournament (organizerId: 30)
        {
          id: 202,
          name: "Organizer 30 Trial Tournament",
          sport: "badminton",
          status: "setup",
          licenseStatus: "trial",
          adminLocked: false,
          auctionEnabled: false,
          scoringEnabled: true,
          auctionCode: "OTT202",
          city: "Hyderabad",
          venue: "Gachibowli",
          organizerId: 30,
          featuresJson: { visibility: "public" },
        },
        // 6. EXPIRED license tournament (organizerId: 10)
        {
          id: 203,
          name: "Organizer 10 Expired League",
          sport: "cricket",
          status: "setup",
          licenseStatus: "expired",
          adminLocked: false,
          auctionEnabled: true,
          scoringEnabled: false,
          auctionCode: "OEL203",
          city: "Chennai",
          venue: "Chepauk",
          organizerId: 10,
          featuresJson: { visibility: "public" },
        },
        // 7. SUSPENDED license tournament (organizerId: 10)
        {
          id: 204,
          name: "Organizer 10 Suspended Trophy",
          sport: "cricket",
          status: "setup",
          licenseStatus: "suspended",
          adminLocked: false,
          auctionEnabled: true,
          scoringEnabled: false,
          auctionCode: "OST204",
          city: "Kolkata",
          venue: "Eden Gardens",
          organizerId: 10,
          featuresJson: { visibility: "public" },
        },
        // 8. PRIVATE licensed tournament (organizerId: 10)
        {
          id: 205,
          name: "Organizer 10 Private Championship",
          sport: "cricket",
          status: "active",
          licenseStatus: "active",
          adminLocked: false,
          auctionEnabled: true,
          scoringEnabled: true,
          auctionCode: "OPC205",
          city: "Jaipur",
          venue: "SMS Stadium",
          organizerId: 10,
          featuresJson: { visibility: "private" },
        },
        // 9. ADMIN LOCKED licensed tournament (organizerId: 10)
        {
          id: 206,
          name: "Organizer 10 Admin Locked Tournament",
          sport: "cricket",
          status: "active",
          licenseStatus: "active",
          adminLocked: true,
          auctionEnabled: true,
          scoringEnabled: true,
          auctionCode: "OAL206",
          city: "Ahmedabad",
          venue: "Narendra Modi Stadium",
          organizerId: 10,
          featuresJson: { visibility: "public" },
        },
      ];

      mockScoringMatches = [];
      mockAuctionSessions = [];
      mockTeams = [];
      mockPlayers = [];

      // Mock auth middleware for testing
      app.use((req: any, _res, next) => {
        if (req.headers["x-test-organizer-id"]) {
          req.jwtUser = {
            organizerAccountId: parseInt(req.headers["x-test-organizer-id"], 10),
          };
        } else if (req.headers["x-test-admin"]) {
          req.jwtUser = { isAdmin: true };
        } else {
          req.jwtUser = {};
        }
        next();
      });

      const fanDiscoveryRouter = (await import("../routes/fan-discovery")).default;
      app.use("/api", fanDiscoveryRouter);
    });

    it("GET /api/fan/tournaments excludes trial tournaments from public listings", async () => {
      const res = await request(app).get("/api/fan/tournaments");
      expect(res.status).toBe(200);

      const items = res.body.items;
      const ids = items.map((t: any) => t.id);

      // Must include licensed tournaments
      expect(ids).toContain(101);
      expect(ids).toContain(102);
      expect(ids).toContain(103);

      // Must EXCLUDE trial tournaments
      expect(ids).not.toContain(201);
      expect(ids).not.toContain(202);

      // Summary total must only count licensed public tournaments
      expect(res.body.summary.total).toBe(3);
    });

    it("GET /api/fan/tournaments filters properly by module=auction", async () => {
      const res = await request(app).get("/api/fan/tournaments?module=auction");
      expect(res.status).toBe(200);

      const items = res.body.items;
      const ids = items.map((t: any) => t.id);

      // Tournaments with auction enabled
      expect(ids).toContain(101);
      expect(ids).toContain(103);

      // Scoring-only tournament must be excluded
      expect(ids).not.toContain(102);

      // Trial tournaments must remain excluded
      expect(ids).not.toContain(201);
    });

    it("GET /api/fan/tournaments filters properly by module=scoring", async () => {
      const res = await request(app).get("/api/fan/tournaments?module=scoring");
      expect(res.status).toBe(200);

      const items = res.body.items;
      const ids = items.map((t: any) => t.id);

      // Tournaments with scoring enabled
      expect(ids).toContain(102);
      expect(ids).toContain(103);

      // Auction-only tournament must be excluded
      expect(ids).not.toContain(101);
    });

    it("GET /api/fan/tournaments filters properly by module=both", async () => {
      const res = await request(app).get("/api/fan/tournaments?module=both");
      expect(res.status).toBe(200);

      const items = res.body.items;
      const ids = items.map((t: any) => t.id);

      // Only tournament 103 has both
      expect(ids).toEqual([103]);
    });

    it("GET /api/fan/tournaments provides module counts in summary", async () => {
      const res = await request(app).get("/api/fan/tournaments");
      expect(res.status).toBe(200);
      expect(res.body.summary.modules).toEqual({
        all: 3,
        auction: 2, // 101, 103
        scoring: 2, // 102, 103
        both: 1,    // 103
      });
    });

    it("GET /api/fan/tournaments filters properly by module=auction_only", async () => {
      const res = await request(app).get("/api/fan/tournaments?module=auction_only");
      expect(res.status).toBe(200);

      const items = res.body.items;
      const ids = items.map((t: any) => t.id);

      // Only tournament 101 is auction-only (103 has both)
      expect(ids).toEqual([101]);
    });

    it("GET /api/fan/tournaments filters properly by module=scoring_only", async () => {
      const res = await request(app).get("/api/fan/tournaments?module=scoring_only");
      expect(res.status).toBe(200);

      const items = res.body.items;
      const ids = items.map((t: any) => t.id);

      // Only tournament 102 is scoring-only (103 has both)
      expect(ids).toEqual([102]);
    });

    it("GET /api/fan/tournaments handles invalid module parameter safely by returning 0 items", async () => {
      const res = await request(app).get("/api/fan/tournaments?module=unknown_module");
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });

    it("GET /api/fan/tournaments excludes expired, suspended, locked, and private tournaments", async () => {
      const res = await request(app).get("/api/fan/tournaments");
      expect(res.status).toBe(200);

      const ids = res.body.items.map((t: any) => t.id);
      expect(ids).not.toContain(203); // expired
      expect(ids).not.toContain(204); // suspended
      expect(ids).not.toContain(205); // private
      expect(ids).not.toContain(206); // admin locked
    });

    it("GET /api/fan/trial-tournaments returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/fan/trial-tournaments");
      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Authentication required");
    });

    it("GET /api/fan/trial-tournaments returns only caller's own trial tournaments and basic metadata", async () => {
      const res = await request(app)
        .get("/api/fan/trial-tournaments")
        .set("x-test-organizer-id", "10");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);

      const item = res.body.items[0];
      expect(item.id).toBe(201);
      expect(item.name).toBe("Organizer 10 Trial Tournament");
      expect(item.isTrial).toBe(true);
      expect(item.featured).toBe(false);

      // Ensure NO private data or player/bid fields leaked
      expect(item.players).toBeUndefined();
      expect(item.bids).toBeUndefined();
      expect(item.basePurse).toBeUndefined();
      expect(item.organizerMobile).toBeUndefined();
      expect(item.organizerEmail).toBeUndefined();
    });

    it("GET /api/fan/trial-tournaments excludes expired and suspended tournaments", async () => {
      const res = await request(app)
        .get("/api/fan/trial-tournaments")
        .set("x-test-organizer-id", "10");

      expect(res.status).toBe(200);
      const ids = res.body.items.map((t: any) => t.id);
      expect(ids).toContain(201);     // trial
      expect(ids).not.toContain(203); // expired must not be classified as trial
      expect(ids).not.toContain(204); // suspended must not be classified as trial
    });

    it("Organizer 10 cannot see Organizer 30's trial tournaments", async () => {
      const res = await request(app)
        .get("/api/fan/trial-tournaments")
        .set("x-test-organizer-id", "10");

      expect(res.status).toBe(200);
      const ids = res.body.items.map((t: any) => t.id);
      expect(ids).toContain(201);
      expect(ids).not.toContain(202);
    });

    it("Caller cannot obtain another organizer's trial data via query parameter tampering", async () => {
      const res = await request(app)
        .get("/api/fan/trial-tournaments?organizerId=30&organizerAccountId=30")
        .set("x-test-organizer-id", "10");

      expect(res.status).toBe(200);
      const ids = res.body.items.map((t: any) => t.id);
      expect(ids).toContain(201);
      expect(ids).not.toContain(202);
    });

    it("GET /api/fan/ticker excludes trial tournaments", async () => {
      // Mock an auction session for trial tournament 201
      mockAuctionSessions = [
        {
          id: 501,
          tournamentId: 201, // trial tournament
          status: "in_progress",
          updatedAt: new Date(),
          currentPlayerId: 999,
          currentBid: 500000,
        },
      ];

      const res = await request(app).get("/api/fan/ticker");
      expect(res.status).toBe(200);

      // The live auction from trial tournament 201 must NOT appear in the ticker events
      const tourneyIdsInTicker = res.body.events.map((e: any) => e.tournamentId);
      expect(tourneyIdsInTicker).not.toContain(201);
    });

    it("GET /api/fan/ticker excludes completed matches from non-public tournaments", async () => {
      // Mock completed match for trial tournament 201 and expired tournament 203
      mockScoringMatches = [
        {
          id: 601,
          tournamentId: 201, // trial
          matchLabel: "Trial Final",
          sportSlug: "cricket",
          status: "completed",
          summaryJson: { result: "Team A won" },
          updatedAt: new Date(),
        },
        {
          id: 602,
          tournamentId: 203, // expired
          matchLabel: "Expired Final",
          sportSlug: "cricket",
          status: "completed",
          summaryJson: { result: "Team B won" },
          updatedAt: new Date(),
        },
        {
          id: 603,
          tournamentId: 102, // licensed active public tournament
          matchLabel: "Badminton Quarter Final",
          sportSlug: "badminton",
          status: "completed",
          summaryJson: { result: "Player X won 21-19" },
          updatedAt: new Date(),
        },
      ];

      const res = await request(app).get("/api/fan/ticker");
      expect(res.status).toBe(200);

      const tourneyIdsInTicker = res.body.events.map((e: any) => e.tournamentId);
      expect(tourneyIdsInTicker).not.toContain(201);
      expect(tourneyIdsInTicker).not.toContain(203);
      expect(tourneyIdsInTicker).toContain(102);
    });

    it("GET /api/fan/ticker fallback announcements only emit licensed public tournaments", async () => {
      // Clear live sessions and matches to trigger fallback announcements
      mockAuctionSessions = [];
      mockScoringMatches = [];

      const res = await request(app).get("/api/fan/ticker");
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThan(0);

      // Verify every emitted event has a valid licensed public tournament ID
      for (const event of res.body.events) {
        expect([101, 102, 103]).toContain(event.tournamentId);
        expect([201, 202, 203, 204, 205, 206]).not.toContain(event.tournamentId);
      }
    });
  });
});
