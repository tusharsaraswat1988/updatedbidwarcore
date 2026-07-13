import { getBaseUrl } from "./page-meta.js";
import {
  GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY,
  loadGoogleSearchConsoleTokens,
  saveGoogleSearchConsoleTokens,
} from "./google-search-console-token-store.js";
import {
  GOOGLE_SEARCH_CONSOLE_SCOPE,
  hasGoogleOAuthScope,
} from "./google-oauth-scopes.js";

const WEBMASTERS_API = "https://www.googleapis.com/webmasters/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export { GOOGLE_SEARCH_CONSOLE_SCOPE, GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY };

export class GoogleSearchConsoleNotConnectedError extends Error {
  constructor() {
    super("GOOGLE_SEARCH_CONSOLE_NOT_CONNECTED");
    this.name = "GoogleSearchConsoleNotConnectedError";
  }
}

export class GoogleSearchConsoleTokenExpiredError extends Error {
  constructor() {
    super("GOOGLE_SEARCH_CONSOLE_TOKEN_EXPIRED");
    this.name = "GoogleSearchConsoleTokenExpiredError";
  }
}

async function exchangeRefreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_grant") {
      throw new GoogleSearchConsoleTokenExpiredError();
    }
    throw new Error(body.error ?? "Failed to refresh Google access token.");
  }
  return { access_token: body.access_token, expires_in: body.expires_in ?? 3600 };
}

async function getValidSearchConsoleAccessToken(): Promise<string> {
  const stored = await loadGoogleSearchConsoleTokens(GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY);
  if (!stored?.refreshToken) {
    throw new GoogleSearchConsoleNotConnectedError();
  }

  const now = Date.now();
  const expiryMs = stored.tokenExpiry?.getTime() ?? 0;
  if (stored.accessToken && expiryMs > now + 60_000) {
    return stored.accessToken;
  }

  const refreshed = await exchangeRefreshToken(stored.refreshToken);
  const tokenExpiry = new Date(now + refreshed.expires_in * 1000);
  await saveGoogleSearchConsoleTokens(GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY, {
    ...stored,
    accessToken: refreshed.access_token,
    tokenExpiry,
  });
  return refreshed.access_token;
}

export async function getSearchConsoleConnectionStatus(): Promise<{
  connected: boolean;
  hasWebmastersScope: boolean;
  needsReconsent: boolean;
  email: string | null;
}> {
  const tokens = await loadGoogleSearchConsoleTokens(GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY);
  const connected = !!tokens?.refreshToken;
  const hasWebmastersScope = hasGoogleOAuthScope(tokens?.grantedScopes, GOOGLE_SEARCH_CONSOLE_SCOPE);
  return {
    connected,
    hasWebmastersScope,
    needsReconsent: !connected || !hasWebmastersScope,
    email: tokens?.email ?? null,
  };
}

function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

function encodeFeedpath(feedpath: string): string {
  return encodeURIComponent(feedpath);
}

export type SubmitSitemapResult = {
  siteUrl: string;
  sitemapUrl: string;
  ok: boolean;
};

/**
 * Submits sitemap-index to Google Search Console for the platform property (bidwar.in).
 * Uses the single global admin Search Console OAuth token.
 */
export async function submitSitemapToSearchConsole(
  options?: { siteUrl?: string; sitemapUrl?: string },
): Promise<SubmitSitemapResult> {
  const status = await getSearchConsoleConnectionStatus();
  if (!status.connected) {
    throw new GoogleSearchConsoleNotConnectedError();
  }
  if (!status.hasWebmastersScope) {
    const err = new Error("GOOGLE_SEARCH_CONSOLE_SCOPE_MISSING");
    err.name = "GoogleSearchConsoleScopeMissingError";
    throw err;
  }

  const base = getBaseUrl().replace(/\/$/, "");
  const siteUrl = options?.siteUrl ?? `sc-domain:${new URL(base).hostname.replace(/^www\./, "")}`;
  const sitemapUrl = options?.sitemapUrl ?? `${base}/sitemap-index.xml`;

  const accessToken = await getValidSearchConsoleAccessToken();

  const endpoint =
    `${WEBMASTERS_API}/sites/${encodeSiteUrl(siteUrl)}/sitemaps/${encodeFeedpath(sitemapUrl)}`;

  const res = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Search Console sitemap submit failed (${res.status}): ${body || res.statusText}`);
  }

  return { siteUrl, sitemapUrl, ok: true };
}
