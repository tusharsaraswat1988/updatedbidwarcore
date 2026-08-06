import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

const ALL_COMP = ["auction", "registered_teams", "hybrid", "practice"] as const;

function boxValues(overrides: {
  overs: number;
  players: number;
  ball?: string;
}) {
  return [
    value("cricket.match.overs_per_innings", overrides.overs),
    value("cricket.match.max_wickets", 10),
    value("cricket.match.playing_squad_size", overrides.players),
    value("cricket.match.bench_size", 2),
    value("cricket.match.balls_per_over", 6),
    value("cricket.match.ball_type", overrides.ball ?? "tennis"),
    value("cricket.dismissal.lbw_enabled", false),
    value("cricket.bowling.free_hit_enabled", true),
    value("cricket.batting.retire_at_runs", 30),
    value("cricket.powerplay.enabled", false),
    value("cricket.tie_break.ties_allowed", true),
    value("cricket.tie_break.super_over_enabled", true),
    value("cricket.boundary.four_runs", 4),
    value("cricket.boundary.six_runs", 6),
  ] as const;
}

export const CRICKET_BOX_RULE_PROFILES = [
  ruleProfile({
    id: "cricket.box.corporate_standard",
    sportId: "cricket",
    displayName: "Corporate Box Standard",
    description: "Short-overs box cricket tuned for corporate leagues.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["cricket.box"],
    status: "active",
    recommendation: "recommended",
    tags: ["box", "corporate"],
    values: boxValues({ overs: 6, players: 8 }),
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "box_corporate",
    },
  }),
  ruleProfile({
    id: "cricket.box.society",
    sportId: "cricket",
    displayName: "Society Box",
    description: "Relaxed box rules for society / weekend leagues.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["cricket.box"],
    status: "active",
    recommendation: "auto_suggested",
    tags: ["box", "society"],
    values: boxValues({ overs: 8, players: 8 }),
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "box_society",
    },
  }),
  ruleProfile({
    id: "cricket.box.legacy_retired",
    sportId: "cricket",
    displayName: "Box Legacy (Retired)",
    description: "Deprecated pack retained for compatibility tests — not selectable on create.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["cricket.box"],
    status: "deprecated",
    recommendation: "advanced",
    tags: ["box", "legacy"],
    values: boxValues({ overs: 5, players: 7 }),
    runtimeBinding: {
      runtimeBindingType: "cricket_platform_defaults",
      runtimeBindingId: "box_legacy_retired",
    },
  }),
] as const;
