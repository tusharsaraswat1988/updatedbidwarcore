import { useState, useEffect, useCallback, useRef } from "react";

/** Countdown shown before auto sign-out (default 90 seconds). */
export const IDLE_WARNING_MS = 90 * 1000;

const LAST_ACTIVITY_KEY = "bidwar:last_activity_ts";

type SyncMessage =
  | { type: "warning"; endAt: number }
  | { type: "continue" }
  | { type: "lock" };

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcast(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!broadcastChannel) broadcastChannel = new BroadcastChannel("bidwar_inactivity");
  return broadcastChannel;
}

function touchActivity(): number {
  const ts = Date.now();
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
  } catch {
    /* private browsing / quota */
  }
  return ts;
}

function readLastActivity(): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return Date.now();
}

function clearTimeoutRef(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) clearTimeout(ref.current);
  ref.current = null;
}

function clearIntervalRef(ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (ref.current) clearInterval(ref.current);
  ref.current = null;
}

type UseInactivityLockOptions = {
  enabled: boolean;
  /** Total idle time before lock (ms). */
  timeoutMs: number;
  /** Countdown shown before lock (ms). Default 90s. */
  warningMs?: number;
};

/**
 * Tracks inactivity across tabs. Shows a warning countdown when `warningMs` remain,
 * then locks unless the user clicks Continue (which resets the full idle timer).
 */
export function useInactivityLock({
  enabled,
  timeoutMs,
  warningMs = IDLE_WARNING_MS,
}: UseInactivityLockOptions) {
  const [locked, setLocked] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(0);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningEndRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearAllTimers = useCallback(() => {
    clearTimeoutRef(warningTimerRef);
    clearIntervalRef(countdownRef);
  }, []);

  const runCountdownInterval = useCallback(() => {
    clearIntervalRef(countdownRef);
    countdownRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((warningEndRef.current - Date.now()) / 1000));
      setWarningSecondsLeft(left);
      if (left <= 0) {
        clearAllTimers();
        setWarningVisible(false);
        setLocked(true);
        getBroadcast()?.postMessage({ type: "lock" } satisfies SyncMessage);
      }
    }, 250);
  }, [clearAllTimers]);

  const startWarningCountdown = useCallback(
    (endAt?: number) => {
      if (!enabledRef.current) return;

      const effectiveWarning = Math.min(warningMs, timeoutMs);
      const end = endAt ?? Date.now() + effectiveWarning;
      warningEndRef.current = end;
      setWarningVisible(true);
      setWarningSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
      runCountdownInterval();

      if (endAt === undefined) {
        getBroadcast()?.postMessage({ type: "warning", endAt: end } satisfies SyncMessage);
      }
    },
    [warningMs, timeoutMs, runCountdownInterval],
  );

  const scheduleWarning = useCallback(() => {
    clearAllTimers();
    setWarningVisible(false);
    if (!enabledRef.current) return;

    const effectiveWarning = Math.min(warningMs, timeoutMs);
    const idleBudget = timeoutMs - effectiveWarning;
    const idleMs = Date.now() - readLastActivity();
    const delay = Math.max(0, idleBudget - idleMs);

    warningTimerRef.current = setTimeout(() => startWarningCountdown(), delay);
  }, [timeoutMs, warningMs, clearAllTimers, startWarningCountdown]);

  const continueSession = useCallback(() => {
    touchActivity();
    setLocked(false);
    setWarningVisible(false);
    clearAllTimers();
    scheduleWarning();
    getBroadcast()?.postMessage({ type: "continue" } satisfies SyncMessage);
  }, [clearAllTimers, scheduleWarning]);

  const unlock = useCallback(() => {
    touchActivity();
    setLocked(false);
    scheduleWarning();
  }, [scheduleWarning]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      setWarningVisible(false);
      setLocked(false);
    }
  }, [enabled, clearAllTimers]);

  useEffect(() => {
    if (!enabled || locked || warningVisible) return;

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
    const handler = () => {
      touchActivity();
      scheduleWarning();
    };

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    touchActivity();
    scheduleWarning();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearAllTimers();
    };
  }, [enabled, locked, warningVisible, scheduleWarning, clearAllTimers]);

  // Activity in another tab resets the idle timer here too.
  useEffect(() => {
    if (!enabled) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== LAST_ACTIVITY_KEY) return;
      if (locked || warningVisible) return;
      scheduleWarning();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled, locked, warningVisible, scheduleWarning]);

  // Mirror warning / continue / lock across tabs.
  useEffect(() => {
    const bc = getBroadcast();
    if (!bc) return;

    const onMessage = (e: MessageEvent<SyncMessage>) => {
      const msg = e.data;
      if (!msg?.type) return;

      if (msg.type === "warning") {
        if (!enabledRef.current || msg.endAt <= Date.now()) return;
        clearAllTimers();
        startWarningCountdown(msg.endAt);
      } else if (msg.type === "continue") {
        if (!enabledRef.current) return;
        setLocked(false);
        setWarningVisible(false);
        clearAllTimers();
        scheduleWarning();
      } else if (msg.type === "lock") {
        if (!enabledRef.current) return;
        clearAllTimers();
        setWarningVisible(false);
        setLocked(true);
      }
    };

    bc.addEventListener("message", onMessage);
    return () => bc.removeEventListener("message", onMessage);
  }, [clearAllTimers, scheduleWarning, startWarningCountdown]);

  return {
    locked,
    warningVisible,
    warningSecondsLeft,
    continueSession,
    unlock,
  };
}
