/** Must match the URI registered in Google Cloud Console for login OAuth. */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/google/callback";

/** Shared Google OAuth scope constants and parsers (no DB / network deps). */

export const GOOGLE_SHEETS_SCOPE_LIST = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const GOOGLE_SHEETS_SCOPES = GOOGLE_SHEETS_SCOPE_LIST.join(" ");

/** Google Search Console (Webmaster Tools) API scope. */
export const GOOGLE_SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters";

export function parseGoogleOAuthScopes(scopeHeader: string | undefined | null): string[] {
  if (!scopeHeader?.trim()) return [];
  return scopeHeader
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hasGoogleOAuthScope(grantedScopes: string[] | null | undefined, scope: string): boolean {
  if (!grantedScopes?.length) return false;
  return grantedScopes.includes(scope);
}
