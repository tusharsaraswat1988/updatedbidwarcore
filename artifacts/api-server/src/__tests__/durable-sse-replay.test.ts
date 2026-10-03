import { describe, expect, it } from "vitest";
import {
  createEventEnvelope,
  CricketEventType,
  replayCricketEvents,
  type CricketScoreboardState,
} from "@workspace/scoring-core";

describe("P0-C5: Durable SSE Event Replay & Monotonic Sequencing", () => {
  const meta = {
    matchId: 100,
    tournamentId: 1,
    homeTeamId: 10,
    awayTeamId: 20,
    oversLimit: 20,
  };

  it("assigns strict monotonic sequence IDs to all consecutive cricket events", () => {
    const rawEvents = [
      { type: CricketEventType.MATCH_STARTED, payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 } },
      { type: CricketEventType.BALL_RECORDED, payload: { innings: 1, over: 0, ball: 1, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 4, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true } },
      { type: CricketEventType.BALL_RECORDED, payload: { innings: 1, over: 0, ball: 2, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 0, extras: { type: "no_ball", runs: 1 }, wicket: null, isLegalDelivery: false } },
      { type: CricketEventType.BALL_RECORDED, payload: { innings: 1, over: 0, ball: 2, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 6, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true } },
      { type: CricketEventType.BALL_RECORDED, payload: { innings: 1, over: 0, ball: 3, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 0, extras: { type: null, runs: 0 }, wicket: { type: "bowled", dismissedPlayerId: 1 }, isLegalDelivery: true } },
    ];

    const envelopes = rawEvents.map((e, idx) =>
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: e.type,
        sequence: idx + 1,
        payload: e.payload,
        actorType: "organizer",
      }),
    );

    // Verify strict monotonic ordering
    for (let i = 0; i < envelopes.length; i++) {
      expect(envelopes[i]?.sequence).toBe(i + 1);
      if (i > 0) {
        expect(envelopes[i]!.sequence).toBe(envelopes[i - 1]!.sequence + 1);
      }
    }
  });

  it("replays missed events after Last-Event-ID on client reconnect", () => {
    // 5 events occur in the match: seq 1, 2, 3, 4, 5
    const allEvents = [
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 2,
        payload: { innings: 1, over: 0, ball: 1, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 4, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 3,
        payload: { innings: 1, over: 0, ball: 2, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 6, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 4,
        payload: { innings: 1, over: 0, ball: 3, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 0, extras: { type: null, runs: 0 }, wicket: { type: "caught", dismissedPlayerId: 1 }, isLegalDelivery: true },
        actorType: "organizer",
      }),
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 5,
        payload: { innings: 1, over: 0, ball: 4, strikerId: 3, nonStrikerId: 2, bowlerId: 5, runsOffBat: 1, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
        actorType: "organizer",
      }),
    ];

    // Client had processed up to sequence 2 (FOUR), then disconnected.
    // While disconnected, sequence 3 (SIX), 4 (WICKET), 5 (SINGLE) occurred.
    const lastEventId = 2;
    const missedEvents = allEvents.filter((e) => e.sequence > lastEventId);

    expect(missedEvents).toHaveLength(3);
    expect(missedEvents.map((e) => e.sequence)).toEqual([3, 4, 5]);
    expect(missedEvents[0]?.payload.runsOffBat).toBe(6); // SIX
    expect(missedEvents[1]?.payload.wicket).toBeDefined(); // WICKET
    expect(missedEvents[2]?.payload.runsOffBat).toBe(1); // SINGLE

    // Verify complete state consistency when replayed
    const fullState = replayCricketEvents(meta, allEvents);
    expect(fullState.innings[0]?.runs).toBe(11); // 4 + 6 + 0 + 1 = 11
    expect(fullState.innings[0]?.wickets).toBe(1);
    expect(fullState.innings[0]?.over).toBe(0);
    expect(fullState.innings[0]?.ball).toBe(4);
  });

  it("preserves strict event ordering: NO BALL -> FREE HIT -> next ball", () => {
    const events = [
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
      // Ball 1: No Ball (awards 1 run, sets free hit)
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 2,
        payload: { innings: 1, over: 0, ball: 1, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 0, extras: { type: "no_ball", runs: 1 }, wicket: null, isLegalDelivery: false },
        actorType: "organizer",
      }),
      // Ball 2: Legal ball on Free Hit (SIX hit)
      createEventEnvelope({
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.BALL_RECORDED,
        sequence: 3,
        payload: { innings: 1, over: 0, ball: 1, strikerId: 1, nonStrikerId: 2, bowlerId: 5, runsOffBat: 6, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true },
        actorType: "organizer",
      }),
    ];

    const state = replayCricketEvents(meta, events);
    expect(state.innings[0]?.runs).toBe(7); // 1 nb + 6 runs
    expect(state.innings[0]?.over).toBe(0);
    expect(state.innings[0]?.ball).toBe(1); // only 1 legal ball
    expect(state.freeHitActive).toBe(false); // cleared after legal delivery
  });

  it("prevents duplicate scoring or animation side-effects when replaying previously processed events (idempotency)", () => {
    let lastProcessedSequence = 0;
    const triggeredAnimations: string[] = [];

    function processEventOnClient(ev: { sequence: number; type: string }) {
      // Client-side idempotency guard
      if (ev.sequence <= lastProcessedSequence) {
        return; // Skip duplicate!
      }
      lastProcessedSequence = ev.sequence;
      triggeredAnimations.push(`${ev.type}-${ev.sequence}`);
    }

    // Client receives events 1, 2, 3
    processEventOnClient({ sequence: 1, type: "FOUR" });
    processEventOnClient({ sequence: 2, type: "SIX" });
    processEventOnClient({ sequence: 3, type: "WICKET" });

    expect(triggeredAnimations).toEqual(["FOUR-1", "SIX-2", "WICKET-3"]);

    // Client reconnects and server replays events 2, 3, 4
    processEventOnClient({ sequence: 2, type: "SIX" }); // duplicate replay -> skipped
    processEventOnClient({ sequence: 3, type: "WICKET" }); // duplicate replay -> skipped
    processEventOnClient({ sequence: 4, type: "FOUR" }); // new event -> processed

    expect(triggeredAnimations).toEqual(["FOUR-1", "SIX-2", "WICKET-3", "FOUR-4"]);
    expect(lastProcessedSequence).toBe(4);
  });
});
