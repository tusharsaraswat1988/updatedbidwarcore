/**
 * Badminton match state hook — SSE-backed live state with React Query cache.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cmdAcknowledgeCourtChange,
  cmdAwardPoint,
  mergeMatchStateCache,
  reduceBadminton,
  type BadmintonMatchState,
  type CommandEvent,
} from "@workspace/badminton-core";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { nextSseReconnectDelayMs } from "@/lib/sse-reconnect";
import { getGetTournamentQueryKey } from "@workspace/api-client-react";
import type { ScoringConnectionStatus } from "@/hooks/use-scoring-socket";
import {
  clearOptimisticRallyFloor,
  matchOptimisticKey,
  raiseOptimisticRallyFloor,
  shouldRejectRallyRegression,
} from "@/lib/badminton-optimistic-floor";
import {
  isMatchStateChangedPayload,
  patchBadmintonMatchesFromMatchState,
  shouldRefetchBadmintonMatches,
} from "@/lib/badminton-match-list-cache";
import { isPresentationPayload } from "@/lib/badminton-presentation-mutation";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** No message/ping within this window → force close + reconnect. */
const SSE_STALE_MS = 45_000;
/** How often to check lastEventAt. */
const SSE_WATCHDOG_MS = 10_000;
/** React Query poll while SSE is reconnecting (fallback for live scores). */
const SSE_RECONNECT_POLL_MS = 8_000;

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
  // Reject foreign-match SSE frames even if their sequence is higher (Sprint 1 / C1).
  if (
    matchId > 0 &&
    incoming.matchId != null &&
    incoming.matchId > 0 &&
    incoming.matchId !== matchId
  ) {
    return prev;
  }
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
  return mergeMatchStateCache(prev, incoming, matchId > 0 ? matchId : undefined);
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
      return sseAwareRefetchInterval(connectionStatus, SSE_RECONNECT_POLL_MS);
    },
  });

  // Shared SSE subscription (one EventSource per tournament+match)
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

    const unsubscribe = subscribeBadmintonMatchStream(
      tournamentId,
      matchId,
      (msg) => {
        markConnected();
        try {
          if (msg.type === "match_state" && msg.data) {
            // Prefer envelope matchId; fall back to state.matchId.
            const envelopeMatchId =
              typeof msg.matchId === "number"
                ? msg.matchId
                : (msg.data as BadmintonMatchState).matchId;
            if (
              matchId > 0 &&
              typeof envelopeMatchId === "number" &&
              envelopeMatchId > 0 &&
              envelopeMatchId !== matchId
            ) {
              return;
            }
            const incoming = msg.data as BadmintonMatchState;
            queryClient.setQueryData(queryKey, (prev: MatchCache | null) =>
              mergeIncomingMatchState(
                tournamentId,
                matchId,
                prev,
                incoming,
              ),
            );
            // Keep multi-court / Mission Control list rows in sync without GET /matches.
            patchBadmintonMatchesFromMatchState(
              queryClient,
              tournamentId,
              matchId,
              incoming,
            );
          }
        } catch {
          // ignore malformed events
        }
      },
      (status) => {
        if (status === "connected") markConnected();
        else markReconnecting();
      },
    );

    return () => {
      clearTimeout(disconnectedTimer);
      unsubscribe();
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
  const pointQueueRef = useRef<Array<{ side: "left" | "right"; idempotencyKey: string }>>([]);
  const drainPromiseRef = useRef<Promise<void> | null>(null);
  const [pointSyncError, setPointSyncError] = useState<string | null>(null);
  const [pendingPointCount, setPendingPointCount] = useState(0);
  const [pointsSyncing, setPointsSyncing] = useState(false);

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
      const raw = await res.text().catch(() => "");
      let message = "";
      try {
        const err = raw ? (JSON.parse(raw) as { message?: string; error?: string }) : null;
        message = err?.message ?? err?.error ?? "";
      } catch {
        // Non-JSON (often HTML 404/500 when API dist is stale)
      }
      if (!message) {
        if (res.status === 404) {
          message =
            "Edit toss API not found — rebuild/restart the API server, then try again.";
        } else {
          message = raw.trim().slice(0, 180) || `Request failed (${res.status})`;
        }
      }
      throw new Error(message);
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

    setPointsSyncing(true);
    drainPromiseRef.current = (async () => {
      while (pointQueueRef.current.length > 0) {
        const item = pointQueueRef.current[0];
        try {
          await postAction("point", {
            side: item.side,
            idempotencyKey: item.idempotencyKey,
          });
          pointQueueRef.current.shift();
          setPendingPointCount(pointQueueRef.current.length);
          setPointSyncError(null);
        } catch (err) {
          // Keep unsent items for a later retry, but clear the floor so SSE can catch up.
          clearOptimisticRallyFloor(optimisticKey);
          setPendingPointCount(pointQueueRef.current.length);
          await queryClient.invalidateQueries({ queryKey });
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Failed to score point — tap Retry to send again";
          setPointSyncError(message);
          throw new Error(message);
        }
      }
      clearOptimisticRallyFloor(optimisticKey);
    })().finally(() => {
      drainPromiseRef.current = null;
      setPointsSyncing(false);
      setPendingPointCount(pointQueueRef.current.length);
    });

    return drainPromiseRef.current;
  }, [matchId, queryClient, tournamentId]);

  const retryPointQueue = useCallback(() => {
    setPointSyncError(null);
    return drainPointQueue();
  }, [drainPointQueue]);

  /** Wait for optimistic points to reach the server before interval/court-change/exit. */
  const ensurePointsSynced = useCallback(async () => {
    if (drainPromiseRef.current) {
      await drainPromiseRef.current;
    }
    if (pointQueueRef.current.length > 0) {
      await drainPointQueue();
    }
  }, [drainPointQueue]);

  const awardPoint = useCallback(
    (side: "left" | "right") => {
      let rejected: string | null = null;
      const optimisticKey = matchOptimisticKey(tournamentId, matchId);
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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
        return postAction("point", { side, idempotencyKey });
      }

      pointQueueRef.current.push({ side, idempotencyKey });
      setPendingPointCount(pointQueueRef.current.length);
      return drainPointQueue();
    },
    [drainPointQueue, matchId, queryClient, tournamentId],
  );

  const undo = useCallback(async () => {
    await ensurePointsSynced();
    return postAction("undo", {});
  }, [ensurePointsSynced, matchId]);

  const startTimeout = useCallback(
    async (side: "left" | "right", kind: "regular" | "medical" = "regular") => {
      await ensurePointsSynced();
      return postAction("timeout", { action: "start", side, kind });
    },
    [ensurePointsSynced, matchId],
  );

  const endTimeout = useCallback(async () => {
    await ensurePointsSynced();
    return postAction("timeout", { action: "end" });
  }, [ensurePointsSynced, matchId]);

  const startMatch = useCallback(
    (payload: unknown) => postAction("start", payload),
    [matchId],
  );

  const startInterval = useCallback(async () => {
    await ensurePointsSynced();
    return postAction("interval", { action: "start" });
  }, [ensurePointsSynced, matchId]);

  const endInterval = useCallback(async () => {
    await ensurePointsSynced();
    return postAction("interval", { action: "end" });
  }, [ensurePointsSynced, matchId]);

  const acknowledgeCourtChange = useCallback(async () => {
    await ensurePointsSynced();

    queryClient.setQueryData(queryKey, (prev: MatchCache | null) => {
      if (!prev?.state) return prev;
      const result = cmdAcknowledgeCourtChange(prev.state);
      if (!result.ok || result.events.length === 0) return prev;
      return {
        state: applyOptimisticCommandEvents(
          prev.state,
          result.events,
          matchId,
          tournamentId,
        ),
        detail: prev.detail,
      };
    });

    try {
      return await postAction("court-change", {});
    } catch (err) {
      await queryClient.invalidateQueries({ queryKey });
      throw err;
    }
  }, [ensurePointsSynced, matchId, queryClient, tournamentId]);

  const correctToss = useCallback(
    async (payload: unknown) => {
      await ensurePointsSynced();
      const state = await postAction("edit-toss", payload);
      await queryClient.invalidateQueries({ queryKey });
      return state;
    },
    [ensurePointsSynced, matchId, queryClient, tournamentId],
  );

  return {
    awardPoint,
    undo,
    startTimeout,
    endTimeout,
    startInterval,
    endInterval,
    acknowledgeCourtChange,
    correctToss,
    startMatch,
    pointSyncError,
    retryPointQueue,
    pendingPointCount,
    pointsSyncing,
    ensurePointsSynced,
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
    retirement: (
      retiringSide: "left" | "right",
      reason?: string,
      assignedMarginPoints?: number,
    ) => postDirector("retirement", { retiringSide, reason, assignedMarginPoints }),
    walkover: (
      winningSide: "left" | "right",
      reason?: string,
      assignedMarginPoints?: number,
    ) => postDirector("walkover", { winningSide, reason, assignedMarginPoints }),
    disqualification: (
      disqualifiedSide: "left" | "right",
      reason: string,
      assignedMarginPoints?: number,
    ) => postDirector("disqualification", { disqualifiedSide, reason, assignedMarginPoints }),
    forceEnd: (reason: string, assignedMarginPoints?: number) =>
      postDirector("force-end", { reason, assignedMarginPoints }),
    assignMarginPoints: (assignedMarginPoints: number) =>
      postDirector("assigned-margin-points", { assignedMarginPoints }),
  };
}

// ── Shared EventSource pools (refcount + liveness) ────────────────────────────

type MatchStreamMessage = {
  type?: string;
  matchId?: number;
  tournamentId?: number;
  data?: unknown;
};

type MatchStreamEntry = {
  es: EventSource | null;
  refs: number;
  listeners: Set<(msg: MatchStreamMessage) => void>;
  statusListeners: Set<(status: ScoringConnectionStatus) => void>;
  url: string;
  lastEventAt: number;
  watchdog: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
};

/** One EventSource per tournament+match — N components share one connection. */
const matchStreams = new Map<string, MatchStreamEntry>();

function matchStreamKey(tournamentId: number, matchId: number): string {
  return `${tournamentId}:${matchId}`;
}

function closeEventSource(es: EventSource | null): void {
  if (!es) return;
  es.onopen = null;
  es.onmessage = null;
  es.onerror = null;
  es.close();
}

function notifyMatchStatus(
  entry: MatchStreamEntry,
  status: ScoringConnectionStatus,
): void {
  entry.statusListeners.forEach((listener) => listener(status));
}

function touchMatchAlive(entry: MatchStreamEntry): void {
  entry.lastEventAt = Date.now();
  entry.reconnectAttempt = 0;
  notifyMatchStatus(entry, "connected");
}

function destroyMatchEs(entry: MatchStreamEntry): void {
  closeEventSource(entry.es);
  entry.es = null;
}

function scheduleMatchReconnect(key: string, entry: MatchStreamEntry): void {
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
  notifyMatchStatus(entry, "reconnecting");
  const delay = nextSseReconnectDelayMs(entry.reconnectAttempt);
  entry.reconnectAttempt += 1;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    if (!matchStreams.has(key) || entry.refs <= 0) return;
    connectMatchStream(key, entry);
  }, delay);
}

function connectMatchStream(key: string, entry: MatchStreamEntry): void {
  destroyMatchEs(entry);
  if (entry.reconnectTimer) {
    clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
  }

  const es = new EventSource(entry.url, { withCredentials: true });
  entry.es = es;

  const onPing = () => {
    if (entry.es !== es) return;
    touchMatchAlive(entry);
  };

  es.addEventListener("ping", onPing);
  es.onopen = () => {
    if (entry.es !== es) return;
    touchMatchAlive(entry);
  };
  es.onmessage = (event) => {
    if (entry.es !== es) return;
    touchMatchAlive(entry);
    try {
      const msg = JSON.parse(event.data) as MatchStreamMessage;
      entry.listeners.forEach((listener) => listener(msg));
    } catch {
      // ignore malformed events
    }
  };
  es.onerror = () => {
    if (entry.es !== es) return;
    destroyMatchEs(entry);
    scheduleMatchReconnect(key, entry);
  };
}

function ensureMatchWatchdog(key: string, entry: MatchStreamEntry): void {
  if (entry.watchdog) return;
  entry.watchdog = setInterval(() => {
    if (!matchStreams.has(key) || entry.refs <= 0) return;
    if (Date.now() - entry.lastEventAt <= SSE_STALE_MS) return;
    // OPEN-but-silent: browser will not reconnect; force close + new ES.
    destroyMatchEs(entry);
    scheduleMatchReconnect(key, entry);
  }, SSE_WATCHDOG_MS);
}

function subscribeBadmintonMatchStream(
  tournamentId: number,
  matchId: number,
  onMessage: (msg: MatchStreamMessage) => void,
  onStatus?: (status: ScoringConnectionStatus) => void,
): () => void {
  const key = matchStreamKey(tournamentId, matchId);
  let entry = matchStreams.get(key);
  if (!entry) {
    entry = {
      es: null,
      refs: 0,
      listeners: new Set(),
      statusListeners: new Set(),
      url: `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream?matchId=${matchId}`,
      lastEventAt: Date.now(),
      watchdog: null,
      reconnectTimer: null,
      reconnectAttempt: 0,
    };
    matchStreams.set(key, entry);
    connectMatchStream(key, entry);
    ensureMatchWatchdog(key, entry);
  }

  entry.refs += 1;
  entry.listeners.add(onMessage);
  if (onStatus) entry.statusListeners.add(onStatus);
  if (entry.es?.readyState === EventSource.OPEN) {
    onStatus?.("connected");
  } else {
    onStatus?.("reconnecting");
  }

  return () => {
    const current = matchStreams.get(key);
    if (!current) return;
    current.listeners.delete(onMessage);
    if (onStatus) current.statusListeners.delete(onStatus);
    current.refs -= 1;
    if (current.refs <= 0) {
      if (current.watchdog) clearInterval(current.watchdog);
      if (current.reconnectTimer) clearTimeout(current.reconnectTimer);
      destroyMatchEs(current);
      matchStreams.delete(key);
    }
  };
}

type DashboardStreamEntry = {
  es: EventSource | null;
  refs: number;
  listeners: Set<(payload?: unknown) => void>;
  statusListeners: Set<(status: ScoringConnectionStatus) => void>;
  url: string;
  lastEventAt: number;
  watchdog: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempt: number;
};

/** One EventSource per tournament — setup pages share it instead of reconnecting on every nav. */
const dashboardStreams = new Map<number, DashboardStreamEntry>();

function notifyDashboardStatus(
  entry: DashboardStreamEntry,
  status: ScoringConnectionStatus,
): void {
  entry.statusListeners.forEach((listener) => listener(status));
}

function destroyDashboardEs(entry: DashboardStreamEntry): void {
  closeEventSource(entry.es);
  entry.es = null;
}

function scheduleDashboardReconnect(
  tournamentId: number,
  entry: DashboardStreamEntry,
): void {
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
  notifyDashboardStatus(entry, "reconnecting");
  const delay = nextSseReconnectDelayMs(entry.reconnectAttempt);
  entry.reconnectAttempt += 1;
  entry.reconnectTimer = setTimeout(() => {
    entry.reconnectTimer = null;
    if (!dashboardStreams.has(tournamentId) || entry.refs <= 0) return;
    connectDashboardStream(tournamentId, entry);
  }, delay);
}

function connectDashboardStream(
  tournamentId: number,
  entry: DashboardStreamEntry,
): void {
  destroyDashboardEs(entry);
  if (entry.reconnectTimer) {
    clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
  }

  const es = new EventSource(entry.url, { withCredentials: true });
  entry.es = es;

  const touchAlive = () => {
    if (entry.es !== es) return;
    entry.lastEventAt = Date.now();
    entry.reconnectAttempt = 0;
    notifyDashboardStatus(entry, "connected");
  };

  es.addEventListener("ping", touchAlive);
  es.onopen = touchAlive;
  es.onmessage = (event) => {
    if (entry.es !== es) return;
    touchAlive();
    let payload: unknown;
    try {
      const parsed = JSON.parse(event.data) as { type?: string; data?: unknown };
      payload = parsed?.type === "tournament_update" ? parsed.data : parsed;
    } catch {
      payload = undefined;
    }
    entry.listeners.forEach((listener) => listener(payload));
  };
  es.onerror = () => {
    if (entry.es !== es) return;
    destroyDashboardEs(entry);
    scheduleDashboardReconnect(tournamentId, entry);
  };
}

function ensureDashboardWatchdog(
  tournamentId: number,
  entry: DashboardStreamEntry,
): void {
  if (entry.watchdog) return;
  entry.watchdog = setInterval(() => {
    if (!dashboardStreams.has(tournamentId) || entry.refs <= 0) return;
    if (Date.now() - entry.lastEventAt <= SSE_STALE_MS) return;
    destroyDashboardEs(entry);
    scheduleDashboardReconnect(tournamentId, entry);
  }, SSE_WATCHDOG_MS);
}

export function subscribeBadmintonDashboardStream(
  tournamentId: number,
  onMessage: (payload?: unknown) => void,
  onStatus?: (status: ScoringConnectionStatus) => void,
): () => void {
  let entry = dashboardStreams.get(tournamentId);
  if (!entry) {
    entry = {
      es: null,
      refs: 0,
      listeners: new Set(),
      statusListeners: new Set(),
      url: `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream`,
      lastEventAt: Date.now(),
      watchdog: null,
      reconnectTimer: null,
      reconnectAttempt: 0,
    };
    dashboardStreams.set(tournamentId, entry);
    connectDashboardStream(tournamentId, entry);
    ensureDashboardWatchdog(tournamentId, entry);
  }

  entry.refs += 1;
  entry.listeners.add(onMessage);
  if (onStatus) entry.statusListeners.add(onStatus);
  if (entry.es?.readyState === EventSource.OPEN) {
    onStatus?.("connected");
  } else {
    onStatus?.("reconnecting");
  }

  return () => {
    const current = dashboardStreams.get(tournamentId);
    if (!current) return;
    current.listeners.delete(onMessage);
    if (onStatus) current.statusListeners.delete(onStatus);
    current.refs -= 1;
    if (current.refs <= 0) {
      if (current.watchdog) clearInterval(current.watchdog);
      if (current.reconnectTimer) clearTimeout(current.reconnectTimer);
      destroyDashboardEs(current);
      dashboardStreams.delete(tournamentId);
    }
  };
}

/**
 * Tournament-scoped SSE liveness for Mission Control / Venue / OBS / match lists.
 * Healthy → poll OFF. Reconnecting/disconnected → temporary poll OK.
 */
export function useBadmintonTournamentStreamStatus(
  tournamentId: number,
): ScoringConnectionStatus {
  const [status, setStatus] = useState<ScoringConnectionStatus>("reconnecting");

  useEffect(() => {
    if (!tournamentId) return;
    return subscribeBadmintonDashboardStream(
      tournamentId,
      () => {
        /* status-only subscriber */
      },
      setStatus,
    );
  }, [tournamentId]);

  return status;
}

/** Shared fallback poll while tournament SSE is not connected. */
export const BADMINTON_MATCHES_RECONNECT_POLL_MS = SSE_RECONNECT_POLL_MS;

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
    return subscribeBadmintonDashboardStream(tournamentId, (payload) => {
      const data =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;
      // Scores / presentation must not refetch dashboard + categories + tournament.
      if (data && isMatchStateChangedPayload(data)) return;
      if (data && isPresentationPayload(data)) return;
      if (data && !shouldRefetchBadmintonMatches(data)) return;
      void queryClient.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["badminton-categories", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
    });
  }, [tournamentId, queryClient]);

  return query;
}
