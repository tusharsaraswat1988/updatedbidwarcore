/**
 * Terminal (finished) badminton match / fixture statuses.
 * Shared by API, UI, scoring adapters, and Tournament Stage Machine.
 *
 * Scoring match terminals omit `cancelled` (engine outcomes).
 * Fixture / stage terminality includes `cancelled` (will never be played).
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

/** Full terminal set for fixtures / stage advancement (includes cancelled). */
export const TERMINAL_MATCH_STATUSES = [
  ...BADMINTON_TERMINAL_MATCH_STATUSES,
  "cancelled",
] as const;

export type TerminalMatchStatus = (typeof TERMINAL_MATCH_STATUSES)[number];

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

/**
 * True when a match/fixture will not continue — stage machine SSoT.
 * Includes cancelled (fixture never played).
 */
export function isTerminalMatchStatus(
  status: string | null | undefined,
): boolean {
  return isBadmintonTerminalMatchStatus(status) || status === "cancelled";
}

/** Alias for DB `scoring_matches.status` checks (public scoreboards, match lists). */
export function isTerminalScoringMatchStatus(
  status: string | null | undefined,
): boolean {
  return isBadmintonTerminalMatchStatus(status);
}
