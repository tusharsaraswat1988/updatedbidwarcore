import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  buildCricketScorecardFromEvents,
  buildLeaderboard,
  scorecardToPlayerStats,
  aggregateTournamentPlayerStats,
  createEventEnvelope,
} from "../index";

const meta = { homeTeamId: 1, awayTeamId: 2 };

function ballEvent(
  sequence: number,
  overrides: Partial<{
    runsOffBat: number;
    wicket: { type: "bowled"; dismissedPlayerId: number } | null;
    strikerId: number;
    nonStrikerId: number;
    bowlerId: number;
    over: number;
    ball: number;
    extras: { type: "wide" | "no_ball" | null; runs: number };
    isLegalDelivery: boolean;
  }> = {},
) {
  return createEventEnvelope({
    matchId: 1,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.BALL_RECORDED,
    sequence,
    payload: {
      innings: 1,
      over: overrides.over ?? 0,
      ball: overrides.ball ?? 1,
      strikerId: overrides.strikerId ?? 101,
      nonStrikerId: overrides.nonStrikerId ?? 102,
      bowlerId: overrides.bowlerId ?? 201,
      runsOffBat: overrides.runsOffBat ?? 4,
      extras: overrides.extras ?? { type: null, runs: 0 },
      wicket: overrides.wicket ?? null,
      isLegalDelivery: overrides.isLegalDelivery ?? true,
    },
    actorType: "organizer",
  });
}

describe("cricket scorecard projector", () => {
  it("builds batting and bowling figures from ball events", () => {
    const events = [
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ballEvent(2, { runsOffBat: 4 }),
      ballEvent(3, {
        ball: 2,
        runsOffBat: 0,
        wicket: { type: "bowled", dismissedPlayerId: 101 },
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    expect(scorecard.innings).toHaveLength(1);
    const inn = scorecard.innings[0]!;
    expect(inn.totalRuns).toBe(4);
    expect(inn.totalWickets).toBe(1);

    const striker = inn.batting.find((b) => b.playerId === 101);
    expect(striker?.runs).toBe(4);
    expect(striker?.balls).toBe(2);
    expect(striker?.notOut).toBe(false);

    const bowler = inn.bowling.find((b) => b.playerId === 201);
    expect(bowler?.wickets).toBe(1);
    expect(bowler?.runs).toBe(4);
  });

  it("aggregates tournament leaderboards from player stats", () => {
    const events = [
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      ballEvent(2, { runsOffBat: 50 }),
      ballEvent(3, { ball: 2, runsOffBat: 2, strikerId: 102, nonStrikerId: 101 }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const stats = scorecardToPlayerStats(scorecard);
    const agg = aggregateTournamentPlayerStats(stats);
    const runsBoard = buildLeaderboard(agg, "runs", 10);

    expect(runsBoard[0]?.playerId).toBe(101);
    expect(runsBoard[0]?.value).toBe(50);
  });

  it("applies penalty runs to innings extras", () => {
    const events = [
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.PENALTY_AWARDED,
        sequence: 2,
        payload: { innings: 1, battingTeamId: 1, runs: 5 },
        actorType: "organizer",
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    expect(scorecard.innings[0]?.extras.penalties).toBe(5);
    expect(scorecard.innings[0]?.totalRuns).toBe(5);
  });
});
