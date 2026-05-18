import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuctionStateQueryKey,
  getListBidsQueryKey,
  getGetTeamPursesQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";

export type CheerMessage = { senderName: string; message: string };

export function useAuctionSocket(
  tournamentId: number,
  onCheerMessage?: (msg: CheerMessage) => void,
) {
  const qc = useQueryClient();
  // Keep ref in sync so the SSE handler always calls the latest callback
  // without needing onCheerMessage in the effect dependency array
  const onCheerRef = useRef(onCheerMessage);
  useEffect(() => { onCheerRef.current = onCheerMessage; });

  useEffect(() => {
    if (!tournamentId) return;

    // `current` always points to the active EventSource. Each call to
    // connect() replaces it, and onerror/onmessage handlers capture the
    // local instance they were attached to — they compare against `current`
    // before acting so stale callbacks from replaced instances are ignored.
    let current: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      clearTimeout(retryTimer);
      current?.close();

      const es = new EventSource(`/api/tournaments/${tournamentId}/auction/events`);
      current = es;

      es.onmessage = (event) => {
        if (es !== current) return; // stale instance — ignore
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

          if (msg.type === "settings_changed") {
            qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
          }

          if (msg.type === "cheer_message" && onCheerRef.current) {
            onCheerRef.current({
              senderName: msg.senderName as string,
              message: msg.message as string,
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        if (es !== current) return; // stale instance — ignore
        es.close();
        if (!destroyed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    // When a background tab regains focus the browser may have throttled
    // the SSE onmessage callbacks, leaving the UI stale. On visibility
    // change we: (a) force-invalidate the auction state so React Query
    // issues a fresh GET immediately, and (b) reconnect the SSE stream
    // to flush any buffered events and confirm the connection is healthy.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
        connect();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      current?.close();
      current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tournamentId, qc]); // onCheerMessage intentionally excluded — handled via ref
}
