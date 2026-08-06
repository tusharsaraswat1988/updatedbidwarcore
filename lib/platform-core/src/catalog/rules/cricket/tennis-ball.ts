import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

export const CRICKET_TENNIS_BALL_RULE_PROFILES = [
  ruleProfile({
    id: "cricket.tennis_ball.community",
    sportId: "cricket",
    displayName: "Tennis Ball Community",
    description: "Community tennis-ball cricket with LBW typically off.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.tennis_ball"],
    status: "active",
    recommendation: "recommended",
    tags: ["tennis_ball"],
    values: [
      value("cricket.match.overs_per_innings", 12),
      value("cricket.match.max_wickets", 10),
      value("cricket.match.playing_squad_size", 11),
      value("cricket.match.bench_size", 4),
      value("cricket.match.balls_per_over", 6),
      value("cricket.match.ball_type", "tennis"),
      value("cricket.dismissal.lbw_enabled", false),
      value("cricket.bowling.free_hit_enabled", true),
      value("cricket.batting.retire_at_runs", null),
      value("cricket.powerplay.enabled", false),
      value("cricket.tie_break.ties_allowed", true),
      value("cricket.tie_break.super_over_enabled", true),
      value("cricket.boundary.four_runs", 4),
      value("cricket.boundary.six_runs", 6),
    ],
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "tennis_ball_community",
    },
  }),
] as const;
