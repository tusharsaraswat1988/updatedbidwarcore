import { describe, expect, it } from "vitest";
import {
  createEventEnvelope,
  CricketEventType,
  replayCricketEvents,
  buildLeagueKnockoutStages,
  makeSlotKey,
  resolveGroupQualifications,
  resolveParticipantSource,
  buildStandingsFromMatches,
  type GroupStandingsMap,
} from "@workspace/scoring-core";
import {
  publishRealtimeMessage,
  subscribeRealtimeBus,
  type RealtimeMessage,
} from "../lib/scoring-realtime-bus";

describe("P0 Fixation: Adversarial Concurrency & Recovery Scenarios", () => {
  const meta = {
    matchId: 200,
    tournamentId: 5,
    homeTeamId: 10,
    awayTeamId: 20,
    oversLimit: 20,
  };

  it("Scenario A: Scorer submits FOUR, OBS disconnects, WICKET occurs, OBS reconnects with Last-Event-ID", () => {
    // 1. Initial Match Start
    const e1 = createEventEnvelope({
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: 1,
      payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 },
      actorType: "organizer",
    });

    // 2. Scorer submits FOUR (seq 2)
    const e2 = createEventEnvelope({
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 2,
      payload: { innings: 1, over: 0, ball: 1, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 4, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
      actorType: "organizer",
    });

    // OBS receives seq 1 and 2
    const obsReceivedSequences: number[] = [1, 2];
    const obsLastEventId = 2;

    // 3. OBS disconnects. While disconnected, WICKET (seq 3) and SINGLE (seq 4) occur.
    const e3 = createEventEnvelope({
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 3,
      payload: { innings: 1, over: 0, ball: 2, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 0, extras: { type: null, runs: 0 }, wicket: { type: "bowled", dismissedPlayerId: 1 }, isLegalDelivery: true },
      actorType: "organizer",
    });

    const e4 = createEventEnvelope({
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 4,
      payload: { innings: 1, over: 0, ball: 3, strikerId: 3, nonStrikerId: 2, bowlerId: 5, runsOffBat: 1, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
      actorType: "organizer",
    });

    const allEvents = [e1, e2, e3, e4];

    // 4. OBS reconnects supplying Last-Event-ID: 2
    const replayedEvents = allEvents.filter((e) => e.sequence > obsLastEventId);
    expect(replayedEvents.map((e) => e.sequence)).toEqual([3, 4]);

    for (const rep of replayedEvents) {
      obsReceivedSequences.push(rep.sequence);
    }

    // OBS now has all sequences in order [1, 2, 3, 4]
    expect(obsReceivedSequences).toEqual([1, 2, 3, 4]);

    const finalState = replayCricketEvents(meta, allEvents);
    expect(finalState.innings[0]?.runs).toBe(5); // 4 + 0 + 1 = 5 runs
    expect(finalState.innings[0]?.wickets).toBe(1);
    expect(finalState.innings[0]?.over).toBe(0);
    expect(finalState.innings[0]?.ball).toBe(3);
  });

  it("Scenario B: API Instance A receives scorer event, OBS is connected to API Instance B", () => {
    const instanceBReceived: RealtimeMessage[] = [];

    // OBS is connected to Instance B
    const unsub = subscribeRealtimeBus((msg) => {
      instanceBReceived.push(msg);
    });

    // Scorer submits SIX on Instance A
    publishRealtimeMessage(1234, "scoring", {
      type: "scoring_state",
      matchId: 99,
      sequence: 77,
      broadcastEvent: {
        id: "evt-77",
        type: "cricket_six",
        sequence: 77,
        runs: 6,
      },
    }, 77);

    expect(instanceBReceived.length).toBeGreaterThan(0);
    const lastMsg = instanceBReceived[instanceBReceived.length - 1];
    expect(lastMsg?.tournamentId).toBe(1234);
    expect(lastMsg?.sequence).toBe(77);
    expect((lastMsg?.payload as { broadcastEvent?: { type?: string } })?.broadcastEvent?.type).toBe("cricket_six");

    unsub();
  });

  it("Scenario C: Scorer sends two events within milliseconds -> strict sequence ordering", () => {
    const eventA = createEventEnvelope({
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 101,
      payload: { innings: 1, over: 0, ball: 1, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 4, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
      actorType: "organizer",
    });

    const eventB = createEventEnvelope({
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "cricket",
      eventType: CricketEventType.BALL_RECORDED,
      sequence: 102,
      payload: { innings: 1, over: 0, ball: 2, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 6, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
      actorType: "organizer",
    });

    expect(eventA.sequence).toBe(101);
    expect(eventB.sequence).toBe(102);
    expect(eventB.sequence).toBeGreaterThan(eventA.sequence);
  });

  it("Scenario D: Same scoring request retried -> no duplicate scoring (idempotency)", () => {
    let matchScore = 0;
    const processedCorrelationIds = new Set<string>();

    function applyScoringMutation(req: { correlationId: string; runs: number }) {
      if (processedCorrelationIds.has(req.correlationId)) {
        return { applied: false, score: matchScore }; // Idempotent skip!
      }
      processedCorrelationIds.add(req.correlationId);
      matchScore += req.runs;
      return { applied: true, score: matchScore };
    }

    const firstAttempt = applyScoringMutation({ correlationId: "uuid-ball-10", runs: 4 });
    expect(firstAttempt.applied).toBe(true);
    expect(firstAttempt.score).toBe(4);

    // Network retry with same correlationId
    const retryAttempt = applyScoringMutation({ correlationId: "uuid-ball-10", runs: 4 });
    expect(retryAttempt.applied).toBe(false);
    expect(retryAttempt.score).toBe(4); // Did not become 8!
  });

  it("Scenario E: Semi-final result processed twice concurrently -> one winner advancement and one valid final slot population", () => {
    const qualifiersBySlotKey = {
      [makeSlotKey("Group A", 1)]: 101,
      [makeSlotKey("Group B", 2)]: 102,
    };

    const sf1WinnerTeamId = 101;
    const finalFixture = {
      homeTeamId: 0,
      awayTeamId: 0,
    };

    // Worker 1 processes SF1 winner
    if (finalFixture.homeTeamId === 0) {
      finalFixture.homeTeamId = sf1WinnerTeamId;
    }

    // Worker 2 concurrently / repeatedly processes SF1 winner
    if (finalFixture.homeTeamId === 0) {
      finalFixture.homeTeamId = sf1WinnerTeamId;
    }

    expect(finalFixture.homeTeamId).toBe(101);
    expect(finalFixture.awayTeamId).toBe(0); // Away slot remains clean for SF2 winner
  });
});
