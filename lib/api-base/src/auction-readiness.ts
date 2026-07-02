/**
 * Shared auction readiness validation — used by operator start gate,
 * hub checklist (informational), and API start endpoint.
 */

export type AuctionReadinessMode = "trial" | "live";

export type AuctionReadinessCheckId =
  | "teams"
  | "players"
  | "minBid"
  | "openingTimer"
  | "bidTimer"
  | "playerOrder"
  | "bidTiers"
  | "minSquad";

export type AuctionReadinessIssue = {
  id: AuctionReadinessCheckId;
  message: string;
};

export type BidTierRow = { upTo?: number; increment: number };

export type AuctionReadinessInput = {
  teamCount: number;
  playerCount: number;
  minBid: number;
  timerSeconds: number;
  bidTimerSeconds: number;
  playerSelectionMode?: string | null;
  bidTiers?: string | null;
  bidTier1UpTo?: number;
  bidTier1Increment?: number;
  bidTier2UpTo?: number;
  bidTier2Increment?: number;
  bidTier3Increment?: number;
  minimumSquadSize: number;
};

export type TournamentReadinessSource = {
  minBid?: number | null;
  timerSeconds?: number | null;
  bidTimerSeconds?: number | null;
  playerSelectionMode?: string | null;
  bidTiers?: string | null;
  bidTier1UpTo?: number | null;
  bidTier1Increment?: number | null;
  bidTier2UpTo?: number | null;
  bidTier2Increment?: number | null;
  bidTier3Increment?: number | null;
  minimumSquadSize?: number | null;
};

import { MIN_AUCTION_TIMER_SECONDS } from "./auction-timer";

/** Default bid tiers JSON for newly created tournaments — one open-ended tier, blank raise-by. */
export const DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON = JSON.stringify([{ increment: 0 }]);

export const DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS = 10;
export const DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS = 10;
export const DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE = "random";

const VALID_PLAYER_MODES = ["sequential", "random", "manual"] as const;

export const READINESS_CHECK_ORDER: AuctionReadinessCheckId[] = [
  "teams",
  "players",
  "minBid",
  "openingTimer",
  "bidTimer",
  "playerOrder",
  "bidTiers",
  "minSquad",
];

const CHECK_LABELS: Record<AuctionReadinessCheckId, string> = {
  teams: "Add at least 2 teams",
  players: "Add players",
  minBid: "Set Minimum Player Value",
  openingTimer: `Set Opening Timer (min ${MIN_AUCTION_TIMER_SECONDS}s)`,
  bidTimer: `Set Bid Timer (min ${MIN_AUCTION_TIMER_SECONDS}s)`,
  playerOrder: "Select Player Order",
  bidTiers: "Configure Bid Increment Rules",
  minSquad: "Set Minimum Players per Team",
};

export function tournamentToReadinessInput(
  tournament: TournamentReadinessSource,
  teamCount: number,
  playerCount: number,
): AuctionReadinessInput {
  return {
    teamCount,
    playerCount,
    minBid: tournament.minBid ?? 0,
    timerSeconds: tournament.timerSeconds ?? 0,
    bidTimerSeconds: tournament.bidTimerSeconds ?? 0,
    playerSelectionMode: tournament.playerSelectionMode,
    bidTiers: tournament.bidTiers,
    bidTier1UpTo: tournament.bidTier1UpTo ?? undefined,
    bidTier1Increment: tournament.bidTier1Increment ?? undefined,
    bidTier2UpTo: tournament.bidTier2UpTo ?? undefined,
    bidTier2Increment: tournament.bidTier2Increment ?? undefined,
    bidTier3Increment: tournament.bidTier3Increment ?? undefined,
    minimumSquadSize: tournament.minimumSquadSize ?? 0,
  };
}

export function parseBidTiers(input: Pick<
  AuctionReadinessInput,
  | "bidTiers"
  | "bidTier1UpTo"
  | "bidTier1Increment"
  | "bidTier2UpTo"
  | "bidTier2Increment"
  | "bidTier3Increment"
>): BidTierRow[] {
  if (input.bidTiers) {
    try {
      const parsed = JSON.parse(input.bidTiers) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row) => ({
          upTo: typeof row?.upTo === "number" ? row.upTo : undefined,
          increment: Number(row?.increment) || 0,
        }));
      }
    } catch {
      /* fall through to legacy */
    }
  }

  return [
    {
      upTo: input.bidTier1UpTo ?? 100_000,
      increment: input.bidTier1Increment ?? 0,
    },
    {
      upTo: input.bidTier2UpTo ?? 200_000,
      increment: input.bidTier2Increment ?? 0,
    },
    { increment: input.bidTier3Increment ?? 0 },
  ];
}

function minPlayersRequired(mode: AuctionReadinessMode): number {
  return mode === "trial" ? 1 : 2;
}

export const MIN_TEAMS_REQUIRED = 2;

export { minPlayersRequired };

function playersIssueMessage(mode: AuctionReadinessMode): string {
  return mode === "trial" ? "Add at least 1 player" : "Add at least 2 players";
}

/**
 * Returns only failing checks. Empty array means the auction may start.
 */
export function validateAuctionReadiness(
  input: AuctionReadinessInput,
  mode: AuctionReadinessMode,
): AuctionReadinessIssue[] {
  const issues: AuctionReadinessIssue[] = [];

  if (input.teamCount < MIN_TEAMS_REQUIRED) {
    issues.push({ id: "teams", message: CHECK_LABELS.teams });
  }

  const minPlayers = minPlayersRequired(mode);
  if (input.playerCount < minPlayers) {
    issues.push({ id: "players", message: playersIssueMessage(mode) });
  }

  if (input.minBid <= 0) {
    issues.push({ id: "minBid", message: CHECK_LABELS.minBid });
  }

  if (input.timerSeconds < MIN_AUCTION_TIMER_SECONDS) {
    issues.push({ id: "openingTimer", message: CHECK_LABELS.openingTimer });
  }

  if (input.bidTimerSeconds < MIN_AUCTION_TIMER_SECONDS) {
    issues.push({ id: "bidTimer", message: CHECK_LABELS.bidTimer });
  }

  const selectionMode = (input.playerSelectionMode ?? "").trim();
  if (!selectionMode || !VALID_PLAYER_MODES.includes(selectionMode as (typeof VALID_PLAYER_MODES)[number])) {
    issues.push({ id: "playerOrder", message: CHECK_LABELS.playerOrder });
  }

  const tiers = parseBidTiers(input);
  if (tiers.length === 0 || !tiers.some((t) => t.increment > 0)) {
    issues.push({ id: "bidTiers", message: CHECK_LABELS.bidTiers });
  }

  if (input.minimumSquadSize <= 0) {
    issues.push({ id: "minSquad", message: CHECK_LABELS.minSquad });
  }

  return issues;
}

export type ReadinessChecklistItem = {
  id: AuctionReadinessCheckId;
  label: string;
  done: boolean;
  link?: string;
};

/**
 * Informational checklist for the hub — same rules as start validation, never blocking.
 */
export function getReadinessChecklistItems(
  input: AuctionReadinessInput,
  mode: AuctionReadinessMode,
  links?: Partial<Record<AuctionReadinessCheckId, string>>,
): ReadinessChecklistItem[] {
  const issues = validateAuctionReadiness(input, mode);
  const failing = new Set(issues.map((i) => i.id));
  const issueMessages = new Map(issues.map((i) => [i.id, i.message]));

  return READINESS_CHECK_ORDER.map((id) => {
    let label = CHECK_LABELS[id];
    if (id === "players") {
      label = playersIssueMessage(mode);
    }
    if (failing.has(id)) {
      label = issueMessages.get(id) ?? label;
    }
    return {
      id,
      label,
      done: !failing.has(id),
      link: links?.[id],
    };
  });
}
