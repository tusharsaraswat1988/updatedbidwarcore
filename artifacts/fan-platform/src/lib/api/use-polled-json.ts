import { useEffect, useState } from "react";

/**
 * Read-only poll for public fan endpoints.
 * The API already serves auction state and scoring snapshots from cache,
 * so the page stays a spectator and never opens a write channel.
 */
export function usePolledJson<T>(url: string | null, intervalMs = 4000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        const json = (await response.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Live data is unavailable right now.");
          setLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [url, intervalMs]);

  return { data, error, loading };
}
