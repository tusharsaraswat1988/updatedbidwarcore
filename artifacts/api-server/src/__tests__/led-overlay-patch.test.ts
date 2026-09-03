import { afterEach, describe, expect, it } from "vitest";
import {
  applyRememberedLedOverlayPatch,
  ledOverlaySessionPatch,
  overlayModeFromPresentationContext,
  parsePersistedPresentationContext,
  presentationContextAfterLedOverlay,
  rememberLedOverlayPatch,
  resetLedOverlayPatchesForTests,
  type PresentationContextState,
} from "../lib/led-overlay-patch";

function applyObs(context: PresentationContextState["context"], selectedTeamId: number | null = null) {
  return {
    overlay: overlayModeFromPresentationContext(context),
    presentationContext: { context, selectedTeamId } satisfies PresentationContextState,
  };
}

function applyLed(mode: "off" | "team" | "player" | "top5" | "banner", current: PresentationContextState) {
  return {
    overlay: ledOverlaySessionPatch(mode).displayOverlay,
    presentationContext: presentationContextAfterLedOverlay(mode, current),
  };
}

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

describe("LED MAIN VIEW resets OBS to LIVE AUCTION", () => {
  it("OBS TOP 5 → LED MAIN VIEW => OBS LIVE AUCTION, LED MAIN VIEW", () => {
    const afterObs = applyObs("top5");
    expect(afterObs.overlay).toBe("top5");
    expect(afterObs.presentationContext.context).toBe("top5");

    const afterMain = applyLed("off", afterObs.presentationContext);
    expect(afterMain.overlay).toBeNull();
    expect(afterMain.presentationContext.context).toBe("auction");
  });

  it("OBS TEAM → LED MAIN VIEW => OBS LIVE AUCTION", () => {
    const afterObs = applyObs("team", 42);
    expect(afterObs.overlay).toBe("team");

    const afterMain = applyLed("off", afterObs.presentationContext);
    expect(afterMain.overlay).toBeNull();
    expect(afterMain.presentationContext).toEqual({ context: "auction", selectedTeamId: 42 });
  });

  it("OBS TOP 5 → OBS TEAM → LED MAIN VIEW => OBS LIVE AUCTION", () => {
    const afterTop5 = applyObs("top5");
    const afterTeam = applyObs("team", afterTop5.presentationContext.selectedTeamId);
    expect(afterTeam.overlay).toBe("team");
    expect(afterTeam.presentationContext.context).toBe("team");

    const afterMain = applyLed("off", afterTeam.presentationContext);
    expect(afterMain.overlay).toBeNull();
    expect(afterMain.presentationContext.context).toBe("auction");
  });

  it("OBS has no player context; LED PLAYER then MAIN VIEW still resets leftover OBS", () => {
    const afterObs = applyObs("top5");
    const afterLedPlayer = applyLed("player", afterObs.presentationContext);
    expect(afterLedPlayer.overlay).toBe("player");
    expect(afterLedPlayer.presentationContext.context).toBe("top5");

    const afterMain = applyLed("off", afterLedPlayer.presentationContext);
    expect(afterMain.overlay).toBeNull();
    expect(afterMain.presentationContext.context).toBe("auction");
  });

  it("OBS TOP 5 still drives LED to TOP 5", () => {
    const afterObs = applyObs("top5");
    expect(afterObs.overlay).toBe("top5");
    expect(afterObs.presentationContext.context).toBe("top5");
  });

  it("LED TEAM / PLAYER / TOP 5 do not change OBS presentation context", () => {
    const current: PresentationContextState = { context: "auction", selectedTeamId: 7 };
    expect(applyLed("team", current).presentationContext).toEqual(current);
    expect(applyLed("player", current).presentationContext).toEqual(current);
    expect(applyLed("top5", current).presentationContext).toEqual(current);
    expect(applyLed("team", current).overlay).toBe("team");
    expect(applyLed("player", current).overlay).toBe("player");
    expect(applyLed("top5", current).overlay).toBe("top5");
  });

  it("preserves selectedTeamId when LED returns to MAIN VIEW", () => {
    expect(
      presentationContextAfterLedOverlay("off", { context: "team", selectedTeamId: 9 }),
    ).toEqual({ context: "auction", selectedTeamId: 9 });
  });

  it("parses persisted and legacy OBS payloads", () => {
    expect(parsePersistedPresentationContext('{"context":"top5","selectedTeamId":3}')).toEqual({
      context: "top5",
      selectedTeamId: 3,
    });
    expect(parsePersistedPresentationContext({ screen: "team", selectedTeamId: 4 })).toEqual({
      context: "team",
      selectedTeamId: 4,
    });
  });
});

describe("display-overlay MAIN VIEW route wiring", () => {
  it("persists and broadcasts presentationContext when LED returns to MAIN VIEW", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(new URL("../routes/auction.ts", import.meta.url), "utf8");
    const overlayHandlerStart = src.indexOf(
      'router.post("/tournaments/:tournamentId/auction/display-overlay"',
    );
    const overlayHandlerEnd = src.indexOf(
      'router.post("/tournaments/:tournamentId/auction/presentation-context"',
    );
    expect(overlayHandlerStart).toBeGreaterThan(-1);
    expect(overlayHandlerEnd).toBeGreaterThan(overlayHandlerStart);
    const handler = src.slice(overlayHandlerStart, overlayHandlerEnd);
    expect(handler).toContain('body.data.mode === "off"');
    expect(handler).toContain("presentationContextAfterLedOverlay");
    expect(handler).toContain("obsContextJson: JSON.stringify(next)");
    expect(handler).toContain("presentationContext: next");
    expect(handler).toContain("broadcastLedOverlayPatch(tid, overlayPatch, presentationExtra)");
  });
});
