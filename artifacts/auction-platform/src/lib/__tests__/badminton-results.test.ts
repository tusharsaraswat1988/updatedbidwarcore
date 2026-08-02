import { describe, expect, it } from "vitest";
import {
  displayMatchSideScores,
  formatPointDifference,
  gamesWonDisplayLine,
  isBroadcastableResult,
  isCompletedMatch,
  listRecentCompleted,
  loserLabel,
  winnerLabel,
  winnerPointDifference,
  type ResultsMatch,
} from "../badminton-results";
import type { BadmintonMatchState } from "@workspace/badminton-core";

function match(status: string, stateStatus?: string): ResultsMatch {
  return {
    id: 1,
    status,
    detail: null,
    state: stateStatus
      ? ({ matchStatus: stateStatus, winnerSide: "left" } as ResultsMatch["state"])
      : null,
  };
}

function completedMatch(partial: Partial<BadmintonMatchState> & { id?: number }): ResultsMatch {
  const id = partial.id ?? 1;
  const state = {
    matchStatus: "completed",
    winnerSide: "left",
    gamesLeft: 2,
    gamesRight: 0,
    leftSide: { label: "Alice", shortLabel: "Alice", playerIds: [] },
    rightSide: { label: "Bob", shortLabel: "Bob", playerIds: [] },
    games: [
      {
        gameNumber: 1,
        leftScore: 21,
        rightScore: 18,
        phase: "completed",
        winner: "left",
      },
      {
        gameNumber: 2,
        leftScore: 21,
        rightScore: 15,
        phase: "completed",
        winner: "left",
      },
    ],
    endedAt: new Date().toISOString(),
    ...partial,
  } as BadmintonMatchState;
  return {
    id,
    status: "completed",
    completedAt: state.endedAt,
    detail: null,
    state,
  };
}

describe("isCompletedMatch", () => {
  it("includes all terminal scoring statuses", () => {
    for (const status of [
      "completed",
      "walkover",
      "retired",
      "disqualified",
      "abandoned",
    ]) {
      expect(isCompletedMatch(match(status))).toBe(true);
    }
  });

  it("excludes live and scheduled matches", () => {
    expect(isCompletedMatch(match("live"))).toBe(false);
    expect(isCompletedMatch(match("scheduled"))).toBe(false);
    expect(isCompletedMatch(match("paused"))).toBe(false);
  });

  it("falls back to state.matchStatus when row status is stale", () => {
    expect(isCompletedMatch(match("live", "walkover"))).toBe(true);
  });
});

describe("winner point difference helpers", () => {
  it("labels winner and loser", () => {
    const m = completedMatch({});
    expect(winnerLabel(m)).toBe("Alice");
    expect(loserLabel(m)).toBe("Bob");
  });

  it("sums net rally difference for the winner", () => {
    const m = completedMatch({});
    // (21-18) + (21-15) = 9
    expect(winnerPointDifference(m)).toBe(9);
    expect(formatPointDifference(9)).toBe("+9");
  });

  it("uses assignedMarginPoints when no games completed", () => {
    const m = completedMatch({
      matchStatus: "walkover",
      gamesLeft: 0,
      gamesRight: 0,
      games: [],
      leftScore: 0,
      rightScore: 0,
      assignedMarginPoints: 21,
    });
    expect(winnerPointDifference(m)).toBe(21);
    expect(displayMatchSideScores(m.state)).toEqual({
      left: 21,
      right: 0,
      fromAssignedMargin: true,
    });
  });

  it("maps walkover margin onto the winning side for list scores", () => {
    const m = completedMatch({
      matchStatus: "walkover",
      winnerSide: "right",
      gamesLeft: 0,
      gamesRight: 0,
      games: [],
      leftScore: 0,
      rightScore: 0,
      assignedMarginPoints: 15,
    });
    expect(displayMatchSideScores(m.state)).toEqual({
      left: 0,
      right: 15,
      fromAssignedMargin: true,
    });
  });

  it("includes lost games in net difference for 2-1", () => {
    const m = completedMatch({
      gamesLeft: 2,
      gamesRight: 1,
      games: [
        {
          gameNumber: 1,
          leftScore: 21,
          rightScore: 18,
          phase: "completed",
          winner: "left",
        },
        {
          gameNumber: 2,
          leftScore: 19,
          rightScore: 21,
          phase: "completed",
          winner: "right",
        },
        {
          gameNumber: 3,
          leftScore: 21,
          rightScore: 15,
          phase: "completed",
          winner: "left",
        },
      ],
    });
    // (21-18) + (19-21) + (21-15) = 3 - 2 + 6 = 7
    expect(winnerPointDifference(m)).toBe(7);
  });

  it("lists recent completed with winners", () => {
    const rows = listRecentCompleted(
      [
        completedMatch({ id: 2 }),
        {
          id: 3,
          status: "live",
          detail: null,
          state: { matchStatus: "live" } as ResultsMatch["state"],
        },
      ],
      5,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(2);
  });

  it("excludes completed rows with no scored games (fake 0–0)", () => {
    const unfinished = completedMatch({
      id: 9,
      gamesLeft: 0,
      gamesRight: 0,
      games: [],
    });
    expect(isBroadcastableResult(unfinished)).toBe(false);
    expect(gamesWonDisplayLine(unfinished)).toBeNull();
    expect(listRecentCompleted([unfinished], 5)).toHaveLength(0);
  });

  it("includes walkovers without game scores", () => {
    const wo = completedMatch({
      id: 10,
      matchStatus: "walkover",
      gamesLeft: 0,
      gamesRight: 0,
      games: [],
      assignedMarginPoints: 21,
      resultReason: "walkover",
    });
    expect(isBroadcastableResult(wo)).toBe(true);
    expect(gamesWonDisplayLine(wo)).toBeNull();
    expect(listRecentCompleted([wo], 5)).toHaveLength(1);
  });
});
