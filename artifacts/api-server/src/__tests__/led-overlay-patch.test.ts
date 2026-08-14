import { afterEach, describe, expect, it } from "vitest";
import {
  applyRememberedLedOverlayPatch,
  ledOverlaySessionPatch,
  overlayModeFromPresentationContext,
  rememberLedOverlayPatch,
  resetLedOverlayPatchesForTests,
} from "../lib/led-overlay-patch";

describe("ledOverlaySessionPatch", () => {
  it("clears overlay for MAIN", () => {
    expect(ledOverlaySessionPatch("off")).toEqual({
      displayOverlay: null,
      teamPurseViewActive: false,
      fortuneWheelActive: false,
      wheelSpinning: false,
    });
  });

  it("sets team / top5 without leaving fortune wheel on", () => {
    expect(ledOverlaySessionPatch("team").displayOverlay).toBe("team");
    expect(ledOverlaySessionPatch("top5").displayOverlay).toBe("top5");
    expect(ledOverlaySessionPatch("player").fortuneWheelActive).toBe(false);
  });
});

describe("overlayModeFromPresentationContext", () => {
  it("maps OBS screen buttons onto the LED overlay", () => {
    expect(overlayModeFromPresentationContext("auction")).toBe("off");
    expect(overlayModeFromPresentationContext("top5")).toBe("top5");
    expect(overlayModeFromPresentationContext("team")).toBe("team");
  });
});

describe("remembered LED overlay patch", () => {
  afterEach(() => {
    resetLedOverlayPatchesForTests();
  });

  it("reapplies the latest overlay onto a stale rebuilt snapshot", () => {
    rememberLedOverlayPatch(1, ledOverlaySessionPatch("team"));
    const stale = {
      displayOverlay: "top5",
      teamPurseViewActive: true,
      fortuneWheelActive: false,
      wheelSpinning: false,
    };
    applyRememberedLedOverlayPatch(1, stale);
    expect(stale.displayOverlay).toBe("team");
  });

  it("does not keep a patch after TTL so later wheel / live state can win", () => {
    rememberLedOverlayPatch(1, ledOverlaySessionPatch("top5"), 0);
    const state = { displayOverlay: "team" as const };
    applyRememberedLedOverlayPatch(1, state);
    expect(state.displayOverlay).toBe("team");
  });
});
