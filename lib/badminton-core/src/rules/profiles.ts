import type { BadmintonRulesProfile } from "./types";

/**
 * 1. BWF Official Individual Event Profile
 * Based on BWF Statutes Section 4.1.2 — General Competition Regulations (GCR 2024).
 */
export const BWF_OFFICIAL_INDIVIDUAL_PROFILE: BadmintonRulesProfile = {
  id: "bwf_official_individual_2024",
  name: "BWF Official Competition (Individual)",
  description:
    "Official BWF competition format for Men's/Women's Singles and Doubles under General Competition Regulations (GCR 2024).",
  profileType: "official_competition",
  schemaVersion: "1.0.0",
  profileVersion: "2024.1",
  rulesSource: "BWF Statutes Section 4.1.2 — General Competition Regulations",
  rulesSourceEffectiveDate: "2024-01-01",
  isOfficialBwf: true,
  allowedEventTypes: ["singles", "doubles", "mixed_doubles"],
  participantType: "individual",
  scoring: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 11,
    scoringSystemName: "3x21 Rally Points (BWF Standard Law 7)",
  },
  draw: {
    drawType: "knockout",
    seedingAlgorithm: "bwf_canonical_fold",
    maxSeeds: 16,
    byeAllocation: "top_seeds_opposing",
    thirdPlaceMatch: false,
    rematchAvoidance: true,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "bwf_gcr_16",
    orderedTieBreakers: [
      "matches_won",
      "head_to_head",
      "games_difference",
      "games_ratio",
      "points_difference",
      "points_ratio",
      "draw_of_lots",
    ],
    twoWayHeadToHeadOverride: true,
    unresolvedTieAction: "draw_of_lots",
    walkoverMarginPoints: 42, // Two games of 21-0
  },
  discipline: {
    walkoverAwardType: "max_score_margin",
    assignedMarginPoints: 42,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "void_all_matches",
    scoreCorrectionAllowedUntil: "match_concluded",
  },
  eligibility: {
    genderRestriction: "Open",
  },
  unsupportedFeatures: [
    "Hawk-Eye line review hardware integration (manual line call override supported)",
  ],
};

/**
 * 2. BWF Official Team Championship Profile
 * Thomas/Uber/Sudirman style team ties with 5 rubbers.
 */
export const BWF_OFFICIAL_TEAM_PROFILE: BadmintonRulesProfile = {
  id: "bwf_official_team_2024",
  name: "BWF Official Team Championship",
  description:
    "Team tie format (3 Singles, 2 Doubles) following BWF Team Championships Regulations.",
  profileType: "official_competition",
  schemaVersion: "1.0.0",
  profileVersion: "2024.1",
  rulesSource: "BWF Statutes Section 4.1.2 & Team Championships Regulations",
  rulesSourceEffectiveDate: "2024-01-01",
  isOfficialBwf: true,
  allowedEventTypes: ["team_tie"],
  participantType: "team",
  teamTieRubbers: [
    { rubberIndex: 1, matchType: "singles", label: "1st Men's/Women's Singles", order: 1 },
    { rubberIndex: 2, matchType: "doubles", label: "1st Men's/Women's Doubles", order: 2 },
    { rubberIndex: 3, matchType: "singles", label: "2nd Men's/Women's Singles", order: 3 },
    { rubberIndex: 4, matchType: "doubles", label: "2nd Men's/Women's Doubles", order: 4 },
    { rubberIndex: 5, matchType: "singles", label: "3rd Men's/Women's Singles", order: 5 },
  ],
  scoring: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 11,
    scoringSystemName: "3x21 Rally Points (BWF Standard Law 7)",
  },
  draw: {
    drawType: "group_knockout",
    seedingAlgorithm: "bwf_canonical_fold",
    maxSeeds: 8,
    byeAllocation: "top_seeds_opposing",
    thirdPlaceMatch: false,
    qualifiersPerGroup: 2,
    qualifierMode: "per_group",
    rematchAvoidance: true,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "bwf_gcr_16",
    orderedTieBreakers: [
      "matches_won", // Tie wins
      "head_to_head",
      "rubber_difference",
      "games_difference",
      "points_difference",
      "draw_of_lots",
    ],
    twoWayHeadToHeadOverride: true,
    unresolvedTieAction: "draw_of_lots",
  },
  discipline: {
    walkoverAwardType: "max_score_margin",
    assignedMarginPoints: 42,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "void_all_matches",
    scoreCorrectionAllowedUntil: "match_concluded",
  },
  eligibility: {
    genderRestriction: "Open",
  },
};

/**
 * 3. Corporate Group Stage Plus Knockout Profile
 * Designed for office, corporate and multi-company events.
 */
export const CORPORATE_GROUP_KNOCKOUT_PROFILE: BadmintonRulesProfile = {
  id: "corporate_group_knockout_standard",
  name: "Corporate Group Stage + Knockout",
  description:
    "Round-robin group stages leading into a single-elimination knockout bracket with rematch avoidance.",
  profileType: "corporate",
  schemaVersion: "1.0.0",
  profileVersion: "1.0.0",
  rulesSource: "BIDWAR Corporate Tournament Guidelines",
  rulesSourceEffectiveDate: "2026-01-01",
  isOfficialBwf: false,
  allowedEventTypes: ["singles", "doubles", "mixed_doubles"],
  participantType: "pair",
  scoring: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 11,
    scoringSystemName: "3x21 Rally Points",
  },
  draw: {
    drawType: "group_knockout",
    seedingAlgorithm: "bwf_canonical_fold",
    maxSeeds: 8,
    byeAllocation: "top_seeds_opposing",
    thirdPlaceMatch: true,
    qualifiersPerGroup: 2,
    qualifierMode: "per_group",
    rematchAvoidance: true,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "points_diff_first",
    orderedTieBreakers: [
      "matches_won",
      "points_difference",
      "head_to_head",
      "points_ratio",
    ],
    twoWayHeadToHeadOverride: true,
    unresolvedTieAction: "organizer_decision",
    walkoverMarginPoints: 21,
  },
  discipline: {
    walkoverAwardType: "assigned_margin",
    assignedMarginPoints: 21,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "treat_as_walkovers",
    scoreCorrectionAllowedUntil: "category_completed",
  },
  eligibility: {
    genderRestriction: "Open",
  },
};

/**
 * 4. Corporate Knockout Profile (Singles or Doubles)
 */
export const CORPORATE_KNOCKOUT_PROFILE: BadmintonRulesProfile = {
  id: "corporate_knockout_standard",
  name: "Corporate Knockout",
  description:
    "Pure single-elimination tournament for individual players or pairs with Bronze match option.",
  profileType: "corporate",
  schemaVersion: "1.0.0",
  profileVersion: "1.0.0",
  rulesSource: "BIDWAR Corporate Tournament Guidelines",
  rulesSourceEffectiveDate: "2026-01-01",
  isOfficialBwf: false,
  allowedEventTypes: ["singles", "doubles", "mixed_doubles"],
  participantType: "individual",
  scoring: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 11,
    scoringSystemName: "3x21 Rally Points",
  },
  draw: {
    drawType: "knockout",
    seedingAlgorithm: "bwf_canonical_fold",
    maxSeeds: 8,
    byeAllocation: "top_seeds_opposing",
    thirdPlaceMatch: true,
    rematchAvoidance: true,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "points_diff_first",
    orderedTieBreakers: ["matches_won"],
    twoWayHeadToHeadOverride: false,
    unresolvedTieAction: "organizer_decision",
  },
  discipline: {
    walkoverAwardType: "assigned_margin",
    assignedMarginPoints: 21,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "treat_as_walkovers",
    scoreCorrectionAllowedUntil: "always",
  },
  eligibility: {
    genderRestriction: "Open",
  },
};

/**
 * 5. Corporate Round-Robin Profile
 */
export const CORPORATE_ROUND_ROBIN_PROFILE: BadmintonRulesProfile = {
  id: "corporate_round_robin_standard",
  name: "Corporate Round Robin",
  description:
    "Circle-method round robin where every entrant plays every other entrant.",
  profileType: "corporate",
  schemaVersion: "1.0.0",
  profileVersion: "1.0.0",
  rulesSource: "BIDWAR Corporate Tournament Guidelines",
  rulesSourceEffectiveDate: "2026-01-01",
  isOfficialBwf: false,
  allowedEventTypes: ["singles", "doubles", "mixed_doubles"],
  participantType: "pair",
  scoring: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 11,
    scoringSystemName: "3x21 Rally Points",
  },
  draw: {
    drawType: "round_robin",
    seedingAlgorithm: "random",
    maxSeeds: 0,
    byeAllocation: "random",
    thirdPlaceMatch: false,
    rematchAvoidance: false,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "vnbl_margin",
    orderedTieBreakers: [
      "matches_won",
      "margin_points",
      "head_to_head",
      "points_ratio",
    ],
    twoWayHeadToHeadOverride: true,
    unresolvedTieAction: "organizer_decision",
    walkoverMarginPoints: 21,
  },
  discipline: {
    walkoverAwardType: "assigned_margin",
    assignedMarginPoints: 21,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "treat_as_walkovers",
    scoreCorrectionAllowedUntil: "category_completed",
  },
  eligibility: {
    genderRestriction: "Open",
  },
};

/**
 * 6. Corporate Team League (VNBL Style) Profile
 */
export const CORPORATE_TEAM_LEAGUE_PROFILE: BadmintonRulesProfile = {
  id: "corporate_team_league_vnbl",
  name: "Corporate Team League (VNBL Format)",
  description:
    "Franchise/Company team ties with multiple pair rubbers scored under the VNBL Margin Point framework.",
  profileType: "corporate",
  schemaVersion: "1.0.0",
  profileVersion: "1.0.0",
  rulesSource: "VNBL Rules & Regulations 2026",
  rulesSourceEffectiveDate: "2026-01-01",
  isOfficialBwf: false,
  allowedEventTypes: ["team_tie", "doubles"],
  participantType: "pair",
  teamTieRubbers: [
    { rubberIndex: 1, matchType: "doubles", label: "Men's / Open Doubles 1", order: 1 },
    { rubberIndex: 2, matchType: "doubles", label: "Mixed / Open Doubles 2", order: 2 },
    { rubberIndex: 3, matchType: "doubles", label: "Open Doubles 3", order: 3 },
  ],
  scoring: {
    totalGames: 3,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 11,
    scoringSystemName: "3x21 Rally Points",
  },
  draw: {
    drawType: "round_robin",
    seedingAlgorithm: "manual",
    maxSeeds: 0,
    byeAllocation: "random",
    thirdPlaceMatch: false,
    rematchAvoidance: false,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "vnbl_margin",
    orderedTieBreakers: [
      "matches_won",
      "margin_points",
      "rubber_difference",
      "head_to_head",
    ],
    twoWayHeadToHeadOverride: true,
    unresolvedTieAction: "organizer_decision",
    walkoverMarginPoints: 21,
  },
  discipline: {
    walkoverAwardType: "assigned_margin",
    assignedMarginPoints: 21,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "treat_as_walkovers",
    scoreCorrectionAllowedUntil: "always",
  },
  eligibility: {
    genderRestriction: "Open",
  },
};

/**
 * 7. Fast Match Recreational Profile (3x15 or 1x21)
 */
export const RECREATIONAL_FAST_PROFILE: BadmintonRulesProfile = {
  id: "recreational_fast_match",
  name: "Recreational Fast Match (15 Points)",
  description:
    "Accelerated format (Best of 3 to 15 points) designed for recreational tournaments, clubs, and busy one-day events.",
  profileType: "recreational",
  schemaVersion: "1.0.0",
  profileVersion: "1.0.0",
  rulesSource: "BIDWAR Recreational Rules Presets",
  rulesSourceEffectiveDate: "2026-01-01",
  isOfficialBwf: false,
  allowedEventTypes: ["singles", "doubles"],
  participantType: "individual",
  scoring: {
    totalGames: 3,
    pointsPerGame: 15,
    deuceAt: 14,
    maxPoints: 21,
    winBy: 2,
    midGameSideChange: true,
    midGameIntervalPoints: 8,
    scoringSystemName: "3x15 Fast Match",
  },
  draw: {
    drawType: "knockout",
    seedingAlgorithm: "bwf_canonical_fold",
    maxSeeds: 4,
    byeAllocation: "top_seeds_opposing",
    thirdPlaceMatch: false,
    rematchAvoidance: true,
    drawLockPolicy: "lock_on_match_start",
  },
  standings: {
    rankingSystem: "points_diff_first",
    orderedTieBreakers: ["matches_won", "points_difference"],
    twoWayHeadToHeadOverride: true,
    unresolvedTieAction: "organizer_decision",
  },
  discipline: {
    walkoverAwardType: "assigned_margin",
    assignedMarginPoints: 15,
    retiredMatchHandling: "record_current_score_as_final",
    disqualificationPolicy: "treat_as_walkovers",
    scoreCorrectionAllowedUntil: "always",
  },
  eligibility: {
    genderRestriction: "Open",
  },
};

export const BUILT_IN_RULES_PROFILES: BadmintonRulesProfile[] = [
  BWF_OFFICIAL_INDIVIDUAL_PROFILE,
  BWF_OFFICIAL_TEAM_PROFILE,
  CORPORATE_GROUP_KNOCKOUT_PROFILE,
  CORPORATE_KNOCKOUT_PROFILE,
  CORPORATE_ROUND_ROBIN_PROFILE,
  CORPORATE_TEAM_LEAGUE_PROFILE,
  RECREATIONAL_FAST_PROFILE,
];

export function getBuiltInRulesProfile(id: string): BadmintonRulesProfile | null {
  return BUILT_IN_RULES_PROFILES.find((p) => p.id === id) ?? null;
}
