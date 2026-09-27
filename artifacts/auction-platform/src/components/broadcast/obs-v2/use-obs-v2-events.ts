/**
 * BIDWAR — CRICKET BROADCAST OVERLAY V2
 * Broadcast Event State & Lifecycle Hook
 *
 * Responsibilities:
 * - Event deduplication (preserves seen tokens to prevent replays across re-renders & reconnects).
 * - Stale-event rejection (suppresses historical events on initial page mount).
 * - Match identity validation (guarantees event belongs to currently displayed fixture).
 * - Lifecycle gating (suppresses scoring events during pre-match, break, or loading).
 * - Deterministic collision & priority management (WICKET/milestones supersede boundaries).
 * - Timed auto-dismissal matching V2 motion tokens.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CricketAuthoritativeBroadcastEvent } from "@workspace/scoring-core";
import type { CricketObsFlashKind } from "@/lib/cricket-obs-view-model";
import { OBS_V2 } from "./obs-v2-tokens";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";
import {
  normalizeAuthoritativeBroadcastEvent,
  normalizeCricketFlashToObsV2Event,
} from "./obs-v2-event-adapter";

export interface UseObsV2EventsParams {
  authoritativeEvent?: CricketAuthoritativeBroadcastEvent | null;
  rawFlash?: CricketObsFlashKind | null;
  flashToken?: string | null;
  flashDetail?: string | null;
  matchId: number | null;
  phase?: string;
  batterName?: string | null;
  bowlerName?: string | null;
  milestoneValue?: number | null;
}

export interface UseObsV2EventsResult {
  /** Currently active broadcast event to render */
  activeEvent: ObsV2BroadcastEvent | null;
  /** Manually dismiss the current event (if needed by director/operator) */
  dismissActiveEvent: () => void;
}

export function useObsV2Events({
  authoritativeEvent,
  rawFlash,
  flashToken,
  flashDetail,
  matchId,
  phase = "live",
  batterName,
  bowlerName,
  milestoneValue,
}: UseObsV2EventsParams): UseObsV2EventsResult {
  const [activeEvent, setActiveEvent] = useState<ObsV2BroadcastEvent | null>(null);

  // Set of already-seen event tokens to prevent replaying on reconnect / re-render
  const seenTokensRef = useRef<Set<string>>(new Set());
  // Ref to track first hydration / bootstrap
  const bootstrappedRef = useRef<boolean>(false);
  // Ref to hold active dismiss timer
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissActiveEvent = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setActiveEvent(null);
  }, []);

  // Timestamp when hook mounted to reject events that happened before the viewer opened the overlay
  const mountTimeRef = useRef<number>(Date.now());

  // 1. Initial Mount / Stale Event Rejection
  useEffect(() => {
    if (!bootstrappedRef.current) {
      if (authoritativeEvent?.id) {
        seenTokensRef.current.add(authoritativeEvent.id);
        bootstrappedRef.current = true;
      }
      if (flashToken) {
        seenTokensRef.current.add(flashToken);
      }
    }
  }, [authoritativeEvent?.id, flashToken]);

  const dispatchEvent = useCallback(
    (newEvent: ObsV2BroadcastEvent, token: string) => {
      // Match Identity Guard: Ensure event belongs to the active match
      if (newEvent.matchId != null && matchId != null && newEvent.matchId !== matchId) {
        seenTokensRef.current.add(token);
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[OBS V2] normalized event id=${newEvent.id}`);
      }

      // Collision & Priority Resolution
      setActiveEvent((current) => {
        if (current && newEvent.priority < current.priority) {
          seenTokensRef.current.add(token);
          return current;
        }

        seenTokensRef.current.add(token);
        if (seenTokensRef.current.size > 100) {
          const [first] = seenTokensRef.current;
          seenTokensRef.current.delete(first);
        }

        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
        }

        const totalDuration = OBS_V2.motion.duration.eventTotal || 2000;
        dismissTimerRef.current = setTimeout(() => {
          setActiveEvent(null);
        }, totalDuration);

        return newEvent;
      });
    },
    [matchId],
  );

  // 2. Authoritative Server Event Processing (P0 Primary Path)
  useEffect(() => {
    if (!authoritativeEvent || !authoritativeEvent.id) return;
    const token = authoritativeEvent.id;
    if (seenTokensRef.current.has(token)) return;

    // Suppress stale historical events that occurred prior to hook mount
    if (
      authoritativeEvent.timestamp &&
      authoritativeEvent.timestamp < mountTimeRef.current - 4000
    ) {
      seenTokensRef.current.add(token);
      return;
    }

    if (phase === "completed" && authoritativeEvent.type !== "MATCH_WON") {
      seenTokensRef.current.add(token);
      return;
    }

    const newEvent = normalizeAuthoritativeBroadcastEvent(authoritativeEvent);
    if (!newEvent) return;

    dispatchEvent(newEvent, token);
  }, [authoritativeEvent, phase, dispatchEvent]);

  // Window Event Listener for Real-Time SSE Event Dispatch
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBroadcastEvent = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as CricketAuthoritativeBroadcastEvent;
      if (!detail || !detail.id) return;
      const token = detail.id;
      if (seenTokensRef.current.has(token)) return;

      if (phase === "completed" && detail.type !== "MATCH_WON") {
        seenTokensRef.current.add(token);
        return;
      }

      const newEvent = normalizeAuthoritativeBroadcastEvent(detail);
      if (!newEvent) return;

      dispatchEvent(newEvent, token);
    };

    window.addEventListener("cricket_scoring_broadcast_event", handleBroadcastEvent);
    return () => {
      window.removeEventListener("cricket_scoring_broadcast_event", handleBroadcastEvent);
    };
  }, [phase, dispatchEvent]);

  // 3. Fallback / Manual Director Flash Processing
  useEffect(() => {
    if (!rawFlash || !flashToken) return;
    if (seenTokensRef.current.has(flashToken)) return;

    if (phase === "completed" && rawFlash !== "MATCH_WON") {
      seenTokensRef.current.add(flashToken);
      return;
    }

    const newEvent = normalizeCricketFlashToObsV2Event({
      flash: rawFlash,
      token: flashToken,
      detail: flashDetail,
      matchId,
      timestamp: Date.now(),
      batter: batterName,
      bowler: bowlerName,
      milestoneValue,
    });

    if (!newEvent) return;
    dispatchEvent(newEvent, flashToken);
  }, [
    rawFlash,
    flashToken,
    flashDetail,
    matchId,
    phase,
    batterName,
    bowlerName,
    milestoneValue,
    dispatchEvent,
  ]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  return {
    activeEvent,
    dismissActiveEvent,
  };
}
