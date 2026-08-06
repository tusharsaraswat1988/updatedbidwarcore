import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const CRICKET_CORPORATE_BOX_PRESENTATION = [
  presentationProfile({
    id: "presentation.cricket.corporate_box",
    sportId: "cricket",
    displayName: "Corporate Box",
    description: "Corporate box cricket presentation pack.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.box", "cricket.custom"],
    status: "active",
    recommendation: "recommended",
    tags: ["box", "corporate"],
    values: standardPresentationValues({ ticker: true }),
    preview: { density: "compact", theme: "corporate_box" },
  }),
] as const;
