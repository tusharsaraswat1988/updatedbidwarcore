import PDFDocument from "pdfkit";
import type { Response } from "express";
import {
  formatShortAuctionAmount,
  type AuctionRulesPdfDocumentModel,
} from "@workspace/auction";
import { PLATFORM_BASE_URL } from "@workspace/api-base/branding-assets";
import { drawPdfPageWatermark, type PdfWatermarkDrawInput } from "./pdf-branding.js";

type PdfBranding = PdfWatermarkDrawInput & {
  footerLogoBuffer: Buffer | null;
  headerLogoBuffer: Buffer | null;
  brandName: string;
  poweredByText: string;
  showBrandingPdf: boolean;
};

function drawKeyValue(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  width: number,
  label: string,
  value: string,
): void {
  doc.fillColor("#64748b").font("Helvetica").fontSize(8).text(label, left, doc.y, { width });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(value, left, doc.y + 1, { width });
  doc.moveDown(0.55);
}

function drawBulletList(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  width: number,
  lines: string[],
): void {
  for (const line of lines) {
    doc.fillColor("#0f172a").font("Helvetica").fontSize(9).text(`•  ${line}`, left, doc.y, {
      width,
      lineGap: 2,
    });
    doc.moveDown(0.25);
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
    margin: 36,
    bufferPages: true,
    info: {
      Title: `${model.tournamentName} — Auction Rules`,
      Author: branding.brandName || "BidWar",
      Subject: "Auction Rules",
    },
  });
  doc.pipe(res);

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const LEFT = doc.page.margins.left;
  const TOP = doc.page.margins.top;
  const unit = model.auctionUnit;
  const generated = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  function drawPageHeader() {
    const barH = 64;
    doc.save();
    doc.fillColor("#0a0a0a").rect(LEFT, TOP, W, barH).fill();

    if (branding.headerLogoBuffer) {
      try {
        doc.image(branding.headerLogoBuffer, LEFT + 10, TOP + 7, {
          height: 20,
          fit: [120, 20],
        });
      } catch {
        doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(15).text(
          branding.brandName || "BidWar",
          LEFT + 12,
          TOP + 8,
        );
      }
    } else {
      doc.fillColor("#FBBF24").font("Helvetica-Bold").fontSize(15).text(
        branding.brandName || "BidWar",
        LEFT + 12,
        TOP + 8,
      );
    }

    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(model.tournamentName, LEFT + 12, TOP + 36, {
        width: W - 140,
        ellipsis: true,
        lineBreak: false,
      });

    doc
      .fillColor("#FBBF24")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("AUCTION RULES", LEFT, TOP + 10, { width: W - 12, align: "right" });
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(7)
      .text(generated, LEFT, TOP + 26, { width: W - 12, align: "right" });
    doc.restore();
    doc.y = TOP + barH + 16;
  }

  function ensureRoom(needed: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 28) {
      doc.addPage();
      drawPageHeader();
    }
  }

  function sectionTitle(title: string) {
    ensureRoom(28);
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(title, LEFT, doc.y);
    doc
      .moveTo(LEFT, doc.y + 2)
      .lineTo(LEFT + W, doc.y + 2)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.55);
  }

  drawPageHeader();

  sectionTitle("Tournament");
  const identityBits = [
    model.sport ? model.sport.toUpperCase() : null,
    model.city,
    model.venue,
    [model.auctionDate, model.auctionTime].filter(Boolean).join(" · ") || null,
  ].filter(Boolean) as string[];
  drawKeyValue(doc, LEFT, W, "Tournament", model.tournamentName);
  if (identityBits.length > 0) {
    drawKeyValue(doc, LEFT, W, "Details", identityBits.join(" · "));
  }

  sectionTitle("Budget & bidding");
  drawKeyValue(doc, LEFT, W, "Team budget", formatShortAuctionAmount(model.basePurse, unit));
  drawKeyValue(doc, LEFT, W, "Minimum player value", formatShortAuctionAmount(model.minBid, unit));
  drawKeyValue(doc, LEFT, W, "Auction unit", unit === "points" ? "Points" : "Rupee (₹)");
  if (model.playersChooseBaseValue) {
    drawKeyValue(doc, LEFT, W, "Base value", "Players choose their base value at registration");
  }
  ensureRoom(40);
  doc.fillColor("#64748b").font("Helvetica").fontSize(8).text("Bid increment rules", LEFT, doc.y);
  doc.moveDown(0.35);
  drawBulletList(
    doc,
    LEFT,
    W,
    model.bidIncrementLines.length > 0
      ? model.bidIncrementLines
      : ["Bid increments are configured by the organizer."],
  );

  sectionTitle("Timers & flow");
  drawKeyValue(doc, LEFT, W, "Opening timer", `${model.timerSeconds} seconds`);
  drawKeyValue(doc, LEFT, W, "Bid timer", `${model.bidTimerSeconds} seconds`);
  if (model.bidExtensionEnabled) {
    drawKeyValue(
      doc,
      LEFT,
      W,
      "Bid extension",
      `Enabled — last ${model.bidExtensionThresholdSeconds}s extends by ${model.bidExtensionSeconds}s`,
    );
  } else {
    drawKeyValue(doc, LEFT, W, "Bid extension", "Off");
  }
  drawKeyValue(doc, LEFT, W, "Player order", model.playerSelectionModeLabel);

  sectionTitle("Squad");
  drawKeyValue(doc, LEFT, W, "Minimum players per team", String(model.minimumSquadSize));
  if (model.maximumSquadSize != null) {
    drawKeyValue(doc, LEFT, W, "Maximum players per team", String(model.maximumSquadSize));
  }

  if (model.categoryOverrides.length > 0) {
    sectionTitle("Category overrides");
    for (const category of model.categoryOverrides) {
      ensureRoom(36);
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(category.name, LEFT, doc.y);
      doc.moveDown(0.25);
      drawBulletList(doc, LEFT, W, category.lines);
      doc.moveDown(0.35);
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const pw = doc.page.width;
    const ph = doc.page.height;

    if (branding.showBrandingPdf) {
      drawPdfPageWatermark(doc, branding);
    }

    doc.save();
    const footerY = ph - doc.page.margins.bottom + 6;
    doc.fillColor("#0a0a0a").rect(LEFT, footerY, W, 18).fill();
    const textY = footerY + 5;
    if (branding.showBrandingPdf) {
      const brandTextX = branding.footerLogoBuffer ? LEFT + 22 : LEFT + 8;
      if (branding.footerLogoBuffer) {
        try {
          doc.image(branding.footerLogoBuffer, LEFT + 6, footerY + 3, { width: 12, height: 12 });
        } catch {
          /* ignore bad image */
        }
      }
      doc
        .fillColor("#FBBF24")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(`${branding.poweredByText} · ${PLATFORM_BASE_URL.replace(/^https?:\/\//, "")}`, brandTextX, textY);
    }
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(6.5)
      .text(`Page ${i + 1} of ${range.count}`, LEFT, textY, { width: W - 6, align: "right" });
    doc.restore();
  }

  doc.end();
}
