import { eq, and, gt, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { membersTable, type Member } from "../schema/members";
import { generateMemberId } from "../schema/members";
import {
  memberAuthIdentitiesTable,
  type MemberAuthIdentity,
} from "../schema/member-auth-identities";
import {
  memberSessionsTable,
  generateMemberSessionId,
  type MemberSession,
} from "../schema/member-sessions";
import { memberRolesTable, type MemberRole } from "../schema/member-roles";
import {
  memberIdentityLinksTable,
  type MemberIdentityLink,
} from "../schema/member-identity-links";
import { hashMemberPassword, verifyMemberPassword } from "./crypto";
import { resolveMemberCapabilities, checkCapability } from "./capabilities";
import { normalizeEmail, normalizeMobile } from "../identity-linking/normalizer";
import type {
  RegisterMemberPasswordInput,
  AuthenticateMemberPasswordInput,
  AuthenticateMemberGoogleInput,
  CreateMemberSessionInput,
  MemberAuthResult,
  MemberContext,
  MemberCapabilityContext,
} from "./types";

export class MemberAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "MemberAuthError";
  }
}

/** Default session TTL: 30 days */
export const DEFAULT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    return normalizeEmail(trimmed);
  }
  return normalizeMobile(trimmed);
}

/**
 * Register password authentication for an existing Member identity.
 */
export async function registerMemberPasswordAuth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: RegisterMemberPasswordInput,
): Promise<MemberAuthIdentity> {
  const normalized = normalizeIdentifier(input.emailOrMobile);
  if (!normalized) {
    throw new MemberAuthError("Invalid email or mobile identifier", "INVALID_IDENTIFIER", 400);
  }

  if (!input.password || input.password.length < 6) {
    throw new MemberAuthError("Password must be at least 6 characters", "INVALID_PASSWORD", 400);
  }

  // Check if member exists
  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, input.memberId))
    .limit(1);

  if (!member) {
    throw new MemberAuthError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  // Check if identifier is already registered for password auth
  const [existing] = await database
    .select()
    .from(memberAuthIdentitiesTable)
    .where(
      and(
        eq(memberAuthIdentitiesTable.provider, "password"),
        eq(memberAuthIdentitiesTable.normalizedIdentifier, normalized),
      ),
    )
    .limit(1);

  if (existing) {
    throw new MemberAuthError("Account with this identifier already exists", "IDENTIFIER_TAKEN", 409);
  }

  const passwordHash = await hashMemberPassword(input.password);
  const [created] = await database
    .insert(memberAuthIdentitiesTable)
    .values({
      memberId: input.memberId,
      provider: "password",
      providerSubject: normalized,
      normalizedIdentifier: normalized,
      passwordHash,
      isVerified: input.isVerified ?? false,
      isEnabled: true,
    })
    .returning();

  return created!;
}

/**
 * Authenticate a Member using password credentials and create a session.
 */
export async function authenticateMemberPassword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: AuthenticateMemberPasswordInput,
): Promise<MemberAuthResult> {
  const normalized = normalizeIdentifier(input.emailOrMobile);
  if (!normalized || !input.password) {
    throw new MemberAuthError("Invalid credentials", "INVALID_CREDENTIALS", 401);
  }

  const [authIdentity] = await database
    .select()
    .from(memberAuthIdentitiesTable)
    .where(
      and(
        eq(memberAuthIdentitiesTable.provider, "password"),
        eq(memberAuthIdentitiesTable.normalizedIdentifier, normalized),
        eq(memberAuthIdentitiesTable.isEnabled, true),
      ),
    )
    .limit(1);

  if (!authIdentity || !authIdentity.passwordHash) {
    // Avoid user enumeration
    throw new MemberAuthError("Invalid credentials", "INVALID_CREDENTIALS", 401);
  }

  const valid = await verifyMemberPassword(input.password, authIdentity.passwordHash);
  if (!valid) {
    throw new MemberAuthError("Invalid credentials", "INVALID_CREDENTIALS", 401);
  }

  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, authIdentity.memberId))
    .limit(1);

  if (!member || member.accountStatus === "suspended" || member.accountStatus === "deactivated") {
    throw new MemberAuthError("Account is inactive or suspended", "ACCOUNT_LOCKED", 403);
  }

  const session = await createMemberSession(database, {
    memberId: member.id,
    authIdentityId: authIdentity.id,
    deviceName: input.deviceName,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    ttlSeconds: input.sessionTtlSeconds,
  });

  return {
    member,
    session,
    authIdentity,
  };
}

/**
 * Authenticate or register a Member using Google OAuth.
 */
export async function authenticateMemberGoogle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: AuthenticateMemberGoogleInput,
): Promise<MemberAuthResult> {
  const normalized = normalizeEmail(input.email);
  if (!normalized || !input.googleSubject) {
    throw new MemberAuthError("Invalid Google identity payload", "INVALID_OAUTH_PAYLOAD", 400);
  }

  // 1. Look up existing Google auth identity
  const [existingGoogleAuth] = await database
    .select()
    .from(memberAuthIdentitiesTable)
    .where(
      and(
        eq(memberAuthIdentitiesTable.provider, "google"),
        eq(memberAuthIdentitiesTable.providerSubject, input.googleSubject),
      ),
    )
    .limit(1);

  let member: Member;
  let authIdentity: MemberAuthIdentity;

  if (existingGoogleAuth) {
    authIdentity = existingGoogleAuth;
    const [existingMember] = await database
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, existingGoogleAuth.memberId))
      .limit(1);

    if (!existingMember || existingMember.accountStatus === "suspended") {
      throw new MemberAuthError("Account is inactive or suspended", "ACCOUNT_LOCKED", 403);
    }
    member = existingMember;
  } else {
    // 2. Look up if a Member with matching verified email already exists
    const [existingMemberByEmail] = await database
      .select()
      .from(membersTable)
      .where(eq(membersTable.primaryEmail, normalized))
      .limit(1);

    if (existingMemberByEmail) {
      member = existingMemberByEmail;
    } else {
      // 3. Create a new canonical Member
      const newMemberId = generateMemberId();
      const [createdMember] = await database
        .insert(membersTable)
        .values({
          id: newMemberId,
          displayName: input.name?.trim() || normalized.split("@")[0] || "Member",
          primaryEmail: normalized,
          isEmailVerified: true,
          avatarUrl: input.avatarUrl || null,
          accountStatus: "active",
        })
        .returning();
      member = createdMember!;
    }

    // 4. Create Google auth identity linked to member
    const [createdAuth] = await database
      .insert(memberAuthIdentitiesTable)
      .values({
        memberId: member.id,
        provider: "google",
        providerSubject: input.googleSubject,
        normalizedIdentifier: normalized,
        isVerified: true,
        isEnabled: true,
      })
      .returning();
    authIdentity = createdAuth!;
  }

  const session = await createMemberSession(database, {
    memberId: member.id,
    authIdentityId: authIdentity.id,
    deviceName: input.deviceName,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    ttlSeconds: input.sessionTtlSeconds,
  });

  return {
    member,
    session,
    authIdentity,
  };
}

/**
 * Create a new member session.
 */
export async function createMemberSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: CreateMemberSessionInput,
): Promise<MemberSession> {
  const sessionId = generateMemberSessionId();
  const now = new Date();
  const ttlSec = input.ttlSeconds || DEFAULT_SESSION_TTL_SECONDS;
  const expiresAt = new Date(now.getTime() + ttlSec * 1000);

  const [session] = await database
    .insert(memberSessionsTable)
    .values({
      id: sessionId,
      memberId: input.memberId,
      authIdentityId: input.authIdentityId ?? null,
      deviceName: input.deviceName ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt,
      revokedAt: null,
      createdAt: now,
      lastSeenAt: now,
    })
    .returning();

  return session!;
}

/**
 * Validate a member session and update lastSeenAt.
 */
export async function validateMemberSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  sessionId: string,
): Promise<{ member: Member; session: MemberSession }> {
  const now = new Date();

  const [session] = await database
    .select()
    .from(memberSessionsTable)
    .where(
      and(
        eq(memberSessionsTable.id, sessionId),
        isNull(memberSessionsTable.revokedAt),
        gt(memberSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) {
    throw new MemberAuthError("Invalid or expired session", "SESSION_INVALID", 401);
  }

  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, session.memberId))
    .limit(1);

  if (!member || member.accountStatus === "suspended" || member.accountStatus === "deactivated") {
    throw new MemberAuthError("Account is inactive or suspended", "ACCOUNT_LOCKED", 403);
  }

  // Update last seen asynchronously or directly
  await database
    .update(memberSessionsTable)
    .set({ lastSeenAt: now })
    .where(eq(memberSessionsTable.id, sessionId));

  return { member, session };
}

/**
 * Revoke a member session (logout).
 */
export async function revokeMemberSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  sessionId: string,
): Promise<void> {
  await database
    .update(memberSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(memberSessionsTable.id, sessionId));
}

/**
 * Revoke all sessions for a member (global logout).
 */
export async function revokeAllMemberSessions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  memberId: string,
): Promise<void> {
  await database
    .update(memberSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(memberSessionsTable.memberId, memberId), isNull(memberSessionsTable.revokedAt)));
}

/**
 * Resolve full context, roles, and capabilities for a member.
 */
export async function resolveMemberContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  memberId: string,
  sessionId?: string,
  context?: MemberCapabilityContext,
): Promise<MemberContext> {
  const [member] = await database
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, memberId))
    .limit(1);

  if (!member) {
    throw new MemberAuthError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  let session: MemberSession | undefined;
  if (sessionId) {
    const validated = await validateMemberSession(database, sessionId);
    session = validated.session;
  }

  const roles = await database
    .select()
    .from(memberRolesTable)
    .where(eq(memberRolesTable.memberId, memberId));

  const identityLinks = await database
    .select()
    .from(memberIdentityLinksTable)
    .where(eq(memberIdentityLinksTable.memberId, memberId));

  const capabilities = resolveMemberCapabilities(roles, context);

  return {
    member,
    session,
    roles,
    capabilities,
    identityLinks,
    hasCapability: (cap: string, capCtx?: MemberCapabilityContext) => {
      const activeCaps = capCtx ? resolveMemberCapabilities(roles, capCtx) : capabilities;
      return checkCapability(activeCaps, cap);
    },
  };
}

/**
 * Helper to link legacy identity into member_identity_links.
 */
export async function linkLegacyIdentityToMember(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: NodePgDatabase<any>,
  input: {
    memberId: string;
    sourceTable: string;
    sourceRecordId: string;
    confidenceScore?: number;
    linkType?: string;
    provenanceJson?: Record<string, unknown>;
  },
): Promise<MemberIdentityLink> {
  const [existing] = await database
    .select()
    .from(memberIdentityLinksTable)
    .where(
      and(
        eq(memberIdentityLinksTable.sourceTable, input.sourceTable),
        eq(memberIdentityLinksTable.sourceRecordId, input.sourceRecordId),
        eq(memberIdentityLinksTable.memberId, input.memberId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await database
    .insert(memberIdentityLinksTable)
    .values({
      memberId: input.memberId,
      sourceTable: input.sourceTable,
      sourceRecordId: input.sourceRecordId,
      linkType: input.linkType || "direct_fk",
      confidenceScore: input.confidenceScore ?? 100,
      provenanceJson: input.provenanceJson ?? null,
      status: "active",
    })
    .returning();

  return created!;
}
