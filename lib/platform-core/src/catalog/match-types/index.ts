import type { MatchTypeCatalogEntry } from "../types.ts";

/**
 * Match Type catalog — platform contest kinds (EPIC-05).
 * Includes `custom` from day one (same philosophy as Rule Profiles).
 */
export const MATCH_TYPE_CATALOG: readonly MatchTypeCatalogEntry[] = [
  {
    kind: "match_type",
    id: "league",
    version: "1.0.0",
    displayName: "League",
    description: "League / round-robin contest.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "match_type",
    id: "knockout",
    version: "1.0.0",
    displayName: "Knockout",
    description: "Elimination / knockout contest.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "match_type",
    id: "practice",
    version: "1.0.0",
    displayName: "Practice",
    description: "Practice contest.",
    supportedCompetitionTypes: ["practice", "*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "match_type",
    id: "friendly",
    version: "1.0.0",
    displayName: "Friendly",
    description: "Friendly contest.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "match_type",
    id: "exhibition",
    version: "1.0.0",
    displayName: "Exhibition",
    description: "Exhibition contest.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "match_type",
    id: "custom",
    version: "1.0.0",
    displayName: "Custom",
    description: "Organizer-defined contest type.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
];
