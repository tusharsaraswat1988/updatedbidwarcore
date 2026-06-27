import { db, organizersTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface StoredGoogleSheetsTokens {
  refreshToken: string;
  accessToken: string | null;
  tokenExpiry: Date | null;
  email: string | null;
}

const ADMIN_SETTINGS_KEY = "google_sheets:admin";

function parseAdminTokens(raw: string | null | undefined): StoredGoogleSheetsTokens | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredGoogleSheetsTokens;
    if (!parsed.refreshToken) return null;
    return {
      refreshToken: parsed.refreshToken,
      accessToken: parsed.accessToken ?? null,
      tokenExpiry: parsed.tokenExpiry ? new Date(parsed.tokenExpiry) : null,
      email: parsed.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function loadGoogleSheetsTokens(ownerKey: string): Promise<StoredGoogleSheetsTokens | null> {
  if (ownerKey === "admin") {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, ADMIN_SETTINGS_KEY));
    return parseAdminTokens(row?.value);
  }

  const organizerId = Number(ownerKey.replace("organizer:", ""));
  if (!Number.isFinite(organizerId)) return null;

  const [organizer] = await db
    .select({
      refreshToken: organizersTable.googleSheetsRefreshToken,
      accessToken: organizersTable.googleSheetsAccessToken,
      tokenExpiry: organizersTable.googleSheetsTokenExpiry,
      email: organizersTable.googleSheetsConnectedEmail,
    })
    .from(organizersTable)
    .where(eq(organizersTable.id, organizerId));

  if (!organizer?.refreshToken) return null;
  return {
    refreshToken: organizer.refreshToken,
    accessToken: organizer.accessToken ?? null,
    tokenExpiry: organizer.tokenExpiry ?? null,
    email: organizer.email ?? null,
  };
}

export async function saveGoogleSheetsTokens(
  ownerKey: string,
  tokens: StoredGoogleSheetsTokens,
): Promise<void> {
  if (ownerKey === "admin") {
    const value = JSON.stringify({
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      tokenExpiry: tokens.tokenExpiry?.toISOString() ?? null,
      email: tokens.email,
    });
    await db
      .insert(settingsTable)
      .values({ key: ADMIN_SETTINGS_KEY, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
    return;
  }

  const organizerId = Number(ownerKey.replace("organizer:", ""));
  if (!Number.isFinite(organizerId)) return;

  await db
    .update(organizersTable)
    .set({
      googleSheetsRefreshToken: tokens.refreshToken,
      googleSheetsAccessToken: tokens.accessToken,
      googleSheetsTokenExpiry: tokens.tokenExpiry,
      googleSheetsConnectedEmail: tokens.email,
    })
    .where(eq(organizersTable.id, organizerId));
}

export async function getGoogleSheetsConnectionStatus(ownerKey: string): Promise<{ connected: boolean; email: string | null }> {
  const tokens = await loadGoogleSheetsTokens(ownerKey);
  return {
    connected: !!tokens?.refreshToken,
    email: tokens?.email ?? null,
  };
}
