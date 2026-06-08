import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { scoringLiveQueryKey } from "@/hooks/use-scoring-match";
import type { ScoringLiveDisplay } from "@/lib/scoring-api";

export type ScoringConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function useScoringSocket(
  tournamentId: number,
  enabled = true,
): { connectionStatus: ScoringConnectionStatus } {
  const qc = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ScoringConnectionStatus>("reconnecting");
  const setStatusRef = useRef(setConnectionStatus);
  useEffect(() => {
    setStatusRef.current = setConnectionStatus;
  });

  useEffect(() => {
    if (!tournamentId || !enabled) return;

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

      const es = new EventSource(`/api/tournaments/${tournamentId}/scoring/events`);
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
          if (msg.type === "scoring_state") {
            const payload: ScoringLiveDisplay = {
              match: msg.match ?? null,
              state: msg.state ?? null,
              summary: msg.summary ?? null,
            };
            qc.setQueryData(scoringLiveQueryKey(tournamentId), payload);
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
        qc.invalidateQueries({ queryKey: scoringLiveQueryKey(tournamentId) });
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
  }, [tournamentId, enabled, qc]);

  return { connectionStatus };
}
