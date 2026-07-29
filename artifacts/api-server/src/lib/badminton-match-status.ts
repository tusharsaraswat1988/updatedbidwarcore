/**
 * Badminton match / fixture / scoring_matches status mapping.
 *
 * Engine `BadmintonMatchState.matchStatus` is the source of truth for terminal
 * outcomes. Snapshots must preserve walkover / retired / disqualified /
 * abandoned rather than collapsing them to plain `completed`.
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

/**
 * Map engine matchStatus → `scoring_matches.status`.
 * Terminal outcomes are preserved (not rewritten as `completed`).
 */
export function mapBadmintonStatusToScoringMatchStatus(
  matchStatus: string,
): string {
  if (isBadmintonTerminalMatchStatus(matchStatus)) return matchStatus;
  if (matchStatus === "live" || matchStatus === "paused") return matchStatus;
  if (matchStatus === "scheduled" || matchStatus === "not_started") {
    return "scheduled";
  }
  return matchStatus;
}

/**
 * Map engine matchStatus → `badminton_fixtures.status`.
 * Walkover / retired / disqualified / abandoned stay distinct from completed.
 */
export function mapBadmintonStatusToFixtureStatus(matchStatus: string): string {
  switch (matchStatus) {
    case "completed":
      return "completed";
    case "walkover":
      return "walkover";
    case "retired":
      return "retired";
    case "disqualified":
      return "disqualified";
    case "abandoned":
      return "abandoned";
    case "live":
    case "paused":
      return "live";
    default:
      return matchStatus;
  }
}

/** True when master-stats pipeline may run for this engine status. */
export function shouldRunBadmintonMasterStatistics(
  matchStatus: string | null | undefined,
): boolean {
  return isBadmintonTerminalMatchStatus(matchStatus);
}

/**
 * Idempotency gate: skip when a processed marker is already set.
 * Used by the master-stats pipeline so re-runs do not double-count.
 */
export function shouldApplyMasterStatisticsForMatch(
  masterStatsAppliedAt: Date | string | null | undefined,
): boolean {
  return masterStatsAppliedAt == null;
}
