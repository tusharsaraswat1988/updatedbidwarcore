/**
 * Badminton match state hook — SSE-backed live state with React Query cache.
 */

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BadmintonMatchState } from "@workspace/badminton-core";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchMatchState(
  tournamentId: number,
  matchId: number,
): Promise<{ state: BadmintonMatchState; detail: unknown } | null> {
  const res = await fetch(
    `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}`,
    { credentials: "include" },
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useBadmintonMatch(tournamentId: number, matchId: number) {
  const queryClient = useQueryClient();
  const queryKey = ["badminton-match", tournamentId, matchId];
  const esRef = useRef<EventSource | null>(null);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchMatchState(tournamentId, matchId),
    enabled: !!tournamentId && !!matchId,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  // SSE subscription
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    const url = `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream?matchId=${matchId}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "match_state" && msg.data) {
          queryClient.setQueryData(queryKey, (prev: { state: BadmintonMatchState; detail: unknown } | null) => ({
            state: msg.data as BadmintonMatchState,
            detail: prev?.detail ?? null,
          }));
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [tournamentId, matchId]);

  return query;
}

// ── Scorer actions hook ───────────────────────────────────────────────────────

export function useBadmintonScorer(
  tournamentId: number,
  matchId: number,
  scorerPin?: string,
) {
  const queryClient = useQueryClient();
  const queryKey = ["badminton-match", tournamentId, matchId];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(scorerPin ? { "x-scorer-pin": scorerPin } : {}),
  };

  async function postAction(endpoint: string, body: unknown) {
    const res = await fetch(
      `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/${endpoint}`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "unknown error" }));
      throw new Error(err.error ?? "Request failed");
    }
    const data = await res.json();
    if (data.state) {
      queryClient.setQueryData(queryKey, (prev: { state: BadmintonMatchState; detail: unknown } | null) => ({
        state: data.state as BadmintonMatchState,
        detail: prev?.detail ?? null,
      }));
    }
    return data.state as BadmintonMatchState;
  }

  const awardPoint = useCallback(
    (side: "left" | "right") => postAction("point", { side }),
    [matchId],
  );

  const undo = useCallback(() => postAction("undo", {}), [matchId]);

  const startTimeout = useCallback(
    (side: "left" | "right", kind: "regular" | "medical" = "regular") =>
      postAction("timeout", { action: "start", side, kind }),
    [matchId],
  );

  const endTimeout = useCallback(() => postAction("timeout", { action: "end" }), [matchId]);

  const retirement = useCallback(
    (retiringSide: "left" | "right", reason?: string) =>
      postAction("retirement", { retiringSide, reason }),
    [matchId],
  );

  const walkover = useCallback(
    (winningSide: "left" | "right", reason?: string) =>
      postAction("walkover", { winningSide, reason }),
    [matchId],
  );

  const startMatch = useCallback(
    (payload: unknown) => postAction("start", payload),
    [matchId],
  );

  return { awardPoint, undo, startTimeout, endTimeout, retirement, walkover, startMatch };
}

// ── Tournament live matches hook ──────────────────────────────────────────────

export function useBadmintonDashboard(tournamentId: number) {
  const queryClient = useQueryClient();
  const queryKey = ["badminton-dashboard", tournamentId];
  const esRef = useRef<EventSource | null>(null);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/dashboard`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: !!tournamentId,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!tournamentId) return;

    const url = `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    return () => {
      es.close();
    };
  }, [tournamentId]);

  return query;
}
