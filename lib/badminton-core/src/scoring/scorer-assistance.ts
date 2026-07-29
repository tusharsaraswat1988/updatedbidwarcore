/**
 * Scorer assistance — read-only derivations for operator UI.
 * Does not mutate match state or scoring logic.
 */

import type { BadmintonMatchState, BadmintonSide, CourtEnd } from "../types";
import { getSidePlayerSlots, isPairMatchKind } from "../side-utils";
import {
  currentReceiverLabel,
  currentServerLabel,
  sideInfoFor,
} from "./display-utils";
import {
  endForSide,
  endsFlipCount,
  gamesNeededToWin,
  getCurrentGame,
  isDecidingGame,
  isGameOver,
  isPostGameEndsChangeDue,
  sideChangeScore,
} from "../reducer/state";
import { opposingSide } from "./doubles-court";

export type ScorerBannerKind =
  | "game_point"
  | "match_point"
  | "interval_due"
  | "court_change_required"
  | "game_completed"
  | "ends_change_required"
  | "match_completed";

export type ScorerBanner = {
  kind: ScorerBannerKind;
  side?: BadmintonSide;
  label: string;
  emoji: string;
};

export type ScorerConfidencePanel = {
  currentGame: number;
  leftScore: number;
  rightScore: number;
  serverLabel: string;
  receiverLabel: string;
  serviceCourt: string | null;
  gamesLeft: number;
  gamesRight: number;
  /** Physical end for scoreboard-left (derived). */
  leftEnd: CourtEnd;
  /** Physical end for scoreboard-right (derived). */
  rightEnd: CourtEnd;
};

export type ScorerAssistanceSnapshot = {
  serverLabel: string;
  receiverLabel: string;
  serviceCourt: string | null;
  banners: ScorerBanner[];
  panel: ScorerConfidencePanel;
  gamePointSide: BadmintonSide | null;
  matchPointSide: BadmintonSide | null;
  intervalDue: boolean;
  courtChangeRequired: boolean;
  /** Between games: players should change ends before next rally. */
  endsChangeDue: boolean;
  endsFlipCount: number;
  intervalThreshold: number;
  scoringBlocked: boolean;
  scoringBlockReason: "interval" | "court_change" | "timeout" | "paused" | null;
};

export type VoiceAssistPrompt =
  | "Game Point"
  | "Match Point"
  | "Interval"
  | "Court Change"
  | "Change Ends";

function sideDisplayLabel(state: BadmintonMatchState, side: BadmintonSide): string {
  const info = sideInfoFor(state, side);
  const slots = getSidePlayerSlots(info);
  if (slots.length === 1) {
    return slots[0]?.label ?? slots[0]?.shortLabel ?? info.label;
  }
  return info.shortLabel || info.label;
}

export function singlesServerLabel(state: BadmintonMatchState): string {
  return sideDisplayLabel(state, state.servingSide);
}

export function singlesReceiverLabel(state: BadmintonMatchState): string {
  return sideDisplayLabel(state, opposingSide(state.servingSide));
}

export function resolveServerLabel(state: BadmintonMatchState): string {
  if (isPairMatchKind(state.matchKind)) {
    return currentServerLabel(state) ?? "—";
  }
  return singlesServerLabel(state);
}

export function resolveReceiverLabel(state: BadmintonMatchState): string {
  if (isPairMatchKind(state.matchKind)) {
    return currentReceiverLabel(state) ?? "—";
  }
  return singlesReceiverLabel(state);
}

/**
 * Service court for the current server.
 * Singles (BWF): even score → Right; odd score → Left (of the server's score).
 * Doubles: derived from courtPositions + servingPlayerIndex.
 */
export function resolveServiceCourt(state: BadmintonMatchState): string | null {
  if (state.matchStatus !== "live") return null;

  if (isPairMatchKind(state.matchKind)) {
    const ds = state.doublesServe;
    if (!ds) return null;
    const positions = ds.courtPositions[ds.servingSide];
    const inRightCourt = ds.servingPlayerIndex === positions.rightCourtPlayerIndex;
    return inRightCourt ? "Right service court" : "Left service court";
  }

  // Singles half-court: based on serving side's own score parity.
  const serverScore =
    state.servingSide === "left" ? state.leftScore : state.rightScore;
  return serverScore % 2 === 0 ? "Right" : "Left";
}

export function wouldSideWinGame(
  side: BadmintonSide,
  state: BadmintonMatchState,
): boolean {
  const { format, leftScore, rightScore } = state;
  const newLeft = side === "left" ? leftScore + 1 : leftScore;
  const newRight = side === "right" ? rightScore + 1 : rightScore;
  return isGameOver(
    newLeft,
    newRight,
    format.pointsPerGame,
    format.deuceAt,
    format.maxPoints,
  );
}

export function wouldSideWinMatch(
  side: BadmintonSide,
  state: BadmintonMatchState,
): boolean {
  if (!wouldSideWinGame(side, state)) return false;
  const gamesNeeded = gamesNeededToWin(state.format.totalGames);
  const newGamesLeft = state.gamesLeft + (side === "left" ? 1 : 0);
  const newGamesRight = state.gamesRight + (side === "right" ? 1 : 0);
  return newGamesLeft >= gamesNeeded || newGamesRight >= gamesNeeded;
}

export function detectGamePointSide(state: BadmintonMatchState): BadmintonSide | null {
  if (state.matchStatus !== "live" || state.inInterval || state.activeTimeout) {
    return null;
  }
  const leftGamePoint = wouldSideWinGame("left", state);
  const rightGamePoint = wouldSideWinGame("right", state);
  if (leftGamePoint && !rightGamePoint) return "left";
  if (rightGamePoint && !leftGamePoint) return "right";
  if (leftGamePoint && rightGamePoint) {
    return state.leftScore >= state.rightScore ? "left" : "right";
  }
  return null;
}

export function detectMatchPointSide(state: BadmintonMatchState): BadmintonSide | null {
  if (state.matchStatus !== "live" || state.inInterval || state.activeTimeout) {
    return null;
  }
  if (wouldSideWinMatch("left", state)) return "left";
  if (wouldSideWinMatch("right", state)) return "right";
  return null;
}

export function isIntervalThresholdReached(state: BadmintonMatchState): boolean {
  if (state.matchStatus !== "live") return false;
  if (!state.format.midGameSideChange) return false;
  if (!isDecidingGame(state.currentGame, state.format.totalGames)) return false;
  const game = getCurrentGame(state);
  return game?.intervalReached === true;
}

export function isIntervalDue(state: BadmintonMatchState): boolean {
  return isIntervalThresholdReached(state) && !state.inInterval;
}

export function isCourtChangeRequired(state: BadmintonMatchState): boolean {
  if (!isIntervalThresholdReached(state)) return false;
  const game = getCurrentGame(state);
  // Prefer engine state when present so UI and command layer agree.
  if (game?.sideChangeAcknowledged) return false;
  return true;
}

export function deriveVoiceAssistPrompts(
  snapshot: ScorerAssistanceSnapshot,
): VoiceAssistPrompt[] {
  const prompts: VoiceAssistPrompt[] = [];
  if (snapshot.matchPointSide) {
    prompts.push("Match Point");
  } else if (snapshot.gamePointSide) {
    prompts.push("Game Point");
  }
  if (snapshot.endsChangeDue) prompts.push("Change Ends");
  if (snapshot.intervalDue) prompts.push("Interval");
  if (snapshot.courtChangeRequired) prompts.push("Court Change");
  return prompts;
}

export function deriveScorerAssistance(
  state: BadmintonMatchState,
  opts?: {
    courtChangeAcknowledged?: boolean;
    readyToScore?: boolean;
  },
): ScorerAssistanceSnapshot {
  const serverLabel = resolveServerLabel(state);
  const receiverLabel = resolveReceiverLabel(state);
  const serviceCourt = resolveServiceCourt(state);
  const gamePointSide = detectGamePointSide(state);
  const matchPointSide = detectMatchPointSide(state);
  const intervalDue = isIntervalDue(state);
  const courtChangeRequired = isCourtChangeRequired(state);
  const endsChangeDue = isPostGameEndsChangeDue(state);
  const flipCount = endsFlipCount(state);
  const leftEnd = endForSide(state, "left");
  const rightEnd = endForSide(state, "right");
  const intervalThreshold = sideChangeScore(state.format.pointsPerGame);
  const intervalDisplayPoints = intervalThreshold;
  const game = getCurrentGame(state);
  // Prefer reducer state when set; fall back to UI-local ack during optimistic updates.
  const courtChangeAcknowledged =
    game?.sideChangeAcknowledged ?? opts?.courtChangeAcknowledged ?? false;
  const readyToScore = opts?.readyToScore ?? true;

  const banners: ScorerBanner[] = [];

  if (state.matchStatus === "completed" || state.matchStatus === "walkover") {
    banners.push({
      kind: "match_completed",
      side: state.winnerSide ?? undefined,
      label: state.winnerSide
        ? `MATCH COMPLETED — ${sideDisplayLabel(state, state.winnerSide)}`
        : "MATCH COMPLETED",
      emoji: "🏆",
    });
  } else if (state.matchStatus === "live") {
    if (endsChangeDue) {
      banners.push({
        kind: "ends_change_required",
        label: `CHANGE ENDS — Game ${state.currentGame}`,
        emoji: "🔄",
      });
    }

    if (matchPointSide) {
      banners.push({
        kind: "match_point",
        side: matchPointSide,
        label: `MATCH POINT — ${sideDisplayLabel(state, matchPointSide)}`,
        emoji: "🔴",
      });
    } else if (gamePointSide) {
      banners.push({
        kind: "game_point",
        side: gamePointSide,
        label: `GAME POINT — ${sideDisplayLabel(state, gamePointSide)}`,
        emoji: "🟠",
      });
    }

    if (intervalDue) {
      banners.push({
        kind: "interval_due",
        label: `INTERVAL DUE (${intervalDisplayPoints} POINTS)`,
        emoji: "🟣",
      });
    }

    if (courtChangeRequired && !courtChangeAcknowledged) {
      banners.push({
        kind: "court_change_required",
        label: "COURT CHANGE REQUIRED",
        emoji: "🔄",
      });
    }
  }

  let scoringBlockReason: ScorerAssistanceSnapshot["scoringBlockReason"] = null;
  if (state.isPaused || state.matchStatus === "paused") {
    scoringBlockReason = "paused";
  } else if (state.inInterval) {
    scoringBlockReason = "interval";
  } else if (courtChangeRequired && !courtChangeAcknowledged) {
    scoringBlockReason = "court_change";
  } else if (state.activeTimeout) {
    scoringBlockReason = "timeout";
  } else if (!readyToScore) {
    scoringBlockReason = state.activeTimeout ? "timeout" : "interval";
  }

  const scoringBlocked =
    state.matchStatus !== "live" ||
    state.isPaused ||
    !!state.inInterval ||
    !!state.activeTimeout ||
    (courtChangeRequired && !courtChangeAcknowledged) ||
    !readyToScore;

  return {
    serverLabel,
    receiverLabel,
    serviceCourt,
    banners,
    panel: {
      currentGame: state.currentGame,
      leftScore: state.leftScore,
      rightScore: state.rightScore,
      serverLabel,
      receiverLabel,
      serviceCourt,
      gamesLeft: state.gamesLeft,
      gamesRight: state.gamesRight,
      leftEnd,
      rightEnd,
    },
    gamePointSide,
    matchPointSide,
    intervalDue,
    courtChangeRequired,
    endsChangeDue,
    endsFlipCount: flipCount,
    intervalThreshold,
    scoringBlocked,
    scoringBlockReason,
  };
}
