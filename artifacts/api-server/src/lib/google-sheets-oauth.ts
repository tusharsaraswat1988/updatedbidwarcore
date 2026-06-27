import jwt from "jsonwebtoken";
import type { Response } from "express";
import { getRuntimeConfig, getSessionSecret } from "./runtime-env";

const COOKIE_NAME = "bidwar_google_sheets_oauth";
const JWT_EXPIRY = 30 * 60;

export interface GoogleSheetsOAuthState {
  state: string;
  next?: string;
  /** Organizer account id or 0 for platform admin. */
  ownerKey: string;
}

function getSecret(): string {
  return getSessionSecret();
}

function isProd(): boolean {
  return getRuntimeConfig().isProduction;
}

function sharedCookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) {
    return explicit.startsWith(".") ? explicit : `.${explicit}`;
  }

  const { appHosts, isProduction } = getRuntimeConfig();
  if (!isProduction || appHosts.length <= 1) return undefined;

  const apex = appHosts.find((h) => !h.toLowerCase().startsWith("www.")) ?? appHosts[0]!;
  return apex.startsWith(".") ? apex : `.${apex}`;
}

function baseCookieOpts(maxAgeSec: number) {
  const domain = sharedCookieDomain();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd(),
    path: "/",
    maxAge: maxAgeSec * 1000,
    ...(domain ? { domain } : {}),
  };
}

function clearCookieAllVariants(res: Response, name: string): void {
  const domain = sharedCookieDomain();
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd(),
    path: "/",
  };
  res.clearCookie(name, { ...base, maxAge: 0 });
  if (domain) {
    res.clearCookie(name, { ...base, domain, maxAge: 0 });
  }
}

export function signGoogleSheetsOAuthJwt(state: GoogleSheetsOAuthState): string {
  return jwt.sign(state, getSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyGoogleSheetsOAuthJwt(token: string): GoogleSheetsOAuthState | null {
  try {
    return jwt.verify(token, getSecret()) as GoogleSheetsOAuthState;
  } catch {
    return null;
  }
}

export function setGoogleSheetsOAuthCookie(res: Response, state: GoogleSheetsOAuthState): void {
  clearCookieAllVariants(res, COOKIE_NAME);
  const token = signGoogleSheetsOAuthJwt(state);
  res.cookie(COOKIE_NAME, token, baseCookieOpts(JWT_EXPIRY));
}

export function clearGoogleSheetsOAuthCookie(res: Response): void {
  clearCookieAllVariants(res, COOKIE_NAME);
}

export { COOKIE_NAME as GOOGLE_SHEETS_OAUTH_COOKIE_NAME };

export function googleSheetsOwnerKey(organizerAccountId: number | undefined, isAdmin: boolean): string | null {
  if (organizerAccountId != null) return `organizer:${organizerAccountId}`;
  if (isAdmin) return "admin";
  return null;
}
