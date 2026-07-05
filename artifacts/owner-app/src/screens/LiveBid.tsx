import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, User, LogOut,
  AlertTriangle, Coffee, RefreshCw, X, XCircle, Radar, ShieldUser, Sparkles,
} from "lucide-react";
import { useLiveBidLayout, type DeviceTier } from "@/hooks/useLiveBidLayout";
import { useCountdown } from "@/hooks/useCountdown";
import { useTimerExpired } from "@/hooks/useTimerExpired";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import { hapticBid, hapticSuccess, hapticError, hapticLeading, hapticBooster } from "@/lib/haptics";
import { formatIndianRupee, formatShortIndianRupee, resolveAuctionUnit } from "@/lib/format";
import { computeNextBidAmount, resolveRetainedSpend } from "@workspace/api-base";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";
import { Toast } from "@/components/Toast";
import { AuctionConnectionBanner, AuctionFeedIndicator } from "@/components/AuctionConnectionBanner";
import { resolveHeaderBrandLogoUrl } from "@/lib/brand-assets";
import { isPlayerOnAuctionStage } from "@/lib/auction-stage";
import { resolvePlayerSpecifications } from "@workspace/api-base/player-spec-export";
import { formatPlayerGender } from "@workspace/api-base/player-gender";
import { useRoleSpecGroups } from "@/hooks/useRoleSpecGroups";
import { getListPlayersQueryKey, useListPlayers } from "@workspace/api-client-react";
import { useBreakCountdownFromState } from "@/lib/break-countdown";

const BIDWAR_AMBER = "#F59E0B";

// ── Types ────────────────────────────────────────────────────────────────────
interface AuctionState {
  status?: string;
  licenseStatus?: string;
  currentPlayer?: {
    id?: number;
    serialNo?: number | null;
    name?: string;
    role?: string | null;
    photoUrl?: string | null;
    basePrice?: number | null;
    age?: number | null;
    city?: string | null;
    gender?: string | null;
    jerseyNumber?: string | number | null;
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    specialization?: string | null;
    achievements?: string | null;
    playerTag?: string | null;
    isNonPlayingMember?: boolean;
    specifications?: { specGroupId: number; groupName: string; value: string }[] | null;
  } | null;
  currentBid?: number | null;
  currentBidTeamId?: number | null;
  currentBidTeamName?: string | null;
  timerEndsAt?: string | null;
  timerType?: string | null;
  bidIncrement?: number;
  currentCategoryMaxPlayers?: number | null;
  currentCategoryName?: string | null;
  teamCategoryPlayerCounts?: Record<string, number> | null;
  displayCountdown?: {
    type?: string;
    endsAt?: string;
    message?: string | null;
  } | null;
  lastAction?: string | null;
  outcome?: {
    type?: string | null;
    playerId?: number | null;
    playerName?: string | null;
    photoUrl?: string | null;
    teamId?: number | null;
    teamName?: string | null;
    amount?: number | null;
  } | null;
  lastSoldPlayer?: {
    id?: number;
    name?: string;
    role?: string | null;
    photoUrl?: string | null;
    soldToTeamId?: number | null;
    soldToTeamName?: string | null;
    soldToTeamColor?: string | null;
    soldAmount?: number | null;
  } | null;
  lastPurseBooster?: {
    id: number;
    teamId: number;
    teamName: string;
    amount: number;
    previousCapacity: number;
    newCapacity: number;
    appliedAt: string;
  } | null;
  lastAuctionActivityAt?: string | null;
}

interface Team {
  id: number;
  name: string;
  shortCode?: string | null;
  color?: string | null;
  logoUrl?: string | null;
  purse: number;
  purseUsed?: number;
  isBiddingEnabled?: boolean;
}

interface Tournament {
  name?: string;
  sport?: string;
  auctionUnit?: string | null;
}

interface TeamPurse {
  teamId: number;
  purseRemaining?: number;
  reservePurse?: number;
  spendablePurse: number;
  slotsRequired?: number;
  playersBought?: number;
  retainedCount?: number;
  maximumSquadSize?: number;
  lowestBasePrice?: number;
  purseUsed?: number;
  effectiveCapacity?: number;
  purse?: number;
  originalPurse?: number;
  boosterTotal?: number;
}

interface Props {
  state: AuctionState | null;
  team: Team;
  tournament: Tournament | null;
  teamPurse: TeamPurse | null;
  teamId: number;
  tournamentId: number;
  connectionStatus: ConnectionStatus;
  bidErrorMsg?: string;
  onBid: (amount: number) => Promise<"success" | "leading" | "error">;
  onViewSquad: () => void;
  onViewScout: () => void;
  navToast?: string | null;
  onNavToastDismiss?: () => void;
  onSignOut: () => void;
  onSync: () => void;
  isSyncError?: boolean;
}

// ── Anti-double-tap ──────────────────────────────────────────────────────────
function useDebounce(ms = 600) {
  const lastTap = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < ms) return false;
    lastTap.current = now;
    return true;
  }, [ms]);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TimerBar({
  timerEndsAt, teamColor, timerExpired,
}: {
  timerEndsAt: string | null | undefined;
  teamColor: string;
  timerExpired: boolean;
}) {
  const { secondsLeft } = useCountdown(timerEndsAt);
  if (!timerEndsAt) return null;

  const urgent = secondsLeft <= 5;
  const color  = timerExpired || urgent ? "#ef4444" : teamColor;

  return (
    <div className="flex items-center gap-4 px-1">
      <div className="flex-1 h-3 bg-[#27272a] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: timerExpired ? "0%" : `${Math.max(0, (secondsLeft / 30) * 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <motion.span
        key={secondsLeft}
        animate={urgent && !timerExpired ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="font-display font-black text-4xl tabular-nums w-16 text-right leading-none"
        style={{ color }}
      >
        {secondsLeft}s
      </motion.span>
    </div>
  );
}

const PLAYER_TAG_LABELS: Record<string, string> = {
  captain: "Captain",
  vice_captain: "Vice Captain",
  owner: "Owner",
  co_owner: "Co-Owner",
  booster: "Booster",
  icon: "Icon",
  star_player: "Star Player",
};

function PlayerCard({ player, teamColor, unit, categoryName, sport, tier }: {
  player: NonNullable<AuctionState["currentPlayer"]>;
  teamColor: string;
  unit: ReturnType<typeof resolveAuctionUnit>;
  categoryName?: string | null;
  sport?: string | null;
  tier: DeviceTier;
}) {
  const specGroupLabels = useRoleSpecGroups(sport ?? undefined, player.role).map((g) => g.groupName);
  const specs = useMemo(
    () => resolvePlayerSpecifications(player, { specGroupLabels }).filter((s) => s.value.trim()),
    [player, specGroupLabels],
  );

  const genderLabel = formatPlayerGender(player.gender);
  const tagLabel = player.playerTag ? (PLAYER_TAG_LABELS[player.playerTag] ?? player.playerTag.replace(/_/g, " ")) : null;

  const metaItems = [
    player.role ? { label: "Role", value: player.role } : null,
    player.age ? { label: "Age", value: String(player.age) } : null,
    player.city ? { label: "City", value: player.city } : null,
    genderLabel ? { label: "Gender", value: genderLabel } : null,
    player.jerseyNumber ? { label: "Jersey", value: `#${player.jerseyNumber}` } : null,
    categoryName ? { label: "Category", value: categoryName } : null,
    tagLabel ? { label: "Tag", value: tagLabel } : null,
    player.isNonPlayingMember ? { label: "Type", value: "Non-Playing" } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const cardPad = tier === "mobile" ? "p-4 gap-4" : "p-5 gap-5";
  const photoClass = tier === "mobile" ? "w-16 h-24" : tier === "tablet" ? "w-20 h-28" : "w-24 h-32";
  const nameClass = tier === "mobile" ? "text-2xl" : "text-3xl";
  const metaCols = tier === "mobile" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className={`flex items-start rounded-2xl border border-[#27272a] bg-[#18181b] ${cardPad}`}
    >
      <div className={`${photoClass} rounded-xl bg-[#27272a] border border-[#3f3f46] flex-shrink-0 overflow-hidden flex items-center justify-center`}>
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-10 h-10 text-[#52525b]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-sm text-[#71717a] shrink-0">#{player.serialNo ?? player.id}</span>
          <h2 className={`font-display font-black leading-tight text-white truncate ${nameClass}`}>{player.name}</h2>
        </div>

        {metaItems.length > 0 && (
          <div className={`grid ${metaCols} gap-x-4 gap-y-1.5 mt-3`}>
            {metaItems.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525b]">{label}</p>
                <p className="text-sm text-[#d4d4d8] capitalize truncate">{value}</p>
              </div>
            ))}
          </div>
        )}

        {specs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-[#27272a]">
            {specs.map((spec) => (
              <div key={`${spec.specGroupId ?? spec.label}-${spec.value}`} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525b]">{spec.label}</p>
                <p className="text-sm text-white font-semibold truncate">{spec.value}</p>
              </div>
            ))}
          </div>
        )}

        {player.achievements?.trim() && (
          <p className="text-sm text-[#a1a1aa] mt-3 pt-3 border-t border-[#27272a] line-clamp-2">
            {player.achievements.trim()}
          </p>
        )}

        {player.basePrice != null && (
          <p className="text-sm text-[#71717a] mt-3">
            Base <span className="text-white font-bold text-base">{formatIndianRupee(player.basePrice, unit)}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

type SquadListCategory = "retained" | "bought";

function TeamSquadSnapshot({
  teamColor,
  teamPurse,
  tournamentId,
  teamId,
  unit,
  tier,
}: {
  teamColor: string;
  teamPurse: TeamPurse | null;
  tournamentId: number;
  teamId: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
}) {
  const [expanded, setExpanded] = useState<SquadListCategory | null>(null);

  const { data: allPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 15_000,
    },
  });

  const { retainedPlayers, boughtPlayers } = useMemo(() => {
    const mine = (allPlayers ?? []).filter(
      (p) => p.teamId === teamId && !p.isNonPlayingMember,
    );
    return {
      retainedPlayers: mine
        .filter((p) => p.status === "retained")
        .map((p) => ({
          id: p.id,
          name: p.name,
          amount: resolveRetainedSpend({
            status: "retained",
            retainedPrice: p.retainedPrice,
            basePrice: p.basePrice,
          }) || p.soldPrice || 0,
        })),
      boughtPlayers: mine
        .filter((p) => p.status === "sold")
        .map((p) => ({
          id: p.id,
          name: p.name,
          amount: p.soldPrice ?? 0,
        })),
    };
  }, [allPlayers, teamId]);

  const maxSquad = teamPurse?.maximumSquadSize ?? 0;
  const totalInSquad = teamPurse?.playersBought ?? retainedPlayers.length + boughtPlayers.length;
  const retainedCount = teamPurse?.retainedCount ?? retainedPlayers.length;
  const boughtCount = boughtPlayers.length;
  const stillNeed = maxSquad > 0 ? Math.max(0, maxSquad - totalInSquad) : null;

  const expandedPlayers = expanded === "retained" ? retainedPlayers : boughtPlayers;
  const expandedTitle = expanded === "retained" ? "Retained Players" : "Bought Players";

  const toggleCategory = (category: SquadListCategory) => {
    setExpanded((prev) => (prev === category ? null : category));
  };

  const statValueClass = tier === "mobile" ? "text-xl" : tier === "tablet" ? "text-2xl" : "text-2xl";
  const statLabelClass = tier === "mobile" ? "text-[10px]" : "text-[11px]";

  return (
    <div className="rounded-2xl border border-[#27272a] bg-[#18181b] overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-[#27272a]">
        <div className="px-3 py-3 text-center">
          <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: BIDWAR_AMBER }}>
            {maxSquad > 0 ? maxSquad : totalInSquad}
          </p>
          <p className={`font-bold uppercase tracking-wider text-[#52525b] mt-1.5 ${statLabelClass}`}>
            Squad Target
          </p>
          <p className="text-[10px] text-[#71717a] mt-0.5">
            {maxSquad > 0
              ? stillNeed != null && stillNeed > 0
                ? `${stillNeed} more needed`
                : `${totalInSquad}/${maxSquad} filled`
              : `${totalInSquad} in squad`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => toggleCategory("retained")}
          className={`px-3 py-3 text-center transition-colors active:scale-[0.98] ${
            expanded === "retained" ? "bg-[#27272a]" : "hover:bg-[#1f1f23]"
          }`}
        >
          <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: teamColor }}>
            {retainedCount}
          </p>
          <p className={`font-bold uppercase tracking-wider text-[#52525b] mt-1.5 ${statLabelClass}`}>
            Retained
          </p>
          <p className="text-[10px] text-[#71717a] mt-0.5">Tap to view</p>
        </button>

        <button
          type="button"
          onClick={() => toggleCategory("bought")}
          className={`px-3 py-3 text-center transition-colors active:scale-[0.98] ${
            expanded === "bought" ? "bg-[#27272a]" : "hover:bg-[#1f1f23]"
          }`}
        >
          <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: teamColor }}>
            {boughtCount}
          </p>
          <p className={`font-bold uppercase tracking-wider text-[#52525b] mt-1.5 ${statLabelClass}`}>
            Bought
          </p>
          <p className="text-[10px] text-[#71717a] mt-0.5">Tap to view</p>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key={expanded}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#27272a]"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#141416]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#a1a1aa]">{expandedTitle}</p>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="p-1 rounded-lg text-[#71717a] hover:text-white hover:bg-[#27272a] transition-colors"
                aria-label="Close player list"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {expandedPlayers.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#52525b]">No players yet</p>
            ) : (
              <ul className={`overflow-y-auto overscroll-contain divide-y divide-[#27272a] [-webkit-overflow-scrolling:touch] ${
                tier === "mobile" ? "max-h-36" : tier === "tablet" ? "max-h-44" : "max-h-52"
              }`}>
                {expandedPlayers.map((player) => (
                  <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm font-semibold text-white truncate">{player.name}</span>
                    <span className="text-sm font-bold shrink-0" style={{ color: teamColor }}>
                      {formatIndianRupee(player.amount, unit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TeamPurseFooter({
  teamColor,
  teamPurse,
  team,
  tournamentId,
  teamId,
  unit,
  tier,
  highlightBoost = false,
  purseOverride = null,
}: {
  teamColor: string;
  teamPurse: TeamPurse | null;
  team: Team;
  tournamentId: number;
  teamId: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
  highlightBoost?: boolean;
  purseOverride?: {
    totalPurse: number;
    boosterTotal: number;
    spendablePurse: number;
  } | null;
}) {
  const { data: allPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 15_000,
    },
  });

  const retainedSpend = useMemo(
    () =>
      (allPlayers ?? [])
        .filter((p) => p.teamId === teamId && p.status === "retained")
        .reduce(
          (sum, p) =>
            sum +
            resolveRetainedSpend({
              status: "retained",
              retainedPrice: p.retainedPrice,
              basePrice: p.basePrice,
            }),
          0,
        ),
    [allPlayers, teamId],
  );

  const totalPurse = purseOverride?.totalPurse ?? teamPurse?.effectiveCapacity ?? teamPurse?.purse ?? team.purse;
  const totalSpent = teamPurse?.purseUsed ?? team.purseUsed ?? 0;
  const reserve = teamPurse?.reservePurse ?? 0;
  const boosterTotal = purseOverride?.boosterTotal ?? teamPurse?.boosterTotal ?? 0;
  const spendable = purseOverride?.spendablePurse ?? teamPurse?.spendablePurse ?? Math.max(0, totalPurse - totalSpent);
  const slotsRequired = teamPurse?.slotsRequired ?? 0;
  const maxBid = slotsRequired > 0 ? Math.floor(spendable / slotsRequired) : spendable;

  const syncBoostValues = highlightBoost && purseOverride != null;
  const fmtFooter = (amount: number, synced = false) =>
    synced && syncBoostValues
      ? formatIndianRupee(amount, unit)
      : formatShortIndianRupee(amount, unit);

  const valueClass =
    tier === "mobile" ? "text-sm sm:text-base" : tier === "tablet" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl";
  const labelClass = tier === "mobile" ? "text-[9px] sm:text-[10px] mt-1" : "text-[10px] sm:text-xs mt-1.5";
  const cellPad = tier === "mobile" ? "px-0.5 py-2" : "px-1 py-2.5";

  const items = useMemo(() => {
    const teamNum = teamColor;
    const bidwarNum = (active = true) => (active ? BIDWAR_AMBER : "#71717a");

    const cols: {
      key: string;
      label: string;
      value: string;
      accent: string;
      pulseOnBoost?: boolean;
    }[] = [
      {
        key: "total-purse",
        label: tier === "mobile" ? "Purse" : "Total Purse",
        value: fmtFooter(totalPurse, true),
        accent: teamNum,
        pulseOnBoost: true,
      },
    ];

    if (retainedSpend > 0) {
      cols.push({
        key: "retained",
        label: "Retained",
        value: fmtFooter(retainedSpend),
        accent: teamNum,
      });
    }

    cols.push(
      {
        key: "spent",
        label: tier === "mobile" ? "Spent" : "Total Spent",
        value: fmtFooter(totalSpent),
        accent: teamNum,
      },
      {
        key: "purse-left",
        label: "Can Bid",
        value: fmtFooter(spendable, true),
        accent: teamNum,
        pulseOnBoost: true,
      },
      {
        key: "reserve",
        label: "Reserve",
        value: fmtFooter(reserve),
        accent: bidwarNum(reserve > 0),
      },
    );

    if (boosterTotal > 0) {
      cols.push({
        key: "boosted",
        label: tier === "mobile" ? "Boosted" : "Total Boosted",
        value: fmtFooter(boosterTotal, true),
        accent: bidwarNum(true),
        pulseOnBoost: true,
      });
    }

    cols.push({
      key: "max-bid",
      label: "Max Bid",
      value: fmtFooter(maxBid, true),
      accent: teamNum,
      pulseOnBoost: true,
    });

    return cols;
  }, [
    tier,
    totalPurse,
    retainedSpend,
    totalSpent,
    spendable,
    reserve,
    boosterTotal,
    maxBid,
    teamColor,
    unit,
    syncBoostValues,
  ]);

  return (
    <div
      className={`grid divide-x divide-[#27272a] transition-shadow duration-500 ${highlightBoost ? "rounded-xl ring-2 ring-amber-400/70" : ""}`}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        ...(highlightBoost ? { boxShadow: `0 0 24px ${BIDWAR_AMBER}40` } : {}),
      }}
    >
      {items.map(({ key, label, value, accent, pulseOnBoost }) => (
        <div key={key} className={`text-center min-w-0 ${cellPad}`}>
          <motion.p
            animate={
              highlightBoost && pulseOnBoost
                ? { scale: [1, 1.12, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.55, repeat: highlightBoost ? 2 : 0 }}
            className={`font-display font-black leading-none ${valueClass}`}
            style={{ color: accent }}
          >
            {value}
          </motion.p>
          <p className={`text-[#a1a1aa] font-bold uppercase tracking-wide leading-tight ${labelClass}`}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function BidAmount({ amount, isLeading, teamColor, leadingTeam, unit, tier }: {
  amount: number;
  isLeading: boolean;
  teamColor: string;
  leadingTeam?: string | null;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
}) {
  const amountClass = tier === "mobile" ? "text-5xl" : tier === "tablet" ? "text-6xl" : "text-7xl";
  return (
    <div className="text-center py-2">
      <p className={`font-bold text-[#71717a] uppercase tracking-widest mb-2 ${tier === "mobile" ? "text-xs" : "text-sm"}`}>
        {isLeading ? "Your Bid — You Are Leading" : "Current Bid"}
      </p>
      <motion.p
        key={amount}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`font-display font-black leading-none ${amountClass}`}
        style={{ color: isLeading ? teamColor : "#ffffff" }}
      >
        {formatIndianRupee(amount || 0, unit)}
      </motion.p>
      {!isLeading && leadingTeam && (
        <p className="text-base text-[#71717a] mt-2">
          Leading: <span className="font-bold text-white text-lg">{leadingTeam}</span>
        </p>
      )}
    </div>
  );
}

interface BidDisabledHint {
  headline: string;
  subline?: string;
}

function getBidDisabledHint(params: {
  isPaused: boolean;
  isActive: boolean;
  maxSquadReached: boolean;
  categoryLimitReached: boolean;
  categoryMax: number | null;
  categoryName: string | null | undefined;
  biddingEnabled: boolean;
  timerActive: boolean;
  hasTimer: boolean;
  spendablePurse: number;
  nextBidAmount: number;
  reservePurse: number;
  slotsRequired: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
}): BidDisabledHint {
  if (params.isPaused) {
    return { headline: "Auction paused", subline: "The operator has paused bidding" };
  }
  if (!params.isActive) {
    return { headline: "Auction not live", subline: "Bidding opens when the auction starts" };
  }
  if (params.maxSquadReached) {
    return { headline: "Squad full", subline: "Maximum squad size reached" };
  }
  if (params.categoryLimitReached) {
    return {
      headline: "Category limit reached",
      subline: `Max ${params.categoryMax} in ${params.categoryName ?? "this category"}`,
    };
  }
  if (!params.biddingEnabled) {
    return { headline: "Bidding disabled", subline: "Contact the auction operator" };
  }
  if (!params.timerActive) {
    return params.hasTimer
      ? { headline: "Timer ended", subline: "Waiting for the operator's next action" }
      : { headline: "Bidding not open yet", subline: "Wait for the operator to start the timer" };
  }
  if (params.spendablePurse < params.nextBidAmount) {
    const shortfall = params.nextBidAmount - params.spendablePurse;
    if (params.reservePurse > 0) {
      return {
        headline: `${formatShortIndianRupee(shortfall, params.unit)} short for this bid`,
        subline: `${formatShortIndianRupee(params.spendablePurse, params.unit)} spendable · ${formatShortIndianRupee(params.reservePurse, params.unit)} held for ${params.slotsRequired} open slot${params.slotsRequired !== 1 ? "s" : ""}`,
      };
    }
    return {
      headline: `${formatShortIndianRupee(shortfall, params.unit)} short for this bid`,
      subline: `${formatShortIndianRupee(params.spendablePurse, params.unit)} spendable · bid needs ${formatShortIndianRupee(params.nextBidAmount, params.unit)}`,
    };
  }
  return { headline: "Bid unavailable", subline: "Try refreshing or wait a moment" };
}

function BidDisabledMessage({ hint, compact }: { hint: BidDisabledHint; compact?: boolean }) {
  return (
    <div
      className={`text-center rounded-xl border border-[#27272a] bg-[#18181b] ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}
    >
      <p className={`font-semibold text-[#d4d4d8] ${compact ? "text-xs" : "text-sm"}`}>{hint.headline}</p>
      {hint.subline && (
        <p className={`text-[#71717a] mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>{hint.subline}</p>
      )}
    </div>
  );
}

function AuctionPauseBanner({
  isOnBreak,
  hasLiveCountdown,
  breakLabel,
  breakMins,
  breakSecs,
  breakMessage,
}: {
  isOnBreak: boolean;
  hasLiveCountdown: boolean;
  breakLabel: string;
  breakMins: number;
  breakSecs: number;
  breakMessage: string | null;
}) {
  if (isOnBreak) {
    const clock = hasLiveCountdown
      ? `${String(breakMins).padStart(2, "0")}:${String(breakSecs).padStart(2, "0")}`
      : null;
    return (
      <div className="flex-shrink-0 mx-4 mt-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-center">
        <div className="flex items-center justify-center gap-2">
          <Coffee className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm font-bold text-amber-300 uppercase tracking-wide">{breakLabel}</p>
        </div>
        {clock ? (
          <p className="font-display font-black text-2xl text-amber-400 tabular-nums mt-1">{clock}</p>
        ) : null}
        <p className={`text-xs text-amber-200/80 ${clock ? "mt-0.5" : "mt-1"}`}>
          {breakMessage?.trim() || (clock ? "Bidding resumes when the break ends" : "Break started — syncing timer…")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 mx-4 mt-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-center">
      <p className="text-sm font-bold text-amber-300 uppercase tracking-wide">Auction Paused</p>
      <p className="text-xs text-amber-200/80 mt-0.5">Auction paused by operator. Bidding is disabled.</p>
    </div>
  );
}

function BidButton({
  canBid, isLeading, timerExpired, hasPlayer, isActive, isPaused, isIdle, isOnBreak,
  hasLiveCountdown, breakMins, breakSecs, breakMessage, breakLabel,
  bidding, bidFeedback, nextBidAmount, teamColor, onBid, layout, tier, unit, dock = false,
}: {
  canBid: boolean;
  isLeading: boolean;
  timerExpired: boolean;
  hasPlayer: boolean;
  isActive: boolean;
  isPaused: boolean;
  isIdle: boolean;
  isOnBreak: boolean;
  hasLiveCountdown: boolean;
  breakMins: number;
  breakSecs: number;
  breakMessage?: string | null;
  breakLabel: string;
  bidding: boolean;
  bidFeedback: "success" | "error" | "leading" | null;
  nextBidAmount: number;
  teamColor: string;
  onBid: () => void;
  layout: "stacked" | "split";
  tier: DeviceTier;
  unit: ReturnType<typeof resolveAuctionUnit>;
  dock?: boolean;
}) {
  const isSplit = layout === "split";
  const buttonH = dock
    ? tier === "mobile" ? "h-36" : tier === "tablet" ? "h-40" : "h-36"
    : isSplit
      ? tier === "mobile" ? "min-h-[42vh] h-full" : tier === "tablet" ? "min-h-[44vh] h-full" : "min-h-[40vh] h-full"
      : tier === "mobile" ? "h-full min-h-[22vh]" : "h-full min-h-[18vh]";
  const dockIdleH = dock
    ? tier === "mobile" ? "h-36" : tier === "tablet" ? "h-40" : "h-36"
    : isSplit ? "h-16" : "h-14";
  const dockStatusH = tier === "mobile" ? "h-36" : tier === "tablet" ? "h-40" : "h-36";
  const bidFontSize = dock
    ? tier === "mobile"
      ? "clamp(2rem, 8.5vw, 3rem)"
      : tier === "tablet"
        ? "clamp(2.25rem, 5.5vw, 3.35rem)"
        : "clamp(2rem, 3vw, 3rem)"
    : isSplit
      ? tier === "laptop"
        ? "clamp(2.25rem, 4.5vw, 4rem)"
        : tier === "tablet"
          ? "clamp(2.15rem, 5.5vw, 3.5rem)"
          : "clamp(2rem, 6vw, 3.25rem)"
      : tier === "mobile"
        ? "clamp(2rem, 10vw, 3rem)"
        : "clamp(2.25rem, 8vw, 3.5rem)";

  if (isOnBreak) {
    const clock = hasLiveCountdown
      ? `${String(breakMins).padStart(2, "0")}:${String(breakSecs).padStart(2, "0")}`
      : "--:--";
    const clockClass = dock
      ? tier === "mobile" ? "text-4xl" : "text-5xl"
      : tier === "mobile" ? "text-5xl" : "text-6xl";

    return (
      <div
        className={`w-full ${dock ? dockStatusH : buttonH} rounded-3xl border-2 border-amber-400/35 bg-amber-500/10 flex items-center justify-center px-4`}
      >
        <p className={`font-display font-black tabular-nums ${clockClass}`} style={{ color: BIDWAR_AMBER }}>
          {clock}
        </p>
      </div>
    );
  }

  if (isLeading) {
    return (
      <motion.div
        key="leading"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${dock ? dockStatusH : buttonH} rounded-3xl border-4 flex flex-col items-center justify-center gap-4 px-6`}
        style={{ borderColor: `${teamColor}80`, backgroundColor: `${teamColor}18` }}
      >
        <Trophy className={dock ? "w-10 h-10" : "w-16 h-16"} style={{ color: teamColor }} />
        <div className="text-center">
          <p className={`font-display font-black ${dock ? "text-xl" : "text-3xl"}`} style={{ color: teamColor }}>HIGHEST BIDDER</p>
          {!dock && <p className="text-base text-[#71717a] mt-2">Waiting for other teams...</p>}
        </div>
      </motion.div>
    );
  }

  if (timerExpired && hasPlayer) {
    return (
      <motion.div
        key="expired"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${dock ? dockStatusH : buttonH} rounded-3xl border-2 border-red-500/30 bg-red-500/10 flex flex-col items-center justify-center gap-4`}
      >
        <AlertTriangle className={`${dock ? "w-10 h-10" : "w-14 h-14"} text-red-400`} />
        <div className="text-center">
          <p className={`font-display font-black text-red-400 ${dock ? "text-xl" : "text-3xl"}`}>BIDDING CLOSED</p>
          {!dock && <p className="text-base text-[#71717a] mt-2">Timer expired — awaiting operator</p>}
        </div>
      </motion.div>
    );
  }

  if (!isActive || !hasPlayer) {
    if (dock) {
      const idleMessage = isPaused
        ? "Auction paused"
        : isIdle
          ? "Auction not started"
          : "Waiting for player";
      return (
        <motion.div
          key="waiting-dock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full ${dockIdleH} rounded-3xl border-2 border-dashed border-[#3f3f46] bg-[#18181b] flex flex-col items-center justify-center gap-1 px-4`}
        >
          <p className={`font-display font-black text-[#52525b] ${tier === "mobile" ? "text-3xl" : tier === "tablet" ? "text-[2rem]" : "text-2xl"}`}>BID</p>
          <p className="text-xs text-[#71717a] font-medium text-center">{idleMessage}</p>
        </motion.div>
      );
    }
    return (
      <motion.div
        key="waiting"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`w-full ${buttonH} rounded-3xl border border-dashed border-[#3f3f46] bg-[#18181b] flex flex-col items-center justify-center gap-3`}
      >
        <div className="w-10 h-10 border-2 border-[#3f3f46] border-t-[#71717a] rounded-full animate-spin" />
        <p className="text-base text-[#71717a] font-semibold">
          {isPaused
            ? "Auction paused by operator."
            : isIdle
              ? "Waiting for auction to start..."
              : "Waiting for next player..."}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.button
      key="bid-btn"
      onClick={onBid}
      disabled={!canBid || bidding}
      whileTap={canBid ? { scale: 0.95 } : {}}
      animate={bidFeedback === "success" ? { scale: [1, 1.04, 1] } : {}}
      className={`w-full ${buttonH} rounded-3xl font-display font-black text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all select-none`}
      style={{
        backgroundColor: canBid ? teamColor : "#374151",
        boxShadow: canBid ? `0 0 60px ${teamColor}50, 0 8px 32px rgba(0,0,0,0.5)` : "none",
        color: canBid ? "black" : "#6b7280",
        fontSize: bidFontSize,
      }}
    >
      {bidding ? (
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
      ) : bidFeedback === "success" ? (
        <span>BID PLACED!</span>
      ) : (
        <div className="flex flex-col items-center leading-none gap-2">
          <span>BID</span>
          <span style={{ fontSize: "0.42em", fontWeight: 700, opacity: 0.85 }}>
            {formatIndianRupee(nextBidAmount, unit)}
          </span>
        </div>
      )}
    </motion.button>
  );
}

// ── Half-screen unsold overlay (bottom half only) ─────────────────────────────
function UnsoldOverlay({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-x-0 bottom-0 h-1/2 z-40 flex flex-col items-center justify-center gap-3 px-6 border-t border-red-500/25 pointer-events-none"
      style={{ backgroundColor: "rgba(9,9,11,0.9)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22 }}
        className="text-center max-w-md"
      >
        <XCircle className="w-14 h-14 text-red-400 mx-auto" />
        <p className="font-display font-black text-3xl sm:text-4xl text-red-400 mt-3">UNSOLD</p>
        <p className="text-lg sm:text-xl font-bold text-white mt-2 truncate">{name}</p>
        <p className="text-sm text-[#71717a] mt-1">Player goes to UNSOLD Pool</p>
      </motion.div>
    </motion.div>
  );
}

// ── Unsold player card ────────────────────────────────────────────────────────
function UnsoldPlayerCard({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  return (
    <motion.div
      key="last-unsold"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex items-center gap-5 p-5 rounded-2xl border bg-[#18181b] relative overflow-hidden"
      style={{ borderColor: "rgba(239,68,68,0.35)" }}
    >
      <div className="w-20 h-28 rounded-xl bg-[#27272a] border border-[#3f3f46] flex-shrink-0 overflow-hidden flex items-center justify-center">
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover opacity-70 grayscale" />
        ) : (
          <User className="w-10 h-10 text-[#52525b]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest mb-1 text-red-400">Unsold</p>
        <h2 className="font-display font-bold text-2xl leading-tight text-white truncate">{name}</h2>
        <p className="text-sm text-[#71717a] mt-1">Player goes to UNSOLD Pool</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="inline-flex items-center px-2 py-1 rounded-lg mt-1 border text-xs font-black uppercase tracking-wider bg-red-500/15 border-red-500/35 text-red-400">
          UNSOLD
        </div>
      </div>
    </motion.div>
  );
}

// ── Last sold player card ─────────────────────────────────────────────────────
function LastSoldPlayerCard({ player, teamColor, wonByThisTeam, unit }: {
  player: NonNullable<AuctionState["lastSoldPlayer"]>;
  teamColor: string;
  wonByThisTeam: boolean;
  unit: ReturnType<typeof resolveAuctionUnit>;
}) {
  const soldColor = wonByThisTeam ? teamColor : "#22c55e";
  return (
    <motion.div
      key="last-sold"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex items-center gap-5 p-5 rounded-2xl border bg-[#18181b] relative overflow-hidden"
      style={{ borderColor: `${soldColor}40` }}
    >
      <div className="w-20 h-28 rounded-xl bg-[#27272a] border border-[#3f3f46] flex-shrink-0 overflow-hidden flex items-center justify-center">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.name ?? ""} className="w-full h-full object-cover opacity-70" />
        ) : (
          <User className="w-10 h-10 text-[#52525b]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: soldColor }}>
          {wonByThisTeam ? "Your team won!" : "Last sold"}
        </p>
        <h2 className="font-display font-bold text-2xl leading-tight text-white truncate">{player.name}</h2>
        {player.role && <p className="text-sm text-[#71717a] capitalize mt-1">{player.role}</p>}
        {!wonByThisTeam && player.soldToTeamName && (
          <p className="text-sm text-[#71717a] mt-1">
            Won by <span className="text-white font-bold">{player.soldToTeamName}</span>
          </p>
        )}
      </div>
      {player.soldAmount != null && (
        <div className="text-right flex-shrink-0">
          <p className="font-display font-black text-xl" style={{ color: soldColor }}>
            {formatIndianRupee(player.soldAmount, unit)}
          </p>
          <div
            className="inline-flex items-center px-2 py-1 rounded-lg mt-1 border text-xs font-black uppercase tracking-wider"
            style={{ backgroundColor: `${soldColor}20`, borderColor: `${soldColor}40`, color: soldColor }}
          >
            SOLD
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Header brand logo (wordmark — not OBS trapezoid badge) ────────────────────
function HeaderBrandLogo({
  logos,
  brandName,
  layout,
  tier,
  iconVersion,
}: {
  logos: { obsWatermark?: string | null; main?: string | null; mainReverse?: string | null; mini?: string | null; splash?: string | null };
  brandName: string;
  layout: "stacked" | "split";
  tier: DeviceTier;
  iconVersion?: number;
}) {
  const src = resolveHeaderBrandLogoUrl(logos, iconVersion);
  const sizeClass =
    layout === "stacked"
      ? tier === "mobile"
        ? "h-12 w-auto max-w-[min(300px,82vw)]"
        : tier === "tablet"
          ? "h-[3.75rem] w-auto max-w-[min(360px,78vw)]"
          : "h-16 w-auto max-w-[min(400px,70vw)]"
      : tier === "mobile"
        ? "h-9 w-auto max-w-[min(150px,34vw)]"
        : tier === "tablet"
          ? "h-10 w-auto max-w-[min(170px,28vw)]"
          : "h-11 w-auto max-w-[min(190px,22vw)]";

  return (
    <img
      src={src}
      alt={brandName}
      className={`object-contain object-center block ${sizeClass}`}
      decoding="async"
    />
  );
}

function PurseBoosterCelebration({
  banner,
  fmt,
  tier,
  accentColor,
  onDismiss,
}: {
  banner: {
    variant: "own" | "peer";
    teamName?: string;
    amount: number;
    previousCapacity: number;
    newCapacity: number;
  };
  fmt: (amount: number | null | undefined) => string;
  tier: DeviceTier;
  accentColor: string;
  onDismiss: () => void;
}) {
  const titleClass = tier === "mobile" ? "text-3xl" : "text-4xl";
  const amountClass = tier === "mobile" ? "text-4xl" : "text-5xl";
  const isPeer = banner.variant === "peer";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-[45] flex items-center justify-center px-4 sm:px-8 cursor-pointer"
      style={{ backgroundColor: "rgba(9,9,11,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onDismiss}
      role="button"
      aria-label="Dismiss purse booster celebration"
    >
      <motion.div
        initial={{ scale: 0.88, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="relative w-full max-w-md text-center pointer-events-none"
      >
        <motion.div
          aria-hidden
          className="absolute -inset-8 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accentColor}45 0%, transparent 70%)` }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 0.9, repeat: 1, ease: "easeInOut" }}
        />

        <motion.div
          animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 0.55, repeat: 1 }}
          className="mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center border-2"
          style={{ backgroundColor: `${accentColor}18`, borderColor: `${accentColor}80` }}
        >
          <Sparkles className="w-10 h-10" style={{ color: accentColor }} />
        </motion.div>

        <p className={`font-display font-black uppercase tracking-wider ${titleClass}`} style={{ color: accentColor }}>
          Purse Booster!
        </p>
        <p className="text-sm text-[#a1a1aa] mt-2">
          {isPeer
            ? (
              <>
                <span className="text-white font-semibold">{banner.teamName}</span>
                {" received a budget boost"}
              </>
            )
            : "Your team budget just increased"}
        </p>
        {isPeer ? (
          <p className="text-[11px] text-[#71717a] mt-1">Purse bar below shows your team only</p>
        ) : null}

        <motion.p
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.45, repeat: 2 }}
          className={`font-display font-black text-white mt-5 ${amountClass}`}
        >
          +{fmt(banner.amount)}
        </motion.p>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
          <div className="rounded-xl border border-[#27272a] bg-[#141416] px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[#71717a]">Before</p>
            <p className="text-lg font-mono text-white mt-1">{fmt(banner.previousCapacity)}</p>
          </div>
          <span className="font-black text-xl" style={{ color: accentColor }}>→</span>
          <div
            className="rounded-xl border px-3 py-3"
            style={{ borderColor: `${accentColor}55`, backgroundColor: `${accentColor}12` }}
          >
            <p className="text-[10px] uppercase tracking-wider" style={{ color: `${accentColor}cc` }}>
              {isPeer ? "New total" : "After"}
            </p>
            <p className="text-lg font-mono mt-1" style={{ color: accentColor }}>{fmt(banner.newCapacity)}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function usePurseBoosterCelebration(
  teamId: number,
  teamPurse: TeamPurse | null,
  lastPurseBooster: AuctionState["lastPurseBooster"],
  bidActivityKey: string,
  originalPurse: number,
) {
  type BoosterBanner = {
    variant: "own" | "peer";
    teamName?: string;
    amount: number;
    previousCapacity: number;
    newCapacity: number;
  };

  const [banner, setBanner] = useState<BoosterBanner | null>(null);
  const [footerPulse, setFooterPulse] = useState(false);

  const hydratedRef = useRef(false);
  const lastBoosterIdRef = useRef<number | null>(null);
  const prevCapacityRef = useRef<number | null>(null);
  const prevBoosterTotalRef = useRef<number | null>(null);
  const celebrationKeyRef = useRef<string | null>(null);
  const bidActivityAtShowRef = useRef<string | null>(null);

  const dismiss = useCallback(() => {
    setBanner(null);
    bidActivityAtShowRef.current = null;
  }, []);
  const showCelebration = useCallback((
    data: BoosterBanner,
    key: string,
  ) => {
    if (celebrationKeyRef.current === key) return;
    celebrationKeyRef.current = key;
    bidActivityAtShowRef.current = bidActivityKey;
    setBanner(data);
    if (data.variant === "own") {
      setFooterPulse(true);
      hapticBooster();
    }
  }, [bidActivityKey]);

  useEffect(() => {
    const capacity = teamPurse?.effectiveCapacity ?? teamPurse?.purse ?? null;
    const boosterTotal = teamPurse?.boosterTotal ?? 0;
    const boost = lastPurseBooster;

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastBoosterIdRef.current = boost?.id ?? null;
      prevCapacityRef.current = capacity;
      prevBoosterTotalRef.current = boosterTotal;
      return;
    }

    if (boost && boost.id !== lastBoosterIdRef.current) {
      lastBoosterIdRef.current = boost.id;
      const prevCapacity = prevCapacityRef.current;
      const prevBoosterTotal = prevBoosterTotalRef.current ?? 0;
      prevCapacityRef.current = capacity;
      prevBoosterTotalRef.current = boosterTotal;

      const ownPurseIncreased =
        capacity != null &&
        prevCapacity != null &&
        (capacity > prevCapacity || boosterTotal > prevBoosterTotal);

      if (boost.teamId === teamId || ownPurseIncreased) {
        showCelebration(
          {
            variant: "own",
            amount: boost.teamId === teamId
              ? boost.amount
              : capacity != null && prevCapacity != null
                ? capacity - prevCapacity
                : boost.amount,
            previousCapacity: boost.teamId === teamId
              ? boost.previousCapacity
              : prevCapacity ?? boost.previousCapacity,
            newCapacity: boost.teamId === teamId
              ? boost.newCapacity
              : capacity ?? boost.newCapacity,
          },
          `booster:${boost.id}:own`,
        );
        return;
      }

      showCelebration(
        {
          variant: "peer",
          teamName: boost.teamName,
          amount: boost.amount,
          previousCapacity: boost.previousCapacity,
          newCapacity: boost.newCapacity,
        },
        `booster:${boost.id}:peer`,
      );
      return;
    }

    if (capacity == null) return;

    const prevCapacity = prevCapacityRef.current;
    const prevBoosterTotal = prevBoosterTotalRef.current ?? 0;
    prevCapacityRef.current = capacity;
    prevBoosterTotalRef.current = boosterTotal;

    if (prevCapacity == null) return;
    if (boosterTotal <= prevBoosterTotal || capacity <= prevCapacity) return;

    showCelebration(
      {
        variant: "own",
        amount: capacity - prevCapacity,
        previousCapacity: prevCapacity,
        newCapacity: capacity,
      },
      `capacity:${prevCapacity}:${capacity}:${boosterTotal}`,
    );
  }, [
    teamId,
    lastPurseBooster,
    teamPurse?.effectiveCapacity,
    teamPurse?.purse,
    teamPurse?.boosterTotal,
    showCelebration,
  ]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(dismiss, 8000);
    return () => clearTimeout(t);
  }, [banner, dismiss]);

  useEffect(() => {
    if (!banner || bidActivityAtShowRef.current === null) return;
    if (bidActivityKey !== bidActivityAtShowRef.current) {
      dismiss();
    }
  }, [bidActivityKey, banner, dismiss]);

  useEffect(() => {
    if (!footerPulse) return;
    const t = setTimeout(() => setFooterPulse(false), 2000);
    return () => clearTimeout(t);
  }, [footerPulse]);

  const footerOverride = useMemo(() => {
    if (!banner || banner.variant !== "own") return null;
    const capacityDelta = banner.newCapacity - banner.previousCapacity;
    const baseSpendable =
      teamPurse?.spendablePurse ??
      Math.max(0, banner.previousCapacity - (teamPurse?.purseUsed ?? 0));
    return {
      totalPurse: banner.newCapacity,
      boosterTotal: banner.newCapacity - originalPurse,
      spendablePurse: baseSpendable + capacityDelta,
    };
  }, [banner, originalPurse, teamPurse?.spendablePurse, teamPurse?.purseUsed]);

  return { banner, footerPulse, dismiss, footerOverride };
}

function MaxSquadNotice({ maxSquadReached }: { maxSquadReached: boolean }) {
  if (!maxSquadReached) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-red-500/25 bg-red-500/8">
      <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-red-400 font-semibold">Maximum squad size reached — bidding blocked</p>
    </div>
  );
}

function HeaderActionButton({
  onClick,
  title,
  label,
  blocked = false,
  compact = false,
  children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  blocked?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={blocked ? undefined : onClick}
      title={title}
      aria-label={title}
      aria-disabled={blocked}
      disabled={blocked}
      className={`inline-flex flex-col items-center justify-center gap-0.5 rounded-xl border transition-all active:scale-95 ${
        compact ? "min-w-[38px] px-1 py-1" : "min-w-[44px] px-1.5 py-1.5"
      } ${
        blocked
          ? "border-[#27272a] bg-[#141416] text-[#52525b] opacity-50 cursor-not-allowed"
          : "border-[#3f3f46] bg-[#18181b] text-[#d4d4d8] hover:text-white hover:border-[#52525b] hover:bg-[#27272a] shadow-sm"
      }`}
    >
      {children}
      <span className={`font-bold uppercase tracking-wide leading-none ${compact ? "text-[7px]" : "text-[8px]"}`}>
        {label}
      </span>
    </button>
  );
}

function resolveHeaderToolbar(_team: Team, _teamColor: string, actionCompact: boolean) {
  return {
    teamLogoClass: actionCompact ? "w-9 h-9 rounded-lg" : "w-10 h-10 rounded-xl",
    teamNameClass: actionCompact ? "text-sm" : "text-base",
  };
}

function LiveBidHeader({
  team,
  teamColor,
  tournament,
  isActive,
  isPaused,
  statusLabel,
  feed,
  logos,
  brandName,
  miniBrandText: _miniBrandText,
  navBlocked,
  syncing,
  onSync,
  onViewSquad,
  onViewScout,
  onLeave,
  layout,
  tier,
  iconVersion,
}: {
  team: Team;
  teamColor: string;
  tournament: Tournament | null;
  isActive: boolean;
  isPaused: boolean;
  statusLabel: string;
  feed: ReturnType<typeof useAuctionConnectionState>;
  logos: { obsWatermark?: string | null; main?: string | null; mainReverse?: string | null; mini?: string | null; splash?: string | null };
  brandName: string;
  miniBrandText: string;
  navBlocked: boolean;
  syncing: boolean;
  onSync: () => void;
  onViewSquad: () => void;
  onViewScout: () => void;
  onLeave: () => void;
  layout: "stacked" | "split";
  tier: DeviceTier;
  iconVersion?: number;
}) {
  const showTournamentLine = layout === "stacked" && tier !== "mobile";
  const actionCompact = tier !== "laptop";
  const { teamLogoClass, teamNameClass } = resolveHeaderToolbar(team, teamColor, actionCompact);

  const teamBlock = (
    <div className="flex items-center gap-2 min-w-0">
      <TeamLogo
        logoUrl={team.logoUrl}
        shortCode={team.shortCode}
        teamName={team.name}
        teamColor={teamColor}
        className={`${teamLogoClass} flex-shrink-0`}
        textClassName={actionCompact ? "text-xs" : undefined}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`font-display font-bold leading-none truncate ${teamNameClass}`} style={{ color: teamColor }}>
            {team.name}
          </p>
          <span
            className={`text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              isActive
                ? "bg-green-500/20 text-green-400"
                : isPaused
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-[#27272a] text-[#71717a]"
            }`}
          >
            {statusLabel}
          </span>
          <AuctionFeedIndicator
            feedState={feed.state}
            secondsSinceLastActivity={feed.secondsSinceLastActivity}
            className="w-4 h-4 flex-shrink-0"
          />
        </div>
        {showTournamentLine && (
          <p className="text-xs text-[#71717a] mt-0.5 truncate">{tournament?.name || "Auction"}</p>
        )}
      </div>
    </div>
  );

  const actionBlock = (
    <div className="flex items-center justify-end gap-0.5 sm:gap-1 min-w-0 shrink-0">
      <HeaderActionButton onClick={onSync} title="Sync auction data" label="Sync" compact={actionCompact}>
        <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
      </HeaderActionButton>
      <HeaderActionButton
        onClick={onViewSquad}
        title={navBlocked ? "Unavailable during live player auction" : "View my squad"}
        label="My Squad"
        blocked={navBlocked}
        compact={actionCompact}
      >
        <ShieldUser className="w-4 h-4" strokeWidth={2.25} />
      </HeaderActionButton>
      <HeaderActionButton
        onClick={onViewScout}
        title={navBlocked ? "Unavailable during live player auction" : "Scout rival teams"}
        label="Rivals"
        blocked={navBlocked}
        compact={actionCompact}
      >
        <Radar className="w-4 h-4" strokeWidth={2.25} />
      </HeaderActionButton>
      <HeaderActionButton onClick={onLeave} title="Leave auction" label="Leave" compact={actionCompact}>
        <LogOut className="w-4 h-4" />
      </HeaderActionButton>
    </div>
  );

  if (layout === "stacked") {
    return (
      <div className="border-b border-[#27272a] flex-shrink-0">
        <div className="flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0a0c] border-b border-[#27272a]/70">
          <HeaderBrandLogo
            logos={logos}
            brandName={brandName}
            layout={layout}
            tier={tier}
            iconVersion={iconVersion}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 min-h-[48px] sm:min-h-[52px]">
          {teamBlock}
          {actionBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 sm:px-4 py-2 border-b border-[#27272a] flex-shrink-0">
      {teamBlock}
      <div className="flex items-center justify-center px-1 sm:px-2 shrink-0">
        <HeaderBrandLogo
          logos={logos}
          brandName={brandName}
          layout={layout}
          tier={tier}
          iconVersion={iconVersion}
        />
      </div>
      {actionBlock}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LiveBid({
  state, team, tournament, teamPurse, teamId, tournamentId,
  connectionStatus, bidErrorMsg, onBid, onViewSquad, onViewScout,
  navToast, onNavToastDismiss, onSignOut, onSync, isSyncError,
}: Props) {
  const { layout, tier } = useLiveBidLayout();
  const isSplit = layout === "split";
  const feed        = useAuctionConnectionState(
    connectionStatus,
    tournamentId,
    state?.lastAuctionActivityAt,
  );
  const mayTap      = useDebounce(600);
  const { brandName, logos, poweredByText, miniBrandText, showPoweredBy, iconVersion } = useBranding();

  const [bidding,            setBidding]            = useState(false);
  const [bidFeedback,        setBidFeedback]         = useState<"success" | "error" | "leading" | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm]  = useState(false);
  const [syncing,            setSyncing]             = useState(false);
  const [syncFailed,         setSyncFailed]          = useState(false);
  const syncAttempted = useRef(false);

  const teamColor = team.color || "#F59E0B";
  const unit = resolveAuctionUnit(tournament?.auctionUnit);
  const fmt = (amount: number | null | undefined) => formatIndianRupee(amount, unit);
  const isLeading = state?.currentBidTeamId === teamId;
  const isActive  = state?.status === "active";
  const hasPlayer = !!state?.currentPlayer;
  const navBlocked = isPlayerOnAuctionStage(state);

  const expired     = useTimerExpired(state?.timerEndsAt);
  const timerActive = !!state?.timerEndsAt && !expired;

  const spendablePurse  = teamPurse?.spendablePurse ?? (team.purse - (team.purseUsed || 0));
  const reservePurse    = teamPurse?.reservePurse ?? 0;
  const playersBought   = teamPurse?.playersBought ?? 0;
  const maxSquad        = teamPurse?.maximumSquadSize ?? 0;
  const slotsRequired   = teamPurse?.slotsRequired ?? 0;
  const maxSquadReached = maxSquad > 0 && playersBought >= maxSquad;
  const increment       = state?.bidIncrement ?? 50000;
  const nextBidAmount   = computeNextBidAmount({
    currentBid: state?.currentBid,
    bidIncrement: increment,
    currentBidTeamId: state?.currentBidTeamId,
  });

  const categoryMax          = state?.currentCategoryMaxPlayers ?? null;
  const categoryCount        = categoryMax != null
    ? ((state?.teamCategoryPlayerCounts as Record<string, number> | null | undefined)?.[String(teamId)] ?? 0)
    : 0;
  const categoryLimitReached = categoryMax != null && categoryCount >= categoryMax;

  const {
    isOnBreak,
    hasLiveCountdown,
    breakMins,
    breakSecs,
    breakLabel,
    breakMessage,
  } = useBreakCountdownFromState(state);

  const canBid =
    isActive && hasPlayer && timerActive && !isLeading && !isOnBreak &&
    spendablePurse >= nextBidAmount &&
    (team.isBiddingEnabled ?? true) &&
    !maxSquadReached && !categoryLimitReached;

  // ── Sync failure detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (!syncAttempted.current || syncing) return undefined;
    if (isSyncError) {
      setSyncFailed(true);
      const t = setTimeout(() => { setSyncFailed(false); syncAttempted.current = false; }, 4000);
      return () => clearTimeout(t);
    }
    syncAttempted.current = false;
    return undefined;
  }, [syncing, isSyncError]);

  function handleSyncTap() {
    if (syncing) return;
    setSyncFailed(false);
    syncAttempted.current = true;
    setSyncing(true);
    onSync();
    setTimeout(() => setSyncing(false), 1200);
  }

  async function handleBidTap() {
    if (isOnBreak || !canBid || bidding || !mayTap()) return;
    hapticBid();
    setBidding(true);
    const result = await onBid(nextBidAmount);
    setBidding(false);
    setBidFeedback(result);
    if (result === "success")  hapticSuccess();
    else if (result === "leading") hapticLeading();
    else hapticError();
    setTimeout(() => setBidFeedback(null), 1600);
  }

  // ── Disable-reason ──────────────────────────────────────────────────────────
  const isPaused = state?.status === "paused";
  const isIdle = state?.status === "idle";

  const bidDisabledHint =
    !isOnBreak && !canBid && !isLeading && !expired && hasPlayer
      ? getBidDisabledHint({
          isPaused,
          isActive,
          maxSquadReached,
          categoryLimitReached,
          categoryMax,
          categoryName: state?.currentCategoryName,
          biddingEnabled: team.isBiddingEnabled ?? true,
          timerActive,
          hasTimer: !!state?.timerEndsAt,
          spendablePurse,
          nextBidAmount,
          reservePurse,
          slotsRequired,
          unit,
        })
      : null;

  const statusLabel =
    isOnBreak ? "BREAK" :
    state?.status === "active"  ? "LIVE" :
    state?.status === "paused"  ? "PAUSED" :
    state?.status               ? state.status.toUpperCase() : "IDLE";

  // ── Unified won/unsold notification ─────────────────────────────────────────
  const [wonBanner,    setWonBanner]    = useState<{ name: string; soldAmount?: number | null } | null>(null);
  const [unsoldBanner, setUnsoldBanner] = useState<{ name: string } | null>(null);
  const lastOutcomeKeyRef = useRef<string | null>(null);
  const outcomeHydratedRef = useRef(false);

  const resolvedOutcome = (() => {
    const raw = state?.outcome;
    if (raw?.type === "sold" || raw?.type === "unsold") {
      return {
        type: raw.type as "sold" | "unsold",
        playerId: raw.playerId ?? null,
        playerName: raw.playerName ?? null,
        photoUrl: raw.photoUrl ?? null,
        teamId: raw.teamId ?? null,
        amount: raw.amount ?? null,
        action: state?.lastAction ?? raw.type,
      };
    }
    const action = state?.lastAction?.trim();
    if (action?.startsWith("UNSOLD:")) {
      return {
        type: "unsold" as const,
        playerId: null,
        playerName: action.replace(/^UNSOLD:\s*/, "") || "Player",
        photoUrl: null,
        teamId: null,
        amount: null,
        action,
      };
    }
    if (action?.startsWith("SOLD:")) {
      return {
        type: "sold" as const,
        playerId: null,
        playerName: null,
        photoUrl: null,
        teamId: state?.lastSoldPlayer?.soldToTeamId ?? null,
        amount: state?.lastSoldPlayer?.soldAmount ?? null,
        action,
      };
    }
    return null;
  })();

  const showUnsoldResult = !hasPlayer && resolvedOutcome?.type === "unsold";
  const showLastSoldResult = !hasPlayer && !showUnsoldResult && !!state?.lastSoldPlayer;

  const outcomeBannerKey = useMemo(() => {
    if (!resolvedOutcome) return null;
    return resolvedOutcome.type === "sold"
      ? `sold:${resolvedOutcome.playerId ?? resolvedOutcome.playerName ?? ""}:${resolvedOutcome.teamId ?? ""}:${resolvedOutcome.amount ?? 0}:${resolvedOutcome.action}`
      : `unsold:${resolvedOutcome.playerId ?? resolvedOutcome.playerName ?? ""}:${resolvedOutcome.action}`;
  }, [resolvedOutcome]);

  const bidActivityKey = useMemo(
    () =>
      [
        state?.currentPlayer?.id ?? "none",
        state?.currentBid ?? 0,
        state?.currentBidTeamId ?? 0,
        state?.timerEndsAt ?? "",
        outcomeBannerKey ?? "",
        state?.status ?? "",
      ].join("|"),
    [
      state?.currentPlayer?.id,
      state?.currentBid,
      state?.currentBidTeamId,
      state?.timerEndsAt,
      outcomeBannerKey,
      state?.status,
    ],
  );

  const originalPurse = teamPurse?.originalPurse ?? team.purse;
  const { banner: purseBoosterBanner, footerPulse: purseFooterPulse, dismiss: dismissPurseBooster, footerOverride: purseFooterOverride } =
    usePurseBoosterCelebration(teamId, teamPurse, state?.lastPurseBooster ?? null, bidActivityKey, originalPurse);

  // Only react to outcomes that arrive after mount — skip stale state from login/sync.
  useEffect(() => {
    if (!outcomeBannerKey) return;

    if (!outcomeHydratedRef.current) {
      outcomeHydratedRef.current = true;
      lastOutcomeKeyRef.current = outcomeBannerKey;
      return;
    }

    if (outcomeBannerKey === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = outcomeBannerKey;

    if (resolvedOutcome?.type === "unsold") {
      setUnsoldBanner({ name: resolvedOutcome.playerName ?? "Player" });
      return;
    }

    if (resolvedOutcome?.type === "sold" && resolvedOutcome.teamId === teamId) {
      setWonBanner({
        name: resolvedOutcome.playerName ?? state?.lastSoldPlayer?.name ?? "Player",
        soldAmount: resolvedOutcome.amount,
      });
    }
  }, [outcomeBannerKey, teamId, resolvedOutcome, state?.lastSoldPlayer?.name]);

  useEffect(() => {
    if (!wonBanner) return;
    const t = setTimeout(() => setWonBanner(null), 5500);
    return () => clearTimeout(t);
  }, [wonBanner]);

  useEffect(() => {
    if (!unsoldBanner) return;
    const t = setTimeout(() => setUnsoldBanner(null), 4000);
    return () => clearTimeout(t);
  }, [unsoldBanner]);

  // ── Stacked layout (mobile portrait, narrow screens) ───────────────────────
  if (!isSplit) {
    return (
      <div
        className="auction-surface relative h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom select-none"
        style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 55%), #09090b` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <LiveBidHeader
          team={team}
          teamColor={teamColor}
          tournament={tournament}
          isActive={isActive}
          isPaused={isPaused}
          statusLabel={statusLabel}
          feed={feed}
          logos={logos}
          brandName={brandName}
          miniBrandText={miniBrandText}
          navBlocked={navBlocked}
          syncing={syncing}
          onSync={handleSyncTap}
          onViewSquad={onViewSquad}
          onViewScout={onViewScout}
          onLeave={() => setShowSignOutConfirm(true)}
          layout="stacked"
          tier={tier}
          iconVersion={iconVersion}
        />

        {/* Sync error banner */}
        {syncFailed && (
          <div className="flex-shrink-0 mx-4 mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400 font-semibold">Sync failed — check your connection</p>
          </div>
        )}

        {(isPaused || isOnBreak) && (
          <AuctionPauseBanner
            isOnBreak={isOnBreak}
            hasLiveCountdown={hasLiveCountdown}
            breakLabel={breakLabel}
            breakMins={breakMins}
            breakSecs={breakSecs}
            breakMessage={breakMessage}
          />
        )}

        {/* Scrollable top area */}
        <div className={`flex-1 overflow-y-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-4 min-h-0 ${tier === "mobile" ? "pb-2" : "pb-3"}`}>
          {/* Timer */}
          {state?.timerEndsAt && (
            <TimerBar timerEndsAt={state.timerEndsAt} teamColor={teamColor} timerExpired={expired} />
          )}

          {/* Player card or last sold */}
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <PlayerCard
                key={state?.currentPlayer?.id}
                player={state!.currentPlayer!}
                teamColor={teamColor}
                unit={unit}
                categoryName={state?.currentCategoryName}
                sport={tournament?.sport}
                tier={tier}
              />
            ) : showUnsoldResult ? (
              <UnsoldPlayerCard
                key="last-unsold"
                name={resolvedOutcome?.playerName ?? "Player"}
                photoUrl={resolvedOutcome?.photoUrl}
              />
            ) : showLastSoldResult ? (
              <LastSoldPlayerCard
                key="last-sold"
                player={state!.lastSoldPlayer!}
                teamColor={teamColor}
                wonByThisTeam={state!.lastSoldPlayer!.soldToTeamId === teamId}
                unit={unit}
              />
            ) : (
              <motion.div
                key="no-player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-10 rounded-2xl border border-dashed border-[#3f3f46] bg-[#18181b]"
              >
                <div className="text-center text-[#52525b]">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-base">Waiting for next player...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <BidAmount
            amount={state?.currentBid || 0}
            isLeading={isLeading}
            teamColor={teamColor}
            leadingTeam={state?.currentBidTeamName}
            unit={unit}
            tier={tier}
          />

          <TeamSquadSnapshot
            teamColor={teamColor}
            teamPurse={teamPurse}
            tournamentId={tournamentId}
            teamId={teamId}
            unit={unit}
            tier={tier}
          />

          {/* Reserve / squad banners */}
          <MaxSquadNotice maxSquadReached={maxSquadReached} />
        </div>

        {/* Bottom bid dock — always pinned visible */}
        <div className={`sticky bottom-0 z-20 flex-shrink-0 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-3 sm:pb-4 border-t border-[#27272a] space-y-2 safe-bottom bg-[#09090b] ${tier === "tablet" ? "pb-5" : ""}`}>
          <TeamPurseFooter
            teamColor={teamColor}
            teamPurse={teamPurse}
            team={team}
            tournamentId={tournamentId}
            teamId={teamId}
            unit={unit}
            tier={tier}
            highlightBoost={purseFooterPulse}
            purseOverride={purseFooterOverride}
          />

          {bidDisabledHint && <BidDisabledMessage hint={bidDisabledHint} compact={tier === "mobile"} />}

          <AnimatePresence mode="wait">
            <BidButton
              key={`${isOnBreak}-${isLeading}-${expired}-${isActive}-${hasPlayer}-${breakMins}-${breakSecs}`}
              canBid={canBid}
              isLeading={isLeading}
              timerExpired={expired}
              hasPlayer={hasPlayer}
              isActive={isActive}
              isPaused={isPaused}
              isIdle={isIdle}
              isOnBreak={isOnBreak}
              hasLiveCountdown={hasLiveCountdown}
              breakMins={breakMins}
              breakSecs={breakSecs}
              breakMessage={breakMessage}
              breakLabel={breakLabel}
              bidding={bidding}
              bidFeedback={bidFeedback}
              nextBidAmount={nextBidAmount}
              teamColor={teamColor}
              onBid={handleBidTap}
              layout="stacked"
              tier={tier}
              unit={unit}
              dock
            />
          </AnimatePresence>

          {bidFeedback === "error" && (
            <p className="text-center text-red-400 text-sm font-semibold">{bidErrorMsg || "Bid failed. Please try again."}</p>
          )}

          {showPoweredBy && (
            <p className="text-center text-xs text-[#3f3f46] uppercase tracking-widest">{poweredByText}</p>
          )}
        </div>

        {/* ── Won banner ── */}
        <AnimatePresence>
          {wonBanner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-40 px-8"
              style={{ backgroundColor: `${teamColor}28`, backdropFilter: "blur(8px)" }}
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ duration: 0.5, times: [0, 0.7, 1] }}
              >
                <Trophy className="w-28 h-28" style={{ color: teamColor }} />
              </motion.div>
              <div className="text-center">
                <p className="font-display font-black text-5xl" style={{ color: teamColor }}>YOU WON!</p>
                <p className="text-2xl font-bold text-white mt-3">{wonBanner.name}</p>
                {wonBanner.soldAmount != null && (
                  <p className="text-xl text-[#a1a1aa] mt-2">{fmt(wonBanner.soldAmount)}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {purseBoosterBanner && (
            <PurseBoosterCelebration
              banner={purseBoosterBanner}
              fmt={fmt}
              tier={tier}
              accentColor={BIDWAR_AMBER}
              onDismiss={dismissPurseBooster}
            />
          )}
        </AnimatePresence>

        {/* ── Unsold notice ── */}
        <AnimatePresence>
          {unsoldBanner && <UnsoldOverlay name={unsoldBanner.name} />}
        </AnimatePresence>

        <AuctionConnectionBanner
          feedState={feed.state}
          secondsSinceLastActivity={feed.secondsSinceLastActivity}
        />

        {/* ── Sign-out confirmation ── */}
        <AnimatePresence>
          {showSignOutConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#09090b]/95 flex flex-col items-center justify-center gap-8 z-[60] px-8"
            >
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="absolute top-5 right-5 p-2 text-[#52525b] hover:text-white transition-colors"
              >
                <X className="w-7 h-7" />
              </button>
              <div className="text-center space-y-3">
                <p className="font-display font-bold text-2xl text-white">Leave this auction?</p>
                <p className="text-base text-[#71717a]">You will need to re-enter your access code.</p>
              </div>
              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-4 rounded-2xl border border-[#27272a] text-[#a1a1aa] font-bold text-base hover:bg-[#18181b] transition-colors"
                >
                  Stay
                </button>
                <button
                  onClick={() => { setShowSignOutConfirm(false); onSignOut(); }}
                  className="flex-1 py-4 rounded-2xl bg-[#27272a] text-white font-bold text-base hover:bg-[#3f3f46] transition-colors"
                >
                  Yes, Leave
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Toast message={navToast ?? null} onDismiss={onNavToastDismiss ?? (() => {})} />
      </div>
    );
  }

  // ── Split layout (tablet landscape + laptop) ─────────────────────────────────
  return (
    <div
      className="auction-surface relative h-full flex flex-row bg-[#09090b] overflow-hidden select-none"
      style={{ background: `radial-gradient(ellipse at center left, ${teamColor}12 0%, transparent 55%), #09090b` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Left: player info — 60% */}
      <div className="w-[60%] flex flex-col overflow-hidden border-r border-[#27272a] min-w-0">
        <LiveBidHeader
          team={team}
          teamColor={teamColor}
          tournament={tournament}
          isActive={isActive}
          isPaused={isPaused}
          statusLabel={statusLabel}
          feed={feed}
          logos={logos}
          brandName={brandName}
          miniBrandText={miniBrandText}
          navBlocked={navBlocked}
          syncing={syncing}
          onSync={handleSyncTap}
          onViewSquad={onViewSquad}
          onViewScout={onViewScout}
          onLeave={() => setShowSignOutConfirm(true)}
          layout="split"
          tier={tier}
          iconVersion={iconVersion}
        />

        {syncFailed && (
          <div className="flex-shrink-0 mx-4 mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400 font-semibold">Sync failed — check your connection</p>
          </div>
        )}

        {(isPaused || isOnBreak) && (
          <AuctionPauseBanner
            isOnBreak={isOnBreak}
            hasLiveCountdown={hasLiveCountdown}
            breakLabel={breakLabel}
            breakMins={breakMins}
            breakSecs={breakSecs}
            breakMessage={breakMessage}
          />
        )}

        <div className={`flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 min-h-0 ${tier === "laptop" ? "px-5 py-4 space-y-4" : ""}`}>
          {state?.timerEndsAt && (
            <TimerBar timerEndsAt={state.timerEndsAt} teamColor={teamColor} timerExpired={expired} />
          )}
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <PlayerCard
                key={state?.currentPlayer?.id}
                player={state!.currentPlayer!}
                teamColor={teamColor}
                unit={unit}
                categoryName={state?.currentCategoryName}
                sport={tournament?.sport}
                tier={tier}
              />
            ) : showUnsoldResult ? (
              <UnsoldPlayerCard
                key="last-unsold-ls"
                name={resolvedOutcome?.playerName ?? "Player"}
                photoUrl={resolvedOutcome?.photoUrl}
              />
            ) : showLastSoldResult ? (
              <LastSoldPlayerCard
                key="last-sold-ls"
                player={state!.lastSoldPlayer!}
                teamColor={teamColor}
                wonByThisTeam={state!.lastSoldPlayer!.soldToTeamId === teamId}
                unit={unit}
              />
            ) : (
              <motion.div
                key="no-player-ls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-8 rounded-2xl border border-dashed border-[#3f3f46] bg-[#18181b]"
              >
                <div className="text-center text-[#52525b]">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-base">Waiting for next player...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <BidAmount
            amount={state?.currentBid || 0}
            isLeading={isLeading}
            teamColor={teamColor}
            leadingTeam={state?.currentBidTeamName}
            unit={unit}
            tier={tier}
          />
          <TeamSquadSnapshot
            teamColor={teamColor}
            teamPurse={teamPurse}
            tournamentId={tournamentId}
            teamId={teamId}
            unit={unit}
            tier={tier}
          />
          <MaxSquadNotice maxSquadReached={maxSquadReached} />
        </div>

        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-[#27272a] flex-shrink-0">
          <TeamPurseFooter
            teamColor={teamColor}
            teamPurse={teamPurse}
            team={team}
            tournamentId={tournamentId}
            teamId={teamId}
            unit={unit}
            tier={tier}
            highlightBoost={purseFooterPulse}
            purseOverride={purseFooterOverride}
          />
        </div>
      </div>

      {/* Right: bid controls — 40% panel */}
      <div className="w-[40%] flex flex-col px-3 sm:px-4 py-3 sm:py-4 gap-2 sm:gap-3 flex-shrink-0 min-w-[180px]">
        <div className={`flex-1 flex flex-col ${tier === "mobile" ? "min-h-[42vh]" : tier === "tablet" ? "min-h-[44vh]" : "min-h-[40vh]"}`}>
          <AnimatePresence mode="wait">
            <BidButton
              key={`split-${isOnBreak}-${isLeading}-${expired}-${isActive}-${hasPlayer}-${breakMins}-${breakSecs}`}
              canBid={canBid}
              isLeading={isLeading}
              timerExpired={expired}
              hasPlayer={hasPlayer}
              isActive={isActive}
              isPaused={isPaused}
              isIdle={isIdle}
              isOnBreak={isOnBreak}
              hasLiveCountdown={hasLiveCountdown}
              breakMins={breakMins}
              breakSecs={breakSecs}
              breakMessage={breakMessage}
              breakLabel={breakLabel}
              bidding={bidding}
              bidFeedback={bidFeedback}
              nextBidAmount={nextBidAmount}
              teamColor={teamColor}
              onBid={handleBidTap}
              layout="split"
              tier={tier}
              unit={unit}
            />
          </AnimatePresence>
        </div>

        {bidFeedback === "error" && (
          <p className="text-center text-red-400 text-sm font-semibold">{bidErrorMsg || "Bid failed. Try again."}</p>
        )}
        {bidDisabledHint && <BidDisabledMessage hint={bidDisabledHint} compact={tier !== "laptop"} />}

        {showPoweredBy && (
          <p className="text-center text-xs text-[#3f3f46] uppercase tracking-widest flex-shrink-0">
            {poweredByText}
          </p>
        )}
      </div>

      {/* ── Won banner ── */}
      <AnimatePresence>
        {wonBanner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-40"
            style={{ backgroundColor: `${teamColor}28`, backdropFilter: "blur(8px)" }}
          >
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.2, 1] }} transition={{ duration: 0.5, times: [0, 0.7, 1] }}>
              <Trophy className="w-28 h-28" style={{ color: teamColor }} />
            </motion.div>
            <div className="text-center">
              <p className="font-display font-black text-5xl" style={{ color: teamColor }}>YOU WON!</p>
              <p className="text-2xl font-bold text-white mt-2">{wonBanner.name}</p>
              {wonBanner.soldAmount != null && <p className="text-xl text-[#a1a1aa] mt-1">{fmt(wonBanner.soldAmount)}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {purseBoosterBanner && (
          <PurseBoosterCelebration
            banner={purseBoosterBanner}
            fmt={fmt}
            tier={tier}
            accentColor={BIDWAR_AMBER}
            onDismiss={dismissPurseBooster}
          />
        )}
      </AnimatePresence>

      {/* ── Unsold notice ── */}
      <AnimatePresence>
        {unsoldBanner && <UnsoldOverlay name={unsoldBanner.name} />}
      </AnimatePresence>

      <AuctionConnectionBanner
        feedState={feed.state}
        secondsSinceLastActivity={feed.secondsSinceLastActivity}
      />

      {/* ── Sign-out confirmation ── */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#09090b]/95 flex flex-col items-center justify-center gap-6 z-[60] px-8"
          >
            <button onClick={() => setShowSignOutConfirm(false)} className="absolute top-5 right-5 p-2 text-[#52525b] hover:text-white transition-colors">
              <X className="w-7 h-7" />
            </button>
            <div className="text-center space-y-2">
              <p className="font-display font-bold text-2xl text-white">Leave this auction?</p>
              <p className="text-base text-[#71717a]">You will need to re-enter your access code.</p>
            </div>
            <div className="flex gap-4 w-full max-w-xs">
              <button onClick={() => setShowSignOutConfirm(false)} className="flex-1 py-4 rounded-2xl border border-[#27272a] text-[#a1a1aa] font-bold text-base hover:bg-[#18181b] transition-colors">
                Stay
              </button>
              <button onClick={() => { setShowSignOutConfirm(false); onSignOut(); }} className="flex-1 py-4 rounded-2xl bg-[#27272a] text-white font-bold text-base hover:bg-[#3f3f46] transition-colors">
                Yes, Leave
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast message={navToast ?? null} onDismiss={onNavToastDismiss ?? (() => {})} />
    </div>
  );
}
