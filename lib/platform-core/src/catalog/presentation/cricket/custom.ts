import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const CRICKET_CUSTOM_PRESENTATION = [
  presentationProfile({
    id: "presentation.cricket.custom",
    sportId: "cricket",
    displayName: "Custom Presentation",
    description: "Blank presentation binding for organizer branding later.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["*"],
    status: "beta",
    recommendation: "advanced",
    tags: ["custom"],
    values: standardPresentationValues({ animation: false, ticker: false }),
    preview: { density: "custom", theme: "custom" },
  }),
] as const;
