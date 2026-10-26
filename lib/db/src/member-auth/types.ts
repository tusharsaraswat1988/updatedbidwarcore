import type { Member } from "../schema/members";
import type { MemberRole } from "../schema/member-roles";
import type { MemberAuthIdentity } from "../schema/member-auth-identities";
import type { MemberSession } from "../schema/member-sessions";
import type { MemberIdentityLink } from "../schema/member-identity-links";

export type MemberAuthProvider = "password" | "google" | "phone_otp" | "apple";

export interface RegisterMemberPasswordInput {
  memberId: string;
  emailOrMobile: string;
  password: string;
  isVerified?: boolean;
}

export interface AuthenticateMemberPasswordInput {
  emailOrMobile: string;
  password: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionTtlSeconds?: number;
}

export interface AuthenticateMemberGoogleInput {
  googleSubject: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionTtlSeconds?: number;
}

export interface CreateMemberSessionInput {
  memberId: string;
  authIdentityId?: number;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  ttlSeconds?: number;
}

export interface MemberAuthResult {
  member: Member;
  session: MemberSession;
  authIdentity: MemberAuthIdentity;
}

export interface MemberCapabilityContext {
  tournamentId?: number;
  teamId?: number;
  matchId?: number;
}

export interface MemberContext {
  member: Member;
  session?: MemberSession;
  roles: MemberRole[];
  capabilities: string[];
  identityLinks: MemberIdentityLink[];
  hasCapability: (capability: string, context?: MemberCapabilityContext) => boolean;
}
