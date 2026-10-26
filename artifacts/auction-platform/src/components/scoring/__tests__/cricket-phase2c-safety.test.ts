/**
 * BIDWAR CRICKET — PHASE 2C DESIGN CONSISTENCY & LIVE PLAYER DATA SAFETY TESTS
 */

import { describe, expect, it } from "vitest";
import {
  resolveBatterView,
  resolveBowlerView,
} from "@/lib/cricket-obs-view-model";
import type { CricketScorerPlayer } from "@/lib/scoring-squad";
import type { CricketFullScorecard } from "@workspace/scoring-core";

const mockPlayers: CricketScorerPlayer[] = [
  { id: 101, name: "Virat Kohli", role: "Top Order Batter" },
  { id: 102, name: "Rohit Sharma", role: "Opening Batter" },
  { id: 201, name: "Jasprit Bumrah", role: "Right-Arm Fast" },
];

const mockScorecard: CricketFullScorecard = {
  matchId: 10,
  tournamentId: 5,
  innings: [
    {
      innings: 1,
      battingTeamId: 1,
      bowlingTeamId: 2,
      runs: 45,
      wickets: 1,
      overs: "4.2",
      batting: [
        {
          playerId: 101,
          runs: 35,
          balls: 20,
          fours: 4,
          sixes: 1,
          strikeRate: 175.0,
          isOut: false,
          dismissal: null,
          bowlerId: null,
          fielderId: null,
        },
        {
          playerId: 102,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0.0,
          isOut: false,
          dismissal: null,
          bowlerId: null,
          fielderId: null,
        },
      ],
      bowling: [
        {
          playerId: 201,
          overs: "2.2",
          maidens: 0,
          runs: 18,
          wickets: 1,
          economy: 7.71,
          dots: 6,
          wides: 0,
          noBalls: 0,
        },
      ],
      fallOfWickets: [],
    },
  ],
};

describe("BIDWAR CRICKET — PHASE 2C PLAYER STAT FALLBACK SAFETY", () => {
  it("A. When scorecard is pending/null, resolveBatterView flags hasStats: false and does not fabricate zero stats", () => {
    const result = resolveBatterView(101, true, mockPlayers, null, 1);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Virat Kohli");
    expect(result?.hasStats).toBe(false);
  });

  it("B. When scorecard is loaded, resolveBatterView resolves authoritative stats with hasStats: true", () => {
    const result = resolveBatterView(101, true, mockPlayers, mockScorecard, 1);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Virat Kohli");
    expect(result?.hasStats).toBe(true);
    expect(result?.runs).toBe(35);
    expect(result?.balls).toBe(20);
    expect(result?.fours).toBe(4);
    expect(result?.sixes).toBe(1);
    expect(result?.strikeRate).toBe(175.0);
  });

  it("C. When a new batter arrives at crease with 0 runs 0 balls, legitimate 0 runs are authoritative (hasStats: true)", () => {
    const result = resolveBatterView(102, false, mockPlayers, mockScorecard, 1);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Rohit Sharma");
    expect(result?.hasStats).toBe(true);
    expect(result?.runs).toBe(0);
    expect(result?.balls).toBe(0);
  });

  it("D. When scorecard is pending/null, resolveBowlerView flags hasStats: false", () => {
    const result = resolveBowlerView(201, mockPlayers, null, 1);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Jasprit Bumrah");
    expect(result?.hasStats).toBe(false);
  });

  it("E. When scorecard is loaded, resolveBowlerView resolves authoritative figures with hasStats: true", () => {
    const result = resolveBowlerView(201, mockPlayers, mockScorecard, 1);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Jasprit Bumrah");
    expect(result?.hasStats).toBe(true);
    expect(result?.overs).toBe("2.2");
    expect(result?.wickets).toBe(1);
    expect(result?.runsConceded).toBe(18);
    expect(result?.economy).toBe(7.71);
  });
});
