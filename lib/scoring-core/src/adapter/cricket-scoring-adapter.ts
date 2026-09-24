import { replayCricketEvents, reduceCricket, buildCricketMatchSummary } from "../cricket";
import { CricketEventType, parseCricketEventPayload } from "../events/cricket";
import { InvalidEventPayloadError } from "../projector/errors";
import type { CricketScoreboardState } from "../cricket/state";
import type { MatchMeta, ScoringEventEnvelope } from "../types";
import type { AppendValidationContext, SportManifest, SportScoringAdapter } from "./contract";
import { scoringAdapterRegistry } from "./registry";

const CRICKET_MANIFEST: SportManifest = {
  sportSlug: "cricket",
  displayName: "Cricket",
  adapterVersion: "1.0.0",
  capabilities: [
    "MatchLifecycle",
    "EventProcessing",
    "Replay",
    "PublicProjection",
    "Statistics",
    "Standings",
    "Leaderboards",
    "Undo",
  ],
};

export const cricketScoringAdapter: SportScoringAdapter<
  CricketScoreboardState,
  MatchMeta
> = {
  manifest: CRICKET_MANIFEST,
  usesExpectedSequence: true,
  replay(matchMeta, events) {
    return replayCricketEvents(matchMeta, events);
  },
  parseEvent(eventType, payload) {
    const parsed = parseCricketEventPayload(eventType, payload);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    return { ok: true, payload: parsed.payload };
  },
  processEvent(state, event, options) {
    try {
      return reduceCricket(state, event, options);
    } catch (err) {
      if (err instanceof InvalidEventPayloadError) {
        throw err;
      }
      throw err;
    }
  },
  projectMatchFromState(state) {
    const terminal =
      state.matchStatus === "completed" ||
      state.matchStatus === "abandoned" ||
      state.matchStatus === "walkover";
    return {
      matchStatus: state.matchStatus,
      sessionStatus: state.sessionStatus,
      winnerTeamId: state.winnerTeamId,
      resultSummary: state.resultText,
      summaryJson: terminal ? (buildCricketMatchSummary(state) as Record<string, unknown>) : null,
      setStartedAt: state.matchStatus === "live",
      setCompletedAt: terminal,
      lastEventSeq: state.lastSequence,
    };
  },
  validateBeforeAppend(ctx: AppendValidationContext) {
    if (ctx.eventType === CricketEventType.WALKOVER_AWARDED) {
      if (
        ctx.matchStatus === "completed" ||
        ctx.matchStatus === "abandoned" ||
        ctx.matchStatus === "walkover" ||
        ctx.matchStatus === "cancelled"
      ) {
        return {
          ok: false,
          error: `Cannot award walkover: match is already terminal (status: ${ctx.matchStatus})`,
          code: "MATCH_ALREADY_TERMINAL",
        };
      }
      return { ok: true };
    }
    if (ctx.eventType === CricketEventType.MATCH_STARTED) {
      if (ctx.matchStatus !== "scheduled") {
        return {
          ok: false,
          error: `Cannot start match: current status is '${ctx.matchStatus}'`,
          code: "MATCH_ALREADY_STARTED",
        };
      }
      return { ok: true };
    }
    if (ctx.eventType === CricketEventType.MATCH_COMPLETED) {
      if (ctx.matchStatus !== "live") {
        return {
          ok: false,
          error: `Cannot complete match: current status is '${ctx.matchStatus}'`,
          code: "MATCH_NOT_LIVE",
        };
      }
      return { ok: true };
    }
    if (
      ctx.matchStatus === "completed" ||
      ctx.matchStatus === "abandoned" ||
      ctx.matchStatus === "walkover" ||
      ctx.matchStatus === "cancelled"
    ) {
      return { ok: false, error: "Match is no longer live", code: "MATCH_CLOSED" };
    }
    return { ok: true };
  },
};

scoringAdapterRegistry.register(cricketScoringAdapter);
