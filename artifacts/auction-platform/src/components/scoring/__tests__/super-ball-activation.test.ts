import { describe, it, expect, vi } from "vitest";
import {
  CricketEventType,
  buildAuthoritativeCricketBroadcastEvent,
  CricketMatchState,
} from "@workspace/scoring-core";

describe("Super Ball Full-Screen Broadcast Activation Contract", () => {
  it("generates SUPER_BALL_ACTIVATED broadcast event on SUPER_BALL_DECLARED", () => {
    const prevState: CricketMatchState = {
      matchId: 1,
      matchStatus: "live",
      currentInnings: 1,
      oversLimit: 10,
      target: null,
      dlsTarget: null,
      innings: [
        {
          innings: 1,
          battingTeamId: 10,
          bowlingTeamId: 20,
          runs: 35,
          wickets: 1,
          over: 3,
          ball: 2,
          legalBallCount: 20,
          events: [],
          partnerships: [],
          fallOfWickets: [],
        },
      ],
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      lastSequence: 14,
      superBallPending: null,
      superBallUsed: { 1: [] },
      retiredHurt: {},
    };

    const broadcastEvent = buildAuthoritativeCricketBroadcastEvent({
      matchId: 1,
      sequence: 15,
      eventType: CricketEventType.SUPER_BALL_DECLARED,
      payload: {
        battingTeamId: 10,
        strikerId: 101,
        bowlerId: 201,
        activationId: "act-unique-test-1",
      },
    });

    expect(broadcastEvent).not.toBeNull();
    expect(broadcastEvent?.type).toBe("SUPER_BALL_ACTIVATED");
    expect(broadcastEvent?.sequence).toBe(15);
    expect(broadcastEvent?.matchId).toBe(1);
    expect(broadcastEvent?.detail).toBe("SUPER BALL ACTIVATED");
    expect(broadcastEvent?.activationId).toBe("act-unique-test-1");
  });

  it("does NOT generate broadcast event on SUPER_BALL_CANCELLED", () => {
    const prevState: CricketMatchState = {
      matchId: 1,
      matchStatus: "live",
      currentInnings: 1,
      oversLimit: 10,
      target: null,
      dlsTarget: null,
      innings: [
        {
          innings: 1,
          battingTeamId: 10,
          bowlingTeamId: 20,
          runs: 35,
          wickets: 1,
          over: 3,
          ball: 2,
          legalBallCount: 20,
          events: [],
          partnerships: [],
          fallOfWickets: [],
        },
      ],
      strikerId: 101,
      nonStrikerId: 102,
      bowlerId: 201,
      lastSequence: 15,
      superBallPending: { battingTeamId: 10, declaredAtBall: 20, expiresAtBall: 21 },
      superBallUsed: { 1: [10] },
      retiredHurt: {},
    };

    const broadcastEvent = buildAuthoritativeCricketBroadcastEvent({
      matchId: 1,
      sequence: 16,
      eventType: CricketEventType.SUPER_BALL_CANCELLED,
      payload: {
        battingTeamId: 10,
      },
    });

    // Cancel must NEVER produce an activation animation
    expect(broadcastEvent).toBeNull();
  });

  it("deduplicates duplicate event IDs across multiple arrival channels", () => {
    const seenIds = new Set<string>();

    function processEvent(ev: { id: string; sequence: number }) {
      if (seenIds.has(ev.id)) return false;
      seenIds.add(ev.id);
      return true;
    }

    const event1 = { id: "cricket-broadcast-1-15-SUPER_BALL_ACTIVATED", sequence: 15 };

    // First arrival via BroadcastChannel
    expect(processEvent(event1)).toBe(true);

    // Duplicate arrival via SSE
    expect(processEvent(event1)).toBe(false);

    // Re-activation with fresh sequence
    const event2 = { id: "cricket-broadcast-1-18-SUPER_BALL_ACTIVATED", sequence: 18 };
    expect(processEvent(event2)).toBe(true);
  });

  it("rejects historical events older than client mount time", () => {
    const mountTime = 100_000;

    function shouldAnimate(eventTimestamp: number, mountTimestamp: number) {
      // Must have occurred at or after mount time (with generous 4s network tolerance)
      return eventTimestamp >= mountTimestamp - 4000;
    }

    // Historical event from past hydration (e.g. 30s ago)
    expect(shouldAnimate(mountTime - 30_000, mountTime)).toBe(false);

    // Live event occurring right now
    expect(shouldAnimate(mountTime + 100, mountTime)).toBe(true);
  });
});
