import { useCallback, useEffect, useRef, useState } from "react";
import type { CricketAuthoritativeBroadcastEvent } from "@workspace/scoring-core";

export interface SuperBallActivationEvent {
  id: string;
  activationId?: string;
  matchId: number;
  sequence: number;
  timestamp: number;
  battingTeamName?: string;
}

export function useSuperBallActivation(
  tournamentId: number,
  options?: {
    onActivated?: (event: SuperBallActivationEvent) => void;
  },
) {
  const [activeActivation, setActiveActivation] =
    useState<SuperBallActivationEvent | null>(null);

  // Set of seen event IDs to prevent duplicate replays
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Mount timestamp to discard stale events delivered during reconnect/hydration
  const mountTimeRef = useRef<number>(Date.now());

  const triggerActivation = useCallback(
    (ev: {
      id?: string;
      activationId?: string;
      matchId: number;
      sequence: number;
      timestamp?: number;
      battingTeamName?: string;
    }) => {
      const uniqueId =
        ev.id ||
        ev.activationId ||
        `${ev.matchId}:${ev.sequence}:SUPER_BALL_ACTIVATED`;

      // 1. Duplicate event protection: ignore if this exact event was already processed
      if (seenIdsRef.current.has(uniqueId)) {
        return;
      }

      // 2. Stale event protection: ignore events that occurred before this component mounted
      const eventTime = ev.timestamp ?? Date.now();
      if (eventTime < mountTimeRef.current - 4000) {
        return;
      }

      seenIdsRef.current.add(uniqueId);

      const activation: SuperBallActivationEvent = {
        id: uniqueId,
        activationId: ev.activationId,
        matchId: ev.matchId,
        sequence: ev.sequence,
        timestamp: eventTime,
        battingTeamName: ev.battingTeamName,
      };

      setActiveActivation(activation);
      options?.onActivated?.(activation);
    },
    [options],
  );

  // 1. Window Event Listener for authoritative SSE broadcast events dispatched by useScoringSocket
  useEffect(() => {
    if (typeof window === "undefined" || !tournamentId) return;

    function handleBroadcastEvent(e: Event) {
      const detail = (e as CustomEvent<CricketAuthoritativeBroadcastEvent>).detail;
      if (!detail) return;

      if (detail.type === "SUPER_BALL_ACTIVATED") {
        triggerActivation({
          id: detail.id,
          activationId: detail.activationId,
          matchId: detail.matchId,
          sequence: detail.sequence,
          timestamp: detail.timestamp,
        });
      }
    }

    window.addEventListener(
      "cricket_scoring_broadcast_event",
      handleBroadcastEvent,
    );
    return () => {
      window.removeEventListener(
        "cricket_scoring_broadcast_event",
        handleBroadcastEvent,
      );
    };
  }, [tournamentId, triggerActivation]);

  // 2. BroadcastChannel Listener for same-browser / multi-tab synchronization
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof BroadcastChannel === "undefined" ||
      !tournamentId
    ) {
      return;
    }

    const channel = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
    channel.onmessage = (ev) => {
      const data = ev.data;
      if (!data) return;

      if (data.type === "SUPER_BALL_ACTIVATED" && data.broadcastEvent) {
        const be = data.broadcastEvent;
        triggerActivation({
          id: be.id,
          activationId: be.activationId,
          matchId: be.matchId,
          sequence: be.sequence,
          timestamp: be.timestamp,
          battingTeamName: be.battingTeamName,
        });
      }
    };

    return () => {
      channel.close();
    };
  }, [tournamentId, triggerActivation]);

  const dismissActivation = useCallback(() => {
    setActiveActivation(null);
  }, []);

  return {
    activeActivation,
    dismissActivation,
    triggerActivation,
  };
}
