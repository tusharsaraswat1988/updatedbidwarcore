import { useState, useEffect, useCallback, useRef } from "react";

const INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Tracks user activity on the page. After INACTIVITY_MS of no interaction,
 * sets `locked = true`. Call `unlock()` to dismiss the lock and reset the timer.
 *
 * Only active when `enabled` is true (i.e. admin is logged in).
 */
export function useInactivityLock(enabled: boolean) {
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLocked(true), INACTIVITY_MS);
  }, []);

  const unlock = useCallback(() => {
    setLocked(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;
    const handler = () => { if (!locked) resetTimer(); };

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, locked, resetTimer]);

  return { locked, unlock };
}
