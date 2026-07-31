/**
 * Terminal (finished) badminton match statuses — engine + DB scoring_matches.
 * Shared by API, UI, and scoring adapters.
 */

export const BADMINTON_TERMINAL_MATCH_STATUSES = [
  "completed",
  "walkover",
  "retired",
  "disqualified",
  "abandoned",
] as const;

export type BadmintonTerminalMatchStatus =
  (typeof BADMINTON_TERMINAL_MATCH_STATUSES)[number];

export function isBadmintonTerminalMatchStatus(
  status: string | null | undefined,
): status is BadmintonTerminalMatchStatus {
  return (
    status === "completed" ||
    status === "walkover" ||
    status === "retired" ||
    status === "disqualified" ||
    status === "abandoned"
  );
}

/** Alias for DB `scoring_matches.status` checks (public scoreboards, match lists). */
export function isTerminalScoringMatchStatus(
  status: string | null | undefined,
): boolean {
  return isBadmintonTerminalMatchStatus(status);
}
