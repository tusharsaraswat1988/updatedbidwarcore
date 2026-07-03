import { BASE_URL } from "./page-meta.js";

/** Query parameters stripped from canonical URLs (tracking / session noise). */
const STRIPPED_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "ref",
  "v",
]);

/**
 * Build a self-referential canonical URL from a pathname.
 * Strips query parameters and hash; normalizes trailing slashes (except homepage).
 */
export function buildCanonical(pathname: string, origin: string = BASE_URL): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath, origin);
  url.hash = "";

  if (url.search) {
    const kept = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (!STRIPPED_QUERY_KEYS.has(key.toLowerCase())) {
        kept.set(key, value);
      }
    }
    url.search = kept.toString() ? `?${kept.toString()}` : "";
  }

  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/**
 * Clamp a lastmod date so it never exceeds the current UTC calendar day.
 * Returns YYYY-MM-DD or undefined when input is invalid.
 */
export function safeLastmod(input: string | Date | undefined | null): string | undefined {
  if (!input) return undefined;

  const parsed = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;

  const now = new Date();
  const capped = parsed > now ? now : parsed;
  return capped.toISOString().slice(0, 10);
}
