import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuctionStateQueryKey,
  getListBidsQueryKey,
  getGetTeamPursesQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";

export function useAuctionSocket(tournamentId: number) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!tournamentId) return;

    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource(`/api/tournaments/${tournamentId}/auction/events`);

      es.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "auction_state" && msg.state) {
            qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), msg.state);

            const invalidate: string[] = msg.invalidate ?? [];
            if (invalidate.includes("bids")) {
              qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
            }
            if (invalidate.includes("purses")) {
              qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
            }
            if (invalidate.includes("players")) {
              qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
            }
          }

          // Tournament settings changed (e.g. playerSelectionMode) — refetch auction state
          if (msg.type === "settings_changed") {
            qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
          }
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        es.close();
        if (!destroyed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [tournamentId, qc]);
}
