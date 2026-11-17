import type { Request, Response } from "express";
import { resolveTournamentVisibility } from "@workspace/platform-core/tournament-features";
import { canAccessPrivateTournamentData } from "./require-organizer";
import {
  secureComparePins,
  checkPinRateLimit,
  recordPinAttempt,
} from "../lib/pin-security";

export interface PrivateTournamentGateCandidate {
  id: number;
  scoringPin?: string | null;
  featuresJson?: unknown;
}

/**
 * Reusable spectator authorization and privacy gate for private and unlisted tournaments.
 *
 * Rules:
 * 1. If tournament visibility is 'private' or 'unlisted', immediately attach no-store cache headers.
 * 2. If tournament visibility is 'private':
 *    - Allows access if caller is verified tournament organizer or administrator.
 *    - For unauthenticated spectators, verifies PIN strictly supplied via 'x-bidwar-pin' HTTP header.
 *    - Query-string fallback ('?pin=...') is strictly forbidden to prevent credential leakage.
 *    - Applies per-IP rate limiting (5 failed attempts locks out for 10 minutes).
 *    - Returns false and outputs 403 or 429 response if authorization fails.
 * 3. Returns true if caller is authorized to view spectator tournament data.
 */
export async function guardPrivateTournamentSpectator(
  req: Request,
  res: Response,
  tournament: PrivateTournamentGateCandidate,
): Promise<boolean> {
  const visibility = resolveTournamentVisibility(tournament.featuresJson);
  const isOrganizer = await canAccessPrivateTournamentData(req, tournament.id);

  if (visibility === "private" || visibility === "unlisted") {
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
  }

  if (visibility === "private" && !isOrganizer) {
    const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

    const rateCheck = checkPinRateLimit(clientIp, tournament.id);
    if (!rateCheck.allowed) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds || 600));
      res.status(429).json({
        error: "Too many failed PIN attempts. Access locked out temporarily.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return false;
    }

    // Strictly header-only authentication — query-string PIN fallback removed
    if (req.query.pin !== undefined) {
      res.status(403).json({
        error: "PIN must be supplied in the x-bidwar-pin header, not as a query parameter.",
        code: "INVALID_AUTH_METHOD",
      });
      return false;
    }

    const pin = (req.headers["x-bidwar-pin"] as string) || "";
    const pinMatches = secureComparePins(pin, tournament.scoringPin);
    const attemptResult = recordPinAttempt(clientIp, tournament.id, pinMatches);

    if (!pinMatches) {
      if (attemptResult.lockedOut) {
        res.setHeader("Retry-After", String(attemptResult.retryAfterSeconds || 600));
        res.status(429).json({
          error: "Too many failed PIN attempts. Access locked out for 10 minutes.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfterSeconds: attemptResult.retryAfterSeconds,
        });
        return false;
      }

      res.status(403).json({
        error: "This tournament is private",
        code: "PRIVATE_TOURNAMENT",
      });
      return false;
    }
  }

  return true;
}
