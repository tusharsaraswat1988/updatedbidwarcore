import type { BadmintonMatchStartedPayload, BadmintonPointWonPayload } from "../events/badminton";
import type { BadmintonMatchKind, BadmintonMatchState, BadmintonSide } from "../types";
import type { CommandEvent } from "../commands";
import { BadmintonEventType } from "../events/badminton";
import type { BadmintonScoringEngine } from "./types";
import {
  deriveSinglesServingSideAfterPointWon,
  validateSinglesServingSideAgainstPayload,
} from "./singles-replay-derive";

export class SinglesScoringEngine implements BadmintonScoringEngine {
  readonly kind: BadmintonMatchKind = "singles";

  validateStart(
    state: BadmintonMatchState,
    _input: BadmintonMatchStartedPayload,
  ): { ok: true } | { ok: false; error: string } {
    if (state.matchStatus !== "scheduled") {
      return { ok: false, error: "Match is not in scheduled status" };
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
    return {
      winningSide,
      gameNumber: state.currentGame,
      winnerScore: scores.winnerScore,
      loserScore: scores.loserScore,
      rallyLength: opts?.rallyLength,
      isGamePoint: scores.gameOver,
      isMatchPoint: scores.matchOver,
      // Singles: server is always the rally winner.
      servingSide: winningSide,
    };
  }

  buildGameEndedExtras(
    _state: BadmintonMatchState,
    winningSide: BadmintonSide,
    _newLeftScore: number,
    _newRightScore: number,
  ) {
    return { nextServingSide: winningSide };
  }

  applyMatchStarted(
    _state: BadmintonMatchState,
    payload: BadmintonMatchStartedPayload,
  ): Partial<BadmintonMatchState> {
    return {
      servingSide: payload.firstServer,
      doublesServe: undefined,
    };
  }

  applyPointWon(
    _state: BadmintonMatchState,
    payload: BadmintonPointWonPayload,
  ): Partial<BadmintonMatchState> {
    const servingSide = deriveSinglesServingSideAfterPointWon(payload);
    validateSinglesServingSideAgainstPayload(servingSide, payload);

    return { servingSide };
  }

  applyGameEnded(
    _state: BadmintonMatchState,
    payload: import("../events/badminton").BadmintonGameEndedPayload,
  ): Partial<BadmintonMatchState> {
    const nextServingSide = payload.nextServingSide ?? payload.winningSide;
    return { servingSide: nextServingSide };
  }
}

export const singlesScoringEngine = new SinglesScoringEngine();
