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

export interface GuardSpectatorLicenseOptions {
  /**
   * When true, an authenticated organizer or administrator can access the endpoint
   * for tournament management workspaces, PROVIDED the request is NOT in spectator scope.
   */
  allowOrganizerManagement?: boolean;
}

/**
 * Ensures spectator access to premium features (scoring, full rosters, player profiles,
 * live updates, auction stream) is restricted to licensed tournaments only.
 *
 * Rules:
 * - Pure spectator endpoints (Fan Arena, spectator streams, public spectator views)
 *   enforce tournament licensing strictly: unlicensed tournaments are blocked with 403 UNLICENSED_TOURNAMENT.
 * - Authenticated organiser sessions do NOT bypass spectator licence restrictions when accessing
 *   spectator surfaces or when scope=spectator is requested.
 * - Dedicated management workspaces retain their legitimate management functionality via explicit options.
 * - Returns true if authorized; returns false and responds with HTTP 403 if unlicensed.
 */
export async function guardSpectatorLicense(
  req: Request,
  res: Response,
  tournament: SpectatorLicenseCandidate,
  featureName: string = "This feature",
  options?: GuardSpectatorLicenseOptions,
): Promise<boolean> {
  const isSpectatorScope = req.query.scope === "spectator" || req.headers["x-bidwar-scope"] === "spectator";

  // Dedicated management workspace bypass (only if explicitly enabled and not in spectator scope)
  if (options?.allowOrganizerManagement && !isSpectatorScope) {
    const isOrganizer = await canAccessPrivateTournamentData(req, tournament.id);
    if (isOrganizer) {
      return true;
    }
  }

  // Pure spectator request or non-organizer: enforce active or historically granted license strictly.
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
