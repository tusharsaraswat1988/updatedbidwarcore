import { Router } from "express";
import { randomBytes } from "node:crypto";
import { buildPublicUrl } from "../lib/runtime-env.js";
import {
  googleSheetsOwnerKey,
  setGoogleSheetsOAuthCookie,
} from "../lib/google-sheets-oauth.js";
import { getGoogleSheetsConnectionStatus } from "../lib/google-sheets-token-store.js";
import { GOOGLE_SHEETS_SCOPES } from "../lib/google-sheets-service.js";
import { GOOGLE_OAUTH_CALLBACK_PATH } from "../lib/google-sheets-oauth-callback.js";
import type { Request } from "express";

/** Safe post-OAuth redirect — blocks auth/setup pages that would loop. */
function sanitizeSheetsOAuthNext(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("/")) return undefined;
  const blocked = new Set(["/complete-profile", "/organizer", "/api"]);
  if (blocked.has(raw) || raw.startsWith("/complete-profile?") || raw.startsWith("/api/")) {
    return undefined;
  }
  return raw;
}

const router = Router();

function resolveOwnerKey(req: Request): string | null {
  return googleSheetsOwnerKey(req.jwtUser?.organizerAccountId, !!req.jwtUser?.isAdmin);
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

  const redirectUri = buildPublicUrl(GOOGLE_OAUTH_CALLBACK_PATH);
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

export default router;
