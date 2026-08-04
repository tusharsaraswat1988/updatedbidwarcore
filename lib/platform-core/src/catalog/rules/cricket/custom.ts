import type { RuleProfileCatalogEntry } from "../../types.ts";

export const CRICKET_CUSTOM_RULE_PROFILES: readonly RuleProfileCatalogEntry[] = [
  {
    kind: "rule_profile",
    id: "cricket.custom.blank",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Custom Cricket Pack",
    description: "Starting point for organizer-defined cricket rules (resolved later by Rule Engine).",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.custom"],
    status: "beta",
    recommendation: "advanced",
    preview: { overs: null, playersPerSide: null, note: "Configure after create" },
  },
];
