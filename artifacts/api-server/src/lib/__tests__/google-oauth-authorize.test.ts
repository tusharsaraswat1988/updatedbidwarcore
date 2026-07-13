import { describe, expect, it } from "vitest";
import { GOOGLE_OAUTH_CALLBACK_PATH } from "../google-oauth-scopes.js";
import { GOOGLE_SEARCH_CONSOLE_SCOPE } from "../google-oauth-scopes.js";
import {
  buildGoogleOAuthAuthorizeUrl,
  GOOGLE_OAUTH_AUTHORIZE_ENDPOINT,
  GOOGLE_SEARCH_CONSOLE_CONNECT_SCOPES,
} from "../google-oauth-authorize.js";

describe("buildGoogleOAuthAuthorizeUrl", () => {
  it("builds a 302 target on accounts.google.com with webmasters scope", () => {
    const redirectUri = `https://bidwar.in${GOOGLE_OAUTH_CALLBACK_PATH}`;
    const built = buildGoogleOAuthAuthorizeUrl({
      clientId: "72869814220-example.apps.googleusercontent.com",
      redirectUri,
      scope: GOOGLE_SEARCH_CONSOLE_CONNECT_SCOPES,
      state: "abc123",
      prompt: "consent",
      accessType: "offline",
      includeGrantedScopes: true,
    });

    expect(built.authorizeUrl.startsWith(`${GOOGLE_OAUTH_AUTHORIZE_ENDPOINT}?`)).toBe(true);
    const url = new URL(built.authorizeUrl);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.protocol).not.toBe("mailto:");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    const scopes = (url.searchParams.get("scope") ?? "").split(/\s+/);
    expect(scopes).toContain(GOOGLE_SEARCH_CONSOLE_SCOPE);
    expect(scopes).toContain("email");
  });

  it("rejects redirect_uri that is not the shared callback path", () => {
    expect(() =>
      buildGoogleOAuthAuthorizeUrl({
        clientId: "client",
        redirectUri: "https://bidwar.in/api/wrong/callback",
        scope: GOOGLE_SEARCH_CONSOLE_SCOPE,
        state: "x",
        prompt: "consent",
      }),
    ).toThrow(/redirect_uri path must be/);
  });
});
