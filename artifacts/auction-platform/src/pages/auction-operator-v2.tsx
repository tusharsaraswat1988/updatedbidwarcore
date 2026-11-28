import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useRoute, useLocation } from "wouter";

const FortuneWheelModal = lazy(() =>
  import("@/components/fortune-wheel-modal").then((m) => ({ default: m.FortuneWheelModal }))
);

import {
  useGetAuctionState,
  useGetTeamPurses,
  useListTeams,
  useListPlayers,
  useListBids,
  useListCategories,
  useStartAuction,
  usePauseAuction,
  useNextPlayer,
  usePlaceBid,
  useSellPlayer,
  useManualSell,
  useMarkUnsold,
  useReAuctionPlayer,
  useReAuctionAllUnsold,
  useConcludeAuction,
  useStartTimer,
  useStopTimer,
  useSetDisplayOverlay,
  useSetDisplayPlayerFilter,
  useSetCategoryFilter,
  useDeferPlayer,
  useSetBreakTimer,
  useSyncFortuneWheel,
  useUpdateAuctionSettings,
  useUpdateTournament,
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getListBidsQueryKey,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
  getListCategoriesQueryKey,
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import { useMutationSync } from "@/hooks/use-mutation-sync";
import { useOperatorSessionLock } from "@/hooks/use-operator-session-lock";
import { useSetPresentationContext } from "@/hooks/use-presentation-context";
import {
  parsePresentationContext,
  presentationContextLabel,
  type PresentationContextKind,
} from "@/lib/presentation-context";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { useTimerExpired } from "@/hooks/use-timer-expired";
import { resolveSquadMetrics } from "@/lib/led-view/squad-metrics";
import { ServerCountdown } from "@/components/server-countdown";
import { OperatorLayout } from "@/components/operator-layout";
import { LocalOperatorPinBar } from "@/components/local-operator-pin-bar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  PrepareReAuctionDialog,
  SinglePlayerReAuctionDialog,
  type ReAuctionTargetPlayer,
} from "@/components/auction/re-auction-dialogs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, CheckCircle, XCircle,
  Shuffle, User, Trophy, Clock, Gavel, RotateCcw, AlertTriangle,
  Settings2, Timer, Tag, X, Search,
  Hourglass, Monitor, Users, Crown, ShieldAlert,
  PanelRightClose, PanelRightOpen, Tv2,
  Copy, Check, Volume2, VolumeX, Info,
  Smartphone, Sparkles, ExternalLink, SlidersHorizontal,
} from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { OperatorPlayerAuctionHistory } from "@/pages/auction-operator";
import { isLiveAuctionHistoryEnabled } from "@workspace/platform-core";
import { cldUrl } from "@/lib/cloudinary";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { useBranding } from "@/hooks/use-branding";
import { broadcastRandomReveal } from "@/lib/auction-reveal-broadcast";
import { getRevealDurations } from "@/components/display/random-player-reveal";
import { getBrandLogoSrc, getBrandWordmarkSrc } from "@/lib/brand-assets";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { computeNextBidAmount } from "@workspace/api-base/auction-bid";
import { BID_ACK_TIMEOUT_MS, logBidLifecycle } from "@workspace/api-base/auction-bid-sync";
import {
  tournamentToReadinessInput,
  validateAuctionReadiness,
  type AuctionReadinessCheckId,
  type AuctionReadinessIssue,
} from "@workspace/api-base/auction-readiness";
import {
  MAX_AUCTION_TIMER_SECONDS,
  MIN_AUCTION_TIMER_SECONDS,
  parseOperatorTimerSeconds,
} from "@workspace/api-base/auction-timer";
import { isAuctionLicenseActive, isTeamEligibleForTrialAuction } from "@workspace/api-base";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { readinessFixPath } from "@/lib/settings-navigation";
import { PurseBoosterDialog } from "@/components/purse-booster-dialog";
import { AuditReasonField } from "@/components/audit-reason-field";
import { useToast } from "@/hooks/use-toast";
import { BroadcastStudioDrawer } from "@/components/auction/broadcast-studio-drawer";
import { FullscreenButton } from "@/components/fullscreen-button";

function playerMatchesSearch(
  player: { id: number; serialNo?: number; name: string },
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  if (player.name.toLowerCase().includes(query)) return true;
  if (/^\d+$/.test(query) && String(player.serialNo ?? player.id) === query) return true;
  return false;
}

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

interface StagePrompterData {
  tournamentId: number;
  currentPlayer: {
    id: number;
    name: string;
    role: string | null;
    categoryId: number | null;
    categoryName: string | null;
    basePrice: number;
    currentBid: number | null;
  } | null;
  rivalryBulletins: Array<{
    teams: Array<{ id: number; name: string; shortCode: string; purseRemaining: number }>;
    message: string;
  }>;
  categoryInflation: {
    multiplier: number | null;
    soldCount: number;
    message: string;
  } | null;
  categoryScarcity: {
    categoryId: number | null;
    categoryName: string | null;
    availableCategoryPlayers: number;
    unfilledCategorySlots: number;
    isCriticalSqueeze: boolean;
    deficit: number;
    message: string;
  } | null;
  roomLiquidity: {
    totalPurseRemaining: number;
    totalUnfilledMandatorySlots: number;
    minBasePrice: number;
    ratio: number | null;
    isDeficit: boolean;
    message: string;
  };
  teamDistressAlerts: Array<{
    teamId: number;
    teamName: string;
    teamColor: string | null;
    purseSpentPct: number;
    purseRemaining: number;
    mandatorySlotsRemaining: number;
    message: string;
  }>;
}

function StageAuctioneerPrompterRadar({
  tournamentId,
  playerId,
}: {
  tournamentId: number;
  playerId?: number | null;
}) {
  const { data: prompter } = useQuery<StagePrompterData | null>({
    queryKey: ["stage-prompter-radar", tournamentId, playerId],
    queryFn: async () => {
      if (!tournamentId || !playerId) return null;
      try {
        const res = await fetch(`/api/intelligence/stage-prompter/${tournamentId}?playerId=${playerId}`, {
          credentials: "include",
        });
        if (res.ok) return await res.json();
        const fallback = await fetch(`/api/tournaments/${tournamentId}/intelligence/stage-prompter?playerId=${playerId}`, {
          credentials: "include",
        });
        if (fallback.ok) return await fallback.json();
      } catch (err) {
        console.warn("Stage prompter radar fetch error:", err);
      }
      return null;
    },
    enabled: Boolean(tournamentId && playerId),
    refetchInterval: 5000,
  });

  if (!prompter || !prompter.currentPlayer) return null;

  const { rivalryBulletins, categoryInflation, categoryScarcity, roomLiquidity, teamDistressAlerts } = prompter;
  const hasInsights =
    rivalryBulletins.length > 0 ||
    categoryScarcity != null ||
    categoryInflation != null ||
    teamDistressAlerts.length > 0 ||
    roomLiquidity?.isDeficit === true ||
    (roomLiquidity?.ratio !== null && roomLiquidity?.ratio !== undefined);

  if (!hasInsights) return null;

  return (
    <div className="rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900/60 to-indigo-500/10 border border-amber-500/30 p-2.5 sm:p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span className="font-mono text-[10px] font-black uppercase tracking-wider text-amber-300">
            Stage Auctioneer Prompter & Scarcity Radar
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categoryScarcity && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                categoryScarcity.isCriticalSqueeze
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}
            >
              {categoryScarcity.isCriticalSqueeze ? "⚠️ SQUEEZE: " : "SUPPLY: "}
              {categoryScarcity.availableCategoryPlayers} left ({categoryScarcity.unfilledCategorySlots} slots)
            </span>
          )}

          {categoryInflation && categoryInflation.multiplier && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              📈 {categoryInflation.multiplier.toFixed(1)}x Base Price
            </span>
          )}

          {roomLiquidity && roomLiquidity.ratio !== null && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                roomLiquidity.isDeficit
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                  : "bg-sky-500/20 text-sky-300 border-sky-500/30"
              }`}
            >
              💧 Liquidity: {roomLiquidity.ratio.toFixed(1)}x
            </span>
          )}

          {teamDistressAlerts.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
              🚨 Distress: {teamDistressAlerts[0].teamName} ({teamDistressAlerts[0].purseSpentPct}% spent)
            </span>
          )}
        </div>
      </div>

      {/* Primary Talking Point Bulletin */}
      {rivalryBulletins.length > 0 ? (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs text-amber-200">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="font-semibold leading-snug">
            <span className="text-amber-400 uppercase text-[10px] tracking-wide font-black mr-1.5">Auctioneer Cue:</span>
            {rivalryBulletins[0].message}
          </p>
        </div>
      ) : categoryScarcity ? (
        <div className="flex items-start gap-2 bg-slate-900/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80">
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          <p className="font-medium leading-snug">
            <span className="text-sky-300 uppercase text-[10px] tracking-wide font-black mr-1.5">Market Pulse:</span>
            {categoryScarcity.message}
          </p>
        </div>
      ) : categoryInflation ? (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs text-amber-200">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="font-medium leading-snug">
            <span className="text-amber-300 uppercase text-[10px] tracking-wide font-black mr-1.5">Price Dynamic:</span>
            {categoryInflation.message}
          </p>
        </div>
      ) : teamDistressAlerts.length > 0 ? (
        <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-2.5 py-1.5 text-xs text-orange-200">
          <Info className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
          <p className="font-medium leading-snug">
            <span className="text-orange-300 uppercase text-[10px] tracking-wide font-black mr-1.5">Distress Alert:</span>
            {teamDistressAlerts[0].message}
          </p>
        </div>
      ) : roomLiquidity?.message ? (
        <div className="flex items-start gap-2 bg-slate-900/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80">
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          <p className="font-medium leading-snug">
            <span className="text-sky-300 uppercase text-[10px] tracking-wide font-black mr-1.5">Room Liquidity:</span>
            {roomLiquidity.message}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function AuctionOperatorV2() {
  const [, params] = useRoute("/tournament/:id/auction");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0", 10);
  const qc = useQueryClient();
  const { logos, brandName, iconVersion } = useBranding();
  const brandLogoSrc =
    getBrandWordmarkSrc(logos, ["mainReverse", "main"]) ||
    getBrandLogoSrc(logos, ["mainReverse", "main"], iconVersion) ||
    "/assets/branding/bidwar-reverse-logo-official.png";

  const { toast } = useToast();

  // Drawers and Dialogs
  const [studioDrawerOpen, setStudioDrawerOpen] = useState(false);
  const [studioDrawerTab, setStudioDrawerTab] = useState<"led" | "obs" | "intermission">("led");

  function openStudioToTab(tab: "led" | "obs" | "intermission") {
    setStudioDrawerTab(tab);
    setStudioDrawerOpen(true);
  }
  const [manualSellOpen, setManualSellOpen] = useState(false);
  const [manualTeamId, setManualTeamId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualSellReason, setManualSellReason] = useState("");
  const [showAdvancedReason, setShowAdvancedReason] = useState(false);
  const [showBatchReAuctionConfirm, setShowBatchReAuctionConfirm] = useState(false);
  const [reAuctionTargetPlayer, setReAuctionTargetPlayer] = useState<ReAuctionTargetPlayer | null>(null);
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const [readinessIssues, setReadinessIssues] = useState<AuctionReadinessIssue[]>([]);
  const [resumeBidDialogOpen, setResumeBidDialogOpen] = useState(false);
  const [currentBidPaused, setCurrentBidPaused] = useState(false);
  const [timingSettingsOpen, setTimingSettingsOpen] = useState(false);
  const [openingTimerSecs, setOpeningTimerSecs] = useState("30");
  const [bidTimerSecs, setBidTimerSecs] = useState("15");

  // Filter & Queue States
  const [playerSearch, setPlayerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("available");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bidHistoryOpen, setBidHistoryOpen] = useState(false);
  const [showFortuneWheel, setShowFortuneWheel] = useState(false);
  const [showPurseBooster, setShowPurseBooster] = useState(false);
  const [countdownDialogOpen, setCountdownDialogOpen] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState("5");
  const [countdownSeconds, setCountdownSeconds] = useState("0");
  const [countdownLabel, setCountdownLabel] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  // Debounces & Locks
  const bidDebounce = useRef<Map<number, number>>(new Map());
  const [bidGateLocked, setBidGateLocked] = useState(false);
  const bidGateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelResetOnMountRef = useRef(false);
  const [confirmDisableOwnerBiddingOpen, setConfirmDisableOwnerBiddingOpen] = useState(false);
  const [confirmEnableOwnerBiddingOpen, setConfirmEnableOwnerBiddingOpen] = useState(false);

  // Socket & Sync Hooks
  const { connectionStatus } = useAuctionSocket(tournamentId);
  const { applyMutationResult, invalidateFallback } = useMutationSync(tournamentId, connectionStatus);
  const {
    readOnly: operatorReadOnly,
    lockStatus: operatorLockStatus,
    takeover: operatorTakeover,
  } = useOperatorSessionLock(tournamentId);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { unit, formatAmount, formatShort, symbol: unitSymbol } = useAuctionUnit(tournament);
  const { data: state } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const feed = useAuctionConnectionState(
    connectionStatus,
    tournamentId,
    typeof (state as any)?.lastAuctionActivityAt === "string" ? (state as any).lastAuctionActivityAt : null,
    { audience: "operator" },
  );

  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: bids } = useListBids(tournamentId, {
    query: {
      queryKey: getListBidsQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 5000),
    },
  });
  const { data: categories } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: sseAwareRefetchInterval(connectionStatus, 5000),
    },
  });

  // Mutations
  const startAuction = useStartAuction();
  const pauseAuction = usePauseAuction();
  const nextPlayer = useNextPlayer();
  const placeBid = usePlaceBid();
  const sellPlayer = useSellPlayer();
  const manualSellMut = useManualSell();
  const markUnsold = useMarkUnsold();
  const reAuction = useReAuctionPlayer();
  const reAuctionAllUnsoldMut = useReAuctionAllUnsold();
  const concludeAuctionMut = useConcludeAuction();
  const startTimerMut = useStartTimer();
  const stopTimerMut = useStopTimer();
  const setDisplayOverlay = useSetDisplayOverlay();
  const setDisplayPlayerFilterMut = useSetDisplayPlayerFilter();
  const setPresentationMut = useSetPresentationContext();
  const deferPlayerMut = useDeferPlayer();
  const setBreakTimerMut = useSetBreakTimer();
  const updateAuctionSettingsMut = useUpdateAuctionSettings();
  const updateTournamentMut = useUpdateTournament();
  const syncFortuneWheel = useSyncFortuneWheel();

  const [isRandomRevealing, setIsRandomRevealing] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  // Drop stale fortune-wheel broadcast from a prior session
  useEffect(() => {
    if (!tournamentId || wheelResetOnMountRef.current) return;
    wheelResetOnMountRef.current = true;
    syncFortuneWheel.mutate({
      tournamentId,
      data: { active: false, winner: null, spinning: false },
    });
  }, [tournamentId, syncFortuneWheel]);

  // Derived Variables
  const teamMap = useMemo(() => Object.fromEntries((teams || []).map((t) => [t.id, t])), [teams]);
  const categoryMap = useMemo(() => Object.fromEntries((categories || []).map((c) => [c.id, c])), [categories]);
  const activeCategoryIds: number[] | null = (state?.activeCategoryIds as number[] | null) ?? null;

  const selectionMode: "random" | "sequential" | "manual" =
    (state as any)?.playerSelectionMode ?? (tournament as any)?.playerSelectionMode ?? "sequential";

  const licenseStatus: string = (state as any)?.licenseStatus ?? "trial";
  const isTrialMode = !isAuctionLicenseActive(licenseStatus);
  const trialTeamIds: number[] | null = (state as any)?.trialTeamIds ?? null;
  const currentCountdown = (state as { displayCountdown?: { type?: string; endsAt?: string; message?: string | null; musicMuted?: boolean } | null } | undefined)?.displayCountdown ?? null;
  const presentationContext = useMemo(() => parsePresentationContext((state as any)?.presentationContext), [(state as any)?.presentationContext]);

  const ownerBiddingEnabled =
    (state as { ownerBiddingEnabled?: boolean } | undefined)?.ownerBiddingEnabled ??
    (tournament as { ownerBiddingEnabled?: boolean } | undefined)?.ownerBiddingEnabled ??
    true;

  const auctionStatus = state?.status || "idle";
  const isPaused = auctionStatus === "paused";
  const isCompleted = auctionStatus === "completed";
  const isActive = auctionStatus === "active";
  const isPreAuction = !isActive && !isPaused && !isCompleted;
  const auctionLive = isActive || isPaused;
  const controlsLocked = isCompleted || operatorReadOnly;

  const hasPlayer = Boolean(state?.currentPlayer);
  const currentPlayer = state?.currentPlayer;
  const currentBid = state?.currentBid || 0;
  const hasBid = Boolean(state?.currentBidTeamId && state.currentBidTeamId > 0);
  const timerEndsAt = state?.timerEndsAt;
  const timerExpired = useTimerExpired(timerEndsAt);
  const timerActive = Boolean(timerEndsAt && !timerExpired);

  const lastSoldPlayer = (state as {
    lastSoldPlayer?: { id: number; name: string; soldAmount: number } | null;
  } | undefined)?.lastSoldPlayer ?? null;
  const canReauctionLastSale = !!lastSoldPlayer?.id && !hasPlayer && isActive && !isPaused;

  // Player Lists
  const allPlayers = players || [];
  const available = allPlayers.filter((p) => p.status === "available");
  const sold = allPlayers.filter((p) => p.status === "sold");
  const unsold = allPlayers.filter((p) => p.status === "unsold");
  const retained = allPlayers.filter((p) => p.status === "retained");

  const statusCounts = {
    all: allPlayers.length,
    available: available.length,
    sold: sold.length,
    unsold: unsold.length,
    retained: retained.length,
  };

  const leftPanelList = useMemo(() => {
    let list = allPlayers;
    if (statusFilter === "available") list = available;
    else if (statusFilter === "sold") list = sold;
    else if (statusFilter === "unsold") list = unsold;
    else if (statusFilter === "retained") list = retained;
    if (playerSearch.trim()) {
      list = list.filter((p) => playerMatchesSearch(p, playerSearch));
    }
    return list;
  }, [allPlayers, available, sold, unsold, retained, statusFilter, playerSearch]);

  const mainRoundExhausted = available.length === 0 && !hasPlayer && auctionLive;
  const bringUnsoldDisabled = controlsLocked || isPaused || unsold.length === 0 || reAuctionAllUnsoldMut.isPending;

  // Next Bid Calculation
  const nextBidAmount = computeNextBidAmount({
    currentBid: state?.currentBid,
    bidIncrement: state?.bidIncrement ?? 50000,
    currentBidTeamId: state?.currentBidTeamId,
  });

  // Action Handlers
  async function handleUpdateDrawMode(newMode: "random" | "sequential" | "manual") {
    if (controlsLocked || updateTournamentMut.isPending) return;
    try {
      await updateTournamentMut.mutateAsync({
        tournamentId,
        data: { playerSelectionMode: newMode },
      });
      qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      toast({
        title: `Draw Mode: ${newMode === "random" ? "Random Draw" : newMode === "manual" ? "Manual Pick" : "In Order"}`,
        description: newMode === "manual" ? "You can now click 'Go' on any player in the queue." : undefined,
      });
    } catch (err) {
      toast({
        title: "Could not change draw mode",
        description: mutationErrorMessage(err, "Please try again"),
        variant: "destructive",
      });
    }
  }

  async function handleNextPlayer(mode: "sequential" | "random", playerId?: number) {
    if (controlsLocked || state?.currentPlayer || nextPlayer.isPending || isRandomRevealing) return;
    if (mode === "random" && !playerId) {
      setIsRandomRevealing(true);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      const poolCount = state?.remainingPlayersCount ?? 1;
      const revealDuration = getRevealDurations(poolCount).totalMs;
      revealTimerRef.current = setTimeout(() => {
        setIsRandomRevealing(false);
      }, revealDuration);
    }
    try {
      const result = await nextPlayer.mutateAsync({ tournamentId, data: { mode, playerId } });
      setCurrentBidPaused(false);
      applyMutationResult(result);
      if (mode === "random" && !playerId && result?.currentPlayer?.id) {
        broadcastRandomReveal(tournamentId, result.currentPlayer.id, Date.now());
      }
    } catch (err) {
      setIsRandomRevealing(false);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      toast({
        title: "Next player failed",
        description: mutationErrorMessage(err, "Could not draw player"),
        variant: "destructive",
      });
    }
  }

  function handleBid(teamId: number) {
    if (controlsLocked || bidGateLocked) return;
    if (!hasPlayer) return;
    if (!timerActive) {
      toast({
        title: "Bidding not started",
        description: "Click START BIDDING (or press Space) before placing bids.",
        variant: "destructive",
      });
      return;
    }
    const now = Date.now();
    if ((bidDebounce.current.get(teamId) ?? 0) + 150 > now) return;
    bidDebounce.current.set(teamId, now);

    const bidTeam = teamMap[teamId];
    qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        currentBid: nextBidAmount,
        currentBidTeamId: teamId,
        currentBidTeamName: bidTeam?.name ?? old.currentBidTeamName,
        currentBidTeamColor: bidTeam?.color ?? old.currentBidTeamColor,
      };
    });

    setBidGateLocked(true);
    if (bidGateTimerRef.current) clearTimeout(bidGateTimerRef.current);
    bidGateTimerRef.current = setTimeout(() => {
      setBidGateLocked(false);
      if (placeBid.isPending) placeBid.reset();
    }, BID_ACK_TIMEOUT_MS);

    placeBid
      .mutateAsync({ tournamentId, data: { teamId, amount: nextBidAmount } })
      .then((result) => applyMutationResult(result))
      .catch((err) => {
        invalidateFallback();
        toast({
          title: "Bid not placed",
          description: mutationErrorMessage(err, "Could not place bid"),
          variant: "destructive",
        });
      })
      .finally(() => {
        if (bidGateTimerRef.current) {
          clearTimeout(bidGateTimerRef.current);
          bidGateTimerRef.current = null;
        }
        setBidGateLocked(false);
      });
  }

  async function handleSell() {
    if (controlsLocked || sellPlayer.isPending) return;
    try {
      const result = await sellPlayer.mutateAsync({
        tournamentId,
        ...(state?.currentBidTeamId != null ? { expectedBidTeamId: state.currentBidTeamId as number } : {}),
        ...(state?.currentBid != null ? { expectedBidAmount: state.currentBid as number } : {}),
      });
      applyMutationResult(result);
      toast({
        title: "Player Sold! 🔨",
        description: `${state?.currentPlayer?.name} awarded to ${state?.currentBidTeamName} for ${formatShort(state?.currentBid ?? 0)}`,
      });
    } catch (err) {
      toast({
        title: "Could not mark sold",
        description: mutationErrorMessage(err, "Sell failed"),
        variant: "destructive",
      });
    }
  }

  async function handleUnsold() {
    if (controlsLocked || markUnsold.isPending) return;
    const currentRev = (state as { revision?: number } | undefined)?.revision ?? 0;
    try {
      const result = await markUnsold.mutateAsync({
        tournamentId,
        data: { expectedRevision: currentRev },
      });
      applyMutationResult(result);
      toast({ title: "Player marked Unsold", description: "Moved to unsold pool" });
    } catch (err) {
      toast({
        title: "Could not mark unsold",
        description: mutationErrorMessage(err, "Unsold failed"),
        variant: "destructive",
      });
    }
  }

  async function handleDeferPlayer() {
    if (controlsLocked || !currentPlayer?.id || deferPlayerMut.isPending) return;
    try {
      const result = await deferPlayerMut.mutateAsync({
        tournamentId,
      });
      applyMutationResult(result);
      toast({ title: "Player Deferred", description: "Returned to available queue" });
    } catch (err) {
      toast({ title: "Could not defer player", variant: "destructive" });
    }
  }

  async function handleStartAuction() {
    if (controlsLocked || startAuction.isPending) return;
    try {
      const result = await startAuction.mutateAsync({ tournamentId });
      applyMutationResult(result);
      toast({ title: "Live Auction Started! 🚀" });
    } catch (err) {
      toast({ title: "Failed to start auction", variant: "destructive" });
    }
  }

  async function handlePauseAuction() {
    if (controlsLocked || pauseAuction.isPending) return;
    try {
      const result = await pauseAuction.mutateAsync({ tournamentId });
      applyMutationResult(result);
      toast({ title: "Auction Paused" });
    } catch (err) {
      toast({ title: "Failed to pause auction", variant: "destructive" });
    }
  }

  async function handleStartBiddingClick() {
    if (controlsLocked) {
      toast({
        title: "Controls locked",
        description: operatorReadOnly
          ? "Another operator session has control. Click 'Take Over' in the top header to take control."
          : "Auction controls are locked.",
        variant: "destructive",
      });
      return;
    }
    if (startTimerMut.isPending || !hasPlayer) return;
    if (currentBidPaused && hasPlayer && hasBid) {
      setResumeBidDialogOpen(true);
      return;
    }
    try {
      const dur = hasBid
        ? parseInt(bidTimerSecs, 10) || 15
        : parseInt(openingTimerSecs, 10) || 30;
      const result = await startTimerMut.mutateAsync({
        tournamentId,
        data: { seconds: dur },
      });
      applyMutationResult(result);
      setCurrentBidPaused(false);
    } catch (err) {
      toast({ title: "Could not start timer", variant: "destructive" });
    }
  }

  async function handleExtendTimer() {
    if (controlsLocked) {
      toast({
        title: "Controls locked",
        description: operatorReadOnly ? "Another operator session has control." : "Auction controls locked.",
        variant: "destructive",
      });
      return;
    }
    if (!hasPlayer || startTimerMut.isPending) return;
    const inBidPhase = !!state?.currentBidTeamId || state?.timerType === "bid";
    const baseSecs = inBidPhase
      ? parseOperatorTimerSeconds(bidTimerSecs, state?.bidTimerSeconds ?? 15)
      : parseOperatorTimerSeconds(openingTimerSecs, state?.timerSeconds ?? 30);
    const secs = baseSecs + 30;
    try {
      const result = await startTimerMut.mutateAsync({ tournamentId, data: { seconds: secs } });
      applyMutationResult(result);
      setCurrentBidPaused(false);
      toast({ title: "Timer extended (+30s)" });
    } catch (err) {
      toast({ title: "Could not extend timer", variant: "destructive" });
    }
  }

  async function handleResumeBidContinue() {
    setResumeBidDialogOpen(false);
    setCurrentBidPaused(false);
    try {
      const dur = parseInt(bidTimerSecs, 10) || 15;
      const result = await startTimerMut.mutateAsync({ tournamentId, data: { seconds: dur } });
      applyMutationResult(result);
    } catch (err) {
      toast({ title: "Could not resume timer", variant: "destructive" });
    }
  }

  async function handleResumeBidRestart() {
    const playerId = state?.currentPlayer?.id;
    if (!playerId) return;
    setResumeBidDialogOpen(false);
    await handleReAuction(playerId, true);
  }

  async function handleReAuction(
    playerId: number,
    startFromBase: boolean,
    reason?: string,
    startingBid?: number,
  ): Promise<boolean> {
    if (controlsLocked || reAuction.isPending) return false;
    const currentId = state?.currentPlayer?.id;
    if (currentId && currentId !== playerId) {
      toast({
        title: "Player on block",
        description: "Finish or defer the current player before starting a re-auction.",
        variant: "destructive",
      });
      return false;
    }
    try {
      const result = await reAuction.mutateAsync({
        tournamentId,
        data: {
          playerId,
          startFromBase,
          ...(startingBid != null ? { startingBid } : {}),
          ...(reason?.trim() ? { reason: reason.trim() } : {}),
        },
      });
      setCurrentBidPaused(false);
      applyMutationResult(result);
      toast({ title: "Player placed back on block" });
      return true;
    } catch (err) {
      toast({
        title: "Could not re-auction player",
        description: mutationErrorMessage(err, "Re-auction failed"),
        variant: "destructive",
      });
      return false;
    }
  }

  function openSingleReAuctionDialog(playerId?: number) {
    if (state?.currentPlayer) {
      toast({
        title: "Player on block",
        description: "Finish or defer the current player before re-auctioning another player.",
        variant: "destructive",
      });
      return;
    }
    const targetId = playerId ?? lastSoldPlayer?.id;
    if (!targetId || controlsLocked || reAuction.isPending || isPaused) return;
    const matched = (players || []).find((p) => p.id === targetId);
    setReAuctionTargetPlayer(
      matched
        ? {
            id: matched.id,
            name: matched.name,
            status: matched.status,
            basePrice: matched.basePrice,
            soldPrice: matched.soldPrice,
            teamId: matched.teamId,
          }
        : {
            id: targetId,
            name: lastSoldPlayer?.name ?? `Player #${targetId}`,
            status: "sold",
            basePrice: tournament?.minBid ?? 0,
            soldPrice: lastSoldPlayer?.soldAmount ?? null,
          },
    );
  }

  function handleInstantReauction(playerId?: number) {
    openSingleReAuctionDialog(playerId);
  }

  async function handleStopTimer() {
    if (controlsLocked || stopTimerMut.isPending) return;
    try {
      const result = await stopTimerMut.mutateAsync({ tournamentId });
      applyMutationResult(result);
      setCurrentBidPaused(true);
    } catch (err) {
      toast({ title: "Could not pause bidding", variant: "destructive" });
    }
  }

  // Keyboard Shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (controlsLocked) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case "enter":
          if (isPreAuction && !controlsLocked && !startAuction.isPending) {
            handleStartAuction();
          } else if (!timerActive && hasBid && isActive && !sellPlayer.isPending) {
            handleSell();
          }
          break;
        case "s":
          if (!timerActive && hasBid && isActive && !sellPlayer.isPending) handleSell();
          break;
        case "u":
          if (!timerActive && hasPlayer && !hasBid && isActive && !markUnsold.isPending) handleUnsold();
          break;
        case "d":
          if (!timerActive && hasPlayer && isActive && !deferPlayerMut.isPending) handleDeferPlayer();
          break;
        case "m":
          if (!timerActive && hasPlayer && !isPaused) openManualSellDialog();
          break;
        case "n":
          if (!timerActive && !hasPlayer && isActive && !nextPlayer.isPending) {
            handleNextPlayer(selectionMode === "random" ? "random" : "sequential");
          }
          break;
        case "z":
          if (canReauctionLastSale && !reAuction.isPending) void handleInstantReauction();
          break;
        case " ":
          e.preventDefault();
          if (isActive && hasPlayer) {
            timerActive ? handleStopTimer() : handleStartBiddingClick();
          }
          break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isActive, hasPlayer, timerActive, hasBid, controlsLocked, isPreAuction, selectionMode, canReauctionLastSale]);

  const tournamentCode = (tournament as any)?.auctionCode ?? (tournament as any)?.code;

  function copyCode() {
    if (!tournamentCode) return;
    navigator.clipboard.writeText(String(tournamentCode));
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  // Manual Sell Dialog Helper
  function openManualSellDialog() {
    manualSellMut.reset();
    setManualAmount("");
    let initialTeamId = "";
    if (state?.currentBidTeamId) {
      initialTeamId = String(state.currentBidTeamId);
    }
    setManualTeamId(initialTeamId);
    setManualSellReason("");
    setManualSellOpen(true);
  }

  async function handleConfirmManualSell() {
    if (!manualTeamId || !manualAmount || controlsLocked || isPaused) return;
    const teamId = parseInt(manualTeamId, 10);
    const amount = parseInt(manualAmount, 10) || 0;

    // Check trial
    if (!isTeamEligibleForTrialAuction(teamId, { licenseStatus, trialTeamIds })) {
      toast({
        title: "Trial locked",
        description: "Only the first 2 teams can receive players during trial.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await manualSellMut.mutateAsync({
        tournamentId,
        data: {
          teamId,
          amount,
          ...(manualSellReason.trim() ? { reason: manualSellReason.trim() } : {}),
        },
      });
      setManualSellOpen(false);
      setManualTeamId("");
      setManualAmount("");
      setManualSellReason("");
      applyMutationResult(result);
      toast({ title: "Player Sold Manually! 🔨" });
    } catch (err) {
      toast({
        title: "Manual sell failed",
        description: mutationErrorMessage(err, "Please check team purse and squad limit."),
        variant: "destructive",
      });
    }
  }

  // Manual sell validation
  const selectedManualTeam = useMemo(() => {
    if (!manualTeamId) return null;
    return teams?.find((t) => t.id === parseInt(manualTeamId, 10)) ?? null;
  }, [manualTeamId, teams]);

  const selectedManualTeamPurse = useMemo(() => {
    if (!selectedManualTeam) return null;
    const pData = teamPurses?.find((p) => p.teamId === selectedManualTeam.id);
    const cap = pData?.effectiveCapacity ?? selectedManualTeam.purse ?? 0;
    const pUsed = selectedManualTeam.purseUsed ?? 0;
    const rem = Math.max(0, cap - pUsed);
    const maxB = pData?.maxAllowedBid ?? rem;
    return {
      available: rem,
      maxAllowedBid: maxB,
      playersBought: pData?.playersBought ?? 0,
      maximumSquadSize: pData?.maximumSquadSize ?? 0,
    };
  }, [selectedManualTeam, teamPurses]);

  const manualAmountExceedsPurse = Boolean(
    selectedManualTeamPurse &&
    manualAmount &&
    parseInt(manualAmount, 10) > selectedManualTeamPurse.maxAllowedBid
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070c18] text-white font-sans select-none">
      <DisplayConnectionBanner
        feedState={feed.state}
        secondsSinceLastActivity={feed.secondsSinceLastActivity}
        placement="inline"
      />
      <LocalOperatorPinBar tournamentId={tournamentId} />

      {/* ════════════ TOP NAVIGATION BAR (BALANCED TACTICAL CONSOLE) ════════════ */}
      <header className="h-13 sm:h-14 border-b border-white/10 bg-[#0B1120] px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 z-30 shadow-md">
        {/* Left: Brand & Tournament Info (Flexible, No Aggressive Truncation) */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 mr-2">
          <img src={brandLogoSrc} alt={brandName} className="h-6.5 sm:h-7.5 w-auto shrink-0" />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate max-w-[260px] md:max-w-[380px] lg:max-w-[480px] xl:max-w-none">
              {tournament?.name || "Live Auction"}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
              isActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 animate-pulse" :
              isPaused ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/35" :
              isCompleted ? "bg-blue-500/20 text-blue-300 border border-blue-500/35" :
              isPreAuction ? "bg-amber-400/15 text-amber-300 border border-amber-400/30" :
              "bg-white/10 text-white/50"
            }`}>
              {isActive ? "LIVE" : isPaused ? "PAUSED" : isCompleted ? "COMPLETED" : isPreAuction ? "PRE-AUCTION" : "OFFLINE"}
            </span>
          </div>

          {/* Tournament Code Chip with Click-to-Copy */}
          {tournamentCode && (
            <button
              type="button"
              onClick={copyCode}
              title="Click to copy join code"
              className="hidden lg:inline-flex items-center gap-1 h-7.5 px-2 rounded-lg text-xs font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/25 hover:bg-amber-400/20 transition-all cursor-pointer shadow-xs shrink-0"
            >
              #{tournamentCode}
              {codeCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-300/70" />}
            </button>
          )}
        </div>

        {/* Center: Live Counters & Status Badges */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Counters Strip (Compact Balanced HUD) */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono font-bold shadow-xs">
            <span className="text-emerald-400">SOLD {statusCounts.sold}</span>
            <span className="text-white/20">·</span>
            <span className="text-rose-400">UNSOLD {statusCounts.unsold}</span>
            <span className="text-white/20">·</span>
            <span className="text-amber-300">LEFT {statusCounts.available}</span>
            {statusCounts.retained > 0 && (
              <>
                <span className="text-white/20">·</span>
                <span className="text-purple-300">RET {statusCounts.retained}</span>
              </>
            )}
          </div>

          {/* On-Air Live Indicator Badges (Click opens Studio Drawer focused on that screen) */}
          <button
            type="button"
            onClick={() => openStudioToTab("led")}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 transition-all cursor-pointer shadow-xs"
            title="Configure LED Stage Screen Overlays — Opens LED Studio Tab"
          >
            <Tv2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-white/50 uppercase font-bold">LED:</span>
            <span className="font-bold">{!state?.displayOverlay ? "MAIN View" : state.displayOverlay.toUpperCase()}</span>
          </button>

          <button
            type="button"
            onClick={() => openStudioToTab("obs")}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/35 hover:bg-rose-500/25 transition-all cursor-pointer shadow-xs"
            title="Configure OBS Live Stream Graphics &amp; Prize Plate — Opens OBS Studio Tab"
          >
            <Gavel className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-[10px] text-white/50 uppercase font-bold">OBS:</span>
            <span className="font-bold capitalize">{presentationContext.context || "Live Auction"}</span>
          </button>
        </div>

        {/* Right: Controls & Studio Drawer Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Pause / Resume Button */}
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handlePauseAuction}
              className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 shadow-xs"
            >
              <Pause className="w-3.5 h-3.5 mr-1" /> Pause
            </Button>
          ) : isPaused ? (
            <Button
              size="sm"
              onClick={handleStartAuction}
              className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
            >
              <Play className="w-3.5 h-3.5 mr-1 fill-current" /> Resume
            </Button>
          ) : isPreAuction ? (
            <Button
              size="sm"
              onClick={handleStartAuction}
              disabled={controlsLocked || startAuction.isPending}
              className="h-8 px-2.5 sm:px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
            >
              <Play className="w-3.5 h-3.5 mr-1 fill-current" /> {startAuction.isPending ? "Starting…" : "Start Live"}
            </Button>
          ) : null}

          {/* Primary Studio Drawer Button */}
          <Button
            size="sm"
            onClick={() => setStudioDrawerOpen(true)}
            className="h-8 px-3 text-xs font-bold rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-xs transition-all"
          >
            <Tv2 className="w-3.5 h-3.5 mr-1" /> Studio
          </Button>

          {/* Quick Bid History Trigger Button */}
          <button
            type="button"
            onClick={() => setBidHistoryOpen(true)}
            className="hidden xl:inline-flex items-center gap-1.5 h-8 px-2 rounded-lg text-xs font-bold text-amber-300/80 hover:text-amber-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="View recent bids log"
          >
            <Gavel className="w-3.5 h-3.5 text-amber-400" />
            <span>Bids</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-amber-400/15 text-amber-300">
              {bids?.length || 0}
            </span>
          </button>

          {/* Switch to Classic V1 Link */}
          <a
            href={`/tournament/${tournamentId}/auction?v=1`}
            className="hidden 2xl:inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
            title="Switch back to Classic V1 layout"
          >
            📻 Classic V1
          </a>

          {/* Fullscreen Toggle Button */}
          <FullscreenButton
            size="sm"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/10 transition-colors shadow-xs"
          />

          {/* Toggle Right Panel */}
          <button
            type="button"
            title={rightCollapsed ? "Show Teams" : "Hide Teams"}
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="hidden lg:flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] text-white/70 hover:text-white transition-colors"
          >
            {rightCollapsed ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Nuanced lock-state banners (fail-closed, retrying, locked with takeover) */}
      {operatorLockStatus === "retrying" && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-xs border-b z-20 bg-yellow-500/10 border-yellow-500/25 text-yellow-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 animate-pulse" />
          Acquiring operator lock… (network issue — retrying)
        </div>
      )}

      {operatorLockStatus === "locked" && (
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 text-xs border-b z-20 bg-orange-500/10 border-orange-500/25 text-orange-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Read-only — another operator tab is controlling this auction.
          </div>
          <button
            onClick={() => { void operatorTakeover(); }}
            className="ml-2 px-2.5 py-1 rounded text-xs font-bold bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/40 transition-colors cursor-pointer"
            title="Force-take control of this auction (use only if the other tab is unresponsive)"
          >
            Take Over
          </button>
        </div>
      )}

      {operatorLockStatus === "unavailable" && (
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 text-xs border-b z-20 bg-yellow-500/10 border-yellow-500/25 text-yellow-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Read-only — could not verify operator lock (network issue).
          </div>
          <button
            onClick={() => { void operatorTakeover(); }}
            className="ml-2 px-2.5 py-1 rounded text-xs font-bold bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/40 transition-colors cursor-pointer"
            title="Retry taking control of this auction"
          >
            Retry
          </button>
        </div>
      )}

      {/* ════════════ 3-ZONE MAIN WORKSPACE (BALANCED GRID) ════════════ */}
      <div className={`flex-1 grid grid-cols-1 min-h-0 overflow-hidden ${
        rightCollapsed
          ? "lg:grid-cols-[330px_1fr]"
          : "lg:grid-cols-[330px_1fr_290px] xl:grid-cols-[350px_1fr_310px] 2xl:grid-cols-[370px_1fr_330px]"
      }`}>

        {/* ══ ZONE 1: LEFT PLAYER QUEUE & DRAW MODE ══ */}
        <aside className="border-r border-white/8 flex flex-col min-h-0 overflow-hidden bg-[#0A101D]">
          {/* Section A: In-Place Draw Mode Segmented Switcher */}
          <div className="p-2.5 sm:p-3 border-b border-white/8 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                Draw Sequence
              </span>
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                selectionMode === "manual" ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" :
                selectionMode === "random" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              }`}>
                {selectionMode === "manual" ? "Manual Pick" : selectionMode === "random" ? "Random Pool" : "In Order"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-black/40 border border-white/10">
              {[
                { mode: "random" as const, label: "Random", icon: Shuffle },
                { mode: "sequential" as const, label: "Order", icon: SkipForward },
                { mode: "manual" as const, label: "Manual", icon: User },
              ].map(({ mode, label, icon: Icon }) => {
                const isSelected = selectionMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleUpdateDrawMode(mode)}
                    disabled={controlsLocked}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-amber-400 text-slate-950 shadow-xs font-black"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Search & Status Filters */}
          <div className="p-2.5 border-b border-white/8 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              <input
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search player name or #..."
                className="w-full h-9 pl-8 pr-7 bg-white/5 border border-white/10 rounded-lg text-xs sm:text-sm text-white placeholder:text-white/35 focus:border-amber-400/50 outline-none transition-all"
              />
              {playerSearch && (
                <button
                  type="button"
                  onClick={() => setPlayerSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 5-Column Filter Grid */}
            <div className="grid grid-cols-5 gap-1">
              {[
                { k: "all", l: "All", c: statusCounts.all },
                { k: "available", l: "Avail", c: statusCounts.available },
                { k: "sold", l: "Sold", c: statusCounts.sold },
                { k: "unsold", l: "Unsold", c: statusCounts.unsold },
                { k: "retained", l: "Ret", c: statusCounts.retained },
              ].map(({ k, l, c }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStatusFilter(k)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-xs font-bold transition-all ${
                    statusFilter === k
                      ? "bg-white/20 text-white border-white/30 shadow-xs"
                      : "bg-white/[0.02] text-white/50 border-white/5 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold">{l}</span>
                  <span className="text-xs font-mono font-bold mt-0.5">{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section C: Player Scroll List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1.5">
              {leftPanelList.map((player) => {
                const isNowOn = state?.currentPlayer?.id === player.id;
                const isAvail = player.status === "available";
                const isSold = player.status === "sold";
                const isUnsold = player.status === "unsold";
                const isRet = player.status === "retained";

                return (
                  <div
                    key={player.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isNowOn
                        ? "bg-amber-400/15 border-amber-400/50 text-white shadow-xs ring-1 ring-amber-400/30"
                        : "bg-white/[0.02] border-white/6 text-white/80 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-amber-400 shrink-0">
                            #{player.serialNo ?? player.id}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white truncate">{player.name}</span>
                          {player.role && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-semibold shrink-0">
                              {player.role}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          Base: <span className="font-mono font-semibold text-white/80">{formatShort(player.basePrice)}</span>
                        </p>
                      </div>

                      {/* Go / Action Button */}
                      {isNowOn ? (
                        <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-md border border-amber-400/30">
                          ON STAGE
                        </span>
                      ) : isAvail ? (
                        <button
                          type="button"
                          disabled={controlsLocked || !isActive || hasPlayer || timerActive || nextPlayer.isPending}
                          onClick={() => handleNextPlayer("sequential", player.id)}
                          title={
                            isPreAuction
                              ? "Start auction first to nominate player"
                              : hasPlayer
                              ? "Hammer or defer current player first"
                              : selectionMode !== "manual"
                              ? "Direct Pick (Switches to this player)"
                              : "Load this player onto stage"
                          }
                          className="h-7.5 min-w-[48px] px-3 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all cursor-pointer shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Go
                        </button>
                      ) : isSold ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                            SOLD
                          </span>
                          <button
                            type="button"
                            disabled={controlsLocked || !isActive || isPaused || reAuction.isPending}
                            onClick={() => openSingleReAuctionDialog(player.id)}
                            title="Put player back on block for re-auction"
                            className="h-6 px-1.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[10px] font-bold border border-orange-500/30 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> ↺
                          </button>
                        </div>
                      ) : isUnsold ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md">
                            UNSOLD
                          </span>
                          <button
                            type="button"
                            disabled={controlsLocked || !isActive || isPaused || reAuction.isPending}
                            onClick={() => openSingleReAuctionDialog(player.id)}
                            title="Put unsold player on block for re-auction"
                            className="h-6 px-1.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[10px] font-bold border border-orange-500/30 flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> ↺
                          </button>
                        </div>
                      ) : isRet ? (
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-md">
                          RET
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* ══ ZONE 2: CENTER LIVE STAGE & BIDDING PAD ══ */}
        <main className="flex flex-col min-h-0 overflow-y-auto bg-[#070c18] p-3 sm:p-4 space-y-3">
          {/* Top Sub-Bar: Mobile Bidding Toggle & Timer Quick Config */}
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/8 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xs sm:text-sm font-bold text-white/70">
                {hasPlayer ? "Active Round" : "Stage Idle"}
              </span>
              <span className="text-white/20">|</span>
              {/* Compact Mobile Owner Bidding Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (ownerBiddingEnabled) setConfirmDisableOwnerBiddingOpen(true);
                  else setConfirmEnableOwnerBiddingOpen(true);
                }}
                className={`flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                  ownerBiddingEnabled
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-white/5 text-white/50 border-white/10"
                }`}
                title="Toggle online mobile bidding for team owners"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile Bidding: {ownerBiddingEnabled ? "ON" : "OFF"}
              </button>
            </div>

            {/* Timing Quick Config */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/50 font-mono text-xs font-semibold">
                Opening: {openingTimerSecs}s · Bid: {bidTimerSecs}s
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTimingSettingsOpen(!timingSettingsOpen)}
                className="h-7 px-2 text-white/60 hover:text-white"
                title="Configure timer windows"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Timing Config Collapsible */}
          {timingSettingsOpen && (
            <div className="p-3.5 rounded-xl bg-[#0f172a] border border-white/15 grid grid-cols-2 gap-3 text-xs">
              <div>
                <Label className="text-xs text-white/70 mb-1.5 block font-semibold">Opening Timer (seconds)</Label>
                <Input
                  type="number"
                  value={openingTimerSecs}
                  onChange={(e) => setOpeningTimerSecs(e.target.value)}
                  className="h-8 text-xs bg-black/40 border-white/15 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-white/70 mb-1.5 block font-semibold">Subsequent Bid Timer (seconds)</Label>
                <Input
                  type="number"
                  value={bidTimerSecs}
                  onChange={(e) => setBidTimerSecs(e.target.value)}
                  className="h-8 text-xs bg-black/40 border-white/15 rounded-lg"
                />
              </div>
            </div>
          )}

          {/* The Main Stage Card (Balanced Proportion) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0e1628] border border-white/10 shadow-lg relative overflow-hidden">
            {hasPlayer && currentPlayer ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-center">
                {/* Left: Player Avatar & Details (7 cols) */}
                <div className="md:col-span-7 flex items-start gap-3 sm:gap-3.5">
                  <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                    {currentPlayer.photoUrl ? (
                      <img
                        src={cldUrl(currentPlayer.photoUrl, "playerCard")}
                        alt={currentPlayer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-white/20" />
                    )}
                  </div>
                  <div className="space-y-0.5 sm:space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        #{currentPlayer.serialNo ?? currentPlayer.id}
                      </span>
                      {currentPlayer.categoryId && categoryMap[currentPlayer.categoryId] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-white/10 text-white/80">
                          {categoryMap[currentPlayer.categoryId]?.name}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight truncate">
                      {currentPlayer.name}
                    </h2>
                    <p className="text-xs text-white/60">
                      Base Price:{" "}
                      <span className="font-mono font-bold text-amber-300">
                        {formatShort(currentPlayer.basePrice)}
                      </span>
                    </p>
                    <OperatorPlayerAuctionHistory
                      tournamentId={tournamentId}
                      playerId={currentPlayer.id}
                      unit={{ formatShort, formatAmount }}
                    />
                  </div>
                </div>

                {/* Right: Current Bid & Countdown Clock (5 cols) */}
                <div className="md:col-span-5 flex flex-col items-center md:items-end justify-center p-3 rounded-xl bg-black/40 border border-white/8 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                    Current Bid
                  </span>
                  <div className="font-mono text-2xl sm:text-3xl lg:text-4xl font-black text-amber-400 tracking-tight leading-none">
                    {formatShort(currentBid || currentPlayer.basePrice)}
                  </div>
                  {state?.currentBidTeamName ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: state.currentBidTeamColor || "#3b82f6" }}
                      />
                      <span className="text-xs font-bold text-white truncate max-w-[170px]">
                        {state.currentBidTeamName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-white/40 italic mt-0.5">Waiting for opening bid...</span>
                  )}
                  {timerEndsAt && (
                    <div className="pt-1">
                      <ServerCountdown variant="operator" timerEndsAt={timerEndsAt} timerType={state?.timerType} />
                    </div>
                  )}
                </div>

                {/* ── Stage Auctioneer Prompter & Scarcity Radar (P2) ── */}
                <div className="md:col-span-12 pt-2.5 border-t border-white/10">
                  <StageAuctioneerPrompterRadar
                    tournamentId={tournamentId}
                    playerId={currentPlayer.id}
                  />
                </div>
              </div>
            ) : isPreAuction ? (
              <div className="py-7 sm:py-9 px-4 sm:px-6 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-b from-emerald-500/10 via-emerald-950/20 to-transparent rounded-2xl border border-emerald-500/25 shadow-lg relative overflow-hidden">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Pre-Auction Staged &amp; Ready
                </div>
                <div className="space-y-1.5 max-w-lg">
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Ready to Launch Live Auction
                  </h3>
                  <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                    <span className="font-bold text-white">{teams?.length ?? 0} Teams</span> and{" "}
                    <span className="font-bold text-amber-300">{statusCounts.available} Available Players</span> are staged and ready. Starting the auction will synchronize venue displays, open team bidding pads, and unlock player nominations.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleStartAuction}
                  disabled={controlsLocked || startAuction.isPending}
                  className="h-11 sm:h-12 px-6 sm:px-8 text-xs sm:text-sm font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 ring-1 ring-emerald-400/50 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {startAuction.isPending ? "Starting Live Auction…" : "START LIVE AUCTION"}
                </Button>
              </div>
            ) : (
              <div className="py-6 sm:py-7 flex flex-col items-center justify-center text-center space-y-2">
                <Gavel className="w-10 h-10 text-white/15" />
                <h3 className="text-base sm:text-lg font-bold text-white/80">No Player on Stage</h3>
                <p className="text-xs text-white/50 max-w-sm">
                  Click <strong className="text-amber-400 font-bold">NEXT PLAYER</strong> or choose a player from the queue to start bidding.
                </p>
              </div>
            )}
            {/* Reauction Last Player banner */}
            {canReauctionLastSale && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => void handleInstantReauction()}
                  disabled={controlsLocked || reAuction.isPending}
                  className="w-full h-8.5 rounded-xl border border-orange-500/40 bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  title={`Reverse ${lastSoldPlayer?.name}'s sale and re-auction [Z]`}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-400" />
                  <span>↺ Re-auction Last Player ({lastSoldPlayer?.name}) [Z]</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Row: Hammer Buttons (Balanced Mid-Way Height: 40-42px / h-10 sm:h-10.5) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              disabled={controlsLocked || !hasPlayer || !hasBid || timerActive || sellPlayer.isPending}
              onClick={handleSell}
              className="h-10 sm:h-10.5 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs border border-emerald-400/40 disabled:opacity-35 rounded-xl transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> SOLD (Enter)
            </Button>
            <Button
              disabled={controlsLocked || !hasPlayer || timerActive || hasBid || markUnsold.isPending}
              onClick={handleUnsold}
              title={
                hasBid
                  ? "Cannot mark unsold while a bid is active. Conclude by marking SOLD or deferring."
                  : undefined
              }
              variant="outline"
              className="h-10 sm:h-10.5 font-bold text-xs border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 disabled:opacity-35 rounded-xl transition-all"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> UNSOLD (U)
            </Button>
            <Button
              disabled={controlsLocked || !hasPlayer || timerActive || deferPlayerMut.isPending}
              onClick={handleDeferPlayer}
              variant="outline"
              className="h-10 sm:h-10.5 font-bold text-xs border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-35 rounded-xl transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> DEFER (D)
            </Button>
            <Button
              disabled={controlsLocked || !hasPlayer || timerActive}
              onClick={openManualSellDialog}
              variant="outline"
              className="h-10 sm:h-10.5 font-bold text-xs border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 disabled:opacity-35 rounded-xl transition-all"
            >
              <User className="w-3.5 h-3.5 mr-1.5" /> MANUAL SELL (M)
            </Button>
          </div>

          {/* Big CTA Row: Next Player & Start Bidding (Tactical Proportion: 44-46px / h-11 sm:h-11.5) */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <button
              disabled={controlsLocked || !isActive || hasPlayer || timerActive || nextPlayer.isPending || isRandomRevealing}
              onClick={() => handleNextPlayer(selectionMode === "random" ? "random" : "sequential")}
              title={
                controlsLocked
                  ? (operatorReadOnly ? "Locked by another session - click Take Over above" : "Auction controls locked")
                  : isPreAuction
                  ? "Click START LIVE AUCTION above to begin session"
                  : undefined
              }
              className="sm:col-span-3 h-11 sm:h-11.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.25)] transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
            >
              {selectionMode === "random" ? <Shuffle className="w-4 h-4" /> : <SkipForward className="w-4 h-4" />}
              NEXT PLAYER
              <span className="text-[11px] font-semibold opacity-75">
                ({selectionMode === "random" ? "Random Pool" : selectionMode === "manual" ? "Manual Pick" : "In Order"})
              </span>
            </button>

            {timerActive ? (
              <>
                <button
                  onClick={handleStopTimer}
                  disabled={controlsLocked || stopTimerMut.isPending}
                  className="sm:col-span-2 h-11 sm:h-11.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-yellow-500/15 border border-yellow-400/50 text-yellow-300 hover:bg-yellow-500/25 transition-all cursor-pointer shadow-xs"
                >
                  <Pause className="w-4 h-4" /> PAUSE CURRENT BID
                </button>
                <button
                  onClick={handleExtendTimer}
                  disabled={controlsLocked || startTimerMut.isPending}
                  title="Add 30 seconds to the timer"
                  className="sm:col-span-1 h-11 sm:h-11.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1 bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-all cursor-pointer shadow-xs disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> +30s
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartBiddingClick}
                  disabled={controlsLocked || !hasPlayer || !isActive || startTimerMut.isPending}
                  title={
                    controlsLocked
                      ? (operatorReadOnly ? "Locked by another session - click Take Over above" : "Auction controls locked")
                      : isPreAuction
                      ? "Start live auction first"
                      : !hasPlayer
                      ? "Load player onto stage first"
                      : undefined
                  }
                  className="sm:col-span-2 h-11 sm:h-11.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {currentBidPaused ? "RESUME BIDDING" : "START BIDDING"}
                </button>
                <button
                  onClick={handleExtendTimer}
                  disabled={controlsLocked || !hasPlayer || !isActive || startTimerMut.isPending}
                  title="Start timer with +30 extra seconds"
                  className="sm:col-span-1 h-11 sm:h-11.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1 bg-white/10 hover:bg-white/15 border border-white/20 text-white transition-all cursor-pointer shadow-xs disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> +30s
                </button>
              </>
            )}
          </div>

          {/* Quick Bid Team Pad (2-Row Layout: 100% Team Name Width, Zero Truncation) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                Quick Bid Pad · Next: {formatShort(nextBidAmount)}
              </span>
              <span className="text-[11px] text-white/50">
                Click team to place bid (+{formatShort(state?.bidIncrement ?? 50000)})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(teams || []).map((team) => {
                const pData = teamPurses?.find((p) => p.teamId === team.id);
                const cap = pData?.effectiveCapacity ?? team.purse ?? 0;
                const pUsed = team.purseUsed ?? 0;
                const rem = Math.max(0, cap - pUsed);
                const maxB = pData?.maxAllowedBid ?? rem;
                const squad = resolveSquadMetrics(
                  pData?.playersBought ?? 0,
                  pData?.minimumSquadSize || tournament?.minimumSquadSize || 0,
                  pData?.maximumSquadSize || tournament?.maximumSquadSize || 0,
                );
                const canAfford = maxB >= nextBidAmount;
                const isCurrentBidder = state?.currentBidTeamId === team.id;
                const isTrialRestricted = isTrialMode && trialTeamIds != null && !isTeamEligibleForTrialAuction(team.id, trialTeamIds);
                const canBid = !controlsLocked && hasPlayer && canAfford && !isCurrentBidder && !squad.isSquadFull && !isTrialRestricted && team.isBiddingEnabled !== false && !bidGateLocked;

                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={!canBid}
                    onClick={() => handleBid(team.id)}
                    className={`flex flex-col justify-between p-2 sm:p-2.5 h-[52px] rounded-xl border text-left transition-all relative ${
                      isCurrentBidder
                        ? "bg-amber-400/20 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.25)] ring-1 ring-amber-400/40"
                        : canAfford && !squad.isSquadFull
                        ? "bg-white/[0.03] border-white/8 hover:bg-white/8 hover:border-white/20 active:scale-[0.98]"
                        : "bg-white/[0.01] border-white/5 opacity-30 cursor-not-allowed"
                    }`}
                    style={{ borderLeft: `4px solid ${team.color || "#888"}` }}
                    title={
                      controlsLocked
                        ? (operatorReadOnly ? "Locked by another session - click Take Over above" : "Auction controls locked")
                        : !timerActive
                        ? "Click START BIDDING first to open bidding"
                        : isCurrentBidder
                        ? "Holding highest bid"
                        : squad.isSquadFull
                        ? `Squad is full (${squad.playersBought}/${squad.squadCap})`
                        : !canAfford
                        ? `Cannot afford next bid (${formatShort(nextBidAmount)} > max allowable ${formatShort(maxB)})`
                        : `Bid ${formatShort(nextBidAmount)} for ${team.name}`
                    }
                  >
                    {/* Top Row: Full-width Team Name with Lead Badge */}
                    <div className="w-full flex items-center justify-between gap-1">
                      <p className="text-xs font-bold truncate text-white leading-tight">
                        {team.name}
                      </p>
                      {isCurrentBidder && (
                        <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-400/25 px-1.5 py-0.2 rounded shrink-0">
                          LEAD
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Max Bid on Left, Bid Increment on Right */}
                    <div className="w-full flex items-center justify-between gap-1 text-[11px] font-mono leading-none">
                      <span className="text-white/50 text-[10px]">
                        Max: <strong className="text-white/80">{formatShort(maxB)}</strong>
                      </span>
                      {!isCurrentBidder && canAfford && !squad.isSquadFull && (
                        <span className="font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded text-[11px]">
                          +{formatShort(state?.bidIncrement ?? 50000)}
                        </span>
                      )}
                      {!isCurrentBidder && squad.isSquadFull && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.2 rounded">
                          FULL
                        </span>
                      )}
                      {!isCurrentBidder && !canAfford && !squad.isSquadFull && (
                        <span className="text-[10px] text-rose-400/80 font-bold">
                          OUT
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </main>

        {/* ══ ZONE 3: RIGHT TEAMS & PURSE PANEL ══ */}
        <aside className={`border-l border-white/8 flex flex-col min-h-0 overflow-hidden bg-[#0A101D] ${
          rightCollapsed ? "hidden" : "flex"
        }`}>
          <div className="p-2.5 sm:p-3 border-b border-white/8 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                Teams &amp; Purse
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-white/40">
              {teams?.length ?? 0} Teams
            </span>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-1.5">
              {(teams || []).map((team) => {
                const pData = teamPurses?.find((p) => p.teamId === team.id);
                const cap = pData?.effectiveCapacity ?? team.purse ?? 0;
                const pUsed = team.purseUsed ?? 0;
                const rem = Math.max(0, cap - pUsed);
                const maxB = pData?.maxAllowedBid ?? rem;
                const squad = resolveSquadMetrics(
                  pData?.playersBought ?? 0,
                  pData?.minimumSquadSize || tournament?.minimumSquadSize || 0,
                  pData?.maximumSquadSize || tournament?.maximumSquadSize || 0,
                );
                const isCurrent = state?.currentBidTeamId === team.id;

                return (
                  <div
                    key={team.id}
                    className={`p-2 rounded-xl border transition-all ${
                      isCurrent
                        ? "bg-amber-400/10 border-amber-400/40 shadow-xs ring-1 ring-amber-400/30"
                        : "bg-white/[0.02] border-white/6 hover:bg-white/[0.05]"
                    }`}
                    style={{ borderLeft: `3.5px solid ${team.color || "#888"}` }}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-white truncate max-w-[170px]">{team.name}</span>
                      <span className="text-[10px] font-mono font-semibold bg-white/10 px-1.5 py-0.2 rounded text-white/80 shrink-0">
                        Squad {squad.playersBought}/{squad.squadCap}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-white/40 uppercase font-bold block leading-none mb-0.5">Avail Purse</span>
                        <span className="text-xs font-bold text-emerald-400 leading-tight">{formatShort(rem)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-white/40 uppercase font-bold block leading-none mb-0.5">Max Bid</span>
                        <span className="text-xs font-bold text-amber-300 leading-tight">{formatShort(maxB)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer Trigger for Last Biddings Actions & History */}
          <div className="p-2 border-t border-white/8 bg-black/30 shrink-0">
            <button
              type="button"
              onClick={() => setBidHistoryOpen(true)}
              className="w-full h-8 flex items-center justify-between px-3 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 active:scale-[0.99] text-amber-300 text-xs font-bold transition-all shadow-xs group"
              title="Click to view full bid history & last actions"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Gavel className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:rotate-12 transition-transform" />
                <span className="truncate">Last Bid Actions</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                {bids?.length || 0} {bids?.length === 1 ? "bid" : "bids"}
              </span>
            </button>
          </div>
        </aside>
      </div>

      {/* ════════════ MODALS & DRAWERS ════════════ */}

      {/* Broadcast Studio Drawer */}
      <BroadcastStudioDrawer
        open={studioDrawerOpen}
        onOpenChange={setStudioDrawerOpen}
        activeTab={studioDrawerTab}
        onTabChange={setStudioDrawerTab}
        tournamentId={tournamentId}
        operatorReadOnly={operatorReadOnly}
        ledOverlay={state?.displayOverlay ?? null}
        onSelectLedOverlay={async (mode) => {
          try {
            const res = await setDisplayOverlay.mutateAsync({
              tournamentId,
              data: { mode },
            });
            applyMutationResult(res);
            toast({ title: `LED: ${mode.toUpperCase()}` });
          } catch (err) {
            toast({ title: "Failed to update LED", variant: "destructive" });
          }
        }}
        displayPlayerFilter={state?.displayPlayerFilter}
        onSelectPlayerFilter={async (filter) => {
          try {
            const res = await setDisplayPlayerFilterMut.mutateAsync({
              tournamentId,
              data: {
                status: filter.status,
                categoryId: filter.categoryId ?? null,
                teamId: filter.teamId ?? null,
              },
            });
            applyMutationResult(res);
            if (state?.displayOverlay !== "player") {
              const overlayRes = await setDisplayOverlay.mutateAsync({
                tournamentId,
                data: { mode: "player" },
              });
              applyMutationResult(overlayRes);
            }
            toast({ title: `LED Filter: ${filter.status.toUpperCase()}` });
          } catch (err) {
            toast({ title: "Failed to update LED filter", variant: "destructive" });
          }
        }}
        teams={teams?.map((t) => ({ id: t.id, name: t.name, color: t.color, shortCode: t.shortCode }))}
        categories={categories?.map((c) => ({ id: c.id, name: c.name }))}
        playerPoolCounts={{
          total: players?.length ?? 0,
          available:
            players?.filter((p) => p.status === "queue" || p.status === "available" || p.status === "live").length ?? 0,
          sold: players?.filter((p) => p.status === "sold").length ?? 0,
          unsold: players?.filter((p) => p.status === "unsold").length ?? 0,
          retained: players?.filter((p) => p.status === "retained").length ?? 0,
        }}
        presentationContext={presentationContext}
        onSelectObsPresentation={async (context) => {
          try {
            const res = await setPresentationMut.mutateAsync({
              tournamentId,
              data: { context, expectedRevision: presentationContext.revision ?? 0 },
            });
            applyMutationResult(res);
            toast({ title: `OBS: ${context.toUpperCase()}` });
          } catch (err) {
            toast({ title: "Failed to update OBS", variant: "destructive" });
          }
        }}
        onAppliedPresentationState={applyMutationResult}
        onOpenBreakTimer={() => {
          setStudioDrawerOpen(false);
          setCountdownDialogOpen(true);
        }}
        breakTimerActive={Boolean(currentCountdown?.endsAt)}
        breakTimerMusicMuted={currentCountdown?.musicMuted}
        onToggleBreakMusic={async () => {
          const muted = currentCountdown?.musicMuted === true;
          try {
            const res = await setBreakTimerMut.mutateAsync({
              tournamentId,
              data: { action: muted ? "unmute_music" : "mute_music" },
            });
            applyMutationResult(res);
          } catch (err) {}
        }}
        onOpenFortuneWheel={() => {
          setStudioDrawerOpen(false);
          setShowFortuneWheel(true);
        }}
        onOpenPurseBooster={() => {
          setStudioDrawerOpen(false);
          setShowPurseBooster(true);
        }}
        onBringUnsold={() => {
          setStudioDrawerOpen(false);
          setShowBatchReAuctionConfirm(true);
        }}
        unsoldPlayersCount={statusCounts.unsold}
        bringUnsoldDisabled={bringUnsoldDisabled}
        isActive={isActive}
        isPaused={isPaused}
        isPreAuction={isPreAuction}
        onStartResumeAuction={handleStartAuction}
        onPauseAuction={handlePauseAuction}
        onConcludeAuction={() => setConcludeDialogOpen(true)}
        mainRoundExhausted={mainRoundExhausted}
      />

      {/* ════════════ ENHANCED DIALOGS ════════════ */}

      {/* 1. Bid History / Last Actions Dialog (Balanced Scale) */}
      <Dialog open={bidHistoryOpen} onOpenChange={setBidHistoryOpen}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#0D1527] border border-white/20 text-white rounded-2xl shadow-2xl">
          <DialogHeader className="px-5 py-4 border-b border-white/10 bg-white/[0.03] shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-white">
                <Gavel className="w-4 h-4 text-amber-400" />
                Last Biddings Actions &amp; History
              </DialogTitle>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                {bids?.length || 0} {bids?.length === 1 ? "bid" : "bids"}
              </span>
            </div>
            <DialogDescription className="text-xs text-white/60 mt-0.5">
              Real-time chronological log of recent bids placed during this auction.
            </DialogDescription>
          </DialogHeader>

          {/* Latest Bid Banner */}
          {bids && bids.length > 0 && (
            <div className="px-5 py-2.5 bg-amber-400/10 border-b border-amber-400/20 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                <p className="text-xs text-amber-200 font-bold truncate">
                  {bids[0]?.teamName ? `${bids[0].teamName} holds ${formatAmount(bids[0].amount)}` : "Latest bid placed"}
                </p>
              </div>
              {bids[0]?.playerName && (
                <span className="text-xs text-amber-300/80 font-semibold truncate shrink-0">
                  for {bids[0].playerName}
                </span>
              )}
            </div>
          )}

          {/* Scrollable Bid List */}
          <ScrollArea className="flex-1 min-h-0 max-h-[50vh] p-3.5 sm:p-4">
            {bids && bids.length > 0 ? (
              <div className="space-y-1.5">
                {bids.map((bid, i) => {
                  const t = teamMap[bid.teamId];
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        i === 0
                          ? "bg-amber-400/15 border-amber-400/40 shadow-xs ring-1 ring-amber-400/30"
                          : "bg-white/[0.03] border-white/8 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/20"
                          style={{ backgroundColor: t?.color || "#888" }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">
                            {bid.playerName || "Current Player"}
                          </p>
                          <p className="text-[11px] text-white/50 truncate">
                            {bid.teamName || t?.name || "Unknown Team"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <div className="text-xs sm:text-sm font-mono font-bold text-amber-300">
                          {formatAmount(bid.amount)}
                        </div>
                        {i === 0 && (
                          <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-400/20 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                            Latest
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-white/40 space-y-2">
                <Gavel className="w-10 h-10 opacity-30" />
                <p className="text-sm font-bold text-white/60">No bids recorded yet</p>
                <p className="text-xs text-white/40 max-w-xs">Bids placed during the live session will show up here in real time.</p>
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t border-white/10 bg-white/[0.02] flex justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBidHistoryOpen(false)}
              className="h-8.5 px-4 text-xs font-bold bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-lg"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Enhanced Manual Sell Dialog (Balanced Scale) */}
      <Dialog open={manualSellOpen} onOpenChange={setManualSellOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto bg-[#0D1527] border border-white/20 text-white rounded-2xl p-5 sm:p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" /> Manual Sell Player
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Directly award the active player to a specific team at a designated price.
            </DialogDescription>
          </DialogHeader>

          {/* Active Player Card Summary */}
          {currentPlayer && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/10 mt-1">
              <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 border border-white/20 bg-white/5 flex items-center justify-center">
                {currentPlayer.photoUrl ? (
                  <img
                    src={cldUrl(currentPlayer.photoUrl, "playerCard")}
                    alt={currentPlayer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-white/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-sm sm:text-base truncate">
                    {currentPlayer.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono font-bold">
                    #{currentPlayer.serialNo ?? currentPlayer.id}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/60 mt-0.5">
                  <span>
                    Base: <strong className="text-white/90 font-mono">{formatShort(currentPlayer.basePrice)}</strong>
                  </span>
                  {currentBid > 0 && (
                    <span>
                      Current Bid: <strong className="text-amber-400 font-mono">{formatShort(currentBid)}</strong>
                    </span>
                  )}
                  <span>
                    Step: <strong className="text-white/80 font-mono">+{formatShort(state?.bidIncrement ?? 50000)}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-2">
            {/* Team Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-white/80">
                1. Select Winning Team <span className="text-rose-400">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                {(teams || []).map((t) => {
                  const isSel = manualTeamId === String(t.id);
                  const pData = teamPurses?.find((p) => p.teamId === t.id);
                  const cap = pData?.effectiveCapacity ?? t.purse ?? 0;
                  const pUsed = t.purseUsed ?? 0;
                  const rem = Math.max(0, cap - pUsed);
                  const maxB = pData?.maxAllowedBid ?? rem;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setManualTeamId(String(t.id))}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSel
                          ? "bg-sky-500/20 border-sky-400 text-white shadow-xs ring-1 ring-sky-400/50"
                          : "bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.07] hover:text-white"
                      }`}
                      style={{ borderLeft: `4px solid ${t.color || "#888"}` }}
                    >
                      <p className="font-bold text-xs truncate">{t.name}</p>
                      <p className="text-[10px] font-mono text-white/50 mt-0.5">
                        Max: {formatShort(maxB)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selling Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-white/80">
                  2. Selling Amount <span className="text-rose-400">*</span>
                </Label>
                {selectedManualTeamPurse && (
                  <span className="text-xs font-mono font-bold text-amber-300">
                    Max: {formatShort(selectedManualTeamPurse.maxAllowedBid)}
                  </span>
                )}
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  currentPlayer?.basePrice ?? 0,
                  (currentPlayer?.basePrice ?? 0) + (state?.bidIncrement ?? 50000),
                  (currentPlayer?.basePrice ?? 0) + (state?.bidIncrement ?? 50000) * 2,
                  (currentPlayer?.basePrice ?? 0) + (state?.bidIncrement ?? 50000) * 5,
                ].map((amt, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setManualAmount(String(amt))}
                    className="h-7.5 px-2.5 text-xs font-mono font-bold bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-lg"
                  >
                    {formatShort(amt)}
                  </Button>
                ))}
              </div>

              <Input
                type="number"
                placeholder="Enter selling amount..."
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="h-10 text-sm font-mono font-bold bg-black/60 border-white/20 rounded-xl px-3"
              />
              <IndianAmountHint value={manualAmount} />

              {/* Live Purse Over-Limit Alert */}
              {manualAmountExceedsPurse && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Amount exceeds <strong>{selectedManualTeam?.name}</strong>'s max allowable purse!</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManualSellOpen(false)}
                className="h-9 px-4 text-xs text-white/60 hover:text-white rounded-lg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!manualTeamId || !manualAmount || manualAmountExceedsPurse || manualSellMut.isPending}
                onClick={handleConfirmManualSell}
                className="h-9 px-5 text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-xs rounded-lg"
              >
                Confirm Sell
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Break & Pre-Auction Countdown Dialog */}
      <Dialog open={countdownDialogOpen} onOpenChange={setCountdownDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg bg-[#0D1527] border border-white/20 text-white rounded-2xl p-5 sm:p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400" /> Pre-Auction &amp; Break Timer
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Broadcasts a live countdown with music on the LED stage display.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/80 mb-1 block font-bold text-xs">Minutes</Label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={countdownMinutes}
                  onChange={(e) => setCountdownMinutes(e.target.value)}
                  className="h-9 text-sm font-mono font-bold bg-black/60 border-white/20 rounded-xl px-3"
                />
              </div>
              <div>
                <Label className="text-white/80 mb-1 block font-bold text-xs">Seconds</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(e.target.value)}
                  className="h-9 text-sm font-mono font-bold bg-black/60 border-white/20 rounded-xl px-3"
                />
              </div>
            </div>

            <div>
              <Label className="text-white/80 mb-1 block font-bold text-xs">Message / Label (optional)</Label>
              <Input
                placeholder="e.g. Lunch Break · Resuming Soon"
                value={countdownLabel}
                onChange={(e) => setCountdownLabel(e.target.value)}
                className="h-9 text-xs sm:text-sm bg-black/60 border-white/20 rounded-xl px-3"
              />
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
              {currentCountdown?.endsAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await setBreakTimerMut.mutateAsync({
                        tournamentId,
                        data: { action: "cancel" },
                      });
                      applyMutationResult(res);
                      setCountdownDialogOpen(false);
                      toast({ title: "Break Timer Stopped" });
                    } catch (err) {}
                  }}
                  className="h-9 px-3.5 text-xs font-bold border-rose-500/40 text-rose-300 hover:bg-rose-500/15 rounded-lg"
                >
                  Stop Active Timer
                </Button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCountdownDialogOpen(false)}
                  className="h-9 px-3.5 text-xs text-white/60 hover:text-white rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const totalSecs = (parseInt(countdownMinutes, 10) || 0) * 60 + (parseInt(countdownSeconds, 10) || 0);
                    if (totalSecs <= 0) return;
                    try {
                      const res = await setBreakTimerMut.mutateAsync({
                        tournamentId,
                        data: {
                          action: "start",
                          durationSeconds: totalSecs,
                          message: countdownLabel.trim() || undefined,
                        },
                      });
                      applyMutationResult(res);
                      setCountdownDialogOpen(false);
                      toast({ title: `Break Timer Started (${totalSecs}s)` });
                    } catch (err) {}
                  }}
                  className="h-9 px-5 text-xs font-black bg-amber-400 text-slate-950 hover:bg-amber-300 rounded-lg shadow-xs"
                >
                  Start Timer
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Batch Re-Auction Dialog (Prepare Re-auction with 3 opening-bid strategies) */}
      <PrepareReAuctionDialog
        open={showBatchReAuctionConfirm}
        onOpenChange={setShowBatchReAuctionConfirm}
        unsoldCount={statusCounts.unsold}
        tournamentMinBid={tournament?.minBid}
        unit={unit}
        unitSymbol={unitSymbol}
        formatAmount={formatAmount}
        isPending={reAuctionAllUnsoldMut.isPending}
        onConfirm={async (payload) => {
          try {
            const res = await reAuctionAllUnsoldMut.mutateAsync({
              tournamentId,
              data: payload,
            });
            applyMutationResult(res);
            setShowBatchReAuctionConfirm(false);
            toast({ title: "Unsold players returned to queue!" });
          } catch (err) {
            toast({
              title: "Failed to bring unsold players",
              description: mutationErrorMessage(err, "Could not bring unsold players."),
              variant: "destructive",
            });
          }
        }}
      />

      {/* 4b. Single-Player Re-Auction Dialog (Base Point / Last Sold Point / Custom Point) */}
      <SinglePlayerReAuctionDialog
        open={!!reAuctionTargetPlayer}
        onOpenChange={(open) => {
          if (!open) setReAuctionTargetPlayer(null);
        }}
        player={reAuctionTargetPlayer}
        previousTeamName={
          reAuctionTargetPlayer?.teamId
            ? teamMap[reAuctionTargetPlayer.teamId]?.name ?? null
            : null
        }
        tournamentMinBid={tournament?.minBid}
        unit={unit}
        unitSymbol={unitSymbol}
        formatAmount={formatAmount}
        isPending={reAuction.isPending}
        onConfirm={async ({ playerId, startFromBase, startingBid }) => {
          const ok = await handleReAuction(playerId, startFromBase, undefined, startingBid);
          if (ok) setReAuctionTargetPlayer(null);
        }}
      />

      {/* 5. Owner Bidding Disable Confirmation Dialog */}
      <Dialog open={confirmDisableOwnerBiddingOpen} onOpenChange={setConfirmDisableOwnerBiddingOpen}>
        <DialogContent className="max-w-md sm:max-w-lg bg-[#0D1527] border-2 border-white/20 text-white rounded-2xl p-6 sm:p-7 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-black text-rose-400">
              Disable Mobile Owner Bidding?
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-white/60 pt-2">
              Team owners will no longer be able to submit bids from their phones. You will record bids manually using the team buttons on stage.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDisableOwnerBiddingOpen(false)}
              className="h-11 px-5 text-xs sm:text-sm text-white/60 hover:text-white rounded-xl"
            >
              Keep Enabled
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                setConfirmDisableOwnerBiddingOpen(false);
                try {
                  const res = await updateAuctionSettingsMut.mutateAsync({
                    tournamentId,
                    data: { ownerBiddingEnabled: false },
                  });
                  applyMutationResult(res);
                  toast({ title: "Mobile Bidding Disabled" });
                } catch (err) {}
              }}
              className="h-11 sm:h-12 px-6 text-xs sm:text-sm font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-md"
            >
              Disable Mobile Bidding
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. Owner Bidding Enable Confirmation Dialog */}
      <Dialog open={confirmEnableOwnerBiddingOpen} onOpenChange={setConfirmEnableOwnerBiddingOpen}>
        <DialogContent className="max-w-md sm:max-w-lg bg-[#0D1527] border-2 border-white/20 text-white rounded-2xl p-6 sm:p-7 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-black text-emerald-400">
              Enable Mobile Owner Bidding?
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-white/60 pt-2">
              Team owners with active logins will be able to submit live bids directly from their mobile devices.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmEnableOwnerBiddingOpen(false)}
              className="h-11 px-5 text-xs sm:text-sm text-white/60 hover:text-white rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                setConfirmEnableOwnerBiddingOpen(false);
                try {
                  const res = await updateAuctionSettingsMut.mutateAsync({
                    tournamentId,
                    data: { ownerBiddingEnabled: true },
                  });
                  applyMutationResult(res);
                  toast({ title: "Mobile Bidding Enabled! 📱" });
                } catch (err) {}
              }}
              className="h-11 sm:h-12 px-6 text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md"
            >
              Enable Mobile Bidding
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume current bid Dialog */}
      <Dialog open={resumeBidDialogOpen} onOpenChange={setResumeBidDialogOpen}>
        <DialogContent className="max-w-md bg-[#0D1527] border border-white/20 text-white rounded-2xl p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-white">Resume Bidding</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Current player and bid are frozen. Choose how to continue:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Button
                className="w-full justify-start h-auto py-3 bg-white/5 hover:bg-white/10 border-white/15 text-white"
                variant="outline"
                disabled={reAuction.isPending}
                onClick={handleResumeBidRestart}
              >
                <div className="text-left">
                  <p className="font-bold text-xs text-white">Restart this player auction</p>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Reset to {formatShort(state?.currentPlayer?.basePrice ?? 0)} with no leading bidder.
                  </p>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold border-amber-300 shadow-md"
                onClick={handleResumeBidContinue}
              >
                <div className="text-left">
                  <p className="font-bold text-xs text-slate-950">Continue from current state</p>
                  <p className="text-[11px] text-slate-900/80 mt-0.5">
                    Keep {state?.currentBidTeamName ?? "current bid"} at {formatShort(state?.currentBid ?? 0)} and restart the timer.
                  </p>
                </div>
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-xs text-white/60 hover:text-white" onClick={() => setResumeBidDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lazy Modals: Fortune Wheel & Purse Booster */}
      {showFortuneWheel && (
        <Suspense fallback={null}>
          <FortuneWheelModal
            open={showFortuneWheel}
            onClose={() => setShowFortuneWheel(false)}
            tournamentId={tournamentId}
          />
        </Suspense>
      )}

      {showPurseBooster && (
        <PurseBoosterDialog
          open={showPurseBooster}
          onOpenChange={setShowPurseBooster}
          tournamentId={tournamentId}
          teams={teams || []}
        />
      )}
    </div>
  );
}
