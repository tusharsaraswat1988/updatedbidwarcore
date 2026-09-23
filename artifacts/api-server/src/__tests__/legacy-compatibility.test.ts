import { describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  memberIdentityLinksTable,
  membersTable,
  organizersTable,
  scorerAccountsTable,
  playersTable,
  badmintonPlayersTable,
  globalPlayersTable,
  scoringOfficialsTable,
  teamsTable,
} from "@workspace/db";
import {
  resolveLegacyIdentity,
  resolveLegacyOrganizer,
  resolveLegacyScorer,
  resolveLegacyPlayer,
  resolveLegacyGlobalPlayer,
  resolveLegacyBadmintonPlayer,
  resolveLegacyOwner,
  resolveLegacyOfficial,
  listMigrationReviewCandidates,
  getMigrationReadinessReport,
} from "@workspace/db/legacy-compatibility";
import type {
  Member,
  MemberIdentityLink,
  TournamentParticipation,
} from "@workspace/db";

describe("Phase 5H — Legacy Identity Compatibility & Migration Readiness Tests", () => {
  const mockActiveMember: Member = {
    id: "mem_leg_01",
    displayName: "Legacy Verified Human",
    firstName: "Legacy",
    lastName: "Verified",
    primaryMobile: "9876543210",
    primaryEmail: "legacy@example.com",
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

  describe("1. Organizer Compatibility", () => {
    it("resolves Category A organizer with active link to canonical Member", async () => {
      const mockLink: MemberIdentityLink = {
        id: 1,
        memberId: "mem_leg_01",
        sourceTable: "organizers",
        sourceRecordId: "10",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: { verifiedVia: "phone_otp" },
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
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
                if (callIdx === 1) return [mockLink];
                return [mockActiveMember];
              }),
            }),
          }),
        }),
      };

      const result = await resolveLegacyOrganizer(mockDb as any, 10);

      expect(result.status).toBe("resolved");
      expect(result.memberId).toBe("mem_leg_01");
      expect(result.member).not.toBeNull();
      expect(result.member!.displayName).toBe("Legacy Verified Human");
      expect(result.confidenceScore).toBe(100);
      expect(result.linkId).toBe(1);
    });

    it("returns 'unresolved' for unlinked organizer without guessing", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const result = await resolveLegacyOrganizer(mockDb as any, 999);

      expect(result.status).toBe("unresolved");
      expect(result.memberId).toBeNull();
      expect(result.member).toBeNull();
      expect(result.reason).toContain("No canonical identity link exists");
    });

    it("returns 'review_required' for Category B organizer link", async () => {
      const mockCatBLink: MemberIdentityLink = {
        id: 2,
        memberId: "mem_cand_01",
        sourceTable: "organizers",
        sourceRecordId: "15",
        linkType: "heuristic_match",
        confidenceScore: 75, // Category B
        provenanceJson: { matchedOn: "email_similarity_collision" },
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
              limit: vi.fn().mockResolvedValue([mockCatBLink]),
            }),
          }),
        }),
      };

      const result = await resolveLegacyOrganizer(mockDb as any, 15);

      expect(result.status).toBe("review_required");
      expect(result.memberId).toBe("mem_cand_01");
      expect(result.member).toBeNull();
      expect(result.confidenceScore).toBe(75);
      expect(result.provenance).toEqual({ matchedOn: "email_similarity_collision" });
    });
  });

  describe("2. Scorer Compatibility", () => {
    it("resolves Category A scorer identity", async () => {
      const mockLink: MemberIdentityLink = {
        id: 3,
        memberId: "mem_leg_01",
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

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [mockLink];
                return [mockActiveMember];
              }),
            }),
          }),
        }),
      };

      const result = await resolveLegacyScorer(mockDb as any, 5);

      expect(result.status).toBe("resolved");
      expect(result.memberId).toBe("mem_leg_01");
      expect(result.sourceTable).toBe("scorer_accounts");
      expect(result.sourceRecordId).toBe("5");
    });

    it("returns 'unresolved' when linked member account is suspended", async () => {
      const mockLink: MemberIdentityLink = {
        id: 4,
        memberId: "mem_suspended",
        sourceTable: "scorer_accounts",
        sourceRecordId: "9",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const suspendedMember = { ...mockActiveMember, id: "mem_suspended", accountStatus: "suspended" };

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [mockLink];
                return [suspendedMember];
              }),
            }),
          }),
        }),
      };

      const result = await resolveLegacyScorer(mockDb as any, 9);

      expect(result.status).toBe("unresolved");
      expect(result.reason).toContain("suspended");
    });
  });

  describe("3. Player & Badminton Compatibility", () => {
    it("resolves Category A verified player", async () => {
      const mockLink: MemberIdentityLink = {
        id: 5,
        memberId: "mem_leg_01",
        sourceTable: "players",
        sourceRecordId: "101",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
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
                if (callIdx === 1) return [mockLink];
                return [mockActiveMember];
              }),
            }),
          }),
        }),
      };

      const result = await resolveLegacyPlayer(mockDb as any, 101);

      expect(result.status).toBe("resolved");
      expect(result.memberId).toBe("mem_leg_01");
    });

    it("resolves Category A badminton player", async () => {
      const mockLink: MemberIdentityLink = {
        id: 6,
        memberId: "mem_leg_01",
        sourceTable: "badminton_players",
        sourceRecordId: "202",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
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
                if (callIdx === 1) return [mockLink];
                return [mockActiveMember];
              }),
            }),
          }),
        }),
      };

      const result = await resolveLegacyBadmintonPlayer(mockDb as any, 202);

      expect(result.status).toBe("resolved");
      expect(result.sourceTable).toBe("badminton_players");
      expect(result.sourceRecordId).toBe("202");
    });

    it("returns 'review_required' for Category B badminton player without auto-linking", async () => {
      const mockCatBLink: MemberIdentityLink = {
        id: 7,
        memberId: "mem_badminton_cand",
        sourceTable: "badminton_players",
        sourceRecordId: "303",
        linkType: "heuristic_match",
        confidenceScore: 80,
        provenanceJson: { reason: "name_partial_match" },
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
              limit: vi.fn().mockResolvedValue([mockCatBLink]),
            }),
          }),
        }),
      };

      const result = await resolveLegacyBadmintonPlayer(mockDb as any, 303);

      expect(result.status).toBe("review_required");
      expect(result.member).toBeNull();
    });
  });

  describe("4. Team Owner & Scoring Officials Conservative Resolution", () => {
    it("resolves owner when active canonical participation exists", async () => {
      const mockOwnerParticipation: TournamentParticipation = {
        id: 11,
        tournamentId: 30,
        memberId: "mem_leg_01",
        role: "team_owner",
        status: "active",
        teamId: 77,
        categoryId: null,
        displayNameOverride: null,
        initials: null,
        jerseyNumber: null,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callIdx++;
              if (callIdx === 1) return { limit: () => [mockOwnerParticipation] };
              return { limit: () => [mockActiveMember] };
            }),
          }),
        }),
      };

      const result = await resolveLegacyOwner(mockDb as any, 30, 77);

      expect(result.status).toBe("resolved");
      expect(result.memberId).toBe("mem_leg_01");
      expect(result.sourceTable).toBe("teams_owner");
    });

    it("returns 'unresolved' for team owner with no participation and no link", async () => {
      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callIdx++;
              return { limit: () => [] }; // No participation, no link
            }),
          }),
        }),
      };

      const result = await resolveLegacyOwner(mockDb as any, 30, 888);

      expect(result.status).toBe("unresolved");
      expect(result.memberId).toBeNull();
    });

    it("returns 'review_required' for unlinked scoring official (Category B)", async () => {
      const mockOfficialLink: MemberIdentityLink = {
        id: 8,
        memberId: "mem_official_cand",
        sourceTable: "scoring_officials",
        sourceRecordId: "12",
        linkType: "heuristic_match",
        confidenceScore: 60,
        provenanceJson: { note: "Roster official" },
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
              limit: vi.fn().mockResolvedValue([mockOfficialLink]),
            }),
          }),
        }),
      };

      const result = await resolveLegacyOfficial(mockDb as any, 12);

      expect(result.status).toBe("review_required");
      expect(result.member).toBeNull();
    });
  });

  describe("5. Migration Review Candidates & Readiness Report", () => {
    it("lists migration review candidates", async () => {
      const mockReviewCandidates: MemberIdentityLink[] = [
        {
          id: 1,
          memberId: "mem_01",
          sourceTable: "players",
          sourceRecordId: "50",
          linkType: "heuristic_match",
          confidenceScore: 70,
          provenanceJson: null,
          status: "pending_review",
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockReviewCandidates),
            }),
          }),
        }),
      };

      const candidates = await listMigrationReviewCandidates(mockDb as any);

      expect(candidates.length).toBe(1);
      expect(candidates[0]!.confidenceScore).toBe(70);
    });

    it("generates read-only migration readiness report without data mutation", async () => {
      // Mock db returns counts for each source
      const mockLinks: MemberIdentityLink[] = [
        {
          id: 1,
          memberId: "mem_01",
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
        },
      ];

      let countCall = 0;
      let linkCall = 0;

      const mockDb = {
        select: vi.fn().mockImplementation((fields) => {
          if (fields?.count) {
            return {
              from: vi.fn().mockImplementation(() => {
                countCall++;
                return [{ count: 10 }]; // 10 records per source
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockImplementation(() => {
                linkCall++;
                if (linkCall === 1) return mockLinks; // organizers have 1 resolved
                return []; // other sources have 0 links
              }),
            }),
          };
        }),
      };

      const report = await getMigrationReadinessReport(mockDb as any);

      expect(report.sources.length).toBe(7);
      expect(report.totalRecords).toBe(70);
      expect(report.totalResolved).toBe(1);
      expect(report.totalUnresolved).toBe(69);
      expect(report.readinessPercentage).toBe(1.43);
      expect(report.generatedAt).toBeDefined();

      const orgSource = report.sources.find((s) => s.sourceTable === "organizers");
      expect(orgSource).toBeDefined();
      expect(orgSource!.totalRecords).toBe(10);
      expect(orgSource!.resolvedCount).toBe(1);
      expect(orgSource!.categoryACount).toBe(1);
      expect(orgSource!.unresolvedCount).toBe(9);
    });
  });

  describe("6. Legacy Database Safety & Zero-Mutation Integrity", () => {
    it("confirms legacy tables remain completely untouched", () => {
      expect(getTableName(organizersTable)).toBe("organizers");
      expect(getTableName(scorerAccountsTable)).toBe("scorer_accounts");
      expect(getTableName(playersTable)).toBe("players");
      expect(getTableName(badmintonPlayersTable)).toBe("badminton_players");
      expect(getTableName(globalPlayersTable)).toBe("global_players");
      expect(getTableName(scoringOfficialsTable)).toBe("scoring_officials");
      expect(getTableName(teamsTable)).toBe("teams");
      expect(getTableName(memberIdentityLinksTable)).toBe("member_identity_links");

      const orgCols = getTableColumns(organizersTable);
      expect(orgCols.id.name).toBe("id");
      expect(orgCols.passwordHash.name).toBe("password_hash");

      const scorerCols = getTableColumns(scorerAccountsTable);
      expect(scorerCols.id.name).toBe("id");
      expect(scorerCols.pinHash.name).toBe("pin_hash");

      const teamCols = getTableColumns(teamsTable);
      expect(teamCols.id.name).toBe("id");
      expect(teamCols.accessCode.name).toBe("access_code");
    });
  });
});
