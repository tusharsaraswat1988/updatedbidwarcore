import { describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  tournamentParticipationsTable,
  membersTable,
  tournamentsTable,
  teamsTable,
  memberRolesTable,
  insertTournamentParticipationSchema,
  organizersTable,
  scorerAccountsTable,
  playersTable,
  badmintonPlayersTable,
  ownerSessionsTable,
} from "@workspace/db";
import {
  createTournamentParticipation,
  getTournamentParticipation,
  getTournamentParticipationByMemberRole,
  listTournamentParticipations,
  updateTournamentParticipation,
  removeTournamentParticipation,
  resolveMemberTournamentContext,
  resolveMemberForLegacyOrganizer,
  resolveMemberForLegacyScorer,
  resolveMemberForLegacyPlayer,
  resolveMemberForLegacyOwner,
  TournamentParticipationError,
  validateParticipationRole,
  validateParticipationStatus,
  isActiveParticipation,
} from "@workspace/db/tournament-participation";
import type {
  Member,
  Tournament,
  Team,
  TournamentParticipation,
  MemberRole,
  MemberIdentityLink,
} from "@workspace/db";

describe("Phase 5F — Tournament Participation & Canonical Member↔Tournament Relationship Tests", () => {
  describe("1. Schema & Constraints", () => {
    it("reuses existing tournament_participations table without schema fragmentation", () => {
      expect(getTableName(tournamentParticipationsTable)).toBe("tournament_participations");
      const cols = getTableColumns(tournamentParticipationsTable);

      expect(cols.id.name).toBe("id");
      expect(cols.tournamentId.name).toBe("tournament_id");
      expect(cols.tournamentId.notNull).toBe(true);
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.memberId.notNull).toBe(true);
      expect(cols.role.name).toBe("role");
      expect(cols.role.notNull).toBe(true);
      expect(cols.status.name).toBe("status");
      expect(cols.status.notNull).toBe(true);
      expect(cols.teamId.name).toBe("team_id");
      expect(cols.categoryId.name).toBe("category_id");
      expect(cols.displayNameOverride.name).toBe("display_name_override");
      expect(cols.initials.name).toBe("initials");
      expect(cols.jerseyNumber.name).toBe("jersey_number");
      expect(cols.metadataJson.name).toBe("metadata_json");
      expect(cols.createdAt.notNull).toBe(true);
      expect(cols.updatedAt.notNull).toBe(true);
    });

    it("validates Zod schema for insertTournamentParticipation", () => {
      const valid = insertTournamentParticipationSchema.parse({
        tournamentId: 101,
        memberId: "mem_12345678901234567890123456789012",
        role: "player",
        status: "active",
      });

      expect(valid.tournamentId).toBe(101);
      expect(valid.role).toBe("player");
      expect(valid.status).toBe("active");
    });

    it("validates role and status whitelist", () => {
      expect(validateParticipationRole("organizer")).toBe(true);
      expect(validateParticipationRole("player")).toBe(true);
      expect(validateParticipationRole("scorer")).toBe(true);
      expect(validateParticipationRole("team_owner")).toBe(true);
      expect(validateParticipationRole("coach")).toBe(true);
      expect(validateParticipationRole("umpire")).toBe(true);
      expect(validateParticipationRole("referee")).toBe(true);
      expect(validateParticipationRole("match_official")).toBe(true);
      expect(validateParticipationRole("fan")).toBe(true);
      expect(validateParticipationRole("mentor")).toBe(true);
      expect(validateParticipationRole("invalid_role_xyz")).toBe(false);

      expect(validateParticipationStatus("active")).toBe(true);
      expect(validateParticipationStatus("invited")).toBe(true);
      expect(validateParticipationStatus("pending")).toBe(true);
      expect(validateParticipationStatus("suspended")).toBe(true);
      expect(validateParticipationStatus("withdrawn")).toBe(true);
      expect(validateParticipationStatus("disqualified")).toBe(true);
      expect(validateParticipationStatus("removed")).toBe(true);
      expect(validateParticipationStatus("bogus_status")).toBe(false);

      expect(isActiveParticipation("active")).toBe(true);
      expect(isActiveParticipation("suspended")).toBe(false);
      expect(isActiveParticipation("removed")).toBe(false);
    });
  });

  describe("2. Participation Service Operations", () => {
    const mockActiveMember: Member = {
      id: "mem_p01",
      displayName: "Alice Runner",
      firstName: "Alice",
      lastName: "Runner",
      primaryMobile: "9876543210",
      primaryEmail: "alice@example.com",
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

    const mockTournament: Tournament = {
      id: 50,
      name: "Championship 2026",
      status: "active",
      sport: "badminton",
      city: "Mumbai",
      organizerId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const mockTeam: Team = {
      id: 200,
      tournamentId: 50,
      name: "Shuttle Masters",
      accessCode: "CODE123",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    it("creates a valid participation successfully", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) return [mockActiveMember]; // Member lookup
                if (callCount === 2) return [mockTournament]; // Tournament lookup
                if (callCount === 3) return [mockTeam]; // Team lookup
                return []; // Duplicate check (none found)
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                tournamentId: 50,
                memberId: "mem_p01",
                role: "player",
                status: "active",
                teamId: 200,
                categoryId: 5,
                displayNameOverride: "A. Runner",
                initials: "AR",
                jerseyNumber: "7",
                metadataJson: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const result = await createTournamentParticipation(mockDb as any, {
        tournamentId: 50,
        memberId: "mem_p01",
        role: "player",
        teamId: 200,
        categoryId: 5,
        displayNameOverride: "A. Runner",
        initials: "AR",
        jerseyNumber: "7",
      });

      expect(result.id).toBe(1);
      expect(result.tournamentId).toBe(50);
      expect(result.memberId).toBe("mem_p01");
      expect(result.role).toBe("player");
      expect(result.teamId).toBe(200);
      expect(result.displayNameOverride).toBe("A. Runner");
    });

    it("rejects participation for non-existent Member", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      await expect(
        createTournamentParticipation(mockDb as any, {
          tournamentId: 50,
          memberId: "mem_non_existent",
          role: "player",
        }),
      ).rejects.toThrow("Member not found");
    });

    it("rejects participation for suspended Member", async () => {
      const suspendedMember = { ...mockActiveMember, accountStatus: "suspended" };
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([suspendedMember]),
            }),
          }),
        }),
      };

      await expect(
        createTournamentParticipation(mockDb as any, {
          tournamentId: 50,
          memberId: "mem_p01",
          role: "player",
        }),
      ).rejects.toThrow("Member account is inactive or suspended");
    });

    it("rejects participation for non-existent Tournament", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) return [mockActiveMember];
                return []; // Tournament missing
              }),
            }),
          }),
        }),
      };

      await expect(
        createTournamentParticipation(mockDb as any, {
          tournamentId: 999,
          memberId: "mem_p01",
          role: "player",
        }),
      ).rejects.toThrow("Tournament not found");
    });

    it("rejects cross-tournament team assignment", async () => {
      const wrongTournamentTeam: Team = {
        id: 300,
        tournamentId: 88, // Differs from requested tournament 50
        name: "Foreign Team",
      } as any;

      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) return [mockActiveMember];
                if (callCount === 2) return [mockTournament];
                return [wrongTournamentTeam];
              }),
            }),
          }),
        }),
      };

      await expect(
        createTournamentParticipation(mockDb as any, {
          tournamentId: 50,
          memberId: "mem_p01",
          role: "player",
          teamId: 300,
        }),
      ).rejects.toThrow("Team does not belong to the specified tournament");
    });

    it("prevents duplicate canonical participation for same tournament, member, and role", async () => {
      const existingParticipation: TournamentParticipation = {
        id: 10,
        tournamentId: 50,
        memberId: "mem_p01",
        role: "player",
        status: "active",
        teamId: null,
        categoryId: null,
        displayNameOverride: null,
        initials: null,
        jerseyNumber: null,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) return [mockActiveMember];
                if (callCount === 2) return [mockTournament];
                return [existingParticipation]; // Duplicate found
              }),
            }),
          }),
        }),
      };

      await expect(
        createTournamentParticipation(mockDb as any, {
          tournamentId: 50,
          memberId: "mem_p01",
          role: "player",
        }),
      ).rejects.toThrow("Member already has a 'player' participation in this tournament");
    });

    it("supports multiple distinct roles for same Member in same tournament", async () => {
      let callCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) return [mockActiveMember];
                if (callCount === 2) return [mockTournament];
                if (callCount === 3) return [mockTeam];
                return []; // No existing 'team_owner' role
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 2,
                tournamentId: 50,
                memberId: "mem_p01",
                role: "team_owner",
                status: "active",
                teamId: 200,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const result = await createTournamentParticipation(mockDb as any, {
        tournamentId: 50,
        memberId: "mem_p01",
        role: "team_owner",
        teamId: 200,
      });

      expect(result.role).toBe("team_owner");
    });

    it("soft-removes participation preserving history with metadata reason", async () => {
      const existing: TournamentParticipation = {
        id: 7,
        tournamentId: 50,
        memberId: "mem_p01",
        role: "scorer",
        status: "active",
        teamId: null,
        categoryId: null,
        displayNameOverride: null,
        initials: null,
        jerseyNumber: null,
        metadataJson: { previousNotes: "official" },
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
                  status: "removed",
                  metadataJson: {
                    previousNotes: "official",
                    removedReason: "Official resigned",
                  },
                },
              ]),
            }),
          }),
        }),
      };

      const res = await removeTournamentParticipation(
        mockDb as any,
        7,
        "Official resigned",
      );

      expect(res.status).toBe("removed");
      expect((res.metadataJson as any).removedReason).toBe("Official resigned");
    });
  });

  describe("3. Tournament Isolation & Authorization Integration", () => {
    it("resolves capabilities scoped strictly to active tournament participations", async () => {
      const mockMember: Member = {
        id: "mem_multi_01",
        displayName: "Bob Scorer",
        firstName: "Bob",
        lastName: "Scorer",
        primaryMobile: "9988776655",
        primaryEmail: "bob@example.com",
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

      const mockTournament: Tournament = {
        id: 10,
        name: "Premier League T10",
      } as any;

      const mockParticipations: TournamentParticipation[] = [
        {
          id: 1,
          tournamentId: 10,
          memberId: "mem_multi_01",
          role: "scorer",
          status: "active",
          teamId: null,
          categoryId: null,
          displayNameOverride: null,
          initials: null,
          jerseyNumber: null,
          metadataJson: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockRoles: MemberRole[] = [];

      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              selectIdx++;
              if (selectIdx === 1) return { limit: () => [mockMember] };
              if (selectIdx === 2) return { limit: () => [mockTournament] };
              if (selectIdx === 3) return mockParticipations;
              return mockRoles;
            }),
          }),
        }),
      };

      const context = await resolveMemberTournamentContext(mockDb as any, {
        tournamentId: 10,
        memberId: "mem_multi_01",
      });

      expect(context.member.id).toBe("mem_multi_01");
      expect(context.tournament.id).toBe(10);
      expect(context.activeRoles).toContain("scorer");
      expect(context.capabilities).toContain("scoring:live");
      expect(context.capabilities).toContain("match:lock");

      // Validated helper: true for Tournament 10
      expect(context.hasCapability("scoring:live")).toBe(true);
    });

    it("blocks access when participation is suspended or removed", async () => {
      const mockMember: Member = { id: "mem_multi_01" } as any;
      const mockTournament: Tournament = { id: 10 } as any;

      const suspendedParticipations: TournamentParticipation[] = [
        {
          id: 1,
          tournamentId: 10,
          memberId: "mem_multi_01",
          role: "scorer",
          status: "suspended", // Suspended
          teamId: null,
          categoryId: null,
          displayNameOverride: null,
          initials: null,
          jerseyNumber: null,
          metadataJson: null,
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
              if (selectIdx === 2) return { limit: () => [mockTournament] };
              if (selectIdx === 3) return suspendedParticipations;
              return [];
            }),
          }),
        }),
      };

      const context = await resolveMemberTournamentContext(mockDb as any, {
        tournamentId: 10,
        memberId: "mem_multi_01",
      });

      expect(context.activeRoles.length).toBe(0);
      expect(context.capabilities.length).toBe(0);
      expect(context.hasCapability("scoring:live")).toBe(false);
    });

    it("enforces team boundary isolation within tournament context", async () => {
      const mockMember: Member = { id: "mem_owner_01" } as any;
      const mockTournament: Tournament = { id: 10 } as any;

      const teamParticipations: TournamentParticipation[] = [
        {
          id: 2,
          tournamentId: 10,
          memberId: "mem_owner_01",
          role: "team_owner",
          status: "active",
          teamId: 100, // Bound to Team 100
          categoryId: null,
          displayNameOverride: null,
          initials: null,
          jerseyNumber: null,
          metadataJson: null,
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
              if (selectIdx === 2) return { limit: () => [mockTournament] };
              if (selectIdx === 3) return teamParticipations;
              return [];
            }),
          }),
        }),
      };

      const context = await resolveMemberTournamentContext(mockDb as any, {
        tournamentId: 10,
        memberId: "mem_owner_01",
        teamId: 100,
      });

      // Allowed for assigned team 100
      expect(context.hasCapability("auction:bid", { teamId: 100 })).toBe(true);

      // Denied for foreign team 200 (prevents cross-team leakage)
      expect(context.hasCapability("auction:bid", { teamId: 200 })).toBe(false);
    });
  });

  describe("4. Legacy Adapters & Category Migration Safety", () => {
    it("resolves canonical Member for Category A Organizer link", async () => {
      const mockLink: MemberIdentityLink = {
        id: 1,
        memberId: "mem_org_01",
        sourceTable: "organizers",
        sourceRecordId: "42",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember: Member = {
        id: "mem_org_01",
        displayName: "Legacy Organizer",
      } as any;

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [mockLink];
                return [mockMember];
              }),
            }),
          }),
        }),
      };

      const resolved = await resolveMemberForLegacyOrganizer(mockDb as any, 42);
      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe("mem_org_01");
      expect(resolved!.displayName).toBe("Legacy Organizer");
    });

    it("returns null for unlinked legacy Organizer without fabricating links", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      const resolved = await resolveMemberForLegacyOrganizer(mockDb as any, 9999);
      expect(resolved).toBeNull();
    });

    it("resolves canonical Member for Category A Scorer link", async () => {
      const mockLink: MemberIdentityLink = {
        id: 2,
        memberId: "mem_scorer_01",
        sourceTable: "scorer_accounts",
        sourceRecordId: "8",
        linkType: "direct_fk",
        confidenceScore: 100,
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember: Member = {
        id: "mem_scorer_01",
        displayName: "Legacy Scorer",
      } as any;

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [mockLink];
                return [mockMember];
              }),
            }),
          }),
        }),
      };

      const resolved = await resolveMemberForLegacyScorer(mockDb as any, 8);
      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe("mem_scorer_01");
    });

    it("strictly guards Category B/C historical player identities (returns null if confidence < 100)", async () => {
      // Category B/C link with low confidence score (e.g. 70)
      const lowConfidenceLink: MemberIdentityLink = {
        id: 3,
        memberId: "mem_guessed_01",
        sourceTable: "players",
        sourceRecordId: "555",
        linkType: "heuristic_match",
        confidenceScore: 70, // Low confidence -> Category B/C
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
              limit: vi.fn().mockResolvedValue([lowConfidenceLink]),
            }),
          }),
        }),
      };

      const resolved = await resolveMemberForLegacyPlayer(mockDb as any, {
        sourceTable: "players",
        sourceRecordId: 555,
      });

      // Must be null: Category B/C cannot be auto-resolved
      expect(resolved).toBeNull();
    });

    it("resolves Member for Category A Player link with 100 confidence", async () => {
      const catALink: MemberIdentityLink = {
        id: 4,
        memberId: "mem_catA_player",
        sourceTable: "badminton_players",
        sourceRecordId: "123",
        linkType: "direct_fk",
        confidenceScore: 100, // Category A
        provenanceJson: null,
        status: "active",
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember: Member = {
        id: "mem_catA_player",
        displayName: "Verified Badminton Star",
      } as any;

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [catALink];
                return [mockMember];
              }),
            }),
          }),
        }),
      };

      const resolved = await resolveMemberForLegacyPlayer(mockDb as any, {
        sourceTable: "badminton_players",
        sourceRecordId: 123,
      });

      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe("mem_catA_player");
      expect(resolved!.displayName).toBe("Verified Badminton Star");
    });

    it("resolves canonical Member for tournament Team Owner participation", async () => {
      const mockOwnerParticipation: TournamentParticipation = {
        id: 8,
        tournamentId: 25,
        memberId: "mem_owner_25",
        role: "team_owner",
        status: "active",
        teamId: 11,
        categoryId: null,
        displayNameOverride: null,
        initials: null,
        jerseyNumber: null,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember: Member = {
        id: "mem_owner_25",
        displayName: "Team Franchise Owner",
      } as any;

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callIdx++;
                if (callIdx === 1) return [mockOwnerParticipation];
                return [mockMember];
              }),
            }),
          }),
        }),
      };

      const resolved = await resolveMemberForLegacyOwner(mockDb as any, {
        tournamentId: 25,
        teamId: 11,
      });

      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe("mem_owner_25");
      expect(resolved!.displayName).toBe("Team Franchise Owner");
    });
  });

  describe("5. Legacy Database Safety & Zero-Mutation Integrity", () => {
    it("confirms legacy tables remain completely untouched", () => {
      expect(getTableName(organizersTable)).toBe("organizers");
      expect(getTableName(scorerAccountsTable)).toBe("scorer_accounts");
      expect(getTableName(ownerSessionsTable)).toBe("owner_sessions");
      expect(getTableName(playersTable)).toBe("players");
      expect(getTableName(badmintonPlayersTable)).toBe("badminton_players");

      const orgCols = getTableColumns(organizersTable);
      expect(orgCols.id.name).toBe("id");
      expect(orgCols.email.name).toBe("email");
      expect(orgCols.passwordHash.name).toBe("password_hash");

      const scorerCols = getTableColumns(scorerAccountsTable);
      expect(scorerCols.id.name).toBe("id");
      expect(scorerCols.pinHash.name).toBe("pin_hash");

      const ownerCols = getTableColumns(ownerSessionsTable);
      expect(ownerCols.tournamentId.name).toBe("tournament_id");
      expect(ownerCols.teamId.name).toBe("team_id");
    });
  });
});
