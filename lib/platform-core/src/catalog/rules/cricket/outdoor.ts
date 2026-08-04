import type { RuleProfileCatalogEntry } from "../../types.ts";

export const CRICKET_OUTDOOR_RULE_PROFILES: readonly RuleProfileCatalogEntry[] = [
  {
    kind: "rule_profile",
    id: "cricket.outdoor.t20_standard",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Outdoor T20 Standard",
    description: "20-over outdoor cricket with standard LBW and free-hit rules.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.outdoor"],
    status: "default",
    recommendation: "recommended",
    preview: { overs: 20, playersPerSide: 11, lbw: true, ball: "leather" },
  },
  {
    kind: "rule_profile",
    id: "cricket.outdoor.custom",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Outdoor Custom",
    description: "Flexible outdoor pack for society/corporate overs.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.outdoor", "cricket.custom"],
    status: "beta",
    recommendation: "advanced",
    preview: { overs: null, playersPerSide: 11, lbw: true, ball: "leather" },
  },
];
