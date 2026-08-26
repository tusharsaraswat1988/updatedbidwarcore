import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

const ALL_COMP = ["auction", "registered_teams", "hybrid", "practice"] as const;

const T20_VALUES = [
  value("cricket.match.overs_per_innings", 20),
  value("cricket.match.max_wickets", 10),
  value("cricket.match.playing_squad_size", 11),
  value("cricket.match.playing_xi_enforced", false),
  value("cricket.match.bench_size", 4),
  value("cricket.match.balls_per_over", 6),
  value("cricket.match.ball_type", "leather"),
  value("cricket.dismissal.lbw_enabled", true),
  value("cricket.extras.leg_bye_enabled", true),
  value("cricket.bowling.free_hit_enabled", true),
  value("cricket.batting.retire_at_runs", null),
  value("cricket.powerplay.enabled", true),
  value("cricket.tie_break.ties_allowed", true),
  value("cricket.tie_break.super_over_enabled", true),
  value("cricket.special.super_ball_enabled", false),
  value("cricket.tie_break.super_over_overs", 1),
  value("cricket.tie_break.super_over_wickets", 2),
  value("cricket.tie_break.super_over_trigger", "manual"),
  value("cricket.boundary.four_runs", 4),
  value("cricket.boundary.six_runs", 6),
] as const;

export const CRICKET_OUTDOOR_RULE_PROFILES = [
  ruleProfile({
    id: "cricket.outdoor.t20_standard",
    sportId: "cricket",
    displayName: "Outdoor T20 Standard",
    description:
      "20-over outdoor cricket documenting current platform defaults.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["cricket.outdoor"],
    status: "active",
    recommendation: "recommended",
    tags: ["t20", "outdoor", "leather"],
    values: T20_VALUES,
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "outdoor_t20_current",
    },
  }),
  ruleProfile({
    id: "cricket.outdoor.custom",
    sportId: "cricket",
    displayName: "Outdoor Custom",
    description:
      "Flexible outdoor pack; overs left to organizer runtime defaults.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["cricket.outdoor", "cricket.custom"],
    status: "beta",
    recommendation: "advanced",
    tags: ["outdoor", "custom"],
    values: [
      value("cricket.match.overs_per_innings", "inherit"),
      value("cricket.match.max_wickets", 10),
      value("cricket.match.playing_squad_size", 11),
      value("cricket.match.playing_xi_enforced", false),
      value("cricket.match.bench_size", 4),
      value("cricket.match.balls_per_over", 6),
      value("cricket.match.ball_type", "leather"),
      value("cricket.dismissal.lbw_enabled", true),
      value("cricket.extras.leg_bye_enabled", true),
      value("cricket.bowling.free_hit_enabled", true),
      value("cricket.batting.retire_at_runs", null),
      value("cricket.powerplay.enabled", true),
      value("cricket.tie_break.ties_allowed", true),
      value("cricket.tie_break.super_over_enabled", true),
      value("cricket.special.super_ball_enabled", false),
      value("cricket.tie_break.super_over_overs", 1),
      value("cricket.tie_break.super_over_wickets", 2),
      value("cricket.tie_break.super_over_trigger", "manual"),
      value("cricket.boundary.four_runs", 4),
      value("cricket.boundary.six_runs", 6),
    ],
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "outdoor_custom",
    },
  }),
] as const;
