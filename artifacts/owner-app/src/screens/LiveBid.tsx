import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, User, LogOut, ShieldAlert,
  AlertTriangle, Coffee, RefreshCw, X, XCircle, Radar, ShieldUser,
} from "lucide-react";
import { useOrientation } from "@/hooks/useOrientation";
import { useCountdown } from "@/hooks/useCountdown";
import { useTimerExpired } from "@/hooks/useTimerExpired";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import { hapticBid, hapticSuccess, hapticError, hapticLeading } from "@/lib/haptics";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { computeNextBidAmount } from "@workspace/api-base/auction-bid";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";
import { Toast } from "@/components/Toast";
import { AuctionConnectionBanner, AuctionFeedIndicator } from "@/components/AuctionConnectionBanner";
import { isPlayerOnAuctionStage } from "@/lib/auction-stage";

// ── Types ────────────────────────────────────────────────────────────────────
interface AuctionState {
  status?: string;
  licenseStatus?: string;
  currentPlayer?: {
    id?: number;
    name?: string;
    role?: string | null;
    photoUrl?: string | null;
    basePrice?: number | null;
    age?: number | null;
    city?: string | null;
    battingStyle?: string | null;
    bowlingStyle?: string | null;
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
}

interface TeamPurse {
  teamId: number;
  purseRemaining: number;
  reservePurse?: number;
  spendablePurse: number;
  slotsRequired?: number;
  playersBought?: number;
  maximumSquadSize?: number;
  lowestBasePrice?: number;
  purseUsed?: number;
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

function PlayerCard({ player, teamColor }: {
  player: NonNullable<AuctionState["currentPlayer"]>;
  teamColor: string;
}) {
  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex items-center gap-5 p-5 rounded-2xl border border-[#27272a] bg-[#18181b]"
    >
      <div className="w-20 h-28 rounded-xl bg-[#27272a] border border-[#3f3f46] flex-shrink-0 overflow-hidden flex items-center justify-center">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-10 h-10 text-[#52525b]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-sm text-[#71717a] shrink-0">#{player.serialNo ?? player.id}</span>
          <h2 className="font-display font-black text-3xl leading-tight text-white truncate">{player.name}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          {player.role && (
            <span className="text-base text-[#a1a1aa] capitalize font-semibold">{player.role}</span>
          )}
          {player.age && <span className="text-sm text-[#71717a]">Age {player.age}</span>}
          {player.city && <span className="text-sm text-[#71717a]">{player.city}</span>}
        </div>
        {player.basePrice != null && (
          <p className="text-sm text-[#71717a] mt-2">
            Base <span className="text-white font-bold text-base">{formatIndianRupee(player.basePrice)}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}

function BidAmount({ amount, isLeading, teamColor, leadingTeam }: {
  amount: number;
  isLeading: boolean;
  teamColor: string;
  leadingTeam?: string | null;
}) {
  return (
    <div className="text-center py-2">
      <p className="text-sm font-bold text-[#71717a] uppercase tracking-widest mb-2">
        {isLeading ? "Your Bid — You Are Leading" : "Current Bid"}
      </p>
      <motion.p
        key={amount}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="font-display font-black text-6xl leading-none"
        style={{ color: isLeading ? teamColor : "#ffffff" }}
      >
        {formatIndianRupee(amount || 0)}
      </motion.p>
      {!isLeading && leadingTeam && (
        <p className="text-base text-[#71717a] mt-2">
          Leading: <span className="font-bold text-white text-lg">{leadingTeam}</span>
        </p>
      )}
    </div>
  );
}

function BidButton({
  canBid, isLeading, timerExpired, hasPlayer, isActive, isPaused, isIdle,
  bidding, bidFeedback, nextBidAmount, teamColor, onBid, landscape,
}: {
  canBid: boolean;
  isLeading: boolean;
  timerExpired: boolean;
  hasPlayer: boolean;
  isActive: boolean;
  isPaused: boolean;
  isIdle: boolean;
  bidding: boolean;
  bidFeedback: "success" | "error" | "leading" | null;
  nextBidAmount: number;
  teamColor: string;
  onBid: () => void;
  landscape: boolean;
}) {
  const buttonH = landscape ? "min-h-[40vh] h-full" : "h-full min-h-[18vh]";

  if (isLeading) {
    return (
      <motion.div
        key="leading"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${buttonH} rounded-3xl border-4 flex flex-col items-center justify-center gap-4 px-6`}
        style={{ borderColor: `${teamColor}80`, backgroundColor: `${teamColor}18` }}
      >
        <Trophy className="w-16 h-16" style={{ color: teamColor }} />
        <div className="text-center">
          <p className="font-display font-black text-3xl" style={{ color: teamColor }}>HIGHEST BIDDER</p>
          <p className="text-base text-[#71717a] mt-2">Waiting for other teams...</p>
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
        className={`w-full ${buttonH} rounded-3xl border-2 border-red-500/30 bg-red-500/10 flex flex-col items-center justify-center gap-4`}
      >
        <AlertTriangle className="w-14 h-14 text-red-400" />
        <div className="text-center">
          <p className="font-display font-black text-3xl text-red-400">BIDDING CLOSED</p>
          <p className="text-base text-[#71717a] mt-2">Timer expired — awaiting operator</p>
        </div>
      </motion.div>
    );
  }

  if (!isActive || !hasPlayer) {
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
      className={`w-full ${buttonH} rounded-3xl font-display font-black text-black disabled:opacity-30 disabled:cursor-not-allowed transition-all select-none`}
      style={{
        backgroundColor: canBid ? teamColor : "#374151",
        boxShadow: canBid ? `0 0 60px ${teamColor}50, 0 8px 32px rgba(0,0,0,0.5)` : "none",
        color: canBid ? "black" : "#6b7280",
        fontSize: landscape ? "clamp(2rem, 5vw, 3.5rem)" : "clamp(2.5rem, 10vw, 4.5rem)",
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
            {formatIndianRupee(nextBidAmount)}
          </span>
        </div>
      )}
    </motion.button>
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
        <p className="text-sm text-[#71717a] mt-1">Player returns to the pool</p>
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
function LastSoldPlayerCard({ player, teamColor, wonByThisTeam }: {
  player: NonNullable<AuctionState["lastSoldPlayer"]>;
  teamColor: string;
  wonByThisTeam: boolean;
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
            {formatIndianRupee(player.soldAmount)}
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

// ── Brand mini logo ───────────────────────────────────────────────────────────
function BrandMini({ logos, brandName, miniBrandText }: {
  logos: { mainReverse?: string | null; mini?: string | null };
  brandName: string;
  miniBrandText: string;
}) {
  const src = logos.mainReverse ?? logos.mini;
  if (src) {
    return <img src={src} alt={brandName} className="h-6 w-auto opacity-60" />;
  }
  return (
    <span className="font-display font-black text-sm text-amber-400/50 tracking-wide">
      {miniBrandText}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LiveBid({
  state, team, tournament, teamPurse, teamId, tournamentId,
  connectionStatus, bidErrorMsg, onBid, onViewSquad, onViewScout,
  navToast, onNavToastDismiss, onSignOut, onSync, isSyncError,
}: Props) {
  const orientation = useOrientation();
  const landscape   = orientation === "landscape";
  const feed        = useAuctionConnectionState(
    connectionStatus,
    tournamentId,
    state?.lastAuctionActivityAt,
  );
  const mayTap      = useDebounce(600);
  const { brandName, logos, poweredByText, miniBrandText, showPoweredBy } = useBranding();

  const [bidding,            setBidding]            = useState(false);
  const [bidFeedback,        setBidFeedback]         = useState<"success" | "error" | "leading" | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm]  = useState(false);
  const [syncing,            setSyncing]             = useState(false);
  const [syncFailed,         setSyncFailed]          = useState(false);
  const syncAttempted = useRef(false);

  const teamColor = team.color || "#F59E0B";
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

  const canBid =
    isActive && hasPlayer && timerActive && !isLeading &&
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
    if (!canBid || bidding || !mayTap()) return;
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

  const disabledReason =
    !canBid && !isLeading && !expired && hasPlayer
      ? isPaused                         ? "Auction paused by operator"
      : !isActive                        ? "Auction not active"
      : maxSquadReached                  ? "Maximum squad size reached"
      : categoryLimitReached             ? `Category limit (max ${categoryMax} in "${state?.currentCategoryName}")`
      : !(team.isBiddingEnabled ?? true) ? "Bidding disabled for your team"
      : reservePurse > 0 && spendablePurse < nextBidAmount
                                         ? `${formatShortIndianRupee(reservePurse)} reserved for ${slotsRequired} slot${slotsRequired !== 1 ? "s" : ""}`
      : `Need ${formatShortIndianRupee(nextBidAmount - spendablePurse)} more purse`
      : null;

  const statusLabel =
    state?.status === "active"  ? "LIVE" :
    state?.status === "paused"  ? "PAUSED" :
    state?.status               ? state.status.toUpperCase() : "IDLE";

  // Break countdown
  const breakEndsAt  = (state?.displayCountdown?.type === "break" || state?.displayCountdown?.type === "pre-auction")
    ? (state.displayCountdown.endsAt ?? null)
    : null;
  const { secondsLeft: breakSecsLeft } = useCountdown(breakEndsAt);
  const breakMins    = Math.floor(breakSecsLeft / 60);
  const breakSecs    = breakSecsLeft % 60;
  const isOnBreak    = !!breakEndsAt && breakSecsLeft > 0;

  // ── Unified won/unsold notification ─────────────────────────────────────────
  const [wonBanner,    setWonBanner]    = useState<{ name: string; soldAmount?: number | null } | null>(null);
  const [unsoldBanner, setUnsoldBanner] = useState<{ name: string } | null>(null);
  const [purseBoosterBanner, setPurseBoosterBanner] = useState<{
    amount: number;
    previousCapacity: number;
    newCapacity: number;
  } | null>(null);
  const lastOutcomeKeyRef = useRef<string | null>(null);
  const prevBoosterRef = useRef<number | null>(null);

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

  const purseBoosterBannerKey =
    state?.lastPurseBooster?.teamId === teamId ? state.lastPurseBooster.id : null;

  useEffect(() => {
    if (!outcomeBannerKey || outcomeBannerKey === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = outcomeBannerKey;

    if (resolvedOutcome?.type === "unsold") {
      const name = resolvedOutcome.playerName ?? "Player";
      setUnsoldBanner({ name });
      const t = setTimeout(() => setUnsoldBanner(null), 4000);
      return () => clearTimeout(t);
    }

    if (resolvedOutcome?.type === "sold" && resolvedOutcome.teamId === teamId) {
      const name = resolvedOutcome.playerName ?? state?.lastSoldPlayer?.name ?? "Player";
      setWonBanner({ name, soldAmount: resolvedOutcome.amount });
      const t = setTimeout(() => setWonBanner(null), 5500);
      return () => clearTimeout(t);
    }

    return undefined;
  }, [outcomeBannerKey, teamId]);

  useEffect(() => {
    if (purseBoosterBannerKey == null) return;
    if (prevBoosterRef.current === purseBoosterBannerKey) return;

    const boost = state?.lastPurseBooster;
    if (!boost || boost.teamId !== teamId || boost.id !== purseBoosterBannerKey) return;

    prevBoosterRef.current = purseBoosterBannerKey;
    setPurseBoosterBanner({
      amount: boost.amount,
      previousCapacity: boost.previousCapacity,
      newCapacity: boost.newCapacity,
    });
    const t = setTimeout(() => setPurseBoosterBanner(null), 5500);
    return () => clearTimeout(t);
  }, [purseBoosterBannerKey, teamId]);

  const navBtnClass = (blocked: boolean) =>
    `p-2 transition-colors rounded-xl active:scale-90 ${
      blocked
        ? "text-[#52525b] opacity-40 cursor-not-allowed"
        : "text-[#71717a] hover:text-white hover:bg-[#18181b]"
    }`;

  const navBtnClassLandscape = (blocked: boolean) =>
    `p-1.5 transition-colors rounded-lg ${
      blocked
        ? "text-[#52525b] opacity-40 cursor-not-allowed"
        : "text-[#71717a] hover:text-white hover:bg-[#18181b]"
    }`;

  // ── Portrait layout ─────────────────────────────────────────────────────────
  if (!landscape) {
    return (
      <div
        className="auction-surface relative h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom select-none"
        style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 55%), #09090b` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Brand mini */}
            <BrandMini logos={logos} brandName={brandName} miniBrandText={miniBrandText} />

            {/* Divider */}
            <div className="w-px h-5 bg-[#3f3f46]" />

            {/* Team badge */}
            <TeamLogo
              logoUrl={team.logoUrl}
              shortCode={team.shortCode}
              teamName={team.name}
              teamColor={teamColor}
              className="w-11 h-11 rounded-xl"
            />
            <div className="min-w-0">
              <p className="font-display font-bold text-lg leading-none truncate" style={{ color: teamColor }}>
                {team.name}
              </p>
              <p className="text-xs text-[#71717a] mt-0.5 truncate">{tournament?.name || "Auction"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <AuctionFeedIndicator
              feedState={feed.state}
              secondsSinceLastActivity={feed.secondsSinceLastActivity}
            />
            <span
              className={`text-xs font-black px-2.5 py-1.5 rounded-full ${
                isActive
                  ? "bg-green-500/20 text-green-400"
                  : isPaused
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-[#27272a] text-[#71717a]"
              }`}
            >
              {statusLabel}
            </span>
            <button
              onClick={handleSyncTap}
              className="p-2 text-[#71717a] hover:text-white transition-colors rounded-xl hover:bg-[#18181b] active:scale-90"
              title="Sync"
            >
              <RefreshCw className={`w-6 h-6 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onViewSquad}
              className={navBtnClass(navBlocked)}
              title={navBlocked ? "Unavailable during live player auction" : "My squad"}
              aria-disabled={navBlocked}
            >
              <ShieldUser className="w-6 h-6" strokeWidth={2.25} />
            </button>
            <button
              onClick={onViewScout}
              className={navBtnClass(navBlocked)}
              title={navBlocked ? "Unavailable during live player auction" : "Scout rivals"}
              aria-disabled={navBlocked}
            >
              <Radar className="w-6 h-6" strokeWidth={2.25} />
            </button>
            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="p-2 text-[#71717a] hover:text-white transition-colors rounded-xl hover:bg-[#18181b] active:scale-90"
              title="Leave"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sync error banner */}
        {syncFailed && (
          <div className="flex-shrink-0 mx-4 mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400 font-semibold">Sync failed — check your connection</p>
          </div>
        )}

        {isPaused && (
          <div className="flex-shrink-0 mx-4 mt-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-center">
            <p className="text-sm font-bold text-amber-300 uppercase tracking-wide">Auction Paused</p>
            <p className="text-xs text-amber-200/80 mt-0.5">Auction paused by operator. Bidding is disabled.</p>
          </div>
        )}

        {/* Scrollable top area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4 min-h-0">
          {/* Timer */}
          {state?.timerEndsAt && (
            <TimerBar timerEndsAt={state.timerEndsAt} teamColor={teamColor} timerExpired={expired} />
          )}

          {/* Player card or last sold */}
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <PlayerCard key={state?.currentPlayer?.id} player={state!.currentPlayer!} teamColor={teamColor} />
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

          {/* Bid amount */}
          <BidAmount
            amount={state?.currentBid || 0}
            isLeading={isLeading}
            teamColor={teamColor}
            leadingTeam={state?.currentBidTeamName}
          />

          {/* Reserve / squad banners */}
          {reservePurse > 0 && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/25 bg-amber-500/8">
              <ShieldAlert className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-400 font-semibold">
                {formatShortIndianRupee(reservePurse)} reserved — {slotsRequired} slot{slotsRequired !== 1 ? "s" : ""} needed
              </p>
            </div>
          )}
          {maxSquadReached && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-red-500/25 bg-red-500/8">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 font-semibold">Maximum squad size reached — bidding blocked</p>
            </div>
          )}
        </div>

        {/* Sticky bid controls */}
        <div
          className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-[#27272a] space-y-3"
          style={{ minHeight: "max(28vh, 200px)" }}
        >
          <div className="flex-1 flex flex-col h-full gap-3">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <BidButton
                  key={`${isLeading}-${expired}-${isActive}-${hasPlayer}`}
                  canBid={canBid}
                  isLeading={isLeading}
                  timerExpired={expired}
                  hasPlayer={hasPlayer}
                  isActive={isActive}
                  isPaused={isPaused}
                  isIdle={isIdle}
                  bidding={bidding}
                  bidFeedback={bidFeedback}
                  nextBidAmount={nextBidAmount}
                  teamColor={teamColor}
                  onBid={handleBidTap}
                  landscape={false}
                />
              </AnimatePresence>
            </div>

            {bidFeedback === "error" && (
              <p className="text-center text-red-400 text-base font-semibold">{bidErrorMsg || "Bid failed. Please try again."}</p>
            )}
            {disabledReason && (
              <p className="text-center text-sm text-[#71717a]">{disabledReason}</p>
            )}

            {/* Purse strip */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "Spendable", value: formatShortIndianRupee(spendablePurse), accent: teamColor },
                { label: "Spent",     value: formatShortIndianRupee(teamPurse?.purseUsed ?? (team.purseUsed || 0)) },
                { label: "Players",   value: String(playersBought) },
              ].map(({ label, value, accent }) => (
                <div key={label} className="text-center">
                  <p className="font-display font-black text-xl" style={accent ? { color: accent } : { color: "#fafafa" }}>
                    {value}
                  </p>
                  <p className="text-xs text-[#52525b] uppercase tracking-wide mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {showPoweredBy && (
              <p className="text-center text-xs text-[#3f3f46] uppercase tracking-widest">{poweredByText}</p>
            )}
          </div>
        </div>

        {/* ── Break overlay ── */}
        <AnimatePresence>
          {isOnBreak && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#09090b]/93 flex flex-col items-center justify-center gap-5 z-30"
            >
              <Coffee className="w-20 h-20 text-amber-400" />
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-amber-400/70 mb-2">Auction</p>
                <p className="font-display font-black text-4xl text-white">ON BREAK</p>
                {state?.displayCountdown?.message && (
                  <p className="text-lg text-[#71717a] mt-2">{state.displayCountdown.message}</p>
                )}
                <p className="font-display font-black text-6xl text-amber-400 mt-4 tabular-nums">
                  {String(breakMins).padStart(2, "0")}:{String(breakSecs).padStart(2, "0")}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  <p className="text-xl text-[#a1a1aa] mt-2">{formatIndianRupee(wonBanner.soldAmount)}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Purse booster banner ── */}
        <AnimatePresence>
          {purseBoosterBanner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-40 px-8 cursor-pointer"
              style={{ backgroundColor: "rgba(9,9,11,0.88)", backdropFilter: "blur(8px)" }}
              onClick={() => setPurseBoosterBanner(null)}
              role="button"
              aria-label="Dismiss purse update"
            >
              <div className="text-center">
                <p className="font-display font-black text-4xl text-emerald-400">💰 Purse Updated</p>
                <p className="text-3xl font-bold text-white mt-4">{formatIndianRupee(purseBoosterBanner.amount)}</p>
                <p className="text-base text-[#a1a1aa] mt-4">Previous Capacity</p>
                <p className="text-xl font-mono text-white">{formatIndianRupee(purseBoosterBanner.previousCapacity)}</p>
                <p className="text-base text-[#a1a1aa] mt-3">New Capacity</p>
                <p className="text-xl font-mono text-emerald-300">{formatIndianRupee(purseBoosterBanner.newCapacity)}</p>
                <p className="text-sm text-[#52525b] mt-6">Tap anywhere to continue</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Unsold/Deferred banner ── */}
        <AnimatePresence>
          {unsoldBanner && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-40 px-8"
              style={{ backgroundColor: "rgba(9,9,11,0.92)", backdropFilter: "blur(8px)" }}
            >
              <motion.div
                initial={{ scale: 0.7, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <XCircle className="w-28 h-28 text-red-400" />
              </motion.div>
              <div className="text-center">
                <p className="font-display font-black text-5xl text-red-400">UNSOLD</p>
                <p className="text-2xl font-bold text-white mt-3">{unsoldBanner.name}</p>
                <p className="text-base text-[#71717a] mt-2">Player not sold — moving on</p>
              </div>
            </motion.div>
          )}
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

  // ── Landscape layout ─────────────────────────────────────────────────────────
  return (
    <div
      className="auction-surface relative h-full flex flex-row bg-[#09090b] overflow-hidden select-none"
      style={{ background: `radial-gradient(ellipse at center left, ${teamColor}12 0%, transparent 55%), #09090b` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Left: player info */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#27272a]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMini logos={logos} brandName={brandName} miniBrandText={miniBrandText} />
            <div className="w-px h-4 bg-[#3f3f46]" />
            <TeamLogo
              logoUrl={team.logoUrl}
              shortCode={team.shortCode}
              teamName={team.name}
              teamColor={teamColor}
              className="w-9 h-9 rounded-lg"
              textClassName="text-xs"
            />
            <p className="font-display font-bold text-base truncate" style={{ color: teamColor }}>{team.name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AuctionFeedIndicator
              feedState={feed.state}
              secondsSinceLastActivity={feed.secondsSinceLastActivity}
            />
            <span className={`text-xs font-black px-2 py-1 rounded-full ${
              isActive ? "bg-green-500/20 text-green-400" : isPaused ? "bg-amber-500/20 text-amber-400" : "bg-[#27272a] text-[#71717a]"
            }`}>
              {statusLabel}
            </span>
            <button onClick={handleSyncTap} className="p-1.5 text-[#71717a] hover:text-white transition-colors rounded-lg hover:bg-[#18181b]" title="Sync">
              <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onViewSquad} className={navBtnClassLandscape(navBlocked)} title={navBlocked ? "Unavailable during live player auction" : "My squad"} aria-disabled={navBlocked}>
              <ShieldUser className="w-5 h-5" strokeWidth={2.25} />
            </button>
            <button onClick={onViewScout} className={navBtnClassLandscape(navBlocked)} title={navBlocked ? "Unavailable during live player auction" : "Scout rivals"} aria-disabled={navBlocked}>
              <Radar className="w-5 h-5" strokeWidth={2.25} />
            </button>
            <button onClick={() => setShowSignOutConfirm(true)} className="p-1.5 text-[#71717a] hover:text-white transition-colors rounded-lg hover:bg-[#18181b]">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {state?.timerEndsAt && (
            <TimerBar timerEndsAt={state.timerEndsAt} teamColor={teamColor} timerExpired={expired} />
          )}
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <PlayerCard key={state?.currentPlayer?.id} player={state!.currentPlayer!} teamColor={teamColor} />
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
              />
            ) : (
              <motion.div
                key="no-player-ls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-8 rounded-2xl border border-dashed border-[#3f3f46] bg-[#18181b]"
              >
                <p className="text-base text-[#52525b]">Waiting for next player...</p>
              </motion.div>
            )}
          </AnimatePresence>
          <BidAmount
            amount={state?.currentBid || 0}
            isLeading={isLeading}
            teamColor={teamColor}
            leadingTeam={state?.currentBidTeamName}
          />
        </div>

        {/* Purse strip */}
        <div className="px-4 py-3 border-t border-[#27272a] flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Spendable", value: formatShortIndianRupee(spendablePurse), accent: teamColor },
              { label: "Spent",     value: formatShortIndianRupee(teamPurse?.purseUsed ?? (team.purseUsed || 0)) },
              { label: "Players",   value: String(playersBought) },
            ].map(({ label, value, accent }) => (
              <div key={label} className="text-center">
                <p className="font-display font-black text-lg" style={accent ? { color: accent } : { color: "#fafafa" }}>{value}</p>
                <p className="text-[10px] text-[#52525b] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: bid controls */}
      <div className="w-[42%] flex flex-col px-4 py-4 gap-3" style={{ minWidth: 200 }}>
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <BidButton
              key={`ls-${isLeading}-${expired}-${isActive}-${hasPlayer}`}
              canBid={canBid}
              isLeading={isLeading}
              timerExpired={expired}
              hasPlayer={hasPlayer}
              isActive={isActive}
              isPaused={isPaused}
              isIdle={isIdle}
              bidding={bidding}
              bidFeedback={bidFeedback}
              nextBidAmount={nextBidAmount}
              teamColor={teamColor}
              onBid={handleBidTap}
              landscape={true}
            />
          </AnimatePresence>
        </div>

        {bidFeedback === "error" && (
          <p className="text-center text-red-400 text-sm font-semibold">{bidErrorMsg || "Bid failed. Try again."}</p>
        )}
        {disabledReason && (
          <p className="text-center text-xs text-[#71717a]">{disabledReason}</p>
        )}

        {showPoweredBy && (
          <p className="text-center text-xs text-[#3f3f46] uppercase tracking-widest flex-shrink-0">
            {poweredByText}
          </p>
        )}
      </div>

      {/* ── Break overlay ── */}
      <AnimatePresence>
        {isOnBreak && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#09090b]/93 flex flex-col items-center justify-center gap-4 z-30"
          >
            <Coffee className="w-16 h-16 text-amber-400" />
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-amber-400/70 mb-1">Auction</p>
              <p className="font-display font-black text-4xl text-white">ON BREAK</p>
              {state?.displayCountdown?.message && <p className="text-base text-[#71717a] mt-1">{state.displayCountdown.message}</p>}
              <p className="font-display font-black text-6xl text-amber-400 mt-3 tabular-nums">
                {String(breakMins).padStart(2, "0")}:{String(breakSecs).padStart(2, "0")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              {wonBanner.soldAmount != null && <p className="text-xl text-[#a1a1aa] mt-1">{formatIndianRupee(wonBanner.soldAmount)}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Purse booster banner ── */}
      <AnimatePresence>
        {purseBoosterBanner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-40 cursor-pointer"
            style={{ backgroundColor: "rgba(9,9,11,0.88)", backdropFilter: "blur(8px)" }}
            onClick={() => setPurseBoosterBanner(null)}
            role="button"
            aria-label="Dismiss purse update"
          >
            <div className="text-center">
              <p className="font-display font-black text-4xl text-emerald-400">💰 Purse Updated</p>
              <p className="text-3xl font-bold text-white mt-4">{formatIndianRupee(purseBoosterBanner.amount)}</p>
              <p className="text-base text-[#a1a1aa] mt-4">Previous Capacity</p>
              <p className="text-xl font-mono text-white">{formatIndianRupee(purseBoosterBanner.previousCapacity)}</p>
              <p className="text-base text-[#a1a1aa] mt-3">New Capacity</p>
              <p className="text-xl font-mono text-emerald-300">{formatIndianRupee(purseBoosterBanner.newCapacity)}</p>
              <p className="text-sm text-[#52525b] mt-6">Tap anywhere to continue</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unsold/Deferred banner ── */}
      <AnimatePresence>
        {unsoldBanner && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-40"
            style={{ backgroundColor: "rgba(9,9,11,0.92)", backdropFilter: "blur(8px)" }}
          >
            <motion.div initial={{ scale: 0.7, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300 }}>
              <XCircle className="w-28 h-28 text-red-400" />
            </motion.div>
            <div className="text-center">
              <p className="font-display font-black text-5xl text-red-400">UNSOLD</p>
              <p className="text-2xl font-bold text-white mt-2">{unsoldBanner.name}</p>
              <p className="text-base text-[#71717a] mt-1">Player not sold — moving on</p>
            </div>
          </motion.div>
        )}
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
