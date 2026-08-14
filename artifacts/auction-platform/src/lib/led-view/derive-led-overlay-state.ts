import type { DerivedState } from "./types";

/** Full-screen LED modes the operator picks from Team / Player / Top5 / Banner. */
export const OPERATOR_LED_OVERLAY_STATES: ReadonlySet<DerivedState> = new Set([
  "banner",
  "teamWise",
  "playerWise",
  "topSold",
  "teamPurse",
]);

/**
 * Map auction session `displayOverlay` onto a LED derived state.
 * Operator overlay must win over break / sold / bidding so LED buttons actually switch the screen.
 */
export function derivedStateFromOverlayKey(
  overlayKey: string | null,
  teamPurseViewActive: boolean,
): DerivedState | null {
  if (
    overlayKey === "banner" ||
    overlayKey === "main_banner"
  ) {
    return "banner";
  }
  if (
    overlayKey === "team_wise" ||
    overlayKey === "teams" ||
    overlayKey === "team_view" ||
    overlayKey === "team"
  ) {
    return "teamWise";
  }
  if (
    overlayKey === "player_wise" ||
    overlayKey === "players" ||
    overlayKey === "player_view" ||
    overlayKey === "player_list" ||
    overlayKey === "player"
  ) {
    return "playerWise";
  }
  if (
    overlayKey === "top_sold" ||
    overlayKey === "top5" ||
    overlayKey === "top_5" ||
    overlayKey === "top_5_sold"
  ) {
    return "topSold";
  }
  if (
    overlayKey === "team_purse" ||
    overlayKey === "purse" ||
    overlayKey === "team_purses"
  ) {
    return "teamPurse";
  }
  if (!overlayKey && teamPurseViewActive) return "teamPurse";
  return null;
}

/** Break countdown must not hide an operator-chosen LED overlay (Top 5, Team, …). */
export function applyBreakTimingToDerivedState(
  derivedState: DerivedState,
  breakCountdown: number,
  breakMeta: { type: "break" | "pre-auction"; isBreakFlag: boolean },
): DerivedState {
  if (OPERATOR_LED_OVERLAY_STATES.has(derivedState) || derivedState === "fortuneWheel") {
    return derivedState;
  }
  if (breakCountdown > 0 && breakMeta.type === "pre-auction") return "preAuction";
  if (breakCountdown > 0 && (breakMeta.type === "break" || breakMeta.isBreakFlag)) return "break";
  return derivedState;
}
