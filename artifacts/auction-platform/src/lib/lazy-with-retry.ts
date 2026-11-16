import { lazy, type ComponentType } from "react";

interface LazyRetryOptions {
  retries?: number;
  interval?: number;
}

const CHUNK_RELOAD_STORAGE_KEY = "bidwar_chunk_reload_ts";
const RELOAD_THROTTLE_MS = 12_000;

/**
 * Checks whether an error is caused by a failed dynamic import (stale build chunk or network drop).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("unable to preload") ||
    message.includes("failed to resolve module")
  );
}

/**
 * Safely reloads the page once to retrieve fresh build assets, protected against reload loops.
 */
export function reloadForFreshVersion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || "0");
    const now = Date.now();
    if (now - lastReload > RELOAD_THROTTLE_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
      window.location.reload();
      return true;
    }
  } catch {
    // SessionStorage may be restricted; fallback to direct reload
    window.location.reload();
    return true;
  }
  return false;
}

/**
 * Enhanced React.lazy with automatic in-memory retries and version-mismatch recovery.
 *
 * If a dynamic import fails due to a network glitch:
 * 1. Retries the import with backoff (default 2 retries, 800ms initial interval).
 * 2. If retries fail and the error is a ChunkLoad / stale module error, seamlessly reloads
 *    the page once to download the latest deployment's index.html and fresh chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: LazyRetryOptions = {},
) {
  const { retries = 2, interval = 800 } = options;

  return lazy(async () => {
    let attempt = 0;
    while (true) {
      try {
        return await factory();
      } catch (error) {
        attempt++;
        const isChunkError = isChunkLoadError(error);

        if (attempt <= retries) {
          await new Promise((resolve) => setTimeout(resolve, interval * attempt));
          continue;
        }

        // Retries exhausted — if this is a chunk failure (e.g. new deployment), reload page
        if (isChunkError && typeof window !== "undefined") {
          const reloaded = reloadForFreshVersion();
          if (reloaded) {
            // Keep suspended until the reload takes effect
            return new Promise<{ default: T }>(() => {});
          }
        }

        throw error;
      }
    }
  });
}
