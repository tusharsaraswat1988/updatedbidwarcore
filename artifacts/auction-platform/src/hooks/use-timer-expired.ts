import { useEffect, useState } from "react";

/**
 * Returns whether a server-authoritative timer has expired.
 *
 * Uses a SINGLE setTimeout (no interval) — the boolean flips from
 * false → true exactly once when the server's `timerEndsAt` instant is
 * reached. Use this for parent-level gating (canBid, isExpired branches)
 * so the parent does NOT rerender every 250ms during countdown.
 *
 * For the visible ticking number, use <ServerCountdown /> which owns its
 * own interval inside an isolated memoized subtree.
 *
 *  - timerEndsAt null/undefined → false
 *  - already past         → true (flips synchronously on mount/dep change)
 *  - still in the future  → false, then true once the timer fires
 */
export function useTimerExpired(timerEndsAt: string | null | undefined): boolean {
  const [expired, setExpired] = useState<boolean>(() => {
    if (!timerEndsAt) return false;
    return new Date(timerEndsAt).getTime() <= Date.now();
  });

  useEffect(() => {
    if (!timerEndsAt) {
      setExpired(false);
      return;
    }
    const remainingMs = new Date(timerEndsAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      setExpired(true);
      return;
    }
    setExpired(false);
    const id = setTimeout(() => setExpired(true), remainingMs);
    return () => clearTimeout(id);
  }, [timerEndsAt]);

  return expired;
}
