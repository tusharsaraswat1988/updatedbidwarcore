/** Auction tournament lifecycle statuses (draft/setup → live → done). */
export const TOURNAMENT_LIFECYCLE_STATUSES = ["setup", "active", "paused", "completed"] as const;

export type TournamentLifecycleStatus = typeof TOURNAMENT_LIFECYCLE_STATUSES[number];

/** Sports with a stabilized scoring module on the platform. */
export const SCORING_ENABLED_SPORTS = ["cricket", "badminton"] as const;

export function isScoringSupportedSport(sport: string): boolean {
  const normalized = sport.trim().toLowerCase();
  return (SCORING_ENABLED_SPORTS as readonly string[]).includes(normalized);
}
