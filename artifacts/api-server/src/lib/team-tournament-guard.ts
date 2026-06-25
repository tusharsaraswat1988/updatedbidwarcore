import { db } from "@workspace/db";
import { teamsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Response } from "express";

type TeamRow = typeof teamsTable.$inferSelect;

export type TeamTournamentGuardResult =
  | { ok: true; team: TeamRow }
  | { ok: false; status: number; error: string };

/**
 * Validates that teamId belongs to tournamentId.
 * Returns 403 when the team exists but belongs to a different tournament (IDOR).
 * Returns 404 when the team does not exist at all.
 */
export async function validateTeamBelongsToTournament(
  tournamentId: number,
  teamId: number,
): Promise<TeamTournamentGuardResult> {
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)));

  if (team) return { ok: true, team };

  const [anyTeam] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));

  if (anyTeam) {
    return { ok: false, status: 403, error: "Team does not belong to this tournament" };
  }
  return { ok: false, status: 404, error: "Team not found" };
}

/** Express helper — writes response and returns null when validation fails. */
export async function requireTeamInTournament(
  res: Response,
  tournamentId: number,
  teamId: number,
): Promise<TeamRow | null> {
  const result = await validateTeamBelongsToTournament(tournamentId, teamId);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return null;
  }
  return result.team;
}
