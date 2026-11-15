import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  computeTournamentSoldRanks,
  isPlayerTop5InTournament,
  processHistoricalAuctionCandidates,
  processHistoricalAuctionSummary,
  getPlayerAuctionPerformanceHistory,
  type CandidateHistoricalRow,
  type TournamentSoldPlayerRankEntry,
} from "../lib/player-auction-history-service";
import {
  isLiveAuctionHistoryEnabled,
  isOwnerAppHistoryEnabled,
  isObsHistoryEnabled,
  isLedHistoryEnabled,
  resolveTournamentFeatures,
} from "@workspace/platform-core";

describe("Player Auction Performance History", () => {
  describe("1. Player sold in 5 tournaments — only the best 3 sold prices are shown", () => {
    it("returns top 3 records sorted by sold price descending", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 101, tournamentName: "Tournament A", tournamentStatus: "completed", soldPrice: 50000 },
        { playerId: 2, tournamentId: 102, tournamentName: "Tournament B", tournamentStatus: "completed", soldPrice: 200000 },
        { playerId: 3, tournamentId: 103, tournamentName: "Tournament C", tournamentStatus: "completed", soldPrice: 150000 },
        { playerId: 4, tournamentId: 104, tournamentName: "Tournament D", tournamentStatus: "completed", soldPrice: 80000 },
        { playerId: 5, tournamentId: 105, tournamentName: "Tournament E", tournamentStatus: "completed", soldPrice: 300000 },
      ];

      const currentTournamentId = 999;
      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(3);
      expect(result[0]!.tournamentId).toBe(105);
      expect(result[0]!.soldPrice).toBe(300000);
      expect(result[1]!.tournamentId).toBe(102);
      expect(result[1]!.soldPrice).toBe(200000);
      expect(result[2]!.tournamentId).toBe(103);
      expect(result[2]!.soldPrice).toBe(150000);
    });
  });

  describe("2. Player sold in 2 tournaments — only 2 entries are shown", () => {
    it("returns exactly 2 records without padding", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 101, tournamentName: "Tournament A", tournamentStatus: "completed", soldPrice: 75000 },
        { playerId: 2, tournamentId: 102, tournamentName: "Tournament B", tournamentStatus: "completed", soldPrice: 180000 },
      ];

      const currentTournamentId = 999;
      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(2);
      expect(result[0]!.tournamentId).toBe(102);
      expect(result[0]!.soldPrice).toBe(180000);
      expect(result[1]!.tournamentId).toBe(101);
      expect(result[1]!.soldPrice).toBe(75000);
    });
  });

  describe("3. Player has only UNSOLD records — no history entries are shown", () => {
    it("excludes unsold records where soldPrice is 0 or not positive", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 101, tournamentName: "Tournament A", tournamentStatus: "completed", soldPrice: 0 },
        { playerId: 2, tournamentId: 102, tournamentName: "Tournament B", tournamentStatus: "completed", soldPrice: -1 },
      ];

      const currentTournamentId = 999;
      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(0);
    });
  });

  describe("4. Player has SOLD and UNSOLD records — only SOLD records appear", () => {
    it("keeps only sold records and sorts them properly", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 101, tournamentName: "Tournament A", tournamentStatus: "completed", soldPrice: 120000 },
        { playerId: 2, tournamentId: 102, tournamentName: "Tournament B", tournamentStatus: "completed", soldPrice: 0 }, // unsold
        { playerId: 3, tournamentId: 103, tournamentName: "Tournament C", tournamentStatus: "completed", soldPrice: 250000 },
      ];

      const currentTournamentId = 999;
      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.tournamentId)).toEqual([103, 101]);
      expect(result.map((r) => r.soldPrice)).toEqual([250000, 120000]);
    });
  });

  describe("5. Player ranks within Top 5 in a tournament — badge appears", () => {
    it("assigns rank <= 5 and qualifies for TOP 5 STAR", () => {
      const tournamentPlayers: TournamentSoldPlayerRankEntry[] = [
        { playerId: 10, soldPrice: 500000 },
        { playerId: 11, soldPrice: 400000 },
        { playerId: 12, soldPrice: 300000 }, // our player (rank 3)
        { playerId: 13, soldPrice: 200000 },
        { playerId: 14, soldPrice: 100000 },
        { playerId: 15, soldPrice: 50000 },
      ];

      const ranks = computeTournamentSoldRanks(tournamentPlayers);
      expect(ranks.get(12)).toBe(3);
      expect(isPlayerTop5InTournament(12, tournamentPlayers)).toBe(true);
    });
  });

  describe("6. Player is outside Top 5 — badge does not appear", () => {
    it("assigns rank > 5 when outside the top 5 sold players", () => {
      const tournamentPlayers: TournamentSoldPlayerRankEntry[] = [
        { playerId: 10, soldPrice: 500000 },
        { playerId: 11, soldPrice: 400000 },
        { playerId: 12, soldPrice: 300000 },
        { playerId: 13, soldPrice: 200000 },
        { playerId: 14, soldPrice: 100000 },
        { playerId: 15, soldPrice: 50000 }, // our player (rank 6)
      ];

      const ranks = computeTournamentSoldRanks(tournamentPlayers);
      expect(ranks.get(15)).toBe(6);
      expect(isPlayerTop5InTournament(15, tournamentPlayers)).toBe(false);
    });
  });

  describe("7. Tied fifth-place price — ties are handled consistently", () => {
    it("includes all players tied at the fifth-highest price", () => {
      const tournamentPlayers: TournamentSoldPlayerRankEntry[] = [
        { playerId: 1, soldPrice: 500000 }, // Rank 1
        { playerId: 2, soldPrice: 400000 }, // Rank 2
        { playerId: 3, soldPrice: 300000 }, // Rank 3
        { playerId: 4, soldPrice: 200000 }, // Rank 4
        { playerId: 5, soldPrice: 100000 }, // Rank 5 (tied)
        { playerId: 6, soldPrice: 100000 }, // Rank 5 (tied with player 5)
        { playerId: 7, soldPrice: 50000 },  // Rank 7
      ];

      const ranks = computeTournamentSoldRanks(tournamentPlayers);
      expect(ranks.get(5)).toBe(5);
      expect(ranks.get(6)).toBe(5);
      expect(ranks.get(7)).toBe(7);

      expect(isPlayerTop5InTournament(5, tournamentPlayers)).toBe(true);
      expect(isPlayerTop5InTournament(6, tournamentPlayers)).toBe(true);
      expect(isPlayerTop5InTournament(7, tournamentPlayers)).toBe(false);
    });

    it("handles tournaments with fewer than 5 sold players", () => {
      const smallTournament: TournamentSoldPlayerRankEntry[] = [
        { playerId: 1, soldPrice: 80000 },
        { playerId: 2, soldPrice: 60000 },
        { playerId: 3, soldPrice: 40000 },
      ];

      const ranks = computeTournamentSoldRanks(smallTournament);
      expect(ranks.get(1)).toBe(1);
      expect(ranks.get(2)).toBe(2);
      expect(ranks.get(3)).toBe(3);

      expect(isPlayerTop5InTournament(1, smallTournament)).toBe(true);
      expect(isPlayerTop5InTournament(2, smallTournament)).toBe(true);
      expect(isPlayerTop5InTournament(3, smallTournament)).toBe(true);
    });
  });

  describe("8. Current tournament records are excluded", () => {
    it("excludes records matching currentTournamentId even if sold at highest price", () => {
      const currentTournamentId = 500;
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 500, tournamentName: "Current Tournament", tournamentStatus: "live", soldPrice: 1000000 },
        { playerId: 2, tournamentId: 200, tournamentName: "Past Tournament 1", tournamentStatus: "completed", soldPrice: 150000 },
        { playerId: 3, tournamentId: 300, tournamentName: "Past Tournament 2", tournamentStatus: "completed", soldPrice: 120000 },
      ];

      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(2);
      expect(result.some((r) => r.tournamentId === currentTournamentId)).toBe(false);
      expect(result[0]!.tournamentId).toBe(200);
      expect(result[1]!.tournamentId).toBe(300);
    });
  });

  describe("9. Multiple players with similar names do not get cross-linked", () => {
    it("returns empty history when identity keys (mobile/globalPlayerId) are missing, avoiding name-based cross-linking", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 42, tournamentId: 10, globalPlayerId: null, mobileNumber: "" },
              ]),
            }),
          }),
        }),
        execute: vi.fn(),
      };

      const history = await getPlayerAuctionPerformanceHistory({
        currentTournamentId: 10,
        playerId: 42,
        dbClient: mockDb,
      });

      expect(history).toEqual([]);
      // Should not execute query looking up other players by name
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe("10. Archived tournaments are handled correctly", () => {
    it("preserves records from archived tournaments", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 100, tournamentName: "Archived Cup 2024", tournamentStatus: "archived", soldPrice: 350000 },
        { playerId: 2, tournamentId: 200, tournamentName: "Completed Cup 2025", tournamentStatus: "completed", soldPrice: 200000 },
      ];

      const currentTournamentId = 300;
      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(2);
      expect(result[0]!.tournamentId).toBe(100);
      expect(result[0]!.tournamentStatus).toBe("archived");
      expect(result[0]!.soldPrice).toBe(350000);
    });
  });

  describe("11. Auction reset, undo, retained, and re-auctioned outcomes do not produce duplicate or stale records", () => {
    it("deduplicates multiple records for the same tournament to keep only the highest sold record", () => {
      const candidates: CandidateHistoricalRow[] = [
        // Suppose tournament 100 has 2 entries for this player (e.g. re-auction before reset)
        { playerId: 1, tournamentId: 100, tournamentName: "Tournament 100", tournamentStatus: "completed", soldPrice: 150000 },
        { playerId: 2, tournamentId: 100, tournamentName: "Tournament 100", tournamentStatus: "completed", soldPrice: 220000 },
        { playerId: 3, tournamentId: 200, tournamentName: "Tournament 200", tournamentStatus: "completed", soldPrice: 180000 },
      ];

      const currentTournamentId = 999;
      const result = processHistoricalAuctionCandidates(candidates, currentTournamentId, 3);

      expect(result).toHaveLength(2);
      const t100 = result.find((r) => r.tournamentId === 100);
      expect(t100).toBeDefined();
      expect(t100!.soldPrice).toBe(220000);
      expect(t100!.playerId).toBe(2);
    });
  });

  describe("12. API authorization and end-to-end service integration", () => {
    it("returns null when player does not exist in the requested tournament", async () => {
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const result = await getPlayerAuctionPerformanceHistory({
        currentTournamentId: 10,
        playerId: 99999,
        dbClient: mockDb,
      });

      expect(result).toBeNull();
    });

    it("correctly decorates records with TOP 5 STAR badge when DB returns is_top_5", async () => {
      let executeCount = 0;
      const mockDb: any = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 10, tournamentId: 1, globalPlayerId: "gp_test1", mobileNumber: "9876543210" },
              ]),
            }),
          }),
        }),
        execute: vi.fn().mockImplementation(() => {
          executeCount++;
          if (executeCount === 1) {
            return Promise.resolve({
              rows: [
                {
                  playerId: 101,
                  tournamentId: 20,
                  soldPrice: 500000,
                  tournamentName: "Premier League 2024",
                  tournamentStatus: "completed",
                  auctionUnit: "rupee",
                  tournamentDate: "2024-03-15",
                  buyingTeamName: "Mumbai Warriors",
                  buyingTeamColor: "#004BA0",
                },
                {
                  playerId: 102,
                  tournamentId: 30,
                  soldPrice: 150000,
                  tournamentName: "Super League 2024",
                  tournamentStatus: "completed",
                  auctionUnit: "points",
                  tournamentDate: "2024-05-10",
                  buyingTeamName: "Delhi Titans",
                  buyingTeamColor: "#D11D27",
                },
              ],
            });
          }
          return Promise.resolve({
            rows: [
              { player_id: 101, is_top_5: true },
              { player_id: 102, is_top_5: false },
            ],
          });
        }),
      };

      const result = await getPlayerAuctionPerformanceHistory({
        currentTournamentId: 1,
        playerId: 10,
        dbClient: mockDb,
      });

      expect(result).toHaveLength(2);
      expect(result![0]!.tournamentName).toBe("Premier League 2024");
      expect(result![0]!.soldPrice).toBe(500000);
      expect(result![0]!.isTop5).toBe(true);
      expect(result![0]!.top5BadgeText).toBe("🏆 TOP 5 STAR");
      expect(result![0]!.buyingTeamName).toBe("Mumbai Warriors");

      expect(result![1]!.tournamentName).toBe("Super League 2024");
      expect(result![1]!.soldPrice).toBe(150000);
      expect(result![1]!.isTop5).toBe(false);
      expect(result![1]!.top5BadgeText).toBeUndefined();
    });

    it("enforces organizer authorization on player auction history route", async () => {
      const app = express();
      let isAuth = false;
      const mockRequireOrganizer = vi.fn(async (_req, res, _tid) => {
        if (!isAuth) {
          res.status(401).json({ error: "Organizer authentication required" });
          return false;
        }
        return true;
      });

      app.get("/tournaments/:tournamentId/players/:playerId/auction-history", async (req, res) => {
        const tid = parseInt(req.params.tournamentId);
        const playerId = parseInt(req.params.playerId);
        if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
        if (!(await mockRequireOrganizer(req, res, tid))) return;
        res.json([{ tournamentName: "Past Tournament", soldPrice: 200000, isTop5: true }]);
      });

      // 1. Unauthorized call -> 401
      const unauthRes = await request(app).get("/tournaments/1/players/10/auction-history");
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.error).toContain("Organizer authentication required");

      // 2. Authorized call -> 200
      isAuth = true;
      const authRes = await request(app).get("/tournaments/1/players/10/auction-history");
      expect(authRes.status).toBe(200);
      expect(authRes.body).toHaveLength(1);
      expect(authRes.body[0].soldPrice).toBe(200000);
    });

    it("returns 400 for invalid tournamentId or playerId on player auction history route", async () => {
      const app = express();
      app.get("/tournaments/:tournamentId/players/:playerId/auction-history", async (req, res) => {
        const tid = parseInt(req.params.tournamentId);
        const playerId = parseInt(req.params.playerId);
        if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
        res.json([]);
      });

      const res1 = await request(app).get("/tournaments/abc/players/10/auction-history");
      expect(res1.status).toBe(400);

      const res2 = await request(app).get("/tournaments/1/players/xyz/auction-history");
      expect(res2.status).toBe(400);
    });
  });

  describe("11. Performance Summary: Best Sold vs Chronological Last Sold calculation", () => {
    it("independently derives bestSoldRecord (highest price) and lastSoldRecord (chronologically latest)", () => {
      // Player sold in 4 historical tournaments:
      // T1 (2023-01): 800,000 (Rank 1 / Top 5)
      // T2 (2024-05): 1,200,000 (Rank 2 / Top 5) -> Historically HIGHEST price
      // T3 (2024-11): 600,000 (Rank 4 / Top 5)
      // T4 (2025-03): 350,000 (Rank 8 / Not Top 5) -> Chronologically LATEST sale, but NOT in top 3 by price!
      const candidates: CandidateHistoricalRow[] = [
        {
          playerId: 101,
          tournamentId: 1,
          tournamentName: "Tournament 2023",
          tournamentStatus: "completed",
          soldPrice: 800000,
          buyingTeamName: "Warriors",
          tournamentDate: "2023-01-15",
        },
        {
          playerId: 102,
          tournamentId: 2,
          tournamentName: "Tournament 2024 Spring",
          tournamentStatus: "completed",
          soldPrice: 1200000,
          buyingTeamName: "Strikers",
          tournamentDate: "2024-05-10",
        },
        {
          playerId: 103,
          tournamentId: 3,
          tournamentName: "Tournament 2024 Winter",
          tournamentStatus: "completed",
          soldPrice: 600000,
          buyingTeamName: "Titans",
          tournamentDate: "2024-11-20",
        },
        {
          playerId: 104,
          tournamentId: 4,
          tournamentName: "Tournament 2025 Recent",
          tournamentStatus: "completed",
          soldPrice: 350000,
          buyingTeamName: "Royals",
          tournamentDate: "2025-03-01",
        },
      ];

      const top5Map = new Map<number, boolean>([
        [101, true],
        [102, true],
        [103, true],
        [104, false],
      ]);

      const currentTournamentId = 999;
      const summary = processHistoricalAuctionSummary(candidates, currentTournamentId, top5Map, 3);

      // Total sold appearances across previous tournaments
      expect(summary.totalSoldAppearances).toBe(4);

      // Top 3 records by soldPrice DESC: T2 (1.2M), T1 (800k), T3 (600k)
      expect(summary.records).toHaveLength(3);
      expect(summary.records[0]!.tournamentId).toBe(2);
      expect(summary.records[0]!.soldPrice).toBe(1200000);
      expect(summary.records[1]!.tournamentId).toBe(1);
      expect(summary.records[1]!.soldPrice).toBe(800000);
      expect(summary.records[2]!.tournamentId).toBe(3);
      expect(summary.records[2]!.soldPrice).toBe(600000);

      // BEST SOLD: strictly highest historical price (T2 at 1.2M)
      expect(summary.bestSoldRecord).not.toBeNull();
      expect(summary.bestSoldRecord!.tournamentId).toBe(2);
      expect(summary.bestSoldRecord!.soldPrice).toBe(1200000);
      expect(summary.bestSoldRecord!.isTop5).toBe(true);
      expect(summary.isBestTop5).toBe(true);

      // LAST SOLD: strictly chronologically latest (T4 at 350k in 2025), which is NOT in top 3 by price!
      expect(summary.lastSoldRecord).not.toBeNull();
      expect(summary.lastSoldRecord!.tournamentId).toBe(4);
      expect(summary.lastSoldRecord!.soldPrice).toBe(350000);
      expect(summary.lastSoldRecord!.buyingTeamName).toBe("Royals");
      expect(summary.lastSoldRecord!.isTop5).toBe(false);

      expect(summary.hasTop5Badge).toBe(true);
    });

    it("falls back to tournamentId descending when tournamentDate is missing or identical", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 10, tournamentName: "Older T", tournamentStatus: "completed", soldPrice: 500000 },
        { playerId: 2, tournamentId: 20, tournamentName: "Newer T", tournamentStatus: "completed", soldPrice: 200000 },
      ];

      const summary = processHistoricalAuctionSummary(candidates, 999, new Map());

      expect(summary.bestSoldRecord!.tournamentId).toBe(10);
      expect(summary.bestSoldRecord!.soldPrice).toBe(500000);

      expect(summary.lastSoldRecord!.tournamentId).toBe(20);
      expect(summary.lastSoldRecord!.soldPrice).toBe(200000);
    });

    it("excludes active tournament and non-positive prices from both best and last sold records", () => {
      const candidates: CandidateHistoricalRow[] = [
        { playerId: 1, tournamentId: 10, tournamentName: "Past T", tournamentStatus: "completed", soldPrice: 300000 },
        { playerId: 2, tournamentId: 999, tournamentName: "Active Current T", tournamentStatus: "live", soldPrice: 1000000 },
        { playerId: 3, tournamentId: 20, tournamentName: "Unsold Past T", tournamentStatus: "completed", soldPrice: 0 },
      ];

      const summary = processHistoricalAuctionSummary(candidates, 999, new Map());

      expect(summary.totalSoldAppearances).toBe(1);
      expect(summary.records).toHaveLength(1);
      expect(summary.bestSoldRecord!.tournamentId).toBe(10);
      expect(summary.lastSoldRecord!.tournamentId).toBe(10);
    });

    it("returns null bestSoldRecord and lastSoldRecord when player has no valid history", () => {
      const summary = processHistoricalAuctionSummary([], 999, new Map());

      expect(summary.records).toEqual([]);
      expect(summary.totalSoldAppearances).toBe(0);
      expect(summary.bestSoldRecord).toBeNull();
      expect(summary.lastSoldRecord).toBeNull();
      expect(summary.hasTop5Badge).toBe(false);
      expect(summary.isBestTop5).toBe(false);
    });
  });

  describe("12. Tournament Feature Toggles & Master/Sub-toggle Hierarchy", () => {
    it("pre-enables all live auction history surfaces by default when features are missing or empty", () => {
      expect(isLiveAuctionHistoryEnabled(null)).toBe(true);
      expect(isLiveAuctionHistoryEnabled({})).toBe(true);
      expect(isOwnerAppHistoryEnabled(null)).toBe(true);
      expect(isOwnerAppHistoryEnabled({})).toBe(true);
      expect(isObsHistoryEnabled(null)).toBe(true);
      expect(isObsHistoryEnabled({})).toBe(true);
      expect(isLedHistoryEnabled(null)).toBe(true);
      expect(isLedHistoryEnabled({})).toBe(true);
    });

    it("disables all surfaces when master toggle liveAuctionHistory is false", () => {
      const features = {
        liveAuctionHistory: false,
        ownerAppHistory: true,
        obsHistory: true,
        ledHistory: true,
      };

      expect(isLiveAuctionHistoryEnabled(features)).toBe(false);
      expect(isOwnerAppHistoryEnabled(features)).toBe(false);
      expect(isObsHistoryEnabled(features)).toBe(false);
      expect(isLedHistoryEnabled(features)).toBe(false);
    });

    it("respects individual surface toggles when master toggle is true", () => {
      // OBS toggled OFF, but Owner App and LED remain ON
      const features = {
        liveAuctionHistory: true,
        ownerAppHistory: true,
        obsHistory: false,
        ledHistory: true,
      };

      expect(isLiveAuctionHistoryEnabled(features)).toBe(true);
      expect(isOwnerAppHistoryEnabled(features)).toBe(true);
      expect(isObsHistoryEnabled(features)).toBe(false);
      expect(isLedHistoryEnabled(features)).toBe(true);
    });

    it("normalizes resolved features with safe defaults", () => {
      const resolved = resolveTournamentFeatures({});
      expect(resolved.liveAuctionHistory).toBe(true);
      expect(resolved.ownerAppHistory).toBe(true);
      expect(resolved.obsHistory).toBe(true);
      expect(resolved.ledHistory).toBe(true);
    });
  });
});
