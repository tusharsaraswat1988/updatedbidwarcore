import type { Member } from "../schema/members";
import type { Tournament } from "../schema/tournaments";
import type { TournamentParticipation } from "../schema/tournament-participations";
import type { MemberRole } from "../schema/member-roles";

export type ParticipationRole =
  | "organizer"
  | "player"
  | "scorer"
  | "umpire"
  | "referee"
  | "match_official"
  | "official"
  | "coach"
  | "team_manager"
  | "team_owner"
  | "owner"
  | "fan"
  | "live_streamer"
  | "associate"
  | "mentor"
  | (string & {});

export type ParticipationStatus =
  | "active"
  | "invited"
  | "pending"
  | "suspended"
  | "withdrawn"
  | "disqualified"
  | "completed"
  | "removed"
  | (string & {});

export interface CreateParticipationInput {
  tournamentId: number;
  memberId: string;
  role: string;
  status?: string;
  teamId?: number | null;
  categoryId?: number | null;
  displayNameOverride?: string | null;
  initials?: string | null;
  jerseyNumber?: string | null;
  metadataJson?: Record<string, unknown> | null;
}

export interface UpdateParticipationInput {
  status?: string;
  teamId?: number | null;
  categoryId?: number | null;
  displayNameOverride?: string | null;
  initials?: string | null;
  jerseyNumber?: string | null;
  metadataJson?: Record<string, unknown> | null;
}

export interface ListParticipationsFilter {
  tournamentId?: number;
  memberId?: string;
  role?: string;
  status?: string | string[];
  teamId?: number;
  categoryId?: number;
  limit?: number;
  offset?: number;
}

export interface MemberTournamentContext {
  member: Member;
  tournament: Tournament;
  participations: TournamentParticipation[];
  activeRoles: string[];
  activeTeamId?: number | null;
  capabilities: string[];
  hasCapability: (
    capability: string,
    subContext?: { teamId?: number; matchId?: number },
  ) => boolean;
}
