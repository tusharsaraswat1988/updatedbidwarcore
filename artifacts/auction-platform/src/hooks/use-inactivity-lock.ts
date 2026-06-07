import { useState, useEffect, useCallback, useRef } from "react";

const DEFAULT_WARNING_MS = 60 * 1000;

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
  /** Countdown shown before lock (ms). Default 60s. */
  warningMs?: number;
};

/**
 * Tracks admin inactivity. Shows a warning countdown when `warningMs` remain,
 * then locks unless the user clicks Continue (which resets the full idle timer).
 */
export function useInactivityLock({
  enabled,
  timeoutMs,
  warningMs = DEFAULT_WARNING_MS,
}: UseInactivityLockOptions) {
  const [locked, setLocked] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(0);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningEndRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    clearTimeoutRef(warningTimerRef);
    clearIntervalRef(countdownRef);
  }, []);

  const startWarningCountdown = useCallback(() => {
    const effectiveWarning = Math.min(warningMs, timeoutMs);
    setWarningVisible(true);
    warningEndRef.current = Date.now() + effectiveWarning;
    setWarningSecondsLeft(Math.ceil(effectiveWarning / 1000));

    clearIntervalRef(countdownRef);
    countdownRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((warningEndRef.current - Date.now()) / 1000));
      setWarningSecondsLeft(left);
      if (left <= 0) {
        clearAllTimers();
        setWarningVisible(false);
        setLocked(true);
      }
    }, 250);
  }, [warningMs, timeoutMs, clearAllTimers]);

  const scheduleWarning = useCallback(() => {
    clearAllTimers();
    setWarningVisible(false);
    if (!enabled) return;

    const delay = Math.max(0, timeoutMs - Math.min(warningMs, timeoutMs));
    warningTimerRef.current = setTimeout(startWarningCountdown, delay);
  }, [enabled, timeoutMs, warningMs, clearAllTimers, startWarningCountdown]);

  const continueSession = useCallback(() => {
    setLocked(false);
    setWarningVisible(false);
    scheduleWarning();
  }, [scheduleWarning]);

  const unlock = useCallback(() => {
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
    const handler = () => scheduleWarning();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    scheduleWarning();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      // Only clear the idle timer — not the warning countdown interval.
      clearTimeoutRef(warningTimerRef);
    };
  }, [enabled, locked, warningVisible, scheduleWarning]);

  return {
    locked,
    warningVisible,
    warningSecondsLeft,
    continueSession,
    unlock,
  };
}
