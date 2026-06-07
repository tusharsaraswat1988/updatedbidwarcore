import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, teamsTable, categoriesTable, playersTable } from "@workspace/db";
import { brandingSettingsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { z } from "zod";

const router = Router();

function fmtRupee(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const s = Math.abs(Math.round(n)).toString();
  let result: string;
  if (s.length <= 3) result = s;
  else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    result = rest.replace(/(\d)(?=(\d\d)+$)/g, "$1,") + "," + last3;
  }
  return `\u20B9${n < 0 ? "-" : ""}${result}`;
}

function fmtShort(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  if (n >= 10000000) return `\u20B9${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `\u20B9${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `\u20B9${(n / 1000).toFixed(1)} K`;
  return `\u20B9${n}`;
}

async function fetchBranding() {
  const [row] = await db.select().from(brandingSettingsTable).limit(1);
  return {
    brandName: row?.brandName ?? "BidWar",
    poweredByText: row?.poweredByText ?? "Powered by BidWar",
    miniBrandText: row?.miniBrandText ?? "BW",
    miniLogoUrl: row?.miniLogoUrl ?? row?.mainLogoUrl ?? null,
    showBrandingPdf: row?.showBrandingPdf ?? true,
  };
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function isOrganizer(req: Request, tid: number): boolean {
  const tidStr = String(tid);
  return !!(req.jwtUser?.isAdmin || req.jwtUser?.organizerAccountId || req.jwtUser?.organizer?.[tidStr]);
}

router.get("/tournaments/:tournamentId/team-reports", async (req: Request, res: Response) => {
  const tid = parseInt(String(req.params.tournamentId));
  if (!isOrganizer(req, tid)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }
  if (tournament.licenseStatus !== "active") { res.status(403).json({ error: "Team reports require an active license" }); return; }

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid)).orderBy(teamsTable.createdAt);
  const players = await db.select({
    teamId: playersTable.teamId,
    status: playersTable.status,
    isNonPlayingMember: playersTable.isNonPlayingMember,
  }).from(playersTable).where(eq(playersTable.tournamentId, tid));

  const result = teams.map(team => {
    const tp = players.filter(p => p.teamId === team.id);
    return {
      teamId: team.id,
      teamName: team.name,
      shortCode: team.shortCode,
      ownerName: team.ownerName,
      logoUrl: team.logoUrl ?? null,
      color: team.color ?? null,
      purse: team.purse,
      purseUsed: team.purseUsed,
      retainedCount: tp.filter(p => p.status === "retained" && !p.isNonPlayingMember).length,
      preSoldCount: tp.filter(p => p.status === "sold" && !p.isNonPlayingMember).length,
      nonPlayingCount: tp.filter(p => p.isNonPlayingMember).length,
    };
  });

  res.json(result);
});

router.get("/tournaments/:tournamentId/team-reports/:teamId", async (req: Request, res: Response) => {
  const tid = parseInt(String(req.params.tournamentId));
  const teamId = parseInt(String(req.params.teamId));
  if (!isOrganizer(req, tid)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }
  if (tournament.licenseStatus !== "active") { res.status(403).json({ error: "Team reports require an active license" }); return; }

  const [team] = await db.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tid)).orderBy(categoriesTable.sortOrder);
  const catMap = new Map(categories.map(c => [c.id, c]));

  const allPlayers = await db.select().from(playersTable).where(and(eq(playersTable.teamId, teamId), eq(playersTable.tournamentId, tid))).orderBy(playersTable.name);

  const enrich = (p: typeof playersTable.$inferSelect) => ({
    id: p.id,
    name: p.name,
    role: p.role ?? null,
    city: p.city ?? null,
    age: p.age ?? null,
    photoUrl: p.photoUrl ?? null,
    mobileNumber: p.mobileNumber || null,
    email: p.email ?? null,
    jerseyNumber: p.jerseyNumber ?? null,
    categoryId: p.categoryId ?? null,
    categoryName: p.categoryId ? (catMap.get(p.categoryId)?.name ?? null) : null,
    categoryColor: p.categoryId ? (catMap.get(p.categoryId)?.colorCode ?? null) : null,
    soldPrice: p.soldPrice ?? null,
    retainedPrice: p.retainedPrice ?? null,
    status: p.status,
    isNonPlayingMember: p.isNonPlayingMember,
  });

  const retainedPlayers = allPlayers.filter(p => p.status === "retained" && !p.isNonPlayingMember).map(enrich);
  const preSoldPlayers = allPlayers.filter(p => p.status === "sold" && !p.isNonPlayingMember).map(enrich);
  const nonPlayingMembers = allPlayers.filter(p => p.isNonPlayingMember).map(enrich);

  const retainedSpend = retainedPlayers.reduce((s, p) => s + (p.retainedPrice ?? 0), 0);
  const preSoldSpend = preSoldPlayers.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
  const remainingPurse = team.purse - retainedSpend - preSoldSpend;

  const totalAcquired = retainedPlayers.length + preSoldPlayers.length;
  const slotsRemaining = tournament.maximumSquadSize > 0
    ? Math.max(0, tournament.maximumSquadSize - totalAcquired)
    : 0;
  const planningRows = Math.max(8, slotsRemaining);

  res.json({
    isLicensed: tournament.licenseStatus === "active",
    tournament: {
      id: tournament.id,
      name: tournament.name,
      sport: tournament.sport,
      logoUrl: tournament.logoUrl ?? null,
      licenseStatus: tournament.licenseStatus,
      minimumSquadSize: tournament.minimumSquadSize,
      maximumSquadSize: tournament.maximumSquadSize,
    },
    team: {
      id: team.id,
      name: team.name,
      shortCode: team.shortCode,
      ownerName: team.ownerName,
      ownerMobile: team.ownerMobile,
      ownerEmail: team.ownerEmail ?? null,
      ownerPhotoUrl: team.ownerPhotoUrl ?? null,
      logoUrl: team.logoUrl ?? null,
      color: team.color ?? null,
      purse: team.purse,
      purseUsed: team.purseUsed,
    },
    purgeSummary: {
      totalPurse: team.purse,
      retainedSpend,
      preSoldSpend,
      remainingPurse,
    },
    retainedPlayers,
    preSoldPlayers,
    nonPlayingMembers,
    categories: categories.map(c => ({ id: c.id, name: c.name, colorCode: c.colorCode ?? null })),
    squadInfo: { totalAcquired, slotsRemaining, planningRows },
  });
});

const pdfBodySchema = z.object({
  columns: z.array(z.string()).default([]),
});

router.post("/tournaments/:tournamentId/team-reports/:teamId/pdf", async (req: Request, res: Response) => {
  const tid = parseInt(String(req.params.tournamentId));
  const teamId = parseInt(String(req.params.teamId));
  if (!isOrganizer(req, tid)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = pdfBodySchema.safeParse(req.body);
  const selectedCols: string[] = body.success ? body.data.columns : [];

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const [team] = await db.select().from(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const isLicensed = tournament.licenseStatus === "active";

  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tid)).orderBy(categoriesTable.sortOrder);
  const catMap = new Map(categories.map(c => [c.id, c]));

  const allPlayers = await db.select().from(playersTable).where(and(eq(playersTable.teamId, teamId), eq(playersTable.tournamentId, tid))).orderBy(playersTable.name);

  type EnrichedPlayer = {
    id: number; name: string; role: string | null; city: string | null; age: number | null;
    mobileNumber: string | null; email: string | null; jerseyNumber: string | null; categoryName: string | null;
    soldPrice: number | null; retainedPrice: number | null; status: string; isNonPlayingMember: boolean;
  };

  const enrich = (p: typeof playersTable.$inferSelect): EnrichedPlayer => ({
    id: p.id, name: p.name, role: p.role ?? null, city: p.city ?? null, age: p.age ?? null,
    mobileNumber: p.mobileNumber || null, email: p.email ?? null, jerseyNumber: p.jerseyNumber ?? null,
    categoryName: p.categoryId ? (catMap.get(p.categoryId)?.name ?? null) : null,
    soldPrice: p.soldPrice ?? null, retainedPrice: p.retainedPrice ?? null,
    status: p.status, isNonPlayingMember: p.isNonPlayingMember,
  });

  const retained = allPlayers.filter(p => p.status === "retained" && !p.isNonPlayingMember).map(enrich);
  const preSold = allPlayers.filter(p => p.status === "sold" && !p.isNonPlayingMember).map(enrich);
  const nonPlaying = allPlayers.filter(p => p.isNonPlayingMember).map(enrich);
  const allAcquired = [...retained, ...preSold];

  const retainedSpend = retained.reduce((s, p) => s + (p.retainedPrice ?? 0), 0);
  const preSoldSpend = preSold.reduce((s, p) => s + (p.soldPrice ?? 0), 0);
  const remainingPurse = team.purse - retainedSpend - preSoldSpend;

  const totalAcquired = allAcquired.length;
  const slotsRemaining = tournament.maximumSquadSize > 0 ? Math.max(0, tournament.maximumSquadSize - totalAcquired) : 0;
  const planningRows = Math.max(8, slotsRemaining);

  const optionalCols = [
    { key: "age", label: "Age" },
    { key: "city", label: "City" },
    { key: "mobileNumber", label: "Mobile" },
    { key: "email", label: "Email" },
    { key: "categoryName", label: "Category" },
    { key: "role", label: "Role" },
    { key: "jerseyNumber", label: "Jersey No." },
    { key: "status", label: "Status" },
    { key: "remainingBalance", label: "Balance" },
  ].filter(c => selectedCols.includes(c.key));

  const fileName = `${team.name.replace(/[^a-zA-Z0-9]/g, "_")}_PreAuction_Report.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const branding = await fetchBranding();
  const brandLogoBuffer = branding.miniLogoUrl ? await fetchImageBuffer(branding.miniLogoUrl) : null;
  const ownerPhotoBuffer = team.ownerPhotoUrl ? await fetchImageBuffer(team.ownerPhotoUrl) : null;

  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: 28, bufferPages: true });
  doc.pipe(res);

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const LEFT = doc.page.margins.left;
  const TOP = doc.page.margins.top;

  function drawPageHeader() {
    doc.save();
    doc.fillColor("#0a0a0a").rect(LEFT, TOP, W, 48).fill();
    doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(15).text("BidWar", LEFT + 10, TOP + 8);
    doc.fillColor("#ffffff").font("Helvetica").fontSize(8).text(tournament.sport.toUpperCase() + " · " + tournament.name, LEFT + 10, TOP + 28);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10)
      .text("PRE-AUCTION TEAM REPORT", LEFT, TOP + 8, { width: W - 10, align: "right" });
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7)
      .text(new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }), LEFT, TOP + 28, { width: W - 10, align: "right" });
    doc.restore();
    doc.y = TOP + 56;
  }

  function ensureRoom(needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      drawPageHeader();
    }
  }

  drawPageHeader();

  const hdrY = doc.y;
  const thirdW = W / 3;

  // Left column — team + owner
  doc.save();
  doc.fillColor("#0f172a").roundedRect(LEFT, hdrY, thirdW - 6, 80, 4).fill();
  doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(13).text(team.name, LEFT + 10, hdrY + 10, { width: thirdW - 20 });
  doc.fillColor("#94a3b8").font("Helvetica").fontSize(9).text(team.shortCode, LEFT + 10, hdrY + 28);
  const ownerTextX = ownerPhotoBuffer ? LEFT + 34 : LEFT + 10;
  if (ownerPhotoBuffer) {
    doc.image(ownerPhotoBuffer, LEFT + 10, hdrY + 40, { width: 18, height: 18 });
  }
  doc.fillColor("#e2e8f0").font("Helvetica-Bold").fontSize(9).text("Owner: " + team.ownerName, ownerTextX, hdrY + 44, { width: thirdW - (ownerTextX - LEFT) - 10 });
  if (team.ownerMobile) {
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(8).text(team.ownerMobile, ownerTextX, hdrY + 58, { width: thirdW - (ownerTextX - LEFT) - 10 });
  }
  doc.restore();

  // Center column — purse summary
  const cX = LEFT + thirdW;
  doc.save();
  doc.fillColor("#0f172a").roundedRect(cX, hdrY, thirdW - 6, 80, 4).fill();
  doc.fillColor("#94a3b8").font("Helvetica").fontSize(7).text("PURSE SUMMARY", cX + 10, hdrY + 8);

  const summaryItems = [
    { label: "Total Purse", value: fmtShort(team.purse) },
    { label: "Retained Spend", value: fmtShort(retainedSpend) },
    { label: "Pre-Sold Spend", value: fmtShort(preSoldSpend) },
    { label: "Remaining Purse", value: fmtShort(remainingPurse) },
  ];
  summaryItems.forEach((item, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const ix = cX + 10 + col * ((thirdW - 20) / 2);
    const iy = hdrY + 22 + row * 24;
    doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(item.label, ix, iy, { width: (thirdW - 24) / 2 });
    doc.fillColor(i === 3 ? "#FBBF24" : "#e2e8f0").font("Helvetica-Bold").fontSize(9).text(item.value, ix, iy + 9, { width: (thirdW - 24) / 2 });
  });
  doc.restore();

  // Right column — non-playing members
  const rX = LEFT + thirdW * 2;
  doc.save();
  doc.fillColor("#0f172a").roundedRect(rX, hdrY, thirdW - 2, 80, 4).fill();
  doc.fillColor("#94a3b8").font("Helvetica").fontSize(7).text("NON-PLAYING MEMBERS", rX + 10, hdrY + 8);
  if (nonPlaying.length === 0) {
    doc.fillColor("#475569").font("Helvetica-Oblique").fontSize(8).text("None listed", rX + 10, hdrY + 24);
  } else {
    nonPlaying.slice(0, 5).forEach((m, i) => {
      doc.fillColor("#e2e8f0").font("Helvetica").fontSize(8).text(
        `${m.name}${m.role ? ` (${m.role})` : ""}`, rX + 10, hdrY + 24 + i * 11, { width: thirdW - 20, ellipsis: true, lineBreak: false }
      );
    });
    if (nonPlaying.length > 5) {
      doc.fillColor("#64748b").font("Helvetica").fontSize(7).text(`+${nonPlaying.length - 5} more`, rX + 10, hdrY + 24 + 5 * 11);
    }
  }
  doc.restore();

  doc.y = hdrY + 88;

  // ── Player table ────────────────────────────────────────────────────────────

  type ColDef = { label: string; width: number; get: (p: EnrichedPlayer, balance: number) => string };

  const mandatoryCols: ColDef[] = [
    { label: "S.No", width: 0.4, get: (_, __, ...rest) => String(rest) },
    { label: "Player Name", width: 2.2, get: (p) => p.name },
    { label: "Amount", width: 1.0, get: (p) => fmtShort(p.status === "retained" ? p.retainedPrice : p.soldPrice) },
  ];

  const colMap: Record<string, ColDef> = {
    age: { label: "Age", width: 0.5, get: (p) => p.age ? String(p.age) : "-" },
    city: { label: "City", width: 0.9, get: (p) => p.city || "-" },
    mobileNumber: { label: "Mobile", width: 1.1, get: (p) => p.mobileNumber || "-" },
    email: { label: "Email", width: 1.4, get: (p) => p.email || "-" },
    categoryName: { label: "Category", width: 0.9, get: (p) => p.categoryName || "-" },
    role: { label: "Role", width: 0.9, get: (p) => p.role?.replace(/_/g, " ") || "-" },
    jerseyNumber: { label: "Jersey", width: 0.55, get: (p) => p.jerseyNumber || "-" },
    status: { label: "Type", width: 0.7, get: (p) => p.status === "retained" ? "Retained" : "Pre-Sold" },
    remainingBalance: { label: "Balance", width: 0.95, get: (_p, balance) => fmtShort(balance) },
  };

  const activeCols = [
    mandatoryCols[0],
    mandatoryCols[1],
    ...optionalCols.filter(c => c.key !== "remainingBalance").map(c => colMap[c.key]).filter(Boolean),
    mandatoryCols[2],
    ...(selectedCols.includes("remainingBalance") ? [colMap.remainingBalance] : []),
  ];

  const totalW = activeCols.reduce((s, c) => s + c.width, 0);
  const colWidths = activeCols.map(c => (c.width / totalW) * W);

  function drawTableHeader() {
    ensureRoom(20);
    const hY = doc.y;
    doc.fillColor("#1e293b").rect(LEFT, hY, W, 16).fill();
    let x = LEFT + 4;
    doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(7.5);
    activeCols.forEach((c, i) => {
      doc.text(c.label.toUpperCase(), x, hY + 4, { width: colWidths[i] - 6, lineBreak: false, ellipsis: true });
      x += colWidths[i];
    });
    doc.y = hY + 16;
  }

  function drawSectionHeading(label: string) {
    ensureRoom(22);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text(label, LEFT, doc.y, { width: W });
    doc.moveDown(0.3);
  }

  let balance = team.purse;
  let rowIdx = 0;

  function drawPlayerRow(p: EnrichedPlayer, sno: number) {
    const price = p.status === "retained" ? (p.retainedPrice ?? 0) : (p.soldPrice ?? 0);
    balance -= price;
    ensureRoom(15);
    const rY = doc.y;
    if (rowIdx % 2 === 0) doc.fillColor("#f8fafc").rect(LEFT, rY, W, 14).fill();
    let x = LEFT + 4;
    doc.fillColor("#0f172a").font("Helvetica").fontSize(7.5);
    activeCols.forEach((c, i) => {
      let text: string;
      if (c.label === "S.No") text = String(sno);
      else text = c.get(p, balance);
      doc.text(text, x, rY + 3, { width: colWidths[i] - 6, lineBreak: false, ellipsis: true });
      x += colWidths[i];
    });
    doc.y = rY + 14;
    rowIdx++;
  }

  // Retained players
  if (retained.length > 0) {
    drawSectionHeading(`Retained Players (${retained.length})`);
    drawTableHeader();
    retained.forEach((p, i) => drawPlayerRow(p, i + 1));
    doc.moveDown(0.5);
  }

  // Pre-sold players
  if (preSold.length > 0) {
    drawSectionHeading(`Pre-Sold Players (${preSold.length})`);
    drawTableHeader();
    const startSno = retained.length + 1;
    preSold.forEach((p, i) => drawPlayerRow(p, startSno + i));
    doc.moveDown(0.5);
  }

  if (retained.length === 0 && preSold.length === 0) {
    ensureRoom(30);
    doc.fillColor("#94a3b8").font("Helvetica-Oblique").fontSize(9).text("No retained or pre-sold players assigned to this team.", LEFT, doc.y);
    doc.moveDown(0.5);
  }

  // ── Auction planning table ────────────────────────────────────────────────

  ensureRoom(32);
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(9).text(`Auction Working Sheet — ${planningRows} Slots`, LEFT, doc.y);
  doc.moveDown(0.3);

  const planCols = [
    { label: "S.No", w: 0.4 },
    { label: "Player Name", w: 2.0 },
    { label: "Category", w: 0.9 },
    { label: "Amount", w: 0.9 },
    { label: "Balance", w: 0.9 },
  ];
  const planTotal = planCols.reduce((s, c) => s + c.w, 0);
  const planWidths = planCols.map(c => (c.w / planTotal) * W);

  ensureRoom(18);
  const phY = doc.y;
  doc.fillColor("#1e293b").rect(LEFT, phY, W, 15).fill();
  let px = LEFT + 4;
  doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(7.5);
  planCols.forEach((c, i) => {
    doc.text(c.label.toUpperCase(), px, phY + 4, { width: planWidths[i] - 6, lineBreak: false });
    px += planWidths[i];
  });
  doc.y = phY + 15;

  for (let i = 0; i < planningRows; i++) {
    ensureRoom(14);
    const rY = doc.y;
    if (i % 2 === 0) doc.fillColor("#f8fafc").rect(LEFT, rY, W, 13).fill();
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7.5).text(String(totalAcquired + i + 1), LEFT + 4, rY + 3, { width: planWidths[0] - 6, lineBreak: false });
    doc.fillColor("#cbd5e1").font("Helvetica").fontSize(7).text("___________________________", LEFT + 4 + planWidths[0], rY + 5, { width: planWidths[1] - 6, lineBreak: false });
    doc.y = rY + 13;
  }

  // ── Footer + watermark ──────────────────────────────────────────────────────

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pw = doc.page.width;
    const ph = doc.page.height;

    if (!isLicensed) {
      doc.save();
      doc.rotate(-30, { origin: [pw / 2, ph / 2] });
      doc.fillColor("#000000", 0.06).font("Helvetica-Bold").fontSize(90)
        .text("UNLICENSED COPY", 0, ph / 2 - 50, { width: pw, align: "center" });
      doc.restore();
    }

    doc.save();
    doc.fillColor("#0a0a0a").rect(LEFT, ph - doc.page.margins.bottom + 4, W, 18).fill();
    const footerY = ph - doc.page.margins.bottom + 9;
    if (branding.showBrandingPdf) {
      const brandTextX = brandLogoBuffer ? LEFT + 22 : LEFT + 6;
      if (brandLogoBuffer) {
        doc.image(brandLogoBuffer, LEFT + 6, footerY - 2, { width: 12, height: 12 });
      }
      doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(7)
        .text(branding.poweredByText, brandTextX, footerY);
    }
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(6.5)
      .text(`Page ${i + 1} of ${range.count}  ·  ${team.name} Pre-Auction Report  ·  Confidential`, LEFT, ph - doc.page.margins.bottom + 9, { width: W - 6, align: "right" });
    doc.restore();
  }

  doc.end();
});

export default router;
