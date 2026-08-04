import type { RuleProfileCatalogEntry } from "../../types.ts";

export const CRICKET_INDOOR_RULE_PROFILES: readonly RuleProfileCatalogEntry[] = [
  {
    kind: "rule_profile",
    id: "cricket.indoor.standard",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Indoor Standard",
    description: "Compact indoor cricket overs and squad sizes.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.indoor"],
    status: "default",
    recommendation: "recommended",
    preview: { overs: 10, playersPerSide: 8, lbw: false, ball: "indoor" },
  },
];
