import { loadGoogleSheetsTokens, saveGoogleSheetsTokens } from "./google-sheets-token-store.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const PLAYERS_TAB = "Players";

/** BidWar primary amber/gold (hsl 43 96% 56%) and dark foreground (hsl 240 10% 4%). */
const HEADER_BG = { red: 0.984, green: 0.749, blue: 0.141 };
const HEADER_FG = { red: 0.039, green: 0.039, blue: 0.059 };

export const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export class GoogleSheetsTokenExpiredError extends Error {
  constructor() {
    super("GOOGLE_SHEETS_TOKEN_EXPIRED");
    this.name = "GoogleSheetsTokenExpiredError";
  }
}

export class GoogleSheetsNotConnectedError extends Error {
  constructor() {
    super("GOOGLE_SHEETS_NOT_CONNECTED");
    this.name = "GoogleSheetsNotConnectedError";
  }
}

function columnIndexToLetter(index: number): string {
  let n = index;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
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
      throw new GoogleSheetsTokenExpiredError();
    }
    throw new Error(body.error ?? "Failed to refresh Google access token.");
  }
  return { access_token: body.access_token, expires_in: body.expires_in ?? 3600 };
}

export async function getValidAccessToken(ownerKey: string): Promise<string> {
  const stored = await loadGoogleSheetsTokens(ownerKey);
  if (!stored?.refreshToken) {
    throw new GoogleSheetsNotConnectedError();
  }

  const now = Date.now();
  const expiryMs = stored.tokenExpiry?.getTime() ?? 0;
  if (stored.accessToken && expiryMs > now + 60_000) {
    return stored.accessToken;
  }

  try {
    const refreshed = await exchangeRefreshToken(stored.refreshToken);
    const tokenExpiry = new Date(now + refreshed.expires_in * 1000);
    await saveGoogleSheetsTokens(ownerKey, {
      ...stored,
      accessToken: refreshed.access_token,
      tokenExpiry,
    });
    return refreshed.access_token;
  } catch (err) {
    if (err instanceof GoogleSheetsTokenExpiredError) throw err;
    throw err;
  }
}

async function getPlayersSheetId(accessToken: string, spreadsheetId: string): Promise<number> {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json() as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(body.error?.message ?? "Failed to read spreadsheet metadata.");
  }
  const playersSheet = body.sheets?.find((s) => s.properties?.title === PLAYERS_TAB);
  return playersSheet?.properties?.sheetId ?? body.sheets?.[0]?.properties?.sheetId ?? 0;
}

async function applyPlayersSheetFormatting(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  colCount: number,
): Promise<void> {
  const formatRes = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
            cell: {
              userEnteredFormat: {
                backgroundColor: HEADER_BG,
                textFormat: { bold: true, foregroundColor: HEADER_FG },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: colCount,
            },
          },
        },
      ],
    }),
  });

  if (!formatRes.ok) {
    const errBody = await formatRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errBody.error?.message ?? "Failed to format spreadsheet.");
  }
}

async function writePlayersSheetValues(
  accessToken: string,
  spreadsheetId: string,
  values: string[][],
): Promise<number> {
  if (values.length === 0) {
    throw new Error("No data to write.");
  }

  const clearRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${PLAYERS_TAB}:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!clearRes.ok) {
    const errBody = await clearRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errBody.error?.message ?? "Failed to clear spreadsheet.");
  }

  const colCount = values[0]?.length ?? 0;
  const rowCount = values.length;
  const lastCol = columnIndexToLetter(colCount);

  const valueRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${PLAYERS_TAB}!A1:${lastCol}${rowCount}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    },
  );

  if (!valueRes.ok) {
    const errBody = await valueRes.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(errBody.error?.message ?? "Failed to write player data to spreadsheet.");
  }

  return colCount;
}

export async function createPlayersSpreadsheet(
  accessToken: string,
  title: string,
  values: string[][],
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: PLAYERS_TAB } }],
    }),
  });

  const created = await createRes.json() as {
    spreadsheetId?: string;
    sheets?: Array<{ properties?: { sheetId?: number } }>;
    error?: { message?: string };
  };

  if (!createRes.ok || !created.spreadsheetId) {
    throw new Error(created.error?.message ?? "Failed to create Google Spreadsheet.");
  }

  const spreadsheetId = created.spreadsheetId;
  const sheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;
  const colCount = await writePlayersSheetValues(accessToken, spreadsheetId, values);
  await applyPlayersSheetFormatting(accessToken, spreadsheetId, sheetId, colCount);

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

export async function regeneratePlayersSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  values: string[][],
): Promise<void> {
  const sheetId = await getPlayersSheetId(accessToken, spreadsheetId);
  const colCount = await writePlayersSheetValues(accessToken, spreadsheetId, values);
  await applyPlayersSheetFormatting(accessToken, spreadsheetId, sheetId, colCount);
}
