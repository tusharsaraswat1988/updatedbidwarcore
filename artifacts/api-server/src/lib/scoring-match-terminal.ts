/**
 * DB `scoring_matches.status` values that represent a finished match for public display.
 * Includes badminton terminal outcomes (walkover / retired / disqualified) so they are
 * not omitted after S3-08 stopped collapsing them to plain `completed`.
 */
export const TERMINAL_SCORING_MATCH_STATUSES = [
  "completed",
  "abandoned",
  "walkover",
  "retired",
  "disqualified",
] as const;

export function isTerminalScoringMatchStatus(status: string): boolean {
  return (
    status === "completed" ||
    status === "abandoned" ||
    status === "walkover" ||
    status === "retired" ||
    status === "disqualified"
  );
}
