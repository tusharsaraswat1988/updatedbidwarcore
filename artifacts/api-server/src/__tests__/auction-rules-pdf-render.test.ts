import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import type { Response } from "express";
import { buildAuctionRulesPdfDocumentModel } from "@workspace/auction/auction-rules-pdf";
import { pipeAuctionRulesPdf } from "../lib/auction-rules-pdf-document";

const RUPEE = Buffer.from("₹", "utf8");

function renderAuctionRulesPdf(): Promise<Buffer> {
  const model = buildAuctionRulesPdfDocumentModel({
    name: "City Premier League",
    sport: "cricket",
    organizerName: "Asha Patil",
    city: "Pune",
    venue: "MCA Stadium",
    auctionDate: "2026-08-20",
    auctionTime: "18:00",
    auctionUnit: "rupee",
    basePurse: 10_000_000,
    minBid: 100_000,
    bidValueMode: "player",
    bidValueOptions: JSON.stringify([50_000, 100_000, 200_000]),
    timerSeconds: 15,
    bidTimerSeconds: 10,
    bidExtensionEnabled: true,
    bidExtensionThresholdSeconds: 3,
    bidExtensionSeconds: 5,
    playerSelectionMode: "random",
    minimumSquadSize: 11,
    maximumSquadSize: 15,
    categories: [
      { name: "Gold", minBid: 150_000, bidIncrement: 50_000, bidTiers: null, maxPlayers: 3 },
      { name: "Silver", minBid: 100_000, bidIncrement: null, bidTiers: null, maxPlayers: 4 },
    ],
    tournament: { bidTiers: JSON.stringify([{ increment: 25_000 }]) },
  });

  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    pass.on("error", reject);
    pass.on("finish", () => resolve(Buffer.concat(chunks)));
    const res = Object.assign(pass, {
      setHeader() {},
    }) as unknown as Response;
    pipeAuctionRulesPdf(
      res,
      model,
      {
        watermarkImageBuffer: null,
        watermarkText: "BidWar",
        watermarkOpacity: 0.04,
        footerLogoBuffer: null,
        headerLogoBuffer: null,
        brandName: "BidWar",
        poweredByText: "Powered by BidWar",
        showBrandingPdf: true,
      },
      "City_Premier_League_Auction_Rules.pdf",
    );
  });
}

describe("auction rules PDF render", () => {
  it("writes Helvetica-safe rules with exact increment copy", async () => {
    const pdf = await renderAuctionRulesPdf();
    const latin1 = pdf.toString("latin1");

    const outDir = join(process.cwd(), "../tmp");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "auction-rules-verify.pdf"), pdf);

    expect(pdf.includes(RUPEE)).toBe(false);
    expect(latin1).toMatch(/\/Count 1\b/);
    expect(latin1).toContain("City Premier League - Auction Rules");
    expect(latin1).toContain("/WinAnsiEncoding");
  });
});
