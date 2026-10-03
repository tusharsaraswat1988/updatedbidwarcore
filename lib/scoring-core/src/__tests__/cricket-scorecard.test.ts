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
    wicket: { type: "bowled" | "caught" | "lbw" | "run_out" | "stumped"; dismissedPlayerId: number } | null;
    strikerId: number;
    nonStrikerId: number;
    bowlerId: number;
    over: number;
    ball: number;
    extras: { type: "wide" | "no_ball" | "bye" | "leg_bye" | "penalty" | null; runs: number };
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

function startMatchEvent() {
  return createEventEnvelope({
    matchId: 1,
    tournamentId: 10,
    sportSlug: "cricket",
    eventType: CricketEventType.MATCH_STARTED,
    sequence: 1,
    payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 20 },
    actorType: "organizer",
  });
}

describe("cricket scorecard projector", () => {
  it("builds batting and bowling figures from ball events", () => {
    const events = [
      startMatchEvent(),
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
      startMatchEvent(),
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
      startMatchEvent(),
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

  // --- Regression Tests: Cricket Accounting (P0 Fix #2) ---

  it("A. 1 bye: team runs +1, striker runs +0, bowler conceded +0", () => {
    const events = [
      startMatchEvent(),
      ballEvent(2, {
        over: 0,
        ball: 1,
        runsOffBat: 0,
        extras: { type: "bye", runs: 1 },
        isLegalDelivery: true,
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    expect(inn.totalRuns).toBe(1);
    expect(inn.extras.byes).toBe(1);
    expect(inn.extras.total).toBe(1);

    const striker = inn.batting.find((b) => b.playerId === 101)!;
    expect(striker.runs).toBe(0);
    expect(striker.balls).toBe(1);

    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(0);
    expect(bowler.overs).toBe("0.1");
    expect(bowler.economy).toBe(0);
  });

  it("B. 2 leg-byes: team runs +2, striker runs +0, bowler conceded +0", () => {
    const events = [
      startMatchEvent(),
      ballEvent(2, {
        over: 0,
        ball: 1,
        runsOffBat: 0,
        extras: { type: "leg_bye", runs: 2 },
        isLegalDelivery: true,
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    expect(inn.totalRuns).toBe(2);
    expect(inn.extras.legByes).toBe(2);
    expect(inn.extras.total).toBe(2);

    const striker = inn.batting.find((b) => b.playerId === 101)!;
    expect(striker.runs).toBe(0);
    expect(striker.balls).toBe(1);

    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(0);
    expect(bowler.overs).toBe("0.1");
    expect(bowler.economy).toBe(0);
  });

  it("C. 1 wide: team runs +1, striker runs +0, bowler conceded +1, delivery remains illegal", () => {
    const events = [
      startMatchEvent(),
      ballEvent(2, {
        over: 0,
        ball: 1,
        runsOffBat: 0,
        extras: { type: "wide", runs: 1 },
        isLegalDelivery: false,
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    expect(inn.totalRuns).toBe(1);
    expect(inn.extras.wides).toBe(1);
    expect(inn.extras.total).toBe(1);

    const striker = inn.batting.find((b) => b.playerId === 101)!;
    expect(striker.runs).toBe(0);
    expect(striker.balls).toBe(0); // Batter does not face a wide

    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(1);
    expect(bowler.wides).toBe(1);
    expect(bowler.overs).toBe("0.0"); // Illegal delivery: overs do not advance
  });

  it("D. No-ball with bat run: team runs +5, striker runs +4, bowler conceded +5, delivery remains illegal", () => {
    const events = [
      startMatchEvent(),
      ballEvent(2, {
        over: 0,
        ball: 1,
        runsOffBat: 4,
        extras: { type: "no_ball", runs: 1 },
        isLegalDelivery: false,
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    expect(inn.totalRuns).toBe(5); // 4 bat + 1 no-ball
    expect(inn.extras.noBalls).toBe(1);
    expect(inn.extras.total).toBe(1);

    const striker = inn.batting.find((b) => b.playerId === 101)!;
    expect(striker.runs).toBe(4);
    expect(striker.balls).toBe(1); // Faced ball because runs were scored off bat
    expect(striker.fours).toBe(1);

    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(5); // 4 bat + 1 no-ball penalty
    expect(bowler.noBalls).toBe(1);
    expect(bowler.overs).toBe("0.0"); // Illegal delivery
  });

  it("E. Mixed over containing normal ball, boundary, wide, bye, leg-bye, no-ball, wicket", () => {
    const events = [
      startMatchEvent(),
      // 1. Normal ball: 1 run off bat (legal)
      ballEvent(2, { over: 0, ball: 1, runsOffBat: 1, strikerId: 101, isLegalDelivery: true }),
      // 2. Boundary: 4 runs off bat (legal)
      ballEvent(3, { over: 0, ball: 2, runsOffBat: 4, strikerId: 102, isLegalDelivery: true }),
      // 3. Wide: 1 extra run (illegal delivery)
      ballEvent(4, { over: 0, ball: 3, runsOffBat: 0, strikerId: 102, nonStrikerId: 101, extras: { type: "wide", runs: 1 }, isLegalDelivery: false }),
      // 4. Bye: 1 bye (legal delivery)
      ballEvent(5, { over: 0, ball: 3, runsOffBat: 0, strikerId: 102, nonStrikerId: 101, extras: { type: "bye", runs: 1 }, isLegalDelivery: true }),
      // 5. Leg-bye: 2 leg-byes (legal delivery)
      ballEvent(6, { over: 0, ball: 4, runsOffBat: 0, strikerId: 102, nonStrikerId: 101, extras: { type: "leg_bye", runs: 2 }, isLegalDelivery: true }),
      // 6. No-ball with 2 bat runs (illegal delivery)
      ballEvent(7, { over: 0, ball: 5, runsOffBat: 2, strikerId: 102, nonStrikerId: 101, extras: { type: "no_ball", runs: 1 }, isLegalDelivery: false }),
      // 7. Normal ball: dot ball (legal delivery)
      ballEvent(8, { over: 0, ball: 5, runsOffBat: 0, strikerId: 101, nonStrikerId: 102, isLegalDelivery: true }),
      // 8. Wicket: bowled (legal delivery)
      ballEvent(9, {
        over: 0,
        ball: 6,
        runsOffBat: 0,
        strikerId: 101,
        nonStrikerId: 102,
        wicket: { type: "bowled", dismissedPlayerId: 101 },
        isLegalDelivery: true,
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    // Innings total: 1 + 4 + 1(wd) + 1(b) + 2(lb) + 3(nb+2) + 0 + 0 = 12 runs
    expect(inn.totalRuns).toBe(12);
    expect(inn.totalWickets).toBe(1);
    expect(inn.overs).toBe("1.0");

    // Extras breakdown
    expect(inn.extras.wides).toBe(1);
    expect(inn.extras.byes).toBe(1);
    expect(inn.extras.legByes).toBe(2);
    expect(inn.extras.noBalls).toBe(1);
    expect(inn.extras.total).toBe(5);

    // Batting totals:
    // Striker 101: 1 (ball 1) + 0 (ball 5) + 0 (wicket ball 6) = 1 run
    const b101 = inn.batting.find((b) => b.playerId === 101)!;
    expect(b101.runs).toBe(1);
    expect(b101.notOut).toBe(false);
    expect(b101.dismissalType).toBe("bowled");

    // Striker 102: 4 (ball 2) + 0 (bye) + 0 (leg-bye) + 2 (nb) = 6 runs
    const b102 = inn.batting.find((b) => b.playerId === 102)!;
    expect(b102.runs).toBe(6);

    // Total bat runs (7) + extras (5) = total runs (12)
    expect(b101.runs + b102.runs + inn.extras.total).toBe(inn.totalRuns);

    // Bowler conceded:
    // Ball 1: 1
    // Ball 2: 4
    // Wide: 1
    // Bye: 0 (NOT charged to bowler!)
    // Leg-bye: 0 (NOT charged to bowler!)
    // No-ball: 3 (1 penalty + 2 bat runs)
    // Dot ball: 0
    // Wicket: 0
    // Total conceded = 1 + 4 + 1 + 0 + 0 + 3 + 0 + 0 = 9 runs!
    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(9);
    expect(bowler.wickets).toBe(1);
    expect(bowler.wides).toBe(1);
    expect(bowler.noBalls).toBe(1);
    expect(bowler.overs).toBe("1.0"); // 6 legal deliveries
    expect(bowler.economy).toBe(9.0); // 9 runs / 1.0 over = 9.00
    expect(bowler.maidens).toBe(0);
  });

  it("calculates maiden over when byes and leg-byes occur without bowler-conceded runs", () => {
    const events = [
      startMatchEvent(),
      // 1. dot
      ballEvent(2, { over: 0, ball: 1, runsOffBat: 0, isLegalDelivery: true }),
      // 2. 1 bye (no bowler runs)
      ballEvent(3, { over: 0, ball: 2, runsOffBat: 0, extras: { type: "bye", runs: 1 }, isLegalDelivery: true }),
      // 3. dot
      ballEvent(4, { over: 0, ball: 3, runsOffBat: 0, isLegalDelivery: true }),
      // 4. 2 leg-byes (no bowler runs)
      ballEvent(5, { over: 0, ball: 4, runsOffBat: 0, extras: { type: "leg_bye", runs: 2 }, isLegalDelivery: true }),
      // 5. dot
      ballEvent(6, { over: 0, ball: 5, runsOffBat: 0, isLegalDelivery: true }),
      // 6. dot
      ballEvent(7, { over: 0, ball: 6, runsOffBat: 0, isLegalDelivery: true }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    expect(inn.totalRuns).toBe(3); // 1 bye + 2 leg-byes
    expect(inn.extras.total).toBe(3);

    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(0); // 0 runs conceded by bowler!
    expect(bowler.overs).toBe("1.0");
    expect(bowler.maidens).toBe(1); // Maiden over preserved!
    expect(bowler.economy).toBe(0.0);
  });

  it("F. Full scorecard → player stats → tournament leaderboard propagation", () => {
    const events = [
      startMatchEvent(),
      // Over 1 (bowler 201): 4 byes on ball 1, 5 dots
      ballEvent(2, { over: 0, ball: 1, runsOffBat: 0, extras: { type: "bye", runs: 4 }, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(3, { over: 0, ball: 2, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(4, { over: 0, ball: 3, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(5, { over: 0, ball: 4, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(6, { over: 0, ball: 5, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(7, { over: 0, ball: 6, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      // Over 2 (bowler 201): 6 runs off bat
      ballEvent(8, { over: 1, ball: 1, runsOffBat: 6, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(9, { over: 1, ball: 2, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(10, { over: 1, ball: 3, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(11, { over: 1, ball: 4, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(12, { over: 1, ball: 5, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
      ballEvent(13, { over: 1, ball: 6, runsOffBat: 0, bowlerId: 201, isLegalDelivery: true }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const inn = scorecard.innings[0]!;

    // Team total: 4 (byes) + 6 (bat) = 10 runs
    expect(inn.totalRuns).toBe(10);
    expect(inn.extras.byes).toBe(4);

    // Bowler 201 conceded ONLY 6 runs in 2.0 overs (maidens: 1 for over 1)
    const bowler = inn.bowling.find((b) => b.playerId === 201)!;
    expect(bowler.runs).toBe(6);
    expect(bowler.overs).toBe("2.0");
    expect(bowler.maidens).toBe(1);
    expect(bowler.economy).toBe(3.0); // 6 runs / 2 overs = 3.00

    // Propagate to player stats
    const playerStats = scorecardToPlayerStats(scorecard);
    const bowlerStats = playerStats.find((p) => p.playerId === 201 && p.bowling !== null)!;
    expect(bowlerStats.bowling!.runs).toBe(6);
    expect(bowlerStats.bowling!.overs).toBe("2.0");
    expect(bowlerStats.bowling!.economy).toBe(3.0);

    // Propagate to tournament aggregate
    const aggregates = aggregateTournamentPlayerStats(playerStats);
    const bowlerAgg = aggregates.get(201)!;
    expect(bowlerAgg.runsConceded).toBe(6);
    expect(bowlerAgg.oversBowled).toBe(2.0);

    // Propagate to leaderboard
    const economyBoard = buildLeaderboard(aggregates, "economy", 10);
    expect(economyBoard[0]?.playerId).toBe(201);
    expect(economyBoard[0]?.value).toBe(3.0);
  });

  it("G. Preserves non-bowling fielders and wicketkeepers in scorecardToPlayerStats and catches leaderboard", () => {
    // Bowler 201 bowls, batsman 101 caught by fielder 303 (who does not bowl!)
    const events = [
      startMatchEvent(),
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 2,
        payload: {
          innings: 1,
          over: 0,
          ball: 1,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 0,
          extras: { type: null, runs: 0 },
          wicket: { type: "caught", dismissedPlayerId: 101, fielderId: 303 },
          isLegalDelivery: true,
        },
        actorType: "organizer",
      }),
    ];

    const scorecard = buildCricketScorecardFromEvents(1, events, meta);
    const stats = scorecardToPlayerStats(scorecard);

    // Fielder 303 must exist in stats with 1 catch!
    const fielderStats = stats.find((p) => p.playerId === 303);
    expect(fielderStats).toBeDefined();
    expect(fielderStats?.fielding.catches).toBe(1);
    expect(fielderStats?.batting).toBeNull();
    expect(fielderStats?.bowling).toBeNull();

    // Aggregates must include fielder 303
    const aggregates = aggregateTournamentPlayerStats(stats);
    const fielderAgg = aggregates.get(303);
    expect(fielderAgg).toBeDefined();
    expect(fielderAgg?.catches).toBe(1);

    // Leaderboard for catches includes fielder 303
    const catchesBoard = buildLeaderboard(aggregates, "catches", 10);
    expect(catchesBoard[0]?.playerId).toBe(303);
    expect(catchesBoard[0]?.value).toBe(1);
  });
});
