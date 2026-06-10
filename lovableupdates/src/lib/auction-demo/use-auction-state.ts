import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLiveSnapshot,
  type LiveBannerDTO,
  type LiveBrandingDTO,
  type LiveLastOutcome,
  type LivePlayerDTO,
  type LivePlayerFilter,
  type LivePurseBooster,
  type LiveSnapshotDTO,
  type LiveSponsorDTO,
  type LiveTeamDTO,
  type LiveToast,
  type LiveWheelItem,
} from "@/lib/bidwar-live.functions";


const ROLE_LABEL: Record<LivePlayerDTO["roleCode"], string> = {
  BAT: "Batter",
  BOWL: "Bowler",
  AR: "All-Rounder",
  WK: "Wicket-Keeper",
};

// ----- Indian-format INR helpers -----
function formatINR(n: number): string {
  if (n >= 1_00_00_000) {
    const cr = n / 1_00_00_000;
    return `₹${cr.toFixed(cr >= 10 ? 1 : 2)} CR`;
  }
  if (n >= 1_00_000) {
    const lakh = n / 1_00_000;
    return `₹${lakh.toFixed(lakh >= 10 ? 1 : 2)} L`;
  }
  return `₹${n.toLocaleString("en-IN")}`;
}
function formatINRFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function nextIncrement(
  currentBid: number,
  tiers: { upTo: number; step: number }[],
  baseStep = 0,
  observedStep = 0,
): number {
  // Best signal: the actual gap between the last two real bids placed by the
  // operator — this reflects whatever increment the operator panel truly uses.
  if (observedStep > 0) return observedStep;
  // Next: the tournament's configured bid_increment.
  if (baseStep > 0) return baseStep;
  const tierStep =
    tiers.find((t) => currentBid < t.upTo)?.step ?? tiers[tiers.length - 1]?.step ?? 0;
  return tierStep > 0 ? tierStep : 10_000;
}

// Shape kept compatible with prior LedView contract so subcomponents stay unchanged.
export type LedTeam = {
  id: string;
  name: string;
  short: string;
  color: string;
  purse: number;
  totalPurse: number;
  logoUrl: string | null;
  playersBought: number;
  reservedAmount: number;
  maxBidAllowed: number;
  slotsRemaining: number;
};

export type LedPlayer = {
  id: string;
  name: string;
  role: LivePlayerDTO["roleCode"];
  basePrice: number;
  city: string;
  age: number;
  battingHand: "Right" | "Left";
  serialNo: number;
  portrait: string;
  status: LivePlayerDTO["status"];
  soldToTeamId: string | null;
  soldPrice: number | null;
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
  role: LivePlayerDTO["roleCode"];
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
  remaining: number;
  totalPlayers: number;
  derivedState: DerivedState;
  currentBidLabel: string;
  basePriceLabel: string;
  nextMinLabel: string;
  incrementLabel: string;
  ladder: { team: LedTeam; amount: number; amountLabel: string; id: string }[];
  uniqueBidders: number;
  tournament: { name: string; organizer: string; venue: string; date: string; logoUrl: string | null };
  roleLabel: string;
  sponsors: LiveSponsorDTO[];
  branding: LiveBrandingDTO | null;
  banner: LiveBannerDTO;
  lastOutcome: LiveLastOutcome | null;
  toast: LiveToast | null;
  purseBooster: LivePurseBooster | null;
  wheel: { active: boolean; spinning: boolean; items: LiveWheelItem[]; winner: string | null };
  breakInfo: { active: boolean; endsAt: string | null; secondsLeft: number; type: "break" | "pre-auction"; message: string | null };
  pausedSeconds: number | null;
  teamPurseViewActive: boolean;
  displayOverlay: string | null;
  displayPlayerFilter: LivePlayerFilter | null;
  teamSquads: LedTeamSquad[];
  filteredPlayers: LedPlayer[];
  topSoldPlayers: LedTopSold[];
  actions: Record<string, never>;
  loading: boolean;
  error: string | null;
};


function toLedTeam(
  t: LiveTeamDTO,
  minBid: number,
  minSquadSize: number,
): LedTeam {
  const playersBought = t.squadCount;
  const remainingSlotsTotal = Math.max(0, minSquadSize - playersBought);
  const reservedAmount = remainingSlotsTotal * Math.max(0, minBid);
  // Bidding on one more player: reserve for the OTHER unfilled slots only.
  const reserveForOthers = Math.max(0, remainingSlotsTotal - 1) * Math.max(0, minBid);
  const maxBidAllowed = Math.max(0, t.purse - reserveForOthers);
  return {
    id: t.id,
    name: t.name,
    short: t.short,
    color: t.color,
    purse: t.purse,
    totalPurse: t.totalPurse,
    logoUrl: t.logoUrl,
    playersBought,
    reservedAmount,
    maxBidAllowed,
    slotsRemaining: remainingSlotsTotal,
  };
}

function toLedPlayer(p: LivePlayerDTO, serialNo: number): LedPlayer {
  return {
    id: p.id,
    name: p.name,
    role: p.roleCode,
    basePrice: p.basePrice,
    city: p.city,
    age: p.age,
    battingHand: p.battingHand,
    serialNo,
    portrait: p.portrait,
    status: p.status,
    soldToTeamId: p.soldToTeamId ?? null,
    soldPrice: p.soldPrice ?? null,
  };
}


const EMPTY_VIEW: LedView = {
  state: {
    currentBid: 0,
    isBidding: false,
    countdown: 0,
    teams: [],
    players: [],
    log: [],
    lastSold: null,
  },
  currentPlayer: null,
  leadingTeam: null,
  remaining: 0,
  totalPlayers: 0,
  derivedState: "idle",
  currentBidLabel: "—",
  basePriceLabel: "—",
  nextMinLabel: "—",
  incrementLabel: "",
  ladder: [],
  uniqueBidders: 0,
  tournament: { name: "BidWar Live", organizer: "", venue: "", date: "", logoUrl: null },
  roleLabel: "",
  sponsors: [],
  branding: null,
  lastOutcome: null,
  toast: null,
  purseBooster: null,
  wheel: { active: false, spinning: false, items: [], winner: null },
  breakInfo: { active: false, endsAt: null, secondsLeft: 0, type: "break", message: null },
  pausedSeconds: null,
  teamPurseViewActive: false,
  displayOverlay: null,
  displayPlayerFilter: null,
  banner: { enabled: false, url: null, fit: "contain" },
  teamSquads: [],
  filteredPlayers: [],
  topSoldPlayers: [],
  actions: {},
  loading: true,
  error: null,
};


/**
 * Live LED view backed by Neon (production BidWar DB). Polls every 500ms.
 * Output shape is identical to the prior demo LedView so V1 subcomponents
 * keep working without modification.
 */
export function useLedView(): LedView {
  const fetchSnapshot = useServerFn(getLiveSnapshot);

  const query = useQuery<LiveSnapshotDTO>({
    queryKey: ["bidwar-live-snapshot"],
    queryFn: () => fetchSnapshot(),
    refetchInterval: 350,
    refetchIntervalInBackground: true,
    staleTime: 0,

  });

  // Local ticker to smooth countdown between 500ms polls
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  return useMemo<LedView>(() => {
    if (!query.data) {
      return { ...EMPTY_VIEW, loading: query.isLoading, error: query.error ? String(query.error) : null };
    }
    const snap = query.data;
    if (!snap.tournament) {
      return {
        ...EMPTY_VIEW,
        loading: false,
        error: "No active tournament",
      };
    }

    const teams = snap.teams.map((tm) => toLedTeam(tm, snap.tournament!.minBid, snap.tournament!.minSquadSize));
    const players = snap.players.map((p, i) => toLedPlayer(p, i + 1));
    const serialById = new Map(players.map((p) => [p.id, p.serialNo]));
    const currentPlayer = snap.currentPlayer ? toLedPlayer(snap.currentPlayer, serialById.get(snap.currentPlayer.id) ?? 0) : null;

    const sess = snap.session;
    const isBidding = !!sess?.isBidding;

    // Countdown derived from timerEndsAt if present; else falls back to timer ceiling
    let countdown = 0;
    if (sess) {
      if (sess.timerEndsAt) {
        const endMs = Date.parse(sess.timerEndsAt);
        if (!isNaN(endMs)) {
          countdown = Math.max(0, Math.ceil((endMs - now) / 1000));
        }
      } else if (isBidding) {
        countdown = sess.timerSeconds;
      }
    }

    const currentBid = sess?.currentBid ?? 0;
    const leadingTeam =
      sess?.currentBidTeamId ? teams.find((t) => t.id === sess.currentBidTeamId) ?? null : null;

    const log = snap.recentBids.map((b) => ({
      id: b.id,
      type: "BID" as const,
      amount: b.amount,
      teamId: b.teamId,
    }));

    const ladder = log.slice(0, 3).map((l) => {
      const team = teams.find((t) => t.id === l.teamId) ?? teams[0];
      return { team, amount: l.amount, amountLabel: formatINR(l.amount), id: l.id };
    });
    const uniqueBidders = new Set(log.map((l) => l.teamId)).size;

    // Derived broadcast state (priority order)
    // NOTE: The operator panel sets `team_purse_view_active=true` for every
    // alternate view (Team Wise, Player Wise, Top 5, Banner, Team Purse) and
    // distinguishes them via `display_overlay`. So `displayOverlay` must win
    // over the legacy `teamPurseViewActive` flag.
    const overlay = sess?.displayOverlay ?? null;
    const overlayKey = overlay ? overlay.toLowerCase().replace(/[-\s]/g, "_") : null;
    const countdown_ = sess?.displayCountdown ?? null;
    const countdownActive = !!(countdown_ && Date.parse(countdown_.endsAt) > now);
    let derivedState: DerivedState = "idle";
    if (sess?.fortuneWheelActive) derivedState = "fortuneWheel";
    else if (countdownActive && countdown_?.type === "pre-auction") derivedState = "preAuction";
    else if (countdownActive && countdown_?.type === "break") derivedState = "break";
    else if (sess?.isBreak) derivedState = "break";
    else if (
      sess?.pausedTimeRemaining != null ||
      sess?.status === "paused" ||
      overlayKey === "pause" ||
      overlayKey === "paused" ||
      overlayKey === "pause_bidding"
    )
      derivedState = "paused";
    else if (overlayKey === "banner" || overlayKey === "main_banner")
      derivedState = "banner";
    else if (overlayKey === "team_wise" || overlayKey === "teams" || overlayKey === "team_view" || overlayKey === "team")
      derivedState = "teamWise";
    else if (
      overlayKey === "player_wise" ||
      overlayKey === "players" ||
      overlayKey === "player_view" ||
      overlayKey === "player_list" ||
      overlayKey === "player"
    )
      derivedState = "playerWise";

    else if (
      overlayKey === "top_sold" ||
      overlayKey === "top5" ||
      overlayKey === "top_5" ||
      overlayKey === "top_5_sold"
    )
      derivedState = "topSold";
    else if (
      overlayKey === "team_purse" ||
      overlayKey === "purse" ||
      overlayKey === "team_purses" ||
      sess?.teamPurseViewActive
    )
      derivedState = "teamPurse";
    else if (
      sess?.lastOutcome?.type === "sold" &&
      currentPlayer &&
      sess.lastOutcome.playerId === Number(currentPlayer.id)
    )
      derivedState = "sold";
    else if (currentPlayer?.status === "sold") derivedState = "sold";
    else if (currentPlayer?.status === "unsold" || sess?.lastOutcome?.type === "unsold")
      derivedState = "unsold";
    else if (isBidding) derivedState = "bidding";

    const lastSold =
      sess?.lastOutcome?.type === "sold"
        ? { playerId: String(sess.lastOutcome.playerId) }
        : null;

    const basePrice = currentPlayer?.basePrice ?? 0;
    const bidBase = currentBid > 0 ? currentBid : basePrice;
    // Observe the real step the operator is using from the last two actual bids.
    const sortedBids = [...snap.recentBids].sort((a, b) => b.amount - a.amount);
    let observedStep = 0;
    if (sortedBids.length >= 2) {
      const delta = sortedBids[0].amount - sortedBids[1].amount;
      if (delta > 0) observedStep = delta;
    } else if (sortedBids.length === 1 && basePrice > 0) {
      const delta = sortedBids[0].amount - basePrice;
      if (delta > 0) observedStep = delta;
    }
    const inc = nextIncrement(
      bidBase,
      snap.tournament.bidTiers,
      snap.tournament.baseIncrement,
      observedStep,
    );
    // First bid opens AT the base price; subsequent bids must exceed by one increment.
    const nextMin = currentBid > 0 ? currentBid + inc : basePrice;

    // Break / pre-auction countdown
    let breakSecondsLeft = 0;
    let breakEndsAt: string | null = null;
    let breakType: "break" | "pre-auction" = "break";
    let breakMessage: string | null = null;
    if (countdown_ && Date.parse(countdown_.endsAt) > 0) {
      breakEndsAt = countdown_.endsAt;
      breakType = countdown_.type;
      breakMessage = countdown_.message ?? null;
      breakSecondsLeft = Math.max(0, Math.ceil((Date.parse(countdown_.endsAt) - now) / 1000));
    } else if (sess?.isBreak && sess.breakEndsAt) {
      breakEndsAt = sess.breakEndsAt;
      const endMs = Date.parse(sess.breakEndsAt);
      if (!isNaN(endMs)) breakSecondsLeft = Math.max(0, Math.ceil((endMs - now) / 1000));
    }

    // Team-wise squads (sold/retained players grouped by team)
    const soldOrRetained = snap.players.filter(
      (p) => (p.status === "sold" || p.status === "retained") && p.soldToTeamId,
    );
    const teamSquads: LedTeamSquad[] = teams.map((team) => {
      const teamPlayers = soldOrRetained
        .filter((p) => p.soldToTeamId === team.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          role: p.roleCode,
          portrait: p.portrait,
          soldPrice: p.soldPrice ?? p.basePrice,
          soldPriceLabel: formatINR(p.soldPrice ?? p.basePrice),
        }));
      const spent = team.totalPurse - team.purse;
      return {
        team,
        players: teamPlayers,
        spent,
        spentLabel: formatINR(spent),
        remainingLabel: formatINR(team.purse),
      };
    });

    // Player-wise filtered list
    const filter = sess?.displayPlayerFilter ?? null;
    const filteredPlayers = players.filter((p) => {
      if (filter?.status && filter.status !== "all" && p.status !== filter.status) return false;
      if (filter?.teamId != null && String(p.soldToTeamId ?? "") !== String(filter.teamId)) return false;
      return true;
    });


    // Top 5 sold
    const topSoldPlayers: LedTopSold[] = [...soldOrRetained]
      .filter((p) => (p.soldPrice ?? 0) > 0)
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 5)
      .map((p) => {
        const tm = teams.find((t) => t.id === p.soldToTeamId) ?? null;
        return {
          id: p.id,
          name: p.name,
          role: p.roleCode,
          portrait: p.portrait,
          soldPrice: p.soldPrice ?? 0,
          soldPriceLabel: formatINR(p.soldPrice ?? 0),
          team: tm,
        };
      });

    return {
      state: {
        currentBid,
        isBidding,
        countdown,
        teams,
        players,
        log,
        lastSold,
      },
      currentPlayer,
      leadingTeam,
      remaining: snap.remainingPlayers,
      totalPlayers: snap.totalPlayers,
      derivedState,
      currentBidLabel: formatINRFull(bidBase),
      basePriceLabel: formatINR(currentPlayer?.basePrice ?? 0),
      nextMinLabel: formatINR(nextMin),
      incrementLabel: `+${formatINR(inc)}`,
      ladder,
      uniqueBidders,
      tournament: {
        name: snap.tournament.name,
        organizer: snap.tournament.organizer,
        venue: snap.tournament.venue,
        date: snap.tournament.date,
        logoUrl: snap.tournament.logoUrl,
      },
      roleLabel: currentPlayer ? ROLE_LABEL[currentPlayer.role] : "",
      sponsors: snap.sponsors,
      branding: snap.branding,
      banner: snap.banner,
      lastOutcome: sess?.lastOutcome ?? null,
      toast: sess?.lastToast ?? null,
      purseBooster: sess?.lastPurseBooster ?? null,
      wheel: {
        active: !!sess?.fortuneWheelActive,
        spinning: !!sess?.wheelSpinning,
        items: sess?.wheelItems ?? [],
        winner: sess?.wheelWinner ?? null,
      },
      breakInfo: {
        active: derivedState === "break" || derivedState === "preAuction",
        endsAt: breakEndsAt,
        secondsLeft: breakSecondsLeft,
        type: breakType,
        message: breakMessage,
      },
      pausedSeconds: sess?.pausedTimeRemaining ?? null,
      teamPurseViewActive: !!sess?.teamPurseViewActive,
      displayOverlay: overlay,
      displayPlayerFilter: filter,
      teamSquads,
      filteredPlayers,
      topSoldPlayers,
      actions: {},
      loading: false,
      error: null,
    };
  }, [query.data, query.isLoading, query.error, now]);
}

