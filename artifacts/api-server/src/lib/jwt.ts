import jwt from "jsonwebtoken";
import type { Response } from "express";

const COOKIE_NAME = "bidwar_auth";
const OAUTH_COOKIE_NAME = "bidwar_oauth";
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const OAUTH_EXPIRY = 10 * 60; // 10 minutes in seconds

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
  return process.env.SESSION_SECRET ?? "bidwar-dev-secret";
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
  return process.env.NODE_ENV === "production";
}

export function setAuthCookie(res: Response, claims: AuthClaims): void {
  const token = signAuthJwt(claims);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    maxAge: JWT_EXPIRY * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: isProd() });
}

export function setOAuthCookie(res: Response, state: OAuthState): void {
  const token = signOAuthJwt(state);
  res.cookie(OAUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    maxAge: OAUTH_EXPIRY * 1000,
  });
}

export function clearOAuthCookie(res: Response): void {
  res.clearCookie(OAUTH_COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: isProd() });
}

export { COOKIE_NAME, OAUTH_COOKIE_NAME };
