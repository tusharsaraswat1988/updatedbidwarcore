import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const CRICKET_INDOOR_BOX_PRESENTATION = [
  presentationProfile({
    id: "presentation.cricket.indoor_box",
    sportId: "cricket",
    displayName: "Indoor Box",
    description: "Indoor / box venue presentation with tight scorebug density.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.box", "cricket.indoor"],
    status: "active",
    recommendation: "auto_suggested",
    tags: ["indoor", "box"],
    values: standardPresentationValues({ ticker: true }),
    preview: { density: "tight", theme: "indoor_box" },
  }),
] as const;
