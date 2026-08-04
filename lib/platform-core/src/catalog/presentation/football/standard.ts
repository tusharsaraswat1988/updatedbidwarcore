import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const FOOTBALL_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.football.standard",
    version: "1.0.0",
    sportId: "football",
    displayName: "Football Standard",
    description: "Placeholder football presentation pack.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["football.standard"],
    status: "beta",
    recommendation: "recommended",
    preview: { theme: "football" },
  },
];
