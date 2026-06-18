import type { AuctionFeedState } from "@workspace/api-base/auction-connection-state";
import type { DerivedState, LedView } from "@/lib/led-view/types";

const OVERLAY_DERIVED_STATES = new Set<DerivedState>([
  "sold",
  "unsold",
  "paused",
  "break",
  "preAuction",
  "fortuneWheel",
  "teamPurse",
  "teamWise",
  "playerWise",
  "topSold",
  "banner",
]);

export type ReconnectStandbyCopy = {
  tone: "info" | "error";
  message: string;
  tournamentName?: string;
};

export function resolveReconnectStandby(
  view: Pick<LedView, "loading" | "error" | "currentPlayer" | "derivedState" | "tournament">,
  feedState?: AuctionFeedState,
): ReconnectStandbyCopy | null {
  if (view.loading) {
    return {
      tone: "info",
      message: "Connecting to live auction",
      tournamentName: view.tournament?.name,
    };
  }

  if (view.error) {
    return {
      tone: "error",
      message: view.error,
      tournamentName: view.tournament?.name,
    };
  }

  const feedStale = feedState === "reconnecting" || feedState === "disconnected";
  if (
    feedStale &&
    !view.currentPlayer &&
    !OVERLAY_DERIVED_STATES.has(view.derivedState)
  ) {
    return {
      tone: feedState === "disconnected" ? "error" : "info",
      message:
        feedState === "disconnected"
          ? "Connection lost — restoring live feed"
          : "Reconnecting to live auction",
      tournamentName: view.tournament?.name,
    };
  }

  return null;
}
