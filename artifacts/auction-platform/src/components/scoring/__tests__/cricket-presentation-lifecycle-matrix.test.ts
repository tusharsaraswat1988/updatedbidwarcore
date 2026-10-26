import { describe, expect, it, beforeEach } from "vitest";
import {
  CricketEventType,
  reduceCricket,
  createInitialCricketState,
  createEventEnvelope,
  buildAuthoritativeCricketBroadcastEvent,
  buildCricketBroadcastEventId,
  type CricketScoreboardState,
} from "@workspace/scoring-core";
import {
  normalizeAuthoritativeBroadcastEvent,
} from "@/components/broadcast/obs-v2/obs-v2-event-adapter";
import {
  OBS_V2_EVENT_PRIORITY,
  OBS_V2_EVENT_CONFIGS,
} from "@/components/broadcast/obs-v2/obs-v2-events";

function createCricketEvent(
  matchId: number,
  sequence: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return createEventEnvelope({
    matchId,
    tournamentId: 1,
    sportSlug: "cricket",
    sequence,
    eventType,
    payload,
    actorType: "scorer",
  });
}

describe("Section 18: Complete Presentation Event & Timing Matrix", () => {
  const matchId = 99;
  let state: CricketScoreboardState;
  let seq: number;

  beforeEach(() => {
    state = createInitialCricketState({
      matchId: 99,
      tournamentId: 1,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 20,
    });
    seq = 0;
  });

  it("1. Match creation & setup phase generates ZERO presentation broadcast events", () => {
    // Lineups
    seq++;
    const lineupEvent1 = createCricketEvent(matchId, seq, CricketEventType.LINEUP_SET, {
      teamId: 1,
      playerIds: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
    });
    state = reduceCricket(state, lineupEvent1);
    const lineup1Broadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: lineupEvent1.eventType,
      payload: lineupEvent1.payload,
    });
    expect(lineup1Broadcast).toBeNull();

    seq++;
    const lineupEvent2 = createCricketEvent(matchId, seq, CricketEventType.LINEUP_SET, {
      teamId: 2,
      playerIds: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211],
    });
    state = reduceCricket(state, lineupEvent2);
    const lineup2Broadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: lineupEvent2.eventType,
      payload: lineupEvent2.payload,
    });
    expect(lineup2Broadcast).toBeNull();

    // Match Start with opening toss & setup
    seq++;
    const startEvent = createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
      tossWinnerTeamId: 1,
      electedTo: "bat",
      oversLimit: 20,
    });
    state = reduceCricket(state, startEvent);
    const startBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: startEvent.eventType,
      payload: startEvent.payload,
    });
    // Crucial: Match start & opening setup must NOT trigger NEW_BATTER or NEW_BOWLER
    expect(startBroadcast).toBeNull();
  });

  it("2. Strike rotation (1/2/3 runs) does NOT trigger NEW_BATTER presentation event", () => {
    // Start match
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 20,
      }),
    );

    seq++;
    const singleBall = createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 1,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    });
    state = reduceCricket(state, singleBall);
    const singleBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: singleBall.eventType,
      payload: singleBall.payload,
      batterName: "Opening Striker",
      bowlerName: "Opening Bowler",
    });
    // Single run changes striker/non-striker on state, but must NEVER trigger a presentation event
    expect(singleBroadcast).toBeNull();
  });

  it("3. Boundaries & Extras trigger exact corresponding presentation events, NOT NEW_BATTER/BOWLER", () => {
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 20,
      }),
    );

    // FOUR
    seq++;
    const fourBall = createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 4,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    });
    state = reduceCricket(state, fourBall);
    const fourBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: fourBall.eventType,
      payload: fourBall.payload,
      batterName: "Batter One",
      bowlerName: "Bowler One",
    });
    expect(fourBroadcast?.type).toBe("FOUR");
    expect(fourBroadcast?.id).toBe(`${matchId}:${seq}:FOUR`);

    // SIX
    seq++;
    const sixBall = createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
      innings: 1,
      over: 0,
      ball: 2,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 6,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    });
    state = reduceCricket(state, sixBall);
    const sixBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: sixBall.eventType,
      payload: sixBall.payload,
      batterName: "Batter One",
      bowlerName: "Bowler One",
    });
    expect(sixBroadcast?.type).toBe("SIX");
    expect(sixBroadcast?.id).toBe(`${matchId}:${seq}:SIX`);
  });

  it("4. Wicket produces WICKET event, and replacement batter selection produces exactly 1 NEW_BATTER event", () => {
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 20,
      }),
    );

    // Lineup for Playing XI check
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.LINEUP_SET, {
        teamId: 1,
        playerIds: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111],
      }),
    );

    // First ball establishes striker 101 and nonStriker 102
    seq++;
    const ball1 = createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
      innings: 1,
      over: 0,
      ball: 1,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    });
    state = reduceCricket(state, ball1);

    // Wicket falls on ball 2
    seq++;
    const wicketBall = createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
      innings: 1,
      over: 0,
      ball: 2,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: {
        type: "bowled",
        dismissedPlayerId: 101,
      },
      isLegalDelivery: true,
    });
    state = reduceCricket(state, wicketBall);
    const wicketBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: wicketBall.eventType,
      payload: wicketBall.payload,
      batterName: "Batter One",
      bowlerName: "Bowler One",
    });
    expect(wicketBroadcast?.type).toBe("WICKET");
    expect(wicketBroadcast?.id).toBe(`${matchId}:${seq}:WICKET`);
    expect(state.strikerId).toBeNull(); // Vacated crease slot

    // Replacement batter chosen (BATTER_SELECTED event)
    seq++;
    const selectBatter = createCricketEvent(matchId, seq, CricketEventType.BATTER_SELECTED, {
      innings: 1,
      playerId: 103,
    });
    state = reduceCricket(state, selectBatter);
    expect(state.strikerId).toBe(103);

    const batterBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: selectBatter.eventType,
      payload: selectBatter.payload,
      batterName: "Batter Three",
    });
    expect(batterBroadcast).not.toBeNull();
    expect(batterBroadcast?.type).toBe("NEW_BATTER");
    expect(batterBroadcast?.id).toBe(`${matchId}:${seq}:NEW_BATTER`);
    expect(batterBroadcast?.batter).toBe("Batter Three");

    // Normalized into ObsV2Event
    const obsEvent = normalizeAuthoritativeBroadcastEvent(batterBroadcast!);
    expect(obsEvent).not.toBeNull();
    expect(obsEvent?.type).toBe("NEW_BATTER");
    expect(obsEvent?.batter).toBe("Batter Three");
  });

  it("5. Over completion alone produces 0 NEW_BOWLER events; explicit bowler selection produces exactly 1 NEW_BOWLER", () => {
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 20,
      }),
    );

    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.LINEUP_SET, {
        teamId: 2,
        playerIds: [201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211],
      }),
    );

    // 5 balls
    for (let b = 1; b <= 5; b++) {
      seq++;
      state = reduceCricket(
        state,
        createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
          innings: 1,
          over: 0,
          ball: b,
          strikerId: 101,
          nonStrikerId: 102,
          bowlerId: 201,
          runsOffBat: 0,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        }),
      );
    }

    // Ball 6 (End of Over 0)
    seq++;
    const ball6 = createCricketEvent(matchId, seq, CricketEventType.BALL_RECORDED, {
      innings: 1,
      over: 0,
      ball: 6,
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: null,
      isLegalDelivery: true,
    });
    state = reduceCricket(state, ball6);
    const overEndBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: ball6.eventType,
      payload: ball6.payload,
      batterName: "Batter One",
      bowlerName: "Bowler One",
    });
    // Over completion dot ball must produce 0 presentation events
    expect(overEndBroadcast).toBeNull();

    // Now scorer confirms new bowler for over 1
    seq++;
    const bowlerSelect = createCricketEvent(matchId, seq, CricketEventType.BOWLER_CHANGED, {
      innings: 1,
      bowlerId: 202,
    });
    state = reduceCricket(state, bowlerSelect);
    expect(state.bowlerId).toBe(202);

    const bowlerBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: bowlerSelect.eventType,
      payload: bowlerSelect.payload,
      bowlerName: "Bowler Two",
    });
    expect(bowlerBroadcast).not.toBeNull();
    expect(bowlerBroadcast?.type).toBe("NEW_BOWLER");
    expect(bowlerBroadcast?.id).toBe(`${matchId}:${seq}:NEW_BOWLER`);
    expect(bowlerBroadcast?.bowler).toBe("Bowler Two");

    // Normalized into ObsV2Event
    const obsEvent = normalizeAuthoritativeBroadcastEvent(bowlerBroadcast!);
    expect(obsEvent).not.toBeNull();
    expect(obsEvent?.type).toBe("NEW_BOWLER");
    expect(obsEvent?.bowler).toBe("Bowler Two");
  });

  it("6. Innings completion produces exactly 1 INNINGS_COMPLETE event without premature NEW_BATTER/BOWLER", () => {
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 20,
      }),
    );

    seq++;
    const inningsEndEvent = createCricketEvent(matchId, seq, CricketEventType.INNINGS_ENDED, {
      innings: 1,
      reason: "overs_complete",
      runs: 165,
      wickets: 4,
      overs: "20.0",
    });
    state = reduceCricket(state, inningsEndEvent);

    const innBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: inningsEndEvent.eventType,
      payload: inningsEndEvent.payload,
      battingTeam: "Team One",
      target: 166,
    });
    expect(innBroadcast).not.toBeNull();
    expect(innBroadcast?.type).toBe("INNINGS_COMPLETE");
    expect(innBroadcast?.id).toBe(`${matchId}:${seq}:INNINGS_COMPLETE`);
    expect(innBroadcast?.runs).toBe(165);
    expect(innBroadcast?.wickets).toBe(4);
    expect(innBroadcast?.overs).toBe("20.0");
    expect(innBroadcast?.target).toBe(166);

    // Normalized into ObsV2Event
    const obsEvent = normalizeAuthoritativeBroadcastEvent(innBroadcast!);
    expect(obsEvent).not.toBeNull();
    expect(obsEvent?.type).toBe("INNINGS_COMPLETE");
    expect(obsEvent?.target).toBe(166);
  });

  it("7. Match completed produces exactly 1 MATCH_WON presentation event", () => {
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.MATCH_STARTED, {
        tossWinnerTeamId: 1,
        electedTo: "bat",
        oversLimit: 1,
      }),
    );

    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.INNINGS_ENDED, {
        innings: 1,
        reason: "overs_complete",
        runs: 100,
        wickets: 5,
        overs: "1.0",
      }),
    );

    // Innings 2 ends
    seq++;
    state = reduceCricket(
      state,
      createCricketEvent(matchId, seq, CricketEventType.INNINGS_ENDED, {
        innings: 2,
        reason: "overs_complete",
        runs: 80,
        wickets: 5,
        overs: "1.0",
      }),
    );

    seq++;
    const matchEndEvent = createCricketEvent(matchId, seq, CricketEventType.MATCH_COMPLETED, {
      winnerTeamId: 1,
      margin: "20 runs",
      resultText: "Team One Won by 20 runs",
    });
    state = reduceCricket(state, matchEndEvent);

    const matchBroadcast = buildAuthoritativeCricketBroadcastEvent({
      matchId,
      sequence: seq,
      eventType: matchEndEvent.eventType,
      payload: matchEndEvent.payload,
      winnerTeamName: "Team One",
    });
    expect(matchBroadcast).not.toBeNull();
    expect(matchBroadcast?.type).toBe("MATCH_WON");
    expect(matchBroadcast?.id).toBe(`${matchId}:${seq}:MATCH_WON`);
    expect(matchBroadcast?.winnerName).toBe("Team One");

    const obsEvent = normalizeAuthoritativeBroadcastEvent(matchBroadcast!);
    expect(obsEvent).not.toBeNull();
    expect(obsEvent?.type).toBe("MATCH_WON");
    expect(obsEvent?.winnerName).toBe("Team One");
  });

  it("8. Event configuration and priorities are properly registered for all new types", () => {
    expect(OBS_V2_EVENT_PRIORITY.NEW_BATTER).toBeDefined();
    expect(OBS_V2_EVENT_PRIORITY.NEW_BOWLER).toBeDefined();
    expect(OBS_V2_EVENT_PRIORITY.INNINGS_COMPLETE).toBeDefined();
    expect(OBS_V2_EVENT_PRIORITY.MATCH_WON).toBeDefined();

    expect(OBS_V2_EVENT_CONFIGS.NEW_BATTER).toBeDefined();
    expect(OBS_V2_EVENT_CONFIGS.NEW_BOWLER).toBeDefined();
    expect(OBS_V2_EVENT_CONFIGS.INNINGS_COMPLETE).toBeDefined();
    expect(OBS_V2_EVENT_CONFIGS.MATCH_WON).toBeDefined();
  });

  it("9. Deterministic ID deduplication prevents duplicate SSE/reconnect presentation replaying", () => {
    const seenEventIds = new Set<string>();

    function processEvent(event: { id: string; type: string }) {
      if (seenEventIds.has(event.id)) {
        return "IGNORED_DUPLICATE";
      }
      seenEventIds.add(event.id);
      return "ANIMATED";
    }

    const eventId1 = buildCricketBroadcastEventId(matchId, 10, "NEW_BATTER");
    const eventId2 = buildCricketBroadcastEventId(matchId, 11, "NEW_BOWLER");

    expect(processEvent({ id: eventId1, type: "NEW_BATTER" })).toBe("ANIMATED");
    // Duplicate arrival over SSE / window event
    expect(processEvent({ id: eventId1, type: "NEW_BATTER" })).toBe("IGNORED_DUPLICATE");

    // Second event
    expect(processEvent({ id: eventId2, type: "NEW_BOWLER" })).toBe("ANIMATED");
    // Reconnect / replay of second event
    expect(processEvent({ id: eventId2, type: "NEW_BOWLER" })).toBe("IGNORED_DUPLICATE");
  });
});
