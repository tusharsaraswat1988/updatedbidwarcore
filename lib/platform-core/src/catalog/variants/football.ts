import type { VariantCatalogEntry } from "../types.ts";

export const FOOTBALL_VARIANTS: readonly VariantCatalogEntry[] = [
  {
    kind: "variant",
    id: "football.standard",
    version: "1.0.0",
    sportId: "football",
    displayName: "Standard Football",
    description: "Placeholder football variant for future packs.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["football.standard"],
    status: "beta",
    recommendation: "advanced",
  },
];
