/**
 * Buzz Studio — Team Squad Template Utilities
 */

import type { TeamSquadContract, TeamSquadPlayerEntry } from "./TeamSquad.types";
import type { BuzzAspectRatio } from "../../rendering/buzz-render-context";

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
