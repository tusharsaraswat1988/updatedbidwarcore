/**
 * Minimal browser API helpers — import this instead of the api-base barrel
 * when you only need fetch/URL helpers (avoids pulling auction/bid modules).
 */

export const API_PREFIX = "/api";

/**
 * Resolve a path for browser fetch/EventSource.
 * Accepts `/auth/...` (appends API_PREFIX) or `/api/...` (unchanged).
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`apiUrl: path must start with / (got: ${path})`);
  }
  if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
    return path;
  }
  return `${API_PREFIX}${path}`;
}

export type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

/**
 * Cookie-authenticated JSON API helper (browser / Vite dev with proxy).
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const { json, headers: headersInit, ...init } = options;
  const headers = new Headers(headersInit);
  if (json !== undefined) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers,
      body: JSON.stringify(json),
    });
  }
  if (!headers.has("content-type") && init.body && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}
