import type { BadmintonGameState, BadmintonMatchState } from "./types";

/** True when at least one game finished with a winner. */
export function hasCompletedGames(
  games: BadmintonGameState[] | undefined | null,
): boolean {
  if (!games?.length) return false;
  return games.some((g) => g.phase === "completed" || !!g.winner);
}

/**
 * Validate director-assigned margin for terminals with no completed games.
 * Returns an error message, or null when valid / not required.
 */
export function validateAssignedMarginPoints(
  state: Pick<BadmintonMatchState, "games">,
  assignedMarginPoints: number | undefined | null,
): string | null {
  if (hasCompletedGames(state.games)) return null;
  if (
    assignedMarginPoints == null ||
    !Number.isInteger(assignedMarginPoints) ||
    assignedMarginPoints < 1
  ) {
    return "Margin points are required (positive integer) when no games were completed";
  }
  return null;
}

/** Normalize optional assigned margin for event payloads (omit when not needed). */
export function resolveAssignedMarginForCommand(
  state: Pick<BadmintonMatchState, "games">,
  assignedMarginPoints: number | undefined,
): { ok: true; value?: number } | { ok: false; error: string } {
  const error = validateAssignedMarginPoints(state, assignedMarginPoints);
  if (error) return { ok: false, error };
  if (hasCompletedGames(state.games)) return { ok: true };
  return { ok: true, value: assignedMarginPoints! };
}
