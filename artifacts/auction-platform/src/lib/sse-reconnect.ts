const MAX_RECONNECT_MS = 30_000;
const BASE_RECONNECT_MS = 1_000;

/** Exponential backoff with jitter: 1s → 2s → 4s → … capped at 30s. */
export function nextSseReconnectDelayMs(attempt: number): number {
  const cappedAttempt = Math.min(attempt, 5);
  const base = Math.min(MAX_RECONNECT_MS, BASE_RECONNECT_MS * Math.pow(2, cappedAttempt));
  const jitter = Math.floor(Math.random() * base * 0.25);
  return base + jitter;
}
