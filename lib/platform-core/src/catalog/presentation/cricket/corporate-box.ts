import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const CRICKET_CORPORATE_BOX_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.cricket.corporate_box",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Corporate Box",
    description: "Compact corporate box cricket graphics and LED density.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.box"],
    status: "default",
    recommendation: "recommended",
    preview: { density: "compact", theme: "corporate_box" },
  },
];
