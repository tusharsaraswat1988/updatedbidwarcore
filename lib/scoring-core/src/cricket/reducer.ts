import {
  CricketEventType,
  parseCricketEventPayload,
  type CricketBallRecordedPayload,
  type CricketInningsEndedPayload,
  type CricketLineupSetPayload,
  type CricketMatchAbandonedPayload,
  type CricketMatchCompletedPayload,
  type CricketMatchInterruptedPayload,
  type CricketMatchResumedPayload,
  type CricketDlsAppliedPayload,
  type CricketMatchStartedPayload,
  type CricketPenaltyAwardedPayload,
  type CricketPlayerRetiredPayload,
  type CricketSuperBallDeclaredPayload,
  type CricketSuperOverStartedPayload,
} from "../events/cricket";
import { InvalidEventPayloadError } from "../projector/errors";
import { replayEvents } from "../projector/replay";
import { resolveEventsForReplay } from "../projector/resolve-undo";
import type { ScoringEventEnvelope } from "../types";
import {
  formatBallLabel,
  shouldSwapStrike,
  toBallDisplay,
  totalRunsOnBall,
} from "./ball";
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
    innings: [
      createInningsState(1, battingTeamId, bowlingTeamId, payload.oversLimit),
    ],
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
  if (
    batting &&
    batting.battingTeamId === payload.teamId &&
    payload.playerIds.length >= 2
  ) {
    const order = payload.battingOrder ?? payload.playerIds;
    return {
      ...next,
      strikerId: order[0] ?? null,
      nonStrikerId: order[1] ?? null,
    };
  }
  return next;
}

function isKnockoutMatchType(state: CricketScoreboardState): boolean {
  const id = state.matchTypeId ?? "";
  return /knockout|semi|final|playoff/i.test(id);
}

function superBallAdjustedPayload(
  payload: CricketBallRecordedPayload,
  onlyOneBatsmanAvailable: boolean,
  isSuperBall: boolean,
): CricketBallRecordedPayload {
  return {
    ...payload,
    isSuperBall,
    runsOffBat:
      onlyOneBatsmanAvailable && [1, 2, 3].includes(payload.runsOffBat)
        ? 0
        : payload.runsOffBat,
  };
}

function applyBallRecorded(
  state: CricketScoreboardState,
  payload: CricketBallRecordedPayload,
  enforceLiveRules = false,
): CricketScoreboardState {
  if (state.sessionStatus === "paused") {
    throw new InvalidEventPayloadError(
      CricketEventType.BALL_RECORDED,
      "match is interrupted — resume play before recording balls",
    );
  }
  if (payload.innings !== state.currentInnings) {
    throw new InvalidEventPayloadError(
      CricketEventType.BALL_RECORDED,
      `innings ${payload.innings} does not match current ${state.currentInnings}`,
    );
  }

  const currentInn = getCurrentInnings(state);
  const battingLineup = currentInn
    ? (state.lineups[currentInn.battingTeamId] ?? [])
    : [];
  const onlyOneBatsmanAvailable =
    !!currentInn &&
    battingLineup.length > 0 &&
    battingLineup.length - currentInn.wickets <= 1;

  if (!onlyOneBatsmanAvailable && payload.strikerId === payload.nonStrikerId) {
    throw new InvalidEventPayloadError(
      CricketEventType.BALL_RECORDED,
      "striker and non-striker must be different players",
    );
  }
  if (!onlyOneBatsmanAvailable && payload.nonStrikerId == null) {
    throw new InvalidEventPayloadError(
      CricketEventType.BALL_RECORDED,
      "non-striker is required unless only one batsman is available",
    );
  }

  const isSuperBall =
    !!payload.isSuperBall ||
    (!!state.superBallPending &&
      state.superBallPending.innings === payload.innings &&
      state.superBallPending.battingTeamId === currentInn?.battingTeamId);
  const effectivePayload = superBallAdjustedPayload(
    payload,
    onlyOneBatsmanAvailable,
    isSuperBall,
  );

  if (enforceLiveRules && currentInn) {
    if (currentInn.phase !== "in_progress") {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "innings is not in progress",
      );
    }
    if (currentInn.wickets >= state.maxWickets && !onlyOneBatsmanAvailable) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "innings is all out — end innings before recording more balls",
      );
    }
    if (state.target != null && currentInn.runs >= state.target) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "target already reached — end innings or complete the match",
      );
    }
    if (payload.isLegalDelivery && payload.over >= currentInn.oversLimit) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        `overs limit (${currentInn.oversLimit}) already complete`,
      );
    }
    if (state.strikerId == null && state.nonStrikerId == null) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "select openers before recording balls",
      );
    }
    if (state.strikerId == null && payload.strikerId === state.nonStrikerId) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "select a new batter before recording balls",
      );
    }
    if (
      !onlyOneBatsmanAvailable &&
      state.nonStrikerId == null &&
      payload.nonStrikerId === state.strikerId
    ) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "select a new batter before recording balls",
      );
    }
    if (state.playingXiEnforced) {
      const bowlingLineup = state.lineups[currentInn.bowlingTeamId] ?? [];
      const batterOk = battingLineup.includes(payload.strikerId);
      const nonStrikerOk =
        payload.nonStrikerId == null ||
        battingLineup.includes(payload.nonStrikerId);
      const bowlerOk = bowlingLineup.includes(payload.bowlerId);
      if (!batterOk || !nonStrikerOk || !bowlerOk) {
        throw new InvalidEventPayloadError(
          CricketEventType.BALL_RECORDED,
          "ball participants must belong to the configured Playing XI",
        );
      }
    }
    if (!state.legByeEnabled && payload.extras.type === "leg_bye") {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "leg bye is disabled by match rules",
      );
    }
    if (!state.lbwEnabled && payload.wicket?.type === "lbw") {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "LBW is disabled by match rules",
      );
    }
    if (payload.isSuperBall && !state.superBallEnabled) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "Super Ball is disabled by match rules",
      );
    }
    if (isSuperBall && payload.wicket?.type === "caught") {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        "caught is not a valid wicket on Super Ball",
      );
    }
  }

  if (enforceLiveRules && state.freeHitActive && payload.wicket) {
    const allowed = FREE_HIT_DISMISSALS.includes(payload.wicket.type);
    if (!allowed) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        `dismissal ${payload.wicket.type} not allowed on free hit`,
      );
    }
  }

  const runs = totalRunsOnBall(effectivePayload);
  let strikerId: number | null = payload.strikerId;
  let nonStrikerId: number | null = payload.nonStrikerId ?? null;
  let freeHitActive = state.freeHitActive;

  if (state.freeHitEnabled && payload.extras.type === "no_ball") {
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

  if (
    effectivePayload.nonStrikerId != null &&
    shouldSwapStrike(effectivePayload)
  ) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }
  if (
    effectivePayload.nonStrikerId != null &&
    payload.isLegalDelivery &&
    payload.ball === 6
  ) {
    [strikerId, nonStrikerId] = [nonStrikerId, strikerId];
  }

  if (payload.wicket) {
    const dismissed = payload.wicket.dismissedPlayerId;
    if (strikerId === dismissed) strikerId = null;
    if (nonStrikerId === dismissed) nonStrikerId = null;
  }

  const ballDisplay = toBallDisplay(effectivePayload);
  const thisOver = appendThisOver(next.thisOver, effectivePayload, ballDisplay);

  return {
    ...next,
    strikerId,
    nonStrikerId,
    bowlerId: payload.bowlerId,
    thisOver,
    freeHitActive,
    superBallPending: isSuperBall ? null : state.superBallPending,
  };
}

function applySuperBallDeclared(
  state: CricketScoreboardState,
  payload: CricketSuperBallDeclaredPayload,
  enforceLiveRules = false,
): CricketScoreboardState {
  const currentInn = getCurrentInnings(state);
  if (enforceLiveRules) {
    if (!state.superBallEnabled) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_BALL_DECLARED,
        "Super Ball is disabled by match rules",
      );
    }
    if (
      !currentInn ||
      currentInn.innings !== payload.innings ||
      currentInn.battingTeamId !== payload.battingTeamId
    ) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_BALL_DECLARED,
        "Super Ball must be declared for the active batting innings",
      );
    }
    if (state.superBallPending) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_BALL_DECLARED,
        "Super Ball is already pending",
      );
    }
    if (
      (state.superBallUsed[payload.innings] ?? []).includes(
        payload.battingTeamId,
      )
    ) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_BALL_DECLARED,
        "Super Ball already used in this innings",
      );
    }
    if (state.powerplayOvers.includes(currentInn.over + 1)) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_BALL_DECLARED,
        "Super Ball cannot be declared during Powerplay",
      );
    }
    const lineup = state.lineups[payload.battingTeamId] ?? [];
    if (lineup.length > 0 && lineup.length - currentInn.wickets <= 1) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_BALL_DECLARED,
        "Super Ball cannot be declared when only one batsman is available",
      );
    }
  }
  const used = { ...state.superBallUsed };
  used[payload.innings] = [
    ...(used[payload.innings] ?? []),
    payload.battingTeamId,
  ];
  return { ...state, superBallPending: payload, superBallUsed: used };
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

  if (
    next.strikerId === payload.playerId ||
    next.nonStrikerId === payload.playerId
  ) {
    return {
      ...next,
      strikerId: next.strikerId === payload.playerId ? null : next.strikerId,
      nonStrikerId:
        next.nonStrikerId === payload.playerId ? null : next.nonStrikerId,
    };
  }
  return next;
}

function applySuperOverStarted(
  state: CricketScoreboardState,
  payload: CricketSuperOverStartedPayload,
  enforceLiveRules = false,
): CricketScoreboardState {
  if (enforceLiveRules && !state.superOverEnabled) {
    throw new InvalidEventPayloadError(
      CricketEventType.SUPER_OVER_STARTED,
      "Super Over is disabled by match rules",
    );
  }
  if (enforceLiveRules && state.superOverTrigger === "knockout_tie") {
    const first = state.innings.find((i) => i.innings === 1);
    const second = state.innings.find((i) => i.innings === 2);
    if (
      !isKnockoutMatchType(state) ||
      !first ||
      !second ||
      first.runs !== second.runs
    ) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        "Super Over is only available for configured knockout ties",
      );
    }
  }
  const inn = createInningsState(
    payload.innings,
    payload.battingTeamId,
    payload.bowlingTeamId,
    payload.oversLimit ?? state.superOverOvers,
    "super_over",
  );
  return {
    ...state,
    matchStatus: "live",
    currentInnings: payload.innings,
    oversLimit: payload.oversLimit ?? state.superOverOvers,
    maxWickets: state.superOverWickets,
    innings: [...state.innings, inn],
    thisOver: [],
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    target: null,
    freeHitActive: false,
    superBallPending: null,
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
    interruptionReason: null,
    freeHitActive: false,
  };
}

function applyMatchInterrupted(
  state: CricketScoreboardState,
  payload: CricketMatchInterruptedPayload,
): CricketScoreboardState {
  return {
    ...state,
    sessionStatus: "paused",
    interruptionReason: payload.reason,
    freeHitActive: false,
  };
}

function applyMatchResumed(
  state: CricketScoreboardState,
): CricketScoreboardState {
  if (state.matchStatus !== "live") return state;
  return {
    ...state,
    sessionStatus: "live",
    interruptionReason: null,
  };
}

function applyDlsApplied(
  state: CricketScoreboardState,
  payload: CricketDlsAppliedPayload,
): CricketScoreboardState {
  const innings = state.innings.find((i) => i.innings === payload.innings);
  if (!innings) {
    throw new InvalidEventPayloadError(
      CricketEventType.DLS_APPLIED,
      `innings ${payload.innings} not found`,
    );
  }

  let next: CricketScoreboardState = {
    ...state,
    target: payload.target,
    revisedOversLimit: payload.revisedOvers,
    oversLimit: payload.innings <= 2 ? payload.revisedOvers : state.oversLimit,
    sessionStatus: state.matchStatus === "live" ? "live" : state.sessionStatus,
    interruptionReason: null,
  };

  next = updateInnings(next, payload.innings, (inn) => ({
    ...inn,
    oversLimit: payload.revisedOvers,
  }));

  return next;
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

export type ReduceCricketOptions = {
  /** Reject balls that break live scoring rules (e.g. caught on free hit). Off during event replay. */
  enforceLiveRules?: boolean;
};

export function reduceCricket(
  state: CricketScoreboardState,
  event: ScoringEventEnvelope,
  options?: ReduceCricketOptions,
): CricketScoreboardState {
  const parsed = parseCricketEventPayload(event.eventType, event.payload);
  if (!parsed.ok) {
    throw new InvalidEventPayloadError(event.eventType, parsed.error);
  }

  const enforceLiveRules = options?.enforceLiveRules ?? false;

  let next: CricketScoreboardState;

  switch (parsed.eventType) {
    case CricketEventType.MATCH_STARTED:
      next = applyMatchStarted(
        state,
        parsed.payload as CricketMatchStartedPayload,
      );
      break;
    case CricketEventType.LINEUP_SET:
      next = applyLineupSet(state, parsed.payload as CricketLineupSetPayload);
      break;
    case CricketEventType.BALL_RECORDED:
      next = applyBallRecorded(
        state,
        parsed.payload as CricketBallRecordedPayload,
        enforceLiveRules,
      );
      break;
    case CricketEventType.PENALTY_AWARDED:
      next = applyPenaltyAwarded(
        state,
        parsed.payload as CricketPenaltyAwardedPayload,
      );
      break;
    case CricketEventType.PLAYER_RETIRED:
      next = applyPlayerRetired(
        state,
        parsed.payload as CricketPlayerRetiredPayload,
      );
      break;
    case CricketEventType.SUPER_BALL_DECLARED:
      next = applySuperBallDeclared(
        state,
        parsed.payload as CricketSuperBallDeclaredPayload,
        enforceLiveRules,
      );
      break;
    case CricketEventType.SUPER_OVER_STARTED:
      next = applySuperOverStarted(
        state,
        parsed.payload as CricketSuperOverStartedPayload,
        enforceLiveRules,
      );
      break;
    case CricketEventType.INNINGS_ENDED:
      next = applyInningsEnded(
        state,
        parsed.payload as CricketInningsEndedPayload,
      );
      break;
    case CricketEventType.MATCH_COMPLETED:
      next = applyMatchCompleted(
        state,
        parsed.payload as CricketMatchCompletedPayload,
      );
      break;
    case CricketEventType.MATCH_ABANDONED:
      next = applyMatchAbandoned(
        state,
        parsed.payload as CricketMatchAbandonedPayload,
      );
      break;
    case CricketEventType.MATCH_INTERRUPTED:
      next = applyMatchInterrupted(
        state,
        parsed.payload as CricketMatchInterruptedPayload,
      );
      break;
    case CricketEventType.MATCH_RESUMED:
      next = applyMatchResumed(state);
      break;
    case CricketEventType.DLS_APPLIED:
      next = applyDlsApplied(state, parsed.payload as CricketDlsAppliedPayload);
      break;
    case CricketEventType.BALL_UNDONE:
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_UNDONE,
        "undo markers are resolved before replay",
      );
    default:
      throw new InvalidEventPayloadError(
        event.eventType,
        "unsupported event type",
      );
  }

  return { ...next, lastSequence: event.sequence };
}

export function replayCricketEvents(
  meta: Parameters<typeof createInitialCricketState>[0],
  events: ScoringEventEnvelope[],
): CricketScoreboardState {
  const effective = resolveEventsForReplay(events);
  return replayEvents(
    createInitialCricketState(meta),
    effective,
    reduceCricket,
    {
      requireContiguousSequence: false,
    },
  );
}

export { formatBallLabel };
