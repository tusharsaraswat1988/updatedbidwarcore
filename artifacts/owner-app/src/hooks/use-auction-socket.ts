import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

/** SSE push for auction state — keeps owner panels in sync with operator pause/resume. */
export function useAuctionSocket(tournamentId: number): { connectionStatus: ConnectionStatus } {
  const qc = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("reconnecting");
  const setStatusRef = useRef(setConnectionStatus);
  useEffect(() => { setStatusRef.current = setConnectionStatus; });

  useEffect(() => {
    if (!tournamentId) return;

    let current: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let disconnectedTimer: ReturnType<typeof setTimeout>;
    let destroyed = false;

    function markConnected() {
      clearTimeout(disconnectedTimer);
      setStatusRef.current("connected");
    }

    function markReconnecting() {
      clearTimeout(disconnectedTimer);
      setStatusRef.current("reconnecting");
      disconnectedTimer = setTimeout(() => {
        setStatusRef.current("disconnected");
      }, 5000);
    }

    function connect() {
      if (destroyed) return;
      clearTimeout(retryTimer);
      current?.close();

      const es = new EventSource(`/api/tournaments/${tournamentId}/auction/events`);
      current = es;

      es.onopen = () => {
        if (es !== current) return;
        markConnected();
      };

      es.onmessage = (event) => {
        if (es !== current) return;
        markConnected();
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "auction_state" && msg.state) {
            qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), msg.state);
            const invalidate: string[] = msg.invalidate ?? [];
            if (invalidate.includes("purses")) {
              qc.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
            }
          }
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        if (es !== current) return;
        es.close();
        markReconnecting();
        if (!destroyed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

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
      clearTimeout(disconnectedTimer);
      current?.close();
      current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tournamentId, qc]);

  return { connectionStatus };
}
