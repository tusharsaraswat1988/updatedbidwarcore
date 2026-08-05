import type {
  ExecutionPhaseId,
  RuntimeHistoryEntry,
  RuntimeHistoryOperation,
  RuntimeSnapshot,
  RuntimeValidationResult,
} from "./types.ts";

export function buildRuntimeHistoryEntry(args: {
  matchId: string;
  tournamentId: number;
  timestamp: string;
  actor: string | null;
  operation: RuntimeHistoryOperation;
  snapshotVersion: number | null;
  executionPhase: ExecutionPhaseId | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
}): RuntimeHistoryEntry {
  return {
    matchId: args.matchId,
    tournamentId: args.tournamentId,
    timestamp: args.timestamp,
    actor: args.actor,
    operation: args.operation,
    snapshotVersion: args.snapshotVersion,
    executionPhase: args.executionPhase,
    reason: args.reason ?? null,
    payload: args.payload ?? null,
  };
}

export function buildFreezeHistoryPayload(
  snapshot: RuntimeSnapshot,
  validation: RuntimeValidationResult,
): Record<string, unknown> {
  return {
    snapshot,
    validationSummary: {
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      infoCount: validation.infoCount,
      readiness: validation.readiness,
      issues: validation.issues,
    },
  };
}
