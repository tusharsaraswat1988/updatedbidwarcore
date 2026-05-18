import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, User, Wifi, WifiOff, WifiLow, LogOut, ShieldAlert, AlertTriangle } from "lucide-react";
import { useOrientation } from "@/hooks/useOrientation";
import { useCountdown } from "@/hooks/useCountdown";
import { useTimerExpired } from "@/hooks/useTimerExpired";
import { hapticBid, hapticSuccess, hapticError, hapticLeading } from "@/lib/haptics";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

// ── Types (minimal shapes matching the API schema) ──────────────────────────
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
}

interface Team {
  id: number;
  name: string;
  shortCode?: string | null;
  color?: string | null;
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
  onBid: (amount: number) => Promise<"success" | "leading" | "error">;
  onSignOut: () => void;
}

// ── Network quality ─────────────────────────────────────────────────────────
type NetworkQuality = "good" | "weak" | "poor";

function useNetworkQuality(state: AuctionState | null): NetworkQuality {
  const lastUpdateRef = useRef<number>(Date.now());
  const [quality, setQuality] = useState<NetworkQuality>("good");

  useEffect(() => {
    if (state) lastUpdateRef.current = Date.now();
  }, [state]);

  useEffect(() => {
    const id = setInterval(() => {
      const staleSec = (Date.now() - lastUpdateRef.current) / 1000;
      if (staleSec > 12) setQuality("poor");
      else if (staleSec > 5) setQuality("weak");
      else setQuality("good");
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return quality;
}

// ── Anti-double-tap hook ────────────────────────────────────────────────────
function useDebounce(ms = 600) {
  const lastTap = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < ms) return false;
    lastTap.current = now;
    return true;
  }, [ms]);
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NetworkDot({ quality }: { quality: NetworkQuality }) {
  if (quality === "good")
    return <Wifi className="w-4 h-4 text-green-400" />;
  if (quality === "weak")
    return <WifiLow className="w-4 h-4 text-yellow-400" />;
  return <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />;
}

function TimerBar({
  timerEndsAt,
  teamColor,
  timerExpired,
}: {
  timerEndsAt: string | null | undefined;
  teamColor: string;
  timerExpired: boolean;
}) {
  const { secondsLeft } = useCountdown(timerEndsAt);

  if (!timerEndsAt) return null;

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex-1 h-2 bg-[#27272a] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: timerExpired ? "#ef4444" : teamColor }}
          animate={{ width: timerExpired ? "0%" : `${Math.max(0, (secondsLeft / 30) * 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span
        className="font-display font-bold text-lg tabular-nums w-8 text-right"
        style={{ color: timerExpired ? "#ef4444" : timerExpired ? "#ef4444" : secondsLeft <= 5 ? "#ef4444" : teamColor }}
      >
        {secondsLeft}s
      </span>
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
      className="flex items-center gap-4 p-4 rounded-2xl border border-[#27272a] bg-[#18181b]"
    >
      <div className="w-16 h-20 rounded-xl bg-[#27272a] border border-[#3f3f46] flex-shrink-0 overflow-hidden flex items-center justify-center">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-8 h-8 text-[#52525b]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-display font-bold text-2xl leading-tight text-white truncate">{player.name}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {player.role && <span className="text-sm text-[#a1a1aa] capitalize">{player.role}</span>}
          {player.age && <span className="text-xs text-[#71717a]">Age {player.age}</span>}
          {player.city && <span className="text-xs text-[#71717a]">{player.city}</span>}
        </div>
        {player.basePrice != null && (
          <p className="text-xs text-[#71717a] mt-1">
            Base <span className="text-white font-semibold">{formatIndianRupee(player.basePrice)}</span>
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
    <div className="text-center">
      <p className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-1">
        {isLeading ? "Your Bid — Leading" : "Current Bid"}
      </p>
      <motion.p
        key={amount}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="font-display font-black text-5xl leading-none"
        style={{ color: isLeading ? teamColor : "#ffffff" }}
      >
        {formatIndianRupee(amount || 0)}
      </motion.p>
      {!isLeading && leadingTeam && (
        <p className="text-xs text-[#71717a] mt-1">
          Leading: <span className="font-semibold text-white">{leadingTeam}</span>
        </p>
      )}
    </div>
  );
}

function BidButton({
  canBid,
  isLeading,
  timerExpired,
  hasPlayer,
  isActive,
  bidding,
  bidFeedback,
  nextBidAmount,
  teamColor,
  onBid,
  landscape,
}: {
  canBid: boolean;
  isLeading: boolean;
  timerExpired: boolean;
  hasPlayer: boolean;
  isActive: boolean;
  bidding: boolean;
  bidFeedback: "success" | "error" | "leading" | null;
  nextBidAmount: number;
  teamColor: string;
  onBid: () => void;
  landscape: boolean;
}) {
  const buttonH = landscape ? "min-h-[40vh] h-full" : "h-full min-h-[14vh]";

  if (isLeading) {
    return (
      <motion.div
        key="leading"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full ${buttonH} rounded-3xl border-4 flex flex-col items-center justify-center gap-3 px-4`}
        style={{ borderColor: `${teamColor}80`, backgroundColor: `${teamColor}18` }}
      >
        <Trophy className="w-12 h-12" style={{ color: teamColor }} />
        <div className="text-center">
          <p className="font-display font-black text-2xl" style={{ color: teamColor }}>HIGHEST BIDDER</p>
          <p className="text-sm text-[#71717a] mt-1">Waiting for other teams...</p>
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
        className={`w-full ${buttonH} rounded-3xl border-2 border-red-500/30 bg-red-500/10 flex flex-col items-center justify-center gap-3`}
      >
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <div className="text-center">
          <p className="font-display font-black text-2xl text-red-400">BIDDING CLOSED</p>
          <p className="text-sm text-[#71717a] mt-1">Timer expired — awaiting operator</p>
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
        className={`w-full ${buttonH} rounded-3xl border border-dashed border-[#3f3f46] bg-[#18181b] flex flex-col items-center justify-center gap-2`}
      >
        <div className="w-8 h-8 border-2 border-[#3f3f46] border-t-[#71717a] rounded-full animate-spin" />
        <p className="text-sm text-[#71717a]">
          {!isActive ? "Auction paused" : "Waiting for next player..."}
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
        fontSize: landscape ? "clamp(2rem, 5vw, 3.5rem)" : "clamp(2.5rem, 10vw, 4rem)",
      }}
    >
      {bidding ? (
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
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

// ── Main component ──────────────────────────────────────────────────────────
export function LiveBid({ state, team, tournament, teamPurse, teamId, onBid, onSignOut }: Props) {
  const orientation = useOrientation();
  const landscape   = orientation === "landscape";
  const networkQ    = useNetworkQuality(state);
  const mayTap      = useDebounce(600);

  const [bidding,     setBidding]     = useState(false);
  const [bidFeedback, setBidFeedback] = useState<"success" | "error" | "leading" | null>(null);

  const teamColor = team.color || "#F59E0B";
  const isLeading = state?.currentBidTeamId === teamId;
  const isActive  = state?.status === "active";
  const hasPlayer = !!state?.currentPlayer;

  const expired     = useTimerExpired(state?.timerEndsAt);
  const timerActive = !!state?.timerEndsAt && !expired;

  const spendablePurse   = teamPurse?.spendablePurse ?? (team.purse - (team.purseUsed || 0));
  const reservePurse     = teamPurse?.reservePurse ?? 0;
  const playersBought    = teamPurse?.playersBought ?? 0;
  const maxSquad         = teamPurse?.maximumSquadSize ?? 0;
  const slotsRequired    = teamPurse?.slotsRequired ?? 0;
  const maxSquadReached  = maxSquad > 0 && playersBought >= maxSquad;
  const increment        = state?.bidIncrement ?? 50000;
  const nextBidAmount    = (state?.currentBid || 0) + increment;

  const categoryMax   = state?.currentCategoryMaxPlayers ?? null;
  const categoryCount = categoryMax != null
    ? ((state?.teamCategoryPlayerCounts as Record<string, number> | null | undefined)?.[String(teamId)] ?? 0)
    : 0;
  const categoryLimitReached = categoryMax != null && categoryCount >= categoryMax;

  const canBid =
    isActive && hasPlayer && timerActive && !isLeading &&
    spendablePurse >= nextBidAmount &&
    (team.isBiddingEnabled ?? true) &&
    !maxSquadReached && !categoryLimitReached;

  async function handleBidTap() {
    if (!canBid || bidding || !mayTap()) return;
    hapticBid();
    setBidding(true);
    const result = await onBid(nextBidAmount);
    setBidding(false);
    setBidFeedback(result);
    if (result === "success") hapticSuccess();
    else if (result === "leading") hapticLeading();
    else hapticError();
    setTimeout(() => setBidFeedback(null), 1600);
  }

  // Disable-reason label under button
  const disabledReason =
    !canBid && !isLeading && !expired && hasPlayer
      ? !isActive                        ? "Auction not active"
      : maxSquadReached                  ? "Maximum squad size reached"
      : categoryLimitReached             ? `Category limit (max ${categoryMax} in "${state?.currentCategoryName}")`
      : !(team.isBiddingEnabled ?? true) ? "Bidding disabled for your team"
      : reservePurse > 0 && spendablePurse < nextBidAmount
                                         ? `${formatShortIndianRupee(reservePurse)} reserved for ${slotsRequired} slot${slotsRequired !== 1 ? "s" : ""}`
      : `Need ${formatShortIndianRupee(nextBidAmount - spendablePurse)} more purse`
      : null;

  const statusLabel =
    state?.status === "active" ? "LIVE" :
    state?.status === "paused" ? "PAUSED" :
    state?.status ? state.status.toUpperCase() : "IDLE";

  // ── Portrait layout ────────────────────────────────────────────────────────
  if (!landscape) {
    return (
      <div
        className="h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom"
        style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 55%), #09090b` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm flex-shrink-0"
              style={{ backgroundColor: `${teamColor}30`, color: teamColor, border: `2px solid ${teamColor}55` }}
            >
              {team.shortCode || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-base leading-none truncate" style={{ color: teamColor }}>
                {team.name}
              </p>
              <p className="text-[10px] text-[#71717a] mt-0.5">{tournament?.name || "Auction"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NetworkDot quality={networkQ} />
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                isActive ? "bg-green-500/20 text-green-400" : "bg-[#27272a] text-[#71717a]"
              }`}
            >
              {statusLabel}
            </span>
            <button
              onClick={onSignOut}
              className="p-1.5 text-[#71717a] hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable top area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-4 min-h-0">
          {/* Timer */}
          {state?.timerEndsAt && (
            <TimerBar timerEndsAt={state.timerEndsAt} teamColor={teamColor} timerExpired={expired} />
          )}

          {/* Player */}
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <PlayerCard key={state?.currentPlayer?.id} player={state!.currentPlayer!} teamColor={teamColor} />
            ) : (
              <motion.div
                key="no-player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-8 rounded-2xl border border-dashed border-[#3f3f46] bg-[#18181b]"
              >
                <div className="text-center text-[#52525b]">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Waiting for next player...</p>
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
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400 font-semibold">
                {formatShortIndianRupee(reservePurse)} reserved — {slotsRequired} slot{slotsRequired !== 1 ? "s" : ""} needed
              </p>
            </div>
          )}
          {maxSquadReached && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-500/25 bg-red-500/8">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-semibold">Maximum squad size reached — bidding blocked</p>
            </div>
          )}
        </div>

        {/* Sticky bid controls — min 25vh */}
        <div
          className="flex-shrink-0 px-4 pt-3 pb-4 border-t border-[#27272a] space-y-2"
          style={{ minHeight: "max(25vh, 180px)" }}
        >
          <div className="flex-1 flex flex-col h-full gap-2">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <BidButton
                  key={`${isLeading}-${expired}-${isActive}-${hasPlayer}`}
                  canBid={canBid}
                  isLeading={isLeading}
                  timerExpired={expired}
                  hasPlayer={hasPlayer}
                  isActive={isActive}
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
              <p className="text-center text-red-400 text-sm">Bid failed. Please try again.</p>
            )}
            {disabledReason && (
              <p className="text-center text-[10px] text-[#71717a]">{disabledReason}</p>
            )}

            {/* Purse strip */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "Spendable", value: formatShortIndianRupee(spendablePurse), accent: teamColor },
                { label: "Spent",     value: formatShortIndianRupee(teamPurse?.purseUsed ?? (team.purseUsed || 0)) },
                { label: "Players",   value: String(playersBought) },
              ].map(({ label, value, accent }) => (
                <div key={label} className="text-center">
                  <p className="font-display font-bold text-base" style={accent ? { color: accent } : { color: "#fafafa" }}>
                    {value}
                  </p>
                  <p className="text-[9px] text-[#52525b] uppercase tracking-wide">{label}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] text-[#3f3f46] uppercase tracking-widest">Powered by BidWar</p>
          </div>
        </div>

        {/* Reconnect overlay */}
        <AnimatePresence>
          {networkQ === "poor" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#09090b]/90 flex flex-col items-center justify-center gap-4 z-50"
            >
              <WifiOff className="w-12 h-12 text-red-400 animate-pulse" />
              <div className="text-center">
                <p className="font-display font-bold text-xl text-white">Connection lost</p>
                <p className="text-sm text-[#71717a] mt-1">Reconnecting to auction room...</p>
              </div>
              <div className="w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-[#3f3f46] uppercase tracking-widest">Powered by BidWar</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Landscape layout ───────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-row bg-[#09090b] overflow-hidden"
      style={{ background: `radial-gradient(ellipse at center left, ${teamColor}12 0%, transparent 55%), #09090b` }}
    >
      {/* Left: player info */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#27272a]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs flex-shrink-0"
              style={{ backgroundColor: `${teamColor}30`, color: teamColor, border: `2px solid ${teamColor}55` }}
            >
              {team.shortCode || "?"}
            </div>
            <p className="font-display font-bold text-sm truncate" style={{ color: teamColor }}>{team.name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NetworkDot quality={networkQ} />
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                isActive ? "bg-green-500/20 text-green-400" : "bg-[#27272a] text-[#71717a]"
              }`}
            >
              {statusLabel}
            </span>
            <button onClick={onSignOut} className="p-1 text-[#71717a] hover:text-white transition-colors">
              <LogOut className="w-3.5 h-3.5" />
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
            ) : (
              <motion.div
                key="no-player-ls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-6 rounded-2xl border border-dashed border-[#3f3f46] bg-[#18181b]"
              >
                <p className="text-sm text-[#52525b]">Waiting for next player...</p>
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
        <div className="px-4 py-2 border-t border-[#27272a] flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Spendable", value: formatShortIndianRupee(spendablePurse), accent: teamColor },
              { label: "Spent",     value: formatShortIndianRupee(teamPurse?.purseUsed ?? (team.purseUsed || 0)) },
              { label: "Players",   value: String(playersBought) },
            ].map(({ label, value, accent }) => (
              <div key={label} className="text-center">
                <p className="font-display font-bold text-sm" style={accent ? { color: accent } : { color: "#fafafa" }}>{value}</p>
                <p className="text-[9px] text-[#52525b] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: bid controls — DOMINANT */}
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
          <p className="text-center text-red-400 text-xs">Bid failed. Try again.</p>
        )}
        {disabledReason && (
          <p className="text-center text-[10px] text-[#71717a]">{disabledReason}</p>
        )}

        <p className="text-center text-[10px] text-[#3f3f46] uppercase tracking-widest flex-shrink-0">
          Powered by BidWar
        </p>
      </div>

      {/* Reconnect overlay */}
      <AnimatePresence>
        {networkQ === "poor" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#09090b]/90 flex flex-col items-center justify-center gap-4 z-50"
          >
            <WifiOff className="w-12 h-12 text-red-400 animate-pulse" />
            <div className="text-center">
              <p className="font-display font-bold text-xl text-white">Connection lost</p>
              <p className="text-sm text-[#71717a] mt-1">Reconnecting to auction room...</p>
            </div>
            <div className="w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
