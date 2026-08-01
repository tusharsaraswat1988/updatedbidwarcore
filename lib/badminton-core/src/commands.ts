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
  type BadmintonTossCorrectedPayload,
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
  type BadmintonMarginPointsAssignedPayload,
  type BadmintonScoreRevisedPayload,
  type BadmintonMatchReopenedPayload,
  type BadmintonScoreRevisedGame,
} from "./events/badminton";
import type { BadmintonMatchState, BadmintonSide, MatchPauseReason } from "./types";
import { resolveAssignedMarginForCommand, hasCompletedGames } from "./assigned-margin";
import { isBadmintonTerminalMatchStatus } from "./match-terminal-status";
import {
  gamesNeededToWin,
  getCurrentGame,
  isDecidingGame,
  isGameOver,
  sideChangeScore,
} from "./reducer/state";
import { getScoringEngine } from "./scoring";
import { isPairMatchKind } from "./side-utils";

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

/** True when umpire may re-enter toss (live, game 1, 0–0, no rallies). */
export function canCorrectToss(state: BadmintonMatchState): boolean {
  if (state.matchStatus !== "live") return false;
  if (state.isPaused || state.inInterval || state.activeTimeout) return false;
  if ((state.totalRallies ?? 0) !== 0) return false;
  if (state.currentGame !== 1) return false;
  if (state.leftScore !== 0 || state.rightScore !== 0) return false;
  if (state.gamesLeft !== 0 || state.gamesRight !== 0) return false;
  if (state.games.length !== 1) return false;
  const game = state.games[0];
  return game?.phase === "in_progress" && game.leftScore === 0 && game.rightScore === 0;
}

export function cmdCorrectToss(
  state: BadmintonMatchState,
  input: BadmintonTossCorrectedPayload,
): CommandResult {
  if (!canCorrectToss(state)) {
    return err(
      "Toss can only be edited at 0–0 with no points scored. Undo points back to the start first.",
    );
  }

  if (isPairMatchKind(state.matchKind)) {
    if (!input.doublesSetup) {
      return err("Doubles matches require doublesSetup (toss, server, receiver)");
    }
    if (input.doublesSetup.firstServingSide === input.doublesSetup.firstReceivingSide) {
      return err("Serving and receiving sides must be different");
    }
  }

  return ok([
    {
      eventType: BadmintonEventType.TOSS_CORRECTED,
      payload: input as unknown as Record<string, unknown>,
    },
  ]);
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
  if (state.inInterval) {
    return err("Cannot score during interval — end the interval first");
  }
  if (state.activeTimeout) {
    return err("Cannot score during timeout — end the timeout first");
  }
  if (state.currentGame === 0) {
    return err("No active game");
  }

  const currentGameState = getCurrentGame(state);
  if (
    state.format.midGameSideChange &&
    isDecidingGame(state.currentGame, state.format.totalGames) &&
    currentGameState?.intervalReached &&
    !currentGameState.sideChangeAcknowledged
  ) {
    return err("Acknowledge court change before scoring");
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
  if (!format.midGameSideChange) {
    return err("Mid-game interval is disabled for this match format");
  }
  if (!isDecidingGame(state.currentGame, format.totalGames)) {
    return err("Interval only happens in the deciding game");
  }

  const threshold = sideChangeScore(format.pointsPerGame);
  const maxScore = Math.max(state.leftScore, state.rightScore);
  if (maxScore < threshold) {
    return err(`Interval starts when either side reaches ${threshold} points`);
  }

  const leadingSide: BadmintonSide =
    state.leftScore === state.rightScore
      ? state.servingSide
      : state.leftScore > state.rightScore
        ? "left"
        : "right";
  const payload: BadmintonIntervalStartedPayload = {
    gameNumber: state.currentGame,
    atScore: threshold,
    side: leadingSide,
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

/** Record scorer acknowledgement of court change at deciding-game interval. */
export function cmdAcknowledgeCourtChange(state: BadmintonMatchState): CommandResult {
  if (state.matchStatus !== "live") return err("Match not live");
  if (!isDecidingGame(state.currentGame, state.format.totalGames)) {
    return err("Court change only applies in the deciding game");
  }

  const game = getCurrentGame(state);
  if (!game?.intervalReached) {
    return err("Court change not required yet");
  }
  // Idempotent — double-tap / retry after success must not fail the scorer UI.
  if (game.sideChangeAcknowledged) {
    return ok([]);
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
  assignedMarginPoints?: number,
): CommandResult {
  if (state.matchStatus !== "live") return err("Match not live");

  const margin = resolveAssignedMarginForCommand(state, assignedMarginPoints);
  if (!margin.ok) return err(margin.error);

  const winningSide: BadmintonSide = retiringSide === "left" ? "right" : "left";
  const payload: BadmintonRetirementPayload = {
    retiringSide,
    winningSide,
    reason,
    ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
  };

  return ok([
    { eventType: BadmintonEventType.RETIREMENT_DECLARED, payload: payload as unknown as Record<string, unknown> },
    {
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: {
        winningSide,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        reason: "retirement",
        ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
      } as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdDeclareWalkover(
  state: BadmintonMatchState,
  winningSide: BadmintonSide,
  reason?: string,
  assignedMarginPoints?: number,
): CommandResult {
  if (state.matchStatus !== "scheduled" && state.matchStatus !== "live") {
    return err("Match cannot be given walkover in current state");
  }

  const margin = resolveAssignedMarginForCommand(state, assignedMarginPoints);
  if (!margin.ok) return err(margin.error);

  const payload: BadmintonWalkoverPayload = {
    winningSide,
    reason,
    ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
  };

  return ok([
    { eventType: BadmintonEventType.WALKOVER_DECLARED, payload: payload as unknown as Record<string, unknown> },
    {
      eventType: BadmintonEventType.MATCH_ENDED,
      payload: {
        winningSide,
        gamesLeft: state.gamesLeft,
        gamesRight: state.gamesRight,
        reason: "walkover",
        ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
      } as unknown as Record<string, unknown>,
    },
  ]);
}

export function cmdDeclareDisqualification(
  state: BadmintonMatchState,
  disqualifiedSide: BadmintonSide,
  reason: string,
  assignedMarginPoints?: number,
): CommandResult {
  if (!reason.trim()) return err("Disqualification reason is required");
  if (
    state.matchStatus !== "live" &&
    state.matchStatus !== "scheduled" &&
    state.matchStatus !== "paused"
  ) {
    return err("Match cannot be disqualified in current state");
  }

  const margin = resolveAssignedMarginForCommand(state, assignedMarginPoints);
  if (!margin.ok) return err(margin.error);

  const winningSide: BadmintonSide = disqualifiedSide === "left" ? "right" : "left";
  const payload: BadmintonDisqualificationPayload = {
    disqualifiedSide,
    winningSide,
    reason,
    ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
  };

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
        ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
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

/** Park a live match so another match can use the court (ops hold). */
export function cmdHoldMatch(state: BadmintonMatchState, detail?: string): CommandResult {
  if (state.matchStatus !== "live") {
    return err("Only live matches can be put on hold");
  }
  if (state.isPaused) {
    return err("Match is already on hold or paused");
  }
  return cmdPauseMatch(state, "ops_hold", detail ?? "Court freed for another match");
}

export function cmdResumeMatch(state: BadmintonMatchState): CommandResult {
  if (
    state.matchStatus !== "paused" &&
    state.matchStatus !== "on_hold" &&
    !state.isPaused
  ) {
    return err("Match is not paused or on hold");
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
  assignedMarginPoints?: number,
): CommandResult {
  if (
    state.matchStatus !== "live" &&
    state.matchStatus !== "paused" &&
    state.matchStatus !== "on_hold"
  ) {
    return err("Match cannot be force-ended in current state");
  }
  if (!reason.trim()) return err("Force end reason is required");

  const margin = resolveAssignedMarginForCommand(state, assignedMarginPoints);
  if (!margin.ok) return err(margin.error);

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
        ...(margin.value != null ? { assignedMarginPoints: margin.value } : {}),
      } as unknown as Record<string, unknown>,
    },
  ]);
}

/** Set/update assigned margin after a terminal finish with no completed games. */
export function cmdAssignMarginPoints(
  state: BadmintonMatchState,
  assignedMarginPoints: number,
): CommandResult {
  if (!isBadmintonTerminalMatchStatus(state.matchStatus)) {
    return err("Margin points can only be assigned after the match has finished");
  }
  if (hasCompletedGames(state.games)) {
    return err("Margin points cannot be assigned when completed games already exist");
  }
  if (!Number.isInteger(assignedMarginPoints) || assignedMarginPoints < 1) {
    return err("Margin points must be a positive integer");
  }

  const payload: BadmintonMarginPointsAssignedPayload = { assignedMarginPoints };
  return ok([
    {
      eventType: BadmintonEventType.MARGIN_POINTS_ASSIGNED,
      payload: payload as unknown as Record<string, unknown>,
    },
  ]);
}

/** Quick admin correction of final set scores after the match has finished. */
export function cmdReviseFinalScore(
  state: BadmintonMatchState,
  games: BadmintonScoreRevisedGame[],
  winningSide: BadmintonSide,
  note?: string,
): CommandResult {
  if (!isBadmintonTerminalMatchStatus(state.matchStatus)) {
    return err("Score can only be revised after the match has finished");
  }
  if (games.length === 0) return err("At least one game score is required");

  const need = gamesNeededToWin(state.format.totalGames);
  let left = 0;
  let right = 0;
  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    if (g.gameNumber !== i + 1) {
      return err("Game numbers must be sequential starting at 1");
    }
    if (g.leftScore === g.rightScore) {
      return err(`Game ${g.gameNumber} cannot be a tie`);
    }
    const winner: BadmintonSide = g.leftScore > g.rightScore ? "left" : "right";
    if (g.winningSide !== winner) {
      return err(`Game ${g.gameNumber} winningSide does not match scores`);
    }
    if (winner === "left") left += 1;
    else right += 1;
  }
  if (left < need && right < need) {
    return err(`Winner must reach ${need} games`);
  }
  if ((winningSide === "left" ? left : right) < need) {
    return err("winningSide does not match game results");
  }

  const payload: BadmintonScoreRevisedPayload = { games, winningSide, note };
  return ok([
    {
      eventType: BadmintonEventType.SCORE_REVISED,
      payload: payload as unknown as Record<string, unknown>,
    },
  ]);
}

/** Re-open a finished match so the scorer can undo / continue scoring. */
export function cmdReopenMatch(
  state: BadmintonMatchState,
  note?: string,
): CommandResult {
  if (!isBadmintonTerminalMatchStatus(state.matchStatus)) {
    return err("Only finished matches can be reopened");
  }
  const payload: BadmintonMatchReopenedPayload = { note };
  return ok([
    {
      eventType: BadmintonEventType.MATCH_REOPENED,
      payload: payload as unknown as Record<string, unknown>,
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
