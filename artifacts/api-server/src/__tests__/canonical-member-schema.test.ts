import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  membersTable,
  memberRolesTable,
  memberSportProfilesTable,
  tournamentParticipationsTable,
  memberIdentityLinksTable,
  generateMemberId,
  insertMemberSchema,
  insertMemberRoleSchema,
  insertMemberSportProfileSchema,
  insertTournamentParticipationSchema,
  insertMemberIdentityLinkSchema,
  globalPlayersTable,
  playersTable,
  badmintonPlayersTable,
  organizersTable,
  scorerAccountsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { buildSchemaContractFromDrizzle } from "@workspace/db/schema-governance";

describe("Phase 5C — Canonical Member Identity Schema Unit Tests", () => {
  describe("1. Canonical Member Schema & Identifier", () => {
    it("generates unique, immutable canonical member IDs with mem_ prefix", () => {
      const id1 = generateMemberId();
      const id2 = generateMemberId();

      expect(id1).toMatch(/^mem_[0-9a-f]{32}$/);
      expect(id2).toMatch(/^mem_[0-9a-f]{32}$/);
      expect(id1).not.toBe(id2);
    });

    it("defines membersTable with exact required columns and constraints", () => {
      expect(getTableName(membersTable)).toBe("members");
      const cols = getTableColumns(membersTable);

      expect(cols.id.name).toBe("id");
      expect(cols.displayName.name).toBe("display_name");
      expect(cols.displayName.notNull).toBe(true);

      // Optional fields are nullable
      expect(cols.firstName.notNull).toBe(false);
      expect(cols.lastName.notNull).toBe(false);
      expect(cols.primaryMobile.notNull).toBe(false);
      expect(cols.primaryEmail.notNull).toBe(false);
      expect(cols.dob.notNull).toBe(false);
      expect(cols.gender.notNull).toBe(false);
      expect(cols.country.notNull).toBe(false);
      expect(cols.state.notNull).toBe(false);
      expect(cols.city.notNull).toBe(false);
      expect(cols.avatarUrl.notNull).toBe(false);
      expect(cols.avatarPublicId.notNull).toBe(false);

      // Verification flags have defaults
      expect(cols.isMobileVerified.notNull).toBe(true);
      expect(cols.isEmailVerified.notNull).toBe(true);
      expect(cols.accountStatus.notNull).toBe(true);
    });

    it("validates insert payload with insertMemberSchema", () => {
      const parsed = insertMemberSchema.parse({
        id: generateMemberId(),
        displayName: "Aryan Sharma",
        primaryMobile: "+919876543210",
        isMobileVerified: true,
        gender: "M",
        country: "IND",
        accountStatus: "active",
      });

      expect(parsed.displayName).toBe("Aryan Sharma");
      expect(parsed.isMobileVerified).toBe(true);
      expect(parsed.accountStatus).toBe("active");
    });
  });

  describe("2. Member Roles & Capability Model", () => {
    it("defines memberRolesTable with member reference and scoping columns", () => {
      expect(getTableName(memberRolesTable)).toBe("member_roles");
      const cols = getTableColumns(memberRolesTable);

      expect(cols.id.name).toBe("id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.memberId.notNull).toBe(true);
      expect(cols.role.name).toBe("role");
      expect(cols.role.notNull).toBe(true);
      expect(cols.scope.name).toBe("scope");
      expect(cols.scope.notNull).toBe(true);

      expect(cols.tournamentId.name).toBe("tournament_id");
      expect(cols.teamId.name).toBe("team_id");
      expect(cols.matchId.name).toBe("match_id");
    });

    it("validates roles across different scopes (global, tournament, team, match)", () => {
      const globalOrganizer = insertMemberRoleSchema.parse({
        memberId: "mem_1001",
        role: "organizer",
        scope: "global",
      });
      expect(globalOrganizer.scope).toBe("global");

      const tournamentScorer = insertMemberRoleSchema.parse({
        memberId: "mem_1002",
        role: "scorer",
        scope: "tournament",
        tournamentId: 42,
      });
      expect(tournamentScorer.tournamentId).toBe(42);

      const teamOwner = insertMemberRoleSchema.parse({
        memberId: "mem_1003",
        role: "team_owner",
        scope: "team",
        teamId: 10,
        tournamentId: 42,
      });
      expect(teamOwner.teamId).toBe(10);
    });
  });

  describe("3. Member Sport Profiles", () => {
    it("defines memberSportProfilesTable for multi-sport isolation", () => {
      expect(getTableName(memberSportProfilesTable)).toBe("member_sport_profiles");
      const cols = getTableColumns(memberSportProfilesTable);

      expect(cols.id.name).toBe("id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.sportSlug.name).toBe("sport_slug");
      expect(cols.sportSlug.notNull).toBe(true);
      expect(cols.primaryRole.name).toBe("primary_role");
      expect(cols.handedness.name).toBe("handedness");
      expect(cols.federationCode.name).toBe("federation_code");
      expect(cols.profileJson.name).toBe("profile_json");
    });

    it("allows distinct sport profiles for Cricket and Badminton", () => {
      const cricketProfile = insertMemberSportProfileSchema.parse({
        memberId: "mem_2001",
        sportSlug: "cricket",
        primaryRole: "All-rounder",
        handedness: "Right-hand bat / Right-arm medium",
        profileJson: { battingOrder: "top", bowlingType: "medium_pace" },
      });
      expect(cricketProfile.sportSlug).toBe("cricket");

      const badmintonProfile = insertMemberSportProfileSchema.parse({
        memberId: "mem_2001",
        sportSlug: "badminton",
        primaryRole: "Singles",
        federationCode: "INPV9921",
        profileJson: { bfaRanking: 12 },
      });
      expect(badmintonProfile.sportSlug).toBe("badminton");
      expect(badmintonProfile.federationCode).toBe("INPV9921");
    });
  });

  describe("4. Tournament Participations", () => {
    it("defines tournamentParticipationsTable decoupling domain state from participation", () => {
      expect(getTableName(tournamentParticipationsTable)).toBe("tournament_participations");
      const cols = getTableColumns(tournamentParticipationsTable);

      expect(cols.id.name).toBe("id");
      expect(cols.tournamentId.name).toBe("tournament_id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.role.name).toBe("role");
      expect(cols.status.name).toBe("status");
      expect(cols.teamId.name).toBe("team_id");
      expect(cols.categoryId.name).toBe("category_id");
      expect(cols.displayNameOverride.name).toBe("display_name_override");
      expect(cols.initials.name).toBe("initials");
    });

    it("validates participation and multi-role assignment schemas", () => {
      const playerParticipation = insertTournamentParticipationSchema.parse({
        tournamentId: 10,
        memberId: "mem_3001",
        role: "player",
        teamId: 5,
        initials: "AS",
      });
      expect(playerParticipation.role).toBe("player");

      const officialParticipation = insertTournamentParticipationSchema.parse({
        tournamentId: 10,
        memberId: "mem_3001",
        role: "match_official",
        status: "active",
      });
      expect(officialParticipation.role).toBe("match_official");
    });
  });

  describe("5. Member Identity Links (Historical Bridge)", () => {
    it("defines memberIdentityLinksTable with provenance and confidence fields", () => {
      expect(getTableName(memberIdentityLinksTable)).toBe("member_identity_links");
      const cols = getTableColumns(memberIdentityLinksTable);

      expect(cols.id.name).toBe("id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.sourceTable.name).toBe("source_table");
      expect(cols.sourceRecordId.name).toBe("source_record_id");
      expect(cols.linkType.name).toBe("link_type");
      expect(cols.confidenceScore.name).toBe("confidence_score");
      expect(cols.provenanceJson.name).toBe("provenance_json");
      expect(cols.status.name).toBe("status");
    });

    it("validates identity link schemas and status states", () => {
      const activeLink = insertMemberIdentityLinkSchema.parse({
        memberId: "mem_4001",
        sourceTable: "global_players",
        sourceRecordId: "gp_9941",
        linkType: "direct_fk",
        confidenceScore: 100,
        status: "active",
        provenanceJson: { verifiedVia: "phone_otp", matchFields: ["mobile"] },
      });
      expect(activeLink.status).toBe("active");
      expect(activeLink.confidenceScore).toBe(100);

      const candidateLink = insertMemberIdentityLinkSchema.parse({
        memberId: "mem_4002",
        sourceTable: "players",
        sourceRecordId: "305",
        linkType: "legacy_import",
        confidenceScore: 60,
        status: "candidate",
      });
      expect(candidateLink.status).toBe("candidate");
      expect(candidateLink.confidenceScore).toBe(60);
    });
  });

  describe("6. Schema Governance & Contract Integration", () => {
    it("includes all 5 canonical Member tables in schema contract", () => {
      const contract = buildSchemaContractFromDrizzle();
      const tableNames = contract.tables.map((t) => t.name);

      expect(tableNames).toContain("members");
      expect(tableNames).toContain("member_roles");
      expect(tableNames).toContain("member_sport_profiles");
      expect(tableNames).toContain("tournament_participations");
      expect(tableNames).toContain("member_identity_links");
    });
  });

  describe("7. Legacy Table Protection & Zero-Mutation Verification", () => {
    it("confirms legacy table column schemas remain completely unmodified", () => {
      // global_players
      const gpCols = getTableColumns(globalPlayersTable);
      expect(gpCols.id.name).toBe("id");
      expect(gpCols.canonicalName.name).toBe("canonical_name");
      expect(gpCols.mobileNumber.name).toBe("mobile_number");

      // players
      const pCols = getTableColumns(playersTable);
      expect(pCols.id.name).toBe("id");
      expect(pCols.tournamentId.name).toBe("tournament_id");
      expect(pCols.basePrice.name).toBe("base_price");
      expect(pCols.soldPrice.name).toBe("sold_price");

      // badminton_players
      const bpCols = getTableColumns(badmintonPlayersTable);
      expect(bpCols.id.name).toBe("id");
      expect(bpCols.tournamentId.name).toBe("tournament_id");
      expect(bpCols.bwfCode.name).toBe("bwf_code");

      // organizers
      const orgCols = getTableColumns(organizersTable);
      expect(orgCols.id.name).toBe("id");
      expect(orgCols.mobile.name).toBe("mobile");
      expect(orgCols.passwordHash.name).toBe("password_hash");

      // scorer_accounts
      const saCols = getTableColumns(scorerAccountsTable);
      expect(saCols.id.name).toBe("id");
      expect(saCols.pinHash.name).toBe("pin_hash");

      // teams
      const teamCols = getTableColumns(teamsTable);
      expect(teamCols.id.name).toBe("id");
      expect(teamCols.ownerName.name).toBe("owner_name");
      expect(teamCols.ownerMobile.name).toBe("owner_mobile");

      // tournaments
      const tCols = getTableColumns(tournamentsTable);
      expect(tCols.id.name).toBe("id");
      expect(tCols.organizerId.name).toBe("organizer_id");
      expect(tCols.auctionEnabled.name).toBe("auction_enabled");
      expect(tCols.scoringEnabled.name).toBe("scoring_enabled");
    });
  });
});
