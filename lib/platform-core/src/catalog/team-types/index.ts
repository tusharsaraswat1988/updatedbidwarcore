import type { TeamTypeCatalogEntry } from "../types.ts";

/**
 * Team Type catalog — platform identity kinds (EPIC-04).
 * Not sport-specific. Not inheritance hierarchies.
 */
export const TEAM_TYPE_CATALOG: readonly TeamTypeCatalogEntry[] = [
  {
    kind: "team_type",
    id: "competitive",
    version: "1.0.0",
    displayName: "Competitive",
    description: "Standard competitive team for tournament play.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "auto_suggested",
  },
  {
    kind: "team_type",
    id: "practice",
    version: "1.0.0",
    displayName: "Practice",
    description: "Practice or training team.",
    supportedCompetitionTypes: ["practice", "*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "team_type",
    id: "selection",
    version: "1.0.0",
    displayName: "Selection",
    description: "Selection / representative pool team.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "team_type",
    id: "temporary",
    version: "1.0.0",
    displayName: "Temporary",
    description: "Short-lived team for a single event or fixture set.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
];
