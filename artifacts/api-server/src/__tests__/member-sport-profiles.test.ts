import { describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  memberSportProfilesTable,
  membersTable,
  insertMemberSportProfileSchema,
  playersTable,
  badmintonPlayersTable,
  globalPlayersTable,
} from "@workspace/db";
import {
  createMemberSportProfile,
  getMemberSportProfile,
  getMemberSportProfileBySport,
  listMemberSportProfiles,
  updateMemberSportProfile,
  removeMemberSportProfile,
  resolveMemberSportContext,
  resolveSportProfileForLegacyPlayer,
  MemberSportProfileError,
  isSportSupported,
  validateSportRole,
  normalizeHandedness,
  normalizeFederationCode,
} from "@workspace/db/member-sport-profiles";
import type { Member, MemberSportProfile, MemberIdentityLink } from "@workspace/db";

describe("Phase 5G — Sport-Specific Member Profiles Tests", () => {
  describe("1. Schema & Validation", () => {
    it("reuses existing member_sport_profiles table without schema fragmentation", () => {
      expect(getTableName(memberSportProfilesTable)).toBe("member_sport_profiles");
      const cols = getTableColumns(memberSportProfilesTable);

      expect(cols.id.name).toBe("id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.memberId.notNull).toBe(true);
      expect(cols.sportSlug.name).toBe("sport_slug");
      expect(cols.sportSlug.notNull).toBe(true);
      expect(cols.primaryRole.name).toBe("primary_role");
      expect(cols.secondaryRole.name).toBe("secondary_role");
      expect(cols.handedness.name).toBe("handedness");
      expect(cols.federationCode.name).toBe("federation_code");
      expect(cols.profileJson.name).toBe("profile_json");
      expect(cols.createdAt.notNull).toBe(true);
      expect(cols.updatedAt.notNull).toBe(true);
    });

    it("validates Zod schema for insertMemberSportProfile", () => {
      const valid = insertMemberSportProfileSchema.parse({
        memberId: "mem_12345678901234567890123456789012",
        sportSlug: "badminton",
        primaryRole: "singles_player",
        handedness: "right",
      });

      expect(valid.sportSlug).toBe("badminton");
      expect(valid.primaryRole).toBe("singles_player");
    });

    it("validates sport support whitelist", () => {
      expect(isSportSupported("cricket")).toBe(true);
      expect(isSportSupported("badminton")).toBe(true);
      expect(isSportSupported("Cricket")).toBe(true);
      expect(isSportSupported("BADMINTON")).toBe(true);
      expect(isSportSupported("football")).toBe(false);
      expect(isSportSupported("tennis")).toBe(false);
      expect(isSportSupported("kabaddi")).toBe(false);
    });

    it("validates sport-specific roles accurately", () => {
      // Cricket roles
      expect(validateSportRole("cricket", "batter")).toBe(true);
      expect(validateSportRole("cricket", "batsman")).toBe(true);
      expect(validateSportRole("cricket", "bowler")).toBe(true);
      expect(validateSportRole("cricket", "all_rounder")).toBe(true);
      expect(validateSportRole("cricket", "wicket_keeper")).toBe(true);
      expect(validateSportRole("cricket", "singles_player")).toBe(false);

      // Badminton roles
      expect(validateSportRole("badminton", "singles_player")).toBe(true);
      expect(validateSportRole("badminton", "doubles_player")).toBe(true);
      expect(validateSportRole("badminton", "mixed_doubles_player")).toBe(true);
      expect(validateSportRole("badminton", "bowler")).toBe(false);
      expect(validateSportRole("badminton", "batter")).toBe(false);
    });

    it("normalizes handedness and federation codes", () => {
      expect(normalizeHandedness("r")).toBe("right");
      expect(normalizeHandedness("Right")).toBe("right");
      expect(normalizeHandedness("L")).toBe("left");
      expect(normalizeHandedness("left")).toBe("left");
      expect(normalizeHandedness("switch")).toBe("both");
      expect(normalizeHandedness("ambidextrous")).toBe("both");
      expect(normalizeHandedness(null)).toBeNull();

      expect(normalizeFederationCode("INPV 0123")).toBe("INPV0123");
      expect(normalizeFederationCode("bwf-9988")).toBe("BWF-9988");
    });
  });

  describe("2. Profile Service Operations", () => {
    const mockMember: Member = {
      id: "mem_athlete_01",
      displayName: "Dual Sport Star",
      firstName: "Dual",
      lastName: "Star",
      primaryMobile: "9112233445",
      primaryEmail: "star@example.com",
      isMobileVerified: true,
      isEmailVerified: true,
      dob: null,
      gender: null,
      country: "IND",
      state: null,
      city: null,
      avatarUrl: null,
      avatarPublicId: null,
      accountStatus: "active",
      metadataJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("creates a Cricket profile for a valid Member", async () => {
      let selectCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1) return { limit: () => [mockMember] };
              return { limit: () => [] }; // No existing cricket profile
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                memberId: "mem_athlete_01",
                sportSlug: "cricket",
                primaryRole: "all_rounder",
                secondaryRole: "bowler",
                handedness: "right",
                federationCode: null,
                profileJson: { battingStyle: "Right-hand bat" },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const profile = await createMemberSportProfile(mockDb as any, {
        memberId: "mem_athlete_01",
        sportSlug: "cricket",
        primaryRole: "all_rounder",
        secondaryRole: "bowler",
        handedness: "right",
        profileJson: { battingStyle: "Right-hand bat" },
      });

      expect(profile.id).toBe(1);
      expect(profile.memberId).toBe("mem_athlete_01");
      expect(profile.sportSlug).toBe("cricket");
      expect(profile.primaryRole).toBe("all_rounder");
    });

    it("creates a Badminton profile for the same Member (multi-sport support)", async () => {
      let selectCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1) return { limit: () => [mockMember] };
              return { limit: () => [] }; // No existing badminton profile
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 2,
                memberId: "mem_athlete_01",
                sportSlug: "badminton",
                primaryRole: "singles_player",
                secondaryRole: "doubles_player",
                handedness: "left",
                federationCode: "BWF12345",
                profileJson: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const profile = await createMemberSportProfile(mockDb as any, {
        memberId: "mem_athlete_01",
        sportSlug: "badminton",
        primaryRole: "singles_player",
        secondaryRole: "doubles_player",
        handedness: "L",
        federationCode: "BWF12345",
      });

      expect(profile.id).toBe(2);
      expect(profile.memberId).toBe("mem_athlete_01");
      expect(profile.sportSlug).toBe("badminton");
      expect(profile.handedness).toBe("left");
    });

    it("rejects unsupported sports", async () => {
      const mockDb = {} as any;
      await expect(
        createMemberSportProfile(mockDb, {
          memberId: "mem_athlete_01",
          sportSlug: "volleyball",
        }),
      ).rejects.toThrow("Unsupported sport: volleyball");
    });

    it("rejects invalid sport-specific role", async () => {
      let selectCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                return [mockMember];
              }),
            }),
          }),
        }),
      };

      await expect(
        createMemberSportProfile(mockDb as any, {
          memberId: "mem_athlete_01",
          sportSlug: "cricket",
          primaryRole: "singles_player", // Invalid role for cricket
        }),
      ).rejects.toThrow("Invalid primary role 'singles_player' for sport 'cricket'");
    });

    it("prevents duplicate sport profiles for the same Member and sport", async () => {
      const existingProfile: MemberSportProfile = {
        id: 5,
        memberId: "mem_athlete_01",
        sportSlug: "badminton",
        primaryRole: "singles_player",
        secondaryRole: null,
        handedness: "right",
        federationCode: null,
        profileJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let selectCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                if (selectCount === 1) return [mockMember];
                return [existingProfile]; // Duplicate profile found
              }),
            }),
          }),
        }),
      };

      await expect(
        createMemberSportProfile(mockDb as any, {
          memberId: "mem_athlete_01",
          sportSlug: "badminton",
          primaryRole: "doubles_player",
        }),
      ).rejects.toThrow("Member already has a 'badminton' profile");
    });

    it("updates existing sport profile", async () => {
      const existing: MemberSportProfile = {
        id: 1,
        memberId: "mem_athlete_01",
        sportSlug: "cricket",
        primaryRole: "batter",
        secondaryRole: null,
        handedness: "right",
        federationCode: null,
        profileJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([existing]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  ...existing,
                  primaryRole: "all_rounder",
                  secondaryRole: "wicket_keeper",
                },
              ]),
            }),
          }),
        }),
      };

      const updated = await updateMemberSportProfile(mockDb as any, 1, {
        primaryRole: "all_rounder",
        secondaryRole: "wicket_keeper",
      });

      expect(updated.primaryRole).toBe("all_rounder");
      expect(updated.secondaryRole).toBe("wicket_keeper");
    });

    it("resolves full MemberSportContext for multi-sport athlete", async () => {
      const mockProfiles: MemberSportProfile[] = [
        {
          id: 1,
          memberId: "mem_athlete_01",
          sportSlug: "cricket",
          primaryRole: "all_rounder",
          secondaryRole: null,
          handedness: "right",
          federationCode: null,
          profileJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          memberId: "mem_athlete_01",
          sportSlug: "badminton",
          primaryRole: "singles_player",
          secondaryRole: null,
          handedness: "left",
          federationCode: "BWF99",
          profileJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [mockMember] };
              return mockProfiles;
            }),
          }),
        }),
      };

      const context = await resolveMemberSportContext(mockDb as any, "mem_athlete_01");

      expect(context.member.id).toBe("mem_athlete_01");
      expect(context.profiles.length).toBe(2);
      expect(context.sports).toEqual(["cricket", "badminton"]);

      const cricketProfile = context.getProfileForSport("cricket");
      expect(cricketProfile).not.toBeNull();
      expect(cricketProfile!.primaryRole).toBe("all_rounder");

      const badmintonProfile = context.getProfileForSport("badminton");
      expect(badmintonProfile).not.toBeNull();
      expect(badmintonProfile!.primaryRole).toBe("singles_player");

      const tennisProfile = context.getProfileForSport("tennis");
      expect(tennisProfile).toBeNull();
    });
  });

  describe("3. Legacy Adapters & Category Linking Safety", () => {
    it("resolves canonical MemberSportProfile for Category A Player link", async () => {
      const mockCatALink: MemberIdentityLink = {
        id: 1,
        memberId: "mem_catA_shuttler",
        sourceTable: "badminton_players",
        sourceRecordId: "77",
        linkType: "direct_fk",
        confidenceScore: 100, // Category A
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBadmintonProfile: MemberSportProfile = {
        id: 10,
        memberId: "mem_catA_shuttler",
        sportSlug: "badminton",
        primaryRole: "doubles_player",
        secondaryRole: null,
        handedness: "right",
        federationCode: "BWF-IND-77",
        profileJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [mockCatALink];
                return [mockBadmintonProfile];
              }),
            }),
          }),
        }),
      };

      const profile = await resolveSportProfileForLegacyPlayer(mockDb as any, {
        sourceTable: "badminton_players",
        sourceRecordId: 77,
        sportSlug: "badminton",
      });

      expect(profile).not.toBeNull();
      expect(profile!.memberId).toBe("mem_catA_shuttler");
      expect(profile!.sportSlug).toBe("badminton");
      expect(profile!.primaryRole).toBe("doubles_player");
    });

    it("strictly guards Category B/C historical records from auto-resolving profiles", async () => {
      const mockCatBLink: MemberIdentityLink = {
        id: 2,
        memberId: "mem_guessed_cricketer",
        sourceTable: "players",
        sourceRecordId: "333",
        linkType: "heuristic_match",
        confidenceScore: 80, // Category B (< 100)
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockCatBLink]),
            }),
          }),
        }),
      };

      const profile = await resolveSportProfileForLegacyPlayer(mockDb as any, {
        sourceTable: "players",
        sourceRecordId: 333,
        sportSlug: "cricket",
      });

      // Must be null: Category B/C cannot auto-resolve
      expect(profile).toBeNull();
    });

    it("returns null for unlinked legacy player", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const profile = await resolveSportProfileForLegacyPlayer(mockDb as any, {
        sourceTable: "global_players",
        sourceRecordId: "gp_unknown",
        sportSlug: "cricket",
      });

      expect(profile).toBeNull();
    });
  });

  describe("4. Domain Isolation & Legacy Table Integrity", () => {
    it("confirms legacy player tables remain completely untouched", () => {
      expect(getTableName(playersTable)).toBe("players");
      expect(getTableName(globalPlayersTable)).toBe("global_players");
      expect(getTableName(badmintonPlayersTable)).toBe("badminton_players");

      const pCols = getTableColumns(playersTable);
      expect(pCols.name.name).toBe("name");
      expect(pCols.tournamentId.name).toBe("tournament_id");

      const bpCols = getTableColumns(badmintonPlayersTable);
      expect(bpCols.firstName.name).toBe("first_name");
      expect(bpCols.tournamentId.name).toBe("tournament_id");
      expect(bpCols.bwfCode.name).toBe("bwf_code");
    });
  });
});
