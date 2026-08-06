import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const CRICKET_OUTDOOR_PRESENTATION = [
  presentationProfile({
    id: "presentation.cricket.outdoor",
    sportId: "cricket",
    displayName: "Outdoor Broadcast",
    description: "Classic outdoor cricket public + LED presentation pack.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.outdoor", "cricket.custom"],
    status: "active",
    recommendation: "recommended",
    tags: ["outdoor", "broadcast"],
    values: standardPresentationValues(),
    preview: { density: "standard", theme: "outdoor" },
  }),
] as const;
