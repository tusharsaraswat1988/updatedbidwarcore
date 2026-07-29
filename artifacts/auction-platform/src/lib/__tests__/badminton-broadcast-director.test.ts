import { describe, expect, it } from "vitest";
import {
  isObsActiveRally,
  isVenueMomentScene,
  MAX_MULTI_COURT_ROWS,
  parseVenueScene,
  resolvePlaySafeOverlayType,
  shouldShowVenueLiveBoard,
  shouldUseObsCornerBug,
  shouldUseObsPlayDensity,
} from "@/lib/badminton-broadcast-director";

describe("badminton broadcast director venue scenes", () => {
  it("parses new venue moment scenes", () => {
    expect(parseVenueScene("intro")).toBe("intro");
    expect(parseVenueScene("winner")).toBe("winner");
    expect(parseVenueScene("sponsor")).toBe("sponsor");
    expect(parseVenueScene("next")).toBe("next");
    expect(parseVenueScene("nope")).toBe("auto");
  });

  it("identifies moment scenes", () => {
    expect(isVenueMomentScene("intro")).toBe(true);
    expect(isVenueMomentScene("next")).toBe(true);
    expect(isVenueMomentScene("live_score")).toBe(false);
    expect(isVenueMomentScene("auto")).toBe(false);
  });

  it("hides live board for moment and standby scenes", () => {
    expect(shouldShowVenueLiveBoard("intro", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("winner", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("sponsor", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("next", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("standby", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("multi", true)).toBe(false);
    expect(shouldShowVenueLiveBoard("auto", true)).toBe(true);
    expect(shouldShowVenueLiveBoard("live_score", true)).toBe(true);
    expect(shouldShowVenueLiveBoard("auto", false)).toBe(false);
  });
});

describe("OBS play-safe overlay resolution", () => {
  const liveIdle = {
    matchStatus: "live" as const,
    activeTimeout: null,
    inInterval: false,
    totalRallies: 0,
    leftScore: 0,
    rightScore: 0,
    gamesLeft: 0,
    gamesRight: 0,
  };
  const liveRally = { ...liveIdle, totalRallies: 3, leftScore: 2, rightScore: 1 };

  it("detects active rally vs timeout / interval", () => {
    expect(isObsActiveRally(liveRally)).toBe(true);
    expect(
      isObsActiveRally({
        ...liveRally,
        activeTimeout: { side: "left", takenAt: new Date().toISOString() },
      }),
    ).toBe(false);
    expect(isObsActiveRally({ ...liveRally, inInterval: true })).toBe(false);
    expect(isObsActiveRally({ ...liveRally, matchStatus: "completed" })).toBe(false);
  });

  it("allows intro/sponsor before first rally (walk-on)", () => {
    expect(resolvePlaySafeOverlayType("intro", liveIdle)).toBe("intro");
    expect(resolvePlaySafeOverlayType("sponsor", liveIdle)).toBe("sponsor");
  });

  it("forces compact when intro/sponsor left up after scoring starts", () => {
    expect(resolvePlaySafeOverlayType("intro", liveRally)).toBe("compact");
    expect(resolvePlaySafeOverlayType("sponsor", liveRally)).toBe("compact");
    expect(resolvePlaySafeOverlayType("full", liveRally)).toBe("full");
    expect(resolvePlaySafeOverlayType("compact", liveRally)).toBe("compact");
  });

  it("allows sponsor/intro during timeout or interval", () => {
    expect(
      resolvePlaySafeOverlayType("sponsor", {
        ...liveRally,
        activeTimeout: { side: "right", takenAt: new Date().toISOString() },
      }),
    ).toBe("sponsor");
    expect(
      resolvePlaySafeOverlayType("intro", { ...liveRally, inInterval: true }),
    ).toBe("intro");
  });

  it("uses slim play density for live score bugs", () => {
    expect(shouldUseObsPlayDensity("compact", liveRally)).toBe(true);
    expect(shouldUseObsPlayDensity("full", liveRally)).toBe(true);
    expect(shouldUseObsPlayDensity("intro", liveRally)).toBe(false);
    expect(shouldUseObsPlayDensity("compact", null, true)).toBe(true);
  });

  it("disables tiny corner bug — compact always uses lower-third", () => {
    expect(shouldUseObsCornerBug("compact", liveRally)).toBe(false);
    expect(shouldUseObsCornerBug("compact", liveIdle)).toBe(false);
    expect(shouldUseObsCornerBug("full", liveRally)).toBe(false);
  });

  it("supports up to six multi-court rows", () => {
    expect(MAX_MULTI_COURT_ROWS).toBe(6);
  });
});
