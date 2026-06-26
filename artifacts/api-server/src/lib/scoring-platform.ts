import {
  scoringAdapterRegistry,
  type ScoringEventEnvelope,
  type ScoringSportSlug,
} from "@workspace/scoring-core";

export function listRegisteredScoringAdapters() {
  return scoringAdapterRegistry.listManifests();
}

export function parseScoringEvent(
  sportSlug: ScoringSportSlug,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return scoringAdapterRegistry.get(sportSlug).parseEvent(eventType, payload);
}

export function replayScoringMatchState<TState = unknown>(
  sportSlug: ScoringSportSlug,
  matchMeta: unknown,
  events: ScoringEventEnvelope[],
): TState {
  return scoringAdapterRegistry.get(sportSlug).replay(matchMeta, events) as TState;
}

export function hasScoringAdapter(sportSlug: ScoringSportSlug): boolean {
  return scoringAdapterRegistry.has(sportSlug);
}
