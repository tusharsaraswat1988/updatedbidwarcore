import {
  CricketEventType,
  parseCricketEventPayload,
  type CricketBallRecordedPayload,
  type CricketInningsEndedPayload,
  type CricketLineupSetPayload,
  type CricketMatchAbandonedPayload,
  type CricketMatchCompletedPayload,
  type CricketMatchStartedPayload,
} from "../events/cricket";
import { InvalidEventPayloadError } from "../projector/errors";
import { replayEvents } from "../projector/replay";
import { resolveEventsForReplay } from "../projector/resolve-undo";
import type { ScoringEventEnvelope } from "../types";
import { formatBallLabel, shouldSwapStrike, toBallDisplay, totalRunsOnBall } from "./ball";
import {
  createInitialCricketState,
  getCurrentInnings,
  type BallDisplayOutcome,
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

function updateInnings(
  state: CricketScoreboardState,
  inningsNumber: number,
  updater: (inn: CricketInningsState) => CricketInningsState,
): CricketScoreboardState {
  return {
    ...state,
    innings: state.innings.map((inn) =>
      inn.innings === inningsNumber ? updater(inn) : inn,
    ),
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
    thisOver: [],
  };
}

function applyLineupSet(
  state: CricketScoreboardState,
  payload: CricketLineupSetPayload,
): CricketScoreboardState {
  const next = {
    ...state,
    lineups: {
      ...state.lineups,
      [payload.teamId]: payload.playerIds,
    },
  };
  const batting = getCurrentInnings(next);
  if (batting && batting.battingTeamId === payload.teamId && payload.playerIds.length >= 2) {
    const order = payload.battingOrder ?? payload.playerIds;
    return {
      ...next,
      strikerId: order[0] ?? null,
      nonStrikerId: order[1] ?? null,
    };
  }
  return next;
}

function applyBallRecorded(
  state: CricketScoreboardState,
  payload: CricketBallRecordedPayload,
): CricketScoreboardState {
  if (payload.innings !== state.currentInnings) {
    throw new InvalidEventPayloadError(
      CricketEventType.BALL_RECORDED,
      `innings ${payload.innings} does not match current ${state.currentInnings}`,
    );
  }

  const runs = totalRunsOnBall(payload);
  let strikerId = payload.strikerId;
  let nonStrikerId = payload.nonStrikerId;

  let next = updateInnings(state, payload.innings, (inn) => {
    const updated: CricketInningsState = {
      ...inn,
      runs: inn.runs + runs,
      wickets: payload.wicket ? inn.wickets + 1 : inn.wickets,
    };
    if (payload.isLegalDelivery) {
      updated.over = payload.over;
      updated.ball = payload.ball;
    }
    return updated;
  });

  if (shouldSwapStrike(payload)) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }
  if (payload.isLegalDelivery && payload.ball === 6) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  const ballDisplay = toBallDisplay(payload);
  const thisOver = appendThisOver(next.thisOver, payload, ballDisplay);

  return {
    ...next,
    strikerId,
    nonStrikerId,
    bowlerId: payload.bowlerId,
    thisOver,
  };
}

function applyInningsEnded(
  state: CricketScoreboardState,
  payload: CricketInningsEndedPayload,
): CricketScoreboardState {
  let next = updateInnings(state, payload.innings, (inn) => ({
    ...inn,
    runs: payload.runs,
    wickets: payload.wickets,
    phase: "completed" as const,
  }));

  if (payload.innings === 1) {
    const first = next.innings.find((i) => i.innings === 1);
    if (!first) return next;
    const second = createInningsState(2, first.bowlingTeamId, first.battingTeamId);
    return {
      ...next,
      currentInnings: 2,
      target: payload.runs + 1,
      innings: [...next.innings, second],
      thisOver: [],
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
    };
  }

  return { ...next, thisOver: [] };
}

function applyMatchCompleted(
  state: CricketScoreboardState,
  payload: CricketMatchCompletedPayload,
): CricketScoreboardState {
  return {
    ...state,
    matchStatus: "completed",
    sessionStatus: "idle",
    winnerTeamId: payload.winnerTeamId,
    resultText: payload.resultText,
  };
}

function applyMatchAbandoned(
  state: CricketScoreboardState,
  payload: CricketMatchAbandonedPayload,
): CricketScoreboardState {
  return {
    ...state,
    matchStatus: "abandoned",
    sessionStatus: "idle",
    abandonedReason: payload.reason,
  };
}

function appendThisOver(
  current: BallDisplayOutcome[],
  payload: CricketBallRecordedPayload,
  display: ReturnType<typeof toBallDisplay>,
): BallDisplayOutcome[] {
  if (payload.isLegalDelivery && payload.ball === 1) {
    return [display];
  }
  const activeOver = current[0]?.over;
  if (activeOver !== undefined && payload.over === activeOver) {
    return [...current, display];
  }
  return current.length > 0 ? [...current, display] : [display];
}

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
      next = applyBallRecorded(state, parsed.payload as CricketBallRecordedPayload);
      break;
    case CricketEventType.INNINGS_ENDED:
      next = applyInningsEnded(state, parsed.payload as CricketInningsEndedPayload);
      break;
    case CricketEventType.MATCH_COMPLETED:
      next = applyMatchCompleted(state, parsed.payload as CricketMatchCompletedPayload);
      break;
    case CricketEventType.MATCH_ABANDONED:
      next = applyMatchAbandoned(state, parsed.payload as CricketMatchAbandonedPayload);
      break;
    case CricketEventType.BALL_UNDONE:
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_UNDONE,
        "undo markers are resolved before replay",
      );
    default:
      throw new InvalidEventPayloadError(event.eventType, "unsupported event type");
  }

  return { ...next, lastSequence: event.sequence };
}

export function replayCricketEvents(
  meta: Parameters<typeof createInitialCricketState>[0],
  events: ScoringEventEnvelope[],
): CricketScoreboardState {
  const effective = resolveEventsForReplay(events);
  return replayEvents(createInitialCricketState(meta), effective, reduceCricket, {
    requireContiguousSequence: false,
  });
}

export { formatBallLabel };
