import type { RuleProfileCatalogEntry } from "../../types.ts";

export const FOOTBALL_RULE_PROFILES: readonly RuleProfileCatalogEntry[] = [
  {
    kind: "rule_profile",
    id: "football.standard",
    version: "1.0.0",
    sportId: "football",
    displayName: "Football Standard",
    description: "Placeholder football rule pack for future expansion.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["football.standard"],
    status: "beta",
    recommendation: "recommended",
    preview: { note: "Future rule engine pack" },
  },
];
