import {
  parseBadmintonEventPayload,
  replayBadmintonEvents,
  reduceBadminton,
  type BadmintonEventEnvelope,
  type BadmintonMatchMeta,
  type BadmintonMatchState,
} from "@workspace/badminton-core";
import {
  scoringAdapterRegistry,
  type SportManifest,
  type SportScoringAdapter,
} from "@workspace/scoring-core";

const BADMINTON_MANIFEST: SportManifest = {
  sportSlug: "badminton",
  displayName: "Badminton",
  adapterVersion: "1.0.0",
  capabilities: [
    "MatchLifecycle",
    "EventProcessing",
    "Replay",
    "PublicProjection",
    "Statistics",
    "Undo",
  ],
};

function isTerminalBadmintonStatus(status: string): boolean {
  return (
    status === "completed" ||
    status === "walkover" ||
    status === "retired" ||
    status === "disqualified" ||
    status === "abandoned"
  );
}

export const badmintonScoringAdapter: SportScoringAdapter<
  BadmintonMatchState,
  BadmintonMatchMeta
> = {
  manifest: BADMINTON_MANIFEST,
  usesExpectedSequence: false,
  replay(matchMeta, events) {
    return replayBadmintonEvents(matchMeta, events as BadmintonEventEnvelope[]);
  },
  parseEvent(eventType, payload) {
    const parsed = parseBadmintonEventPayload(eventType, payload);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    const normalized =
      typeof parsed.payload === "object" && parsed.payload !== null
        ? (parsed.payload as Record<string, unknown>)
        : { value: parsed.payload };
    return { ok: true, payload: normalized };
  },
  processEvent(state, event) {
    return reduceBadminton(state, event as BadmintonEventEnvelope);
  },
  projectMatchFromState(state) {
    const terminal = isTerminalBadmintonStatus(state.matchStatus);
    return {
      matchStatus: terminal ? "completed" : state.matchStatus === "live" ? "live" : state.matchStatus,
      resultSummary: state.resultReason ?? (terminal ? "completed" : null),
      winnerTeamId: null,
      setStartedAt: state.matchStatus === "live",
      setCompletedAt: terminal,
    };
  },
};

export function registerBadmintonScoringAdapter(): void {
  if (scoringAdapterRegistry.has("badminton")) {
    return;
  }
  scoringAdapterRegistry.register(badmintonScoringAdapter);
}
