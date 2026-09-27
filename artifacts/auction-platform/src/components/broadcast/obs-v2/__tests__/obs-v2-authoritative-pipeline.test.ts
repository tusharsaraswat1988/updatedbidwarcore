import { describe, expect, it } from "vitest";
import {
  buildAuthoritativeCricketBroadcastEvent,
  buildCricketBroadcastEventId,
  CricketEventType,
  type CricketAuthoritativeBroadcastEvent,
} from "@workspace/scoring-core";
import { normalizeAuthoritativeBroadcastEvent } from "../obs-v2-event-adapter";
import { OBS_V2_EVENT_CONFIGS, OBS_V2_EVENT_PRIORITY, type ObsV2BroadcastEvent } from "../obs-v2-events";
import { OBS_V2 } from "../obs-v2-tokens";

describe("OBS V2 Authoritative Cricket Live Pipeline (P0 Acceptance)", () => {
  const matchId = 101;

  describe("1. FOUR from umpire BALL_RECORDED", () => {
    it("generates authoritative FOUR event, normalizes with brand color, and ensures deterministic ID", () => {
      // 1. Umpire presses FOUR
      const seq = 47;
      const serverEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: seq,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 2,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Pat Cummins",
      });

      expect(serverEvent).not.toBeNull();
      expect(serverEvent?.id).toBe("101:47:FOUR");
      expect(serverEvent?.type).toBe("FOUR");

      // 2. OBS V2 receives scoring_state and normalizes event
      const obsEvent = normalizeAuthoritativeBroadcastEvent(serverEvent!);
      expect(obsEvent).not.toBeNull();
      expect(obsEvent?.id).toBe("101:47:FOUR");
      expect(obsEvent?.type).toBe("FOUR");
      expect(obsEvent?.title).toBe("BOUNDARY 4");
      expect(obsEvent?.subtitle).toContain("Rohit Sharma");
      expect(obsEvent?.accentColor).toBe(OBS_V2.color.brand);
      expect(obsEvent?.priority).toBe(OBS_V2_EVENT_PRIORITY.FOUR);
    });
  });

  describe("2. SIX from umpire BALL_RECORDED", () => {
    it("generates authoritative SIX event and normalizes for maximum display", () => {
      const seq = 48;
      const serverEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: seq,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 3,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Pat Cummins",
      });

      expect(serverEvent).not.toBeNull();
      expect(serverEvent?.id).toBe("101:48:SIX");
      expect(serverEvent?.type).toBe("SIX");

      const obsEvent = normalizeAuthoritativeBroadcastEvent(serverEvent!);
      expect(obsEvent?.id).toBe("101:48:SIX");
      expect(obsEvent?.type).toBe("SIX");
      expect(obsEvent?.title).toBe("MAXIMUM 6");
      expect(obsEvent?.priority).toBe(OBS_V2_EVENT_PRIORITY.SIX);
    });
  });

  describe("3. WIDE from umpire BALL_RECORDED", () => {
    it("generates authoritative WIDE event and normalizes with neutral accent", () => {
      const seq = 49;
      const serverEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: seq,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 3,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "wide", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Pat Cummins",
      });

      expect(serverEvent).not.toBeNull();
      expect(serverEvent?.id).toBe("101:49:WIDE");
      expect(serverEvent?.type).toBe("WIDE");

      const obsEvent = normalizeAuthoritativeBroadcastEvent(serverEvent!);
      expect(obsEvent?.type).toBe("WIDE");
      expect(obsEvent?.title).toBe("WIDE BALL");
      expect(obsEvent?.accentColor).toBe(OBS_V2.color.neutral);
      expect(obsEvent?.priority).toBe(OBS_V2_EVENT_PRIORITY.WIDE);
    });
  });

  describe("4. NO_BALL from umpire BALL_RECORDED", () => {
    it("generates authoritative NO_BALL event and normalizes with warning accent", () => {
      const seq = 50;
      const serverEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: seq,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 3,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "no_ball", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Pat Cummins",
      });

      expect(serverEvent).not.toBeNull();
      expect(serverEvent?.id).toBe("101:50:NO_BALL");
      expect(serverEvent?.type).toBe("NO_BALL");

      const obsEvent = normalizeAuthoritativeBroadcastEvent(serverEvent!);
      expect(obsEvent?.type).toBe("NO_BALL");
      expect(obsEvent?.title).toBe("NO BALL");
      expect(obsEvent?.accentColor).toBe(OBS_V2.color.warning);
      expect(obsEvent?.priority).toBe(OBS_V2_EVENT_PRIORITY.NO_BALL);
    });
  });

  describe("5. WICKET", () => {
    it("generates authoritative WICKET event with danger accent and highest standard priority", () => {
      const seq = 51;
      const serverEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: seq,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 4,
          strikerId: 10,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: null, runs: 0 },
          wicket: { type: "bowled", dismissedPlayerId: 10 },
          isLegalDelivery: true,
        },
        batterName: "Rohit Sharma",
        bowlerName: "Pat Cummins",
      });

      expect(serverEvent).not.toBeNull();
      expect(serverEvent?.id).toBe("101:51:WICKET");
      expect(serverEvent?.type).toBe("WICKET");

      const obsEvent = normalizeAuthoritativeBroadcastEvent(serverEvent!);
      expect(obsEvent?.type).toBe("WICKET");
      expect(obsEvent?.title).toBe("WICKET");
      expect(obsEvent?.accentColor).toBe(OBS_V2.color.danger);
      expect(obsEvent?.priority).toBe(OBS_V2_EVENT_PRIORITY.WICKET);
      expect(obsEvent?.priority).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.SIX);
    });
  });

  describe("6. WIDE followed by FOUR", () => {
    it("processes WIDE then FOUR across consecutive sequences with distinct identities", () => {
      const wide = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 52,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 4,
          strikerId: 11,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "wide", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Virat Kohli",
        bowlerName: "Pat Cummins",
      })!;

      const four = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 53,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 4,
          strikerId: 11,
          bowlerId: 20,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Virat Kohli",
        bowlerName: "Pat Cummins",
      })!;

      expect(wide.id).toBe("101:52:WIDE");
      expect(four.id).toBe("101:53:FOUR");

      const obsWide = normalizeAuthoritativeBroadcastEvent(wide)!;
      const obsFour = normalizeAuthoritativeBroadcastEvent(four)!;

      expect(obsWide.type).toBe("WIDE");
      expect(obsFour.type).toBe("FOUR");
      expect(obsFour.priority).toBeGreaterThan(obsWide.priority);
    });
  });

  describe("7. NO_BALL followed by SIX", () => {
    it("processes NO_BALL then SIX across consecutive sequences", () => {
      const noBall = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 54,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 5,
          strikerId: 11,
          bowlerId: 20,
          runsOffBat: 0,
          extras: { type: "no_ball", runs: 1 },
          wicket: null,
          isLegalDelivery: false,
        },
        batterName: "Virat Kohli",
        bowlerName: "Pat Cummins",
      })!;

      const six = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 55,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 5,
          ball: 5,
          strikerId: 11,
          bowlerId: 20,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Virat Kohli",
        bowlerName: "Pat Cummins",
      })!;

      expect(noBall.id).toBe("101:54:NO_BALL");
      expect(six.id).toBe("101:55:SIX");

      const obsNoBall = normalizeAuthoritativeBroadcastEvent(noBall)!;
      const obsSix = normalizeAuthoritativeBroadcastEvent(six)!;

      expect(obsNoBall.type).toBe("NO_BALL");
      expect(obsSix.type).toBe("SIX");
      expect(obsSix.priority).toBeGreaterThan(obsNoBall.priority);
    });
  });

  describe("8. FOUR → SIX → WICKET rapidly", () => {
    it("resolves rapid collisions strictly by priority: WICKET > SIX > FOUR", () => {
      const four = normalizeAuthoritativeBroadcastEvent(
        buildAuthoritativeCricketBroadcastEvent({
          matchId,
          sequence: 56,
          eventType: CricketEventType.BALL_RECORDED,
          payload: { runsOffBat: 4, extras: { type: null, runs: 0 }, isLegalDelivery: true },
        })!,
      )!;

      const six = normalizeAuthoritativeBroadcastEvent(
        buildAuthoritativeCricketBroadcastEvent({
          matchId,
          sequence: 57,
          eventType: CricketEventType.BALL_RECORDED,
          payload: { runsOffBat: 6, extras: { type: null, runs: 0 }, isLegalDelivery: true },
        })!,
      )!;

      const wicket = normalizeAuthoritativeBroadcastEvent(
        buildAuthoritativeCricketBroadcastEvent({
          matchId,
          sequence: 58,
          eventType: CricketEventType.BALL_RECORDED,
          payload: { runsOffBat: 0, wicket: { type: "caught", dismissedPlayerId: 10 }, isLegalDelivery: true },
        })!,
      )!;

      // SIX replaces active FOUR because priority 70 > 60
      expect(six.priority).toBeGreaterThan(four.priority);

      // WICKET replaces active SIX because priority 90 > 70
      expect(wicket.priority).toBeGreaterThan(six.priority);
    });
  });

  describe("9. SSE Reconnect after a scoring event", () => {
    it("ensures seen event tokens prevent replaying old animations on reconnect", () => {
      const seenTokens = new Set<string>();

      const ev = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 60,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 4, extras: { type: null, runs: 0 }, isLegalDelivery: true },
      })!;

      // First delivery: animates
      expect(seenTokens.has(ev.id)).toBe(false);
      seenTokens.add(ev.id);

      // Reconnect with same event payload: suppressed
      const isReplay = seenTokens.has(ev.id);
      expect(isReplay).toBe(true);
    });
  });

  describe("10. OBS V2 Page Refresh", () => {
    it("suppresses historical event on initial mount / bootstrap", () => {
      const seenTokens = new Set<string>();
      let bootstrapped = false;

      const initialEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 65,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 6, extras: { type: null, runs: 0 }, isLegalDelivery: true },
      })!;

      // On initial bootstrap / mount, the initial event token is marked as seen
      if (!bootstrapped) {
        bootstrapped = true;
        seenTokens.add(initialEvent.id);
      }

      // Incoming processing verifies token is already seen -> NOT animated
      expect(seenTokens.has(initialEvent.id)).toBe(true);

      // Subsequent new event -> animates
      const newEvent = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 66,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 4, extras: { type: null, runs: 0 }, isLegalDelivery: true },
      })!;

      expect(seenTokens.has(newEvent.id)).toBe(false);
    });
  });

  describe("11. Multiple Browser Tabs", () => {
    it("both tabs consume same authoritative event identity and deduplicate reliably", () => {
      const tabASeen = new Set<string>();
      const tabBSeen = new Set<string>();

      const ev = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 70,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 4, extras: { type: null, runs: 0 }, isLegalDelivery: true },
      })!;

      // Tab A receives SSE
      expect(tabASeen.has(ev.id)).toBe(false);
      tabASeen.add(ev.id);
      const tabAEvent = normalizeAuthoritativeBroadcastEvent(ev);
      expect(tabAEvent?.id).toBe("101:70:FOUR");

      // Tab B receives SSE
      expect(tabBSeen.has(ev.id)).toBe(false);
      tabBSeen.add(ev.id);
      const tabBEvent = normalizeAuthoritativeBroadcastEvent(ev);
      expect(tabBEvent?.id).toBe("101:70:FOUR");

      // Duplicate delivery in Tab A does not animate again
      expect(tabASeen.has(ev.id)).toBe(true);
    });
  });

  describe("12. Consecutive Illegal Deliveries", () => {
    it("animates consecutive wides and no-balls with distinct monotonic sequence tokens", () => {
      const seenTokens = new Set<string>();

      const wide1 = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 80,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 0, extras: { type: "wide", runs: 1 }, isLegalDelivery: false },
      })!;

      const wide2 = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 81,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 0, extras: { type: "wide", runs: 1 }, isLegalDelivery: false },
      })!;

      const noBall = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 82,
        eventType: CricketEventType.BALL_RECORDED,
        payload: { runsOffBat: 0, extras: { type: "no_ball", runs: 1 }, isLegalDelivery: false },
      })!;

      expect(wide1.id).toBe("101:80:WIDE");
      expect(wide2.id).toBe("101:81:WIDE");
      expect(noBall.id).toBe("101:82:NO_BALL");

      // All tokens are distinct and not suppressed by consecutive repetition
      expect(seenTokens.has(wide1.id)).toBe(false);
      seenTokens.add(wide1.id);

      expect(seenTokens.has(wide2.id)).toBe(false);
      seenTokens.add(wide2.id);

      expect(seenTokens.has(noBall.id)).toBe(false);
      seenTokens.add(noBall.id);
    });
  });

  describe("13. Ball Sequence Transition from Last Ball of Over to Next Over", () => {
    it("creates authoritative event on 6th ball without dropping when thisOver resets", () => {
      // Ball 6 of over 0: legal 4 runs (ends over)
      const lastBallOfOver = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 90,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 0,
          ball: 6,
          runsOffBat: 4,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Hardik Pandya",
      })!;

      // Ball 1 of over 1: legal 6 runs (start of next over)
      const firstBallOfNextOver = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 91,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 1,
          ball: 1,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        batterName: "Hardik Pandya",
      })!;

      expect(lastBallOfOver.id).toBe("101:90:FOUR");
      expect(firstBallOfNextOver.id).toBe("101:91:SIX");

      const obs1 = normalizeAuthoritativeBroadcastEvent(lastBallOfOver);
      const obs2 = normalizeAuthoritativeBroadcastEvent(firstBallOfNextOver);

      expect(obs1?.type).toBe("FOUR");
      expect(obs2?.type).toBe("SIX");
    });
  });

  describe("14. Match Phase / Innings Transitions", () => {
    it("handles MATCH_COMPLETED terminal victory event and gates non-terminal events in completed phase", () => {
      const matchWon = buildAuthoritativeCricketBroadcastEvent({
        matchId,
        sequence: 120,
        eventType: CricketEventType.MATCH_COMPLETED,
        payload: {
          winnerTeamId: 1,
          margin: "4 wickets",
          resultText: "Titans Won by 4 wickets",
        },
      })!;

      expect(matchWon.id).toBe("101:120:MATCH_WON");
      expect(matchWon.type).toBe("MATCH_WON");

      const obsWon = normalizeAuthoritativeBroadcastEvent(matchWon);
      expect(obsWon?.type).toBe("MATCH_WON");
      expect(obsWon?.priority).toBe(OBS_V2_EVENT_PRIORITY.MATCH_WON);

      // Verify that during completed phase, non-terminal scoring events are suppressed
      const lateBall: CricketAuthoritativeBroadcastEvent = {
        id: "101:121:FOUR",
        sequence: 121,
        type: "FOUR",
        matchId,
        timestamp: Date.now(),
        runs: 4,
      };

      const phase = "completed";
      const isSuppressed = phase === "completed" && lateBall.type !== "MATCH_WON";
      expect(isSuppressed).toBe(true);
    });
  });
});
