import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  reduceCricket,
  replayCricketEvents,
  resolveCricketUndoTarget,
  resolveEventsForReplay,
} from "../index";

const matchMeta = {
  matchId: 16,
  tournamentId: 40,
  homeTeamId: 1,
  awayTeamId: 2,
  oversLimit: 5,
  playingXiEnforced: true,
};

function env(
  sequence: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return createEventEnvelope({
    matchId: 16,
    tournamentId: 40,
    sportSlug: "cricket",
    eventType,
    sequence,
    payload,
    actorType: "organizer",
  });
}

function setupEvents() {
  return [
    env(1, CricketEventType.MATCH_STARTED, {
      tossWinnerTeamId: 1,
      electedTo: "bat",
      oversLimit: 5,
    }),
    env(2, CricketEventType.LINEUP_SET, {
      teamId: 1,
      playerIds: [11, 12, 13],
    }),
    env(3, CricketEventType.LINEUP_SET, {
      teamId: 2,
      playerIds: [21, 22],
    }),
    env(4, CricketEventType.BOWLER_CHANGED, {
      innings: 1,
      bowlerId: 21,
    }),
  ];
}

function tombstone(sequence: number, undoesSequence: number) {
  return env(sequence, CricketEventType.BALL_UNDONE, {
    undoesEventId: undoesSequence,
    undoesSequence,
  });
}

describe("cricket undo before the first ball", () => {
  it("walks back bowler, then squads, then toss", () => {
    const events = setupEvents();

    expect(resolveCricketUndoTarget(events)).toMatchObject({
      kind: "setup",
      event: { sequence: 4, eventType: CricketEventType.BOWLER_CHANGED },
    });

    const afterBowler = [...events, tombstone(5, 4)];
    const bowlerState = replayCricketEvents(matchMeta, afterBowler);
    expect(bowlerState.matchStatus).toBe("live");
    expect(bowlerState.bowlerId).toBeNull();
    expect(bowlerState.lineups[1]).toEqual([11, 12, 13]);
    expect(bowlerState.lineups[2]).toEqual([21, 22]);
    expect(bowlerState.strikerId).toBe(11);
    expect(resolveCricketUndoTarget(afterBowler)?.event.sequence).toBe(3);

    const afterBowlingSquad = [...afterBowler, tombstone(6, 3)];
    const bowlingState = replayCricketEvents(matchMeta, afterBowlingSquad);
    expect(bowlingState.lineups[2]).toBeUndefined();
    expect(bowlingState.lineups[1]).toEqual([11, 12, 13]);
    expect(resolveCricketUndoTarget(afterBowlingSquad)?.event.sequence).toBe(2);

    const afterBattingSquad = [...afterBowlingSquad, tombstone(7, 2)];
    const battingState = replayCricketEvents(matchMeta, afterBattingSquad);
    expect(battingState.lineups[1]).toBeUndefined();
    expect(battingState.strikerId).toBeNull();
    expect(battingState.nonStrikerId).toBeNull();
    expect(battingState.innings).toHaveLength(1);
    expect(resolveCricketUndoTarget(afterBattingSquad)?.event.sequence).toBe(1);

    const afterToss = [...afterBattingSquad, tombstone(8, 1)];
    const tossState = replayCricketEvents(matchMeta, afterToss);
    expect(tossState.matchStatus).toBe("scheduled");
    expect(tossState.innings).toHaveLength(0);
    expect(tossState.tossWinnerTeamId).toBeNull();
    expect(resolveCricketUndoTarget(afterToss)).toBeNull();
    expect(resolveEventsForReplay(afterToss)).toEqual([]);
  });

  it("still undoes the last ball once a delivery exists", () => {
    const events = [
      ...setupEvents(),
      env(5, CricketEventType.BALL_RECORDED, {
        innings: 1,
        over: 0,
        ball: 1,
        strikerId: 11,
        nonStrikerId: 12,
        bowlerId: 21,
        runsOffBat: 1,
        extras: { type: null, runs: 0 },
        wicket: null,
        isLegalDelivery: true,
      }),
    ];
    expect(resolveCricketUndoTarget(events)).toMatchObject({
      kind: "ball",
      event: { sequence: 5 },
    });
  });

  it("replaces an opening batter before the first ball", () => {
    const started = setupEvents().reduce(
      (state, event) => reduceCricket(state, event, { enforceLiveRules: true }),
      createInitialCricketState(matchMeta),
    );
    expect(started.strikerId).toBe(11);
    expect(started.nonStrikerId).toBe(12);

    const replaced = reduceCricket(
      started,
      env(5, CricketEventType.BATTER_SELECTED, {
        innings: 1,
        playerId: 13,
        position: "striker",
      }),
      { enforceLiveRules: true },
    );
    expect(replaced.strikerId).toBe(13);
    expect(replaced.nonStrikerId).toBe(12);

    const undone = replayCricketEvents(matchMeta, [
      ...setupEvents(),
      env(5, CricketEventType.BATTER_SELECTED, {
        innings: 1,
        playerId: 13,
        position: "striker",
      }),
      tombstone(6, 5),
    ]);
    expect(undone.strikerId).toBe(11);
    expect(undone.nonStrikerId).toBe(12);
    expect(undone.bowlerId).toBe(21);
  });
});
