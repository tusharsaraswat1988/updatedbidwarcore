import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const CRICKET_SOCIETY_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.cricket.society",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Society League",
    description: "Community / society aesthetic for tennis-ball and local leagues.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.tennis_ball", "cricket.box", "cricket.outdoor"],
    status: "default",
    recommendation: "recommended",
    preview: { density: "friendly", theme: "society" },
  },
];
