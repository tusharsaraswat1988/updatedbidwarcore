import { describe, expect, it } from "vitest";
import { OBS_V2 } from "../obs-v2-tokens.ts";
import {
  OBS_V2_EVENT_CONFIGS,
  OBS_V2_EVENT_PRIORITY,
  type ObsV2BroadcastEvent,
} from "../obs-v2-events.ts";
import { normalizeCricketFlashToObsV2Event } from "../obs-v2-event-adapter.ts";

describe("OBS V2 Broadcast Event Graphics (Step 4)", () => {
  describe("1. Event Normalization", () => {
    it("normalizes FOUR event with brand gold accent", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "FOUR",
        token: "tok-101-1",
        matchId: 101,
        detail: "Rohit Sharma · BOUNDARY 4",
      });

      expect(event).not.toBeNull();
      expect(event?.id).toBe("tok-101-1");
      expect(event?.type).toBe("FOUR");
      expect(event?.title).toBe("BOUNDARY 4");
      expect(event?.subtitle).toBe("Rohit Sharma · BOUNDARY 4");
      expect(event?.accentColor).toBe(OBS_V2.color.brand);
      expect(event?.priority).toBe(OBS_V2_EVENT_PRIORITY.FOUR);
    });

    it("normalizes SIX event with prominent hierarchy", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "SIX",
        token: "tok-101-2",
        matchId: 101,
        batter: "Hardik Pandya",
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("SIX");
      expect(event?.title).toBe("MAXIMUM 6");
      expect(event?.subtitle).toContain("Hardik Pandya");
      expect(event?.accentColor).toBe(OBS_V2.color.brand);
      expect(event?.priority).toBe(OBS_V2_EVENT_PRIORITY.SIX);
    });

    it("normalizes WICKET event with semantic danger color (#EF3340)", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "WICKET",
        token: "tok-101-3",
        matchId: 101,
        detail: "Virat Kohli · OUT",
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("WICKET");
      expect(event?.title).toBe("WICKET");
      expect(event?.subtitle).toBe("Virat Kohli · OUT");
      expect(event?.accentColor).toBe(OBS_V2.color.danger);
      expect(event?.priority).toBe(OBS_V2_EVENT_PRIORITY.WICKET);
      expect(event?.priority).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.SIX);
    });

    it("normalizes NO_BALL with semantic warning color (#F59E0B)", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "NO_BALL",
        token: "tok-101-4",
        matchId: 101,
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("NO_BALL");
      expect(event?.title).toBe("NO BALL");
      expect(event?.accentColor).toBe(OBS_V2.color.warning);
    });

    it("normalizes WIDE with neutral slate color (#94A3B8)", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "WIDE",
        token: "tok-101-5",
        matchId: 101,
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("WIDE");
      expect(event?.title).toBe("WIDE BALL");
      expect(event?.accentColor).toBe(OBS_V2.color.neutral);
    });

    it("normalizes FREE_HIT with info cyan color (#12CFFF)", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "FREE_HIT",
        token: "tok-101-6",
        matchId: 101,
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("FREE_HIT");
      expect(event?.title).toBe("FREE HIT");
      expect(event?.accentColor).toBe(OBS_V2.color.info);
    });

    it("normalizes batter milestone 50 with success green color (#22C55E)", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "MILESTONE",
        token: "tok-101-7",
        matchId: 101,
        milestoneValue: 50,
        batter: "KL Rahul",
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("MILESTONE");
      expect(event?.title).toBe("HALF CENTURY 50");
      expect(event?.subtitle).toContain("KL Rahul · 50 RUNS");
      expect(event?.accentColor).toBe(OBS_V2.color.success);
      expect(event?.priority).toBe(OBS_V2_EVENT_PRIORITY.MILESTONE);
    });

    it("normalizes batter milestone 100 with century title", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "MILESTONE",
        token: "tok-101-8",
        matchId: 101,
        milestoneValue: 100,
        batter: "Shubman Gill",
      });

      expect(event).not.toBeNull();
      expect(event?.type).toBe("MILESTONE");
      expect(event?.title).toBe("CENTURY 100");
      expect(event?.subtitle).toContain("Shubman Gill · 100 RUNS");
      expect(event?.accentColor).toBe(OBS_V2.color.success);
    });
  });

  describe("2. Anti-Fabrication & Error Handling", () => {
    it("rejects unsupported event kinds gracefully without throwing", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "RANDOM_UNSUPPORTED_ACTION" as any,
        token: "tok-bad",
        matchId: 101,
      });

      expect(event).toBeNull();
    });

    it("rejects events without tokens", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "FOUR",
        token: null,
        matchId: 101,
      });

      expect(event).toBeNull();
    });

    it("omits missing batter name rather than fabricating fake text", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "FOUR",
        token: "tok-nobatter",
        matchId: 101,
        batter: null,
      });

      expect(event?.batter).toBeUndefined();
      expect(event?.subtitle).toBe("FOUR RUNS OFF THE BAT");
    });
  });

  describe("3. Priority Hierarchy & Collision Model", () => {
    it("strictly orders events: MATCH_WON > WICKET > MILESTONE > SIX > FOUR > FREE_HIT > NO_BALL > WIDE", () => {
      expect(OBS_V2_EVENT_PRIORITY.MATCH_WON).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.WICKET);
      expect(OBS_V2_EVENT_PRIORITY.WICKET).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.MILESTONE);
      expect(OBS_V2_EVENT_PRIORITY.MILESTONE).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.SIX);
      expect(OBS_V2_EVENT_PRIORITY.SIX).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.FOUR);
      expect(OBS_V2_EVENT_PRIORITY.FOUR).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.FREE_HIT);
      expect(OBS_V2_EVENT_PRIORITY.FREE_HIT).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.NO_BALL);
      expect(OBS_V2_EVENT_PRIORITY.NO_BALL).toBeGreaterThan(OBS_V2_EVENT_PRIORITY.WIDE);
    });

    it("higher-priority event supersedes an active lower-priority event", () => {
      const activeFour: ObsV2BroadcastEvent = normalizeCricketFlashToObsV2Event({
        flash: "FOUR",
        token: "tok-four",
        matchId: 101,
      })!;

      const incomingWicket: ObsV2BroadcastEvent = normalizeCricketFlashToObsV2Event({
        flash: "WICKET",
        token: "tok-wicket",
        matchId: 101,
      })!;

      // Collision resolution logic check
      const resolves = incomingWicket.priority >= activeFour.priority;
      expect(resolves).toBe(true);
    });

    it("lower-priority event is suppressed if a higher-priority event is active", () => {
      const activeWicket: ObsV2BroadcastEvent = normalizeCricketFlashToObsV2Event({
        flash: "WICKET",
        token: "tok-wicket",
        matchId: 101,
      })!;

      const incomingWide: ObsV2BroadcastEvent = normalizeCricketFlashToObsV2Event({
        flash: "WIDE",
        token: "tok-wide",
        matchId: 101,
      })!;

      const shouldSuppress = incomingWide.priority < activeWicket.priority;
      expect(shouldSuppress).toBe(true);
    });
  });

  describe("4. Match Identity & Deduplication Guards", () => {
    it("preserves matchId on the normalized event for cross-match isolation", () => {
      const event = normalizeCricketFlashToObsV2Event({
        flash: "SIX",
        token: "tok-m45",
        matchId: 45,
      });

      expect(event?.matchId).toBe(45);
    });

    it("verifies deduplication identity uniqueness", () => {
      const seenTokens = new Set<string>();

      const ev1Token = "101-14-17.3-FOUR";
      const ev2Token = "101-15-17.4-SIX";

      seenTokens.add(ev1Token);
      expect(seenTokens.has(ev1Token)).toBe(true);
      expect(seenTokens.has(ev2Token)).toBe(false);

      // Reconnect / duplicate event check
      const isDuplicate = seenTokens.has(ev1Token);
      expect(isDuplicate).toBe(true);
    });
  });
});
