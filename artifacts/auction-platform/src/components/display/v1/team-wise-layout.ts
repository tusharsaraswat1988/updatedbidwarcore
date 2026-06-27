import type { LedTeam } from "@/lib/led-view/types";

export function computeTeamWiseGrid(teamCount: number) {
  const n = Math.max(teamCount, 1);
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: Math.ceil(n / 3) };
  if (n <= 8) return { cols: 4, rows: Math.ceil(n / 4) };
  if (n === 9) return { cols: 3, rows: 3 };
  return { cols: 5, rows: Math.ceil(n / 5) };
}

export function getTeamWiseTypography(rows: number) {
  const s = 1 / rows;
  return {
    name:  `clamp(0.9rem,  ${2.8 * s + 0.85}vw, 3.2rem)`,
    purse: `clamp(0.75rem, ${2.0 * s + 0.65}vw, 2.2rem)`,
    money: `clamp(0.65rem, ${1.5 * s + 0.55}vw, 1.7rem)`,
    squad: `clamp(0.85rem, ${2.2 * s + 0.7}vw,  2.5rem)`,
    label: `clamp(0.84rem, ${1.0 * s + 0.76}vw, 1.24rem)`,
    meta:  `clamp(0.74rem, ${0.9 * s + 0.66}vw, 1.12rem)`,
    badge: `clamp(0.78rem, ${0.96 * s + 0.70}vw, 1.16rem)`,
    logo:  `clamp(1.5rem,  ${3.8 * s + 1.2}vw,  4.5rem)`,
  };
}

export type TeamWiseStatus = {
  label: string;
  dotClass: string;
  badgeClass: string;
};

export function getTeamWiseStatus(team: LedTeam, minimumBid: number): TeamWiseStatus {
  const isFull = team.maximumSquadSize > 0 && team.slotsRemaining === 0;
  if (isFull) {
    return {
      label: "FULL",
      dotClass: "bg-emerald-400",
      badgeClass: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (team.playersBought === 0) {
    return {
      label: "YET TO BUY",
      dotClass: "bg-sky-400",
      badgeClass: "border-sky-400/35 bg-sky-500/10 text-sky-200",
    };
  }
  if (minimumBid > 0 && team.maxBidAllowed < minimumBid) {
    return {
      label: "BUDGET LOW",
      dotClass: "bg-red-400",
      badgeClass: "border-red-400/35 bg-red-500/10 text-red-300",
    };
  }
  const slots = team.slotsRemaining;
  return {
    label: slots === 1 ? "1 SLOT LEFT" : `${slots} SLOTS LEFT`,
    dotClass: "bg-amber-400",
    badgeClass: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  };
}

export function formatTeamWiseMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Short form for stat blocks — ₹4.60Cr / ₹12.50L / ₹60,000 */
export function formatTeamWiseMoneyShort(value: number) {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000)    return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}
