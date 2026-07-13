import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseGoogleOAuthScopes } from "./google-oauth-scopes.js";

/** Single platform-wide Search Console OAuth token (bidwar.in), stored in settings. */
export const GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY = "admin";
const ADMIN_SETTINGS_KEY = "google_search_console:admin";

export interface StoredGoogleSearchConsoleTokens {
  refreshToken: string;
  accessToken: string | null;
  tokenExpiry: Date | null;
  email: string | null;
  grantedScopes: string[] | null;
}

function parseAdminTokens(raw: string | null | undefined): StoredGoogleSearchConsoleTokens | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      refreshToken?: string;
      accessToken?: string | null;
      tokenExpiry?: string | null;
      email?: string | null;
      grantedScopes?: string[] | string | null;
    };
    if (!parsed.refreshToken) return null;
    const grantedScopes = Array.isArray(parsed.grantedScopes)
      ? parsed.grantedScopes
      : parseGoogleOAuthScopes(
          typeof parsed.grantedScopes === "string" ? parsed.grantedScopes : null,
        );
    return {
      refreshToken: parsed.refreshToken,
      accessToken: parsed.accessToken ?? null,
      tokenExpiry: parsed.tokenExpiry ? new Date(parsed.tokenExpiry) : null,
      email: parsed.email ?? null,
      grantedScopes: grantedScopes.length ? grantedScopes : null,
    };
  } catch {
    return null;
  }
}

/**
 * Load the platform Search Console OAuth tokens.
 * Only the global admin owner key is supported — not per-organizer.
 */
export async function loadGoogleSearchConsoleTokens(
  ownerKey: string = GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY,
): Promise<StoredGoogleSearchConsoleTokens | null> {
  if (ownerKey !== GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY) return null;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, ADMIN_SETTINGS_KEY));
  return parseAdminTokens(row?.value);
}

export async function saveGoogleSearchConsoleTokens(
  ownerKey: string,
  tokens: StoredGoogleSearchConsoleTokens,
): Promise<void> {
  if (ownerKey !== GOOGLE_SEARCH_CONSOLE_ADMIN_OWNER_KEY) {
    throw new Error("Search Console tokens can only be stored for the platform admin owner key");
  }

  const value = JSON.stringify({
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken,
    tokenExpiry: tokens.tokenExpiry?.toISOString() ?? null,
    email: tokens.email,
    grantedScopes: tokens.grantedScopes,
  });

  await db
    .insert(settingsTable)
    .values({ key: ADMIN_SETTINGS_KEY, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}
