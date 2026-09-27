import { describe, expect, it } from "vitest";
import { CricketEventType } from "../events/cricket";
import {
  buildAuthoritativeCricketBroadcastEvent,
  buildCricketBroadcastEventId,
} from "../cricket/broadcast-events";

describe("Authoritative Cricket Broadcast Events", () => {
  const matchId = 123;

  describe("Deterministic ID Generation", () => {
    it("generates deterministic ID matching matchId:sequence:type format", () => {
      expect(buildCricketBroadcastEventId(123, 47, "FOUR")).toBe("123:47:FOUR");
      expect(buildCricketBroadcastEventId(123, 48, "WIDE")).toBe("123:48:WIDE");
      expect(buildCricketBroadcastEventId(123, 49, "NO_BALL")).toBe("123:49:NO_BALL");
      expect(buildCricketBroadcastEventId(123, 50, "SIX")).toBe("123:50:SIX");
      expect(buildCricketBroadcastEventId(123, 51, "WICKET")).toBe("123:51:WICKET");
    });
  });

  describe("Ball Recorded Events", () => {
    it("builds FOUR event from legal 4 runs off the bat", () => {
      const event = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 47,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 2,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("123:47:FOUR");
      expect(event?.type).toBe("FOUR");
      expect(event?.sequence).toBe(47);
      expect(event?.matchId).toBe(123);
      expect(event?.batter).toBe("Rohit Sharma");
      expect(event?.bowler).toBe("Mitchell Starc");
      expect(event?.runs).toBe(4);
      expect(event?.detail).toBe("Rohit Sharma · BOUNDARY 4");
    });

    it("builds SIX event from legal 6 runs off the bat", () => {
      const event = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 48,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 3,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("123:48:SIX");
      expect(event?.type).toBe("SIX");
      expect(event?.sequence).toBe(48);
      expect(event?.runs).toBe(6);
      expect(event?.detail).toBe("Rohit Sharma · MAXIMUM 6");
    });

    it("builds WIDE event with extra run details", () => {
      const event = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 49,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 4,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "wide", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("123:49:WIDE");
      expect(event?.type).toBe("WIDE");
      expect(event?.sequence).toBe(49);
      expect(event?.runs).toBe(0);
      expect(event?.detail).toBe("ILLEGAL DELIVERY · EXTRA RUN CONCEDED");
    });

    it("builds NO_BALL event with free hit notification", () => {
      const event = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 50,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 4,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "no_ball", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("123:50:NO_BALL");
      expect(event?.type).toBe("NO_BALL");
      expect(event?.sequence).toBe(50);
      expect(event?.detail).toBe("EXTRA RUN · FREE HIT AWARDED NEXT BALL");
    });

    it("builds WICKET event taking priority over runs/extras", () => {
      const event = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 51,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 5,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: null, runs: 0 },
          wicket: { type: "caught", dismissedPlayerId: 10, fielderId: 15 },
          isLegalDelivery: true,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("123:51:WICKET");
      expect(event?.type).toBe("WICKET");
      expect(event?.sequence).toBe(51);
      expect(event?.detail).toBe("Rohit Sharma · CAUGHT");
    });

    it("handles no-ball + boundary 4 (SIX / FOUR on illegal delivery)", () => {
      const eventFour = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 52,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 5,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 4,
          extras: { type: "no_ball", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(eventFour).not.toBeNull();
      expect(eventFour?.id).toBe("123:52:FOUR");
      expect(eventFour?.type).toBe("FOUR");
      expect(eventFour?.detail).toBe("Rohit Sharma · NO BALL + BOUNDARY 4");

      const eventSix = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 53,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 5,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 6,
          extras: { type: "no_ball", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Mitchell Starc",
      });

      expect(eventSix).not.toBeNull();
      expect(eventSix?.id).toBe("123:53:SIX");
      expect(eventSix?.type).toBe("SIX");
      expect(eventSix?.detail).toBe("Rohit Sharma · NO BALL + MAXIMUM 6");
    });

    it("returns null for non-transient deliveries (dots, singles)", () => {
      const dotBall = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 54,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 3,
          ball: 6,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
      });
      expect(dotBall).toBeNull();

      const single = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 55,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 4,
          ball: 1,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 1,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
      });
      expect(single).toBeNull();
    });

    it("builds MATCH_WON on match completed event", () => {
      const event = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 120,
        eventType: CricketEventType.MATCH_COMPLETED,
        payload: {
          winnerTeamId: 1,
          margin: "5 wickets",
          resultText: "Titans Won by 5 wickets",
        },
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("123:120:MATCH_WON");
      expect(event?.type).toBe("MATCH_WON");
      expect(event?.detail).toBe("Titans Won by 5 wickets");
    });
  });
});
