import type { Member } from "../schema/members";
import type { TournamentParticipation } from "../schema/tournament-participations";
import type { MemberSportProfile } from "../schema/member-sport-profiles";

export type IdentitySource =
  | "canonical_member"
  | "legacy_organizer"
  | "legacy_scorer"
  | "legacy_owner"
  | "legacy_player"
  | "legacy_badminton_player"
  | "legacy_official"
  | "anonymous";

export type CanonicalResolutionStatus =
  | "native"
  | "resolved"
  | "unresolved"
  | "review_required"
  | "anonymous";

export interface LegacyIdentityContext {
  type: "organizer" | "scorer" | "owner" | "player" | "badminton_player" | "official" | "none";
  id?: number | string | null;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  tournamentId?: number | null;
  teamId?: number | null;
}

export interface RuntimeContextParams {
  tournamentId?: number;
  teamId?: number;
  matchId?: number;
}

export interface RuntimeAuthInput {
  canonicalSessionId?: string;
  organizerAccountId?: number;
  scorerId?: number;
  ownerTournamentId?: number;
  ownerTeamId?: number;
  playerId?: number;
  badmintonPlayerId?: number;
  globalPlayerId?: string;
  officialId?: number;
  isAdmin?: boolean;
  adminLevel?: "master" | "data_entry";
  organizerTournaments?: Record<string, true>;
}

export interface MemberRuntimeContext {
  identitySource: IdentitySource;
  canonicalResolutionStatus: CanonicalResolutionStatus;
  isCanonical: boolean;
  member: Member | null;
  memberId: string | null;
  legacyIdentity: LegacyIdentityContext | null;
  globalRoles: string[];
  tournamentParticipations: TournamentParticipation[];
  sportProfiles: MemberSportProfile[];
  capabilities: string[];
  tournamentId: number | null;
  teamId: number | null;
  matchId: number | null;
  hasCapability: (
    capability: string,
    subContext?: { teamId?: number; matchId?: number },
  ) => boolean;
  diagnostics: {
    resolutionTimeMs: number;
    linkId?: number | null;
    sourceTable?: string;
  };
}
