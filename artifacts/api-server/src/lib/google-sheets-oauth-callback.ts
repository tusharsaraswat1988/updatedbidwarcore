import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { buildPublicUrl } from "./runtime-env.js";
import {
  clearGoogleSheetsOAuthCookie,
  GOOGLE_SHEETS_OAUTH_COOKIE_NAME,
  verifyGoogleSheetsOAuthJwt,
} from "./google-sheets-oauth.js";
import { loadGoogleSheetsTokens, saveGoogleSheetsTokens } from "./google-sheets-token-store.js";
import {
  GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY,
  loadGoogleSearchConsoleTokens,
  saveGoogleSearchConsoleTokens,
} from "./google-search-console-token-store.js";
import { GOOGLE_OAUTH_CALLBACK_PATH, parseGoogleOAuthScopes } from "./google-oauth-scopes.js";

export { GOOGLE_OAUTH_CALLBACK_PATH };

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sanitizeOAuthNext(raw: string | undefined, purpose: "sheets" | "search_console"): string | undefined {
  if (!raw?.startsWith("/")) return undefined;
  if (purpose === "search_console") {
    if (!raw.startsWith("/admin")) return undefined;
    if (raw.startsWith("/api/")) return undefined;
    return raw;
  }
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

function mergeGrantedScopes(
  previous: string[] | null | undefined,
  fromTokenResponse: string[] | null | undefined,
): string[] | null {
  const merged = new Set<string>([...(previous ?? []), ...(fromTokenResponse ?? [])]);
  if (merged.size === 0) return null;
  return [...merged];
}

/**
 * Handles Google Sheets / Search Console OAuth when Google redirects to the shared login callback URI.
 * Returns true when this request was a Google API connect flow (response already sent).
 *
 * Search Console: platform-admin only (ownerKey `admin`), separate token store from organizer Sheets.
 * Sheets: organizer or admin sheets tokens — unchanged.
 */
export async function tryCompleteGoogleSheetsOAuth(req: Request, res: Response): Promise<boolean> {
  const code = req.query.code as string | undefined;
  const returnedState = req.query.state as string | undefined;
  const token = req.cookies?.[GOOGLE_SHEETS_OAUTH_COOKIE_NAME] as string | undefined;
  const oauthState = token ? verifyGoogleSheetsOAuthJwt(token) : null;

  if (!oauthState?.ownerKey) return false;

  const purpose = oauthState.purpose ?? "sheets";
  const errorPrefix = purpose === "search_console" ? "google_search_console" : "google_sheets";
  const successParam =
    purpose === "search_console" ? "google_search_console_connected" : "google_sheets_connected";
  const defaultRedirect =
    purpose === "search_console" ? "/admin/settings/system/search-console" : "/organizer";
  const errorRedirect = purpose === "search_console" ? "/admin/settings/system/search-console" : "/organizer";

  // Search Console is platform-global — only accept admin owner key (not organizer Google login).
  if (purpose === "search_console" && oauthState.ownerKey !== GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect(`${errorRedirect}?error=${errorPrefix}_invalid_owner`);
    return true;
  }

  // Shared callback URL — if this round-trip matches organizer login state, defer to auth.ts.
  const loginState = req.oauthState?.state;
  if (loginState && returnedState && safeCompare(loginState, returnedState)) {
    return false;
  }

  if (!code) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect(`${errorRedirect}?error=${errorPrefix}_cancelled`);
    return true;
  }

  const pendingNext = sanitizeOAuthNext(oauthState.next, purpose);
  if (!oauthState.state || !returnedState || !safeCompare(oauthState.state, returnedState)) {
    clearGoogleSheetsOAuthCookie(res);
    if (loginState) return false;
    res.redirect(`${errorRedirect}?error=${errorPrefix}_state_mismatch`);
    return true;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = buildPublicUrl(GOOGLE_OAUTH_CALLBACK_PATH);
  if (!clientId || !clientSecret) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect(`${errorRedirect}?error=not_configured`);
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
      scope?: string;
      error?: string;
    };

    if (!tokens.access_token) {
      clearGoogleSheetsOAuthCookie(res);
      res.redirect(`${errorRedirect}?error=${errorPrefix}_token_failed`);
      return true;
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await userRes.json() as { email?: string };

    const existing =
      purpose === "search_console"
        ? await loadGoogleSearchConsoleTokens(oauthState.ownerKey)
        : await loadGoogleSheetsTokens(oauthState.ownerKey);
    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    if (!refreshToken) {
      clearGoogleSheetsOAuthCookie(res);
      res.redirect(`${errorRedirect}?error=${errorPrefix}_no_refresh`);
      return true;
    }

    const tokenExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
    const grantedScopes = mergeGrantedScopes(
      existing?.grantedScopes,
      parseGoogleOAuthScopes(tokens.scope),
    );

    const stored = {
      refreshToken,
      accessToken: tokens.access_token,
      tokenExpiry,
      email: gUser.email ?? null,
      grantedScopes,
    };

    if (purpose === "search_console") {
      await saveGoogleSearchConsoleTokens(oauthState.ownerKey, stored);
    } else {
      await saveGoogleSheetsTokens(oauthState.ownerKey, stored);
    }

    clearGoogleSheetsOAuthCookie(res);
    const baseRedirect = pendingNext ?? defaultRedirect;
    res.redirect(appendQueryParam(baseRedirect, successParam, "1"));
    return true;
  } catch (err) {
    req.log.error({ err, purpose }, "Google API OAuth callback error");
    clearGoogleSheetsOAuthCookie(res);
    res.redirect(`${errorRedirect}?error=${errorPrefix}_failed`);
    return true;
  }
}
