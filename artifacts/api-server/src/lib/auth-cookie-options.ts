/**
 * Host-aware auth cookie Domain policy.
 *
 * Production on bidwar.in / www.bidwar.in may share Domain=.bidwar.in.
 * The same binary on Railway (or any host outside that apex) must use host-only
 * cookies — otherwise browsers reject Domain=.bidwar.in Set-Cookie on *.up.railway.app
 * and organizer sessions appear to "log out" on Auction navigation.
 */
import type { Request, Response } from "express";
import { getRuntimeConfig } from "./runtime-env";

/** Configured shared parent domain from COOKIE_DOMAIN / APP_DOMAIN (may be undefined). */
export function configuredSharedCookieDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const explicit = env.COOKIE_DOMAIN?.trim();
  if (explicit) {
    return explicit.startsWith(".") ? explicit : `.${explicit}`;
  }

  const { appHosts, isProduction } = getRuntimeConfig();
  // Dev / single-host: never set Domain — host-only cookies only.
  if (!isProduction || appHosts.length <= 1) return undefined;

  const apex =
    appHosts.find((h) => !h.toLowerCase().startsWith("www.")) ?? appHosts[0]!;
  return apex.startsWith(".") ? apex : `.${apex}`;
}

export function resolveRequestHostname(
  req: Request | undefined,
): string | undefined {
  if (!req) return undefined;
  const fromHostname = typeof req.hostname === "string" ? req.hostname.trim() : "";
  const fromHeader = req.get?.("host")?.trim() ?? "";
  const raw = (fromHostname || fromHeader).toLowerCase();
  if (!raw) return undefined;
  return raw.split(":")[0] || undefined;
}

export function isLoopbackHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost");
}

/** True when request host is the cookie apex or a subdomain of it. */
export function hostMatchesCookieDomain(
  host: string,
  domainWithOptionalDot: string,
): boolean {
  const apex = domainWithOptionalDot.startsWith(".")
    ? domainWithOptionalDot.slice(1).toLowerCase()
    : domainWithOptionalDot.toLowerCase();
  const h = host.toLowerCase().split(":")[0]!;
  return h === apex || h.endsWith(`.${apex}`);
}

/**
 * Domain attribute for Set-Cookie on this response, or undefined for host-only.
 * Derives from the *request host* (res.req), not APP_DOMAIN alone.
 */
export function cookieDomainForResponse(res: Response): string | undefined {
  const configured = configuredSharedCookieDomain();
  const host = resolveRequestHostname(res.req);

  // No request context (tests / edge): keep prior configured behavior.
  if (!host) return configured;

  if (isLoopbackHostname(host)) return undefined;

  if (!configured) return undefined;

  if (hostMatchesCookieDomain(host, configured)) return configured;

  // Railway / other public host outside APP_DOMAIN apex → host-only.
  return undefined;
}

export function authCookieBaseOptions(res: Response, maxAgeSec: number) {
  const domain = cookieDomainForResponse(res);
  const secure = getRuntimeConfig().isProduction;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSec * 1000,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Clear host-only cookie always. Clear shared-domain variant only when the
 * request host is under that apex (or when no request host is available).
 * Avoids emitting Domain=.bidwar.in Set-Cookie clears on Railway hosts.
 */
export function clearAuthCookieVariants(res: Response, name: string): void {
  const configured = configuredSharedCookieDomain();
  const secure = getRuntimeConfig().isProduction;
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };
  res.clearCookie(name, { ...base, maxAge: 0 });

  const host = resolveRequestHostname(res.req);
  const shouldClearShared =
    !!configured &&
    (!host || hostMatchesCookieDomain(host, configured));

  if (shouldClearShared && configured) {
    res.clearCookie(name, { ...base, domain: configured, maxAge: 0 });
  }
}
