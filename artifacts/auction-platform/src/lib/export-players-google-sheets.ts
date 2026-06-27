const PENDING_CONNECT_KEY = "bidwar_pending_google_sheets_connect";

export type GoogleSheetSyncStatus = "CONNECTED" | "SYNCING" | "ERROR" | "DISCONNECTED" | null;

export interface GoogleSheetsStatus {
  googleConnected: boolean;
  googleAccountEmail: string | null;
  sheetConfigured: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  syncStatus: GoogleSheetSyncStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface GoogleSheetsSyncResult {
  spreadsheetUrl: string;
  spreadsheetId: string;
  playerCount: number;
  created?: boolean;
}

export class GoogleSheetsAuthRequiredError extends Error {
  constructor() {
    super("Google account connection required");
    this.name = "GoogleSheetsAuthRequiredError";
  }
}

export function savePendingGoogleSheetsConnect(tournamentId: number): void {
  try {
    sessionStorage.setItem(PENDING_CONNECT_KEY, String(tournamentId));
  } catch {
    // sessionStorage unavailable
  }
}

export function readPendingGoogleSheetsConnect(tournamentId: number): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_CONNECT_KEY);
    return raw === String(tournamentId);
  } catch {
    return false;
  }
}

export function clearPendingGoogleSheetsConnect(): void {
  try {
    sessionStorage.removeItem(PENDING_CONNECT_KEY);
  } catch {
    // ignore
  }
}

export function googleSheetsConnectUrl(returnPath: string): string {
  return `/api/google/sheets/connect?next=${encodeURIComponent(returnPath)}`;
}

function parseApiError(body: { error?: string; needsGoogleAuth?: boolean }, res: Response): never {
  if (res.status === 401 || (res.status === 403 && body.needsGoogleAuth)) {
    throw new GoogleSheetsAuthRequiredError();
  }
  throw new Error(body.error ?? "Google Sheets request failed.");
}

export async function fetchGoogleSheetsStatus(tournamentId: number): Promise<GoogleSheetsStatus> {
  const res = await fetch(`/api/google/sheets/status?tournamentId=${tournamentId}`, {
    credentials: "include",
  });
  const body = await res.json().catch(() => ({})) as GoogleSheetsStatus & { error?: string };
  if (!res.ok) {
    parseApiError(body, res);
  }
  return body;
}

export async function connectAndSyncGoogleSheet(tournamentId: number): Promise<GoogleSheetsSyncResult> {
  const res = await fetch("/api/google/sheets/sync", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tournamentId }),
  });

  const body = await res.json().catch(() => ({})) as GoogleSheetsSyncResult & {
    error?: string;
    needsGoogleAuth?: boolean;
  };

  if (!res.ok) {
    parseApiError(body, res);
  }

  if (!body.spreadsheetUrl) {
    throw new Error("Sync succeeded but no spreadsheet URL was returned.");
  }

  return {
    spreadsheetUrl: body.spreadsheetUrl,
    spreadsheetId: body.spreadsheetId ?? "",
    playerCount: body.playerCount ?? 0,
    created: body.created,
  };
}

export async function syncGoogleSheetNow(tournamentId: number): Promise<GoogleSheetsSyncResult> {
  const res = await fetch("/api/google/sheets/sync-now", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tournamentId }),
  });

  const body = await res.json().catch(() => ({})) as GoogleSheetsSyncResult & {
    error?: string;
    needsGoogleAuth?: boolean;
  };

  if (!res.ok) {
    parseApiError(body, res);
  }

  if (!body.spreadsheetUrl) {
    throw new Error("Sync succeeded but no spreadsheet URL was returned.");
  }

  return {
    spreadsheetUrl: body.spreadsheetUrl,
    spreadsheetId: body.spreadsheetId ?? "",
    playerCount: body.playerCount ?? 0,
  };
}

export async function disconnectGoogleSheet(tournamentId: number): Promise<void> {
  const res = await fetch("/api/google/sheets/disconnect", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tournamentId }),
  });

  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "Failed to disconnect Google Sheet.");
  }
}

export async function openGoogleSheetUrl(tournamentId: number): Promise<string> {
  const res = await fetch(`/api/google/sheets/open?tournamentId=${tournamentId}`, {
    credentials: "include",
  });
  const body = await res.json().catch(() => ({})) as { spreadsheetUrl?: string; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not open Google Sheet.");
  }
  if (!body.spreadsheetUrl) {
    throw new Error("No spreadsheet URL available.");
  }
  return body.spreadsheetUrl;
}

/** @deprecated Use connectAndSyncGoogleSheet — syncs all tournament players */
export async function exportPlayersToGoogleSheetsApi(
  tournamentId: number,
  _playerIds?: number[],
): Promise<GoogleSheetsSyncResult> {
  return connectAndSyncGoogleSheet(tournamentId);
}

export function formatLastSyncedAt(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Unknown";
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
