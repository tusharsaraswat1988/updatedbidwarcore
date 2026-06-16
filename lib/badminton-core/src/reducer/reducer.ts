import {
  BadmintonEventType,
  parseBadmintonEventPayload,
  type BadmintonGameEndedPayload,
  type BadmintonIntervalEndedPayload,
  type BadmintonIntervalStartedPayload,
  type BadmintonMatchEndedPayload,
  type BadmintonMatchStartedPayload,
  type BadmintonPointUndonePayload,
  type BadmintonPointWonPayload,
  type BadmintonRetirementPayload,
  type BadmintonDisqualificationPayload,
  type BadmintonWalkoverPayload,
  type BadmintonTimeoutStartedPayload,
  type BadmintonTimeoutEndedPayload,
} from "../events/badminton";
import type {
  BadmintonEventEnvelope,
  BadmintonGameState,
  BadmintonMatchState,
  BadmintonMatchStatus,
} from "../types";
import {
  createInitialBadmintonState,
  gamesNeededToWin,
  isDecidingGame,
  isGameOver,
  isInDeuce,
  sideChangeScore,
} from "./state";
import { getScoringEngine } from "../scoring";

class InvalidEventPayloadError extends Error {
  constructor(eventType: string, detail: string) {
    super(`Invalid payload for ${eventType}: ${detail}`);
    this.name = "InvalidEventPayloadError";
  }
}

function applyMatchStarted(
  state: BadmintonMatchState,
  payload: BadmintonMatchStartedPayload,
): BadmintonMatchState {
  const firstGame: BadmintonGameState = {
    gameNumber: 1,
    leftScore: 0,
    rightScore: 0,
    servingSide: payload.firstServer,
    intervalReached: false,
    phase: "in_progress",
    startedAt: new Date().toISOString(),
  };

  const engine = getScoringEngine(payload.matchKind);
  const enginePatch = engine.applyMatchStarted(state, payload);

  return {
    ...state,
    matchStatus: "live",
    matchKind: payload.matchKind,
    format: payload.format,
    leftSide: payload.leftSide,
    rightSide: payload.rightSide,
    currentGame: 1,
    leftScore: 0,
    rightScore: 0,
    games: [firstGame],
    servingSide: enginePatch.servingSide ?? payload.firstServer,
    doublesServe: enginePatch.doublesServe,
    gamesLeft: 0,
    gamesRight: 0,
    inInterval: false,
    activeTimeout: null,
  };
}

function applyPointWon(
  state: BadmintonMatchState,
  payload: BadmintonPointWonPayload,
): BadmintonMatchState {
  if (state.matchStatus !== "live") return state;
  if (payload.gameNumber !== state.currentGame) return state;

  const newLeftScore = payload.winningSide === "left" ? payload.winnerScore : payload.loserScore;
  const newRightScore = payload.winningSide === "right" ? payload.winnerScore : payload.loserScore;
  const nextServingSide = payload.servingSide ?? payload.winningSide;

  const updatedGames = state.games.map((g) => {
    if (g.gameNumber !== payload.gameNumber) return g;
    return {
      ...g,
      leftScore: newLeftScore,
      rightScore: newRightScore,
      servingSide: nextServingSide,
      // Detect interval in deciding game at sideChangeScore
      intervalReached:
        g.intervalReached ||
        (isDecidingGame(payload.gameNumber, state.format.totalGames) &&
          !g.intervalReached &&
          Math.max(newLeftScore, newRightScore) >= sideChangeScore(state.format.pointsPerGame)),
    };
  });

  const engine = getScoringEngine(state.matchKind);
  const enginePatch = engine.applyPointWon(state, payload);

  return {
    ...state,
    leftScore: newLeftScore,
    rightScore: newRightScore,
    servingSide: enginePatch.servingSide ?? nextServingSide,
    doublesServe: enginePatch.doublesServe ?? state.doublesServe,
    games: updatedGames,
    totalRallies: state.totalRallies + 1,
  };
}

function applyGameEnded(
  state: BadmintonMatchState,
  payload: BadmintonGameEndedPayload,
): BadmintonMatchState {
  const newGamesLeft = payload.winningSide === "left" ? state.gamesLeft + 1 : state.gamesLeft;
  const newGamesRight = payload.winningSide === "right" ? state.gamesRight + 1 : state.gamesRight;

  const updatedGames = state.games.map((g) => {
    if (g.gameNumber !== payload.gameNumber) return g;
    return {
      ...g,
      leftScore: payload.leftScore,
      rightScore: payload.rightScore,
      phase: "completed" as const,
      winner: payload.winningSide,
      endedAt: new Date().toISOString(),
    };
  });

  const gamesNeeded = gamesNeededToWin(state.format.totalGames);
  const isMatchOver = newGamesLeft >= gamesNeeded || newGamesRight >= gamesNeeded;

  if (isMatchOver) {
    return {
      ...state,
      gamesLeft: newGamesLeft,
      gamesRight: newGamesRight,
      leftScore: payload.leftScore,
      rightScore: payload.rightScore,
      games: updatedGames,
      inInterval: false,
    };
  }

  const nextGameNumber = payload.gameNumber + 1;
  const nextServingSide = payload.nextServingSide ?? payload.winningSide;

  const engine = getScoringEngine(state.matchKind);
  const enginePatch = engine.applyGameEnded(state, payload);

  const nextGame: BadmintonGameState = {
    gameNumber: nextGameNumber,
    leftScore: 0,
    rightScore: 0,
    servingSide: enginePatch.servingSide ?? nextServingSide,
    intervalReached: false,
    phase: "in_progress",
    startedAt: new Date().toISOString(),
  };

  return {
    ...state,
    gamesLeft: newGamesLeft,
    gamesRight: newGamesRight,
    currentGame: nextGameNumber,
    leftScore: 0,
    rightScore: 0,
    games: [...updatedGames, nextGame],
    servingSide: enginePatch.servingSide ?? nextServingSide,
    doublesServe: enginePatch.doublesServe ?? state.doublesServe,
    inInterval: false,
  };
}

function applyMatchEnded(
  state: BadmintonMatchState,
  payload: BadmintonMatchEndedPayload,
): BadmintonMatchState {
  // Map reason to the appropriate terminal match status.
  const statusByReason: Record<string, BadmintonMatchStatus> = {
    normal: "completed",
    walkover: "walkover",
    retirement: "retired",
    disqualification: "disqualified",
    abandoned: "abandoned",
  };

  return {
    ...state,
    matchStatus: statusByReason[payload.reason] ?? "completed",
    winnerSide: payload.winningSide,
    gamesLeft: payload.gamesLeft,
    gamesRight: payload.gamesRight,
    resultReason: payload.reason,
    inInterval: false,
    activeTimeout: null,
  };
}

function applyIntervalStarted(
  state: BadmintonMatchState,
  _payload: BadmintonIntervalStartedPayload,
): BadmintonMatchState {
  return { ...state, inInterval: true };
}

function applyIntervalEnded(
  state: BadmintonMatchState,
  _payload: BadmintonIntervalEndedPayload,
): BadmintonMatchState {
  return { ...state, inInterval: false };
}

function applyTimeoutStarted(
  state: BadmintonMatchState,
  payload: BadmintonTimeoutStartedPayload,
): BadmintonMatchState {
  return {
    ...state,
    activeTimeout: { side: payload.side, takenAt: new Date().toISOString() },
  };
}

function applyTimeoutEnded(
  state: BadmintonMatchState,
  _payload: BadmintonTimeoutEndedPayload,
): BadmintonMatchState {
  return { ...state, activeTimeout: null };
}

function applyRetirement(
  state: BadmintonMatchState,
  payload: BadmintonRetirementPayload,
): BadmintonMatchState {
  return {
    ...state,
    matchStatus: "retired",
    winnerSide: payload.winningSide,
    resultReason: "retirement",
  };
}

function applyWalkover(
  state: BadmintonMatchState,
  payload: BadmintonWalkoverPayload,
): BadmintonMatchState {
  return {
    ...state,
    matchStatus: "walkover",
    winnerSide: payload.winningSide,
    resultReason: "walkover",
  };
}

function applyDisqualification(
  state: BadmintonMatchState,
  payload: BadmintonDisqualificationPayload,
): BadmintonMatchState {
  return {
    ...state,
    matchStatus: "disqualified",
    winnerSide: payload.winningSide,
    resultReason: "disqualification",
  };
}

export function reduceBadminton(
  state: BadmintonMatchState,
  event: BadmintonEventEnvelope,
): BadmintonMatchState {
  const parsed = parseBadmintonEventPayload(event.eventType, event.payload);
  if (!parsed.ok) {
    throw new InvalidEventPayloadError(event.eventType, parsed.error);
  }

  let next: BadmintonMatchState;

  switch (event.eventType) {
    case BadmintonEventType.MATCH_STARTED:
      next = applyMatchStarted(state, parsed.payload as BadmintonMatchStartedPayload);
      break;
    case BadmintonEventType.POINT_WON:
      next = applyPointWon(state, parsed.payload as BadmintonPointWonPayload);
      break;
    case BadmintonEventType.POINT_UNDONE:
      // Undo markers are resolved before replay (compensating event pattern)
      throw new InvalidEventPayloadError(
        BadmintonEventType.POINT_UNDONE,
        "undo markers are resolved before replay",
      );
    case BadmintonEventType.GAME_ENDED:
      next = applyGameEnded(state, parsed.payload as BadmintonGameEndedPayload);
      break;
    case BadmintonEventType.MATCH_ENDED:
      next = applyMatchEnded(state, parsed.payload as BadmintonMatchEndedPayload);
      break;
    case BadmintonEventType.INTERVAL_STARTED:
      next = applyIntervalStarted(state, parsed.payload as BadmintonIntervalStartedPayload);
      break;
    case BadmintonEventType.INTERVAL_ENDED:
      next = applyIntervalEnded(state, parsed.payload as BadmintonIntervalEndedPayload);
      break;
    case BadmintonEventType.TIMEOUT_STARTED:
      next = applyTimeoutStarted(state, parsed.payload as BadmintonTimeoutStartedPayload);
      break;
    case BadmintonEventType.TIMEOUT_ENDED:
      next = applyTimeoutEnded(state, parsed.payload as BadmintonTimeoutEndedPayload);
      break;
    case BadmintonEventType.SIDE_CHANGED:
      next = state; // Side change is visual-only; state doesn't change
      break;
    case BadmintonEventType.RETIREMENT_DECLARED:
      next = applyRetirement(state, parsed.payload as BadmintonRetirementPayload);
      break;
    case BadmintonEventType.WALKOVER_DECLARED:
      next = applyWalkover(state, parsed.payload as BadmintonWalkoverPayload);
      break;
    case BadmintonEventType.DISQUALIFICATION_DECLARED:
      next = applyDisqualification(state, parsed.payload as BadmintonDisqualificationPayload);
      break;
    default:
      throw new InvalidEventPayloadError(event.eventType, "unsupported event type");
  }

  return { ...next, lastSequence: event.sequence };
}

/** Resolve undo markers: remove the event being undone + the undo marker itself. */
export function resolveUndoEvents(
  events: BadmintonEventEnvelope[],
): BadmintonEventEnvelope[] {
  const undoneSequences = new Set<number>();

  for (const ev of events) {
    if (ev.eventType === BadmintonEventType.POINT_UNDONE) {
      const payload = ev.payload as BadmintonPointUndonePayload;
      undoneSequences.add(payload.undoneSequence);
      undoneSequences.add(ev.sequence);
    }
  }

  return events.filter((ev) => !undoneSequences.has(ev.sequence));
}

/** Replay a sequence of events to build the full match state. */
export function replayBadmintonEvents(
  meta: BadmintonMatchMeta,
  events: BadmintonEventEnvelope[],
): BadmintonMatchState {
  const effective = resolveUndoEvents(events);
  const initial = createInitialBadmintonState(meta);
  return effective.reduce((state, event) => reduceBadminton(state, event), initial);
}

type BadmintonMatchMeta = Parameters<typeof createInitialBadmintonState>[0];
