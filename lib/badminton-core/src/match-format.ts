import type { BadmintonMatchFormat } from "./types";
import { STANDARD_FORMAT } from "./types";

/** Preset ids shown in the Scoring Format UI. */
export type BadmintonFormatPresetId =
  | "standard_bwf"
  | "fast_match"
  | "single_game"
  | "custom";

export const BADMINTON_FORMAT_PRESET_META: Record<
  BadmintonFormatPresetId,
  { label: string; summary: string }
> = {
  standard_bwf: {
    label: "Standard BWF",
    summary: "Best of 3 • 21 points • Win by 2 • Cap 30",
  },
  fast_match: {
    label: "Fast Match",
    summary: "Best of 3 • 15 points • Win by 2",
  },
  single_game: {
    label: "Single Game",
    summary: "1 game • 21 points",
  },
  custom: {
    label: "Custom",
    summary: "Configure games, points, and win-by yourself",
  },
};

export const BADMINTON_FORMAT_PRESETS: Record<
  Exclude<BadmintonFormatPresetId, "custom">,
  BadmintonMatchFormat
> = {
  standard_bwf: STANDARD_FORMAT,
  fast_match: {
    totalGames: 3,
    pointsPerGame: 15,
    deuceAt: 14,
    maxPoints: 21,
    midGameSideChange: true,
  },
  single_game: {
    totalGames: 1,
    pointsPerGame: 21,
    deuceAt: 20,
    maxPoints: 30,
    midGameSideChange: false,
  },
};

export function isBadmintonFormatPresetId(value: string): value is BadmintonFormatPresetId {
  return value === "standard_bwf"
    || value === "fast_match"
    || value === "single_game"
    || value === "custom";
}

/** Derive deuce threshold from points + win-by margin. */
export function deuceAtFromWinBy(pointsPerGame: number, winBy: number): number {
  const margin = Math.max(1, Math.floor(winBy));
  return pointsPerGame - (margin - 1);
}

/** Infer win-by from stored deuceAt (best-effort for UI). */
export function winByFromDeuceAt(pointsPerGame: number, deuceAt: number): number {
  return Math.max(1, pointsPerGame - deuceAt + 1);
}

export function normalizeBadmintonFormat(
  input: Partial<BadmintonMatchFormat> & Pick<BadmintonMatchFormat, "totalGames" | "pointsPerGame">,
): BadmintonMatchFormat {
  const totalGames = ([1, 3, 5] as const).includes(input.totalGames as 1 | 3 | 5)
    ? (input.totalGames as 1 | 3 | 5)
    : 3;
  const pointsPerGame = Math.max(1, Math.floor(input.pointsPerGame) || 21);
  const deuceAt =
    typeof input.deuceAt === "number" && input.deuceAt >= 1
      ? Math.min(input.deuceAt, pointsPerGame)
      : deuceAtFromWinBy(pointsPerGame, 2);
  const maxPoints =
    typeof input.maxPoints === "number" && input.maxPoints >= pointsPerGame
      ? Math.floor(input.maxPoints)
      : Math.max(pointsPerGame, pointsPerGame + 9);
  const midGameSideChange =
    typeof input.midGameSideChange === "boolean"
      ? input.midGameSideChange
      : totalGames > 1;

  return {
    totalGames,
    pointsPerGame,
    deuceAt,
    maxPoints,
    midGameSideChange,
  };
}

export function parseBadmintonMatchFormat(raw: unknown): BadmintonMatchFormat | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.totalGames !== "number" || typeof obj.pointsPerGame !== "number") {
    return null;
  }
  return normalizeBadmintonFormat({
    totalGames: obj.totalGames,
    pointsPerGame: obj.pointsPerGame,
    deuceAt: typeof obj.deuceAt === "number" ? obj.deuceAt : undefined,
    maxPoints: typeof obj.maxPoints === "number" ? obj.maxPoints : undefined,
    midGameSideChange:
      typeof obj.midGameSideChange === "boolean" ? obj.midGameSideChange : undefined,
  });
}

export function badmintonFormatFromPreset(
  presetId: BadmintonFormatPresetId,
  custom?: Partial<BadmintonMatchFormat>,
): BadmintonMatchFormat {
  if (presetId === "custom") {
    return normalizeBadmintonFormat({
      totalGames: custom?.totalGames ?? 3,
      pointsPerGame: custom?.pointsPerGame ?? 21,
      deuceAt: custom?.deuceAt,
      maxPoints: custom?.maxPoints,
      midGameSideChange: custom?.midGameSideChange,
    });
  }
  return { ...BADMINTON_FORMAT_PRESETS[presetId] };
}

function bestOfLabel(totalGames: number): string {
  if (totalGames === 1) return "Single Game";
  return `Best of ${totalGames}`;
}

/** Human-readable chip: "Best of 3 • 21 Points" or "Custom • Best of 5 • 11 Points". */
export function formatBadmintonMatchLabel(
  format: BadmintonMatchFormat,
  presetId?: string | null,
): string {
  const core = `${bestOfLabel(format.totalGames)} • ${format.pointsPerGame} Points`;
  if (presetId === "custom") return `Custom • ${core}`;
  return core;
}

export function buildBadmintonFormatFromCustomInputs(input: {
  totalGames: 1 | 3 | 5;
  pointsPerGame: number;
  winBy: number;
  maxPoints?: number | null;
  midGameSideChange: boolean;
}): BadmintonMatchFormat {
  const pointsPerGame = Math.max(1, Math.floor(input.pointsPerGame) || 21);
  const winBy = Math.max(1, Math.floor(input.winBy) || 2);
  const deuceAt = deuceAtFromWinBy(pointsPerGame, winBy);
  const maxPoints =
    input.maxPoints == null || input.maxPoints === undefined
      ? Math.max(pointsPerGame, pointsPerGame + 9)
      : Math.max(pointsPerGame, Math.floor(input.maxPoints));

  return normalizeBadmintonFormat({
    totalGames: input.totalGames,
    pointsPerGame,
    deuceAt,
    maxPoints,
    midGameSideChange: input.totalGames === 1 ? false : input.midGameSideChange,
  });
}
