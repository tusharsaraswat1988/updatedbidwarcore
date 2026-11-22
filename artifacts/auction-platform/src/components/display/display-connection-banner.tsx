import { memo, useMemo } from "react";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import type { AuctionFeedState } from "@workspace/api-base/auction-connection-state";
import { AuctionConnectionBanner } from "@/components/auction/auction-connection-banner";

/**
 * Broadcast-surface connection affordance.
 * Prefer `feedState` from useAuctionConnectionState; `status` alone is socket-only fallback.
 */
export const DisplayConnectionBanner = memo(function DisplayConnectionBanner({
  feedState,
  status,
  secondsSinceLastActivity,
  placement = "overlay",
  className = "",
  showAwaitingOperator = false,
}: {
  feedState?: AuctionFeedState;
  status?: ConnectionStatus;
  secondsSinceLastActivity?: number | null;
  /** @deprecated use `placement` */
  variant?: "banner" | "pill" | "compact";
  placement?: "overlay" | "inline";
  className?: string;
  showAwaitingOperator?: boolean;
}) {
  const resolvedFeed = useMemo((): AuctionFeedState => {
    // Broadcast & LED display surfaces suppress the intermittent "Awaiting operator" toast
    if (feedState === "awaiting_operator_response" && !showAwaitingOperator) {
      return "live";
    }
    if (feedState) return feedState;
    if (status === "disconnected") return "disconnected";
    if (status === "reconnecting") return "reconnecting";
    return "live";
  }, [feedState, status, showAwaitingOperator]);

  if (resolvedFeed === "live") return null;

  return (
    <AuctionConnectionBanner
      feedState={resolvedFeed}
      secondsSinceLastActivity={secondsSinceLastActivity}
      placement={placement}
      className={className}
      hideAwaitingOperator={!showAwaitingOperator}
    />
  );
});
