/**
 * Buzz Studio — Team Squad Template Utilities
 */

import type { TeamSquadContract, TeamSquadPlayerEntry } from "./TeamSquad.types";
import type { BuzzAspectRatio, BuzzRenderContext } from "../../rendering/buzz-render-context";

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

function formatINR(amount: number): string {
  const intStr = Math.round(amount).toString();
  if (intStr.length <= 3) return `₹${intStr}`;
  const lastThree = intStr.slice(-3);
  const remaining = intStr.slice(0, -3);
  const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${grouped},${lastThree}`;
}

export function formatSquadPlayerPrice(
  entry: TeamSquadPlayerEntry,
  currency = "INR",
): string | null {
  if (entry.priceDisplay) return entry.priceDisplay;
  if (entry.price == null) return null;
  if (currency === "INR") return formatINR(entry.price);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${Math.round(entry.price).toLocaleString("en-US")}`;
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

export function rosterGridColumns(
  aspectRatio: BuzzAspectRatio,
  playerCount: number,
): number {
  if (aspectRatio === "16:9") {
    if (playerCount <= 6) return 2;
    if (playerCount <= 12) return 3;
    return 4;
  }
  if (aspectRatio === "1:1") {
    return playerCount > 8 ? 2 : 1;
  }
  if (aspectRatio === "4:5") {
    return playerCount > 10 ? 2 : 1;
  }
  return 1;
}

/** Vertical budget ratios — header + footer reserved; roster fills the rest. */
function rosterHeightBudget(
  aspectRatio: BuzzAspectRatio,
  landscape: boolean,
): number {
  if (landscape) return 0.78;
  if (aspectRatio === "9:16") return 0.58;
  if (aspectRatio === "4:5") return 0.62;
  return 0.6;
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
}

/** Longest formatted price string length in the squad (for width fitting). */
export function longestSquadPriceLength(
  players: TeamSquadPlayerEntry[],
  currency = "INR",
): number {
  let max = 5;
  for (const player of players) {
    const formatted = formatSquadPlayerPrice(player, currency);
    if (formatted) max = Math.max(max, formatted.length);
  }
  return max;
}

/** Rough glyph width for bold currency strings (₹, digits, commas). */
function estimatePriceTextWidth(charCount: number, fontSize: number): number {
  // Slightly conservative so export never clips the last digit.
  return charCount * fontSize * 0.62;
}

function fitPriceFontSize(
  charCount: number,
  availableWidth: number,
  preferredSize: number,
  minSize: number,
): number {
  let size = preferredSize;
  while (size > minSize && estimatePriceTextWidth(charCount, size) > availableWidth) {
    size -= 1;
  }
  return size;
}

/**
 * Scale roster rows so the full squad fits inside the export canvas for any ratio.
 * Price font scales down when needed so amounts like ₹10,00,000 never truncate.
 */
export function computeSquadRosterLayout(
  ctx: BuzzRenderContext,
  players: TeamSquadPlayerEntry[],
  currency = "INR",
): SquadRosterLayout {
  const playerCount = players.length;
  const landscape = ctx.aspectRatio === "16:9";
  const columns = rosterGridColumns(ctx.aspectRatio, playerCount);
  const rows = Math.max(1, Math.ceil(playerCount / columns));
  const budget = rosterHeightBudget(ctx.aspectRatio, landscape) * ctx.renderHeight;
  const baseGap = Math.max(4, Math.round(ctx.renderHeight * 0.006));
  const totalGap = baseGap * Math.max(0, rows - 1);
  const rowMinHeight = Math.max(36, Math.floor((budget - totalGap) / rows));

  const avatarSize = Math.max(
    24,
    Math.min(
      Math.round(rowMinHeight * 0.72),
      landscape ? Math.round(ctx.renderHeight * 0.1) : Math.round(ctx.renderHeight * 0.045),
    ),
  );

  const rowPaddingY = Math.max(4, Math.round(rowMinHeight * 0.1));
  const rowPaddingX = Math.max(6, Math.round(ctx.renderWidth * 0.014));
  const metaSize = Math.max(8, Math.round(rowMinHeight * 0.16));
  const nameSize = Math.max(13, Math.round(rowMinHeight * 0.26));

  const canvasPadX = Math.round(ctx.renderWidth * 0.055) * 2;
  const rowInnerWidth = Math.max(120, (ctx.renderWidth - canvasPadX) / columns);
  const gapBudget = avatarSize + rowPaddingX * 2 + Math.round(rowPaddingX * 0.8);
  const priceAreaWidth = Math.max(80, Math.round((rowInnerWidth - gapBudget) * 0.5));
  const maxPriceChars = longestSquadPriceLength(players, currency);
  const preferredPrice = Math.round(metaSize * 2.8);
  const minPrice = Math.max(13, Math.round(metaSize * 1.35));
  const priceSize = fitPriceFontSize(maxPriceChars, priceAreaWidth, preferredPrice, minPrice);

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
  };
}
