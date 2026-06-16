import type {
  BadmintonGameEndedPayload,
  BadmintonMatchStartedPayload,
  BadmintonPointWonPayload,
} from "../events/badminton";
import type { BadmintonMatchKind, BadmintonMatchState, BadmintonSide } from "../types";
import type { CommandEvent } from "../commands";
import { BadmintonEventType } from "../events/badminton";
import {
  advanceDoublesServeAfterPoint,
  buildInitialCourtPositions,
  buildNextGameCourtPositions,
  nextGameServerAfterGameEnd,
  opposingSide,
  receiverIndexForServer,
} from "./doubles-court";
import type {
  BadmintonScoringEngine,
  DoublesMatchStartedPayload,
  DoublesServeState,
} from "./types";
import {
  deriveDoublesServeAfterPointWon,
  validateDoublesServeAgainstPayload,
} from "./doubles-replay-derive";

function isDoublesPayload(
  input: BadmintonMatchStartedPayload,
): input is DoublesMatchStartedPayload {
  return "doublesSetup" in input && input.doublesSetup != null;
}

function buildDoublesServeState(
  servingSide: BadmintonSide,
  serverPlayerIndex: 0 | 1,
  receivingSide: BadmintonSide,
  receiverPlayerIndex: 0 | 1,
  setup: DoublesServeState["setup"],
): DoublesServeState {
  const courtPositions = buildInitialCourtPositions(
    servingSide,
    serverPlayerIndex,
    receivingSide,
    receiverPlayerIndex,
  );

  return {
    servingSide,
    servingPlayerIndex: serverPlayerIndex,
    receivingSide,
    receivingPlayerIndex: receiverPlayerIndex,
    courtPositions,
    setup,
  };
}

export class DoublesScoringEngine implements BadmintonScoringEngine {
  readonly kind: BadmintonMatchKind = "doubles";

  validateStart(
    state: BadmintonMatchState,
    input: BadmintonMatchStartedPayload,
  ): { ok: true } | { ok: false; error: string } {
    if (state.matchStatus !== "scheduled") {
      return { ok: false, error: "Match is not in scheduled status" };
    }
    if (!isDoublesPayload(input)) {
      return { ok: false, error: "Doubles matches require doublesSetup (toss, server, receiver)" };
    }
    const { doublesSetup } = input;
    if (doublesSetup.firstServingSide === doublesSetup.firstReceivingSide) {
      return { ok: false, error: "Serving and receiving sides must be different" };
    }
    return { ok: true };
  }

  buildMatchStartedEvents(
    _state: BadmintonMatchState,
    input: BadmintonMatchStartedPayload,
  ): CommandEvent[] {
    return [
      {
        eventType: BadmintonEventType.MATCH_STARTED,
        payload: input as unknown as Record<string, unknown>,
      },
    ];
  }

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
  ): BadmintonPointWonPayload {
    const ds = state.doublesServe;
    if (!ds) {
      throw new Error("Doubles serve state missing");
    }

    const next = advanceDoublesServeAfterPoint(
      winningSide,
      ds.servingSide,
      scores.newLeftScore,
      scores.newRightScore,
      ds.courtPositions,
    );

    return {
      winningSide,
      gameNumber: state.currentGame,
      winnerScore: scores.winnerScore,
      loserScore: scores.loserScore,
      rallyLength: opts?.rallyLength,
      isGamePoint: scores.gameOver,
      isMatchPoint: scores.matchOver,
      servingSide: next.servingSide,
      doublesServe: {
        servingSide: next.servingSide,
        servingPlayerIndex: next.servingPlayerIndex,
        receivingSide: next.receivingSide,
        receivingPlayerIndex: next.receivingPlayerIndex,
        courtPositions: next.courtPositions,
      },
    };
  }

  buildGameEndedExtras(
    state: BadmintonMatchState,
    winningSide: BadmintonSide,
    _newLeftScore: number,
    _newRightScore: number,
  ): Partial<BadmintonGameEndedPayload> {
    const ds = state.doublesServe;
    if (!ds) {
      return { nextServingSide: winningSide };
    }

    const lastServingSide = ds.servingSide;
    const lastServerPlayerIndex = ds.servingPlayerIndex;
    const lastRallyWinningSide = winningSide;

    const nextServerIndex = nextGameServerAfterGameEnd(
      winningSide,
      lastServingSide,
      lastServerPlayerIndex,
      lastRallyWinningSide,
    );

    const courtPositions = buildNextGameCourtPositions(
      winningSide,
      nextServerIndex,
      ds.courtPositions.left,
      ds.courtPositions.right,
    );

    const receivingSide = opposingSide(winningSide);
    const nextReceiverIndex = receiverIndexForServer(
      nextServerIndex,
      courtPositions[winningSide],
      courtPositions[receivingSide],
    );

    return {
      nextServingSide: winningSide,
      doublesServe: {
        nextServingSide: winningSide,
        nextServerPlayerIndex: nextServerIndex,
        nextReceiverPlayerIndex: nextReceiverIndex,
        courtPositions,
        lastServingSide,
        lastServerPlayerIndex,
        lastRallyWinningSide,
      },
    };
  }

  applyMatchStarted(
    _state: BadmintonMatchState,
    payload: BadmintonMatchStartedPayload,
  ): Partial<BadmintonMatchState> {
    if (!isDoublesPayload(payload)) {
      return {};
    }

    const { doublesSetup } = payload;
    const doublesServe = buildDoublesServeState(
      doublesSetup.firstServingSide,
      doublesSetup.firstServerPlayerIndex,
      doublesSetup.firstReceivingSide,
      doublesSetup.firstReceiverPlayerIndex,
      {
        firstServingSide: doublesSetup.firstServingSide,
        firstServerPlayerIndex: doublesSetup.firstServerPlayerIndex,
        firstReceivingSide: doublesSetup.firstReceivingSide,
        firstReceiverPlayerIndex: doublesSetup.firstReceiverPlayerIndex,
      },
    );

    return {
      servingSide: doublesServe.servingSide,
      doublesServe,
    };
  }

  applyPointWon(
    state: BadmintonMatchState,
    payload: BadmintonPointWonPayload,
  ): Partial<BadmintonMatchState> {
    const derived = deriveDoublesServeAfterPointWon(state, payload);
    if (!derived) {
      return { servingSide: payload.servingSide ?? payload.winningSide };
    }

    validateDoublesServeAgainstPayload(derived, payload.doublesServe);

    return {
      servingSide: derived.servingSide,
      doublesServe: derived,
    };
  }

  applyGameEnded(
    state: BadmintonMatchState,
    payload: BadmintonGameEndedPayload,
  ): Partial<BadmintonMatchState> {
    const extras = payload.doublesServe;
    if (!extras) {
      return { servingSide: payload.nextServingSide ?? payload.winningSide };
    }

    const doublesServe: DoublesServeState = {
      setup: state.doublesServe?.setup ?? {
        firstServingSide: extras.nextServingSide,
        firstServerPlayerIndex: extras.nextServerPlayerIndex,
        firstReceivingSide: opposingSide(extras.nextServingSide),
        firstReceiverPlayerIndex: extras.nextReceiverPlayerIndex,
      },
      servingSide: extras.nextServingSide,
      servingPlayerIndex: extras.nextServerPlayerIndex,
      receivingSide: opposingSide(extras.nextServingSide),
      receivingPlayerIndex: extras.nextReceiverPlayerIndex,
      courtPositions: extras.courtPositions,
      lastGameEnd: {
        lastServingSide: extras.lastServingSide,
        lastServerPlayerIndex: extras.lastServerPlayerIndex,
        lastRallyWinningSide: extras.lastRallyWinningSide,
      },
    };

    return {
      servingSide: extras.nextServingSide,
      doublesServe,
    };
  }
}

export class MixedDoublesScoringEngine extends DoublesScoringEngine {
  override readonly kind: BadmintonMatchKind = "mixed_doubles";
}

export const doublesScoringEngine = new DoublesScoringEngine();
export const mixedDoublesScoringEngine = new MixedDoublesScoringEngine();
