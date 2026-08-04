import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const CRICKET_INDOOR_BOX_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.cricket.indoor_box",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Indoor Box",
    description: "Indoor / box venue presentation with tight scorebug density.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.box", "cricket.indoor"],
    status: "default",
    recommendation: "auto_suggested",
    preview: { density: "tight", theme: "indoor_box" },
  },
];
