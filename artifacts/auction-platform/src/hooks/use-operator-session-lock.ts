import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_MS = 2_000;
// Maximum time to keep retrying acquire before surfacing a hard "locked" state.
const ACQUIRE_MAX_RETRIES = 5;
const ACQUIRE_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];

function createTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postLock(
  tournamentId: number,
  action: "acquire" | "heartbeat" | "release" | "takeover",
  tabId: string,
): Promise<{ acquired?: boolean; ok?: boolean; holderTabId?: string | null }> {
  const res = await fetch(`/api/tournaments/${tournamentId}/auction/operator-lock/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tabId }),
  });
  if (!res.ok) {
    throw new Error(`operator-lock ${action} failed: ${res.status}`);
  }
  return res.json();
}

export type LockStatus =
  | "acquiring"   // initial acquire in progress
  | "retrying"    // acquire failed, retrying with backoff
  | "controller"  // this tab holds the lock
  | "locked"      // another tab holds the lock (read-only)
  | "unknown";    // lock state not yet determined

/**
 * Server heartbeat lock — only one operator tab controls a tournament at a time.
 *
 * PHASE 4 CHANGES:
 * - Fails CLOSED on network error (no longer fails open).
 * - Retries acquire with exponential backoff up to ACQUIRE_MAX_RETRIES times.
 * - Exposes `takeover()` for explicit "Take Over" flow.
 * - Exposes `lockStatus` for nuanced UI feedback.
 */
export function useOperatorSessionLock(tournamentId: number) {
  const tabIdRef = useRef<string>(createTabId());
  const [lockStatus, setLockStatus] = useState<LockStatus>("acquiring");
  const acquireAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isController = lockStatus === "controller";
  const lockReady = lockStatus === "controller" || lockStatus === "locked";
  const readOnly = lockReady && !isController;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Exposed takeover function — called only after the operator confirms in the UI.
  // Uses the /takeover route which force-displaces the current holder.
  const takeover = useCallback(async () => {
    try {
      const data = await postLock(tournamentId, "takeover", tabIdRef.current);
      if (data.acquired) {
        setLockStatus("controller");
        acquireAttemptRef.current = 0;
      }
    } catch {
      // Takeover failed — remain locked; operator can retry.
    }
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;

    let cancelled = false;
    const tabId = tabIdRef.current;
    acquireAttemptRef.current = 0;
    setLockStatus("acquiring");

    function scheduleAcquireRetry() {
      const attempt = acquireAttemptRef.current;
      if (attempt >= ACQUIRE_MAX_RETRIES) {
        // Exhausted retries — fail closed: do NOT grant control.
        if (!cancelled) setLockStatus("locked");
        return;
      }
      const delay = ACQUIRE_RETRY_DELAYS_MS[attempt] ?? ACQUIRE_RETRY_DELAYS_MS[ACQUIRE_RETRY_DELAYS_MS.length - 1];
      acquireAttemptRef.current = attempt + 1;
      if (!cancelled) setLockStatus("retrying");
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) void acquire();
      }, delay);
    }

    async function acquire() {
      try {
        const data = await postLock(tournamentId, "acquire", tabId);
        if (cancelled) return;
        if (data.acquired) {
          setLockStatus("controller");
          acquireAttemptRef.current = 0;
        } else {
          setLockStatus("locked");
        }
      } catch {
        if (cancelled) return;
        // Network error: fail CLOSED — do not grant control. Retry with backoff.
        scheduleAcquireRetry();
      }
    }

    void acquire();

    const heartbeat = setInterval(() => {
      void postLock(tournamentId, "heartbeat", tabId)
        .then((data) => {
          if (cancelled) return;
          if (data.ok) {
            setLockStatus("controller");
          } else {
            // Server says we no longer hold the lock (TTL expired or displaced).
            setLockStatus("locked");
          }
        })
        .catch(() => {
          // Transient heartbeat failure: keep last known state but do NOT promote
          // from locked → controller. A controller stays controller across brief
          // network glitches; a locked tab stays locked.
        });
    }, HEARTBEAT_MS);

    const onUnload = () => {
      void postLock(tournamentId, "release", tabId);
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      clearRetryTimer();
      window.removeEventListener("beforeunload", onUnload);
      void postLock(tournamentId, "release", tabId);
    };
  }, [tournamentId, clearRetryTimer]);

  return {
    isController,
    readOnly,
    lockReady,
    lockStatus,
    takeover,
    tabId: tabIdRef.current,
  };
}
