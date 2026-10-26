import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock @workspace/db
const mockEditions: any[] = [];
const mockTournaments: any[] = [
  {
    id: 101,
    name: "BidWar Premier Championship 2026",
    sport: "cricket",
    venue: "Main Stadium",
    city: "Varanasi",
    status: "setup",
    auctionDate: "2026-10-10",
    auctionTime: "10:00",
    logoUrl: "https://bidwar.in/logo.png",
    auctionEnabled: true,
    scoringEnabled: true,
  },
];

const mockSponsors: any[] = [];
const mockTeams: any[] = [
  { id: 1, tournamentId: 101, name: "Varanasi Warriors", shortCode: "VW", color: "#f97316", logoUrl: "https://vw.png" },
  { id: 2, tournamentId: 101, name: "Kashi Knights", shortCode: "KK", color: "#3b82f6", logoUrl: "https://kk.png" },
];
const mockMatches: any[] = [
  {
    id: 1,
    tournamentId: 101,
    homeTeamId: 1,
    awayTeamId: 2,
    matchLabel: "Match 1",
    roundName: "Opening Match",
    status: "in_progress",
    venue: "Main Ground",
    scheduledAt: new Date("2026-10-10T10:00:00Z"),
    startedAt: new Date("2026-10-10T10:00:00Z"),
    completedAt: null,
    winnerTeamId: null,
    resultSummary: null,
    summaryJson: {
      innings: [
        { battingTeamId: 1, runs: 42, wickets: 1, overs: "5.2", phase: "in_progress" },
      ],
      target: null,
      currentInnings: 1,
      resultText: null,
    },
  },
];
const mockFixtures: any[] = [];
const mockSessions: any[] = [
  {
    matchId: 1,
    stateJson: {
      innings: [{ battingTeamId: 1, runs: 87, wickets: 2, over: 8, ball: 1, phase: "in_progress" }],
      target: 120,
      currentInnings: 2,
      resultText: null,
    },
  },
];
const mockStandings: any[] = [
  { id: 1, tournamentId: 101, teamId: 1, played: 1, won: 1, lost: 0, tied: 0, noResult: 0, points: 2, netRunRate: "1.25" },
];

let nextId = 1;

function makeChainableQuery(items: any[]) {
  const promise = Promise.resolve([...items]);
  const chain: any = promise;
  chain.limit = (lim: number) => Promise.resolve(items.slice(0, lim));
  chain.orderBy = (..._args: any[]) => {
    const orderPromise: any = Promise.resolve([...items]);
    orderPromise.limit = (lim: number) => Promise.resolve(items.slice(0, lim));
    return orderPromise;
  };
  return chain;
}

vi.mock("@workspace/db", () => {
  let currentTable: any = null;
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => {
          const tableName = table?.name;
          return {
            where: vi.fn((cond: any) => {
              if (tableName === "tournaments") {
                return makeChainableQuery(mockTournaments);
              }
              if (tableName === "teams") {
                return makeChainableQuery(mockTeams);
              }
              if (tableName === "scoring_matches") {
                return makeChainableQuery(mockMatches);
              }
              if (tableName === "scoring_standings") {
                return makeChainableQuery(mockStandings);
              }
              if (tableName === "scoring_fixtures") {
                return makeChainableQuery(mockFixtures);
              }
              if (tableName === "scoring_sessions") {
                return makeChainableQuery(mockSessions);
              }
              if (tableName === "bpl_edition_sponsors") {
                const condStr = JSON.stringify(cond) || String(cond);
                let list = [...mockSponsors];
                if (condStr.includes('"is_active"') || condStr.includes('true')) {
                  list = list.filter((s) => s.isActive !== false);
                }
                return makeChainableQuery(list);
              }

              // bpl_editions
              let filtered = [...mockEditions];
              const condStr = JSON.stringify(cond) || String(cond);
              if (condStr.includes('"LIVE"')) {
                filtered = filtered.filter((e) => e.status === "LIVE");
              } else if (condStr.includes('"UPCOMING"')) {
                filtered = filtered.filter((e) => e.status === "UPCOMING");
              } else if (condStr.includes('"COMPLETED"')) {
                filtered = filtered.filter((e) => e.status === "COMPLETED");
              }
              return makeChainableQuery(filtered);
            }),
            orderBy: vi.fn(() => {
              if (tableName === "bpl_edition_sponsors") return makeChainableQuery(mockSponsors);
              return makeChainableQuery(mockEditions);
            }),
            limit: vi.fn((lim: number) => {
              if (tableName === "tournaments") return Promise.resolve(mockTournaments.slice(0, lim));
              return Promise.resolve(mockEditions.slice(0, lim));
            }),
          };
        }),
      })),
      insert: vi.fn((table: any) => {
        currentTable = table;
        return {
          values: vi.fn((data: any) => ({
            returning: vi.fn(() => {
              const row = { id: nextId++, createdAt: new Date(), updatedAt: new Date(), ...data };
              if (currentTable?.name === "bpl_edition_sponsors") {
                mockSponsors.push(row);
              } else {
                mockEditions.push(row);
              }
              return Promise.resolve([row]);
            }),
          })),
        };
      }),
      update: vi.fn((table: any) => {
        currentTable = table;
        return {
          set: vi.fn((patch: any) => ({
            where: vi.fn(() => ({
              returning: vi.fn(() => {
                if (currentTable?.name === "bpl_edition_sponsors") {
                  if (mockSponsors.length > 0) {
                    Object.assign(mockSponsors[0], patch);
                    return Promise.resolve([mockSponsors[0]]);
                  }
                  return Promise.resolve([]);
                }
                if (mockEditions.length > 0) {
                  Object.assign(mockEditions[0], patch);
                  return Promise.resolve([mockEditions[0]]);
                }
                return Promise.resolve([]);
              }),
            })),
          })),
        };
      }),
      delete: vi.fn((table: any) => {
        currentTable = table;
        return {
          where: vi.fn(() => {
            if (currentTable?.name === "bpl_edition_sponsors") {
              mockSponsors.pop();
            } else {
              mockEditions.pop();
            }
            return Promise.resolve();
          }),
        };
      }),
    },
    bplEditionsTable: {
      name: "bpl_editions",
      id: "id",
      status: "status",
      editionNumber: "edition_number",
      slug: "slug",
      startDate: "start_date",
    },
    bplEditionSponsorsTable: {
      name: "bpl_edition_sponsors",
      id: "id",
      editionId: "edition_id",
      displayOrder: "display_order",
      isActive: "is_active",
    },
    tournamentsTable: {
      name: "tournaments",
      id: "id",
      nameCol: "name",
    },
    teamsTable: {
      name: "teams",
      id: "id",
      tournamentId: "tournament_id",
    },
    scoringMatchesTable: {
      name: "scoring_matches",
      id: "id",
      tournamentId: "tournament_id",
    },
    scoringStandingsTable: {
      name: "scoring_standings",
      id: "id",
      tournamentId: "tournament_id",
    },
    scoringFixturesTable: {
      name: "scoring_fixtures",
      id: "id",
      tournamentId: "tournament_id",
    },
    scoringSessionsTable: {
      name: "scoring_sessions",
      id: "id",
      matchId: "match_id",
    },
  };
});

vi.mock("../middleware/require-admin.js", () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.headers["x-test-admin"] === "true") {
      req.jwtUser = { isAdmin: true, adminLevel: "master" };
      return next();
    }
    return res.status(401).json({ error: "Not authorised" });
  },
}));

import bplRouter from "../routes/bpl";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers["x-test-admin"] === "true") {
      (req as any).jwtUser = { isAdmin: true };
    }
    next();
  });
  app.use("/api", bplRouter);
  return app;
}

describe("BPL Foundation API (P0)", () => {
  let app: express.Express;

  beforeEach(() => {
    mockEditions.length = 0;
    nextId = 1;
    app = createTestApp();
  });

  describe("Authorization & Admin Access", () => {
    it("rejects unauthorized users from creating an edition", async () => {
      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .send({
          name: "BidWar Premier League — Edition 01",
          editionNumber: 1,
          slug: "edition-01",
          year: 2026,
          startDate: "2026-10-10",
          endDate: "2026-10-11",
          status: "DRAFT",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Not authorised");
    });

    it("allows authorized admin to access admin routes", async () => {
      const res = await request(app)
        .get("/api/admin/bpl/editions")
        .set("x-test-admin", "true");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Validation & Safety", () => {
    it("rejects edition creation with missing required fields", async () => {
      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send({
          name: "",
          editionNumber: 1,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("rejects invalid status", async () => {
      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send({
          name: "Edition 01",
          editionNumber: 1,
          slug: "edition-01",
          year: 2026,
          startDate: "2026-10-10",
          endDate: "2026-10-11",
          status: "INVALID_STATUS",
        });

      expect(res.status).toBe(400);
    });

    it("rejects invalid URL formats", async () => {
      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send({
          name: "Edition 01",
          editionNumber: 1,
          slug: "edition-01",
          year: 2026,
          startDate: "2026-10-10",
          endDate: "2026-10-11",
          status: "DRAFT",
          liveStreamUrl: "invalid-not-a-url",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Live stream URL must be a valid HTTP/HTTPS URL");
    });

    it("rejects start date after end date", async () => {
      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send({
          name: "Edition 01",
          editionNumber: 1,
          slug: "edition-01",
          year: 2026,
          startDate: "2026-10-20",
          endDate: "2026-10-10",
          status: "DRAFT",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Start date must be before or equal to end date");
    });
  });

  describe("Public BPL Dynamic Active Resolution", () => {
    it("returns resolutionReason EMPTY when no editions exist", async () => {
      const res = await request(app).get("/api/bpl");
      expect(res.status).toBe(200);
      expect(res.body.edition).toBeNull();
      expect(res.body.resolutionReason).toBe("EMPTY");
    });

    it("resolves LIVE edition when one is live", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "LIVE",
        linkedTournamentId: 101,
        liveStreamUrl: "https://youtube.com/live/xyz",
        fanPageUrl: "https://bidwar.in/fan/bpl-01",
      });

      const res = await request(app).get("/api/bpl");
      expect(res.status).toBe(200);
      expect(res.body.edition).toBeDefined();
      expect(res.body.edition.status).toBe("LIVE");
      expect(res.body.resolutionReason).toBe("LIVE");
      expect(res.body.edition.liveStreamUrl).toBe("https://youtube.com/live/xyz");
      expect(res.body.edition.fanPageUrl).toBe("https://bidwar.in/fan/bpl-01");
    });

    it("falls back to UPCOMING edition when no LIVE edition exists", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "UPCOMING",
        linkedTournamentId: 101,
      });

      const res = await request(app).get("/api/bpl");
      expect(res.status).toBe(200);
      expect(res.body.edition).toBeDefined();
      expect(res.body.resolutionReason).toBe("UPCOMING");
    });
  });

  describe("Tournament Relationship & Linkage", () => {
    it("persists linked tournament reference without copying tournament data", async () => {
      const payload = {
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "UPCOMING",
        linkedTournamentId: 101,
      };

      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.linkedTournamentId).toBe(101);
      // linked tournament summary is attached dynamically
      expect(res.body.linkedTournament).toBeDefined();
      expect(res.body.linkedTournament.id).toBe(101);
      expect(res.body.linkedTournament.name).toBe("BidWar Premier Championship 2026");
    });

    it("rejects linking nonexistent tournament", async () => {
      mockTournaments.length = 0; // Empty tournaments table

      const payload = {
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "UPCOMING",
        linkedTournamentId: 9999,
      };

      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("does not exist");
      mockTournaments.push({
        id: 101,
        name: "BidWar Premier Championship 2026",
        sport: "cricket",
        venue: "Main Stadium",
        city: "Varanasi",
        status: "setup",
        auctionDate: "2026-10-10",
        auctionTime: "10:00",
        logoUrl: "https://bidwar.in/logo.png",
        auctionEnabled: true,
        scoringEnabled: true,
      });
    });
  });

  describe("Single LIVE Protection & Safety", () => {
    it("rejects marking an edition LIVE when another edition is already LIVE", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "LIVE",
      });

      const payload = {
        name: "BidWar Premier League — Edition 02",
        editionNumber: 2,
        slug: "edition-02",
        year: 2027,
        startDate: "2027-10-10",
        endDate: "2027-10-11",
        status: "LIVE",
      };

      const res = await request(app)
        .post("/api/admin/bpl/editions")
        .set("x-test-admin", "true")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Only one edition can be marked LIVE");
    });

    it("rejects deleting an edition while it is marked LIVE", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "LIVE",
      });

      const res = await request(app)
        .delete("/api/admin/bpl/editions/1")
        .set("x-test-admin", "true");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot delete an edition while it is marked LIVE");
    });
  });

  describe("P1 — Live Tournament Activity & Presentation", () => {
    it("enriches edition payload with tournament snapshot, teams, live match, and standings", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "LIVE",
        linkedTournamentId: 101,
      });

      const res = await request(app).get("/api/bpl");
      expect(res.status).toBe(200);
      expect(res.body.edition).toBeDefined();

      const edition = res.body.edition;
      // Tournament Snapshot
      expect(edition.tournamentSnapshot).toBeDefined();
      expect(edition.tournamentSnapshot.teamsCount).toBe(2);
      expect(edition.tournamentSnapshot.matchesCount).toBe(1);
      expect(edition.tournamentSnapshot.fixturesCount).toBe(0);
      expect(edition.tournamentSnapshot.liveMatchesCount).toBe(1);

      // Teams
      expect(edition.teams).toHaveLength(2);
      expect(edition.teams[0].name).toBe("Varanasi Warriors");

      // Live match
      expect(edition.liveMatch).toBeDefined();
      expect(edition.liveMatch.status).toBe("in_progress");
      expect(edition.liveMatch.homeTeam.name).toBe("Varanasi Warriors");
      expect(edition.liveMatch.awayTeam.name).toBe("Kashi Knights");
      expect(edition.liveMatch.liveScoreRoute).toBe("/score-display/101");
      expect(edition.liveMatch.score.innings[0].runs).toBe(87);
      expect(edition.liveMatch.score.innings[0].wickets).toBe(2);
      expect(edition.liveMatch.score.innings[0].overs).toBe("8.1");
      expect(edition.liveMatch.score.target).toBe(120);

      // Standings
      expect(edition.standings).toHaveLength(1);
      expect(edition.standings[0].teamName).toBe("Varanasi Warriors");
      expect(edition.standings[0].points).toBe(2);
    });

    it("handles an edition with no linked tournament gracefully", async () => {
      mockEditions.push({
        id: 2,
        name: "BidWar Premier League — Edition 02",
        editionNumber: 2,
        slug: "edition-02",
        year: 2027,
        startDate: "2027-10-10",
        endDate: "2027-10-11",
        status: "UPCOMING",
        linkedTournamentId: null,
      });

      const res = await request(app).get("/api/bpl/edition-02");
      expect(res.status).toBe(200);
      expect(res.body.linkedTournament).toBeNull();
      expect(editionDataHasEmptyActivity(res.body)).toBe(true);
    });
  });

  describe("P1 — Edition Sponsor Foundation & Management", () => {
    it("allows admin to create, list, and delete sponsors for an edition", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "LIVE",
      });

      // 1. Create sponsor
      const createRes = await request(app)
        .post("/api/admin/bpl/editions/1/sponsors")
        .set("x-test-admin", "true")
        .send({
          name: "Apex Global",
          logoUrl: "https://apex.example/logo.png",
          category: "TITLE",
          websiteUrl: "https://apex.example",
          displayOrder: 0,
          isActive: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.name).toBe("Apex Global");
      expect(createRes.body.category).toBe("TITLE");

      // 2. List sponsors via admin
      const listRes = await request(app)
        .get("/api/admin/bpl/editions/1/sponsors")
        .set("x-test-admin", "true");

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);

      // 3. Public sponsors list
      const publicRes = await request(app).get("/api/bpl/editions/1/sponsors");
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.length).toBeGreaterThanOrEqual(1);
    });

    it("rejects sponsor creation with invalid URL or missing name", async () => {
      mockEditions.push({
        id: 1,
        name: "BidWar Premier League — Edition 01",
        editionNumber: 1,
        slug: "edition-01",
        year: 2026,
        startDate: "2026-10-10",
        endDate: "2026-10-11",
        status: "LIVE",
      });

      const res = await request(app)
        .post("/api/admin/bpl/editions/1/sponsors")
        .set("x-test-admin", "true")
        .send({
          name: "",
          logoUrl: "not-a-valid-url",
        });

      expect(res.status).toBe(400);
    });
  });
});

function editionDataHasEmptyActivity(body: any): boolean {
  return (
    body.tournamentSnapshot?.teamsCount === 0 &&
    body.teams?.length === 0 &&
    body.liveMatch === null &&
    body.standings?.length === 0
  );
}

