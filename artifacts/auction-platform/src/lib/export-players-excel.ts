import {
  buildPlayerExportRows,
  type ExportCategoryMap,
  type ExportTeamMap,
} from "@workspace/api-base/export-players-rows";
import type { RegistrationCustomQuestion } from "@workspace/api-base/registration-fields";

export async function exportPlayersToExcel(
  players: Record<string, unknown>[],
  catMap: ExportCategoryMap,
  teamMap: ExportTeamMap,
  fileName: string,
  sportId?: string | null,
  customQuestions?: RegistrationCustomQuestion[] | null,
): Promise<void> {
  if (players.length === 0) {
    throw new Error("No players to export.");
  }

  const rows = buildPlayerExportRows(players, catMap, teamMap, sportId, customQuestions);
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Players");
  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

export { buildPlayerExportRows } from "@workspace/api-base/export-players-rows";
