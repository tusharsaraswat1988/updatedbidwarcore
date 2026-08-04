import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const CRICKET_OUTDOOR_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.cricket.outdoor",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Outdoor Broadcast",
    description: "Classic outdoor cricket public + LED presentation pack.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.outdoor", "cricket.custom"],
    status: "default",
    recommendation: "recommended",
    preview: { density: "standard", theme: "outdoor" },
  },
];
