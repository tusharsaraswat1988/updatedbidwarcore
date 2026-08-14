import { describe, expect, it } from "vitest";
import {
  applyBreakTimingToDerivedState,
  derivedStateFromOverlayKey,
} from "../derive-led-overlay-state";

describe("derivedStateFromOverlayKey", () => {
  it("maps top5 to topSold", () => {
    expect(derivedStateFromOverlayKey("top5", false)).toBe("topSold");
    expect(derivedStateFromOverlayKey("top_5", true)).toBe("topSold");
  });

  it("maps team / player / banner overlays", () => {
    expect(derivedStateFromOverlayKey("team", false)).toBe("teamWise");
    expect(derivedStateFromOverlayKey("player", false)).toBe("playerWise");
    expect(derivedStateFromOverlayKey("banner", false)).toBe("banner");
  });

  it("returns null when overlay is off", () => {
    expect(derivedStateFromOverlayKey(null, false)).toBeNull();
  });

  it("keeps Team / Banner / Player distinct from Top 5", () => {
    expect(derivedStateFromOverlayKey("team", true)).toBe("teamWise");
    expect(derivedStateFromOverlayKey("banner", true)).toBe("banner");
    expect(derivedStateFromOverlayKey("player", true)).toBe("playerWise");
  });
});

describe("applyBreakTimingToDerivedState", () => {
  it("keeps Top 5 while a break countdown is running", () => {
    expect(
      applyBreakTimingToDerivedState("topSold", 90, { type: "break", isBreakFlag: false }),
    ).toBe("topSold");
  });

  it("still shows break when no operator overlay is active", () => {
    expect(
      applyBreakTimingToDerivedState("bidding", 90, { type: "break", isBreakFlag: false }),
    ).toBe("break");
  });
});
