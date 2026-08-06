import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const CRICKET_SOCIETY_PRESENTATION = [
  presentationProfile({
    id: "presentation.cricket.society",
    sportId: "cricket",
    displayName: "Society League",
    description: "Community / society aesthetic for tennis-ball and local leagues.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.tennis_ball", "cricket.box", "cricket.outdoor"],
    status: "active",
    recommendation: "recommended",
    tags: ["society"],
    values: standardPresentationValues(),
    preview: { density: "friendly", theme: "society" },
  }),
] as const;
