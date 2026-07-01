import {
  useGetTournamentInsights,
  getGetTournamentInsightsQueryKey,
  type Tournament,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";

const LIVE_REFETCH_MS = 75_000;

export function useTournamentInsightsFeed(
  tournamentId: number,
  tournament: Tournament | undefined,
) {
  const isLive = tournament?.status === "active";

  useAuctionSocket(tournamentId);

  return useGetTournamentInsights(tournamentId, {
    query: {
      queryKey: getGetTournamentInsightsQueryKey(tournamentId),
      enabled: !!tournamentId && !!tournament,
      staleTime: LIVE_REFETCH_MS,
      refetchInterval: isLive ? LIVE_REFETCH_MS : false,
      refetchOnWindowFocus: false,
    },
  });
}
