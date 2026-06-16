import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetAuctionStateQueryKey } from "@workspace/api-client-react";
import {
  applyAuctionSseMessage,
  resetAuctionEventVersion,
  type SseAuctionMessage,
} from "@/lib/sync-auction-sse";
import { nextSseReconnectDelayMs } from "@/lib/sse-reconnect";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

/** SSE push for auction state — same transport and merge path as auction-platform screens. */
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
    let reconnectAttempt = 0;

    function markConnected() {
      reconnectAttempt = 0;
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
          const msg = JSON.parse(event.data) as SseAuctionMessage;
          if (
            msg.type === "auction_state" ||
            msg.type === "bid" ||
            msg.type === "sold" ||
            msg.type === "unsold"
          ) {
            applyAuctionSseMessage(qc, tournamentId, msg);
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
          const delay = nextSseReconnectDelayMs(reconnectAttempt);
          reconnectAttempt += 1;
          retryTimer = setTimeout(connect, delay);
        }
      };
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        resetAuctionEventVersion(tournamentId);
        qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
        reconnectAttempt = 0;
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
