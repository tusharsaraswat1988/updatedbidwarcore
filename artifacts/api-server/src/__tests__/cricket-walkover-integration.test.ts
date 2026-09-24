import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  cricketScoringAdapter,
  buildStandingsFromMatches,
} from "@workspace/scoring-core";
import { isTerminalScoringMatchStatus } from "../lib/scoring-match-terminal";

describe("Cricket Walkover API & Scoring Integration", () => {
  const meta = {
    matchId: 501,
    tournamentId: 42,
    homeTeamId: 10,
    awayTeamId: 20,
    oversLimit: 20,
    maxWickets: 10,
  };

  it("identifies 'walkover' as a terminal scoring match status", () => {
    expect(isTerminalScoringMatchStatus("walkover")).toBe(true);
    expect(isTerminalScoringMatchStatus("completed")).toBe(true);
    expect(isTerminalScoringMatchStatus("abandoned")).toBe(true);
    expect(isTerminalScoringMatchStatus("cancelled")).toBe(true);
    expect(isTerminalScoringMatchStatus("live")).toBe(false);
    expect(isTerminalScoringMatchStatus("scheduled")).toBe(false);
  });

  it("projects walkover match to terminal status with winner and result text", () => {
    const walkoverEvent = createEventEnvelope({
      matchId: 501,
      tournamentId: 42,
      sportSlug: "cricket",
      eventType: CricketEventType.WALKOVER_AWARDED,
      sequence: 1,
      actorType: "scorer_pin",
      actorId: "scorer-123",
      payload: {
        winnerTeamId: 10,
        reason: "Away team forfeited",
      },
    });

    const state = cricketScoringAdapter.replay(meta, [walkoverEvent]);
    const projection = cricketScoringAdapter.projectMatchFromState(state);

    expect(projection.matchStatus).toBe("walkover");
    expect(projection.winnerTeamId).toBe(10);
    expect(projection.resultSummary).toBe("Won by Walkover (Away team forfeited)");
    expect(projection.setCompletedAt).toBe(true);
    expect(projection.setStartedAt).toBe(false);
  });

  it("rejects duplicate events after walkover has occurred", () => {
    const walkoverEvent = createEventEnvelope({
      matchId: 501,
      tournamentId: 42,
      sportSlug: "cricket",
      eventType: CricketEventType.WALKOVER_AWARDED,
      sequence: 1,
      actorType: "scorer_pin",
      payload: {
        winnerTeamId: 20,
      },
    });

    const state = cricketScoringAdapter.replay(meta, [walkoverEvent]);

    const subsequentEvent = {
      tournamentId: 42,
      matchId: 501,
      eventType: CricketEventType.BALL_RECORDED,
      payload: { innings: 1, over: 0, ball: 1 },
      matchStatus: state.matchStatus,
    };

    const validation = cricketScoringAdapter.validateBeforeAppend(subsequentEvent);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.code).toBe("MATCH_CLOSED");
    }
  });

  it("calculates standings correctly when walkover matches are included", () => {
    const rows = buildStandingsFromMatches(
      [10, 20, 30],
      [
        {
          matchId: 1,
          status: "walkover",
          homeTeamId: 10,
          awayTeamId: 20,
          summary: {
            homeTeamId: 10,
            awayTeamId: 20,
            winnerTeamId: 10,
            resultText: "Won by Walkover",
            matchStatus: "walkover",
            oversLimit: 20,
            currentInnings: 1,
            innings: [],
          },
        },
        {
          matchId: 2,
          status: "completed",
          homeTeamId: 20,
          awayTeamId: 30,
          summary: {
            homeTeamId: 20,
            awayTeamId: 30,
            winnerTeamId: 20,
            resultText: "Team 20 won by 10 runs",
            matchStatus: "completed",
            oversLimit: 20,
            currentInnings: 2,
            innings: [
              { innings: 1, battingTeamId: 20, bowlingTeamId: 30, runs: 150, wickets: 5, overs: "20.0", phase: "completed" },
              { innings: 2, battingTeamId: 30, bowlingTeamId: 20, runs: 140, wickets: 8, overs: "20.0", phase: "completed" },
            ],
          },
        },
      ],
    );

    const team10 = rows.find((r) => r.teamId === 10)!;
    const team20 = rows.find((r) => r.teamId === 20)!;
    const team30 = rows.find((r) => r.teamId === 30)!;

    // Team 10: 1 walkover win -> 2 pts, 0 NRR
    expect(team10.played).toBe(1);
    expect(team10.won).toBe(1);
    expect(team10.points).toBe(2);
    expect(team10.netRunRate).toBe(0);

    // Team 20: 1 walkover loss + 1 normal win -> 2 pts, positive NRR from match 2
    expect(team20.played).toBe(2);
    expect(team20.won).toBe(1);
    expect(team20.lost).toBe(1);
    expect(team20.points).toBe(2);
    expect(team20.netRunRate).toBeGreaterThan(0);

    // Team 30: 1 normal loss -> 0 pts, negative NRR
    expect(team30.played).toBe(1);
    expect(team30.lost).toBe(1);
    expect(team30.points).toBe(0);
    expect(team30.netRunRate).toBeLessThan(0);
  });
});
