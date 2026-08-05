import type { MatchRoleCatalogEntry } from "../types.ts";

/**
 * Match Role catalog (EPIC-05).
 *
 * Side roles attach to Match Sides (not presentation labels like Home/Away).
 * Official roles attach to Match Officials (members), not Configuration.
 *
 * Forbidden as platform roles: home, away, team_a, team_b, player_a, player_b.
 */
export const MATCH_ROLE_CATALOG: readonly MatchRoleCatalogEntry[] = [
  {
    kind: "match_role",
    id: "competitor",
    version: "1.0.0",
    displayName: "Competitor",
    description: "Primary competing subject on a Match Side.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    scope: "side",
    required: true,
    multipleAllowed: false,
    maxCount: 1,
  },
  {
    kind: "match_role",
    id: "official",
    version: "1.0.0",
    displayName: "Official",
    description: "Generic match official.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    scope: "official",
    required: false,
    multipleAllowed: true,
    maxCount: null,
  },
  {
    kind: "match_role",
    id: "referee",
    version: "1.0.0",
    displayName: "Referee",
    description: "Match referee.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    scope: "official",
    required: false,
    multipleAllowed: true,
    maxCount: null,
  },
  {
    kind: "match_role",
    id: "umpire",
    version: "1.0.0",
    displayName: "Umpire",
    description: "Match umpire.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    scope: "official",
    required: false,
    multipleAllowed: true,
    maxCount: null,
  },
  {
    kind: "match_role",
    id: "scorer",
    version: "1.0.0",
    displayName: "Scorer",
    description: "Match scorer.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    scope: "official",
    required: false,
    multipleAllowed: true,
    maxCount: null,
  },
  {
    kind: "match_role",
    id: "observer",
    version: "1.0.0",
    displayName: "Observer",
    description: "Match observer.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    scope: "official",
    required: false,
    multipleAllowed: true,
    maxCount: null,
  },
];

/** Platform side slot ids — presentation maps these later (Home/Away, Red/Blue, …). */
export const MATCH_SIDE_IDS = ["side_a", "side_b"] as const;
export type MatchSideId = (typeof MATCH_SIDE_IDS)[number];
