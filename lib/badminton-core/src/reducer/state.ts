import type {
  BadmintonGameState,
  BadmintonMatchMeta,
  BadmintonMatchState,
  BadmintonSide,
  CourtEnd,
  EndAssignment,
} from "../types";
import { DEFAULT_END_ASSIGNMENT, STANDARD_FORMAT } from "../types";

export function createInitialBadmintonState(meta: BadmintonMatchMeta): BadmintonMatchState {
  return {
    matchId: meta.matchId,
    tournamentId: meta.tournamentId,
    matchKind: meta.matchKind,
    format: meta.format ?? STANDARD_FORMAT,
    matchStatus: "scheduled",
    leftSide: {
      label: "Player A",
      shortLabel: "A",
      playerIds: [],
    },
    rightSide: {
      label: "Player B",
      shortLabel: "B",
      playerIds: [],
    },
    gamesLeft: 0,
    gamesRight: 0,
    currentGame: 0,
    leftScore: 0,
    rightScore: 0,
    games: [],
    servingSide: "left",
    inInterval: false,
    activeTimeout: null,
    lastSequence: 0,
    totalRallies: 0,
    isPaused: false,
    matchNotes: [],
    endAssignment: DEFAULT_END_ASSIGNMENT,
  };
}

export function otherCourtEnd(end: CourtEnd): CourtEnd {
  return end === "END_1" ? "END_2" : "END_1";
}

export function resolveEndAssignment(state: BadmintonMatchState): EndAssignment {
  return state.endAssignment ?? DEFAULT_END_ASSIGNMENT;
}

/**
 * How many times ends have flipped so far.
 * - +1 after each completed game (BWF: change ends between games)
 * - +1 when deciding-game mid-interval court change is acknowledged
 */
export function endsFlipCount(state: BadmintonMatchState): number {
  const gamesCompleted = Math.max(0, state.currentGame - 1);
  const game = getCurrentGame(state);
  const decidingMidAcknowledged =
    isDecidingGame(state.currentGame, state.format.totalGames) &&
    game?.sideChangeAcknowledged === true;
  return gamesCompleted + (decidingMidAcknowledged ? 1 : 0);
}

/** Physical end currently occupied by a scoreboard side. */
export function endForSide(state: BadmintonMatchState, side: BadmintonSide): CourtEnd {
  const assignment = resolveEndAssignment(state);
  const flips = endsFlipCount(state);
  const leftEnd =
    flips % 2 === 0 ? assignment.leftStartsAt : otherCourtEnd(assignment.leftStartsAt);
  return side === "left" ? leftEnd : otherCourtEnd(leftEnd);
}

/**
 * True at the start of game 2+ (0–0) while the match is still live —
 * scorer should prompt players to change ends before the next rally.
 */
export function isPostGameEndsChangeDue(state: BadmintonMatchState): boolean {
  if (state.matchStatus !== "live") return false;
  if (state.currentGame <= 1) return false;
  if (state.leftScore !== 0 || state.rightScore !== 0) return false;
  const gamesNeeded = gamesNeededToWin(state.format.totalGames);
  if (state.gamesLeft >= gamesNeeded || state.gamesRight >= gamesNeeded) return false;
  const game = getCurrentGame(state);
  if (!game || game.phase !== "in_progress") return false;
  return true;
}

/** Get current game state (mutable reference). */
export function getCurrentGame(state: BadmintonMatchState): BadmintonGameState | null {
  if (state.currentGame === 0 || state.games.length === 0) return null;
  return state.games[state.currentGame - 1] ?? null;
}

/** Compute which side serves next after a point.
 * In badminton rally scoring: server = rally winner always.
 * Side that wins the rally serves next. */
export function nextServingSide(winningSide: BadmintonSide): BadmintonSide {
  return winningSide;
}

/** Games needed to win the match (majority of totalGames). */
export function gamesNeededToWin(totalGames: number): number {
  return Math.ceil(totalGames / 2);
}

/** Check if a game is over. Returns true if one side has won. */
export function isGameOver(
  leftScore: number,
  rightScore: number,
  pointsPerGame: number,
  deuceAt: number,
  maxPoints: number,
): boolean {
  const maxScore = Math.max(leftScore, rightScore);
  const minScore = Math.min(leftScore, rightScore);

  if (maxScore < pointsPerGame) return false;

  // Deuce — need to lead by 2
  if (minScore >= deuceAt) {
    return maxScore - minScore >= 2 || maxScore >= maxPoints;
  }

  return maxScore >= pointsPerGame;
}

/** Whether we're in deuce. */
export function isInDeuce(
  leftScore: number,
  rightScore: number,
  deuceAt: number,
): boolean {
  return leftScore >= deuceAt && rightScore >= deuceAt;
}

/** Calculate the deciding game number (final game). */
export function decidingGame(totalGames: number): number {
  return totalGames;
}

/** Is the current game the deciding game? */
export function isDecidingGame(currentGame: number, totalGames: number): boolean {
  return currentGame === totalGames;
}

/**
 * Score at which ends change / interval occurs in the deciding game.
 * BWF Law 16.2.3: for a game of 21 points, when either side reaches 11.
 * For odd pointsPerGame this is ceil(n/2); for 21 → 11.
 */
export function sideChangeScore(pointsPerGame: number): number {
  return Math.ceil(pointsPerGame / 2);
}
