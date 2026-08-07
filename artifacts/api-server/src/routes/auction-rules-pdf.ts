import { Router, type Request, type Response } from "express";
import { db, tournamentsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  buildAuctionRulesPdfDocumentModel,
  evaluateAuctionRulesPdfReady,
} from "@workspace/auction/auction-rules-pdf";
import { canAccessPrivateTournamentData } from "../middleware/require-organizer";
import { brandingService } from "../lib/branding-service.js";
import { fetchImageBuffer } from "../lib/pdf-branding.js";
import { pipeAuctionRulesPdf } from "../lib/auction-rules-pdf-document.js";

const router = Router();

router.get("/tournaments/:tournamentId/auction-rules.pdf", async (req: Request, res: Response) => {
  const tid = parseInt(String(req.params.tournamentId), 10);
  if (!Number.isFinite(tid)) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  if (!(await canAccessPrivateTournamentData(req, tid))) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  const gate = evaluateAuctionRulesPdfReady(tournament);
  if (!gate.ready) {
    res.status(409).json({
      error: gate.blockedReason ?? "Complete auction rules before downloading.",
    });
    return;
  }

  const categories = await db
    .select({
      name: categoriesTable.name,
      minBid: categoriesTable.minBid,
      bidIncrement: categoriesTable.bidIncrement,
      bidTiers: categoriesTable.bidTiers,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.tournamentId, tid))
    .orderBy(categoriesTable.sortOrder);

  const model = buildAuctionRulesPdfDocumentModel({
    name: tournament.name,
    sport: tournament.sport,
    city: tournament.city,
    venue: tournament.venue,
    auctionDate: tournament.auctionDate,
    auctionTime: tournament.auctionTime,
    auctionUnit: tournament.auctionUnit,
    basePurse: tournament.basePurse,
    minBid: tournament.minBid,
    bidValueMode: tournament.bidValueMode,
    timerSeconds: tournament.timerSeconds,
    bidTimerSeconds: tournament.bidTimerSeconds,
    bidExtensionEnabled: tournament.bidExtensionEnabled,
    bidExtensionThresholdSeconds: tournament.bidExtensionThresholdSeconds,
    bidExtensionSeconds: tournament.bidExtensionSeconds,
    playerSelectionMode: tournament.playerSelectionMode,
    minimumSquadSize: tournament.minimumSquadSize,
    maximumSquadSize: tournament.maximumSquadSize,
    categories,
    tournament: {
      bidTiers: tournament.bidTiers,
      bidTier1UpTo: tournament.bidTier1UpTo,
      bidTier1Increment: tournament.bidTier1Increment,
      bidTier2UpTo: tournament.bidTier2UpTo,
      bidTier2Increment: tournament.bidTier2Increment,
      bidTier3Increment: tournament.bidTier3Increment,
    },
  });

  const branding = await brandingService.resolvePdfWatermarkBranding();
  const [reverseLogo, primaryLogo] = await Promise.all([
    brandingService.getAsset("REVERSE_LOGO"),
    brandingService.getAsset("PRIMARY_LOGO"),
  ]);
  const headerLogoUrl = reverseLogo?.fileUrl ?? primaryLogo?.fileUrl ?? null;
  const headerLogoBuffer = headerLogoUrl
    ? await fetchImageBuffer(headerLogoUrl)
    : branding.footerLogoBuffer;

  const fileName = `${model.tournamentName.replace(/[^a-zA-Z0-9]+/g, "_")}_Auction_Rules.pdf`;
  pipeAuctionRulesPdf(
    res,
    model,
    {
      ...branding,
      headerLogoBuffer,
    },
    fileName,
  );
});

export default router;
