import jwt from "jsonwebtoken";
import type { Response } from "express";
import { getRuntimeConfig, getSessionSecret } from "./runtime-env";

const COOKIE_NAME = "bidwar_auth";
const OAUTH_COOKIE_NAME = "bidwar_oauth";
const OWNER_COOKIE_NAME = "bidwar_owner";
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const OAUTH_EXPIRY = 30 * 60; // 30 minutes — complete-profile can take a few steps
const OWNER_SESSION_EXPIRY = JWT_EXPIRY;

export interface AuthClaims {
  isAdmin?: boolean;
  adminLevel?: "master" | "data_entry";
  organizer?: Record<string, true>;
  /** Tournament Director role — per-tournament match administration. */
  tournamentDirector?: Record<string, true>;
  organizerAccountId?: number;
}

export interface OAuthState {
  state?: string;
  next?: string;
  /** Capacitor / native shell — OAuth must finish via custom-scheme handoff. */
  nativeApp?: "android" | "ios";
  pendingGoogleProfile?: {
    name: string;
    email: string;
    googleId: string;
    googleEmail: string;
  };
  pendingGoogleMobile?: string;
  /** Email/mobile signup: OTP verified before password may be set. */
  pendingEmailSignup?: {
    name: string;
    email: string;
    mobile: string;
    otpVerified: boolean;
  };
}

/** Short-lived token bridging Chrome Custom Tabs → WebView session cookie. */
export interface NativeGoogleHandoffClaims {
  purpose: "google_native_handoff";
  organizerAccountId: number;
}

const NATIVE_HANDOFF_EXPIRY = 2 * 60; // 2 minutes

export interface OwnerSessionClaims {
  sessionId: string;
  tournamentId: number;
  teamId: number;
}

/** Scorer module JWT — Bearer auth for live scoring. */
export interface ScorerAuthClaims {
  purpose: "scorer";
  scorerId: number;
  sessionId: string;
}

const SCORER_JWT_EXPIRY = 12 * 60 * 60; // 12 hours

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

function stripJwtReservedFields<T extends object>(payload: T): Omit<T, "exp" | "iat" | "nbf"> {
  const { exp: _exp, iat: _iat, nbf: _nbf, ...clean } = payload as T & { exp?: unknown; iat?: unknown; nbf?: unknown };
  return clean as Omit<T, "exp" | "iat" | "nbf">;
}

export function signOAuthJwt(state: OAuthState): string {
  // Re-signing a decoded cookie must not pass through exp/iat — jsonwebtoken rejects duplicate exp.
  const cleanState = stripJwtReservedFields(state as OAuthState & { exp?: unknown; iat?: unknown; nbf?: unknown });
  return jwt.sign(cleanState, getSecret(), { expiresIn: OAUTH_EXPIRY });
}

export function verifyOAuthJwt(token: string): OAuthState | null {
  try {
    const payload = jwt.verify(token, getSecret()) as OAuthState & { exp?: unknown; iat?: unknown; nbf?: unknown };
    return stripJwtReservedFields(payload) as OAuthState;
  } catch {
    return null;
  }
}

export function signOwnerSessionJwt(claims: OwnerSessionClaims): string {
  const clean = stripJwtReservedFields(claims as OwnerSessionClaims & { exp?: unknown; iat?: unknown; nbf?: unknown });
  return jwt.sign(clean, getSecret(), { expiresIn: OWNER_SESSION_EXPIRY });
}

export function signScorerJwt(claims: ScorerAuthClaims): string {
  const clean = stripJwtReservedFields(
    claims as ScorerAuthClaims & { exp?: unknown; iat?: unknown; nbf?: unknown },
  );
  return jwt.sign(clean, getSecret(), { expiresIn: SCORER_JWT_EXPIRY });
}

export function verifyScorerJwt(token: string): ScorerAuthClaims | null {
  try {
    const payload = jwt.verify(token, getSecret()) as ScorerAuthClaims & {
      exp?: unknown;
      iat?: unknown;
      nbf?: unknown;
    };
    const clean = stripJwtReservedFields(payload) as ScorerAuthClaims;
    if (
      clean.purpose !== "scorer" ||
      typeof clean.scorerId !== "number" ||
      !Number.isFinite(clean.scorerId) ||
      typeof clean.sessionId !== "string" ||
      !clean.sessionId
    ) {
      return null;
    }
    return clean;
  } catch {
    return null;
  }
}

export function verifyOwnerSessionJwt(token: string): OwnerSessionClaims | null {
  try {
    const payload = jwt.verify(token, getSecret()) as OwnerSessionClaims & { exp?: unknown; iat?: unknown; nbf?: unknown };
    const clean = stripJwtReservedFields(payload) as OwnerSessionClaims;
    if (
      typeof clean.sessionId !== "string" ||
      typeof clean.tournamentId !== "number" ||
      typeof clean.teamId !== "number"
    ) {
      return null;
    }
    return clean;
  } catch {
    return null;
  }
}

export function signNativeGoogleHandoffJwt(organizerAccountId: number): string {
  const claims: NativeGoogleHandoffClaims = {
    purpose: "google_native_handoff",
    organizerAccountId,
  };
  return jwt.sign(claims, getSecret(), { expiresIn: NATIVE_HANDOFF_EXPIRY });
}

export function verifyNativeGoogleHandoffJwt(token: string): NativeGoogleHandoffClaims | null {
  try {
    const payload = jwt.verify(token, getSecret()) as NativeGoogleHandoffClaims & {
      exp?: unknown;
      iat?: unknown;
      nbf?: unknown;
    };
    const clean = stripJwtReservedFields(payload) as NativeGoogleHandoffClaims;
    if (
      clean.purpose !== "google_native_handoff" ||
      typeof clean.organizerAccountId !== "number" ||
      !Number.isFinite(clean.organizerAccountId)
    ) {
      return null;
    }
    return clean;
  } catch {
    return null;
  }
}

function isProd(): boolean {
  return getRuntimeConfig().isProduction;
}

/** Shared parent domain when APP_DOMAIN lists apex + www (production only). */
function sharedCookieDomain(): string | undefined {
  const explicit = process.env.COOKIE_DOMAIN?.trim();
  if (explicit) {
    return explicit.startsWith(".") ? explicit : `.${explicit}`;
  }

  const { appHosts, isProduction } = getRuntimeConfig();
  // Dev (Vite proxy on localhost): never set Domain — host-only cookies only.
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

/** Remove auth/oauth cookies (host-only and shared-domain variants). */
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

export function setAuthCookie(res: Response, claims: AuthClaims): void {
  clearCookieAllVariants(res, COOKIE_NAME);
  const token = signAuthJwt(claims);
  res.cookie(COOKIE_NAME, token, baseCookieOpts(JWT_EXPIRY));
}

export function clearAuthCookie(res: Response): void {
  clearCookieAllVariants(res, COOKIE_NAME);
}

export function setOAuthCookie(res: Response, state: OAuthState): void {
  clearCookieAllVariants(res, OAUTH_COOKIE_NAME);
  const token = signOAuthJwt(state);
  res.cookie(OAUTH_COOKIE_NAME, token, baseCookieOpts(OAUTH_EXPIRY));
}

export function clearOAuthCookie(res: Response): void {
  clearCookieAllVariants(res, OAUTH_COOKIE_NAME);
}

export function setOwnerSessionCookie(res: Response, claims: OwnerSessionClaims): void {
  clearCookieAllVariants(res, OWNER_COOKIE_NAME);
  const token = signOwnerSessionJwt(claims);
  res.cookie(OWNER_COOKIE_NAME, token, baseCookieOpts(OWNER_SESSION_EXPIRY));
}

export function clearOwnerSessionCookie(res: Response): void {
  clearCookieAllVariants(res, OWNER_COOKIE_NAME);
}

export { COOKIE_NAME, OAUTH_COOKIE_NAME, OWNER_COOKIE_NAME };
