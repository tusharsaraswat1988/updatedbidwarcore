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
    heroPurse: `clamp(1.35rem, ${3.4 * s + 1.15}vw, 3.6rem)`,
    name:      `clamp(1.15rem, ${3.2 * s + 1.0}vw, 3.5rem)`,
    purse:     `clamp(1.05rem, ${2.5 * s + 0.85}vw, 2.75rem)`,
    spendable: `clamp(1.1rem,  ${2.6 * s + 0.85}vw, 2.8rem)`,
    money:     `clamp(0.95rem, ${1.9 * s + 0.65}vw, 2.05rem)`,
    squad:     `clamp(1.25rem, ${3.0 * s + 1.0}vw, 3.4rem)`,
    label:     `clamp(0.78rem, ${0.95 * s + 0.58}vw, 1.15rem)`,
    meta:      `clamp(0.72rem, ${0.85 * s + 0.52}vw, 1.05rem)`,
    badge:     `clamp(0.8rem,  ${0.95 * s + 0.6}vw, 1.2rem)`,
    /** ~20% larger franchise badge */
    logo:      `clamp(2.4rem,  ${5.2 * s + 1.8}vw, 6.2rem)`,
    nameStyle: (name: string) => getTeamWiseNameStyle(name, rows),
  };
}

export function getTeamWiseNameStyle(name: string, rows: number) {
  const s = 1 / rows;
  const len = name.length;
  if (len > 22) {
    return {
      fontSize: `clamp(0.92rem, ${2.2 * s + 0.75}vw, 2.2rem)`,
      lineHeight: 1.05,
    };
  }
  if (len > 14) {
    return {
      fontSize: `clamp(1.05rem, ${2.7 * s + 0.88}vw, 2.8rem)`,
      lineHeight: 1.08,
    };
  }
  return {
    fontSize: `clamp(1.18rem, ${3.3 * s + 1.05}vw, 3.5rem)`,
    lineHeight: 1.1,
  };
}

/** Broadcast card shell — radial depth, team-tinted edge, floating shadow (body only). */
export function getTeamWisePanelShellStyle(teamColor: string, isActive = false) {
  const edgeTint = `color-mix(in srgb, ${teamColor} ${isActive ? "35%" : "22%"}, rgba(255,255,255,0.12))`;
  const ambientSpread = isActive ? "36px" : "24px";
  const ambientAlpha = isActive ? "0.18" : "0.1";

  return {
    ["--tw-panel-color" as string]: teamColor,
    background: [
      `radial-gradient(ellipse 92% 68% at 50% 36%, color-mix(in srgb, ${teamColor} 14%, rgba(20,24,34,0.98)) 0%, rgba(10,12,18,0.99) 52%, rgba(5,7,11,1) 100%)`,
      `linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 14%, rgba(0,0,0,0.3) 100%)`,
    ].join(", "),
    borderTopColor: `color-mix(in srgb, ${teamColor} 20%, rgba(255,255,255,0.22))`,
    borderBottomColor: `color-mix(in srgb, ${teamColor} 25%, rgba(0,0,0,0.85))`,
    borderLeftColor: edgeTint,
    borderRightColor: edgeTint,
    boxShadow: [
      "0 16px 40px rgba(0,0,0,0.7)",
      "0 6px 18px rgba(0,0,0,0.45)",
      "inset 0 1px 0 rgba(255,255,255,0.12)",
      "inset 0 -2px 10px rgba(0,0,0,0.5)",
      "inset 0 0 28px rgba(0,0,0,0.35)",
      `0 0 ${ambientSpread} color-mix(in srgb, ${teamColor} ${ambientAlpha}, transparent)`,
    ].join(", "),
  };
}

/** Extremely soft team-colored spill — separation via light, not spacing. */
export function getTeamWiseAmbientGlowStyle(teamColor: string, isActive = false) {
  const mix = isActive ? "28%" : "15%";
  return {
    background: `radial-gradient(ellipse 82% 70% at 50% 44%, color-mix(in srgb, ${teamColor} ${mix}, transparent) 0%, transparent 72%)`,
  };
}

/** Metallic franchise banner — layered gradient, inner depth (header only). */
export function getTeamWiseHeaderBandStyle(teamColor: string) {
  return {
    ["--tw-header-color" as string]: teamColor,
    background: [
      `linear-gradient(168deg, color-mix(in srgb, ${teamColor} 82%, #ffffff 15%) 0%, color-mix(in srgb, ${teamColor} 92%, #000000 8%) 26%, color-mix(in srgb, ${teamColor} 86%, #000000 14%) 48%, color-mix(in srgb, ${teamColor} 75%, #0a0e18 25%) 74%, color-mix(in srgb, ${teamColor} 60%, #050810 40%) 100%)`,
    ].join(", "),
    boxShadow: [
      "inset 0 2px 0 rgba(255,255,255,0.32)",
      "inset 0 -1px 0 rgba(0,0,0,0.45)",
      "inset 0 -5px 12px rgba(0,0,0,0.45)",
      "inset 0 10px 22px rgba(0,0,0,0.15)",
    ].join(", "),
  };
}

/** Hero purse amount — ultra high contrast bright gold/yellow broadcast figure. */
export function getTeamWisePurseValueStyle(isPrimary = true) {
  return {
    color: isPrimary ? "#fde047" : "#ffffff",
    textShadow: isPrimary
      ? "0 2px 8px rgba(0,0,0,0.9), 0 0 2px #000"
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

/** Highest purse ticker — single leader vs tied teams at the max purse. */
export type HighestPurseTickerDisplay =
  | { mode: "single"; primary: string; teamColor: string }
  | { mode: "tied"; primary: string; secondary: string };

export function getHighestPurseTickerDisplay(
  teams: readonly LedTeam[],
  unit: AuctionUnit = "rupee",
): HighestPurseTickerDisplay | null {
  if (teams.length === 0) return null;

  const maxPurse = Math.max(...teams.map((t) => t.purse));
  const tiedTeams = teams.filter((t) => t.purse === maxPurse);
  const amount = formatTeamWiseMoneyShort(maxPurse, unit);

  if (tiedTeams.length === 1) {
    const team = tiedTeams[0]!;
    return {
      mode: "single",
      primary: `${team.short} · ${amount}`,
      teamColor: team.color,
    };
  }

  return {
    mode: "tied",
    primary: amount,
    secondary: `Shared by ${tiedTeams.length} Teams`,
  };
}
