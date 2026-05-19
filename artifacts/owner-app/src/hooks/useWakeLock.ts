import { useEffect, useRef } from "react";

/**
 * Requests a Screen Wake Lock to prevent the device from sleeping.
 *
 * The lock is only active when `active` is true. It is automatically
 * re-acquired whenever the page becomes visible again (browsers release
 * wake locks when the tab is backgrounded).
 *
 * Silently no-ops on browsers that don't support the Wake Lock API
 * (older Android WebView, Firefox < 126, etc.).
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  async function acquire() {
    if (!("wakeLock" in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Permission denied or not supported — silently ignore
    }
  }

  function release() {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }

  // Acquire / release based on `active` flag
  useEffect(() => {
    if (!active) { release(); return; }
    void acquire();
    return () => { release(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Re-acquire after the page becomes visible (browser drops the lock on hide)
  useEffect(() => {
    if (!active) return;

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void acquire();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
