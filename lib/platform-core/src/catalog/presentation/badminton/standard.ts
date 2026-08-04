import type { PresentationProfileCatalogEntry } from "../../types.ts";

export const BADMINTON_PRESENTATION: readonly PresentationProfileCatalogEntry[] = [
  {
    kind: "presentation_profile",
    id: "presentation.badminton.standard",
    version: "1.0.0",
    sportId: "badminton",
    displayName: "Badminton Standard",
    description: "Default badminton public + court display presentation.",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "auction"],
    supportedVariants: ["badminton.standard"],
    status: "default",
    recommendation: "recommended",
    preview: { density: "standard", theme: "badminton" },
  },
  {
    kind: "presentation_profile",
    id: "presentation.badminton.broadcast",
    version: "1.0.0",
    sportId: "badminton",
    displayName: "Badminton Broadcast",
    description: "Broadcast-oriented badminton overlays (advanced).",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "auction"],
    supportedVariants: ["badminton.standard"],
    status: "beta",
    recommendation: "advanced",
    preview: { density: "broadcast", theme: "badminton_broadcast" },
  },
];
