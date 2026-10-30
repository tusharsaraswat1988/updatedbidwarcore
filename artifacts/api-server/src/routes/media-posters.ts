import { Router, type Request, type Response } from "express";
import {
  getPlayerSoldPosterBufferByToken,
  resolveAuthoritativeSaleData,
} from "../lib/poster/player-sold-poster-service.js";
import { generatePlayerSoldPosterV2Buffer as generatePlayerSoldPosterBuffer } from "../lib/poster/player-sold-poster-generator-v2.js";
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
    const playerName = req.query.name ? String(req.query.name) : (req.query.playerName ? String(req.query.playerName) : undefined);
    const teamName = req.query.team ? String(req.query.team) : (req.query.teamName ? String(req.query.teamName) : undefined);
    const tournamentName = req.query.tournament ? String(req.query.tournament) : (req.query.tournamentName ? String(req.query.tournamentName) : undefined);
    const amount = req.query.price ? Number(req.query.price) : (req.query.amount ? Number(req.query.amount) : 0);
    const role = req.query.role ? String(req.query.role) : (req.query.playerRole ? String(req.query.playerRole) : undefined);
    const sport = req.query.sport ? String(req.query.sport) : (req.query.tournamentSport ? String(req.query.tournamentSport) : undefined);
    const photoUrl = req.query.photoUrl ? String(req.query.photoUrl) : (req.query.playerPhotoUrl ? String(req.query.playerPhotoUrl) : undefined);
    const logoUrl = req.query.logoUrl ? String(req.query.logoUrl) : (req.query.teamLogoUrl ? String(req.query.teamLogoUrl) : undefined);
    const shortCode = req.query.shortCode ? String(req.query.shortCode) : (req.query.teamShortCode ? String(req.query.teamShortCode) : undefined);
    const color = req.query.color ? String(req.query.color) : (req.query.teamColor ? String(req.query.teamColor) : undefined);
    const auctionUnit = (req.query.unit === "rupee" || req.query.auctionUnit === "rupee") ? "rupee" : "points";

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
      auctionUnit: authoritative.auctionUnit ?? undefined,
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
