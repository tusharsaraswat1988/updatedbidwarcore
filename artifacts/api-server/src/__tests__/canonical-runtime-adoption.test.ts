import { describe, expect, it, vi } from "vitest";
import {
  resolveMemberRuntimeContext,
} from "@workspace/db/runtime-context";
import type {
  Member,
  MemberRole,
  TournamentParticipation,
  MemberSportProfile,
  MemberIdentityLink,
} from "@workspace/db";

describe("Phase 5I — Canonical Member Runtime Adoption Tests", () => {
  const mockMember: Member = {
    id: "mem_rt_01",
    displayName: "Runtime Active Member",
    firstName: "Runtime",
    lastName: "Member",
    primaryMobile: "9876543210",
    primaryEmail: "runtime@example.com",
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

  describe("1. Canonical Member Native Context", () => {
    it("resolves native canonical Member session with full context", async () => {
      const mockSession = {
        id: "memsess_test_01",
        memberId: "mem_rt_01",
        authIdentityId: 1,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };

      const mockRoles: MemberRole[] = [
        {
          id: 1,
          memberId: "mem_rt_01",
          role: "organizer",
          scope: "global",
          tournamentId: null,
          teamId: null,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockSportProfiles: MemberSportProfile[] = [
        {
          id: 1,
          memberId: "mem_rt_01",
          sportSlug: "cricket",
          primaryRole: "batter",
          secondaryRole: null,
          handedness: "right",
          federationCode: null,
          profileJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      let selectCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1) return { limit: () => [mockSession] }; // validateMemberSession -> session
              if (selectCount === 2) return { limit: () => [mockMember] }; // validateMemberSession -> member
              if (selectCount === 3) return mockRoles; // roles
              return mockSportProfiles; // sport profiles
            }),
          })),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const ctx = await resolveMemberRuntimeContext(mockDb as any, {
        canonicalSessionId: "memsess_test_01",
      });

      expect(ctx.identitySource).toBe("canonical_member");
      expect(ctx.canonicalResolutionStatus).toBe("native");
      expect(ctx.isCanonical).toBe(true);
      expect(ctx.memberId).toBe("mem_rt_01");
      expect(ctx.member).not.toBeNull();
      expect(ctx.globalRoles).toContain("organizer");
      expect(ctx.sportProfiles.length).toBe(1);
      expect(ctx.capabilities).toContain("tournament:create");
      expect(ctx.hasCapability("tournament:manage")).toBe(true);
    });
  });

  describe("2. Legacy Identity Read-Through & Resolution", () => {
    it("resolves Category A organizer to canonical Member context", async () => {
      const mockLink: MemberIdentityLink = {
        id: 10,
        memberId: "mem_rt_01",
        sourceTable: "organizers",
        sourceRecordId: "1",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 1, name: "Org 1", email: "org1@test.com", mobile: "9876543210" }] }; // org details
              if (selectIdx === 2) return { limit: () => [mockLink] }; // link
              if (selectIdx === 3) return { limit: () => [mockMember] }; // member
              if (selectIdx === 4) return []; // roles
              return []; // sport profiles
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        {
          organizerAccountId: 1,
          organizerTournaments: { "42": true },
        },
        { tournamentId: 42 },
      );

      expect(ctx.identitySource).toBe("legacy_organizer");
      expect(ctx.canonicalResolutionStatus).toBe("resolved");
      expect(ctx.isCanonical).toBe(true);
      expect(ctx.memberId).toBe("mem_rt_01");
      expect(ctx.legacyIdentity).toEqual({
        type: "organizer",
        id: 1,
        name: "Org 1",
        email: "org1@test.com",
        mobile: "9876543210",
      });
      // Owned tournament capability
      expect(ctx.hasCapability("tournament:manage", { teamId: undefined })).toBe(true);
    });

    it("resolves Category A scorer to canonical Member context", async () => {
      const mockLink: MemberIdentityLink = {
        id: 11,
        memberId: "mem_rt_01",
        sourceTable: "scorer_accounts",
        sourceRecordId: "5",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 5, name: "Scorer 5", mobile: "9988776655", isActive: true }] }; // scorer info
              if (selectIdx === 2) return { limit: () => [mockLink] }; // link
              if (selectIdx === 3) return { limit: () => [mockMember] }; // member
              if (selectIdx === 4) return []; // roles
              return []; // sport profiles
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        { scorerId: 5 },
        { tournamentId: 100 },
      );

      expect(ctx.identitySource).toBe("legacy_scorer");
      expect(ctx.canonicalResolutionStatus).toBe("resolved");
      expect(ctx.isCanonical).toBe(true);
      expect(ctx.memberId).toBe("mem_rt_01");
      expect(ctx.capabilities).toContain("scoring:live");
    });
  });

  describe("3. Fallback for Unresolved & Review_Required Identities", () => {
    it("unresolved organizer continues operating smoothly without canonical Member", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 99, name: "Unlinked Org", email: "unlinked@org.com", mobile: "9000000000" }] };
              return { limit: () => [] }; // Unlinked (no member_identity_links)
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        {
          organizerAccountId: 99,
          organizerTournaments: { "50": true },
        },
        { tournamentId: 50 },
      );

      expect(ctx.identitySource).toBe("legacy_organizer");
      expect(ctx.canonicalResolutionStatus).toBe("unresolved");
      expect(ctx.isCanonical).toBe(false);
      expect(ctx.member).toBeNull();
      expect(ctx.memberId).toBeNull();

      // Legacy authorization remains fully functional for owned tournament
      expect(ctx.hasCapability("tournament:manage")).toBe(true);
    });

    it("unresolved scorer continues operating with legacy scoring capabilities", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 88, name: "Legacy Scorer", mobile: "9888888888", isActive: true }] };
              return { limit: () => [] }; // Unlinked
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        { scorerId: 88 },
        { tournamentId: 70 },
      );

      expect(ctx.identitySource).toBe("legacy_scorer");
      expect(ctx.canonicalResolutionStatus).toBe("unresolved");
      expect(ctx.isCanonical).toBe(false);
      expect(ctx.member).toBeNull();

      // Legacy scorer capabilities preserved for tournament 70
      expect(ctx.hasCapability("scoring:live")).toBe(true);
    });

    it("Category B review_required candidate identity is NOT automatically promoted to Member", async () => {
      const mockReviewLink: MemberIdentityLink = {
        id: 77,
        memberId: "mem_cand_01",
        sourceTable: "players",
        sourceRecordId: "500",
        linkType: "heuristic_match",
        confidenceScore: 70, // Category B
        provenanceJson: { reason: "name_similarity" },
        status: "pending_review",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockReviewLink]),
            }),
          }),
        }),
      };

      const ctx = await resolveMemberRuntimeContext(mockDb as any, {
        playerId: 500,
      });

      expect(ctx.identitySource).toBe("legacy_player");
      expect(ctx.canonicalResolutionStatus).toBe("review_required");
      expect(ctx.isCanonical).toBe(false);
      expect(ctx.member).toBeNull();
      expect(ctx.memberId).toBeNull();
    });
  });

  describe("4. Tournament Isolation & Privilege Escalation Prevention", () => {
    it("preserves tournament boundary isolation", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 10, name: "Org 10", email: "org10@test.com", mobile: "9876543210" }] };
              return { limit: () => [] };
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        {
          organizerAccountId: 10,
          organizerTournaments: { "100": true }, // Owned tournament is 100
        },
        { tournamentId: 200 }, // Requesting context for tournament 200
      );

      // Access denied for tournament 200 (cannot cross tournament boundary)
      expect(ctx.hasCapability("tournament:manage")).toBe(false);
    });

    it("prevents privilege escalation: scorer cannot become organizer or admin", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 3, name: "Scorer 3", mobile: "9876543210", isActive: true }] };
              return { limit: () => [] };
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        { scorerId: 3 },
        { tournamentId: 10 },
      );

      expect(ctx.hasCapability("scoring:live")).toBe(true);
      expect(ctx.hasCapability("tournament:manage")).toBe(false);
      expect(ctx.hasCapability("tournament:create")).toBe(false);
      expect(ctx.hasCapability("admin:*")).toBe(false);
    });

    it("enforces team boundary isolation for team owners", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const ctx = await resolveMemberRuntimeContext(mockDb as any, {
        ownerTournamentId: 10,
        ownerTeamId: 100, // Team 100
      });

      // Allowed for Team 100
      expect(ctx.hasCapability("auction:bid", { teamId: 100 })).toBe(true);

      // Denied for Team 200 (prevents cross-team bidding/access)
      expect(ctx.hasCapability("auction:bid", { teamId: 200 })).toBe(false);
    });
  });

  describe("5. No-Write Safety Invariant", () => {
    it("executes runtime resolution with ZERO database writes or mutations", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };

      await resolveMemberRuntimeContext(mockDb as any, {
        organizerAccountId: 5,
        scorerId: 3,
        ownerTournamentId: 10,
        ownerTeamId: 20,
      });

      // Assert NO write operations were called
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });
});
