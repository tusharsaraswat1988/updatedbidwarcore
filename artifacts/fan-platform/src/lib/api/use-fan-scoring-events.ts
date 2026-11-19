import { useEffect, useState } from "react";

/**
 * Read-only fan subscriber for the public scoring stream:
 * GET /api/tournaments/:id/scoring/events
 *
 * Frames used: scoring_state (authoritative snapshot) and scoring_replay
 * (sequence catch-up). OBS director frames are ignored.
 */

export type FanScoringConnection = "connecting" | "connected" | "reconnecting" | "disconnected";

export type FanScoringDisplay = {
  match: Record<string, unknown> | null;
  state: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  sequence: number | null;
};

type Listener = (display: FanScoringDisplay | null) => void;
type StatusListener = (status: FanScoringConnection) => void;

type Pool = {
  tournamentId: number;
  listeners: Set<Listener>;
  statusListeners: Set<StatusListener>;
  es: EventSource | null;
  lastSeq: number;
  snapshot: FanScoringDisplay | null;
  status: FanScoringConnection;
  retry: number | null;
  disconnectTimer: number | null;
  gapFrom: number | null;
  fallbackUsed: boolean;
};

const pools = new Map<number, Pool>();

export function sequenceOf(message: Record<string, unknown>, frameId?: string): number | null {
  if (typeof message.sequence === "number" && Number.isFinite(message.sequence)) return message.sequence;
  const state = message.state;
  if (state && typeof state === "object") {
    const last = (state as { lastSequence?: unknown }).lastSequence;
    if (typeof last === "number" && Number.isFinite(last)) return last;
  }
  if (frameId) {
    const parsed = parseInt(frameId, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** How a newly seen sequence relates to the last applied one. */
export function classifySequence(last: number, incoming: number | null): "accept" | "duplicate" | "stale" | "gap" | "first" {
  if (incoming == null) return last === 0 ? "first" : "accept";
  if (last === 0) return "first";
  if (incoming < last) return "stale";
  if (incoming === last) return "duplicate";
  if (incoming > last + 1) return "gap";
  return "accept";
}

function emit(pool: Pool) {
  for (const listener of pool.listeners) listener(pool.snapshot);
}

function setStatus(pool: Pool, status: FanScoringConnection) {
  pool.status = status;
  for (const listener of pool.statusListeners) listener(status);
}

function clearTimers(pool: Pool) {
  if (pool.retry != null) window.clearTimeout(pool.retry);
  if (pool.disconnectTimer != null) window.clearTimeout(pool.disconnectTimer);
  pool.retry = null;
  pool.disconnectTimer = null;
}

function applySnapshot(pool: Pool, message: Record<string, unknown>, frameId?: string) {
  const seq = sequenceOf(message, frameId);
  const kind = classifySequence(pool.lastSeq, seq);
  if (kind === "stale" || kind === "duplicate") return;
  pool.snapshot = {
    match: (message.match as Record<string, unknown> | null) ?? null,
    state: (message.state as Record<string, unknown> | null) ?? null,
    summary: (message.summary as Record<string, unknown> | null) ?? null,
    sequence: seq,
  };
  if (seq != null) pool.lastSeq = seq;
  pool.gapFrom = null;
  emit(pool);
}

function noteReplay(pool: Pool, message: Record<string, unknown>, frameId?: string) {
  const seq = sequenceOf(message, frameId);
  if (seq == null) return;
  const kind = classifySequence(pool.lastSeq, seq);
  if (kind === "stale" || kind === "duplicate") return;
  if (kind === "gap") {
    if (pool.gapFrom !== pool.lastSeq) {
      pool.gapFrom = pool.lastSeq;
      window.setTimeout(() => connect(pool), 0);
      return;
    }
    pool.lastSeq = seq;
    return;
  }
  pool.lastSeq = seq;
  pool.gapFrom = null;
}

function connect(pool: Pool) {
  if (pool.listeners.size === 0) return;
  clearTimers(pool);
  const previous = pool.es;
  pool.es = null;
  previous?.close();
  const url = pool.lastSeq > 0
    ? `/api/tournaments/${pool.tournamentId}/scoring/events?lastEventId=${pool.lastSeq}`
    : `/api/tournaments/${pool.tournamentId}/scoring/events`;
  const es = new EventSource(url);
  pool.es = es;
  setStatus(pool, pool.snapshot ? "reconnecting" : "connecting");

  const onState = (event: MessageEvent) => {
    if (pool.es !== es) return;
    clearTimers(pool);
    setStatus(pool, "connected");
    try {
      applySnapshot(pool, JSON.parse(event.data) as Record<string, unknown>, event.lastEventId);
    } catch {
      // Ignore a malformed frame. The next snapshot replaces it.
    }
  };

  const onReplay = (event: MessageEvent) => {
    if (pool.es !== es) return;
    clearTimers(pool);
    setStatus(pool, "connected");
    try {
      noteReplay(pool, JSON.parse(event.data) as Record<string, unknown>, event.lastEventId);
    } catch {
      // Replay frames only advance the sequence. A bad frame is skipped.
    }
  };

  es.addEventListener("scoring_state", onState);
  es.addEventListener("scoring_replay", onReplay);

  es.onerror = () => {
    if (pool.es !== es) return;
    es.close();
    if (pool.es === es) pool.es = null;
    setStatus(pool, "reconnecting");
    pool.disconnectTimer = window.setTimeout(() => {
      if (pool.status !== "connected") setStatus(pool, "disconnected");
    }, 5000);
    pool.retry = window.setTimeout(() => connect(pool), 3000);
  };
}

async function primeFromSnapshot(pool: Pool) {
  if (pool.fallbackUsed || pool.snapshot) return;
  pool.fallbackUsed = true;
  try {
    const response = await fetch(`/api/tournaments/${pool.tournamentId}/scoring/fan-live`);
    if (!response.ok || pool.snapshot) return;
    const body = await response.json() as Record<string, unknown>;
    applySnapshot(pool, { type: "scoring_state", ...body });
  } catch {
    // The stream remains the source of live updates.
  }
}

function acquire(tournamentId: number): Pool {
  let pool = pools.get(tournamentId);
  if (!pool) {
    pool = {
      tournamentId,
      listeners: new Set(),
      statusListeners: new Set(),
      es: null,
      lastSeq: 0,
      snapshot: null,
      status: "connecting",
      retry: null,
      disconnectTimer: null,
      gapFrom: null,
      fallbackUsed: false,
    };
    pools.set(tournamentId, pool);
  }
  return pool;
}

function release(tournamentId: number) {
  const pool = pools.get(tournamentId);
  if (!pool || pool.listeners.size > 0) return;
  clearTimers(pool);
  pool.es?.close();
  pool.es = null;
  pools.delete(tournamentId);
}

export function useFanScoringEvents(tournamentId: number, enabled: boolean) {
  const [display, setDisplay] = useState<FanScoringDisplay | null>(null);
  const [connection, setConnection] = useState<FanScoringConnection>("connecting");

  useEffect(() => {
    if (!enabled || tournamentId <= 0) {
      setDisplay(null);
      setConnection("disconnected");
      return;
    }

    const pool = acquire(tournamentId);
    const onDisplay = (next: FanScoringDisplay | null) => setDisplay(next);
    const onStatus = (next: FanScoringConnection) => setConnection(next);
    pool.listeners.add(onDisplay);
    pool.statusListeners.add(onStatus);
    setDisplay(pool.snapshot);
    setConnection(pool.status);
    if (!pool.es && pool.retry == null) connect(pool);

    const fallback = window.setTimeout(() => primeFromSnapshot(pool), 8000);

    return () => {
      window.clearTimeout(fallback);
      pool.listeners.delete(onDisplay);
      pool.statusListeners.delete(onStatus);
      release(tournamentId);
    };
  }, [tournamentId, enabled]);

  return { display, connection };
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __bidwarFanScoring?: Map<number, Pool> }).__bidwarFanScoring = pools;
}
