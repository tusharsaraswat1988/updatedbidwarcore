import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_MS = 2_000;
const PEER_PROBE_MS = 400;
const STALE_LOCK_RETRY_MS = 1_500;
// Maximum time to keep retrying acquire before surfacing a hard unavailable state.
const ACQUIRE_MAX_RETRIES = 5;
const ACQUIRE_RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];

function tabIdStorageKey(tournamentId: number): string {
  return `operator-lock-tab:${tournamentId}`;
}

function createTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Stable per browser tab + tournament — survives remounts when navigating panels. */
function getOrCreateTabId(tournamentId: number): string {
  if (!tournamentId) return createTabId();
  try {
    const key = tabIdStorageKey(tournamentId);
    const existing = sessionStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
    const id = createTabId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return createTabId();
  }
}

function operatorLockChannel(tournamentId: number): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(`auction-operator-lock:${tournamentId}`);
}

/** Returns true when another live operator tab in this browser responds. */
async function detectPeerOperatorTab(tournamentId: number, tabId: string): Promise<boolean> {
  const channel = operatorLockChannel(tournamentId);
  if (!channel) return false;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (hasPeer: boolean) => {
      if (settled) return;
      settled = true;
      channel.removeEventListener("message", onMessage);
      channel.close();
      resolve(hasPeer);
    };

    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; tabId?: string } | null;
      if (
        (msg?.type === "pong" || msg?.type === "heartbeat") &&
        msg.tabId &&
        msg.tabId !== tabId
      ) {
        finish(true);
      }
    };

    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "ping", tabId });
    window.setTimeout(() => finish(false), PEER_PROBE_MS);
  });
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
  | "unavailable" // could not confirm lock (network) — read-only, no "other tab" claim
  | "unknown";    // lock state not yet determined

/**
 * Server heartbeat lock — only one operator tab controls a tournament at a time.
 *
 * - tabId is persisted in sessionStorage so remounts (panel navigation, HMR) reuse
 *   the same session instead of falsely appearing as a second operator tab.
 * - Lock is released only on page hide/unload — never on React effect cleanup —
 *   so Strict Mode remounts and in-app navigation cannot drop a live controller.
 * - Generation tokens ignore stale peer-probe results that would otherwise flip a
 *   healthy controller into read-only when a second tab is open.
 */
export function useOperatorSessionLock(tournamentId: number) {
  const tabIdRef = useRef<string>(getOrCreateTabId(tournamentId));
  const [lockStatus, setLockStatus] = useState<LockStatus>("acquiring");
  const acquireAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerChannelRef = useRef<BroadcastChannel | null>(null);
  /** Bumps on every lock transition attempt so stale async probes cannot regress state. */
  const lockGenRef = useRef(0);

  const isController = lockStatus === "controller";
  const lockReady =
    lockStatus === "controller" ||
    lockStatus === "locked" ||
    lockStatus === "unavailable";
  const readOnly = lockReady && !isController;

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current != null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const becomeController = useCallback((gen: number) => {
    if (gen !== lockGenRef.current) return;
    setLockStatus("controller");
    acquireAttemptRef.current = 0;
  }, []);

  const takeover = useCallback(async () => {
    const gen = ++lockGenRef.current;
    try {
      const data = await postLock(tournamentId, "takeover", tabIdRef.current);
      if (data.acquired) {
        becomeController(gen);
      }
    } catch {
      // Takeover failed — remain locked; operator can retry.
    }
  }, [tournamentId, becomeController]);

  useEffect(() => {
    tabIdRef.current = getOrCreateTabId(tournamentId);
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;

    let cancelled = false;
    const tabId = tabIdRef.current;
    acquireAttemptRef.current = 0;
    const effectGen = ++lockGenRef.current;
    setLockStatus("acquiring");

    const channel = operatorLockChannel(tournamentId);
    peerChannelRef.current = channel;

    const onPeerMessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; tabId?: string } | null;
      if (msg?.type === "ping" && msg.tabId && msg.tabId !== tabId) {
        channel?.postMessage({ type: "pong", tabId });
      }
    };
    channel?.addEventListener("message", onPeerMessage);

    const peerAnnounce = setInterval(() => {
      channel?.postMessage({ type: "heartbeat", tabId });
    }, HEARTBEAT_MS);

    function scheduleAcquireRetry() {
      const attempt = acquireAttemptRef.current;
      if (attempt >= ACQUIRE_MAX_RETRIES) {
        if (!cancelled && effectGen === lockGenRef.current) {
          setLockStatus("unavailable");
        }
        return;
      }
      const delay = ACQUIRE_RETRY_DELAYS_MS[attempt] ?? ACQUIRE_RETRY_DELAYS_MS[ACQUIRE_RETRY_DELAYS_MS.length - 1];
      acquireAttemptRef.current = attempt + 1;
      if (!cancelled && effectGen === lockGenRef.current) {
        setLockStatus("retrying");
      }
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) void acquire();
      }, delay);
    }

    function scheduleStaleLockRetry() {
      clearRetryTimer();
      if (!cancelled && effectGen === lockGenRef.current) {
        setLockStatus("acquiring");
      }
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) void acquire();
      }, STALE_LOCK_RETRY_MS);
    }

    async function handleAcquireDenied(gen: number) {
      // Re-check the server before trusting a peer probe — a prior mount with the
      // same tabId may still own the lock, or a stale lock may be reclaimable.
      try {
        const retry = await postLock(tournamentId, "acquire", tabId);
        if (cancelled || gen !== lockGenRef.current) return;
        if (retry.acquired) {
          becomeController(gen);
          return;
        }
      } catch {
        if (cancelled || gen !== lockGenRef.current) return;
        scheduleAcquireRetry();
        return;
      }

      const hasPeer = await detectPeerOperatorTab(tournamentId, tabId);
      if (cancelled || gen !== lockGenRef.current) return;
      if (hasPeer) {
        setLockStatus("locked");
      } else {
        // Stale server lock (e.g. prior closed tab) — retry quietly.
        scheduleStaleLockRetry();
      }
    }

    async function acquire() {
      const gen = lockGenRef.current;
      try {
        const data = await postLock(tournamentId, "acquire", tabId);
        if (cancelled || gen !== lockGenRef.current) return;
        if (data.acquired) {
          becomeController(gen);
        } else {
          await handleAcquireDenied(gen);
        }
      } catch {
        if (cancelled || gen !== lockGenRef.current) return;
        scheduleAcquireRetry();
      }
    }

    void acquire();

    const heartbeat = setInterval(() => {
      const gen = lockGenRef.current;
      void postLock(tournamentId, "heartbeat", tabId)
        .then(async (data) => {
          if (cancelled || gen !== lockGenRef.current) return;
          if (data.ok) {
            becomeController(gen);
            return;
          }
          // Lost the lock — try reclaim once, then fall back to peer/stale handling.
          await handleAcquireDenied(gen);
        })
        .catch(() => {
          // Transient heartbeat failure: keep last known state.
        });
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Release only when the tab is actually going away — not on React remounts.
    const releaseLock = () => {
      void postLock(tournamentId, "release", tabId);
    };
    window.addEventListener("pagehide", releaseLock);
    window.addEventListener("beforeunload", releaseLock);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      clearInterval(peerAnnounce);
      clearRetryTimer();
      channel?.removeEventListener("message", onPeerMessage);
      channel?.close();
      peerChannelRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", releaseLock);
      window.removeEventListener("beforeunload", releaseLock);
      // Intentionally do NOT release here: Strict Mode / panel remounts reuse the
      // same tabId and must keep holding the server lock as the controller.
    };
  }, [tournamentId, clearRetryTimer, becomeController]);

  return {
    isController,
    readOnly,
    lockReady,
    lockStatus,
    takeover,
    tabId: tabIdRef.current,
  };
}
