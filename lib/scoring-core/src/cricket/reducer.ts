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
  type CricketWalkoverAwardedPayload,
} from "../events/cricket";
import { InvalidEventPayloadError } from "../projector/errors";
import { replayEvents } from "../projector/replay";
import { resolveEventsForReplay } from "../projector/resolve-undo";
import type { ScoringEventEnvelope } from "../types";
import {
  expectedNextBall,
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
import { FREE_HIT_DISMISSALS, SUPER_BALL_BLOCKED_DISMISSALS } from "./types";
import { isCricketMatchTerminalState } from "./result";

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
  if (
    state.matchStatus !== "scheduled" ||
    state.currentInnings > 0 ||
    state.innings.length > 0
  ) {
    throw new InvalidEventPayloadError(
      CricketEventType.MATCH_STARTED,
      "cannot start match: match has already started",
    );
  }
  const { battingTeamId, bowlingTeamId } = battingBowlingTeamIds(
    state,
    payload.electedTo,
    payload.tossWinnerTeamId,
  );
  const existingBattingLineup = state.lineups[battingTeamId];
  let strikerId = state.strikerId;
  let nonStrikerId = state.nonStrikerId;
  if (
    existingBattingLineup &&
    existingBattingLineup.length >= 2 &&
    strikerId == null &&
    nonStrikerId == null
  ) {
    strikerId = existingBattingLineup[0] ?? null;
    nonStrikerId = existingBattingLineup[1] ?? null;
  }
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
    strikerId,
    nonStrikerId,
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
  if (enforceLiveRules && state.matchStatus !== "live") {
    throw new InvalidEventPayloadError(
      CricketEventType.BALL_RECORDED,
      `cannot record ball: match is not live (status: ${state.matchStatus})`,
    );
  }
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
    const expected = expectedNextBall(currentInn);
    if (expected.over >= currentInn.oversLimit) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        `overs limit (${currentInn.oversLimit}) already complete`,
      );
    }
    if (payload.over !== expected.over || payload.ball !== expected.ball) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        `invalid delivery sequence: expected over ${expected.over} ball ${expected.ball}, received over ${payload.over} ball ${payload.ball}`,
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
    if (isSuperBall && payload.wicket && SUPER_BALL_BLOCKED_DISMISSALS.includes(payload.wicket.type)) {
      throw new InvalidEventPayloadError(
        CricketEventType.BALL_RECORDED,
        `${payload.wicket.type} is not a valid wicket on Super Ball`,
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
      const nextPos = expectedNextBall(inn);
      updated.over = nextPos.over;
      updated.ball = nextPos.ball;
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
    superBallPending:
      isSuperBall &&
      payload.extras.type !== "wide" &&
      payload.extras.type !== "no_ball"
        ? null
        : state.superBallPending,
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
    if (
      state.superBallPending &&
      state.superBallPending.innings === payload.innings
    ) {
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
  if (enforceLiveRules) {
    if (!state.superOverEnabled) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        "Super Over is disabled by match rules",
      );
    }

    // Match must be live
    if (state.matchStatus !== "live") {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        `Super Over cannot start: match is not live (status: ${state.matchStatus})`,
      );
    }

    // Both regulation innings must be complete before any Super Over can start
    const first = state.innings.find((i) => i.innings === 1);
    const second = state.innings.find((i) => i.innings === 2);

    if (!first || first.phase !== "completed") {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        "Super Over cannot start: first innings is not yet completed",
      );
    }
    if (!second || second.phase !== "completed") {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        "Super Over cannot start: second innings is not yet completed",
      );
    }

    // Regulation match must have been tied (target not reached, no clear winner)
    // A Super Over can only begin if the regulation match ended in a tie.
    // Tie means: second innings runs === (first innings runs) when target was set to first.runs + 1,
    // i.e., second.runs === state.target - 1  OR  second.runs === first.runs (no target path).
    const regulationIsTie = state.target != null
      ? second.runs === state.target - 1
      : second.runs === first.runs;

    if (!regulationIsTie) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        "Super Over cannot start: regulation match was not a tie",
      );
    }

    // For knockout_tie trigger, also enforce the match type constraint
    if (state.superOverTrigger === "knockout_tie" && !isKnockoutMatchType(state)) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        "Super Over is only available for configured knockout ties",
      );
    }

    // The innings number in the payload must be sequentially correct
    // (next after the last existing innings in the list)
    const expectedInnings = state.innings.length + 1;
    if (payload.innings !== expectedInnings) {
      throw new InvalidEventPayloadError(
        CricketEventType.SUPER_OVER_STARTED,
        `Super Over innings number must be ${expectedInnings}, got ${payload.innings}`,
      );
    }

    // The last Super Over innings (if any) must be completed before starting another
    const existingSuperOvers = state.innings.filter((i) => i.kind === "super_over");
    if (existingSuperOvers.length > 0) {
      const lastSuperOver = existingSuperOvers[existingSuperOvers.length - 1]!;
      if (lastSuperOver.phase !== "completed") {
        throw new InvalidEventPayloadError(
          CricketEventType.SUPER_OVER_STARTED,
          "Super Over cannot start: the previous Super Over innings is not yet completed",
        );
      }
      // When starting the 1st innings of a new Super Over pair (length is even: 2, 4, 6...),
      // the immediately preceding Super Over pair must have been tied.
      // If the preceding pair produced a decisive result, no more Super Overs are allowed.
      if (existingSuperOvers.length % 2 === 0) {
        const prevFirst = existingSuperOvers[existingSuperOvers.length - 2]!;
        const prevSecond = existingSuperOvers[existingSuperOvers.length - 1]!;
        if (prevFirst.runs !== prevSecond.runs) {
          throw new InvalidEventPayloadError(
            CricketEventType.SUPER_OVER_STARTED,
            "Super Over cannot start: the previous Super Over already produced a decisive result",
          );
        }
      }
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
  enforceLiveRules = false,
): CricketScoreboardState {
  if (enforceLiveRules) {
    // The innings being ended must be the current active innings
    if (payload.innings !== state.currentInnings) {
      throw new InvalidEventPayloadError(
        CricketEventType.INNINGS_ENDED,
        `Cannot end innings ${payload.innings}: current active innings is ${state.currentInnings}`,
      );
    }
    const currentInn = state.innings.find((i) => i.innings === payload.innings);
    if (!currentInn) {
      throw new InvalidEventPayloadError(
        CricketEventType.INNINGS_ENDED,
        `Cannot end innings ${payload.innings}: innings not found`,
      );
    }
    if (currentInn.phase !== "in_progress") {
      throw new InvalidEventPayloadError(
        CricketEventType.INNINGS_ENDED,
        `Cannot end innings ${payload.innings}: innings is already ${currentInn.phase}`,
      );
    }
    // Match must be live
    if (state.matchStatus !== "live") {
      throw new InvalidEventPayloadError(
        CricketEventType.INNINGS_ENDED,
        `Cannot end innings: match is not live (status: ${state.matchStatus})`,
      );
    }
  }

  let next = updateInnings(state, payload.innings, (inn) => ({
    ...inn,
    runs: payload.runs,
    wickets: payload.wickets,
    phase: "completed" as const,
  }));

  if (payload.reason === "super_over_required") {
    return {
      ...next,
      thisOver: [],
      freeHitActive: false,
      superBallPending: null,
    };
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
    const target =
      state.revisedOversLimit != null && state.target != null
        ? state.target
        : payload.runs + 1;
    return {
      ...next,
      currentInnings: 2,
      target,
      innings: [...next.innings, second],
      thisOver: [],
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
      freeHitActive: false,
      superBallPending: null,
    };
  }

  return {
    ...next,
    thisOver: [],
    freeHitActive: false,
    superBallPending: null,
  };
}

function applyMatchCompleted(
  state: CricketScoreboardState,
  payload: CricketMatchCompletedPayload,
): CricketScoreboardState {
  const terminalCheck = isCricketMatchTerminalState(state);
  if (!terminalCheck.valid) {
    throw new InvalidEventPayloadError(
      CricketEventType.MATCH_COMPLETED,
      terminalCheck.reason,
    );
  }
  return {
    ...state,
    matchStatus: "completed",
    sessionStatus: "idle",
    winnerTeamId: payload.winnerTeamId,
    resultText: payload.resultText,
    freeHitActive: false,
    innings: state.innings.map((inn) =>
      inn.phase === "in_progress"
        ? { ...inn, phase: "completed" as const }
        : inn,
    ),
  };
}

function applyMatchAbandoned(
  state: CricketScoreboardState,
  payload: CricketMatchAbandonedPayload,
): CricketScoreboardState {
  if (
    state.matchStatus === "completed" ||
    state.matchStatus === "abandoned" ||
    state.matchStatus === "walkover" ||
    state.matchStatus === "cancelled"
  ) {
    throw new InvalidEventPayloadError(
      CricketEventType.MATCH_ABANDONED,
      `cannot abandon match: match is already terminal (${state.matchStatus})`,
    );
  }
  return {
    ...state,
    matchStatus: "abandoned",
    sessionStatus: "idle",
    abandonedReason: payload.reason,
    interruptionReason: null,
    freeHitActive: false,
  };
}

function applyWalkoverAwarded(
  state: CricketScoreboardState,
  payload: CricketWalkoverAwardedPayload,
): CricketScoreboardState {
  if (
    state.matchStatus === "completed" ||
    state.matchStatus === "abandoned" ||
    state.matchStatus === "walkover" ||
    state.matchStatus === "cancelled"
  ) {
    throw new InvalidEventPayloadError(
      CricketEventType.WALKOVER_AWARDED,
      `cannot award walkover: match is already terminal (${state.matchStatus})`,
    );
  }
  if (
    payload.winnerTeamId !== state.homeTeamId &&
    payload.winnerTeamId !== state.awayTeamId
  ) {
    throw new InvalidEventPayloadError(
      CricketEventType.WALKOVER_AWARDED,
      `winnerTeamId ${payload.winnerTeamId} is not a valid team for this match (home: ${state.homeTeamId}, away: ${state.awayTeamId})`,
    );
  }
  const resultText = payload.reason
    ? `Won by Walkover (${payload.reason})`
    : "Won by Walkover";
  return {
    ...state,
    matchStatus: "walkover",
    sessionStatus: "idle",
    winnerTeamId: payload.winnerTeamId,
    resultText,
    freeHitActive: false,
    interruptionReason: null,
    innings: state.innings.map((inn) =>
      inn.phase === "in_progress"
        ? { ...inn, phase: "completed" as const }
        : inn,
    ),
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
  enforceLiveRules = false,
): CricketScoreboardState {
  if (enforceLiveRules) {
    // DLS can only be applied to a live match
    if (state.matchStatus !== "live") {
      throw new InvalidEventPayloadError(
        CricketEventType.DLS_APPLIED,
        `DLS cannot be applied: match is not live (status: ${state.matchStatus})`,
      );
    }

    // DLS cannot be applied after match is in terminal state
    const terminalCheck = isCricketMatchTerminalState(state);
    if (terminalCheck.valid) {
      throw new InvalidEventPayloadError(
        CricketEventType.DLS_APPLIED,
        "DLS cannot be applied: match is already in a terminal state",
      );
    }

    // DLS can only target a regulation innings (1 or 2), not a Super Over innings
    if (payload.innings > 2) {
      throw new InvalidEventPayloadError(
        CricketEventType.DLS_APPLIED,
        "DLS cannot be applied to a Super Over innings",
      );
    }

    // DLS cannot be applied during a Super Over phase
    const superOvers = state.innings.filter((i) => i.kind === "super_over");
    if (superOvers.length > 0) {
      throw new InvalidEventPayloadError(
        CricketEventType.DLS_APPLIED,
        "DLS cannot be applied during a Super Over",
      );
    }

    // DLS cannot be applied to a innings that has already completed
    const targetInnings = state.innings.find((i) => i.innings === payload.innings);
    if (targetInnings && targetInnings.phase === "completed") {
      throw new InvalidEventPayloadError(
        CricketEventType.DLS_APPLIED,
        `DLS cannot be applied: innings ${payload.innings} is already completed`,
      );
    }

    // DLS cannot be applied if the target has already been reached in the current innings
    if (
      payload.innings === 2 &&
      state.target != null
    ) {
      const secondInn = state.innings.find((i) => i.innings === 2);
      if (secondInn && secondInn.runs >= state.target) {
        throw new InvalidEventPayloadError(
          CricketEventType.DLS_APPLIED,
          "DLS cannot be applied: the chase target has already been reached",
        );
      }
    }

    // DLS target innings must be the current or the upcoming second innings
    // (innings 1 DLS is allowed during 1st innings; innings 2 DLS is allowed
    //  when innings 1 is complete or when 2nd innings is in progress)
    if (payload.innings === 1 && state.currentInnings > 1) {
      throw new InvalidEventPayloadError(
        CricketEventType.DLS_APPLIED,
        "DLS cannot be applied to a completed first innings",
      );
    }
    if (payload.innings === 2) {
      const firstInn = state.innings.find((i) => i.innings === 1);
      if (!firstInn) {
        throw new InvalidEventPayloadError(
          CricketEventType.DLS_APPLIED,
          "DLS for innings 2 requires first innings to have started",
        );
      }
    }
  }

  let next: CricketScoreboardState = {
    ...state,
    target: payload.target,
    revisedOversLimit: payload.revisedOvers,
    oversLimit: payload.innings <= 2 ? payload.revisedOvers : state.oversLimit,
    sessionStatus: state.matchStatus === "live" ? "live" : state.sessionStatus,
    interruptionReason: null,
  };

  const innings = state.innings.find((i) => i.innings === payload.innings);
  if (innings) {
    next = updateInnings(next, payload.innings, (inn) => ({
      ...inn,
      oversLimit: payload.revisedOvers,
    }));
  }

  return next;
}

function appendThisOver(
  current: BallDisplayOutcome[],
  payload: CricketBallRecordedPayload,
  display: ReturnType<typeof toBallDisplay>,
): BallDisplayOutcome[] {
  const activeOver = current[0]?.over;
  if (activeOver !== undefined && payload.over !== activeOver) {
    return [display];
  }
  return [...current, display];
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
        enforceLiveRules,
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
    case CricketEventType.WALKOVER_AWARDED:
      next = applyWalkoverAwarded(
        state,
        parsed.payload as CricketWalkoverAwardedPayload,
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
      next = applyDlsApplied(state, parsed.payload as CricketDlsAppliedPayload, enforceLiveRules);
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
