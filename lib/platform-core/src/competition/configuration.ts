import { DEFAULT_BUSINESS_STAGE_ID } from "../catalog/business-stages/index.ts";
import { parseRuleOverrides, type RuleOverridesDocument } from "./rule-overrides.ts";
import type {
  CompetitionConfiguration,
  ParticipantConstraints,
  SquadRules,
} from "./types.ts";

export type TournamentCompetitionColumns = {
  id: number;
  sport?: string | null;
  variantId?: string | null;
  competitionTypeId?: string | null;
  ruleProfileId?: string | null;
  ruleProfileVersion?: string | null;
  presentationProfileId?: string | null;
  presentationProfileVersion?: string | null;
  registrationModeId?: string | null;
  teamFormationStrategyId?: string | null;
  squadRulesJson?: SquadRules | Record<string, unknown> | null;
  ruleOverridesJson?: RuleOverridesDocument | Record<string, unknown> | null;
  participantConstraintsJson?: ParticipantConstraints | Record<string, unknown> | null;
  businessStageId?: string | null;
};

function asSquadRules(value: unknown): SquadRules {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return {
    minPlayers: typeof v.minPlayers === "number" ? v.minPlayers : null,
    maxPlayers: typeof v.maxPlayers === "number" ? v.maxPlayers : null,
    substitutes: typeof v.substitutes === "number" ? v.substitutes : null,
    retentions: typeof v.retentions === "number" ? v.retentions : null,
    lockedPlayers: typeof v.lockedPlayers === "number" ? v.lockedPlayers : null,
    reservePlayers: typeof v.reservePlayers === "number" ? v.reservePlayers : null,
  };
}

function asParticipantConstraints(value: unknown): ParticipantConstraints {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const kinds = Array.isArray(v.allowedKindIds)
    ? (v.allowedKindIds.filter((k) => typeof k === "string") as ParticipantConstraints["allowedKindIds"])
    : undefined;
  return {
    allowedKindIds: kinds,
    minParticipants: typeof v.minParticipants === "number" ? v.minParticipants : null,
    maxParticipants: typeof v.maxParticipants === "number" ? v.maxParticipants : null,
  };
}

/** Resolve Working Competition Configuration from tournament columns (resolve-on-read). */
export function resolveCompetitionConfiguration(
  tournament: TournamentCompetitionColumns,
  options?: { locked?: boolean; planVersion?: number | null },
): CompetitionConfiguration {
  return {
    tournamentId: tournament.id,
    sportId: tournament.sport ?? "cricket",
    variantId: tournament.variantId ?? null,
    competitionTypeId: tournament.competitionTypeId ?? null,
    ruleProfileId: tournament.ruleProfileId ?? null,
    ruleProfileVersion: tournament.ruleProfileVersion ?? null,
    presentationProfileId: tournament.presentationProfileId ?? null,
    presentationProfileVersion: tournament.presentationProfileVersion ?? null,
    registrationModeId: tournament.registrationModeId ?? null,
    teamFormationStrategyId: tournament.teamFormationStrategyId ?? null,
    squadRules: asSquadRules(tournament.squadRulesJson),
    ruleOverrides: parseRuleOverrides(tournament.ruleOverridesJson),
    participantConstraints: asParticipantConstraints(tournament.participantConstraintsJson),
    businessStageId: tournament.businessStageId ?? DEFAULT_BUSINESS_STAGE_ID,
    locked: options?.locked ?? false,
    planVersion: options?.planVersion ?? null,
  };
}
