/**
 * Badminton Universal Rules-Driven Tournament Engine — Domain Contracts.
 *
 * Separates tournament rules from tournament execution engine.
 * Supports both official competitions (following applicable BWF regulations)
 * and corporate, club, academy, and recreational tournaments with organizer-defined rules.
 */

export type BadmintonProfileType =
  | "official_competition"
  | "corporate"
  | "club_academy"
  | "recreational"
  | "custom";

export type BadmintonCompetitionEventType = "singles" | "doubles" | "mixed_doubles" | "team_tie";

export type BadmintonParticipantType = "individual" | "pair" | "team";

export type BadmintonDrawFormatType =
  | "knockout"
  | "round_robin"
  | "group_knockout"
  | "league_playoff";

export type BadmintonTieBreakerCriterion =
  | "matches_won"
  | "head_to_head"
  | "games_difference"
  | "games_ratio"
  | "points_difference"
  | "points_ratio"
  | "rubber_difference"
  | "margin_points"
  | "draw_of_lots";

export type BadmintonRankingSystem =
  | "bwf_gcr_16"
  | "vnbl_margin"
  | "points_diff_first"
  | "custom_ordered";

export type BadmintonWalkoverAwardType =
  | "assigned_margin"
  | "max_score_margin"
  | "forfeit_only";

export type BadmintonDrawLockPolicy =
  | "lock_on_match_start"
  | "lock_on_publish"
  | "manual_admin_only";

export type BadmintonUnresolvedTieAction =
  | "flag_unresolved"
  | "draw_of_lots"
  | "organizer_decision";

export type BadmintonScoringRules = {
  /** 1, 3, or 5 games per match. */
  totalGames: 1 | 3 | 5;
  /** Points to win a standard game (e.g. 21, 15, 11). */
  pointsPerGame: number;
  /** Point threshold triggering deuce (e.g. 20 for 21-pt). Null for sudden death. */
  deuceAt: number | null;
  /** Hard cap on game score (e.g. 30). */
  maxPoints: number;
  /** Margin required to win at deuce (typically 2). 1 for sudden death. */
  winBy: number;
  /** Whether sides switch ends in deciding game at halfway point. */
  midGameSideChange: boolean;
  /** Score at which 60-second interval occurs (typically 11 for 21-pt). */
  midGameIntervalPoints: number;
  /** Descriptive human-readable label. */
  scoringSystemName: string;
};

export type BadmintonDrawRules = {
  drawType: BadmintonDrawFormatType;
  seedingAlgorithm: "bwf_canonical_fold" | "random" | "manual";
  maxSeeds: number;
  byeAllocation: "top_seeds_opposing" | "random";
  thirdPlaceMatch: boolean;
  qualifiersPerGroup?: number;
  qualifierMode?: "per_group" | "category";
  rematchAvoidance: boolean;
  drawLockPolicy: BadmintonDrawLockPolicy;
};

export type BadmintonTieBreakerRules = {
  rankingSystem: BadmintonRankingSystem;
  orderedTieBreakers: BadmintonTieBreakerCriterion[];
  /** In BWF GCR 16.2.1, two-way ties always resolve by head-to-head match. */
  twoWayHeadToHeadOverride: boolean;
  unresolvedTieAction: BadmintonUnresolvedTieAction;
  /** Point margin assigned for walkover matches when applicable. */
  walkoverMarginPoints?: number;
};

export type BadmintonDisciplineRules = {
  walkoverAwardType: BadmintonWalkoverAwardType;
  assignedMarginPoints: number;
  retiredMatchHandling: "record_current_score_as_final" | "award_remaining_points";
  disqualificationPolicy: "void_all_matches" | "treat_as_walkovers";
  scoreCorrectionAllowedUntil: "always" | "match_concluded" | "category_completed";
};

export type BadmintonEligibilityRules = {
  minAge?: number | null;
  maxAge?: number | null;
  genderRestriction?: "M" | "F" | "Mixed" | "Open";
  maxRegistrationsPerPlayer?: number;
};

export type BadmintonTeamTieRubberDef = {
  rubberIndex: number;
  matchType: "singles" | "doubles" | "mixed_doubles";
  label: string;
  order: number;
};

export type BadmintonRulesProfile = {
  id: string;
  name: string;
  description: string;
  profileType: BadmintonProfileType;
  schemaVersion: string;
  profileVersion: string;
  rulesSource: string;
  rulesSourceEffectiveDate: string;
  /** Official regulations mapping flag. NEVER implies endorsement or certification. */
  isOfficialBwf: boolean;
  allowedEventTypes: BadmintonCompetitionEventType[];
  participantType: BadmintonParticipantType;
  teamTieRubbers?: BadmintonTeamTieRubberDef[];
  scoring: BadmintonScoringRules;
  draw: BadmintonDrawRules;
  standings: BadmintonTieBreakerRules;
  discipline: BadmintonDisciplineRules;
  eligibility: BadmintonEligibilityRules;
  unsupportedFeatures?: string[];
  metadata?: Record<string, unknown>;
};
