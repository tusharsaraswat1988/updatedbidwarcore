import type {
  BadmintonMatchKind,
  BadmintonMatchState,
  BadmintonSide,
} from "../types";
import type {
  BadmintonGameEndedPayload,
  BadmintonMatchStartedPayload,
  BadmintonPointWonPayload,
} from "../events/badminton";
import type { CommandEvent } from "../commands";

/** Which service court (left/right half) a player occupies on their side. */
export type ServiceCourt = "left" | "right";

/** Per-side court position: which partner (0 or 1) is in the right service court. */
export type SideCourtPositions = {
  rightCourtPlayerIndex: 0 | 1;
};

/** Full doubles court layout — software-managed, no manual dragging. */
export type DoublesCourtPositionsState = {
  left: SideCourtPositions;
  right: SideCourtPositions;
};

/** Player-level service state for doubles / mixed doubles. */
export type DoublesServeState = {
  /** Side whose pair is currently serving. */
  servingSide: BadmintonSide;
  /** Partner index (0|1) on servingSide who is the current server. */
  servingPlayerIndex: 0 | 1;
  /** Side currently receiving. */
  receivingSide: BadmintonSide;
  /** Partner index (0|1) on receivingSide who is the current receiver. */
  receivingPlayerIndex: 0 | 1;
  /** Court positions for all four players. */
  courtPositions: DoublesCourtPositionsState;
  /** Setup metadata — preserved for replay / display. */
  setup: {
    firstServingSide: BadmintonSide;
    firstServerPlayerIndex: 0 | 1;
    firstReceivingSide: BadmintonSide;
    firstReceiverPlayerIndex: 0 | 1;
  };
  /** Tracks last server at end of previous game for BWF game-start rotation. */
  lastGameEnd?: {
    lastServingSide: BadmintonSide;
    lastServerPlayerIndex: 0 | 1;
    lastRallyWinningSide: BadmintonSide;
  };
};

/** Extended match-start payload for doubles with toss + player selection. */
export type DoublesMatchStartedPayload = BadmintonMatchStartedPayload & {
  doublesSetup: {
    tossWinnerSide: BadmintonSide;
    tossDecision: "serve" | "receive";
    firstServingSide: BadmintonSide;
    firstServerPlayerIndex: 0 | 1;
    firstReceivingSide: BadmintonSide;
    firstReceiverPlayerIndex: 0 | 1;
  };
};

/** Point payload extension — carries post-rally serve/court state for doubles. */
export type DoublesPointWonPayload = BadmintonPointWonPayload & {
  doublesServe?: {
    servingSide: BadmintonSide;
    servingPlayerIndex: 0 | 1;
    receivingSide: BadmintonSide;
    receivingPlayerIndex: 0 | 1;
    courtPositions: DoublesCourtPositionsState;
  };
};

/** Game-ended payload extension for doubles next-game server. */
export type DoublesGameEndedPayload = BadmintonGameEndedPayload & {
  doublesServe?: {
    nextServingSide: BadmintonSide;
    nextServerPlayerIndex: 0 | 1;
    nextReceiverPlayerIndex: 0 | 1;
    courtPositions: DoublesCourtPositionsState;
    lastServingSide: BadmintonSide;
    lastServerPlayerIndex: 0 | 1;
    lastRallyWinningSide: BadmintonSide;
  };
};

export interface BadmintonScoringEngine {
  readonly kind: BadmintonMatchKind;

  validateStart(
    state: BadmintonMatchState,
    input: BadmintonMatchStartedPayload,
  ): { ok: true } | { ok: false; error: string };

  buildMatchStartedEvents(
    state: BadmintonMatchState,
    input: BadmintonMatchStartedPayload,
  ): CommandEvent[];

  buildPointWonPayload(
    state: BadmintonMatchState,
    winningSide: BadmintonSide,
    scores: {
      newLeftScore: number;
      newRightScore: number;
      winnerScore: number;
      loserScore: number;
      gameOver: boolean;
      matchOver: boolean;
    },
    opts?: { rallyLength?: number },
  ): BadmintonPointWonPayload;

  buildGameEndedExtras(
    state: BadmintonMatchState,
    winningSide: BadmintonSide,
    newLeftScore: number,
    newRightScore: number,
  ): Partial<BadmintonGameEndedPayload>;

  applyMatchStarted(
    state: BadmintonMatchState,
    payload: BadmintonMatchStartedPayload,
  ): Partial<BadmintonMatchState>;

  applyPointWon(
    state: BadmintonMatchState,
    payload: BadmintonPointWonPayload,
  ): Partial<BadmintonMatchState>;

  applyGameEnded(
    state: BadmintonMatchState,
    payload: BadmintonGameEndedPayload,
  ): Partial<BadmintonMatchState>;
}
