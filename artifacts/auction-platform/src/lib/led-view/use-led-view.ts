import { useMemo } from "react";
import {
  useGetAuctionState,
  useGetTeamPurses,
  useGetTournament,
  useListPlayers,
  useListBids,
  useListCategories,
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getGetTournamentQueryKey,
  getListPlayersQueryKey,
  getListBidsQueryKey,
  getListCategoriesQueryKey,
  type Player,
  type TeamPurse,
} from "@workspace/api-client-react";
import { useBranding } from "@/hooks/use-branding";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import {
  getSponsorsByPriority,
  parseSponsorLogos,
  resolveSponsorPriorityType,
  SponsorPriorityType,
} from "@/lib/sponsor-logo";
import { computeNextBidAmount } from "@workspace/api-base/auction-bid";
import { formatINR, formatINRFull, nextIncrement } from "./format-inr";
import { useCountdownSeconds } from "./use-countdown-seconds";
import {
  mapApiPlayerFilter,
  formatLedPlayerFilterLabel,
  type DerivedState,
  type LedPlayer,
  type LedPlayerStatus,
  type LedTeam,
  type LedTeamSquad,
  type LedTopSold,
  type LedView,
  type LiveBrandingDTO,
  type LiveLastOutcome,
  type LedAuctionStateSlice,
} from "./types";
import { resolvePlayerSpecifications, specGroupLabelsForRole } from "@/lib/player-spec-display";
import { useRoleSpecMap } from "@/hooks/use-role-spec-groups";
import { resolvePlayerPortraitGender } from "./player-gender";
import { resolveAuctionUnit } from "@/hooks/use-auction-unit";
import { resolveSquadMetrics } from "./squad-metrics";

function mapPlayerStatus(
  status: Player["status"],
  playerId: number,
  currentPlayerId: number | null | undefined,
): LedPlayerStatus {
  if (currentPlayerId === playerId) return "live";
  if (status === "available") return "queue";
  if (status === "sold") return "sold";
  if (status === "unsold") return "unsold";
  if (status === "retained") return "retained";
  return "queue";
}

function resolveLeadingTeam(
  teams: LedTeam[],
  auctionState:
    | {
        currentBidTeamId?: number | null;
        currentBidTeamName?: string | null;
        currentBidTeamColor?: string | null;
        currentBidTeamLogoUrl?: string | null;
      }
    | null
    | undefined,
): LedTeam | null {
  if (auctionState?.currentBidTeamId == null) return null;
  const id = String(auctionState.currentBidTeamId);
  const fromPurse = teams.find((t) => t.id === id);
  if (fromPurse) return fromPurse;

  const name = auctionState.currentBidTeamName ?? "Team";
  return {
    id,
    name,
    short: name.slice(0, 3).toUpperCase(),
    color: auctionState.currentBidTeamColor ?? "#3B82F6",
    purse: 0,
    totalPurse: 0,
    purseUsed: 0,
    logoUrl: auctionState.currentBidTeamLogoUrl ?? null,
    playersBought: 0,
    playersSold: 0,
    retainedCount: 0,
    reservedAmount: 0,
    maxBidAllowed: 0,
    slotsRemaining: 0,
    minimumSquadSize: 0,
    maximumSquadSize: 0,
    squadCap: 1,
    lastPurchase: null,
  };
}

function toLedTeam(t: TeamPurse, minBid: number, tournamentMinSquad: number): LedTeam {
  const playersBought = t.playersBought;
  const retainedCount = t.retainedCount ?? 0;
  const playersSold = Math.max(0, playersBought - retainedCount);
  const minSquad = (t.minimumSquadSize ?? 0) > 0 ? t.minimumSquadSize! : tournamentMinSquad;
  const maxSquad = t.maximumSquadSize ?? 0;
  const squad = resolveSquadMetrics(playersBought, minSquad, maxSquad);
  const slotsForReserve = t.slotsRequired ?? squad.slotsRemaining;
  const reservedAmount = t.reservePurse ?? slotsForReserve * Math.max(0, minBid);
  const reserveForOthers = Math.max(0, slotsForReserve - 1) * Math.max(0, minBid);
  const maxBidAllowed =
    t.spendablePurse ?? Math.max(0, t.purseRemaining - reserveForOthers);
  return {
    id: String(t.teamId),
    name: t.teamName,
    short: t.shortCode || t.teamName.slice(0, 3).toUpperCase(),
    color: t.color ?? "#3B82F6",
    purse: t.purseRemaining,
    totalPurse: t.purse,
    purseUsed: t.purseUsed,
    logoUrl: t.logoUrl ?? null,
    playersBought,
    playersSold,
    retainedCount,
    reservedAmount,
    maxBidAllowed,
    slotsRemaining: squad.slotsRemaining,
    minimumSquadSize: squad.minimumSquadSize,
    maximumSquadSize: squad.maximumSquadSize,
    squadCap: squad.squadCap,
    lastPurchase:
      t.topPlayerName && t.topPlayerAmount != null
        ? { playerName: t.topPlayerName, amount: t.topPlayerAmount }
        : null,
  };
}

function toLedPlayer(
  p: Player,
  currentPlayerId: number | null | undefined,
  categoryName?: string | null,
  specGroupLabels?: string[],
): LedPlayer {
  const roleRaw = p.role?.trim() || "Player";
  const specs = resolvePlayerSpecifications(
    p as Player & {
      specifications?: { specGroupId: number; groupName: string; value: string }[];
    },
    { specGroupLabels },
  );

  return {
    id: String(p.id),
    name: p.name,
    roleRaw,
    specs,
    basePrice: p.basePrice,
    city: p.city ?? "",
    age: p.age ?? 0,
    serialNo: p.serialNo ?? p.id,
    portrait: p.photoUrl ?? "",
    gender: resolvePlayerPortraitGender(p.gender, categoryName),
    status: mapPlayerStatus(p.status, p.id, currentPlayerId),
    soldToTeamId: p.teamId != null ? String(p.teamId) : null,
    soldPrice: p.soldPrice ?? p.retainedPrice ?? null,
    achievements: p.achievements?.trim() || "",
    categoryName: categoryName ?? null,
  };
}

function parseBidTiers(tournament: {
  bidTier1UpTo?: number;
  bidTier1Increment?: number;
  bidTier2UpTo?: number;
  bidTier2Increment?: number;
  bidTier3Increment?: number;
}): { upTo: number; step: number }[] {
  return [
    { upTo: tournament.bidTier1UpTo ?? 0, step: tournament.bidTier1Increment ?? 0 },
    { upTo: tournament.bidTier2UpTo ?? 0, step: tournament.bidTier2Increment ?? 0 },
    { upTo: Number.MAX_SAFE_INTEGER, step: tournament.bidTier3Increment ?? 0 },
  ];
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
  hasTeamBid: false,
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
  purseBoosterOverlay: null,
  wheel: { active: false, spinning: false, items: [], winner: null },
  breakInfo: { active: false, endsAt: null, secondsLeft: 0, type: "break", message: null },
  pausedSeconds: null,
  auctionStatus: "idle",
  teamPurseViewActive: false,
  displayOverlay: null,
  displayPlayerFilter: null,
  playerFilterLabel: "All Players",
  banner: { enabled: false, url: null, fit: "contain" },
  teamSquads: [],
  filteredPlayers: [],
  topSoldPlayers: [],
  timerCeiling: 30,
  minimumBid: 0,
  loading: true,
  error: null,
  connectionStatus: "connecting",
};

type BreakMeta = {
  endsAt: string | null;
  type: "break" | "pre-auction";
  message: string | null;
  isBreakFlag: boolean;
};

function resolveBreakMeta(
  state: LedAuctionStateSlice | undefined,
  displayCountdown: { type?: string; endsAt?: string; message?: string | null } | null | undefined,
): BreakMeta {
  const isBreakFlag = !!state?.isBreak;
  if (displayCountdown?.endsAt) {
    return {
      endsAt: displayCountdown.endsAt,
      type: displayCountdown.type === "pre-auction" ? "pre-auction" : "break",
      message: displayCountdown.message ?? null,
      isBreakFlag,
    };
  }
  if (isBreakFlag && state?.breakEndsAt) {
    return {
      endsAt: state.breakEndsAt,
      type: "break",
      message: null,
      isBreakFlag,
    };
  }
  return { endsAt: null, type: "break", message: null, isBreakFlag };
}

function applyLiveTiming(
  base: LedView,
  bidCountdown: number,
  breakCountdown: number,
  breakMeta: BreakMeta,
): LedView {
  let derivedState = base.derivedState;

  if (breakCountdown > 0 && breakMeta.type === "pre-auction") {
    derivedState = "preAuction";
  } else if (breakCountdown > 0 && (breakMeta.type === "break" || breakMeta.isBreakFlag)) {
    derivedState = "break";
  }

  const breakActive =
    derivedState === "break" || derivedState === "preAuction";

  return {
    ...base,
    derivedState,
    state: {
      ...base.state,
      countdown: bidCountdown,
    },
    breakInfo: {
      active: breakActive,
      endsAt: breakMeta.endsAt,
      secondsLeft: breakCountdown,
      type: breakMeta.type,
      message: breakMeta.message,
    },
  };
}

export function useLedView(
  tournamentId: number,
  connectionStatus: LedView["connectionStatus"] = "connected",
): LedView {
  const sseStatus = connectionStatus as ConnectionStatus;

  const { data: tournament, isLoading: tournamentLoading, error: tournamentError } = useGetTournament(
    tournamentId,
    {
      query: {
        queryKey: getGetTournamentQueryKey(tournamentId),
        enabled: !!tournamentId,
      },
    },
  );

  const { data: state, isLoading: stateLoading, error: stateError } = useGetAuctionState(
    tournamentId,
    {
      query: {
        queryKey: getGetAuctionStateQueryKey(tournamentId),
        enabled: !!tournamentId,
        refetchInterval: sseAwareRefetchInterval(sseStatus, 10000),
      },
    },
  );

  const { data: teamPursesFromQuery } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && !(state?.teamPurses?.length),
    },
  });
  const teamPurses = state?.teamPurses ?? teamPursesFromQuery;

  const { data: allPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const playersForSpecMap = useMemo(() => {
    const list = allPlayers ?? [];
    const current = state?.currentPlayer;
    if (current && !list.some((p) => p.id === current.id)) {
      return [...list, current];
    }
    return list;
  }, [allPlayers, state?.currentPlayer]);

  const roleSpecMap = useRoleSpecMap(tournament?.sport, playersForSpecMap);

  const { data: categories } = useListCategories(tournamentId, {
    query: {
      queryKey: getListCategoriesQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const currentPlayerId = state?.currentPlayer?.id ?? (state as LedAuctionStateSlice | undefined)?.outcome?.playerId ?? null;

  const { data: allBids } = useListBids(tournamentId, {
    query: {
      queryKey: getListBidsQueryKey(tournamentId),
      enabled: !!tournamentId && !!currentPlayerId,
    },
  });

  const brandingHook = useBranding();

  const stateExt = state as (typeof state & LedAuctionStateSlice) | undefined;
  const breakMeta = useMemo(
    () => resolveBreakMeta(stateExt, state?.displayCountdown),
    [stateExt, state?.displayCountdown],
  );

  const bidCountdown = useCountdownSeconds(state?.timerEndsAt ?? null);
  const breakCountdown = useCountdownSeconds(breakMeta.endsAt);

  const staticView = useMemo<LedView>(() => {
    const loading = tournamentLoading || stateLoading;
    const error = tournamentError || stateError;

    if (loading && !tournament) {
      return {
        ...EMPTY_VIEW,
        loading: true,
        error: error ? String(error) : null,
        connectionStatus,
      };
    }

    if (!tournament) {
      return {
        ...EMPTY_VIEW,
        loading: false,
        error: "Tournament not found",
        connectionStatus,
      };
    }

    const outcome = stateExt?.outcome;
    const auctionUnit = resolveAuctionUnit(tournament);
    const minBid = tournament.minBid ?? 0;
    const minSquadSize = tournament.minimumSquadSize ?? 0;
    const teamsBase = [...(teamPurses ?? [])]
      .sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" }))
      .map((t) => toLedTeam(t, minBid, minSquadSize));

    const blockPlayerId = state?.currentPlayer?.id ?? null;
    const awaitingNext =
      state?.status === "active" &&
      !blockPlayerId &&
      outcome?.type === "deferred";

    const currentPlayerIdResolved =
      blockPlayerId ??
      (outcome?.type === "sold" || outcome?.type === "unsold"
        ? outcome?.playerId ?? null
        : null);

    const playersSource = allPlayers ?? (state?.currentPlayer ? [state.currentPlayer] : []);
    const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const categoryNameFor = (p: Player) =>
      p.categoryId != null ? categoryNameById.get(p.categoryId) ?? null : null;
    const labelsFor = (p: Player) => specGroupLabelsForRole(roleSpecMap, p.role);
    const players = playersSource.map((p) =>
      toLedPlayer(p, currentPlayerIdResolved, categoryNameFor(p), labelsFor(p)),
    );

    const lastSoldByTeam = new Map<
      string,
      { playerName: string; amount: number; playerId: number }
    >();
    for (const p of players) {
      if (p.status !== "sold" || !p.soldToTeamId) continue;
      const pid = Number(p.id);
      const prev = lastSoldByTeam.get(p.soldToTeamId);
      if (!prev || pid > prev.playerId) {
        lastSoldByTeam.set(p.soldToTeamId, {
          playerName: p.name,
          amount: p.soldPrice ?? p.basePrice,
          playerId: pid,
        });
      }
    }
    if (
      outcome?.type === "sold" &&
      outcome.teamId != null &&
      outcome.playerName &&
      (outcome.amount ?? 0) > 0
    ) {
      const tid = String(outcome.teamId);
      const oid = outcome.playerId ?? 0;
      const prev = lastSoldByTeam.get(tid);
      if (!prev || oid >= prev.playerId) {
        lastSoldByTeam.set(tid, {
          playerName: outcome.playerName,
          amount: outcome.amount ?? 0,
          playerId: oid,
        });
      }
    }

    const teams = teamsBase.map((team) => {
      // Purse snapshot is authoritative — stale player lists must not resurrect
      // pre-reset sold rosters or last-purchase rows after a trial reset.
      if (team.playersBought === 0) {
        return { ...team, lastPurchase: null };
      }
      if (team.playersSold === 0) {
        return team;
      }
      const last = lastSoldByTeam.get(team.id);
      if (!last) return team;
      return {
        ...team,
        lastPurchase: { playerName: last.playerName, amount: last.amount },
      };
    });

    const currentPlayer = state?.currentPlayer
      ? toLedPlayer(
          state.currentPlayer,
          currentPlayerIdResolved,
          categoryNameFor(state.currentPlayer),
          labelsFor(state.currentPlayer),
        )
      : awaitingNext && outcome?.playerId
        ? players.find((p) => p.id === String(outcome.playerId)) ?? {
            id: String(outcome.playerId),
            name: outcome.playerName ?? "Player",
            roleRaw: "Player",
            specs: [],
            basePrice: outcome.amount ?? 0,
            city: "",
            age: 0,
            serialNo: outcome.playerId ?? 0,
            portrait: outcome.photoUrl ?? "",
            gender: "male" as const,
            status: "queue" as const,
            soldToTeamId: null,
            soldPrice: null,
            achievements: "",
            categoryName: null,
          }
      : outcome?.playerId && (outcome.type === "sold" || outcome.type === "unsold")
        ? players.find((p) => p.id === String(outcome.playerId)) ?? null
        : null;

    const isBreakFlag = !!stateExt?.isBreak;
    const fortuneWheelActive = !!state?.fortuneWheelActive;
    const teamPurseViewActive = !!state?.teamPurseViewActive;
    const overlay = state?.displayOverlay ?? null;
    const overlayKey = overlay ? overlay.toLowerCase().replace(/[-\s]/g, "_") : null;

    const isBidding =
      state?.status === "active" &&
      !!state?.currentPlayer &&
      !isBreakFlag &&
      !fortuneWheelActive &&
      !teamPurseViewActive &&
      !!state?.timerEndsAt;

    const bidTimerSecs =
      state?.bidTimerSeconds ?? tournament.bidTimerSeconds ?? 15;
    const startTimerSecs = state?.timerSeconds ?? tournament.timerSeconds ?? 30;
    const timerCeiling = Math.max(
      1,
      isBidding && state?.timerType === "bid" ? bidTimerSecs : startTimerSecs,
    );

    const currentBid = state?.currentBid ?? 0;
    const leadingTeam = resolveLeadingTeam(teams, state);

    const compareBidsRecentFirst = (
      a: { timestamp: string; id: number },
      b: { timestamp: string; id: number },
    ) => {
      const byTime = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (byTime !== 0) return byTime;
      return b.id - a.id;
    };

    const playerBids = (allBids ?? [])
      .filter((b) => currentPlayerIdResolved != null && b.playerId === currentPlayerIdResolved)
      .sort(compareBidsRecentFirst);

    const hasTeamBid =
      state?.currentBidTeamId != null ||
      state?.timerType === "bid" ||
      playerBids.length > 0;

    // Ladder shows the 3 most recent bids (not the 3 highest amounts).
    const recentBids = playerBids.slice(0, 3);

    const log = recentBids.map((b) => ({
      id: String(b.id),
      type: "BID" as const,
      amount: b.amount,
      teamId: String(b.teamId),
    }));

    const ladder = log.map((l) => {
      const team = teams.find((t) => t.id === l.teamId) ?? teams[0];
      return { team, amount: l.amount, amountLabel: formatINR(l.amount, auctionUnit), id: l.id };
    });
    const uniqueBidders = new Set(
      playerBids.map((b) => String(b.teamId)),
    ).size;

    let derivedState: DerivedState = "idle";
    if (fortuneWheelActive) derivedState = "fortuneWheel";
    else if (isBreakFlag) derivedState = "break";
    else if (
      state?.status === "paused" ||
      overlayKey === "pause" ||
      overlayKey === "paused" ||
      overlayKey === "pause_bidding"
    )
      derivedState = "paused";
    else if (overlayKey === "banner" || overlayKey === "main_banner") derivedState = "banner";
    else if (
      overlayKey === "team_wise" ||
      overlayKey === "teams" ||
      overlayKey === "team_view" ||
      overlayKey === "team"
    )
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
      teamPurseViewActive
    )
      derivedState = "teamPurse";
    else if (
      outcome?.type === "sold" &&
      currentPlayer &&
      outcome.playerId === Number(currentPlayer.id)
    )
      derivedState = "sold";
    else if (currentPlayer?.status === "sold") derivedState = "sold";
    else if (currentPlayer?.status === "unsold" || outcome?.type === "unsold")
      derivedState = "unsold";
    else if (awaitingNext) derivedState = "awaitingNext";
    else if (isBidding) derivedState = "bidding";

    const lastOutcome: LiveLastOutcome | null = outcome
      ? {
          type: outcome.type,
          playerId: outcome.playerId ?? 0,
          playerName: outcome.playerName,
          teamId: outcome.teamId ?? undefined,
          teamName: outcome.teamName ?? undefined,
          amount: outcome.amount ?? undefined,
          photoUrl: outcome.photoUrl ?? undefined,
          teamLogoUrl: outcome.teamLogoUrl ?? undefined,
          teamColor: outcome.teamColor ?? undefined,
        }
      : null;

    const lastSold =
      outcome?.type === "sold" && outcome.playerId != null
        ? { playerId: String(outcome.playerId) }
        : null;

    const basePrice = currentPlayer?.basePrice ?? 0;
    const bidBase = currentBid > 0 ? currentBid : basePrice;

    const sortedBids = [...playerBids].sort((a, b) => b.amount - a.amount);
    let observedStep = 0;
    if (sortedBids.length >= 2) {
      const delta = sortedBids[0].amount - sortedBids[1].amount;
      if (delta > 0) observedStep = delta;
    } else if (sortedBids.length === 1 && basePrice > 0) {
      const delta = sortedBids[0].amount - basePrice;
      if (delta > 0) observedStep = delta;
    }

    const bidTiers = parseBidTiers(tournament);
    const inc = nextIncrement(
      bidBase,
      bidTiers,
      tournament.bidIncrement ?? 0,
      observedStep || (state?.bidIncrement ?? 0),
    );
    const openingPrice = currentBid > 0 ? currentBid : basePrice;
    const nextMin = computeNextBidAmount({
      currentBid: openingPrice,
      bidIncrement: inc,
      currentBidTeamId: state?.currentBidTeamId,
    });

    const soldOrRetained = players.filter(
      (p) => (p.status === "sold" || p.status === "retained") && p.soldToTeamId,
    );

    const teamSquads: LedTeamSquad[] = teams.map((team) => {
      const teamPlayers = soldOrRetained
        .filter((p) => p.soldToTeamId === team.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          roleRaw: p.roleRaw,
          portrait: p.portrait,
          soldPrice: p.soldPrice ?? p.basePrice,
          soldPriceLabel: formatINR(p.soldPrice ?? p.basePrice, auctionUnit),
        }));
      const spent = team.totalPurse - team.purse;
      return {
        team,
        players: teamPlayers,
        spent,
        spentLabel: formatINR(spent, auctionUnit),
        remainingLabel: formatINR(team.purse, auctionUnit),
      };
    });

    const filter = mapApiPlayerFilter(state?.displayPlayerFilter);
    const filteredPlayers = players.filter((p) => {
      if (filter?.status && filter.status !== "all") {
        if (filter.status === "queue" && p.status !== "queue" && p.status !== "live") return false;
        else if (filter.status !== "queue" && p.status !== filter.status) return false;
      }
      if (filter?.teamId != null && filter.status !== "queue" && filter.status !== "available") {
        if (String(p.soldToTeamId ?? "") !== String(filter.teamId)) return false;
      }
      return true;
    });
    const playerFilterLabel = formatLedPlayerFilterLabel(
      filter,
      teams,
      filter?.categoryId != null
        ? categoryNameById.get(Number(filter.categoryId)) ?? null
        : null,
    );

    const topSoldPlayers: LedTopSold[] = [...soldOrRetained]
      .filter((p) => (p.soldPrice ?? 0) > 0)
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 5)
      .map((p) => {
        const tm = teams.find((t) => t.id === p.soldToTeamId) ?? null;
        return {
          id: p.id,
          name: p.name,
          roleRaw: p.roleRaw,
          portrait: p.portrait,
          soldPrice: p.soldPrice ?? 0,
          soldPriceLabel: formatINR(p.soldPrice ?? 0, auctionUnit),
          team: tm,
        };
      });

    const sponsorLogos = getSponsorsByPriority(parseSponsorLogos(tournament.sponsorLogos));
    const sponsors = sponsorLogos.map((s) => {
      const priorityType = resolveSponsorPriorityType(s);
      const tier =
        priorityType === SponsorPriorityType.TITLE
          ? ("title" as const)
          : priorityType === SponsorPriorityType.CO_SPONSOR
            ? ("co_sponsor" as const)
            : ("normal" as const);
      const typeLabel =
        priorityType === SponsorPriorityType.TITLE
          ? "Title Sponsor"
          : priorityType === SponsorPriorityType.CO_SPONSOR
            ? "Co Sponsor"
            : (s.type?.trim() || "Partner");
      return {
        name: s.name ?? "",
        type: typeLabel,
        logoUrl: s.url ?? "",
        tier,
      };
    });

    const branding: LiveBrandingDTO = {
      brandName: brandingHook.brandName,
      miniBrandText: brandingHook.miniBrandText,
      poweredByText: brandingHook.poweredByText,
      mainLogoUrl: brandingHook.logos.main,
      miniLogoUrl: brandingHook.logos.mini,
      primaryColor: brandingHook.colors.primary,
      accentColor: brandingHook.colors.accent,
    };

    const banner: LedView["banner"] = {
      enabled: !!tournament.mainBannerEnabled,
      url: tournament.mainBannerUrl ?? null,
      fit: tournament.mainBannerFit === "cover" ? "cover" : "contain",
    };

    const purseBoosterOverlay = stateExt?.ledPurseBoosterOverlay ?? null;

    return {
      state: {
        currentBid,
        isBidding,
        countdown: 0,
        teams,
        players,
        log,
        lastSold,
      },
      currentPlayer,
      leadingTeam,
      hasTeamBid,
      remaining: state?.remainingPlayersCount ?? 0,
      totalPlayers: players.length || (state?.soldPlayersCount ?? 0) + (state?.remainingPlayersCount ?? 0),
      derivedState,
      currentBidLabel: formatINRFull(bidBase, auctionUnit),
      basePriceLabel: formatINR(currentPlayer?.basePrice ?? 0, auctionUnit),
      nextMinLabel: formatINR(nextMin, auctionUnit),
      incrementLabel: `+${formatINR(inc, auctionUnit)}`,
      ladder,
      uniqueBidders,
      tournament: {
        name: tournament.name,
        organizer: tournament.organizerName ?? "",
        venue: tournament.venue ?? "",
        date: tournament.auctionDate ?? "",
        logoUrl: tournament.logoUrl ?? null,
        auctionUnit,
      },
      roleLabel: currentPlayer?.roleRaw ?? "",
      sponsors,
      branding,
      banner,
      lastOutcome,
      toast: null,
      purseBooster: null,
      purseBoosterOverlay,
      wheel: {
        active: fortuneWheelActive,
        spinning: !!state?.wheelSpinning,
        items: (state?.wheelItems ?? []).map((w) => ({ label: w.label, color: w.color })),
        winner: state?.wheelWinner ?? null,
      },
      breakInfo: {
        active: false,
        endsAt: breakMeta.endsAt,
        secondsLeft: 0,
        type: breakMeta.type,
        message: breakMeta.message,
      },
      pausedSeconds: stateExt?.pausedTimeRemaining ?? null,
      auctionStatus: state?.status ?? "idle",
      teamPurseViewActive,
      displayOverlay: overlay,
      displayPlayerFilter: filter,
      playerFilterLabel,
      teamSquads,
      filteredPlayers,
      topSoldPlayers,
      timerCeiling,
      minimumBid: minBid,
      loading: false,
      error: error ? String(error) : null,
      connectionStatus,
    };
  }, [
    tournament,
    tournamentLoading,
    tournamentError,
    state,
    stateLoading,
    stateError,
    stateExt,
    teamPurses,
    allPlayers,
    categories,
    allBids,
    brandingHook.brandName,
    brandingHook.miniBrandText,
    brandingHook.poweredByText,
    brandingHook.logos.main,
    brandingHook.logos.mini,
    brandingHook.colors.primary,
    brandingHook.colors.accent,
    breakMeta.endsAt,
    breakMeta.type,
    breakMeta.message,
    breakMeta.isBreakFlag,
    connectionStatus,
    currentPlayerId,
    roleSpecMap,
  ]);

  return useMemo(
    () => applyLiveTiming(staticView, bidCountdown, breakCountdown, breakMeta),
    [staticView, bidCountdown, breakCountdown, breakMeta],
  );
}
