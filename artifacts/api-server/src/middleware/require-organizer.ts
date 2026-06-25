import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isOrganizerAccountLocked } from "@workspace/api-base/organizer-account";

function isLockedOrganizerAccount(req: Request): boolean {
  const status = req.organizerAccountLicenseStatus;
  return !!status && isOrganizerAccountLocked(status);
}

/**
 * Strict tournament-scoped organizer check.
 * Grants access when caller is admin, holds organizer[tournamentId] JWT flag,
 * or organizerAccountId matches tournament.organizerId.
 */
export function isTournamentOrganizer(
  req: Request,
  tournamentId: number,
  tournamentOrganizerId: number | null | undefined,
): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  if (isLockedOrganizerAccount(req)) return false;
  if (u.organizer?.[String(tournamentId)]) return true;
  if (u.organizerAccountId != null && tournamentOrganizerId != null) {
    return u.organizerAccountId === tournamentOrganizerId;
  }
  return false;
}

/**
 * Returns true when the caller is an admin or the tournament-scoped organizer.
 * When tournamentOrganizerId is omitted, only admin or per-tournament JWT flag passes
 * (organizerAccountId alone is NOT sufficient — prevents cross-tournament access).
 */
export function isOrganizerOrAdmin(
  req: Request,
  tournamentId: number,
  tournamentOrganizerId?: number | null,
): boolean {
  if (tournamentOrganizerId !== undefined) {
    return isTournamentOrganizer(req, tournamentId, tournamentOrganizerId);
  }
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  if (isLockedOrganizerAccount(req)) return false;
  return !!u.organizer?.[String(tournamentId)];
}

/**
 * Async guard for mutating routes. Loads tournament and verifies strict organizer scope.
 * Returns false and writes 403/404 when unauthorized.
 */
export async function requireTournamentOrganizer(
  req: Request,
  res: Response,
  tournamentId: number,
): Promise<boolean> {
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return false;
  }

  if (!isTournamentOrganizer(req, tournamentId, tournament.organizerId)) {
    res.status(403).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

/** Resolve whether caller may see private tournament/player/team fields. */
export async function canAccessPrivateTournamentData(
  req: Request,
  tournamentId: number,
): Promise<boolean> {
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!tournament) return false;
  return isTournamentOrganizer(req, tournamentId, tournament.organizerId);
}

/**
 * Returns true when the caller is an admin or holds an organizer account.
 * Use for resource creation endpoints where no tournamentId exists yet
 * (e.g. POST /tournaments).
 */
export function isAccountOrAdmin(req: Request): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  if (!u.organizerAccountId) return false;
  return !isLockedOrganizerAccount(req);
}
