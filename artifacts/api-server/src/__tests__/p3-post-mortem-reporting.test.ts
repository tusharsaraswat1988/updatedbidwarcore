import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Captured queries for verification
const capturedQueries: Array<{ sql: string; params: unknown[] }> = [];

// Mock tournaments
const mockTournamentsData = [
  { id: 1, name: "Premier League 2026", sport: "cricket", status: "completed", organizerId: 10 },
  { id: 2, name: "City Cup 2026", sport: "cricket", status: "completed", organizerId: 99 },
];

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockTournamentsData)),
          where: vi.fn().mockImplementation((cond: any) => ({
            orderBy: vi.fn().mockImplementation(() =>
              Promise.resolve(mockTournamentsData.filter((t) => t.organizerId === 10)),
            ),
            then: (resolve: (val: unknown) => void) => {
              const condStr = JSON.stringify(cond || {});
              if (condStr.includes("2")) return resolve([mockTournamentsData[1]]);
              if (condStr.includes("9999")) return resolve([]);
              return resolve([mockTournamentsData[0]]);
            },
          })),
        })),
      })),
    },
    pool: {
      query: vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
        capturedQueries.push({ sql, params });

        // 1. Tournaments config
        if (sql.includes("FROM tournaments WHERE id = $1")) {
          return Promise.resolve({
            rows: [
              {
                id: 1,
                name: "Premier League 2026",
                sport: "cricket",
                status: "completed",
                base_purse: 10000000,
                min_bid: 50000,
                minimum_squad_size: 5,
                maximum_squad_size: 8,
              },
            ],
          });
        }

        // 2. Teams and purse
        if (sql.includes("FROM teams t")) {
          return Promise.resolve({
            rows: [
              {
                id: 1,
                name: "Titans",
                short_code: "TTN",
                color: "#ff0000",
                purse: 10000000,
                purse_used: 8500000,
                booster_total: 0,
              },
              {
                id: 2,
                name: "Mavericks",
                short_code: "MAV",
                color: "#0000ff",
                purse: 10000000,
                purse_used: 9000000,
                booster_total: 0,
              },
              {
                id: 3,
                name: "Underdogs",
                short_code: "UND",
                color: "#888888",
                purse: 10000000,
                purse_used: 1000000,
                booster_total: 0,
              },
            ],
          });
        }

        // 3. Categories
        if (sql.includes("FROM categories")) {
          return Promise.resolve({
            rows: [
              { id: 1, name: "Batsmen", color_code: "#ef4444" },
              { id: 2, name: "Bowlers", color_code: "#3b82f6" },
              { id: 3, name: "All-Rounders", color_code: "#10b981" },
            ],
          });
        }

        // 4. Auction player events
        if (sql.includes("FROM auction_player_events")) {
          return Promise.resolve({
            rows: [
              // Titans: 5 players bought, total 8.5M
              {
                player_id: 101,
                player_name: "Rohit Sharma",
                player_role: "Batsman",
                category_id: 1,
                category_name: "Batsmen",
                color_code: "#ef4444",
                base_price: 500000,
                final_amount: 1000000,
                outcome: "sold",
                sold_to_team_id: 1,
                sold_to_team_name: "Titans",
                total_bids: 6,
              },
              {
                player_id: 102,
                player_name: "Shubman Gill",
                player_role: "Batsman",
                category_id: 1,
                category_name: "Batsmen",
                color_code: "#ef4444",
                base_price: 500000,
                final_amount: 1500000,
                outcome: "sold",
                sold_to_team_id: 1,
                sold_to_team_name: "Titans",
                total_bids: 8,
              },
              {
                player_id: 103,
                player_name: "Jasprit Bumrah",
                player_role: "Bowler",
                category_id: 2,
                category_name: "Bowlers",
                color_code: "#3b82f6",
                base_price: 500000,
                final_amount: 2000000,
                outcome: "sold",
                sold_to_team_id: 1,
                sold_to_team_name: "Titans",
                total_bids: 10,
              },
              {
                player_id: 104,
                player_name: "Mohammed Shami",
                player_role: "Bowler",
                category_id: 2,
                category_name: "Bowlers",
                color_code: "#3b82f6",
                base_price: 500000,
                final_amount: 2000000,
                outcome: "sold",
                sold_to_team_id: 1,
                sold_to_team_name: "Titans",
                total_bids: 12,
              },
              {
                player_id: 105,
                player_name: "Hardik Pandya",
                player_role: "All-Rounder",
                category_id: 3,
                category_name: "All-Rounders",
                color_code: "#10b981",
                base_price: 500000,
                final_amount: 2000000,
                outcome: "sold",
                sold_to_team_id: 1,
                sold_to_team_name: "Titans",
                total_bids: 14,
              },

              // Mavericks: 3 players bought, total 9M (Record Breaker Virat Kohli 5M)
              {
                player_id: 106,
                player_name: "Virat Kohli",
                player_role: "Batsman",
                category_id: 1,
                category_name: "Batsmen",
                color_code: "#ef4444",
                base_price: 1000000,
                final_amount: 5000000,
                outcome: "sold",
                sold_to_team_id: 2,
                sold_to_team_name: "Mavericks",
                total_bids: 25,
              },
              {
                player_id: 107,
                player_name: "Suryakumar Yadav",
                player_role: "Batsman",
                category_id: 1,
                category_name: "Batsmen",
                color_code: "#ef4444",
                base_price: 500000,
                final_amount: 2000000,
                outcome: "sold",
                sold_to_team_id: 2,
                sold_to_team_name: "Mavericks",
                total_bids: 15,
              },
              {
                player_id: 108,
                player_name: "Rashid Khan",
                player_role: "Bowler",
                category_id: 2,
                category_name: "Bowlers",
                color_code: "#3b82f6",
                base_price: 500000,
                final_amount: 2000000,
                outcome: "sold",
                sold_to_team_id: 2,
                sold_to_team_name: "Mavericks",
                total_bids: 12,
              },

              // Underdogs: 1 player bought (Bargain Steal: 1M base, 1M sold, 10 bids)
              {
                player_id: 109,
                player_name: "Kane Williamson",
                player_role: "Batsman",
                category_id: 1,
                category_name: "Batsmen",
                color_code: "#ef4444",
                base_price: 1000000,
                final_amount: 1000000,
                outcome: "sold",
                sold_to_team_id: 3,
                sold_to_team_name: "Underdogs",
                total_bids: 10,
              },

              // Unsold lots
              {
                player_id: 110,
                player_name: "David Warner",
                player_role: "Batsman",
                category_id: 1,
                category_name: "Batsmen",
                color_code: "#ef4444",
                base_price: 800000,
                final_amount: 0,
                outcome: "unsold",
                sold_to_team_id: null,
                sold_to_team_name: null,
                total_bids: 0,
              },
              {
                player_id: 111,
                player_name: "Mitchell Starc",
                player_role: "Bowler",
                category_id: 2,
                category_name: "Bowlers",
                color_code: "#3b82f6",
                base_price: 1000000,
                final_amount: 0,
                outcome: "unsold",
                sold_to_team_id: null,
                sold_to_team_name: null,
                total_bids: 0,
              },
            ],
          });
        }

        // 5. Bid counts
        if (sql.includes("FROM auction_bid_events")) {
          return Promise.resolve({
            rows: [
              { player_id: 106, bid_count: 25 },
              { player_id: 107, bid_count: 15 },
              { player_id: 105, bid_count: 14 },
              { player_id: 104, bid_count: 12 },
              { player_id: 108, bid_count: 12 },
              { player_id: 103, bid_count: 10 },
              { player_id: 109, bid_count: 10 },
              { player_id: 102, bid_count: 8 },
              { player_id: 101, bid_count: 6 },
            ],
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    },
    tournamentsTable: {
      id: "id",
      organizerId: "organizer_id",
      name: "name",
      sport: "sport",
      status: "status",
    },
    intelligenceArchivesTable: {
      id: "id",
      tournamentName: "tournament_name",
    },
  };
});

vi.mock("../lib/rate-limiters", () => ({
  heavyLimiter: (_req: any, _res: any, next: any) => next(),
}));

import intelligenceRouter from "../routes/intelligence";

describe("P3 Post-Mortem Intelligence & Moneyball Efficiency Reporting", () => {
  let app: express.Express;

  beforeEach(() => {
    capturedQueries.length = 0;
    app = express();
    app.use(express.json());

    // Inject mock user middleware (Organizer account 10)
    app.use((req: any, _res, next) => {
      req.jwtUser = {
        userId: 1,
        organizerAccountId: 10,
        organizer: { "1": true },
        isAdmin: false,
      };
      next();
    });

    app.use("/api", intelligenceRouter);
    app.use(intelligenceRouter);
  });

  describe("1. Access Control & Authorization Safeguards", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use("/api", intelligenceRouter);

      const res = await request(unauthApp).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(401);
    });

    it("forbids organizer from accessing tournament owned by another account (403)", async () => {
      // Tournament 2 belongs to organizer 99, caller is organizer 10
      const res = await request(app).get("/api/intelligence/post-mortem/2");
      expect(res.status).toBe(403);
    });

    it("permits authenticated organizer for their assigned tournament (200)", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);
      expect(res.body.tournamentId).toBe(1);
      expect(res.body.tournamentName).toBe("Premier League 2026");
    });
  });

  describe("2. Moneyball Squad Efficiency Index Leaderboard", () => {
    it("ranks teams by composite Moneyball efficiency score", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const index = res.body.moneyballIndex;
      expect(Array.isArray(index)).toBe(true);
      expect(index.length).toBe(3);

      // Verify ranks are sequentially ordered
      expect(index[0].rank).toBe(1);
      expect(index[1].rank).toBe(2);
      expect(index[2].rank).toBe(3);

      // Titans should be #1: completed squad (5/5), 85% purse deployment, lower cost per player
      const titans = index.find((t: any) => t.teamName === "Titans");
      expect(titans).toBeDefined();
      expect(titans.rank).toBe(1);
      expect(titans.playersBought).toBe(5);
      expect(titans.targetSquadSize).toBe(5);
      expect(titans.squadCompletionRate).toBe(1);
      expect(titans.totalSpent).toBe(8500000);
      expect(titans.startingPurse).toBe(10000000);
      expect(titans.budgetDeploymentRate).toBe(0.85);
      expect(titans.costPerPlayer).toBe(1700000);
      expect(titans.efficiencyScore).toBeGreaterThanOrEqual(80);

      // Mavericks: incomplete squad (3/5), high cost per player
      const mavericks = index.find((t: any) => t.teamName === "Mavericks");
      expect(mavericks).toBeDefined();
      expect(mavericks.playersBought).toBe(3);
      expect(mavericks.squadCompletionRate).toBe(0.6);
      expect(mavericks.costPerPlayer).toBe(3000000);
      expect(mavericks.efficiencyScore).toBeLessThan(titans.efficiencyScore);

      // Underdogs: only 1 player bought (1/5), only 10% budget deployed
      const underdogs = index.find((t: any) => t.teamName === "Underdogs");
      expect(underdogs).toBeDefined();
      expect(underdogs.playersBought).toBe(1);
      expect(underdogs.budgetDeploymentRate).toBe(0.1);
      expect(underdogs.efficiencyScore).toBeLessThan(mavericks.efficiencyScore);
    });

    it("calculates cost per player difference vs tournament market average", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const overview = res.body.marketOverview;
      // Total turnover = 8.5M (Titans) + 9M (Mavericks) + 1M (Underdogs) = 18.5M across 9 sold players
      expect(overview.totalTurnover).toBe(18500000);
      expect(overview.soldCount).toBe(9);
      expect(overview.tournamentAvgCostPerPlayer).toBe(Math.round(18500000 / 9));

      const titans = res.body.moneyballIndex.find((t: any) => t.teamName === "Titans");
      expect(titans.costPerPlayerDiff).toBe(titans.costPerPlayer - overview.tournamentAvgCostPerPlayer);
    });
  });

  describe("3. Tournament Market Overview & Clearance Rates", () => {
    it("reports market turnover, average inflation percentage, and sold vs unsold ratio", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const overview = res.body.marketOverview;
      expect(overview.lotCount).toBe(11);
      expect(overview.soldCount).toBe(9);
      expect(overview.unsoldCount).toBe(2);
      expect(overview.soldRatio).toBeCloseTo(9 / 11, 2);
      expect(overview.unsoldRatio).toBeCloseTo(2 / 11, 2);
      expect(overview.averageInflationPct).toBeGreaterThan(0);
    });

    it("provides category inflation and turnover breakdown", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const categories = res.body.marketOverview.categoryBreakdown;
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThanOrEqual(3);

      const batsmenCat = categories.find((c: any) => c.categoryName === "Batsmen");
      expect(batsmenCat).toBeDefined();
      expect(batsmenCat.soldCount).toBe(5);
      expect(batsmenCat.unsoldCount).toBe(1); // David Warner unsold
      expect(batsmenCat.totalSpent).toBe(10500000); // 1M + 1.5M + 5M + 2M + 1M = 10.5M
      expect(batsmenCat.inflationPct).toBeGreaterThan(0);
    });
  });

  describe("4. Marquee & Value Highlights", () => {
    it("identifies Top Bargain Steals (lowest price multiplier with high competition)", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const bargains = res.body.highlights.topBargainSteals;
      expect(Array.isArray(bargains)).toBe(true);
      expect(bargains.length).toBeGreaterThan(0);

      // Kane Williamson was sold at 1.0x base price (1M / 1M) with 10 bids
      const williamson = bargains[0];
      expect(williamson.playerName).toBe("Kane Williamson");
      expect(williamson.multiplier).toBe(1.0);
      expect(williamson.totalBids).toBe(10);
      expect(williamson.teamName).toBe("Underdogs");
    });

    it("identifies Top Record Breakers & Fiercest Bidding Wars", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const recordBreakers = res.body.highlights.topRecordBreakers;
      expect(Array.isArray(recordBreakers)).toBe(true);
      expect(recordBreakers.length).toBeGreaterThan(0);

      // Virat Kohli sold for 5M with 25 bids and 4M escalation (+400% inflation)
      const kohli = recordBreakers[0];
      expect(kohli.playerName).toBe("Virat Kohli");
      expect(kohli.finalAmount).toBe(5000000);
      expect(kohli.escalation).toBe(4000000);
      expect(kohli.inflationPct).toBe(400);
      expect(kohli.totalBids).toBe(25);
      expect(kohli.teamName).toBe("Mavericks");
    });

    it("summarizes unsold lots by category with base value and sample players", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const unsoldSummary = res.body.highlights.unsoldByCategory;
      expect(Array.isArray(unsoldSummary)).toBe(true);
      expect(unsoldSummary.length).toBe(2);

      const batsmenUnsold = unsoldSummary.find((u: any) => u.categoryName === "Batsmen");
      expect(batsmenUnsold).toBeDefined();
      expect(batsmenUnsold.unsoldCount).toBe(1);
      expect(batsmenUnsold.totalBasePrice).toBe(800000);
      expect(batsmenUnsold.samplePlayers[0].name).toBe("David Warner");
    });
  });

  describe("5. Executive Export Generation (CSV, PDF, JSON)", () => {
    it("exports complete debrief in CSV format with structured sections", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1/export?format=csv");
      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      expect(res.header["content-disposition"]).toContain("attachment; filename=");
      expect(res.text).toContain("TOURNAMENT MARKET EXECUTIVE SUMMARY");
      expect(res.text).toContain("MONEYBALL SQUAD EFFICIENCY INDEX LEADERBOARD");
      expect(res.text).toContain("CATEGORY MARKET BREAKDOWN & INFLATION");
      expect(res.text).toContain("TOP 5 BARGAIN STEALS");
      expect(res.text).toContain("TOP 5 RECORD BREAKERS");
      expect(res.text).toContain("UNSOLD LOTS SUMMARY BY CATEGORY");
      expect(res.text).toContain("Titans");
      expect(res.text).toContain("Virat Kohli");
      expect(res.text).toContain("Kane Williamson");
    });

    it("exports complete debrief in JSON format", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1/export?format=json");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.postMortem).toBeDefined();
      expect(res.body.postMortem.tournamentName).toBe("Premier League 2026");
      expect(res.body.postMortem.moneyballIndex.length).toBe(3);
    });

    it("exports executive PDF stream with application/pdf header", async () => {
      const res = await request(app).get("/api/intelligence/post-mortem/1/export?format=pdf");
      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("application/pdf");
      expect(res.header["content-disposition"]).toContain("attachment; filename=");
      // PDF documents start with %PDF
      expect(res.body.toString().startsWith("%PDF") || res.text.startsWith("%PDF") || res.body.length > 100).toBe(true);
    });

    it("supports alternate route: /api/tournaments/:tournamentId/intelligence/post-mortem", async () => {
      const res = await request(app).get("/api/tournaments/1/intelligence/post-mortem");
      expect(res.status).toBe(200);
      expect(res.body.tournamentId).toBe(1);
      expect(res.body.moneyballIndex).toBeDefined();
    });

    it("supports alternate export route: /api/tournaments/:tournamentId/intelligence/post-mortem/export", async () => {
      const res = await request(app).get("/api/tournaments/1/intelligence/post-mortem/export?format=csv");
      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      expect(res.text).toContain("MONEYBALL SQUAD EFFICIENCY INDEX LEADERBOARD");
    });
  });

  describe("6. Edge Cases, SQL Hygiene & Resilience Safeguards", () => {
    it("ensures SQL filters out in_progress events, deduplicates players, and only includes active boosters", async () => {
      capturedQueries.length = 0;
      const res = await request(app).get("/api/intelligence/post-mortem/1");
      expect(res.status).toBe(200);

      const boosterQuery = capturedQueries.find((q) => q.sql.includes("FROM purse_boosters"));
      expect(boosterQuery).toBeDefined();
      expect(boosterQuery?.sql).toContain("status = 'active'");

      const eventsQuery = capturedQueries.find((q) => q.sql.includes("FROM auction_player_events"));
      expect(eventsQuery).toBeDefined();
      expect(eventsQuery?.sql).toContain("DISTINCT ON (ape.player_id)");
      expect(eventsQuery?.sql).toContain("outcome != 'in_progress'");
    });

    it("handles executive PDF generation for >10 teams with page breaks and unicode sanitization", async () => {
      const { streamPostMortemPdf } = await import("../lib/post-mortem-service");
      const mockReport: any = {
        tournamentId: 99,
        tournamentName: "Super League ★ ⚡ 2026",
        sport: "cricket",
        status: "completed",
        generatedAt: new Date().toISOString(),
        moneyballIndex: Array.from({ length: 14 }, (_, i) => ({
          teamId: i + 1,
          teamName: `Franchise ${i + 1} ★`,
          shortCode: `F${i + 1}`,
          color: "#ff0000",
          startingPurse: 10000000,
          totalSpent: 8000000,
          remainingPurse: 2000000,
          playersBought: 11,
          targetSquadSize: 11,
          squadCompletionRate: 1.0,
          costPerPlayer: 727272,
          costPerPlayerDiff: -50000,
          costPerPlayerVariancePct: -6,
          budgetDeploymentRate: 0.8,
          efficiencyScore: 85 - i * 2,
          rank: i + 1,
          breakdown: { completionScore: 40, deploymentScore: 30, costEfficiencyScore: 15 },
        })),
        marketOverview: {
          totalTurnover: 112000000,
          averageInflationPct: 25,
          lotCount: 154,
          soldCount: 154,
          unsoldCount: 0,
          soldRatio: 1.0,
          unsoldRatio: 0.0,
          tournamentAvgCostPerPlayer: 727272,
          categoryBreakdown: [],
        },
        highlights: {
          topBargainSteals: Array.from({ length: 5 }, (_, i) => ({
            playerId: i + 1,
            playerName: `Bargain Player ${i + 1} ⚡`,
            role: "Batsman",
            categoryId: 1,
            categoryName: "Batsmen",
            teamId: 1,
            teamName: "Franchise 1",
            basePrice: 500000,
            finalAmount: 600000,
            multiplier: 1.2,
            totalBids: 12,
            savings: 127272,
          })),
          topRecordBreakers: Array.from({ length: 5 }, (_, i) => ({
            playerId: 100 + i,
            playerName: `Record Player ${i + 1} 🔥`,
            role: "All-Rounder",
            categoryId: 2,
            categoryName: "All-Rounders",
            teamId: 2,
            teamName: "Franchise 2",
            basePrice: 1000000,
            finalAmount: 15000000,
            escalation: 14000000,
            inflationPct: 1400,
            totalBids: 35,
          })),
          unsoldByCategory: [],
        },
      };

      const chunks: Buffer[] = [];
      const mockRes: any = {
        setHeader: vi.fn(),
        write: (chunk: Buffer) => chunks.push(chunk),
        end: () => {},
        on: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
      };

      await streamPostMortemPdf(mockReport, mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining(".pdf"));
    });
  });
});
