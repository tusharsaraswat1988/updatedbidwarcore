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
import type { CricketObsFlashKind } from "@/lib/cricket-obs-view-model";
import { OBS_V2 } from "./obs-v2-tokens";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";
import { normalizeCricketFlashToObsV2Event } from "./obs-v2-event-adapter";

export interface UseObsV2EventsParams {
  rawFlash: CricketObsFlashKind | null;
  flashToken: string | null;
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

  // 1. Initial Mount / Stale Event Rejection
  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      if (flashToken) {
        seenTokensRef.current.add(flashToken);
      }
    }
  }, [flashToken]);

  // 2. Incoming Event Processing
  useEffect(() => {
    if (!rawFlash || !flashToken) return;

    // Check if token has already been processed
    if (seenTokensRef.current.has(flashToken)) return;

    // Lifecycle Gating: Only display transient scoring events during live innings or chase
    const isLiveMatchPhase = phase === "live" || phase === "chase";
    const isTerminalVictory = rawFlash === "MATCH_WON";
    if (!isLiveMatchPhase && !isTerminalVictory) {
      seenTokensRef.current.add(flashToken);
      return;
    }

    // Normalize event
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

    // Match Identity Guard: Ensure event belongs to the active match
    if (newEvent.matchId != null && matchId != null && newEvent.matchId !== matchId) {
      seenTokensRef.current.add(flashToken);
      return;
    }

    // Collision & Priority Resolution
    setActiveEvent((current) => {
      // If an event is currently active, resolve priority
      if (current) {
        if (newEvent.priority < current.priority) {
          // Lower priority event is suppressed
          seenTokensRef.current.add(flashToken);
          return current;
        }
      }

      // Mark token as seen
      seenTokensRef.current.add(flashToken);
      if (seenTokensRef.current.size > 100) {
        // Keep memory bounded
        const [first] = seenTokensRef.current;
        seenTokensRef.current.delete(first);
      }

      // Reset auto-dismiss timer
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      const totalDuration = OBS_V2.motion.duration.eventTotal || 2000;

      dismissTimerRef.current = setTimeout(() => {
        setActiveEvent(null);
      }, totalDuration);

      return newEvent;
    });
  }, [
    rawFlash,
    flashToken,
    flashDetail,
    matchId,
    phase,
    batterName,
    bowlerName,
    milestoneValue,
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
