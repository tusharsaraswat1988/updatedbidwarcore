import { mapScoringMatchToIdentity } from "../match/bridges.ts";
import type { MatchIdentity, MatchLifecycleStatusId } from "../match/types.ts";
import { resolveExecutionPhase } from "./phase.ts";
import type {
  ExecutionPhaseId,
  ExecutionPhaseState,
  RuntimeMatchListItem,
} from "./types.ts";

/** Minimal runtime columns for Runtime Match bridges — never returned raw from product APIs. */
export type ScoringMatchRuntimeBridgeRow = {
  id: number;
  tournamentId: number;
  matchTypeId?: string | null;
  lifecycleStatus?: string | null;
  executionPhase?: string | null;
  currentRuntimeVersion?: number | null;
  fixtureId?: number | null;
  sportSlug?: string | null;
};

/** BadmintonRuntimeBridge / CricketRuntimeBridge → Match Identity (same EPIC-05 identity). */
export function mapRowToRuntimeIdentity(row: ScoringMatchRuntimeBridgeRow): MatchIdentity {
  return mapScoringMatchToIdentity(row);
}

export function mapRowToExecutionPhaseState(
  row: ScoringMatchRuntimeBridgeRow,
): ExecutionPhaseState {
  return {
    matchId: String(row.id),
    tournamentId: row.tournamentId,
    phase: resolveExecutionPhase(row.executionPhase),
    currentRuntimeVersion: row.currentRuntimeVersion ?? null,
  };
}

export function mapRowToRuntimeListItem(row: ScoringMatchRuntimeBridgeRow): RuntimeMatchListItem {
  return {
    identity: mapRowToRuntimeIdentity(row),
    executionPhase: resolveExecutionPhase(row.executionPhase) as ExecutionPhaseId,
    currentRuntimeVersion: row.currentRuntimeVersion ?? null,
    matchLifecycleStatus: (row.lifecycleStatus ?? "draft") as MatchLifecycleStatusId,
  };
}

export function runtimeSourceFromSportSlug(
  sportSlug: string | null | undefined,
): "badminton" | "cricket" {
  return sportSlug === "badminton" ? "badminton" : "cricket";
}
