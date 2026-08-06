import { value } from "../../definitions/helpers.ts";
import { ruleProfile } from "../profile-helpers.ts";

export const FOOTBALL_RULE_PROFILES = [
  ruleProfile({
    id: "football.standard",
    sportId: "football",
    displayName: "Football Standard",
    description: "Placeholder football rule pack for future expansion.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["football.standard"],
    status: "beta",
    recommendation: "recommended",
    tags: ["placeholder"],
    values: [value("football.match.duration_minutes", 90)],
    runtimeBinding: {
      runtimeBindingType: "football_platform_defaults",
      runtimeBindingId: "standard",
    },
  }),
] as const;
