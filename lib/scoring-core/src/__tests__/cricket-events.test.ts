import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  parseCricketEventPayload,
} from "../index";

describe("cricket event models", () => {
  it("parses match.started payload", () => {
    const result = parseCricketEventPayload(CricketEventType.MATCH_STARTED, {
      tossWinnerTeamId: 10,
      electedTo: "bat",
      oversLimit: 20,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid ball.recorded payload", () => {
    const result = parseCricketEventPayload(CricketEventType.BALL_RECORDED, {
      innings: 1,
      strikerId: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("creates event envelope with defaults", () => {
    const event = createEventEnvelope({
      matchId: 1,
      tournamentId: 2,
      sportSlug: "cricket",
      eventType: CricketEventType.MATCH_STARTED,
      sequence: 1,
      payload: { tossWinnerTeamId: 5, electedTo: "bowl", oversLimit: 20 },
      actorType: "organizer",
    });
    expect(event.eventVersion).toBe(1);
    expect(event.sequence).toBe(1);
    expect(event.sportSlug).toBe("cricket");
  });
});
