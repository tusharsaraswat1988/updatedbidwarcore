import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { buildPublicUrl } from "../lib/runtime-env.js";
import { setGoogleSheetsOAuthCookie } from "../lib/google-sheets-oauth.js";
import { GOOGLE_OAUTH_CALLBACK_PATH } from "../lib/google-sheets-oauth-callback.js";
import { GOOGLE_SEARCH_CONSOLE_SCOPE } from "../lib/google-oauth-scopes.js";
import {
  buildGoogleOAuthAuthorizeUrl,
  GOOGLE_SEARCH_CONSOLE_CONNECT_SCOPES,
  sendGoogleOAuthAuthorizeRedirect,
} from "../lib/google-oauth-authorize.js";
import {
  GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY,
  GoogleSearchConsoleNotConnectedError,
  getSearchConsoleConnectionStatus,
  submitSitemapToSearchConsole,
} from "../lib/google-search-console-service.js";
import { requireAdmin } from "../middleware/require-admin.js";

const router = Router();

/** Safe post-OAuth redirect back into the admin panel. */
function sanitizeOAuthNext(raw: string | undefined): string | undefined {
  if (!raw?.startsWith("/admin")) return undefined;
  if (raw.startsWith("/api/")) return undefined;
  return raw;
}

const submitBodySchema = z.object({
  siteUrl: z.string().min(1).optional(),
  sitemapUrl: z.string().url().optional(),
});

/** GET /google/search-console/status — platform GSC connection status */
router.get("/google/search-console/status", requireAdmin, async (_req, res) => {
  const status = await getSearchConsoleConnectionStatus();
  res.json({
    ...status,
    scope: GOOGLE_SEARCH_CONSOLE_SCOPE,
    connectScopes: GOOGLE_SEARCH_CONSOLE_CONNECT_SCOPES,
    redirectUri: buildPublicUrl(GOOGLE_OAUTH_CALLBACK_PATH),
  });
});

/**
 * GET /google/search-console/connect?next=&debug=1
 * Starts Google OAuth for Search Console only.
 * Requires platform admin session (username/password). Does not use organizer Google login.
 * Stores one global platform token under ownerKey `admin`.
 */
router.get("/google/search-console/connect", requireAdmin, async (req, res) => {
  const ownerKey = GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY;
  req.log.info(
    {
      handler: "GET /google/search-console/connect",
      reachedHandler: true,
      passedMiddleware: "requireAdmin",
      isAdmin: true,
      adminLevel: req.jwtUser?.adminLevel ?? "master",
      ownerKey,
      host: req.headers.host ?? null,
      debug: req.query.debug === "1" || req.query.debug === "true",
    },
    "Search Console connect handler reached (requireAdmin passed)",
  );

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google integration not configured" });
    return;
  }

  try {
    const status = await getSearchConsoleConnectionStatus();
    const next =
      sanitizeOAuthNext(req.query.next as string | undefined) ??
      "/admin/settings/system/search-console";
    const state = randomBytes(32).toString("hex");
    setGoogleSheetsOAuthCookie(res, {
      state,
      next,
      ownerKey,
      purpose: "search_console",
    });

    const redirectUri = buildPublicUrl(GOOGLE_OAUTH_CALLBACK_PATH);
    const prompt = status.needsReconsent ? "consent" : "select_account";

    const built = buildGoogleOAuthAuthorizeUrl({
      clientId,
      redirectUri,
      scope: GOOGLE_SEARCH_CONSOLE_CONNECT_SCOPES,
      state,
      prompt,
      accessType: "offline",
      includeGrantedScopes: true,
    });

    const scopeList = built.scope.split(/\s+/);
    if (!scopeList.includes(GOOGLE_SEARCH_CONSOLE_SCOPE)) {
      throw new Error("Built OAuth URL is missing webmasters scope");
    }

    req.log.info(
      {
        authorizeUrl: built.authorizeUrl,
        redirectUri: built.redirectUri,
        scope: built.scope,
        prompt: built.prompt,
        needsReconsent: status.needsReconsent,
        ownerKey,
        expectedCallbackPath: GOOGLE_OAUTH_CALLBACK_PATH,
        note: "redirect_uri must be listed under Google Cloud → Credentials → Authorized redirect URIs",
      },
      "Search Console OAuth connect — authorize URL generated",
    );

    if (req.query.debug === "1" || req.query.debug === "true") {
      res.status(200).json({
        ok: true,
        willRedirectStatus: 302,
        willRedirectTo: "https://accounts.google.com/o/oauth2/v2/auth",
        authorizeUrl: built.authorizeUrl,
        redirectUri: built.redirectUri,
        scope: built.scope,
        hasWebmastersScope: true,
        prompt: built.prompt,
        needsReconsent: status.needsReconsent,
        ownerKey,
      });
      return;
    }

    sendGoogleOAuthAuthorizeRedirect(res, built.authorizeUrl, req.log);
  } catch (err) {
    req.log.error({ err }, "Search Console OAuth connect failed to build authorize URL");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to start Google OAuth",
    });
  }
});

/** POST /google/search-console/submit-sitemap — admin-only platform sitemap submit */
router.post("/google/search-console/submit-sitemap", requireAdmin, async (req, res) => {
  const parsed = submitBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await submitSitemapToSearchConsole(parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof GoogleSearchConsoleNotConnectedError) {
      res.status(401).json({
        error: "Google Search Console not connected",
        needsGoogleAuth: true,
        connectPath: "/api/google/search-console/connect",
      });
      return;
    }
    if (err instanceof Error && err.name === "GoogleSearchConsoleScopeMissingError") {
      res.status(403).json({
        error: "Search Console scope missing — re-consent required",
        needsReconsent: true,
        connectPath: "/api/google/search-console/connect",
        scope: GOOGLE_SEARCH_CONSOLE_SCOPE,
      });
      return;
    }
    req.log.error({ err }, "Search Console sitemap submit failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Submit failed" });
  }
});

export default router;
