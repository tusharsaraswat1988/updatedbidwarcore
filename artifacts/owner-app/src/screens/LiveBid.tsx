import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, User, LogOut,
  AlertTriangle, Coffee, RefreshCw, X, XCircle, Radar, ShieldUser, Sparkles,
  Info, ChevronRight, Wallet, Users, Target, ShieldAlert,
} from "lucide-react";
import { useLiveBidLayout, type DeviceTier } from "@/hooks/useLiveBidLayout";
import { useCountdown } from "@/hooks/useCountdown";
import { useTimerExpired } from "@/hooks/useTimerExpired";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { useBidLifecycle } from "@/hooks/use-bid-lifecycle";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import { hapticBid, hapticSuccess, hapticError, hapticLeading, hapticBooster } from "@/lib/haptics";
import { formatIndianRupee, formatShortIndianRupee, resolveAuctionUnit } from "@/lib/format";
import { computeNextBidAmount, resolveRetainedSpend, isTeamEligibleForTrialAuction, resolveOwnerLiveBidFooterPurse, resolveOwnerPlayingSquadTotal, resolveOwnerSquadRequirement, ownerSquadMinSubline, ownerSquadMaxSubline } from "@workspace/api-base";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { InterLotCommandCenter } from "@/components/InterLotCommandCenter";
import { PlayerTagBadge } from "@/components/PlayerTagBadge";
import { Toast } from "@/components/Toast";
import { AuctionConnectionBanner, AuctionFeedIndicator } from "@/components/AuctionConnectionBanner";
import { resolveHeaderBrandLogoUrl } from "@/lib/brand-assets";
import { isPlayerOnAuctionStage } from "@/lib/auction-stage";
import { resolvePlayerSpecifications } from "@workspace/api-base/player-spec-export";
import { formatPlayerGender } from "@workspace/api-base/player-gender";
import { useRoleSpecGroups } from "@/hooks/useRoleSpecGroups";
import { getListPlayersQueryKey, useListPlayers, useGetTeamPurses, getGetTeamPursesQueryKey } from "@workspace/api-client-react";
import { useBreakCountdownFromState } from "@/lib/break-countdown";
import { getPlayerTagTheme } from "@/lib/player-tag-theme";
import { OwnerPlayerAuctionHistory } from "@/components/OwnerPlayerAuctionHistory";
import { useOwnerTargets, useAiRadarPreference } from "@/lib/owner-targets";
import {
  isRecognizedRole,
  computeBluffRadar,
  computePlanBPivot,
  type BluffRadarResult,
  type PlanBPivotResult,
} from "@/lib/war-room-engine";

const BIDWAR_AMBER = "#F59E0B";

// ── Types ────────────────────────────────────────────────────────────────────
interface AuctionState {
  status?: string;
  licenseStatus?: string;
  trialTeamIds?: number[] | null;
  currentPlayer?: {
    id?: number;
    serialNo?: number | null;
    categoryId?: number | null;
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
  ownerBiddingEnabled?: boolean;
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
  ownerBiddingEnabled?: boolean;
}

interface TeamPurse {
  teamId: number;
  purseRemaining?: number;
  reservePurse?: number;
  spendablePurse: number;
  slotsRequired?: number;
  futureReservePurse?: number;
  futureSlotsRequired?: number;
  maxAllowedBid?: number;
  playersBought?: number;
  retainedCount?: number;
  minimumSquadSize?: number;
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
  onViewWarRoom?: () => void;
  navToast?: string | null;
  onNavToastDismiss?: () => void;
  onSignOut: () => void;
  onSync: () => void;
  isSyncError?: boolean;
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
      <div className="flex-1 h-3 bg-[#4a4478] rounded-full overflow-hidden">
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

function PlayerBioSideDrawer({
  isOpen,
  onClose,
  player,
  teamColor,
  unit,
  categoryName: _categoryName,
  sport,
  tournamentId,
  features,
  isTargetPlayer = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  player: NonNullable<AuctionState["currentPlayer"]> | null;
  teamColor: string;
  unit: ReturnType<typeof resolveAuctionUnit>;
  categoryName?: string | null;
  sport?: string | null;
  tournamentId?: number;
  features?: any;
  isTargetPlayer?: boolean;
}) {
  const specGroupLabels = useRoleSpecGroups(sport ?? undefined, player?.role).map((g) => g.groupName);
  const specs = useMemo(
    () => (player ? resolvePlayerSpecifications(player, { specGroupLabels }).filter((s) => s.value.trim()) : []),
    [player, specGroupLabels],
  );

  const genderLabel = player ? formatPlayerGender(player.gender) : null;
  const tagTheme = player ? getPlayerTagTheme(player.playerTag) : null;

  const metaItems = player
    ? [
        player.role ? { label: "Role", value: player.role } : null,
        player.age ? { label: "Age", value: String(player.age) } : null,
        player.city ? { label: "City", value: player.city } : null,
        genderLabel ? { label: "Gender", value: genderLabel } : null,
        player.jerseyNumber ? { label: "Jersey", value: `#${player.jerseyNumber}` } : null,
        player.isNonPlayingMember ? { label: "Type", value: "Non-Playing" } : null,
      ].filter(Boolean) as { label: string; value: string }[]
    : [];

  return (
    <AnimatePresence>
      {isOpen && player && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          />

          {/* Side Drawer Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative z-10 w-full max-w-[340px] sm:max-w-md h-full bg-[#1e1845] border-l border-[#4a4478] shadow-2xl flex flex-col text-white select-none overflow-hidden safe-top safe-bottom"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#4a4478] bg-[#18123a] flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="font-display font-bold text-sm uppercase tracking-wider text-amber-300 truncate">
                  Player Dossier & History
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-[#a8a0c4] hover:text-white hover:bg-[#3d3670] transition-colors"
                aria-label="Close dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 [-webkit-overflow-scrolling:touch]">
              {/* Avatar + Main identity */}
              <div className="flex items-start gap-3.5">
                <div className="relative flex-shrink-0">
                  <PlayerAvatar
                    name={player.name ?? "Player"}
                    photoUrl={player.photoUrl}
                    accentColor={tagTheme?.color ?? teamColor}
                    className="w-20 h-28 rounded-2xl object-cover shadow-lg border border-[#4a4478]"
                  />
                  {player.playerTag ? (
                    <div className="absolute left-1 top-1 z-10 scale-90 origin-top-left">
                      <PlayerTagBadge tagKey={player.playerTag} />
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-amber-400 font-bold">#{player.serialNo ?? player.id}</span>
                  <h3 className="font-display font-black text-xl text-white leading-tight truncate mt-0.5">
                    {player.name}
                  </h3>
                  {isTargetPlayer && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                        ⭐ YOUR TARGET PLAYER
                      </span>
                    </div>
                  )}
                  {player.playerTag ? (
                    <div className="mt-1">
                      <PlayerTagBadge tagKey={player.playerTag} size="md" />
                    </div>
                  ) : null}
                  {player.basePrice != null && (
                    <div className="mt-2.5 px-2.5 py-1 rounded-lg bg-[#2a2458] border border-[#4a4478] inline-block">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">Base Price</p>
                      <p className="font-display font-black text-sm text-emerald-400 leading-none mt-0.5">
                        {formatIndianRupee(player.basePrice, unit)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Meta Grid */}
              {metaItems.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#2a2458]/70 border border-[#4a4478]">
                  {metaItems.map(({ label, value }) => (
                    <div key={label} className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b6490]">{label}</p>
                      <p className="text-xs text-[#d4d4d8] font-semibold capitalize truncate">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Past Auction Creds */}
              {tournamentId && player.id ? (
                <div className="rounded-xl border border-[#4a4478] bg-[#2a2458]/50 p-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-400/90 mb-1.5 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" />
                    Historical Performance
                  </p>
                  <OwnerPlayerAuctionHistory
                    tournamentId={tournamentId}
                    playerId={player.id}
                    unit={unit}
                    features={features}
                  />
                </div>
              ) : null}

              {/* Specs */}
              {specs.length > 0 && (
                <div className="p-3 rounded-xl bg-[#2a2458]/70 border border-[#4a4478] space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">Specifications</p>
                  <div className="grid grid-cols-2 gap-2">
                    {specs.map((spec) => (
                      <div key={`${spec.specGroupId ?? spec.label}-${spec.value}`} className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b6490]">{spec.label}</p>
                        <p className="text-xs text-white font-semibold truncate">{spec.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Achievements */}
              {player.achievements?.trim() && (
                <div className="p-3 rounded-xl bg-[#2a2458]/70 border border-[#4a4478] space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">Achievements</p>
                  <p className="text-xs text-[#d4d4d8] leading-relaxed whitespace-pre-wrap">{player.achievements.trim()}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#4a4478] bg-[#18123a] flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#3d3670] hover:bg-[#4a4478] text-white font-bold text-xs uppercase tracking-wider transition-colors active:scale-95"
              >
                Back to Live Bidding
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function PlayerCard({
  player,
  teamColor,
  unit,
  categoryName,
  sport,
  tier,
  tournamentId,
  features,
  squadRoleCount,
  onOpenBio,
  isTargetPlayer,
}: {
  player: NonNullable<AuctionState["currentPlayer"]>;
  teamColor: string;
  unit: ReturnType<typeof resolveAuctionUnit>;
  categoryName?: string | null;
  sport?: string | null;
  tier: DeviceTier;
  tournamentId?: number;
  features?: any;
  squadRoleCount?: number | null;
  onOpenBio?: () => void;
  isTargetPlayer?: boolean;
}) {
  const specGroupLabels = useRoleSpecGroups(sport ?? undefined, player.role).map((g) => g.groupName);
  const specs = useMemo(
    () => resolvePlayerSpecifications(player, { specGroupLabels }).filter((s) => s.value.trim()),
    [player, specGroupLabels],
  );

  const genderLabel = formatPlayerGender(player.gender);
  const tagTheme = getPlayerTagTheme(player.playerTag);

  const metaItems = [
    player.role ? { label: "Role", value: player.role } : null,
    player.age ? { label: "Age", value: String(player.age) } : null,
    player.city ? { label: "City", value: player.city } : null,
    genderLabel ? { label: "Gender", value: genderLabel } : null,
    player.jerseyNumber ? { label: "Jersey", value: `#${player.jerseyNumber}` } : null,
    categoryName ? { label: "Category", value: categoryName } : null,
    player.isNonPlayingMember ? { label: "Type", value: "Non-Playing" } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (tier === "mobile") {
    const keySpecs = specs.slice(0, 2).map((s) => s.value).join(" • ");
    return (
      <motion.div
        key={player.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        onClick={onOpenBio}
        className="rounded-2xl border bg-[#2a2458] p-3 shadow-md flex items-center justify-between gap-2.5 relative cursor-pointer active:scale-[0.99] transition-transform select-none"
        style={
          tagTheme
            ? { borderColor: tagTheme.color, boxShadow: `0 0 16px ${tagTheme.glow}` }
            : { borderColor: "#4a4478" }
        }
      >
        <div className="relative flex-shrink-0">
          <PlayerAvatar
            name={player.name ?? "Player"}
            photoUrl={player.photoUrl}
            accentColor={tagTheme?.color ?? teamColor}
            className="w-14 h-16 rounded-xl object-cover shadow-sm"
          />
          {player.playerTag ? (
            <div className="absolute -top-1 -left-1 z-10 scale-90 origin-top-left">
              <PlayerTagBadge tagKey={player.playerTag} />
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs text-[#a8a0c4] shrink-0">#{player.serialNo ?? player.id}</span>
            <h2 className="font-display font-black leading-tight text-white text-base truncate">{player.name}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {isTargetPlayer && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                ⭐ YOUR TARGET PLAYER
              </span>
            )}
            {isRecognizedRole(player.role) ? (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#18123a] text-amber-300 border border-amber-400/30">
                {player.role}
              </span>
            ) : null}
            {player.basePrice != null ? (
              <span className="text-[11px] font-bold text-[#faf8ff]">
                Base <span className="text-emerald-400 font-extrabold">{formatIndianRupee(player.basePrice, unit)}</span>
              </span>
            ) : null}
            {isRecognizedRole(player.role || categoryName) && squadRoleCount !== undefined && squadRoleCount !== null && (() => {
              const rName = (player.role || categoryName) ?? "Player";
              const rPlural = rName.endsWith("s") ? rName : `${rName}s`;
              return squadRoleCount === 0 ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                  High Priority: 0 {rPlural} on roster
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  <Users className="w-2.5 h-2.5 text-indigo-400" />
                  Surplus: Already hold {squadRoleCount} {squadRoleCount === 1 ? rName : rPlural}
                </span>
              );
            })()}
          </div>

          {(keySpecs || player.jerseyNumber) && (
            <p className="text-[10px] text-[#a8a0c4] mt-1 truncate">
              {player.jerseyNumber ? `#${player.jerseyNumber} · ` : ""}{keySpecs || (player.city ? player.city : "")}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenBio?.();
          }}
          className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-[#3d3670]/90 hover:bg-[#4a4478] border border-[#5d568e] text-amber-300 active:scale-95 transition-all text-center shadow-xs"
          aria-label="Open player bio and stats"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-[9px] font-black uppercase tracking-wider leading-none">Bio & Stats</span>
        </button>
      </motion.div>
    );
  }

  const cardPad = "p-5 gap-5";
  const photoClass = tier === "tablet" ? "w-20 h-28" : "w-24 h-32";
  const nameClass = "text-3xl";
  const metaCols = "grid-cols-2 sm:grid-cols-3";

  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className={`flex items-start rounded-2xl border bg-[#2a2458] ${cardPad}`}
      style={
        tagTheme
          ? {
              borderColor: tagTheme.color,
              boxShadow: `0 0 16px ${tagTheme.glow}`,
            }
          : { borderColor: "#4a4478" }
      }
    >
      <div className="relative flex-shrink-0">
        <PlayerAvatar
          name={player.name ?? "Player"}
          photoUrl={player.photoUrl}
          accentColor={tagTheme?.color ?? teamColor}
          className={`${photoClass} rounded-xl`}
        />
        {player.playerTag ? (
          <div className="absolute left-1 top-1 z-10 max-w-[calc(100%-0.25rem)]">
            <PlayerTagBadge tagKey={player.playerTag} />
          </div>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="font-mono text-sm text-[#a8a0c4] shrink-0">#{player.serialNo ?? player.id}</span>
          <h2 className={`font-display font-black leading-tight text-white truncate ${nameClass}`}>{player.name}</h2>
          {isTargetPlayer && (
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
              ⭐ YOUR TARGET PLAYER
            </span>
          )}
          {player.playerTag ? <PlayerTagBadge tagKey={player.playerTag} size="md" className="shrink-0" /> : null}
          {isRecognizedRole(player.role || categoryName) && squadRoleCount !== undefined && squadRoleCount !== null && (() => {
            const rName = (player.role || categoryName) ?? "Player";
            const rPlural = rName.endsWith("s") ? rName : `${rName}s`;
            return squadRoleCount === 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                High Priority: 0 {rPlural} on roster
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Surplus: Already hold {squadRoleCount} {squadRoleCount === 1 ? rName : rPlural}
              </span>
            );
          })()}
        </div>

        {metaItems.length > 0 && (
          <div className={`grid ${metaCols} gap-x-4 gap-y-1.5 mt-3`}>
            {metaItems.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b6490]">{label}</p>
                <p className="text-sm text-[#d4d4d8] capitalize truncate">{value}</p>
              </div>
            ))}
          </div>
        )}

        {tournamentId && player.id ? (
          <OwnerPlayerAuctionHistory
            tournamentId={tournamentId}
            playerId={player.id}
            unit={unit}
            features={features}
          />
        ) : null}

        {specs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-[#4a4478]">
            {specs.map((spec) => (
              <div key={`${spec.specGroupId ?? spec.label}-${spec.value}`} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b6490]">{spec.label}</p>
                <p className="text-sm text-white font-semibold truncate">{spec.value}</p>
              </div>
            ))}
          </div>
        )}

        {player.achievements?.trim() && (
          <p className="text-sm text-[#a8a0c4] mt-3 pt-3 border-t border-[#4a4478] line-clamp-2">
            {player.achievements.trim()}
          </p>
        )}

        {player.basePrice != null && (
          <p className="text-sm text-[#a8a0c4] mt-3">
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
  biddingActive = false,
  collapseSignal = 0,
}: {
  teamColor: string;
  teamPurse: TeamPurse | null;
  tournamentId: number;
  teamId: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
  biddingActive?: boolean;
  collapseSignal?: number;
}) {
  const [expanded, setExpanded] = useState<SquadListCategory | null>(null);

  useEffect(() => {
    if (biddingActive || collapseSignal > 0) {
      setExpanded(null);
    }
  }, [biddingActive, collapseSignal]);

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

  const totalInSquad = resolveOwnerPlayingSquadTotal({
    playersBought: teamPurse?.playersBought,
    retainedPlayingCount: retainedPlayers.length,
    boughtPlayingCount: boughtPlayers.length,
    rosterLoaded: allPlayers != null,
  });
  const retainedCount = teamPurse?.retainedCount ?? retainedPlayers.length;
  const boughtCount = boughtPlayers.length;
  const squadDue = resolveOwnerSquadRequirement({
    minimumSquadSize: teamPurse != null ? (teamPurse.minimumSquadSize ?? 0) : null,
    maximumSquadSize: teamPurse != null ? (teamPurse.maximumSquadSize ?? 0) : null,
    totalInSquad,
  });

  const expandedPlayers = expanded === "retained" ? retainedPlayers : boughtPlayers;
  const expandedTitle = expanded === "retained" ? "Retained Players" : "Bought Players";

  const toggleCategory = (category: SquadListCategory) => {
    setExpanded((prev) => (prev === category ? null : category));
  };

  const statValueClass = tier === "mobile" ? "text-xl" : tier === "tablet" ? "text-2xl" : "text-2xl";
  const statLabelClass = tier === "mobile" ? "text-[10px]" : "text-[11px]";
  const cellPad = tier === "mobile" ? "px-1.5 py-3" : "px-3 py-3";
  const squadCols =
    2 + (squadDue.minDue != null ? 1 : 0) + (squadDue.maxDue != null ? 1 : 0);

  return (
    <div className="rounded-2xl border border-[#4a4478] bg-[#2a2458] overflow-hidden">
      <div
        className="grid divide-x divide-[#4a4478]"
        style={{ gridTemplateColumns: `repeat(${squadCols}, minmax(0, 1fr))` }}
      >
        {squadDue.minDue != null ? (
          <div className={`${cellPad} text-center min-w-0`}>
            <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: BIDWAR_AMBER }}>
              {squadDue.minDue}
            </p>
            <p className={`font-bold uppercase tracking-wider text-[#6b6490] mt-1.5 ${statLabelClass}`}>
              Min Squad
            </p>
            <p className="text-[10px] text-[#a8a0c4] mt-0.5">{ownerSquadMinSubline(squadDue.minDue)}</p>
          </div>
        ) : null}

        {squadDue.maxDue != null ? (
          <div className={`${cellPad} text-center min-w-0`}>
            <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: BIDWAR_AMBER }}>
              {squadDue.maxDue}
            </p>
            <p className={`font-bold uppercase tracking-wider text-[#6b6490] mt-1.5 ${statLabelClass}`}>
              Max Squad
            </p>
            <p className="text-[10px] text-[#a8a0c4] mt-0.5">{ownerSquadMaxSubline(squadDue.maxDue)}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => toggleCategory("retained")}
          className={`${cellPad} text-center min-w-0 transition-colors active:scale-[0.98] ${
            expanded === "retained" ? "bg-[#4a4478]" : "hover:bg-[#1f1f23]"
          }`}
        >
          <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: teamColor }}>
            {retainedCount}
          </p>
          <p className={`font-bold uppercase tracking-wider text-[#6b6490] mt-1.5 ${statLabelClass}`}>
            Retained
          </p>
          <p className="text-[10px] text-[#a8a0c4] mt-0.5">Tap to view</p>
        </button>

        <button
          type="button"
          onClick={() => toggleCategory("bought")}
          className={`${cellPad} text-center min-w-0 transition-colors active:scale-[0.98] ${
            expanded === "bought" ? "bg-[#4a4478]" : "hover:bg-[#1f1f23]"
          }`}
        >
          <p className={`font-display font-black leading-none ${statValueClass}`} style={{ color: teamColor }}>
            {boughtCount}
          </p>
          <p className={`font-bold uppercase tracking-wider text-[#6b6490] mt-1.5 ${statLabelClass}`}>
            Bought
          </p>
          <p className="text-[10px] text-[#a8a0c4] mt-0.5">Tap to view</p>
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
            className="overflow-hidden border-t border-[#4a4478]"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#141416]">
              <p className="text-xs font-bold uppercase tracking-wider text-[#a8a0c4]">{expandedTitle}</p>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="p-1 rounded-lg text-[#a8a0c4] hover:text-white hover:bg-[#4a4478] transition-colors"
                aria-label="Close player list"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {expandedPlayers.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#6b6490]">No players yet</p>
            ) : (
              <ul className={`overflow-y-auto overscroll-contain divide-y divide-[#4a4478] [-webkit-overflow-scrolling:touch] ${
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

function PurseBreakdownModal({
  isOpen,
  onClose,
  totalPurse,
  totalSpent,
  retainedSpend,
  purseRemaining,
  reserve,
  boosterTotal,
  maxBid,
  unit,
  teamColor: _teamColor,
}: {
  isOpen: boolean;
  onClose: () => void;
  totalPurse: number;
  totalSpent: number;
  retainedSpend: number;
  purseRemaining: number;
  reserve: number | null;
  boosterTotal: number;
  maxBid: number | null;
  unit: ReturnType<typeof resolveAuctionUnit>;
  teamColor: string;
}) {
  const boughtSpend = Math.max(0, totalSpent - retainedSpend);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
          />

          {/* Modal / Sheet Panel */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative z-10 w-full sm:max-w-md bg-[#1e1845] border-t sm:border border-[#4a4478] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white max-h-[85vh] safe-bottom"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#4a4478] bg-[#18123a] flex-shrink-0">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <p className="font-display font-bold text-sm uppercase tracking-wider text-emerald-300">
                  Purse & Budget Breakdown
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-[#a8a0c4] hover:text-white hover:bg-[#3d3670] transition-colors"
                aria-label="Close breakdown"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 overflow-y-auto min-h-0 [-webkit-overflow-scrolling:touch]">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-[#2a2458] border border-[#4a4478]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">Purse Left</p>
                  <p className="font-display font-black text-xl text-emerald-400 mt-0.5">
                    {formatIndianRupee(purseRemaining, unit)}
                  </p>
                  <p className="text-[10px] text-[#6b6490] mt-0.5">Available for bids</p>
                </div>
                <div className="p-3 rounded-xl bg-[#2a2458] border border-[#4a4478]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">Max Bid Limit</p>
                  <p className="font-display font-black text-xl text-amber-400 mt-0.5">
                    {maxBid != null ? formatIndianRupee(maxBid, unit) : "—"}
                  </p>
                  <p className="text-[10px] text-[#6b6490] mt-0.5">Single-player ceiling</p>
                </div>
              </div>

              <div className="divide-y divide-[#4a4478]/70 rounded-xl bg-[#2a2458]/70 border border-[#4a4478] px-3.5 py-1 text-xs">
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#a8a0c4]">Total Purse Capacity</span>
                  <span className="font-bold text-white tabular-nums">{formatIndianRupee(totalPurse, unit)}</span>
                </div>
                {boosterTotal > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-amber-400 font-semibold">Active Purse Boosters</span>
                    <span className="font-bold text-amber-300 tabular-nums">+{formatIndianRupee(boosterTotal, unit)}</span>
                  </div>
                )}
                {retainedSpend > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[#a8a0c4]">Retained Players Spend</span>
                    <span className="font-bold text-white tabular-nums">{formatIndianRupee(retainedSpend, unit)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#a8a0c4]">Auction Bought Spend</span>
                  <span className="font-bold text-white tabular-nums">{formatIndianRupee(boughtSpend, unit)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#a8a0c4] font-semibold">Total Spent</span>
                  <span className="font-bold text-rose-300 tabular-nums">{formatIndianRupee(totalSpent, unit)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-[#a8a0c4]">Reserve for Required Slots</span>
                  <span className="font-bold text-amber-200 tabular-nums">
                    {reserve != null ? formatIndianRupee(reserve, unit) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#4a4478] bg-[#18123a] flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#3d3670] hover:bg-[#4a4478] text-white font-bold text-xs uppercase tracking-wider transition-colors active:scale-95"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
  biddingActive = false,
  collapseSignal = 0,
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
    maxAllowedBid: number;
  } | null;
  biddingActive?: boolean;
  collapseSignal?: number;
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

  const footerPurse = resolveOwnerLiveBidFooterPurse(teamPurse, team, purseOverride);
  const totalPurse = footerPurse.totalPurse;
  const totalSpent = footerPurse.totalSpent;
  const purseRemaining = footerPurse.purseRemaining;
  const reserve = footerPurse.reservePurse;
  const boosterTotal = footerPurse.boosterTotal;
  const maxBid = footerPurse.maxAllowedBid;

  const syncBoostValues = highlightBoost && purseOverride != null;
  const fmtFooter = (amount: number, synced = false) =>
    synced && syncBoostValues
      ? formatIndianRupee(amount, unit)
      : formatShortIndianRupee(amount, unit);
  const fmtOrDash = (amount: number | null, synced = false) =>
    amount == null ? "—" : fmtFooter(amount, synced);

  const valueClass =
    tier === "mobile" ? "text-sm sm:text-base" : tier === "tablet" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl";
  const labelClass = tier === "mobile" ? "text-[9px] sm:text-[10px] mt-1" : "text-[10px] sm:text-xs mt-1.5";
  const cellPad = tier === "mobile" ? "px-0.5 py-2" : "px-1 py-2.5";

  const items = useMemo(() => {
    const teamNum = teamColor;
    const bidwarNum = (active = true) => (active ? BIDWAR_AMBER : "#a8a0c4");

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
        label: "Purse Left",
        value: fmtFooter(purseRemaining, true),
        accent: teamNum,
        pulseOnBoost: true,
      },
      {
        key: "reserve",
        label: "Reserve",
        value: fmtOrDash(reserve),
        accent: bidwarNum(reserve != null && reserve > 0),
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
      value: fmtOrDash(maxBid, true),
      accent: teamNum,
      pulseOnBoost: true,
    });

    return cols;
  }, [
    tier,
    totalPurse,
    retainedSpend,
    totalSpent,
    purseRemaining,
    reserve,
    boosterTotal,
    maxBid,
    teamColor,
    unit,
    syncBoostValues,
  ]);

  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    if (biddingActive || collapseSignal > 0) {
      setShowBreakdown(false);
    }
  }, [biddingActive, collapseSignal]);

  if (tier === "mobile") {
    return (
      <>
        <div
          onClick={() => setShowBreakdown(true)}
          className={`grid grid-cols-3 divide-x divide-[#4a4478] transition-all rounded-xl border border-[#4a4478]/80 bg-[#251f4f]/90 py-1.5 px-0.5 cursor-pointer active:scale-[0.99] select-none ${
            highlightBoost ? "ring-2 ring-amber-400/70" : ""
          }`}
          style={highlightBoost ? { boxShadow: `0 0 24px ${BIDWAR_AMBER}40` } : undefined}
          title="Tap to view purse breakdown"
        >
          {/* Pillar 1: Purse Left */}
          <div className="text-center min-w-0 px-1 py-0.5">
            <motion.p
              animate={highlightBoost ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={{ duration: 0.55, repeat: highlightBoost ? 2 : 0 }}
              className="font-display font-black text-sm sm:text-base leading-none truncate text-emerald-400"
            >
              {fmtFooter(purseRemaining, true)}
            </motion.p>
            <p className="text-[#a8a0c4] font-bold uppercase tracking-wider text-[9px] mt-1">
              Purse Left
            </p>
          </div>

          {/* Pillar 2: Max Bid */}
          <div className="text-center min-w-0 px-1 py-0.5">
            <motion.p
              animate={highlightBoost ? { scale: [1, 1.1, 1] } : { scale: 1 }}
              transition={{ duration: 0.55, repeat: highlightBoost ? 2 : 0 }}
              className="font-display font-black text-sm sm:text-base leading-none truncate"
              style={{ color: BIDWAR_AMBER }}
            >
              {fmtOrDash(maxBid, true)}
            </motion.p>
            <p className="text-[#a8a0c4] font-bold uppercase tracking-wider text-[9px] mt-1">
              Max Bid
            </p>
          </div>

          {/* Pillar 3: Spent & Breakdown */}
          <div className="text-center min-w-0 px-1 py-0.5 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1 font-display font-black text-sm sm:text-base leading-none text-white max-w-full">
              <span className="truncate">{fmtFooter(totalSpent)}</span>
              <Info className="w-3 h-3 text-amber-400/90 flex-shrink-0" />
            </div>
            <p className="text-[#a8a0c4] font-bold uppercase tracking-wider text-[9px] mt-1">
              Spent • Info
            </p>
          </div>
        </div>

        <PurseBreakdownModal
          isOpen={showBreakdown}
          onClose={() => setShowBreakdown(false)}
          totalPurse={totalPurse}
          totalSpent={totalSpent}
          retainedSpend={retainedSpend}
          purseRemaining={purseRemaining}
          reserve={reserve ?? null}
          boosterTotal={boosterTotal}
          maxBid={maxBid ?? null}
          unit={unit}
          teamColor={teamColor}
        />
      </>
    );
  }

  return (
    <div
      className={`grid divide-x divide-[#4a4478] transition-shadow duration-500 ${highlightBoost ? "rounded-xl ring-2 ring-amber-400/70" : ""}`}
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
          <p className={`text-[#a8a0c4] font-bold uppercase tracking-wide leading-tight ${labelClass}`}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function BidAmount({
  amount,
  isLeading,
  teamColor,
  leadingTeam,
  unit,
  tier,
  hasPlayer = true,
}: {
  amount: number;
  isLeading: boolean;
  teamColor: string;
  leadingTeam?: string | null;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
  hasPlayer?: boolean;
}) {
  if (!hasPlayer) {
    return (
      <div className="text-center py-2 px-4 rounded-xl bg-[#201a47]/60 border border-[#4a4478]/70 max-w-xs mx-auto my-1 shadow-inner">
        <p className="text-[10px] font-bold text-[#a8a0c4] uppercase tracking-widest">Stage Status</p>
        <p className="font-display font-bold text-sm text-[#e2dff5] mt-0.5">Awaiting Next Lot Draw</p>
      </div>
    );
  }
  const amountClass = tier === "mobile" ? "text-4xl sm:text-5xl" : tier === "tablet" ? "text-6xl" : "text-7xl";
  return (
    <div className="text-center py-1 sm:py-2">
      <p className={`font-bold text-[#a8a0c4] uppercase tracking-widest mb-1.5 sm:mb-2 ${tier === "mobile" ? "text-[11px]" : "text-sm"}`}>
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
        <p className="text-sm sm:text-base text-[#a8a0c4] mt-1 sm:mt-2">
          Leading: <span className="font-bold text-white text-base sm:text-lg">{leadingTeam}</span>
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
  ownerBiddingEnabled?: boolean;
  isPaused: boolean;
  isActive: boolean;
  isTrialRestricted: boolean;
  maxSquadReached: boolean;
  categoryLimitReached: boolean;
  categoryMax: number | null;
  categoryName: string | null | undefined;
  biddingEnabled: boolean;
  timerActive: boolean;
  hasTimer: boolean;
  maxAllowedBid: number;
  nextBidAmount: number;
  reservePurse: number;
  futureReservePurse: number;
  futureSlotsRequired: number;
  slotsRequired: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
}): BidDisabledHint {
  if (params.ownerBiddingEnabled === false) {
    return {
      headline: "BIDDING DISABLED",
      subline: "Online bidding is disabled by the organizer.",
    };
  }
  if (params.isTrialRestricted) {
    return {
      headline: "Trial locked",
      subline: "Only the first 2 teams can bid — ask admin to activate the live license",
    };
  }
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
  if (params.maxAllowedBid < params.nextBidAmount) {
    const shortfall = params.nextBidAmount - params.maxAllowedBid;
    if (params.futureReservePurse > 0) {
      return {
        headline: `${formatShortIndianRupee(shortfall, params.unit)} short for this bid`,
        subline: `${formatShortIndianRupee(params.maxAllowedBid, params.unit)} max bid · ${formatShortIndianRupee(params.futureReservePurse, params.unit)} held for ${params.futureSlotsRequired} slot${params.futureSlotsRequired !== 1 ? "s" : ""} after purchase`,
      };
    }
    return {
      headline: `${formatShortIndianRupee(shortfall, params.unit)} short for this bid`,
      subline: `${formatShortIndianRupee(params.maxAllowedBid, params.unit)} max bid · needs ${formatShortIndianRupee(params.nextBidAmount, params.unit)}`,
    };
  }
  return { headline: "Bid unavailable", subline: "Try refreshing or wait a moment" };
}

function BidDisabledMessage({ hint, compact }: { hint: BidDisabledHint; compact?: boolean }) {
  return (
    <div
      className={`text-center rounded-xl border border-[#4a4478] bg-[#2a2458] ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}`}
    >
      <p className={`font-semibold text-[#d4d4d8] ${compact ? "text-xs" : "text-sm"}`}>{hint.headline}</p>
      {hint.subline && (
        <p className={`text-[#a8a0c4] mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>{hint.subline}</p>
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

// ── Tactical AI Intelligence Components (P2) ──────────────────────────────────

interface TacticalWarRoomProps {
  walkAwayPrice: number;
  marginStatus: "safe" | "tight" | "limit";
  rivalOutbidCount: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
  aiRadarEnabled?: boolean;
  onToggleAiRadar?: () => void;
  bluffAlert?: BluffRadarResult | null;
}

function TacticalWarRoomStrip({
  walkAwayPrice,
  marginStatus,
  rivalOutbidCount,
  unit,
  tier,
  aiRadarEnabled = true,
  onToggleAiRadar,
  bluffAlert,
}: TacticalWarRoomProps) {
  if (aiRadarEnabled === false) {
    return (
      <div className="w-full flex items-center justify-center py-0.5 select-none">
        <button
          type="button"
          onClick={onToggleAiRadar}
          className="h-6 min-h-[24px] px-3 rounded-full bg-[#1b1542]/90 hover:bg-[#251d5c] border border-[#4a4478] text-[10px] font-bold text-[#a8a0c4] hover:text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
          title="AI Radar collapsed. Tap to expand full AI advice."
        >
          <span>👁️ AI Radar: OFF</span>
          <span className="text-[#6b6490] font-normal">· Tap to expand</span>
        </button>
      </div>
    );
  }

  const marginConfig = {
    safe: {
      label: "Safe Margin",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      dotClass: "bg-emerald-400",
      ringClass: "ring-emerald-500/30",
    },
    tight: {
      label: "Tight Margin",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      dotClass: "bg-amber-400",
      ringClass: "ring-amber-500/30",
    },
    limit: {
      label: "Quota Limit Reached",
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      dotClass: "bg-rose-400",
      ringClass: "ring-rose-500/30",
    },
  }[marginStatus];

  const isMobile = tier === "mobile";

  return (
    <div className="w-full flex flex-col gap-1.5 select-none">
      <div className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-2xl bg-[#1b1542] border border-[#4a4478] shadow-xs">
        {/* Walk-Away Price Pill with Ring Indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${marginConfig.dotClass} animate-pulse shrink-0 ring-4 ${marginConfig.ringClass}`} />
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-wrap">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#a8a0c4] shrink-0">
              Walk-Away:
            </span>
            <span className="font-mono font-black text-white text-xs sm:text-sm shrink-0">
              {formatIndianRupee(walkAwayPrice, unit)}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${marginConfig.badgeClass} shrink-0`}>
              {marginConfig.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Rival Outbid Capacity Radar */}
          <div className="flex items-center gap-1 shrink-0 bg-[#241c56] border border-[#4a4478] px-2 py-0.5 rounded-xl text-[10px]">
            <Radar className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="font-semibold text-[#a8a0c4] whitespace-nowrap">
              <strong className="text-white font-mono font-bold mr-0.5">{rivalOutbidCount}</strong>
              {isMobile ? "outbid" : rivalOutbidCount === 1 ? "rival can outbid" : "rivals can outbid"}
            </span>
          </div>

          {/* 1-Click AI Radar Toggle to collapse */}
          {onToggleAiRadar && (
            <button
              type="button"
              onClick={onToggleAiRadar}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#241c56] hover:bg-[#322774] border border-[#4a4478] text-[9px] font-bold text-amber-300 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Click to collapse AI advice into a 24px micro-pill"
            >
              <span>👁️ AI Radar: ON</span>
            </button>
          )}
        </div>
      </div>

      {/* Rival Bluff / Price-Bumping Alert */}
      {bluffAlert?.isBluffRisk && (
        <div
          className={`w-full px-2.5 py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
            bluffAlert.severity === "high"
              ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
              : "bg-amber-500/20 border-amber-500/50 text-amber-200"
          }`}
        >
          <ShieldAlert
            className={`w-4 h-4 shrink-0 ${
              bluffAlert.severity === "high" ? "text-rose-400 animate-pulse" : "text-amber-400"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider">
                {bluffAlert.headline}
              </span>
              <span className="text-[9px] opacity-75 font-mono">
                ({bluffAlert.rivalRoleCount} {bluffAlert.normalizedRole}s held)
              </span>
            </div>
            <p className="text-[10px] leading-tight line-clamp-1 opacity-90 mt-0.5">
              {bluffAlert.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface LivePursePreservationSimulatorProps {
  nextBidAmount: number;
  postBidPurse: number;
  futureSlots: number;
  avgPerPlayer: number;
  unit: ReturnType<typeof resolveAuctionUnit>;
  tier: DeviceTier;
  aiRadarEnabled?: boolean;
}

function LivePursePreservationSimulator({
  nextBidAmount,
  postBidPurse,
  futureSlots,
  avgPerPlayer,
  unit,
  tier,
  aiRadarEnabled = true,
}: LivePursePreservationSimulatorProps) {
  if (aiRadarEnabled === false) return null;
  const isMobile = tier === "mobile";
  return (
    <div className="w-full flex items-center justify-center text-center px-2 py-1 rounded-xl bg-black/40 border border-white/10 select-none">
      <p className={`font-mono font-medium ${isMobile ? "text-[10px]" : "text-xs"} text-[#d4d4d8] leading-tight`}>
        If you bid <span className="font-bold text-amber-300">{formatIndianRupee(nextBidAmount, unit)}</span>:{" "}
        <span className="font-bold text-emerald-400">{formatIndianRupee(postBidPurse, unit)}</span> left
        {futureSlots > 0 ? (
          <>
            {" "}for <span className="font-bold text-white">{futureSlots}</span> slot{futureSlots > 1 ? "s" : ""}{" "}
            <span className="text-[#a8a0c4]">(Must average <strong className="text-amber-300 font-bold">{formatIndianRupee(avgPerPlayer, unit)}</strong>/player)</span>
          </>
        ) : (
          <span className="text-emerald-300 font-semibold"> (Quota fulfilled)</span>
        )}
      </p>
    </div>
  );
}

function BidButton({
  ownerBiddingEnabled = true,
  canBid, isLeading, timerExpired, timerActive, hasPlayer, isActive, isPaused, isIdle, isOnBreak,
  hasLiveCountdown, breakMins, breakSecs, breakMessage, breakLabel,
  bidding, bidFeedback, nextBidAmount, teamColor, onBid, layout, tier, unit, dock = false,
}: {
  ownerBiddingEnabled?: boolean;
  canBid: boolean;
  isLeading: boolean;
  timerExpired: boolean;
  timerActive: boolean;
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
    ? tier === "mobile" ? "h-20 sm:h-24" : tier === "tablet" ? "h-40" : "h-36"
    : isSplit
      ? tier === "mobile" ? "min-h-[42vh] h-full" : tier === "tablet" ? "min-h-[44vh] h-full" : "min-h-[40vh] h-full"
      : tier === "mobile" ? "h-full min-h-[22vh]" : "h-full min-h-[18vh]";
  const dockIdleH = dock
    ? tier === "mobile" ? "h-20 sm:h-24" : tier === "tablet" ? "h-40" : "h-36"
    : isSplit ? "h-16" : "h-14";
  const dockStatusH = tier === "mobile" ? "h-20 sm:h-24" : tier === "tablet" ? "h-40" : "h-36";
  const bidFontSize = dock
    ? tier === "mobile"
      ? "clamp(1.5rem, 6.5vw, 2.25rem)"
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
      ? tier === "mobile" ? "text-3xl" : "text-5xl"
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
        className={`w-full ${dock ? dockStatusH : buttonH} rounded-3xl border-4 flex flex-col items-center justify-center ${dock && tier === "mobile" ? "gap-1 px-3" : "gap-4 px-6"}`}
        style={{ borderColor: `${teamColor}80`, backgroundColor: `${teamColor}18` }}
      >
        <Trophy className={dock ? (tier === "mobile" ? "w-6 h-6" : "w-10 h-10") : "w-16 h-16"} style={{ color: teamColor }} />
        <div className="text-center">
          <p className={`font-display font-black ${dock ? (tier === "mobile" ? "text-lg" : "text-xl") : "text-3xl"}`} style={{ color: teamColor }}>HIGHEST BIDDER</p>
          {!dock && <p className="text-base text-[#a8a0c4] mt-2">Waiting for other teams...</p>}
        </div>
      </motion.div>
    );
  }

  if (ownerBiddingEnabled === false) {
    return (
      <motion.div
        key="owner-bidding-disabled"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`w-full ${dock ? dockStatusH : buttonH} rounded-3xl border-2 border-red-500/30 bg-red-500/10 flex flex-col items-center justify-center ${dock && tier === "mobile" ? "gap-1 px-2" : "gap-2 px-4"} text-center`}
      >
        <XCircle className={`${dock ? (tier === "mobile" ? "w-6 h-6" : "w-8 h-8") : "w-12 h-12"} text-red-400`} />
        <div>
          <p className={`font-display font-black text-red-400 ${dock ? (tier === "mobile" ? "text-sm" : "text-lg") : "text-2xl"}`}>
            BIDDING DISABLED
          </p>
          <p className={`text-[#a8a0c4] font-medium ${dock ? (tier === "mobile" ? "text-[10px]" : "text-xs") : "text-sm"} mt-0.5`}>
            Online bidding is disabled by the organizer.
          </p>
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
        className={`w-full ${dock ? dockStatusH : buttonH} rounded-3xl border-2 border-red-500/30 bg-red-500/10 flex flex-col items-center justify-center ${dock && tier === "mobile" ? "gap-1.5 px-3" : "gap-4 px-6"}`}
      >
        <AlertTriangle className={`${dock ? (tier === "mobile" ? "w-6 h-6" : "w-10 h-10") : "w-14 h-14"} text-red-400`} />
        <div className="text-center">
          <p className={`font-display font-black text-red-400 ${dock ? (tier === "mobile" ? "text-lg" : "text-xl") : "text-3xl"}`}>BIDDING CLOSED</p>
          {!dock && <p className="text-base text-[#a8a0c4] mt-2">Timer expired — awaiting operator</p>}
        </div>
      </motion.div>
    );
  }

  if (isActive && hasPlayer && !timerActive && !isLeading && !isOnBreak) {
    const idleMessage = "Waiting for operator to open bidding";
    if (dock) {
      return (
        <motion.div
          key="timer-waiting-dock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full ${dockIdleH} rounded-3xl border-2 border-dashed border-[#3d3670] bg-[#2a2458] flex flex-col items-center justify-center gap-0.5 px-4`}
        >
          <p className={`font-display font-black text-[#6b6490] ${tier === "mobile" ? "text-2xl" : tier === "tablet" ? "text-[2rem]" : "text-2xl"}`}>BID</p>
          <p className="text-[11px] text-[#a8a0c4] font-medium text-center">{idleMessage}</p>
        </motion.div>
      );
    }
    return (
      <motion.div
        key="timer-waiting"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`w-full ${buttonH} rounded-3xl border border-dashed border-[#3d3670] bg-[#2a2458] flex flex-col items-center justify-center gap-3`}
      >
        <div className="w-10 h-10 border-2 border-[#3d3670] border-t-[#a8a0c4] rounded-full animate-spin" />
        <p className="text-base text-[#a8a0c4] font-semibold">{idleMessage}</p>
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
          className={`w-full ${dockIdleH} rounded-3xl border-2 border-dashed border-[#3d3670] bg-[#2a2458] flex flex-col items-center justify-center gap-0.5 px-4`}
        >
          <p className={`font-display font-black text-[#6b6490] ${tier === "mobile" ? "text-2xl" : tier === "tablet" ? "text-[2rem]" : "text-2xl"}`}>BID</p>
          <p className="text-[11px] text-[#a8a0c4] font-medium text-center">{idleMessage}</p>
        </motion.div>
      );
    }
    return (
      <motion.div
        key="waiting"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`w-full ${buttonH} rounded-3xl border border-dashed border-[#3d3670] bg-[#2a2458] flex flex-col items-center justify-center gap-3`}
      >
        <div className="w-10 h-10 border-2 border-[#3d3670] border-t-[#a8a0c4] rounded-full animate-spin" />
        <p className="text-base text-[#a8a0c4] font-semibold">
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
      className={`w-full ${buttonH} rounded-3xl font-display font-black text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all select-none active:scale-[0.98]`}
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
        <div className="flex flex-col items-center leading-none gap-1 sm:gap-2">
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
        <p className="text-sm text-[#a8a0c4] mt-1">Player goes to UNSOLD Pool</p>
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
      className="flex items-center gap-5 p-5 rounded-2xl border bg-[#2a2458] relative overflow-hidden"
      style={{ borderColor: "rgba(239,68,68,0.35)" }}
    >
      <PlayerAvatar
        name={name}
        photoUrl={photoUrl}
        accentColor="#ef4444"
        grayscale={true}
        className="w-20 h-28 rounded-xl"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest mb-1 text-red-400">Unsold</p>
        <h2 className="font-display font-bold text-2xl leading-tight text-white truncate">{name}</h2>
        <p className="text-sm text-[#a8a0c4] mt-1">Player goes to UNSOLD Pool</p>
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
function LastSoldPlayerCard({
  player,
  teamColor,
  wonByThisTeam,
  unit,
  planBPivot,
  onViewWarRoom,
}: {
  player: NonNullable<AuctionState["lastSoldPlayer"]>;
  teamColor: string;
  wonByThisTeam: boolean;
  unit: ReturnType<typeof resolveAuctionUnit>;
  planBPivot?: PlanBPivotResult | null;
  onViewWarRoom?: () => void;
}) {
  const soldColor = wonByThisTeam ? teamColor : "#22c55e";
  return (
    <motion.div
      key="last-sold"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl border bg-[#2a2458] relative overflow-hidden"
      style={{ borderColor: `${soldColor}40` }}
    >
      <div className="flex items-center gap-4 sm:gap-5">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          accentColor={wonByThisTeam ? "#10b981" : teamColor}
          className="w-16 h-22 sm:w-20 sm:h-28 rounded-xl shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5" style={{ color: wonByThisTeam ? "#10b981" : soldColor }}>
            {wonByThisTeam ? (
              <>
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-black">YOUR TEAM WON!</span>
              </>
            ) : (
              "LAST SOLD"
            )}
          </p>
          <h2 className="font-display font-bold text-xl sm:text-2xl leading-tight text-white truncate">{player.name}</h2>
          {player.role && <p className="text-xs sm:text-sm text-[#a8a0c4] capitalize mt-0.5">{player.role}</p>}
          {!wonByThisTeam && player.soldToTeamName && (
            <p className="text-xs sm:text-sm text-[#a8a0c4] mt-0.5">
              Won by <span className="text-white font-bold">{player.soldToTeamName}</span>
            </p>
          )}
        </div>
        {player.soldAmount != null && (
          <div className="text-right flex-shrink-0">
            <p className="font-display font-black text-lg sm:text-xl" style={{ color: soldColor }}>
              {formatIndianRupee(player.soldAmount, unit)}
            </p>
            <div
              className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-lg mt-1 border text-[11px] sm:text-xs font-black uppercase tracking-wider"
              style={{ backgroundColor: `${soldColor}20`, borderColor: `${soldColor}40`, color: soldColor }}
            >
              SOLD
            </div>
          </div>
        )}
      </div>

      {/* Plan-B Pivot Active Notice */}
      {!wonByThisTeam && planBPivot?.isTargetLost && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-left space-y-1">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{planBPivot.headline}</span>
            </span>
            {onViewWarRoom && (
              <button
                type="button"
                onClick={onViewWarRoom}
                className="px-2 py-0.5 rounded bg-amber-400 text-black text-[9px] font-black shrink-0 hover:bg-amber-300 transition-all active:scale-95 cursor-pointer"
              >
                Open War Room
              </button>
            )}
          </div>
          <p className="text-xs text-[#e4e4e7] leading-relaxed">{planBPivot.message}</p>
          <p className="text-[10px] text-amber-300 font-semibold">💡 {planBPivot.recommendedAction}</p>
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
        ? "h-7 sm:h-8 w-auto max-w-[min(260px,75vw)]"
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
        <p className="text-sm text-[#a8a0c4] mt-2">
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
          <p className="text-[11px] text-[#a8a0c4] mt-1">Purse bar below shows your team only</p>
        ) : null}

        <motion.p
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.45, repeat: 2 }}
          className={`font-display font-black text-white mt-5 ${amountClass}`}
        >
          +{fmt(banner.amount)}
        </motion.p>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
          <div className="rounded-xl border border-[#4a4478] bg-[#141416] px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[#a8a0c4]">Before</p>
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
    const baseMaxAllowed =
      teamPurse?.maxAllowedBid ??
      Math.max(0, banner.previousCapacity - (teamPurse?.purseUsed ?? 0));
    return {
      totalPurse: banner.newCapacity,
      boosterTotal: banner.newCapacity - originalPurse,
      maxAllowedBid: baseMaxAllowed + capacityDelta,
    };
  }, [banner, originalPurse, teamPurse?.maxAllowedBid, teamPurse?.purseUsed]);

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
  danger = false,
  children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  blocked?: boolean;
  compact?: boolean;
  danger?: boolean;
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
        compact ? "min-w-[34px] px-1 py-1" : "min-w-[44px] px-1.5 py-1.5"
      } ${
        blocked
          ? "border-[#4a4478] bg-[#141416] text-[#6b6490] opacity-50 cursor-not-allowed"
          : danger
            ? "border-red-500/40 bg-red-500/10 text-red-300 hover:text-white hover:border-red-500/70 hover:bg-red-500/20 shadow-sm"
            : "border-[#3d3670] bg-[#2a2458] text-[#d4d4d8] hover:text-white hover:border-[#6b6490] hover:bg-[#4a4478] shadow-sm"
      }`}
    >
      {children}
      <span className={`font-bold uppercase tracking-wide leading-none ${compact ? "text-[7.5px]" : "text-[8px]"}`}>
        {label}
      </span>
    </button>
  );
}

function resolveHeaderToolbar(_team: Team, _teamColor: string, actionCompact: boolean) {
  return {
    teamLogoClass: actionCompact ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl",
    teamNameClass: actionCompact ? "text-xs sm:text-sm" : "text-base",
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
  onViewWarRoom,
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
  onViewWarRoom?: () => void;
  onLeave: () => void;
  layout: "stacked" | "split";
  tier: DeviceTier;
  iconVersion?: number;
}) {
  const showTournamentLine = layout === "stacked" && tier !== "mobile";
  const actionCompact = tier !== "laptop";
  const { teamLogoClass, teamNameClass } = resolveHeaderToolbar(team, teamColor, actionCompact);

  const teamBlock = (
    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
      <TeamLogo
        logoUrl={team.logoUrl}
        shortCode={team.shortCode}
        teamName={team.name}
        teamColor={teamColor}
        className={`${teamLogoClass} flex-shrink-0`}
        textClassName={actionCompact ? "text-xs" : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <p className={`font-display font-bold leading-none truncate ${teamNameClass}`} style={{ color: teamColor }}>
            {team.name}
          </p>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
            isActive
              ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              : isPaused
                ? "bg-amber-500/20 border-amber-500/35 text-amber-400"
                : "bg-[#4a4478] border-[#5d568e] text-[#a8a0c4]"
          }`}>
            {isActive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
            )}
            <span className="text-[9px] font-black uppercase tracking-wider">{statusLabel}</span>
            {isActive && (
              <span className="inline-flex items-end gap-[2px] h-2.5 ml-0.5">
                <motion.span
                  animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                  className="w-[2px] bg-emerald-400 rounded-full"
                />
                <motion.span
                  animate={{ height: ["80%", "35%", "100%", "50%", "80%"] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                  className="w-[2px] bg-emerald-400 rounded-full"
                />
                <motion.span
                  animate={{ height: ["40%", "90%", "25%", "95%", "40%"] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className="w-[2px] bg-emerald-400 rounded-full"
                />
              </span>
            )}
          </div>
          <AuctionFeedIndicator
            feedState={feed.state}
            secondsSinceLastActivity={feed.secondsSinceLastActivity}
            className="w-3.5 h-3.5 flex-shrink-0"
          />
        </div>
        {showTournamentLine && (
          <p className="text-xs text-[#a8a0c4] mt-0.5 truncate">{tournament?.name || "Auction"}</p>
        )}
      </div>
    </div>
  );

  const actionBlock = (
    <div className="flex items-center justify-end gap-1 sm:gap-2 min-w-0 shrink-0">
      <HeaderActionButton onClick={onSync} title="Sync auction data" label="Sync" compact={actionCompact}>
        <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${syncing ? "animate-spin" : ""}`} />
      </HeaderActionButton>
      <HeaderActionButton onClick={onLeave} title="Leave auction" label="Leave" compact={actionCompact} danger>
        <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
      </HeaderActionButton>
    </div>
  );

  if (layout === "stacked") {
    return (
      <div className="border-b border-[#4a4478] flex-shrink-0">
        <div className="flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 bg-[#18123a] border-b border-[#4a4478]/70">
          <HeaderBrandLogo
            logos={logos}
            brandName={brandName}
            layout={layout}
            tier={tier}
            iconVersion={iconVersion}
          />
        </div>
        <div className="flex items-center justify-between gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 min-h-[44px] sm:min-h-[50px]">
          {teamBlock}
          {actionBlock}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 sm:px-4 py-2 border-b border-[#4a4478] flex-shrink-0">
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
  onViewWarRoom,
  navToast, onNavToastDismiss, onSignOut, onSync, isSyncError,
}: Props) {
  const { layout, tier } = useLiveBidLayout();
  const isSplit = layout === "split";

  // Target shortlist detection & AI Radar toggle preference
  const { isTarget, targetIds } = useOwnerTargets(tournamentId, teamId);
  const isTargetPlayer = isTarget(state?.currentPlayer?.id ?? 0);
  const [aiRadarEnabled, toggleAiRadar] = useAiRadarPreference();
  const feed        = useAuctionConnectionState(
    connectionStatus,
    tournamentId,
    state?.lastAuctionActivityAt,
  );
  const { brandName, logos, poweredByText, miniBrandText, showPoweredBy, iconVersion } = useBranding();

  const {
    bidding,
    bidFeedback,
    runBid,
  } = useBidLifecycle({ tournamentId, teamId });

  const [showSignOutConfirm, setShowSignOutConfirm]  = useState(false);
  const [showPlayerBioDrawer, setShowPlayerBioDrawer] = useState(false);
  const [collapseSignal, setCollapseSignal]           = useState(0);
  const [syncing,            setSyncing]             = useState(false);
  const [syncFailed,         setSyncFailed]          = useState(false);
  const syncAttempted = useRef(false);

  const prevTimerActiveRef = useRef(false);
  const prevBidRef = useRef<number | null | undefined>(undefined);
  const prevPlayerIdRef = useRef<number | null | undefined>(undefined);
  const prevStatusRef = useRef<string | null | undefined>(undefined);

  const teamColor = team.color || "#F59E0B";
  const unit = resolveAuctionUnit(tournament?.auctionUnit);
  const fmt = (amount: number | null | undefined) => formatIndianRupee(amount, unit);
  const currentBidTeamId = Number(state?.currentBidTeamId);
  const isLeading = Number.isFinite(currentBidTeamId) && currentBidTeamId === teamId;
  const isActive  = state?.status === "active";
  const hasPlayer = !!state?.currentPlayer;
  const navBlocked = isPlayerOnAuctionStage(state);

  const expired     = useTimerExpired(state?.timerEndsAt);
  const timerActive = !!state?.timerEndsAt && !expired;

  const maxAllowedBid   = teamPurse?.maxAllowedBid ?? (team.purse - (team.purseUsed || 0));
  const reservePurse    = teamPurse?.reservePurse ?? 0;
  const futureReservePurse = teamPurse?.futureReservePurse ?? reservePurse;
  const playersBought   = teamPurse?.playersBought ?? 0;
  const maxSquad        = teamPurse?.maximumSquadSize ?? 0;
  const slotsRequired   = teamPurse?.slotsRequired ?? 0;
  const futureSlotsRequired = teamPurse?.futureSlotsRequired ?? slotsRequired;
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

  const isTrialRestricted = !isTeamEligibleForTrialAuction(teamId, {
    licenseStatus: state?.licenseStatus,
    trialTeamIds: state?.trialTeamIds,
  });

  const ownerBiddingEnabled =
    state?.ownerBiddingEnabled ?? (tournament as any)?.ownerBiddingEnabled ?? true;

  const canBid =
    isActive && hasPlayer && timerActive && !isLeading && !isOnBreak &&
    ownerBiddingEnabled &&
    maxAllowedBid >= nextBidAmount &&
    (team.isBiddingEnabled ?? true) &&
    !maxSquadReached && !categoryLimitReached &&
    !isTrialRestricted;

  // ── Tactical AI Intelligence (P2) ──────────────────────────────────────────
  const purseRemaining = teamPurse?.purseRemaining ?? Math.max(0, team.purse - (team.purseUsed || 0));
  const minSquad = teamPurse?.minimumSquadSize ?? 0;
  const minBasePrice =
    teamPurse?.lowestBasePrice && teamPurse.lowestBasePrice > 0
      ? teamPurse.lowestBasePrice
      : ((tournament as any)?.minBid && (tournament as any).minBid > 0 ? (tournament as any).minBid : 100000);
  const remainingMandatorySlots = Math.max(0, minSquad - playersBought);
  const futureMandatoryReserve = Math.max(0, remainingMandatorySlots - 1) * minBasePrice;
  const rawWalkAway = Math.max(0, purseRemaining - futureMandatoryReserve);
  const walkAwayPrice =
    teamPurse?.maxAllowedBid !== undefined
      ? Math.min(rawWalkAway, teamPurse.maxAllowedBid)
      : rawWalkAway;

  const marginStatus: "safe" | "tight" | "limit" = useMemo(() => {
    if (walkAwayPrice <= 0 || nextBidAmount > walkAwayPrice) return "limit";
    if (nextBidAmount >= walkAwayPrice * 0.75) return "tight";
    return "safe";
  }, [walkAwayPrice, nextBidAmount]);

  const postBidPurse = Math.max(0, purseRemaining - nextBidAmount);
  const futureMandatorySlots = Math.max(0, remainingMandatorySlots - 1);
  const avgPerPlayerNeeded = futureMandatorySlots > 0 ? Math.round(postBidPurse / futureMandatorySlots) : 0;

  const { data: allTeamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: Boolean(tournamentId),
      refetchInterval: 5000,
    },
  });

  const rivalOutbidCount = useMemo(() => {
    const purseList = allTeamPurses ?? (state as any)?.teamPurses;
    if (!purseList || !Array.isArray(purseList)) return 0;
    const catMax = state?.currentCategoryMaxPlayers;
    const catCounts = state?.teamCategoryPlayerCounts;

    return purseList.filter((tp: TeamPurse) => {
      if (tp.teamId === teamId) return false;
      if (tp.maximumSquadSize != null && tp.maximumSquadSize > 0 && (tp.playersBought ?? 0) >= tp.maximumSquadSize) return false;
      const rivalMaxBid = tp.maxAllowedBid ?? tp.spendablePurse ?? tp.purseRemaining ?? 0;
      if (rivalMaxBid < nextBidAmount) return false;

      if (catMax != null && catMax > 0 && catCounts) {
        const rivalCatCount = catCounts[String(tp.teamId)] ?? 0;
        if (rivalCatCount >= catMax) return false;
      }
      return true;
    }).length;
  }, [allTeamPurses, (state as any)?.teamPurses, teamId, nextBidAmount, state?.currentCategoryMaxPlayers, state?.teamCategoryPlayerCounts]);

  const { data: allPlayersData } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: Boolean(tournamentId),
    },
  });

  const mySquadRoleCount = useMemo(() => {
    const role = state?.currentPlayer?.role;
    const catId = state?.currentPlayer?.categoryId;

    if (role && allPlayersData) {
      const targetRole = role.trim().toLowerCase();
      const mySoldOrRetained = allPlayersData.filter(
        (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained") && !p.isNonPlayingMember,
      );
      return mySoldOrRetained.filter((p) => p.role && p.role.trim().toLowerCase() === targetRole).length;
    }

    const catCounts = state?.teamCategoryPlayerCounts as Record<string, number> | null | undefined;
    if (catCounts && catCounts[String(teamId)] !== undefined) {
      return catCounts[String(teamId)] ?? 0;
    }

    if (catId != null && allPlayersData) {
      return allPlayersData.filter(
        (p) => p.teamId === teamId && (p as any).categoryId === catId && (p.status === "sold" || p.status === "retained") && !p.isNonPlayingMember,
      ).length;
    }

    return null;
  }, [allPlayersData, teamId, state?.currentPlayer?.role, state?.currentPlayer?.categoryId, state?.teamCategoryPlayerCounts]);

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

  // ── Auto-collapse any open drawers/popups when bidding starts or advances ──
  useEffect(() => {
    const timerStarted = !prevTimerActiveRef.current && timerActive;
    const bidChanged = prevBidRef.current !== undefined && state?.currentBid !== prevBidRef.current;
    const playerChanged = prevPlayerIdRef.current !== undefined && state?.currentPlayer?.id !== prevPlayerIdRef.current;
    const statusBecameActive = prevStatusRef.current !== "active" && state?.status === "active";

    prevTimerActiveRef.current = timerActive;
    prevBidRef.current = state?.currentBid;
    prevPlayerIdRef.current = state?.currentPlayer?.id;
    prevStatusRef.current = state?.status;

    if (isActive && hasPlayer && (timerStarted || statusBecameActive || bidChanged || playerChanged)) {
      setShowPlayerBioDrawer(false);
      setCollapseSignal((s) => s + 1);
    }
  }, [timerActive, state?.currentBid, state?.currentPlayer?.id, state?.status, isActive, hasPlayer]);

  useEffect(() => {
    if (bidding) {
      setShowPlayerBioDrawer(false);
      setCollapseSignal((s) => s + 1);
    }
  }, [bidding]);

  async function handleBidTap() {
    if (isOnBreak || !canBid) return;
    setShowPlayerBioDrawer(false);
    setCollapseSignal((s) => s + 1);
    hapticBid();
    const result = await runBid(nextBidAmount, onBid, canBid && !isOnBreak);
    if (result === "blocked") return;
    if (result === "success") hapticSuccess();
    else if (result === "leading") hapticLeading();
    else hapticError();
  }

  // ── Disable-reason ──────────────────────────────────────────────────────────
  const isPaused = state?.status === "paused";
  const isIdle = state?.status === "idle";

  const bidDisabledHint =
    !isOnBreak && !canBid && !isLeading && !expired && hasPlayer
      ? getBidDisabledHint({
          ownerBiddingEnabled,
          isPaused,
          isActive,
          isTrialRestricted,
          maxSquadReached,
          categoryLimitReached,
          categoryMax,
          categoryName: state?.currentCategoryName,
          biddingEnabled: team.isBiddingEnabled ?? true,
          timerActive,
          hasTimer: !!state?.timerEndsAt,
          maxAllowedBid,
          nextBidAmount,
          reservePurse,
          futureReservePurse,
          futureSlotsRequired,
          slotsRequired,
          unit,
        })
      : null;

  const statusLabel =
    isTrialRestricted ? "TRIAL" :
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

  // ── Tactical Bluff & Plan-B AI Intelligence ──
  const bluffAlert = useMemo(() => {
    if (!hasPlayer || !state?.currentPlayer) return null;
    return computeBluffRadar({
      currentBidTeamId: state.currentBidTeamId,
      currentBidTeamName: state.currentBidTeamName,
      myTeamId: teamId,
      currentPlayerRole: state.currentPlayer.role,
      currentPlayerBasePrice: state.currentPlayer.basePrice,
      currentBidAmount: state.currentBid,
      sportName: tournament?.sport,
      allPlayers: allPlayersData ?? [],
      teamPurses: (allTeamPurses ?? (state as any)?.teamPurses) ?? [],
      walkAwayPrice,
    });
  }, [
    hasPlayer,
    state?.currentPlayer,
    state?.currentBidTeamId,
    state?.currentBidTeamName,
    state?.currentBid,
    teamId,
    tournament?.sport,
    allPlayersData,
    allTeamPurses,
    state,
    walkAwayPrice,
  ]);

  const planBPivot = useMemo(() => {
    if (!state?.lastSoldPlayer) return null;
    return computePlanBPivot({
      lastSoldPlayer: state.lastSoldPlayer,
      myTeamId: teamId,
      targetPlayerIds: targetIds,
      allPlayers: allPlayersData ?? [],
      sportName: tournament?.sport,
      purseRemaining: teamPurse?.purseRemaining ?? team.purse,
      remainingMandatorySlots: futureMandatorySlots,
      formatCurrencyFn: fmt,
    });
  }, [
    state?.lastSoldPlayer,
    teamId,
    targetIds,
    allPlayersData,
    tournament?.sport,
    teamPurse?.purseRemaining,
    team.purse,
    futureMandatorySlots,
    fmt,
  ]);

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
        className="auction-surface relative h-full flex flex-col bg-background overflow-hidden safe-top safe-bottom select-none"
        style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 55%), #1e1845` }}
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
          onViewWarRoom={onViewWarRoom}
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
                tournamentId={tournamentId}
                features={(tournament as any)?.featuresJson ?? (tournament as any)?.features}
                squadRoleCount={mySquadRoleCount}
                onOpenBio={() => setShowPlayerBioDrawer(true)}
                isTargetPlayer={isTargetPlayer}
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
                planBPivot={planBPivot}
                onViewWarRoom={onViewWarRoom}
              />
            ) : (
              <motion.div
                key="no-player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-10 rounded-2xl border border-dashed border-[#3d3670] bg-[#2a2458]"
              >
                <div className="text-center text-[#6b6490]">
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
            hasPlayer={hasPlayer}
          />

          <TeamSquadSnapshot
            teamColor={teamColor}
            teamPurse={teamPurse}
            tournamentId={tournamentId}
            teamId={teamId}
            unit={unit}
            tier={tier}
            biddingActive={timerActive && isActive && hasPlayer}
            collapseSignal={collapseSignal}
          />

          {/* Reserve / squad banners */}
          <MaxSquadNotice maxSquadReached={maxSquadReached} />
        </div>

        {/* Bottom bid dock — always pinned visible */}
        <div className={`sticky bottom-0 z-20 flex-shrink-0 px-3 sm:px-4 pt-1.5 sm:pt-2.5 pb-2 sm:pb-3.5 border-t border-[#4a4478] space-y-1.5 sm:space-y-2 safe-bottom bg-background ${tier === "tablet" ? "pb-5" : ""}`}>
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
            biddingActive={timerActive && isActive && hasPlayer}
            collapseSignal={collapseSignal}
          />

          {/* Tactical War Room AI Strip: Walk-Away Price & Rival Outbid Capacity Radar (P2) */}
          {hasPlayer && state?.currentPlayer && (
            <TacticalWarRoomStrip
              walkAwayPrice={walkAwayPrice}
              marginStatus={marginStatus}
              rivalOutbidCount={rivalOutbidCount}
              unit={unit}
              tier={tier}
              aiRadarEnabled={aiRadarEnabled}
              onToggleAiRadar={toggleAiRadar}
              bluffAlert={bluffAlert}
            />
          )}

          {bidDisabledHint && <BidDisabledMessage hint={bidDisabledHint} compact={tier === "mobile"} />}

          <AnimatePresence mode="wait">
            <BidButton
              key={`${ownerBiddingEnabled}-${isOnBreak}-${isLeading}-${expired}-${timerActive}-${isActive}-${hasPlayer}-${breakMins}-${breakSecs}`}
              ownerBiddingEnabled={ownerBiddingEnabled}
              canBid={canBid}
              isLeading={isLeading}
              timerExpired={expired}
              timerActive={timerActive}
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

          {/* Live Purse Preservation Simulator (P2) */}
          {hasPlayer && state?.currentPlayer && (
            <LivePursePreservationSimulator
              nextBidAmount={nextBidAmount}
              postBidPurse={postBidPurse}
              futureSlots={futureMandatorySlots}
              avgPerPlayer={avgPerPlayerNeeded}
              unit={unit}
              tier={tier}
              aiRadarEnabled={aiRadarEnabled}
            />
          )}

          {bidFeedback === "error" && (
            <p className="text-center text-red-400 text-sm font-semibold">{bidErrorMsg || "Bid failed. Please try again."}</p>
          )}

          {showPoweredBy && (
            <p className="text-center text-xs text-[#3d3670] uppercase tracking-widest">{poweredByText}</p>
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
                  <p className="text-xl text-[#a8a0c4] mt-2">{fmt(wonBanner.soldAmount)}</p>
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

        <PlayerBioSideDrawer
          isOpen={showPlayerBioDrawer}
          onClose={() => setShowPlayerBioDrawer(false)}
          player={state?.currentPlayer ?? null}
          teamColor={teamColor}
          unit={unit}
          categoryName={state?.currentCategoryName}
          sport={tournament?.sport}
          tournamentId={tournamentId}
          features={(tournament as any)?.featuresJson ?? (tournament as any)?.features}
          isTargetPlayer={isTargetPlayer}
        />

        {/* ── Sign-out confirmation ── */}
        <AnimatePresence>
          {showSignOutConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-8 z-[60] px-8"
            >
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="absolute top-5 right-5 p-2 text-[#6b6490] hover:text-white transition-colors"
              >
                <X className="w-7 h-7" />
              </button>
              <div className="text-center space-y-3">
                <p className="font-display font-bold text-2xl text-white">Leave this auction?</p>
                <p className="text-base text-[#a8a0c4]">You will need to re-enter your access code.</p>
              </div>
              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-4 rounded-2xl border border-[#4a4478] text-[#a8a0c4] font-bold text-base hover:bg-[#2a2458] transition-colors"
                >
                  Stay
                </button>
                <button
                  onClick={() => { setShowSignOutConfirm(false); onSignOut(); }}
                  className="flex-1 py-4 rounded-2xl bg-[#4a4478] text-white font-bold text-base hover:bg-[#3d3670] transition-colors"
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
      className="auction-surface relative h-full flex flex-row bg-background overflow-hidden select-none"
      style={{ background: `radial-gradient(ellipse at center left, ${teamColor}12 0%, transparent 55%), #1e1845` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Left: player info — 60% */}
      <div className="w-[60%] flex flex-col overflow-hidden border-r border-[#4a4478] min-w-0">
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
          onViewWarRoom={onViewWarRoom}
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
                tournamentId={tournamentId}
                features={(tournament as any)?.featuresJson ?? (tournament as any)?.features}
                squadRoleCount={mySquadRoleCount}
                onOpenBio={() => setShowPlayerBioDrawer(true)}
                isTargetPlayer={isTargetPlayer}
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
                planBPivot={planBPivot}
                onViewWarRoom={onViewWarRoom}
              />
            ) : (
              <motion.div
                key="no-player-ls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center p-8 rounded-2xl border border-dashed border-[#3d3670] bg-[#2a2458]"
              >
                <div className="text-center text-[#6b6490]">
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
            hasPlayer={hasPlayer}
          />
          <TeamSquadSnapshot
            teamColor={teamColor}
            teamPurse={teamPurse}
            tournamentId={tournamentId}
            teamId={teamId}
            unit={unit}
            tier={tier}
            biddingActive={timerActive && isActive && hasPlayer}
            collapseSignal={collapseSignal}
          />
          <MaxSquadNotice maxSquadReached={maxSquadReached} />
        </div>

        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-[#4a4478] flex-shrink-0">
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
            biddingActive={timerActive && isActive && hasPlayer}
            collapseSignal={collapseSignal}
          />
        </div>
      </div>

      {/* Right: bid controls — 40% panel */}
      <div className="w-[40%] flex flex-col px-3 sm:px-4 py-3 sm:py-4 gap-2 sm:gap-3 flex-shrink-0 min-w-[180px]">
        {/* Tactical War Room AI Strip: Walk-Away Price & Rival Outbid Capacity Radar (P2) */}
        {hasPlayer && state?.currentPlayer && (
          <TacticalWarRoomStrip
            walkAwayPrice={walkAwayPrice}
            marginStatus={marginStatus}
            rivalOutbidCount={rivalOutbidCount}
            unit={unit}
            tier={tier}
            aiRadarEnabled={aiRadarEnabled}
            onToggleAiRadar={toggleAiRadar}
            bluffAlert={bluffAlert}
          />
        )}

        <div className={`flex-1 flex flex-col ${tier === "mobile" ? "min-h-[42vh]" : tier === "tablet" ? "min-h-[44vh]" : "min-h-[40vh]"}`}>
          <AnimatePresence mode="wait">
            {hasPlayer || isOnBreak ? (
              <BidButton
                key={`split-${ownerBiddingEnabled}-${isOnBreak}-${isLeading}-${expired}-${timerActive}-${isActive}-${hasPlayer}-${breakMins}-${breakSecs}`}
                ownerBiddingEnabled={ownerBiddingEnabled}
                canBid={canBid}
                isLeading={isLeading}
                timerExpired={expired}
                timerActive={timerActive}
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
            ) : (
              <InterLotCommandCenter
                key="inter-lot-war-room"
                tournamentId={tournamentId}
                teamId={teamId}
                teamColor={teamColor}
                isPaused={isPaused}
                isIdle={isIdle}
                unit={unit}
                onViewSquad={onViewSquad}
                onViewScout={onViewScout}
                onViewWarRoom={onViewWarRoom}
                sport={tournament?.sport}
                lastSoldPlayer={state?.lastSoldPlayer}
                purseRemaining={teamPurse?.purseRemaining ?? team.purse}
                futureMandatorySlots={futureMandatorySlots}
                suppressPlanBPivot={showLastSoldResult}
              />
            )}
          </AnimatePresence>

          {/* Live Purse Preservation Simulator (P2) */}
          {hasPlayer && state?.currentPlayer && (
            <div className="mt-2">
              <LivePursePreservationSimulator
                nextBidAmount={nextBidAmount}
                postBidPurse={postBidPurse}
                futureSlots={futureMandatorySlots}
                avgPerPlayer={avgPerPlayerNeeded}
                unit={unit}
                tier={tier}
                aiRadarEnabled={aiRadarEnabled}
              />
            </div>
          )}
        </div>

        {bidFeedback === "error" && (
          <p className="text-center text-red-400 text-sm font-semibold">{bidErrorMsg || "Bid failed. Try again."}</p>
        )}
        {bidDisabledHint && <BidDisabledMessage hint={bidDisabledHint} compact={tier !== "laptop"} />}

        {showPoweredBy && (
          <p className="text-center text-xs text-[#3d3670] uppercase tracking-widest flex-shrink-0">
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
              {wonBanner.soldAmount != null && <p className="text-xl text-[#a8a0c4] mt-1">{fmt(wonBanner.soldAmount)}</p>}
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
            className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-6 z-[60] px-8"
          >
            <button onClick={() => setShowSignOutConfirm(false)} className="absolute top-5 right-5 p-2 text-[#6b6490] hover:text-white transition-colors">
              <X className="w-7 h-7" />
            </button>
            <div className="text-center space-y-2">
              <p className="font-display font-bold text-2xl text-white">Leave this auction?</p>
              <p className="text-base text-[#a8a0c4]">You will need to re-enter your access code.</p>
            </div>
            <div className="flex gap-4 w-full max-w-xs">
              <button onClick={() => setShowSignOutConfirm(false)} className="flex-1 py-4 rounded-2xl border border-[#4a4478] text-[#a8a0c4] font-bold text-base hover:bg-[#2a2458] transition-colors">
                Stay
              </button>
              <button onClick={() => { setShowSignOutConfirm(false); onSignOut(); }} className="flex-1 py-4 rounded-2xl bg-[#4a4478] text-white font-bold text-base hover:bg-[#3d3670] transition-colors">
                Yes, Leave
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlayerBioSideDrawer
        isOpen={showPlayerBioDrawer}
        onClose={() => setShowPlayerBioDrawer(false)}
        player={state?.currentPlayer ?? null}
        teamColor={teamColor}
        unit={unit}
        categoryName={state?.currentCategoryName}
        sport={tournament?.sport}
        tournamentId={tournamentId}
        features={(tournament as any)?.featuresJson ?? (tournament as any)?.features}
        isTargetPlayer={isTargetPlayer}
      />

      <Toast message={navToast ?? null} onDismiss={onNavToastDismiss ?? (() => {})} />
    </div>
  );
}
