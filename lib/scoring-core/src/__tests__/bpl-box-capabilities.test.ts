import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  deriveCricketMatchResult,
  reduceCricket,
  replayCricketEvents,
} from "../index";
import { InvalidEventPayloadError } from "../projector/errors";

const baseMeta = {
  matchId: 500,
  tournamentId: 50,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 5,
  maxWickets: 6,
  playingSquadSize: 7,
  playingXiEnforced: true,
};

function ev(
  sequence: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return createEventEnvelope({
    matchId: 500,
    tournamentId: 50,
    sportSlug: "cricket",
    eventType,
    sequence,
    payload,
    actorType: "organizer",
  });
}

function started(
  extraMeta: Record<string, unknown> = {},
  powerplayOvers: number[] = [],
) {
  let state = createInitialCricketState({ ...baseMeta, ...extraMeta });
  state = reduceCricket(
    state,
    ev(1, CricketEventType.MATCH_STARTED, {
      tossWinnerTeamId: 1,
      electedTo: "bat",
      oversLimit: 5,
      powerplayOvers,
    }),
    { enforceLiveRules: true },
  );
  state = reduceCricket(
    state,
    ev(2, CricketEventType.LINEUP_SET, {
      teamId: 1,
      playerIds: [11, 12, 13, 14, 15, 16, 17],
      battingOrder: [11, 12],
    }),
    { enforceLiveRules: true },
  );
  state = reduceCricket(
    state,
    ev(3, CricketEventType.LINEUP_SET, {
      teamId: 2,
      playerIds: [21, 22, 23, 24, 25, 26, 27],
    }),
    { enforceLiveRules: true },
  );
  return state;
}

const fourBall = {
  innings: 1,
  over: 1,
  ball: 1,
  strikerId: 11,
  nonStrikerId: 12,
  bowlerId: 21,
  runsOffBat: 4,
  extras: { type: null, runs: 0 },
  wicket: null,
  isLegalDelivery: true,
};

describe("box cricket configurable capabilities", () => {
  it("rejects Super Ball declaration when capability is disabled", () => {
    const state = started({ superBallEnabled: false });
    expect(() =>
      reduceCricket(
        state,
        ev(4, CricketEventType.SUPER_BALL_DECLARED, {
          innings: 1,
          battingTeamId: 1,
        }),
        {
          enforceLiveRules: true,
        },
      ),
    ).toThrow(InvalidEventPayloadError);
  });

  it("declares one Super Ball per innings and persists scoring through replay", () => {
    const meta = { ...baseMeta, superBallEnabled: true };
    const events = [
      ev(1, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 5,
      }),
      ev(2, CricketEventType.LINEUP_SET, {
        teamId: 1,
        playerIds: [11, 12, 13, 14, 15, 16, 17],
        battingOrder: [11, 12],
      }),
      ev(3, CricketEventType.LINEUP_SET, {
        teamId: 2,
        playerIds: [21, 22, 23, 24, 25, 26, 27],
      }),
      ev(4, CricketEventType.SUPER_BALL_DECLARED, {
        innings: 1,
        battingTeamId: 1,
      }),
      ev(5, CricketEventType.BALL_RECORDED, fourBall),
    ];
    const state = replayCricketEvents(meta, events);
    expect(state.innings[0]?.runs).toBe(8);
    expect(state.thisOver.at(-1)?.isSuperBall).toBe(true);
    expect(state.superBallPending).toBeNull();
    expect(state.superBallUsed[1]).toEqual([1]);
  });

  it("scores Super Ball six as 12 and rejects duplicate declaration", () => {
    let state = started({ superBallEnabled: true });
    state = reduceCricket(
      state,
      ev(4, CricketEventType.SUPER_BALL_DECLARED, {
        innings: 1,
        battingTeamId: 1,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ev(5, CricketEventType.BALL_RECORDED, { ...fourBall, runsOffBat: 6 }),
      { enforceLiveRules: true },
    );
    expect(state.innings[0]?.runs).toBe(12);
    expect(() =>
      reduceCricket(
        state,
        ev(6, CricketEventType.SUPER_BALL_DECLARED, {
          innings: 1,
          battingTeamId: 1,
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(InvalidEventPayloadError);
  });

  it("rejects Super Ball during configured powerplay", () => {
    const state = started({ superBallEnabled: true }, [1]);
    expect(() =>
      reduceCricket(
        state,
        ev(4, CricketEventType.SUPER_BALL_DECLARED, {
          innings: 1,
          battingTeamId: 1,
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/Powerplay/);
  });

  it("rejects Super Ball declaration when only one batsman remains", () => {
    const state = {
      ...started({ superBallEnabled: true, maxWickets: 6 }),
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 0,
          wickets: 6,
          over: 1,
          ball: 0,
          phase: "in_progress" as const,
          kind: "normal" as const,
          oversLimit: 5,
        },
      ],
    };
    expect(() =>
      reduceCricket(
        state,
        ev(4, CricketEventType.SUPER_BALL_DECLARED, {
          innings: 1,
          battingTeamId: 1,
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/only one batsman/);
  });

  it("rejects caught on Super Ball but accepts run out and stumping", () => {
    let caughtState = started({ superBallEnabled: true });
    caughtState = reduceCricket(
      caughtState,
      ev(4, CricketEventType.SUPER_BALL_DECLARED, {
        innings: 1,
        battingTeamId: 1,
      }),
      { enforceLiveRules: true },
    );
    expect(() =>
      reduceCricket(
        caughtState,
        ev(5, CricketEventType.BALL_RECORDED, {
          ...fourBall,
          runsOffBat: 0,
          wicket: { type: "caught", dismissedPlayerId: 11 },
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/caught/);

    let runOutState = started({ superBallEnabled: true });
    runOutState = reduceCricket(
      runOutState,
      ev(4, CricketEventType.SUPER_BALL_DECLARED, {
        innings: 1,
        battingTeamId: 1,
      }),
      { enforceLiveRules: true },
    );
    runOutState = reduceCricket(
      runOutState,
      ev(5, CricketEventType.BALL_RECORDED, {
        ...fourBall,
        runsOffBat: 0,
        wicket: { type: "run_out", dismissedPlayerId: 11 },
      }),
      { enforceLiveRules: true },
    );
    expect(runOutState.innings[0]?.wickets).toBe(1);

    let stumpedState = started({ superBallEnabled: true });
    stumpedState = reduceCricket(
      stumpedState,
      ev(4, CricketEventType.SUPER_BALL_DECLARED, {
        innings: 1,
        battingTeamId: 1,
      }),
      { enforceLiveRules: true },
    );
    stumpedState = reduceCricket(
      stumpedState,
      ev(5, CricketEventType.BALL_RECORDED, {
        ...fourBall,
        runsOffBat: 0,
        wicket: { type: "stumped", dismissedPlayerId: 11 },
      }),
      { enforceLiveRules: true },
    );
    expect(stumpedState.innings[0]?.wickets).toBe(1);
  });

  it("supports single-batsman scoring where running runs become zero and boundaries count", () => {
    let state = createInitialCricketState({
      ...baseMeta,
      playingSquadSize: 2,
      maxWickets: 1,
    });
    state = reduceCricket(
      state,
      ev(1, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 5,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ev(2, CricketEventType.LINEUP_SET, {
        teamId: 1,
        playerIds: [11, 12],
        battingOrder: [11, 12],
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ev(3, CricketEventType.LINEUP_SET, { teamId: 2, playerIds: [21, 22] }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ev(4, CricketEventType.BALL_RECORDED, {
        ...fourBall,
        over: 0,
        ball: 1,
        runsOffBat: 0,
        wicket: { type: "run_out", dismissedPlayerId: 12 },
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ev(5, CricketEventType.BALL_RECORDED, {
        ...fourBall,
        over: 0,
        ball: 2,
        nonStrikerId: null,
        runsOffBat: 3,
      }),
      { enforceLiveRules: true },
    );
    state = reduceCricket(
      state,
      ev(6, CricketEventType.BALL_RECORDED, {
        ...fourBall,
        over: 0,
        ball: 3,
        nonStrikerId: null,
        runsOffBat: 4,
      }),
      { enforceLiveRules: true },
    );
    expect(state.innings[0]?.runs).toBe(4);
  });

  it("rejects ball participants outside the configured Playing XI when enforcement is enabled", () => {
    const state = started();
    expect(() =>
      reduceCricket(
        state,
        ev(4, CricketEventType.BALL_RECORDED, { ...fourBall, strikerId: 99 }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/Playing XI/);
  });

  it("keeps LBW and leg-bye available for standard cricket while allowing configured opt-out", () => {
    let standard = started({ lbwEnabled: true, legByeEnabled: true });
    standard = reduceCricket(
      standard,
      ev(4, CricketEventType.BALL_RECORDED, {
        ...fourBall,
        runsOffBat: 0,
        extras: { type: "leg_bye", runs: 1 },
      }),
      { enforceLiveRules: true },
    );
    expect(standard.innings[0]?.runs).toBe(1);

    let noLbw = started({ lbwEnabled: false, legByeEnabled: false });
    expect(() =>
      reduceCricket(
        noLbw,
        ev(4, CricketEventType.BALL_RECORDED, {
          ...fourBall,
          runsOffBat: 0,
          wicket: { type: "lbw", dismissedPlayerId: 11 },
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/LBW/);
    expect(() =>
      reduceCricket(
        noLbw,
        ev(5, CricketEventType.BALL_RECORDED, {
          ...fourBall,
          runsOffBat: 0,
          extras: { type: "leg_bye", runs: 1 },
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/leg bye/);
  });

  it("derives Super Over winner and blocks league-only knockout trigger", () => {
    const state = createInitialCricketState({
      ...baseMeta,
      superOverEnabled: true,
      superOverTrigger: "knockout_tie",
      matchTypeId: "league",
    });
    expect(() =>
      reduceCricket(
        state,
        ev(1, CricketEventType.SUPER_OVER_STARTED, {
          innings: 3,
          battingTeamId: 1,
          bowlingTeamId: 2,
          oversLimit: 1,
        }),
        { enforceLiveRules: true },
      ),
    ).toThrow(/knockout/);

    const completed = {
      ...state,
      matchTypeId: "semi_final",
      innings: [
        {
          innings: 1,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 20,
          wickets: 1,
          over: 5,
          ball: 0,
          phase: "completed" as const,
          kind: "normal" as const,
          oversLimit: 5,
        },
        {
          innings: 2,
          battingTeamId: 2,
          bowlingTeamId: 1,
          runs: 20,
          wickets: 1,
          over: 5,
          ball: 0,
          phase: "completed" as const,
          kind: "normal" as const,
          oversLimit: 5,
        },
      ],
    };
    const superState = {
      ...completed,
      innings: [
        ...completed.innings,
        {
          innings: 3,
          battingTeamId: 1,
          bowlingTeamId: 2,
          runs: 8,
          wickets: 0,
          over: 1,
          ball: 0,
          phase: "completed" as const,
          kind: "super_over" as const,
          oversLimit: 1,
        },
        {
          innings: 4,
          battingTeamId: 2,
          bowlingTeamId: 1,
          runs: 6,
          wickets: 0,
          over: 1,
          ball: 0,
          phase: "completed" as const,
          kind: "super_over" as const,
          oversLimit: 1,
        },
      ],
    };
    expect(deriveCricketMatchResult(superState).winnerTeamId).toBe(1);
  });
});
