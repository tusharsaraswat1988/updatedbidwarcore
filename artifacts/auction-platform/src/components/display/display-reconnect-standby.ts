import type { AuctionFeedState } from "@workspace/api-base/auction-connection-state";
import type { DerivedState, LedView } from "@/lib/led-view/types";

const OVERLAY_DERIVED_STATES = new Set<DerivedState>([
  "sold",
  "unsold",
  "awaitingNext",
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

/** Never show raw API/JS exceptions on the LED — map to calm broadcast copy. */
export function sanitizeStandbyMessage(raw: string | null | undefined): string {
  const msg = (raw ?? "").trim();
  if (!msg) return "Please wait — reconnecting to live auction";

  const lower = msg.toLowerCase();

  if (lower === "tournament not found") return msg;

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("connection refused") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("aborted")
  ) {
    return "Connection lost — restoring live feed";
  }

  if (/^(type|reference|syntax|range)?error:/i.test(msg)) {
    return "Connection lost — restoring live feed";
  }

  if (/\b(401|403|404|500|502|503|504)\b/.test(lower) || lower.includes("unauthorized")) {
    return "Unable to load auction — retrying shortly";
  }

  if (
    msg.length <= 72 &&
    !/\berror\b|\bexception\b|\btypeerror\b|\bfetch\b|\bundefined\b/i.test(msg)
  ) {
    return msg;
  }

  return "Please wait — reconnecting to live auction";
}

function isTransientStandbyMessage(message: string): boolean {
  return (
    message === "Connection lost — restoring live feed" ||
    message === "Please wait — reconnecting to live auction" ||
    message === "Unable to load auction — retrying shortly" ||
    message === "Reconnecting to live auction"
  );
}

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
    const message = sanitizeStandbyMessage(view.error);
    return {
      tone: isTransientStandbyMessage(message) ? "info" : "error",
      message,
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
