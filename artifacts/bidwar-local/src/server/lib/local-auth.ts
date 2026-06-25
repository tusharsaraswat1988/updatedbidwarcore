import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import type { Response } from "express";

/** Same cookie name as cloud so the bundled SPA works without changes. */
export const LOCAL_AUTH_COOKIE = "bidwar_auth";
const JWT_EXPIRY_SEC = 7 * 24 * 60 * 60;

export interface LocalAuthClaims {
  organizer?: Record<string, true>;
}

function getSecret(): string {
  const fromEnv = process.env.LOCAL_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  // LAN-only fallback; set LOCAL_SESSION_SECRET in production installers.
  return "bidwar-local-session-secret-min-32-chars";
}

export function signLocalAuthJwt(claims: LocalAuthClaims): string {
  return jwt.sign(claims, getSecret(), { expiresIn: JWT_EXPIRY_SEC });
}

export function verifyLocalAuthJwt(token: string): LocalAuthClaims | null {
  try {
    return jwt.verify(token, getSecret()) as LocalAuthClaims;
  } catch {
    return null;
  }
}

export function setLocalAuthCookie(res: Response, claims: LocalAuthClaims): void {
  const token = signLocalAuthJwt(claims);
  res.cookie(LOCAL_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: JWT_EXPIRY_SEC * 1000,
  });
}

export function clearLocalAuthCookie(res: Response): void {
  res.clearCookie(LOCAL_AUTH_COOKIE, { path: "/" });
}

export function grantOrganizerForTournament(
  res: Response,
  existing: LocalAuthClaims | null,
  tournamentId: number,
): void {
  const key = String(tournamentId);
  const organizer = { ...(existing?.organizer ?? {}), [key]: true as const };
  setLocalAuthCookie(res, { organizer });
}

export function revokeOrganizerForTournament(
  res: Response,
  existing: LocalAuthClaims | null,
  tournamentId: number,
): void {
  const key = String(tournamentId);
  const organizer = { ...(existing?.organizer ?? {}) };
  delete organizer[key];
  setLocalAuthCookie(res, { organizer });
}

export function isOrganizerForTournament(
  claims: LocalAuthClaims | null,
  tournamentId: number,
): boolean {
  return !!claims?.organizer?.[String(tournamentId)];
}

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
