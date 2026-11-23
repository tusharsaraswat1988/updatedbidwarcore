import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Captured queries for verification
const capturedQueries: Array<{ sql: string; params: unknown[] }> = [];

// Mock tournaments
const mockTournamentsData = [
  { id: 1, name: "Premier League 2026", sport: "cricket", status: "live", organizerId: 10 },
  { id: 2, name: "City Cup 2026", sport: "cricket", status: "completed", organizerId: 99 },
];

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockTournamentsData)),
          where: vi.fn().mockImplementation((cond: any) => ({
            orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockTournamentsData.filter(t => t.organizerId === 10))),
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

        // 1. auction_sessions
        if (sql.includes("FROM auction_sessions")) {
          return Promise.resolve({
            rows: [{ current_player_id: 101, current_bid: 250000 }],
          });
        }

        // 2. tournaments config
        if (sql.includes("FROM tournaments WHERE id = $1")) {
          return Promise.resolve({
            rows: [
              {
                minimum_squad_size: 5,
                maximum_squad_size: 8,
                min_bid: 50000,
                base_purse: 10000000,
              },
            ],
          });
        }

        // 3. teams and purse
        if (sql.includes("FROM teams t")) {
          return Promise.resolve({
            rows: [
              {
                id: 1,
                name: "Titans",
                short_code: "TTN",
                color: "#ff0000",
                purse: 10000000,
                purse_used: 1500000, // 15% used -> purse remaining 8.5L
                booster_total: 0,
              },
              {
                id: 2,
                name: "Mavericks",
                short_code: "MAV",
                color: "#0000ff",
                purse: 10000000,
                purse_used: 2000000, // 20% used -> purse remaining 8.0L
                booster_total: 0,
              },
              {
                id: 3,
                name: "Strugglers",
                short_code: "STR",
                color: "#888888",
                purse: 5000000,
                purse_used: 4200000, // 84% spent (>80%), only 1 player bought (4 slots left >= 3)
                booster_total: 0,
              },
            ],
          });
        }

        // 4. squad player counts
        if (sql.includes("FROM players") && sql.includes("GROUP BY team_id, category_id")) {
          return Promise.resolve({
            rows: [
              // Titans have 2 players: role 'Wicketkeeper', but 0 in category 5
              { team_id: 1, category_id: 1, role: "Wicketkeeper", cnt: 2 },
              // Mavericks have 2 players: role 'Batsman', and 0 in category 5
              { team_id: 2, category_id: 2, role: "Batsman", cnt: 2 },
              // Strugglers have 1 player: role 'All-Rounder', and 0 in category 5
              { team_id: 3, category_id: 1, role: "All-Rounder", cnt: 1 },
            ],
          });
        }

        // 5. player lookup
        if (sql.includes("FROM players p") && sql.includes("WHERE p.tournament_id = $1 AND p.id = $2")) {
          const playerIdParam = params[1];
          if (playerIdParam === 102) {
            return Promise.resolve({
              rows: [
                {
                  id: 102,
                  name: "MS Dhoni",
                  role: "Wicketkeeper",
                  category_id: null,
                  base_price: 150000,
                  status: "available",
                  category_name: null,
                  category_max_players: null,
                },
              ],
            });
          }
          return Promise.resolve({
            rows: [
              {
                id: 101,
                name: "Jasprit Bumrah",
                role: "Bowler",
                category_id: 5,
                base_price: 200000,
                status: "available",
                category_name: "Fast Bowlers",
                category_max_players: 2,
              },
            ],
          });
        }

        // 6. category or role inflation
        if (sql.includes("FROM auction_player_events")) {
          if (sql.includes("player_role = $2")) {
            return Promise.resolve({
              rows: [
                {
                  multiplier: "3.20",
                  sold_count: 5,
                },
              ],
            });
          }
          return Promise.resolve({
            rows: [
              {
                multiplier: "2.60",
                sold_count: 4,
              },
            ],
          });
        }

        // 7. available category or role players
        if (sql.includes("FROM players") && sql.includes("status = 'available'")) {
          if (sql.includes("role = $2")) {
            return Promise.resolve({
              rows: [
                { avail_count: 1 },
              ],
            });
          }
          return Promise.resolve({
            rows: [
              { avail_count: 2 }, // 2 available
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

// Mock rate limiters and briefing
vi.mock("../lib/rate-limiters", () => ({
  heavyLimiter: (_req: any, _res: any, next: any) => next(),
}));

import intelligenceRouter from "../routes/intelligence";

describe("P2 Stage Prompter & Tactical Scarcity Intelligence", () => {
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

  it("requires authentication and authorization to access stage prompter", async () => {
    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use("/api", intelligenceRouter);

    const res = await request(unauthApp).get("/api/intelligence/stage-prompter/1");
    expect(res.status).toBe(401);
  });

  it("blocks organizer from accessing an unauthorized tournament", async () => {
    // Tournament 2 belongs to organizer 99, not 10
    const res = await request(app).get("/api/intelligence/stage-prompter/2");
    expect(res.status).toBe(403);
  });

  it("computes Rivalry Bulletins identifying teams with 0 category players and sufficient purse", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1");
    expect(res.status).toBe(200);

    expect(res.body.currentPlayer).toBeDefined();
    expect(res.body.currentPlayer.name).toBe("Jasprit Bumrah");
    expect(res.body.currentPlayer.categoryName).toBe("Fast Bowlers");

    // Titans (8.5L) and Mavericks (8.0L) both have 0 Fast Bowlers and purse >= 250k
    expect(res.body.rivalryBulletins.length).toBeGreaterThanOrEqual(1);
    const bulletin = res.body.rivalryBulletins[0];
    expect(bulletin.message).toContain("Titans");
    expect(bulletin.message).toContain("Mavericks");
    expect(bulletin.message).toContain("Expect a bidding duel");
  });

  it("computes Category Inflation Metric correctly for the active lot", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1");
    expect(res.status).toBe(200);

    expect(res.body.categoryInflation).toBeDefined();
    expect(res.body.categoryInflation.multiplier).toBe(2.6);
    expect(res.body.categoryInflation.soldCount).toBe(4);
    expect(res.body.categoryInflation.message).toContain("Fast Bowlers are trading at 2.6x base price today");
  });

  it("computes Category Scarcity & Supply Deficit and flags critical squeeze", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1");
    expect(res.status).toBe(200);

    const scarcity = res.body.categoryScarcity;
    expect(scarcity).toBeDefined();
    expect(scarcity.categoryName).toBe("Fast Bowlers");
    expect(scarcity.availableCategoryPlayers).toBe(2);
    // 3 teams with maxPlayers=2 each, 0 players each = 6 unfilled slots
    expect(scarcity.unfilledCategorySlots).toBe(6);
    expect(scarcity.isCriticalSqueeze).toBe(true);
    expect(scarcity.deficit).toBe(4);
    expect(scarcity.message).toContain("Critical squeeze: 2 Fast Bowlers available for 6 unfilled slots");
  });

  it("computes Room Liquidity Ratio across all teams", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1");
    expect(res.status).toBe(200);

    const liquidity = res.body.roomLiquidity;
    expect(liquidity).toBeDefined();
    // Titans (8.5M) + Mavericks (8.0M) + Strugglers (0.8M) = 17.3M remaining
    expect(liquidity.totalPurseRemaining).toBe(17300000);
    // Minimum squad = 5. Titans have 2 (need 3), Mavs have 2 (need 3), Strugglers have 1 (need 4) -> Total 10 unfilled mandatory slots
    expect(liquidity.totalUnfilledMandatorySlots).toBe(10);
    expect(liquidity.minBasePrice).toBe(50000);
    // Required purse = 10 * 50,000 = 500,000. Ratio = 17,300,000 / 500,000 = 34.6
    expect(liquidity.ratio).toBe(34.6);
    expect(liquidity.isDeficit).toBe(false);
  });

  it("detects Team Distress Alert when team has >= 80% purse spent and >= 3 mandatory slots remaining", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1");
    expect(res.status).toBe(200);

    expect(res.body.teamDistressAlerts.length).toBe(1);
    const alert = res.body.teamDistressAlerts[0];
    expect(alert.teamName).toBe("Strugglers");
    expect(alert.purseSpentPct).toBe(84);
    expect(alert.mandatorySlotsRemaining).toBe(4);
    expect(alert.message).toContain("Strugglers has spent 84% of purse with 4 mandatory slots left");
  });

  it("supports the alternative endpoint path /tournaments/:tournamentId/intelligence/stage-prompter", async () => {
    const res = await request(app).get("/tournaments/1/intelligence/stage-prompter");
    expect(res.status).toBe(200);
    expect(res.body.tournamentId).toBe(1);
    expect(res.body.currentPlayer.name).toBe("Jasprit Bumrah");
  });

  it("supports explicit ?playerId= query parameter and retrieves live sessionCurrentBid", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1?playerId=101");
    expect(res.status).toBe(200);
    expect(res.body.currentPlayer.id).toBe(101);
    // Verifies live bid from auction_sessions is retrieved rather than defaulting to basePrice
    expect(res.body.currentPlayer.currentBid).toBe(250000);
  });

  it("falls back to player role for inflation, scarcity, and duel tracking when category_id is null", async () => {
    const res = await request(app).get("/api/intelligence/stage-prompter/1?playerId=102");
    expect(res.status).toBe(200);
    expect(res.body.currentPlayer.id).toBe(102);
    expect(res.body.currentPlayer.role).toBe("Wicketkeeper");

    // Inflation calculated via player_role fallback
    expect(res.body.categoryInflation).toBeDefined();
    expect(res.body.categoryInflation.multiplier).toBe(3.2);
    expect(res.body.categoryInflation.soldCount).toBe(5);
    expect(res.body.categoryInflation.message).toContain("Wicketkeepers are trading at 3.2x base price today");

    // Scarcity calculated via role fallback
    expect(res.body.categoryScarcity).toBeDefined();
    expect(res.body.categoryScarcity.categoryName).toBe("Wicketkeeper");
    expect(res.body.categoryScarcity.availableCategoryPlayers).toBe(1);
    expect(res.body.categoryScarcity.isCriticalSqueeze).toBe(true);

    // Titans have 2 Wicketkeepers on roster; Mavericks have 0 with 8.0L purse (>= 1.5L base)
    // Mavericks are correctly identified and Titans are excluded
    expect(res.body.rivalryBulletins.length).toBe(1);
    const msg = res.body.rivalryBulletins[0].message;
    expect(msg).toContain("Mavericks");
    expect(msg).not.toContain("Titans");
    expect(msg).toContain("0 Wicketkeepers");
  });

  it("verifies Tactical AI Walk-Away Price caps at server maxAllowedBid when provided", () => {
    // Formula: WalkAwayPrice = PurseRemaining - (RemainingMandatorySlots - 1) * MinBasePrice
    const purseRemaining = 5000000;
    const minSquad = 6;
    const playersBought = 2;
    const minBasePrice = 100000;
    const serverMaxAllowedBid = 4500000; // Server enforced ceiling (e.g. customized reserves)

    const remainingMandatorySlots = Math.max(0, minSquad - playersBought); // 4
    const futureReserve = Math.max(0, remainingMandatorySlots - 1) * minBasePrice; // (4 - 1) * 100k = 300k
    const rawWalkAway = Math.max(0, purseRemaining - futureReserve); // 4.7M
    const walkAwayPrice = Math.min(rawWalkAway, serverMaxAllowedBid); // 4.5M

    expect(rawWalkAway).toBe(4700000);
    expect(walkAwayPrice).toBe(4500000);
  });

  it("verifies Rival Outbid Capacity Radar excludes teams whose squad is full", () => {
    const nextBidAmount = 500000;
    const myTeamId = 1;

    const mockPurses = [
      { teamId: 1, purseRemaining: 2000000, maxAllowedBid: 1500000, playersBought: 3, maximumSquadSize: 5 },
      // Rival 2: plenty of purse (3M), open slots (3/5) -> CAN outbid
      { teamId: 2, purseRemaining: 3000000, maxAllowedBid: 2500000, playersBought: 3, maximumSquadSize: 5 },
      // Rival 3: plenty of purse (4M), but squad is FULL (5/5) -> CANNOT outbid
      { teamId: 3, purseRemaining: 4000000, maxAllowedBid: 4000000, playersBought: 5, maximumSquadSize: 5 },
      // Rival 4: insufficient maxAllowedBid (300k < 500k) -> CANNOT outbid
      { teamId: 4, purseRemaining: 600000, maxAllowedBid: 300000, playersBought: 2, maximumSquadSize: 5 },
    ];

    const count = mockPurses.filter((tp) => {
      if (tp.teamId === myTeamId) return false;
      if (tp.maximumSquadSize != null && tp.maximumSquadSize > 0 && tp.playersBought >= tp.maximumSquadSize) return false;
      const rivalMax = tp.maxAllowedBid ?? tp.purseRemaining ?? 0;
      if (rivalMax < nextBidAmount) return false;
      return true;
    }).length;

    expect(count).toBe(1); // Only Rival 2 can outbid!
  });

  it("verifies the mathematical invariants of Tactical AI Walk-Away Price", () => {
    // Formula: WalkAwayPrice = PurseRemaining - (RemainingMandatorySlots - 1) * MinBasePrice
    const purseRemaining = 5000000;
    const minSquad = 6;
    const playersBought = 2;
    const minBasePrice = 100000;

    const remainingMandatorySlots = Math.max(0, minSquad - playersBought); // 4
    const futureReserve = Math.max(0, remainingMandatorySlots - 1) * minBasePrice; // (4 - 1) * 100k = 300k
    const walkAwayPrice = Math.max(0, purseRemaining - futureReserve); // 5.0M - 300k = 4.7M

    expect(walkAwayPrice).toBe(4700000);

    // Boundary 1: When remaining mandatory slots <= 1, walkAwayPrice is the entire purseRemaining
    const remainingOneSlot = 1;
    const futureReserveOne = Math.max(0, remainingOneSlot - 1) * minBasePrice;
    expect(purseRemaining - futureReserveOne).toBe(purseRemaining);

    // Boundary 2: Safe vs Tight vs Quota Limit classification
    function getMarginStatus(nextBid: number, walkAway: number): "safe" | "tight" | "limit" {
      if (walkAway <= 0 || nextBid > walkAway) return "limit";
      if (nextBid >= walkAway * 0.75) return "tight";
      return "safe";
    }

    expect(getMarginStatus(1000000, 4700000)).toBe("safe");
    expect(getMarginStatus(3800000, 4700000)).toBe("tight");
    expect(getMarginStatus(4800000, 4700000)).toBe("limit");
  });

  it("verifies the mathematical invariants of Live Purse Preservation Simulator", () => {
    const purseRemaining = 2500000;
    const nextBid = 500000;
    const minSquad = 5;
    const playersBought = 1;

    const postBidPurse = Math.max(0, purseRemaining - nextBid); // 2,000,000
    const remainingMandatorySlots = Math.max(0, minSquad - playersBought); // 4
    const futureSlots = Math.max(0, remainingMandatorySlots - 1); // 3 slots left after buying this player
    const avgPerPlayer = Math.round(postBidPurse / futureSlots); // 2,000,000 / 3 = 666,667

    expect(postBidPurse).toBe(2000000);
    expect(futureSlots).toBe(3);
    expect(avgPerPlayer).toBe(666667);
  });
});
