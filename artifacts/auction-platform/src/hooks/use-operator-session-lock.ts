import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_MS = 2_000;

function createTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postLock(
  tournamentId: number,
  action: "acquire" | "heartbeat" | "release",
  tabId: string,
): Promise<{ acquired?: boolean; ok?: boolean; holderTabId?: string | null }> {
  const res = await fetch(`/api/tournaments/${tournamentId}/auction/operator-lock/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tabId }),
  });
  if (!res.ok) {
    throw new Error(`operator-lock ${action} failed`);
  }
  return res.json();
}

/**
 * Server heartbeat lock — only one operator tab controls a tournament at a time.
 * Second tab enters read-only mode until the controller releases or times out.
 */
export function useOperatorSessionLock(tournamentId: number) {
  const tabIdRef = useRef<string>(createTabId());
  const [isController, setIsController] = useState(false);
  const [lockReady, setLockReady] = useState(false);

  const syncLockState = useCallback(
    (acquired: boolean) => {
      setIsController(acquired);
      setLockReady(true);
    },
    [],
  );

  useEffect(() => {
    if (!tournamentId) return;

    let cancelled = false;
    const tabId = tabIdRef.current;

    async function acquire() {
      try {
        const data = await postLock(tournamentId, "acquire", tabId);
        if (!cancelled) syncLockState(!!data.acquired);
      } catch {
        // Fail open so a network blip does not block the auctioneer entirely.
        if (!cancelled) syncLockState(true);
      }
    }

    void acquire();

    const heartbeat = setInterval(() => {
      void postLock(tournamentId, "heartbeat", tabId)
        .then((data) => {
          if (!cancelled) syncLockState(!!data.ok);
        })
        .catch(() => {
          /* keep last known state on transient errors */
        });
    }, HEARTBEAT_MS);

    const onUnload = () => {
      void postLock(tournamentId, "release", tabId);
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", onUnload);
      void postLock(tournamentId, "release", tabId);
    };
  }, [tournamentId, syncLockState]);

  const readOnly = lockReady && !isController;

  return {
    isController,
    readOnly,
    lockReady,
    tabId: tabIdRef.current,
  };
}
