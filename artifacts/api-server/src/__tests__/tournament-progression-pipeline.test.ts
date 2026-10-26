import { describe, expect, it } from "vitest";
import {
  buildLeagueKnockoutStages,
  makeSlotKey,
  resolveGroupQualifications,
  resolveParticipantSource,
  buildStandingsFromMatches,
  type GroupStandingsMap,
  type StandingsMatchInput,
} from "@workspace/scoring-core";

describe("P0-A: Generic League → Qualification → Knockout Progression", () => {
  describe("1. Configuration-driven stage graphs (No hard-coded BPL/dates/teams)", () => {
    it("supports 4 teams / 1 group -> Top 2 to Final", () => {
      const config = buildLeagueKnockoutStages(
        [{ name: "Group 1", teamIds: [10, 20, 30, 40] }],
        { qualifiersPerGroup: 2 },
      );

      expect(config.stages).toHaveLength(2);
      expect(config.stages[0]?.name).toBe("League Stage");
      expect(config.stages[1]?.name).toBe("Final");
      expect(config.stages[1]?.fixtures?.[0]?.homeSource).toEqual({
        type: "group_rank",
        groupName: "Group 1",
        rank: 1,
      });
      expect(config.stages[1]?.fixtures?.[0]?.awaySource).toEqual({
        type: "group_rank",
        groupName: "Group 1",
        rank: 2,
      });
    });

    it("supports 8 teams / 2 groups -> Top 2 each to Semis -> Final", () => {
      const config = buildLeagueKnockoutStages(
        [
          { name: "Group Red", teamIds: [1, 2, 3, 4] },
          { name: "Group Blue", teamIds: [5, 6, 7, 8] },
        ],
        { qualifiersPerGroup: 2 },
      );

      expect(config.stages).toHaveLength(3);
      const [groups, semis, final] = config.stages;

      expect(groups?.groups).toHaveLength(2);
      expect(semis?.fixtures).toHaveLength(2);
      expect(semis?.fixtures?.[0]?.homeSource).toEqual({
        type: "group_rank",
        groupName: "Group Red",
        rank: 1,
      });
      expect(semis?.fixtures?.[0]?.awaySource).toEqual({
        type: "group_rank",
        groupName: "Group Blue",
        rank: 2,
      });
      expect(semis?.fixtures?.[1]?.homeSource).toEqual({
        type: "group_rank",
        groupName: "Group Blue",
        rank: 1,
      });
      expect(semis?.fixtures?.[1]?.awaySource).toEqual({
        type: "group_rank",
        groupName: "Group Red",
        rank: 2,
      });

      expect(final?.fixtures?.[0]?.homeSource).toEqual({
        type: "winner_of",
        roundName: "Semi Final 1",
        bracketRound: 0,
        bracketSlot: 0,
      });
      expect(final?.fixtures?.[0]?.awaySource).toEqual({
        type: "winner_of",
        roundName: "Semi Final 2",
        bracketRound: 0,
        bracketSlot: 1,
      });
    });

    it("supports 12 teams / 3 groups -> Top 1 each + best second or 4 groups", () => {
      const config = buildLeagueKnockoutStages(
        [
          { name: "Pool Alpha", teamIds: [1, 2, 3] },
          { name: "Pool Beta", teamIds: [4, 5, 6] },
          { name: "Pool Gamma", teamIds: [7, 8, 9] },
          { name: "Pool Delta", teamIds: [10, 11, 12] },
        ],
        { qualifiersPerGroup: 1 },
      );

      expect(config.stages).toHaveLength(3);
      expect(config.stages[1]?.fixtures).toHaveLength(2); // 2 Semi Finals
      expect(config.stages[2]?.fixtures).toHaveLength(1); // 1 Final
    });
  });

  describe("2. Authoritative Standings & Qualification Resolution", () => {
    it("consumes authoritative standings points, wins, NRR and all-out rules for ranking", () => {
      const teamIds = [1, 2, 3];
      // Team 1 plays Team 2 (Team 1 wins)
      // Team 2 plays Team 3 (Team 2 wins)
      // Team 3 plays Team 1 (Team 1 wins)
      const matches: StandingsMatchInput[] = [
        {
          matchId: 101,
          status: "completed",
          homeTeamId: 1,
          awayTeamId: 2,
          summary: {
            innings: [
              { innings: 1, battingTeamId: 1, bowlingTeamId: 2, runs: 180, wickets: 4, overs: "20.0", phase: "completed" },
              { innings: 2, battingTeamId: 2, bowlingTeamId: 1, runs: 140, wickets: 10, overs: "18.2", allOut: true, oversLimit: 20, phase: "completed" },
            ],
            target: 181,
            winnerTeamId: 1,
            resultText: "Team 1 won by 40 runs",
            homeTeamId: 1,
            awayTeamId: 2,
            oversLimit: 20,
            currentInnings: 2,
            matchStatus: "completed",
          },
        },
        {
          matchId: 102,
          status: "completed",
          homeTeamId: 2,
          awayTeamId: 3,
          summary: {
            innings: [
              { innings: 1, battingTeamId: 2, bowlingTeamId: 3, runs: 160, wickets: 5, overs: "20.0", phase: "completed" },
              { innings: 2, battingTeamId: 3, bowlingTeamId: 2, runs: 130, wickets: 8, overs: "20.0", phase: "completed" },
            ],
            target: 161,
            winnerTeamId: 2,
            resultText: "Team 2 won by 30 runs",
            homeTeamId: 2,
            awayTeamId: 3,
            oversLimit: 20,
            currentInnings: 2,
            matchStatus: "completed",
          },
        },
        {
          matchId: 103,
          status: "completed",
          homeTeamId: 3,
          awayTeamId: 1,
          summary: {
            innings: [
              { innings: 1, battingTeamId: 3, bowlingTeamId: 1, runs: 120, wickets: 9, overs: "20.0", phase: "completed" },
              { innings: 2, battingTeamId: 1, bowlingTeamId: 3, runs: 121, wickets: 2, overs: "14.1", phase: "completed" },
            ],
            target: 121,
            winnerTeamId: 1,
            resultText: "Team 1 won by 8 wickets",
            homeTeamId: 3,
            awayTeamId: 1,
            oversLimit: 20,
            currentInnings: 2,
            matchStatus: "completed",
          },
        },
      ];

      const standings = buildStandingsFromMatches(teamIds, matches);
      expect(standings[0]?.teamId).toBe(1); // 2 wins, 4 pts
      expect(standings[0]?.points).toBe(4);
      expect(standings[1]?.teamId).toBe(2); // 1 win, 2 pts
      expect(standings[1]?.points).toBe(2);
      expect(standings[2]?.teamId).toBe(3); // 0 wins, 0 pts
      expect(standings[2]?.points).toBe(0);

      const groupMap: GroupStandingsMap = {
        "Group Red": {
          groupName: "Group Red",
          standings,
          isComplete: true,
        },
        "Group Blue": {
          groupName: "Group Blue",
          standings: [
            { teamId: 20, played: 2, won: 2, lost: 0, tied: 0, noResult: 0, points: 4, pointsPercentage: 100, netRunRate: 1.5, runsScored: 300, oversFaced: 40, runsConceded: 240, oversBowled: 40 },
            { teamId: 21, played: 2, won: 1, lost: 1, tied: 0, noResult: 0, points: 2, pointsPercentage: 50, netRunRate: 0.1, runsScored: 280, oversFaced: 40, runsConceded: 270, oversBowled: 40 },
          ],
          isComplete: true,
        },
      };

      const resolved = resolveGroupQualifications(
        [{ name: "Group Red" }, { name: "Group Blue" }],
        { type: "top_n_per_group", count: 2 },
        groupMap,
      );

      expect(resolved.isReady).toBe(true);
      expect(resolved.qualifiersBySlotKey[makeSlotKey("Group Red", 1)]).toBe(1);
      expect(resolved.qualifiersBySlotKey[makeSlotKey("Group Red", 2)]).toBe(2);
      expect(resolved.qualifiersBySlotKey[makeSlotKey("Group Blue", 1)]).toBe(20);
      expect(resolved.qualifiersBySlotKey[makeSlotKey("Group Blue", 2)]).toBe(21);
    });

    it("prevents knockout fixture progression when group matches are still pending", () => {
      const groupMap: GroupStandingsMap = {
        "Group Red": {
          groupName: "Group Red",
          standings: [{ teamId: 1, played: 1, won: 1, lost: 0, tied: 0, noResult: 0, points: 2, pointsPercentage: 100, netRunRate: 1.0, runsScored: 150, oversFaced: 20, runsConceded: 120, oversBowled: 20 }],
          isComplete: false, // Incomplete!
        },
      };

      const resolved = resolveGroupQualifications(
        [{ name: "Group Red" }],
        { type: "top_n_per_group", count: 1 },
        groupMap,
      );

      expect(resolved.isReady).toBe(false);
      expect(resolved.errors[0]).toContain("incomplete");
    });
  });

  describe("3. Knockout Winner Advancement", () => {
    it("advances SF1 and SF2 winners into Final home and away slots", () => {
      const qualifiersBySlotKey = {
        [makeSlotKey("Group A", 1)]: 10,
        [makeSlotKey("Group B", 2)]: 20,
        [makeSlotKey("Group B", 1)]: 30,
        [makeSlotKey("Group A", 2)]: 40,
      };

      const sf1Home = resolveParticipantSource({ type: "group_rank", groupName: "Group A", rank: 1 }, { qualifiersBySlotKey });
      const sf1Away = resolveParticipantSource({ type: "group_rank", groupName: "Group B", rank: 2 }, { qualifiersBySlotKey });
      expect(sf1Home.teamId).toBe(10);
      expect(sf1Away.teamId).toBe(20);

      const sf2Home = resolveParticipantSource({ type: "group_rank", groupName: "Group B", rank: 1 }, { qualifiersBySlotKey });
      const sf2Away = resolveParticipantSource({ type: "group_rank", groupName: "Group A", rank: 2 }, { qualifiersBySlotKey });
      expect(sf2Home.teamId).toBe(30);
      expect(sf2Away.teamId).toBe(40);

      // SF1 finishes with Team 10 winning
      // SF2 finishes with Team 30 winning
      const matchWinnersByRoundName = {
        "Semi Final 1": 10,
        "Semi Final 2": 30,
      };

      const finalHome = resolveParticipantSource(
        { type: "winner_of", roundName: "Semi Final 1", bracketRound: 0, bracketSlot: 0 },
        { qualifiersBySlotKey, matchWinnersByRoundName },
      );
      const finalAway = resolveParticipantSource(
        { type: "winner_of", roundName: "Semi Final 2", bracketRound: 0, bracketSlot: 1 },
        { qualifiersBySlotKey, matchWinnersByRoundName },
      );

      expect(finalHome.resolved).toBe(true);
      expect(finalHome.teamId).toBe(10);
      expect(finalAway.resolved).toBe(true);
      expect(finalAway.teamId).toBe(30);
    });

    it("handles double result processing idempotently without slot corruption", () => {
      const matchWinnersByRoundName = { "Semi Final 1": 10 };

      // First run
      const res1 = resolveParticipantSource(
        { type: "winner_of", roundName: "Semi Final 1" },
        { qualifiersBySlotKey: {}, matchWinnersByRoundName },
      );
      // Duplicate run (re-scoring or retry)
      const res2 = resolveParticipantSource(
        { type: "winner_of", roundName: "Semi Final 1" },
        { qualifiersBySlotKey: {}, matchWinnersByRoundName },
      );

      expect(res1.teamId).toBe(10);
      expect(res2.teamId).toBe(10);
      expect(res1.teamId).toBe(res2.teamId);
    });
  });
});
