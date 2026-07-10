/**
 * Buzz Studio — Team Squad Template Utilities
 *
 * Responsive roster layout for all four export ratios.
 * Fonts and row heights scale to fit — names and prices never truncate.
 */

import type { TeamSquadContract, TeamSquadPlayerEntry } from "./TeamSquad.types";
import type { BuzzAspectRatio, BuzzRenderContext } from "../../rendering/buzz-render-context";
import {
  formatBuzzPrice,
  resolveBuzzAuctionUnit,
} from "../../lib/format-buzz-price";

export function formatSquadPlayerPrice(
  entry: TeamSquadPlayerEntry,
  unitOrCurrency = "rupee",
): string | null {
  if (entry.priceDisplay) return entry.priceDisplay;
  if (entry.price == null) return null;
  return formatBuzzPrice(entry.price, resolveBuzzAuctionUnit(unitOrCurrency));
}

export function squadCounts(contract: TeamSquadContract): {
  sold: number;
  retained: number;
  total: number;
} {
  let sold = 0;
  let retained = 0;
  for (const player of contract.players) {
    if (player.status === "retained") retained += 1;
    else sold += 1;
  }
  return { sold, retained, total: contract.players.length };
}

/**
 * Column count — prefer 2 columns once the squad gets dense so rows stay readable.
 * Landscape always uses at least 2 when there are enough players.
 */
export function rosterGridColumns(
  aspectRatio: BuzzAspectRatio,
  playerCount: number,
): number {
  if (aspectRatio === "16:9") {
    if (playerCount <= 4) return 2;
    if (playerCount <= 10) return 3;
    return 4;
  }
  if (aspectRatio === "1:1") {
    return playerCount >= 5 ? 2 : 1;
  }
  if (aspectRatio === "4:5") {
    return playerCount >= 6 ? 2 : 1;
  }
  // 9:16
  return playerCount >= 7 ? 2 : 1;
}

/** Vertical budget for roster area (fraction of canvas height). */
function rosterHeightBudget(
  aspectRatio: BuzzAspectRatio,
  landscape: boolean,
): number {
  if (landscape) return 0.72;
  if (aspectRatio === "9:16") return 0.55;
  if (aspectRatio === "4:5") return 0.58;
  return 0.56;
}

export interface SquadRosterLayout {
  columns: number;
  avatarSize: number;
  rowGap: number;
  rowPaddingY: number;
  rowPaddingX: number;
  nameSize: number;
  priceSize: number;
  metaSize: number;
  rowMinHeight: number;
  priceAreaWidth: number;
  nameAreaWidth: number;
}

function estimateTextWidth(charCount: number, fontSize: number, factor = 0.58): number {
  return charCount * fontSize * factor;
}

function fitFontToWidth(
  charCount: number,
  availableWidth: number,
  preferredSize: number,
  minSize: number,
  factor = 0.58,
): number {
  let size = preferredSize;
  while (size > minSize && estimateTextWidth(charCount, size, factor) > availableWidth) {
    size -= 1;
  }
  return size;
}

export function longestSquadPriceLength(
  players: TeamSquadPlayerEntry[],
  unitOrCurrency = "rupee",
): number {
  let max = 5;
  for (const player of players) {
    const formatted = formatSquadPlayerPrice(player, unitOrCurrency);
    if (formatted) max = Math.max(max, formatted.length);
  }
  return max;
}

function longestSquadNameLength(players: TeamSquadPlayerEntry[]): number {
  let max = 8;
  for (const player of players) {
    max = Math.max(max, player.playerName.length);
  }
  return max;
}

/**
 * Scale roster so the full squad fits the canvas for any ratio.
 * Name + price fonts shrink together until both fit without clipping.
 */
export function computeSquadRosterLayout(
  ctx: BuzzRenderContext,
  players: TeamSquadPlayerEntry[],
  unitOrCurrency = "rupee",
): SquadRosterLayout {
  const playerCount = Math.max(1, players.length);
  const landscape = ctx.aspectRatio === "16:9";
  const columns = rosterGridColumns(ctx.aspectRatio, playerCount);
  const rows = Math.max(1, Math.ceil(playerCount / columns));
  const budget = rosterHeightBudget(ctx.aspectRatio, landscape) * ctx.renderHeight;
  const baseGap = Math.max(3, Math.round(ctx.renderHeight * 0.005));
  const totalGap = baseGap * Math.max(0, rows - 1);
  const rowMinHeight = Math.max(32, Math.floor((budget - totalGap) / rows));

  const avatarSize = Math.max(
    22,
    Math.min(
      Math.round(rowMinHeight * 0.7),
      landscape ? Math.round(ctx.renderHeight * 0.095) : Math.round(ctx.renderHeight * 0.042),
    ),
  );

  const rowPaddingY = Math.max(3, Math.round(rowMinHeight * 0.08));
  const rowPaddingX = Math.max(5, Math.round(ctx.renderWidth * 0.012));
  const metaSize = Math.max(7, Math.round(rowMinHeight * 0.15));

  const canvasPadX = Math.round(ctx.renderWidth * 0.05) * 2;
  const rowInnerWidth = Math.max(100, (ctx.renderWidth - canvasPadX) / columns - 4);
  const gapBudget = avatarSize + rowPaddingX * 2 + Math.round(rowPaddingX * 0.6);
  const contentWidth = Math.max(80, rowInnerWidth - gapBudget);

  // Split content: ~52% name / ~48% price — then fit fonts to each slot.
  const nameAreaWidth = Math.max(48, Math.round(contentWidth * 0.52));
  const priceAreaWidth = Math.max(56, Math.round(contentWidth * 0.48));

  const maxNameChars = longestSquadNameLength(players);
  const maxPriceChars = longestSquadPriceLength(players, unitOrCurrency);

  // Names may wrap to 2 lines — fit against ~1.85× single-line width budget.
  const preferredName = Math.max(11, Math.round(rowMinHeight * 0.28));
  const minName = Math.max(9, Math.round(rowMinHeight * 0.16));
  const nameSize = fitFontToWidth(
    maxNameChars,
    Math.round(nameAreaWidth * 1.85),
    preferredName,
    minName,
    0.55,
  );

  const preferredPrice = Math.max(12, Math.round(rowMinHeight * 0.42));
  const minPrice = Math.max(10, Math.round(metaSize * 1.2));
  const priceSize = fitFontToWidth(maxPriceChars, priceAreaWidth, preferredPrice, minPrice, 0.62);

  return {
    columns,
    avatarSize,
    rowGap: baseGap,
    rowPaddingY,
    rowPaddingX,
    nameSize,
    priceSize,
    metaSize,
    rowMinHeight,
    priceAreaWidth,
    nameAreaWidth,
  };
}

/**
 * Tournament title: ~80% of base poster size, shrink further so it fits in max 2 lines.
 */
export function fitTournamentTitleSize(
  name: string,
  availableWidth: number,
  preferredSize: number,
  maxLines = 2,
): number {
  const minSize = Math.max(9, Math.round(preferredSize * 0.55));
  const target = Math.max(minSize, Math.round(preferredSize * 0.8));
  const upper = name.toUpperCase();

  for (let size = target; size >= minSize; size -= 1) {
    const charWidth = size * 0.55;
    const charsPerLine = Math.max(1, Math.floor(availableWidth / charWidth));
    const linesNeeded = Math.ceil(upper.length / charsPerLine);
    if (linesNeeded <= maxLines) return size;
  }
  return minSize;
}

/**
 * Team name: larger display size, shrink to fit up to 2 lines.
 */
export function fitTeamTitleSize(
  name: string,
  availableWidth: number,
  preferredSize: number,
  maxLines = 2,
): number {
  const minSize = Math.max(12, Math.round(preferredSize * 0.55));
  const upper = name.toUpperCase();

  for (let size = preferredSize; size >= minSize; size -= 1) {
    const charWidth = size * 0.56;
    const charsPerLine = Math.max(1, Math.floor(availableWidth / charWidth));
    const linesNeeded = Math.ceil(upper.length / charsPerLine);
    if (linesNeeded <= maxLines) return size;
  }
  return minSize;
}

export function isMarqueePlayerTag(tag: string | null | undefined): boolean {
  return tag === "icon" || tag === "star_player";
}

/** Lightweight tag chrome for squad rows (mirrors lib/tag-theme for icon/star). */
export function squadTagTheme(
  tag: string | null | undefined,
): { color: string; glow: string; border: string; label: string } | null {
  if (tag === "icon") {
    return {
      color: "#fbbf24",
      glow: "rgba(251,191,36,0.45)",
      border: "rgba(251,191,36,0.40)",
      label: "Icon",
    };
  }
  if (tag === "star_player") {
    return {
      color: "#a855f7",
      glow: "rgba(168,85,247,0.40)",
      border: "rgba(168,85,247,0.40)",
      label: "Star Player",
    };
  }
  return null;
}
