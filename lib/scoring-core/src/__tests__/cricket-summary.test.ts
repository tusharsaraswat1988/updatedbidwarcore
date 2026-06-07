import { describe, expect, it } from "vitest";
import {
  buildCricketMatchSummary,
  createInitialCricketState,
  CricketEventType,
  createEventEnvelope,
  replayCricketEvents,
} from "../index";

describe("buildCricketMatchSummary", () => {
  it("builds innings rows from projected state", () => {
    const meta = {
      matchId: 1,
      tournamentId: 10,
      homeTeamId: 100,
      awayTeamId: 200,
      oversLimit: 20,
    };

    const events = [
      createEventEnvelope({
        matchId: 1,
        tournamentId: 10,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 100, electedTo: "bat", oversLimit: 20 },
        actorType: "organizer",
      }),
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
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 9,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "organizer",
      }),
    ];

    const state = replayCricketEvents(meta, events);
    const summary = buildCricketMatchSummary(state);

    expect(summary.innings).toHaveLength(1);
    expect(summary.innings[0]?.runs).toBe(4);
    expect(summary.innings[0]?.overs).toBe("0.1");
    expect(summary.matchStatus).toBe("live");
  });

  it("returns empty innings for scheduled match", () => {
    const state = createInitialCricketState({
      matchId: 1,
      tournamentId: 10,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 20,
    });
    const summary = buildCricketMatchSummary(state);
    expect(summary.innings).toHaveLength(0);
    expect(summary.matchStatus).toBe("scheduled");
  });
});
