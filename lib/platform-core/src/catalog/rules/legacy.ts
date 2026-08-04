import { value } from "../definitions/helpers.ts";
import { LEGACY_PROFILE } from "../types.ts";
import { ruleProfile } from "./profile-helpers.ts";

/** Legacy compatibility profile — status legacy; not offered on create. */
export const LEGACY_RULE_PROFILES = [
  ruleProfile({
    id: LEGACY_PROFILE.id,
    familyId: LEGACY_PROFILE.id,
    sportId: "cricket",
    displayName: LEGACY_PROFILE.displayName,
    description: LEGACY_PROFILE.description,
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "legacy",
    recommendation: "advanced",
    tags: ["legacy"],
    values: [
      value("cricket.match.overs_per_innings", "inherit"),
      value("cricket.match.max_wickets", "inherit"),
      value("cricket.match.playing_squad_size", "inherit"),
      value("cricket.match.bench_size", "inherit"),
      value("cricket.match.balls_per_over", "inherit"),
      value("cricket.match.ball_type", "inherit"),
      value("cricket.dismissal.lbw_enabled", "inherit"),
      value("cricket.bowling.free_hit_enabled", "inherit"),
      value("cricket.batting.retire_at_runs", "inherit"),
      value("cricket.powerplay.enabled", "inherit"),
      value("cricket.tie_break.ties_allowed", "inherit"),
      value("cricket.tie_break.super_over_enabled", "inherit"),
      value("cricket.boundary.four_runs", "inherit"),
      value("cricket.boundary.six_runs", "inherit"),
    ],
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "legacy",
    },
  }),
] as const;
