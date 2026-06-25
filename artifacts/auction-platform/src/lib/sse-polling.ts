import type { ConnectionStatus } from "@/hooks/use-auction-socket";

/**
 * When SSE is connected, React Query polling is redundant — SSE + setQueryData
 * is the primary sync path. Polling runs only as an offline fallback.
 */
export function sseAwareRefetchInterval(
  connectionStatus: ConnectionStatus,
  fallbackMs: number,
): number | false {
  return connectionStatus === "connected" ? false : fallbackMs;
}
