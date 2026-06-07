import jwt from "jsonwebtoken";
import type { Response } from "express";
import { getRuntimeConfig, getSessionSecret } from "./runtime-env";

const COOKIE_NAME = "bidwar_auth";
const OAUTH_COOKIE_NAME = "bidwar_oauth";
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const OAUTH_EXPIRY = 30 * 60; // 30 minutes — complete-profile can take a few steps

export interface AuthClaims {
  isAdmin?: boolean;
  adminLevel?: "master" | "data_entry";
  organizer?: Record<string, true>;
  organizerAccountId?: number;
}

export interface OAuthState {
  state?: string;
  next?: string;
  pendingGoogleProfile?: {
    name: string;
    email: string;
    googleId: string;
    googleEmail: string;
  };
  pendingGoogleMobile?: string;
}

function getSecret(): string {
  return getSessionSecret();
}

export function signAuthJwt(claims: AuthClaims): string {
  // Strip JWT-reserved fields (exp, iat, nbf) that may be present when
  // re-signing a previously decoded payload — jsonwebtoken rejects duplicate exp.
  const { exp: _exp, iat: _iat, nbf: _nbf, ...cleanClaims } = claims as AuthClaims & { exp?: unknown; iat?: unknown; nbf?: unknown };
  return jwt.sign(cleanClaims, getSecret(), { expiresIn: JWT_EXPIRY });
}

export function verifyAuthJwt(token: string): AuthClaims | null {
  try {
    const payload = jwt.verify(token, getSecret()) as AuthClaims;
    return payload;
  } catch {
    return null;
  }
}

export function signOAuthJwt(state: OAuthState): string {
  return jwt.sign(state, getSecret(), { expiresIn: OAUTH_EXPIRY });
}

export function verifyOAuthJwt(token: string): OAuthState | null {
  try {
    const payload = jwt.verify(token, getSecret()) as OAuthState;
    return payload;
  } catch {
    return null;
  }
}

function isProd(): boolean {
  return getRuntimeConfig().isProduction;
}

/** Shared parent domain when APP_DOMAIN lists apex + www (e.g. bidwar.in,www.bidwar.in). */
function sharedCookieDomain(): string | undefined {
  const hosts = getRuntimeConfig().appHosts;
  if (hosts.length <= 1) return undefined;
  const apex = hosts.find((h) => !h.toLowerCase().startsWith("www.")) ?? hosts[0]!;
  return apex.startsWith(".") ? apex : `.${apex}`;
}

function cookieOpts(maxAgeSec: number) {
  const domain = sharedCookieDomain();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd(),
    maxAge: maxAgeSec * 1000,
    ...(domain ? { domain } : {}),
  };
}

export function setAuthCookie(res: Response, claims: AuthClaims): void {
  const token = signAuthJwt(claims);
  res.cookie(COOKIE_NAME, token, cookieOpts(JWT_EXPIRY));
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, cookieOpts(0));
}

export function setOAuthCookie(res: Response, state: OAuthState): void {
  const token = signOAuthJwt(state);
  res.cookie(OAUTH_COOKIE_NAME, token, cookieOpts(OAUTH_EXPIRY));
}

export function clearOAuthCookie(res: Response): void {
  res.clearCookie(OAUTH_COOKIE_NAME, cookieOpts(0));
}

export { COOKIE_NAME, OAUTH_COOKIE_NAME };
