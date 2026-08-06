import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

export const CRICKET_CUSTOM_RULE_PROFILES = [
  ruleProfile({
    id: "cricket.custom.blank",
    sportId: "cricket",
    displayName: "Custom Cricket Pack",
    description: "Starting point for organizer-defined cricket rules (resolved later by Rule Engine).",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.custom"],
    status: "beta",
    recommendation: "advanced",
    tags: ["custom"],
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
      runtimeBindingId: "custom_blank",
    },
  }),
] as const;
