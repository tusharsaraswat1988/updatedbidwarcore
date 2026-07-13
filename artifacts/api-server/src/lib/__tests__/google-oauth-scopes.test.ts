import { describe, expect, it } from "vitest";
import {
  GOOGLE_SEARCH_CONSOLE_SCOPE,
  hasGoogleOAuthScope,
  parseGoogleOAuthScopes,
} from "../google-oauth-scopes.js";

describe("Google OAuth scope helpers", () => {
  it("parses space-delimited scopes from token responses", () => {
    expect(
      parseGoogleOAuthScopes(
        "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/webmasters",
      ),
    ).toEqual([
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/webmasters",
    ]);
  });

  it("detects Search Console webmasters scope for re-consent checks", () => {
    expect(hasGoogleOAuthScope(null, GOOGLE_SEARCH_CONSOLE_SCOPE)).toBe(false);
    expect(hasGoogleOAuthScope([], GOOGLE_SEARCH_CONSOLE_SCOPE)).toBe(false);
    expect(
      hasGoogleOAuthScope(
        ["https://www.googleapis.com/auth/spreadsheets"],
        GOOGLE_SEARCH_CONSOLE_SCOPE,
      ),
    ).toBe(false);
    expect(
      hasGoogleOAuthScope(
        ["https://www.googleapis.com/auth/spreadsheets", GOOGLE_SEARCH_CONSOLE_SCOPE],
        GOOGLE_SEARCH_CONSOLE_SCOPE,
      ),
    ).toBe(true);
  });
});
