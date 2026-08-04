import type { VariantCatalogEntry } from "../types.ts";

export const BADMINTON_VARIANTS: readonly VariantCatalogEntry[] = [
  {
    kind: "variant",
    id: "badminton.standard",
    version: "1.0.0",
    sportId: "badminton",
    displayName: "Standard Badminton",
    description: "Standard singles/doubles badminton tournament variant.",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "auction"],
    supportedVariants: ["badminton.standard"],
    status: "default",
    recommendation: "recommended",
  },
];
