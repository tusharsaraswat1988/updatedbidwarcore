import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const FOOTBALL_PRESENTATION = [
  presentationProfile({
    id: "presentation.football.standard",
    sportId: "football",
    displayName: "Football Standard",
    description: "Placeholder football presentation pack.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["football.standard"],
    status: "beta",
    recommendation: "recommended",
    tags: ["football"],
    values: standardPresentationValues(),
    preview: { theme: "football" },
  }),
] as const;
