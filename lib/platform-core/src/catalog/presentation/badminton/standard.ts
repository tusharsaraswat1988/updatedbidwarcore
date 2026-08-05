import { presentationProfile } from "../helpers.ts";
import { standardPresentationValues } from "../profile-values.ts";

export const BADMINTON_PRESENTATION = [
  presentationProfile({
    id: "presentation.badminton.standard",
    sportId: "badminton",
    displayName: "Badminton Standard",
    description: "Default badminton public + court display presentation.",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "auction"],
    supportedVariants: ["badminton.standard"],
    status: "active",
    recommendation: "recommended",
    tags: ["badminton", "standard"],
    values: standardPresentationValues(),
    preview: { density: "standard", theme: "badminton" },
  }),
  presentationProfile({
    id: "presentation.badminton.broadcast",
    sportId: "badminton",
    displayName: "Badminton Broadcast",
    description: "Broadcast-oriented badminton overlays (advanced).",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "auction"],
    supportedVariants: ["badminton.standard"],
    status: "beta",
    recommendation: "advanced",
    tags: ["badminton", "broadcast"],
    values: standardPresentationValues({ animation: true, ticker: true }),
    preview: { density: "broadcast", theme: "badminton_broadcast" },
  }),
] as const;
