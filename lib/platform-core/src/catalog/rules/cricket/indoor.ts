import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

export const CRICKET_INDOOR_RULE_PROFILES = [
  ruleProfile({
    id: "cricket.indoor.standard",
    sportId: "cricket",
    displayName: "Indoor Standard",
    description: "Compact indoor cricket overs and squad sizes.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.indoor"],
    status: "active",
    recommendation: "recommended",
    tags: ["indoor"],
    values: [
      value("cricket.match.overs_per_innings", 10),
      value("cricket.match.max_wickets", 10),
      value("cricket.match.playing_squad_size", 8),
      value("cricket.match.bench_size", 2),
      value("cricket.match.balls_per_over", 6),
      value("cricket.match.ball_type", "indoor"),
      value("cricket.dismissal.lbw_enabled", false),
      value("cricket.bowling.free_hit_enabled", true),
      value("cricket.batting.retire_at_runs", 30),
      value("cricket.powerplay.enabled", false),
      value("cricket.tie_break.ties_allowed", true),
      value("cricket.tie_break.super_over_enabled", true),
      value("cricket.boundary.four_runs", 4),
      value("cricket.boundary.six_runs", 6),
    ],
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "indoor_standard",
    },
  }),
] as const;
