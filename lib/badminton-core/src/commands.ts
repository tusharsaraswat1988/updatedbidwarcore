/**
 * Command layer — given current match state, produce the correct events
 * that should be appended to the event log.
 *
 * This is the business-logic heart of the scoring engine:
 * - Validates legality of actions
 * - Computes derived information (isGamePoint, isMatchPoint, etc.)
 * - Produces correct event payloads
 *
 * Commands never touch the DB — callers persist the resulting events.
 */

import {
  BadmintonEventType,
  type BadmintonGameEndedPayload,
  type BadmintonMatchEndedPayload,
  type BadmintonMatchStartedPayload,
  type BadmintonPointWonPayload,
  type BadmintonPointUndonePayload,
  type BadmintonIntervalStartedPayload,
  type BadmintonIntervalEndedPayload,
  type BadmintonSideChangedPayload,
  type BadmintonRetirementPayload,
  type BadmintonWalkoverPayload,
  type BadmintonDisqualificationPayload,
  type BadmintonTimeoutStartedPayload,
  type BadmintonTimeoutEndedPayload,
  type BadmintonMatchPausedPayload,
  type BadmintonMatchResumedPayload,
  type BadmintonMatchNoteAddedPayload,
} from "./events/badminton";
import type { BadmintonMatchState, BadmintonSide, MatchPauseReason } from "./types";
import {
  gamesNeededToWin,
  getCurrentGame,
  isDecidingGame,
  isGameOver,
  sideChangeScore,
} from "./reducer/state";
import { getScoringEngine } from "./scoring";

export type CommandEvent = {
  eventType: string;
  payload: Record<string, unknown>;
};

export type CommandResult =
  | { ok: true; events: CommandEvent[] }
  | { ok: false; error: string };

function ok(events: CommandEvent[]): CommandResult {
  return { ok: true, events };
}

function err(error: string): CommandResult {
  return { ok: false, error };
}

// ── Commands ─────────────────────────────────────────────────────────────────

export function cmdStartMatch(
  state: BadmintonMatchState,
  input: BadmintonMatchStartedPayload,
): CommandResult {
  const engine = getScoringEngine(input.matchKind ?? state.matchKind);
  const validation = engine.validateStart(state, input);
  if (!validation.ok) {
    return err(validation.error);
  }
  return ok(engine.buildMatchStartedEvents(state, input));
}

export function cmdAwardPoint(
  state: BadmintonMatchState,
  winningSide: BadmintonSide,
  opts?: { rallyLength?: number },
): CommandResult {
  if (state.matchStatus !== "live") {
    return err("Match is not live");
  }
  if (state.isPaused) {
    return err("Match is paused");
  }
  if (state.currentGame === 0) {
    return err("No active game");
  }

  const { format } = state;
  const currentLeft = state.leftScore;
  const currentRight = state.rightScore;
  const newWinnerScore = winningSide === "left" ? currentLeft + 1 : currentRight + 1;
  const loserScore = winningSide === "left" ? currentRight : currentLeft;
  const newLeftScore = winningSide === "left" ? newWinnerScore : loserScore;
  const newRightScore = winningSide === "right" ? newWinnerScore : loserScore;

  const gameOver = isGameOver(
    newLeftScore,
    newRightScore,
    format.pointsPerGame,
    format.deuceAt,
    format.maxPoints,
  );

  const gamesNeeded = gamesNeededToWin(format.totalGames);
  const newGamesLeft = state.gamesLeft + (winningSide === "left" && gameOver ? 1 : 0);
  const newGamesRight = state.gamesRight + (winningSide === "right" && gameOver ? 1 : 0);
  const matchOver =
    gameOver && (newGamesLeft >= gamesNeeded || newGamesRight >= gamesNeeded);

  const engine = getScoringEngine(state.matchKind);
  const pointPayload = engine.buildPointWonPayload(state, winningSide, {
    newLeftScore,
    newRightScore,
    winnerScore: newWinnerScore,
    loserScore,
    gameOver,
    matchOver,
  }, opts);

  const events: CommandEvent[] = [
    { eventType: BadmintonEventType.POINT_WON, payload: pointPayload as unknown as Record<string, unknown> },
  ];

  if (gameOver) {
    const gameExtras = engine.buildGameEndedExtras(
      state,
      winningSide,
      newLeftScore,
      newRightScore,
    );
    const gameEndedPayload: BadmintonGameEndedPayload = {
      gameNumber: state.currentGame,
      winningSide,
      leftScore: newLeftScore,
      rightScore: newRightScore,
      ...gameExtras,
    };
    events.push({
      eventType: BadmintonEventType.GAME_ENDED,
      payload: gameEndedPayload as unknown as Record<string, unknown>,
    });
  }

  if (matchOver) {
    const resultSummary = buildResultSummary(
      state.games,
      newGamesLeft,
      newGamesRight,
      winningSide,
      gameOver ? { leftScore: newLeftScore, rightScore: newRightScore, gameNumber: state.currentGame, winningSide } : null,
    );
    const matchEndedPayload: BadmintonMatchEndedPayload = {
      winningSide,
      gamesLeft: newGamesLeft,
      gamesRight: newGamesRight,
      reason: "normal",
      resultSummary,
    };
    events.push({
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: matchEndedPayload as unknown as Record<string, unknown>,
    });
  } else if (gameOver) {
    // Detecting interval for next deciding game — will happen after game_ended via cmdStartInterval
  }

  return ok(events);
}

export function cmdUndoLastPoint(
  state: BadmintonMatchState,
  undoTargetSequences: number[],
): CommandResult {
  if (state.matchStatus !== "live") {
    return err("Cannot undo — match is not live");
  }
  if (state.isPaused) {
    return err("Cannot undo — match is paused");
  }
  if (state.totalRallies === 0) {
    return err("No points to undo");
  }
  if (undoTargetSequences.length === 0) {
    return err("No points to undo");
  }

  const undoPayload: BadmintonPointUndonePayload = {
    undoneSequence: undoTargetSequences[0]!,
    undoneSequences: undoTargetSequences,
  };

  return ok([
    {
      eventType: BadmintonEventType.POINT_UNDONE,
      payload: undoPayload as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdStartInterval(
  state: BadmintonMatchState,
): CommandResult {
  if (state.matchStatus !== "live") return err("Match not live");
  if (state.inInterval) return err("Already in interval");

  const { format } = state;
  const threshold = sideChangeScore(format.pointsPerGame);
  const maxScore = Math.max(state.leftScore, state.rightScore);

  if (!isDecidingGame(state.currentGame, format.totalGames)) {
    return err("Interval only happens in the deciding game");
  }

  const servingSide: BadmintonSide = maxScore === state.leftScore ? "left" : "right";
  const payload: BadmintonIntervalStartedPayload = {
    gameNumber: state.currentGame,
    atScore: threshold,
    side: servingSide,
  };

  return ok([
    { eventType: BadmintonEventType.INTERVAL_STARTED, payload: payload as unknown as Record<string, unknown> },
  ]);
}

export function cmdEndInterval(state: BadmintonMatchState): CommandResult {
  if (!state.inInterval) return err("Not in interval");

  const payload: BadmintonIntervalEndedPayload = {
    gameNumber: state.currentGame,
  };

  return ok([
    { eventType: BadmintonEventType.INTERVAL_ENDED, payload: payload as unknown as Record<string, unknown> },
  ]);
}

/** Record umpire acknowledgement of court change at deciding-game interval. */
export function cmdAcknowledgeCourtChange(state: BadmintonMatchState): CommandResult {
  if (state.matchStatus !== "live") return err("Match not live");
  if (!isDecidingGame(state.currentGame, state.format.totalGames)) {
    return err("Court change only applies in the deciding game");
  }

  const game = getCurrentGame(state);
  if (!game?.intervalReached) {
    return err("Court change not required yet");
  }

  const payload: BadmintonSideChangedPayload = {
    gameNumber: state.currentGame,
    leftSide: "original_right",
    rightSide: "original_left",
  };

  return ok([
    {
      eventType: BadmintonEventType.SIDE_CHANGED,
      payload: payload as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdStartTimeout(
  state: BadmintonMatchState,
  side: BadmintonSide,
  kind: "regular" | "medical" = "regular",
): CommandResult {
  if (state.matchStatus !== "live") return err("Match not live");
  if (state.activeTimeout) return err("Timeout already in progress");

  const payload: BadmintonTimeoutStartedPayload = { side, kind };
  return ok([
    { eventType: BadmintonEventType.TIMEOUT_STARTED, payload: payload as unknown as Record<string, unknown> },
  ]);
}

export function cmdEndTimeout(state: BadmintonMatchState): CommandResult {
  if (!state.activeTimeout) return err("No active timeout");

  const payload: BadmintonTimeoutEndedPayload = { side: state.activeTimeout.side };
  return ok([
    { eventType: BadmintonEventType.TIMEOUT_ENDED, payload: payload as unknown as Record<string, unknown> },
  ]);
}

export function cmdDeclareRetirement(
  state: BadmintonMatchState,
  retiringSide: BadmintonSide,
  reason?: string,
): CommandResult {
  if (state.matchStatus !== "live") return err("Match not live");

  const winningSide: BadmintonSide = retiringSide === "left" ? "right" : "left";
  const payload: BadmintonRetirementPayload = { retiringSide, winningSide, reason };

  return ok([
    { eventType: BadmintonEventType.RETIREMENT_DECLARED, payload: payload as unknown as Record<string, unknown> },
    {
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: {
        winningSide,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        reason: "retirement",
      } as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdDeclareWalkover(
  state: BadmintonMatchState,
  winningSide: BadmintonSide,
  reason?: string,
): CommandResult {
  if (state.matchStatus !== "scheduled" && state.matchStatus !== "live") {
    return err("Match cannot be given walkover in current state");
  }

  const payload: BadmintonWalkoverPayload = { winningSide, reason };

  return ok([
    { eventType: BadmintonEventType.WALKOVER_DECLARED, payload: payload as unknown as Record<string, unknown> },
    {
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: {
        winningSide,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        reason: "walkover",
      } as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdDeclareDisqualification(
  state: BadmintonMatchState,
  disqualifiedSide: BadmintonSide,
  reason: string,
): CommandResult {
  if (!reason.trim()) return err("Disqualification reason is required");
  if (
    state.matchStatus !== "live" &&
    state.matchStatus !== "scheduled" &&
    state.matchStatus !== "paused"
  ) {
    return err("Match cannot be disqualified in current state");
  }

  const winningSide: BadmintonSide = disqualifiedSide === "left" ? "right" : "left";
  const payload: BadmintonDisqualificationPayload = { disqualifiedSide, winningSide, reason };

  return ok([
    {
      eventType: BadmintonEventType.DISQUALIFICATION_DECLARED,
      payload: payload as unknown as Record<string, unknown>,
    },
    {
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: {
        winningSide,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        reason: "disqualification",
        resultSummary: `Disqualified — ${reason}`,
      } as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdPauseMatch(
  state: BadmintonMatchState,
  reason: MatchPauseReason,
  detail?: string,
): CommandResult {
  if (state.matchStatus !== "live") return err("Only live matches can be paused");
  if (state.isPaused) return err("Match is already paused");

  const payload: BadmintonMatchPausedPayload = { reason, detail };
  return ok([
    {
      eventType: BadmintonEventType.MATCH_PAUSED,
      payload: payload as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdResumeMatch(state: BadmintonMatchState): CommandResult {
  if (state.matchStatus !== "paused" && !state.isPaused) {
    return err("Match is not paused");
  }

  const payload: BadmintonMatchResumedPayload = {};
  return ok([
    {
      eventType: BadmintonEventType.MATCH_RESUMED,
      payload: payload as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdAddMatchNote(state: BadmintonMatchState, text: string): CommandResult {
  const trimmed = text.trim();
  if (!trimmed) return err("Note text is required");
  if (state.matchStatus === "scheduled") {
    return err("Cannot add notes before match starts");
  }

  const payload: BadmintonMatchNoteAddedPayload = { text: trimmed };
  return ok([
    {
      eventType: BadmintonEventType.MATCH_NOTE_ADDED,
      payload: payload as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdForceEndMatch(
  state: BadmintonMatchState,
  reason: string,
): CommandResult {
  if (state.matchStatus !== "live" && state.matchStatus !== "paused") {
    return err("Match cannot be force-ended in current state");
  }
  if (!reason.trim()) return err("Force end reason is required");

  const winningSide: BadmintonSide =
    state.gamesLeft >= state.gamesRight
      ? state.gamesLeft > state.gamesRight
        ? "left"
        : state.gamesRight > state.gamesLeft
          ? "right"
          : "left"
      : "right";

  return ok([
    {
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: {
        winningSide,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        reason: "abandoned",
        resultSummary: `Force ended — ${reason}`,
      } as unknown as Record<string, unknown>,
    },
  ]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildResultSummary(
  games: Array<{ leftScore: number; rightScore: number; phase: string; winner?: string }>,
  gamesLeft: number,
  gamesRight: number,
  matchWinner: BadmintonSide,
  finalGamePatch: { leftScore: number; rightScore: number; gameNumber: number; winningSide: BadmintonSide } | null,
): string {
  const allGames = games.map((g, i) => {
    if (finalGamePatch && i === finalGamePatch.gameNumber - 1) {
      return { leftScore: finalGamePatch.leftScore, rightScore: finalGamePatch.rightScore };
    }
    return { leftScore: g.leftScore, rightScore: g.rightScore };
  });

  const completedGames = allGames.filter(
    (_, i) =>
      games[i].phase === "completed" ||
      (finalGamePatch && i === finalGamePatch.gameNumber - 1),
  );

  const scoreString = completedGames
    .map((g) => `${g.leftScore}-${g.rightScore}`)
    .join(", ");

  return `${matchWinner === "left" ? "Left" : "Right"} won ${gamesLeft}-${gamesRight} (${scoreString})`;
}
