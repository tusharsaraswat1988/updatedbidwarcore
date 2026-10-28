import { describe, expect, it } from "vitest";
import {
  detectCategoryChampion,
  displayMatchSideScores,
  formatPointDifference,
  gamesWonDisplayLine,
  isBroadcastableResult,
  isCompletedMatch,
  listRecentCompleted,
  loserLabel,
  winnerLabel,
  winnerPointDifference,
  type ResultsCategory,
  type ResultsFixture,
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

  describe("detectCategoryChampion — Round-Robin Standings Leader (P0-05)", () => {
    it("crowns standings leader as champion even when last played match was won by another entrant", () => {
      const category: ResultsCategory = {
        id: 10,
        name: "Men's Singles",
        drawType: "round_robin",
        phase: "completed",
      };

      // 4 Entrants:
      // Reg 1: 3 wins (Leader)
      // Reg 2: 1 win
      // Reg 3: 1 win
      // Reg 4: 1 win (won the LAST match of the tournament against Reg 3)

      const fixtures: ResultsFixture[] = [
        { id: 1, categoryId: 10, drawId: 1, scoringMatchId: 101, registrationAId: 1, registrationBId: 2, status: "completed", winnerRegistrationId: 1 },
        { id: 2, categoryId: 10, drawId: 1, scoringMatchId: 102, registrationAId: 3, registrationBId: 4, status: "completed", winnerRegistrationId: 3 },
        { id: 3, categoryId: 10, drawId: 1, scoringMatchId: 103, registrationAId: 1, registrationBId: 3, status: "completed", winnerRegistrationId: 1 },
        { id: 4, categoryId: 10, drawId: 1, scoringMatchId: 104, registrationAId: 2, registrationBId: 4, status: "completed", winnerRegistrationId: 2 },
        { id: 5, categoryId: 10, drawId: 1, scoringMatchId: 105, registrationAId: 1, registrationBId: 4, status: "completed", winnerRegistrationId: 1 },
        // Match 106 played LAST at timestamp T+10 hours, won by Reg 4 against Reg 3
        { id: 6, categoryId: 10, drawId: 1, scoringMatchId: 106, registrationAId: 3, registrationBId: 4, status: "completed", winnerRegistrationId: 4 },
      ];

      const matches: ResultsMatch[] = [
        {
          ...completedMatch({
            id: 101,
            winnerSide: "left",
            leftSide: { label: "Leader Alice", shortLabel: "Alice", playerIds: [] },
            rightSide: { label: "Bob", shortLabel: "Bob", playerIds: [] },
            endedAt: "2026-10-28T10:00:00Z",
          }),
          detail: { categoryId: 10 },
        },
        {
          ...completedMatch({
            id: 102,
            winnerSide: "left",
            leftSide: { label: "Charlie", shortLabel: "Charlie", playerIds: [] },
            rightSide: { label: "David", shortLabel: "David", playerIds: [] },
            endedAt: "2026-10-28T11:00:00Z",
          }),
          detail: { categoryId: 10 },
        },
        {
          ...completedMatch({
            id: 103,
            winnerSide: "left",
            leftSide: { label: "Leader Alice", shortLabel: "Alice", playerIds: [] },
            rightSide: { label: "Charlie", shortLabel: "Charlie", playerIds: [] },
            endedAt: "2026-10-28T12:00:00Z",
          }),
          detail: { categoryId: 10 },
        },
        {
          ...completedMatch({
            id: 104,
            winnerSide: "left",
            leftSide: { label: "Bob", shortLabel: "Bob", playerIds: [] },
            rightSide: { label: "David", shortLabel: "David", playerIds: [] },
            endedAt: "2026-10-28T13:00:00Z",
          }),
          detail: { categoryId: 10 },
        },
        {
          ...completedMatch({
            id: 105,
            winnerSide: "left",
            leftSide: { label: "Leader Alice", shortLabel: "Alice", playerIds: [] },
            rightSide: { label: "David", shortLabel: "David", playerIds: [] },
            endedAt: "2026-10-28T14:00:00Z",
          }),
          detail: { categoryId: 10 },
        },
        // Match 106 finishes LAST at 18:00, won by David (right side)
        {
          ...completedMatch({
            id: 106,
            winnerSide: "right",
            leftSide: { label: "Charlie", shortLabel: "Charlie", playerIds: [] },
            rightSide: { label: "David", shortLabel: "David", playerIds: [] },
            endedAt: "2026-10-28T18:00:00Z",
          }),
          detail: { categoryId: 10 },
        },
      ];

      // With precomputed standings:
      const standings = [
        { registrationId: 1, rank: 1, won: 3, lost: 0, marginPoints: 30 },
        { registrationId: 2, rank: 2, won: 1, lost: 2, marginPoints: -5 },
        { registrationId: 3, rank: 3, won: 1, lost: 2, marginPoints: -10 },
        { registrationId: 4, rank: 4, won: 1, lost: 2, marginPoints: -15 },
      ];

      const champWithStandings = detectCategoryChampion(category, matches, fixtures, standings);
      expect(champWithStandings).not.toBeNull();
      // Must crown Leader Alice, NOT David (who won the last match)!
      expect(champWithStandings?.winnerLabel).toBe("Leader Alice");
      expect(champWithStandings?.roundLabel).toBe("League Winner");

      // Without precomputed standings (on-the-fly calculation):
      const champComputed = detectCategoryChampion(category, matches, fixtures);
      expect(champComputed).not.toBeNull();
      expect(champComputed?.winnerLabel).toBe("Leader Alice");
    });

    it("returns null when standings top entrants are tied and unresolved", () => {
      const category: ResultsCategory = {
        id: 11,
        name: "Tied League",
        drawType: "round_robin",
        phase: "completed",
      };

      const fixtures: ResultsFixture[] = [];
      const matches: ResultsMatch[] = [];
      const tiedStandings = [
        { registrationId: 1, rank: 1, won: 2, lost: 1, marginPoints: 10 },
        { registrationId: 2, rank: 1, won: 2, lost: 1, marginPoints: 10 },
      ];

      const champ = detectCategoryChampion(category, matches, fixtures, tiedStandings);
      expect(champ).toBeNull();
    });

    it("returns null when rank 1 entrant has tiedWithNext flag set to true", () => {
      const category: ResultsCategory = {
        id: 12,
        name: "Tied League with tiedWithNext",
        drawType: "round_robin",
        phase: "completed",
      };

      const fixtures: ResultsFixture[] = [];
      const matches: ResultsMatch[] = [];
      const standingsWithTieFlag = [
        { registrationId: 1, rank: 1, won: 2, lost: 1, marginPoints: 10, tiedWithNext: true },
        { registrationId: 2, rank: 1, won: 2, lost: 1, marginPoints: 10, tiedWithNext: false },
      ];

      const champ = detectCategoryChampion(category, matches, fixtures, standingsWithTieFlag);
      expect(champ).toBeNull();
    });

    it("evaluates champion using universal standings rulesSnapshotJson when present", () => {
      const category: ResultsCategory = {
        id: 13,
        name: "Rules Driven League",
        drawType: "round_robin",
        phase: "completed",
        rulesSnapshotJson: {
          id: "corporate_round_robin_standard",
          name: "Corporate Round Robin",
          description: "Testing",
          profileType: "corporate",
          schemaVersion: "1.0.0",
          profileVersion: "1.0.0",
          rulesSource: "BIDWAR",
          rulesSourceEffectiveDate: "2026-01-01",
          isOfficialBwf: false,
          allowedEventTypes: ["singles", "doubles"],
          participantType: "individual",
          scoring: {
            totalGames: 3,
            pointsPerGame: 21,
            deuceAt: 20,
            maxPoints: 30,
            winBy: 2,
            midGameSideChange: true,
            scoringSystemName: "3x21",
          },
          draw: {
            drawType: "round_robin",
            seedingAlgorithm: "random",
            maxSeeds: 0,
            byeAllocation: "random",
            thirdPlaceMatch: false,
            rematchAvoidance: false,
            drawLockPolicy: "lock_on_match_start",
          },
          standings: {
            rankingSystem: "points_diff_first",
            orderedTieBreakers: ["matches_won", "points_difference", "head_to_head"],
            twoWayHeadToHeadOverride: true,
            unresolvedTieAction: "organizer_decision",
          },
          discipline: {
            walkoverAwardType: "assigned_margin",
            assignedMarginPoints: 21,
            retiredMatchHandling: "record_current_score_as_final",
            disqualificationPolicy: "treat_as_walkovers",
            scoreCorrectionAllowedUntil: "always",
          },
          eligibility: {},
        },
      };

      const fixtures: ResultsFixture[] = [
        { id: 201, categoryId: 13, drawId: 1, registrationAId: 10, registrationBId: 20, scoringMatchId: 201, status: "completed", winnerRegistrationId: 10 },
      ];
      const matches: ResultsMatch[] = [
        {
          ...completedMatch({
            id: 201,
            winnerSide: "left",
            leftSide: { label: "Player 10", shortLabel: "P10", playerIds: [] },
            rightSide: { label: "Player 20", shortLabel: "P20", playerIds: [] },
            games: [
              { gameNumber: 1, leftScore: 21, rightScore: 10, phase: "completed", winner: "left" },
              { gameNumber: 2, leftScore: 21, rightScore: 12, phase: "completed", winner: "left" },
            ],
          }),
          detail: { categoryId: 13 },
        },
      ];

      const champ = detectCategoryChampion(category, matches, fixtures);
      expect(champ).not.toBeNull();
      expect(champ?.winnerLabel).toBe("Player 10");
    });
  });
});
