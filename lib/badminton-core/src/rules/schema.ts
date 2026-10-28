import { z } from "zod";
import type { BadmintonRulesProfile } from "./types";

export const badmintonProfileTypeSchema = z.enum([
  "official_competition",
  "corporate",
  "club_academy",
  "recreational",
  "custom",
]);

export const badmintonCompetitionEventTypeSchema = z.enum([
  "singles",
  "doubles",
  "mixed_doubles",
  "team_tie",
]);

export const badmintonParticipantTypeSchema = z.enum(["individual", "pair", "team"]);

export const badmintonDrawFormatTypeSchema = z.enum([
  "knockout",
  "round_robin",
  "group_knockout",
  "league_playoff",
]);

export const badmintonTieBreakerCriterionSchema = z.enum([
  "matches_won",
  "head_to_head",
  "games_difference",
  "games_ratio",
  "points_difference",
  "points_ratio",
  "rubber_difference",
  "margin_points",
  "draw_of_lots",
]);

export const badmintonRankingSystemSchema = z.enum([
  "bwf_gcr_16",
  "vnbl_margin",
  "points_diff_first",
  "custom_ordered",
]);

export const badmintonWalkoverAwardTypeSchema = z.enum([
  "assigned_margin",
  "max_score_margin",
  "forfeit_only",
]);

export const badmintonDrawLockPolicySchema = z.enum([
  "lock_on_match_start",
  "lock_on_publish",
  "manual_admin_only",
]);

export const badmintonUnresolvedTieActionSchema = z.enum([
  "flag_unresolved",
  "draw_of_lots",
  "organizer_decision",
]);

export const badmintonScoringRulesSchema = z
  .object({
    totalGames: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    pointsPerGame: z.number().int().min(5).max(50),
    deuceAt: z.number().int().min(4).max(50).nullable(),
    maxPoints: z.number().int().min(5).max(100),
    winBy: z.number().int().min(1).max(5),
    midGameSideChange: z.boolean(),
    midGameIntervalPoints: z.number().int().min(3).max(30),
    scoringSystemName: z.string().min(1).max(100),
  })
  .refine(
    (val) => val.maxPoints >= val.pointsPerGame,
    { message: "maxPoints must be greater than or equal to pointsPerGame" },
  )
  .refine(
    (val) => val.deuceAt === null || val.deuceAt < val.pointsPerGame,
    { message: "deuceAt must be less than pointsPerGame (e.g. 20 for 21-point game)" },
  );

export const badmintonDrawRulesSchema = z.object({
  drawType: badmintonDrawFormatTypeSchema,
  seedingAlgorithm: z.enum(["bwf_canonical_fold", "random", "manual"]),
  maxSeeds: z.number().int().min(0).max(64),
  byeAllocation: z.enum(["top_seeds_opposing", "random"]),
  thirdPlaceMatch: z.boolean(),
  qualifiersPerGroup: z.number().int().min(1).max(16).optional(),
  qualifierMode: z.enum(["per_group", "category"]).optional(),
  rematchAvoidance: z.boolean(),
  drawLockPolicy: badmintonDrawLockPolicySchema,
});

export const badmintonTieBreakerRulesSchema = z.object({
  rankingSystem: badmintonRankingSystemSchema,
  orderedTieBreakers: z.array(badmintonTieBreakerCriterionSchema).min(1),
  twoWayHeadToHeadOverride: z.boolean(),
  unresolvedTieAction: badmintonUnresolvedTieActionSchema,
  walkoverMarginPoints: z.number().int().min(0).optional(),
});

export const badmintonDisciplineRulesSchema = z.object({
  walkoverAwardType: badmintonWalkoverAwardTypeSchema,
  assignedMarginPoints: z.number().int().min(0),
  retiredMatchHandling: z.enum(["record_current_score_as_final", "award_remaining_points"]),
  disqualificationPolicy: z.enum(["void_all_matches", "treat_as_walkovers"]),
  scoreCorrectionAllowedUntil: z.enum(["always", "match_concluded", "category_completed"]),
});

export const badmintonEligibilityRulesSchema = z.object({
  minAge: z.number().int().min(5).max(100).nullable().optional(),
  maxAge: z.number().int().min(5).max(100).nullable().optional(),
  genderRestriction: z.enum(["M", "F", "Mixed", "Open"]).optional(),
  maxRegistrationsPerPlayer: z.number().int().min(1).max(10).optional(),
});

export const badmintonTeamTieRubberDefSchema = z.object({
  rubberIndex: z.number().int().min(1),
  matchType: z.enum(["singles", "doubles", "mixed_doubles"]),
  label: z.string().min(1).max(100),
  order: z.number().int().min(1),
});

export const badmintonRulesProfileSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    description: z.string().max(1000),
    profileType: badmintonProfileTypeSchema,
    schemaVersion: z.string().default("1.0.0"),
    profileVersion: z.string().default("1.0.0"),
    rulesSource: z.string().min(1).max(200),
    rulesSourceEffectiveDate: z.string().min(1).max(30),
    isOfficialBwf: z.boolean(),
    allowedEventTypes: z.array(badmintonCompetitionEventTypeSchema).min(1),
    participantType: badmintonParticipantTypeSchema,
    teamTieRubbers: z.array(badmintonTeamTieRubberDefSchema).optional(),
    scoring: badmintonScoringRulesSchema,
    draw: badmintonDrawRulesSchema,
    standings: badmintonTieBreakerRulesSchema,
    discipline: badmintonDisciplineRulesSchema,
    eligibility: badmintonEligibilityRulesSchema,
    unsupportedFeatures: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (profile) => {
      if (profile.participantType === "team" && (!profile.teamTieRubbers || profile.teamTieRubbers.length === 0)) {
        return false;
      }
      return true;
    },
    { message: "Team tie tournaments must define at least one team rubber configuration" },
  )
  .refine(
    (profile) => {
      if (profile.draw.drawType === "group_knockout" && (!profile.draw.qualifiersPerGroup || profile.draw.qualifiersPerGroup < 1)) {
        return false;
      }
      return true;
    },
    { message: "Group knockout tournaments must define qualifiersPerGroup >= 1" },
  );

export function validateRulesProfile(input: unknown): {
  success: boolean;
  data?: BadmintonRulesProfile;
  errors?: string[];
} {
  const result = badmintonRulesProfileSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as BadmintonRulesProfile };
  }
  const errors = result.error.issues.map(
    (iss) => `${iss.path.join(".") || "root"}: ${iss.message}`,
  );
  return { success: false, errors };
}
