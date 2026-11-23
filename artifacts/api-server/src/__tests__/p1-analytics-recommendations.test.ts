import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Captured queries for verification
const capturedQueries: Array<{ sql: string; params: unknown[] }> = [];

// Mock DB
const mockTournamentsData = [
  { id: 1, name: "Premier League 2026", sport: "cricket", status: "live", organizerId: 10 },
  { id: 2, name: "City Cup 2026", sport: "cricket", status: "completed", organizerId: 99 },
  { id: 3, name: "Badminton Open", sport: "badminton", status: "upcoming", organizerId: 10 },
];

const mockArchivesData = [
  { id: 101, tournamentName: "Historic 2025", archivedAt: new Date() },
];

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation((fields?: unknown) => ({
        from: vi.fn().mockImplementation((table: unknown) => ({
          orderBy: vi.fn().mockImplementation(() => {
            return Promise.resolve(mockTournamentsData);
          }),
          where: vi.fn().mockImplementation((cond: any) => {
            // Mock tournament lookup by ID
            return {
              orderBy: vi.fn().mockImplementation(() => {
                return Promise.resolve(mockTournamentsData.filter(t => t.organizerId === 10));
              }),
              then: (resolve: (val: unknown) => void) => {
                // If checking for id = 1, return tournament 1
                // If checking for id = 2, return tournament 2
                // If cond matches archive, return archive
                const condStr = JSON.stringify(cond || {});
                if (condStr.includes("101")) {
                  return resolve(mockArchivesData);
                }
                if (condStr.includes("2")) {
                  return resolve([mockTournamentsData[1]]);
                }
                if (condStr.includes("9999")) {
                  return resolve([]);
                }
                return resolve([mockTournamentsData[0]]);
              },
            };
          }),
        })),
      })),
    },
    pool: {
      query: vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
        capturedQueries.push({ sql, params });

        // Overview / tournament queries
        if (sql.includes("COUNT(*)::int AS total_bids")) {
          return Promise.resolve({
            rows: [{ total_bids: 42, avg_response_ms: 3200 }],
          });
        }
        if (sql.includes("ORDER BY bid_count DESC LIMIT 1")) {
          return Promise.resolve({
            rows: [{ player_id: 101, player_name: "Virat Kohli", bid_count: 15 }],
          });
        }
        if (sql.includes("ORDER BY avg_response_ms ASC LIMIT 1")) {
          return Promise.resolve({
            rows: [{ team_id: 5, team_name: "Titans", team_color: "#ff0000", avg_response_ms: 1200, total_bids: 18 }],
          });
        }
        if (sql.includes("ORDER BY (final_amount::numeric / NULLIF(base_price,0)) DESC LIMIT 1")) {
          return Promise.resolve({
            rows: [{ player_name: "Star Player", final_amount: 5000000, base_price: 1000000, inflation_pct: 400, sold_to_team_name: "Warriors" }],
          });
        }
        if (sql.includes("GROUP BY outcome")) {
          return Promise.resolve({
            rows: [
              { outcome: "sold", cnt: 20 },
              { outcome: "unsold", cnt: 5 },
            ],
          });
        }

        // Demand query
        if (sql.includes("demand_score")) {
          return Promise.resolve({
            rows: [
              {
                player_id: 201,
                player_name: "Zero Base Phenom",
                player_role: "All Rounder",
                base_price: 0,
                final_amount: 500000,
                outcome: "sold",
                total_bids: 0,
                competition_score: 4,
                interested_teams: 4,
                duration_secs: 12,
                avg_secs_between: 0,
                inflation_pct: null,
                demand_score: 27.0, // 4 * 3.00 + 15.0 = 27.0
              },
              {
                player_id: 202,
                player_name: "Manual Multiplier Lot",
                player_role: "Batsman",
                base_price: 100000,
                final_amount: 1000000, // 10x multiplier
                outcome: "sold",
                total_bids: 1,
                competition_score: 3,
                interested_teams: 3,
                duration_secs: 20,
                avg_secs_between: 5,
                inflation_pct: 900,
                demand_score: 59.4, // 1 * 0.40 + 3 * 3.00 + 50 = 59.4
              },
            ],
          });
        }

        // Observations queries
        if (sql.includes("c.name, AVG(ape.total_bids_received)")) {
          return Promise.resolve({ rows: [{ name: "Icon", avg_bids: "8.5", player_count: 4 }] });
        }
        if (sql.includes("SELECT player_role, AVG(total_bids_received)")) {
          return Promise.resolve({ rows: [{ player_role: "All-Rounder", avg_bids: "7.2", count: 10 }] });
        }
        if (sql.includes("WHERE tournament_id = $1 AND is_superseded = false")) {
          return Promise.resolve({ rows: [{ high_inflation: 2, total_sold: 15, max_sold: 5000000, avg_sold: 1200000 }] });
        }
        if (sql.includes("SELECT 1 FROM auction_bid_events WHERE tournament_id = $1 LIMIT 1")) {
          return Promise.resolve({ rows: [{ "?column?": 1 }] });
        }

        // Team lookup
        if (sql.includes("SELECT tournament_id FROM teams WHERE id = $1")) {
          if (params.includes(20)) {
            return Promise.resolve({ rows: [{ tournament_id: 2 }] });
          }
          if (params.includes(999)) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [{ tournament_id: 1 }] });
        }

        // Player authorization check
        if (sql.includes("FROM auction_player_events ape") && sql.includes("JOIN tournaments t")) {
          if (params.includes(999)) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [{ 1: 1 }] });
        }

        // Cross-sport
        if (sql.includes("COALESCE(tor.sport, ape.sport)")) {
          return Promise.resolve({ rows: [{ sport: "cricket", sold: 20, unsold: 5, avg_sold: 1000000, avg_bids_per_player: "6.2" }] });
        }

        // Default empty result
        return Promise.resolve({ rows: [] });
      }),
    },
    tournamentsTable: {
      id: "id",
      name: "name",
      sport: "sport",
      status: "status",
      organizerId: "organizer_id",
    },
    intelligenceArchivesTable: {
      id: "id",
      archivedAt: "archived_at",
      tournamentName: "tournament_name",
    },
    auctionBidEventsTable: {
      tournamentId: "tournament_id",
    },
    auctionPlayerEventsTable: {
      tournamentId: "tournament_id",
      isSuperseded: "is_superseded",
    },
    auctionTimerEventsTable: {
      tournamentId: "tournament_id",
    },
  };
});

vi.mock("../lib/rate-limiters", () => ({
  heavyLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/intelligence-cache", async () => {
  const actual = await vi.importActual<any>("../lib/intelligence-cache");
  return {
    ...actual,
    getCachedIntel: vi.fn((_key: string, fetcher: () => Promise<unknown>) => fetcher()),
  };
});

vi.mock("../lib/intelligence-briefing", () => ({
  buildIntelligenceBriefing: vi.fn(async (name: string, sport: string, notes: unknown) => ({
    summary: `Briefing for ${name} (${sport})`,
    notes,
  })),
}));

vi.mock("../lib/intelligence-export", () => ({
  writeIntelligenceCsv: vi.fn(async (res: any) => res.json({ exported: true })),
}));

// Import after mocks
import intelligenceRouter, { requireIntelAuth } from "../routes/intelligence";

describe("P1: Analytics & Recommendations - BidWar Intelligence Blueprint", () => {
  let app: express.Express;
  let currentUserJwt: Record<string, unknown> = {};

  beforeEach(() => {
    capturedQueries.length = 0;
    currentUserJwt = {};

    app = express();
    app.use(express.json());
    // Injected session middleware
    app.use((req, _res, next) => {
      req.jwtUser = { ...currentUserJwt };
      next();
    });
    app.use(intelligenceRouter);
  });

  // ─── 1. Organiser Scoped Access & Authorization ─────────────────────────────
  describe("1. Organiser Scoped Access & Authorization", () => {
    it("rejects unauthenticated requests with 401 Not authorised", async () => {
      currentUserJwt = {}; // no auth

      const res = await request(app).get("/intelligence/tournaments");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Not authorised");
      expect(res.body.middleware).toBe("requireIntelAuth");
    });

    it("rejects caller with falsy organizer tokens (e.g. { organizer: { '1': false } }) with 401", async () => {
      currentUserJwt = { organizer: { "1": false }, isAdmin: false };

      const res = await request(app).get("/intelligence/tournaments");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Not authorised");
    });

    it("allows tournament organizers to access /tournaments and filters to their owned tournaments", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/tournaments");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("allows tournament organizer to access intelligence for their owned tournament (id: 1)", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/tournament/1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalBids");
      expect(res.body).toHaveProperty("hottestPlayer");
      expect(res.body.hottestPlayer.player_name).toBe("Virat Kohli");
    });

    it("blocks tournament organizer from accessing intelligence for another organizer's tournament (id: 2)", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/tournament/2");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Authentication required");
    });

    it("returns 404 when tournament does not exist (id: 9999)", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/tournament/9999");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Tournament not found");
    });

    it("allows global platform admin (isAdmin: true) to access any tournament intelligence", async () => {
      currentUserJwt = { isAdmin: true };

      const res = await request(app).get("/intelligence/tournament/2");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalBids");
    });

    it("allows global platform admin to access platform-wide archives and cross-sport intelligence", async () => {
      currentUserJwt = { isAdmin: true };

      const resArchives = await request(app).get("/intelligence/archives");
      expect(resArchives.status).toBe(200);

      const resCrossSport = await request(app).get("/intelligence/cross-sport");
      expect(resCrossSport.status).toBe(200);
      expect(resCrossSport.body).toHaveProperty("sports");
    });

    it("blocks tournament organizer from accessing platform-wide archives (403 Admin access required)", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/archives");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Admin access required");
    });

    it("blocks tournament organizer from querying /events without a tournamentId", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/events");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Tournament ID required for organizer access");
    });

    it("allows tournament organizer to query /events with their own tournamentId", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/events?tournamentId=1");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("events");
    });
  });

  // ─── 2. Query Safety & Lifecycle Integration (is_superseded = false) ─────────
  describe("2. Query Safety & Lifecycle Integration", () => {
    beforeEach(() => {
      currentUserJwt = { isAdmin: true };
    });

    it("ensures /demand/:tournamentId query filters out superseded rows with is_superseded = false", async () => {
      await request(app).get("/intelligence/demand/1");

      const demandQuery = capturedQueries.find(q => q.sql.includes("demand_score"));
      expect(demandQuery).toBeDefined();
      expect(demandQuery!.sql).toContain("is_superseded = false");
    });

    it("ensures /tournament/:tournamentId overview query filters out superseded rows", async () => {
      await request(app).get("/intelligence/tournament/1");

      const hottestQuery = capturedQueries.find(q => q.sql.includes("ORDER BY bid_count DESC LIMIT 1"));
      expect(hottestQuery).toBeDefined();
      expect(hottestQuery!.sql).toContain("ape.is_superseded = false");

      const inflationQuery = capturedQueries.find(q => q.sql.includes("inflation_pct"));
      expect(inflationQuery).toBeDefined();
      expect(inflationQuery!.sql).toContain("is_superseded = false");

      const outcomeQuery = capturedQueries.find(q => q.sql.includes("GROUP BY outcome"));
      expect(outcomeQuery).toBeDefined();
      expect(outcomeQuery!.sql).toContain("is_superseded = false");
    });

    it("ensures /observations/:tournamentId query filters out superseded rows", async () => {
      await request(app).get("/intelligence/observations/1");

      const catStatsQuery = capturedQueries.find(q => q.sql.includes("c.name, AVG(ape.total_bids_received)"));
      expect(catStatsQuery).toBeDefined();
      expect(catStatsQuery!.sql).toContain("ape.is_superseded = false");

      const inflationStats = capturedQueries.find(q => q.sql.includes("high_inflation"));
      expect(inflationStats).toBeDefined();
      expect(inflationStats!.sql).toContain("is_superseded = false");
    });

    it("ensures /intensity/:tournamentId query filters out superseded rows", async () => {
      await request(app).get("/intelligence/intensity/1");

      const intensityQuery = capturedQueries.find(q => q.sql.includes("escalation_curve"));
      expect(intensityQuery).toBeDefined();
      expect(intensityQuery!.sql).toContain("is_superseded = false");
    });

    it("ensures /live/:tournamentId query filters out superseded rows", async () => {
      await request(app).get("/intelligence/live/1");

      const liveLastBid = capturedQueries.find(q => q.sql.includes("lastBidResult") || q.sql.includes("ORDER BY abe.timestamp DESC LIMIT 1"));
      expect(liveLastBid).toBeDefined();
      expect(liveLastBid!.sql).toContain("is_superseded = false");
    });

    it("ensures /behavior/:tournamentId category query scopes ape.tournament_id = abe.tournament_id and filters tournament_id", async () => {
      await request(app).get("/intelligence/behavior/1");

      const catQuery = capturedQueries.find(q => q.sql.includes("cat_bids") && q.sql.includes("c.name AS cat_name"));
      expect(catQuery).toBeDefined();
      expect(catQuery!.sql).toContain("ape.tournament_id = abe.tournament_id");
      expect(catQuery!.sql).toContain("WHERE tournament_id = $1");
      expect(catQuery!.sql).toContain("is_superseded = false");
    });

    it("ensures /team/:teamId aggressionHighlights query scopes ape.tournament_id = abe.tournament_id", async () => {
      await request(app).get("/intelligence/team/5?tournamentId=1");

      const aggQuery = capturedQueries.find(q => q.sql.includes("aggression_pct"));
      expect(aggQuery).toBeDefined();
      expect(aggQuery!.sql).toContain("ape.tournament_id = abe.tournament_id");
      expect(aggQuery!.sql).toContain("DISTINCT ON (player_id, tournament_id)");
      expect(aggQuery!.sql).toContain("is_superseded = false");
    });
  });

  // ─── 3. playerEventFilters & teamId Filter Fix ──────────────────────────────
  describe("3. playerEventFilters & teamId Filter Fix", () => {
    beforeEach(() => {
      currentUserJwt = { isAdmin: true };
    });

    it("matches sold_to_team_id = $teamId OR EXISTS in auction_bid_events when teamId filter is applied", async () => {
      await request(app).get("/intelligence/demand/1?teamId=7");

      const demandQuery = capturedQueries.find(q => q.sql.includes("demand_score"));
      expect(demandQuery).toBeDefined();

      // Check that teamId filter matches sold_to_team_id (for manual sales / terminal bids)
      expect(demandQuery!.sql).toContain("sold_to_team_id = $2");
      expect(demandQuery!.sql).toContain("EXISTS (");
      expect(demandQuery!.sql).toContain("abe_f.team_id = $2");
      expect(demandQuery!.params).toContain(7);
    });

    it("applies sold_to_team_id filter on player events when querying /events with teamId", async () => {
      await request(app).get("/intelligence/events?tournamentId=1&teamId=7");

      const eventQuery = capturedQueries.find(q => q.sql.includes("FROM auction_player_events") && q.sql.includes("sold_to_team_id = $"));
      expect(eventQuery).toBeDefined();
      expect(eventQuery!.params).toContain(7);
    });
  });

  // ─── 4. Safe Division on Zero Base Price & Demand Enhancement ───────────────
  describe("4. Safe Division on Base Price & Demand Enhancement", () => {
    beforeEach(() => {
      currentUserJwt = { isAdmin: true };
    });

    it("handles lots with base_price = 0 safely without division by zero errors", async () => {
      const res = await request(app).get("/intelligence/demand/1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const zeroBasePlayer = res.body.find((p: any) => p.player_id === 201);
      expect(zeroBasePlayer).toBeDefined();
      expect(zeroBasePlayer.base_price).toBe(0);
      expect(zeroBasePlayer.inflation_pct).toBeNull();
      expect(zeroBasePlayer.demand_score).toBeGreaterThan(0);
      expect(Number.isFinite(zeroBasePlayer.demand_score)).toBe(true);
    });

    it("properly calculates demand_score utilizing interested_teams and high valuation multipliers on manual sales", async () => {
      const res = await request(app).get("/intelligence/demand/1");
      expect(res.status).toBe(200);

      const manualLot = res.body.find((p: any) => p.player_id === 202);
      expect(manualLot).toBeDefined();
      expect(manualLot.competition_score).toBe(3);
      expect(manualLot.interested_teams).toBe(3);
      expect(manualLot.inflation_pct).toBe(900);
      // High valuation multiplier + competition score should result in strong demand_score
      expect(manualLot.demand_score).toBeGreaterThanOrEqual(50);
    });

    it("uses NULLIF(base_price, 0) across intelligence analytics SQL queries", async () => {
      await request(app).get("/intelligence/demand/1");

      const demandQuery = capturedQueries.find(q => q.sql.includes("demand_score"));
      expect(demandQuery).toBeDefined();
      expect(demandQuery!.sql).toContain("NULLIF(base_price, 0)");
    });
  });

  // ─── 5. Edge Cases & Boundary Conditions ───────────────────────────────────
  describe("5. Edge Cases & Boundary Conditions", () => {
    it("handles simultaneous categoryId and teamId filters with safe parameter indexing", async () => {
      currentUserJwt = { isAdmin: true };
      await request(app).get("/intelligence/demand/1?categoryId=4&teamId=9");

      const demandQuery = capturedQueries.find(q => q.sql.includes("demand_score"));
      expect(demandQuery).toBeDefined();
      expect(demandQuery!.sql).toContain("category_id = $2");
      expect(demandQuery!.sql).toContain("sold_to_team_id = $3");
      expect(demandQuery!.params).toEqual([1, 4, 9]);
    });

    it("verifies team/:teamId authorization checks team's parent tournament", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      // Team 10 belongs to Tournament 1 (organizer 10) -> Allowed
      const resAllowed = await request(app).get("/intelligence/team/10");
      expect(resAllowed.status).toBe(200);

      // Team 20 belongs to Tournament 2 (organizer 99) -> 403 Forbidden
      const resBlocked = await request(app).get("/intelligence/team/20");
      expect(resBlocked.status).toBe(403);
    });

    it("verifies player detail authorization for tournament organizers", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      // Player 201 belongs to organizer's tournament -> 200
      const resAllowed = await request(app).get("/intelligence/players/detail?playerId=201");
      expect(resAllowed.status).toBe(200);

      // Player 999 belongs to another organizer's tournament -> 403
      const resBlocked = await request(app).get("/intelligence/players/detail?playerId=999");
      expect(resBlocked.status).toBe(403);
      expect(resBlocked.body.error).toBe("Authentication required");
    });

    it("returns 400 when player detail is requested without playerId or globalPlayerId", async () => {
      currentUserJwt = { isAdmin: true };
      const res = await request(app).get("/intelligence/players/detail");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Provide globalPlayerId or playerId");
    });

    it("validates live export dataset parameter and authorization", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      // Valid live export for owned tournament
      const resValid = await request(app).get("/intelligence/export/live/1?dataset=all");
      expect(resValid.status).toBe(200);
      expect(resValid.body).toEqual({ exported: true });

      // Invalid dataset parameter -> 400
      const resInvalidDataset = await request(app).get("/intelligence/export/live/1?dataset=invalid_format");
      expect(resInvalidDataset.status).toBe(400);
      expect(resInvalidDataset.body.error).toBe("Invalid dataset");

      // Export for unowned tournament -> 403
      const resUnowned = await request(app).get("/intelligence/export/live/2?dataset=all");
      expect(resUnowned.status).toBe(403);
    });

    it("blocks organizers from archive export (platform admin only)", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      const res = await request(app).get("/intelligence/export/archive/101?dataset=all");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Admin access required");
    });

    it("allows tournament organizer to access pre-auction player detail via players table union", async () => {
      currentUserJwt = { organizerAccountId: 10, isAdmin: false };

      // Player 888 has no auction_player_events yet, but is registered in players table for tournament 1
      const resAllowed = await request(app).get("/intelligence/players/detail?playerId=888");
      expect(resAllowed.status).toBe(200);
      expect(resAllowed.body).toHaveProperty("playerId", 888);

      const authQuery = capturedQueries.find(q => q.sql.includes("FROM auction_player_events ape") && q.sql.includes("UNION ALL") && q.sql.includes("FROM players p"));
      expect(authQuery).toBeDefined();
      expect(authQuery!.sql).toContain("p.id = $1");
    });

    it("verifies archiveIntelligenceBeforeDelete filters isSuperseded = false for player count", async () => {
      const whereClauses: unknown[] = [];
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation((clause: unknown) => {
              whereClauses.push(clause);
              return Promise.resolve([{ value: 5 }]);
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 77 }]),
          }),
        }),
        execute: vi.fn().mockResolvedValue({}),
      };

      const { archiveIntelligenceBeforeDelete } = await import("../lib/intelligence-archive");
      const result = await archiveIntelligenceBeforeDelete(mockTx as any, {
        id: 1,
        name: "Test Tourney",
        sport: "cricket",
        organizerId: 10,
        venue: null,
        auctionDate: null,
        status: "completed",
      });

      expect(result).toBe(77);
      // Verify playerRow query has compound condition with is_superseded
      const playerClause = whereClauses[1];
      expect(JSON.stringify(playerClause)).toContain("is_superseded");
    });
  });
});
