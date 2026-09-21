import type { Player, Team } from "@workspace/api-client-react";
import { formatPlayerGender } from "@/components/player-gender-select";

export type ExportRosterFormat = "excel" | "pdf";
export type ExportRosterScope = "all" | "multi-sheet" | number;

interface ExportRosterOptions {
  tournamentName?: string;
  players: Player[];
  teams: Team[];
  categories?: { id: number; name: string }[];
  scope: ExportRosterScope;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").trim() || "Tournament";
}

function sanitizeSheetName(name: string, fallback: string): string {
  const clean = name.replace(/[:\\/?*\[\]]/g, " ").trim();
  return (clean.slice(0, 30) || fallback).trim();
}

function buildPlayerRow(
  p: Player,
  teamName: string,
  categoriesMap: Map<number, string>,
  index: number,
) {
  return {
    "Serial #": p.serialNo ?? (index + 1),
    "Jersey #": p.jerseyNumber ? `#${p.jerseyNumber}` : "—",
    "Player Name": p.name || "",
    Team: teamName,
    Role: p.role || "—",
    "Batting Style": p.battingStyle || "—",
    "Bowling Style": p.bowlingStyle || "—",
    Mobile: p.mobileNumber || "—",
    City: p.city || "—",
    Gender: p.gender ? formatPlayerGender(p.gender) : "—",
    Category: p.categoryId ? categoriesMap.get(p.categoryId) || "—" : "—",
  };
}

export async function exportCricketRosterToExcel({
  tournamentName = "Tournament",
  players,
  teams,
  categories = [],
  scope,
}: ExportRosterOptions): Promise<void> {
  if (players.length === 0) {
    throw new Error("No players available to export.");
  }

  const sortedPlayers = [...players].sort((a, b) => (a.serialNo ?? a.id) - (b.serialNo ?? b.id));
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const teamById = new Map<number, Team>();
  for (const t of teams) teamById.set(t.id, t);
  const catMap = new Map<number, string>();
  for (const c of categories) catMap.set(c.id, c.name);

  const colWidths = [
    { wch: 10 }, // Serial #
    { wch: 10 }, // Jersey #
    { wch: 26 }, // Player Name
    { wch: 22 }, // Team
    { wch: 18 }, // Role
    { wch: 18 }, // Batting Style
    { wch: 20 }, // Bowling Style
    { wch: 15 }, // Mobile
    { wch: 15 }, // City
    { wch: 12 }, // Gender
    { wch: 15 }, // Category
  ];

  if (typeof scope === "number") {
    // Single Team Excel
    const team = teamById.get(scope);
    const teamName = team?.name || `Team #${scope}`;
    const teamPlayers = sortedPlayers.filter((p) => p.teamId === scope);
    const rows = teamPlayers.map((p, idx) => buildPlayerRow(p, teamName, catMap, idx));
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Player Name": "No players in team" }]);
    ws["!cols"] = colWidths;
    const sheetName = sanitizeSheetName(teamName, "Team");
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const filename = `${sanitizeFilename(tournamentName)}-${sanitizeFilename(teamName)}-Roster.xlsx`;
    XLSX.writeFile(wb, filename);
    return;
  }

  if (scope === "multi-sheet") {
    // Multi-sheet Excel: One sheet per team + unassigned + all players
    const allRows = sortedPlayers.map((p, idx) => {
      const t = p.teamId != null ? teamById.get(p.teamId) : undefined;
      return buildPlayerRow(p, t?.name || "Unassigned", catMap, idx);
    });
    const allWs = XLSX.utils.json_to_sheet(allRows);
    allWs["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, allWs, "All Players");

    const usedSheetNames = new Set<string>(["All Players"]);

    for (const team of teams) {
      const teamPlayers = sortedPlayers.filter((p) => p.teamId === team.id);
      const rows = teamPlayers.map((p, idx) => buildPlayerRow(p, team.name, catMap, idx));
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Player Name": "No players" }]);
      ws["!cols"] = colWidths;
      let sName = sanitizeSheetName(team.name, `Team_${team.id}`);
      let counter = 1;
      while (usedSheetNames.has(sName)) {
        sName = sanitizeSheetName(`${team.name.slice(0, 26)} (${counter++})`, `Team_${team.id}`);
      }
      usedSheetNames.add(sName);
      XLSX.utils.book_append_sheet(wb, ws, sName);
    }

    const unassigned = sortedPlayers.filter((p) => p.teamId == null);
    if (unassigned.length > 0) {
      const rows = unassigned.map((p, idx) => buildPlayerRow(p, "Unassigned", catMap, idx));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, "Unassigned");
    }

    const filename = `${sanitizeFilename(tournamentName)}-TeamWise-Roster.xlsx`;
    XLSX.writeFile(wb, filename);
    return;
  }

  // Scope: "all" — Single sheet with all players
  const allRows = sortedPlayers.map((p, idx) => {
    const t = p.teamId != null ? teamById.get(p.teamId) : undefined;
    return buildPlayerRow(p, t?.name || "Unassigned", catMap, idx);
  });
  const ws = XLSX.utils.json_to_sheet(allRows);
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, "Players");
  const filename = `${sanitizeFilename(tournamentName)}-Players-Roster.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportCricketRosterToPdf({
  tournamentName = "Tournament",
  players,
  teams,
  categories = [],
  scope,
}: ExportRosterOptions): Promise<void> {
  if (players.length === 0) {
    throw new Error("No players available to export.");
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const teamById = new Map<number, Team>();
  for (const t of teams) teamById.set(t.id, t);
  const catMap = new Map<number, string>();
  for (const c of categories) catMap.set(c.id, c.name);

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  const bottomLimit = pageHeight - 20;

  // Column definitions for PDF
  const cols = [
    { header: "#", width: 14, align: "center" as const },
    { header: "Player Name", width: 48, align: "left" as const },
    { header: "Role", width: 32, align: "left" as const },
    { header: "Batting", width: 28, align: "left" as const },
    { header: "Bowling", width: 34, align: "left" as const },
    { header: "Mobile", width: 26, align: "left" as const },
  ];

  let currentY = 16;

  function drawDocHeader(title: string, subtitle: string) {
    // Top banner background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(marginX, currentY, contentWidth, 16, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title.slice(0, 48), marginX + 4, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(subtitle, marginX + 4, currentY + 12);

    const rightText = "BIDWAR SPORTS";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text(rightText, marginX + contentWidth - 4, currentY + 7, { align: "right" });

    currentY += 21;
  }

  function drawTableHeader() {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(marginX, currentY, contentWidth, 7, "F");
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + 7, marginX + contentWidth, currentY + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600

    let curX = marginX;
    for (const col of cols) {
      const textX = col.align === "center" ? curX + col.width / 2 : curX + 2;
      doc.text(col.header, textX, currentY + 4.8, { align: col.align });
      curX += col.width;
    }
    currentY += 7;
  }

  function drawTeamHeader(teamName: string, shortCode?: string | null, count = 0) {
    if (currentY + 24 > bottomLimit) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(marginX, currentY, contentWidth, 8, "FD");

    // Left accent strip
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(marginX, currentY, 2.5, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const label = shortCode ? `[${shortCode}] ${teamName}` : teamName;
    doc.text(label, marginX + 6, currentY + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${count} ${count === 1 ? "player" : "players"}`, marginX + contentWidth - 4, currentY + 5.5, {
      align: "right",
    });

    currentY += 9;
    drawTableHeader();
  }

  function drawPlayerRow(p: Player, idx: number) {
    const rowHeight = 6.2;
    if (currentY + rowHeight > bottomLimit) {
      doc.addPage();
      currentY = 16;
      drawTableHeader();
    }

    // Alternating row background
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
    }

    // Bottom border
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.15);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    const values = [
      String(p.serialNo ?? (idx + 1)),
      p.jerseyNumber ? `${p.name} (#${p.jerseyNumber})` : (p.name || "—"),
      p.role || "—",
      p.battingStyle || "—",
      p.bowlingStyle || "—",
      p.mobileNumber || "—",
    ];

    let curX = marginX;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const val = values[i];
      const textX = col.align === "center" ? curX + col.width / 2 : curX + 2;

      if (i === 1) {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }

      // Truncate if too long for column
      const maxChars = Math.floor(col.width * 0.45);
      const truncated = val.length > maxChars ? `${val.slice(0, maxChars - 2)}..` : val;
      doc.text(truncated, textX, currentY + 4.3, { align: col.align });

      curX += col.width;
    }

    currentY += rowHeight;
  }

  const sortedPlayers = [...players].sort((a, b) => (a.serialNo ?? a.id) - (b.serialNo ?? b.id));

  // Render content based on scope
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (typeof scope === "number") {
    // Single Team PDF
    const team = teamById.get(scope);
    const teamName = team?.name || `Team #${scope}`;
    const teamPlayers = sortedPlayers.filter((p) => p.teamId === scope);

    drawDocHeader(`${tournamentName} — ${teamName}`, `Official Squad Roster · Generated on ${dateStr}`);
    drawTeamHeader(teamName, team?.shortCode, teamPlayers.length);

    teamPlayers.forEach((p, idx) => drawPlayerRow(p, idx));

    // Page numbering and footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`${tournamentName} · ${teamName}`, marginX, pageHeight - 8);
      doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth, pageHeight - 8, { align: "right" });
    }

    const filename = `${sanitizeFilename(tournamentName)}-${sanitizeFilename(teamName)}-Roster.pdf`;
    doc.save(filename);
    return;
  }

  // All Teams PDF
  drawDocHeader(tournamentName, `Complete Tournament Scoring Roster · Total ${sortedPlayers.length} Players · ${dateStr}`);

  // Group by team
  for (const team of teams) {
    const teamPlayers = sortedPlayers.filter((p) => p.teamId === team.id);
    if (teamPlayers.length === 0) continue;
    drawTeamHeader(team.name, team.shortCode, teamPlayers.length);
    teamPlayers.forEach((p, idx) => drawPlayerRow(p, idx));
    currentY += 4; // spacing between teams
  }

  const unassigned = sortedPlayers.filter((p) => p.teamId == null);
  if (unassigned.length > 0) {
    drawTeamHeader("Players without Team", undefined, unassigned.length);
    unassigned.forEach((p, idx) => drawPlayerRow(p, idx));
  }

  // Page numbering and footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${tournamentName} — Scoring Roster`, marginX, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth, pageHeight - 8, { align: "right" });
  }

  const filename = `${sanitizeFilename(tournamentName)}-Scoring-Roster.pdf`;
  doc.save(filename);
}
