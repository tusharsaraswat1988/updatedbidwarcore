import PDFDocument from "pdfkit";
import type { Response } from "express";
import type { AuctionRulesPdfDocumentModel } from "@workspace/auction";
import { PLATFORM_BASE_URL } from "@workspace/api-base/branding-assets";
import { drawPdfPageWatermark, type PdfWatermarkDrawInput } from "./pdf-branding.js";

type PdfBranding = PdfWatermarkDrawInput & {
  footerLogoBuffer: Buffer | null;
  headerLogoBuffer: Buffer | null;
  brandName: string;
  poweredByText: string;
  showBrandingPdf: boolean;
};

const INK = "#0f172a";
const LABEL = "#334155";
const MUTED = "#475569";
const RULE = "#cbd5e1";
const BAND = "#f8fafc";
const HEADER_BG = "#111111";
const ACCENT = "#D4A017";
const ON_DARK = "#f8fafc";
const ON_DARK_MUTED = "#e2e8f0";

function drawKeyValue(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  width: number,
  label: string,
  value: string,
  band: boolean,
): void {
  const labelW = Math.min(168, Math.round(width * 0.36));
  const valueW = width - labelW - 10;
  doc.font("Helvetica-Bold").fontSize(9.5);
  const valueHeight = Math.max(12, doc.heightOfString(value, { width: valueW, lineGap: 1 }));
  const rowH = Math.max(20, valueHeight + 8);
  const y = doc.y;

  if (band) {
    doc.save();
    doc.fillColor(BAND).rect(left, y - 2, width, rowH).fill();
    doc.restore();
  }

  doc.fillColor(LABEL).font("Helvetica").fontSize(8.5).text(label, left + 4, y + 3, {
    width: labelW,
    lineBreak: false,
    ellipsis: true,
  });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(value, left + labelW + 8, y + 2, {
    width: valueW,
    lineGap: 1,
  });
  doc.y = y + rowH;
}

function drawBulletList(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  width: number,
  lines: string[],
  ensureRoom: (needed: number) => void,
): void {
  for (const line of lines) {
    doc.font("Helvetica").fontSize(9.5);
    const height = Math.max(14, doc.heightOfString(`-  ${line}`, { width, lineGap: 2 }) + 6);
    ensureRoom(height);
    const y = doc.y;
    doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(`-  ${line}`, left, y, {
      width,
      lineGap: 2,
    });
    doc.y = y + height;
  }
}

export function pipeAuctionRulesPdf(
  res: Response,
  model: AuctionRulesPdfDocumentModel,
  branding: PdfBranding,
  fileName: string,
): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({
    size: "A4",
    layout: "portrait",
    margin: 40,
    bufferPages: true,
    info: {
      Title: `${model.tournamentName} - Auction Rules`,
      Author: branding.brandName || "BidWar",
      Subject: "Auction Rules",
    },
  });
  doc.pipe(res);

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const LEFT = doc.page.margins.left;
  const TOP = doc.page.margins.top;
  const FOOTER_RESERVE = 36;
  const generated = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

  let kvBand = false;

  function drawPageHeader() {
    const barH = 58;
    doc.save();
    doc.fillColor(HEADER_BG).rect(LEFT, TOP, W, barH).fill();
    doc.fillColor(ACCENT).rect(LEFT, TOP, W, 3).fill();

    if (branding.headerLogoBuffer) {
      try {
        doc.image(branding.headerLogoBuffer, LEFT + 12, TOP + 10, {
          height: 18,
          fit: [130, 18],
        });
      } catch {
        doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(14).text(
          branding.brandName || "BidWar",
          LEFT + 12,
          TOP + 10,
          { lineBreak: false },
        );
      }
    } else {
      doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(14).text(
        branding.brandName || "BidWar",
        LEFT + 12,
        TOP + 10,
        { lineBreak: false },
      );
    }

    doc
      .fillColor(ON_DARK)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(model.tournamentName, LEFT + 12, TOP + 32, {
        width: W - 150,
        ellipsis: true,
        lineBreak: false,
      });

    doc
      .fillColor(ACCENT)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("AUCTION RULES", LEFT, TOP + 12, { width: W - 14, align: "right", lineBreak: false });
    doc
      .fillColor(ON_DARK_MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(generated, LEFT, TOP + 28, { width: W - 14, align: "right", lineBreak: false });
    doc.restore();
    doc.y = TOP + barH + 18;
    kvBand = false;
  }

  function contentLimit() {
    return doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
  }

  function ensureRoom(needed: number) {
    if (doc.y + needed > contentLimit()) {
      doc.addPage();
      drawPageHeader();
    }
  }

  function wrappedHeight(text: string, fontSize: number, width = W): number {
    doc.font("Helvetica").fontSize(fontSize);
    return doc.heightOfString(text, { width, lineGap: 2 });
  }

  function drawWrappedNote(text: string) {
    const height = wrappedHeight(text, 8.5) + 10;
    ensureRoom(height);
    const y = doc.y;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(text, LEFT, y, {
      width: W,
      lineGap: 2,
    });
    doc.y = y + height;
  }

  function sectionTitle(title: string) {
    ensureRoom(36);
    const y = doc.y;
    doc.fillColor(ACCENT).rect(LEFT, y, 3, 13).fill();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(title, LEFT + 10, y, {
      lineBreak: false,
    });
    doc
      .moveTo(LEFT, y + 16)
      .lineTo(LEFT + W, y + 16)
      .strokeColor(RULE)
      .lineWidth(0.8)
      .stroke();
    doc.y = y + 22;
    kvBand = false;
  }

  function row(label: string, value: string) {
    const labelW = Math.min(168, Math.round(W * 0.36));
    const valueW = W - labelW - 10;
    doc.font("Helvetica-Bold").fontSize(9.5);
    const valueHeight = Math.max(12, doc.heightOfString(value, { width: valueW, lineGap: 1 }));
    ensureRoom(Math.max(22, valueHeight + 10));
    drawKeyValue(doc, LEFT, W, label, value, kvBand);
    kvBand = !kvBand;
  }

  drawPageHeader();

  sectionTitle("Tournament");
  const identityBits = [model.sport, model.city, model.venue].filter(Boolean) as string[];
  if (identityBits.length > 0) {
    row("Sport / venue", identityBits.join("  |  "));
  }
  const schedule = [model.auctionDate, model.auctionTime].filter(Boolean).join("  |  ");
  if (schedule) {
    row("Auction schedule", schedule);
  }
  if (model.organizerName) {
    row("Organiser", model.organizerName);
  }

  sectionTitle("Budget & bidding");
  row("Team budget", model.basePurseLabel);
  row("Minimum player value", model.minBidLabel);
  row("Auction unit", model.auctionUnitLabel);
  if (model.playersChooseBaseValue) {
    row(
      "Base value",
      model.allowedBaseValuesLabel
        ? `Players choose at registration from: ${model.allowedBaseValuesLabel}`
        : "Players choose their base value at registration",
    );
  }
  ensureRoom(18);
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text("BID INCREMENT RULES", LEFT, doc.y, {
    lineBreak: false,
  });
  doc.y += 12;
  drawBulletList(
    doc,
    LEFT,
    W,
    model.bidIncrementLines.length > 0
      ? model.bidIncrementLines
      : ["Bid increments are configured by the organizer."],
    ensureRoom,
  );
  drawWrappedNote(model.openingBidNote);

  sectionTitle("Timers & flow");
  row("Opening timer", `${model.timerSeconds} seconds`);
  row("Bid timer", `${model.bidTimerSeconds} seconds`);
  if (model.bidExtensionEnabled) {
    row(
      "Bid extension",
      `On - a bid in the last ${model.bidExtensionThresholdSeconds}s adds ${model.bidExtensionSeconds}s`,
    );
  } else {
    row("Bid extension", "Off");
  }
  row("Player order", model.playerSelectionModeLabel);

  sectionTitle("Squad");
  row("Minimum players per team", String(model.minimumSquadSize));
  if (model.maximumSquadSize != null) {
    row("Maximum players per team", String(model.maximumSquadSize));
  }
  if (model.squadReserveNote) {
    drawWrappedNote(model.squadReserveNote);
  }

  if (model.categoryOverrides.length > 0) {
    sectionTitle("Category rules");
    for (const category of model.categoryOverrides) {
      ensureRoom(22);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(category.name, LEFT, doc.y, {
        lineBreak: false,
      });
      doc.y += 14;
      drawBulletList(doc, LEFT, W, category.lines, ensureRoom);
      doc.y += 8;
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const ph = doc.page.height;

    if (branding.showBrandingPdf) {
      drawPdfPageWatermark(doc, branding);
    }

    doc.save();
    const footerY = ph - doc.page.margins.bottom - 18;
    doc.fillColor(HEADER_BG).rect(LEFT, footerY, W, 18).fill();
    doc.fillColor(ACCENT).rect(LEFT, footerY, W, 2).fill();
    const textY = footerY + 5;
    if (branding.showBrandingPdf) {
      doc
        .fillColor(ACCENT)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(
          `${branding.poweredByText}  |  ${PLATFORM_BASE_URL.replace(/^https?:\/\//, "")}`,
          LEFT + 10,
          textY,
          { width: W - 80, lineBreak: false, ellipsis: true },
        );
    }
    doc
      .fillColor(ON_DARK)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Page ${i + 1} of ${range.count}`, LEFT, textY, {
        width: W - 10,
        align: "right",
        lineBreak: false,
      });
    doc.restore();
  }

  doc.end();
}
