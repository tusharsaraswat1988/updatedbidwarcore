import jwt from "jsonwebtoken";
import type { Response } from "express";
import { getSessionSecret } from "./runtime-env";
import {
  authCookieBaseOptions,
  clearAuthCookieVariants,
} from "./auth-cookie-options";

const COOKIE_NAME = "bidwar_google_sheets_oauth";
const JWT_EXPIRY = 30 * 60;

export type GoogleApiOAuthPurpose = "sheets" | "search_console";

export interface GoogleSheetsOAuthState {
  state: string;
  next?: string;
  /** Organizer account id key or `admin` for platform admin. */
  ownerKey: string;
  /** Which Google API connect flow started this round-trip. Defaults to sheets. */
  purpose?: GoogleApiOAuthPurpose;
}

function getSecret(): string {
  return getSessionSecret();
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
  clearAuthCookieVariants(res, COOKIE_NAME);
  const token = signGoogleSheetsOAuthJwt(state);
  res.cookie(COOKIE_NAME, token, authCookieBaseOptions(res, JWT_EXPIRY));
}

export function clearGoogleSheetsOAuthCookie(res: Response): void {
  clearAuthCookieVariants(res, COOKIE_NAME);
}

export { COOKIE_NAME as GOOGLE_SHEETS_OAUTH_COOKIE_NAME };

export function googleSheetsOwnerKey(organizerAccountId: number | undefined, isAdmin: boolean): string | null {
  if (organizerAccountId != null) return `organizer:${organizerAccountId}`;
  if (isAdmin) return "admin";
  return null;
}
