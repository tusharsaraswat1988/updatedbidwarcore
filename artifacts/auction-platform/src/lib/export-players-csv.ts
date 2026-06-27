import {
  buildPlayerExportRows,
  type ExportCategoryMap,
  type ExportTeamMap,
} from "@workspace/api-base";

function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportPlayersToCsv(
  players: Record<string, unknown>[],
  catMap: ExportCategoryMap,
  teamMap: ExportTeamMap,
  fileName: string,
): void {
  if (players.length === 0) {
    throw new Error("No players to export.");
  }

  const rows = buildPlayerExportRows(players, catMap, teamMap);
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
