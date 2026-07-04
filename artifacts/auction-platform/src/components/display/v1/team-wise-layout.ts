import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { formatAuctionAmount, formatShortAuctionAmount } from "@workspace/api-base/auction-unit";
import type { LedPlayer, LedTeam } from "@/lib/led-view/types";

export type PlayerPoolCounts = {
  available: number;
  /** Pre-auction retained players only. */
  retained: number;
  /** Auction sold + retained — every player on a team roster. */
  sold: number;
  unsold: number;
};

/** Count players by auction roster status for the team-wise summary strip. */
export function countPlayerPoolByStatus(players: readonly LedPlayer[]): PlayerPoolCounts {
  let available = 0;
  let retained = 0;
  let soldAtAuction = 0;
  let unsold = 0;
  for (const p of players) {
    switch (p.status) {
      case "sold":
        soldAtAuction++;
        break;
      case "retained":
        retained++;
        break;
      case "unsold":
        unsold++;
        break;
      default:
        available++;
        break;
    }
  }
  return {
    available,
    retained,
    sold: soldAtAuction + retained,
    unsold,
  };
}

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
    /** Hero — purse left (priority 1) */
    heroPurse: `clamp(1.15rem, ${2.95 * s + 0.92}vw, 3.1rem)`,
    name:      `clamp(1.08rem, ${3.25 * s + 0.98}vw, 3.65rem)`,
    purse:     `clamp(0.95rem, ${2.4 * s + 0.75}vw, 2.6rem)`,
    spendable: `clamp(0.82rem, ${2.0 * s + 0.62}vw, 2.15rem)`,
    money:     `clamp(0.68rem, ${1.45 * s + 0.52}vw, 1.72rem)`,
    squad:     `clamp(1rem,   ${2.55 * s + 0.82}vw, 2.85rem)`,
    label:     `clamp(0.66rem, ${0.78 * s + 0.56}vw, 0.92rem)`,
    meta:      `clamp(0.64rem, ${0.76 * s + 0.52}vw, 0.9rem)`,
    badge:     `clamp(0.72rem, ${0.88 * s + 0.62}vw, 1.02rem)`,
    /** ~20% larger franchise badge */
    logo:      `clamp(2.1rem,  ${5.04 * s + 1.62}vw, 6rem)`,
  };
}

/** Elevated glass card shell — layered charcoal with team-tinted border glow. */
export function getTeamWisePanelShellStyle(teamColor: string, isActive = false) {
  const accentMix = `color-mix(in srgb, ${teamColor} ${isActive ? "38%" : "24%"}, rgba(212,175,55,0.18))`;
  return {
    ["--tw-panel-color" as string]: teamColor,
    background: [
      `linear-gradient(172deg, color-mix(in srgb, ${teamColor} 16%, rgba(14,17,26,0.98)) 0%, rgba(8,10,16,0.99) 45%, rgba(4,6,11,1) 100%)`,
    ].join(", "),
    borderColor: accentMix,
    boxShadow: isActive
      ? [
          "0 18px 48px rgba(0,0,0,0.68)",
          "inset 0 1px 0 rgba(255,255,255,0.1)",
          "inset 0 -2px 12px rgba(0,0,0,0.5)",
          `0 0 0 1px ${accentMix}`,
          `0 0 56px color-mix(in srgb, ${teamColor} 26%, transparent)`,
        ].join(", ")
      : [
          "0 12px 36px rgba(0,0,0,0.58)",
          "inset 0 1px 0 rgba(255,255,255,0.07)",
          "inset 0 -2px 10px rgba(0,0,0,0.42)",
          `0 0 0 1px color-mix(in srgb, ${teamColor} 18%, rgba(255,255,255,0.06))`,
          `0 0 28px color-mix(in srgb, ${teamColor} 10%, transparent)`,
        ].join(", "),
  };
}

/** Metallic franchise banner — layered gradient, gold edge, depth. */
export function getTeamWiseHeaderBandStyle(teamColor: string) {
  return {
    ["--tw-header-color" as string]: teamColor,
    background: [
      `linear-gradient(128deg, color-mix(in srgb, ${teamColor} 82%, #ffffff 10%) 0%, color-mix(in srgb, ${teamColor} 95%, #000000 12%) 38%, color-mix(in srgb, ${teamColor} 72%, #0a0e18 28%) 72%, color-mix(in srgb, ${teamColor} 48%, #050810 52%) 100%)`,
    ].join(", "),
    boxShadow: [
      `0 8px 24px color-mix(in srgb, ${teamColor} 32%, transparent)`,
      "inset 0 2px 0 rgba(255,255,255,0.32)",
      "inset 0 -4px 12px rgba(0,0,0,0.42)",
      "inset 0 0 0 1px rgba(212,175,55,0.28)",
    ].join(", "),
  };
}

/** Hero purse amount — gold broadcast figure. */
export function getTeamWisePurseValueStyle(isPrimary = true) {
  return {
    color: isPrimary ? "#f7dc8a" : undefined,
    textShadow: isPrimary
      ? "0 0 28px rgba(212,175,55,0.32), 0 2px 4px rgba(0,0,0,0.72), 0 0 1px rgba(0,0,0,0.9)"
      : undefined,
  };
}

export function getTeamWiseProgressTrackStyle(teamColor: string) {
  return {
    background: `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, color-mix(in srgb, ${teamColor} 8%, rgba(255,255,255,0.06)) 100%)`,
    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)",
  };
}

export function getTeamWiseProgressFillStyle(teamColor: string) {
  return {
    background: `linear-gradient(90deg, color-mix(in srgb, ${teamColor} 55%, #000) 0%, ${teamColor} 42%, color-mix(in srgb, ${teamColor} 80%, #fff 14%) 78%, color-mix(in srgb, ${teamColor} 65%, #fff 8%) 100%)`,
    boxShadow: `0 0 14px color-mix(in srgb, ${teamColor} 38%, transparent), inset 0 2px 0 rgba(255,255,255,0.32)`,
  };
}

export type TeamWiseStatus = {
  label: string;
  dotClass: string;
  badgeClass: string;
};

export function getTeamWiseStatus(team: LedTeam, minimumBid: number): TeamWiseStatus {
  const isFull = team.maximumSquadSize > 0 && team.playersBought >= team.maximumSquadSize;
  if (isFull) {
    return {
      label: "FULL",
      dotClass: "team-wise-badge-dot team-wise-badge-dot--full",
      badgeClass: "team-wise-badge team-wise-badge--full",
    };
  }
  if (team.playersBought === 0) {
    return {
      label: "YET TO BUY",
      dotClass: "team-wise-badge-dot team-wise-badge-dot--ready",
      badgeClass: "team-wise-badge team-wise-badge--ready",
    };
  }
  if (minimumBid > 0 && team.maxBidAllowed < minimumBid) {
    return {
      label: "BUDGET LOW",
      dotClass: "team-wise-badge-dot team-wise-badge-dot--alert",
      badgeClass: "team-wise-badge team-wise-badge--alert",
    };
  }
  if (
    team.maximumSquadSize === 0 &&
    team.minimumSquadSize > 0 &&
    team.playersBought >= team.minimumSquadSize
  ) {
    return {
      label: "MIN MET",
      dotClass: "team-wise-badge-dot team-wise-badge-dot--ok",
      badgeClass: "team-wise-badge team-wise-badge--ok",
    };
  }
  const slots = team.slotsRemaining;
  return {
    label: slots === 1 ? "1 SLOT LEFT" : `${slots} SLOTS LEFT`,
    dotClass: "team-wise-badge-dot team-wise-badge-dot--slots",
    badgeClass: "team-wise-badge team-wise-badge--slots",
  };
}

export function formatTeamWiseMoney(value: number, unit: AuctionUnit = "rupee") {
  return formatAuctionAmount(value, unit);
}

/** Short form for stat blocks — ₹4.60Cr / ₹12.50L or points equivalent */
export function formatTeamWiseMoneyShort(value: number, unit: AuctionUnit = "rupee") {
  return formatShortAuctionAmount(value, unit);
}
