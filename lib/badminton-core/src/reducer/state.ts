import type {
  BadmintonGameState,
  BadmintonMatchMeta,
  BadmintonMatchState,
  BadmintonSide,
} from "../types";
import { STANDARD_FORMAT } from "../types";

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
  };
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

/** Score at which side change happens in deciding game. */
export function sideChangeScore(pointsPerGame: number): number {
  return Math.floor(pointsPerGame / 2);
}
