/** DB `scoring_matches.status` values that represent a finished match for public display. */
export const TERMINAL_SCORING_MATCH_STATUSES = ["completed", "abandoned"] as const;

export function isTerminalScoringMatchStatus(status: string): boolean {
  return status === "completed" || status === "abandoned";
}
