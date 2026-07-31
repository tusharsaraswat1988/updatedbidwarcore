import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isOrganizerAccountLocked } from "@workspace/api-base/organizer-account";

function isLockedOrganizerAccount(req: Request): boolean {
  const status = req.organizerAccountLicenseStatus;
  return !!status && isOrganizerAccountLocked(status);
}

function isPhoneIncompleteOrganizer(req: Request): boolean {
  return !!req.organizerPhoneIncomplete;
}

/** Parse tournament id from `/api/tournaments/:id/...` paths (middleware runs before router mount). */
export function tournamentIdFromApiPath(path: string): number | null {
  const match = path.match(/^\/api\/tournaments\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

/** Admin or per-tournament organizer JWT (password login / /me bootstrap). */
export function hasTournamentOrganizerJwt(req: Request, tournamentId: number): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  return !!u.organizer?.[String(tournamentId)];
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
  // Tournament password / /me bootstrap — independent of account phone OTP.
  if (u.organizer?.[String(tournamentId)]) return true;
  if (isLockedOrganizerAccount(req)) return false;
  if (isPhoneIncompleteOrganizer(req)) return false;
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
  if (u.organizer?.[String(tournamentId)]) return true;
  if (isLockedOrganizerAccount(req)) return false;
  if (isPhoneIncompleteOrganizer(req)) return false;
  return false;
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
  if (isLockedOrganizerAccount(req)) return false;
  if (isPhoneIncompleteOrganizer(req)) return false;
  return true;
}
