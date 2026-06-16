import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getListBidsQueryKey,
  getListPlayersQueryKey,
  getListTeamsQueryKey,
  type TeamPurse,
} from "@workspace/api-client-react";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";

/**
 * Sync operator mutations with React Query without redundant invalidation
 * when SSE is healthy. SSE + mutation response are authoritative; invalidate
 * only when disconnected (polling fallback).
 */
export function useMutationSync(tournamentId: number, connectionStatus: ConnectionStatus) {
  const qc = useQueryClient();
  const sseConnected = connectionStatus === "connected";

  const invalidateFallback = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
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
      // SSE delivers auction_state + targeted invalidations when connected.
      // Refetch only when SSE is down and polling is the fallback transport.
      if (!sseConnected) {
        invalidateFallback();
      }
    },
    [qc, tournamentId, sseConnected, invalidateFallback],
  );

  return { applyMutationResult, invalidateFallback, sseConnected };
}
