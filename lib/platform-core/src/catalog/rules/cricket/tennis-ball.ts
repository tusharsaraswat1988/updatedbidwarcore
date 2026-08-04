import type { RuleProfileCatalogEntry } from "../../types.ts";

export const CRICKET_TENNIS_BALL_RULE_PROFILES: readonly RuleProfileCatalogEntry[] = [
  {
    kind: "rule_profile",
    id: "cricket.tennis_ball.community",
    version: "1.0.0",
    sportId: "cricket",
    displayName: "Tennis Ball Community",
    description: "Community tennis-ball cricket with LBW typically off.",
    supportedCompetitionTypes: ["auction", "registered_teams", "hybrid", "practice"],
    supportedVariants: ["cricket.tennis_ball"],
    status: "default",
    recommendation: "recommended",
    preview: { overs: 12, playersPerSide: 11, lbw: false, ball: "tennis" },
  },
];
