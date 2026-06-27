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
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getListBidsQueryKey,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
  getListCategoriesQueryKey,
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { AuctionFeedIndicator } from "@/components/auction/auction-connection-banner";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import { AUCTION_FEED_UI, formatLastActivityDiagnostic } from "@workspace/api-base/auction-connection-state";
import { useMutationSync } from "@/hooks/use-mutation-sync";
import { useOperatorSessionLock } from "@/hooks/use-operator-session-lock";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { useTimerExpired } from "@/hooks/use-timer-expired";
import { ServerCountdown } from "@/components/server-countdown";
import { OperatorLayout } from "@/components/operator-layout";
import { LocalOperatorPinBar } from "@/components/local-operator-pin-bar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, CheckCircle, XCircle,
  Shuffle, User, Trophy, Clock, Gavel, RotateCcw, AlertTriangle,
  Settings2, Timer, LayoutGrid, Tag, X, Search,
  Hourglass, Monitor, Users, Crown, ExternalLink, ShieldAlert,
  PanelRightClose, PanelRightOpen, Tv2, Clapperboard,
  Coffee, PlusCircle, ChevronDown,
} from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { computeNextBidAmount } from "@workspace/api-base/auction-bid";
import {
  tournamentToReadinessInput,
  validateAuctionReadiness,
  type AuctionReadinessCheckId,
  type AuctionReadinessIssue,
} from "@workspace/api-base/auction-readiness";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { readinessFixPath } from "@/lib/settings-navigation";
import { useRoleSpecGroups } from "@/hooks/use-role-spec-groups";
import { PurseBoosterDialog } from "@/components/purse-booster-dialog";
import { AuditReasonField } from "@/components/audit-reason-field";
import { useToast } from "@/hooks/use-toast";


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

// ─── Countdown clock (live) ───────────────────────────────────────────────────

function CountdownClock({ endsAt, className }: { endsAt: string; className?: string }) {
  const [display, setDisplay] = useState(() => {
    const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  });
  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
      const s = Math.ceil(ms / 1000);
      setDisplay(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    };
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return (
    <span className={className ?? "font-display font-black tabular-nums text-lg leading-none"}>
      {display}
    </span>
  );
}

// ─── Circular timer ring ──────────────────────────────────────────────────────

function CircularTimer({
  endsAt,
  totalSeconds,
  running,
}: {
  endsAt?: string | null;
  totalSeconds: number;
  running: boolean;
}) {
  const R = 46;
  const circ = 2 * Math.PI * R;

  const [remaining, setRemaining] = useState<number>(() => {
    if (!endsAt || !running) return totalSeconds;
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!running || !endsAt) {
      setRemaining(totalSeconds);
      return;
    }
    const tick = () => {
      const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(Math.ceil(ms / 1000));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, running, totalSeconds]);

  const pct = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;
  const dash = pct * circ;
  const urgent = running && remaining <= 10;

  return (
    <div className="flex flex-col items-center justify-center py-4 rounded-2xl border border-white/8 bg-[#141820]">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={R} fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="7" />
          <circle
            cx="56" cy="56" r={R} fill="none"
            stroke={urgent ? "#f87171" : running ? "#facc15" : "#ffffff20"}
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-black tabular-nums leading-none ${urgent ? "text-red-400" : running ? "text-white" : "text-white/30"}`}>
            {remaining}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <div className={`w-1.5 h-1.5 rounded-full ${running ? (urgent ? "bg-red-400 animate-ping" : "bg-yellow-400 animate-pulse") : "bg-white/15"}`} />
        <span className={`text-sm font-semibold ${running ? (urgent ? "text-red-300" : "text-yellow-300") : "text-white/25"}`}>
          {running ? (urgent ? "Ending soon" : "Bidding open") : "Timer paused"}
        </span>
      </div>
      <p className="text-xs text-white/25 mt-0.5">of {totalSeconds}s window</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuctionOperator() {
  const [, params] = useRoute("/tournament/:id/auction");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const readinessFixLinks: Partial<Record<AuctionReadinessCheckId, string>> = {
    teams: readinessFixPath(tournamentId, "teams"),
    players: readinessFixPath(tournamentId, "players"),
    minBid: readinessFixPath(tournamentId, "minBid"),
    openingTimer: readinessFixPath(tournamentId, "openingTimer"),
    bidTimer: readinessFixPath(tournamentId, "bidTimer"),
    playerOrder: readinessFixPath(tournamentId, "playerOrder"),
    bidTiers: readinessFixPath(tournamentId, "bidTiers"),
    minSquad: readinessFixPath(tournamentId, "minSquad"),
  };

  const [manualSellOpen, setManualSellOpen] = useState(false);
  const [manualTeamId, setManualTeamId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualSellReason, setManualSellReason] = useState("");
  const [showAdvancedReason, setShowAdvancedReason] = useState(false);
  const [showBatchReAuctionConfirm, setShowBatchReAuctionConfirm] = useState(false);
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const [readinessIssues, setReadinessIssues] = useState<AuctionReadinessIssue[]>([]);
  const [resumeBidDialogOpen, setResumeBidDialogOpen] = useState(false);
  const [currentBidPaused, setCurrentBidPaused] = useState(false);
  const [timerSecs, setTimerSecs] = useState("30");
  const [playerSearch, setPlayerSearch] = useState("");
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [pendingCategoryIds, setPendingCategoryIds] = useState<number[]>([]);
  const [mobilePanel, setMobilePanel] = useState<"queue" | "control" | "teams">("control");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // Pre Auction & Break Timer dialog
  const [showFortuneWheel, setShowFortuneWheel] = useState(false);
  const [showPurseBooster, setShowPurseBooster] = useState(false);
  const syncFortuneWheel = useSyncFortuneWheel();
  const wheelResetOnMountRef = useRef(false);
  const [countdownDialogOpen, setCountdownDialogOpen] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState("5");
  const [countdownSeconds, setCountdownSeconds] = useState("0");
  const [countdownLabel, setCountdownLabel] = useState("");
  const { toast } = useToast();
  // Status-based left panel filter
  const [statusFilter, setStatusFilter] = useState("available");
  // Player view filter popup
  const [playerFilterOpen, setPlayerFilterOpen] = useState(false);
  const [playerFilterStatus, setPlayerFilterStatus] = useState<"all" | "sold" | "unsold" | "available" | "retained">("all");
  const [playerFilterTeamId, setPlayerFilterTeamId] = useState<number | null>(null);
  const playerFilterContainerRef = useRef<HTMLDivElement>(null);
  // Per-team bid debounce
  const bidDebounce = useRef<Map<number, number>>(new Map());

  // Drop stale fortune-wheel broadcast from a prior session so the LED shows
  // the auction main view when the operator opens auction control.
  useEffect(() => {
    if (!tournamentId || wheelResetOnMountRef.current) return;
    wheelResetOnMountRef.current = true;
    syncFortuneWheel.mutate({
      tournamentId,
      data: { active: false, winner: null, spinning: false },
    });
  }, [tournamentId, syncFortuneWheel]);

  // Close filter panels when clicking outside
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (playerFilterContainerRef.current && !playerFilterContainerRef.current.contains(e.target as Node)) {
        setPlayerFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const { connectionStatus } = useAuctionSocket(tournamentId);
  const { applyMutationResult, invalidateFallback } = useMutationSync(tournamentId, connectionStatus);
  const {
    readOnly: operatorReadOnly,
    lockReady: operatorLockReady,
    lockStatus: operatorLockStatus,
    takeover: operatorTakeover,
  } = useOperatorSessionLock(tournamentId);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: state } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const feed = useAuctionConnectionState(
    connectionStatus,
    tournamentId,
    typeof state?.lastAuctionActivityAt === "string" ? state.lastAuctionActivityAt : null,
  );
  const feedDiagnostic = formatLastActivityDiagnostic(feed.secondsSinceLastActivity);

  useEffect(() => {
    const f = state?.displayPlayerFilter;
    if (!f) return;
    setPlayerFilterStatus(f.status ?? "all");
    setPlayerFilterTeamId(f.teamId ?? null);
  }, [state?.displayPlayerFilter?.status, state?.displayPlayerFilter?.teamId]);

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
  const lastSaleBid = useMemo(() => {
    if (!bids?.length) return null;
    return [...bids].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];
  }, [bids]);
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

  const startAuction       = useStartAuction();
  const pauseAuction       = usePauseAuction();
  const nextPlayer         = useNextPlayer();
  const placeBid           = usePlaceBid();
  const sellPlayer         = useSellPlayer();
  const manualSellMut      = useManualSell();
  const markUnsold         = useMarkUnsold();
  const reAuction          = useReAuctionPlayer();
  const reAuctionAllUnsoldMut = useReAuctionAllUnsold();
  const concludeAuctionMut = useConcludeAuction();
  const startTimerMut      = useStartTimer();
  const stopTimerMut       = useStopTimer();
  const setDisplayOverlay  = useSetDisplayOverlay();
  const setDisplayPlayerFilterMut = useSetDisplayPlayerFilter();
  const setCategoryFilter  = useSetCategoryFilter();
  const deferPlayerMut     = useDeferPlayer();
  const setBreakTimerMut   = useSetBreakTimer();

  const currentPlayerSpecGroups = useRoleSpecGroups(tournament?.sport, state?.currentPlayer?.role);

  const auctionMutationPending =
    placeBid.isPending ||
    sellPlayer.isPending ||
    markUnsold.isPending ||
    nextPlayer.isPending ||
    startAuction.isPending ||
    pauseAuction.isPending ||
    deferPlayerMut.isPending ||
    reAuction.isPending;

  const controlsLocked = operatorReadOnly || auctionMutationPending;

  async function handleNextPlayer(mode: "sequential" | "random", playerId?: number) {
    if (controlsLocked) return;
    const result = await nextPlayer.mutateAsync({ tournamentId, data: { mode, playerId } });
    setCurrentBidPaused(false);
    if (state?.displayOverlay) {
      await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: "off" } });
    }
    applyMutationResult(result);
  }

  function handleBid(teamId: number) {
    if (controlsLocked || placeBid.isPending) return;
    const now = Date.now();
    if ((bidDebounce.current.get(teamId) ?? 0) + 150 > now) return;
    bidDebounce.current.set(teamId, now);
    const nextBid = computeNextBidAmount({
      currentBid: state?.currentBid,
      bidIncrement: state?.bidIncrement ?? 50000,
      currentBidTeamId: state?.currentBidTeamId,
    });
    const bidTeam = teamMap[teamId];
    qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), (old: any) => {
      if (!old) return old;
      return { ...old, currentBid: nextBid, currentBidTeamId: teamId, currentBidTeamName: bidTeam?.name ?? old.currentBidTeamName, currentBidTeamColor: bidTeam?.color ?? old.currentBidTeamColor };
    });
    placeBid
      .mutateAsync({ tournamentId, data: { teamId, amount: nextBid } })
      .then((result) => { applyMutationResult(result); })
      .catch(() => { invalidateFallback(); });
  }

  async function handleSell() {
    if (controlsLocked || sellPlayer.isPending) return;
    // Pass the bid state the operator currently sees so the server can detect
    // a concurrent bid that arrived between the operator clicking SELL and the
    // request reaching the server (Phase 3 sell-race prevention).
    const result = await sellPlayer.mutateAsync({
      tournamentId,
      ...(state?.currentBidTeamId != null ? { expectedBidTeamId: state.currentBidTeamId as number } : {}),
      ...(state?.currentBid != null ? { expectedBidAmount: state.currentBid as number } : {}),
    });
    applyMutationResult(result);
  }
  async function handleUnsold() {
    if (controlsLocked || markUnsold.isPending) return;
    const result = await markUnsold.mutateAsync({ tournamentId });
    applyMutationResult(result);
  }
  async function handleManualSell() {
    if (!manualTeamId || !manualAmount || controlsLocked) return;
    try {
      const result = await manualSellMut.mutateAsync({
        tournamentId,
        data: {
          teamId: parseInt(manualTeamId),
          amount: parseInt(manualAmount) || 0,
          ...(manualSellReason.trim() ? { reason: manualSellReason.trim() } : {}),
        },
      });
      setManualSellOpen(false);
      setManualTeamId("");
      setManualAmount("");
      setManualSellReason("");
      applyMutationResult(result);
    } catch { /* error shown in dialog */ }
  }

  async function handleReAuction(playerId: number, startFromBase: boolean, reason?: string) {
    if (controlsLocked || reAuction.isPending) return;
    const result = await reAuction.mutateAsync({
      tournamentId,
      data: {
        playerId,
        startFromBase,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      },
    });
    setCurrentBidPaused(false);
    applyMutationResult(result);
  }

  function resolveTimerSecondsForPhase(): number {
    const inBidPhase = !!state?.currentBidTeamId || state?.timerType === "bid";
    return inBidPhase
      ? (state?.bidTimerSeconds ?? 15)
      : (parseInt(timerSecs) || state?.timerSeconds || 30);
  }

  async function handleStartTimer() {
    if (controlsLocked) return;
    const secs = resolveTimerSecondsForPhase();
    const result = await startTimerMut.mutateAsync({ tournamentId, data: { seconds: secs } });
    applyMutationResult(result);
  }

  async function handleExtendTimer() {
    if (controlsLocked) return;
    const secs = (parseInt(timerSecs) || 30) + 30;
    const result = await startTimerMut.mutateAsync({ tournamentId, data: { seconds: secs } });
    applyMutationResult(result);
  }

  async function handleStopTimer() {
    if (controlsLocked) return;
    const result = await stopTimerMut.mutateAsync({ tournamentId });
    applyMutationResult(result);
    setCurrentBidPaused(true);
  }

  function handleStartBiddingClick() {
    if (!isActive) return;
    if (currentBidPaused && hasPlayer) {
      setResumeBidDialogOpen(true);
      return;
    }
    void handleStartTimer();
  }

  async function handleResumeBidContinue() {
    setResumeBidDialogOpen(false);
    setCurrentBidPaused(false);
    await handleStartTimer();
  }

  async function handleResumeBidRestart() {
    const playerId = state?.currentPlayer?.id;
    if (!playerId) return;
    setResumeBidDialogOpen(false);
    await handleReAuction(playerId, true);
  }

  async function handleInstantReauction(playerId?: number) {
    const targetId = playerId ?? lastSaleBid?.playerId;
    if (!targetId || controlsLocked || reAuction.isPending || isPaused) return;
    await handleReAuction(targetId, true);
  }

  async function handleDeferPlayer() {
    if (controlsLocked || deferPlayerMut.isPending) return;
    const result = await deferPlayerMut.mutateAsync({ tournamentId });
    applyMutationResult(result);
    if (selectionMode === "manual" && !(result as { currentPlayer?: unknown } | undefined)?.currentPlayer) {
      toast({
        title: "Player deferred",
        description: "Pick the next player from the queue using Go.",
      });
    }
  }

  function openCountdownDialog() {
    setCountdownMinutes("5");
    setCountdownSeconds("0");
    setCountdownLabel("");
    setCountdownDialogOpen(true);
  }

  function parseCountdownDuration(): number | null {
    const mins = Math.max(0, parseInt(countdownMinutes, 10) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(countdownSeconds, 10) || 0));
    const total = mins * 60 + secs;
    if (total < 10 || total > 3600) return null;
    return total;
  }

  async function handleStartCountdown() {
    const message = countdownLabel.trim() || undefined;
    const durationSeconds = parseCountdownDuration();
    if (!durationSeconds) {
      toast({
        title: "Invalid duration",
        description: "Enter at least 10 seconds and at most 60 minutes.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await setBreakTimerMut.mutateAsync({ tournamentId, data: { action: "start", durationSeconds, message } });
      applyMutationResult(result);
      setCountdownDialogOpen(false);
      toast({
        title: "Countdown started",
        description: isActive ? "Auction paused — countdown is live on all displays." : "Countdown is live on all displays.",
      });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Could not start countdown.";
      toast({ title: "Countdown failed", description: msg, variant: "destructive" });
    }
  }

  async function handleCancelCountdown() {
    try {
      const result = await setBreakTimerMut.mutateAsync({ tournamentId, data: { action: "cancel" } });
      applyMutationResult(result);
      toast({
        title: "Break timer cancelled",
        description:
          result.status === "active"
            ? "Auction resumed on all screens."
            : "Countdown cleared on all displays.",
      });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Could not cancel countdown.";
      toast({ title: "Cancel failed", description: msg, variant: "destructive" });
    }
  }

  async function handleBringUnsoldPlayers() {
    const result = await reAuctionAllUnsoldMut.mutateAsync({ tournamentId, data: {} });
    applyMutationResult(result);
  }

  async function handleBatchReAuction() {
    await handleBringUnsoldPlayers();
    setShowBatchReAuctionConfirm(false);
  }

  async function handleConcludeAuction(force = false) {
    try {
      const result = await concludeAuctionMut.mutateAsync({ tournamentId, data: { force } });
      setConcludeDialogOpen(false);
      applyMutationResult(result);
    } catch (err: unknown) {
      const data = (err as { data?: { requiresConfirmation?: boolean } })?.data;
      if (data?.requiresConfirmation) {
        setConcludeDialogOpen(true);
      }
    }
  }

  async function handleStartAuction() {
    if (controlsLocked) return;
    if (isPaused) {
      const result = await startAuction.mutateAsync({ tournamentId });
      applyMutationResult(result);
      return;
    }

    if (tournament && Array.isArray(teams) && Array.isArray(players)) {
      const readinessInput = tournamentToReadinessInput(
        tournament,
        teams.length,
        players.length,
      );
      const issues = validateAuctionReadiness(readinessInput, isTrialMode ? "trial" : "live");
      if (issues.length > 0) {
        setReadinessIssues(issues);
        setReadinessModalOpen(true);
        return;
      }
    }

    try {
      const result = await startAuction.mutateAsync({ tournamentId });
      applyMutationResult(result);
    } catch (err: unknown) {
      const issues = (err as { data?: { issues?: string[] } })?.data?.issues;
      if (issues?.length) {
        setReadinessIssues(issues.map((message) => ({ id: "teams" as AuctionReadinessCheckId, message })));
        setReadinessModalOpen(true);
      }
    }
  }

  function openCategoryFilter() {
    const current: number[] = (state?.activeCategoryIds as number[] | null) ?? [];
    setPendingCategoryIds(current);
    setCategoryFilterOpen(true);
  }

  async function applyCategoryFilter() {
    const result = await setCategoryFilter.mutateAsync({ tournamentId, data: { categoryIds: pendingCategoryIds.length > 0 ? pendingCategoryIds : null } as any });
    setCategoryFilterOpen(false);
    applyMutationResult(result);
  }

  async function clearCategoryFilter() {
    const result = await setCategoryFilter.mutateAsync({ tournamentId, data: { categoryIds: null } as any });
    applyMutationResult(result);
  }

  const timerSecsUserEdited = useRef(false);
  useEffect(() => {
    if (!timerSecsUserEdited.current && state?.timerSeconds) {
      setTimerSecs(String(state.timerSeconds));
    }
  }, [state?.timerSeconds]);

  const timerExpired = useTimerExpired(state?.timerEndsAt);

  const isActive   = state?.status === "active";
  const isPaused   = state?.status === "paused";
  const isCompleted = state?.status === "completed";
  const hasPlayer  = !!state?.currentPlayer;
  const hasBid     = !!state?.currentBidTeamId;
  const timerActive = !!state?.timerEndsAt && !timerExpired;
  const allPlayers  = players || [];
  const available   = allPlayers.filter(p => p.status === "available");
  const soldPlayers   = allPlayers.filter(p => p.status === "sold");
  const unsoldPlayers = allPlayers.filter(p => p.status === "unsold");
  const retainedPlayers = allPlayers.filter(p => p.status === "retained");
  const mainRoundExhausted =
    (state as { mainRoundExhausted?: boolean } | undefined)?.mainRoundExhausted
    ?? (isActive && available.length === 0 && unsoldPlayers.length > 0 && !hasPlayer);
  const increment   = state?.bidIncrement ?? 50000;
  const nextBidAmount = computeNextBidAmount({
    currentBid: state?.currentBid,
    bidIncrement: increment,
    currentBidTeamId: state?.currentBidTeamId,
  });
  const teamMap     = Object.fromEntries((teams || []).map(t => [t.id, t]));
  const activeCategoryIds: number[] | null = (state?.activeCategoryIds as number[] | null) ?? null;
  const categoryMap = Object.fromEntries((categories || []).map(c => [c.id, c]));
  const selectionMode = (state as any)?.playerSelectionMode ?? "sequential";
  const licenseStatus: string = (state as any)?.licenseStatus ?? "trial";
  const isTrialMode = licenseStatus !== "active";
  const trialTeamIds: number[] | null = (state as any)?.trialTeamIds ?? null;
  const deferredPlayerIds: number[] | null = (state as any)?.deferredPlayerIds ?? null;
  const currentCountdown = (state as { displayCountdown?: { type?: string; endsAt?: string; message?: string | null } | null } | undefined)?.displayCountdown ?? null;

  // Keyboard shortcuts — declared here so derived vars are in scope
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (controlsLocked) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case "s": if (!timerActive && hasBid && isActive && !sellPlayer.isPending) handleSell(); break;
        case "u": if (!timerActive && hasPlayer && isActive && !markUnsold.isPending) handleUnsold(); break;
        case "d": if (!timerActive && hasPlayer && isActive && !deferPlayerMut.isPending) handleDeferPlayer(); break;
        case "m": if (!timerActive && hasPlayer) { setManualAmount(String(state?.currentBid || state?.currentPlayer?.basePrice || 0)); setManualTeamId(""); setManualSellOpen(true); } break;
        case "n": if (!timerActive && isActive && !nextPlayer.isPending) handleNextPlayer(selectionMode === "random" ? "random" : "sequential"); break;
        case "z": if (isActive && lastSaleBid && !reAuction.isPending) void handleInstantReauction(); break;
        case " ": e.preventDefault(); if (isActive && hasPlayer) { timerActive ? handleStopTimer() : handleStartBiddingClick(); } break;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hasPlayer, timerActive, hasBid, controlsLocked]);

  // Category-filtered available queue (used for category filter context)
  const filteredQueue = activeCategoryIds && activeCategoryIds.length > 0
    ? available.filter(p => p.categoryId && activeCategoryIds.includes(p.categoryId))
    : available;

  // Status counts for the filter flyout
  const statusCounts = {
    all:       allPlayers.length,
    available: filteredQueue.length,
    sold:      soldPlayers.length,
    unsold:    unsoldPlayers.length,
    retained:  retainedPlayers.length,
  };

  // Left panel list — filtered by status then search (name or player #, same as Players page)
  const filterBySearch = <T extends { id: number; name: string }>(list: T[]): T[] =>
    playerSearch.trim()
      ? list.filter(p => playerMatchesSearch(p, playerSearch))
      : list;

  const statusBasedList = statusFilter === "all"       ? allPlayers
    : statusFilter === "available" ? filteredQueue
    : statusFilter === "sold"      ? soldPlayers
    : statusFilter === "unsold"    ? unsoldPlayers
    : retainedPlayers;

  const leftPanelList = filterBySearch(statusBasedList);
  // LED overlay buttons
  const ledOverlayButtons = [
    { mode: "team"   as const, label: "Team",   icon: LayoutGrid,  bg: "bg-primary text-black"    },
    { mode: "player" as const, label: "Player", icon: Users,       bg: "bg-blue-600 text-white"   },
    { mode: "top5"   as const, label: "Top5",   icon: Crown,       bg: "bg-purple-600 text-white" },
    { mode: "banner" as const, label: "Banner", icon: Clapperboard, bg: "bg-amber-600 text-white" },
  ];

  const timerSecsNum = parseInt(timerSecs) || 30;

  return (
    <OperatorLayout
      tournamentId={tournamentId}
      connectionStatus={connectionStatus}
      feedState={feed.state}
      secondsSinceLastActivity={feed.secondsSinceLastActivity}
      auctionStatus={state?.status || "idle"}
    >
      <div className="flex flex-col h-full overflow-hidden bg-[#0f1117] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>

        <DisplayConnectionBanner
          feedState={feed.state}
          secondsSinceLastActivity={feed.secondsSinceLastActivity}
          placement="inline"
        />

        <LocalOperatorPinBar tournamentId={tournamentId} />

        {/* Phase 4: nuanced lock-state banners (fail-closed, retrying, locked with takeover) */}
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
              className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/40 transition-colors"
              title="Force-take control of this auction (use only if the other tab is unresponsive)"
            >
              Take Over
            </button>
          </div>
        )}

        {/* Legacy banner for backward compatibility while lockStatus is unknown */}
        {operatorLockReady && operatorReadOnly && operatorLockStatus !== "locked" && (
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-xs border-b z-20 bg-orange-500/10 border-orange-500/25 text-orange-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Read-only — another operator tab is controlling this auction. Close the other tab or wait for it to disconnect.
          </div>
        )}

        {isPaused && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2 px-4 py-8 border-b-2 border-amber-500/50 bg-gradient-to-b from-amber-500/20 to-amber-500/8 z-20">
            <div className="flex items-center gap-3">
              <Pause className="w-9 h-9 text-amber-300 flex-shrink-0" />
              <span className="font-display font-black text-3xl sm:text-4xl tracking-wider text-amber-200 uppercase">
                AUCTION PAUSED
              </span>
            </div>
            <p className="text-sm sm:text-base text-amber-100/75 font-medium">
              Resume Auction to continue.
            </p>
          </div>
        )}

        {mainRoundExhausted && !isPaused && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-orange-500/30 bg-orange-500/10 z-20">
            <div>
              <p className="text-sm font-bold text-orange-200">Main round complete</p>
              <p className="text-xs text-orange-100/70">
                {unsoldPlayers.length} unsold player{unsoldPlayers.length !== 1 ? "s" : ""} remaining — bring them back or conclude the auction.
              </p>
            </div>
          </div>
        )}

        {/* ══════════ AUCTION CONTROL BAR ════════════════════════════════════ */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#141720] border-b border-white/8 flex-wrap min-h-[44px] z-10">

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs font-medium flex-shrink-0">
            <span className="text-white/40">SOLD <span className="text-green-400 font-bold">{state?.soldPlayersCount || 0}</span></span>
            <span className="text-white/40 hidden sm:inline">UNSOLD <span className="text-red-400 font-bold">{state?.unsoldPlayersCount || 0}</span></span>
            <span className="text-white/40">LEFT <span className="text-white font-bold">{state?.remainingPlayersCount || 0}</span></span>
            {retainedPlayers.length > 0 && (
              <span className="text-white/40 hidden sm:inline">RET <span className="text-purple-400 font-bold">{retainedPlayers.length}</span></span>
            )}
          </div>

          {(tournament as { auctionCode?: string | null } | undefined)?.auctionCode && (
            <span className="font-mono text-xs tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 flex-shrink-0 hidden sm:inline">
              {(tournament as { auctionCode?: string | null }).auctionCode}
            </span>
          )}

          <div className="w-px h-4 bg-white/12 flex-shrink-0" />

          {/* Category filter */}
          {categories && categories.length > 0 && (
            <button
              onClick={openCategoryFilter}
              disabled={timerActive}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                activeCategoryIds && activeCategoryIds.length > 0
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-white/15 text-white/50 hover:text-white hover:bg-white/8"
              }`}
            >
              <Tag className="w-3 h-3" />
              {activeCategoryIds && activeCategoryIds.length > 0
                ? activeCategoryIds.length === 1 ? (categoryMap[activeCategoryIds[0]]?.name ?? "1 Category") : `${activeCategoryIds.length} Categories`
                : "All Categories"}
            </button>
          )}

          {/* Start / Pause / Unsold round / Conclude (session-level) */}
          {mainRoundExhausted ? (
            <>
              <button
                className="h-7 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-md bg-orange-600 hover:bg-orange-500 text-white transition-all flex-shrink-0 disabled:opacity-50"
                onClick={() => setShowBatchReAuctionConfirm(true)}
                disabled={reAuctionAllUnsoldMut.isPending || unsoldPlayers.length === 0}
              >
                <RotateCcw className="w-3 h-3" />
                Bring Unsold Players
              </button>
              <button
                className="h-7 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-md border border-white/20 text-white/80 hover:bg-white/8 transition-all flex-shrink-0 disabled:opacity-50"
                onClick={() => setConcludeDialogOpen(true)}
                disabled={concludeAuctionMut.isPending}
              >
                <CheckCircle className="w-3 h-3" />
                Conclude Auction
              </button>
            </>
          ) : !isActive && !isCompleted ? (
            <button
              className="h-7 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-md bg-green-600 hover:bg-green-500 text-white transition-all flex-shrink-0 disabled:opacity-50"
              onClick={handleStartAuction}
              disabled={controlsLocked || startAuction.isPending}
            >
              <Play className="w-3 h-3" />
              {isPaused ? "Resume Auction" : isTrialMode ? "Start Practice" : "Start Auction"}
            </button>
          ) : isActive ? (
            <button
              className="h-7 px-3 flex items-center gap-1.5 text-xs font-semibold rounded-md border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 transition-all flex-shrink-0"
              onClick={async () => {
                if (controlsLocked || pauseAuction.isPending) return;
                const result = await pauseAuction.mutateAsync({ tournamentId });
                applyMutationResult(result);
              }}
              disabled={controlsLocked || pauseAuction.isPending}
              title="Pause the entire auction for a break — shown on LED, owner panels, and displays"
            >
              <Pause className="w-3 h-3" /> Pause Auction
            </button>
          ) : null}

          <div className="flex-1 min-w-0" aria-hidden />

          {/* Trial badge */}
          {isTrialMode && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
              Practice Mode
            </span>
          )}

          {/* LED SCREEN controls */}
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-white/10 bg-white/4 flex-shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 pr-1.5 border-r border-white/10 mr-0.5 leading-tight">LED<br/>SCREEN</span>
            <button
              onClick={async () => {
                if (controlsLocked) return;
                const result = await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: "off" } });
                applyMutationResult(result);
              }}
              disabled={timerActive || setDisplayOverlay.isPending}
              className={`flex items-center gap-1.5 h-7 px-3 rounded text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                !state?.displayOverlay
                  ? "bg-green-600 text-white shadow-md ring-1 ring-white/20"
                  : "text-white/40 hover:text-white hover:bg-white/8"
              }`}
            >
              <Tv2 className="w-3.5 h-3.5" /> MAIN View
            </button>
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            {ledOverlayButtons.map(({ mode, label, icon: Icon, bg }) => {
              const active = state?.displayOverlay === mode;
              if (mode === "player") {
                return (
                  <div key="player" className="relative" ref={playerFilterContainerRef}>
                    <button
                      title={active ? "Player view active — click to filter" : "Show Player list on LED screen"}
                      onClick={async () => {
                        if (controlsLocked) return;
                        if (!active) {
                          const result = await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: "player" } });
                          applyMutationResult(result);
                        }
                        setPlayerFilterOpen(v => !v);
                      }}
                      disabled={timerActive || setDisplayOverlay.isPending}
                      className={`flex items-center gap-1 h-7 px-2.5 rounded text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        active ? `${bg} shadow-md ring-1 ring-white/20` : "text-white/35 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {label}
                      <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                    </button>
                    {playerFilterOpen && (
                      <div className="absolute top-full right-0 mt-1 w-56 rounded-xl border border-white/15 bg-[#1a1f2e] shadow-2xl z-50 p-3 space-y-3">
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Status</p>
                          <div className="flex flex-wrap gap-1">
                            {(["all", "available", "sold", "unsold", "retained"] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={async () => {
                                  setPlayerFilterStatus(opt);
                                  const result = await setDisplayPlayerFilterMut.mutateAsync({
                                    tournamentId,
                                    data: { status: opt, teamId: playerFilterTeamId },
                                  });
                                  applyMutationResult(result);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition-all ${
                                  playerFilterStatus === opt
                                    ? "bg-blue-600 text-white"
                                    : "bg-white/8 text-white/50 hover:text-white hover:bg-white/14"
                                }`}
                              >
                                {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        {teams && teams.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Team</p>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={async () => {
                                  setPlayerFilterTeamId(null);
                                  const result = await setDisplayPlayerFilterMut.mutateAsync({ tournamentId, data: { status: playerFilterStatus, teamId: null } });
                                  applyMutationResult(result);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                  playerFilterTeamId === null ? "bg-blue-600 text-white" : "bg-white/8 text-white/50 hover:text-white hover:bg-white/14"
                                }`}
                              >
                                All
                              </button>
                              {teams.map(team => (
                                <button
                                  key={team.id}
                                  onClick={async () => {
                                    setPlayerFilterTeamId(team.id);
                                    const result = await setDisplayPlayerFilterMut.mutateAsync({
                                      tournamentId,
                                      data: { status: playerFilterStatus, teamId: team.id },
                                    });
                                    applyMutationResult(result);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                    playerFilterTeamId === team.id ? "bg-blue-600 text-white" : "bg-white/8 text-white/50 hover:text-white hover:bg-white/14"
                                  }`}
                                  style={{ borderLeft: `2px solid ${team.color || "#888"}` }}
                                >
                                  {team.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button key={mode}
                  title={active ? `Showing ${label} on LED — click to return to live` : `Show ${label} on LED screen`}
                  onClick={async () => {
                    if (controlsLocked) return;
                    const result = await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: active ? "off" : mode } });
                    applyMutationResult(result);
                  }}
                  disabled={timerActive || setDisplayOverlay.isPending}
                  className={`flex items-center gap-1 h-7 px-2.5 rounded text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? `${bg} shadow-md ring-1 ring-white/20` : "text-white/35 hover:text-white hover:bg-white/8"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowPurseBooster(true)}
            className="flex items-center gap-1 h-7 px-2.5 rounded text-xs font-bold transition-all text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 flex-shrink-0"
            title="Apply purse booster"
          >
            💰 Booster
          </button>

          <div
            title={feedDiagnostic ? `${AUCTION_FEED_UI[feed.state].title} · ${feedDiagnostic}` : AUCTION_FEED_UI[feed.state].subtitle}
            className={`flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold flex-shrink-0 transition-colors ${
              feed.state === "live" ? "border-green-500/40 bg-green-500/10 text-green-400"
              : feed.state === "awaiting_operator_response" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
              : feed.state === "reconnecting" ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            <AuctionFeedIndicator
              feedState={feed.state}
              secondsSinceLastActivity={feed.secondsSinceLastActivity}
              className="w-3.5 h-3.5"
            />
            <span className="hidden sm:inline">
              {feed.state === "live" ? "Live" : feed.state === "awaiting_operator_response" ? "Waiting" : feed.state === "reconnecting" ? "Reconnecting" : "Offline"}
            </span>
          </div>

          {/* Right panel toggle */}
          <button
            title={rightCollapsed ? "Show Teams & Purse" : "Hide Teams & Purse"}
            onClick={() => setRightCollapsed(v => !v)}
            className={`hidden lg:flex items-center justify-center h-7 w-7 rounded border transition-colors flex-shrink-0 ${
              rightCollapsed ? "border-yellow-400/50 text-yellow-400 bg-yellow-400/10" : "border-white/15 text-white/35 hover:text-white hover:bg-white/8"
            }`}
          >
            {rightCollapsed ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ══════════ 3-COLUMN MAIN ═════════════════════════════════════════ */}
        <div className={`flex-1 grid grid-cols-1 min-h-0 overflow-hidden ${rightCollapsed ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-[280px_1fr_260px]"}`}>

          {/* ══ LEFT: PLAYER QUEUE ══════════════════════════════════════════ */}
          <aside className={`border-r border-white/8 flex-col min-h-0 overflow-hidden bg-[#141720] ${mobilePanel === "queue" ? "flex" : "hidden"} lg:flex`}>

            {/* Header */}
            <div className="flex items-center px-3 py-2 border-b border-white/8 flex-shrink-0">
              <span className="text-xs font-black uppercase tracking-widest text-white/40">
                Players
                <span className="ml-1.5 text-white/25 font-normal normal-case tracking-normal">({leftPanelList.length})</span>
              </span>
            </div>

            {/* Search */}
            <div className="px-2 py-1.5 flex-shrink-0 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
                <input
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  placeholder="Search name or serial no…"
                  className="w-full h-7 pl-6 pr-6 bg-white/5 border border-white/8 rounded text-xs text-white/60 placeholder:text-white/25 outline-none focus:border-yellow-400/30"
                />
                {playerSearch && (
                  <button onClick={() => setPlayerSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/55">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Status filters — always visible */}
            <div className="px-2 py-2 flex-shrink-0 border-b border-white/5 space-y-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Filter by status</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { k: "all",       l: "All",       c: statusCounts.all,       active: "bg-white/15 text-white border-white/25" },
                  { k: "available", l: "Avail",     c: statusCounts.available, active: "bg-blue-500/25 text-blue-200 border-blue-400/40" },
                  { k: "sold",      l: "Sold",      c: statusCounts.sold,      active: "bg-green-500/25 text-green-200 border-green-400/40" },
                  { k: "unsold",    l: "Unsold",    c: statusCounts.unsold,    active: "bg-red-500/25 text-red-200 border-red-400/40" },
                  { k: "retained",  l: "Retained",  c: statusCounts.retained,  active: "bg-purple-500/25 text-purple-200 border-purple-400/40" },
                ] as const).map(({ k, l, c, active }) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setStatusFilter(k); setPlayerSearch(""); }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold transition-all ${
                      statusFilter === k
                        ? active
                        : "bg-white/5 border-white/10 text-white/45 hover:text-white/75 hover:bg-white/8"
                    }`}
                  >
                    {l}
                    <span className="font-mono text-[9px] opacity-70">{c}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active category filter chips */}
            {activeCategoryIds && activeCategoryIds.length > 0 && (
              <div className="px-2 py-1 flex-shrink-0 border-b border-white/5 flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-blue-400 font-semibold">CAT:</span>
                {activeCategoryIds.map(id => (
                  <span key={id} className="text-[9px] px-1 rounded" style={{ color: categoryMap[id]?.colorCode || "#60a5fa", backgroundColor: `${categoryMap[id]?.colorCode || "#60a5fa"}15` }}>
                    {categoryMap[id]?.name || `#${id}`}
                  </span>
                ))}
                <button onClick={clearCategoryFilter} className="text-[9px] text-white/30 hover:text-red-400 ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Re-auction all unsold — contextual button */}
            {statusFilter === "unsold" && statusCounts.unsold > 0 && (
              <div className="px-2 py-1.5 border-b border-white/6 flex-shrink-0">
                <button
                  onClick={() => setShowBatchReAuctionConfirm(true)}
                  disabled={isPaused}
                  title={isPaused ? "Resume auction before re-auctioning" : undefined}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3 h-3" /> Re-auction all {statusCounts.unsold} unsold
                </button>
              </div>
            )}

            {/* Player list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="py-1">
                {leftPanelList.length === 0 ? (
                  <p className="text-center text-white/25 text-xs py-8">
                    {playerSearch ? "No matches" : statusFilter === "all" ? "No players" : `No ${statusFilter} players`}
                  </p>
                ) : leftPanelList.map((player) => {
                  const cat        = player.categoryId ? categoryMap[player.categoryId] : null;
                  const team       = player.teamId ? teamMap[player.teamId] : null;
                  const isNowOn    = state?.currentPlayer?.id === player.id;
                  const pStatus    = player.status ?? "available";
                  const isAvail    = pStatus === "available";
                  const isSold     = pStatus === "sold";
                  const isUnsold   = pStatus === "unsold";
                  const isRetained = pStatus === "retained";
                  const isDeferred = isAvail && deferredPlayerIds?.includes(player.id);

                  return (
                    <div key={player.id}
                      className={`px-2 py-2 border-b border-white/4 transition-all ${
                        isNowOn ? "bg-yellow-400/8 border-yellow-400/15" : "hover:bg-white/4"
                      }`}>

                      <div className="flex items-start gap-1.5 min-w-0">
                        {/* Player # — matches Players page serial column */}
                        <span className="text-[10px] text-white/18 w-4 text-right flex-shrink-0 font-mono pt-0.5">{player.serialNo ?? player.id}</span>

                        {/* Jersey */}
                        {player.jerseyNumber && (
                          <span className="text-[10px] font-mono font-bold text-white/30 w-5 text-right flex-shrink-0 pt-0.5">#{player.jerseyNumber}</span>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className={`text-xs font-semibold truncate leading-tight max-w-full ${
                              isNowOn ? "text-yellow-200" : isSold ? "text-white/70" : isUnsold ? "text-white/40" : isRetained ? "text-purple-200" : "text-white/65"
                            }`}>
                              {player.name}
                            </p>
                            {isDeferred && <Hourglass className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 opacity-70" />}
                            {(player as any).playerTag && (() => {
                              const tt = getTagTheme((player as any).playerTag);
                              if (!tt) return null;
                              return (
                                <span style={{
                                  flexShrink: 0,
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  fontSize: "7px",
                                  fontWeight: 800,
                                  letterSpacing: "0.06em",
                                  background: tt.bg,
                                  border: `1px solid ${tt.border}`,
                                  color: tt.color,
                                  animation: TAG_PULSE_ANIMATION,
                                  whiteSpace: "nowrap",
                                  lineHeight: 1,
                                }}>
                                  {tt.label}
                                </span>
                              );
                            })()}
                            {(player as any).isNonPlayingMember && (
                              <span className="flex-shrink-0 text-[7px] font-bold tracking-wider px-1 py-0.5 rounded bg-slate-500/15 border border-slate-400/20 text-slate-400 uppercase leading-none">NP</span>
                            )}
                            {cat && <span className="text-[8px] font-semibold flex-shrink-0 truncate max-w-[4rem]" style={{ color: cat.colorCode || "#888" }}>{cat.name}</span>}
                          </div>

                          {/* Contextual second line */}
                          {isSold && (
                            <p className="text-[10px] leading-tight mt-0.5 truncate">
                              <span className="text-green-400 font-mono font-bold">{formatShortIndianRupee(player.soldPrice || player.basePrice)}</span>
                              {team && <><span className="text-white/30 mx-1">→</span><span className="text-white/45">{team.name}</span></>}
                            </p>
                          )}
                          {isRetained && (
                            <p className="text-[10px] leading-tight mt-0.5 truncate">
                              <span className="text-purple-400 font-mono font-bold">{formatShortIndianRupee((player as any).retainedPrice || player.basePrice)}</span>
                              {team && <><span className="text-white/30 mx-1">→</span><span className="font-semibold" style={{ color: team.color || "#a78bfa" }}>{team.name}</span></>}
                              {!team && <span className="text-white/40 ml-1">No team assigned</span>}
                            </p>
                          )}
                          {isUnsold && (
                            <p className="text-[10px] text-red-400/60 leading-tight mt-0.5">Unsold · base {formatShortIndianRupee(player.basePrice)}</p>
                          )}
                          {(isAvail || isNowOn) && !isSold && !isRetained && !isUnsold && (
                            <p className="text-[10px] text-white/28 leading-tight mt-0.5">base {formatShortIndianRupee(player.basePrice)}</p>
                          )}
                        </div>
                      </div>

                      {/* Status + actions — own row so Re button is never clipped */}
                      {(isNowOn || isSold || isUnsold || isRetained || (isAvail && !isNowOn)) && (
                        <div className="flex items-center justify-end gap-1.5 mt-1.5 pl-5 flex-wrap">
                          {isNowOn && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                          {isSold    && <span className="text-[8px] font-black text-green-400 bg-green-400/12 px-1.5 py-0.5 rounded">SOLD</span>}
                          {isUnsold  && <span className="text-[8px] font-black text-red-400/70 bg-red-400/10 px-1.5 py-0.5 rounded">UNSOLD</span>}
                          {isRetained && <span className="text-[8px] font-black text-purple-400 bg-purple-400/12 px-1.5 py-0.5 rounded">RET</span>}

                          {isAvail && !isNowOn && (
                            <button
                              disabled={controlsLocked || !isActive || timerActive || nextPlayer.isPending || selectionMode !== "manual"}
                              title={timerActive ? "Pause current bid first" : selectionMode !== "manual" ? "Switch to Manual mode to pick from queue" : "Load this player"}
                              onClick={() => handleNextPlayer("sequential", player.id)}
                              className="text-[9px] px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 hover:bg-yellow-400/30 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-all"
                            >
                              Go
                            </button>
                          )}
                          {(isSold || isUnsold) && (
                            <button
                              disabled={controlsLocked || reAuction.isPending || isPaused}
                              title={isPaused ? "Resume auction before re-auctioning" : "Re-auction this player"}
                              onClick={() => void handleInstantReauction(player.id)}
                              className="text-[9px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-30 font-semibold inline-flex items-center gap-0.5 transition-all whitespace-nowrap"
                            >
                              <RotateCcw className="w-2.5 h-2.5" /> Re-auction
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          {/* ══ CENTER: AUCTION CONTROL ═════════════════════════════════════ */}
          <main className={`flex-col min-h-0 overflow-hidden ${mobilePanel === "control" ? "flex" : "hidden"} lg:flex`}>

            {/* Timer bar */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-[#141720] border-b border-white/8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 flex-shrink-0">
                <Clock className="w-3 h-3 inline mr-1 mb-0.5" />Bid Timer
              </span>
              <ServerCountdown
                variant="operator"
                timerEndsAt={state?.timerEndsAt}
                timerType={state?.timerType}
                fallback={<span className="text-xs text-white/30">{hasPlayer ? "Ready to bid" : "No player"}</span>}
              />

              {/* Timer input */}
              <input
                type="number"
                value={timerSecs}
                onChange={e => { timerSecsUserEdited.current = true; setTimerSecs(e.target.value); }}
                className="w-12 h-7 text-center text-sm font-mono font-bold bg-white/6 border border-white/12 rounded text-white/70 outline-none focus:border-yellow-400/40"
                min={5} max={300}
              />
              <span className="text-xs text-white/30">sec</span>

              {timerActive && (
                <button
                  onClick={handleExtendTimer}
                  disabled={startTimerMut.isPending}
                  className="h-7 px-2.5 text-xs font-semibold bg-white/5 border border-white/10 rounded text-white/40 hover:text-white/65 transition-all disabled:opacity-30"
                >
                  +30s
                </button>
              )}

              <div className="flex-1" />

              {currentCountdown?.endsAt ? (
                <div
                  title={currentCountdown.message ?? "Pre Auction & Break"}
                  className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded border border-amber-500/40 bg-amber-500/15 text-amber-300 flex-shrink-0"
                >
                  <Coffee className="w-3 h-3 flex-shrink-0" />
                  <CountdownClock
                    endsAt={currentCountdown.endsAt}
                    className="font-mono font-bold tabular-nums text-sm leading-none min-w-[2.75rem] text-center"
                  />
                  <button
                    type="button"
                    onClick={handleCancelCountdown}
                    disabled={setBreakTimerMut.isPending}
                    title="Cancel break timer"
                    className="h-5 w-5 flex items-center justify-center rounded bg-amber-500/25 hover:bg-red-500/35 hover:text-red-300 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openCountdownDialog}
                  className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded border border-amber-500/35 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
                >
                  <Coffee className="w-3 h-3" /> Pre Auction & Break Timer
                </button>
              )}
              <button
                onClick={() => setShowFortuneWheel(true)}
                disabled={timerActive}
                title="Open Fortune Wheel"
                className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded border border-purple-500/35 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Shuffle className="w-3 h-3" /> Fortune Wheel
              </button>
            </div>

            {/* Scrollable core */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 space-y-4 max-w-2xl mx-auto">

                {/* Current player card */}
                <AnimatePresence mode="wait">
                  {hasPlayer ? (
                    <motion.div
                      key={state?.currentPlayer?.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl border border-white/10 overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #1a1f2e, #141820)" }}
                    >
                      <div className="flex items-stretch">
                        <div className="w-20 h-24 flex-shrink-0 bg-white/5 flex items-center justify-center overflow-hidden">
                          {state?.currentPlayer?.photoUrl ? (
                            <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-9 h-9 text-white/20" />
                          )}
                        </div>
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <div className="flex items-start gap-2 justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                {state?.currentPlayer?.role?.toUpperCase() || "PLAYER"}
                                <span className="ml-2 font-mono text-white/25">#{state?.currentPlayer?.id}</span>
                                {state?.currentPlayer?.categoryId && categoryMap[state.currentPlayer.categoryId] && (
                                  <span className="ml-2" style={{ color: categoryMap[state.currentPlayer.categoryId].colorCode || undefined }}>
                                    · {categoryMap[state.currentPlayer.categoryId].name}
                                  </span>
                                )}
                              </p>
                              <h2 className="text-2xl font-display font-bold leading-tight mt-0.5 truncate text-white">
                                {state?.currentPlayer?.name}
                              </h2>
                            </div>
                            {state?.currentPlayer?.jerseyNumber && (
                              <span className="text-2xl font-display font-black text-white/10 flex-shrink-0 leading-none">
                                #{state.currentPlayer.jerseyNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {state?.currentPlayer?.age && (
                              <span className="text-[10px] text-white/40">Age <span className="text-white/70 font-semibold">{state.currentPlayer.age}</span></span>
                            )}
                            {state?.currentPlayer?.city && (
                              <span className="text-[10px] text-white/40">{state.currentPlayer.city}</span>
                            )}
                            {[state?.currentPlayer?.battingStyle, state?.currentPlayer?.bowlingStyle, state?.currentPlayer?.specialization].map((val, i) => {
                              if (!val) return null;
                              const label = currentPlayerSpecGroups[i]?.groupName;
                              return <span key={i} className="text-[10px] text-white/40">{label ? `${label}: ` : ""}{val}</span>;
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-white/3 flex items-center justify-center py-8 text-white/20 text-sm">
                      {isActive ? "Click Next Player to load a player" : "Start the auction to begin"}
                    </div>
                  )}
                </AnimatePresence>

                {/* Timer circle + Bid amount — side by side */}
                <div className="grid grid-cols-2 gap-4">
                  <CircularTimer
                    endsAt={state?.timerEndsAt}
                    totalSeconds={state?.timerType === "bid" ? (state?.bidTimerSeconds ?? 15) : timerSecsNum}
                    running={timerActive}
                  />
                  <div className="flex flex-col items-center justify-center py-4 rounded-2xl border border-white/8 bg-[#141820] text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-1">Current Bid</p>
                    <motion.div
                      key={state?.currentBid}
                      initial={{ scale: 0.88, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="text-4xl font-display font-black text-yellow-400 leading-none mb-2"
                      style={{ textShadow: "0 0 28px rgba(250,204,21,0.35)" }}
                    >
                      {formatIndianRupee(state?.currentBid || 0)}
                    </motion.div>
                    {hasBid ? (
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: state?.currentBidTeamColor || "#fff" }} />
                        <span className="text-sm font-bold" style={{ color: state?.currentBidTeamColor || "inherit" }}>
                          {state?.currentBidTeamName}
                        </span>
                      </div>
                    ) : hasPlayer ? (
                      <p className="text-xs text-white/25">No bid yet</p>
                    ) : null}
                    <p className="text-[10px] text-white/20 mt-1.5">Base {formatIndianRupee(state?.currentPlayer?.basePrice || 0)} · +{formatShortIndianRupee(increment)}/raise</p>
                  </div>
                </div>

                {/* SOLD / UNSOLD / DEFER / MANUAL */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      label: "SOLD",
                      icon: CheckCircle,
                      sub: isPaused ? "Resume first [S]" : timerActive ? "Pause bid first [S]" : !hasBid ? "Bid first [S]" : `${state?.currentBidTeamName ?? ""} [S]`.trim(),
                      title: isPaused ? "Resume auction before concluding a player" : timerActive ? "Pause current bid first, then click SOLD" : !hasBid ? "Place a bid first — use Start Bidding, then a team bid button" : undefined,
                      disabled: controlsLocked || isPaused || !hasBid || timerActive || sellPlayer.isPending,
                      onClick: handleSell,
                      bg: "bg-green-600/15", border: "border-green-600/60", text: "text-green-400", glow: "0 0 16px rgba(34,197,94,0.25)",
                    },
                    {
                      label: "UNSOLD",
                      icon: XCircle,
                      sub: isPaused ? "Resume first [U]" : timerActive ? "Pause bid first [U]" : "No bid [U]",
                      title: isPaused ? "Resume auction before concluding a player" : timerActive ? "Pause current bid first" : undefined,
                      disabled: controlsLocked || isPaused || !hasPlayer || timerActive || markUnsold.isPending,
                      onClick: handleUnsold,
                      bg: "bg-red-600/10", border: "border-red-600/50", text: "text-red-400", glow: "",
                    },
                    {
                      label: "DEFER",
                      icon: Hourglass,
                      sub: isPaused ? "Resume first [D]" : timerActive ? "Pause bid first [D]" : "Back queue [D]",
                      title: isPaused ? "Resume auction before deferring a player" : timerActive ? "Pause current bid first" : undefined,
                      disabled: controlsLocked || isPaused || !hasPlayer || timerActive || deferPlayerMut.isPending,
                      onClick: handleDeferPlayer,
                      bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400", glow: "",
                    },
                    {
                      label: "MANUAL",
                      icon: Settings2,
                      sub: timerActive ? "Pause bid first [M]" : "Set amount [M]",
                      title: timerActive ? "Pause current bid first" : undefined,
                      disabled: !hasPlayer || timerActive,
                      onClick: () => { setManualAmount(String(state?.currentBid || state?.currentPlayer?.basePrice || 0)); setManualTeamId(""); setManualSellOpen(true); },
                      bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-400", glow: "",
                    },
                  ].map(({ label, icon: Icon, sub, title, disabled, onClick, bg, border, text, glow }) => (
                    <button
                      key={label}
                      disabled={disabled}
                      onClick={onClick}
                      title={title}
                      className={`col-span-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed ${bg} ${border} ${text} hover:scale-[1.02] enabled:hover:scale-[1.02]`}
                      style={{ boxShadow: glow || undefined }}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                      <span className="text-[10px] font-normal opacity-55">{sub}</span>
                    </button>
                  ))}
                </div>

                {/* Reauction last player */}
                <button
                  onClick={() => void handleInstantReauction()}
                  disabled={controlsLocked || !lastSaleBid || reAuction.isPending || isPaused}
                  title={isPaused ? "Resume auction before re-auctioning" : "Reverse the last sale and start a reauction [Z]"}
                  className="w-full flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 border-orange-500/40 bg-orange-500/10 text-orange-300 font-bold text-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:bg-orange-500/20 enabled:hover:scale-[1.01]"
                >
                  <RotateCcw className="w-5 h-5" />
                  Reauction Last Player
                  <span className="text-[10px] font-normal opacity-55">
                    {isPaused ? "Resume first [Z]" : !lastSaleBid ? "No recent sale [Z]" : "Undo last sale [Z]"}
                  </span>
                </button>

                {/* NEXT PLAYER + START/STOP BIDDING */}
                <div className="grid grid-cols-5 gap-2">
                  <button
                    disabled={controlsLocked || !isActive || timerActive || nextPlayer.isPending}
                    onClick={() => handleNextPlayer(selectionMode === "random" ? "random" : "sequential")}
                    title={timerActive ? "Stop bidding first" : undefined}
                    className="col-span-3 flex items-center justify-center gap-3 py-4 rounded-xl font-display font-black text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-yellow-500/90 to-yellow-400 text-black hover:from-yellow-400 hover:to-yellow-300 enabled:shadow-[0_0_28px_rgba(234,179,8,0.4)] enabled:hover:scale-[1.01]"
                  >
                    {selectionMode === "random" ? <Shuffle className="w-6 h-6" /> : <SkipForward className="w-6 h-6" />}
                    NEXT PLAYER
                    {nextPlayer.isPending
                      ? <span className="text-sm font-normal opacity-60">Loading…</span>
                      : selectionMode === "random"
                      ? <span className="text-sm font-normal opacity-60">(Random)</span>
                      : <span className="text-sm font-normal opacity-60 font-mono">N</span>
                    }
                  </button>

                  {timerActive ? (
                    <button
                      onClick={handleStopTimer}
                      disabled={stopTimerMut.isPending}
                      title="Freeze current player, bid, and timer — for disputes or interruptions"
                      className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-black text-lg transition-all disabled:opacity-40 bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 hover:bg-amber-500/30 enabled:hover:scale-[1.01]"
                    >
                      <Pause className="w-5 h-5" /> PAUSE CURRENT BID
                    </button>
                  ) : (
                    <button
                      onClick={handleStartBiddingClick}
                      disabled={!hasPlayer || !isActive || startTimerMut.isPending}
                      title={isPaused ? "Resume auction before starting bidding" : undefined}
                      className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-black text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 enabled:shadow-[0_0_22px_rgba(16,185,129,0.45)] enabled:hover:scale-[1.01]"
                    >
                      <Play className="w-5 h-5" /> {currentBidPaused ? "RESUME BIDDING" : "START BIDDING"}
                    </button>
                  )}
                </div>


                {/* Quick Bid */}
                {teams && teams.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                      Quick Bid · Next: <span className="text-yellow-400 font-mono">{formatShortIndianRupee(nextBidAmount)}</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {teams.map(team => {
                        const purseData = teamPurses?.find(p => p.teamId === team.id);
                        const capacity = purseData?.effectiveCapacity ?? team.purse;
                        const spendable = purseData?.spendablePurse ?? (capacity - (team.purseUsed || 0));
                        const reserved  = purseData?.reservePurse ?? 0;
                        const slotsNeeded = purseData?.slotsRequired ?? 0;
                        const bought    = purseData?.playersBought ?? 0;
                        const maxSquad  = purseData?.maximumSquadSize ?? 0;
                        const maxReached = maxSquad > 0 && bought >= maxSquad;
                        const isLeading = state?.currentBidTeamId === team.id;
                        const nextBid   = nextBidAmount;
                        const isTrialRestricted = isTrialMode && trialTeamIds !== null && !trialTeamIds.includes(team.id);
                        const canBid = isActive && hasPlayer && timerActive && spendable >= nextBid && !!team.isBiddingEnabled && !isLeading && !isTrialRestricted && !maxReached && !controlsLocked && !placeBid.isPending;
                        return (
                          <button key={team.id} disabled={!canBid} onClick={() => handleBid(team.id)}
                            className={`relative p-3 rounded-xl border-2 text-left transition-all ${isLeading ? "scale-[1.01]" : "border-white/10"} ${!canBid ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"}`}
                            style={{ borderColor: isLeading ? team.color || "#fff" : undefined, boxShadow: isLeading ? `0 0 16px ${team.color}44` : undefined, background: `${team.color || "#888"}0d` }}
                          >
                            {isLeading && (
                              <div className="absolute top-1.5 right-2 flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: team.color || "#fff" }} />
                                <span className="text-[9px] font-bold" style={{ color: team.color || "#fff" }}>LEAD</span>
                              </div>
                            )}
                            {isTrialRestricted && (
                              <div className="absolute inset-0 rounded-xl bg-[#0f1117]/60 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-amber-400/70 uppercase">Trial</span>
                              </div>
                            )}
                            {maxReached && !isTrialRestricted && (
                              <div className="absolute top-1.5 right-2"><span className="text-[8px] font-bold text-red-400 uppercase">Full</span></div>
                            )}
                            <div className="flex items-center gap-2 mb-1">
                              {team.logoUrl ? (
                                <img src={team.logoUrl} alt={team.name} className="w-5 h-5 rounded object-contain flex-shrink-0" />
                              ) : (
                                <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0" style={{ backgroundColor: `${team.color}33`, color: team.color || "#fff" }}>
                                  {team.shortCode?.slice(0, 2)}
                                </div>
                              )}
                              <span className="text-xs font-bold truncate text-white/80">{team.shortCode || team.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] text-white/40">{formatShortIndianRupee(spendable)} spendable</p>
                              {reserved > 0 && (
                                <span title={`${formatShortIndianRupee(reserved)} reserved for ${slotsNeeded} slot${slotsNeeded !== 1 ? "s" : ""}`} className="flex-shrink-0">
                                  <ShieldAlert className="w-2.5 h-2.5 text-amber-400/70" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </main>

          {/* ══ RIGHT: TEAMS + BID HISTORY ══════════════════════════════════ */}
          <aside className={`border-l border-white/8 flex-col min-h-0 overflow-hidden bg-[#141720] ${mobilePanel === "teams" ? "flex" : "hidden"} ${rightCollapsed ? "lg:hidden" : "lg:flex"}`}>

            {/* Teams & Purse */}
            <div className="flex flex-col flex-shrink-0" style={{ maxHeight: "55%" }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-white/45" />
                  <span className="text-sm font-bold uppercase tracking-wider text-white/60">Teams &amp; Purse</span>
                </div>
                <a href={`/tournament/${tournamentId}/teams`} className="text-[11px] text-white/35 hover:text-white/65 transition-colors flex items-center gap-1">
                  All <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2.5 flex flex-col gap-2">
                  {(teams || []).map(team => {
                    const purseData = teamPurses?.find(p => p.teamId === team.id);
                    const spent = purseData?.purseUsed ?? team.purseUsed ?? 0;
                    const spendable = purseData?.spendablePurse ?? ((purseData?.effectiveCapacity ?? team.purse) - spent);
                    const reserved = purseData?.reservePurse ?? 0;
                    const slotsNeeded = purseData?.slotsRequired ?? 0;
                    const bought = purseData?.playersBought ?? 0;
                    const maxSquad = purseData?.maximumSquadSize ?? 0;
                    const maxReached = maxSquad > 0 && bought >= maxSquad;
                    const isLeading = state?.currentBidTeamId === team.id;
                    const capacity = purseData?.effectiveCapacity ?? team.purse;
                    const usedPct = capacity > 0 ? Math.min(100, Math.round((spent / capacity) * 100)) : 0;
                    return (
                      <div
                        key={team.id}
                        className={`rounded-xl p-3 border transition-all ${isLeading ? "border-2" : "border-white/10"}`}
                        style={{
                          borderColor: isLeading ? team.color || "#fff" : undefined,
                          boxShadow: isLeading ? `0 0 14px ${team.color}33` : undefined,
                          backgroundColor: `${team.color || "#888"}0c`,
                        }}
                      >
                        <div className="flex items-start gap-3 mb-2.5">
                          {team.logoUrl ? (
                            <img
                              src={team.logoUrl}
                              alt={team.name}
                              className="w-11 h-11 rounded-md object-contain flex-shrink-0 bg-white/5 p-0.5"
                            />
                          ) : (
                            <div
                              className="w-11 h-11 rounded-md text-xs font-mono font-black flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${team.color}25`, color: team.color || "#fff" }}
                            >
                              {team.shortCode?.slice(0, 3) || "T"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold leading-tight text-white truncate">{team.name}</p>
                              {isLeading && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase flex-shrink-0"
                                  style={{ color: team.color || "#fff", backgroundColor: `${team.color || "#fff"}18` }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: team.color || "#fff" }} />
                                  Lead
                                </span>
                              )}
                            </div>
                            {team.shortCode ? (
                              <p className="text-[11px] text-white/40 mt-0.5">{team.shortCode}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Max Bid</span>
                            <span className={`text-base font-mono font-bold tabular-nums ${maxReached ? "text-red-400" : "text-emerald-400"}`}>
                              {maxReached ? "SQUAD FULL" : formatShortIndianRupee(spendable)}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Squad</span>
                            <span className="text-sm font-semibold text-white/90 tabular-nums text-right">
                              {bought}
                              {maxSquad > 0 ? ` / ${maxSquad}` : ""} players
                              <span className="text-white/35 mx-1">·</span>
                              <span className="text-white/75">{formatShortIndianRupee(spent)} spent</span>
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Reserve</span>
                            <span className="text-sm font-mono font-semibold text-amber-400/90 tabular-nums text-right">
                              {reserved > 0 ? (
                                <>
                                  {formatShortIndianRupee(reserved)}
                                  {slotsNeeded > 0 ? (
                                    <span className="text-amber-300/70 font-sans font-medium">
                                      {" "}
                                      · {slotsNeeded} slot{slotsNeeded !== 1 ? "s" : ""}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-white/35">—</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${usedPct}%`, backgroundColor: team.color || "#888" }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-white/30 tabular-nums">
                          {formatShortIndianRupee(spent)} of {formatShortIndianRupee(capacity)} used
                        </p>
                      </div>
                    );
                  })}
                  {!teams?.length && <p className="text-center text-sm text-white/30 py-6">No teams</p>}
                </div>
              </ScrollArea>
            </div>

            {/* Last Actions / Bid History */}
            <div className="flex-1 flex flex-col min-h-0 border-t border-white/8 overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-white/8 flex-shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-white/50">Last Actions</span>
              </div>
              {bids && bids.length > 0 && (
                <div className="px-3 py-1.5 bg-yellow-400/5 border-b border-yellow-400/10 flex-shrink-0">
                  <p className="text-xs text-yellow-300/70 font-medium truncate">
                    {bids[0]?.teamName ? `${bids[0].teamName} bid ${formatShortIndianRupee(bids[0].amount)}` : "Latest bid"}
                  </p>
                </div>
              )}
              <ScrollArea className="flex-1 min-h-0">
                {bids && bids.length > 0 ? (
                  bids.slice(0, 30).map((bid, i) => {
                    const t = teamMap[bid.teamId];
                    return (
                      <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-white/5 last:border-0 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t?.color || "#888" }} />
                          <div className="min-w-0">
                            <p className="text-xs text-white/55 truncate font-medium">{bid.playerName || "—"}</p>
                            <p className="text-[11px] text-white/30 truncate">{bid.teamName || t?.name || "—"}</p>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-semibold text-yellow-400/80 flex-shrink-0">{formatShortIndianRupee(bid.amount)}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-xs text-white/25 py-6">No bids yet</p>
                )}
              </ScrollArea>
            </div>
          </aside>
        </div>

        {/* ══════════ BOTTOM BAR ════════════════════════════════════════════ */}
        <div className="flex-shrink-0 h-7 bg-[#0d0f14] border-t border-white/5 flex items-center px-4 gap-0">
          {/* Tournament name — left */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Tournament</span>
            <span className="text-[10px] font-semibold text-white/55 truncate max-w-[200px]">
              {tournament?.name || "—"}
            </span>
          </div>

          <div className="w-px h-4 bg-white/8 mx-4 flex-shrink-0" />

          {/* Keyboard shortcuts — centre */}
          <div className="flex items-center gap-5 flex-1 justify-center">
            {["[S] Sold","[U] Unsold","[D] Defer","[M] Manual","[Space] Start/Pause","[N] Next","[Z] Undo"].map((s, i) => (
              <span key={i} className="text-[10px] text-white/20 font-medium whitespace-nowrap hidden sm:block">{s}</span>
            ))}
          </div>

          <div className="w-px h-4 bg-white/8 mx-4 flex-shrink-0" />

          {/* Operator footer — branding handled in header center mark */}
          <div className="w-[1px] flex-shrink-0" aria-hidden />
        </div>

        {/* Mobile panel switcher */}
        <div className="flex-shrink-0 flex lg:hidden border-t border-white/8 bg-[#141720]">
          {(["queue", "control", "teams"] as const).map(p => (
            <button key={p} onClick={() => setMobilePanel(p)}
              className={`flex-1 py-2 text-xs font-semibold capitalize transition-all ${mobilePanel === p ? "text-yellow-300 border-t-2 border-yellow-400" : "text-white/35 hover:text-white/55"}`}>
              {p}
            </button>
          ))}
        </div>

        {/* ══ DIALOGS ══════════════════════════════════════════════════════ */}


        {/* Manual Sell dialog */}
        <Dialog open={manualSellOpen} onOpenChange={setManualSellOpen}>
          <DialogContent className="dark max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Manual Sell
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {manualSellMut.error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                  {(manualSellMut.error as { message?: string })?.message || "Failed"}
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Team</Label>
                <Select value={manualTeamId} onValueChange={setManualTeamId}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>{(teams || []).map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                <Input type="number" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="e.g. 500000" />
              </div>
              {showAdvancedReason && (
                <AuditReasonField value={manualSellReason} onChange={setManualSellReason} label="Audit reason (optional)" />
              )}
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setShowAdvancedReason(v => !v)}
              >
                {showAdvancedReason ? "Hide advanced options" : "Advanced: add audit reason"}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setManualSellOpen(false)}>Cancel</Button>
                <Button className="flex-1" disabled={!manualTeamId || !manualAmount || manualSellMut.isPending} onClick={handleManualSell}>
                  {manualSellMut.isPending ? "Selling…" : "Confirm Sell"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category filter dialog */}
        <Dialog open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
          <DialogContent className="dark max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> Filter by Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <button
                onClick={() => setPendingCategoryIds([])}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${pendingCategoryIds.length === 0 ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                All Categories
              </button>
              {(categories || []).map(cat => {
                const sel = pendingCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setPendingCategoryIds(prev => sel ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-2 ${sel ? "border-blue-400/40 bg-blue-400/10 text-blue-300" : "border-border text-muted-foreground hover:bg-accent"}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colorCode || "#888" }} />
                    {cat.name}
                  </button>
                );
              })}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setCategoryFilterOpen(false)}>Cancel</Button>
                <Button className="flex-1" onClick={applyCategoryFilter}>Apply</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pre Auction & Break Timer dialog */}
        <Dialog open={countdownDialogOpen} onOpenChange={setCountdownDialogOpen}>
          <DialogContent className="dark max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-400" />
                Pre Auction & Break Timer
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Minutes</Label>
                  <Input type="number" value={countdownMinutes} onChange={e => setCountdownMinutes(e.target.value)} min={0} max={60} step={1} placeholder="5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Seconds</Label>
                  <Input type="number" value={countdownSeconds} onChange={e => setCountdownSeconds(e.target.value)} min={0} max={59} step={1} placeholder="0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label (optional)</Label>
                <Input value={countdownLabel} onChange={e => setCountdownLabel(e.target.value)} placeholder="e.g. Pre Auction, Lunch Break" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCountdownDialogOpen(false)}>Cancel</Button>
                <Button className="flex-1" disabled={setBreakTimerMut.isPending} onClick={handleStartCountdown}>
                  Start
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Resume current bid — after Pause Current Bid */}
        <Dialog open={resumeBidDialogOpen} onOpenChange={setResumeBidDialogOpen}>
          <DialogContent className="dark max-w-md">
            <DialogHeader>
              <DialogTitle>Resume bidding</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Current player and bid are frozen. Choose how to continue:
              </p>
              <div className="space-y-2">
                <Button className="w-full justify-start h-auto py-3" variant="outline" onClick={handleResumeBidContinue}>
                  <div className="text-left">
                    <p className="font-semibold text-sm">Continue from current state</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Keep {state?.currentBidTeamName ?? "current bid"} at {formatIndianRupee(state?.currentBid ?? 0)} and restart the timer.
                    </p>
                  </div>
                </Button>
                <Button
                  className="w-full justify-start h-auto py-3"
                  variant="outline"
                  disabled={reAuction.isPending}
                  onClick={handleResumeBidRestart}
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm">Restart this player auction</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reset to {formatIndianRupee(state?.currentPlayer?.basePrice ?? 0)} with no leading bidder.
                    </p>
                  </div>
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => setResumeBidDialogOpen(false)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Auction readiness gate */}
        <Dialog open={readinessModalOpen} onOpenChange={setReadinessModalOpen}>
          <DialogContent className="dark max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Auction is not ready
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Complete these before starting:</p>
              <ul className="space-y-2 text-sm">
                {readinessIssues.map((issue) => {
                  const fixLink = readinessFixLinks[issue.id];
                  return (
                    <li key={`${issue.id}-${issue.message}`} className="flex items-start justify-between gap-3 rounded-md border border-border/50 px-3 py-2">
                      <span className="flex items-start gap-2 min-w-0">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{issue.message}</span>
                      </span>
                      {fixLink && (
                        <button
                          type="button"
                          onClick={() => {
                            setReadinessModalOpen(false);
                            navigate(fixLink);
                          }}
                          className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                        >
                          Fix →
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {readinessIssues[0] && readinessFixLinks[readinessIssues[0].id] && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setReadinessModalOpen(false);
                    navigate(readinessFixLinks[readinessIssues[0].id]!);
                  }}
                >
                  Fix first issue →
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => setReadinessModalOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bring unsold players — instant confirm */}
        <Dialog open={showBatchReAuctionConfirm} onOpenChange={setShowBatchReAuctionConfirm}>
          <DialogContent className="dark max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-orange-400" /> Bring Unsold Players?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Move all {unsoldPlayers.length} unsold player{unsoldPlayers.length !== 1 ? "s" : ""} back to the available queue for another round.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowBatchReAuctionConfirm(false)}>Cancel</Button>
                <Button className="flex-1 bg-orange-500 hover:bg-orange-400 text-white" disabled={reAuctionAllUnsoldMut.isPending} onClick={handleBatchReAuction}>
                  {reAuctionAllUnsoldMut.isPending ? "Moving…" : "Bring Unsold Players"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Conclude auction */}
        <Dialog open={concludeDialogOpen} onOpenChange={setConcludeDialogOpen}>
          <DialogContent className="dark max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" /> Conclude Auction
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sold</p>
                  <p className="text-2xl font-black text-green-400">{soldPlayers.length}</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Unsold remaining</p>
                  <p className="text-2xl font-black text-red-400">{unsoldPlayers.length}</p>
                </div>
              </div>
              {unsoldPlayers.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Unsold players will stay unsold. You can run another unsold round first, or conclude anyway.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">All players are sold. Ready to conclude.</p>
              )}
              <div className="flex flex-col gap-2">
                {unsoldPlayers.length > 0 && (
                  <Button variant="outline" className="w-full" onClick={() => { setConcludeDialogOpen(false); setShowBatchReAuctionConfirm(true); }}>
                    Continue Unsold Round
                  </Button>
                )}
                <Button
                  className="w-full bg-green-600 hover:bg-green-500"
                  disabled={concludeAuctionMut.isPending}
                  onClick={() => void handleConcludeAuction(unsoldPlayers.length > 0)}
                >
                  {concludeAuctionMut.isPending ? "Concluding…" : unsoldPlayers.length > 0 ? "Conclude Auction Anyway" : "Conclude Auction"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setConcludeDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>

      {/* Fortune Wheel inline modal — lazy loaded, no new tab */}
      {showFortuneWheel && (
        <Suspense fallback={null}>
          <FortuneWheelModal
            open={showFortuneWheel}
            onClose={() => setShowFortuneWheel(false)}
            tournamentId={tournamentId}
          />
        </Suspense>
      )}

      <PurseBoosterDialog
        open={showPurseBooster}
        onOpenChange={setShowPurseBooster}
        tournamentId={tournamentId}
        teams={(teams ?? []).map(t => ({ id: t.id, name: t.name, shortCode: t.shortCode ?? "" }))}
      />

    </OperatorLayout>
  );
}
