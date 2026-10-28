import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAvailableProfiles,
  getRulesProfileByIdOrKey,
  resolveCategoryRules,
  createTournamentProfile,
  cloneProfileForTournament,
  attachRulesProfileToCategory,
  snapshotCategoryRules,
} from "./badminton-rules-service";
import {
  BWF_OFFICIAL_INDIVIDUAL_PROFILE,
  BWF_OFFICIAL_TEAM_PROFILE,
  CORPORATE_GROUP_KNOCKOUT_PROFILE,
  CORPORATE_KNOCKOUT_PROFILE,
  CORPORATE_ROUND_ROBIN_PROFILE,
  CORPORATE_TEAM_LEAGUE_PROFILE,
  RECREATIONAL_FAST_PROFILE,
  validateRulesProfile,
  badmintonRulesProfileSchema,
} from "@workspace/badminton-core";

describe("Badminton Rules Service", () => {
  describe("Built-in Profiles Availability", () => {
    it("lists all 7 first-class built-in profiles", async () => {
      const profiles = await listAvailableProfiles();
      const ids = profiles.map((p) => p.id);

      expect(ids).toContain("bwf_official_individual_2024");
      expect(ids).toContain("bwf_official_team_2024");
      expect(ids).toContain("corporate_group_knockout_standard");
      expect(ids).toContain("corporate_knockout_standard");
      expect(ids).toContain("corporate_round_robin_standard");
      expect(ids).toContain("corporate_team_league_vnbl");
      expect(ids).toContain("recreational_fast_match");
      expect(profiles.length).toBeGreaterThanOrEqual(7);
    });

    it("resolves built-in profiles by key string", async () => {
      const bwf = await getRulesProfileByIdOrKey("bwf_official_individual_2024");
      expect(bwf).toBeDefined();
      expect(bwf?.id).toBe("bwf_official_individual_2024");
      expect(bwf?.isOfficialBwf).toBe(true);
      expect(bwf?.scoring.pointsPerGame).toBe(21);
      expect(bwf?.scoring.maxPoints).toBe(30);
      expect(bwf?.scoring.deuceAt).toBe(20);

      const vnbl = await getRulesProfileByIdOrKey("corporate_team_league_vnbl");
      expect(vnbl).toBeDefined();
      expect(vnbl?.isOfficialBwf).toBe(false);
      expect(vnbl?.standings.rankingSystem).toBe("vnbl_margin");
      expect(vnbl?.standings.orderedTieBreakers).toContain("margin_points");

      const rec = await getRulesProfileByIdOrKey("recreational_fast_match");
      expect(rec).toBeDefined();
      expect(rec?.scoring.pointsPerGame).toBe(15);
      expect(rec?.scoring.maxPoints).toBe(21);
    });

    it("returns null for non-existent profile key", async () => {
      const missing = await getRulesProfileByIdOrKey("non_existent_random_key_123");
      expect(missing).toBeNull();
    });
  });

  describe("Validation of Rules Profiles", () => {
    it("validates all built-in profiles against the Zod rules schema", async () => {
      const profiles = await listAvailableProfiles();
      expect(profiles.length).toBeGreaterThanOrEqual(7);
      for (const profile of profiles) {
        const res = validateRulesProfile(profile);
        expect(res.success, `Validation failed for profile ${profile.id}: ${JSON.stringify(res.errors)}`).toBe(true);
      }
    });

    it("rejects profiles with invalid constraints", () => {
      // 1. maxPoints < pointsPerGame
      const invalidPoints = {
        ...BWF_OFFICIAL_INDIVIDUAL_PROFILE,
        id: "invalid_points",
        scoring: {
          ...BWF_OFFICIAL_INDIVIDUAL_PROFILE.scoring,
          pointsPerGame: 21,
          maxPoints: 20, // Invalid!
        },
      };
      const res1 = validateRulesProfile(invalidPoints);
      expect(res1.success).toBe(false);

      // 2. deuceAt >= pointsPerGame
      const invalidDeuce = {
        ...BWF_OFFICIAL_INDIVIDUAL_PROFILE,
        id: "invalid_deuce",
        scoring: {
          ...BWF_OFFICIAL_INDIVIDUAL_PROFILE.scoring,
          pointsPerGame: 21,
          deuceAt: 21, // Must be strictly < pointsPerGame
        },
      };
      const res2 = validateRulesProfile(invalidDeuce);
      expect(res2.success).toBe(false);

      // 3. Invalid totalGames
      const invalidGames = {
        ...BWF_OFFICIAL_INDIVIDUAL_PROFILE,
        id: "invalid_games",
        scoring: {
          ...BWF_OFFICIAL_INDIVIDUAL_PROFILE.scoring,
          totalGames: 4, // Only 1, 3, or 5 allowed
        },
      };
      const res3 = validateRulesProfile(invalidGames);
      expect(res3.success).toBe(false);
    });
  });
});
