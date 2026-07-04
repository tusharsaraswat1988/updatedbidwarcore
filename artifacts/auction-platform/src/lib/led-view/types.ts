import type { DisplayPlayerFilter as ApiDisplayPlayerFilter } from "@workspace/api-client-react";
import type { PlayerGender } from "./player-gender";

export type { PlayerGender } from "./player-gender";

export type LedPlayerSpec = {
  label: string;
  value: string;
};

export type LedPlayerStatus = "queue" | "live" | "sold" | "unsold" | "retained";

export type LedTeamLastPurchase = {
  playerName: string;
  amount: number;
};

export type LedTeam = {
  id: string;
  name: string;
  short: string;
  color: string;
  purse: number;
  totalPurse: number;
  purseUsed: number;
  logoUrl: string | null;
  playersBought: number;
  /** Players acquired at auction (sold), excluding retained. */
  playersSold: number;
  retainedCount: number;
  reservedAmount: number;
  maxBidAllowed: number;
  slotsRemaining: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  /** Denominator for squad progress (max if set, else min, else bought). */
  squadCap: number;
  lastPurchase: LedTeamLastPurchase | null;
};

export type LedPlayer = {
  id: string;
  name: string;
  /** Sport-specific role from tournament setup (e.g. "Doubles Player"). */
  roleRaw: string;
  /** Dynamic specification chips from player_spec_values or legacy fallback. */
  specs: LedPlayerSpec[];
  basePrice: number;
  city: string;
  age: number;
  /** Tournament-scoped display serial (Players page Serial # column). */
  serialNo: number;
  portrait: string;
  gender: PlayerGender;
  status: LedPlayerStatus;
  soldToTeamId: string | null;
  soldPrice: number | null;
  achievements: string;
  categoryName: string | null;
};

export type DerivedState =
  | "idle"
  | "bidding"
  | "sold"
  | "unsold"
  | "paused"
  | "break"
  | "preAuction"
  | "fortuneWheel"
  | "teamPurse"
  | "teamWise"
  | "playerWise"
  | "topSold"
  | "banner";

export type LedSquadPlayer = {
  id: string;
  name: string;
  roleRaw: string;
  portrait: string;
  soldPrice: number;
  soldPriceLabel: string;
};

export type LedTeamSquad = {
  team: LedTeam;
  players: LedSquadPlayer[];
  spent: number;
  spentLabel: string;
  remainingLabel: string;
};

export type LedTopSold = LedSquadPlayer & {
  team: LedTeam | null;
};

export type LiveSponsorTier = "title" | "co_sponsor" | "normal";

export type LiveSponsorDTO = {
  name: string;
  type: string;
  logoUrl: string;
  tier?: LiveSponsorTier;
};

export type LiveBrandingDTO = {
  brandName: string;
  miniBrandText: string;
  poweredByText: string;
  mainLogoUrl: string | null;
  miniLogoUrl: string | null;
  primaryColor: string;
  accentColor: string;
};

export type LiveLastOutcome = {
  type: "sold" | "unsold";
  playerId: number;
  playerName?: string;
  teamId?: number;
  teamName?: string;
  amount?: number;
  photoUrl?: string;
  teamLogoUrl?: string;
  teamColor?: string;
};

export type LiveToast = {
  teamName?: string;
  message?: string;
  expiresAt?: string;
};

export type LivePurseBooster = {
  teamName?: string;
  amount?: number;
  reason?: string;
  expiresAt?: string;
};

export type LedPurseBoosterOverlayView = {
  batchId: string;
  replayKey: number;
  expiresAt: string;
  durationMs: number;
  target: "single" | "all";
  boosterAmount: number;
  teams: Array<{
    teamId: number;
    teamName: string;
    shortCode: string;
    color: string;
    logoUrl: string | null;
    previousCapacity: number;
    boosterAmount: number;
    newCapacity: number;
  }>;
};

export type LiveWheelItem = { label: string; color?: string };

export type LivePlayerFilter = {
  status: "all" | "queue" | "sold" | "unsold" | "retained" | "live" | "available";
  categoryId: string | null;
  teamId: string | null;
};

export type LedAuctionStateSlice = {
  outcome?: {
    type: "sold" | "unsold";
    playerId?: number | null;
    playerName?: string;
    photoUrl?: string | null;
    teamId?: number | null;
    teamName?: string | null;
    teamColor?: string | null;
    teamLogoUrl?: string | null;
    amount?: number | null;
  } | null;
  ledPurseToast?: { teamName: string; expiresAt?: string } | null;
  ledPurseBoosterOverlay?: LedPurseBoosterOverlayView | null;
  lastPurseBooster?: {
    teamName: string;
    amount: number;
    appliedAt?: string;
  } | null;
  isBreak?: boolean;
  breakEndsAt?: string | null;
  pausedTimeRemaining?: number | null;
  bidTimerSeconds?: number | null;
};

export type LiveBannerDTO = {
  enabled: boolean;
  url: string | null;
  fit: "contain" | "cover";
};

export type LedView = {
  state: {
    currentBid: number;
    isBidding: boolean;
    countdown: number;
    teams: LedTeam[];
    players: LedPlayer[];
    log: { id: string; type: "BID"; amount: number; teamId: string }[];
    lastSold: { playerId: string } | null;
  };
  currentPlayer: LedPlayer | null;
  leadingTeam: LedTeam | null;
  /** True once any team has placed a bid on the current player (including at base price). */
  hasTeamBid: boolean;
  remaining: number;
  totalPlayers: number;
  derivedState: DerivedState;
  currentBidLabel: string;
  basePriceLabel: string;
  nextMinLabel: string;
  incrementLabel: string;
  ladder: { team: LedTeam; amount: number; amountLabel: string; id: string }[];
  uniqueBidders: number;
  tournament: { name: string; organizer: string; venue: string; date: string; logoUrl: string | null; auctionUnit?: import("@workspace/api-base/auction-unit").AuctionUnit };
  roleLabel: string;
  sponsors: LiveSponsorDTO[];
  branding: LiveBrandingDTO | null;
  banner: LiveBannerDTO;
  lastOutcome: LiveLastOutcome | null;
  toast: LiveToast | null;
  purseBooster: LivePurseBooster | null;
  purseBoosterOverlay: LedPurseBoosterOverlayView | null;
  wheel: { active: boolean; spinning: boolean; items: LiveWheelItem[]; winner: string | null };
  breakInfo: {
    active: boolean;
    endsAt: string | null;
    secondsLeft: number;
    type: "break" | "pre-auction";
    message: string | null;
  };
  pausedSeconds: number | null;
  /** Raw auction status from API — used by side panels to detect real pause vs operator overlay. */
  auctionStatus: string;
  teamPurseViewActive: boolean;
  displayOverlay: string | null;
  displayPlayerFilter: LivePlayerFilter | null;
  /** Human-readable active player-wise filter for LED headings. */
  playerFilterLabel: string;
  teamSquads: LedTeamSquad[];
  filteredPlayers: LedPlayer[];
  topSoldPlayers: LedTopSold[];
  timerCeiling: number;
  /** Tournament minimum bid — used for team dashboard status. */
  minimumBid: number;
  loading: boolean;
  error: string | null;
  connectionStatus: "connected" | "connecting" | "disconnected" | "error" | "reconnecting";
};

export function mapApiPlayerFilter(f: ApiDisplayPlayerFilter | null | undefined): LivePlayerFilter | null {
  if (!f) return null;
  const status =
    f.status === "available"
      ? "queue"
      : (f.status as LivePlayerFilter["status"]);
  return {
    status,
    categoryId: f.categoryId != null ? String(f.categoryId) : null,
    teamId: f.teamId != null ? String(f.teamId) : null,
  };
}

const PLAYER_FILTER_STATUS_LABELS: Partial<Record<LivePlayerFilter["status"], string>> = {
  queue: "Available",
  available: "Available",
  live: "Live Now",
  sold: "Sold",
  unsold: "Unsold",
  retained: "Retained",
};

/** LED broadcast label for a player filter status (matches operator filter UI). */
export function getLedPlayerFilterStatusLabel(
  status: LivePlayerFilter["status"] | null | undefined,
): string | null {
  if (!status || status === "all") return null;
  return PLAYER_FILTER_STATUS_LABELS[status] ?? status;
}

/** Human-readable label for the active LED player-wise filter (status, team, category). */
export function formatLedPlayerFilterLabel(
  filter: LivePlayerFilter | null | undefined,
  teams: LedTeam[],
  categoryName?: string | null,
): string {
  if (!filter) return "All Players";

  const parts: string[] = [];

  if (filter.status && filter.status !== "all") {
    parts.push(getLedPlayerFilterStatusLabel(filter.status) ?? filter.status);
  }
  if (filter.teamId && filter.status !== "queue" && filter.status !== "available") {
    const team = teams.find((t) => String(t.id) === String(filter.teamId));
    parts.push(team?.name ?? team?.short ?? "Selected Team");
  }
  if (filter.categoryId && categoryName) {
    parts.push(categoryName);
  }

  return parts.length > 0 ? parts.join(" · ") : "All Players";
}
