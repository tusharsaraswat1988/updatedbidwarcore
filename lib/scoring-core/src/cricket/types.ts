/** ICC dismissal types supported in Phase 2. */
export const DISMISSAL_TYPES = [
  "bowled",
  "caught",
  "run_out",
  "stumped",
  "lbw",
  "hit_wicket",
  "timed_out",
  "obstructing_field",
  "hit_ball_twice",
  "retired_out",
] as const;

export type DismissalType = (typeof DISMISSAL_TYPES)[number];

export const EXTRA_TYPES = ["wide", "no_ball", "bye", "leg_bye", "penalty"] as const;
export type ExtraType = (typeof EXTRA_TYPES)[number];

/** On a free hit, only these dismissals are valid. */
export const FREE_HIT_DISMISSALS: DismissalType[] = [
  "run_out",
  "obstructing_field",
  "hit_wicket",
  "hit_ball_twice",
  "timed_out",
];
