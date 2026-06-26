import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  cricketScoringAdapter,
  scoringAdapterRegistry,
} from "../index";

describe("scoring adapter registry", () => {
  it("registers cricket adapter at module load", () => {
    expect(scoringAdapterRegistry.has("cricket")).toBe(true);
    expect(scoringAdapterRegistry.get("cricket")).toBe(cricketScoringAdapter);
  });

  it("cricket adapter replay matches direct replayCricketEvents", () => {
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

    const viaAdapter = cricketScoringAdapter.replay(meta, events);
    expect(viaAdapter.innings[0]?.runs).toBe(4);
    expect(viaAdapter.matchStatus).toBe("live");
  });

  it("cricket adapter parseEvent rejects invalid payload", () => {
    const result = cricketScoringAdapter.parseEvent(CricketEventType.BALL_RECORDED, {});
    expect(result.ok).toBe(false);
  });

  it("throws when adapter is missing", () => {
    expect(() => scoringAdapterRegistry.get("badminton")).toThrow(/No scoring adapter/);
  });
});

describe("cricket adapter initial state", () => {
  it("matches createInitialCricketState for empty replay", () => {
    const meta = {
      matchId: 5,
      tournamentId: 10,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 20,
    };
    const replayed = cricketScoringAdapter.replay(meta, []);
    const initial = createInitialCricketState(meta);
    expect(replayed).toEqual(initial);
  });
});
