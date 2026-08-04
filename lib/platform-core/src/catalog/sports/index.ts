import type { SportCatalogEntry } from "../types.ts";

export const SPORT_CATALOG: readonly SportCatalogEntry[] = [
  {
    kind: "sport",
    id: "cricket",
    version: "1.0.0",
    displayName: "Cricket",
    description: "Outdoor, box, tennis-ball, and indoor cricket tournaments.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: [
      "cricket.outdoor",
      "cricket.box",
      "cricket.tennis_ball",
      "cricket.indoor",
      "cricket.custom",
    ],
    status: "default",
    recommendation: "recommended",
  },
  {
    kind: "sport",
    id: "badminton",
    version: "1.0.0",
    displayName: "Badminton",
    description: "Singles and doubles badminton tournaments with draw-based competition.",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "auction"],
    supportedVariants: ["badminton.standard"],
    status: "default",
    recommendation: "recommended",
  },
  {
    kind: "sport",
    id: "football",
    version: "1.0.0",
    displayName: "Football",
    description: "Football tournaments (catalog placeholder for future packs).",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["football.standard"],
    status: "beta",
    recommendation: "advanced",
  },
];
