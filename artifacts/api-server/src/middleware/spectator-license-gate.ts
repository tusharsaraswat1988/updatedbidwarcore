import type { Request, Response } from "express";
import { isTournamentLicensed } from "@workspace/platform-core";
import { canAccessPrivateTournamentData } from "./require-organizer";

export interface SpectatorLicenseCandidate {
  id: number;
  licenseStatus?: string | null;
  status?: string;
  licenseGrantedAt?: Date | string | null;
  adminLocked?: boolean;
}

/**
 * Ensures spectator access to premium features (scoring, full rosters, player profiles,
 * live updates, auction stream) is restricted to licensed tournaments only.
 *
 * - Organizers and administrators are always authorized to view their tournament data.
 * - For public spectators, tournament must hold an active or historically granted license.
 * - Returns true if authorized; returns false and responds with HTTP 403 if unlicensed.
 */
export async function guardSpectatorLicense(
  req: Request,
  res: Response,
  tournament: SpectatorLicenseCandidate,
  featureName: string = "This feature",
): Promise<boolean> {
  const isOrganizer = await canAccessPrivateTournamentData(req, tournament.id);
  if (isOrganizer) {
    return true;
  }

  if (!isTournamentLicensed(tournament)) {
    res.status(403).json({
      error: `${featureName} requires an active BidWar licence.`,
      code: "UNLICENSED_TOURNAMENT",
      tournamentId: tournament.id,
    });
    return false;
  }

  return true;
}
