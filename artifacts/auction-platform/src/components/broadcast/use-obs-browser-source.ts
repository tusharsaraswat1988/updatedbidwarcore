import { useMemo } from "react";

/**
 * Detect OBS Browser Source or explicit ?obs=1 for performance tuning.
 */
export function useObsBrowserSource(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("obs") === "1") return true;
    const ua = navigator.userAgent ?? "";
    return /OBS|CEF/i.test(ua);
  }, []);
}
