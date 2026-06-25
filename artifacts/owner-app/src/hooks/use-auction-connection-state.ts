import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS,
  getRecordedAuctionActivity,
  parseActivityTimestamp,
  recordAuctionActivity,
  resolveAuctionFeedState,
  type AuctionFeedState,
  type AuctionSocketStatus,
} from "@workspace/api-base/auction-connection-state";

export type { AuctionFeedState, AuctionSocketStatus };

export function useAuctionConnectionState(
  connectionStatus: AuctionSocketStatus,
  tournamentId: number,
  lastActivityAtFromState?: string | null,
  options?: {
    awaitingThresholdMs?: number;
    tickMs?: number;
  },
) {
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastActivityAtFromState) return;
    const parsed = parseActivityTimestamp(lastActivityAtFromState);
    if (parsed == null) return;
    recordAuctionActivity(tournamentId, parsed);
    setLastActivityAt((prev) => (prev == null || parsed > prev ? parsed : prev));
  }, [tournamentId, lastActivityAtFromState]);

  useEffect(() => {
    const tickMs = options?.tickMs ?? 2000;
    const id = setInterval(() => {
      setNow(Date.now());
      const recorded = getRecordedAuctionActivity(tournamentId);
      if (recorded == null) return;
      setLastActivityAt((prev) => (prev == null || recorded > prev ? recorded : prev));
    }, tickMs);
    return () => clearInterval(id);
  }, [tournamentId, options?.tickMs]);

  return useMemo(
    () =>
      resolveAuctionFeedState({
        connectionStatus,
        lastActivityAt,
        now,
        awaitingThresholdMs: options?.awaitingThresholdMs ?? DEFAULT_AWAITING_OPERATOR_THRESHOLD_MS,
      }),
    [connectionStatus, lastActivityAt, now, options?.awaitingThresholdMs],
  );
}
