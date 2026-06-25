import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  type TeamPurse,
} from "@workspace/api-client-react";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";

/** Sync owner bid mutations without redundant invalidation when SSE is healthy. */
export function useMutationSync(tournamentId: number, connectionStatus: ConnectionStatus) {
  const qc = useQueryClient();
  const sseConnected = connectionStatus === "connected";

  const invalidateFallback = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
  }, [qc, tournamentId]);

  const applyMutationResult = useCallback(
    (result?: unknown) => {
      if (result != null) {
        qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
        const purses = (result as { teamPurses?: TeamPurse[] }).teamPurses;
        if (purses?.length) {
          qc.setQueryData(getGetTeamPursesQueryKey(tournamentId), purses);
        }
      }
      if (!sseConnected) {
        invalidateFallback();
      }
    },
    [qc, tournamentId, sseConnected, invalidateFallback],
  );

  return { applyMutationResult, invalidateFallback, sseConnected };
}
