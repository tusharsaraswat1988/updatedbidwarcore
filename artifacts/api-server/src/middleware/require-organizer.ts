import type { Request } from "express";

/**
 * Returns true when the caller is an admin, any organizer-account holder,
 * OR the tournament-specific organizer for the given tournament ID.
 *
 * Use this for all mutating routes that are scoped to a tournament:
 *   if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
 */
export function isOrganizerOrAdmin(req: Request, tournamentId: number): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  return !!(u.isAdmin || u.organizerAccountId || u.organizer?.[String(tournamentId)]);
}

/**
 * Returns true when the caller is an admin or holds an organizer account.
 * Use for resource creation endpoints where no tournamentId exists yet
 * (e.g. POST /tournaments).
 */
export function isAccountOrAdmin(req: Request): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  return !!(u.isAdmin || u.organizerAccountId);
}
