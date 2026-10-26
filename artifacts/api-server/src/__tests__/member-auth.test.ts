import { describe, expect, it, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import {
  memberAuthIdentitiesTable,
  memberSessionsTable,
  membersTable,
  generateMemberSessionId,
  generateMemberId,
  insertMemberAuthIdentitySchema,
  insertMemberSessionSchema,
  organizersTable,
  scorerAccountsTable,
  ownerSessionsTable,
} from "@workspace/db";
import {
  hashMemberPassword,
  verifyMemberPassword,
  hashToken,
} from "@workspace/db/member-auth";
import {
  resolveMemberCapabilities,
  checkCapability,
  ROLE_CAPABILITIES_MAP,
  isRoleActiveForContext,
} from "@workspace/db/member-auth";
import {
  registerMemberPasswordAuth,
  authenticateMemberPassword,
  authenticateMemberGoogle,
  createMemberSession,
  validateMemberSession,
  revokeMemberSession,
  revokeAllMemberSessions,
  resolveMemberContext,
  linkLegacyIdentityToMember,
  MemberAuthError,
} from "@workspace/db/member-auth";
import type { Member, MemberRole, MemberAuthIdentity, MemberSession, MemberIdentityLink } from "@workspace/db";

describe("Phase 5E — Unified Member Authentication & Capability Migration Tests", () => {
  describe("1. Schema & Table Definitions", () => {
    it("defines member_auth_identities with correct columns and types", () => {
      expect(getTableName(memberAuthIdentitiesTable)).toBe("member_auth_identities");
      const cols = getTableColumns(memberAuthIdentitiesTable);

      expect(cols.id.name).toBe("id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.memberId.notNull).toBe(true);
      expect(cols.provider.name).toBe("provider");
      expect(cols.provider.notNull).toBe(true);
      expect(cols.providerSubject.name).toBe("provider_subject");
      expect(cols.normalizedIdentifier.name).toBe("normalized_identifier");
      expect(cols.passwordHash.name).toBe("password_hash");
      expect(cols.isVerified.notNull).toBe(true);
      expect(cols.isEnabled.notNull).toBe(true);
      expect(cols.createdAt.notNull).toBe(true);
      expect(cols.updatedAt.notNull).toBe(true);
    });

    it("defines member_sessions with correct columns and types", () => {
      expect(getTableName(memberSessionsTable)).toBe("member_sessions");
      const cols = getTableColumns(memberSessionsTable);

      expect(cols.id.name).toBe("id");
      expect(cols.memberId.name).toBe("member_id");
      expect(cols.memberId.notNull).toBe(true);
      expect(cols.authIdentityId.name).toBe("auth_identity_id");
      expect(cols.tokenHash.name).toBe("token_hash");
      expect(cols.deviceName.name).toBe("device_name");
      expect(cols.ipAddress.name).toBe("ip_address");
      expect(cols.userAgent.name).toBe("user_agent");
      expect(cols.expiresAt.notNull).toBe(true);
      expect(cols.createdAt.notNull).toBe(true);
      expect(cols.lastSeenAt.notNull).toBe(true);
    });

    it("generates collision-resistant session IDs with memsess_ prefix", () => {
      const s1 = generateMemberSessionId();
      const s2 = generateMemberSessionId();

      expect(s1).toMatch(/^memsess_[0-9a-f]{32}$/);
      expect(s2).toMatch(/^memsess_[0-9a-f]{32}$/);
      expect(s1).not.toBe(s2);
    });

    it("validates Zod schemas for insert operations", () => {
      const validAuth = insertMemberAuthIdentitySchema.parse({
        memberId: "mem_12345678901234567890123456789012",
        provider: "password",
        normalizedIdentifier: "user@example.com",
        passwordHash: "salt:hash",
      });
      expect(validAuth.provider).toBe("password");

      const validSession = insertMemberSessionSchema.parse({
        id: generateMemberSessionId(),
        memberId: "mem_12345678901234567890123456789012",
        expiresAt: new Date(Date.now() + 86400000),
      });
      expect(validSession.id).toMatch(/^memsess_/);
    });
  });

  describe("2. Member Auth Cryptography", () => {
    it("hashes passwords securely with scrypt and random salt", async () => {
      const hash1 = await hashMemberPassword("SecretP@ssword123");
      const hash2 = await hashMemberPassword("SecretP@ssword123");

      expect(hash1).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(hash2).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      // Different salts produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it("verifies matching passwords correctly and rejects invalid ones", async () => {
      const password = "MySecurePassword2026!";
      const hash = await hashMemberPassword(password);

      const isValid = await verifyMemberPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyMemberPassword("WrongPassword", hash);
      expect(isInvalid).toBe(false);

      const malformed = await verifyMemberPassword(password, "invalid_hash_format");
      expect(malformed).toBe(false);
    });

    it("hashes session tokens with SHA-256", () => {
      const token = "raw_opaque_session_token_123";
      const hash = hashToken(token);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("3. Capability & Scope Resolution", () => {
    it("resolves capabilities for standard organizer role", () => {
      const roles: MemberRole[] = [
        {
          id: 1,
          memberId: "mem_1",
          role: "organizer",
          scope: "global",
          tournamentId: null,
          teamId: null,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const caps = resolveMemberCapabilities(roles);
      expect(caps).toContain("tournament:create");
      expect(caps).toContain("tournament:manage");
      expect(caps).toContain("auction:manage");
      expect(caps).toContain("scorer:assign");

      expect(checkCapability(caps, "tournament:manage")).toBe(true);
      expect(checkCapability(caps, "scoring:live")).toBe(false);
    });

    it("resolves wildcard capabilities for admin role", () => {
      const roles: MemberRole[] = [
        {
          id: 2,
          memberId: "mem_admin",
          role: "admin",
          scope: "global",
          tournamentId: null,
          teamId: null,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const caps = resolveMemberCapabilities(roles);
      expect(caps).toContain("*");
      expect(checkCapability(caps, "tournament:manage")).toBe(true);
      expect(checkCapability(caps, "scoring:live")).toBe(true);
      expect(checkCapability(caps, "arbitrary:permission")).toBe(true);
    });

    it("enforces tournament-scoped role boundaries", () => {
      const roles: MemberRole[] = [
        {
          id: 3,
          memberId: "mem_scoped_scorer",
          role: "scorer",
          scope: "tournament",
          tournamentId: 42,
          teamId: null,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Matching tournament context
      const matchContextCaps = resolveMemberCapabilities(roles, { tournamentId: 42 });
      expect(matchContextCaps).toContain("scoring:live");

      // Non-matching tournament context
      const otherContextCaps = resolveMemberCapabilities(roles, { tournamentId: 99 });
      expect(otherContextCaps).not.toContain("scoring:live");
      expect(otherContextCaps.length).toBe(0);
    });

    it("enforces team-scoped role boundaries", () => {
      const roles: MemberRole[] = [
        {
          id: 4,
          memberId: "mem_owner",
          role: "team_owner",
          scope: "team",
          tournamentId: null,
          teamId: 10,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      expect(isRoleActiveForContext(roles[0]!, { teamId: 10 })).toBe(true);
      expect(isRoleActiveForContext(roles[0]!, { teamId: 20 })).toBe(false);

      const teamCaps = resolveMemberCapabilities(roles, { teamId: 10 });
      expect(teamCaps).toContain("auction:bid");
      expect(teamCaps).toContain("team:roster_view");
    });
  });

  describe("4. Member Auth Service Operations", () => {
    it("registers member password auth and prevents collisions", async () => {
      const mockMember: Member = {
        id: "mem_001",
        displayName: "John Doe",
        firstName: "John",
        lastName: "Doe",
        primaryMobile: "9876543210",
        primaryEmail: "john@example.com",
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

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation((condition) => ({
              limit: vi.fn().mockImplementation(() => {
                // If checking member existence -> return member
                // If checking existing auth -> return empty
                return [mockMember];
              }),
            })),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 1,
                memberId: "mem_001",
                provider: "password",
                providerSubject: "john@example.com",
                normalizedIdentifier: "john@example.com",
                passwordHash: "salt:hash",
                isVerified: false,
                isEnabled: true,
                metadataJson: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      // Mock first call for member lookup (returns mockMember), second for identity lookup (returns empty)
      let queryCount = 0;
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              queryCount++;
              if (queryCount === 1) return [mockMember];
              return [];
            }),
          }),
        }),
      });

      const res = await registerMemberPasswordAuth(mockDb as any, {
        memberId: "mem_001",
        emailOrMobile: "john@example.com",
        password: "secure_password_123",
      });

      expect(res.memberId).toBe("mem_001");
      expect(res.provider).toBe("password");
      expect(res.normalizedIdentifier).toBe("john@example.com");
    });

    it("rejects short password during registration", async () => {
      const mockDb = {} as any;
      await expect(
        registerMemberPasswordAuth(mockDb, {
          memberId: "mem_001",
          emailOrMobile: "test@example.com",
          password: "123",
        }),
      ).rejects.toThrow(MemberAuthError);
    });

    it("authenticates valid password and creates session", async () => {
      const password = "my_password_123";
      const passwordHash = await hashMemberPassword(password);

      const mockAuthIdentity: MemberAuthIdentity = {
        id: 1,
        memberId: "mem_001",
        provider: "password",
        providerSubject: "user@example.com",
        normalizedIdentifier: "user@example.com",
        passwordHash,
        isVerified: true,
        isEnabled: true,
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMember: Member = {
        id: "mem_001",
        displayName: "Valid User",
        firstName: null,
        lastName: null,
        primaryMobile: null,
        primaryEmail: "user@example.com",
        isMobileVerified: false,
        isEmailVerified: true,
        dob: null,
        gender: null,
        country: null,
        state: null,
        city: null,
        avatarUrl: null,
        avatarPublicId: null,
        accountStatus: "active",
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let selectCall = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCall++;
                if (selectCall === 1) return [mockAuthIdentity];
                return [mockMember];
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "memsess_test123",
                memberId: "mem_001",
                authIdentityId: 1,
                deviceName: "Chrome / Windows",
                ipAddress: "127.0.0.1",
                userAgent: "Mozilla",
                expiresAt: new Date(Date.now() + 86400000),
                revokedAt: null,
                createdAt: new Date(),
                lastSeenAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const result = await authenticateMemberPassword(mockDb as any, {
        emailOrMobile: "user@example.com",
        password: "my_password_123",
        deviceName: "Chrome / Windows",
        ipAddress: "127.0.0.1",
      });

      expect(result.member.id).toBe("mem_001");
      expect(result.session.id).toBe("memsess_test123");
      expect(result.authIdentity.id).toBe(1);
    });

    it("throws generic error on invalid password without user enumeration", async () => {
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
        authenticateMemberPassword(mockDb as any, {
          emailOrMobile: "unknown@example.com",
          password: "any_password",
        }),
      ).rejects.toThrow("Invalid credentials");
    });

    it("authenticates Google OAuth and creates new Member if needed", async () => {
      let selectCount = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCount++;
                return []; // No existing google auth, no existing member
              }),
            }),
          }),
        }),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => ({
            returning: vi.fn().mockImplementation(() => {
              if (val.displayName) {
                // inserting member
                return [
                  {
                    id: val.id,
                    displayName: val.displayName,
                    primaryEmail: val.primaryEmail,
                    isEmailVerified: true,
                    accountStatus: "active",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ];
              }
              if (val.provider === "google") {
                // inserting auth identity
                return [
                  {
                    id: 10,
                    memberId: val.memberId,
                    provider: "google",
                    providerSubject: val.providerSubject,
                    normalizedIdentifier: val.normalizedIdentifier,
                    isVerified: true,
                    isEnabled: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ];
              }
              // inserting session
              return [
                {
                  id: val.id,
                  memberId: val.memberId,
                  authIdentityId: val.authIdentityId,
                  expiresAt: val.expiresAt,
                  revokedAt: null,
                  createdAt: new Date(),
                  lastSeenAt: new Date(),
                },
              ];
            }),
          })),
        })),
      };

      const result = await authenticateMemberGoogle(mockDb as any, {
        googleSubject: "google_sub_998877",
        email: "googleuser@gmail.com",
        name: "Google User",
        avatarUrl: "https://lh3.googleusercontent.com/photo.jpg",
      });

      expect(result.member.primaryEmail).toBe("googleuser@gmail.com");
      expect(result.authIdentity.provider).toBe("google");
      expect(result.authIdentity.providerSubject).toBe("google_sub_998877");
      expect(result.session.id).toMatch(/^memsess_/);
    });

    it("validates active session and updates lastSeenAt", async () => {
      const mockSession: MemberSession = {
        id: "memsess_valid_01",
        memberId: "mem_001",
        authIdentityId: 1,
        tokenHash: null,
        deviceName: "MacBook Pro",
        ipAddress: "1.2.3.4",
        userAgent: "Safari",
        expiresAt: new Date(Date.now() + 3600000), // +1 hour
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };

      const mockMember: Member = {
        id: "mem_001",
        displayName: "Active Member",
        firstName: null,
        lastName: null,
        primaryMobile: null,
        primaryEmail: "active@example.com",
        isMobileVerified: true,
        isEmailVerified: true,
        dob: null,
        gender: null,
        country: null,
        state: null,
        city: null,
        avatarUrl: null,
        avatarPublicId: null,
        accountStatus: "active",
        metadataJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let selectIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectIdx++;
                if (selectIdx === 1) return [mockSession];
                return [mockMember];
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      const res = await validateMemberSession(mockDb as any, "memsess_valid_01");
      expect(res.member.id).toBe("mem_001");
      expect(res.session.id).toBe("memsess_valid_01");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("revokes single session and all sessions", async () => {
      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      await revokeMemberSession(mockDb as any, "memsess_123");
      expect(mockDb.update).toHaveBeenCalled();

      await revokeAllMemberSessions(mockDb as any, "mem_456");
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it("resolves full MemberContext with capabilities and helper", async () => {
      const mockMember: Member = {
        id: "mem_ctx_01",
        displayName: "Multi Role Member",
        firstName: "Multi",
        lastName: "Role",
        primaryMobile: "9998887776",
        primaryEmail: "multirole@example.com",
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

      const mockRoles: MemberRole[] = [
        {
          id: 1,
          memberId: "mem_ctx_01",
          role: "organizer",
          scope: "global",
          tournamentId: null,
          teamId: null,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          memberId: "mem_ctx_01",
          role: "scorer",
          scope: "tournament",
          tournamentId: 100,
          teamId: null,
          matchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockLinks: MemberIdentityLink[] = [
        {
          id: 1,
          memberId: "mem_ctx_01",
          sourceTable: "organizers",
          sourceRecordId: "5",
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

      let callIdx = 0;
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => {
              callIdx++;
              if (callIdx === 1) return { limit: () => [mockMember] };
              if (callIdx === 2) return mockRoles;
              return mockLinks;
            }),
          }),
        }),
      };

      const ctx = await resolveMemberContext(mockDb as any, "mem_ctx_01");

      expect(ctx.member.id).toBe("mem_ctx_01");
      expect(ctx.roles.length).toBe(2);
      expect(ctx.identityLinks.length).toBe(1);
      expect(ctx.capabilities).toContain("tournament:create");

      // Global organizer capability
      expect(ctx.hasCapability("tournament:manage")).toBe(true);

      // Scoped scorer capability
      expect(ctx.hasCapability("scoring:live", { tournamentId: 100 })).toBe(true);
      expect(ctx.hasCapability("scoring:live", { tournamentId: 200 })).toBe(false);
    });
  });

  describe("5. Dual-Auth & Legacy Coexistence Integrity", () => {
    it("preserves legacy auth tables unmodified", () => {
      expect(getTableName(organizersTable)).toBe("organizers");
      expect(getTableName(scorerAccountsTable)).toBe("scorer_accounts");
      expect(getTableName(ownerSessionsTable)).toBe("owner_sessions");

      const orgCols = getTableColumns(organizersTable);
      expect(orgCols.passwordHash.name).toBe("password_hash");
      expect(orgCols.email.name).toBe("email");
      expect(orgCols.mobile.name).toBe("mobile");

      const scorerCols = getTableColumns(scorerAccountsTable);
      expect(scorerCols.pinHash.name).toBe("pin_hash");
      expect(scorerCols.mobile.name).toBe("mobile");

      const ownerCols = getTableColumns(ownerSessionsTable);
      expect(ownerCols.tournamentId.name).toBe("tournament_id");
      expect(ownerCols.teamId.name).toBe("team_id");
    });

    it("links legacy identities additively without mutating source records", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 101,
                memberId: "mem_legacy_01",
                sourceTable: "organizers",
                sourceRecordId: "12",
                linkType: "direct_fk",
                confidenceScore: 100,
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          }),
        }),
      };

      const link = await linkLegacyIdentityToMember(mockDb as any, {
        memberId: "mem_legacy_01",
        sourceTable: "organizers",
        sourceRecordId: "12",
        confidenceScore: 100,
        linkType: "direct_fk",
      });

      expect(link.sourceTable).toBe("organizers");
      expect(link.sourceRecordId).toBe("12");
      expect(link.memberId).toBe("mem_legacy_01");
    });
  });
});
