import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  tournamentsTable, teamsTable, categoriesTable, playersTable,
} from "@workspace/db";
import { and, eq, inArray, gte, lte, ilike, desc } from "drizzle-orm";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { z } from "zod";

const filtersSchema = z.object({
  categoryIds: z.array(z.number().int()).optional(),
  teamIds: z.array(z.number().int()).optional(),
  statuses: z.array(z.enum(["available", "sold", "unsold", "retained"])).optional(),
  roles: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  search: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
}).strict();

const previewBodySchema = z.object({
  type: z.string().min(1),
  filters: filtersSchema.optional(),
});

const exportBodySchema = z.object({
  type: z.string().min(1),
  format: z.enum(["pdf", "xlsx", "csv"]),
  filters: filtersSchema.optional(),
});

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.isAdmin && req.session.adminLevel === "master") { next(); return; }
  res.status(403).json({ error: "Master admin access required" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Filters = {
  categoryIds?: number[];
  teamIds?: number[];
  statuses?: string[];        // available | sold | unsold | retained
  roles?: string[];
  cities?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
};

type Column = {
  key: string;
  label: string;
  width?: number;             // PDF + Excel relative width
  format?: (v: unknown, row: Record<string, unknown>) => string;
};

type ReportSection = {
  heading?: string;
  columns: Column[];
  rows: Record<string, unknown>[];
};

type ReportData = {
  reportTitle: string;
  tournamentName: string;
  tournamentSport: string;
  generatedAt: string;
  filtersApplied: string[];
  summary?: { label: string; value: string }[];
  sections: ReportSection[];
};

type ReportType = {
  id: string;
  title: string;
  description: string;
  category: "pre" | "live" | "post" | "directory";
};

// ─── Report catalogue ─────────────────────────────────────────────────────────

const REPORT_TYPES: ReportType[] = [
  { id: "master_catalogue", title: "Master Player Catalogue", description: "Full player registry with role, base price and status.", category: "pre" },
  { id: "category_wise", title: "Category-Wise Player List", description: "Players grouped by category (Platinum, Gold, Silver, etc.).", category: "pre" },
  { id: "city_wise", title: "City-Wise Player List", description: "Players grouped by city of origin.", category: "pre" },
  { id: "contact_directory", title: "Player Contact Directory", description: "Player names, mobile numbers, role and city.", category: "directory" },
  { id: "sold_players", title: "Sold Player Report", description: "All sold players with team, price and category.", category: "live" },
  { id: "unsold_players", title: "Unsold Player Report", description: "Players that did not get sold (re-auction candidates).", category: "live" },
  { id: "top_sold", title: "Top Sold Players", description: "Top 25 most expensive sold players.", category: "live" },
  { id: "team_squad", title: "Team Squad Sheet", description: "Per-team sold + retained squad.", category: "post" },
  { id: "team_purse", title: "Team Purse Breakdown", description: "Purse used, remaining and player count for each team.", category: "post" },
  { id: "financial_summary", title: "Financial Summary", description: "KPIs: total spend, average bid, highest bid, sold/unsold counts.", category: "post" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRupee(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  // Indian formatting: 1,00,00,000
  const s = Math.abs(Math.round(n)).toString();
  let result;
  if (s.length <= 3) result = s;
  else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    result = rest.replace(/(\d)(?=(\d\d)+$)/g, "$1,") + "," + last3;
  }
  return `₹${n < 0 ? "-" : ""}${result}`;
}

function fmtShortRupee(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)} K`;
  return `₹${n}`;
}

function fmtText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function buildFiltersDescription(f: Filters, ctx: { categories: Map<number, string>; teams: Map<number, string> }): string[] {
  const out: string[] = [];
  if (f.categoryIds?.length) out.push(`Categories: ${f.categoryIds.map(id => ctx.categories.get(id) ?? `#${id}`).join(", ")}`);
  if (f.teamIds?.length) out.push(`Teams: ${f.teamIds.map(id => ctx.teams.get(id) ?? `#${id}`).join(", ")}`);
  if (f.statuses?.length) out.push(`Status: ${f.statuses.join(", ")}`);
  if (f.roles?.length) out.push(`Role: ${f.roles.join(", ")}`);
  if (f.cities?.length) out.push(`Cities: ${f.cities.join(", ")}`);
  if (f.search) out.push(`Name contains: ${f.search}`);
  if (f.minPrice !== undefined) out.push(`Min price: ${fmtRupee(f.minPrice)}`);
  if (f.maxPrice !== undefined) out.push(`Max price: ${fmtRupee(f.maxPrice)}`);
  return out;
}

async function loadContext(tournamentId: number) {
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) return null;
  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tournamentId));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tournamentId));
  const teamMap = new Map(teams.map(t => [t.id, t.name]));
  const teamColorMap = new Map(teams.map(t => [t.id, t.color ?? "#3B82F6"]));
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  return { tournament, teams, categories, teamMap, teamColorMap, categoryMap };
}

async function loadFilteredPlayers(tournamentId: number, f: Filters) {
  const conditions = [eq(playersTable.tournamentId, tournamentId)];
  if (f.categoryIds?.length) conditions.push(inArray(playersTable.categoryId, f.categoryIds));
  if (f.teamIds?.length) conditions.push(inArray(playersTable.teamId, f.teamIds));
  if (f.statuses?.length) conditions.push(inArray(playersTable.status, f.statuses));
  if (f.roles?.length) conditions.push(inArray(playersTable.role, f.roles));
  if (f.cities?.length) conditions.push(inArray(playersTable.city, f.cities));
  if (f.search) conditions.push(ilike(playersTable.name, `%${f.search}%`));
  if (f.minPrice !== undefined) conditions.push(gte(playersTable.soldPrice, f.minPrice));
  if (f.maxPrice !== undefined) conditions.push(lte(playersTable.soldPrice, f.maxPrice));
  return await db.select().from(playersTable).where(and(...conditions)).orderBy(playersTable.name);
}

// ─── Report builders ──────────────────────────────────────────────────────────

const PLAYER_COLUMNS: Column[] = [
  { key: "name", label: "Name", width: 1.6 },
  { key: "role", label: "Role", width: 1, format: v => fmtText(v).replace(/_/g, " ") },
  { key: "city", label: "City", width: 1.1, format: v => fmtText(v) },
  { key: "categoryName", label: "Category", width: 1, format: v => fmtText(v) },
  { key: "basePrice", label: "Base Price", width: 1.1, format: v => fmtShortRupee(v as number) },
  { key: "status", label: "Status", width: 0.8, format: v => fmtText(v).toUpperCase() },
  { key: "teamName", label: "Team", width: 1.1, format: v => fmtText(v) },
  { key: "soldPrice", label: "Sold Price", width: 1.1, format: v => fmtShortRupee(v as number) },
];

const CONTACT_COLUMNS: Column[] = [
  { key: "name", label: "Name", width: 1.6 },
  { key: "mobileNumber", label: "Mobile", width: 1.3, format: v => fmtText(v) },
  { key: "role", label: "Role", width: 1, format: v => fmtText(v).replace(/_/g, " ") },
  { key: "city", label: "City", width: 1.2, format: v => fmtText(v) },
  { key: "teamName", label: "Team", width: 1.2, format: v => fmtText(v) },
  { key: "status", label: "Status", width: 0.8, format: v => fmtText(v).toUpperCase() },
];

const TEAM_PURSE_COLUMNS: Column[] = [
  { key: "name", label: "Team", width: 2 },
  { key: "shortCode", label: "Code", width: 0.6 },
  { key: "playerCount", label: "Players", width: 0.7 },
  { key: "purse", label: "Purse", width: 1.1, format: v => fmtShortRupee(v as number) },
  { key: "purseUsed", label: "Spent", width: 1.1, format: v => fmtShortRupee(v as number) },
  { key: "purseRemaining", label: "Remaining", width: 1.1, format: v => fmtShortRupee(v as number) },
  { key: "utilization", label: "Used %", width: 0.7, format: v => `${(v as number).toFixed(1)}%` },
];

async function buildReport(typeId: string, tournamentId: number, filters: Filters): Promise<ReportData | null> {
  const ctx = await loadContext(tournamentId);
  if (!ctx) return null;
  const t = ctx.tournament;
  const generatedAt = new Date().toISOString();
  const filtersApplied = buildFiltersDescription(filters, { categories: ctx.categoryMap, teams: ctx.teamMap });

  const enrich = (p: typeof playersTable.$inferSelect) => ({
    ...p,
    teamName: p.teamId ? ctx.teamMap.get(p.teamId) ?? null : null,
    categoryName: p.categoryId ? ctx.categoryMap.get(p.categoryId) ?? null : null,
  });

  const meta = REPORT_TYPES.find(r => r.id === typeId);
  const reportTitle = meta?.title ?? typeId;

  const baseHeader = {
    reportTitle,
    tournamentName: t.name,
    tournamentSport: t.sport,
    generatedAt,
    filtersApplied,
  };

  if (typeId === "master_catalogue") {
    const players = (await loadFilteredPlayers(tournamentId, filters)).map(enrich);
    return {
      ...baseHeader,
      summary: [
        { label: "Total Players", value: String(players.length) },
        { label: "Sold", value: String(players.filter(p => p.status === "sold").length) },
        { label: "Unsold", value: String(players.filter(p => p.status === "unsold").length) },
        { label: "Available", value: String(players.filter(p => p.status === "available").length) },
      ],
      sections: [{ columns: PLAYER_COLUMNS, rows: players as unknown as Record<string, unknown>[] }],
    };
  }

  if (typeId === "category_wise") {
    const players = (await loadFilteredPlayers(tournamentId, filters)).map(enrich);
    const sections: ReportSection[] = [];
    for (const cat of ctx.categories) {
      const rows = players.filter(p => p.categoryId === cat.id);
      if (rows.length) sections.push({ heading: `${cat.name} (${rows.length})`, columns: PLAYER_COLUMNS, rows: rows as unknown as Record<string, unknown>[] });
    }
    const uncategorised = players.filter(p => !p.categoryId);
    if (uncategorised.length) sections.push({ heading: `Uncategorised (${uncategorised.length})`, columns: PLAYER_COLUMNS, rows: uncategorised as unknown as Record<string, unknown>[] });
    return { ...baseHeader, summary: [{ label: "Categories", value: String(sections.length) }, { label: "Players", value: String(players.length) }], sections };
  }

  if (typeId === "city_wise") {
    const players = (await loadFilteredPlayers(tournamentId, filters)).map(enrich);
    const groups = new Map<string, typeof players>();
    for (const p of players) {
      const key = p.city?.trim() || "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const sections = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([city, rows]) => ({ heading: `${city} (${rows.length})`, columns: PLAYER_COLUMNS, rows: rows as unknown as Record<string, unknown>[] }));
    return { ...baseHeader, summary: [{ label: "Cities", value: String(groups.size) }, { label: "Players", value: String(players.length) }], sections };
  }

  if (typeId === "contact_directory") {
    const players = (await loadFilteredPlayers(tournamentId, filters)).map(enrich);
    const withMobile = players.filter(p => p.mobileNumber && p.mobileNumber.trim());
    return {
      ...baseHeader,
      summary: [
        { label: "Players", value: String(players.length) },
        { label: "With Mobile", value: String(withMobile.length) },
      ],
      sections: [{ columns: CONTACT_COLUMNS, rows: players as unknown as Record<string, unknown>[] }],
    };
  }

  if (typeId === "sold_players") {
    const f: Filters = { ...filters, statuses: ["sold"] };
    const players = (await loadFilteredPlayers(tournamentId, f)).map(enrich)
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
    const totalSpend = players.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    const avg = players.length ? totalSpend / players.length : 0;
    return {
      ...baseHeader,
      summary: [
        { label: "Sold Players", value: String(players.length) },
        { label: "Total Spend", value: fmtShortRupee(totalSpend) },
        { label: "Average Bid", value: fmtShortRupee(avg) },
        { label: "Highest Bid", value: fmtShortRupee(players[0]?.soldPrice ?? 0) },
      ],
      sections: [{ columns: PLAYER_COLUMNS, rows: players as unknown as Record<string, unknown>[] }],
    };
  }

  if (typeId === "unsold_players") {
    const f: Filters = { ...filters, statuses: ["unsold"] };
    const players = (await loadFilteredPlayers(tournamentId, f)).map(enrich);
    return {
      ...baseHeader,
      summary: [{ label: "Unsold Players", value: String(players.length) }],
      sections: [{ columns: PLAYER_COLUMNS, rows: players as unknown as Record<string, unknown>[] }],
    };
  }

  if (typeId === "top_sold") {
    const f: Filters = { ...filters, statuses: ["sold"] };
    const all = (await loadFilteredPlayers(tournamentId, f)).map(enrich)
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 25);
    return {
      ...baseHeader,
      summary: [{ label: "Showing", value: `Top ${all.length}` }],
      sections: [{ columns: PLAYER_COLUMNS, rows: all as unknown as Record<string, unknown>[] }],
    };
  }

  if (typeId === "team_squad") {
    const players = (await loadFilteredPlayers(tournamentId, filters)).map(enrich);
    const sections: ReportSection[] = [];
    const teams = filters.teamIds?.length ? ctx.teams.filter(t => filters.teamIds!.includes(t.id)) : ctx.teams;
    for (const team of teams) {
      const rows = players.filter(p => p.teamId === team.id && (p.status === "sold" || p.status === "retained"));
      if (!rows.length) continue;
      const totalSpent = rows.reduce((s, p) => s + (p.soldPrice ?? p.retainedPrice ?? 0), 0);
      sections.push({
        heading: `${team.name}  (${rows.length} players · spent ${fmtShortRupee(totalSpent)} · purse ${fmtShortRupee(team.purse)})`,
        columns: PLAYER_COLUMNS,
        rows: rows as unknown as Record<string, unknown>[],
      });
    }
    return { ...baseHeader, summary: [{ label: "Teams", value: String(sections.length) }], sections };
  }

  if (typeId === "team_purse") {
    const filteredPlayers = await loadFilteredPlayers(tournamentId, filters);
    const counts = new Map<number, number>();
    const spentByTeam = new Map<number, number>();
    for (const p of filteredPlayers) {
      if (p.teamId && (p.status === "sold" || p.status === "retained")) {
        counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
        const amt = p.soldPrice ?? p.retainedPrice ?? 0;
        spentByTeam.set(p.teamId, (spentByTeam.get(p.teamId) ?? 0) + amt);
      }
    }
    const teamScope = filters.teamIds?.length ? ctx.teams.filter(t => filters.teamIds!.includes(t.id)) : ctx.teams;
    const filtersNarrowSpend = !!(filters.categoryIds?.length || filters.statuses?.length || filters.roles?.length || filters.cities?.length || filters.search || filters.minPrice != null || filters.maxPrice != null);
    const rows = teamScope.map(t => {
      const used = filtersNarrowSpend ? (spentByTeam.get(t.id) ?? 0) : t.purseUsed;
      return {
        name: t.name,
        shortCode: t.shortCode,
        playerCount: counts.get(t.id) ?? 0,
        purse: t.purse,
        purseUsed: used,
        purseRemaining: t.purse - used,
        utilization: t.purse > 0 ? (used / t.purse) * 100 : 0,
      };
    }).sort((a, b) => b.purseUsed - a.purseUsed);
    const totalSpent = rows.reduce((s, r) => s + r.purseUsed, 0);
    const totalPurse = rows.reduce((s, r) => s + r.purse, 0);
    return {
      ...baseHeader,
      summary: [
        { label: "Teams", value: String(rows.length) },
        { label: "Total Purse", value: fmtShortRupee(totalPurse) },
        { label: "Spent", value: fmtShortRupee(totalSpent) },
      ],
      sections: [{ columns: TEAM_PURSE_COLUMNS, rows: rows as unknown as Record<string, unknown>[] }],
    };
  }

  if (typeId === "financial_summary") {
    const allPlayers = await loadFilteredPlayers(tournamentId, filters);
    const sold = allPlayers.filter(p => p.status === "sold");
    const unsold = allPlayers.filter(p => p.status === "unsold");
    const retained = allPlayers.filter(p => p.status === "retained");
    const totalSpend = sold.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
    const avg = sold.length ? totalSpend / sold.length : 0;
    const sortedSold = [...sold].sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
    const top = sortedSold.slice(0, 10);
    const cheap = [...sold].sort((a, b) => (a.soldPrice ?? 0) - (b.soldPrice ?? 0)).slice(0, 5);
    return {
      ...baseHeader,
      summary: [
        { label: "Total Players", value: String(allPlayers.length) },
        { label: "Sold", value: String(sold.length) },
        { label: "Unsold", value: String(unsold.length) },
        { label: "Retained", value: String(retained.length) },
        { label: "Total Spend", value: fmtShortRupee(totalSpend) },
        { label: "Average Bid", value: fmtShortRupee(avg) },
        { label: "Highest Bid", value: fmtShortRupee(sortedSold[0]?.soldPrice ?? 0) },
      ],
      sections: [
        { heading: "Top 10 Spends", columns: PLAYER_COLUMNS, rows: top.map(enrich) as unknown as Record<string, unknown>[] },
        { heading: "Lowest 5 Spends", columns: PLAYER_COLUMNS, rows: cheap.map(enrich) as unknown as Record<string, unknown>[] },
      ],
    };
  }

  return null;
}

// ─── PDF renderer ─────────────────────────────────────────────────────────────

function renderPdf(report: ReportData, res: Response): void {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32, bufferPages: true, info: { Title: report.reportTitle, Author: "BidWar" } });
  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  function header() {
    doc.fillColor("#0a0a0a").rect(doc.page.margins.left, doc.page.margins.top, pageWidth, 50).fill();
    doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(18).text("BidWar", doc.page.margins.left + 14, doc.page.margins.top + 10);
    doc.fillColor("#ffffff").font("Helvetica").fontSize(9).text(`${report.tournamentSport.toUpperCase()} · ${report.tournamentName}`, doc.page.margins.left + 14, doc.page.margins.top + 32);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11).text(report.reportTitle, doc.page.margins.left, doc.page.margins.top + 10, { width: pageWidth - 28, align: "right" });
    doc.fillColor("#cbd5e1").font("Helvetica").fontSize(8).text(`Generated: ${new Date(report.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, doc.page.margins.left, doc.page.margins.top + 32, { width: pageWidth - 14, align: "right" });
    doc.fillColor("#000000");
    doc.y = doc.page.margins.top + 60;
  }

  function summary() {
    if (!report.summary?.length) return;
    const boxW = pageWidth / report.summary.length;
    const yTop = doc.y;
    report.summary.forEach((s, i) => {
      const x = doc.page.margins.left + i * boxW;
      doc.roundedRect(x + 3, yTop, boxW - 6, 36, 4).fillAndStroke("#fef3c7", "#fcd34d");
      doc.fillColor("#78350f").font("Helvetica").fontSize(7).text(s.label.toUpperCase(), x + 8, yTop + 5, { width: boxW - 16 });
      doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(13).text(s.value, x + 8, yTop + 16, { width: boxW - 16 });
    });
    doc.fillColor("#000000");
    doc.y = yTop + 44;
  }

  function filtersBlock() {
    if (!report.filtersApplied.length) return;
    doc.fillColor("#475569").font("Helvetica-Oblique").fontSize(8)
      .text(`Filters → ${report.filtersApplied.join("  ·  ")}`, doc.page.margins.left, doc.y, { width: pageWidth });
    doc.moveDown(0.4);
    doc.fillColor("#000000");
  }

  function ensureRoom(needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      header();
      doc.y = doc.page.margins.top + 60;
    }
  }

  function renderSection(section: ReportSection, isFirst: boolean) {
    if (section.heading) {
      ensureRoom(20);
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(section.heading, doc.page.margins.left, doc.y);
      doc.moveDown(0.3);
    }
    if (!section.rows.length) {
      doc.fillColor("#94a3b8").font("Helvetica-Oblique").fontSize(9).text("No data", doc.page.margins.left, doc.y);
      doc.moveDown(0.5);
      return;
    }
    const totalW = section.columns.reduce((s, c) => s + (c.width ?? 1), 0);
    const colWidths = section.columns.map(c => ((c.width ?? 1) / totalW) * pageWidth);

    // header row
    ensureRoom(24);
    const hY = doc.y;
    doc.rect(doc.page.margins.left, hY, pageWidth, 18).fill("#1e293b");
    let x = doc.page.margins.left + 6;
    doc.fillColor("#fbbf24").font("Helvetica-Bold").fontSize(8);
    section.columns.forEach((c, i) => {
      doc.text(c.label.toUpperCase(), x, hY + 5, { width: colWidths[i] - 6, ellipsis: true, lineBreak: false });
      x += colWidths[i];
    });
    doc.fillColor("#000000");
    doc.y = hY + 18;

    // data rows
    section.rows.forEach((row, idx) => {
      ensureRoom(20);
      const rY = doc.y;
      if (idx % 2 === 0) doc.rect(doc.page.margins.left, rY, pageWidth, 16).fill("#f8fafc");
      let cx = doc.page.margins.left + 6;
      doc.fillColor("#0f172a").font("Helvetica").fontSize(8);
      section.columns.forEach((c, i) => {
        const raw = row[c.key];
        const text = c.format ? c.format(raw, row) : fmtText(raw);
        doc.text(text, cx, rY + 4, { width: colWidths[i] - 6, ellipsis: true, lineBreak: false });
        cx += colWidths[i];
      });
      doc.y = rY + 16;
    });
    doc.moveDown(0.6);
    isFirst && void 0;
  }

  header();
  summary();
  filtersBlock();
  report.sections.forEach((s, i) => renderSection(s, i === 0));

  // Footer with page numbers + watermark
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const w = doc.page.width;
    const h = doc.page.height;
    // watermark
    doc.save();
    doc.rotate(-25, { origin: [w / 2, h / 2] });
    doc.fillColor("#000000", 0.04).font("Helvetica-Bold").fontSize(120).text("BidWar", 0, h / 2 - 60, { width: w, align: "center" });
    doc.restore();
    // footer
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7)
      .text(`Page ${i + 1} of ${range.count}  ·  BidWar Report Center  ·  Confidential`, doc.page.margins.left, h - doc.page.margins.bottom + 6, { width: w - doc.page.margins.left - doc.page.margins.right, align: "center" });
  }

  doc.end();
}

// ─── Excel renderer ───────────────────────────────────────────────────────────

async function renderExcel(report: ReportData, res: Response): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BidWar";
  wb.created = new Date();

  for (let si = 0; si < report.sections.length; si++) {
    const section = report.sections[si];
    const sheetName = (section.heading?.split("(")[0].trim() || report.reportTitle).slice(0, 28) + (report.sections.length > 1 ? ` ${si + 1}` : "");
    const sheet = wb.addWorksheet(sheetName.replace(/[\\/?*[\]:]/g, "-"));

    // Title rows
    sheet.mergeCells(1, 1, 1, section.columns.length);
    sheet.getCell(1, 1).value = `${report.tournamentName} — ${report.reportTitle}`;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF0F172A" } };

    sheet.mergeCells(2, 1, 2, section.columns.length);
    sheet.getCell(2, 1).value = `Generated ${new Date(report.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`;
    sheet.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF64748B" } };

    if (section.heading) {
      sheet.mergeCells(3, 1, 3, section.columns.length);
      sheet.getCell(3, 1).value = section.heading;
      sheet.getCell(3, 1).font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
    }

    const headerRowIdx = section.heading ? 5 : 4;
    sheet.getRow(headerRowIdx).values = ["#", ...section.columns.map(c => c.label)];
    sheet.getRow(headerRowIdx).font = { bold: true, color: { argb: "FFFBBF24" } };
    sheet.getRow(headerRowIdx).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    sheet.getRow(headerRowIdx).alignment = { vertical: "middle" };

    section.rows.forEach((row, idx) => {
      const r = sheet.getRow(headerRowIdx + 1 + idx);
      r.values = [idx + 1, ...section.columns.map(c => {
        const raw = row[c.key];
        if (c.format) return c.format(raw, row);
        if (raw === null || raw === undefined) return "";
        return raw as string | number;
      })];
      if (idx % 2 === 0) {
        r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });

    // column widths
    sheet.getColumn(1).width = 5;
    section.columns.forEach((c, i) => {
      sheet.getColumn(i + 2).width = Math.max(12, (c.width ?? 1) * 14);
    });
    sheet.views = [{ state: "frozen", ySplit: headerRowIdx }];
  }

  // Summary sheet
  if (report.summary?.length) {
    const s = wb.addWorksheet("Summary");
    s.getCell(1, 1).value = report.reportTitle;
    s.getCell(1, 1).font = { bold: true, size: 14 };
    s.mergeCells(1, 1, 1, 2);
    s.getCell(2, 1).value = report.tournamentName;
    s.mergeCells(2, 1, 2, 2);
    report.summary.forEach((row, i) => {
      s.getCell(4 + i, 1).value = row.label;
      s.getCell(4 + i, 1).font = { bold: true };
      s.getCell(4 + i, 2).value = row.value;
    });
    if (report.filtersApplied.length) {
      const start = 5 + report.summary.length;
      s.getCell(start, 1).value = "Filters";
      s.getCell(start, 1).font = { bold: true };
      report.filtersApplied.forEach((f, i) => { s.getCell(start + 1 + i, 1).value = f; });
    }
    s.getColumn(1).width = 24;
    s.getColumn(2).width = 30;
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  await wb.xlsx.write(res);
  res.end();
}

// ─── CSV renderer ─────────────────────────────────────────────────────────────

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function renderCsv(report: ReportData, res: Response): void {
  const lines: string[] = [];
  lines.push(`# ${report.tournamentName} - ${report.reportTitle}`);
  lines.push(`# Generated ${new Date(report.generatedAt).toISOString()}`);
  if (report.filtersApplied.length) lines.push(`# Filters: ${report.filtersApplied.join(" | ")}`);
  for (const section of report.sections) {
    lines.push("");
    if (section.heading) lines.push(`# ${section.heading}`);
    lines.push(section.columns.map(c => csvEscape(c.label)).join(","));
    for (const row of section.rows) {
      lines.push(section.columns.map(c => {
        const raw = row[c.key];
        return csvEscape(c.format ? c.format(raw, row) : raw);
      }).join(","));
    }
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.send(lines.join("\n"));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/auth/admin/reports/types", requireMasterAdmin, (_req, res) => {
  res.json({ reports: REPORT_TYPES });
});

router.get("/auth/admin/reports/:tournamentId/context", requireMasterAdmin, async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  if (!Number.isFinite(tournamentId)) { res.status(400).json({ error: "Invalid tournament id" }); return; }
  const ctx = await loadContext(tournamentId);
  if (!ctx) { res.status(404).json({ error: "Tournament not found" }); return; }
  // distinct roles + cities for filter dropdowns
  const allPlayers = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tournamentId));
  const roles = [...new Set(allPlayers.map(p => p.role).filter((r): r is string => !!r))].sort();
  const cities = [...new Set(allPlayers.map(p => p.city).filter((c): c is string => !!c))].sort();
  res.json({
    tournament: { id: ctx.tournament.id, name: ctx.tournament.name, sport: ctx.tournament.sport },
    teams: ctx.teams.map(t => ({ id: t.id, name: t.name, shortCode: t.shortCode, color: t.color })),
    categories: ctx.categories.map(c => ({ id: c.id, name: c.name, colorCode: c.colorCode })),
    roles,
    cities,
    playerCount: allPlayers.length,
  });
});

router.post("/auth/admin/reports/:tournamentId/preview", requireMasterAdmin, async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  if (!Number.isFinite(tournamentId)) { res.status(400).json({ error: "Invalid tournament id" }); return; }
  const parsed = previewBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body", details: parsed.error.issues }); return; }
  if (!REPORT_TYPES.find(r => r.id === parsed.data.type)) { res.status(400).json({ error: "Unknown report type" }); return; }
  const data = await buildReport(parsed.data.type, tournamentId, parsed.data.filters ?? {});
  if (!data) { res.status(404).json({ error: "Report or tournament not found" }); return; }
  res.json(data);
});

router.post("/auth/admin/reports/:tournamentId/export", requireMasterAdmin, async (req, res) => {
  const tournamentId = parseInt(String(req.params.tournamentId));
  if (!Number.isFinite(tournamentId)) { res.status(400).json({ error: "Invalid tournament id" }); return; }
  const parsed = exportBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body", details: parsed.error.issues }); return; }
  if (!REPORT_TYPES.find(r => r.id === parsed.data.type)) { res.status(400).json({ error: "Unknown report type" }); return; }
  const { type, filters, format } = parsed.data;
  const data = await buildReport(type, tournamentId, filters ?? {});
  if (!data) { res.status(404).json({ error: "Report or tournament not found" }); return; }
  const safeName = `${data.tournamentName}-${data.reportTitle}-${new Date().toISOString().slice(0, 10)}`.replace(/[^a-z0-9-]/gi, "_");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}.${format}"`);
  if (format === "pdf") { renderPdf(data, res); return; }
  if (format === "xlsx") { await renderExcel(data, res); return; }
  if (format === "csv") { renderCsv(data, res); return; }
  res.status(400).json({ error: "Unsupported format" });
});

// ── Cheer settings (master admin only) ───────────────────────────────────────

router.patch("/auth/admin/tournaments/:tournamentId/cheer-settings", requireMasterAdmin, async (req, res) => {
  const tid = parseInt(String(req.params.tournamentId));
  if (isNaN(tid)) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const schema = z.object({
    cheerMessagesEnabled: z.boolean().optional(),
    cheerMessagePresets: z.array(z.string().max(120)).min(1).max(10).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.cheerMessagesEnabled !== undefined) {
    updates.cheerMessagesEnabled = parsed.data.cheerMessagesEnabled;
  }
  if (parsed.data.cheerMessagePresets !== undefined) {
    updates.cheerMessagePresets = JSON.stringify(parsed.data.cheerMessagePresets);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [updated] = await db
    .update(tournamentsTable)
    .set(updates)
    .where(eq(tournamentsTable.id, tid))
    .returning({ id: tournamentsTable.id });

  if (!updated) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  res.json({ ok: true });
});

// suppress unused-warning helpers
void desc;

export default router;
