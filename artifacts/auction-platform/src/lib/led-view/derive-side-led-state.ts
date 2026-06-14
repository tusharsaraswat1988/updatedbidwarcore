import type { DerivedState, LedView } from "./types";

/** Operator LED-screen modes that must not affect side panels. */
const OPERATOR_DISPLAY_MODES: DerivedState[] = [
  "teamWise",
  "playerWise",
  "topSold",
  "banner",
  "teamPurse",
];

/**
 * Side LED panels follow live auction state only — not operator display overlays
 * (player list, team squads, top 5, banner, team purse view).
 */
export function deriveSideLedState(view: LedView): DerivedState {
  if (!OPERATOR_DISPLAY_MODES.includes(view.derivedState)) {
    return view.derivedState;
  }

  if (view.wheel.active) return "fortuneWheel";
  if (view.breakInfo.active && view.breakInfo.type === "pre-auction") return "preAuction";
  if (view.breakInfo.active) return "break";
  if (view.auctionStatus === "paused" || view.pausedSeconds != null) return "paused";

  const outcome = view.lastOutcome;
  const playerId = view.currentPlayer?.id;
  if (
    outcome?.type === "sold" &&
    playerId &&
    outcome.playerId === Number(playerId)
  ) {
    return "sold";
  }
  if (view.currentPlayer?.status === "sold") return "sold";
  if (view.currentPlayer?.status === "unsold" || outcome?.type === "unsold") {
    return "unsold";
  }
  if (view.state.isBidding) return "bidding";

  return "idle";
}

export function withSideLedState(view: LedView): LedView {
  return { ...view, derivedState: deriveSideLedState(view) };
}
