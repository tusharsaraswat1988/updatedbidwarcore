import { useMemo } from "react";
import { useSearch } from "wouter";

/**
 * Detect OBS Browser Source or explicit ?obs=1 for performance tuning.
 */
export function useObsBrowserSource(): boolean {
  const search = useSearch();
  return useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(search);
    if (params.get("obs") === "1") return true;
    const ua = navigator.userAgent ?? "";
    return /OBS|CEF/i.test(ua);
  }, [search]);
}
