/**
 * Badminton match state hook — SSE-backed live state with React Query cache.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cmdAwardPoint,
  mergeMatchStateCache,
  reduceBadminton,
  type BadmintonMatchState,
  type CommandEvent,
} from "@workspace/badminton-core";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import type { ScoringConnectionStatus } from "@/hooks/use-scoring-socket";
import {
  clearOptimisticRallyFloor,
  matchOptimisticKey,
  raiseOptimisticRallyFloor,
  shouldRejectRallyRegression,
} from "@/lib/badminton-optimistic-floor";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type MatchCache = { state: BadmintonMatchState; detail: unknown };

function applyOptimisticCommandEvents(
  state: BadmintonMatchState,
  events: CommandEvent[],
  matchId: number,
  tournamentId: number,
): BadmintonMatchState {
  let next = state;
  let seq = state.lastSequence ?? 0;

  for (const event of events) {
    seq += 1;
    next = reduceBadminton(next, {
      matchId,
      tournamentId,
      sportSlug: "badminton",
      eventType: event.eventType,
      eventVersion: 1,
      sequence: seq,
      actorType: "scorer",
      payload: event.payload,
    });
  }

  return next;
}

function mergeIncomingMatchState(
  tournamentId: number,
  matchId: number,
  prev: MatchCache | null,
  incoming: BadmintonMatchState,
): MatchCache | null {
  if (
    prev?.state &&
    shouldRejectRallyRegression(
      matchOptimisticKey(tournamentId, matchId),
      prev.state.totalRallies ?? 0,
      incoming.totalRallies ?? 0,
    )
  ) {
    return prev;
  }
  return mergeMatchStateCache(prev, incoming);
}

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
  const [connectionStatus, setConnectionStatus] = useState<ScoringConnectionStatus>("reconnecting");
  const setStatusRef = useRef(setConnectionStatus);

  useEffect(() => {
    setStatusRef.current = setConnectionStatus;
  });

  const query = useQuery({
    queryKey,
    queryFn: () => fetchMatchState(tournamentId, matchId),
    enabled: !!tournamentId && !!matchId,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = query.state.data?.state?.matchStatus;
      const live = status === "live" || status === "paused";
      if (!live) return false;
      return sseAwareRefetchInterval(connectionStatus, 15000);
    },
  });

  // SSE subscription
  useEffect(() => {
    if (!tournamentId || !matchId) return;

    let disconnectedTimer: ReturnType<typeof setTimeout>;

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

    const url = `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream?matchId=${matchId}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => markConnected();

    es.onmessage = (event) => {
      markConnected();
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "match_state" && msg.data) {
          queryClient.setQueryData(queryKey, (prev: MatchCache | null) =>
            mergeIncomingMatchState(
              tournamentId,
              matchId,
              prev,
              msg.data as BadmintonMatchState,
            ),
          );
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      markReconnecting();
    };

    return () => {
      clearTimeout(disconnectedTimer);
      es.close();
      esRef.current = null;
    };
  }, [tournamentId, matchId, queryClient]);

  return query;
}

// ── Scorer actions hook ───────────────────────────────────────────────────────

export function useBadmintonScorer(
  tournamentId: number,
  matchId: number,
  _scorerPin?: string,
) {
  const queryClient = useQueryClient();
  const queryKey = ["badminton-match", tournamentId, matchId];
  const pointQueueRef = useRef<Array<{ side: "left" | "right" }>>([]);
  const drainPromiseRef = useRef<Promise<void> | null>(null);

  async function postAction(endpoint: string, body: unknown) {
    const { scorerAuthHeaders } = await import("@/lib/badminton-scorer-session");
    const res = await fetch(
      `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...scorerAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "unknown error" }));
      throw new Error(err.message ?? err.error ?? "Request failed");
    }
    const data = await res.json();
    if (data.state) {
      queryClient.setQueryData(queryKey, (prev: MatchCache | null) =>
        mergeIncomingMatchState(
          tournamentId,
          matchId,
          prev,
          data.state as BadmintonMatchState,
        ),
      );
    }
    return data.state as BadmintonMatchState;
  }

  const drainPointQueue = useCallback(() => {
    if (drainPromiseRef.current) {
      return drainPromiseRef.current;
    }

    const optimisticKey = matchOptimisticKey(tournamentId, matchId);

    drainPromiseRef.current = (async () => {
      while (pointQueueRef.current.length > 0) {
        const item = pointQueueRef.current[0];
        try {
          await postAction("point", { side: item.side });
          pointQueueRef.current.shift();
        } catch {
          pointQueueRef.current = [];
          clearOptimisticRallyFloor(optimisticKey);
          await queryClient.invalidateQueries({ queryKey });
          throw new Error("Failed to score point");
        }
      }
      clearOptimisticRallyFloor(optimisticKey);
    })().finally(() => {
      drainPromiseRef.current = null;
    });

    return drainPromiseRef.current;
  }, [matchId, queryClient, tournamentId]);

  const awardPoint = useCallback(
    (side: "left" | "right") => {
      let rejected: string | null = null;
      const optimisticKey = matchOptimisticKey(tournamentId, matchId);

      queryClient.setQueryData(queryKey, (prev: MatchCache | null) => {
        if (!prev?.state) return prev;
        const result = cmdAwardPoint(prev.state, side);
        if (!result.ok) {
          rejected = result.error;
          return prev;
        }
        const nextState = applyOptimisticCommandEvents(
          prev.state,
          result.events,
          matchId,
          tournamentId,
        );
        raiseOptimisticRallyFloor(optimisticKey, nextState.totalRallies ?? 0);
        return {
          state: nextState,
          detail: prev.detail,
        };
      });

      if (rejected) {
        return Promise.reject(new Error(rejected));
      }

      const cached = queryClient.getQueryData<MatchCache>(queryKey);
      if (!cached?.state) {
        return postAction("point", { side });
      }

      pointQueueRef.current.push({ side });
      return drainPointQueue();
    },
    [drainPointQueue, matchId, queryClient, tournamentId],
  );

  const undo = useCallback(() => postAction("undo", {}), [matchId]);

  const startTimeout = useCallback(
    (side: "left" | "right", kind: "regular" | "medical" = "regular") =>
      postAction("timeout", { action: "start", side, kind }),
    [matchId],
  );

  const endTimeout = useCallback(() => postAction("timeout", { action: "end" }), [matchId]);

  const startMatch = useCallback(
    (payload: unknown) => postAction("start", payload),
    [matchId],
  );

  const startInterval = useCallback(() => postAction("interval", { action: "start" }), [matchId]);

  const endInterval = useCallback(() => postAction("interval", { action: "end" }), [matchId]);

  const acknowledgeCourtChange = useCallback(() => postAction("court-change", {}), [matchId]);

  return {
    awardPoint,
    undo,
    startTimeout,
    endTimeout,
    startInterval,
    endInterval,
    acknowledgeCourtChange,
    startMatch,
  };
}

// ── Tournament Director actions hook ─────────────────────────────────────────

export function useBadmintonDirector(tournamentId: number, matchId: number) {
  const queryClient = useQueryClient();
  const queryKey = ["badminton-match", tournamentId, matchId];

  async function postDirector(endpoint: string, body: unknown) {
    const res = await fetch(
      `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}/${endpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      queryClient.setQueryData(queryKey, (prev: MatchCache | null) =>
        mergeMatchStateCache(prev, data.state as BadmintonMatchState),
      );
    }
    void queryClient.invalidateQueries({ queryKey: ["badminton-incidents", tournamentId, matchId] });
    return data.state as BadmintonMatchState;
  }

  return {
    pause: (reason: string, detail?: string) => postDirector("pause", { reason, detail }),
    resume: () => postDirector("resume", {}),
    addNote: (text: string) => postDirector("note", { text }),
    retirement: (retiringSide: "left" | "right", reason?: string) =>
      postDirector("retirement", { retiringSide, reason }),
    walkover: (winningSide: "left" | "right", reason?: string) =>
      postDirector("walkover", { winningSide, reason }),
    disqualification: (disqualifiedSide: "left" | "right", reason: string) =>
      postDirector("disqualification", { disqualifiedSide, reason }),
    forceEnd: (reason: string) => postDirector("force-end", { reason }),
  };
}

// ── Tournament live matches hook ──────────────────────────────────────────────

// ── Tournament live matches hook ──────────────────────────────────────────────

type DashboardStreamEntry = {
  es: EventSource;
  refs: number;
  listeners: Set<() => void>;
};

/** One EventSource per tournament — setup pages share it instead of reconnecting on every nav. */
const dashboardStreams = new Map<number, DashboardStreamEntry>();

function subscribeBadmintonDashboardStream(
  tournamentId: number,
  onMessage: () => void,
): () => void {
  let entry = dashboardStreams.get(tournamentId);
  if (!entry) {
    const url = `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream`;
    const es = new EventSource(url, { withCredentials: true });
    entry = { es, refs: 0, listeners: new Set() };
    es.onmessage = () => {
      entry?.listeners.forEach((listener) => listener());
    };
    dashboardStreams.set(tournamentId, entry);
  }

  entry.refs += 1;
  entry.listeners.add(onMessage);

  return () => {
    const current = dashboardStreams.get(tournamentId);
    if (!current) return;
    current.listeners.delete(onMessage);
    current.refs -= 1;
    if (current.refs <= 0) {
      current.es.close();
      dashboardStreams.delete(tournamentId);
    }
  };
}

export function useBadmintonDashboard(tournamentId: number) {
  const queryClient = useQueryClient();
  const queryKey = ["badminton-dashboard", tournamentId];

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
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!tournamentId) return;
    return subscribeBadmintonDashboardStream(tournamentId, () => {
      void queryClient.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
    });
  }, [tournamentId, queryClient]);

  return query;
}
