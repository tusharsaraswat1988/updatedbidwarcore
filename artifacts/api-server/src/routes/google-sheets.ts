import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { buildPublicUrl } from "../lib/runtime-env.js";
import {
  clearGoogleSheetsOAuthCookie,
  GOOGLE_SHEETS_OAUTH_COOKIE_NAME,
  googleSheetsOwnerKey,
  setGoogleSheetsOAuthCookie,
  verifyGoogleSheetsOAuthJwt,
} from "../lib/google-sheets-oauth.js";
import {
  getGoogleSheetsConnectionStatus,
  saveGoogleSheetsTokens,
} from "../lib/google-sheets-token-store.js";
import { GOOGLE_SHEETS_SCOPES } from "../lib/google-sheets-service.js";
import type { Request } from "express";

const router = Router();

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Safe post-OAuth redirect — blocks auth/setup pages that would loop. */
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

function resolveOwnerKey(req: Request): string | null {
  return googleSheetsOwnerKey(req.jwtUser?.organizerAccountId, !!req.jwtUser?.isAdmin);
}

function readSheetsOAuthState(req: Request) {
  const token = req.cookies?.[GOOGLE_SHEETS_OAUTH_COOKIE_NAME] as string | undefined;
  return token ? verifyGoogleSheetsOAuthJwt(token) : null;
}

router.get("/google/sheets/status", async (req, res) => {
  const ownerKey = resolveOwnerKey(req);
  if (!ownerKey) {
    res.status(403).json({ error: "Authentication required", connected: false });
    return;
  }
  const status = await getGoogleSheetsConnectionStatus(ownerKey);
  res.json(status);
});

router.get("/google/sheets/connect", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google integration not configured" });
    return;
  }

  const ownerKey = resolveOwnerKey(req);
  if (!ownerKey) {
    res.status(403).json({ error: "Authentication required" });
    return;
  }

  const next = sanitizeSheetsOAuthNext(req.query.next as string | undefined);
  const state = randomBytes(32).toString("hex");
  setGoogleSheetsOAuthCookie(res, { state, next, ownerKey });

  const redirectUri = buildPublicUrl("/api/google/sheets/callback");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SHEETS_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/sheets/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const returnedState = req.query.state as string | undefined;
  const oauthState = readSheetsOAuthState(req);

  if (!code) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=google_sheets_cancelled");
    return;
  }

  const pendingNext = sanitizeSheetsOAuthNext(oauthState?.next);
  if (!oauthState?.state || !returnedState || !safeCompare(oauthState.state, returnedState) || !oauthState.ownerKey) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=google_sheets_state_mismatch");
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = buildPublicUrl("/api/google/sheets/callback");
  if (!clientId || !clientSecret) {
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=not_configured");
    return;
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
      return;
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await userRes.json() as { email?: string };

    const existing = await import("../lib/google-sheets-token-store.js").then((m) =>
      m.loadGoogleSheetsTokens(oauthState.ownerKey),
    );

    const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
    if (!refreshToken) {
      clearGoogleSheetsOAuthCookie(res);
      res.redirect("/organizer?error=google_sheets_no_refresh");
      return;
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
  } catch (err) {
    req.log.error({ err }, "Google Sheets OAuth callback error");
    clearGoogleSheetsOAuthCookie(res);
    res.redirect("/organizer?error=google_sheets_failed");
  }
});

export default router;
