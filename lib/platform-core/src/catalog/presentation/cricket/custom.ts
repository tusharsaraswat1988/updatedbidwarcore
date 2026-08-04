import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const CRICKET_CUSTOM_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.cricket.custom",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Custom Presentation",
    description: "Blank presentation binding for organizer branding later.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["*"],
    status: "beta",
    recommendation: "advanced",
    preview: { density: "custom", theme: "custom" },
  },
];
