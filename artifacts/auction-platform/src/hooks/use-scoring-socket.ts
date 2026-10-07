import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mergeObsDirectorSnapshot } from "@workspace/scoring-core/cricket";
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
  const lastProcessedSequenceRef = useRef<number>(0);
  const lastDispatchedBroadcastSeqRef = useRef<number>(0);

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

    function handleMessagePayload(rawString: string, frameEventId?: string) {
      try {
        const msg = JSON.parse(rawString);
        const parsedFrameId = frameEventId ? parseInt(frameEventId, 10) : undefined;
        const msgSeq =
          typeof msg.sequence === "number"
            ? msg.sequence
            : typeof msg.state?.lastSequence === "number"
              ? msg.state.lastSequence
              : Number.isFinite(parsedFrameId)
                ? parsedFrameId
                : undefined;

        if (msgSeq !== undefined && Number.isFinite(msgSeq)) {
          lastProcessedSequenceRef.current = Math.max(lastProcessedSequenceRef.current, msgSeq);
        }

        if (msg.type === "scoring_state") {
          if (msg.isOversized) {
            qc.invalidateQueries({ queryKey: scoringLiveQueryKey(tournamentId) });
          } else {
            const payload: ScoringLiveDisplay = {
              match: msg.match ?? null,
              state: msg.state ?? null,
              summary: msg.summary ?? null,
              broadcastEvent: msg.broadcastEvent ?? null,
            };
            qc.setQueryData(scoringLiveQueryKey(tournamentId), payload);
          }

          // Deduplicate broadcast animation events: only trigger once per sequence
          if (msg.broadcastEvent && typeof window !== "undefined") {
            const bSeq = msg.broadcastEvent.sequence;
            if (bSeq == null || bSeq > lastDispatchedBroadcastSeqRef.current) {
              if (bSeq != null) lastDispatchedBroadcastSeqRef.current = bSeq;
              window.dispatchEvent(
                new CustomEvent("cricket_scoring_broadcast_event", {
                  detail: msg.broadcastEvent,
                }),
              );
            }
          }
        } else if (msg.type === "scoring_replay") {
          // Replay frames update sequence tracking, never overwrite live display with null
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("cricket_scoring_replay_event", { detail: msg }),
            );
          }
        } else if (msg.type === "cricket_obs_director") {
          qc.setQueryData(
            ["cricket-obs-director", tournamentId],
            (current: { stageOrGroup?: string | null; type?: string } | undefined) =>
              mergeObsDirectorSnapshot(current, msg),
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("cricket_obs_director", { detail: msg }),
            );
          }
        }
      } catch {
        // ignore malformed messages
      }
    }

    function connect() {
      if (destroyed) return;
      clearTimeout(retryTimer);
      current?.close();

      const lastSeq = lastProcessedSequenceRef.current;
      const url =
        lastSeq > 0
          ? `/api/tournaments/${tournamentId}/scoring/events?lastEventId=${lastSeq}`
          : `/api/tournaments/${tournamentId}/scoring/events`;

      const es = new EventSource(url);
      current = es;

      es.onopen = () => {
        if (es !== current) return;
        markConnected();
      };

      es.onmessage = (event) => {
        if (es !== current) return;
        markConnected();
        handleMessagePayload(event.data, event.lastEventId);
      };

      es.addEventListener("scoring_state", (event: MessageEvent) => {
        if (es !== current) return;
        markConnected();
        handleMessagePayload(event.data, event.lastEventId);
      });

      es.addEventListener("scoring_replay", (event: MessageEvent) => {
        if (es !== current) return;
        markConnected();
        handleMessagePayload(event.data, event.lastEventId);
      });

      es.addEventListener("obs_director", (event: MessageEvent) => {
        if (es !== current) return;
        markConnected();
        handleMessagePayload(event.data, event.lastEventId);
      });

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
