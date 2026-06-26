export type SseConnectionStatus = "connected" | "reconnecting" | "disconnected";

/**
 * When SSE is connected, React Query polling is redundant — SSE + setQueryData
 * is the primary sync path. Polling runs only as an offline fallback.
 */
export function sseAwareRefetchInterval(
  connectionStatus: SseConnectionStatus,
  fallbackMs: number,
): number | false {
  return connectionStatus === "connected" ? false : fallbackMs;
}
