/**
 * Buzz Studio — Team Squad Template Utilities
 *
 * Preset layout engine for Team Squad creatives across player count tiers:
 * - Tier 1: < 8 players (spacious layout)
 * - Tier 2: 8–11 players (standard squad)
 * - Tier 3: 12–16+ players (dense squad)
 *
 * Provides uniform typography, zero letter-breaking, and clean data hierarchy.
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

export type SquadPlayerTier = "under8" | "tier8to11" | "tier12to16";

export function resolveSquadPlayerTier(playerCount: number): SquadPlayerTier {
  if (playerCount < 8) return "under8";
  if (playerCount <= 11) return "tier8to11";
  return "tier12to16";
}

export interface SquadLayoutPreset {
  columns: number;
  rowHeight: number;
  avatarSize: number;
  nameSize: number;
  priceSize: number;
  statusSize: number;
  rowGap: number;
  rowPaddingX: number;
  rowPaddingY: number;
  gapInsideRow: number;
  priceAreaWidth: number;
}

/** Backward compatibility alias */
export type SquadRosterLayout = SquadLayoutPreset;

export function getSquadLayoutPreset(
  ctx: BuzzRenderContext,
  playerCount: number,
  hasSponsors = false,
): SquadLayoutPreset {
  const count = Math.max(1, playerCount);
  const tier = resolveSquadPlayerTier(count);
  const { aspectRatio, renderHeight } = ctx;

  // 1. Landscape (16:9)
  if (aspectRatio === "16:9") {
    let columns = 3;
    if (tier === "under8") columns = count <= 4 ? 2 : 3;
    else if (tier === "tier12to16") columns = 4;

    const rows = Math.max(1, Math.ceil(count / columns));
    const availableHeight = renderHeight * 0.78;
    const rowGap = 10;
    const rowHeight = Math.max(54, Math.floor((availableHeight - rowGap * (rows - 1)) / rows));

    const avatarSize = Math.max(42, Math.min(84, Math.round(rowHeight * 0.74)));
    const nameSize = tier === "under8" ? 22 : tier === "tier8to11" ? 19 : 16;
    const priceSize = tier === "under8" ? 24 : tier === "tier8to11" ? 22 : 18;
    const statusSize = Math.max(9, Math.round(nameSize * 0.58));

    return {
      columns,
      rowHeight,
      avatarSize,
      nameSize,
      priceSize,
      statusSize,
      rowGap,
      rowPaddingX: 12,
      rowPaddingY: 8,
      gapInsideRow: 10,
      priceAreaWidth: 125,
    };
  }

  // 2. 9:16 (1080 x 1920)
  if (aspectRatio === "9:16") {
    const columns = tier === "under8" && count <= 5 ? 1 : 2;
    const rows = Math.max(1, Math.ceil(count / columns));
    const availableHeight = renderHeight * (hasSponsors ? 0.72 : 0.76);
    const rowGap = 12;
    const rowHeight = Math.max(64, Math.floor((availableHeight - rowGap * (rows - 1)) / rows));

    const avatarSize = Math.max(56, Math.min(115, Math.round(rowHeight * 0.75)));
    const nameSize = tier === "under8" ? (columns === 1 ? 30 : 26) : tier === "tier8to11" ? 25 : 21;
    const priceSize = tier === "under8" ? (columns === 1 ? 36 : 30) : tier === "tier8to11" ? 28 : 24;
    const statusSize = Math.max(10, Math.round(nameSize * 0.52));

    return {
      columns,
      rowHeight,
      avatarSize,
      nameSize,
      priceSize,
      statusSize,
      rowGap,
      rowPaddingX: 14,
      rowPaddingY: 10,
      gapInsideRow: 12,
      priceAreaWidth: 145,
    };
  }

  // 3. 4:5 (1080 x 1350)
  if (aspectRatio === "4:5") {
    const columns = tier === "under8" && count <= 4 ? 1 : 2;
    const rows = Math.max(1, Math.ceil(count / columns));
    const availableHeight = renderHeight * (hasSponsors ? 0.66 : 0.70);
    const rowGap = 8;
    const rowHeight = Math.max(52, Math.floor((availableHeight - rowGap * (rows - 1)) / rows));

    const avatarSize = Math.max(44, Math.min(94, Math.round(rowHeight * 0.75)));
    const nameSize = tier === "under8" ? (columns === 1 ? 26 : 22) : tier === "tier8to11" ? 21 : 18;
    const priceSize = tier === "under8" ? (columns === 1 ? 30 : 26) : tier === "tier8to11" ? 25 : 21;
    const statusSize = Math.max(9, Math.round(nameSize * 0.54));

    return {
      columns,
      rowHeight,
      avatarSize,
      nameSize,
      priceSize,
      statusSize,
      rowGap,
      rowPaddingX: 12,
      rowPaddingY: 8,
      gapInsideRow: 10,
      priceAreaWidth: 135,
    };
  }

  // 4. 1:1 (1080 x 1080)
  const columns = tier === "under8" && count <= 4 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(count / columns));
  const availableHeight = renderHeight * (hasSponsors ? 0.62 : 0.66);
  const rowGap = 6;
  const rowHeight = Math.max(48, Math.floor((availableHeight - rowGap * (rows - 1)) / rows));

  const avatarSize = Math.max(38, Math.min(76, Math.round(rowHeight * 0.74)));
  const nameSize = tier === "under8" ? (columns === 1 ? 22 : 18) : tier === "tier8to11" ? 18 : 15;
  const priceSize = tier === "under8" ? (columns === 1 ? 25 : 21) : tier === "tier8to11" ? 20 : 17;
  const statusSize = Math.max(8, Math.round(nameSize * 0.54));

  return {
    columns,
    rowHeight,
    avatarSize,
    nameSize,
    priceSize,
    statusSize,
    rowGap,
    rowPaddingX: 10,
    rowPaddingY: 6,
    gapInsideRow: 8,
    priceAreaWidth: 120,
  };
}

/** Backward compatibility helper */
export function computeSquadRosterLayout(
  ctx: BuzzRenderContext,
  players: TeamSquadPlayerEntry[],
  _unitOrCurrency = "rupee",
  hasSponsors = false,
): SquadLayoutPreset {
  return getSquadLayoutPreset(ctx, players.length, hasSponsors);
}

/** Backward compatibility helper */
export function rosterGridColumns(
  aspectRatio: BuzzAspectRatio,
  playerCount: number,
): number {
  if (aspectRatio === "16:9") {
    if (playerCount <= 4) return 2;
    if (playerCount <= 9) return 3;
    return 4;
  }
  return playerCount <= 4 ? 1 : 2;
}

export function longestSquadPriceLength(
  players: TeamSquadPlayerEntry[],
  unitOrCurrency = "rupee",
): number {
  let max = 6;
  for (const player of players) {
    const formatted = formatSquadPlayerPrice(player, unitOrCurrency);
    if (formatted) max = Math.max(max, formatted.length);
  }
  return max;
}

export function isMarqueePlayerTag(tag: string | null | undefined): boolean {
  return tag === "icon" || tag === "star_player";
}

export function squadTagTheme(
  tag: string | null | undefined,
): { color: string; glow: string; border: string; label: string } | null {
  if (tag === "icon") {
    return {
      color: "#fbbf24",
      glow: "rgba(251,191,36,0.45)",
      border: "rgba(251,191,36,0.50)",
      label: "Icon",
    };
  }
  if (tag === "star_player") {
    return {
      color: "#a855f7",
      glow: "rgba(168,85,247,0.40)",
      border: "rgba(168,85,247,0.50)",
      label: "Star Player",
    };
  }
  return null;
}

/** Tournament title: shrink so it fits in max 2 lines. */
export function fitTournamentTitleSize(
  name: string,
  availableWidth: number,
  preferredSize: number,
  maxLines = 2,
): number {
  const minSize = Math.max(11, Math.round(preferredSize * 0.55));
  const target = Math.max(minSize, Math.round(preferredSize * 0.85));
  const upper = name.toUpperCase();

  for (let size = target; size >= minSize; size -= 1) {
    const charWidth = size * 0.55;
    const charsPerLine = Math.max(1, Math.floor(availableWidth / charWidth));
    const linesNeeded = Math.ceil(upper.length / charsPerLine);
    if (linesNeeded <= maxLines) return size;
  }
  return minSize;
}

/** Team name: prominent display size, shrink to fit up to 2 lines. */
export function fitTeamTitleSize(
  name: string,
  availableWidth: number,
  preferredSize: number,
  maxLines = 2,
): number {
  const minSize = Math.max(14, Math.round(preferredSize * 0.55));
  const upper = name.toUpperCase();

  for (let size = preferredSize; size >= minSize; size -= 1) {
    const charWidth = size * 0.56;
    const charsPerLine = Math.max(1, Math.floor(availableWidth / charWidth));
    const linesNeeded = Math.ceil(upper.length / charsPerLine);
    if (linesNeeded <= maxLines) return size;
  }
  return minSize;
}
