import type { ScoringEventEnvelope, ScoringSportSlug } from "../types";

/** Capability tokens declared by sport adapters (manifest-driven runtime). */
export type SportAdapterCapability =
  | "MatchLifecycle"
  | "EventProcessing"
  | "Replay"
  | "PublicProjection"
  | "Statistics"
  | "Standings"
  | "Leaderboards"
  | "Undo"
  | "Draw"
  | "Officials"
  | "Cards"
  | "Penalty";

export type SportManifest = {
  sportSlug: ScoringSportSlug;
  displayName: string;
  adapterVersion: string;
  capabilities: readonly SportAdapterCapability[];
};

export type ParseEventResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

export type ProcessEventOptions = {
  enforceLiveRules?: boolean;
};

/** Match row patch derived from projected sport state after replay. */
export type MatchProjectionPatch = {
  matchStatus: string;
  sessionStatus?: string;
  winnerTeamId?: number | null;
  resultSummary?: string | null;
  summaryJson?: Record<string, unknown> | null;
  setStartedAt?: boolean;
  setCompletedAt?: boolean;
  lastEventSeq?: number;
};

export type AppendValidationContext = {
  tournamentId: number;
  matchId: number;
  eventType: string;
  payload: Record<string, unknown>;
  matchStatus: string;
};

export type AppendValidationResult =
  | { ok: true }
  | { ok: false; error: string; code: string };

/**
 * Sport Adapter contract — bridge between Scoring Platform and Sport Engine.
 * Platform orchestrates; adapters own validation, replay, and sport projections.
 */
export interface SportScoringAdapter<TState = unknown, TMatchMeta = unknown> {
  readonly manifest: SportManifest;
  replay(matchMeta: TMatchMeta, events: ScoringEventEnvelope[]): TState;
  parseEvent(eventType: string, payload: Record<string, unknown>): ParseEventResult;
  /** Apply one parsed event to current state (Sport Engine reduce). */
  processEvent?(
    state: TState,
    event: ScoringEventEnvelope,
    options?: ProcessEventOptions,
  ): TState;
  /** Derive shared match/session fields from sport state after replay. */
  projectMatchFromState?(state: TState): MatchProjectionPatch;
  /** Sport-specific append guards (no DB access). */
  validateBeforeAppend?(ctx: AppendValidationContext): AppendValidationResult;
  /** Whether append API requires optimistic sequence (cricket). */
  usesExpectedSequence?: boolean;
}

/** Optional statistics capability — formulas live in adapter, platform persists. */
export interface StatisticsCapableAdapter {
  readonly manifest: SportManifest;
  calculateMatchStatistics?(matchId: number): Promise<void>;
  calculateMatchAwards?(matchId: number): Promise<void>;
  calculateTournamentLeaderboards?(tournamentId: number): Promise<void>;
  calculateTournamentStandings?(tournamentId: number): Promise<void>;
  calculateGlobalStatistics?(matchId: number): Promise<void>;
}

export function isStatisticsCapableAdapter(
  adapter: SportScoringAdapter,
): adapter is SportScoringAdapter & StatisticsCapableAdapter {
  return (
    typeof (adapter as StatisticsCapableAdapter).calculateMatchStatistics === "function" ||
    adapter.manifest.capabilities.includes("Statistics")
  );
}
