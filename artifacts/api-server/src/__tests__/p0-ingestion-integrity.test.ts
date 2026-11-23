import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logManualSellBoundaryEvents,
  logPlayerAuctionEnd,
  logPlayerAuctionStart,
} from "../lib/auction-logger";
import { computeInferredContenderCount } from "../lib/auction-contenders";
import {
  auctionPlayerEventsTable,
  auctionBidEventsTable,
  auctionSessionsTable,
  teamsTable,
  categoriesTable,
  playersTable,
  purseBoostersTable,
} from "@workspace/db";
import fs from "node:fs";
import path from "node:path";

// Mock DB for unit verification
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

let mockTeamsData: any[] = [];
let mockBoostersData: any[] = [];
let mockCategoriesData: any[] = [];
let mockPlayersData: any[] = [];
let mockBidEventsData: any[] = [];
let mockPlayerEventsData: any[] = [];

vi.mock("@workspace/db", async () => {
  const actual = await vi.importActual<any>("@workspace/db");
  return {
    ...actual,
    db: {
      insert: (table: any) => ({
        values: (vals: any) => {
          mockDbInsert(table, vals);
          return Promise.resolve();
        },
      }),
      select: (...args: any[]) => ({
        from: (table: any) => ({
          where: vi.fn().mockImplementation((condition: any) => {
            mockDbSelect(table, condition);

            if (table === teamsTable) {
              return Promise.resolve(mockTeamsData);
            }
            if (table === categoriesTable) {
              return Promise.resolve(mockCategoriesData);
            }
            if (table === playersTable) {
              return Promise.resolve(mockPlayersData);
            }
            if (table === purseBoostersTable) {
              return {
                groupBy: () => Promise.resolve(mockBoostersData),
              };
            }
            if (table === auctionBidEventsTable) {
              const val = mockBidEventsData.length;
              return Promise.resolve([{ value: val }]);
            }
            if (table === auctionPlayerEventsTable) {
              return {
                orderBy: () => ({
                  limit: () => Promise.resolve(mockPlayerEventsData),
                }),
                then: (fn: any) => Promise.resolve(fn(mockPlayerEventsData)),
              };
            }

            return {
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
              then: (fn: any) => Promise.resolve(fn([])),
            };
          }),
        }),
      }),
      selectDistinct: () => ({
        from: () => ({
          where: () => Promise.resolve(mockBidEventsData.map((b) => ({ teamId: b.teamId }))),
        }),
      }),
      update: (table: any) => ({
        set: (vals: any) => ({
          where: (condition: any) => {
            mockDbUpdate(table, vals, condition);
            return Promise.resolve();
          },
        }),
      }),
    },
  };
});

describe("P0: Ingestion Integrity Blueprint Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamsData = [];
    mockBoostersData = [];
    mockCategoriesData = [];
    mockPlayersData = [];
    mockBidEventsData = [];
    mockPlayerEventsData = [];
  });

  describe("1. Synthetic Boundary Logging in Manual Sell", () => {
    it("generates two boundary events with correct sequence, amounts, timestamps, and flags", async () => {
      const playerStartedAt = new Date("2026-03-01T10:00:00Z");
      const hammerTime = new Date("2026-03-01T10:02:30Z");

      await logManualSellBoundaryEvents({
        tournamentId: 101,
        playerId: 55,
        globalPlayerId: "mem_abc",
        winnerTeamId: 7,
        sport: "cricket",
        basePrice: 100_000,
        finalAmount: 450_000,
        playerStartedAt,
        now: hammerTime,
      });

      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const insertedTable = mockDbInsert.mock.calls[0][0];
      const insertedRows = mockDbInsert.mock.calls[0][1];

      expect(insertedTable).toBe(auctionBidEventsTable);
      expect(insertedRows).toHaveLength(2);

      // Event 1 (Opening Lot)
      const event1 = insertedRows[0];
      expect(event1.tournamentId).toBe(101);
      expect(event1.playerId).toBe(55);
      expect(event1.globalPlayerId).toBe("mem_abc");
      expect(event1.teamId).toBe(7);
      expect(event1.sport).toBe("cricket");
      expect(event1.bidAmount).toBe(100_000);
      expect(event1.previousBidAmount).toBeNull();
      expect(event1.bidIncrement).toBe(100_000);
      expect(event1.bidSequenceNumber).toBe(1);
      expect(event1.isManualBid).toBe(true);
      expect(event1.becameLeader).toBe(false);
      expect(event1.timestamp).toEqual(playerStartedAt);

      // Event 2 (Winning Hammer)
      const event2 = insertedRows[1];
      expect(event2.tournamentId).toBe(101);
      expect(event2.playerId).toBe(55);
      expect(event2.globalPlayerId).toBe("mem_abc");
      expect(event2.teamId).toBe(7);
      expect(event2.sport).toBe("cricket");
      expect(event2.bidAmount).toBe(450_000);
      expect(event2.previousBidAmount).toBe(100_000);
      expect(event2.bidIncrement).toBe(350_000); // 450k - 100k
      expect(event2.bidSequenceNumber).toBe(2);
      expect(event2.isManualBid).toBe(true);
      expect(event2.becameLeader).toBe(true);
      expect(event2.timestamp).toEqual(hammerTime);
      expect(event2.millisecondsSinceLastBid).toBe(150_000); // 2m 30s
    });

    it("handles null playerStartedAt by defaulting to now", async () => {
      const now = new Date("2026-03-01T12:00:00Z");

      await logManualSellBoundaryEvents({
        tournamentId: 101,
        playerId: 56,
        winnerTeamId: 8,
        sport: "badminton",
        basePrice: 0,
        finalAmount: 50_000,
        playerStartedAt: null,
        now,
      });

      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const insertedRows = mockDbInsert.mock.calls[0][1];
      expect(insertedRows[0].bidAmount).toBe(0);
      expect(insertedRows[0].bidSequenceNumber).toBe(1);
      expect(insertedRows[0].timestamp).toEqual(now);
      expect(insertedRows[1].bidAmount).toBe(50_000);
      expect(insertedRows[1].bidIncrement).toBe(50_000);
      expect(insertedRows[1].bidSequenceNumber).toBe(2);
      expect(insertedRows[1].timestamp).toEqual(now);
      expect(insertedRows[1].millisecondsSinceLastBid).toBe(0);
    });
  });

  describe("2. Inferred Contender Matrix (ICM) Calculation", () => {
    it("returns Math.max(1, count) = 1 when no teams exist", async () => {
      mockTeamsData = [];
      const count = await computeInferredContenderCount(999, {
        categoryId: 1,
        finalAmount: 100_000,
      });
      expect(count).toBe(1);
    });

    it("evaluates team purse and category limits accurately", async () => {
      // 3 teams:
      // Team 1: purse 500k, purseUsed 100k (remaining 400k) -> qualifies for 200k
      // Team 2: purse 300k, purseUsed 250k (remaining 50k) -> fails for 200k
      // Team 3: purse 200k, purseUsed 100k (remaining 100k) + booster 150k (remaining 250k) -> qualifies for 200k
      mockTeamsData = [
        { id: 1, purse: 500_000, purseUsed: 100_000 },
        { id: 2, purse: 300_000, purseUsed: 250_000 },
        { id: 3, purse: 200_000, purseUsed: 100_000 },
      ];
      mockBoostersData = [{ teamId: 3, total: 150_000 }];
      mockCategoriesData = [{ maxPlayers: 2 }];

      // Team 1 has 1 player in category 10
      // Team 3 has 2 players, but 1 is non-playing member -> active category count is 1 < 2 -> has open slot
      mockPlayersData = [
        { id: 101, teamId: 1, isNonPlayingMember: false },
        { id: 102, teamId: 3, isNonPlayingMember: false },
        { id: 103, teamId: 3, isNonPlayingMember: true },
      ];

      const count = await computeInferredContenderCount(101, {
        categoryId: 10,
        finalAmount: 200_000,
      });

      // Team 1 qualifies (400k >= 200k, 1/2 slots)
      // Team 2 fails (50k < 200k)
      // Team 3 qualifies (250k >= 200k, 1/2 slots because non-playing member is excluded)
      expect(count).toBe(2);
    });

    it("excludes teams with maxed-out category slots even if they have purse", async () => {
      mockTeamsData = [{ id: 1, purse: 1_000_000, purseUsed: 0 }];
      mockCategoriesData = [{ maxPlayers: 1 }];
      mockPlayersData = [{ id: 101, teamId: 1, isNonPlayingMember: false }];

      const count = await computeInferredContenderCount(101, {
        categoryId: 5,
        finalAmount: 100_000,
      });

      // Contenders = 0, but Math.max(1, 0) guarantees minimum 1
      expect(count).toBe(1);
    });
  });

  describe("3. Auction Duration Rectification & Bid Event Isolation", () => {
    it("computes duration and averageSecsBetweenBids when auctionStartedAt is provided", async () => {
      const startedAt = new Date(Date.now() - 60_000); // 60s ago
      mockBidEventsData = [{ id: 1 }, { id: 2 }]; // 2 bids

      logPlayerAuctionEnd({
        tournamentId: 101,
        playerId: 99,
        sport: "cricket",
        playerName: "Test Player",
        basePrice: 100_000,
        playerSnapshotJson: "{}",
        outcome: "sold",
        finalAmount: 200_000,
        soldToTeamId: 3,
        auctionStartedAt: startedAt,
        interestedTeamsCount: 4,
      });

      // Wait a tick for the fire-and-forget promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockDbInsert).toHaveBeenCalled();
      const calls = mockDbInsert.mock.calls.filter((c) => c[0] === auctionPlayerEventsTable);
      expect(calls.length).toBeGreaterThanOrEqual(1);

      const insertedRow = calls[calls.length - 1][1];
      expect(insertedRow.auctionStartedAt).toEqual(startedAt);
      expect(insertedRow.auctionDurationSeconds).toBeGreaterThanOrEqual(59);
      expect(insertedRow.auctionDurationSeconds).toBeLessThanOrEqual(62);
      expect(insertedRow.averageSecsBetweenBids).toBeGreaterThanOrEqual(29);
      expect(insertedRow.interestedTeamsCount).toBe(4);
      expect(insertedRow.isSuperseded).toBe(false);
    });

    it("falls back to querying in_progress record when auctionStartedAt is not passed", async () => {
      const inProgressStartedAt = new Date(Date.now() - 30_000);
      mockPlayerEventsData = [{ startedAt: inProgressStartedAt }];
      mockBidEventsData = [{ id: 1 }];

      logPlayerAuctionEnd({
        tournamentId: 101,
        playerId: 100,
        sport: "cricket",
        playerName: "Fallback Player",
        basePrice: 50_000,
        playerSnapshotJson: "{}",
        outcome: "sold",
        finalAmount: 150_000,
        soldToTeamId: 2,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockDbInsert).toHaveBeenCalled();
      const calls = mockDbInsert.mock.calls.filter((c) => c[0] === auctionPlayerEventsTable);
      const insertedRow = calls[calls.length - 1][1];
      expect(insertedRow.auctionStartedAt).toEqual(inProgressStartedAt);
      expect(insertedRow.auctionDurationSeconds).toBeGreaterThanOrEqual(29);
      expect(insertedRow.outcome).toBe("sold");
      expect(insertedRow.isSuperseded).toBe(false);
    });
  });

  describe("4. Schema, Migration & Lifecycle Safety (isSuperseded & current_player_started_at)", () => {
    it("has isSuperseded column defined in auctionPlayerEventsTable", () => {
      expect(auctionPlayerEventsTable.isSuperseded).toBeDefined();
      expect(auctionPlayerEventsTable.isSuperseded.name).toBe("is_superseded");
    });

    it("has currentPlayerStartedAt column defined in auctionSessionsTable", () => {
      expect(auctionSessionsTable.currentPlayerStartedAt).toBeDefined();
      expect(auctionSessionsTable.currentPlayerStartedAt.name).toBe("current_player_started_at");
    });

    it("ensures migration 0043 exists and contains DDL for both columns", () => {
      const migrationFile = path.resolve(
        __dirname,
        "../../../../lib/db/migrations/0043_p0_auction_ingestion_integrity.sql",
      );
      expect(fs.existsSync(migrationFile)).toBe(true);
      const content = fs.readFileSync(migrationFile, "utf8");
      expect(content).toContain("current_player_started_at");
      expect(content).toContain("is_superseded");
      expect(content).toContain("ix_auction_player_events_superseded");
    });
  });
});
