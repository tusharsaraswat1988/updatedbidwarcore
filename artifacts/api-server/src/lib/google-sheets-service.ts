import { loadGoogleSheetsTokens, saveGoogleSheetsTokens } from "./google-sheets-token-store.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/** BidWar primary amber/gold (hsl 43 96% 56%) and dark foreground (hsl 240 10% 4%). */
const HEADER_BG = { red: 0.984, green: 0.749, blue: 0.141 };
const HEADER_FG = { red: 0.039, green: 0.039, blue: 0.059 };

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  sold: "Sold",
  retained: "Retained",
  unsold: "Unsold",
  withdrawn: "Withdrawn",
};

export const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export interface PlayerSheetRow {
  serialNo: string | number;
  name: string;
  mobile: string;
  gender: string;
  category: string;
  team: string;
  status: string;
  baseValue: string | number;
  soldValue: string | number;
}

function formatGender(code: string | null | undefined): string {
  if (code === "M") return "Male";
  if (code === "F") return "Female";
  return "";
}

export function buildPlayerSheetRows(
  players: Array<{
    serialNo?: number | null;
    id?: number;
    name?: string | null;
    mobileNumber?: string | null;
    gender?: string | null;
    categoryId?: number | null;
    teamId?: number | null;
    status?: string | null;
    basePrice?: number | null;
    soldPrice?: number | null;
  }>,
  catMap: Record<number, string>,
  teamMap: Record<number, string>,
): PlayerSheetRow[] {
  return players.map((p) => ({
    serialNo: p.serialNo ?? p.id ?? "",
    name: p.name ?? "",
    mobile: p.mobileNumber ?? "",
    gender: formatGender(p.gender),
    category: p.categoryId ? (catMap[p.categoryId] ?? "") : "",
    team: p.teamId ? (teamMap[p.teamId] ?? "") : "",
    status: STATUS_LABELS[String(p.status ?? "")] ?? String(p.status ?? ""),
    baseValue: p.basePrice ?? "",
    soldValue: p.soldPrice ?? "",
  }));
}

const HEADERS = [
  "Serial No",
  "Player Name",
  "Mobile",
  "Gender",
  "Category",
  "Team",
  "Status",
  "Base Value",
  "Sold Value",
] as const;

function rowsToValues(rows: PlayerSheetRow[]): string[][] {
  const data = rows.map((r) => [
    String(r.serialNo),
    r.name,
    r.mobile,
    r.gender,
    r.category,
    r.team,
    r.status,
    r.baseValue === "" ? "" : String(r.baseValue),
    r.soldValue === "" ? "" : String(r.soldValue),
  ]);
  return [HEADERS.slice(), ...data];
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
    throw new Error(body.error ?? "Failed to refresh Google access token.");
  }
  return { access_token: body.access_token, expires_in: body.expires_in ?? 3600 };
}

export async function getValidAccessToken(ownerKey: string): Promise<string> {
  const stored = await loadGoogleSheetsTokens(ownerKey);
  if (!stored?.refreshToken) {
    throw new Error("GOOGLE_SHEETS_NOT_CONNECTED");
  }

  const now = Date.now();
  const expiryMs = stored.tokenExpiry?.getTime() ?? 0;
  if (stored.accessToken && expiryMs > now + 60_000) {
    return stored.accessToken;
  }

  const refreshed = await exchangeRefreshToken(stored.refreshToken);
  const tokenExpiry = new Date(now + refreshed.expires_in * 1000);
  await saveGoogleSheetsTokens(ownerKey, {
    ...stored,
    accessToken: refreshed.access_token,
    tokenExpiry,
  });
  return refreshed.access_token;
}

export async function createPlayersSpreadsheet(
  accessToken: string,
  title: string,
  rows: PlayerSheetRow[],
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const values = rowsToValues(rows);

  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: "Players" } }],
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
  const colCount = HEADERS.length;
  const rowCount = values.length;

  const valueRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/Players!A1:${String.fromCharCode(64 + colCount)}${rowCount}?valueInputOption=USER_ENTERED`,
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

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}
