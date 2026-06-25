import { describe, expect, it } from "vitest";
import { pickManOfTheMatch, type MomCandidate } from "../cricket/mom";
import type { PlayerMatchStatsInput } from "../cricket/leaderboard";

function row(
  playerId: number,
  teamId: number,
  batting?: { runs: number; balls?: number },
  bowling?: { wickets: number; runs?: number },
): PlayerMatchStatsInput {
  return {
    matchId: 1,
    playerId,
    teamId,
    innings: 1,
    batting: batting
      ? {
          playerId,
          runs: batting.runs,
          balls: batting.balls ?? batting.runs,
          fours: 0,
          sixes: 0,
          strikeRate: 100,
          notOut: false,
          dismissalType: "caught",
          dismissedByPlayerId: null,
          fielderId: null,
        }
      : null,
    bowling: bowling
      ? {
          playerId,
          overs: "4.0",
          maidens: 0,
          runs: bowling.runs ?? 20,
          wickets: bowling.wickets,
          wides: 0,
          noBalls: 0,
          economy: 5,
        }
      : null,
    fielding: { catches: 0, runOuts: 0, stumpings: 0 },
  };
}

describe("pickManOfTheMatch", () => {
  it("returns null for empty stats", () => {
    expect(pickManOfTheMatch([], null)).toBeNull();
  });

  it("prefers high runs over modest bowling", () => {
    const mom = pickManOfTheMatch(
      [row(1, 10, { runs: 78 }), row(2, 11, undefined, { wickets: 2 })],
      10,
    ) as MomCandidate;
    expect(mom.playerId).toBe(1);
  });

  it("gives winning-team bonus on close scores", () => {
    const mom = pickManOfTheMatch(
      [row(1, 10, { runs: 45 }), row(2, 11, { runs: 42 })],
      11,
    ) as MomCandidate;
    expect(mom.playerId).toBe(2);
  });
});
