import { describe, expect, it, vi } from "vitest";
import {
  resolveMemberRuntimeContext,
} from "@workspace/db/runtime-context";
import {
  normalizeRoleName,
  resolveMemberCapabilities,
} from "@workspace/db/member-auth";
import type {
  Member,
  MemberRole,
  TournamentParticipation,
  MemberSportProfile,
  MemberIdentityLink,
} from "@workspace/db";

describe("Phase 5I — Canonical Member Runtime Adoption & Identity Resolution Hardening Tests", () => {
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

  const mockMemberB: Member = {
    id: "mem_rt_02_collision",
    displayName: "Collision Member B",
    firstName: "Collision",
    lastName: "Member",
    primaryMobile: "9988776655",
    primaryEmail: "collision@example.com",
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

  describe("2. Legacy Identity Read-Through & Resolution (Category A)", () => {
    it("resolves Category A organizer to canonical Member context via member_identity_links", async () => {
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

    it("resolves Category A scorer to canonical Member context via member_identity_links", async () => {
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

  describe("3. Identity Resolution Hardening — Collision & Integrity Protections", () => {
    // Case A: Organizer email matches Member B email, but NO row in member_identity_links
    it("Case A: Organizer email collision without identity link MUST NOT resolve to Member B", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) {
                // Legacy organizer has collision@example.com (same as Member B)
                return { limit: () => [{ id: 404, name: "Collision Org", email: "collision@example.com", mobile: "9111111111" }] };
              }
              // No link in member_identity_links
              return { limit: () => [] };
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        { organizerAccountId: 404 },
        { tournamentId: 10 },
      );

      // Must remain unresolved and NOT hijack Member B's identity
      expect(ctx.identitySource).toBe("legacy_organizer");
      expect(ctx.canonicalResolutionStatus).toBe("unresolved");
      expect(ctx.isCanonical).toBe(false);
      expect(ctx.member).toBeNull();
      expect(ctx.memberId).toBeNull();
    });

    // Case B: Scorer phone matches Member B phone, but NO row in member_identity_links
    it("Case B: Scorer mobile collision without identity link MUST NOT resolve to Member B", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) {
                // Legacy scorer has 9988776655 (same as Member B)
                return { limit: () => [{ id: 505, name: "Collision Scorer", mobile: "9988776655", isActive: true }] };
              }
              // No link in member_identity_links
              return { limit: () => [] };
            }),
          })),
        })),
      };

      const ctx = await resolveMemberRuntimeContext(
        mockDb as any,
        { scorerId: 505 },
        { tournamentId: 10 },
      );

      // Must remain unresolved and NOT hijack Member B's identity
      expect(ctx.identitySource).toBe("legacy_scorer");
      expect(ctx.canonicalResolutionStatus).toBe("unresolved");
      expect(ctx.isCanonical).toBe(false);
      expect(ctx.member).toBeNull();
      expect(ctx.memberId).toBeNull();
    });

    // Case C: Organizer email changed / differs from Member email, but Category A link exists
    it("Case C: Organizer email differs from Member email but Category A link exists -> resolves correctly", async () => {
      const mockLink: MemberIdentityLink = {
        id: 301,
        memberId: "mem_rt_01",
        sourceTable: "organizers",
        sourceRecordId: "606",
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
              if (selectIdx === 1) {
                // Organizer has old email that differs from Member's runtime@example.com
                return { limit: () => [{ id: 606, name: "Old Email Org", email: "old_org@legacy.com", mobile: "9876543210" }] };
              }
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
        { organizerAccountId: 606 },
        { tournamentId: 10 },
      );

      // Authoritative link succeeds regardless of email discrepancy
      expect(ctx.identitySource).toBe("legacy_organizer");
      expect(ctx.canonicalResolutionStatus).toBe("resolved");
      expect(ctx.isCanonical).toBe(true);
      expect(ctx.memberId).toBe("mem_rt_01");
      expect(ctx.member?.id).toBe("mem_rt_01");
    });

    // Case D: Scorer phone changed / differs from Member phone, but Category A link exists
    it("Case D: Scorer mobile differs from Member mobile but Category A link exists -> resolves correctly", async () => {
      const mockLink: MemberIdentityLink = {
        id: 302,
        memberId: "mem_rt_01",
        sourceTable: "scorer_accounts",
        sourceRecordId: "707",
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
              if (selectIdx === 1) {
                // Scorer has old mobile that differs from Member's 9876543210
                return { limit: () => [{ id: 707, name: "Old Mobile Scorer", mobile: "1111111111", isActive: true }] };
              }
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
        { scorerId: 707 },
        { tournamentId: 10 },
      );

      // Authoritative link succeeds regardless of phone discrepancy
      expect(ctx.identitySource).toBe("legacy_scorer");
      expect(ctx.canonicalResolutionStatus).toBe("resolved");
      expect(ctx.isCanonical).toBe(true);
      expect(ctx.memberId).toBe("mem_rt_01");
      expect(ctx.member?.id).toBe("mem_rt_01");
    });

    // Case E: Category B link exists (<= 90% confidence or pending_review)
    it("Case E: Category B link (pending_review / <=90%) -> review_required, memberId = null", async () => {
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

    // Case F: Category C / unlinked
    it("Case F: Category C (unlinked) -> unresolved, memberId = null", async () => {
      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [{ id: 88, name: "Unlinked Scorer", mobile: "9888888888", isActive: true }] };
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
      expect(ctx.memberId).toBeNull();
      // Legacy scorer capabilities preserved for tournament 70
      expect(ctx.hasCapability("scoring:live")).toBe(true);
    });
  });

  describe("4. Owner Role Normalization & Capabilities", () => {
    it("Case G: normalizes 'owner' and 'team_owner' to canonical vocabulary with identical capabilities", () => {
      expect(normalizeRoleName("owner")).toBe("team_owner");
      expect(normalizeRoleName("OWNER")).toBe("team_owner");
      expect(normalizeRoleName("  owner  ")).toBe("team_owner");
      expect(normalizeRoleName("team_owner")).toBe("team_owner");
      expect(normalizeRoleName("organizer")).toBe("organizer");

      const ownerRoleRow: MemberRole = {
        id: 1,
        memberId: "mem_owner_01",
        role: "owner",
        scope: "team",
        tournamentId: 10,
        teamId: 20,
        matchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const teamOwnerRoleRow: MemberRole = {
        id: 2,
        memberId: "mem_owner_01",
        role: "team_owner",
        scope: "team",
        tournamentId: 10,
        teamId: 20,
        matchId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ownerCaps = resolveMemberCapabilities([ownerRoleRow], { tournamentId: 10, teamId: 20 });
      const teamOwnerCaps = resolveMemberCapabilities([teamOwnerRoleRow], { tournamentId: 10, teamId: 20 });

      expect(ownerCaps).toEqual(teamOwnerCaps);
      expect(ownerCaps).toContain("auction:bid");
      expect(ownerCaps).toContain("team:roster_view");
      expect(ownerCaps).toContain("push:receive");
      expect(ownerCaps).toContain("team:edit");
    });
  });

  describe("5. Tournament Isolation & Privilege Escalation Prevention", () => {
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

  describe("6. No-Write Safety Invariant", () => {
    it("Case H: executes runtime resolution with ZERO database writes or mutations", async () => {
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
