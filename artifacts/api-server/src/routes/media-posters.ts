import { Router, type Request, type Response } from "express";
import {
  getPlayerSoldPosterBufferByToken,
} from "../lib/poster/player-sold-poster-service.js";
import { generatePlayerSoldPosterBuffer } from "../lib/poster/player-sold-poster-generator.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * GET /api/media/player-sold-poster/preview.png
 * Generates an illustrative sample Player Sold poster on-demand.
 * Supports query parameters (?name=...&team=...&price=...&tournament=...)
 * Note: Must be registered BEFORE /:token.png so "preview" is not captured as a token.
 */
router.get("/media/player-sold-poster/preview.png", async (req: Request, res: Response) => {
  try {
    const playerName = String(req.query.name || "Virat Kohli");
    const teamName = String(req.query.team || "Royal Challengers");
    const tournamentName = String(req.query.tournament || "Premier League 2026");
    const amount = Number(req.query.price || 2500000);
    const role = String(req.query.role || "Top-Order Batter");

    const buffer = await generatePlayerSoldPosterBuffer({
      playerName,
      playerRole: role,
      teamName,
      amount,
      tournamentName,
      tournamentSport: "Cricket",
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
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
