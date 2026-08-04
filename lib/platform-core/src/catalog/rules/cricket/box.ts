import type { RuleProfileCatalogEntry } from "../../types.ts";

export const CRICKET_BOX_RULE_PROFILES: readonly RuleProfileCatalogEntry[] = [
  {
    kind: "rule_profile",
    id: "cricket.box.corporate_standard",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Corporate Box Standard",
    description: "Short-overs box cricket tuned for corporate leagues.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.box"],
    status: "default",
    recommendation: "recommended",
    preview: { overs: 6, playersPerSide: 8, lbw: false, ball: "tennis" },
  },
  {
    kind: "rule_profile",
    id: "cricket.box.society",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Society Box",
    description: "Relaxed box rules for society / weekend leagues.",
    supportedCompetitionTypes: ["registered_teams", "practice", "hybrid", "auction"],
    supportedVariants: ["cricket.box"],
    status: "default",
    recommendation: "auto_suggested",
    preview: { overs: 8, playersPerSide: 8, lbw: false, ball: "tennis" },
  },
  {
    kind: "rule_profile",
    id: "cricket.box.legacy_retired",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Box Legacy (Retired)",
    description: "Deprecated pack retained for compatibility tests — not selectable on create.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.box"],
    status: "deprecated",
    recommendation: "advanced",
    preview: { overs: 5, playersPerSide: 7 },
  },
];

