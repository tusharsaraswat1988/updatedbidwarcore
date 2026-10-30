import { Router, type Request, type Response } from "express";
import {
  getPlayerSoldPosterBufferByToken,
  resolveAuthoritativeSaleData,
} from "../lib/poster/player-sold-poster-service.js";
import { generatePlayerSoldPosterBuffer } from "../lib/poster/player-sold-poster-generator.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * GET /api/media/player-sold-poster/preview.png
 * Generates an authoritative Player Sold poster on-demand with photos, logos, and sport branding.
 * Supports query parameters (?playerId=...&name=...&team=...&price=...&tournament=...)
 * Explicitly sends no-cache headers to prevent proxy/browser serving stale cached previews.
 * Note: Must be registered BEFORE /:token.png so "preview" is not captured as a token.
 */
router.get("/media/player-sold-poster/preview.png", async (req: Request, res: Response) => {
  try {
    const playerId = req.query.playerId ? Number(req.query.playerId) : undefined;
    const teamId = req.query.teamId ? Number(req.query.teamId) : undefined;
    const tournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : 0;
    const playerName = req.query.name ? String(req.query.name) : undefined;
    const teamName = req.query.team ? String(req.query.team) : undefined;
    const tournamentName = req.query.tournament ? String(req.query.tournament) : undefined;
    const amount = req.query.price ? Number(req.query.price) : 0;
    const role = req.query.role ? String(req.query.role) : undefined;
    const sport = req.query.sport ? String(req.query.sport) : undefined;
    const photoUrl = req.query.photoUrl ? String(req.query.photoUrl) : undefined;
    const logoUrl = req.query.logoUrl ? String(req.query.logoUrl) : undefined;
    const shortCode = req.query.shortCode ? String(req.query.shortCode) : undefined;
    const color = req.query.color ? String(req.query.color) : undefined;
    const auctionUnit = req.query.unit === "points" ? "points" : "rupee";

    // Authoritative DB lookup resolves actual player photograph, team logo, color & sport
    const authoritative = await resolveAuthoritativeSaleData({
      tournamentId,
      playerId,
      playerName,
      playerPhotoUrl: photoUrl,
      playerRole: role,
      teamId,
      teamName,
      teamLogoUrl: logoUrl,
      teamShortCode: shortCode,
      teamColor: color,
      amount,
      auctionUnit,
      tournamentName,
      tournamentSport: sport,
    });

    const buffer = await generatePlayerSoldPosterBuffer({
      playerName: authoritative.playerName,
      playerPhotoUrl: authoritative.playerPhotoUrl,
      playerRole: authoritative.playerRole,
      teamName: authoritative.teamName,
      teamLogoUrl: authoritative.teamLogoUrl,
      teamShortCode: authoritative.teamShortCode,
      teamColor: authoritative.teamColor,
      amount: authoritative.amount,
      auctionUnit: authoritative.auctionUnit,
      tournamentName: authoritative.tournamentName,
      tournamentSport: authoritative.tournamentSport,
      bidwarLogoUrl: authoritative.bidwarLogoUrl,
      titleSponsorLogoUrl: authoritative.titleSponsorLogoUrl,
      coSponsorLogoUrls: authoritative.coSponsorLogoUrls,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(buffer);
  } catch (err) {
    logger.error({ err }, "Error generating preview poster");
    res.status(500).json({ error: "Failed to generate preview poster" });
  }
});

/**
 * GET /api/media/player-sold-poster/:token.png
 * Publicly serves a dynamically generated Player Sold poster PNG.
 * Accessible without credentials to WhatsApp Cloud API and Twilio media fetchers.
 */
router.get("/media/player-sold-poster/:token.png", (req: Request, res: Response) => {
  const token = String(req.params.token ?? "").replace(/\.png$/i, "").trim();
  if (!token) {
    res.status(404).json({ error: "Missing poster token" });
    return;
  }

  const result = getPlayerSoldPosterBufferByToken(token);
  if (!result) {
    res.status(404).json({ error: "Poster not found or expired" });
    return;
  }

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.setHeader("ETag", `"${token}"`);

  if (req.headers["if-none-match"] === `"${token}"`) {
    res.status(304).end();
    return;
  }

  res.send(result.buffer);
});

export default router;
