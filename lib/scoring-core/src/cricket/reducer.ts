import {
  CricketEventType,
  parseCricketEventPayload,
  type CricketBallRecordedPayload,
  type CricketInningsEndedPayload,
  type CricketLineupSetPayload,
  type CricketMatchAbandonedPayload,
  type CricketMatchCompletedPayload,
  type CricketMatchStartedPayload,
  type CricketPenaltyAwardedPayload,
  type CricketPlayerRetiredPayload,
  type CricketSuperOverStartedPayload,
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
import { FREE_HIT_DISMISSALS } from "./types";

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
  oversLimit: number,
  kind: CricketInningsState["kind"] = "normal",
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
    kind,
    oversLimit,
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
    innings: [createInningsState(1, battingTeamId, bowlingTeamId, payload.oversLimit)],
    thisOver: [],
    powerplayOvers: payload.powerplayOvers ?? [],
    freeHitActive: false,
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

  if (state.freeHitActive && payload.wicket) {
    const allowed = FREE_HIT_DISMISSALS.includes(payload.wicket.type);
    if (!allowed) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        `dismissal ${payload.wicket.type} not allowed on free hit`,
      );
    }
  }

  const runs = totalRunsOnBall(payload);
  let strikerId = payload.strikerId;
  let nonStrikerId = payload.nonStrikerId;
  let freeHitActive = state.freeHitActive;

  if (payload.extras.type === "no_ball") {
    freeHitActive = true;
  } else if (payload.isLegalDelivery) {
    freeHitActive = false;
  }

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
    freeHitActive,
  };
}

function applyPenaltyAwarded(
  state: CricketScoreboardState,
  payload: CricketPenaltyAwardedPayload,
): CricketScoreboardState {
  return updateInnings(state, payload.innings, (inn) => ({
    ...inn,
    runs: inn.runs + payload.runs,
  }));
}

function applyPlayerRetired(
  state: CricketScoreboardState,
  payload: CricketPlayerRetiredPayload,
): CricketScoreboardState {
  let next = state;
  if (payload.type === "out") {
    next = updateInnings(state, payload.innings, (inn) => ({
      ...inn,
      wickets: inn.wickets + 1,
    }));
  } else {
    const hurt = { ...next.retiredHurt };
    const list = hurt[payload.teamId] ?? [];
    if (!list.includes(payload.playerId)) {
      hurt[payload.teamId] = [...list, payload.playerId];
    }
    next = { ...next, retiredHurt: hurt };
  }

  if (next.strikerId === payload.playerId || next.nonStrikerId === payload.playerId) {
    return {
      ...next,
      strikerId: next.strikerId === payload.playerId ? null : next.strikerId,
      nonStrikerId: next.nonStrikerId === payload.playerId ? null : next.nonStrikerId,
    };
  }
  return next;
}

function applySuperOverStarted(
  state: CricketScoreboardState,
  payload: CricketSuperOverStartedPayload,
): CricketScoreboardState {
  const inn = createInningsState(
    payload.innings,
    payload.battingTeamId,
    payload.bowlingTeamId,
    payload.oversLimit,
    "super_over",
  );
  return {
    ...state,
    matchStatus: "live",
    currentInnings: payload.innings,
    oversLimit: payload.oversLimit,
    maxWickets: 2,
    innings: [...state.innings, inn],
    thisOver: [],
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    target: null,
    freeHitActive: false,
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

  if (payload.reason === "super_over_required") {
    return { ...next, thisOver: [], freeHitActive: false };
  }

  if (payload.innings === 1) {
    const first = next.innings.find((i) => i.innings === 1);
    if (!first) return next;
    const second = createInningsState(
      2,
      first.bowlingTeamId,
      first.battingTeamId,
      state.oversLimit,
    );
    return {
      ...next,
      currentInnings: 2,
      target: payload.runs + 1,
      innings: [...next.innings, second],
      thisOver: [],
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
      freeHitActive: false,
    };
  }

  return { ...next, thisOver: [], freeHitActive: false };
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
    freeHitActive: false,
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
    freeHitActive: false,
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
    case CricketEventType.PENALTY_AWARDED:
      next = applyPenaltyAwarded(state, parsed.payload as CricketPenaltyAwardedPayload);
      break;
    case CricketEventType.PLAYER_RETIRED:
      next = applyPlayerRetired(state, parsed.payload as CricketPlayerRetiredPayload);
      break;
    case CricketEventType.SUPER_OVER_STARTED:
      next = applySuperOverStarted(state, parsed.payload as CricketSuperOverStartedPayload);
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
