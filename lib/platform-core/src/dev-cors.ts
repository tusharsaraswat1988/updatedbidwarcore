/**
 * CORS helpers for local development and production allowlists.
 *
 * In development, any http loopback origin (localhost / 127.0.0.1, any port) is
 * allowed so Vite can bind to dynamic ports. Production uses only explicit origins.
 */

/** http://localhost[:port] or http://127.0.0.1[:port] — port optional (default 80). */
const DEV_LOOPBACK_ORIGIN =
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/** True for http loopback origins with any TCP port (development only). */
export function isDevLocalhostOrigin(origin: string): boolean {
  return DEV_LOOPBACK_ORIGIN.test(normalizeOrigin(origin));
}

export function parseOriginList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
}

/**
 * Extra development origins from EXTRA_CORS_ORIGINS (LAN IPs, tunnel URLs, etc.).
 * Loopback ports are not listed here — they are matched by isDevLocalhostOrigin.
 */
export function mergeDevCorsOrigins(extra?: string): string[] {
  return parseOriginList(extra);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  options: { isProduction: boolean },
): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.some((o) => normalizeOrigin(o) === normalized)) return true;
  if (!options.isProduction && isDevLocalhostOrigin(normalized)) return true;

  return false;
}
