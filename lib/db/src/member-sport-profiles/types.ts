import type { Member } from "../schema/members";
import type { MemberSportProfile } from "../schema/member-sport-profiles";

export type SupportedSportSlug = "cricket" | "badminton" | (string & {});

export type CricketRole =
  | "player"
  | "batter"
  | "batsman"
  | "bowler"
  | "all_rounder"
  | "wicket_keeper"
  | "coach"
  | (string & {});

export type BadmintonRole =
  | "singles_player"
  | "doubles_player"
  | "mixed_doubles_player"
  | "player"
  | "coach"
  | (string & {});

export interface CreateSportProfileInput {
  memberId: string;
  sportSlug: string;
  primaryRole?: string | null;
  secondaryRole?: string | null;
  handedness?: string | null;
  federationCode?: string | null;
  profileJson?: Record<string, unknown> | null;
}

export interface UpdateSportProfileInput {
  primaryRole?: string | null;
  secondaryRole?: string | null;
  handedness?: string | null;
  federationCode?: string | null;
  profileJson?: Record<string, unknown> | null;
}

export interface ListSportProfilesFilter {
  memberId?: string;
  sportSlug?: string;
  primaryRole?: string;
  limit?: number;
  offset?: number;
}

export interface MemberSportContext {
  member: Member;
  profiles: MemberSportProfile[];
  sports: string[];
  getProfileForSport: (sportSlug: string) => MemberSportProfile | null;
}
