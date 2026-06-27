import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { buildPublicUrl } from "./runtime-env.js";
import {
  clearGoogleSheetsOAuthCookie,
  GOOGLE_SHEETS_OAUTH_COOKIE_NAME,
  verifyGoogleSheetsOAuthJwt,
} from "./google-sheets-oauth.js";
import { loadGoogleSheetsTokens, saveGoogleSheetsTokens } from "./google-sheets-token-store.js";

/** Must match the URI registered in Google Cloud Console for login OAuth. */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/google/callback";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sanitizeSheetsOAuthNext(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("/")) return undefined;
  const blocked = new Set(["/complete-profile", "/organizer", "/api"]);
  if (blocked.has(raw) || raw.startsWith("/complete-profile?") || raw.startsWith("/api/")) {
    return undefined;
  }
  return raw;
}

function appendQueryParam(path: string, key: string, value: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${key}=${encodeURIComponent(value)}`;
}

/**
 * Handles Google Sheets OAuth when Google redirects to the shared login callback URI.
 * Returns true when this request was a Sheets connect flow (response already sent).
 */
export async function tryCompleteGoogleSheetsOAuth(req: Request, res: Response): Promise<boolean> {
  const code = req.query.code as string | undefined;
  const returnedState = req.query.state as string | undefined;
  const token = req.cookies?.[GOOGLE_SHEETS_OAUTH_COOKIE_NAME] as string | undefined;
  const oauthState = token ? verifyGoogleSheetsOAuthJwt(token) : null;

  if (!oauthState?.ownerKey) return false;

  if (!code) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=google_sheets_cancelled");
    return true;
  }

  const pendingNext = sanitizeSheetsOAuthNext(oauthState.next);
  if (!oauthState.state || !returnedState || !safeCompare(oauthState.state, returnedState)) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=google_sheets_state_mismatch");
    return true;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = buildPublicUrl(GOOGLE_OAUTH_CALLBACK_PATH);
  if (!clientId || !clientSecret) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=not_configured");
    return true;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!tokens.access_token) {
      clearGoogleSheetsOAuthCookie(res);
      res.redirect("/organizer?error=google_sheets_token_failed");
      return true;
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await userRes.json() as { email?: string };

    const existing = await loadGoogleSheetsTokens(oauthState.ownerKey);
    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    if (!refreshToken) {
      clearGoogleSheetsOAuthCookie(res);
      res.redirect("/organizer?error=google_sheets_no_refresh");
      return true;
    }

    const tokenExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
    await saveGoogleSheetsTokens(oauthState.ownerKey, {
      refreshToken,
      accessToken: tokens.access_token,
      tokenExpiry,
      email: gUser.email ?? null,
    });

    clearGoogleSheetsOAuthCookie(res);
    const baseRedirect = pendingNext ?? "/organizer";
    res.redirect(appendQueryParam(baseRedirect, "google_sheets_connected", "1"));
    return true;
  } catch (err) {
    req.log.error({ err }, "Google Sheets OAuth callback error");
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=google_sheets_failed");
    return true;
  }
}
