/**
 * Human-readable Match Format labels for organizer UI.
 * Display-only — does not affect scoring or persistence.
 */

import type { BadmintonMatchFormat } from "@workspace/badminton-core";
import { winByFromDeuceAt } from "@workspace/badminton-core";

function gamesLine(totalGames: number): string {
  if (totalGames === 1) return "Single Game";
  return `Best of ${totalGames} Games`;
}

/** Compact chip: "Best of 3 • 21 Points" or "Fast Match • 15 Points". */
export function matchFormatChipLabel(
  format: BadmintonMatchFormat,
  presetId?: string | null,
): string {
  const points = `${format.pointsPerGame} Points`;
  if (presetId === "fast_match") return `Fast Match • ${points}`;
  if (presetId === "single_game") return `Single Game • ${points}`;
  if (presetId === "standard_bwf") {
    return format.totalGames === 1
      ? `Single Game • ${points}`
      : `Best of ${format.totalGames} • ${points}`;
  }
  if (presetId === "custom") {
    const games =
      format.totalGames === 1 ? "Single Game" : `Best of ${format.totalGames}`;
    return `Custom • ${games} • ${points}`;
  }
  return format.totalGames === 1
    ? `Single Game • ${points}`
    : `Best of ${format.totalGames} • ${points}`;
}

export type MatchFormatSummaryLine = { label: string; value: string };

/** Full readable summary lines for the Match Format page. */
export function matchFormatSummaryLines(
  format: BadmintonMatchFormat,
): MatchFormatSummaryLine[] {
  const winBy = winByFromDeuceAt(format.pointsPerGame, format.deuceAt);
  const lines: MatchFormatSummaryLine[] = [
    { label: "Games", value: gamesLine(format.totalGames) },
    { label: "Points", value: `${format.pointsPerGame} Points` },
    {
      label: "Win by",
      value: winBy === 1 ? "Win by 1 Point" : `Win by ${winBy} Points`,
    },
    { label: "Maximum score", value: `Maximum ${format.maxPoints}` },
  ];

  if (format.totalGames > 1) {
    lines.push({
      label: "Side change",
      value: format.midGameSideChange
        ? "Final Game Side Change On"
        : "Final Game Side Change Off",
    });
  }

  return lines;
}
