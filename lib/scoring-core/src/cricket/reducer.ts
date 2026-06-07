import {
  CricketEventType,
  parseCricketEventPayload,
  type CricketLineupSetPayload,
  type CricketMatchStartedPayload,
} from "../events/cricket";
import { InvalidEventPayloadError, ReducerNotImplementedError } from "../projector/errors";
import { replayEvents } from "../projector/replay";
import type { ScoringEventEnvelope } from "../types";
import {
  createInitialCricketState,
  type CricketInningsState,
  type CricketScoreboardState,
} from "./state";

function battingBowlingTeamIds(
  state: CricketScoreboardState,
  electedTo: "bat" | "bowl",
  tossWinnerTeamId: number,
): { battingTeamId: number; bowlingTeamId: number } {
  const otherTeamId =
    tossWinnerTeamId === state.homeTeamId ? state.awayTeamId : state.homeTeamId;
  const battingTeamId = electedTo === "bat" ? tossWinnerTeamId : otherTeamId;
  const bowlingTeamId = electedTo === "bat" ? otherTeamId : tossWinnerTeamId;
  return { battingTeamId, bowlingTeamId };
}

function createInningsState(
  innings: number,
  battingTeamId: number,
  bowlingTeamId: number,
): CricketInningsState {
  return {
    innings,
    battingTeamId,
    bowlingTeamId,
    runs: 0,
    wickets: 0,
    over: 0,
    ball: 0,
    phase: "in_progress",
  };
}

function applyMatchStarted(
  state: CricketScoreboardState,
  payload: CricketMatchStartedPayload,
): CricketScoreboardState {
  const { battingTeamId, bowlingTeamId } = battingBowlingTeamIds(
    state,
    payload.electedTo,
    payload.tossWinnerTeamId,
  );
  return {
    ...state,
    matchStatus: "live",
    sessionStatus: "live",
    oversLimit: payload.oversLimit,
    tossWinnerTeamId: payload.tossWinnerTeamId,
    electedTo: payload.electedTo,
    currentInnings: 1,
    innings: [createInningsState(1, battingTeamId, bowlingTeamId)],
  };
}

function applyLineupSet(
  state: CricketScoreboardState,
  payload: CricketLineupSetPayload,
): CricketScoreboardState {
  return {
    ...state,
    lineups: {
      ...state.lineups,
      [payload.teamId]: payload.playerIds,
    },
  };
}

/**
 * Cricket reducer foundation (PR-1).
 * PR-2 implements ball, innings end, complete, undo, and abandoned handlers.
 */
export function reduceCricket(
  state: CricketScoreboardState,
  event: ScoringEventEnvelope,
): CricketScoreboardState {
  const parsed = parseCricketEventPayload(event.eventType, event.payload);
  if (!parsed.ok) {
    throw new InvalidEventPayloadError(event.eventType, parsed.error);
  }

  let next: CricketScoreboardState;

  switch (parsed.eventType) {
    case CricketEventType.MATCH_STARTED:
      next = applyMatchStarted(state, parsed.payload as CricketMatchStartedPayload);
      break;
    case CricketEventType.LINEUP_SET:
      next = applyLineupSet(state, parsed.payload as CricketLineupSetPayload);
      break;
    case CricketEventType.BALL_RECORDED:
    case CricketEventType.INNINGS_ENDED:
    case CricketEventType.MATCH_COMPLETED:
    case CricketEventType.BALL_UNDONE:
    case CricketEventType.MATCH_ABANDONED:
      throw new ReducerNotImplementedError(parsed.eventType);
    default:
      throw new ReducerNotImplementedError(event.eventType);
  }

  return { ...next, lastSequence: event.sequence };
}

export function replayCricketEvents(
  meta: Parameters<typeof createInitialCricketState>[0],
  events: ScoringEventEnvelope[],
): CricketScoreboardState {
  return replayEvents(createInitialCricketState(meta), events, reduceCricket);
}
