const PENDING_EXPORT_KEY = "bidwar_pending_google_sheets_export";

export interface PendingGoogleSheetsExport {
  tournamentId: number;
  playerIds: number[];
}

export interface GoogleSheetsExportResult {
  spreadsheetUrl: string;
  spreadsheetId: string;
  playerCount: number;
}

export class GoogleSheetsAuthRequiredError extends Error {
  constructor() {
    super("Google account connection required");
    this.name = "GoogleSheetsAuthRequiredError";
  }
}

export function savePendingGoogleSheetsExport(payload: PendingGoogleSheetsExport): void {
  try {
    sessionStorage.setItem(PENDING_EXPORT_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage unavailable
  }
}

export function readPendingGoogleSheetsExport(tournamentId: number): PendingGoogleSheetsExport | null {
  try {
    const raw = sessionStorage.getItem(PENDING_EXPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingGoogleSheetsExport;
    if (parsed.tournamentId !== tournamentId || !Array.isArray(parsed.playerIds) || parsed.playerIds.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingGoogleSheetsExport(): void {
  try {
    sessionStorage.removeItem(PENDING_EXPORT_KEY);
  } catch {
    // ignore
  }
}

export function googleSheetsConnectUrl(returnPath: string): string {
  return `/api/google/sheets/connect?next=${encodeURIComponent(returnPath)}`;
}

export async function exportPlayersToGoogleSheetsApi(
  tournamentId: number,
  playerIds: number[],
): Promise<GoogleSheetsExportResult> {
  const res = await fetch(`/api/tournaments/${tournamentId}/players/export/google-sheets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIds }),
  });

  const body = await res.json().catch(() => ({})) as {
    error?: string;
    needsGoogleAuth?: boolean;
    spreadsheetUrl?: string;
    spreadsheetId?: string;
    playerCount?: number;
  };

  if (res.status === 401 || (res.status === 403 && body.needsGoogleAuth)) {
    throw new GoogleSheetsAuthRequiredError();
  }

  if (!res.ok) {
    throw new Error(body.error ?? "Failed to export to Google Sheets.");
  }

  if (!body.spreadsheetUrl) {
    throw new Error("Export succeeded but no spreadsheet URL was returned.");
  }

  return {
    spreadsheetUrl: body.spreadsheetUrl,
    spreadsheetId: body.spreadsheetId ?? "",
    playerCount: body.playerCount ?? playerIds.length,
  };
}
