/**
 * Scorer assistance — read-only derivations for operator UI.
 * Does not mutate match state or scoring logic.
 */

import type { BadmintonMatchState, BadmintonSide } from "../types";
import { getSidePlayerSlots, isPairMatchKind } from "../side-utils";
import {
  currentReceiverLabel,
  currentServerLabel,
  sideInfoFor,
} from "./display-utils";
import {
  gamesNeededToWin,
  getCurrentGame,
  isDecidingGame,
  isGameOver,
  sideChangeScore,
} from "../reducer/state";
import { opposingSide } from "./doubles-court";

export type ScorerBannerKind =
  | "game_point"
  | "match_point"
  | "interval_due"
  | "court_change_required"
  | "game_completed"
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
  intervalThreshold: number;
  scoringBlocked: boolean;
  scoringBlockReason: "interval" | "court_change" | "timeout" | "paused" | null;
};

export type VoiceAssistPrompt =
  | "Game Point"
  | "Match Point"
  | "Interval"
  | "Court Change";

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

export function resolveServiceCourt(state: BadmintonMatchState): string | null {
  if (state.matchStatus !== "live") return null;

  if (isPairMatchKind(state.matchKind)) {
    const ds = state.doublesServe;
    if (!ds) return null;
    const positions = ds.courtPositions[ds.servingSide];
    const inRightCourt = ds.servingPlayerIndex === positions.rightCourtPlayerIndex;
    return inRightCourt ? "Right service court" : "Left service court";
  }

  return state.servingSide === "left" ? "Left side" : "Right side";
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
  return isIntervalDue(state);
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
  const intervalThreshold = sideChangeScore(state.format.pointsPerGame);
  const intervalDisplayPoints = intervalThreshold;
  const courtChangeAcknowledged = opts?.courtChangeAcknowledged ?? false;
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
    },
    gamePointSide,
    matchPointSide,
    intervalDue,
    courtChangeRequired,
    intervalThreshold,
    scoringBlocked,
    scoringBlockReason,
  };
}
