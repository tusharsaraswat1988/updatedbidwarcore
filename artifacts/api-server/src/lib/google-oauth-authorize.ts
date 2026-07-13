import type { Response } from "express";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_SEARCH_CONSOLE_SCOPE,
} from "./google-oauth-scopes.js";

export { GOOGLE_OAUTH_CALLBACK_PATH };

/** Canonical Google OAuth 2.0 authorization endpoint (v2). */
export const GOOGLE_OAUTH_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export type GoogleOAuthPrompt = "consent" | "select_account" | "none";

export type BuildGoogleOAuthAuthorizeUrlInput = {
  clientId: string;
  redirectUri: string;
  scope: string | readonly string[];
  state: string;
  prompt: GoogleOAuthPrompt;
  accessType?: "online" | "offline";
  includeGrantedScopes?: boolean;
};

export type BuiltGoogleOAuthAuthorizeUrl = {
  authorizeUrl: string;
  redirectUri: string;
  scope: string;
  prompt: GoogleOAuthPrompt;
};

function normalizeScope(scope: string | readonly string[]): string {
  if (typeof scope === "string") {
    return scope.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean).join(" ");
  }
  return [...scope].map((s) => s.trim()).filter(Boolean).join(" ");
}

/** Ensure redirect_uri is an absolute URL pointing at our shared Google callback. */
export function assertGoogleOAuthRedirectUri(redirectUri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error(`Invalid OAuth redirect_uri (not a URL): ${redirectUri}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Invalid OAuth redirect_uri protocol: ${redirectUri}`);
  }
  if (parsed.pathname !== GOOGLE_OAUTH_CALLBACK_PATH) {
    throw new Error(
      `OAuth redirect_uri path must be ${GOOGLE_OAUTH_CALLBACK_PATH} (got ${parsed.pathname})`,
    );
  }
}

/**
 * Build the Google OAuth authorize URL.
 * Throws if the result would not land on Google's authorize endpoint.
 */
export function buildGoogleOAuthAuthorizeUrl(
  input: BuildGoogleOAuthAuthorizeUrlInput,
): BuiltGoogleOAuthAuthorizeUrl {
  const clientId = input.clientId.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is empty");
  }

  assertGoogleOAuthRedirectUri(input.redirectUri);
  const scope = normalizeScope(input.scope);
  if (!scope) {
    throw new Error("OAuth scope must not be empty");
  }

  const params = new URLSearchParams();
  params.set("client_id", clientId);
  params.set("redirect_uri", input.redirectUri);
  params.set("response_type", "code");
  params.set("scope", scope);
  params.set("state", input.state);
  params.set("prompt", input.prompt);
  params.set("access_type", input.accessType ?? "offline");
  if (input.includeGrantedScopes) {
    params.set("include_granted_scopes", "true");
  }

  const authorizeUrl = `${GOOGLE_OAUTH_AUTHORIZE_ENDPOINT}?${params.toString()}`;
  const parsed = new URL(authorizeUrl);

  if (parsed.origin !== "https://accounts.google.com") {
    throw new Error(`Refusing OAuth redirect to unexpected origin: ${parsed.origin}`);
  }
  if (parsed.pathname !== "/o/oauth2/v2/auth") {
    throw new Error(`Refusing OAuth redirect to unexpected path: ${parsed.pathname}`);
  }
  if (parsed.protocol === "mailto:" || authorizeUrl.toLowerCase().startsWith("mailto:")) {
    throw new Error("Refusing mailto OAuth redirect");
  }

  return {
    authorizeUrl,
    redirectUri: input.redirectUri,
    scope,
    prompt: input.prompt,
  };
}

/** Scopes for Search Console connect (webmasters + identity for callback userinfo). */
export const GOOGLE_SEARCH_CONSOLE_CONNECT_SCOPES = [
  GOOGLE_SEARCH_CONSOLE_SCOPE,
  "openid",
  "email",
  "profile",
] as const;

/**
 * Issue a raw 302 to Google's authorize endpoint.
 * Uses setHeader("Location") instead of res.redirect() to avoid any framework
 * rewriting of external Location values.
 */
export function sendGoogleOAuthAuthorizeRedirect(
  res: Response,
  authorizeUrl: string,
  log?: { info: (obj: Record<string, unknown>, msg: string) => void },
): void {
  const parsed = new URL(authorizeUrl);
  if (
    parsed.origin !== "https://accounts.google.com"
    || parsed.pathname !== "/o/oauth2/v2/auth"
  ) {
    throw new Error(`Refusing to send non-Google OAuth Location: ${authorizeUrl}`);
  }

  log?.info(
    {
      authorizeUrl,
      locationHost: parsed.host,
      locationPath: parsed.pathname,
      hasWebmastersScope: (parsed.searchParams.get("scope") ?? "").includes(
        GOOGLE_SEARCH_CONSOLE_SCOPE,
      ),
      redirectUri: parsed.searchParams.get("redirect_uri"),
      prompt: parsed.searchParams.get("prompt"),
    },
    "Google OAuth authorize URL (302 Location)",
  );

  res.status(302);
  res.setHeader("Location", authorizeUrl);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  // Empty body — browsers follow Location; avoids HTML that could contain mailto links.
  res.end();
}
