import {
  useGetAuctionState,
  getGetAuctionStateQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { AuctionFeedIndicator } from "@/components/auction/auction-connection-banner";
import {
  AUCTION_FEED_UI,
  formatLastActivityDiagnostic,
  type AuctionFeedState,
} from "@workspace/api-base/auction-connection-state";

const FEED_BADGE_LABEL: Record<AuctionFeedState, string> = {
  live: "Live",
  awaiting_operator_response: "Waiting",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

const FEED_BADGE_STYLE: Record<AuctionFeedState, string> = {
  live: "bg-green-500/10 text-green-300",
  awaiting_operator_response: "bg-yellow-500/10 text-yellow-300",
  reconnecting: "bg-orange-500/10 text-orange-300",
  disconnected: "bg-red-500/10 text-red-400",
};

export function LiveConnectionStatus({ tournamentId }: { tournamentId: number }) {
  const { connectionStatus } = useAuctionSocket(tournamentId);
  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });
  const feed = useAuctionConnectionState(
    connectionStatus,
    tournamentId,
    typeof state?.lastAuctionActivityAt === "string" ? state.lastAuctionActivityAt : null,
  );
  const diagnostic = formatLastActivityDiagnostic(feed.secondsSinceLastActivity);

  return (
    <span
      title={diagnostic ? `${AUCTION_FEED_UI[feed.state].title} · ${diagnostic}` : AUCTION_FEED_UI[feed.state].subtitle}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${FEED_BADGE_STYLE[feed.state]}`}
    >
      <AuctionFeedIndicator
        feedState={feed.state}
        secondsSinceLastActivity={feed.secondsSinceLastActivity}
        className="h-3.5 w-3.5"
      />
      {FEED_BADGE_LABEL[feed.state]}
    </span>
  );
}
