import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
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
  useUndoLastAction,
  useReAuctionPlayer,
  useReAuctionAllUnsold,
  useStartTimer,
  useStopTimer,
  useSetDisplayOverlay,
  useSetDisplayPlayerFilter,
  useSetCategoryFilter,
  useDeferPlayer,
  useSetBreakTimer,
  useSetPreAuctionCountdown,
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
import { useTimerExpired } from "@/hooks/use-timer-expired";
import { ServerCountdown } from "@/components/server-countdown";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, CheckCircle, XCircle, Undo2,
  Shuffle, User, Trophy, Clock, Gavel, RotateCcw, AlertTriangle,
  Settings2, Timer, LayoutGrid, Tag, X, Filter, Search,
  Hourglass, Monitor, Users, Crown, ListOrdered, ExternalLink, ShieldAlert, Star,
  PanelRightClose, PanelRightOpen, Tv2,
  Wifi, WifiOff, RefreshCw, Coffee, AlarmClock, PlusCircle,
} from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { useRoleSpecGroups } from "@/hooks/use-role-spec-groups";
import { DISPLAY_THEMES_LIST, type DisplayThemeName } from "@/lib/display-theme";

function CountdownClock({ endsAt }: { endsAt: string }) {
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
  return <span className="font-display font-black tabular-nums text-lg leading-none">{display}</span>;
}

export default function AuctionOperator() {
  const [, params] = useRoute("/tournament/:id/auction");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const [manualSellOpen, setManualSellOpen] = useState(false);
  const [manualTeamId, setManualTeamId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [reAuctionTab, setReAuctionTab] = useState<"queue" | "sold" | "unsold">("queue");
  const [showBatchReAuctionConfirm, setShowBatchReAuctionConfirm] = useState(false);
  const [timerSecs, setTimerSecs] = useState("30");
  const [playerSearch, setPlayerSearch] = useState("");
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [pendingCategoryIds, setPendingCategoryIds] = useState<number[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [mobilePanel, setMobilePanel] = useState<"queue" | "control" | "teams">("control");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // Break timer / pre-auction countdown dialog
  const [countdownDialogOpen, setCountdownDialogOpen] = useState(false);
  const [countdownDialogType, setCountdownDialogType] = useState<"break" | "pre-auction">("break");
  const [countdownMinutes, setCountdownMinutes] = useState("5");
  const [countdownLabel, setCountdownLabel] = useState("");
  // Per-team bid debounce: maps teamId → timestamp of last bid click
  const bidDebounce = useRef<Map<number, number>>(new Map());

  // Display theme — persisted per-tournament in localStorage, appended to the
  // Open Display URL so the LED screen loads with the chosen aesthetic.
  const [displayTheme, setDisplayTheme] = useState<DisplayThemeName>(() => {
    try {
      return (localStorage.getItem(`display_theme_${tournamentId}`) ?? "default") as DisplayThemeName;
    } catch {
      return "default";
    }
  });
  function handleDisplayThemeChange(t: DisplayThemeName) {
    setDisplayTheme(t);
    try { localStorage.setItem(`display_theme_${tournamentId}`, t); } catch { /* ignore */ }
  }

  const { connectionStatus } = useAuctionSocket(tournamentId);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: state } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 1500 },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: bids } = useListBids(tournamentId, {
    query: { queryKey: getListBidsQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 5000 },
  });
  const { data: categories } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 5000 },
  });

  const startAuction = useStartAuction();
  const pauseAuction = usePauseAuction();
  const nextPlayer = useNextPlayer();
  const placeBid = usePlaceBid();
  const sellPlayer = useSellPlayer();
  const manualSellMut = useManualSell();
  const markUnsold = useMarkUnsold();
  const undoAction = useUndoLastAction();
  const reAuction = useReAuctionPlayer();
  const reAuctionAllUnsoldMut = useReAuctionAllUnsold();
  const startTimerMut = useStartTimer();
  const stopTimerMut = useStopTimer();
  const setDisplayOverlay = useSetDisplayOverlay();
  const setDisplayPlayerFilterMut = useSetDisplayPlayerFilter();
  const setCategoryFilter = useSetCategoryFilter();
  const deferPlayerMut = useDeferPlayer();
  const setBreakTimerMut = useSetBreakTimer();
  const setPreAuctionMut = useSetPreAuctionCountdown();

  // Spec group names for the current player's role (displayed in the player card)
  const currentPlayerSpecGroups = useRoleSpecGroups(tournament?.sport, state?.currentPlayer?.role);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
  }, [qc, tournamentId]);

  async function handleNextPlayer(mode: "sequential" | "random", playerId?: number) {
    await nextPlayer.mutateAsync({ tournamentId, data: { mode, playerId } });
    // Auto-reset LED to main live view whenever a new player is loaded
    if (state?.displayOverlay) {
      await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: "off" } });
    }
    invalidate();
  }

  function handleBid(teamId: number) {
    // Per-team 150 ms debounce — prevent double-clicks on the same button only
    const now = Date.now();
    if ((bidDebounce.current.get(teamId) ?? 0) + 150 > now) return;
    bidDebounce.current.set(teamId, now);

    const increment = state?.bidIncrement ?? 50000;
    const nextBid = (state?.currentBid || 0) + increment;
    const bidTeam = teamMap[teamId];

    // Optimistic update — show new bid amount and leading team immediately
    qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        currentBid: nextBid,
        currentBidTeamId: teamId,
        currentBidTeamName: bidTeam?.name ?? old.currentBidTeamName,
        currentBidTeamColor: bidTeam?.color ?? old.currentBidTeamColor,
      };
    });

    // Fire mutation in the background — UI is already updated, don't await
    placeBid
      .mutateAsync({ tournamentId, data: { teamId, amount: nextBid } })
      .then(result => {
        // Authoritative result from server replaces the optimistic state
        qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
        invalidate();
      })
      .catch(() => {
        // On error revert by re-fetching authoritative state
        invalidate();
      });
  }

  async function handleSell() {
    await sellPlayer.mutateAsync({ tournamentId });
    invalidate();
  }

  async function handleUnsold() {
    await markUnsold.mutateAsync({ tournamentId });
    invalidate();
  }

  async function handleUndo() {
    await undoAction.mutateAsync({ tournamentId });
    invalidate();
  }

  async function handleManualSell() {
    if (!manualTeamId || !manualAmount) return;
    try {
      await manualSellMut.mutateAsync({
        tournamentId,
        data: { teamId: parseInt(manualTeamId), amount: parseInt(manualAmount) || 0 },
      });
      setManualSellOpen(false);
      setManualTeamId("");
      setManualAmount("");
      invalidate();
    } catch {
      // error shown in dialog via manualSellMut.error
    }
  }

  async function handleReAuction(playerId: number, startFromBase: boolean) {
    await reAuction.mutateAsync({ tournamentId, data: { playerId, startFromBase } });
    invalidate();
  }

  async function handleStartTimer() {
    const secs = parseInt(timerSecs) || 30;
    const result = await startTimerMut.mutateAsync({ tournamentId, data: { seconds: secs } });
    qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    invalidate();
  }

  async function handleExtendTimer() {
    const secs = (parseInt(timerSecs) || 30) + 30;
    const result = await startTimerMut.mutateAsync({ tournamentId, data: { seconds: secs } });
    qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    invalidate();
  }

  async function handleStopTimer() {
    const result = await stopTimerMut.mutateAsync({ tournamentId });
    qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    invalidate();
  }

  async function handleDeferPlayer() {
    await deferPlayerMut.mutateAsync({ tournamentId });
    invalidate();
  }

  function openCountdownDialog(type: "break" | "pre-auction") {
    setCountdownDialogType(type);
    setCountdownMinutes("5");
    setCountdownLabel("");
    setCountdownDialogOpen(true);
  }

  async function handleStartCountdown() {
    const mins = parseFloat(countdownMinutes) || 5;
    const durationSeconds = Math.round(mins * 60);
    const message = countdownLabel.trim() || undefined;
    if (countdownDialogType === "break") {
      const result = await setBreakTimerMut.mutateAsync({ tournamentId, data: { action: "start", durationSeconds, message } });
      qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    } else {
      const result = await setPreAuctionMut.mutateAsync({ tournamentId, data: { action: "start", ...(message ? { message } : {}) } });
      qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    }
    setCountdownDialogOpen(false);
    invalidate();
  }

  async function handleCancelCountdown() {
    const dc = (state as { displayCountdown?: { type?: string } | null } | undefined)?.displayCountdown;
    if (dc?.type === "break") {
      const result = await setBreakTimerMut.mutateAsync({ tournamentId, data: { action: "cancel" } });
      qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    } else {
      const result = await setPreAuctionMut.mutateAsync({ tournamentId, data: { action: "cancel" } });
      qc.setQueryData(getGetAuctionStateQueryKey(tournamentId), result);
    }
    invalidate();
  }

  async function handleBatchReAuction() {
    await reAuctionAllUnsoldMut.mutateAsync({ tournamentId });
    setShowBatchReAuctionConfirm(false);
    invalidate();
  }

  function openCategoryFilter() {
    const current: number[] = (state?.activeCategoryIds as number[] | null) ?? [];
    setPendingCategoryIds(current);
    setCategoryFilterOpen(true);
  }

  async function applyCategoryFilter() {
    await setCategoryFilter.mutateAsync({
      tournamentId,
      data: { categoryIds: pendingCategoryIds.length > 0 ? pendingCategoryIds : null } as any,
    });
    setCategoryFilterOpen(false);
    invalidate();
  }

  async function clearCategoryFilter() {
    await setCategoryFilter.mutateAsync({ tournamentId, data: { categoryIds: null } as any });
    invalidate();
  }

  const timerSecsUserEdited = useRef(false);
  useEffect(() => {
    if (!timerSecsUserEdited.current && state?.timerSeconds) {
      setTimerSecs(String(state.timerSeconds));
    }
  }, [state?.timerSeconds]);

  const timerExpired = useTimerExpired(state?.timerEndsAt);

  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
  const hasPlayer = !!state?.currentPlayer;
  const hasBid = !!state?.currentBidTeamId;
  const timerActive = !!state?.timerEndsAt && !timerExpired;
  const available = (players || []).filter(p => p.status === "available");
  const soldPlayers = (players || []).filter(p => p.status === "sold");
  const unsoldPlayers = (players || []).filter(p => p.status === "unsold");
  const retainedPlayers = (players || []).filter(p => p.status === "retained");
  const increment = state?.bidIncrement ?? 50000;
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t]));
  const activeCategoryIds: number[] | null = (state?.activeCategoryIds as number[] | null) ?? null;
  const categoryMap = Object.fromEntries((categories || []).map(c => [c.id, c]));
  const selectionMode = (state as any)?.playerSelectionMode ?? "sequential";
  const licenseStatus: string = (state as any)?.licenseStatus ?? "trial";
  const isTrialMode = licenseStatus !== "active";
  const trialTeamIds: number[] | null = (state as any)?.trialTeamIds ?? null;
  const deferredPlayerIds: number[] | null = (state as any)?.deferredPlayerIds ?? null;
  const currentCountdown = (state as { displayCountdown?: { type?: string; endsAt?: string; message?: string | null } | null } | undefined)?.displayCountdown ?? null;

  const searchLower = playerSearch.trim().toLowerCase();
  const filterBySearch = <T extends { name: string; jerseyNumber?: string | null }>(list: T[]): T[] =>
    searchLower
      ? list.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.jerseyNumber != null && p.jerseyNumber.includes(searchLower))
        )
      : list;

  // Category-filtered available queue
  const filteredQueue = activeCategoryIds && activeCategoryIds.length > 0
    ? available.filter(p => p.categoryId && activeCategoryIds.includes(p.categoryId))
    : available;

  // Role-filtered queue for left panel
  const roleFilteredQueue = roleFilter === "all"
    ? filteredQueue
    : filteredQueue.filter(p => {
        const r = (p.role || "").toLowerCase();
        if (roleFilter === "bat") return r === "bat" || r === "batsman" || r.includes("bat");
        if (roleFilter === "bowl") return r === "bowl" || r === "bowler" || r.includes("bowl");
        if (roleFilter === "ar") return r === "ar" || r.includes("all") || r === "all-rounder";
        if (roleFilter === "wk") return r === "wk" || r.includes("wicket") || r.includes("keeper");
        return r === roleFilter;
      });

  const roleCounts = {
    bat: filteredQueue.filter(p => { const r = (p.role || "").toLowerCase(); return r === "bat" || r === "batsman" || r.includes("bat"); }).length,
    bowl: filteredQueue.filter(p => { const r = (p.role || "").toLowerCase(); return r === "bowl" || r === "bowler" || r.includes("bowl"); }).length,
    ar: filteredQueue.filter(p => { const r = (p.role || "").toLowerCase(); return r === "ar" || r.includes("all") || r === "all-rounder"; }).length,
    wk: filteredQueue.filter(p => { const r = (p.role || "").toLowerCase(); return r === "wk" || r.includes("wicket") || r.includes("keeper"); }).length,
  };

  const leftPanelList = filterBySearch(
    reAuctionTab === "queue" ? roleFilteredQueue
    : reAuctionTab === "sold" ? soldPlayers
    : unsoldPlayers
  );

  // LED overlay helpers
  const ledOverlayButtons = [
    { mode: "team" as const, label: "Team", icon: LayoutGrid, bg: "bg-primary text-black" },
    { mode: "player" as const, label: "Player", icon: Users, bg: "bg-blue-600 text-white" },
    { mode: "top5" as const, label: "Top5", icon: Crown, bg: "bg-purple-600 text-white" },
  ];

  return (
    <AppLayout tournamentId={tournamentId} noPadding>
      <div className="flex flex-col h-full overflow-hidden">

        {/* ─── TOP STATUS BAR ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-border bg-card/70 backdrop-blur flex items-center gap-2 px-3 py-1.5 flex-wrap z-10 min-h-11">
          {/* Auction status */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
              isActive ? "bg-green-500/15 border-green-500/40 text-green-400"
              : isPaused ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
              : "bg-border/50 border-border text-muted-foreground"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current ${isActive ? "animate-pulse" : ""}`} />
              {state?.status?.toUpperCase() || "IDLE"}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span className="text-muted-foreground">SOLD <span className="text-green-400 font-bold">{state?.soldPlayersCount || 0}</span></span>
            <span className="text-muted-foreground hidden sm:inline">UNSOLD <span className="text-red-400 font-bold">{state?.unsoldPlayersCount || 0}</span></span>
            <span className="text-muted-foreground">LEFT <span className="text-foreground font-bold">{state?.remainingPlayersCount || 0}</span></span>
            {retainedPlayers.length > 0 && (
              <span className="text-muted-foreground hidden sm:inline">RET <span className="text-purple-400 font-bold">{retainedPlayers.length}</span></span>
            )}
          </div>

          {(tournament as { auctionCode?: string | null } | undefined)?.auctionCode && (
            <span className="font-mono text-[10px] tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 flex-shrink-0 hidden sm:inline">
              {(tournament as { auctionCode?: string | null }).auctionCode}
            </span>
          )}

          <div className="h-4 w-px bg-border flex-shrink-0" />

          {/* Category selector */}
          {categories && categories.length > 0 && (
            <button
              onClick={openCategoryFilter}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-semibold transition-colors flex-shrink-0 ${
                activeCategoryIds && activeCategoryIds.length > 0
                  ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Tag className="w-3 h-3" />
              {activeCategoryIds && activeCategoryIds.length > 0
                ? activeCategoryIds.length === 1
                  ? (categoryMap[activeCategoryIds[0]]?.name ?? "1 Category")
                  : `${activeCategoryIds.length} Categories`
                : "All Categories"}
            </button>
          )}

          {/* Start / Pause */}
          {!isActive ? (
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs px-3 flex-shrink-0"
              onClick={async () => { await startAuction.mutateAsync({ tournamentId }); invalidate(); }}
              disabled={startAuction.isPending}
            >
              <Play className="w-3 h-3" />
              {isPaused ? "Resume" : isTrialMode ? "Start (Trial)" : "Start Auction"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 text-xs px-3 flex-shrink-0"
              onClick={async () => { await pauseAuction.mutateAsync({ tournamentId }); invalidate(); }}
            >
              <Pause className="w-3 h-3" /> Pause
            </Button>
          )}

          {/* Undo */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleUndo}
            disabled={undoAction.isPending}
            title="Undo Last Action"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>

          <div className="flex-1 min-w-0" />

          {/* Trial badge */}
          {isTrialMode && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
              Trial Mode
            </span>
          )}

          {/* LED overlay controls */}
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-border bg-card/50 flex-shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground pr-1 border-r border-border mr-0.5">LED<br/>SCREEN</span>
            {ledOverlayButtons.map(({ mode, label, icon: Icon, bg }) => {
              const active = state?.displayOverlay === mode;
              return (
                <button
                  key={mode}
                  title={active ? `Currently showing ${label} on LED — click to go back to live auction` : `Show ${label} overlay on LED screen`}
                  onClick={async () => {
                    await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: active ? "off" : mode } });
                    invalidate();
                  }}
                  disabled={setDisplayOverlay.isPending}
                  className={`flex items-center gap-1.5 h-8 px-2.5 rounded text-[11px] font-bold transition-all ${
                    active ? `${bg} shadow-md ring-1 ring-white/20` : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
            {state?.displayOverlay ? (
              <button
                title="Return LED screen to the live auction player view"
                className="flex items-center gap-1.5 h-8 px-2.5 rounded text-[11px] font-bold text-green-400 hover:bg-green-500/15 border-l border-border ml-0.5 pl-2 transition-colors"
                onClick={async () => { await setDisplayOverlay.mutateAsync({ tournamentId, data: { mode: "off" } }); invalidate(); }}
              >
                <Tv2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>LIVE</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 h-8 px-2 text-[9px] text-green-500/60 font-semibold border-l border-border ml-0.5 pl-2">
                <Tv2 className="w-3 h-3" /> Live
              </span>
            )}
          </div>

          {/* Display theme dots + Open Display */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-0.5 border border-border/50 rounded-md px-1.5 py-1">
              {DISPLAY_THEMES_LIST.map(t => (
                <button
                  key={t.id}
                  title={t.label}
                  onClick={() => handleDisplayThemeChange(t.id)}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    displayTheme === t.id
                      ? "ring-1 ring-white ring-offset-1 ring-offset-background scale-110"
                      : "opacity-50 hover:opacity-90"
                  }`}
                  style={{ backgroundColor: t.dot }}
                />
              ))}
            </div>
            <a
              href={`/tournament/${tournamentId}/display?theme=${displayTheme}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs px-2 sm:px-2.5">
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Display</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-50 hidden sm:inline" />
              </Button>
            </a>
          </div>

          {/* Connection status dot */}
          <div
            title={
              connectionStatus === "connected" ? "Feed connected"
              : connectionStatus === "reconnecting" ? "Reconnecting to feed…"
              : "Feed disconnected"
            }
            className={`flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold flex-shrink-0 transition-colors ${
              connectionStatus === "connected"
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : connectionStatus === "reconnecting"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            {connectionStatus === "connected" ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : connectionStatus === "reconnecting" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {connectionStatus === "connected" ? "Live"
               : connectionStatus === "reconnecting" ? "Reconnecting"
               : "Offline"}
            </span>
          </div>

          {/* Active countdown badge — visible at a glance in the top bar */}
          {currentCountdown && currentCountdown.endsAt && (
            <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-semibold flex-shrink-0">
              {currentCountdown.type === "break" ? (
                <Coffee className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <AlarmClock className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <CountdownClock endsAt={currentCountdown.endsAt} />
              <button
                onClick={handleCancelCountdown}
                disabled={setBreakTimerMut.isPending || setPreAuctionMut.isPending}
                title="End break now"
                className="ml-1 h-4 w-4 flex items-center justify-center rounded bg-amber-500/20 hover:bg-red-500/30 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Right panel toggle (desktop only) */}
          <button
            title={rightCollapsed ? "Show Teams & Purse" : "Hide Teams & Purse"}
            onClick={() => setRightCollapsed(v => !v)}
            className={`hidden lg:flex items-center justify-center h-7 w-7 rounded border transition-colors flex-shrink-0 ${
              rightCollapsed
                ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {rightCollapsed ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Reconnecting / disconnected inline banner */}
        {connectionStatus !== "connected" && (
          <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-1 text-xs border-b ${
            connectionStatus === "disconnected"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
          }`}>
            {connectionStatus === "disconnected" ? (
              <WifiOff className="w-3 h-3 flex-shrink-0" />
            ) : (
              <RefreshCw className="w-3 h-3 flex-shrink-0 animate-spin" />
            )}
            {connectionStatus === "disconnected"
              ? "Feed disconnected — updates may be delayed. Attempting to reconnect…"
              : "Reconnecting to live feed — bid updates may be delayed…"}
          </div>
        )}

        {/* ─── 3-COLUMN MAIN AREA ─────────────────────────────────────────── */}
        <div className={`flex-1 grid grid-cols-1 min-h-0 overflow-hidden ${rightCollapsed ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-[260px_1fr_284px]"}`}>

          {/* ═══════════════════ LEFT: PLAYER QUEUE ═══════════════════════ */}
          <aside className={`border-r border-border flex-col min-h-0 overflow-hidden bg-card/20 ${mobilePanel === "queue" ? "flex" : "hidden"} lg:flex`}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Player Queue
                  <span className="ml-1.5 text-muted-foreground font-normal">
                    ({reAuctionTab === "queue" ? filteredQueue.length : reAuctionTab === "sold" ? soldPlayers.length : unsoldPlayers.length})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  title="Category filter"
                  onClick={openCategoryFilter}
                  className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                    activeCategoryIds && activeCategoryIds.length > 0
                      ? "text-blue-400 bg-blue-500/15"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Random player"
                  disabled={!isActive || nextPlayer.isPending}
                  onClick={() => handleNextPlayer("random")}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tab switcher: Queue / Sold / Unsold */}
            <div className="flex gap-0.5 px-2 py-1.5 border-b border-border flex-shrink-0 bg-card/30">
              {(["queue", "sold", "unsold"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setReAuctionTab(tab); setPlayerSearch(""); setRoleFilter("all"); }}
                  className={`flex-1 text-[10px] py-1 px-1 rounded font-semibold capitalize transition-all ${
                    reAuctionTab === tab
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "queue" ? `Queue (${filteredQueue.length})` : tab === "sold" ? `Sold (${soldPlayers.length})` : `Unsold (${unsoldPlayers.length})`}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-2 py-1.5 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                <input
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  placeholder="Search player..."
                  className="w-full h-7 pl-6 pr-6 bg-background/60 border border-border rounded text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                {playerSearch && (
                  <button onClick={() => setPlayerSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Role filter tabs — only shown for queue tab */}
            {reAuctionTab === "queue" && (
              <div className="flex gap-1 px-2 pb-2 flex-shrink-0 flex-wrap">
                {([
                  { key: "all", label: `ALL`, count: filteredQueue.length },
                  { key: "bat", label: `BAT`, count: roleCounts.bat },
                  { key: "bowl", label: `BOWL`, count: roleCounts.bowl },
                  { key: "ar", label: `AR`, count: roleCounts.ar },
                  ...(roleCounts.wk > 0 ? [{ key: "wk", label: `WK`, count: roleCounts.wk }] : []),
                ] as { key: string; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setRoleFilter(key)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide transition-all ${
                      roleFilter === key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground bg-muted/40 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                    <span className={`text-[9px] font-mono ${roleFilter === key ? "opacity-80" : "opacity-60"}`}>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active category filter label */}
            {activeCategoryIds && activeCategoryIds.length > 0 && (
              <div className="px-2 pb-1 flex-shrink-0 flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-blue-400 font-semibold">CAT:</span>
                {activeCategoryIds.map(id => (
                  <span key={id} className="text-[9px] px-1 rounded" style={{ color: categoryMap[id]?.colorCode || "#60a5fa", backgroundColor: `${categoryMap[id]?.colorCode || "#60a5fa"}15` }}>
                    {categoryMap[id]?.name || `#${id}`}
                  </span>
                ))}
                <button onClick={clearCategoryFilter} className="text-[9px] text-muted-foreground hover:text-red-400 ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Batch re-auction button */}
            {reAuctionTab === "unsold" && available.length === 0 && unsoldPlayers.length > 0 && (
              <div className="px-2 pb-1.5 flex-shrink-0">
                <button
                  onClick={() => setShowBatchReAuctionConfirm(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all"
                >
                  <RotateCcw className="w-3 h-3" /> Re-auction all {unsoldPlayers.length} unsold
                </button>
              </div>
            )}

            {/* Scrollable player list */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-0.5 p-2">
                {leftPanelList.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-6">
                    {playerSearch ? "No matches" : reAuctionTab === "queue" ? "Queue empty" : `No ${reAuctionTab} players`}
                  </p>
                ) : leftPanelList.slice(0, 80).map((player, idx) => {
                  const cat = player.categoryId ? categoryMap[player.categoryId] : null;
                  const isQueue = reAuctionTab === "queue";
                  const isCurrentPlayer = state?.currentPlayer?.id === player.id;
                  const team = player.teamId ? teamMap[player.teamId] : null;
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                        isCurrentPlayer ? "bg-primary/10 border border-primary/30" : "hover:bg-accent/50"
                      }`}
                    >
                      <span className="text-[10px] text-muted-foreground font-mono w-5 text-right flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          {player.jerseyNumber && (
                            <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">#{player.jerseyNumber}</span>
                          )}
                          <span className="text-xs font-medium truncate">{player.name}</span>
                          {isQueue && deferredPlayerIds?.includes(player.id) && (
                            <Hourglass className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 opacity-70" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {player.role && (
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">{player.role}</span>
                          )}
                          {cat && (
                            <span className="text-[9px] font-semibold" style={{ color: cat.colorCode || "#888" }}>{cat.name}</span>
                          )}
                          {team && !isQueue && (
                            <span className="text-[9px] text-muted-foreground truncate">{team.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {formatShortIndianRupee(player.soldPrice || player.basePrice)}
                        </span>
                        {isQueue ? (
                          <button
                            disabled={!isActive || nextPlayer.isPending || selectionMode !== "manual"}
                            title={selectionMode !== "manual" ? "Switch to Manual mode to pick from queue" : undefined}
                            onClick={() => handleNextPlayer("sequential", player.id)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed font-semibold transition-all"
                          >
                            Go
                          </button>
                        ) : (
                          <button
                            disabled={reAuction.isPending}
                            onClick={() => handleReAuction(player.id, true)}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-30 disabled:cursor-not-allowed font-semibold flex items-center gap-0.5 transition-all"
                          >
                            <RotateCcw className="w-2 h-2" /> Re
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          {/* ══════════════════ CENTER: AUCTION CONTROL ════════════════════ */}
          <main className={`flex-col min-h-0 overflow-hidden ${mobilePanel === "control" ? "flex" : "hidden"} lg:flex`}>

            {/* Sub-header: timer control row */}
            <div className="flex-shrink-0 h-10 border-b border-border bg-card/30 flex items-center gap-2 px-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-shrink-0">Timer</span>
              <ServerCountdown
                variant="operator"
                timerEndsAt={state?.timerEndsAt}
                timerType={state?.timerType}
                fallback={
                  <span className="text-xs text-muted-foreground">{hasPlayer ? "Ready to bid" : "No player"}</span>
                }
              />
              <div className="flex items-center gap-1.5 ml-auto">
                <Input
                  type="number"
                  value={timerSecs}
                  onChange={e => { timerSecsUserEdited.current = true; setTimerSecs(e.target.value); }}
                  className="w-14 h-7 text-center text-xs"
                  min={5} max={300}
                />
                <span className="text-[10px] text-muted-foreground flex-shrink-0">sec</span>
                {timerActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                    onClick={handleExtendTimer}
                    disabled={startTimerMut.isPending}
                    title="Add 30s to timer"
                  >
                    +30s
                  </Button>
                )}
              </div>
            </div>

            {/* Scrollable control area */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-3 space-y-3 max-w-3xl mx-auto">

                {/* ── Current Player Card ── */}
                <AnimatePresence mode="wait">
                  {hasPlayer ? (
                    <motion.div
                      key={state?.currentPlayer?.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-xl border border-primary/25 bg-gradient-to-r from-card to-card/60 overflow-hidden"
                    >
                      <div className="flex items-stretch gap-0">
                        {/* Photo */}
                        <div className="w-20 h-24 flex-shrink-0 bg-muted/30 flex items-center justify-center overflow-hidden">
                          {state?.currentPlayer?.photoUrl ? (
                            <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-9 h-9 text-muted-foreground opacity-30" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 px-4 py-3 min-w-0">
                          <div className="flex items-start gap-2 justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {state?.currentPlayer?.role?.toUpperCase() || "PLAYER"}
                                {state?.currentPlayer?.categoryId && categoryMap[state.currentPlayer.categoryId] && (
                                  <span className="ml-2" style={{ color: categoryMap[state.currentPlayer.categoryId].colorCode || undefined }}>
                                    · {categoryMap[state.currentPlayer.categoryId].name}
                                  </span>
                                )}
                              </p>
                              <h2 className="text-2xl font-display font-bold leading-tight mt-0.5 truncate">
                                {state?.currentPlayer?.name}
                              </h2>
                            </div>
                            {state?.currentPlayer?.jerseyNumber && (
                              <span className="text-2xl font-display font-black text-primary/40 flex-shrink-0 leading-none">
                                #{state.currentPlayer.jerseyNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {state?.currentPlayer?.age && (
                              <span className="text-[10px] text-muted-foreground">Age <span className="text-foreground font-semibold">{state.currentPlayer.age}</span></span>
                            )}
                            {state?.currentPlayer?.city && (
                              <span className="text-[10px] text-muted-foreground">{state.currentPlayer.city}</span>
                            )}
                            {[
                              state?.currentPlayer?.battingStyle,
                              state?.currentPlayer?.bowlingStyle,
                              state?.currentPlayer?.specialization,
                            ].map((val, i) => {
                              if (!val) return null;
                              const label = currentPlayerSpecGroups[i]?.groupName;
                              return (
                                <span key={i} className="text-[10px] text-muted-foreground">
                                  {label ? <><span className="opacity-60">{label}:</span> {val}</> : val}
                                </span>
                              );
                            })}
                            <span className="text-[10px] text-muted-foreground">Base <span className="text-foreground font-semibold">{formatShortIndianRupee(state?.currentPlayer?.basePrice)}</span></span>
                            {state?.currentPlayer?.availabilityDates && (
                              <span className="text-[10px] text-blue-400">Avail: {state.currentPlayer.availabilityDates}</span>
                            )}
                          </div>
                          {state?.currentPlayer?.achievements && (
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{state.currentPlayer.achievements}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="no-player"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="rounded-xl border-2 border-dashed border-border h-24 flex items-center justify-center"
                    >
                      <div className="text-center text-muted-foreground">
                        <User className="w-7 h-7 mx-auto mb-1 opacity-30" />
                        <p className="text-sm font-medium">No player on block</p>
                        <p className="text-xs mt-0.5 opacity-60">Select from queue or click Next Player</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Current Bid + Leading Team ── */}
                <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                      Current Bid <span className="normal-case font-normal opacity-70">(+{formatShortIndianRupee(increment)}/raise)</span>
                    </p>
                    <motion.p
                      key={state?.currentBid}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="text-4xl font-display font-black text-primary leading-none"
                      style={{ textShadow: "0 0 24px rgba(234,179,8,0.4)" }}
                    >
                      {formatIndianRupee(state?.currentBid || 0)}
                    </motion.p>
                    {hasPlayer && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Base: {formatIndianRupee(state?.currentPlayer?.basePrice)}
                      </p>
                    )}
                  </div>
                  {hasBid ? (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Leading</p>
                      <div className="flex items-center gap-2 justify-end">
                        <div
                          className="w-2.5 h-2.5 rounded-full animate-pulse"
                          style={{ backgroundColor: state?.currentBidTeamColor || "#fff" }}
                        />
                        <span className="font-bold text-base leading-tight" style={{ color: state?.currentBidTeamColor || "inherit" }}>
                          {state?.currentBidTeamName}
                        </span>
                      </div>
                    </div>
                  ) : hasPlayer ? (
                    <div className="text-right flex-shrink-0 opacity-40">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">No bid yet</p>
                    </div>
                  ) : null}
                </div>

                {/* ── SOLD / UNSOLD / DEFER / MANUAL ──
                    Locked while the bid timer is running — operator must stop
                    bidding (or wait for timer to expire) before concluding. */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    disabled={!hasBid || timerActive || sellPlayer.isPending}
                    onClick={handleSell}
                    title={timerActive ? "Stop bidding first" : undefined}
                    className="col-span-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-green-600/15 border-green-600/60 text-green-400 hover:bg-green-600/25 enabled:hover:scale-[1.02] enabled:shadow-[0_0_16px_rgba(34,197,94,0.3)]"
                  >
                    <CheckCircle className="w-5 h-5" />
                    SOLD
                  </button>
                  <button
                    disabled={!hasPlayer || timerActive || markUnsold.isPending}
                    onClick={handleUnsold}
                    title={timerActive ? "Stop bidding first" : undefined}
                    className="col-span-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-red-600/10 border-red-600/50 text-red-400 hover:bg-red-600/20 enabled:hover:scale-[1.02]"
                  >
                    <XCircle className="w-5 h-5" />
                    UNSOLD
                  </button>
                  <button
                    disabled={!hasPlayer || timerActive || deferPlayerMut.isPending}
                    onClick={handleDeferPlayer}
                    title={timerActive ? "Stop bidding first" : "Defer to back of queue"}
                    className="col-span-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/15 enabled:hover:scale-[1.02]"
                  >
                    <Hourglass className="w-5 h-5" />
                    DEFER
                  </button>
                  <button
                    disabled={!hasPlayer || timerActive}
                    onClick={() => {
                      setManualAmount(String(state?.currentBid || state?.currentPlayer?.basePrice || 0));
                      setManualTeamId("");
                      setManualSellOpen(true);
                    }}
                    title={timerActive ? "Stop bidding first" : undefined}
                    className="col-span-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed bg-blue-500/10 border-blue-500/40 text-blue-400 hover:bg-blue-500/15 enabled:hover:scale-[1.02]"
                  >
                    <Settings2 className="w-5 h-5" />
                    MANUAL
                  </button>
                </div>

                {/* ── NEXT PLAYER (3/5) + START/STOP BIDDING (2/5) ──
                    NEXT PLAYER is the primary CTA (larger); START/STOP toggles
                    the bid timer. Concluding actions above are locked while the
                    timer is active to prevent accidental skips. */}
                <div className="grid grid-cols-5 gap-2">
                  <button
                    disabled={!isActive || timerActive || nextPlayer.isPending}
                    onClick={() => handleNextPlayer(selectionMode === "random" ? "random" : "sequential")}
                    title={timerActive ? "Stop bidding first" : undefined}
                    className="col-span-3 flex items-center justify-center gap-3 py-4 rounded-xl font-display font-black text-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-primary/90 to-primary text-black hover:from-primary hover:to-primary/90 enabled:shadow-[0_0_30px_rgba(234,179,8,0.45)] enabled:hover:scale-[1.01] enabled:hover:shadow-[0_0_40px_rgba(234,179,8,0.55)]"
                  >
                    {selectionMode === "random" ? <Shuffle className="w-6 h-6" /> : <SkipForward className="w-6 h-6" />}
                    NEXT PLAYER
                    {nextPlayer.isPending ? (
                      <span className="text-sm font-normal opacity-60">Loading...</span>
                    ) : selectionMode === "random" ? (
                      <span className="text-sm font-normal opacity-60">(Random)</span>
                    ) : (
                      <span className="text-sm font-normal opacity-60 font-mono">N</span>
                    )}
                  </button>
                  {timerActive ? (
                    <button
                      onClick={handleStopTimer}
                      disabled={stopTimerMut.isPending}
                      className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-black text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 text-white hover:bg-red-500 enabled:shadow-[0_0_24px_rgba(220,38,38,0.5)] enabled:hover:scale-[1.01]"
                    >
                      <Pause className="w-5 h-5" />
                      STOP BIDDING
                    </button>
                  ) : (
                    <button
                      onClick={handleStartTimer}
                      disabled={!hasPlayer || startTimerMut.isPending}
                      className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-display font-black text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 enabled:shadow-[0_0_24px_rgba(16,185,129,0.5)] enabled:hover:scale-[1.01]"
                    >
                      <Timer className="w-5 h-5" />
                      START BIDDING
                    </button>
                  )}
                </div>

                {/* ── LED Countdown (Break / Pre-Auction) ── */}
                <div className="rounded-xl border border-border bg-card/30 p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      LED Countdown
                    </p>
                    {currentCountdown && (
                      <button
                        onClick={handleCancelCountdown}
                        disabled={setBreakTimerMut.isPending || setPreAuctionMut.isPending}
                        className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    )}
                  </div>
                  {currentCountdown ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {currentCountdown.type === "break" ? (
                          <Coffee className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        ) : (
                          <AlarmClock className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {currentCountdown.type === "break" ? "Break Timer" : "Pre-Auction Countdown"}
                          </p>
                          {currentCountdown.message && (
                            <p className="text-[10px] text-muted-foreground truncate">{currentCountdown.message}</p>
                          )}
                        </div>
                        {currentCountdown.endsAt && (
                          <CountdownClock endsAt={currentCountdown.endsAt} />
                        )}
                      </div>
                      {currentCountdown.type === "break" && (
                        <button
                          onClick={async () => {
                            try {
                              await setBreakTimerMut.mutateAsync({ tournamentId, data: { action: "extend", durationSeconds: 300 } });
                            } catch { /* ignore */ }
                          }}
                          disabled={setBreakTimerMut.isPending}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-colors disabled:opacity-40"
                        >
                          <PlusCircle className="w-3 h-3" />
                          Extend +5 min
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openCountdownDialog("break")}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 text-xs font-semibold transition-colors"
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        Break Timer
                      </button>
                      <button
                        onClick={() => openCountdownDialog("pre-auction")}
                        disabled={isActive}
                        title={isActive ? "Cannot show pre-auction countdown while auction is active" : undefined}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <AlarmClock className="w-3.5 h-3.5" />
                        Pre-Auction
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Quick Bid Team Grid ── */}
                {teams && teams.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Quick Bid · Next: <span className="text-primary font-mono">{formatShortIndianRupee((state?.currentBid || 0) + increment)}</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {teams.map(team => {
                        const purseData = teamPurses?.find(p => p.teamId === team.id);
                        const spendable = purseData?.spendablePurse ?? (team.purse - (team.purseUsed || 0));
                        const reserved = purseData?.reservePurse ?? 0;
                        const slotsNeeded = purseData?.slotsRequired ?? 0;
                        const qbPlayersBought = purseData?.playersBought ?? 0;
                        const qbMaxSquad = purseData?.maximumSquadSize ?? 0;
                        const qbMaxReached = qbMaxSquad > 0 && qbPlayersBought >= qbMaxSquad;
                        const isLeading = state?.currentBidTeamId === team.id;
                        const nextBid = (state?.currentBid || 0) + increment;
                        const isTrialRestricted = isTrialMode && trialTeamIds !== null && !trialTeamIds.includes(team.id);
                        const canBid = isActive && hasPlayer && timerActive && spendable >= nextBid && !!team.isBiddingEnabled && !isLeading && !isTrialRestricted && !qbMaxReached;
                        return (
                          <button
                            key={team.id}
                            disabled={!canBid}
                            onClick={() => handleBid(team.id)}
                            className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                              isLeading ? "scale-[1.01]" : "border-border"
                            } ${!canBid ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"}`}
                            style={{
                              borderColor: isLeading ? team.color || "#fff" : undefined,
                              boxShadow: isLeading ? `0 0 16px ${team.color}44` : undefined,
                            }}
                          >
                            {isLeading && (
                              <div className="absolute top-1.5 right-2 flex items-center gap-0.5">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: team.color || "#fff" }} />
                                <span className="text-[9px] font-bold" style={{ color: team.color || "#fff" }}>LEAD</span>
                              </div>
                            )}
                            {isTrialRestricted && (
                              <div className="absolute inset-0 rounded-xl bg-background/60 flex items-center justify-center">
                                <span className="text-[9px] font-bold text-amber-400/70 uppercase">Trial</span>
                              </div>
                            )}
                            {qbMaxReached && !isTrialRestricted && (
                              <div className="absolute top-1.5 right-2">
                                <span className="text-[8px] font-bold text-red-400 uppercase">Full</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mb-1">
                              {team.logoUrl ? (
                                <img src={team.logoUrl} alt={team.name} className="w-5 h-5 rounded object-contain flex-shrink-0" />
                              ) : (
                                <div
                                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0"
                                  style={{ backgroundColor: `${team.color}33`, color: team.color || "#fff" }}
                                >
                                  {team.shortCode?.slice(0, 2)}
                                </div>
                              )}
                              <span className="text-xs font-bold truncate">{team.shortCode || team.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] text-muted-foreground">{formatShortIndianRupee(spendable)} spendable</p>
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

          {/* ══════════════════ RIGHT: TEAMS + HISTORY ═════════════════════ */}
          <aside className={`border-l border-border flex-col min-h-0 overflow-hidden bg-card/20 ${mobilePanel === "teams" ? "flex" : "hidden"} ${rightCollapsed ? "lg:hidden" : "lg:flex"}`}>

            {/* Teams & Purse */}
            <div className="flex flex-col flex-shrink-0" style={{ maxHeight: "52%" }}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider">Teams &amp; Purse</span>
                </div>
                <a
                  href={`/tournament/${tournamentId}/teams`}
                  className="text-[9px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                >
                  All <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 grid grid-cols-2 gap-1.5">
                  {(teams || []).map(team => {
                    const purseData = teamPurses?.find(p => p.teamId === team.id);
                    const purseLeft = team.purse - (team.purseUsed || 0);
                    const spendable = purseData?.spendablePurse ?? purseLeft;
                    const reserved = purseData?.reservePurse ?? 0;
                    const slotsNeeded = purseData?.slotsRequired ?? 0;
                    const cardPlayersBought = purseData?.playersBought ?? 0;
                    const cardMaxSquad = purseData?.maximumSquadSize ?? 0;
                    const cardMaxReached = cardMaxSquad > 0 && cardPlayersBought >= cardMaxSquad;
                    const isLeading = state?.currentBidTeamId === team.id;
                    const usedPct = Math.min(100, Math.round(((team.purseUsed || 0) / team.purse) * 100));
                    return (
                      <div
                        key={team.id}
                        className={`rounded-lg p-2 border transition-all ${
                          isLeading ? "border-2 scale-[1.02]" : "border-border"
                        }`}
                        style={{
                          borderColor: isLeading ? team.color || "#fff" : undefined,
                          boxShadow: isLeading ? `0 0 12px ${team.color}33` : undefined,
                          backgroundColor: `${team.color || "#888"}08`,
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {team.logoUrl ? (
                            <img src={team.logoUrl} alt={team.name} className="w-5 h-5 rounded object-contain flex-shrink-0" />
                          ) : (
                            <div
                              className="w-5 h-5 rounded text-[8px] font-mono font-black flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${team.color}25`, color: team.color || "#fff" }}
                            >
                              {team.shortCode?.slice(0, 3) || "T"}
                            </div>
                          )}
                          <span className="text-[10px] font-bold truncate">{team.shortCode || team.name}</span>
                          {isLeading && (
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: team.color || "#fff" }} />
                          )}
                          {reserved > 0 && (
                            <span title={`${formatShortIndianRupee(reserved)} reserved for ${slotsNeeded} slot${slotsNeeded !== 1 ? "s" : ""}`} className="flex-shrink-0 ml-auto">
                              <ShieldAlert className="w-2.5 h-2.5 text-amber-400/60" />
                            </span>
                          )}
                        </div>
                        {/* Spendable (max bid) */}
                        <p className={`text-xs font-mono font-bold ${cardMaxReached ? "text-red-400" : "text-emerald-400"}`}>
                          {cardMaxReached ? "FULL" : formatShortIndianRupee(spendable)}
                        </p>
                        <p className="text-[8px] text-muted-foreground/50 leading-none">max bid</p>
                        {reserved > 0 && (
                          <p className="text-[9px] text-amber-400/60 font-mono leading-tight mt-0.5">
                            +{formatShortIndianRupee(reserved)} rsv · {slotsNeeded}slot{slotsNeeded !== 1 ? "s" : ""}
                          </p>
                        )}
                        {/* Purse bar */}
                        <div className="mt-1 h-1 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${usedPct}%`, backgroundColor: team.color || "#888" }}
                          />
                        </div>
                        {/* Squad + top player */}
                        <div className="flex items-center justify-between mt-0.5">
                          <span className={`text-[9px] font-medium ${
                            cardMaxReached ? "text-red-400" : slotsNeeded > 0 ? "text-amber-400" : cardPlayersBought > 0 ? "text-green-400/70" : "text-muted-foreground"
                          }`}>
                            {cardPlayersBought}{cardMaxSquad > 0 ? `/${cardMaxSquad}` : ""}p
                          </span>
                          {slotsNeeded > 0 && !cardMaxReached && <span className="text-[8px] text-amber-400/60">need {slotsNeeded}</span>}
                          {cardMaxReached && <span className="text-[8px] text-red-400 font-bold">FULL</span>}
                        </div>
                        {purseData?.topPlayerName && (
                          <div className="flex items-center gap-0.5 mt-0.5 min-w-0">
                            <Star className="w-2 h-2 flex-shrink-0 text-amber-400/50" />
                            <span className="text-[8px] text-muted-foreground/60 truncate">{purseData.topPlayerName}</span>
                            {purseData.topPlayerAmount != null && (
                              <span className="text-[8px] font-mono text-amber-400/60 flex-shrink-0 ml-auto tabular-nums">{formatShortIndianRupee(purseData.topPlayerAmount)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!teams?.length && (
                    <p className="col-span-2 text-center text-xs text-muted-foreground py-4">No teams</p>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Last Actions / Bid History */}
            <div className="flex-1 flex flex-col min-h-0 border-t border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-wider">Last Actions</span>
                </div>
              </div>
              {state?.lastAction && (
                <div className="px-3 py-1.5 bg-primary/5 border-b border-primary/15 flex-shrink-0">
                  <p className="text-[10px] text-primary/80 font-medium truncate">{state.lastAction}</p>
                </div>
              )}
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-0 p-2">
                  {(bids || []).slice(0, 30).map(bid => (
                    <div
                      key={bid.id}
                      className="flex items-center justify-between py-1.5 px-1 border-b border-border/40 last:border-0 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bid.teamColor || "#666" }} />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground truncate">{bid.playerName}</p>
                          <p className="text-[9px] text-muted-foreground/60 truncate">{bid.teamName}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-primary flex-shrink-0">
                        {formatShortIndianRupee(bid.amount)}
                      </span>
                    </div>
                  ))}
                  {!bids?.length && (
                    <p className="text-center text-xs text-muted-foreground py-6">No bids yet</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </aside>

        </div>{/* end 3-col grid */}

        {/* ─── MOBILE BOTTOM TAB BAR ──────────────────────────────────────── */}
        <div className="lg:hidden flex-shrink-0 flex border-t border-border bg-card/90 backdrop-blur">
          {([
            { id: "queue" as const, label: "Queue", icon: ListOrdered, badge: filteredQueue.length },
            { id: "control" as const, label: "Controls", icon: Gavel, badge: null },
            { id: "teams" as const, label: "Teams", icon: Trophy, badge: teams?.length ?? null },
          ]).map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setMobilePanel(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors relative ${
                mobilePanel === id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mobilePanel === id && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-b-full" />
              )}
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              {badge !== null && badge > 0 && (
                <span className={`absolute top-1.5 right-[calc(50%-18px)] text-[9px] font-black px-1 rounded-full min-w-[14px] text-center leading-[14px] ${
                  mobilePanel === id ? "bg-primary text-black" : "bg-muted text-muted-foreground"
                }`}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          ))}
        </div>

      </div>{/* end flex col */}

      {/* ─── DIALOGS (unchanged) ─────────────────────────────────────────── */}

      {/* Category Filter */}
      <Dialog open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-blue-400" /> Category Filter
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select which categories are eligible for the next player selection. Leave all unchecked to include all categories.
            </p>
            <div className="space-y-2">
              {(categories || []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(cat => {
                const isSelected = pendingCategoryIds.includes(cat.id);
                const playersInCat = available.filter(p => p.categoryId === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setPendingCategoryIds(prev =>
                        prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                      );
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      isSelected ? "border-blue-500/60 bg-blue-500/10" : "border-border bg-card/50 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colorCode || "#888" }} />
                      <div>
                        <span className="text-sm font-semibold">{cat.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{playersInCat} available</span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-blue-500 border-blue-500" : "border-border"}`}>
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" style={{ strokeWidth: 3 }} />}
                    </div>
                  </button>
                );
              })}
              {(!categories || categories.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-4">No categories configured</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500"
                onClick={applyCategoryFilter}
                disabled={setCategoryFilter.isPending}
              >
                {pendingCategoryIds.length > 0 ? `Apply (${pendingCategoryIds.length} selected)` : "Apply — All Categories"}
              </Button>
              <Button variant="outline" onClick={() => setCategoryFilterOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Sell */}
      <Dialog open={manualSellOpen} onOpenChange={(open) => { setManualSellOpen(open); if (!open) manualSellMut.reset(); }}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" /> Manual Sell
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sell <strong className="text-foreground">{state?.currentPlayer?.name}</strong> directly to a team at a set price.
            </p>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={manualTeamId} onValueChange={(v) => { setManualTeamId(v); manualSellMut.reset(); }}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent className="dark">
                  {(teams || []).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || "#666" }} />
                        {t.name} — {formatShortIndianRupee(t.purse - t.purseUsed)} left
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={manualAmount}
                onChange={e => { setManualAmount(e.target.value); manualSellMut.reset(); }}
                placeholder="e.g. 500000"
              />
              {(() => {
                const selectedTeam = (teams || []).find(t => String(t.id) === manualTeamId);
                const enteredAmt = parseInt(manualAmount) || 0;
                const purseLeft = selectedTeam ? selectedTeam.purse - selectedTeam.purseUsed : null;
                if (selectedTeam && enteredAmt > 0 && purseLeft !== null && enteredAmt > purseLeft) {
                  return (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <span>Exceeds {selectedTeam.name}&apos;s remaining purse of {formatShortIndianRupee(purseLeft)}</span>
                    </p>
                  );
                }
                return null;
              })()}
            </div>
            {manualSellMut.error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">
                {(manualSellMut.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Sale failed"}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500"
                disabled={!manualTeamId || !manualAmount || manualSellMut.isPending}
                onClick={handleManualSell}
              >
                Confirm Sell
              </Button>
              <Button variant="outline" onClick={() => setManualSellOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Break Timer / Pre-Auction Countdown Dialog */}
      <Dialog open={countdownDialogOpen} onOpenChange={setCountdownDialogOpen}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {countdownDialogType === "break" ? (
                <><Coffee className="w-5 h-5 text-amber-400" /> Break Timer</>
              ) : (
                <><AlarmClock className="w-5 h-5 text-primary" /> Pre-Auction Countdown</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {countdownDialogType === "break"
                ? "Show a break countdown on the LED display. Countdown auto-clears when the next player is loaded."
                : "Show a pre-auction countdown on the LED display before the auction begins."}
            </p>

            {/* Duration controls — break only; pre-auction is always 10 s */}
            {countdownDialogType === "break" ? (
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 block">Duration</Label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[5, 10, 15, 30].map(mins => (
                    <button
                      key={mins}
                      onClick={() => setCountdownMinutes(String(mins))}
                      className={`py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                        countdownMinutes === String(mins)
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={countdownMinutes}
                    onChange={e => setCountdownMinutes(e.target.value)}
                    min={0.5}
                    max={60}
                    step={0.5}
                    className="w-24 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <AlarmClock className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-primary font-semibold">Fixed 10-second countdown</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Custom Label <span className="normal-case font-normal">(optional)</span>
              </Label>
              <Input
                value={countdownLabel}
                onChange={e => setCountdownLabel(e.target.value)}
                placeholder={countdownDialogType === "break" ? "e.g. Back soon" : "e.g. Auction starts in"}
                maxLength={60}
                className="text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                className={`flex-1 ${countdownDialogType === "break" ? "bg-amber-600 hover:bg-amber-500" : "bg-primary hover:bg-primary/90 text-black"}`}
                disabled={(countdownDialogType === "break" && (!countdownMinutes || parseFloat(countdownMinutes) <= 0)) || setBreakTimerMut.isPending || setPreAuctionMut.isPending}
                onClick={handleStartCountdown}
              >
                Start Countdown
              </Button>
              <Button variant="outline" onClick={() => setCountdownDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Re-auction Confirm */}
      <Dialog open={showBatchReAuctionConfirm} onOpenChange={setShowBatchReAuctionConfirm}>
        <DialogContent className="max-w-sm dark border-orange-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <RotateCcw className="w-5 h-5" /> Start Unsold Player Round
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3">
              <p className="text-sm text-orange-200/90">
                All <span className="font-bold text-orange-300">{unsoldPlayers.length} unsold player{unsoldPlayers.length !== 1 ? "s" : ""}</span> will be moved back to the queue as "Available". Sold players and team purses are not affected.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              The auction will continue normally — use "Next Player" to start auctioning them again.
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white"
                disabled={reAuctionAllUnsoldMut.isPending}
                onClick={handleBatchReAuction}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Re-auction {unsoldPlayers.length} Players
              </Button>
              <Button variant="outline" onClick={() => setShowBatchReAuctionConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
