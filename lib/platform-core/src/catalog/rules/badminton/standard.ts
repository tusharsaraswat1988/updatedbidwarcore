import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

const ALL_COMP = ["registered_teams", "hybrid", "practice", "auction"] as const;

function badmintonValues(input: {
  presetId: "standard_bwf" | "fast_match" | "single_game" | "custom";
  totalGames: number;
  pointsPerGame: number;
  deuceAt: number;
  maxPoints: number;
  midGameSideChange: boolean;
}) {
  return [
    value("badminton.tournament.preset_id", input.presetId),
    value("badminton.match.total_games", input.totalGames),
    value("badminton.match.points_per_game", input.pointsPerGame),
    value("badminton.match.deuce_at", input.deuceAt),
    value("badminton.match.max_points", input.maxPoints),
    value("badminton.match.mid_game_side_change", input.midGameSideChange),
  ] as const;
}

export const BADMINTON_RULE_PROFILES = [
  ruleProfile({
    id: "badminton.standard_bwf",
    sportId: "badminton",
    displayName: "BWF Standard",
    description: "Best-of-3 to 21 points with standard BWF scoring.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["badminton.standard"],
    status: "active",
    recommendation: "recommended",
    tags: ["bwf", "standard"],
    values: badmintonValues({
      presetId: "standard_bwf",
      totalGames: 3,
      pointsPerGame: 21,
      deuceAt: 20,
      maxPoints: 30,
      midGameSideChange: true,
    }),
    runtimeBinding: {
      runtimeBindingType: "badminton_match_format",
      runtimeBindingId: "standard_bwf",
    },
  }),
  ruleProfile({
    id: "badminton.fast_match",
    sportId: "badminton",
    displayName: "Fast Match",
    description: "Shorter badminton format for busy tournament days.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["badminton.standard"],
    status: "active",
    recommendation: "auto_suggested",
    tags: ["fast"],
    values: badmintonValues({
      presetId: "fast_match",
      totalGames: 3,
      pointsPerGame: 15,
      deuceAt: 14,
      maxPoints: 21,
      midGameSideChange: true,
    }),
    runtimeBinding: {
      runtimeBindingType: "badminton_match_format",
      runtimeBindingId: "fast_match",
    },
  }),
  ruleProfile({
    id: "badminton.single_game",
    sportId: "badminton",
    displayName: "Single Game",
    description: "One game to 21 points.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["badminton.standard"],
    status: "active",
    recommendation: "advanced",
    tags: ["single_game"],
    values: badmintonValues({
      presetId: "single_game",
      totalGames: 1,
      pointsPerGame: 21,
      deuceAt: 20,
      maxPoints: 30,
      midGameSideChange: false,
    }),
    runtimeBinding: {
      runtimeBindingType: "badminton_match_format",
      runtimeBindingId: "single_game",
    },
  }),
  ruleProfile({
    id: "badminton.custom",
    sportId: "badminton",
    displayName: "Custom Badminton",
    description: "Advanced custom badminton scoring pack.",
    supportedCompetitionTypes: ALL_COMP,
    supportedVariants: ["badminton.standard"],
    status: "beta",
    recommendation: "advanced",
    tags: ["custom"],
    values: badmintonValues({
      presetId: "custom",
      totalGames: 3,
      pointsPerGame: 21,
      deuceAt: 20,
      maxPoints: 30,
      midGameSideChange: true,
    }),
    runtimeBinding: {
      runtimeBindingType: "badminton_match_format",
      runtimeBindingId: "custom",
    },
  }),
] as const;
